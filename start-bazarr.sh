#!/bin/bash
echo "🎬 Starting Bazarr container..."

# Try using docker command directly
if docker compose up -d bazarr 2>/dev/null; then
    echo "✅ Bazarr started successfully!"
    echo "   Access at: http://localhost:6767"
elif docker-compose up -d bazarr 2>/dev/null; then
    echo "✅ Bazarr started successfully!"
    echo "   Access at: http://localhost:6767"
else
    echo "❌ Failed to start Bazarr via Docker"
    echo ""
    echo "Please start Bazarr manually via Docker Desktop:"
    echo "1. Open Docker Desktop"
    echo "2. Go to Containers"
    echo "3. Find 'media-vault' stack"
    echo "4. Start the 'bazarr' container"
    echo ""
    echo "Or run from PowerShell in project directory:"
    echo "   docker compose up -d bazarr"
fi
