/**
 * profile.js
 * Loads and saves the user's profile info (name, education, skills, target role).
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("profile.html", "Profile");
  const content = document.getElementById("page-content");
  const template = document.getElementById("profile-content-template");
  content.appendChild(template.content.cloneNode(true));

  fillProfileForm(user);

  document.getElementById("profile-form").addEventListener("submit", saveProfile);
});

function fillProfileForm(user) {
  document.getElementById("profile-name-display").textContent = user.full_name;
  document.getElementById("profile-email-display").textContent = user.email;
  document.getElementById("profile-avatar").textContent = initials(user.full_name);
  document.getElementById("full_name").value = user.full_name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("education").value = user.education || "";
  document.getElementById("skills").value = user.skills || "";
  document.getElementById("target_role").value = user.target_role || "";
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = document.getElementById("profile-save-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    education: document.getElementById("education").value.trim(),
    skills: document.getElementById("skills").value.trim(),
    target_role: document.getElementById("target_role").value.trim(),
  };

  try {
    await API.updateProfile(payload);
    const user = await API.me();
    AuthStore.setStoredUser(user);
    fillShellUser(user);
    fillProfileForm(user);
    showToast("Profile updated successfully.", "success");
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not update your profile.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
