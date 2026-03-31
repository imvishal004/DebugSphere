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
  const [showSuggestion,  setShowSuggestion]  = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);

  // ── Loading ───────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-indigo-300">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="text-sm font-medium">AI is analyzing your error…</span>
        </div>
        <p className="mt-1 text-xs text-indigo-400/70 pl-6">
          This usually takes 3–8 seconds
        </p>
      </div>
    );
  }

  // ── Not yet triggered ─────────────────────────────────────
  if (!aiDebug || !aiDebug.triggered) {
    return (
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              AI Debugging Available
            </p>
            <p className="mt-0.5 text-xs text-slate-500 pl-5">
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
            Analyze
          </button>
        </div>
      </div>
    );
  }

  // ── AI call failed ────────────────────────────────────────
  if (aiDebug.triggered && aiDebug.aiError && !aiDebug.explanation) {
    return (
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                AI Analysis Unavailable
              </p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                {aiDebug.aiError.includes("timeout")
                  ? "AI service timed out. Please try again."
                  : "AI service encountered an error. Please retry."}
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

  // ── Successful analysis ───────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-900/20 border-b border-indigo-500/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-indigo-300">
            AI Debug Analysis
          </span>
          {aiDebug.model && (
            <span className="text-[10px] text-indigo-500 bg-indigo-900/50 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
              {aiDebug.model.split("/").pop()}
            </span>
          )}
        </div>
        <button
          onClick={onAnalyze}
          title="Re-analyze with AI"
          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          Re-analyze
        </button>
      </div>

      {/* Scrollable content */}
      <div className="p-4 space-y-3 overflow-auto">

        {/* What went wrong */}
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

        {/* Divider */}
        {aiDebug.explanation && aiDebug.suggestion && (
          <div className="border-t border-indigo-500/10" />
        )}

        {/* Suggested fix */}
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

        {/* Footer */}
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

// ── Suggestion renderer — handles code blocks ──────────────
function SuggestionContent({ text }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="pl-5 space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part
            .replace(/^```[^\n]*\n?/, "")
            .replace(/```$/, "")
            .trim();

          return (
            <pre
              key={i}
              className="
                bg-slate-950 border border-slate-700/50
                rounded-md p-3 text-xs font-mono
                text-green-300 overflow-x-auto whitespace-pre-wrap
                break-words
              "
            >
              {inner}
            </pre>
          );
        }

        return part.trim() ? (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {part.trim()}
          </p>
        ) : null;
      })}
    </div>
  );
}