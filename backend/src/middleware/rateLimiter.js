// backend/src/middleware/rateLimiter.js
// Updated: validate:false added to all limiters to suppress
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warning on Render.
// The trust proxy setting in server.js is the real fix,
// but validate:false is added as belt-and-suspenders.

const rateLimit = require("express-rate-limit");

// ── Global API rate limiter ───────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      200,
  message: {
    success: false,
    message: "Too many requests, try again later",
  },
  standardHeaders: true,
  legacyHeaders:   false,
  // Suppress X-Forwarded-For warning on Render
  // (trust proxy in server.js is the actual fix)
  validate: { xForwardedForHeader: false },
});

// ── Strict limiter for code execution ─────────────────────
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 min
  max:      10,
  message: {
    success: false,
    message: "Execution rate limit: max 10 per minute",
  },
  standardHeaders: true,
  legacyHeaders:   false,
  validate: { xForwardedForHeader: false },
});

// ── Auth rate limiter ──────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message: {
    success: false,
    message: "Too many auth attempts",
  },
  validate: { xForwardedForHeader: false },
});

// ── AI debug rate limiter ──────────────────────────────────
const aiDebugLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      5,
  message: {
    success: false,
    message:
      "AI debug rate limit reached. Max 5 analyses per 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders:   false,
  validate: { xForwardedForHeader: false },

  // Use user ID from JWT when available, fall back to IP
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip;
  },
});

module.exports = {
  apiLimiter,
  executionLimiter,
  authLimiter,
  aiDebugLimiter,
};