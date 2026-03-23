import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import CodeEditor from "../components/CodeEditor";
import LanguageSelector from "../components/LanguageSelector";
import OutputConsole from "../components/OutputConsole";
import { Play, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const BOILERPLATE = {
  python: `# Python 3.11
# Read input with input()
name = input("Enter your name: ")
print(f"Hello, {name}! Welcome to CloudExecX.")
`,
  java: `// Java 17
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "! Welcome to CloudExecX.");
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
    cout << "Hello, " << name << "! Welcome to CloudExecX." << endl;
    return 0;
}
`,
  javascript: `// Node.js 18
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.question('Enter your name: ', (name) => {
  console.log(\`Hello, \${name}! Welcome to CloudExecX.\`);
  rl.close();
});
`,
};

export default function Editor() {
  const { id } = useParams();
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(BOILERPLATE.python);
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("Untitled");
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snippetId, setSnippetId] = useState(id || null);

  // Load snippet if editing existing
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

  // Language change → update boilerplate only if code is default
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (!id && Object.values(BOILERPLATE).includes(code)) {
      setCode(BOILERPLATE[lang]);
    }
  };

  // Poll for result
  const pollResult = useCallback(async (executionId) => {
    const MAX = 30;
    for (let i = 0; i < MAX; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await api.get(`/executions/${executionId}`);
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

  // Execute
  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await api.post("/executions", {
        language,
        code,
        input,
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

  return (
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

      {/* Editor + Sidebar */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Code editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <CodeEditor language={language} code={code} onChange={setCode} />
        </div>

        {/* Right panel: Input + Output */}
        <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0">
          {/* Stdin input */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Standard Input (stdin)
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Enter input here…"
            />
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col min-h-0">
            <OutputConsole result={result} isRunning={isRunning} />
          </div>
        </div>
      </div>
    </div>
  );
}