/**
 * resume.js
 * Handles resume upload (drag & drop or click), lists uploaded resumes
 * with their AI-extracted details, and lets the user generate
 * resume-based interview questions or delete a resume.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("resume.html", "Resume");
  const content = document.getElementById("page-content");
  const template = document.getElementById("resume-content-template");
  content.appendChild(template.content.cloneNode(true));

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("resume-input");

  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) uploadResume(fileInput.files[0]);
  });
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) uploadResume(e.dataTransfer.files[0]);
  });

  loadResumes();
});

async function uploadResume(file) {
  const allowed = [".pdf", ".docx"];
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showToast("Only PDF and DOCX files are supported.", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("File is too large. Maximum size is 5MB.", "error");
    return;
  }

  document.getElementById("upload-progress").classList.remove("hidden");
  const formData = new FormData();
  formData.append("file", file);

  try {
    await API.uploadResume(formData);
    showToast("Resume uploaded and analyzed successfully.", "success");
    document.getElementById("resume-input").value = "";
    loadResumes();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not upload the resume.", "error");
  } finally {
    document.getElementById("upload-progress").classList.add("hidden");
  }
}

async function loadResumes() {
  const wrap = document.getElementById("resume-list-wrap");
  try {
    const resumes = await API.listResumes();
    if (!resumes.length) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-file-lines"></i><h3>No resumes yet</h3><p>Upload your resume to get personalized interview questions.</p></div>`;
      return;
    }
    wrap.innerHTML = resumes.map((r) => `
      <div class="resume-item" data-id="${r.id}">
        <div class="rh">
          <div><i class="fa-solid fa-file-lines"></i> <strong>${escapeHtml(r.file_name)}</strong></div>
          <button class="btn btn-ghost btn-sm delete-resume-btn" data-id="${r.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="info-block"><div class="lbl">Technologies</div><div>${escapeHtml(r.technologies || "Not detected")}</div></div>
        <div class="info-block"><div class="lbl">Skills</div><div>${escapeHtml(r.skills || "Not detected")}</div></div>
        <div class="info-block"><div class="lbl">Education</div><div>${escapeHtml(r.education || "Not detected")}</div></div>
        <div class="info-block"><div class="lbl">Experience</div><div>${escapeHtml(r.experience || "Not detected")}</div></div>
        <div class="info-block"><div class="lbl">Projects</div><div>${escapeHtml(r.projects || "Not detected")}</div></div>
        <button class="btn btn-secondary btn-sm generate-questions-btn" data-id="${r.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Interview Questions</button>
        <div class="hidden mt-16 questions-output" id="questions-output-${r.id}"></div>
      </div>
    `).join("");

    wrap.querySelectorAll(".delete-resume-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteResume(btn.dataset.id));
    });
    wrap.querySelectorAll(".generate-questions-btn").forEach((btn) => {
      btn.addEventListener("click", () => generateQuestions(btn.dataset.id, btn));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="error-state">Could not load your resumes.</div>`;
  }
}

async function generateQuestions(resumeId, btn) {
  const output = document.getElementById(`questions-output-${resumeId}`);
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:-2px;margin-right:6px;"></span> Generating…`;
  try {
    const result = await API.getResumeQuestions(resumeId, 5);
    output.classList.remove("hidden");
    output.innerHTML = `
      <div class="card" style="background:var(--paper);">
        <h4 style="margin-bottom:10px;">Personalized Questions</h4>
        <ol style="margin:0;padding-left:20px;">${result.questions.map((q) => `<li style="margin-bottom:8px;">${escapeHtml(q)}</li>`).join("")}</ol>
        <a href="interview.html" class="btn btn-primary btn-sm mt-16">Start Resume-Based Interview</a>
      </div>`;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not generate questions.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function deleteResume(resumeId) {
  const ok = await confirmModal({
    title: "Delete this resume?",
    body: "This will permanently remove the resume and its extracted data.",
    okLabel: "Delete",
  });
  if (!ok) return;
  try {
    await API.deleteResume(resumeId);
    showToast("Resume deleted.", "success");
    loadResumes();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not delete the resume.", "error");
  }
}
