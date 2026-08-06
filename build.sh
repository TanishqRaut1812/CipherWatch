#!/usr/bin/env bash
set -e

echo "============================================================"
echo "🛠️  Building CipherWatch Standalone Linux Endpoint Agent"
echo "============================================================"

# Ensure PyInstaller is installed
if ! command -v pyinstaller &> /dev/null; then
    echo "📦 Installing PyInstaller build dependencies..."
    pip install pyinstaller httpx psutil watchdog pydantic
fi

# Clean previous build artifacts
echo "🧹 Cleaning build/ and dist/..."
rm -rf build/ dist/
mkdir -p build/

# Run PyInstaller using spec file
echo "⚙️ Running PyInstaller executable build..."
pyinstaller --clean cipherwatch-agent.spec

# Organize deployment package inside build/ directory
if [ -f "dist/cipherwatch-agent" ]; then
    cp dist/cipherwatch-agent build/cipherwatch-agent
    chmod +x build/cipherwatch-agent

    cp installer/linux/install.sh build/install.sh
    chmod +x build/install.sh

    cp installer/linux/cipherwatch-agent.service build/cipherwatch-agent.service

    rm -rf dist/

    echo "============================================================"
    echo "✅ Build Successful!"
    echo "   All deployment assets populated in build/:"
    echo "   • Executable Binary: build/cipherwatch-agent ($(du -h build/cipherwatch-agent | cut -f1))"
    echo "   • Installer Script:  build/install.sh"
    echo "   • Systemd Service:   build/cipherwatch-agent.service"
    echo "============================================================"
else
    echo "❌ Build failed! Executable dist/cipherwatch-agent was not generated."
    exit 1
fi
