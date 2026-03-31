#!/bin/bash
# ─────────────────────────────────────────────────────────────
# render-build.sh
#
# Runs during Render build phase.
# Installs all language runtimes needed by isolatedExecutor.js
# then installs npm dependencies.
#
# Render instances run Ubuntu 22.04 LTS.
# Node.js is pre-installed by Render (selected in dashboard).
# ─────────────────────────────────────────────────────────────

set -e  # exit immediately on any error

echo ""
echo "════════════════════════════════════════════"
echo "  DebugSphere — Build Script"
echo "════════════════════════════════════════════"
echo ""

# ── Update package list ────────────────────────────────────
echo "📦  Updating package list..."
apt-get update -qq

# ── Python 3 ──────────────────────────────────────────────
echo "🐍  Installing Python 3..."
apt-get install -y -qq python3 python3-pip
echo "    Python: $(python3 --version)"

# ── Java 17 ───────────────────────────────────────────────
echo "☕  Installing Java 17 JDK..."
apt-get install -y -qq openjdk-17-jdk
echo "    Java: $(java -version 2>&1 | head -1)"

# ── G++ (C++ compiler) ─────────────────────────────────────
echo "⚙️   Installing G++ compiler..."
apt-get install -y -qq g++ build-essential
echo "    G++: $(g++ --version | head -1)"

# ── Node.js is pre-installed by Render ────────────────────
echo "🟢  Node.js: $(node --version)"
echo "    npm:     $(npm --version)"

# ── Create temp directory ──────────────────────────────────
echo "📁  Creating temp directory..."
mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere

# ── Install npm dependencies ───────────────────────────────
echo "📦  Installing npm packages..."
npm install

echo ""
echo "════════════════════════════════════════════"
echo "  ✅  Build complete"
echo "════════════════════════════════════════════"
echo ""

# ── Verify all runtimes are available ─────────────────────
echo "Runtime verification:"
echo "  python3: $(which python3)"
echo "  java:    $(which java)"
echo "  javac:   $(which javac)"
echo "  g++:     $(which g++)"
echo "  node:    $(which node)"