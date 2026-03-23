import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import StatsCard from "../components/StatsCard";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Code2,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const langColors = {
  python: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  java: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  cpp: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  javascript: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [snippets, setSnippets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/executions/stats").then((r) => setStats(r.data.data)).catch(() => {});
    api.get("/code/snippets").then((r) => setSnippets(r.data.data)).catch(() => {});
  }, []);

  const deleteSnippet = async (id) => {
    if (!confirm("Delete this snippet?")) return;
    try {
      await api.delete(`/code/snippets/${id}`);
      setSnippets((prev) => prev.filter((s) => s._id !== id));
      toast.success("Snippet deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Overview of your coding activity</p>
        </div>
        <button
          onClick={() => navigate("/editor")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatsCard icon={Activity} label="Total Executions" value={stats.total} color="indigo" />
          <StatsCard icon={CheckCircle2} label="Successful" value={stats.completed} color="green" />
          <StatsCard icon={XCircle} label="Failed" value={stats.failed + stats.timeout} color="red" />
          <StatsCard icon={Clock} label="Avg Runtime" value={`${stats.averageRuntime}ms`} color="yellow" />
        </div>
      )}

      {/* Language breakdown */}
      {stats?.languageBreakdown && Object.keys(stats.languageBreakdown).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-10">
          <h3 className="text-lg font-semibold text-white mb-4">Language Usage</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.languageBreakdown).map(([lang, count]) => (
              <div
                key={lang}
                className={`px-4 py-2 rounded-lg border text-sm font-medium ${langColors[lang] || "bg-slate-700 text-slate-300"}`}
              >
                {lang.toUpperCase()} — {count} runs
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Snippets */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Saved Snippets</h3>

        {snippets.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Code2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No saved snippets yet.</p>
            <button
              onClick={() => navigate("/editor")}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              Create your first snippet →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snippets.map((s) => (
              <div
                key={s._id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white truncate max-w-[200px]">{s.title}</h4>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs border ${langColors[s.language]}`}>
                      {s.language}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSnippet(s._id); }}
                    className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <pre className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 max-h-24 overflow-hidden font-mono mb-3">
                  {s.code.slice(0, 200)}
                </pre>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                  </span>
                  <Link
                    to={`/editor/${s._id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}