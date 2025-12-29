#!/bin/bash
# Stop MediaVault services

echo "🛑 Stopping MediaVault..."
echo ""

# Stop tmux sessions
echo "Stopping MediaVault services..."
tmux kill-session -t mediavault 2>/dev/null && echo "   ✅ MediaVault (API + Web + Worker) stopped" || echo "   ⚠️  MediaVault was not running"

echo "Stopping qBittorrent..."
tmux kill-session -t qbittorrent 2>/dev/null && echo "   ✅ qBittorrent stopped" || echo "   ⚠️  qBittorrent was not running"

# Stop Docker services (Jellyfin, Prowlarr, Bazarr, Sonarr, Radarr, FlareSolverr)
echo "Stopping Docker services..."
cd /home/beerm/projects/media-vault
if docker ps > /dev/null 2>&1; then
    docker compose stop > /dev/null 2>&1 \
        && echo "   ✅ Docker services stopped" || echo "   ⚠️  Failed to stop Docker services"
else
    echo "   ⚠️  Docker not running"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services stopped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: PostgreSQL and Docker daemon still running (for faster restarts)."
echo "To stop them manually:"
echo "   sudo service postgresql stop"
echo "   sudo service docker stop"
echo ""
