const Execution = require("../models/Execution");
const { addExecutionJob } = require("../services/queueService");
const { sanitizeCode, sanitizeInput } = require("../utils/sanitizer");
const { analyzeError } = require("../services/aiService"); // ← NEW

// ── Existing controllers (unchanged) ─────────────────────────

exports.execute = async (req, res, next) => {
  try {
    const { language, code, input, codeSnippetId } = req.body;

    if (!language || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Language and code are required" });
    }

    const allowed = ["python", "java", "cpp", "javascript"];
    if (!allowed.includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Supported languages: ${allowed.join(", ")}`,
      });
    }

    const { sanitized: safeCode, warnings } = sanitizeCode(code);
    const safeInput = sanitizeInput(input);

    const execution = await Execution.create({
      userId:        req.user._id,
      codeSnippetId: codeSnippetId || null,
      language,
      code:          safeCode,
      input:         safeInput,
      status:        "queued",
    });

    await addExecutionJob({
      executionId: execution._id.toString(),
      language,
      code:        safeCode,
      input:       safeInput,
    });

    res.status(202).json({
      success: true,
      data: { executionId: execution._id, status: "queued", warnings },
    });
  } catch (err) {
    next(err);
  }
};

exports.getExecution = async (req, res, next) => {
  try {
    const execution = await Execution.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    }).lean();

    if (!execution) {
      return res
        .status(404)
        .json({ success: false, message: "Execution not found" });
    }
    res.json({ success: true, data: execution });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip  = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      Execution.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Execution.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      data: executions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [total, completed, failed, timeout, langAgg, avgRuntime] =
      await Promise.all([
        Execution.countDocuments({ userId }),
        Execution.countDocuments({ userId, status: "completed" }),
        Execution.countDocuments({ userId, status: "failed" }),
        Execution.countDocuments({ userId, status: "timeout" }),
        Execution.aggregate([
          { $match: { userId } },
          { $group: { _id: "$language", count: { $sum: 1 } } },
        ]),
        Execution.aggregate([
          { $match: { userId, status: "completed" } },
          { $group: { _id: null, avg: { $avg: "$runtime" } } },
        ]),
      ]);

    const languageBreakdown = {};
    langAgg.forEach((l) => (languageBreakdown[l._id] = l.count));

    res.json({
      success: true,
      data: {
        total,
        completed,
        failed,
        timeout,
        averageRuntime: Math.round(avgRuntime[0]?.avg || 0),
        languageBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── NEW: Manual AI re-analysis controller ─────────────────────
//
// Route:  POST /api/executions/:id/debug
// Auth:   required (via router.use(auth))
// Rate:   aiDebugLimiter (5 per 15 min per user)
//
// Purpose:
//   Allows the user to manually trigger (or re-trigger) AI
//   analysis on a completed failed execution.
//
//   Use cases:
//     1. Automatic analysis failed (AI was down / key missing)
//     2. User wants a fresh analysis after reading the first one
//     3. Execution was failed before AI feature was deployed
//
// Guards:
//   • Execution must belong to the requesting user
//   • Execution must have status "failed"
//     (timeout = self-explanatory, completed = no error to analyze)
//   • Code + error must be present

exports.analyzeWithAI = async (req, res, next) => {
  try {
    const execution = await Execution.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    // ── Guard: execution must exist and belong to user ────────
    if (!execution) {
      return res
        .status(404)
        .json({ success: false, message: "Execution not found" });
    }

    // ── Guard: only analyze failed executions ─────────────────
    if (execution.status !== "failed") {
      return res.status(400).json({
        success: false,
        message:
          execution.status === "completed"
            ? "Execution completed successfully — no errors to analyze"
            : execution.status === "timeout"
            ? "Execution timed out — try optimizing your algorithm"
            : `Cannot analyze execution with status: ${execution.status}`,
      });
    }

    // ── Guard: must have something to analyze ─────────────────
    if (!execution.code) {
      return res
        .status(400)
        .json({ success: false, message: "No code found in this execution" });
    }

    // ── Call AI service ───────────────────────────────────────
    console.log(
      `🤖  Manual AI analysis requested for execution ${execution._id} ` +
      `by user ${req.user._id}`
    );

    const aiResult = await analyzeError({
      language: execution.language,
      code:     execution.code,
      error:    execution.error,
      exitCode: execution.exitCode,
    });

    // ── Persist AI result ─────────────────────────────────────
    // Use findByIdAndUpdate + { new: true } to return updated doc
    const aiDebugPayload = {
      triggered:   true,
      explanation: aiResult.explanation,
      suggestion:  aiResult.suggestion,
      model:       aiResult.model,
      tokensUsed:  aiResult.tokensUsed,
      analyzedAt:  new Date(),
      aiError:     aiResult.error,
    };

    const updated = await Execution.findByIdAndUpdate(
      execution._id,
      { aiDebug: aiDebugPayload },
      { new: true }
    ).lean();

    // ── Respond ───────────────────────────────────────────────
    if (aiResult.success) {
      return res.json({
        success: true,
        message: "AI analysis complete",
        data: {
          aiDebug:     updated.aiDebug,
          executionId: execution._id,
        },
      });
    } else {
      // AI call failed but we still return 200 — we persisted the
      // error reason so the frontend can show a graceful message.
      // Using 200 (not 500) because OUR server worked fine;
      // the upstream AI provider had the issue.
      return res.status(200).json({
        success: false,
        message: `AI analysis failed: ${aiResult.error}`,
        data: {
          aiDebug:     updated.aiDebug,
          executionId: execution._id,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};