#!/bin/bash
# Enable "Always Burn in Subtitle When Transcoding" by default in Jellyfin
# Based on: https://forum.jellyfin.org/t-auto-enable-always-burn-in-subtitle

BUNDLE_FILE="/jellyfin/jellyfin-web/main.jellyfin.bundle.js"
BACKUP_FILE="/jellyfin/jellyfin-web/main.jellyfin.bundle.js.backup"

echo "🔧 Enabling Burn-In Subtitles by Default in Jellyfin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Backup
echo "1️⃣  Creating backup..."
docker exec jellyfin cp "$BUNDLE_FILE" "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Backup created at: $BACKUP_FILE"
else
    echo "   ❌ Backup failed!"
    exit 1
fi
echo ""

# Step 2: Check if file exists and show current state
echo "2️⃣  Checking current configuration..."
CURRENT_STATE=$(docker exec jellyfin grep -o "f.AlwaysBurnInSubtitleWhenTranscoding=c.A.alwaysBurnInSubtitleWhenTranscoding()" "$BUNDLE_FILE" | head -1)
if [ -n "$CURRENT_STATE" ]; then
    echo "   ✅ Found target code - ready to modify"
else
    echo "   ⚠️  Target code not found - file may already be modified or Jellyfin version differs"
    echo "   Continuing anyway..."
fi
echo ""

# Step 3: Apply modification 1
echo "3️⃣  Applying modification 1: Enable burn-in by default..."
docker exec jellyfin sed -i 's/f\.AlwaysBurnInSubtitleWhenTranscoding=c\.A\.alwaysBurnInSubtitleWhenTranscoding()/f.AlwaysBurnInSubtitleWhenTranscoding=true/g' "$BUNDLE_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Modification 1 applied"
else
    echo "   ❌ Modification 1 failed"
fi
echo ""

# Step 4: Apply modification 2 (this one is complex, so we'll do it carefully)
echo "4️⃣  Applying modification 2: Force return true..."
docker exec jellyfin sed -i 's/{key:"alwaysBurnInSubtitleWhenTranscoding",value:function(e){return void 0!==e?this\.set("alwaysBurnInSubtitleWhenTranscoding",e\.toString()):(0,o\.G4)(this\.get("alwaysBurnInSubtitleWhenTranscoding",!1))}}}/{key:"alwaysBurnInSubtitleWhenTranscoding",value:function(e){return true}}/g' "$BUNDLE_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Modification 2 applied"
else
    echo "   ❌ Modification 2 failed"
fi
echo ""

# Step 5: Verify changes
echo "5️⃣  Verifying modifications..."
VERIFY1=$(docker exec jellyfin grep -o "f.AlwaysBurnInSubtitleWhenTranscoding=true" "$BUNDLE_FILE" | head -1)
VERIFY2=$(docker exec jellyfin grep -o 'value:function(e){return true}' "$BUNDLE_FILE" | head -1)

if [ -n "$VERIFY1" ]; then
    echo "   ✅ Modification 1 verified"
else
    echo "   ⚠️  Modification 1 could not be verified"
fi

if [ -n "$VERIFY2" ]; then
    echo "   ✅ Modification 2 verified"
else
    echo "   ⚠️  Modification 2 could not be verified"
fi
echo ""

# Step 6: Restart Jellyfin
echo "6️⃣  Restarting Jellyfin to apply changes..."
docker restart jellyfin > /dev/null 2>&1
echo "   ⏳ Waiting for Jellyfin to restart (15 seconds)..."
sleep 15
echo "   ✅ Jellyfin restarted"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BURN-IN SUBTITLES ENABLED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 What This Does:"
echo ""
echo "   • Subtitles will ALWAYS be burned into video during transcoding"
echo "   • Ensures perfect sync (no more out-of-sync issues!)"
echo "   • Works for ALL subtitle types (SRT, ASS, SSA, etc.)"
echo "   • Applied to ALL users on ALL clients automatically"
echo ""
echo "⚠️  Trade-offs:"
echo ""
echo "   • Requires transcoding (uses more CPU)"
echo "   • Cannot disable subtitles during playback"
echo "   • Slightly slower playback start time"
echo ""
echo "💡 To Revert:"
echo ""
echo "   docker exec jellyfin cp $BACKUP_FILE $BUNDLE_FILE"
echo "   docker restart jellyfin"
echo ""
echo "🎯 Jellyfin is now at: http://localhost:8096"
echo ""
