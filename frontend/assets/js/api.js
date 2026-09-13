/**
 * api.js
 * Central API client. Every page includes this file and calls window.API.*
 * All requests go to the same origin the app is served from (FastAPI serves
 * the frontend directly), so no base URL configuration is needed.
 */

const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("interviewai_token");
}

function setToken(token) {
  localStorage.setItem("interviewai_token", token);
}

function clearToken() {
  localStorage.removeItem("interviewai_token");
  localStorage.removeItem("interviewai_user");
}

function getStoredUser() {
  const raw = localStorage.getItem("interviewai_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem("interviewai_user", JSON.stringify(user));
}

/**
 * Core request helper. Handles auth headers, JSON parsing, and
 * consistent error messages so every page can rely on the same behavior.
 */
async function apiRequest(method, path, body, { isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    // The FastAPI server itself is unreachable (not running, MySQL down at socket level, etc.)
    throw new ApiError(
      "Can't reach the InterviewAI server. Make sure the backend is running (run.bat) and try again.",
      0
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // Session expired or invalid - send back to login
      clearToken();
      if (!window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
        window.location.href = "login.html?expired=1";
      }
    }
    const message = (data && data.detail) ? data.detail : `Request failed (${response.status}).`;
    throw new ApiError(typeof message === "string" ? message : "Something went wrong. Please try again.", response.status);
  }

  return data;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const API = {
  // ---- Auth ----
  signup: (payload) => apiRequest("POST", "/auth/signup", payload, { auth: false }),
  login: (payload) => apiRequest("POST", "/auth/login", payload, { auth: false }),
  adminLogin: (payload) => apiRequest("POST", "/auth/admin-login", payload, { auth: false }),
  me: () => apiRequest("GET", "/auth/me"),
  updateProfile: (payload) => apiRequest("PUT", "/auth/profile", payload),
  updateSettings: (payload) => apiRequest("PUT", "/auth/settings", payload),
  changePassword: (payload) => apiRequest("PUT", "/auth/change-password", payload),

  // ---- Interview ----
  startInterview: (payload) => apiRequest("POST", "/interview/start", payload),
  submitAnswer: (payload) => apiRequest("POST", "/interview/answer", payload),
  finishInterview: (interviewId) => apiRequest("POST", `/interview/${interviewId}/finish`),
  getInterviewResult: (interviewId) => apiRequest("GET", `/interview/${interviewId}/result`),
  getInterviewHistory: () => apiRequest("GET", "/interview/history"),

  // ---- Quiz ----
  getQuizCategories: () => apiRequest("GET", "/quiz/categories"),
  startQuiz: (payload) => apiRequest("POST", "/quiz/start", payload),
  submitQuiz: (payload) => apiRequest("POST", "/quiz/submit", payload),
  getQuizHistory: () => apiRequest("GET", "/quiz/history"),

  // ---- Resume ----
  uploadResume: (formData) => apiRequest("POST", "/resume/upload", formData, { isForm: true }),
  listResumes: () => apiRequest("GET", "/resume/list"),
  getResumeQuestions: (resumeId, numQuestions) => apiRequest("GET", `/resume/${resumeId}/questions?num_questions=${numQuestions}`),
  deleteResume: (resumeId) => apiRequest("DELETE", `/resume/${resumeId}`),

  // ---- Performance ----
  getPerformanceSummary: () => apiRequest("GET", "/performance/summary"),
  getPerformanceTrends: () => apiRequest("GET", "/performance/trends"),

  // ---- Admin ----
  getAdminStats: () => apiRequest("GET", "/admin/stats"),
  getAdminUsers: (search = "", page = 1, pageSize = 10) =>
    apiRequest("GET", `/admin/users?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`),
  toggleUserActive: (userId) => apiRequest("PUT", `/admin/users/${userId}/toggle-active`),
  toggleUserAdmin: (userId) => apiRequest("PUT", `/admin/users/${userId}/toggle-admin`),
  getAdminInterviews: (page = 1, pageSize = 10) => apiRequest("GET", `/admin/interviews?page=${page}&page_size=${pageSize}`),
  getAdminMcqQuestions: (category = "", page = 1, pageSize = 20) =>
    apiRequest("GET", `/admin/mcq-questions?category=${encodeURIComponent(category)}&page=${page}&page_size=${pageSize}`),

  // ---- Health ----
  health: () => apiRequest("GET", "/health", null, { auth: false }),
};

window.API = API;
window.ApiError = ApiError;
window.AuthStore = { getToken, setToken, clearToken, getStoredUser, setStoredUser };
