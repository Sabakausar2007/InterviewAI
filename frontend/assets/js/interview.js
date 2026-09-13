/**
 * interview.js
 * Drives the full AI Mock Interview flow: setup -> question loop -> AI
 * evaluation -> finish -> redirect to results.
 */

let interviewState = {
  interviewId: null,
  questions: [],
  currentIndex: 0,
  interviewType: "Technical",
  jobRole: "Python Developer",
  difficulty: "Medium",
  numQuestions: 5,
  answeredCount: 0,
  timerInterval: null,
  secondsElapsed: 0,
  recognition: null,
  isRecording: false,
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("interview.html", "AI Interview");
  const content = document.getElementById("page-content");
  const template = document.getElementById("interview-content-template");
  content.appendChild(template.content.cloneNode(true));

  setupRadioGroup("type-options", "Technical", (val) => {
    interviewState.interviewType = val;
    document.getElementById("resume-field").classList.toggle("hidden", val !== "Resume Based");
    if (val === "Resume Based") loadResumeOptions();
  });
  setupRadioGroup("difficulty-options", "Medium", (val) => (interviewState.difficulty = val));
  setupRadioGroup("count-options", "5", (val) => (interviewState.numQuestions = parseInt(val, 10)));

  const roleSelect = document.getElementById("job-role-select");
  roleSelect.addEventListener("change", () => {
    document.getElementById("custom-role-field").classList.toggle("hidden", roleSelect.value !== "Custom");
  });

  document.getElementById("start-interview-btn").addEventListener("click", startInterview);
  document.getElementById("submit-answer-btn").addEventListener("click", submitAnswer);
  document.getElementById("continue-interview-btn").addEventListener("click", goToNextQuestion);
  document.getElementById("end-interview-btn").addEventListener("click", endInterviewEarly);
  document.getElementById("mic-btn").addEventListener("click", toggleRecording);

  setupSpeechRecognition();
});

function setupRadioGroup(containerId, defaultValue, onChange) {
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

async function loadResumeOptions() {
  const select = document.getElementById("resume-select");
  select.innerHTML = `<option>Loading…</option>`;
  try {
    const resumes = await API.listResumes();
    if (!resumes.length) {
      select.innerHTML = `<option value="">No resumes uploaded yet</option>`;
      return;
    }
    select.innerHTML = resumes.map((r) => `<option value="${r.id}">${escapeHtml(r.file_name)}</option>`).join("");
  } catch (err) {
    select.innerHTML = `<option value="">Could not load resumes</option>`;
  }
}

async function startInterview() {
  const roleSelect = document.getElementById("job-role-select");
  const jobRole = roleSelect.value === "Custom"
    ? (document.getElementById("custom-role-input").value.trim() || "Custom Role")
    : roleSelect.value;
  interviewState.jobRole = jobRole;

  let resumeId = null;
  if (interviewState.interviewType === "Resume Based") {
    const resumeSelect = document.getElementById("resume-select");
    resumeId = resumeSelect.value ? parseInt(resumeSelect.value, 10) : null;
    if (!resumeId) {
      showToast("Please upload a resume first, or choose a different interview type.", "error");
      return;
    }
  }

  const btn = document.getElementById("start-interview-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Generating questions…`;

  try {
    const result = await API.startInterview({
      interview_type: interviewState.interviewType,
      job_role: jobRole,
      difficulty: interviewState.difficulty,
      num_questions: interviewState.numQuestions,
      resume_id: resumeId,
    });
    interviewState.interviewId = result.interview_id;
    interviewState.questions = result.questions;
    interviewState.currentIndex = 0;
    interviewState.answeredCount = 0;

    document.getElementById("panel-setup").classList.add("hidden");
    document.getElementById("panel-interview").classList.remove("hidden");
    document.getElementById("interview-context-label").textContent = `${interviewState.interviewType} · ${jobRole} · ${interviewState.difficulty}`;

    showQuestion();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not start the interview. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Start Interview";
  }
}

function showQuestion() {
  const q = interviewState.questions[interviewState.currentIndex];
  document.getElementById("question-text").textContent = q.question_text;
  document.getElementById("question-counter").textContent =
    `Question ${interviewState.currentIndex + 1} / ${interviewState.questions.length}`;
  const pct = Math.round(((interviewState.currentIndex) / interviewState.questions.length) * 100);
  document.getElementById("interview-progress").style.width = `${pct}%`;
  document.getElementById("answer-box").value = "";

  document.getElementById("panel-interview").classList.remove("hidden");
  document.getElementById("panel-evaluation").classList.add("hidden");

  startQuestionTimer();
}

function startQuestionTimer() {
  clearInterval(interviewState.timerInterval);
  interviewState.secondsElapsed = 0;
  const timerEl = document.getElementById("question-timer");
  timerEl.classList.remove("warn");
  timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> 00:00`;
  interviewState.timerInterval = setInterval(() => {
    interviewState.secondsElapsed += 1;
    timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${formatSeconds(interviewState.secondsElapsed)}`;
    if (interviewState.secondsElapsed >= 180) timerEl.classList.add("warn");
  }, 1000);
}

async function submitAnswer() {
  const answerBox = document.getElementById("answer-box");
  const answerText = answerBox.value.trim();
  if (!answerText) {
    showToast("Please write or record an answer before submitting.", "error");
    return;
  }
  clearInterval(interviewState.timerInterval);
  stopRecording();

  const q = interviewState.questions[interviewState.currentIndex];
  const btn = document.getElementById("submit-answer-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Evaluating…`;

  try {
    const evaluation = await API.submitAnswer({ question_id: q.id, answer_text: answerText });
    interviewState.answeredCount += 1;
    showEvaluation(evaluation);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not evaluate your answer.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Answer";
  }
}

function showEvaluation(evaluation) {
  document.getElementById("panel-interview").classList.add("hidden");
  document.getElementById("panel-evaluation").classList.remove("hidden");

  const score = Math.round(evaluation.score || 0);
  document.getElementById("eval-score-ring").style.setProperty("--pct", score);
  document.getElementById("eval-score-value").textContent = score;

  document.getElementById("eval-relevance").textContent = Math.round(evaluation.relevance || 0);
  document.getElementById("eval-technical").textContent = Math.round(evaluation.technical_knowledge || 0);
  document.getElementById("eval-accuracy").textContent = Math.round(evaluation.accuracy || 0);
  document.getElementById("eval-communication").textContent = Math.round(evaluation.communication || 0);
  document.getElementById("eval-clarity").textContent = Math.round(evaluation.clarity || 0);
  document.getElementById("eval-confidence").textContent = Math.round(evaluation.confidence || 0);

  const strengthsEl = document.getElementById("eval-strengths");
  const weaknessesEl = document.getElementById("eval-weaknesses");
  strengthsEl.innerHTML = (evaluation.strengths || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("") || "<li>—</li>";
  weaknessesEl.innerHTML = (evaluation.weaknesses || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("") || "<li>—</li>";

  document.getElementById("eval-improved").textContent = evaluation.improved_answer || "—";

  const continueBtn = document.getElementById("continue-interview-btn");
  const isLast = interviewState.currentIndex >= interviewState.questions.length - 1;
  continueBtn.textContent = isLast ? "Finish Interview" : "Continue Interview";
}

async function goToNextQuestion() {
  const isLast = interviewState.currentIndex >= interviewState.questions.length - 1;
  if (isLast) {
    await finishAndRedirect();
    return;
  }
  interviewState.currentIndex += 1;
  showQuestion();
}

async function finishAndRedirect() {
  const btn = document.getElementById("continue-interview-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span> Finalizing your results…`;
  try {
    await API.finishInterview(interviewState.interviewId);
    window.location.href = `interview-result.html?id=${interviewState.interviewId}`;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not finalize the interview.", "error");
    btn.disabled = false;
    btn.textContent = "Finish Interview";
  }
}

async function endInterviewEarly() {
  const ok = await confirmModal({
    title: "End interview early?",
    body: interviewState.answeredCount > 0
      ? "You'll get a result based on the questions you've already answered."
      : "You haven't answered any questions yet, so no result will be saved.",
    okLabel: "End Interview",
  });
  if (!ok) return;

  clearInterval(interviewState.timerInterval);
  stopRecording();

  if (interviewState.answeredCount === 0) {
    window.location.href = "dashboard.html";
    return;
  }
  try {
    await API.finishInterview(interviewState.interviewId);
    window.location.href = `interview-result.html?id=${interviewState.interviewId}`;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not finalize the interview.", "error");
  }
}

// ---------------------------------------------------------------------
// Optional voice input via the Web Speech API (works in Chrome/Edge).
// Gracefully does nothing in unsupported browsers.
// ---------------------------------------------------------------------
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const micBtn = document.getElementById("mic-btn");
    if (micBtn) micBtn.title = "Voice input is not supported in this browser";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const answerBox = document.getElementById("answer-box");
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    answerBox.value = (answerBox.value + " " + transcript).trim();
  };
  recognition.onerror = () => stopRecording();
  recognition.onend = () => {
    if (interviewState.isRecording) recognition.start(); // keep listening until user stops
  };

  interviewState.recognition = recognition;
}

function toggleRecording() {
  if (!interviewState.recognition) {
    showToast("Voice input is not supported in this browser. Please type your answer.", "error");
    return;
  }
  interviewState.isRecording ? stopRecording() : startRecording();
}

function startRecording() {
  const micBtn = document.getElementById("mic-btn");
  interviewState.isRecording = true;
  micBtn.classList.add("recording");
  micBtn.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Recording`;
  try {
    interviewState.recognition.start();
  } catch (e) { /* already started */ }
}

function stopRecording() {
  if (!interviewState.recognition || !interviewState.isRecording) return;
  interviewState.isRecording = false;
  const micBtn = document.getElementById("mic-btn");
  micBtn.classList.remove("recording");
  micBtn.innerHTML = `<i class="fa-solid fa-microphone"></i> Record Answer`;
  try {
    interviewState.recognition.stop();
  } catch (e) { /* already stopped */ }
}
