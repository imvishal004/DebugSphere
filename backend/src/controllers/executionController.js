const Execution = require("../models/Execution");
const { addExecutionJob } = require("../services/queueService");
const { sanitizeCode, sanitizeInput } = require("../utils/sanitizer");

exports.execute = async (req, res, next) => {
  try {
    const { language, code, input, codeSnippetId } = req.body;

    if (!language || !code) {
      return res.status(400).json({ success: false, message: "Language and code are required" });
    }

    const allowed = ["python", "java", "cpp", "javascript"];
    if (!allowed.includes(language)) {
      return res.status(400).json({ success: false, message: `Supported languages: ${allowed.join(", ")}` });
    }

    // Sanitise
    const { sanitized: safeCode, warnings } = sanitizeCode(code);
    const safeInput = sanitizeInput(input);

    // Create execution record
    const execution = await Execution.create({
      userId: req.user._id,
      codeSnippetId: codeSnippetId || null,
      language,
      code: safeCode,
      input: safeInput,
      status: "queued",
    });

    // Enqueue
    await addExecutionJob({
      executionId: execution._id.toString(),
      language,
      code: safeCode,
      input: safeInput,
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
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!execution) {
      return res.status(404).json({ success: false, message: "Execution not found" });
    }
    res.json({ success: true, data: execution });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

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