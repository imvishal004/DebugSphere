#!/bin/bash
# ─────────────────────────────────────────────────────────────
# render-build.sh
# Installs all language runtimes + npm dependencies
# Runs on BOTH api and worker services during build phase
# ─────────────────────────────────────────────────────────────

set -e  # exit immediately on error

echo ""
echo "════════════════════════════════════════════════"
echo "  DebugSphere — Render Build Script"
echo "════════════════════════════════════════════════"
echo ""

# ── System packages ────────────────────────────────────────
echo "📦  Updating apt package list..."
apt-get update -qq 2>/dev/null || true

# ── Python 3 ──────────────────────────────────────────────
echo "🐍  Installing Python 3..."
apt-get install -y -qq python3 2>/dev/null || true
python3 --version && echo "    ✅ Python ready" || echo "    ❌ Python failed"

# ── Java 17 JDK ───────────────────────────────────────────
# This fixes Issue 1 — JDK not installed on Render
echo "☕  Installing OpenJDK 17..."
apt-get install -y -qq openjdk-17-jdk 2>/dev/null || true
java -version 2>&1 | head -1 && echo "    ✅ Java ready" || echo "    ❌ Java failed"
javac -version 2>&1 && echo "    ✅ javac ready" || echo "    ❌ javac failed"

# ── G++ compiler ───────────────────────────────────────────
echo "⚙️   Installing G++ compiler..."
apt-get install -y -qq g++ build-essential 2>/dev/null || true
g++ --version | head -1 && echo "    ✅ G++ ready" || echo "    ❌ G++ failed"

# ── Node.js (pre-installed by Render) ─────────────────────
echo "🟢  Node.js: $(node --version)"
echo "    npm:     $(npm --version)"

# ── Create temp execution directory ───────────────────────
echo "📁  Creating temp directory /tmp/debugsphere..."
mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere
echo "    ✅ Temp directory ready"

# ── Install npm dependencies ───────────────────────────────
echo "📦  Running npm install..."
npm install
echo "    ✅ npm install complete"

echo ""
echo "════════════════════════════════════════════════"
echo "  ✅  Build complete — Runtime verification:"
echo "════════════════════════════════════════════════"
echo "  node:    $(node --version)"
echo "  python3: $(python3 --version 2>&1)"
echo "  java:    $(java -version 2>&1 | head -1)"
echo "  javac:   $(javac -version 2>&1)"
echo "  g++:     $(g++ --version | head -1)"
echo "════════════════════════════════════════════════"
echo ""