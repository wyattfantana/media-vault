#!/bin/bash
# MediaVault Startup Script - Runs everything in tmux sessions

# Kill any existing tmux sessions
tmux kill-session -t mediavault 2>/dev/null
tmux kill-session -t qbittorrent 2>/dev/null

# Start qBittorrent in its own tmux session (auto-accept legal notice)
echo "Starting qBittorrent..."
tmux new-session -d -s qbittorrent "echo y | qbittorrent-nox --webui-port=8080 --confirm-legal-notice"

# Start MediaVault services in tmux (skip desktop app)
echo "Starting MediaVault services..."
tmux new-session -d -s mediavault "cd /home/beerm/projects/media-vault && export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && npx turbo dev --filter=starter-api --filter=starter-web --filter=worker"

echo ""
echo "✅ MediaVault services started!"
echo ""
echo "To view running services:"
echo "  tmux attach -t mediavault    # View MediaVault logs"
echo "  tmux attach -t qbittorrent   # View qBittorrent logs"
echo ""
echo "To detach from tmux: Press Ctrl+B, then D"
echo ""
echo "Services will continue running even if you close your terminal!"
echo ""
echo "To stop everything:"
echo "  tmux kill-session -t mediavault"
echo "  tmux kill-session -t qbittorrent"
