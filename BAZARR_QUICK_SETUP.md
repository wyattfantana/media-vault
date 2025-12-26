# Bazarr Quick Setup - Law & Order SVU Subtitle Sync

**Goal:** Get perfectly synced subtitles for all Law & Order SVU episodes

---

## Quick Checklist (10 minutes)

Open Bazarr: **http://localhost:6767**

### ☐ Step 1: Enable Languages (1 min)
```
Settings → Languages → Add Language
→ Select "English"
→ Check "Enabled"
→ Save
```

### ☐ Step 2: Enable Subtitle SYNC (3 min) ⭐ MOST IMPORTANT
```
Settings → Subtitles

Scroll to "Subtitle Synchronization":
→ ✓ Use embedded subtitles parser
→ ✓ Adaptive searching
→ ✓ Use scene name when available

Scroll to "Advanced Options":
→ ✓ Sync subtitles (ENABLE THIS!)
→ Sync threshold: 120 seconds
→ Save
```

**This is what fixes out-of-sync subs!** Bazarr will use FFmpeg to automatically adjust timing.

### ☐ Step 3: Enable Providers (2 min)
```
Settings → Providers

Quick option (no account):
→ ✓ TVsubtitles
→ ✓ Subscene
→ Save

Best option (free account):
→ Sign up at: https://www.opensubtitles.com/en/users/sign_up
→ ✓ OpenSubtitles.com
→ Enter username/password
→ Save
```

### ☐ Step 4: Add Law & Order SVU (2 min)
```
Series → Add Series

⚠️ IMPORTANT: Click "Manual" tab (NOT Sonarr)

→ Click "Add New Path"
→ Type: /tv
→ Click "Save"

→ Browse folders and find:
   "Law and Order - SVU (1999 - ongoing) S01-S26 1080p WebDL H265 EAC3 2.0"

→ Click the folder to select it

→ Configure:
   Languages: English
   Forced: No
   HI: No
   Audio Language: English

→ Click "Add"
```

### ☐ Step 5: Download & Sync Subtitles (2 min)
```
Series → Click "Law & Order SVU"

→ Click "Tools" button
→ Select "Search All Episodes"

Wait 10-30 minutes for downloads to complete.
Check progress: Series → Law & Order SVU
```

---

## How to Verify It's Working

Run this command:
```bash
./check-law-and-order-subs.sh
```

Or check manually:
```bash
find "/mnt/d/MediaVault/TV Shows/Law and Order - SVU"* -name "*.srt" | wc -l
```

---

## What Bazarr Does Automatically

✅ **Downloads subtitles** from multiple providers
✅ **Syncs timing** using FFmpeg audio analysis
✅ **Matches quality** to your video files
✅ **Names files correctly** for Jellyfin/Plex
✅ **Keeps updating** on a schedule you set

---

## Sync Explanation

**Without sync:** Subtitle says "Hello" but person says it 3 seconds later
**With sync:** Bazarr analyzes audio, detects offset, adjusts subtitle timing ✅

The "Sync subtitles" option is what fixes your out-of-sync problem!

---

## After Setup

Your subtitles will be at:
```
/mnt/d/MediaVault/TV Shows/Law and Order - SVU.../S01/Episode.srt
```

Jellyfin will automatically detect and use them!

---

## Troubleshooting

**"Can't add series - no path"**
→ Make sure you clicked "Add New Path" first and added `/tv`

**"No subtitles downloading"**
→ Check Settings → Languages has English enabled
→ Check Settings → Providers has at least one enabled

**"Subtitles still out of sync"**
→ Settings → Subtitles → Enable "Sync subtitles"
→ Or manually sync: Series → Episode → Tools → Sync

**"Too slow downloading"**
→ OpenSubtitles.com has rate limits (free: 200/day, VIP: unlimited)
→ Enable multiple providers to spread load

---

## Commands

**Check status:**
```bash
./check-law-and-order-subs.sh
```

**Count subtitle files:**
```bash
find "/mnt/d/MediaVault/TV Shows/Law and Order - SVU"* -name "*.srt" | wc -l
```

**Manual sync test (after Bazarr configured):**
```bash
# Get series ID from Bazarr, then:
curl -X POST -H "X-API-KEY: a5421902220f09abd682e7d30ed1cc20" \
  http://localhost:6767/api/episodes/sync
```

---

**Next:** Once configured, Bazarr runs automatically. Set it and forget it! 🎯
