// ─────────────────────────────────────────────────────────────
// AIDebugPanel.jsx
//
// Displays AI-generated debugging analysis for failed executions.
//
// Props:
//   aiDebug      {object|null} - The aiDebug field from Execution
//   executionId  {string}      - For the manual re-analyze button
//   isAnalyzing  {boolean}     - True while manual request is in flight
//   onAnalyze    {function}    - Called when user clicks "Analyze" button
//
// Render states:
//   1. null aiDebug + no error     → show "Analyze with AI" button
//   2. isAnalyzing                 → loading spinner
//   3. aiDebug.triggered + success → show explanation + suggestion
//   4. aiDebug.triggered + aiError → show error + retry button
//   5. aiDebug.aiError only        → auto-analysis failed, show retry
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lightbulb,
  Bug,
} from "lucide-react";

export default function AIDebugPanel({
  aiDebug,
  executionId,
  isAnalyzing,
  onAnalyze,
}) {
  // Collapse/expand the suggestion section independently
  const [showSuggestion, setShowSuggestion] = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);

  // ── State 1: Loading (manual request in flight) ───────────
  if (isAnalyzing) {
    return (
      <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-950/40 p-4">
        <div className="flex items-center gap-2 text-indigo-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">
            AI is analyzing your error…
          </span>
        </div>
        <p className="mt-1 text-xs text-indigo-400/70">
          This usually takes 3–8 seconds
        </p>
      </div>
    );
  }

  // ── State 2: Not yet triggered — show CTA button ──────────
  if (!aiDebug || !aiDebug.triggered) {
    return (
      <div className="mt-3 rounded-lg border border-slate-600/50 bg-slate-800/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              AI Debugging Available
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Let AI explain the error and suggest a fix
            </p>
          </div>
          <button
            onClick={onAnalyze}
            disabled={!executionId}
            className="
              flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5
              bg-indigo-600 hover:bg-indigo-500
              disabled:opacity-40 disabled:cursor-not-allowed
              text-white text-xs font-semibold rounded-md
              transition-colors duration-150
            "
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze with AI
          </button>
        </div>
      </div>
    );
  }

  // ── State 3: AI call itself failed ────────────────────────
  if (aiDebug.triggered && aiDebug.aiError && !aiDebug.explanation) {
    return (
      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                AI Analysis Unavailable
              </p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                {aiDebug.aiError.includes("API_KEY")
                  ? "AI service is not configured. Contact the administrator."
                  : aiDebug.aiError.includes("TIMEOUT")
                  ? "AI service timed out. Please try again."
                  : "AI service encountered an error. Please try again."}
              </p>
            </div>
          </div>
          <button
            onClick={onAnalyze}
            className="
              flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5
              bg-slate-700 hover:bg-slate-600
              text-slate-300 text-xs font-medium rounded-md
              transition-colors duration-150
            "
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── State 4: Successful AI analysis ──────────────────────
  return (
    <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-950/30 overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-900/30 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">
            AI Debug Analysis
          </span>
          {aiDebug.model && (
            <span className="text-[10px] text-indigo-500 bg-indigo-900/50 px-1.5 py-0.5 rounded-full">
              {aiDebug.model}
            </span>
          )}
        </div>
        {/* Re-analyze button */}
        <button
          onClick={onAnalyze}
          title="Re-analyze with AI"
          className="
            flex items-center gap-1 text-[11px] text-indigo-400
            hover:text-indigo-300 transition-colors duration-150
          "
        >
          <RefreshCw className="w-3 h-3" />
          Re-analyze
        </button>
      </div>

      <div className="p-4 space-y-3">

        {/* Explanation section */}
        {aiDebug.explanation && (
          <div>
            <button
              onClick={() => setShowExplanation((v) => !v)}
              className="flex items-center gap-1.5 w-full text-left mb-2"
            >
              <Bug className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                What went wrong
              </span>
              {showExplanation
                ? <ChevronUp   className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto" />
              }
            </button>
            {showExplanation && (
              <p className="text-sm text-slate-300 leading-relaxed pl-5">
                {aiDebug.explanation}
              </p>
            )}
          </div>
        )}

        {/* Divider between sections */}
        {aiDebug.explanation && aiDebug.suggestion && (
          <div className="border-t border-indigo-500/10" />
        )}

        {/* Suggestion section */}
        {aiDebug.suggestion && (
          <div>
            <button
              onClick={() => setShowSuggestion((v) => !v)}
              className="flex items-center gap-1.5 w-full text-left mb-2"
            >
              <Lightbulb className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Suggested fix
              </span>
              {showSuggestion
                ? <ChevronUp   className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto" />
              }
            </button>
            {showSuggestion && (
              <SuggestionContent text={aiDebug.suggestion} />
            )}
          </div>
        )}

        {/* Footer metadata */}
        {aiDebug.analyzedAt && (
          <div className="pt-1 flex items-center justify-between text-[10px] text-indigo-500/60">
            <span>
              Analyzed {new Date(aiDebug.analyzedAt).toLocaleTimeString()}
            </span>
            {aiDebug.tokensUsed > 0 && (
              <span>{aiDebug.tokensUsed} tokens</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: renders suggestion with code block support ──
// Detects fenced code blocks (```...```) in the suggestion text
// and renders them in a monospace block with distinct styling.
// Plain text paragraphs are rendered normally.
function SuggestionContent({ text }) {
  // Split on code fences — captures the code block content
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="pl-5 space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Strip the opening fence line (```python, ```js, etc.)
          const inner = part
            .replace(/^```[^\n]*\n?/, "")
            .replace(/```$/, "")
            .trim();

          return (
            <pre
              key={i}
              className="
                bg-slate-900/80 border border-slate-700/50
                rounded-md p-3 text-xs font-mono
                text-green-300 overflow-x-auto whitespace-pre-wrap
              "
            >
              {inner}
            </pre>
          );
        }

        // Plain text — preserve line breaks
        return part.trim() ? (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {part.trim()}
          </p>
        ) : null;
      })}
    </div>
  );
}