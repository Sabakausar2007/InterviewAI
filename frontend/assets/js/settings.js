/**
 * settings.js
 * Handles interview preferences (default type/difficulty/theme) and
 * password change on settings.html.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  buildAppShell("settings.html", "Settings");
  const content = document.getElementById("page-content");
  const template = document.getElementById("settings-content-template");
  content.appendChild(template.content.cloneNode(true));

  document.getElementById("default_interview_type").value = user.default_interview_type || "Technical";
  document.getElementById("default_difficulty").value = user.default_difficulty || "Medium";

  const themeCards = document.querySelectorAll(".theme-card");
  const currentTheme = user.theme || "light";
  themeCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.value === currentTheme);
    card.addEventListener("click", () => {
      themeCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  document.getElementById("preferences-form").addEventListener("submit", savePreferences);
  document.getElementById("password-form").addEventListener("submit", changePassword);
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const ok = await confirmModal({ title: "Log out?", body: "You'll need to log in again to continue.", okLabel: "Logout", danger: false });
    if (ok) logout();
  });
});

async function savePreferences(e) {
  e.preventDefault();
  const btn = document.getElementById("preferences-save-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  const selectedTheme = document.querySelector(".theme-card.selected")?.dataset.value || "light";
  const payload = {
    default_interview_type: document.getElementById("default_interview_type").value,
    default_difficulty: document.getElementById("default_difficulty").value,
    theme: selectedTheme,
  };

  try {
    await API.updateSettings(payload);
    const user = await API.me();
    AuthStore.setStoredUser(user);
    applyTheme(user.theme);
    showToast("Preferences saved.", "success");
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not save preferences.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function changePassword(e) {
  e.preventDefault();
  const btn = document.getElementById("password-save-btn");
  const originalText = btn.textContent;
  const currentPassword = document.getElementById("current_password").value;
  const newPassword = document.getElementById("new_password").value;

  if (newPassword.length < 6) {
    showToast("New password must be at least 6 characters.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Updating…";
  try {
    await API.changePassword({ current_password: currentPassword, new_password: newPassword });
    showToast("Password changed successfully.", "success");
    document.getElementById("password-form").reset();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : "Could not change your password.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
