#!/usr/bin/env bash
set -e

VERSION="1.0.0"
DEB_DIR="build_deb/cipherwatch-agent_${VERSION}_amd64"

echo "============================================================"
echo "📦 Packaging CipherWatch Agent into .deb Package"
echo "============================================================"

rm -rf build_deb/

# Create directory structure
mkdir -p "${DEB_DIR}/DEBIAN"
mkdir -p "${DEB_DIR}/usr/local/bin"
mkdir -p "${DEB_DIR}/etc/cipherwatch/logs"
mkdir -p "${DEB_DIR}/etc/systemd/system"

# Copy binary
cp "../../dist/cipherwatch-agent" "${DEB_DIR}/usr/local/bin/cipherwatch-agent"
chmod 755 "${DEB_DIR}/usr/local/bin/cipherwatch-agent"

# Copy systemd service
cp "cipherwatch-agent.service" "${DEB_DIR}/etc/systemd/system/cipherwatch-agent.service"
chmod 644 "${DEB_DIR}/etc/systemd/system/cipherwatch-agent.service"

# Create control file
cat <<EOF > "${DEB_DIR}/DEBIAN/control"
Package: cipherwatch-agent
Version: ${VERSION}
Architecture: amd64
Maintainer: CipherWatch Security Team <security@cipherwatch.io>
Description: CipherWatch Enterprise Standalone Endpoint Security Agent
  Metadata-only insider threat monitoring agent running as a standalone binary
  with no external Python dependency.
EOF

# Build package
dpkg-deb --build "${DEB_DIR}" "../../dist/cipherwatch-agent_${VERSION}_amd64.deb"

echo "============================================================"
echo "✅ Package Created: dist/cipherwatch-agent_${VERSION}_amd64.deb"
echo "============================================================"
