/**
 * quiz-result.js
 * Reads the most recent quiz result from sessionStorage (set by mcq.js
 * right before redirecting here) and renders the scored review.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("mcq.html", "Quiz Result");
  const content = document.getElementById("page-content");
  const template = document.getElementById("quiz-result-template");
  content.appendChild(template.content.cloneNode(true));

  const raw = sessionStorage.getItem("interviewai_last_quiz_result");
  if (!raw) {
    document.getElementById("qr-empty").classList.remove("hidden");
    return;
  }

  let result;
  try {
    result = JSON.parse(raw);
  } catch (e) {
    document.getElementById("qr-empty").classList.remove("hidden");
    return;
  }

  renderQuizResult(result);
  sessionStorage.removeItem("interviewai_last_quiz_result");
});

function renderQuizResult(result) {
  document.getElementById("qr-body").classList.remove("hidden");

  document.getElementById("qr-correct").textContent = result.correct_answers;
  document.getElementById("qr-total").textContent = result.total_questions;
  document.getElementById("qr-percent").textContent = result.score_percent;

  const labelEl = document.getElementById("qr-perf-label");
  labelEl.textContent = result.performance_label;
  labelEl.style.color = result.performance_label === "Excellent" ? "#0d7a70"
    : result.performance_label === "Good" ? "#a35c14" : "#b1272b";

  document.getElementById("qr-stat-correct").textContent = result.correct_answers;
  document.getElementById("qr-stat-wrong").textContent = result.wrong_answers;
  document.getElementById("qr-stat-time").textContent = formatSeconds(result.time_taken_seconds || 0);
  document.getElementById("qr-stat-accuracy").textContent = `${result.score_percent}%`;

  const wrap = document.getElementById("qr-review-wrap");
  wrap.innerHTML = result.review.map((r, idx) => {
    const optionRows = Object.entries(r.options).map(([letter, text]) => {
      let cls = "";
      if (letter === r.correct_answer) cls = "correct";
      else if (letter === r.your_answer && !r.is_correct) cls = "wrong";
      return `<div class="opt-row ${cls}"><span class="opt-letter-sm">${letter}</span>${escapeHtml(text)}</div>`;
    }).join("");

    return `
      <div class="review-item">
        <div class="rq-head">
          <strong>${idx + 1}. ${escapeHtml(r.question)}</strong>
          ${r.is_correct ? '<span class="badge badge-teal">Correct</span>' : '<span class="badge badge-red">Incorrect</span>'}
        </div>
        ${optionRows}
        ${r.explanation ? `<p class="text-muted mt-8" style="margin:10px 0 0; font-size:0.85rem;"><strong>Explanation:</strong> ${escapeHtml(r.explanation)}</p>` : ""}
      </div>
    `;
  }).join("");
}
