const router = require("express").Router();
const auth   = require("../middleware/auth");
const { executionLimiter, apiLimiter, aiDebugLimiter } =
  require("../middleware/rateLimiter");     // ← added aiDebugLimiter
const ctrl = require("../controllers/executionController");

// All execution routes require authentication
router.use(auth);

// ── Existing routes (unchanged) ───────────────────────────────
router.post("/",        executionLimiter, ctrl.execute);
router.get("/stats",    apiLimiter,       ctrl.getStats);
router.get("/history",  apiLimiter,       ctrl.getHistory);
router.get("/:id",      apiLimiter,       ctrl.getExecution);

// ── NEW: Manual AI debug route ────────────────────────────────
// POST /api/executions/:id/debug
//
// Must be placed AFTER /stats and /history routes.
// Express matches routes top-to-bottom, and :id is a wildcard —
// placing this before the GET routes would be fine since it's
// POST, but keeping related /:id routes together is cleaner.
//
// Middleware stack for this route:
//   1. auth         — verified JWT, populates req.user
//   2. aiDebugLimiter — 5 requests per 15 min per user ID
//   3. ctrl.analyzeWithAI — validates + calls AI + persists
router.post("/:id/debug", aiDebugLimiter, ctrl.analyzeWithAI);

module.exports = router;