// ─────────────────────────────────────────────────────────────
// isolatedExecutor.js
//
// Replaces dockerManager.js for cloud deployments where
// Docker socket is not available.
//
// Executes user code using Node.js child_process.spawn with:
//   ✅ Hard timeout  (process killed after EXECUTION_TIMEOUT ms)
//   ✅ Stdin piping  (user input passed to process)
//   ✅ Stdout/stderr separation
//   ✅ Temp directory per execution (cleaned up after)
//   ✅ Same return shape as dockerManager.js
//      { stdout, stderr, executionTime, exitCode, timedOut }
//
// Supported languages:
//   python     → python3
//   javascript → node
//   java       → javac + java
//   cpp        → g++  + ./solution
//
// Drop-in replacement:
//   worker.js only needs its import line changed.
//   Everything else (controller, queue, models) is untouched.
// ─────────────────────────────────────────────────────────────

const { spawn } = require("child_process");
const fs        = require("fs-extra");
const path      = require("path");
const os        = require("os");
const { v4: uuidv4 } = require("uuid");

// ── Language configurations ────────────────────────────────
// buildCmd: null = interpreted language, no compile step
// runCmd:   function(dir) → [executable, [args]]
const LANG_CONFIG = {
  python: {
    fileName: "solution.py",
    buildCmd: null,
    runCmd:   (dir) => ["python3", [path.join(dir, "solution.py")]],
  },

  javascript: {
    fileName: "solution.js",
    buildCmd: null,
    runCmd:   (dir) => ["node", [path.join(dir, "solution.js")]],
  },

  java: {
    fileName: "Main.java",
    // javac compiles, then java runs the class
    buildCmd: (dir) => ["javac", [path.join(dir, "Main.java")]],
    runCmd:   (dir) => ["java",  ["-cp", dir, "Main"]],
  },

  cpp: {
    fileName: "solution.cpp",
    // g++ compiles to binary, then binary runs
    buildCmd: (dir) => [
      "g++",
      ["-O2", "-o", path.join(dir, "solution"), path.join(dir, "solution.cpp")],
    ],
    runCmd: (dir) => [path.join(dir, "solution"), []],
  },
};

// ── Process runner ─────────────────────────────────────────
// Spawns a child process, pipes stdin, collects stdout/stderr.
// Kills the process if it exceeds timeoutMs.
//
// Returns:
//   { stdout, stderr, exitCode, timedOut }
function runProcess(executable, args, stdinData, timeoutMs, cwd) {
  return new Promise((resolve) => {
    let stdout  = "";
    let stderr  = "";
    let killed  = false;
    let settled = false;

    const proc = spawn(executable, args, {
      cwd:   cwd || os.tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
      // Prevent child from inheriting parent environment vars
      // that could expose secrets (NVIDIA_API_KEY etc.)
      env: {
        PATH:   process.env.PATH,
        HOME:   os.tmpdir(),
        TMPDIR: os.tmpdir(),
        LANG:   "en_US.UTF-8",
      },
    });

    // ── Timeout killer ───────────────────────────────────
    const timer = setTimeout(() => {
      if (settled) return;
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    // ── Pipe stdin then close ────────────────────────────
    // Closing stdin signals EOF to the child process so
    // input() / Scanner / cin / readline stop waiting.
    try {
      if (stdinData && stdinData.trim()) {
        proc.stdin.write(stdinData);
      }
      proc.stdin.end();
    } catch {
      // stdin may already be closed — ignore
    }

    // ── Collect output ───────────────────────────────────
    // Cap at 1 MB to prevent memory issues from infinite
    // output loops (e.g. while True: print("x"))
    const MAX_OUTPUT = 1 * 1024 * 1024; // 1 MB

    proc.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT) {
        stdout += chunk.toString("utf8");
      }
    });

    proc.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT) {
        stderr += chunk.toString("utf8");
      }
    });

    // ── Process exit ─────────────────────────────────────
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      resolve({
        stdout:   stdout.trim(),
        stderr:   stderr.trim(),
        exitCode: killed ? -1 : (code ?? -1),
        timedOut: killed,
      });
    });

    // ── Spawn error (executable not found etc.) ──────────
    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      // Give a helpful message if the runtime is missing
      let message = err.message;
      if (err.code === "ENOENT") {
        const runtimeName = {
          python3:  "Python 3",
          node:     "Node.js",
          javac:    "Java JDK",
          java:     "Java JDK",
          "g++":    "G++ compiler",
        }[executable] || executable;

        message =
          `${runtimeName} is not installed on this server. ` +
          `Contact the administrator.`;
      }

      resolve({
        stdout:   "",
        stderr:   message,
        exitCode: -1,
        timedOut: false,
      });
    });
  });
}

// ── Main exported function ─────────────────────────────────
// Drop-in replacement for dockerManager.executeInDocker().
// Same parameter signature, same return shape.
//
// @param {string} language  "python"|"java"|"cpp"|"javascript"
// @param {string} code      Source code to execute
// @param {string} input     stdin string (may be empty)
//
// @returns {Promise<{
//   stdout:        string,
//   stderr:        string,
//   executionTime: number,   // milliseconds
//   exitCode:      number,
//   timedOut:      boolean
// }>}
async function executeInDocker(language, code, input) {
  const config = LANG_CONFIG[language];
  if (!config) {
    throw new Error(
      `Unsupported language: ${language}. ` +
      `Supported: ${Object.keys(LANG_CONFIG).join(", ")}`
    );
  }

  const TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT, 10) || 10000;

  // ── Create isolated temp directory ──────────────────────
  // Each execution gets its own UUID-named directory.
  // Cleaned up in the finally block regardless of outcome.
  const execId  = uuidv4();
  const baseDir = process.env.HOST_TEMP_DIR
    ? path.resolve(process.env.HOST_TEMP_DIR)
    : path.join(os.tmpdir(), "debugsphere");

  const tempDir = path.join(baseDir, execId);

  await fs.ensureDir(tempDir, { mode: 0o700 });

  const startTime = Date.now();

  try {
    // ── Write source file ────────────────────────────────
    await fs.writeFile(
      path.join(tempDir, config.fileName),
      code,
      { encoding: "utf8", mode: 0o600 }
    );

    // ── Build step (Java, C++ only) ──────────────────────
    if (config.buildCmd) {
      const [buildExe, buildArgs] = config.buildCmd(tempDir);

      console.log(
        `🔨  Compiling ${language} | exec: ${execId.slice(0, 8)}`
      );

      const buildResult = await runProcess(
        buildExe,
        buildArgs,
        null,           // no stdin for compiler
        TIMEOUT,
        tempDir
      );

      // Compilation failed — return compiler error immediately
      if (buildResult.exitCode !== 0) {
        const compileTime = Date.now() - startTime;
        return {
          stdout:        "",
          stderr:        buildResult.stderr || buildResult.stdout,
          executionTime: compileTime,
          exitCode:      buildResult.exitCode,
          timedOut:      buildResult.timedOut,
        };
      }

      console.log(
        `✅  Compilation successful in ${Date.now() - startTime}ms`
      );
    }

    // ── Run step ─────────────────────────────────────────
    const [runExe, runArgs] = config.runCmd(tempDir);
    const remainingTime     = TIMEOUT - (Date.now() - startTime);

    console.log(
      `▶️   Running ${language} | exec: ${execId.slice(0, 8)} | ` +
      `timeout: ${remainingTime}ms`
    );

    const runResult = await runProcess(
      runExe,
      runArgs,
      input || "",
      Math.max(remainingTime, 2000), // at least 2s for run step
      tempDir
    );

    const executionTime = Date.now() - startTime;

    // ── Timeout ──────────────────────────────────────────
    if (runResult.timedOut) {
      return {
        stdout:        "",
        stderr:        `⏱ Execution timed out after ${TIMEOUT / 1000}s`,
        executionTime: TIMEOUT,
        exitCode:      -1,
        timedOut:      true,
      };
    }

    return {
      stdout:        runResult.stdout,
      stderr:        runResult.stderr,
      executionTime,
      exitCode:      runResult.exitCode,
      timedOut:      false,
    };

  } finally {
    // ── Cleanup temp directory ───────────────────────────
    // Always runs — even if execution threw an error.
    // Silent — cleanup failure should not affect the result.
    await fs.remove(tempDir).catch(() => {});
  }
}

module.exports = { executeInDocker };