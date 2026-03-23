const rateLimit = require("express-rate-limit");

// Global API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  message: { success: false, message: "Too many requests, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for code execution
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 min
  max: 10,
  message: { success: false, message: "Execution rate limit: max 10 per minute" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts" },
});

module.exports = { apiLimiter, executionLimiter, authLimiter };