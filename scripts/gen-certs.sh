#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# gen-certs.sh — Generate a self-signed CA + server certificate for LAN use
#
# Usage:
#   ./scripts/gen-certs.sh [LAN_IP_OR_HOSTNAME]
#
# Default hostname: localhost
# Output: ./certs/  (ca.crt, server.crt, server.key)
#
# After running, import ./certs/ca.crt into your browser / OS trust store.
# Windows: double-click ca.crt → Install → "Trusted Root Certification Authorities"
# Linux:   sudo cp certs/ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates
# macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/ca.crt
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/../certs"
DOMAIN="${1:-localhost}"
DAYS=3650

mkdir -p "${CERTS_DIR}"

echo "[gen-certs] Generating for domain/IP: ${DOMAIN}"

# ── 1. CA key + certificate ──────────────────────────────────────────────────
if [ ! -f "${CERTS_DIR}/ca.key" ]; then
  openssl genrsa -out "${CERTS_DIR}/ca.key" 4096 2>/dev/null
  echo "[gen-certs] CA key generated."
fi

openssl req -x509 -new -nodes \
  -key "${CERTS_DIR}/ca.key" \
  -sha256 -days "${DAYS}" \
  -subj "/C=US/O=WebRTC-FreePBX CA/CN=WebRTC-FreePBX-CA" \
  -out "${CERTS_DIR}/ca.crt"
echo "[gen-certs] CA certificate generated."

# ── 2. Server key ────────────────────────────────────────────────────────────
openssl genrsa -out "${CERTS_DIR}/server.key" 2048 2>/dev/null
echo "[gen-certs] Server key generated."

# ── 3. CSR ───────────────────────────────────────────────────────────────────
openssl req -new \
  -key "${CERTS_DIR}/server.key" \
  -subj "/C=US/O=WebRTC-FreePBX/CN=${DOMAIN}" \
  -out "${CERTS_DIR}/server.csr"

# ── 4. SAN extension file ────────────────────────────────────────────────────
# Determine whether DOMAIN is an IP address or a hostname
SAN_ENTRIES="DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"
if [[ "${DOMAIN}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN_ENTRIES="IP:${DOMAIN},DNS:localhost,IP:127.0.0.1"
fi

cat > "${CERTS_DIR}/san.cnf" << EOF
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[v3_req]
subjectAltName = ${SAN_ENTRIES}
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

# ── 5. Sign server cert with CA ──────────────────────────────────────────────
openssl x509 -req \
  -in "${CERTS_DIR}/server.csr" \
  -CA "${CERTS_DIR}/ca.crt" \
  -CAkey "${CERTS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERTS_DIR}/server.crt" \
  -days "${DAYS}" \
  -sha256 \
  -extfile "${CERTS_DIR}/san.cnf" \
  -extensions v3_req 2>/dev/null

# ── 6. Clean up temp files ───────────────────────────────────────────────────
rm -f "${CERTS_DIR}/server.csr" "${CERTS_DIR}/san.cnf" "${CERTS_DIR}/ca.srl"

chmod 600 "${CERTS_DIR}/server.key" "${CERTS_DIR}/ca.key"
chmod 644 "${CERTS_DIR}/server.crt" "${CERTS_DIR}/ca.crt"

echo ""
echo "✓ Certificates generated in: ${CERTS_DIR}/"
echo ""
echo "Files:"
echo "  ca.crt     — Import this into your browser/OS trust store"
echo "  server.crt — TLS certificate (used by Nginx)"
echo "  server.key — TLS private key (used by Nginx)"
echo ""
echo "Next steps:"
echo "  1. Import ca.crt into your browser/OS (see header comment)"
echo "  2. Настройте reverse proxy (Nginx/Caddy) с server.crt + server.key для HTTPS UI"
echo "  3. На АТС включите WSS и доверенный для браузеров сертификат"
