// ============================================================
// ארנק שוברים — לוגיקת אפליקציה
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = ["מזון", "ביגוד", "בילויים", "נסיעות", "קוסמטיקה", "אחר"];
const CATEGORY_ICONS = {
  "מזון": "🍽️", "ביגוד": "👕", "בילויים": "🎬",
  "נסיעות": "✈️", "קוסמטיקה": "💄", "אחר": "🎟️"
};
const SOON_DAYS = 7;

let currentUser = null;
let allCoupons = [];
let activeCategory = "all";
let isSignUpMode = false;

// ---------------- Auth screen elements ----------------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");

authToggle.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authSubmit.textContent = isSignUpMode ? "הרשמה" : "כניסה";
  authToggle.innerHTML = isSignUpMode
    ? 'כבר יש לך חשבון? <span>כניסה</span>'
    : 'אין לך חשבון? <span>הרשמה</span>';
  authError.hidden = true;
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;
  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (isSignUpMode) {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      authError.hidden = false;
      authError.style.color = "var(--teal)";
      authError.textContent = "נרשמת בהצלחה! אם נדרש אימות, בדוק/בדקי את תיבת המייל, ואז התחבר/י.";
      authError.style.background = "rgba(62,124,116,0.12)";
      authError.style.borderColor = "rgba(62,124,116,0.35)";
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    authError.hidden = false;
    authError.style.color = "";
    authError.style.background = "";
    authError.style.borderColor = "";
    authError.textContent = translateAuthError(err.message);
  } finally {
    authSubmit.disabled = false;
  }
});

function translateAuthError(msg) {
  if (/invalid login credentials/i.test(msg)) return "אימייל או סיסמה שגויים.";
  if (/already registered/i.test(msg)) return "כבר קיים חשבון עם האימייל הזה — נסה/י להתחבר.";
  if (/password/i.test(msg) && /6/.test(msg)) return "הסיסמה חייבת להכיל לפחות 6 תווים.";
  return msg;
}

document.getElementById("drawer-signout").addEventListener("click", () => {
  closeDrawer();
  sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    document.getElementById("drawer-email").textContent = currentUser.email || "";
    loadCoupons();
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    closeDrawer();
  }
});

// ---------------- Data loading ----------------
async function loadCoupons() {
  const { data, error } = await sb
    .from("coupons")
    .select("*")
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error(error);
    return;
  }
  allCoupons = data;
  renderCategoryFilters();
  renderAll();
}

function getStatus(coupon) {
  if (coupon.is_used) return "used";
  if (!coupon.expiry_date) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(coupon.expiry_date);
  const diffDays = Math.floor((expiry - today) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= SOON_DAYS) return "soon";
  return "active";
}

const STATUS_LABEL = { active: "בתוקף", soon: "פג בקרוב", used: "נוצל", expired: "פג תוקף" };
const STATUS_CLASS = { active: "stamp-active", soon: "stamp-soon", used: "stamp-used", expired: "stamp-expired" };

// ---------------- Stats ----------------
function renderStats() {
  const counts = { active: 0, soon: 0, used: 0, expired: 0 };
  allCoupons.forEach(c => counts[getStatus(c)]++);
  const statsRow = document.getElementById("stats-row");
  statsRow.innerHTML = `
    <div class="stat-card"><span class="stat-num">${allCoupons.length}</span><span class="stat-label">סה״כ שוברים</span></div>
    <div class="stat-card"><span class="stat-num" style="color:var(--teal)">${counts.active}</span><span class="stat-label">בתוקף</span></div>
    <div class="stat-card"><span class="stat-num" style="color:var(--amber)">${counts.soon}</span><span class="stat-label">פג בקרוב</span></div>
    <div class="stat-card"><span class="stat-num" style="color:var(--muted)">${counts.used}</span><span class="stat-label">נוצלו</span></div>
  `;
}

// ---------------- Filters ----------------
function renderCategoryFilters() {
  const el = document.getElementById("category-filters");
  const cats = ["all", ...CATEGORIES];
  el.innerHTML = cats.map(cat => `
    <button type="button" class="chip ${activeCategory === cat ? "active" : ""}" data-cat="${cat}">
      ${cat === "all" ? "הכל" : CATEGORY_ICONS[cat] + " " + cat}
    </button>
  `).join("");
  el.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategoryFilters();
      renderAll();
    });
  });
}

document.getElementById("search-input").addEventListener("input", renderAll);
document.getElementById("status-filter").addEventListener("change", renderAll);

// ---------------- Side drawer ----------------
const sideDrawer = document.getElementById("side-drawer");
const drawerBackdrop = document.getElementById("drawer-backdrop");

function openDrawer() {
  sideDrawer.classList.add("is-open");
  drawerBackdrop.classList.add("is-open");
  updateDrawerActiveStates();
}
function closeDrawer() {
  sideDrawer.classList.remove("is-open");
  drawerBackdrop.classList.remove("is-open");
}
document.getElementById("menu-btn").addEventListener("click", openDrawer);
document.getElementById("nav-menu").addEventListener("click", openDrawer);
document.getElementById("drawer-close").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

function renderDrawerCategories() {
  const el = document.getElementById("drawer-category-links");
  el.innerHTML = CATEGORIES.map(cat => `
    <button type="button" class="drawer-link" data-cat="${cat}">${CATEGORY_ICONS[cat]} ${cat}</button>
  `).join("");
  el.querySelectorAll(".drawer-link").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategoryFilters();
      renderAll();
      closeDrawer();
    });
  });
}
renderDrawerCategories();

document.querySelectorAll("#drawer-status-links .drawer-link").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("status-filter").value = btn.dataset.status;
    renderAll();
    closeDrawer();
  });
});

function updateDrawerActiveStates() {
  const status = document.getElementById("status-filter").value;
  document.querySelectorAll("#drawer-status-links .drawer-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });
  document.querySelectorAll("#drawer-category-links .drawer-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cat === activeCategory);
  });
}

// ---------------- Bottom nav ----------------
document.getElementById("nav-home").addEventListener("click", () => {
  activeCategory = "all";
  document.getElementById("status-filter").value = "all";
  document.getElementById("search-input").value = "";
  renderCategoryFilters();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("nav-search").addEventListener("click", () => {
  const input = document.getElementById("search-input");
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();
});

document.getElementById("nav-add").addEventListener("click", () => openModal(null));

document.getElementById("nav-filter").addEventListener("click", () => {
  document.querySelector(".controls").scrollIntoView({ behavior: "smooth", block: "center" });
});

function getFilteredCoupons() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const statusFilter = document.getElementById("status-filter").value;

  return allCoupons.filter(c => {
    if (activeCategory !== "all" && c.category !== activeCategory) return false;
    if (statusFilter !== "all" && getStatus(c) !== statusFilter) return false;
    if (q) {
      const hay = [c.store_name, c.title, c.code, c.notes].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------- Render grid ----------------
function renderAll() {
  renderStats();
  const list = getFilteredCoupons();
  const grid = document.getElementById("coupon-grid");
  const empty = document.getElementById("empty-state");

  if (allCoupons.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list.map(couponCardHTML).join("") || `<p style="color:var(--muted)">לא נמצאו שוברים תואמים.</p>`;

  grid.querySelectorAll(".card-body").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });
  grid.querySelectorAll(".card-delete-x").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("למחוק את השובר הזה?")) await deleteCoupon(el.dataset.id);
    });
  });
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("he-IL");
}

function couponCardHTML(c) {
  const status = getStatus(c);
  const icon = CATEGORY_ICONS[c.category] || "🎟️";
  return `
    <div class="coupon-card ${status === "used" ? "is-used" : ""}">
      <div class="card-body" data-id="${c.id}">
        <button type="button" class="card-delete-x" data-id="${c.id}" aria-label="מחיקה">✕</button>
        <span class="card-category">${icon} ${escapeHtml(c.category)}</span>
        <span class="card-store">${escapeHtml(c.store_name)}</span>
        ${c.title ? `<span class="card-title-line">${escapeHtml(c.title)}</span>` : ""}
        <div class="card-meta-row">
          ${c.code ? `<span class="code-chip mono">${escapeHtml(c.code)}</span>` : ""}
          ${c.discount_value ? `<span class="value-chip">${escapeHtml(c.discount_value)}</span>` : ""}
        </div>
        ${c.expiry_date ? `<span class="card-expiry ${status === "soon" || status === "expired" ? "warn" : ""}">בתוקף עד ${formatDate(c.expiry_date)}</span>` : ""}
      </div>
      <div class="card-stub">
        <span class="stub-perf"></span>
        <span class="stub-icon">${escapeHtml(c.category)}</span>
        <span class="stub-stamp ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------- Modal (add / edit) ----------------
const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const couponForm = document.getElementById("coupon-form");
const formError = document.getElementById("form-error");
const deleteBtn = document.getElementById("delete-btn");
const imageInput = document.getElementById("f-image");
const imagePreview = document.getElementById("f-image-preview");

let pendingImageFile = null;
let currentImagePath = null;

document.getElementById("add-btn").addEventListener("click", () => openModal(null));
document.getElementById("modal-close").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  pendingImageFile = file || null;
  if (file) {
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.hidden = false;
  }
});

async function openModal(id) {
  couponForm.reset();
  formError.hidden = true;
  pendingImageFile = null;
  imagePreview.hidden = true;
  document.getElementById("coupon-id").value = "";

  if (id) {
    const c = allCoupons.find(x => String(x.id) === String(id));
    if (!c) return;
    modalTitle.textContent = "עריכת שובר";
    deleteBtn.hidden = false;
    document.getElementById("coupon-id").value = c.id;
    document.getElementById("f-store").value = c.store_name || "";
    document.getElementById("f-title").value = c.title || "";
    document.getElementById("f-code").value = c.code || "";
    document.getElementById("f-value").value = c.discount_value || "";
    document.getElementById("f-expiry").value = c.expiry_date || "";
    document.getElementById("f-category").value = c.category || "אחר";
    document.getElementById("f-notes").value = c.notes || "";
    document.getElementById("f-used").checked = !!c.is_used;
    currentImagePath = c.image_path || null;

    if (c.image_path) {
      const { data } = await sb.storage.from(SUPABASE_BUCKET).createSignedUrl(c.image_path, 3600);
      if (data?.signedUrl) {
        imagePreview.src = data.signedUrl;
        imagePreview.hidden = false;
      }
    }
  } else {
    modalTitle.textContent = "שובר חדש";
    deleteBtn.hidden = true;
    currentImagePath = null;
  }
  modalBackdrop.classList.add("is-open");
}

function closeModal() {
  modalBackdrop.classList.remove("is-open");
}

deleteBtn.addEventListener("click", async () => {
  const id = document.getElementById("coupon-id").value;
  if (id && confirm("למחוק את השובר הזה?")) {
    await deleteCoupon(id);
    closeModal();
  }
});

async function deleteCoupon(id) {
  const c = allCoupons.find(x => String(x.id) === String(id));
  const { error } = await sb.from("coupons").delete().eq("id", id);
  if (error) { alert("שגיאה במחיקה: " + error.message); return; }
  if (c?.image_path) await sb.storage.from(SUPABASE_BUCKET).remove([c.image_path]);
  await loadCoupons();
}

couponForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const id = document.getElementById("coupon-id").value || null;

  const payload = {
    store_name: document.getElementById("f-store").value.trim(),
    title: document.getElementById("f-title").value.trim() || null,
    code: document.getElementById("f-code").value.trim() || null,
    discount_value: document.getElementById("f-value").value.trim() || null,
    expiry_date: document.getElementById("f-expiry").value || null,
    category: document.getElementById("f-category").value,
    notes: document.getElementById("f-notes").value.trim() || null,
    is_used: document.getElementById("f-used").checked,
  };

  if (!payload.store_name) {
    formError.hidden = false;
    formError.textContent = "יש למלא שם בית עסק.";
    return;
  }

  try {
    let couponId = id;

    if (id) {
      const { error } = await sb.from("coupons").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      payload.user_id = currentUser.id;
      const { data, error } = await sb.from("coupons").insert(payload).select().single();
      if (error) throw error;
      couponId = data.id;
    }

    if (pendingImageFile) {
      const ext = pendingImageFile.name.split(".").pop();
      const path = `${currentUser.id}/${couponId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from(SUPABASE_BUCKET).upload(path, pendingImageFile, { upsert: true });
      if (uploadError) throw uploadError;
      if (currentImagePath) await sb.storage.from(SUPABASE_BUCKET).remove([currentImagePath]);
      const { error: updateError } = await sb.from("coupons").update({ image_path: path }).eq("id", couponId);
      if (updateError) throw updateError;
    }

    closeModal();
    await loadCoupons();
  } catch (err) {
    formError.hidden = false;
    formError.textContent = "שגיאה בשמירה: " + err.message;
  }
});
