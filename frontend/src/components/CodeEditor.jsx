import Editor from "@monaco-editor/react";

const LANG_MAP = {
  python: "python",
  java: "java",
  cpp: "cpp",
  javascript: "javascript",
};

export default function CodeEditor({ language, code, onChange }) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 flex-1">
      <Editor
        height="100%"
        language={LANG_MAP[language] || "plaintext"}
        value={code}
        onChange={(val) => onChange(val || "")}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
          wordWrap: "on",
          lineNumbers: "on",
          renderLineHighlight: "all",
          suggestOnTriggerCharacters: true,
          tabSize: 4,
        }}
      />
    </div>
  );
}