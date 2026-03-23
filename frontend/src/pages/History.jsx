import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  completed: { icon: CheckCircle2, class: "text-green-400", label: "Success" },
  failed: { icon: XCircle, class: "text-red-400", label: "Failed" },
  timeout: { icon: AlertTriangle, class: "text-yellow-400", label: "Timeout" },
  queued: { icon: Clock, class: "text-slate-400", label: "Queued" },
  running: { icon: Clock, class: "text-blue-400", label: "Running" },
};

const langBadge = {
  python: "bg-blue-500/20 text-blue-400",
  java: "bg-orange-500/20 text-orange-400",
  cpp: "bg-purple-500/20 text-purple-400",
  javascript: "bg-yellow-500/20 text-yellow-400",
};

export default function History() {
  const [executions, setExecutions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const fetchHistory = async (page = 1) => {
    try {
      const res = await api.get(`/executions/history?page=${page}&limit=15`);
      setExecutions(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Execution History</h1>
      <p className="text-slate-400 text-sm mb-8">
        All your past code executions with results.
      </p>

      {executions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-400">No executions yet.</p>
          <button
            onClick={() => navigate("/editor")}
            className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            Run your first code →
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {executions.map((exec) => {
              const cfg = statusConfig[exec.status] || statusConfig.failed;
              const Icon = cfg.icon;
              const isOpen = expanded === exec._id;

              return (
                <div
                  key={exec._id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : exec._id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/50 transition"
                  >
                    <Icon className={`w-5 h-5 ${cfg.class} shrink-0`} />
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${langBadge[exec.language]}`}>
                      {exec.language}
                    </span>
                    <span className="text-sm text-slate-300 truncate flex-1 font-mono">
                      {exec.code.slice(0, 60)}…
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {exec.runtime}ms
                    </span>
                    <span className="text-xs text-slate-500 shrink-0 hidden sm:block">
                      {format(new Date(exec.createdAt), "MMM d, HH:mm")}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-slate-800 px-5 py-4 bg-slate-800/30 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-slate-400">Code:</span>
                        <pre className="mt-1 text-xs text-slate-300 bg-slate-800 rounded-lg p-3 max-h-40 overflow-auto font-mono whitespace-pre-wrap">
                          {exec.code}
                        </pre>
                      </div>
                      {exec.input && (
                        <div>
                          <span className="text-xs font-medium text-slate-400">Input:</span>
                          <pre className="mt-1 text-xs text-slate-300 bg-slate-800 rounded-lg p-3 font-mono">
                            {exec.input}
                          </pre>
                        </div>
                      )}
                      {exec.output && (
                        <div>
                          <span className="text-xs font-medium text-slate-400">Output:</span>
                          <pre className="mt-1 text-xs text-green-300 bg-slate-800 rounded-lg p-3 font-mono whitespace-pre-wrap">
                            {exec.output}
                          </pre>
                        </div>
                      )}
                      {exec.error && (
                        <div>
                          <span className="text-xs font-medium text-slate-400">Error:</span>
                          <pre className="mt-1 text-xs text-red-400 bg-slate-800 rounded-lg p-3 font-mono whitespace-pre-wrap">
                            {exec.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchHistory(pagination.page - 1)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-slate-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchHistory(pagination.page + 1)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}