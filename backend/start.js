// ─────────────────────────────────────────────────────────────
// start.js
//
// Render free tier startup script.
// Downloads portable OpenJDK 17 to /tmp/jdk at runtime
// (apt-get is not available on Render free tier).
// Then starts server.js which includes the worker.
// ─────────────────────────────────────────────────────────────

const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const { spawn, execSync } = require("child_process");

// tar package handles .tar.gz extraction
let tar;
try {
  tar = require("tar");
} catch {
  console.error("[start.js] ❌  'tar' package not found. Run: npm install tar");
  process.exit(1);
}

// ── Config ─────────────────────────────────────────────────
const JDK_DIR    = "/tmp/jdk";
const JDK_MARKER = "/tmp/jdk/.ready";
const TMP_DIR    = "/tmp/debugsphere";
const JDK_TAR    = "/tmp/jdk17.tar.gz";

// Adoptium Temurin 17 — stable portable JDK for Linux x64
const JDK_URL =
  "https://github.com/adoptium/temurin17-binaries/releases/download/" +
  "jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz";

function log(msg)  { console.log(`[start.js] ${msg}`); }
function warn(msg) { console.warn(`[start.js] ⚠️  ${msg}`); }

// ── Check if javac is available ────────────────────────────
function javaInPath() {
  try {
    execSync("javac -version 2>&1", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ── Check if JDK already downloaded ───────────────────────
function jdkReady() {
  return fs.existsSync(JDK_MARKER) &&
         fs.existsSync(path.join(JDK_DIR, "bin", "javac"));
}

// ── Download file ──────────────────────────────────────────
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    log(`Downloading JDK (~185MB) — this takes ~30-60s...`);
    const file = fs.createWriteStream(dest);

    function request(u) {
      const mod = u.startsWith("https") ? https : http;
      mod.get(u, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${u}`));
        }

        let downloaded = 0;
        const total = parseInt(res.headers["content-length"] || "0", 10);

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            if (pct % 25 === 0) {
              log(`  ${pct}% (${Math.round(downloaded / 1024 / 1024)}MB / ${Math.round(total / 1024 / 1024)}MB)`);
            }
          }
        });

        res.pipe(file);
        file.on("finish", () => {
          file.close();
          log(`Download complete`);
          resolve();
        });
        file.on("error", reject);
      }).on("error", reject);
    }

    request(url);
  });
}

// ── Extract tar.gz ─────────────────────────────────────────
function extractTar(tarPath, destDir) {
  return new Promise((resolve, reject) => {
    log(`Extracting JDK...`);
    fs.mkdirSync(destDir, { recursive: true });
    tar.extract({ file: tarPath, cwd: destDir, strip: 1 })
      .then(() => { log("Extraction complete"); resolve(); })
      .catch(reject);
  });
}

// ── Install JDK to /tmp/jdk ────────────────────────────────
async function installJDK() {
  await downloadFile(JDK_URL, JDK_TAR);
  await extractTar(JDK_TAR, JDK_DIR);

  // Remove tar to free space
  try { fs.unlinkSync(JDK_TAR); } catch { /* ignore */ }

  // Write ready marker
  fs.writeFileSync(JDK_MARKER, new Date().toISOString());
  log(`JDK ready at ${JDK_DIR}`);
}

// ── Set JAVA_HOME and update PATH ──────────────────────────
function configureJava() {
  const bin = path.join(JDK_DIR, "bin");
  process.env.JAVA_HOME = JDK_DIR;
  process.env.PATH      = `${bin}:${process.env.PATH}`;

  log(`JAVA_HOME = ${JDK_DIR}`);

  try {
    const v = execSync(`${path.join(bin, "javac")} -version 2>&1`, {
      encoding: "utf8",
      timeout:  5000,
      env:      process.env,
    }).trim();
    log(`✅  javac: ${v}`);
  } catch (e) {
    warn(`javac check failed: ${e.message}`);
  }
}

// ── Print runtime summary ──────────────────────────────────
function printSummary() {
  log("── Runtime ─────────────────────────────────");
  const checks = [
    ["node",    "node --version"],
    ["python3", "python3 --version"],
    ["javac",   "javac -version"],
    ["java",    "java -version"],
    ["g++",     "g++ --version"],
  ];
  for (const [name, cmd] of checks) {
    try {
      const out = execSync(`${cmd} 2>&1`, {
        encoding: "utf8",
        timeout:  5000,
        env:      process.env,
      }).trim().split("\n")[0];
      log(`  ✅  ${name}: ${out}`);
    } catch {
      log(`  ❌  ${name}: NOT FOUND`);
    }
  }
  log("────────────────────────────────────────────");
}

// ── Start server.js ────────────────────────────────────────
// Always starts server.js — worker is merged into it
function startServer() {
  const serviceFile = path.join(__dirname, "server.js");
  log(`Starting: node server.js`);

  const child = spawn(process.execPath, [serviceFile], {
    stdio: "inherit",
    env:   process.env,
    cwd:   __dirname,
  });

  child.on("exit", (code, signal) => {
    log(`server.js exited — code: ${code} signal: ${signal}`);
    process.exit(code || 0);
  });

  child.on("error", (e) => {
    console.error(`[start.js] Failed to start server.js: ${e.message}`);
    process.exit(1);
  });

  ["SIGTERM", "SIGINT"].forEach((sig) => {
    process.on(sig, () => {
      log(`${sig} received — shutting down`);
      child.kill(sig);
    });
  });
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  log("════════════════════════════════════════════");
  log("  DebugSphere startup");
  log(`  Node: ${process.version}`);
  log(`  Platform: ${os.platform()} ${os.arch()}`);
  log("════════════════════════════════════════════");

  // Create temp dir for code execution
  fs.mkdirSync(TMP_DIR, { recursive: true });
  log(`Temp dir: ${TMP_DIR}`);

  // Java setup
  if (javaInPath()) {
    log("✅  Java already in PATH");
  } else if (jdkReady()) {
    log("✅  JDK already downloaded — configuring...");
    configureJava();
  } else {
    log("☕  Java not found — downloading portable JDK...");
    try {
      await installJDK();
      configureJava();
    } catch (e) {
      warn(`JDK download failed: ${e.message}`);
      warn("Java execution will not work.");
      warn("Python, JavaScript, C++ will still work.");
    }
  }

  printSummary();
  startServer();
}

main().catch((e) => {
  console.error(`[start.js] Fatal: ${e.message}`);
  process.exit(1);
});