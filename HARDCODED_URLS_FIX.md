# Hardcoded URLs Fix Guide

## Problem
There are **112 instances** of hardcoded URLs/ports across **28 files** in the codebase. This breaks the app when users change ports or run on different configurations.

Found by: Fresh install testing by experienced developer

## Root Causes
1. Direct usage of `'http://localhost:3001'` instead of environment variables
2. No centralized configuration file
3. Hard to change ports without breaking everything

## Solution

### 1. Centralized Configuration Created ✅
**File:** `apps/web/src/lib/config.ts`

This file now exports all URLs from environment variables:
- `API_URL` - API server URL
- `API_BASE` - API base path (`/api/v1`)
- `JELLYFIN_DEFAULT_URL` - Jellyfin server
- `QBITTORRENT_DEFAULT_URL` - qBittorrent Web UI

### 2. Environment Variables Updated ✅
**File:** `apps/web/.env.example`

Added:
```env
VITE_API_URL=http://localhost:3001
VITE_JELLYFIN_URL=http://localhost:8096
VITE_QBITTORRENT_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:3001
```

### 3. Migration Pattern

**Old Code:**
```typescript
const res = await fetch('http://localhost:3001/api/v1/downloads', {
  credentials: 'include'
});
```

**New Code:**
```typescript
import { API_BASE } from '@/lib/config';

const res = await fetch(`${API_BASE}/downloads`, {
  credentials: 'include'
});
```

## Files Needing Updates (28 Total)

### Frontend Pages (High Priority) ✅ ALL COMPLETE
- [x] `apps/web/src/pages/Favorites.tsx` ✅ (5 instances fixed)
- [x] `apps/web/src/pages/Downloads.tsx` ✅ (9 instances fixed)
- [x] `apps/web/src/pages/Dashboard.tsx` ✅ (4 instances fixed)
- [x] `apps/web/src/pages/Movies.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/pages/TVShows.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/pages/Documentaries.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/pages/Settings.tsx` ✅ (10 instances fixed)
- [x] `apps/web/src/pages/Browse.tsx` ✅ (2 instances fixed)
- [x] `apps/web/src/pages/YouTube.tsx` ✅ (20 instances fixed)
- [x] `apps/web/src/pages/SoundCloud.tsx` ✅ (11 instances fixed)

### Components ✅ ALL COMPLETE
- [x] `apps/web/src/components/layout/Layout.tsx` ✅ (2 instances fixed)
- [x] `apps/web/src/components/DownloadFormatPreview.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/components/RecommendedForYou.tsx` ✅ (1 instance fixed)

### Other Pages ✅ ALL COMPLETE (except deprecated files)
- [x] `apps/web/src/pages/admin/AdminLogin.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/pages/admin/AdminDashboard.tsx` ✅ (2 instances fixed)
- [x] `apps/web/src/pages/Media.tsx` ✅ (4 instances fixed)
- [x] `apps/web/src/pages/Trending.tsx` ✅ (1 instance fixed)
- [x] `apps/web/src/pages/AllPlatforms.tsx` ✅ (10 instances fixed)
- [x] `apps/web/src/pages/Reddit.tsx` ✅ (3 instances fixed)
- [x] `apps/web/src/pages/Rumble.tsx` ⚠️ (Deprecated - can be deleted)
- [x] `apps/web/src/pages/Search.tsx` ✅ (2 instances fixed)
- [x] `apps/web/src/pages/SettingsPresets.tsx` ✅ (5 instances fixed)
- [x] `apps/web/src/pages/TikTok.tsx` ✅ (3 instances fixed)
- [x] `apps/web/src/pages/Twitch.tsx` ✅ (3 instances fixed)
- [x] `apps/web/src/pages/Vimeo.tsx` ⚠️ (Deprecated - can be deleted)

### Library Files
- [x] `apps/web/src/lib/api.ts` ✅ (Already exports API_URL)
- [x] `apps/web/src/lib/auth.ts` ✅ (Updated to import from config)

### Backup Files (Can be deleted)
- [ ] `apps/web/src/pages/TVShows.tsx.backup`

## Search & Replace Command

To find all instances:
```bash
grep -r "localhost:3001" apps/web/src --exclude-dir=node_modules
grep -r "localhost:8096" apps/web/src --exclude-dir=node_modules
grep -r "localhost:8080" apps/web/src --exclude-dir=node_modules
```

## Testing After Migration

1. Change `VITE_API_URL` in `.env` to different port (e.g., `http://localhost:4000`)
2. Start API on that port
3. Verify all pages still work
4. Change back to 3001

## Priority Order

1. **Critical** - Auth, API client (`lib/auth.ts`, `lib/api.ts`)
2. **High** - Main pages (Movies, TV, Docs, Downloads, Dashboard)
3. **Medium** - Components (Layout, Previews)
4. **Low** - Admin pages, social media pages

## Next Steps

Run systematic replacement across all files:
1. Import config at top of each file
2. Replace hardcoded URLs with config constants
3. Test each page after update
4. Commit in logical groups (e.g., "Fix hardcoded URLs in browse pages")
