#!/bin/bash

set -e

echo ""
echo "================================================"
echo "🚀 DebugSphere Portable Build Starting"
echo "================================================"
echo ""

# ------------------------------------------------------------
# Download Stable Java JDK (Fixed URL — NOT latest)
# ------------------------------------------------------------

echo "☕ Downloading OpenJDK 17..."

mkdir -p .java

curl -L \
https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11+9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz \
-o openjdk.tar.gz

echo "📦 Extracting Java..."

tar -xzf openjdk.tar.gz -C .java

echo "🔎 Setting JAVA_HOME..."

JAVA_FOLDER=$(ls .java)

export JAVA_HOME=$PWD/.java/$JAVA_FOLDER
export PATH=$JAVA_HOME/bin:$PATH

echo ""
echo "🔎 Checking Java..."

java -version

echo ""
echo "🔎 Checking javac..."

javac -version

echo "✅ Java Ready"

# ------------------------------------------------------------
# Check Python (already available on Render)
# ------------------------------------------------------------

echo ""
echo "🐍 Checking Python..."

python3 --version || true

# ------------------------------------------------------------
# Install npm dependencies
# ------------------------------------------------------------

echo ""
echo "📦 Installing npm dependencies..."

npm install

echo "✅ npm install complete"

# ------------------------------------------------------------
# Create execution temp directory
# ------------------------------------------------------------

echo ""
echo "📁 Creating temp directory..."

mkdir -p /tmp/debugsphere
chmod 777 /tmp/debugsphere

echo "✅ Temp directory ready"

# ------------------------------------------------------------
# Final summary
# ------------------------------------------------------------

echo ""
echo "================================================"
echo "✅ Build Summary"
echo "================================================"

echo "Node:  $(node --version)"
echo "Java:  $(java -version 2>&1 | head -1)"
echo "Javac: $(javac -version 2>&1)"
echo "Python: $(python3 --version 2>&1)"

echo "================================================"
echo ""
echo "🎉 DebugSphere Build Completed Successfully"
echo ""