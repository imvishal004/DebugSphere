const { spawn } = require("child_process");
const fs        = require("fs-extra");
const path      = require("path");
const os        = require("os");
const { v4: uuidv4 } = require("uuid");

// ── Java detection (FIXED) ───────────────────────────────

function findJavaBinary(binaryName) {

  const localJavaHome =
    process.env.JAVA_HOME ||
    path.join(process.cwd(), "java");

  const candidates = [

    path.join(localJavaHome, "bin", binaryName),

    `/usr/bin/${binaryName}`,

    `/usr/lib/jvm/java-17-openjdk-amd64/bin/${binaryName}`,

    binaryName,
  ];

  for (const candidate of candidates) {

    try {

      if (
        candidate === binaryName ||
        require("fs").existsSync(candidate)
      ) {
        return candidate;
      }

    } catch {}

  }

  return binaryName;
}

const JAVAC = findJavaBinary("javac");
const JAVA  = findJavaBinary("java");

console.log(
  `☕ Java binaries: javac=${JAVAC} | java=${JAVA}`
);

// ── Language configs ─────────────────────────────────────

const LANG_CONFIG = {

  python: {
    fileName: "solution.py",
    buildCmd: null,
    runCmd: (dir) => [
      "python3",
      [path.join(dir, "solution.py")],
    ],
  },

  javascript: {
    fileName: "solution.js",
    buildCmd: null,
    runCmd: (dir) => [
      "node",
      [path.join(dir, "solution.js")],
    ],
  },

  java: {
    fileName: "Main.java",
    buildCmd: (dir) => [
      JAVAC,
      [path.join(dir, "Main.java")],
    ],
    runCmd: (dir) => [
      JAVA,
      ["-cp", dir, "Main"],
    ],
  },

  cpp: {
    fileName: "solution.cpp",
    buildCmd: (dir) => [
      "g++",
      [
        "-O2",
        "-o",
        path.join(dir, "solution"),
        path.join(dir, "solution.cpp"),
      ],
    ],
    runCmd: (dir) => [
      path.join(dir, "solution"),
      [],
    ],
  },

};

// ── Execution logic unchanged ───────────────────────────

async function executeInDocker(language, code, input) {

  const config = LANG_CONFIG[language];

  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const TIMEOUT =
    parseInt(process.env.EXECUTION_TIMEOUT, 10)
    || 10000;

  const execId  = uuidv4();

  const baseDir =
    process.env.HOST_TEMP_DIR
      ? path.resolve(process.env.HOST_TEMP_DIR)
      : path.join(os.tmpdir(), "debugsphere");

  const tempDir = path.join(baseDir, execId);

  await fs.ensureDir(tempDir, { mode: 0o700 });

  const startTime = Date.now();

  try {

    await fs.writeFile(
      path.join(tempDir, config.fileName),
      code,
      { encoding: "utf8", mode: 0o600 }
    );

    if (config.buildCmd) {

      const [exe, args] =
        config.buildCmd(tempDir);

      await new Promise((resolve, reject) => {

        const proc = spawn(exe, args);

        proc.on("close", (code) => {

          if (code !== 0)
            reject(new Error("Compilation failed"));

          else resolve();

        });

      });

    }

    const [runExe, runArgs] =
      config.runCmd(tempDir);

    return new Promise((resolve) => {

      let stdout = "";
      let stderr = "";

      const proc =
        spawn(runExe, runArgs, {
          cwd: tempDir,
          env: {
            ...process.env,
            JAVA_HOME:
              process.env.JAVA_HOME,
          },
        });

      const timer = setTimeout(() => {

        proc.kill("SIGKILL");

        resolve({
          stdout: "",
          stderr:
            `⏱ Execution timed out`,
          executionTime: TIMEOUT,
          exitCode: -1,
          timedOut: true,
        });

      }, TIMEOUT);

      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });

      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("close", (code) => {

        clearTimeout(timer);

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          executionTime:
            Date.now() - startTime,
          exitCode: code,
          timedOut: false,
        });

      });

    });

  }

  finally {

    await fs.remove(tempDir)
      .catch(() => {});

  }

}

module.exports = { executeInDocker };