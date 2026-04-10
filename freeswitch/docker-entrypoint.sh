#!/bin/bash
# FreeSWITCH Docker Entrypoint Script
# Generates TLS certificates and starts FreeSWITCH

set -e

TLS_DIR="/etc/freeswitch/tls"
CERT_FILE="$TLS_DIR/wss_cert.pem"
KEY_FILE="$TLS_DIR/wss_key.pem"

echo "=== FreeSWITCH Startup Script ==="

# Create TLS directory if not exists
if [ ! -d "$TLS_DIR" ]; then
    echo "Creating TLS directory: $TLS_DIR"
    mkdir -p "$TLS_DIR"
fi

# Generate self-signed certificate if not exists
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Generating self-signed TLS certificate for WSS..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=Telephony/CN=freeswitch.telephony.local" \
        -addext "subjectAltName=DNS:freeswitch,DNS:*.telephony.local,IP:100.64.0.10"
    
    echo "Certificate generated successfully!"
    echo "  Cert: $CERT_FILE"
    echo "  Key:  $KEY_FILE"
else
    echo "TLS certificates already exist, skipping generation."
fi

# Set permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

# Start FreeSWITCH in foreground
echo "Starting FreeSWITCH..."
exec freeswitch -u root -g root -nf -nonat
