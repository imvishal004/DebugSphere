import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Bug, LayoutDashboard, Code2, Clock, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/editor",    label: "Editor",    icon: Code2           },
    { to: "/history",   label: "History",   icon: Clock           },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* ── Logo ───────────────────────────────────────────── */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-xl font-bold text-white"
        >
          {/* Bug icon fits "DebugSphere" better than Zap */}
          <div className="p-1 bg-indigo-600/20 rounded-lg">
            <Bug className="w-5 h-5 text-indigo-400" />
          </div>
          <span>
            Debug<span className="text-indigo-400">Sphere</span>
          </span>
        </Link>

        {/* ── Nav links ──────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                pathname.startsWith(to)
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* ── User / Logout ───────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-slate-400">
            {user?.name}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </nav>
  );
}