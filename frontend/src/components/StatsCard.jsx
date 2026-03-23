export default function StatsCard({ icon: Icon, label, value, color = "indigo" }) {
  const colors = {
    indigo: "from-indigo-600/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400",
    green: "from-green-600/20 to-green-600/5 border-green-500/30 text-green-400",
    red: "from-red-600/20 to-red-600/5 border-red-500/30 text-red-400",
    yellow: "from-yellow-600/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400",
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5`}>
      <div className="flex items-center gap-3">
        <Icon className="w-8 h-8 opacity-80" />
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}