#!/bin/bash

# SSL Certificate Generator for Local Telephony System
# Generates self-signed certificates for Nginx and FreeSWITCH WSS

set -e

SSL_DIR="./config/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"
CA_FILE="$SSL_DIR/ca.pem"
DAYS=3650

echo "🔐 Generating SSL certificates for local telephony system..."

# Create SSL directory if not exists
mkdir -p "$SSL_DIR"

# Remove old certificates if exist
rm -f "$CERT_FILE" "$KEY_FILE" "$CA_FILE"

# Generate Private Key
echo "Generating private key..."
openssl genrsa -out "$KEY_FILE" 2048

# Generate Self-Signed Certificate
echo "Generating self-signed certificate..."
openssl req -new -x509 \
    -key "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days $DAYS \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=Company/OU=IT/CN=telephony.local" \
    -addext "subjectAltName=DNS:telephony.local,DNS:localhost,IP:100.64.0.5,IP:100.64.0.10"

# Copy cert to CA file (for simplicity in local setup)
cp "$CERT_FILE" "$CA_FILE"

# Set permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE" "$CA_FILE"

echo ""
echo "✅ Certificates generated successfully!"
echo "   Certificate: $CERT_FILE"
echo "   Private Key: $KEY_FILE"
echo "   CA Bundle:   $CA_FILE"
echo ""
echo "⚠️  IMPORTANT: Browsers will show a security warning for self-signed certificates."
echo "   You need to manually trust the certificate in your browser or add it to OS trust store."
echo ""
echo "To install on Linux (Firefox/Chrome):"
echo "  sudo cp $CA_FILE /usr/local/share/ca-certificates/telephony.crt"
echo "  sudo update-ca-certificates"
echo ""
echo "To install on Windows:"
echo "  Double-click $CA_FILE -> Install Certificate -> Local Machine -> Trusted Root Certification Authorities"
echo ""
