/**
 * auth.js
 * Powers login.html and signup.html. Detects which form is present
 * on the page and wires up validation + API calls accordingly.
 */

function showFieldError(input, show) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.toggle("has-error", show);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setButtonLoading(button, labelEl, isLoading, loadingText, normalText) {
  button.disabled = isLoading;
  labelEl.innerHTML = isLoading
    ? `<span class="spinner" style="width:16px;height:16px;border-width:2px;vertical-align:-3px;margin-right:6px;"></span>${loadingText}`
    : normalText;
}

document.addEventListener("DOMContentLoaded", () => {
  redirectIfLoggedIn();

  // ---------------- LOGIN PAGE ----------------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    let mode = "user"; // or "admin"
    const tabUser = document.getElementById("tab-user");
    const tabAdmin = document.getElementById("tab-admin");
    const title = document.getElementById("form-title");
    const sub = document.getElementById("form-sub");

    tabUser.addEventListener("click", () => {
      mode = "user";
      tabUser.classList.add("active");
      tabAdmin.classList.remove("active");
      title.textContent = "Welcome back";
      sub.textContent = "Log in to continue practicing.";
    });
    tabAdmin.addEventListener("click", () => {
      mode = "admin";
      tabAdmin.classList.add("active");
      tabUser.classList.remove("active");
      title.textContent = "Admin Login";
      sub.textContent = "Log in with an admin-enabled account.";
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      document.getElementById("expired-banner").classList.remove("hidden");
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      let valid = true;
      if (!isValidEmail(email)) { showFieldError(emailInput, true); valid = false; } else { showFieldError(emailInput, false); }
      if (!password) { showFieldError(passwordInput, true); valid = false; } else { showFieldError(passwordInput, false); }
      if (!valid) return;

      const btn = document.getElementById("login-submit");
      const label = document.getElementById("login-submit-label");
      setButtonLoading(btn, label, true, "Logging in…", "Log In");

      try {
        const result = mode === "admin"
          ? await API.adminLogin({ email, password })
          : await API.login({ email, password });
        AuthStore.setToken(result.access_token);
        AuthStore.setStoredUser(result.user);
        showToast(`Welcome back, ${result.user.full_name || "there"}!`, "success");
        setTimeout(() => {
          window.location.href = mode === "admin" ? "admin.html" : "dashboard.html";
        }, 400);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Login failed. Please try again.", "error");
        setButtonLoading(btn, label, false, "", "Log In");
      }
    });
  }

  // ---------------- SIGNUP PAGE ----------------
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("full_name");
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      const confirmInput = document.getElementById("confirm_password");

      const full_name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirm_password = confirmInput.value;

      let valid = true;
      if (full_name.length < 2) { showFieldError(nameInput, true); valid = false; } else { showFieldError(nameInput, false); }
      if (!isValidEmail(email)) { showFieldError(emailInput, true); valid = false; } else { showFieldError(emailInput, false); }
      if (password.length < 6) { showFieldError(passwordInput, true); valid = false; } else { showFieldError(passwordInput, false); }
      if (confirm_password !== password) { showFieldError(confirmInput, true); valid = false; } else { showFieldError(confirmInput, false); }
      if (!valid) return;

      const btn = document.getElementById("signup-submit");
      const label = document.getElementById("signup-submit-label");
      setButtonLoading(btn, label, true, "Creating account…", "Create Account");

      try {
        const result = await API.signup({ full_name, email, password, confirm_password });
        AuthStore.setToken(result.access_token);
        AuthStore.setStoredUser(result.user);
        showToast("Account created! Welcome to InterviewAI.", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 400);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Sign up failed. Please try again.", "error");
        setButtonLoading(btn, label, false, "", "Create Account");
      }
    });
  }
});
