const router = require("express").Router();
const auth = require("../middleware/auth");
const { executionLimiter, apiLimiter } = require("../middleware/rateLimiter");
const ctrl = require("../controllers/executionController");

router.use(auth);

router.post("/", executionLimiter, ctrl.execute);
router.get("/stats", apiLimiter, ctrl.getStats);
router.get("/history", apiLimiter, ctrl.getHistory);
router.get("/:id", apiLimiter, ctrl.getExecution);

module.exports = router;