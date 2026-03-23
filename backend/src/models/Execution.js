const mongoose = require("mongoose");

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
    code: { type: String, required: true, maxlength: 50000 },
    input: { type: String, default: "", maxlength: 10000 },
    output: { type: String, default: "" },
    error: { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "timeout"],
      default: "queued",
    },
    runtime: { type: Number, default: 0 },         // milliseconds
    exitCode: { type: Number, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Execution", executionSchema);