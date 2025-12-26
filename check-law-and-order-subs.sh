#!/bin/bash
# Check Law & Order SVU subtitle status and trigger downloads

BAZARR_URL="http://localhost:6767"
BAZARR_API_KEY="a5421902220f09abd682e7d30ed1cc20"

echo "🔍 Checking Law & Order SVU subtitle status..."
echo ""

# Check if series is added to Bazarr
SERIES_COUNT=$(curl -s -H "X-API-KEY: $BAZARR_API_KEY" "$BAZARR_URL/api/series" | node -e "const data=require('fs').readFileSync(0,'utf-8'); try { const json=JSON.parse(data); console.log(json.data?.length || 0); } catch(e) { console.log(0); }")

echo "📺 TV Series in Bazarr: $SERIES_COUNT"

if [ "$SERIES_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  No series found in Bazarr yet."
    echo ""
    echo "Quick setup (5 minutes):"
    echo ""
    echo "1️⃣  Enable Languages:"
    echo "   → http://localhost:6767 → Settings → Languages"
    echo "   → Add 'English' and enable it"
    echo ""
    echo "2️⃣  Enable Providers:"
    echo "   → Settings → Providers"
    echo "   → Enable 'TVsubtitles' (no account needed)"
    echo "   → Enable 'OpenSubtitles.com' (free account required)"
    echo ""
    echo "3️⃣  Add TV Show:"
    echo "   → Series → Add Series → Manual"
    echo "   → Browse to: /tv/Law and Order - SVU (1999 - ongoing) S01-S26 1080p WebDL H265 EAC3 2.0"
    echo "   → Set languages: English"
    echo "   → Click Add"
    echo ""
    echo "4️⃣  Trigger Download:"
    echo "   → Series → Click on Law & Order SVU"
    echo "   → Tools → 'Search All'"
    echo ""
else
    echo ""
    echo "✅ Series found! Checking for Law & Order SVU..."
    echo ""

    # Get series details
    curl -s -H "X-API-KEY: $BAZARR_API_KEY" "$BAZARR_URL/api/series" | node -e "
        const data = require('fs').readFileSync(0, 'utf-8');
        try {
            const json = JSON.parse(data);
            const svu = json.data.find(s => s.title?.includes('Law') || s.path?.includes('SVU'));
            if (svu) {
                console.log('✅ Law & Order SVU found in Bazarr!');
                console.log('   Title:', svu.title || 'Unknown');
                console.log('   Path:', svu.path || 'Unknown');
                console.log('   Episodes:', svu.episodeFileCount || 0);
                console.log('   Missing subtitles:', svu.episodeMissingCount || 0);
            } else {
                console.log('⚠️  Law & Order SVU not found in series list');
                console.log('   Add it manually via the Bazarr web UI');
            }
        } catch(e) {
            console.log('❌ Error parsing response');
        }
    "

    echo ""
    echo "To trigger subtitle download:"
    echo "→ http://localhost:6767 → Series → Law & Order SVU → Tools → 'Search All'"
fi

echo ""
echo "📊 Current Configuration:"
curl -s -H "X-API-KEY: $BAZARR_API_KEY" "$BAZARR_URL/api/system/settings" | node -e "
    const data = require('fs').readFileSync(0, 'utf-8');
    try {
        const json = JSON.parse(data);
        const langs = json.data?.settings?.general?.enabled_languages || [];
        console.log('   Languages enabled:', langs.length > 0 ? langs.join(', ') : 'NONE - Configure this first!');
    } catch(e) {
        console.log('   Unable to check settings');
    }
"

curl -s -H "X-API-KEY: $BAZARR_API_KEY" "$BAZARR_URL/api/providers" | node -e "
    const data = require('fs').readFileSync(0, 'utf-8');
    try {
        const json = JSON.parse(data);
        const enabled = json.data?.filter(p => p.enabled) || [];
        console.log('   Providers enabled:', enabled.length > 0 ? enabled.map(p => p.name).join(', ') : 'NONE - Configure this first!');
    } catch(e) {
        console.log('   Unable to check providers');
    }
"

echo ""
