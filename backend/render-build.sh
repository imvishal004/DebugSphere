#!/bin/bash
# ─────────────────────────────────────────────────────────────
# render-build.sh
# Installs language runtimes + npm dependencies on Render.
# Runs during BUILD phase — not at runtime.
# ─────────────────────────────────────────────────────────────

set -e  # exit on any error

echo ""
echo "════════════════════════════════════════════════"
echo "  DebugSphere — Render Build Script"
echo "════════════════════════════════════════════════"
echo ""

# ── Update package list ────────────────────────────────────
echo "📦  Updating apt..."
apt-get update -qq

# ── Python 3 ──────────────────────────────────────────────
echo "🐍  Installing Python 3..."
apt-get install -y -qq python3
python3 --version && echo "    ✅ Python OK" || echo "    ❌ Python FAILED"

# ── OpenJDK 17 ────────────────────────────────────────────
echo "☕  Installing OpenJDK 17..."
apt-get install -y -qq openjdk-17-jdk-headless

# Verify java and javac are available
if command -v javac &> /dev/null; then
  echo "    ✅ javac OK: $(javac -version 2>&1)"
else
  echo "    ❌ javac NOT FOUND — trying full JDK..."
  apt-get install -y openjdk-17-jdk
fi

if command -v java &> /dev/null; then
  echo "    ✅ java OK: $(java -version 2>&1 | head -1)"
else
  echo "    ❌ java NOT FOUND"
fi

# ── Set JAVA_HOME persistently ─────────────────────────────
JAVA_DIR=$(dirname $(dirname $(readlink -f $(which java) 2>/dev/null || echo "/usr/bin/java")))
echo "    JAVA_DIR detected: $JAVA_DIR"

# Write JAVA_HOME to a file that isolatedExecutor can read
echo "$JAVA_DIR" > /tmp/java_home.txt
echo "    JAVA_HOME written to /tmp/java_home.txt"

# ── G++ compiler ───────────────────────────────────────────
echo "⚙️   Installing G++..."
apt-get install -y -qq g++ build-essential
g++ --version | head -1 && echo "    ✅ G++ OK" || echo "    ❌ G++ FAILED"

# ── Temp directory ─────────────────────────────────────────
echo "📁  Creating /tmp/debugsphere..."
mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere
echo "    ✅ Temp dir OK"

# ── npm install ────────────────────────────────────────────
echo "📦  Running npm install..."
npm install
echo "    ✅ npm install OK"

echo ""
echo "════════════════════════════════════════════════"
echo "  ✅  Build complete"
echo "════════════════════════════════════════════════"
echo "  node:    $(node --version)"
echo "  python3: $(python3 --version 2>&1)"
echo "  java:    $(java -version 2>&1 | head -1)"
echo "  javac:   $(javac -version 2>&1)"
echo "  g++:     $(g++ --version | head -1)"
echo "  which javac: $(which javac)"
echo "  which java:  $(which java)"
echo "════════════════════════════════════════════════"
echo ""