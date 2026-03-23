const mongoose = require("mongoose");

const codeSnippetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Untitled",
      trim: true,
      maxlength: 200,
    },
    language: {
      type: String,
      required: true,
      enum: ["python", "java", "cpp", "javascript"],
    },
    code: {
      type: String,
      required: true,
      maxlength: 50000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CodeSnippet", codeSnippetSchema);