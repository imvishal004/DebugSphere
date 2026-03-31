#!/bin/bash

# ============================================================
# DebugSphere Render Build Script
# Supports:
# Java (portable install)
# Python (already available)
# JavaScript (Node runtime)
# C++ (optional — handled at runtime)
# ============================================================

set -e

echo ""
echo "================================================"
echo "🚀 DebugSphere Portable Build Starting"
echo "================================================"
echo ""

# ------------------------------------------------------------
# JAVA INSTALL (Portable)
# ------------------------------------------------------------

echo "☕ Installing Portable Java JDK..."

mkdir -p .java

curl -L \
https://github.com/adoptium/temurin17-binaries/releases/latest/download/OpenJDK17U-jdk_x64_linux_hotspot.tar.gz \
-o openjdk.tar.gz

echo "📦 Extracting Java..."

tar -xzf openjdk.tar.gz -C .java

JAVA_FOLDER=$(ls .java)

export JAVA_HOME=$PWD/.java/$JAVA_FOLDER
export PATH=$JAVA_HOME/bin:$PATH

echo "🔎 Checking Java..."

java -version

echo "🔎 Checking javac..."

javac -version

echo "✅ Java Ready"

# ------------------------------------------------------------
# PYTHON CHECK (Already installed on Render)
# ------------------------------------------------------------

echo ""
echo "🐍 Checking Python..."

python3 --version || echo "⚠️ Python not detected"

# ------------------------------------------------------------
# NODE DEPENDENCIES
# ------------------------------------------------------------

echo ""
echo "📦 Installing npm dependencies..."

npm install

echo "✅ npm install complete"

# ------------------------------------------------------------
# TEMP EXECUTION DIRECTORY
# ------------------------------------------------------------

echo ""
echo "📁 Creating temp directory..."

mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere

echo "✅ Temp directory ready"

# ------------------------------------------------------------
# FINAL SUMMARY
# ------------------------------------------------------------

echo ""
echo "================================================"
echo "✅ Build Summary"
echo "================================================"

echo "Node:  $(node --version)"
echo "Python: $(python3 --version 2>&1)"
echo "Java:  $(java -version 2>&1 | head -1)"
echo "Javac: $(javac -version 2>&1)"

echo "================================================"
echo ""
echo "🎉 DebugSphere Build Completed Successfully"
echo ""