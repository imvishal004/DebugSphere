const mongoose = require("mongoose");

// ── AI Debug sub-schema ───────────────────────────────────────
// Kept as a nested object so all AI data is grouped cleanly.
// Using a sub-schema gives us type safety and default values
// without polluting the top-level execution document.
const aiDebugSchema = new mongoose.Schema(
  {
    // Was AI analysis attempted for this execution?
    triggered: {
      type: Boolean,
      default: false,
    },

    // Human-readable explanation of what went wrong
    explanation: {
      type: String,
      default: "",
      maxlength: 5000,
    },

    // Concrete fix suggestion from the AI
    suggestion: {
        type: String,
        default: "",
        maxlength: 5000,
    },

    // Which AI model produced this result (e.g. "gpt-4o-mini")
    model: {
      type: String,
      default: "",
    },

    // Token count for cost monitoring / usage dashboards
    tokensUsed: {
      type: Number,
      default: 0,
    },

    // When the AI analysis completed
    analyzedAt: {
      type: Date,
      default: null,
    },

    // If the AI call itself failed, store why
    // This lets the frontend show a graceful fallback message
    // instead of silently showing nothing
    aiError: {
      type: String,
      default: "",
    },
  },
  { _id: false } // no separate _id for the sub-document
);

// ── Main execution schema ─────────────────────────────────────
const executionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    codeSnippetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodeSnippet",
      default: null,
    },
    language: {
      type: String,
      required: true,
      enum: ["python", "java", "cpp", "javascript"],
    },
    code:   { type: String, required: true, maxlength: 50000 },
    input:  { type: String, default: "",    maxlength: 10000 },
    output: { type: String, default: "" },
    error:  { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "timeout"],
      default: "queued",
      index: true,
    },
    runtime:     { type: Number, default: 0 },    // milliseconds
    exitCode:    { type: Number, default: null },
    completedAt: { type: Date,   default: null },

    // ── AI debugging data ─────────────────────────────────────
    // Nested under one key so existing code that reads the
    // execution document is completely unaffected.
    // Default: null so frontend can check  result.aiDebug == null
    // to know AI was never triggered (vs triggered but errored).
    aiDebug: {
      type: aiDebugSchema,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Execution", executionSchema);