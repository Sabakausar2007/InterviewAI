/**
 * admin.js
 * Powers the Admin Dashboard: platform stats, and paginated/searchable
 * tables for users, interviews, and MCQ questions.
 */

let adminState = {
  usersPage: 1,
  usersSearch: "",
  interviewsPage: 1,
  mcqPage: 1,
  mcqCategory: "",
  pageSize: 10,
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdmin();
  if (!user) return;

  buildAppShell("admin.html", "Admin Dashboard");
  const content = document.getElementById("page-content");
  const template = document.getElementById("admin-content-template");
  content.appendChild(template.content.cloneNode(true));

  loadAdminStats();
  loadUsers();

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  let searchTimeout;
  document.getElementById("user-search").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      adminState.usersSearch = e.target.value.trim();
      adminState.usersPage = 1;
      loadUsers();
    }, 350);
  });

  document.getElementById("mcq-category-filter").addEventListener("change", (e) => {
    adminState.mcqCategory = e.target.value;
    adminState.mcqPage = 1;
    loadMcqQuestions();
  });
});

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.toggle("hidden", t.id !== `tab-${tabName}`));
  if (tabName === "interviews") loadAdminInterviews();
  if (tabName === "mcq") loadMcqQuestions();
}

async function loadAdminStats() {
  try {
    const stats = await API.getAdminStats();
    document.getElementById("admin-total-users").textContent = stats.total_users;
    document.getElementById("admin-total-interviews").textContent = stats.total_interviews;
    document.getElementById("admin-total-quizzes").textContent = stats.total_quizzes;
    document.getElementById("admin-avg-interview").textContent = `${stats.avg_interview_score}%`;
    document.getElementById("admin-avg-quiz").textContent = `${stats.avg_quiz_score}%`;
    document.getElementById("admin-total-mcq").textContent = stats.total_mcq_questions;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load admin stats.", "error");
  }
}

async function loadUsers() {
  const wrap = document.getElementById("users-table-wrap");
  try {
    const result = await API.getAdminUsers(adminState.usersSearch, adminState.usersPage, adminState.pageSize);
    if (!result.users.length) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><h3>No users found</h3></div>`;
      document.getElementById("users-pagination").innerHTML = "";
      return;
    }
    const rows = result.users.map((u) => `
      <tr>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.is_admin ? '<span class="badge badge-accent">Admin</span>' : '<span class="badge badge-neutral">User</span>'}</td>
        <td>${u.is_active ? '<span class="badge badge-teal">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
        <td>${formatDate(u.created_at)}</td>
        <td class="flex gap-8">
          <button class="btn btn-secondary btn-sm toggle-active-btn" data-id="${u.id}">${u.is_active ? "Deactivate" : "Activate"}</button>
          <button class="btn btn-ghost btn-sm toggle-admin-btn" data-id="${u.id}">${u.is_admin ? "Remove Admin" : "Make Admin"}</button>
        </td>
      </tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;

    wrap.querySelectorAll(".toggle-active-btn").forEach((btn) => btn.addEventListener("click", () => toggleActive(btn.dataset.id)));
    wrap.querySelectorAll(".toggle-admin-btn").forEach((btn) => btn.addEventListener("click", () => toggleAdmin(btn.dataset.id)));

    renderPagination("users-pagination", result, loadUsers, "usersPage");
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load users.</div>`;
  }
}

async function toggleActive(userId) {
  try {
    await API.toggleUserActive(userId);
    showToast("User status updated.", "success");
    loadUsers();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not update user status.", "error");
  }
}

async function toggleAdmin(userId) {
  const ok = await confirmModal({ title: "Change admin status?", body: "This changes the user's access level immediately.", okLabel: "Confirm", danger: false });
  if (!ok) return;
  try {
    await API.toggleUserAdmin(userId);
    showToast("Admin status updated.", "success");
    loadUsers();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not update admin status.", "error");
  }
}

async function loadAdminInterviews() {
  const wrap = document.getElementById("interviews-table-wrap");
  try {
    const result = await API.getAdminInterviews(adminState.interviewsPage, adminState.pageSize);
    if (!result.interviews.length) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No interviews yet</h3></div>`;
      document.getElementById("interviews-pagination").innerHTML = "";
      return;
    }
    const rows = result.interviews.map((i) => `
      <tr>
        <td>#${i.user_id}</td>
        <td>${escapeHtml(i.job_role)}</td>
        <td>${escapeHtml(i.interview_type)}</td>
        <td>${escapeHtml(i.difficulty)}</td>
        <td>${i.overall_score != null ? scoreBadge(i.overall_score) : "—"}</td>
        <td>${statusBadge(i.status)}</td>
        <td>${formatDate(i.created_at)}</td>
      </tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>User</th><th>Job Role</th><th>Type</th><th>Difficulty</th><th>Score</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    renderPagination("interviews-pagination", result, loadAdminInterviews, "interviewsPage");
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load interviews.</div>`;
  }
}

async function loadMcqQuestions() {
  const wrap = document.getElementById("mcq-table-wrap");
  try {
    const result = await API.getAdminMcqQuestions(adminState.mcqCategory, adminState.mcqPage, 20);
    if (!result.questions.length) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-list-check"></i><h3>No questions found</h3></div>`;
      document.getElementById("mcq-pagination").innerHTML = "";
      return;
    }
    const rows = result.questions.map((q) => `
      <tr>
        <td>${escapeHtml(q.category)}</td>
        <td>${escapeHtml(q.difficulty)}</td>
        <td style="max-width:420px;">${escapeHtml(q.question)}</td>
        <td><span class="badge badge-neutral">${q.correct_answer}</span></td>
      </tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Category</th><th>Difficulty</th><th>Question</th><th>Answer</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    renderPagination("mcq-pagination", result, loadMcqQuestions, "mcqPage");
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load MCQ questions.</div>`;
  }
}

function renderPagination(containerId, result, reloadFn, stateKey) {
  const container = document.getElementById(containerId);
  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
  container.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="${containerId}-prev" ${result.page <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>
    <span>Page ${result.page} of ${totalPages} (${result.total} total)</span>
    <button class="btn btn-ghost btn-sm" id="${containerId}-next" ${result.page >= totalPages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
  `;
  document.getElementById(`${containerId}-prev`).addEventListener("click", () => {
    adminState[stateKey] = Math.max(1, adminState[stateKey] - 1);
    reloadFn();
  });
  document.getElementById(`${containerId}-next`).addEventListener("click", () => {
    adminState[stateKey] = adminState[stateKey] + 1;
    reloadFn();
  });
}
