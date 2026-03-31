// ─────────────────────────────────────────────────────────────
// start.js
//
// Node.js startup script for Render free tier.
// Replaces start.sh (bash not reliable on Render free tier).
//
// What it does:
//   1. Downloads portable OpenJDK to /tmp/jdk if not present
//   2. Sets JAVA_HOME + PATH environment variables
//   3. Creates /tmp/debugsphere temp directory
//   4. Spawns the actual service (server.js or worker.js)
//
// Usage:
//   node start.js server   → starts API server
//   node start.js worker   → starts BullMQ worker
//
// Java source: Adoptium (Eclipse Temurin) portable JDK
//   No apt required — pure HTTP download + tar extract
// ─────────────────────────────────────────────────────────────

const https    = require("https");
const http     = require("http");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const { spawn, execSync } = require("child_process");
const zlib     = require("zlib");
const tar      = require("tar"); // installed via npm

const SERVICE = process.argv[2] || "server";

// ── Configuration ──────────────────────────────────────────
const JDK_DIR      = "/tmp/jdk";
const JDK_MARKER   = "/tmp/jdk/.ready";  // exists when JDK is installed
const DEBUGSPHERE_TMP = "/tmp/debugsphere";

// Adoptium Temurin 17 — Linux x64 portable JDK
// This is a stable, trusted OpenJDK distribution
const JDK_URL =
  "https://github.com/adoptium/temurin17-binaries/releases/download/" +
  "jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz";

const JDK_TAR = "/tmp/jdk17.tar.gz";

// ── Logging helpers ────────────────────────────────────────
function log(msg)  { console.log(`[start.js] ${msg}`); }
function warn(msg) { console.warn(`[start.js] ⚠️  ${msg}`); }
function err(msg)  { console.error(`[start.js] ❌  ${msg}`); }

// ── Check if Java is already in PATH ──────────────────────
function javaInPath() {
  try {
    const result = execSync("javac -version 2>&1", {
      encoding: "utf8",
      timeout:  5000,
    });
    log(`javac found in PATH: ${result.trim()}`);
    return true;
  } catch {
    return false;
  }
}

// ── Check if we already downloaded JDK ────────────────────
function jdkAlreadyInstalled() {
  return fs.existsSync(JDK_MARKER);
}

// ── Download file to disk ──────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    log(`Downloading: ${url}`);
    log(`         to: ${destPath}`);

    const file = fs.createWriteStream(destPath);
    let downloaded = 0;

    function doRequest(requestUrl) {
      const protocol = requestUrl.startsWith("https") ? https : http;

      protocol.get(requestUrl, (res) => {
        // Handle redirects (GitHub releases use redirects)
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          log(`Redirect → ${redirectUrl}`);
          doRequest(redirectUrl);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            if (pct % 20 === 0) {
              log(`  Download progress: ${pct}% (${Math.round(downloaded / 1024 / 1024)}MB)`);
            }
          }
        });

        res.pipe(file);

        file.on("finish", () => {
          file.close();
          log(`Download complete: ${Math.round(downloaded / 1024 / 1024)}MB`);
          resolve();
        });
      }).on("error", (e) => {
        fs.unlink(destPath, () => {});
        reject(e);
      });
    }

    doRequest(url);
  });
}

// ── Extract tar.gz ────────────────────────────────────────
function extractTar(tarPath, destDir) {
  return new Promise((resolve, reject) => {
    log(`Extracting ${tarPath} to ${destDir}...`);
    fs.mkdirSync(destDir, { recursive: true });

    tar.extract({
      file:  tarPath,
      cwd:   destDir,
      strip: 1,        // strip the top-level jdk-17.x.x+9/ folder
    })
    .then(() => {
      log("Extraction complete");
      resolve();
    })
    .catch(reject);
  });
}

// ── Install JDK ────────────────────────────────────────────
async function installJDK() {
  log("Installing portable OpenJDK 17 to /tmp/jdk...");

  // Ensure directories exist
  fs.mkdirSync(JDK_DIR, { recursive: true });

  // Download
  await downloadFile(JDK_URL, JDK_TAR);

  // Extract
  await extractTar(JDK_TAR, JDK_DIR);

  // Cleanup tar file to save space
  try { fs.unlinkSync(JDK_TAR); } catch { /* ignore */ }

  // Write marker file
  fs.writeFileSync(JDK_MARKER, new Date().toISOString());

  log(`JDK installed at ${JDK_DIR}`);
}

// ── Set JAVA_HOME and PATH ─────────────────────────────────
function configureJavaEnv() {
  const javaBin = path.join(JDK_DIR, "bin");

  process.env.JAVA_HOME = JDK_DIR;
  process.env.PATH      = `${javaBin}:${process.env.PATH}`;

  log(`JAVA_HOME = ${JDK_DIR}`);
  log(`PATH      = ${process.env.PATH.slice(0, 100)}...`);

  // Verify
  try {
    const v = execSync(`${path.join(javaBin, "javac")} -version 2>&1`, {
      encoding: "utf8",
      timeout:  5000,
    });
    log(`✅  javac verified: ${v.trim()}`);
  } catch (e) {
    warn(`javac verification failed: ${e.message}`);
  }
}

// ── Runtime summary ────────────────────────────────────────
function printRuntimeSummary() {
  log("── Runtime Summary ─────────────────────");

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

  log("────────────────────────────────────────");
}

// ── Start Node.js service ──────────────────────────────────
function startService(serviceName) {
  const serviceFile = path.join(__dirname, `${serviceName}.js`);

  log(`Starting: node ${serviceName}.js`);

  const child = spawn(process.execPath, [serviceFile], {
    stdio: "inherit",
    env:   process.env,
    cwd:   __dirname,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      log(`Service killed by signal: ${signal}`);
      process.exit(1);
    }
    log(`Service exited with code: ${code}`);
    process.exit(code || 0);
  });

  child.on("error", (e) => {
    err(`Failed to start ${serviceName}.js: ${e.message}`);
    process.exit(1);
  });

  // Forward signals to child
  ["SIGTERM", "SIGINT"].forEach((sig) => {
    process.on(sig, () => {
      log(`Received ${sig} — forwarding to service`);
      child.kill(sig);
    });
  });
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  log(`════════════════════════════════════════`);
  log(`  DebugSphere — service: ${SERVICE}`);
  log(`  Node: ${process.version}`);
  log(`  Platform: ${os.platform()} ${os.arch()}`);
  log(`════════════════════════════════════════`);

  // Create temp dir for code execution
  fs.mkdirSync(DEBUGSPHERE_TMP, { recursive: true });
  log(`Temp dir ready: ${DEBUGSPHERE_TMP}`);

  // Check if Java is already available
  if (javaInPath()) {
    log("✅  Java already in PATH — skipping JDK download");
  } else if (jdkAlreadyInstalled()) {
    log("✅  JDK already downloaded — configuring environment");
    configureJavaEnv();
  } else {
    log("☕  Java not found — downloading portable JDK...");
    try {
      await installJDK();
      configureJavaEnv();
    } catch (e) {
      warn(`JDK download failed: ${e.message}`);
      warn("Java execution will not work on this instance.");
      warn("Other languages (Python, JS, C++) will still work.");
    }
  }

  // Print runtime summary
  printRuntimeSummary();

  // Start the actual service
  startService(SERVICE);
}

main().catch((e) => {
  err(`Fatal startup error: ${e.message}`);
  console.error(e);
  process.exit(1);
});