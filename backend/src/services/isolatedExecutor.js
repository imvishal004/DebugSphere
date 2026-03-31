// ─────────────────────────────────────────────────────────────
// isolatedExecutor.js
//
// Fixed:
//   1. Java binary detection — searches multiple known paths
//   2. Unhandled error event — proc.on('error') now properly
//      resolves instead of throwing unhandled exception
//   3. Worker crash prevention — all spawn errors caught
// ─────────────────────────────────────────────────────────────

const { spawn }      = require("child_process");
const { execSync }   = require("child_process");
const fs             = require("fs-extra");
const path           = require("path");
const os             = require("os");
const { v4: uuidv4 } = require("uuid");

// ── Java binary resolver ───────────────────────────────────
// Render builds install JDK during build phase.
// At runtime the binaries are in PATH via /usr/bin symlinks.
// We try multiple strategies to find the correct path.
function resolveJavaBinary(binaryName) {
  // Strategy 1 — use which to find from PATH
  try {
    const result = execSync(`which ${binaryName} 2>/dev/null`, {
      encoding: "utf8",
      timeout:  3000,
    }).trim();
    if (result) {
      console.log(`☕  Found ${binaryName} via which: ${result}`);
      return result;
    }
  } catch {
    // which failed — try next strategy
  }

  // Strategy 2 — known Render/Ubuntu paths
  const candidates = [
    `/usr/lib/jvm/java-17-openjdk-amd64/bin/${binaryName}`,
    `/usr/lib/jvm/java-17-openjdk/bin/${binaryName}`,
    `/usr/lib/jvm/java-17/bin/${binaryName}`,
    `/usr/local/lib/jvm/java-17/bin/${binaryName}`,
    `/usr/bin/${binaryName}`,
    `/opt/java/17/bin/${binaryName}`,
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log(`☕  Found ${binaryName} at: ${candidate}`);
        return candidate;
      }
    } catch {
      continue;
    }
  }

  // Strategy 3 — rely on PATH (last resort)
  console.warn(
    `⚠️  Could not find ${binaryName} in known paths. ` +
    `Falling back to PATH lookup.`
  );
  return binaryName;
}

// Resolve once at startup — logged so we can see in Render logs
const JAVAC = resolveJavaBinary("javac");
const JAVA  = resolveJavaBinary("java");

console.log(`☕  Java binaries: javac=${JAVAC} | java=${JAVA}`);

// ── Language configurations ────────────────────────────────
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
    buildCmd: (dir) => [JAVAC, [path.join(dir, "Main.java")]],
    runCmd:   (dir) => [
      JAVA,
      [
        "-cp", dir,
        // Limit Java heap to prevent OOM on free Render instance
        "-Xmx256m",
        "-Xms64m",
        "Main",
      ],
    ],
  },

  cpp: {
    fileName: "solution.cpp",
    buildCmd: (dir) => [
      "g++",
      [
        "-O2",
        "-o", path.join(dir, "solution"),
        path.join(dir, "solution.cpp"),
      ],
    ],
    runCmd: (dir) => [path.join(dir, "solution"), []],
  },
};

// ── Process runner ─────────────────────────────────────────
// FIXED: proc.on('error') now calls resolve() not reject()
// This prevents unhandled error events from crashing the worker.
//
// The previous version had this bug:
//   proc.on("error", reject)  ← if nobody catches it = worker crash
// Now it resolves with a friendly error message instead.
function runProcess(executable, args, stdinData, timeoutMs, cwd) {
  return new Promise((resolve) => {
    let stdout  = "";
    let stderr  = "";
    let killed  = false;
    let settled = false;

    // ── Safe resolve — only fires once ────────────────
    function safeResolve(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    let proc;
    let timer;

    try {
      proc = spawn(executable, args, {
        cwd:   cwd || os.tmpdir(),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          PATH:      process.env.PATH,
          HOME:      os.tmpdir(),
          TMPDIR:    os.tmpdir(),
          LANG:      "en_US.UTF-8",
          JAVA_HOME: process.env.JAVA_HOME || "/usr/lib/jvm/java-17-openjdk-amd64",
        },
      });
    } catch (spawnErr) {
      // spawn() itself threw synchronously (very rare)
      resolve({
        stdout:   "",
        stderr:   `Failed to start process: ${spawnErr.message}`,
        exitCode: -1,
        timedOut: false,
      });
      return;
    }

    // ── Timeout killer ─────────────────────────────────
    timer = setTimeout(() => {
      killed = true;
      try { proc.kill("SIGKILL"); } catch { /* already dead */ }
    }, timeoutMs);

    // ── Pipe stdin then close ──────────────────────────
    try {
      if (stdinData && stdinData.trim()) {
        proc.stdin.write(stdinData);
      }
      proc.stdin.end();
    } catch {
      // stdin may already be closed — ignore
    }

    // ── Collect output ─────────────────────────────────
    const MAX_OUTPUT = 1 * 1024 * 1024; // 1 MB cap

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

    // ── Process exit ───────────────────────────────────
    proc.on("close", (code) => {
      safeResolve({
        stdout:   stdout.trim(),
        stderr:   stderr.trim(),
        exitCode: killed ? -1 : (code ?? -1),
        timedOut: killed,
      });
    });

    // ── Spawn / runtime error ──────────────────────────
    // CRITICAL FIX: This must call resolve() not reject()
    // If we call reject() and nobody catches it with .catch()
    // Node.js throws an unhandled 'error' event and the
    // entire worker process crashes.
    proc.on("error", (err) => {
      let message = err.message;

      if (err.code === "ENOENT") {
        // Binary not found in PATH
        const friendlyNames = {
          python3: "Python 3",
          node:    "Node.js",
          javac:   "Java JDK (javac) — not installed on this server",
          java:    "Java JDK (java)  — not installed on this server",
          "g++":   "G++ compiler",
        };
        const name = friendlyNames[executable] ||
                     friendlyNames[path.basename(executable)] ||
                     executable;
        message = `${name} runtime not found. Contact administrator.`;
        console.error(
          `❌  ENOENT: ${executable} not found. ` +
          `PATH=${process.env.PATH}`
        );
      }

      safeResolve({
        stdout:   "",
        stderr:   message,
        exitCode: -1,
        timedOut: false,
      });
    });
  });
}

// ── Main exported function ─────────────────────────────────
async function executeInDocker(language, code, input) {
  const config = LANG_CONFIG[language];
  if (!config) {
    throw new Error(
      `Unsupported language: ${language}. ` +
      `Supported: ${Object.keys(LANG_CONFIG).join(", ")}`
    );
  }

  const TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT, 10) || 10000;

  // ── Create isolated temp directory ─────────────────
  const execId  = uuidv4();
  const baseDir = process.env.HOST_TEMP_DIR
    ? path.resolve(process.env.HOST_TEMP_DIR)
    : path.join(os.tmpdir(), "debugsphere");

  const tempDir = path.join(baseDir, execId);

  await fs.ensureDir(tempDir, { mode: 0o700 });

  const startTime = Date.now();

  try {
    // ── Write source file ───────────────────────────
    await fs.writeFile(
      path.join(tempDir, config.fileName),
      code,
      { encoding: "utf8", mode: 0o600 }
    );

    // ── Build step (Java, C++ only) ─────────────────
    if (config.buildCmd) {
      const [buildExe, buildArgs] = config.buildCmd(tempDir);

      console.log(
        `🔨  Compiling ${language} | exec: ${execId.slice(0, 8)} | ` +
        `compiler: ${buildExe}`
      );

      const buildResult = await runProcess(
        buildExe,
        buildArgs,
        null,
        TIMEOUT,
        tempDir
      );

      if (buildResult.exitCode !== 0) {
        const compileTime = Date.now() - startTime;
        console.log(`❌  Compilation failed in ${compileTime}ms`);
        return {
          stdout:        "",
          stderr:        buildResult.stderr || buildResult.stdout,
          executionTime: compileTime,
          exitCode:      buildResult.exitCode,
          timedOut:      buildResult.timedOut,
        };
      }

      console.log(
        `✅  Compilation OK in ${Date.now() - startTime}ms`
      );
    }

    // ── Run step ────────────────────────────────────
    const [runExe, runArgs] = config.runCmd(tempDir);
    const remainingTime     = Math.max(
      TIMEOUT - (Date.now() - startTime),
      2000
    );

    console.log(
      `▶️   Running ${language} | exec: ${execId.slice(0, 8)} | ` +
      `timeout: ${remainingTime}ms`
    );

    const runResult = await runProcess(
      runExe,
      runArgs,
      input || "",
      remainingTime,
      tempDir
    );

    const executionTime = Date.now() - startTime;

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
    await fs.remove(tempDir).catch(() => {});
  }
}

module.exports = { executeInDocker };