# Fresh Install Issues - Testing Feedback

**Tester:** Experienced developer (Draven)
**Date:** 2025-12-14
**Result:** 90% working with config tweaks needed

---

## ✅ What Worked

- VPN detection and toggle (after port fixes)
- Movie/TV/Documentary search
- YouTube search
- Torrent search from movie pages
- qBittorrent integration
- Torrent delete removes from qBittorrent
- Jellyfin integration
- Favorites/bookmarks system
- Overall UI and UX

---

## ❌ Critical Issues Found

### 1. Database Migration - Missing User Columns ✅ FIXED
**Issue:** Fresh database install fails at login/register due to missing columns on `user` table

**Missing Columns:**
- `twoFactorEnabled`
- `role`
- `banned`
- `banReason`
- `banExpires`

**Impact:** Blocks all fresh installs - users can't register or sign in

**Fix Applied:**
- Updated `apps/api/src/scripts/migrate-better-auth.ts`
- Added all 5 missing columns with proper defaults
- Tested: Ready for fresh install

**File:** `apps/api/src/scripts/migrate-better-auth.ts` lines 32-36

---

### 2. Hardcoded Ports/URLs ⚠️ IN PROGRESS
**Issue:** 112 instances of hardcoded `localhost:3001` across 28 files

**Impact:**
- Changing API port (e.g., 3001 → 4000) breaks everything
- Hard to deploy on different configurations
- Not production-ready

**Examples:**
```typescript
// ❌ Hardcoded (breaks if port changes)
fetch('http://localhost:3001/api/v1/downloads')

// ✅ Should be
import { API_BASE } from '@/lib/config';
fetch(`${API_BASE}/downloads`)
```

**Fix Applied:**
- Created centralized config: `apps/web/src/lib/config.ts`
- Updated `.env.example` with all service URLs
- Created migration guide: `HARDCODED_URLS_FIX.md`

**Remaining Work:**
- Replace hardcoded URLs in 28 files (see `HARDCODED_URLS_FIX.md`)
- Priority: Main pages (Movies, TV, Docs, Downloads, Dashboard)

---

### 3. No Error Feedback on Login/Register ❌ NOT FIXED
**Issue:** When login/register fails, form just clears and refreshes - no error message shown

**Impact:**
- User doesn't know why login failed
- Confusing UX
- Hard to debug issues

**Current Behavior:**
1. User enters credentials
2. Click submit
3. Form clears and page refreshes
4. No feedback about what went wrong

**Expected Behavior:**
1. User enters credentials
2. Click submit
3. Show error: "Missing required fields in database" or "Invalid credentials"
4. User knows what to do next

**Fix Needed:**
- Add error state to login/register forms
- Display error messages from API
- Show loading state during submission

**Files to Update:**
- Login form component
- Register form component
- Better Auth error handling

---

### 4. Mullvad VPN Auto-Detection ⚠️ PARTIALLY FIXED
**Issue:** Initially didn't detect Mullvad was connected

**Impact:** Blocks torrent downloads even when VPN is on

**Current Status:**
- Works after port configuration fixes
- May need tweaking for different setups

**Fix Needed:**
- Improve VPN detection reliability
- Add manual override option
- Better error messages when VPN not detected

---

## 📋 Other Issues Found

### 5. TMDB API Key Required
**Issue:** Users must sign up for TMDB API key (requires address, personal info)

**Impact:** Barrier to entry for new users

**Suggestions:**
- Provide default demo key for testing
- Better documentation about API key requirement
- Consider proxy/shared key for initial setup

---

### 6. Hardcoded Service Detection
**Issue:** qBittorrent, Jellyfin URLs hardcoded in multiple places

**Related to:** Issue #2 (Hardcoded Ports)

**Fix:** Include in URL centralization effort

---

## 🎯 Feature Requests (From Testing)

### High Priority
1. **Better Filters/Browsing**
   - Search by actor, director
   - Saved searches/filters
   - Genre filters (e.g., "80s Action Movies")
   - Pre-filter non-English content
   - Fix Top 250 integration

2. **Filter Favorites by Genre**
   - Currently can filter by type (Movies, TV, etc.)
   - Want to filter within type by genre
   - Example: "Show only Action movies in my favorites"

3. **UI Installer**
   - Click-through installer for typical users
   - No manual .env editing
   - Auto-detect services

### Medium Priority
4. **Built-in Torrent Downloader**
   - Remove qBittorrent dependency
   - All-in-one solution

5. **Backup/Sync Options**
   - Backup favorites/watchlists
   - Sync across devices
   - Export/import data

6. **YouTube Playlist Preservation**
   - Save full playlists locally
   - Never lose data when account is deleted

### Low Priority
7. **Saved Searches**
   - "Latest releases over 7/8 rating"
   - "All 80s movies"
   - Quick filters for common searches

---

## 🚀 Recommended Fix Order

### Phase 1: Critical Blockers
1. ✅ Database migration (DONE)
2. ⚠️ Hardcoded URLs (IN PROGRESS)
3. ❌ Error feedback on login/register

### Phase 2: UX Improvements
4. VPN detection reliability
5. TMDB API key documentation
6. Filter improvements

### Phase 3: Features
7. Saved searches/filters
8. Genre filtering in favorites
9. UI installer

---

## 💡 Tester's Overall Feedback

**Quote:** "looks like it's almost there! just needs a few small changes to config"

**Positive:**
- Core functionality works great
- UI is polished
- Jellyfin integration is "very cool"
- Torrent integration is useful

**Areas to Improve:**
- Configuration flexibility (ports, URLs)
- Fresh install experience
- Error handling/feedback
- Content filtering/discovery

---

## 📝 Notes for Next Session

1. Finish hardcoded URL replacement (use `HARDCODED_URLS_FIX.md` guide)
2. Add error feedback to auth forms
3. Test fresh install end-to-end
4. Consider Docker setup for easier deployment
5. Improve filter architecture (complete redesign, not just patches)

**Testing Approach:**
- Always test with fresh database
- Change ports to verify nothing is hardcoded
- Test on different configurations
- Get feedback early and often

---

**Status:** Ready for systematic fixes. Core app is solid, just needs configuration flexibility.
