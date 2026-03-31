import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CodeEditor from "../components/CodeEditor";
import LanguageSelector from "../components/LanguageSelector";
import OutputConsole from "../components/OutputConsole";
import InputModal from "../components/InputModal";
import { Play, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const BOILERPLATE = {
  python: `# Python 3
name = input("Enter your name: ")
print(f"Hello, {name}! Welcome to DebugSphere.")
`,
  java: `// Java 17
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "! Welcome to DebugSphere.");
    }
}
`,
  cpp: `// C++ GCC
#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "Enter your name: ";
    getline(cin, name);
    cout << "Hello, " << name << "! Welcome to DebugSphere." << endl;
    return 0;
}
`,
  javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.question('Enter your name: ', (name) => {
  console.log(\`Hello, \${name}! Welcome to DebugSphere.\`);
  rl.close();
});
`,
};

function detectInputCalls(code, language) {
  if (!code?.trim()) return 0;
  let stripped = code;

  if (language === "python") {
    stripped = code.replace(/#.*/g, "");
    const m = stripped.match(/\binput\s*\(/g);
    return m ? m.length : 0;
  }
  if (language === "java") {
    stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const s = stripped.match(/\bsc(?:anner)?\s*\.\s*next\w*\s*\(/gi) || [];
    const r = stripped.match(/\.readLine\s*\(/g) || [];
    return s.length + r.length;
  }
  if (language === "cpp") {
    stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const c = stripped.match(/\bcin\s*>>/g) || [];
    const g = stripped.match(/\bgetline\s*\(/g) || [];
    return c.length + g.length;
  }
  if (language === "javascript") {
    stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const r = stripped.match(/\brl\.question\s*\(/g) || [];
    const s = stripped.match(/process\.stdin/g) || [];
    const o = stripped.match(/\.on\s*\(\s*['"]line['"]/g) || [];
    return r.length + s.length + o.length;
  }
  return 0;
}

export default function Editor() {
  const { id } = useParams();

  const [language,    setLanguage]    = useState("python");
  const [code,        setCode]        = useState(BOILERPLATE.python);
  const [input,       setInput]       = useState("");
  const [title,       setTitle]       = useState("Untitled");
  const [result,      setResult]      = useState(null);
  const [isRunning,   setIsRunning]   = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [snippetId,   setSnippetId]   = useState(id || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [detectedInputs, setDetectedInputs] = useState(0);

  useEffect(() => {
    if (id) {
      api.get(`/code/snippets/${id}`)
        .then((r) => {
          const s = r.data.data;
          setLanguage(s.language);
          setCode(s.code);
          setTitle(s.title);
          setSnippetId(s._id);
        })
        .catch(() => toast.error("Snippet not found"));
    }
  }, [id]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (!id && Object.values(BOILERPLATE).includes(code)) {
      setCode(BOILERPLATE[lang]);
    }
  };

  const pollResult = useCallback(async (executionId) => {
    const MAX = 60;
    for (let i = 0; i < MAX; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res  = await api.get(`/executions/${executionId}`);
        const exec = res.data.data;
        if (["completed", "failed", "timeout"].includes(exec.status)) {
          setResult(exec);
          setIsRunning(false);
          return;
        }
      } catch { break; }
    }
    setResult({ status: "failed", error: "Polling timed out" });
    setIsRunning(false);
  }, []);

  const runExecution = async (stdinInput) => {
    setIsRunning(true);
    setResult(null);
    setIsAnalyzing(false);
    try {
      const res = await api.post("/executions", {
        language,
        code,
        input:         stdinInput,
        codeSnippetId: snippetId,
      });
      const { executionId, warnings } = res.data.data;
      if (warnings?.length) warnings.forEach((w) => toast(w, { icon: "⚠️" }));
      pollResult(executionId);
    } catch (err) {
      setIsRunning(false);
      toast.error(err.response?.data?.message || "Execution failed");
    }
  };

  const handleRun = () => {
    const count = detectInputCalls(code, language);
    if (count > 0 && !input.trim()) {
      setDetectedInputs(count);
      setShowInputModal(true);
    } else {
      runExecution(input);
    }
  };

  const handleModalConfirm = (stdin) => {
    setInput(stdin);
    setShowInputModal(false);
    runExecution(stdin);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (snippetId) {
        await api.put(`/code/snippets/${snippetId}`, { title, language, code });
      } else {
        const res = await api.post("/code/save", { title, language, code });
        setSnippetId(res.data.data._id);
      }
      toast.success("Saved!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIAnalyze = useCallback(async () => {
    if (!result?._id) return;
    setIsAnalyzing(true);
    try {
      const res = await api.post(`/executions/${result._id}/debug`);
      if (res.data.success) {
        setResult((prev) => ({ ...prev, aiDebug: res.data.data.aiDebug }));
        toast.success("AI analysis complete", { icon: "🤖" });
      } else {
        setResult((prev) => ({
          ...prev,
          aiDebug: res.data.data?.aiDebug || prev?.aiDebug,
        }));
        toast.error(res.data.message || "AI analysis failed");
      }
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error("AI rate limit: max 5 per 15 min", { duration: 5000 });
      } else {
        toast.error(err.response?.data?.message || "AI analysis failed");
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [result?._id]);

  const inputCount = detectInputCalls(code, language);

  return (
    <>
      <InputModal
        isOpen={showInputModal}
        language={language}
        detectedInputs={detectedInputs}
        onConfirm={handleModalConfirm}
        onCancel={() => setShowInputModal(false)}
      />

      {/* ── Full height container ─────────────────────────── */}
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden p-4 lg:px-8 gap-4 max-w-7xl mx-auto w-full">

        {/* ── Toolbar ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 w-48 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="Snippet title"
            />
            <LanguageSelector value={language} onChange={handleLanguageChange} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {/* ── Main layout — editor + right panel ───────────── */}
        <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">

          {/* ── Code editor (left, fills remaining width) ─── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeEditor language={language} code={code} onChange={setCode} />
          </div>

          {/* ── Right panel (fixed width, full height) ───── */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-3 min-h-0 overflow-hidden">

            {/* Stdin */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-400">
                  Standard Input
                </label>
                {inputCount > 0 && (
                  <span className="text-[10px] bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    {inputCount} input{inputCount > 1 ? "s" : ""} detected
                  </span>
                )}
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                placeholder="Enter input… or click Run"
              />
            </div>

            {/* Output + AI panel — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <OutputConsole
                result={result}
                isRunning={isRunning}
                isAnalyzing={isAnalyzing}
                onAnalyze={handleAIAnalyze}
              />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}