/**
 * performance.js
 * Renders the Performance Analytics page: summary stats, trend charts,
 * and strongest/weakest topic breakdowns.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("performance.html", "Performance");
  const content = document.getElementById("page-content");
  const template = document.getElementById("performance-content-template");
  content.appendChild(template.content.cloneNode(true));

  loadSummary();
  loadTrendsAndCharts();
});

async function loadSummary() {
  try {
    const perf = await API.getPerformanceSummary();
    document.getElementById("perf-total-interviews").textContent = perf.total_interviews;
    document.getElementById("perf-total-quizzes").textContent = perf.total_quizzes;
    document.getElementById("perf-avg-interview").textContent = perf.avg_interview_score ? `${perf.avg_interview_score}%` : "—";
    document.getElementById("perf-avg-quiz").textContent = perf.avg_quiz_score ? `${perf.avg_quiz_score}%` : "—";
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load performance summary.", "error");
  }
}

async function loadTrendsAndCharts() {
  try {
    const trends = await API.getPerformanceTrends();
    renderTrendChart(trends);
    renderDimensionChart(trends);
    renderTopicLists(trends);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not load performance trends.", "error");
  }
}

function renderTrendChart(trends) {
  const canvas = document.getElementById("trend-chart");
  const empty = document.getElementById("trend-chart-empty");
  const hasData = (trends.interview_trend && trends.interview_trend.length) || (trends.quiz_trend && trends.quiz_trend.length);
  if (!hasData) {
    canvas.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  const labels = [...new Set([
    ...trends.interview_trend.map((i) => formatDate(i.date)),
    ...trends.quiz_trend.map((q) => formatDate(q.date)),
  ])];

  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Interview Score", data: trends.interview_trend.map((i) => i.score), borderColor: "#5b5fef", backgroundColor: "rgba(91,95,239,0.12)", tension: 0.35, fill: true },
        { label: "Quiz Score", data: trends.quiz_trend.map((q) => q.score), borderColor: "#17a398", backgroundColor: "rgba(23,163,152,0.12)", tension: 0.35, fill: true },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, max: 100 } } },
  });
}

function renderDimensionChart(trends) {
  const canvas = document.getElementById("dimension-chart");
  const empty = document.getElementById("radar-chart-empty");
  if (!trends.avg_technical_performance && !trends.avg_communication_performance) {
    canvas.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Technical", "Communication"],
      datasets: [{
        data: [trends.avg_technical_performance, trends.avg_communication_performance],
        backgroundColor: ["#5b5fef", "#17a398"],
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function renderTopicLists(trends) {
  const strongestWrap = document.getElementById("strongest-topics-wrap");
  const weakestWrap = document.getElementById("weakest-topics-wrap");

  if (!trends.strongest_topics || !trends.strongest_topics.length) {
    strongestWrap.innerHTML = `<p class="text-muted" style="margin:0;">Complete some quizzes to see your strongest topics.</p>`;
    weakestWrap.innerHTML = `<p class="text-muted" style="margin:0;">Complete some quizzes to see topics to improve.</p>`;
    return;
  }

  strongestWrap.innerHTML = trends.strongest_topics.map((t) => `
    <div class="topic-pill"><span>${escapeHtml(t)}</span><span class="badge badge-teal">${trends.topic_averages[t]}%</span></div>
  `).join("");

  weakestWrap.innerHTML = trends.weakest_topics.map((t) => `
    <div class="topic-pill"><span>${escapeHtml(t)}</span><span class="badge badge-amber">${trends.topic_averages[t]}%</span></div>
  `).join("");
}
