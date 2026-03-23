const router = require("express").Router();
const auth = require("../middleware/auth");
const { apiLimiter } = require("../middleware/rateLimiter");
const ctrl = require("../controllers/codeController");

router.use(auth);
router.use(apiLimiter);

router.post("/save", ctrl.saveSnippet);
router.get("/snippets", ctrl.getSnippets);
router.get("/snippets/:id", ctrl.getSnippetById);
router.put("/snippets/:id", ctrl.updateSnippet);
router.delete("/snippets/:id", ctrl.deleteSnippet);

module.exports = router;