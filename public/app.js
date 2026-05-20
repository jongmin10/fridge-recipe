// ════════════════════════════════════════════════════════════════
//  DOM 참조
// ════════════════════════════════════════════════════════════════

// Navbar
const navAuth       = document.getElementById("navAuth");
const btnShowAuth   = document.getElementById("btnShowAuth");

// Step 1
const uploadZone         = document.getElementById("uploadZone");
const uploadPlaceholder  = document.getElementById("uploadPlaceholder");
const fileInput          = document.getElementById("fileInput");
const preview            = document.getElementById("preview");
const btnAnalyze         = document.getElementById("btnAnalyze");
const loading            = document.getElementById("loading");
const errorBox           = document.getElementById("errorBox");
const errorMsg           = document.getElementById("errorMsg");
const btnRetry           = document.getElementById("btnRetry");
const ingredientsSection = document.getElementById("ingredientsSection");
const tagList            = document.getElementById("tagList");
const newIngredient      = document.getElementById("newIngredient");
const btnAdd             = document.getElementById("btnAdd");
const btnNext            = document.getElementById("btnNext");

// Step 2
const step1             = document.getElementById("step1");
const step2             = document.getElementById("step2");
const btnBack           = document.getElementById("btnBack");
const ingredientSummary = document.getElementById("ingredientSummary");
const filterTime        = document.getElementById("filterTime");
const filterDifficulty  = document.getElementById("filterDifficulty");
const btnRegenerate     = document.getElementById("btnRegenerate");
const recipeLoading     = document.getElementById("recipeLoading");
const recipeErrorBox    = document.getElementById("recipeErrorBox");
const recipeErrorMsg    = document.getElementById("recipeErrorMsg");
const btnRecipeRetry    = document.getElementById("btnRecipeRetry");
const recipeGrid        = document.getElementById("recipeGrid");

// Step 3
const step3             = document.getElementById("step3");
const btnBackFromBook   = document.getElementById("btnBackFromBook");
const btnEditProfile    = document.getElementById("btnEditProfile");
const profileBadge      = document.getElementById("profileBadge");
const searchRecipe      = document.getElementById("searchRecipe");
const bookFilterTime    = document.getElementById("bookFilterTime");
const bookFilterDiff    = document.getElementById("bookFilterDiff");
const recipeCount       = document.getElementById("recipeCount");
const savedRecipeGrid   = document.getElementById("savedRecipeGrid");
const emptyBook         = document.getElementById("emptyBook");

// Auth modal
const authModal       = document.getElementById("authModal");
const authModalClose  = document.getElementById("authModalClose");
const loginPane       = document.getElementById("loginPane");
const signupPane      = document.getElementById("signupPane");
const loginEmail      = document.getElementById("loginEmail");
const loginPassword   = document.getElementById("loginPassword");
const loginError      = document.getElementById("loginError");
const btnLogin        = document.getElementById("btnLogin");
const signupEmail     = document.getElementById("signupEmail");
const signupPassword  = document.getElementById("signupPassword");
const signupNickname  = document.getElementById("signupNickname");
const signupError     = document.getElementById("signupError");
const btnSignup       = document.getElementById("btnSignup");

// Profile modal
const profileModal      = document.getElementById("profileModal");
const profileModalClose = document.getElementById("profileModalClose");
const profileNickname   = document.getElementById("profileNickname");
const profileError      = document.getElementById("profileError");
const btnSaveProfile    = document.getElementById("btnSaveProfile");

// Toast
const toast = document.getElementById("toast");

// ════════════════════════════════════════════════════════════════
//  상태
// ════════════════════════════════════════════════════════════════

let selectedFile  = null;
let ingredients   = [];
let allRecipes    = [];
let currentUser   = null;
let authToken     = null;
let savedRecipes  = [];

const MAX_INGREDIENT_LENGTH = 20;
const MAX_INGREDIENT_COUNT  = 30;

// ════════════════════════════════════════════════════════════════
//  유틸
// ════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimer = null;
function showToast(msg, type = "success") {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function authHeaders() {
  return authToken ? { "Authorization": `Bearer ${authToken}` } : {};
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// 썸네일 생성: Canvas로 최대 200px 너비 JPEG
function generateThumbnail(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(""); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 200;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.65));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
    img.src = url;
  });
}

// ════════════════════════════════════════════════════════════════
//  네비게이션 바
// ════════════════════════════════════════════════════════════════

function updateNavbar() {
  if (currentUser) {
    navAuth.innerHTML = "";

    const userSpan = document.createElement("span");
    userSpan.className = "nav-user";
    userSpan.textContent = `${currentUser.nickname}님`;

    const bookBtn = document.createElement("button");
    bookBtn.className = "btn-nav-outline";
    bookBtn.textContent = "📖 레시피북";
    bookBtn.addEventListener("click", showStep3);

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn-nav-ghost";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", handleLogout);

    navAuth.append(userSpan, bookBtn, logoutBtn);
  } else {
    navAuth.innerHTML = "";
    const loginBtn = document.createElement("button");
    loginBtn.className = "btn-nav";
    loginBtn.id = "btnShowAuth";
    loginBtn.textContent = "로그인 / 회원가입";
    loginBtn.addEventListener("click", () => openAuthModal());
    navAuth.appendChild(loginBtn);
  }
}

// ════════════════════════════════════════════════════════════════
//  인증
// ════════════════════════════════════════════════════════════════

async function initAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) {
    const data = await res.json();
    authToken   = token;
    currentUser = data.user;
  } else {
    localStorage.removeItem("authToken");
  }
  updateNavbar();
}

function openAuthModal(tab = "login") {
  authModal.classList.remove("hidden");
  switchTab(tab);
  loginError.classList.add("hidden");
  signupError.classList.add("hidden");
}

authModalClose.addEventListener("click", () => authModal.classList.add("hidden"));
authModal.addEventListener("click", (e) => { if (e.target === authModal) authModal.classList.add("hidden"); });

// 탭 전환
authModal.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  authModal.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  loginPane.classList.toggle("hidden",  name !== "login");
  signupPane.classList.toggle("hidden", name !== "signup");
}

// 로그인
btnLogin.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

async function handleLogin() {
  loginError.classList.add("hidden");
  btnLogin.disabled = true;
  try {
    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail.value.trim(), password: loginPassword.value }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(loginError, data.error); return; }
    onAuthSuccess(data.token, data.user);
    authModal.classList.add("hidden");
    showToast(`${data.user.nickname}님, 환영합니다!`);
  } catch {
    showAuthError(loginError, "네트워크 오류가 발생했습니다.");
  } finally {
    btnLogin.disabled = false;
  }
}

// 회원가입
btnSignup.addEventListener("click", handleSignup);

async function handleSignup() {
  signupError.classList.add("hidden");
  btnSignup.disabled = true;
  try {
    const res  = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:    signupEmail.value.trim(),
        password: signupPassword.value,
        nickname: signupNickname.value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(signupError, data.error); return; }
    onAuthSuccess(data.token, data.user);
    authModal.classList.add("hidden");
    showToast(`${data.user.nickname}님, 가입을 환영합니다!`);
  } catch {
    showAuthError(signupError, "네트워크 오류가 발생했습니다.");
  } finally {
    btnSignup.disabled = false;
  }
}

function showAuthError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

function onAuthSuccess(token, user) {
  authToken   = token;
  currentUser = user;
  localStorage.setItem("authToken", token);
  updateNavbar();
}

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() }).catch(() => {});
  authToken   = null;
  currentUser = null;
  localStorage.removeItem("authToken");
  updateNavbar();
  showStep1();
  showToast("로그아웃됐습니다.", "info");
}

// ════════════════════════════════════════════════════════════════
//  프로필 편집
// ════════════════════════════════════════════════════════════════

btnEditProfile.addEventListener("click", openProfileModal);
profileModalClose.addEventListener("click", () => profileModal.classList.add("hidden"));
profileModal.addEventListener("click", (e) => { if (e.target === profileModal) profileModal.classList.add("hidden"); });

function openProfileModal() {
  if (!currentUser) return;
  profileNickname.value = currentUser.nickname;

  // 다이어트 체크박스 동기화
  profileModal.querySelectorAll(".form-group input[type='checkbox']").forEach(cb => {
    const isDietary = cb.closest(".form-group")?.querySelector("label")?.textContent.includes("식이");
    if (isDietary) {
      cb.checked = currentUser.dietary_restrictions?.includes(cb.value) ?? false;
    } else {
      cb.checked = currentUser.preferred_styles?.includes(cb.value) ?? false;
    }
  });

  profileError.classList.add("hidden");
  profileModal.classList.remove("hidden");
}

btnSaveProfile.addEventListener("click", async () => {
  profileError.classList.add("hidden");
  btnSaveProfile.disabled = true;

  const dietary = [...profileModal.querySelectorAll(".checkbox-grid:nth-of-type(1) input:checked")]
    .map(cb => cb.value);
  const styles  = [...profileModal.querySelectorAll(".checkbox-grid:nth-of-type(2) input:checked")]
    .map(cb => cb.value);

  try {
    const res  = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        nickname:             profileNickname.value.trim(),
        dietary_restrictions: dietary,
        preferred_styles:     styles,
      }),
    });
    const data = await res.json();
    if (!res.ok) { profileError.textContent = data.error; profileError.classList.remove("hidden"); return; }
    currentUser = data.user;
    updateNavbar();
    updateProfileBadge();
    profileModal.classList.add("hidden");
    showToast("프로필이 저장됐습니다.");
  } catch {
    profileError.textContent = "저장 중 오류가 발생했습니다.";
    profileError.classList.remove("hidden");
  } finally {
    btnSaveProfile.disabled = false;
  }
});

function updateProfileBadge() {
  if (!currentUser) { profileBadge.textContent = ""; return; }
  const dietary = currentUser.dietary_restrictions?.join(", ") || "없음";
  const styles  = currentUser.preferred_styles?.join(", ")     || "없음";
  profileBadge.textContent = `식이 제한: ${dietary}  |  선호 스타일: ${styles}`;
}

// ════════════════════════════════════════════════════════════════
//  화면 전환
// ════════════════════════════════════════════════════════════════

function showStep1() {
  step1.classList.remove("hidden");
  step2.classList.add("hidden");
  step3.classList.add("hidden");
}
function showStep2() {
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
  step3.classList.add("hidden");
}
function showStep3() {
  step1.classList.add("hidden");
  step2.classList.add("hidden");
  step3.classList.remove("hidden");
  updateProfileBadge();
  loadRecipeBook();
}

btnBackFromBook.addEventListener("click", showStep1);

// ════════════════════════════════════════════════════════════════
//  STEP 1 — 재료 인식
// ════════════════════════════════════════════════════════════════

uploadZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { if (fileInput.files[0]) loadImage(fileInput.files[0]); });
uploadZone.addEventListener("dragover",  (e) => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
});

function loadImage(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) { showError("JPEG, PNG, WebP 파일만 지원합니다."); return; }
  if (file.size > 10 * 1024 * 1024) { showError("파일 크기가 10MB를 초과합니다."); return; }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.classList.remove("hidden");
    uploadPlaceholder.classList.add("hidden");
  };
  reader.readAsDataURL(file);
  btnAnalyze.disabled = false;
  hideError();
  resetStep1Results();
}

btnAnalyze.addEventListener("click", analyze);
btnRetry.addEventListener("click",   analyze);

async function analyze() {
  if (!selectedFile) return;
  setLoading(true); hideError(); resetStep1Results();
  const formData = new FormData();
  formData.append("image", selectedFile);
  try {
    const res  = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "분석 실패");
    ingredients = data.ingredients ?? [];
    renderTags();
    ingredientsSection.classList.remove("hidden");
    btnNext.classList.remove("hidden");
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// 이벤트 위임
tagList.addEventListener("click", (e) => {
  const btn = e.target.closest(".tag-remove");
  if (!btn) return;
  ingredients.splice(Number(btn.dataset.idx), 1);
  renderTags();
});

function renderTags() {
  tagList.innerHTML = "";
  ingredients.forEach((name, idx) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = name;
    const btn = document.createElement("button");
    btn.className = "tag-remove"; btn.dataset.idx = idx; btn.title = "삭제"; btn.textContent = "×";
    tag.appendChild(btn);
    tagList.appendChild(tag);
  });
}

btnAdd.addEventListener("click", addIngredient);
newIngredient.addEventListener("keydown", (e) => { if (e.key === "Enter") addIngredient(); });

function addIngredient() {
  const val = newIngredient.value.trim();
  if (!val) { newIngredient.value = ""; return; }
  if (val.length > MAX_INGREDIENT_LENGTH) { showError(`재료 이름은 ${MAX_INGREDIENT_LENGTH}자 이하여야 합니다.`); return; }
  if (ingredients.length >= MAX_INGREDIENT_COUNT) { showError(`재료는 최대 ${MAX_INGREDIENT_COUNT}개까지 추가할 수 있습니다.`); return; }
  if (!ingredients.includes(val)) { ingredients.push(val); renderTags(); }
  newIngredient.value = "";
}

btnNext.addEventListener("click", () => { showStep2(); updateIngredientSummary(); fetchRecipes(); });

function setLoading(on)  { loading.classList.toggle("hidden", !on); btnAnalyze.disabled = on; }
function showError(msg)  { errorMsg.textContent = msg; errorBox.classList.remove("hidden"); }
function hideError()     { errorBox.classList.add("hidden"); }
function resetStep1Results() { ingredientsSection.classList.add("hidden"); btnNext.classList.add("hidden"); ingredients = []; }

// ════════════════════════════════════════════════════════════════
//  STEP 2 — 레시피 추천
// ════════════════════════════════════════════════════════════════

btnBack.addEventListener("click", showStep1);
btnRegenerate.addEventListener("click", fetchRecipes);
btnRecipeRetry.addEventListener("click", fetchRecipes);
filterTime.addEventListener("change",       applyFilters);
filterDifficulty.addEventListener("change", applyFilters);

function updateIngredientSummary() {
  const preview = ingredients.slice(0, 5).join(", ");
  const extra   = ingredients.length > 5 ? ` 외 ${ingredients.length - 5}개` : "";
  ingredientSummary.textContent = `재료: ${preview}${extra}`;
}

async function fetchRecipes() {
  setRecipeLoading(true); hideRecipeError(); recipeGrid.innerHTML = ""; allRecipes = [];
  const filters = {};
  const t = Number(filterTime.value), d = filterDifficulty.value;
  if (t > 0) filters.max_time = t;
  if (d) filters.difficulty = d;

  try {
    const res  = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ingredients, filters }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "레시피 생성 실패");
    allRecipes = data.recipes ?? [];
    if (!allRecipes.length) throw new Error("추천 레시피를 생성하지 못했습니다. 재생성을 시도해보세요.");
    applyFilters();
  } catch (err) {
    showRecipeError(err.message);
  } finally {
    setRecipeLoading(false);
  }
}

function applyFilters() {
  const maxTime = Number(filterTime.value), diff = filterDifficulty.value;
  const filtered = allRecipes.filter(r => {
    if (maxTime > 0 && (parseInt(r.time) || 0) > maxTime) return false;
    if (diff && r.difficulty !== diff) return false;
    return true;
  });
  renderRecipes(filtered.length ? filtered : allRecipes);
}

function renderRecipes(recipes) {
  recipeGrid.innerHTML = "";
  recipes.forEach((recipe, idx) => recipeGrid.appendChild(buildRecipeCard(recipe, idx)));
}

function buildRecipeCard(recipe, idx) {
  const diffClass = { "쉬움": "badge-easy", "보통": "badge-medium", "어려움": "badge-hard" }[recipe.difficulty] ?? "badge-easy";
  const card = document.createElement("div");
  card.className = "recipe-card";

  const header = document.createElement("div");
  header.className = "recipe-card-header";
  header.dataset.idx = idx;

  const title = document.createElement("h3");
  title.textContent = recipe.name ?? "레시피";

  const meta = document.createElement("div");
  meta.className = "recipe-meta";
  meta.innerHTML = `<span class="recipe-time">⏱ ${escapeHtml(recipe.time ?? "-")}</span>
    <span class="badge ${diffClass}">★ ${escapeHtml(recipe.difficulty ?? "-")}</span>`;

  const btnExpand = document.createElement("button");
  btnExpand.className = "btn-expand";
  btnExpand.textContent = "자세히 ▼";

  header.append(title, meta, btnExpand);

  const detail = document.createElement("div");
  detail.className = "recipe-detail hidden";
  detail.innerHTML = `
    <div class="ingredient-groups">
      <div class="ingredient-group">
        <h4>보유 재료</h4>
        <div class="tag-list">${buildIngredientTags(recipe.available_ingredients, false)}</div>
      </div>
      ${recipe.missing_ingredients?.length ? `
      <div class="ingredient-group">
        <h4>추가 필요</h4>
        <div class="tag-list">${buildIngredientTags(recipe.missing_ingredients, true)}</div>
      </div>` : ""}
    </div>`;

  const stepsDiv = document.createElement("div");
  stepsDiv.className = "steps";
  const stepsTitle = document.createElement("h4");
  stepsTitle.textContent = "조리 방법";
  const ol = document.createElement("ol");
  (recipe.steps ?? []).forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });

  const btnSave = document.createElement("button");
  btnSave.className = "btn-save";
  btnSave.textContent = currentUser ? "♥ 저장하기" : "♥ 저장하기 (로그인 필요)";
  btnSave.addEventListener("click", () => handleSaveRecipe(recipe, btnSave));

  stepsDiv.append(stepsTitle, ol);
  detail.append(stepsDiv, btnSave);
  card.append(header, detail);

  header.addEventListener("click", () => {
    const open = !detail.classList.contains("hidden");
    detail.classList.toggle("hidden", open);
    btnExpand.textContent = open ? "자세히 ▼" : "닫기 ▲";
  });

  return card;
}

function buildIngredientTags(items = [], isMissing) {
  return items.map(n => `<span class="tag${isMissing ? " missing" : ""}">${escapeHtml(n)}</span>`).join("");
}

async function handleSaveRecipe(recipe, btn) {
  if (!currentUser) { openAuthModal("login"); showToast("레시피를 저장하려면 로그인해주세요.", "info"); return; }

  btn.disabled = true;
  btn.textContent = "저장 중…";

  try {
    const thumbnail_url = await generateThumbnail(selectedFile);
    const res  = await fetch("/api/recipes/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...recipe, thumbnail_url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "저장 실패");
    btn.textContent = "✓ 저장됨";
    showToast(`"${recipe.name}" 레시피가 저장됐습니다.`);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "♥ 저장하기";
    showToast(err.message, "error");
  }
}

function setRecipeLoading(on) { recipeLoading.classList.toggle("hidden", !on); btnRegenerate.disabled = on; }
function showRecipeError(msg) { recipeErrorMsg.textContent = msg; recipeErrorBox.classList.remove("hidden"); }
function hideRecipeError()    { recipeErrorBox.classList.add("hidden"); }

// ════════════════════════════════════════════════════════════════
//  STEP 3 — 레시피북
// ════════════════════════════════════════════════════════════════

searchRecipe.addEventListener("input",      renderBookFiltered);
bookFilterTime.addEventListener("change",   renderBookFiltered);
bookFilterDiff.addEventListener("change",   renderBookFiltered);

// 이벤트 위임: 삭제 버튼
savedRecipeGrid.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-delete");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/recipes/saved/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json()).error);
    savedRecipes = savedRecipes.filter(r => r.id !== id);
    renderBookFiltered();
    showToast("레시피가 삭제됐습니다.", "info");
  } catch (err) {
    showToast(err.message, "error");
    btn.disabled = false;
  }
});

async function loadRecipeBook() {
  if (!currentUser) return;
  savedRecipeGrid.innerHTML = "";
  emptyBook.classList.add("hidden");
  try {
    const res  = await fetch("/api/recipes/saved", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    savedRecipes = data.recipes ?? [];
    renderBookFiltered();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderBookFiltered() {
  const query   = searchRecipe.value.trim().toLowerCase();
  const maxTime = Number(bookFilterTime.value);
  const diff    = bookFilterDiff.value;

  const filtered = savedRecipes.filter(r => {
    if (query   && !r.name.toLowerCase().includes(query)) return false;
    if (maxTime > 0 && (parseInt(r.time) || 0) > maxTime) return false;
    if (diff    && r.difficulty !== diff) return false;
    return true;
  });

  recipeCount.textContent = `총 ${savedRecipes.length}개 저장됨${filtered.length !== savedRecipes.length ? ` (${filtered.length}개 표시)` : ""}`;
  savedRecipeGrid.innerHTML = "";

  if (!filtered.length) { emptyBook.classList.remove("hidden"); return; }
  emptyBook.classList.add("hidden");
  filtered.forEach(r => savedRecipeGrid.appendChild(buildSavedCard(r)));
}

function buildSavedCard(recipe) {
  const diffClass = { "쉬움": "badge-easy", "보통": "badge-medium", "어려움": "badge-hard" }[recipe.difficulty] ?? "badge-easy";

  const card = document.createElement("div");
  card.className = "saved-card";

  const header = document.createElement("div");
  header.className = "saved-card-header";

  // 썸네일
  const thumb = document.createElement("div");
  thumb.className = "saved-thumb";
  if (recipe.thumbnail_url) {
    const img = document.createElement("img");
    img.src = recipe.thumbnail_url;
    img.alt = recipe.name;
    thumb.appendChild(img);
  } else {
    thumb.textContent = "🍽";
  }

  const info = document.createElement("div");
  info.className = "saved-info";

  const title = document.createElement("h3");
  title.textContent = recipe.name;

  const metaDiv = document.createElement("div");
  metaDiv.className = "saved-meta";
  metaDiv.innerHTML = `<span class="recipe-time">⏱ ${escapeHtml(recipe.time ?? "-")}</span>
    <span class="badge ${diffClass}">★ ${escapeHtml(recipe.difficulty ?? "-")}</span>
    <span class="saved-date">📅 ${formatDate(recipe.created_at)}</span>`;

  info.append(title, metaDiv);

  const actions = document.createElement("div");
  actions.className = "saved-actions";

  const btnExpand = document.createElement("button");
  btnExpand.className = "btn-expand";
  btnExpand.textContent = "보기 ▼";

  const btnDel = document.createElement("button");
  btnDel.className = "btn-delete";
  btnDel.dataset.id = recipe.id;
  btnDel.textContent = "🗑 삭제";

  actions.append(btnExpand, btnDel);
  header.append(thumb, info, actions);

  // 상세
  const detail = document.createElement("div");
  detail.className = "saved-detail hidden";
  detail.innerHTML = `
    <div class="ingredient-groups">
      <div class="ingredient-group">
        <h4>보유 재료</h4>
        <div class="tag-list">${buildIngredientTags(recipe.available_ingredients, false)}</div>
      </div>
      ${recipe.missing_ingredients?.length ? `
      <div class="ingredient-group">
        <h4>추가 필요</h4>
        <div class="tag-list">${buildIngredientTags(recipe.missing_ingredients, true)}</div>
      </div>` : ""}
    </div>`;

  const stepsDiv = document.createElement("div");
  stepsDiv.className = "steps";
  const stepsTitle = document.createElement("h4");
  stepsTitle.textContent = "조리 방법";
  const ol = document.createElement("ol");
  (recipe.steps ?? []).forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
  stepsDiv.append(stepsTitle, ol);
  detail.appendChild(stepsDiv);

  card.append(header, detail);

  header.addEventListener("click", (e) => {
    if (e.target.closest(".btn-delete")) return;
    const open = !detail.classList.contains("hidden");
    detail.classList.toggle("hidden", open);
    btnExpand.textContent = open ? "보기 ▼" : "닫기 ▲";
  });

  return card;
}

// ════════════════════════════════════════════════════════════════
//  초기화
// ════════════════════════════════════════════════════════════════

initAuth();
