#!/bin/bash

# ─────────────────────────────────────────────
# DebugSphere Render Build Script
# Installs required runtimes:
# Java (JDK)
# Python
# C++
# Node dependencies
# ─────────────────────────────────────────────

set -e

echo ""
echo "════════════════════════════════════════"
echo "🚀 DebugSphere Build Script Starting"
echo "════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────
# Update system packages
# ─────────────────────────────────────────────

echo "📦 Updating package list..."
apt-get update

# ─────────────────────────────────────────────
# Install Java JDK
# (Using default-jdk — most reliable on Render)
# ─────────────────────────────────────────────

echo ""
echo "☕ Installing Java JDK..."

apt-get install -y default-jdk

echo ""
echo "🔎 Verifying Java installation..."

java -version

echo ""
echo "🔎 Verifying javac compiler..."

javac -version

echo "✅ Java installation complete"

# ─────────────────────────────────────────────
# Install Python
# ─────────────────────────────────────────────

echo ""
echo "🐍 Installing Python..."

apt-get install -y python3

python3 --version

echo "✅ Python ready"

# ─────────────────────────────────────────────
# Install C++ compiler
# ─────────────────────────────────────────────

echo ""
echo "⚙️ Installing C++ compiler..."

apt-get install -y g++ build-essential

g++ --version | head -1

echo "✅ G++ ready"

# ─────────────────────────────────────────────
# Show Node version
# ─────────────────────────────────────────────

echo ""
echo "🟢 Node.js version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# ─────────────────────────────────────────────
# Create temp execution folder
# ─────────────────────────────────────────────

echo ""
echo "📁 Creating execution temp directory..."

mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere

echo "✅ Temp directory ready"

# ─────────────────────────────────────────────
# Install npm dependencies
# ─────────────────────────────────────────────

echo ""
echo "📦 Installing npm dependencies..."

npm install

echo "✅ npm install complete"

# ─────────────────────────────────────────────
# Final runtime verification
# ─────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "✅ Build Finished — Runtime Summary"
echo "════════════════════════════════════════"

echo "Node:    $(node --version)"
echo "Python:  $(python3 --version 2>&1)"
echo "Java:    $(java -version 2>&1 | head -1)"
echo "Javac:   $(javac -version 2>&1)"
echo "G++:     $(g++ --version | head -1)"

echo "════════════════════════════════════════"
echo ""
echo "🎉 DebugSphere Build Successful"
echo ""