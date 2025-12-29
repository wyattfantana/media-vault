#!/bin/bash
# MediaVault Startup Script - Runs everything in tmux sessions

echo "🚀 Starting MediaVault..."
echo ""

# 1. Start PostgreSQL if not running
echo "📊 Checking PostgreSQL..."
if ! pg_isready -q 2>/dev/null; then
    echo "   Starting PostgreSQL..."
    sudo service postgresql start > /dev/null 2>&1
    sleep 2
    if pg_isready -q 2>/dev/null; then
        echo "   ✅ PostgreSQL started"
    else
        echo "   ⚠️  PostgreSQL failed to start"
        exit 1
    fi
else
    echo "   ✅ PostgreSQL already running"
fi
echo ""

# 2. Start Docker service if not running
echo "🐳 Checking Docker..."
if docker ps > /dev/null 2>&1; then
    echo "   ✅ Docker already running"
else
    echo "   Starting Docker..."
    sudo service docker start > /dev/null 2>&1
    sleep 3
    if docker ps > /dev/null 2>&1; then
        echo "   ✅ Docker started"
    else
        echo "   ⚠️  Docker failed to start"
        echo "   Try: sudo service docker start"
        exit 1
    fi
fi
echo ""

# 3. Start Docker services with Docker Compose
echo "🔍 Starting Docker services (Prowlarr, Bazarr, Sonarr, Radarr, Jellyfin, FlareSolverr)..."
cd /home/beerm/projects/media-vault

# Count running containers that match our services
RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -cE '^(sonarr|radarr|prowlarr|bazarr|jellyfin|flaresolverr)$')

if [ "$RUNNING" -ge 6 ]; then
    echo "   ✅ All 6 Docker services already running"
else
    docker compose up -d 2>&1 | grep -v "^time=" | grep -v "obsolete" | head -15
    sleep 3
    RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -cE '^(sonarr|radarr|prowlarr|bazarr|jellyfin|flaresolverr)$')
    if [ "$RUNNING" -ge 6 ]; then
        echo "   ✅ All 6 Docker services started"
    elif [ "$RUNNING" -gt 0 ]; then
        echo "   ✅ $RUNNING/6 Docker services running"
    else
        echo "   ⚠️  Failed to start Docker services"
    fi
fi
echo ""

# 4. Start qBittorrent in tmux if not running
echo "📥 Checking qBittorrent..."
if pgrep -x qbittorrent-nox > /dev/null 2>&1; then
    echo "   ✅ qBittorrent already running"
else
    echo "   Starting qBittorrent..."
    tmux kill-session -t qbittorrent 2>/dev/null || true
    tmux new-session -d -s qbittorrent "qbittorrent-nox --webui-port=8080"
    sleep 2
    if pgrep -x qbittorrent-nox > /dev/null 2>&1; then
        echo "   ✅ qBittorrent started"
    else
        echo "   ⚠️  qBittorrent failed to start"
    fi
fi
echo ""

# 5. Kill any existing MediaVault tmux sessions
tmux kill-session -t mediavault 2>/dev/null || true

# 6. Start MediaVault services (API + Web + Worker)
echo "🎯 Starting MediaVault services (API + Web + Worker)..."
tmux new-session -d -s mediavault "cd /home/beerm/projects/media-vault && export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && npx turbo dev --filter=api --filter=web --filter=worker"
sleep 2
echo "   ✅ MediaVault started"
echo ""

# 7. Show status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL SERVICES STARTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 URLs:"
echo "   • Web UI:       http://localhost:5173"
echo "   • API:          http://localhost:3001"
echo "   • qBittorrent:  http://localhost:8080"
echo "   • Prowlarr:     http://localhost:9696"
echo "   • Bazarr:       http://localhost:6767"
echo "   • Sonarr:       http://localhost:8989"
echo "   • Radarr:       http://localhost:7878"
echo "   • Jellyfin:     http://localhost:8096"
echo ""
echo "📺 View logs:"
echo "   tmux attach -t mediavault    # API + Web + Worker logs"
echo "   tmux attach -t qbittorrent   # qBittorrent logs"
echo ""
echo "🔌 Detach from tmux: Ctrl+B, then D"
echo ""
echo "🛑 Stop everything:"
echo "   scripts/stop-mediavault.sh"
echo ""
