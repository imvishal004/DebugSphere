import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// Inject JWT on every request (unchanged)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handling (unchanged)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login")
        window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Named API helpers ─────────────────────────────────────────
// Centralizing these means if the endpoint URL ever changes,
// you update one line here — not every component that calls it.

/**
 * Trigger manual AI analysis for a failed execution.
 * Rate limited to 5 calls per 15 min per user (server-enforced).
 *
 * @param {string} executionId - MongoDB _id of the Execution document
 * @returns {Promise<AxiosResponse>}
 */
export const analyzeWithAI = (executionId) =>
  api.post(`/executions/${executionId}/debug`);

// Default export keeps all existing code working unchanged
export default api;