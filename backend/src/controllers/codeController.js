const CodeSnippet = require("../models/CodeSnippet");

exports.saveSnippet = async (req, res, next) => {
  try {
    const { title, language, code } = req.body;

    if (!language || !code) {
      return res.status(400).json({ success: false, message: "Language and code are required" });
    }

    const snippet = await CodeSnippet.create({
      userId: req.user._id,
      title: title || "Untitled",
      language,
      code,
    });

    res.status(201).json({ success: true, data: snippet });
  } catch (err) {
    next(err);
  }
};

exports.getSnippets = async (req, res, next) => {
  try {
    const snippets = await CodeSnippet.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: snippets });
  } catch (err) {
    next(err);
  }
};

exports.getSnippetById = async (req, res, next) => {
  try {
    const snippet = await CodeSnippet.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!snippet) {
      return res.status(404).json({ success: false, message: "Snippet not found" });
    }
    res.json({ success: true, data: snippet });
  } catch (err) {
    next(err);
  }
};

exports.deleteSnippet = async (req, res, next) => {
  try {
    const snippet = await CodeSnippet.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!snippet) {
      return res.status(404).json({ success: false, message: "Snippet not found" });
    }
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    next(err);
  }
};

exports.updateSnippet = async (req, res, next) => {
  try {
    const { title, language, code } = req.body;

    const snippet = await CodeSnippet.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, language, code },
      { new: true, runValidators: true }
    );

    if (!snippet) {
      return res.status(404).json({ success: false, message: "Snippet not found" });
    }
    res.json({ success: true, data: snippet });
  } catch (err) {
    next(err);
  }
};