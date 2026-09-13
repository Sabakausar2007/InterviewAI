/**
 * interview-result.js
 * Loads and renders the final interview report for the ?id= in the URL.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("history.html", "Interview Result");
  const content = document.getElementById("page-content");
  const template = document.getElementById("result-content-template");
  content.appendChild(template.content.cloneNode(true));

  const params = new URLSearchParams(window.location.search);
  const interviewId = params.get("id");
  if (!interviewId) {
    showToast("No interview specified.", "error");
    window.location.href = "history.html";
    return;
  }

  try {
    const result = await API.getInterviewResult(interviewId);
    renderResult(result);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load this interview result.", "error");
    document.getElementById("result-loading").innerHTML = `<div class="error-state">Could not load this interview result.</div>`;
  }
});

function renderResult(result) {
  document.getElementById("result-loading").classList.add("hidden");
  document.getElementById("result-body").classList.remove("hidden");

  document.getElementById("overall-score").textContent = Math.round(result.overall_score || 0);
  document.getElementById("result-meta").textContent =
    `${result.interview_type} · ${result.job_role} · ${result.difficulty} · ${formatDate(result.created_at)}`;

  document.getElementById("score-technical").textContent = `${Math.round(result.technical_score || 0)}%`;
  document.getElementById("score-communication").textContent = `${Math.round(result.communication_score || 0)}%`;
  document.getElementById("score-relevance").textContent = `${Math.round(result.relevance_score || 0)}%`;
  document.getElementById("score-clarity").textContent = `${Math.round(result.clarity_score || 0)}%`;

  fillList("strong-areas-list", result.strong_areas, "Nothing recorded yet.");
  fillList("weak-areas-list", result.areas_to_improve, "Nothing recorded yet.");
  fillList("recommendations-list", result.recommendations, "Keep practicing regularly.");

  const wrap = document.getElementById("question-review-wrap");
  wrap.innerHTML = result.question_review.map((q, idx) => `
    <div class="qr-item">
      <div class="qr-head">
        <div class="qr-question">${idx + 1}. ${escapeHtml(q.question)}</div>
        ${scoreBadge(q.score)}
      </div>
      <div class="qr-answer">${q.answer ? escapeHtml(q.answer) : "<em>No answer submitted.</em>"}</div>
      ${q.strengths.length ? `<p style="margin:4px 0;"><strong>Strengths:</strong> ${q.strengths.map(escapeHtml).join(", ")}</p>` : ""}
      ${q.weaknesses.length ? `<p style="margin:4px 0;"><strong>Could improve:</strong> ${q.weaknesses.map(escapeHtml).join(", ")}</p>` : ""}
    </div>
  `).join("");
}

function fillList(elementId, items, emptyText) {
  const el = document.getElementById(elementId);
  if (!items || !items.length) {
    el.innerHTML = `<li>${emptyText}</li>`;
    return;
  }
  el.innerHTML = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
}
