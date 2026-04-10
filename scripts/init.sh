#!/bin/bash

# Init script for Telephony Project
# Generates SSL certificates, creates config files, and prepares data directories

set -e

echo "🚀 Initializing Telephony Project..."

# Create necessary directories
mkdir -p data logs certs freeswitch/conf freeswitch/db

# Generate SSL certificates if not exist
if [ ! -f certs/server.crt ] || [ ! -f certs/server.key ]; then
    echo "🔐 Generating self-signed SSL certificates..."
    ./scripts/generate-ssl.sh
else
    echo "✅ SSL certificates already exist."
fi

# Create .env from template if not exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your LDAP and FreePBX settings before starting!"
else
    echo "✅ .env file already exists."
fi

# Initialize empty users.json if not exist
if [ ! -f data/users.json ]; then
    echo "📄 Creating empty users.json database..."
    echo '{"users": []}' > data/users.json
else
    echo "✅ users.json already exists."
fi

# Set proper permissions
echo "🔧 Setting permissions..."
chmod 600 certs/server.key
chmod 755 data
chmod 755 logs
chmod 644 data/users.json

echo ""
echo "✅ Initialization complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your LDAP and FreePBX settings"
echo "2. Run: docker-compose up -d"
echo "3. Access web interface at https://<your-server-ip>"
echo ""
