import { Terminal, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function OutputConsole({ result, isRunning }) {
  const statusIcon = () => {
    if (isRunning) return <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />;
    if (!result) return <Terminal className="w-4 h-4 text-slate-500" />;
    if (result.status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  const statusLabel = () => {
    if (isRunning) return "Running…";
    if (!result) return "Ready";
    if (result.status === "completed") return "Completed";
    if (result.status === "timeout") return "Timed Out";
    return "Error";
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50 rounded-t-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          {statusIcon()}
          {statusLabel()}
        </div>
        {result?.runtime !== undefined && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {result.runtime}ms
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 font-mono text-sm flex-1 min-h-[120px] max-h-[300px] overflow-auto whitespace-pre-wrap">
        {isRunning && (
          <span className="text-yellow-400 animate-pulse-fast">
            ▶ Executing code in isolated container…
          </span>
        )}

        {!isRunning && !result && (
          <span className="text-slate-500">Output will appear here after execution.</span>
        )}

        {!isRunning && result && (
          <>
            {result.output && <div className="text-green-300">{result.output}</div>}
            {result.error && <div className="text-red-400 mt-2">{result.error}</div>}
            {!result.output && !result.error && (
              <span className="text-slate-500">(No output)</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}