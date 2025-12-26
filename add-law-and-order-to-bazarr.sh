#!/bin/bash
# Script to manually add Law & Order SVU to Bazarr for subtitle management

BAZARR_URL="http://localhost:6767"
BAZARR_API_KEY="a5421902220f09abd682e7d30ed1cc20"
SHOW_PATH="/tv/Law and Order - SVU (1999 - ongoing) S01-S26 1080p WebDL H265 EAC3 2.0"

echo "🎬 Adding Law & Order SVU to Bazarr..."
echo ""

# Note: Bazarr requires Sonarr/Radarr integration for automatic series management
# For manual management, you'll need to use the web UI:

echo "📝 Manual Steps Required:"
echo ""
echo "1. Open Bazarr: http://localhost:6767"
echo "2. Click 'Series' in the top menu"
echo "3. Click 'Add Series' button"
echo "4. Browse to: $SHOW_PATH"
echo "5. Select the show"
echo "6. Set subtitle languages: English"
echo "7. Click 'Add'"
echo ""
echo "OR (Recommended):"
echo ""
echo "Set up Sonarr integration for automatic series management:"
echo "1. Settings → Sonarr"
echo "2. Enable Sonarr"
echo "3. URL: http://localhost:8989"
echo "4. API Key: (from Sonarr if you set it up)"
echo ""
echo "Once added, Bazarr will automatically:"
echo "  - Scan all episodes in all seasons"
echo "  - Download missing subtitles"
echo "  - Keep subtitles up to date"
echo ""
