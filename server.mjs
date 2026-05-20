import express from "express";
import multer  from "multer";
import bcrypt  from "bcryptjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { randomBytes } from "crypto";
import {
  createUser, findUserByEmail, findUserById,
  updateUser, saveRecipe, getUserRecipes, deleteRecipe,
} from "./db.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

let API_KEY;
try {
  const env = readFileSync(join(__dir, ".env"), "utf8");
  API_KEY = env.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim();
} catch (err) {
  console.error(".env 파일을 읽을 수 없습니다:", err.message);
  process.exit(1);
}
if (!API_KEY) {
  console.error("OPENROUTER_API_KEY가 .env에 설정되어 있지 않습니다.");
  process.exit(1);
}

// ── 세션 스토어 (인메모리) ─────────────────────────────────────────
const sessions = new Map(); // token → userId

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  return token;
}
function verifySession(token) { return sessions.get(token) ?? null; }
function destroySession(token) { sessions.delete(token); }

// ── 미들웨어 ──────────────────────────────────────────────────────
const app = express();

app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline';"
  );
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("JPEG, PNG, WebP 파일만 업로드 가능합니다."));
  },
});

function uploadMiddleware(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

app.use(express.static(join(__dir, "public")));
app.use(express.json({ limit: "2mb" }));

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
  const userId = verifySession(token);
  if (!userId) return res.status(401).json({ error: "세션이 만료됐습니다. 다시 로그인해주세요." });
  req.userId = userId;
  next();
}

function sanitizeUser(user) {
  const { password_hash: _, ...safe } = user;
  return safe;
}

function fetchWithTimeout(url, options, ms = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── 입력값 화이트리스트 ────────────────────────────────────────────
const VALID_TIMES      = new Set([0, 15, 30]);
const VALID_DIFFS      = new Set(["", "쉬움", "보통", "어려움"]);
const VALID_DIETARY    = new Set(["채식/비건", "글루텐 프리", "유제품 제외", "견과류 제외"]);
const VALID_STYLES     = new Set(["한식", "양식", "중식", "일식", "인도식"]);

// ════════════════════════════════════════════════════════════════
//  인증 API
// ════════════════════════════════════════════════════════════════

app.post("/api/auth/signup", async (req, res) => {
  const { email = "", password = "", nickname = "" } = req.body;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "올바른 이메일 형식이 아닙니다." });
  if (password.length < 6)
    return res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
  if (!nickname.trim() || nickname.length > 20)
    return res.status(400).json({ error: "닉네임은 1~20자여야 합니다." });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user  = createUser({ email, passwordHash, nickname: nickname.trim() });
    const token = createSession(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    const status = err.message.includes("이미 사용") ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email = "", password = "" } = req.body;
  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });

  const token = createSession(user.id);
  res.json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  destroySession(token);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
//  프로필 API
// ════════════════════════════════════════════════════════════════

app.get("/api/profile", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  res.json({ user: sanitizeUser(user) });
});

app.put("/api/profile", requireAuth, (req, res) => {
  const { nickname, dietary_restrictions, preferred_styles } = req.body;
  if (nickname !== undefined && (!nickname.trim() || nickname.length > 20))
    return res.status(400).json({ error: "닉네임은 1~20자여야 합니다." });

  const safeDietary = Array.isArray(dietary_restrictions)
    ? dietary_restrictions.filter(d => VALID_DIETARY.has(d)) : undefined;
  const safeStyles = Array.isArray(preferred_styles)
    ? preferred_styles.filter(s => VALID_STYLES.has(s)) : undefined;

  try {
    const user = updateUser(req.userId, {
      nickname: nickname?.trim(),
      dietary_restrictions: safeDietary,
      preferred_styles: safeStyles,
    });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  저장된 레시피 API
// ════════════════════════════════════════════════════════════════

app.get("/api/recipes/saved", requireAuth, (req, res) => {
  res.json({ recipes: getUserRecipes(req.userId) });
});

app.post("/api/recipes/saved", requireAuth, (req, res) => {
  const { name, time, difficulty, available_ingredients,
          missing_ingredients, steps, thumbnail_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "레시피 이름이 필요합니다." });

  // 썸네일 크기 제한 (100KB base64)
  const safeThumbnail = typeof thumbnail_url === "string" && thumbnail_url.length <= 100 * 1024
    ? thumbnail_url : "";

  try {
    const recipe = saveRecipe(req.userId, {
      name: name.trim(), time, difficulty,
      available_ingredients, missing_ingredients, steps,
      thumbnail_url: safeThumbnail,
    });
    res.status(201).json({ recipe });
  } catch (err) {
    console.error("[/api/recipes/saved POST]", err);
    res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
});

app.delete("/api/recipes/saved/:id", requireAuth, (req, res) => {
  try {
    deleteRecipe(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  이미지 분석 API
// ════════════════════════════════════════════════════════════════

app.post("/api/analyze", uploadMiddleware, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "이미지 파일이 필요합니다." });

  const base64  = req.file.buffer.toString("base64");
  const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
  const prompt  =
    "이 사진에서 보이는 모든 식재료를 한국어로 파악해줘. " +
    "반드시 한국어로, 다른 설명 없이 아래 JSON 형식으로만 응답해: " +
    '{"ingredients": ["재료1", "재료2"]}';

  try {
    const response = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nemotron-nano-12b-v2-vl:free",
          messages: [{ role: "user", content: [
            { type: "text",      text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ]}],
          max_tokens: 512,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: friendlyError(data?.error) });
    res.json({ ingredients: parseIngredients(data.choices?.[0]?.message?.content ?? "") });
  } catch (err) {
    if (err.name === "AbortError")
      return res.status(504).json({ error: "AI 서버 응답 시간이 초과됐습니다." });
    console.error("[/api/analyze]", err);
    res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
});

// ════════════════════════════════════════════════════════════════
//  레시피 추천 API
// ════════════════════════════════════════════════════════════════

app.post("/api/recipes", async (req, res) => {
  const { ingredients = [], filters = {} } = req.body;

  if (!Array.isArray(ingredients) || !ingredients.length)
    return res.status(400).json({ error: "재료 목록이 비어 있습니다." });
  if (ingredients.length > 30)
    return res.status(400).json({ error: "재료는 최대 30개까지 허용됩니다." });

  const sanitized = ingredients
    .filter(i => typeof i === "string" && i.trim().length > 0)
    .map(i => i.trim().slice(0, 20));
  if (!sanitized.length)
    return res.status(400).json({ error: "유효한 재료가 없습니다." });

  const safeMaxTime = VALID_TIMES.has(Number(filters.max_time)) ? Number(filters.max_time) : 0;
  const safeDiff    = VALID_DIFFS.has(filters.difficulty) ? filters.difficulty : "";

  // 로그인 사용자의 식이 제한 반영
  let dietaryNote = "";
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const userId = verifySession(token);
    if (userId) {
      const user = findUserById(userId);
      if (user?.dietary_restrictions?.length) {
        dietaryNote = `사용자의 식이 제한: ${user.dietary_restrictions.join(", ")}. 이를 반드시 지켜줘.`;
      }
    }
  }

  const ingList = sanitized.join(", ");
  const prompt = [
    `냉장고 재료: ${ingList}`,
    "",
    `위 재료로 만들 수 있는 한국 가정식 레시피 3가지를 추천해줘.`,
    safeMaxTime > 0 ? `조리 시간이 ${safeMaxTime}분 이하인 레시피만 추천해.` : "",
    safeDiff ? `난이도는 "${safeDiff}"인 레시피만 추천해.` : "",
    dietaryNote,
    "",
    "반드시 다음 규칙을 따라:",
    `1. available_ingredients: [${ingList}] 중 실제 사용하는 재료 이름 그대로`,
    "2. missing_ingredients: 위 목록에 없지만 필요한 재료",
    "3. steps: 3~4단계, 각 단계 한 문장",
    '4. difficulty: "쉬움" / "보통" / "어려움" 중 하나',
    "5. JSON만 출력. 마크다운 없이.",
    "",
    '{"recipes":[{"name":"","time":"","difficulty":"","available_ingredients":[],"missing_ingredients":[],"steps":[]}]}',
  ].filter(Boolean).join("\n");

  try {
    const response = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: friendlyError(data?.error) });
    res.json({ recipes: parseRecipes(data.choices?.[0]?.message?.content ?? "") });
  } catch (err) {
    if (err.name === "AbortError")
      return res.status(504).json({ error: "AI 서버 응답 시간이 초과됐습니다." });
    console.error("[/api/recipes]", err);
    res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
});

// ── 유틸 ──────────────────────────────────────────────────────────

function friendlyError(error) {
  const msg = error?.message ?? "";
  if (msg.includes("free-models-per-day") || msg.includes("Rate limit"))
    return "오늘 무료 API 한도를 초과했습니다. openrouter.ai/credits 에서 크레딧을 충전하거나, 내일 오전 9시(UTC 자정) 이후 다시 시도해주세요.";
  if (msg.includes("rate limit") || error?.code === 429)
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  return msg || "AI 서버 오류가 발생했습니다.";
}

function parseRecipes(text) {
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[a-z]*\n?/gi, "")
    .trim();
  const m = stripped.match(/\{[\s\S]*"recipes"[\s\S]*\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (Array.isArray(p.recipes) && p.recipes.length) return p.recipes;
    } catch {}
  }
  return extractJsonObjects(stripped).filter(o => o.name && o.steps);
}

function extractJsonObjects(text) {
  const results = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth++ === 0) start = i; }
    else if (text[i] === "}") {
      if (--depth === 0 && start !== -1) {
        try { results.push(JSON.parse(text.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  return results;
}

function parseIngredients(text) {
  const stripped = text.replace(/```[a-z]*\n?/gi, "").trim();
  const m = stripped.match(/\{[\s\S]*"ingredients"[\s\S]*?\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (Array.isArray(p.ingredients))
        return p.ingredients.map(s => String(s).trim()).filter(s => s.length > 0 && s.length <= 20);
    } catch {}
  }
  return stripped
    .split(/[\n,]/)
    .map(s => s.replace(/^[-*\d.\s"'`{}\[\]]+|["'`{}\[\]]+$/g, "").trim())
    .filter(s => s.length > 1 && s.length <= 20 && !/^ingredients/i.test(s));
}

app.listen(3000, () => console.log("서버 실행 중: http://localhost:3000"));
