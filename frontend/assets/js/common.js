/**
 * common.js
 * Shared utilities used across every page: toast notifications, a confirm
 * modal, the logged-in app shell (sidebar + topbar), and auth guards.
 * Depends on api.js being loaded first.
 */

// ---------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------
function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = "info", duration = 4200) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
  toast.innerHTML = `<i class="fa-solid ${icon}" style="margin-top:2px;"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.25s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Friendly wrapper: run an async function, show a toast on failure.
async function withErrorToast(fn, fallbackMessage = "Something went wrong.") {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : fallbackMessage;
    showToast(msg, "error");
    throw err;
  }
}

// ---------------------------------------------------------------------
// Confirm modal
// ---------------------------------------------------------------------
function ensureModalRoot() {
  let el = document.getElementById("confirm-modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "confirm-modal-root";
    el.className = "modal-backdrop";
    el.innerHTML = `
      <div class="modal">
        <h3 id="confirm-modal-title">Are you sure?</h3>
        <p id="confirm-modal-body">This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button>
          <button class="btn btn-danger" id="confirm-modal-ok">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function confirmModal({ title = "Are you sure?", body = "This action cannot be undone.", okLabel = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    root.querySelector("#confirm-modal-title").textContent = title;
    root.querySelector("#confirm-modal-body").textContent = body;
    const okBtn = root.querySelector("#confirm-modal-ok");
    const cancelBtn = root.querySelector("#confirm-modal-cancel");
    okBtn.textContent = okLabel;
    okBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
    root.classList.add("show");

    const cleanup = (result) => {
      root.classList.remove("show");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    root.onclick = (e) => { if (e.target === root) cleanup(false); };
  });
}

// ---------------------------------------------------------------------
// Auth guards
// ---------------------------------------------------------------------
function isLoggedIn() {
  return Boolean(AuthStore.getToken());
}

function redirectIfLoggedIn(destination = "dashboard.html") {
  if (isLoggedIn()) window.location.href = destination;
}

async function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return null;
  }
  try {
    const user = await API.me();
    AuthStore.setStoredUser(user);
    applyTheme(user.theme);
    return user;
  } catch (err) {
    window.location.href = "login.html";
    return null;
  }
}

async function requireAdmin() {
  const user = await requireAuth();
  if (user && !user.is_admin) {
    showToast("Admin access required.", "error");
    window.location.href = "dashboard.html";
    return null;
  }
  return user;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

function logout() {
  AuthStore.clearToken();
  window.location.href = "index.html";
}

// ---------------------------------------------------------------------
// App shell (sidebar + topbar) for logged-in pages
// ---------------------------------------------------------------------
const SIDEBAR_LINKS = [
  { href: "dashboard.html", icon: "fa-grid-2", label: "Dashboard" },
  { href: "interview.html", icon: "fa-comments", label: "AI Interview" },
  { href: "mcq.html", icon: "fa-list-check", label: "MCQ Practice" },
  { href: "resume.html", icon: "fa-file-lines", label: "Resume" },
  { href: "history.html", icon: "fa-clock-rotate-left", label: "My Interviews" },
  { href: "performance.html", icon: "fa-chart-line", label: "Performance" },
  { href: "profile.html", icon: "fa-user", label: "Profile" },
  { href: "settings.html", icon: "fa-gear", label: "Settings" },
];

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

function buildAppShell(activeHref, pageTitle) {
  const shell = document.getElementById("app-shell-root");
  if (!shell) return;

  const currentPage = window.location.pathname.split("/").pop();
  const links = SIDEBAR_LINKS.map(
    (l) => `<a href="${l.href}" class="${currentPage === l.href ? "active" : ""}"><i class="fa-solid ${l.icon}"></i>${l.label}</a>`
  ).join("");

  shell.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="app-sidebar">
      <div class="brand"><span class="brand-mark"><i class="fa-solid fa-brain"></i></span>InterviewAI</div>
      <nav class="sidebar-nav">
        ${links}
        <a href="#" id="logout-link" style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
          <i class="fa-solid fa-right-from-bracket"></i>Logout
        </a>
      </nav>
      <div class="sidebar-foot">
        <div class="user-chip">
          <div class="avatar avatar-dark" id="shell-avatar">--</div>
          <div>
            <div class="name" id="shell-username">Loading…</div>
            <div class="email" id="shell-email"></div>
          </div>
        </div>
      </div>
    </aside>
    <div class="main-area">
      <div class="topbar">
        <div class="flex gap-16" style="align-items:center;">
          <button class="sidebar-toggle" id="sidebar-toggle"><i class="fa-solid fa-bars"></i></button>
          <h1>${pageTitle || ""}</h1>
        </div>
        <div class="flex gap-12" style="align-items:center;">
          <span class="badge badge-neutral" id="shell-mode-badge" style="display:none;"><i class="fa-solid fa-circle-info"></i> Demo mode</span>
        </div>
      </div>
      <div class="page-content" id="page-content"></div>
    </div>
  `;

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  const toggle = document.getElementById("sidebar-toggle");
  const overlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("app-sidebar");
  if (toggle) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  const user = AuthStore.getStoredUser();
  if (user) fillShellUser(user);

  API.health().then((h) => {
    if (h.ai_mode === "fallback") {
      const badge = document.getElementById("shell-mode-badge");
      if (badge) badge.style.display = "inline-flex";
    }
  }).catch(() => {});
}

function fillShellUser(user) {
  const nameEl = document.getElementById("shell-username");
  const emailEl = document.getElementById("shell-email");
  const avatarEl = document.getElementById("shell-avatar");
  if (nameEl) nameEl.textContent = user.full_name || "User";
  if (emailEl) emailEl.textContent = user.email || "";
  if (avatarEl) avatarEl.textContent = initials(user.full_name);
}

// ---------------------------------------------------------------------
// Small formatting helpers used across pages
// ---------------------------------------------------------------------
function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d)) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreBadge(score) {
  const s = Math.round(score || 0);
  if (s >= 75) return `<span class="badge badge-teal">${s}%</span>`;
  if (s >= 50) return `<span class="badge badge-amber">${s}%</span>`;
  return `<span class="badge badge-red">${s}%</span>`;
}

function statusBadge(status) {
  if (status === "completed") return `<span class="badge badge-teal">Completed</span>`;
  return `<span class="badge badge-amber">In progress</span>`;
}

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

window.showToast = showToast;
window.withErrorToast = withErrorToast;
window.confirmModal = confirmModal;
window.isLoggedIn = isLoggedIn;
window.redirectIfLoggedIn = redirectIfLoggedIn;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.logout = logout;
window.buildAppShell = buildAppShell;
window.fillShellUser = fillShellUser;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.scoreBadge = scoreBadge;
window.statusBadge = statusBadge;
window.formatSeconds = formatSeconds;
window.escapeHtml = escapeHtml;
window.applyTheme = applyTheme;
