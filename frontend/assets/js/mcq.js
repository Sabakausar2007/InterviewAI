/**
 * mcq.js
 * Drives the MCQ Practice flow: category selection -> difficulty/count ->
 * quiz taking (no page refresh between questions) -> submit -> result page.
 */

const CATEGORY_ICONS = {
  "Python": "fa-brands fa-python",
  "Java": "fa-brands fa-java",
  "C/C++": "fa-solid fa-code",
  "Data Structures": "fa-solid fa-diagram-project",
  "Algorithms": "fa-solid fa-sitemap",
  "HTML": "fa-brands fa-html5",
  "CSS": "fa-brands fa-css3-alt",
  "JavaScript": "fa-brands fa-js",
  "SQL": "fa-solid fa-database",
  "Database": "fa-solid fa-server",
  "Cybersecurity": "fa-solid fa-shield-halved",
  "Computer Networks": "fa-solid fa-network-wired",
  "Operating Systems": "fa-solid fa-desktop",
};

let mcqState = {
  category: null,
  difficulty: "Medium",
  numQuestions: 10,
  questions: [],
  answers: {}, // questionId -> "A"/"B"/"C"/"D"
  currentIndex: 0,
  timerInterval: null,
  secondsElapsed: 0,
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("mcq.html", "MCQ Practice");
  const content = document.getElementById("page-content");
  const template = document.getElementById("mcq-content-template");
  content.appendChild(template.content.cloneNode(true));

  loadCategories();

  setupRadioGroupMcq("mcq-difficulty-options", "Medium", (v) => (mcqState.difficulty = v));
  setupRadioGroupMcq("mcq-count-options", "10", (v) => (mcqState.numQuestions = parseInt(v, 10)));

  document.getElementById("back-to-categories").addEventListener("click", () => {
    document.getElementById("quiz-options-view").classList.add("hidden");
    document.getElementById("category-select-view").classList.remove("hidden");
  });
  document.getElementById("start-quiz-btn").addEventListener("click", startQuiz);
  document.getElementById("mcq-prev-btn").addEventListener("click", () => navigateQuestion(-1));
  document.getElementById("mcq-next-btn").addEventListener("click", () => navigateQuestion(1));
  document.getElementById("mcq-submit-btn").addEventListener("click", submitQuiz);
});

function setupRadioGroupMcq(containerId, defaultValue, onChange) {
  const container = document.getElementById(containerId);
  const cards = container.querySelectorAll(".radio-card");
  cards.forEach((card) => {
    if (card.dataset.value === defaultValue) card.classList.add("selected");
    card.addEventListener("click", () => {
      cards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      onChange(card.dataset.value);
    });
  });
}

async function loadCategories() {
  const grid = document.getElementById("category-grid");
  try {
    const categories = await API.getQuizCategories();
    grid.innerHTML = categories.map((c) => `
      <div class="category-card" data-category="${escapeHtml(c.name)}">
        <div class="cat-icon"><i class="${CATEGORY_ICONS[c.name] || "fa-solid fa-list"}"></i></div>
        <h4 style="margin-bottom:4px;">${escapeHtml(c.name)}</h4>
        <div class="cat-count">${c.question_count} questions available</div>
      </div>
    `).join("");
    grid.querySelectorAll(".category-card").forEach((card) => {
      card.addEventListener("click", () => selectCategory(card.dataset.category));
    });
  } catch (err) {
    grid.innerHTML = `<div class="error-state" style="grid-column:1/-1;">Could not load MCQ categories.</div>`;
  }
}

function selectCategory(category) {
  mcqState.category = category;
  document.getElementById("selected-category-title").textContent = category;
  document.getElementById("category-select-view").classList.add("hidden");
  document.getElementById("quiz-options-view").classList.remove("hidden");
}

async function startQuiz() {
  const btn = document.getElementById("start-quiz-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Preparing quiz…`;

  try {
    const result = await API.startQuiz({
      category: mcqState.category,
      difficulty: mcqState.difficulty,
      num_questions: mcqState.numQuestions,
    });
    mcqState.questions = result.questions;
    mcqState.answers = {};
    mcqState.currentIndex = 0;

    document.getElementById("panel-mcq-setup").classList.add("hidden");
    document.getElementById("panel-mcq-quiz").classList.remove("hidden");

    renderQuestion();
    startQuizTimer();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not start the quiz.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Start Quiz";
  }
}

function startQuizTimer() {
  clearInterval(mcqState.timerInterval);
  mcqState.secondsElapsed = 0;
  const timerEl = document.getElementById("mcq-timer");
  mcqState.timerInterval = setInterval(() => {
    mcqState.secondsElapsed += 1;
    timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${formatSeconds(mcqState.secondsElapsed)}`;
  }, 1000);
}

function renderQuestion() {
  const q = mcqState.questions[mcqState.currentIndex];
  document.getElementById("mcq-counter").textContent = `Question ${mcqState.currentIndex + 1} / ${mcqState.questions.length}`;
  document.getElementById("mcq-progress").style.width = `${Math.round(((mcqState.currentIndex) / mcqState.questions.length) * 100)}%`;
  document.getElementById("mcq-question-text").textContent = q.question;

  const options = [
    { letter: "A", text: q.option_a },
    { letter: "B", text: q.option_b },
    { letter: "C", text: q.option_c },
    { letter: "D", text: q.option_d },
  ];
  const selected = mcqState.answers[q.id];
  document.getElementById("mcq-options-wrap").innerHTML = options.map((o) => `
    <button type="button" class="option-btn ${selected === o.letter ? "selected" : ""}" data-letter="${o.letter}">
      <span class="opt-letter">${o.letter}</span>${escapeHtml(o.text)}
    </button>
  `).join("");

  document.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mcqState.answers[q.id] = btn.dataset.letter;
      renderQuestion();
    });
  });

  document.getElementById("mcq-prev-btn").disabled = mcqState.currentIndex === 0;
  const isLast = mcqState.currentIndex === mcqState.questions.length - 1;
  document.getElementById("mcq-next-btn").classList.toggle("hidden", isLast);
  document.getElementById("mcq-submit-btn").classList.toggle("hidden", !isLast);
}

function navigateQuestion(delta) {
  const newIndex = mcqState.currentIndex + delta;
  if (newIndex < 0 || newIndex >= mcqState.questions.length) return;
  mcqState.currentIndex = newIndex;
  renderQuestion();
}

async function submitQuiz() {
  clearInterval(mcqState.timerInterval);
  const answers = mcqState.questions.map((q) => ({
    question_id: q.id,
    selected_answer: mcqState.answers[q.id] || null,
  }));

  const unanswered = answers.filter((a) => !a.selected_answer).length;
  if (unanswered > 0) {
    const proceed = await confirmModal({
      title: "Submit with unanswered questions?",
      body: `You have ${unanswered} unanswered question(s). They will be marked as incorrect.`,
      okLabel: "Submit Anyway",
      danger: false,
    });
    if (!proceed) {
      startQuizTimer();
      return;
    }
  }

  const btn = document.getElementById("mcq-submit-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Scoring…`;

  try {
    const result = await API.submitQuiz({
      category: mcqState.category,
      difficulty: mcqState.difficulty,
      answers,
      time_taken_seconds: mcqState.secondsElapsed,
    });
    sessionStorage.setItem("interviewai_last_quiz_result", JSON.stringify(result));
    window.location.href = "quiz-result.html";
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not submit the quiz.", "error");
    btn.disabled = false;
    btn.textContent = "Submit Quiz";
  }
}
