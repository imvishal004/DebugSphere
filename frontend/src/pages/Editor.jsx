import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CodeEditor from "../components/CodeEditor";
import LanguageSelector from "../components/LanguageSelector";
import OutputConsole from "../components/OutputConsole";
import InputModal from "../components/InputModal";   // ← NEW
import { Play, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const BOILERPLATE = {
  python: `# Python 3.11
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
  cpp: `// C++ (GCC 12)
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
  javascript: `// Node.js 18
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.question('Enter your name: ', (name) => {
  console.log(\`Hello, \${name}! Welcome to DebugSphere.\`);
  rl.close();
});
`,
};

// ── Input detector ─────────────────────────────────────────────
// Scans code for stdin read calls per language.
// Returns count of detected input calls (0 = no input needed).
//
// We scan BEFORE execution so we can prompt the user.
// Handles comments by stripping them first.
function detectInputCalls(code, language) {
  if (!code?.trim()) return 0;

  // Strip single-line comments to avoid false positives
  // e.g. # input() in a Python comment should not trigger modal
  let stripped = code;

  if (language === "python") {
    // Remove # comments
    stripped = code.replace(/#.*/g, "");
    // Count input( occurrences
    const matches = stripped.match(/\binput\s*\(/g);
    return matches ? matches.length : 0;
  }

  if (language === "java") {
    // Remove // comments and /* */ blocks
    stripped = code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    // Count Scanner.next*, BufferedReader.readLine
    const scannerMatches = stripped.match(
      /\bsc(?:anner)?\s*\.\s*next\w*\s*\(/gi
    ) || [];
    const readerMatches  = stripped.match(
      /\.readLine\s*\(/g
    ) || [];
    return scannerMatches.length + readerMatches.length;
  }

  if (language === "cpp") {
    // Remove // and /* */ comments
    stripped = code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    // Count cin >> occurrences and getline calls
    const cinMatches     = stripped.match(/\bcin\s*>>/g)      || [];
    const getlineMatches = stripped.match(/\bgetline\s*\(/g)   || [];
    return cinMatches.length + getlineMatches.length;
  }

  if (language === "javascript") {
    // Remove // and /* */ comments
    stripped = code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    // Count readline question/on calls and process.stdin
    const rlMatches    = stripped.match(/\brl\.question\s*\(/g)  || [];
    const stdinMatches = stripped.match(/process\.stdin/g)        || [];
    const onMatches    = stripped.match(/\.on\s*\(\s*['"]line['"]/g) || [];
    return rlMatches.length + stdinMatches.length + onMatches.length;
  }

  return 0;
}

export default function Editor() {
  const { id } = useParams();
  const [language,   setLanguage]   = useState("python");
  const [code,       setCode]       = useState(BOILERPLATE.python);
  const [input,      setInput]      = useState("");
  const [title,      setTitle]      = useState("Untitled");
  const [result,     setResult]     = useState(null);
  const [isRunning,  setIsRunning]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [snippetId,  setSnippetId]  = useState(id || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Input modal state ──────────────────────────────────────
  const [showInputModal,   setShowInputModal]   = useState(false);
  const [detectedInputs,   setDetectedInputs]   = useState(0);

  // Load snippet
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

  // Poll for execution result
  const pollResult = useCallback(async (executionId) => {
    const MAX = 60;   // increased from 30 — AI analysis takes time
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
      } catch {
        break;
      }
    }
    setResult({ status: "failed", error: "Polling timed out" });
    setIsRunning(false);
  }, []);

  // ── Core execution function ────────────────────────────────
  // Called directly when no input needed,
  // or called from modal confirm with stdin string.
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

  // ── Run button handler ─────────────────────────────────────
  // 1. Detect input calls in code
  // 2. If found AND stdin textarea is empty → show modal
  // 3. If stdin already provided → run directly
  // 4. If no input calls → run directly
  const handleRun = () => {
    const inputCount = detectInputCalls(code, language);

    if (inputCount > 0 && !input.trim()) {
      // Code needs input but user hasn't provided any
      // Show modal so user can enter input values
      setDetectedInputs(inputCount);
      setShowInputModal(true);
    } else {
      // Either no input needed OR user already filled stdin textarea
      runExecution(input);
    }
  };

  // ── Modal confirm ──────────────────────────────────────────
  const handleModalConfirm = (stdinString) => {
    setInput(stdinString);       // save to stdin textarea for reference
    setShowInputModal(false);
    runExecution(stdinString);
  };

  // ── Modal cancel ───────────────────────────────────────────
  const handleModalCancel = () => {
    setShowInputModal(false);
    // Do NOT run — user cancelled
  };

  // Save
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

  // AI analyze
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
        toast.error("AI rate limit reached. Max 5 analyses per 15 minutes.", {
          duration: 5000,
        });
      } else {
        toast.error(err.response?.data?.message || "AI analysis request failed");
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [result?._id]);

  return (
    <>
      {/* ── Input Modal ────────────────────────────────────── */}
      <InputModal
        isOpen={showInputModal}
        language={language}
        detectedInputs={detectedInputs}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />

      <div className="h-[calc(100vh-64px)] flex flex-col p-4 lg:px-8 gap-4 max-w-7xl mx-auto w-full">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
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
              {isSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save    className="w-4 h-4" />
              }
              Save
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              {isRunning
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Play    className="w-4 h-4" />
              }
              {isRunning ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {/* Editor + Sidebar */}
        <div className="flex-1 flex gap-4 min-h-0">

          {/* Code editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <CodeEditor language={language} code={code} onChange={setCode} />
          </div>

          {/* Right panel */}
          <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">

            {/* Stdin textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-400">
                  Standard Input (stdin)
                </label>
                {/* Show badge if inputs detected */}
                {detectInputCalls(code, language) > 0 && (
                  <span className="text-[10px] bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    {detectInputCalls(code, language)} input
                    {detectInputCalls(code, language) > 1 ? "s" : ""} detected
                  </span>
                )}
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                placeholder="Enter input here… or click Run and we'll ask you"
              />
            </div>

            {/* Output */}
            <div className="flex-1 flex flex-col min-h-0">
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