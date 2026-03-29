// ─────────────────────────────────────────────────────────────
// InputModal.jsx
//
// Shown when code contains input() / Scanner / readline / cin
// before execution starts. Lets user provide stdin values
// line by line with a clear prompt UI.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { Terminal, X, Play, Plus, Trash2 } from "lucide-react";

export default function InputModal({
  isOpen,
  language,
  detectedInputs,   // number of input() calls detected
  onConfirm,        // fn(stdinString) — called with joined input
  onCancel,
}) {
  // Each entry = one line of stdin
  const [lines, setLines] = useState([""]);
  const lastInputRef = useRef(null);

  // Reset lines when modal opens
  useEffect(() => {
    if (isOpen) {
      // Pre-populate with one empty line per detected input() call
      const count = Math.max(detectedInputs || 1, 1);
      setLines(Array(count).fill(""));
    }
  }, [isOpen, detectedInputs]);

  // Focus last input when lines change
  useEffect(() => {
    if (isOpen) {
      lastInputRef.current?.focus();
    }
  }, [lines.length, isOpen]);

  if (!isOpen) return null;

  // Label per language
  const inputFnName = {
    python:     "input()",
    java:       "Scanner.nextLine()",
    cpp:        "cin >>",
    javascript: "readline()",
  }[language] || "input()";

  const addLine    = () => setLines((l) => [...l, ""]);
  const removeLine = (i) => setLines((l) => l.filter((_, idx) => idx !== i));
  const updateLine = (i, val) =>
    setLines((l) => l.map((line, idx) => (idx === i ? val : line)));

  const handleConfirm = () => {
    // Join lines with newline — this becomes the stdin string
    const stdin = lines.join("\n");
    onConfirm(stdin);
  };

  const handleKeyDown = (e, i) => {
    // Enter on last line → add new line
    if (e.key === "Enter" && i === lines.length - 1) {
      e.preventDefault();
      addLine();
    }
    // Ctrl+Enter → confirm
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    // ── Backdrop ─────────────────────────────────────────────
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      {/* ── Modal card ───────────────────────────────────────── */}
      <div className="w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600/20 rounded-lg">
              <Terminal className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Program Input Required
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Your code calls{" "}
                <code className="text-indigo-400 bg-indigo-900/30 px-1 rounded">
                  {inputFnName}
                </code>{" "}
                {detectedInputs > 1
                  ? `${detectedInputs} times`
                  : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-400">
            Enter one value per line. Each line will be sent as a
            separate input to your program.
          </p>

          {/* Input lines */}
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Line number */}
                <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>

                {/* Input field */}
                <input
                  ref={i === lines.length - 1 ? lastInputRef : null}
                  type="text"
                  value={line}
                  onChange={(e) => updateLine(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  placeholder={`Input ${i + 1}…`}
                  className="
                    flex-1 bg-slate-800 border border-slate-700
                    rounded-lg px-3 py-2 text-sm font-mono
                    text-slate-200 placeholder-slate-600
                    focus:ring-2 focus:ring-indigo-500
                    focus:border-transparent outline-none
                    transition-colors
                  "
                />

                {/* Remove line button (only if more than 1 line) */}
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(i)}
                    className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add line button */}
          <button
            onClick={addLine}
            className="
              flex items-center gap-1.5 text-xs text-slate-400
              hover:text-indigo-400 transition-colors mt-1
            "
          >
            <Plus className="w-3.5 h-3.5" />
            Add another input line
          </button>

          {/* Stdin preview */}
          {lines.some((l) => l.trim()) && (
            <div className="mt-2 p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">
                stdin preview
              </p>
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                {lines.join("\n") || " "}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/50 border-t border-slate-700">
          <p className="text-[11px] text-slate-500">
            Ctrl+Enter to run
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="
                px-3 py-1.5 text-sm text-slate-400
                hover:text-slate-200 transition-colors
              "
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="
                flex items-center gap-1.5 px-4 py-1.5
                bg-green-600 hover:bg-green-500
                text-white text-sm font-semibold
                rounded-lg transition-colors
              "
            >
              <Play className="w-3.5 h-3.5" />
              Run Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}