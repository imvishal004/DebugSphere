const rateLimit = require("express-rate-limit");

// ── Global API rate limiter ───────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  message: { success: false, message: "Too many requests, try again later" },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Strict limiter for code execution ─────────────────────────
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  max: 10,
  message: {
    success: false,
    message: "Execution rate limit: max 10 per minute",
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Auth rate limiter ─────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts" },
});

// ── AI debug rate limiter ─────────────────────────────────────
// Why stricter than executionLimiter:
//   • Each call hits a paid external API (OpenAI / Gemini)
//   • Cost per call: ~$0.001–$0.01 depending on model
//   • 5 calls per 15 min = max ~20/hour per user
//   • Still generous enough for legitimate debugging sessions
//   • windowMs matches apiLimiter (15 min) for consistency
//
// If you want per-user limits (not per-IP), you need
// express-rate-limit with a custom keyGenerator.
// For now, IP-based is sufficient and requires no extra deps.
const aiDebugLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min window
  max: 5,                     // 5 AI calls per 15 min per IP
  message: {
    success: false,
    message:
      "AI debug rate limit reached. Max 5 analyses per 15 minutes. " +
      "Automatic analysis is still available on new executions.",
  },
  standardHeaders: true,
  legacyHeaders:   false,

  // Use user ID from JWT as key when available, fall back to IP.
  // This prevents one user bypassing the limit by rotating IPs,
  // and prevents multiple users on the same IP (e.g. office NAT)
  // from sharing a limit.
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip;
  },

  // Skip successful responses from the rate limit count.
  // Only count actual AI calls that consumed tokens.
  skipSuccessfulRequests: false,
});

module.exports = {
  apiLimiter,
  executionLimiter,
  authLimiter,
  aiDebugLimiter,   // ← NEW export
};