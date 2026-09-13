/**
 * history.js
 * Renders the full interview history table on history.html.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("history.html", "My Interviews");
  const content = document.getElementById("page-content");
  const template = document.getElementById("history-content-template");
  content.appendChild(template.content.cloneNode(true));

  loadHistory();
});

async function loadHistory() {
  const wrap = document.getElementById("history-wrap");
  try {
    const interviews = await API.getInterviewHistory();
    if (!interviews.length) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comments"></i><h3>No interviews yet</h3><p>Your completed and in-progress interviews will appear here.</p><a href="interview.html" class="btn btn-primary mt-16">Start an Interview</a></div>`;
      return;
    }
    const rows = interviews.map((i) => `
      <tr>
        <td>${formatDate(i.date)}</td>
        <td>${escapeHtml(i.interview_type)}</td>
        <td>${escapeHtml(i.job_role)}</td>
        <td>${escapeHtml(i.difficulty)}</td>
        <td>${i.score != null ? scoreBadge(i.score) : "—"}</td>
        <td>${statusBadge(i.status)}</td>
        <td>${i.status === "completed" ? `<a href="interview-result.html?id=${i.id}" class="btn btn-secondary btn-sm">View Result</a>` : `<span class="text-muted" style="font-size:0.82rem;">In progress</span>`}</td>
      </tr>
    `).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Job Role</th><th>Difficulty</th><th>Score</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load your interview history.</div>`;
  }
}
