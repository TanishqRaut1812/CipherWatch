#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run install.sh as root (sudo ./install.sh)."
  exit 1
fi

echo "============================================================"
echo "🛡️  Installing CipherWatch Standalone Linux Endpoint Agent"
echo "============================================================"

# Check for existing installation
if [ -f "/usr/local/bin/cipherwatch-agent" ] || [ -d "/etc/cipherwatch" ]; then
    echo "Existing installation detected."
    read -p "Upgrade existing installation? [Y/n] " response
    response=${response:-Y}
    if [[ "$response" != "Y" && "$response" != "y" ]]; then
        echo "Installation aborted by user."
        exit 0
    fi
    echo "Proceeding with upgrade..."
fi

# Resolve location of built executable
BIN_SRC="./cipherwatch-agent"
if [ ! -f "$BIN_SRC" ]; then
    BIN_SRC="../build/cipherwatch-agent"
fi
if [ ! -f "$BIN_SRC" ]; then
    BIN_SRC="../../build/cipherwatch-agent"
fi

if [ ! -f "$BIN_SRC" ]; then
    echo "❌ Executable binary cipherwatch-agent not found in build/. Run ./build.sh first."
    exit 1
fi

# 1. Copy standalone binary executable to /usr/local/bin/
echo "📁 Copying binary executable to /usr/local/bin/cipherwatch-agent..."
cp "$BIN_SRC" /usr/local/bin/cipherwatch-agent
chmod 755 /usr/local/bin/cipherwatch-agent

# 2. Create Linux standard configuration and log directories
echo "📁 Creating system directories (/etc/cipherwatch/{logs,cache,keys})..."
mkdir -p /etc/cipherwatch/logs /etc/cipherwatch/cache /etc/cipherwatch/keys
chmod 700 /etc/cipherwatch

# 3. Install and enable systemd service unit
echo "⚙️ Installing systemd service (cipherwatch-agent.service)..."
SERVICE_SRC="./cipherwatch-agent.service"
if [ ! -f "$SERVICE_SRC" ]; then
    SERVICE_SRC="../build/cipherwatch-agent.service"
fi

if [ -f "$SERVICE_SRC" ]; then
    cp "$SERVICE_SRC" /etc/systemd/system/cipherwatch-agent.service
    chmod 644 /etc/systemd/system/cipherwatch-agent.service
    systemctl daemon-reload
    systemctl enable cipherwatch-agent.service
    echo "✓ Systemd service cipherwatch-agent.service installed and enabled."
else
    echo "⚠️ Systemd service unit file not found. Skipping service registration."
fi

echo "============================================================"
echo "CipherWatch Agent installed successfully."
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "1."
echo "cipherwatch-agent setup"
echo ""
echo "2."
echo "Development:"
echo "cipherwatch-agent dev"
echo ""
echo "OR"
echo ""
echo "Production:"
echo "sudo systemctl start cipherwatch-agent"
echo ""
echo "Useful commands:"
echo "cipherwatch-agent status"
echo "cipherwatch-agent logs"
echo "cipherwatch-agent stop"
echo "============================================================"
