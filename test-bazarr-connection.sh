#!/bin/bash

echo "🔍 Bazarr Connection Test"
echo "========================"
echo ""

# Test 1: Can we reach Bazarr?
echo "1. Testing Bazarr availability..."
if curl -s http://localhost:6767 > /dev/null; then
    echo "   ✅ Bazarr is reachable at http://localhost:6767"
else
    echo "   ❌ Cannot reach Bazarr"
    exit 1
fi

echo ""
echo "2. To test with API key, you need to:"
echo "   a) Go to http://localhost:6767"
echo "   b) Login if needed"
echo "   c) Settings → General → Security → Copy API Key"
echo ""
read -p "Paste your Bazarr API key here: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "   ⚠️  No API key provided"
    exit 1
fi

echo ""
echo "3. Testing API connection with your key..."

RESPONSE=$(curl -s -H "X-Api-Key: $API_KEY" http://localhost:6767/api/system/status)

if echo "$RESPONSE" | grep -q "bazarr_version"; then
    echo "   ✅ API Key works!"
    echo "   Response: $RESPONSE" | jq '.' 2>/dev/null || echo "   $RESPONSE"
    echo ""
    echo "✅ Connection successful! Use these settings in MediaVault:"
    echo "   URL: http://localhost:6767"
    echo "   API Key: $API_KEY"
else
    echo "   ❌ API Key failed"
    echo "   Response: $RESPONSE"
    echo ""
    echo "Make sure you copied the complete API key from:"
    echo "Bazarr → Settings → General → Security → API Key"
fi
