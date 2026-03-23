const Docker = require("dockerode");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

const docker = new Docker({ socketPath: "//./pipe/docker_engine" });

// ── Language configurations ──────────────────────────────────
const LANG_CONFIG = {
  python: {
    image: "cloudexecx-python",
    fileName: "solution.py",
    buildCmd: null,
    runCmd: "python3 /workspace/solution.py",
  },
  java: {
    image: "cloudexecx-java",
    fileName: "Main.java",
    buildCmd: "javac /workspace/Main.java",
    runCmd: "java -cp /workspace Main",
  },
  cpp: {
    image: "cloudexecx-cpp",
    fileName: "solution.cpp",
    buildCmd: "g++ -O2 -o /workspace/solution /workspace/solution.cpp",
    runCmd: "/workspace/solution",
  },
  javascript: {
    image: "cloudexecx-javascript",
    fileName: "solution.js",
    buildCmd: null,
    runCmd: "node /workspace/solution.js",
  },
};

// ── Demux Docker multiplexed stream into stdout / stderr ─────
function demuxStream(buffer) {
  let stdout = "";
  let stderr = "";
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const type = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > buffer.length) break;
    const chunk = buffer.slice(offset, offset + size).toString("utf8");
    if (type === 1) stdout += chunk;
    else if (type === 2) stderr += chunk;
    offset += size;
  }

  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// ── Core executor ────────────────────────────────────────────
async function executeInDocker(language, code, input) {
  const config = LANG_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT, 10) || 10000;
  const MEMORY =
    parseInt(process.env.DOCKER_MEMORY_LIMIT, 10) || 256 * 1024 * 1024;

  const execId = uuidv4();
  const hostTmp =
    process.env.HOST_TEMP_DIR || path.resolve(os.tmpdir(), "cloudexecx");

  const tempDir = path.resolve(hostTmp, execId);

  await fs.ensureDir(tempDir, { mode: 0o777 });
  await fs.writeFile(path.join(tempDir, config.fileName), code, {
    mode: 0o666,
  });
  await fs.writeFile(path.join(tempDir, "input.txt"), input || "", {
    mode: 0o666,
  });

  // Build shell command
  let shellCmd;
  if (config.buildCmd) {
    shellCmd = `${config.buildCmd} 2>&1 && ${config.runCmd} < /workspace/input.txt 2>&1`;
  } else {
    shellCmd = `${config.runCmd} < /workspace/input.txt 2>&1`;
  }

  // We split stderr and stdout properly by NOT redirecting stderr to stdout
  // Instead, capture both streams separately via Docker logs
  let shellCmdSeparate;
  if (config.buildCmd) {
    shellCmdSeparate = `${config.buildCmd} && ${config.runCmd} < /workspace/input.txt`;
  } else {
    shellCmdSeparate = `${config.runCmd} < /workspace/input.txt`;
  }

  const startTime = Date.now();
  let container = null;

  const dockerPath = tempDir.replace(/\\/g, "/");

  try {
    container = await docker.createContainer({
      Image: config.image,
      Cmd: ["sh", "-c", shellCmdSeparate],
      HostConfig: {
        Binds: [`${dockerPath}:/workspace`],

        Memory: MEMORY,
        MemorySwap: MEMORY,
        CpuPeriod: 100000,
        CpuQuota: parseInt(process.env.DOCKER_CPU_QUOTA, 10) || 50000,
        NetworkMode: "none",
        PidsLimit: 64,
        SecurityOpt: ["no-new-privileges"],
        AutoRemove: false,
      },
      NetworkDisabled: true,
      StopTimeout: Math.ceil(TIMEOUT / 1000),
    });

    await container.start();

    // Wait with timeout
    const waitPromise = container.wait();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("EXECUTION_TIMEOUT")), TIMEOUT),
    );

    let statusCode = -1;
    try {
      const result = await Promise.race([waitPromise, timeoutPromise]);
      statusCode = result.StatusCode;
    } catch (err) {
      if (err.message === "EXECUTION_TIMEOUT") {
        try {
          await container.kill();
        } catch (_) {}
        return {
          stdout: "",
          stderr: `⏱ Execution timed out after ${TIMEOUT / 1000}s`,
          executionTime: TIMEOUT,
          exitCode: -1,
          timedOut: true,
        };
      }
      throw err;
    }

    const executionTime = Date.now() - startTime;

    // Gather logs
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
    });
    const { stdout, stderr } = demuxStream(logBuffer);

    return {
      stdout,
      stderr,
      executionTime,
      exitCode: statusCode,
      timedOut: false,
    };
  } finally {
    // Cleanup
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (_) {}
    }
    await fs.remove(tempDir).catch(() => {});
  }
}

module.exports = { executeInDocker };
