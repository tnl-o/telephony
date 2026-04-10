#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DIR/ssl"
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$DIR/ssl/key.pem" \
  -out "$DIR/ssl/cert.pem" \
  -subj "/CN=telephony-dev" \
  -addext "subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1"
echo "Wrote $DIR/ssl/cert.pem"
