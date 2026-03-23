const LANGUAGES = [
  { value: "python", label: "Python 3.11", icon: "🐍" },
  { value: "java", label: "Java 17", icon: "☕" },
  { value: "cpp", label: "C++ (GCC 12)", icon: "⚙️" },
  { value: "javascript", label: "JavaScript (Node 18)", icon: "🟨" },
];

export default function LanguageSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-400">Language:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.icon} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}