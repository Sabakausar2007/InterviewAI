/**
 * dashboard.js
 * Loads the app shell, then fills in stats, recent activity, and the
 * performance chart on the Dashboard page.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("dashboard.html", "Dashboard");

  const content = document.getElementById("page-content");
  const template = document.getElementById("dashboard-content-template");
  content.appendChild(template.content.cloneNode(true));

  document.getElementById("welcome-heading").querySelector("h2").textContent = `Welcome back, ${user.full_name.split(" ")[0]} 👋`;

  loadStats();
  loadRecentInterviews();
  loadRecentQuizzes();
  loadChart();
});

async function loadStats() {
  try {
    const perf = await API.getPerformanceSummary();
    document.getElementById("stat-interviews").textContent = perf.total_interviews;
    document.getElementById("stat-interview-score").textContent = perf.avg_interview_score ? `${perf.avg_interview_score}%` : "—";
    document.getElementById("stat-quizzes").textContent = perf.total_quizzes;
    document.getElementById("stat-quiz-score").textContent = perf.avg_quiz_score ? `${perf.avg_quiz_score}%` : "—";
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load your stats.", "error");
  }
}

async function loadRecentInterviews() {
  const wrap = document.getElementById("recent-interviews-wrap");
  try {
    const interviews = await API.getInterviewHistory();
    if (!interviews.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fa-solid fa-comments"></i><p style="margin:0;">No interviews yet. <a href="interview.html">Start your first one</a>.</p></div>`;
      return;
    }
    const rows = interviews.slice(0, 5).map((i) => `
      <tr>
        <td>${formatDate(i.date)}</td>
        <td>${escapeHtml(i.interview_type)}</td>
        <td>${escapeHtml(i.job_role)}</td>
        <td>${i.score != null ? scoreBadge(i.score) : "—"}</td>
        <td>${statusBadge(i.status)}</td>
      </tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Role</th><th>Score</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load recent interviews.</div>`;
  }
}

async function loadRecentQuizzes() {
  const wrap = document.getElementById("recent-quizzes-wrap");
  try {
    const quizzes = await API.getQuizHistory();
    if (!quizzes.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fa-solid fa-list-check"></i><p style="margin:0;">No quizzes yet. <a href="mcq.html">Take your first quiz</a>.</p></div>`;
      return;
    }
    const rows = quizzes.slice(0, 5).map((q) => `
      <tr>
        <td>${escapeHtml(q.category)}</td>
        <td>${q.total_questions}</td>
        <td>${q.correct_answers}</td>
        <td>${scoreBadge(q.score_percent)}</td>
        <td>${formatDate(q.date)}</td>
      </tr>`).join("");
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Quiz</th><th>Questions</th><th>Correct</th><th>Score</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load recent quiz results.</div>`;
  }
}

async function loadChart() {
  const canvas = document.getElementById("performance-chart");
  const emptyState = document.getElementById("chart-empty");
  try {
    const trends = await API.getPerformanceTrends();
    const hasData = (trends.interview_trend && trends.interview_trend.length) || (trends.quiz_trend && trends.quiz_trend.length);
    if (!hasData) {
      canvas.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    const labels = [
      ...trends.interview_trend.map((i) => formatDate(i.date)),
      ...trends.quiz_trend.map((q) => formatDate(q.date)),
    ];
    const uniqueLabels = [...new Set(labels)];

    new Chart(canvas, {
      type: "line",
      data: {
        labels: uniqueLabels,
        datasets: [
          {
            label: "Interview Score",
            data: trends.interview_trend.map((i) => i.score),
            borderColor: "#5b5fef",
            backgroundColor: "rgba(91,95,239,0.12)",
            tension: 0.35,
            fill: true,
          },
          {
            label: "Quiz Score",
            data: trends.quiz_trend.map((q) => q.score),
            borderColor: "#17a398",
            backgroundColor: "rgba(23,163,152,0.12)",
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });
  } catch (err) {
    canvas.classList.add("hidden");
    emptyState.classList.remove("hidden");
  }
}
