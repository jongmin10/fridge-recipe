import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dir  = dirname(fileURLToPath(import.meta.url));
const DATA   = join(__dir, "data");
const DB_PATH = join(DATA, "db.json");

const EMPTY = { users: [], saved_recipes: [] };

function load() {
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  try { return JSON.parse(readFileSync(DB_PATH, "utf8")); }
  catch { return structuredClone(EMPTY); }
}

function persist(db) {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

// ── Users ────────────────────────────────────────────────────────

export function createUser({ email, passwordHash, nickname }) {
  const db = load();
  if (db.users.some(u => u.email === email))
    throw new Error("이미 사용 중인 이메일입니다.");
  const user = {
    id: randomUUID(), email, password_hash: passwordHash, nickname,
    dietary_restrictions: [], preferred_styles: [],
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  persist(db);
  return user;
}

export function findUserByEmail(email) {
  return load().users.find(u => u.email === email) ?? null;
}

export function findUserById(id) {
  return load().users.find(u => u.id === id) ?? null;
}

export function updateUser(id, { nickname, dietary_restrictions, preferred_styles }) {
  const db  = load();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error("사용자를 찾을 수 없습니다.");
  if (nickname             !== undefined) db.users[idx].nickname             = nickname;
  if (dietary_restrictions !== undefined) db.users[idx].dietary_restrictions = dietary_restrictions;
  if (preferred_styles     !== undefined) db.users[idx].preferred_styles     = preferred_styles;
  persist(db);
  return db.users[idx];
}

// ── Saved Recipes ─────────────────────────────────────────────────

export function saveRecipe(userId, { name, time, difficulty,
  available_ingredients, missing_ingredients, steps, thumbnail_url }) {
  const db = load();
  const recipe = {
    id: randomUUID(), user_id: userId, name,
    time: time ?? "", difficulty: difficulty ?? "",
    available_ingredients: available_ingredients ?? [],
    missing_ingredients:   missing_ingredients   ?? [],
    steps:                 steps                 ?? [],
    thumbnail_url:         thumbnail_url         ?? "",
    created_at: new Date().toISOString(),
  };
  db.saved_recipes.push(recipe);
  persist(db);
  return recipe;
}

export function getUserRecipes(userId) {
  return load().saved_recipes
    .filter(r => r.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function deleteRecipe(id, userId) {
  const db  = load();
  const idx = db.saved_recipes.findIndex(r => r.id === id && r.user_id === userId);
  if (idx === -1) throw new Error("레시피를 찾을 수 없습니다.");
  db.saved_recipes.splice(idx, 1);
  persist(db);
}
