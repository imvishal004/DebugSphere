import axios from "axios";

// Get backend URL from environment
let baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Remove trailing slash if exists
if (baseURL.endsWith("/")) {
  baseURL = baseURL.slice(0, -1);
}

// Create axios instance
const api = axios.create({
  baseURL: `${baseURL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

// AI Debug API
export const analyzeWithAI = (executionId) =>
  api.post(`/executions/${executionId}/debug`);

export default api;