import Editor from "@monaco-editor/react";

const LANG_MAP = {
  python:     "python",
  java:       "java",
  cpp:        "cpp",
  javascript: "javascript",
};

export default function CodeEditor({ language, code, onChange }) {
  return (
    // h-full → takes 100% of whatever the parent gives it
    // w-full → full width
    // Remove flex-1 — that only works inside a flex container
    <div className="h-full w-full rounded-lg overflow-hidden border border-slate-700">
      <Editor
        height="100%"
        width="100%"
        language={LANG_MAP[language] || "plaintext"}
        value={code}
        onChange={(val) => onChange(val || "")}
        theme="vs-dark"
        options={{
          fontSize:               14,
          fontFamily:             "'JetBrains Mono', 'Fira Code', monospace",
          minimap:                { enabled: false },
          scrollBeyondLastLine:   false,
          padding:                { top: 16, bottom: 16 },
          automaticLayout:        true,
          wordWrap:               "on",
          lineNumbers:            "on",
          renderLineHighlight:    "all",
          suggestOnTriggerCharacters: true,
          tabSize:                4,
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center bg-slate-900">
            <span className="text-slate-500 text-sm">Loading editor…</span>
          </div>
        }
      />
    </div>
  );
}