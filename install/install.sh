#!/bin/bash

# Secret Vault Quick Installation Script
# https://github.com/datamaker/secret-vault

set -e

echo "========================================"
echo "  Secret Vault Installation"
echo "========================================"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed."
    echo "Please install Docker Compose first."
    exit 1
fi

# Create directory
INSTALL_DIR="${1:-secret-vault}"
echo ">>> Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Create data directory for PostgreSQL persistence
mkdir -p data/postgres

# Download files
echo ">>> Downloading configuration files..."
BASE_URL="https://raw.githubusercontent.com/datamaker/secret-vault/main/install"

curl -sSL "$BASE_URL/docker-compose.yml" -o docker-compose.yml
curl -sSL "$BASE_URL/init.sql" -o init.sql
curl -sSL "$BASE_URL/.env.example" -o .env.example

# Create .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env

    # Generate keys
    echo ">>> Generating encryption keys..."
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    MASTER_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH=$(openssl rand -hex 32)

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        sed -i '' "s/MASTER_ENCRYPTION_KEY=.*/MASTER_ENCRYPTION_KEY=$MASTER_KEY/" .env
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i '' "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH/" .env
    else
        # Linux
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        sed -i "s/MASTER_ENCRYPTION_KEY=.*/MASTER_ENCRYPTION_KEY=$MASTER_KEY/" .env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH/" .env
    fi

    echo ">>> Keys generated and saved to .env"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "To start Secret Vault:"
echo "  cd $INSTALL_DIR"
echo "  docker-compose up -d"
echo ""
echo "Then access: http://localhost"
echo ""
echo "IMPORTANT: Back up your .env file!"
echo "The MASTER_ENCRYPTION_KEY is required to decrypt your secrets."
echo ""
