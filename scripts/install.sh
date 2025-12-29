#!/bin/bash

# MediaVault Installation Script
# This script sets up PostgreSQL, creates .env files, and runs migrations

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   MediaVault Installation Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# =========================================
# CHECK PREREQUISITES
# =========================================
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20+ first."
    echo "  Install: https://nodejs.org/ or 'nvm install 20'"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js 20+ required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi
print_success "npm $(npm -v)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL is not installed."
    echo "  Install: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi
print_success "PostgreSQL installed"

# Check if qBittorrent is installed (optional)
if command -v qbittorrent-nox &> /dev/null; then
    print_success "qBittorrent-nox installed"
else
    print_warning "qBittorrent-nox not found (optional - install for torrent downloads)"
fi

# Check if yt-dlp is installed (optional)
if command -v yt-dlp &> /dev/null; then
    print_success "yt-dlp installed"
else
    print_warning "yt-dlp not found (optional - install for YouTube/etc downloads)"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    print_success "Docker installed"
else
    print_warning "Docker not found (optional - needed for Prowlarr, Bazarr, Jellyfin)"
fi

# =========================================
# COLLECT USER INPUT
# =========================================
print_step "Configuration..."

# TMDB API Key
echo ""
echo "You need a TMDB API key for movie/TV metadata."
echo "Get one free at: https://www.themoviedb.org/settings/api"
echo ""
read -p "Enter your TMDB API Key: " TMDB_API_KEY

if [ -z "$TMDB_API_KEY" ]; then
    print_warning "No TMDB API key provided. You can add it later to apps/api/.env"
    TMDB_API_KEY="your_tmdb_api_key_here"
fi

# Download directory
echo ""
echo "Where should downloaded media be saved?"
echo "Default: /mnt/d/MediaVault (Windows) or ~/MediaVault (Linux)"
echo ""
read -p "Download directory [~/MediaVault]: " DOWNLOAD_DIR
DOWNLOAD_DIR=${DOWNLOAD_DIR:-"$HOME/MediaVault"}

# Expand ~ to full path
DOWNLOAD_DIR="${DOWNLOAD_DIR/#\~/$HOME}"

# Create download directory structure
print_step "Creating download directories..."
mkdir -p "$DOWNLOAD_DIR/Movies"
mkdir -p "$DOWNLOAD_DIR/TV Shows"
mkdir -p "$DOWNLOAD_DIR/Documentaries"
mkdir -p "$DOWNLOAD_DIR/Music"
mkdir -p "$DOWNLOAD_DIR/iplayer"
print_success "Created $DOWNLOAD_DIR/{Movies,TV Shows,Documentaries,Music,iplayer}"

# =========================================
# INSTALL NPM DEPENDENCIES
# =========================================
print_step "Installing npm dependencies..."
npm install
print_success "Dependencies installed"

# =========================================
# SETUP POSTGRESQL
# =========================================
print_step "Setting up PostgreSQL..."

# Start PostgreSQL
sudo service postgresql start 2>/dev/null || true
sleep 2

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw mediavault; then
    print_warning "Database 'mediavault' already exists, skipping creation"
else
    # Create user and database
    sudo -u postgres psql -c "CREATE USER mediavault WITH PASSWORD 'mediavault123';" 2>/dev/null || print_warning "User 'mediavault' may already exist"
    sudo -u postgres psql -c "CREATE DATABASE mediavault OWNER mediavault;" 2>/dev/null || print_warning "Database 'mediavault' may already exist"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mediavault TO mediavault;" 2>/dev/null || true
    print_success "PostgreSQL database created"
fi

# =========================================
# CREATE .ENV FILES
# =========================================
print_step "Creating environment files..."

# Generate random secret for auth
AUTH_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

# Create apps/api/.env
cat > apps/api/.env << EOF
# Database
POSTGRES_HOST=/var/run/postgresql
POSTGRES_DB=mediavault
POSTGRES_USER=mediavault
POSTGRES_PASSWORD=mediavault123
POSTGRES_PORT=5432

# TMDB API (for movie/TV metadata)
TMDB_API_KEY=$TMDB_API_KEY

# Download directory
DOWNLOAD_DIR=$DOWNLOAD_DIR

# Server
PORT=3001
NODE_ENV=development

# Authentication
BETTER_AUTH_SECRET=$AUTH_SECRET
BETTER_AUTH_URL=http://localhost:3001

# qBittorrent
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

# Optional: Sentry error tracking
# SENTRY_DSN=

# Optional: OAuth providers
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# FACEBOOK_CLIENT_ID=
# FACEBOOK_CLIENT_SECRET=
EOF

print_success "Created apps/api/.env"

# Create apps/web/.env
cat > apps/web/.env << EOF
VITE_API_URL=http://localhost:3001
EOF

print_success "Created apps/web/.env"

# =========================================
# RUN MIGRATIONS
# =========================================
print_step "Running database migrations..."

cd apps/api

# Run SQL migrations
for f in src/migrations/*.sql; do
    if [ -f "$f" ]; then
        echo "  Running $(basename $f)..."
        PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault -f "$f" 2>/dev/null || true
    fi
done

# Run TypeORM migrations
npm run migration:run 2>/dev/null || print_warning "TypeORM migrations may have already been applied"

cd "$PROJECT_ROOT"
print_success "Migrations complete"

# =========================================
# CREATE SYMLINKS FOR START/STOP SCRIPTS
# =========================================
print_step "Creating convenience symlinks..."

ln -sf "$PROJECT_ROOT/scripts/start-mediavault.sh" "$HOME/start-mediavault.sh" 2>/dev/null || true
ln -sf "$PROJECT_ROOT/scripts/stop-mediavault.sh" "$HOME/stop-mediavault.sh" 2>/dev/null || true
chmod +x "$PROJECT_ROOT/scripts/start-mediavault.sh" "$PROJECT_ROOT/scripts/stop-mediavault.sh"

print_success "Created ~/start-mediavault.sh and ~/stop-mediavault.sh"

# =========================================
# DONE
# =========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}   Installation Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start MediaVault:"
echo "     ~/start-mediavault.sh"
echo ""
echo "  2. Open in browser:"
echo "     http://localhost:5173"
echo ""
echo "  3. Create an account and start using MediaVault!"
echo ""
echo "Optional services (for full functionality):"
echo ""
echo "  • qBittorrent: For torrent downloads"
echo "    sudo apt install qbittorrent-nox"
echo ""
echo "  • Docker services: For Prowlarr, Jellyfin, etc."
echo "    docker compose up -d"
echo ""
echo "  • yt-dlp: For YouTube/SoundCloud downloads"
echo "    pip install yt-dlp"
echo ""
echo "Configuration files:"
echo "  • API:  apps/api/.env"
echo "  • Web:  apps/web/.env"
echo ""
