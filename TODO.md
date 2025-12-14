# MediaVault - Development Roadmap & Session Tracker

**Last Updated:** 2025-12-14
**Current Phase:** ✅ Phases 1, 2 Complete | ⚠️ Phases 4, 5 Partially Complete | ✅ VPN Integration Complete | ✅ Startup System Complete | ✅ Settings Simplified | ✅ Jellyfin Auto-Scan
**Next Session:** Favorites/Watchlist feature, IMDB Top 250 completion, or Phase 4 (advanced features)

---

## 📊 PROJECT STATE SNAPSHOT

### What's Working ✅
- **Authentication** - Better Auth with email/password, sessions, protected routes
- **TMDB Integration** - Movies, TV shows, documentaries browse with filters and infinite scroll
- **YouTube Integration** - Channel/playlist browse, multi-select, bookmarks, accurate counts
- **BBC iPlayer** - 9000+ programmes, channel filters, expiry tracking
- **SoundCloud** - Artist/track search, bookmarks (300-result limit)
- **Download Worker** - Background processing, progress tracking, auto-media creation, per-user concurrent limits
- **Jellyfin Auto-Formatting** - TV show detection, TMDB metadata, inline preview
- **Bookmarks/Favorites** - Save channels/playlists with auto-count updates
- **Presets System** - User-configurable download templates
- **Settings System** - Comprehensive user preferences with 7 categories (Download, Bandwidth, Jellyfin, Notifications, Storage, Behavior, Privacy)
- **Media Library** - Browse, stream, search downloaded files
- **Background Services** - tmux-based persistent services (qBittorrent, API, Web, Worker)
- **Infinite Scroll** - Smooth browsing on Movies, TV Shows, Documentaries pages
- **Jellyfin Plugins** - Intro Skipper, JellyScrub, TheTVDB, TMDb Box Sets (installed, restart required)
- **VPN Integration** - Windows Mullvad integration with automatic traffic protection, sidebar toggle, status display
- **Database** - PostgreSQL running in WSL2 (Unix sockets, all-in-one architecture)
- **Startup System** - Passwordless sudo, auto-start all services (PostgreSQL, Docker, Jellyfin, qBittorrent, MediaVault), single-command startup/stop/status scripts
- **Jellyfin Container** - Properly configured Docker container with persistent volumes, auto-restart, accessible at http://localhost:8096

### Partially Working ⚠️
- **Torrent Integration** - qBittorrent API works, but has critical database bug (see below)
- **Social Media Pages** - Reddit, TikTok, Twitch, Vimeo exist but basic/untested

### Not Working ❌
- **Torrent Downloads** - Database constraint missing 'qbittorrent' as valid downloader
- **Concurrent Downloads** - Only processes one at a time
- **Download Cancellation** - Can't cancel in-progress downloads
- **Age-Restricted YouTube** - Needs cookie authentication

---

## 🔥 CRITICAL BUGS ✅ ALL FIXED

### 1. Database Schema Bug - Torrent Downloads Failing ✅ FIXED
**Issue:** Line 16 of `002_create_media_tables.sql` was missing `'qbittorrent'`

**Solution:** Created migration `007_add_qbittorrent_downloader.sql`
- [x] Created migration with ALTER TABLE statement
- [x] Applied migration to database
- [x] Tested torrent download end-to-end
- [x] Verified database accepts 'qbittorrent' as downloader

**Status:** ✅ FIXED - Torrents now work perfectly

---

### 2. qBittorrent Progress Not Syncing to Database ✅ FIXED
**Issue:** Torrents tracked in qBittorrent but progress didn't sync to MediaVault

**Solution:** Implemented comprehensive torrent sync system
- [x] Created background poller in download worker (every 10 seconds)
- [x] Polls qBittorrent API and matches torrents by hash
- [x] Updates downloads table with progress, status
- [x] Detects all completion states (stalledUP, pausedUP, uploading, etc.)
- [x] Creates media entries when torrent completes
- [x] Triggers Jellyfin library scans

**Status:** ✅ FIXED - Real-time progress sync working

---

### 3. TMDB Thumbnails Not Working ✅ FIXED
**Issue:** TMDB year extraction broken, frontend aspect ratio wrong

**Solution:** Multiple fixes applied
- [x] Fixed year extraction (extract before cleaning title)
- [x] Enhanced title cleaning (preserve important parts)
- [x] Added TV show detection
- [x] Special handling for edge cases (Law & Order SVU)
- [x] Optimized size (w500 → w200)
- [x] Fixed frontend aspect ratio (16:9 → 2:3)
- [x] Changed object-cover to object-contain

**Status:** ✅ FIXED - 100% success rate (4/4 torrents)

---

## 🎯 DEVELOPMENT PHASES

### Phase 1: Bug Fixes & Stabilization ✅ COMPLETED
**Goal:** Fix critical bugs, complete torrent integration, stabilize core features

#### Tasks
- [x] **Fix database schema for qBittorrent** (migration 007)
- [x] **Implement qBittorrent progress sync** to MediaVault database
- [x] **Test torrent workflow** end-to-end (add → download → complete → organize)
- [x] **Verify Jellyfin auto-formatting** works with completed torrents
- [x] **TMDB thumbnail integration** - Auto-fetch posters with smart title parsing
- [x] **Frontend UI fixes** - Proper aspect ratios for movie posters
- [ ] **Fix worker environment variables** (POSTGRES_HOST for database connection) - DEFERRED
- [ ] **Add error handling** for failed downloads with retry logic - DEFERRED
- [x] **Test download sources**:
  - [x] Torrents (magnet links) - ✅ WORKING (600MB in ~5min with TMDB thumbnails)
  - [x] YouTube (standard videos) - ✅ WORKING (889KB in ~10s, auto-organized)
  - [x] BBC iPlayer (TV shows) - ✅ WORKING (600MB in ~5min, slow but functional)
  - [x] BBC iPlayer (Radio) - ✅ WORKING (same as TV, uses get_iplayer)
  - [x] SoundCloud (tracks) - ✅ WORKING (2.28MB in 28s via yt-dlp)
  - [ ] YouTube (age-restricted with cookies) - DEFERRED (requires cookie setup)
  - [ ] Torrents (.torrent files) - DEFERRED (similar to magnet links)

**Completion Criteria:**
- ✅ All downloads types work without database errors
- ✅ Torrent progress syncs in real-time
- ✅ Files auto-organize to Jellyfin-compatible paths
- ✅ Worker doesn't crash on errors
- ✅ TMDB thumbnails fetch automatically
- ✅ UI displays thumbnails properly

---

### Phase 2: Torrent System Enhancement ✅ COMPLETED
**Goal:** Make torrent management first-class feature

#### Tasks
- [x] **Frontend UI for torrent management**
  - [x] Show download/upload speed, ETA, peers, seeds in Downloads page
  - [x] Pause/resume torrents from MediaVault UI
  - [x] Delete torrents with "keep files" or "remove files" option
  - [ ] Filter downloads by type (torrents vs direct downloads) - DEFERRED (not needed yet)
- [x] **Torrent completion handling**
  - [x] Move completed torrents to organized folders (already working from Phase 1)
  - [x] Update media table with torrent metadata (already working from Phase 1)
  - [ ] Optional: Stop seeding after ratio/time reached - DEFERRED
- [x] **qBittorrent systemd service**
  - [x] Already running via tmux in startup script
- [x] **Bandwidth controls**
  - [x] Download speed limits (global via API)
  - [x] Upload speed limits (global via API)
  - [ ] Schedule-based limits (fast at night, slow during day) - DEFERRED

**Completion Criteria:**
- ✅ Torrents manageable entirely from MediaVault UI
- ✅ qBittorrent auto-starts with system (tmux)
- ✅ Bandwidth limits configurable via API

---

### Phase 3: Enhanced Content Discovery ⚠️ PARTIALLY COMPLETED
**Goal:** Make finding content easier and more intuitive

#### Tasks
- [ ] **Unified Search Improvements** - ⏸️ SKIPPED (not needed per user request)
  - [ ] Search across Movies, TV, Documentaries simultaneously
  - [ ] Show mixed results with source badges
  - [ ] Advanced filters accessible from search (genre, year, rating)
  - [ ] Search history and suggestions
  - [ ] "Similar to this" recommendations
- [x] **Better Browsing UX**
  - [x] Infinite scroll instead of pagination - ✅ COMPLETED (Session 4)
  - [x] "Continue browsing" state persistence via sessionStorage - ✅ COMPLETED (Session 6)
  - [ ] Quick filter sidebar (genre pills, year slider, rating filter)
  - [ ] Sort options more visible
- [ ] **Content Discovery Features**
  - [ ] "Recommended for you" based on download history
  - [ ] "Trending now" across all platforms
  - [ ] "Popular this week/month" aggregated view
  - [ ] Genre-based carousels (Netflix-style)
- [ ] **Performance Optimization**
  - [ ] Cache TMDB search results (Redis or in-memory)
  - [ ] Debounce search input (300ms)
  - [ ] Pre-fetch popular content on page load

**Completion Criteria:**
- ✅ Users can find content 50% faster
- ✅ Search works across all platforms
- ✅ Recommendations are relevant

---

### Phase 4: Advanced Features ⚠️ PARTIALLY COMPLETED
**Goal:** Add power-user features and automation

#### Tasks
- [x] **Download Queue Enhancements**
  - [x] Concurrent downloads (3 simultaneous, configurable in code)
  - [ ] Priority queue system (high/normal/low priority) - DEFERRED
  - [ ] Pause/resume all downloads - DEFERRED
  - [x] Cancel in-progress downloads (DELETE endpoint already works)
- [ ] **Scheduled Downloads**
  - [ ] Schedule downloads for specific time
  - [ ] Recurring downloads (daily, weekly)
  - [ ] Auto-download new episodes from bookmarked channels
- [ ] **Notification System**
  - [ ] Browser notifications for completed downloads
  - [ ] Email notifications (optional)
  - [ ] Webhook support for Discord/Slack
- [ ] **Auto-Update Bookmarks**
  - [ ] Background job to check bookmarked channels for new videos
  - [ ] Notify user when new content available
  - [ ] Optional: Auto-download new content
- [ ] **Statistics & Analytics**
  - [ ] Enhanced dashboard with charts
  - [ ] Download success rate
  - [ ] Storage usage over time
  - [ ] Most popular sources/genres
- [ ] **Media Player Integration**
  - [ ] In-app video player for previewing downloads
  - [ ] Subtitle support
  - [ ] Playback tracking

**Completion Criteria:**
- ✅ Power users have advanced controls
- ✅ Automation reduces manual work
- ✅ Analytics provide insights

---

### Phase 5: Polish & Production Ready ⚠️ PARTIALLY COMPLETED
**Goal:** Make MediaVault production-ready for public use

#### Tasks
- [x] **Error Handling & Resilience**
  - [x] Retry logic with exponential backoff (10s, 20s, 40s - max 3 retries)
  - [ ] Graceful degradation when services unavailable - DEFERRED
  - [x] User-friendly error messages (showing retry status)
  - [ ] Error boundaries for React components - DEFERRED
- [ ] **Performance Optimization**
  - [ ] Lazy loading for thumbnails
  - [ ] Placeholder images while loading
  - [ ] Code splitting for faster initial load
  - [ ] Database query optimization
- [ ] **Security Hardening**
  - [ ] Rate limiting on API endpoints
  - [ ] Input validation and sanitization
  - [ ] CSRF protection
  - [ ] Secure cookie settings
- [ ] **Documentation**
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] User guide with screenshots
  - [ ] Troubleshooting guide
  - [ ] Docker deployment guide
- [ ] **Testing**
  - [ ] Unit tests for services
  - [ ] Integration tests for API
  - [ ] E2E tests for critical flows
  - [ ] Load testing

**Completion Criteria:**
- ✅ App is stable and performant
- ✅ Documentation is comprehensive
- ✅ Ready for public release

---

## 🔄 SESSION STATE TRACKER

### Current Session: 2025-12-14 (Session 15) ✅ COMPLETED
**Focus:** UX Improvements - Auto-Scroll, Card Layout, React Hooks Fix
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Fixed Movies page not loading** - React hooks placement issue
  - Root cause: `useRef` hook declared after function definitions (violates React rules)
  - Moved `downloadButtonRef = useRef<HTMLButtonElement>(null)` to top of component
  - Applied fix to Movies.tsx and Favorites.tsx
  - Added missing `useRef` import
  - Cleared stale sessionStorage causing search mode on Movies page
- [x] **Implemented auto-scroll to bottom when selecting torrent**
  - User feedback: "it's not obvious you have to scroll down to confirm download"
  - Scrolls modal to very bottom when user clicks a torrent
  - Uses modal container's scrollHeight for smooth animation
  - Applied to Movies, Favorites, TVShows, and Documentaries pages
  - Improved UX: Download button now immediately visible after torrent selection
- [x] **Fixed Favorites card layout alignment**
  - Issue: Buttons at different heights when titles vary in length
  - Solution: Flexbox layout with `flex flex-col h-full` on card container
  - Title min-height increased to 3.5rem (accommodates 2-line titles)
  - Added flex-grow wrapper to push buttons to bottom
  - All cards now have equal heights with aligned buttons

**Implementation Details:**
- React hooks must be declared at component top level (before any logic or function definitions)
- Auto-scroll: Finds scrollable modal container via `closest('.overflow-y-auto, .overflow-auto')`
- Card layout: Poster is flex-shrink-0, content wrapper is flex-grow, buttons use mt-auto
- sessionStorage cleanup resolved Movies page showing empty search results

**Files Modified:**
- `apps/web/src/pages/Movies.tsx` - Hook placement, auto-scroll, useRef import
- `apps/web/src/pages/Favorites.tsx` - Hook placement, auto-scroll, card layout with flexbox
- `apps/web/src/pages/TVShows.tsx` - Auto-scroll, useRef import
- `apps/web/src/pages/Documentaries.tsx` - Auto-scroll, useRef import

**User Feedback:**
- "perfecto" - After auto-scroll refinement
- "splendid" - After card layout fix
- "nice yes it worls and scrolls down" - Initial auto-scroll test

**Next Session Start Point:**
→ UX polish complete! Consider: TMDB/IMDb list integration, per-platform preferences, or Phase 3 browsing enhancements

---

### Session: 2025-12-13 (Session 14) ✅ COMPLETED
**Focus:** VPN Status Detection, iPlayer Jellyfin Formatting, Auto-Scan & Network Troubleshooting
**Status:** ✅ COMPLETED
**Completed:**
- [x] **VPN Status Detection for Downloads** - Automatic VPN checking
  - Replaced manual "I confirm VPN is connected" checkbox with automatic VPN status detection
  - Downloads now check actual VPN connection status via API
  - Confirm button enabled only when VPN is ON (green indicator)
  - Confirm button greyed out when VPN is OFF (red indicator)
  - Shows real-time status: "Checking VPN status..." / "VPN Connected" / "VPN Disconnected"
  - Applied to all download modals: Movies, TV Shows, Documentaries
- [x] **iPlayer Title Formatting for Jellyfin** - Clean filenames
  - Created `formatIPlayerTitle()` function to clean ugly iPlayer filenames
  - Removes PIDs (e.g., m002m6dy), "_original" suffix, replaces underscores with spaces
  - Example: `AI_Decoded_-_Stephen_Fry_m002m6dy_original.mp4` → `AI Decoded - Stephen Fry.mp4`
  - Automatically renames both video and subtitle files after download
  - Uses programme metadata (name + episode) when available, falls back to filename cleanup
  - Applied to all new iPlayer downloads
- [x] **Fixed Jellyfin not seeing iPlayer files** - Volume mount issue
  - Root cause: Jellyfin mounted to `/home/beerm/downloads` but files were in `/mnt/d/MediaVault`
  - Recreated Jellyfin container with correct volume mount: `/mnt/d/MediaVault` → `/media`
  - Jellyfin now sees all media including iPlayer folder
- [x] **Jellyfin Auto-Scan on Download Complete** - Automatic library updates
  - Added code to initialize Jellyfin from database on API startup
  - Loads config from `user_preferences` table (jellyfin_server_url, jellyfin_api_key)
  - Download worker automatically triggers library scan after each download
  - Scans specific library containing the new file
  - New media appears in Jellyfin within seconds
- [x] **Fixed Jellyfin phone connection issue** - WSL2 networking resolved
  - Root cause: Jellyfin remote IP filter set to Allowlist mode with empty list
  - Changed `IsRemoteIPFilterBlacklist` from `false` to `true` in network.xml
  - Added Windows Firewall rule for port 8096
  - Set up port forwarding: `192.168.0.78:8096` → `172.24.105.200:8096` (WSL2)
  - Phone now connects via Windows host IP: http://192.168.0.78:8096
- [ ] **iPlayer Download Thumbnails** - Work in progress (WIP)
  - Attempted to add thumbnail support for iPlayer downloads
  - Issue: get_iplayer --info flag doesn't support --listformat
  - Tried using search() instead of getProgrammeInfo() but still not working
  - Needs further investigation - may require different approach
  - Deferred to future session
- [ ] **IMDB Top 250 Lists Integration** - Work in progress (WIP)
  - Downloaded official IMDB datasets (title.ratings.tsv.gz, title.basics.tsv.gz)
  - Processed datasets to extract Top 250 movies and TV shows
  - Updated curated-lists.service.ts with official data (250 movies, 250 TV shows)
  - User feedback: "the list is still off" - needs further investigation
  - Deferred to future session for completion

**Implementation Details:**
- VPN Detection: Fetches `/api/v1/vpn/status` when download modal opens, enables/disables button based on `connected` status
- iPlayer Formatting: Downloads to temp folder, renames with clean title, moves to Jellyfin library
- Jellyfin Docker: Changed mount from `/home/beerm/downloads:/media` to `/mnt/d/MediaVault:/media`
- Jellyfin network.xml: Switched from Allowlist (blocking all) to Blacklist mode (allowing all)
- Windows netsh portproxy: Forwards 0.0.0.0:8096 → 172.24.105.200:8096
- Windows Firewall: Created "Jellyfin WSL2" inbound rule for TCP port 8096

**Files Modified:**
- `/home/beerm/projects/media-vault/apps/web/src/pages/Movies.tsx` - VPN status detection
- `/home/beerm/projects/media-vault/apps/web/src/pages/TVShows.tsx` - VPN status detection
- `/home/beerm/projects/media-vault/apps/web/src/pages/Documentaries.tsx` - VPN status detection
- `/home/beerm/projects/media-vault/apps/api/src/workers/download.worker.ts` - iPlayer title formatting
- `/home/beerm/projects/media-vault/apps/api/src/services/get-iplayer.service.ts` - Attempted thumbnail support
- `/home/beerm/projects/media-vault/apps/api/src/routes/downloads.ts` - Use search() for iPlayer info
- `/home/beerm/projects/media-vault/apps/api/src/index.ts` - Initialize Jellyfin from database
- `/home/beerm/jellyfin/config/config/network.xml` - Fixed remote IP filter
- Jellyfin Docker container - Updated volume mounts

**Next Session Start Point:**
→ Investigate why IMDB Top 250 lists are "still off" - verify rankings against official IMDB website, check filtering/sorting logic

---

### Session: 2025-12-12 (Session 13) ✅ COMPLETED
**Focus:** User-Friendly Settings - Dynamic Library Paths & API Keys
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Dynamic Jellyfin Library Paths** - Users can add unlimited custom paths
  - Changed jellyfin_library_paths from fixed object to array of {name, path} objects
  - Migration 015: Converted existing data from object to array format
  - Added UI controls: "Add Path" button, remove buttons for each path
  - Users can now create custom categories (Anime, Kids Shows, etc.)
  - Two-column layout: Name field + Path field for each library
- [x] **API Keys & Paths in Settings** - No more editing environment files!
  - Migration 016: Added tmdb_api_key, omdb_api_key, download_directory, ytdlp_path, get_iplayer_path columns
  - Renamed "Privacy" tab to "Advanced" with 3 organized sections:
    - API Keys: TMDB (with link to get free key), OMDB (optional)
    - Tool Paths: Download directory, yt-dlp path, get_iplayer path
    - Privacy: YouTube cookies, clear search history
  - Added helpful descriptions and links to get API keys
  - All fields saved to user preferences database
- [x] **TMDB Service Integration** - Actually uses user's API key now
  - Updated TMDB service with getApiKey(userId) method
  - Fetches API key from user preferences first, falls back to env var
  - Updated searchMovies, searchTVShows, findThumbnailForTitle to accept userId
  - Added auth middleware to TMDB routes to extract userId
  - Routes now pass userId to service methods
  - **Result**: Users configure TMDB API key in Settings UI, no code editing required!

**Implementation Details:**
- Migration 014: Added iplayer path to default jellyfin_library_paths
- Migration 015: Converted library paths from object to array with backwards compatibility
- Migration 016: Added 5 new user-configurable columns for API keys and paths
- Settings UI: Dynamic path management with Add/Remove buttons, password-type inputs for API keys
- Backend: Updated preferences.ts to handle new fields
- TMDB service: Fetches user API key from database, maintains backwards compatibility with env vars

**Files Created:**
- `apps/api/src/migrations/014_add_iplayer_to_jellyfin_paths.sql`
- `apps/api/src/migrations/015_convert_jellyfin_paths_to_array.sql`
- `apps/api/src/migrations/016_add_api_keys_and_paths.sql`

**Files Modified:**
- `apps/web/src/pages/Settings.tsx` - Dynamic library paths UI, API keys section, renamed Privacy to Advanced
- `apps/api/src/services/tmdb.service.ts` - getApiKey() method, userId parameter support
- `apps/api/src/routes/tmdb.ts` - Auth middleware, userId extraction and passing
- `apps/api/src/routes/preferences.ts` - Handle new API key and path fields

**User Feedback:**
- "nice ok another idea i had is having the tmdb api key in the settings too"
- "yes we need this" (referring to dynamic library paths)
- Identified that TMDB was still hardcoded despite settings field existing

**Next Session Start Point:**
→ Settings system is now truly user-friendly! All configuration through UI, no code/env editing required. Consider: TMDB/IMDb list integration, per-platform preferences, or UX enhancements from recommendations list.

---

### Session: 2025-12-11 (Session 12) ✅ COMPLETED
**Focus:** PostgreSQL + Windows Mullvad VPN Integration
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Moved PostgreSQL from Windows to WSL2** - True "all-in-one" architecture
  - Stopped and disabled Windows PostgreSQL service
  - Started WSL2 PostgreSQL using Unix sockets (no TCP/IP)
  - Updated MediaVault .env to use `/var/run/postgresql` socket
  - Fixed authentication (peer → md5 in pg_hba.conf)
  - All services now run entirely in WSL2
- [x] **Windows Mullvad VPN Integration** - Seamless VPN without crashes
  - Integrated Windows Mullvad CLI (`/mnt/c/Program Files/Mullvad VPN/resources/mullvad.exe`)
  - Updated VPN service to use Windows Mullvad from WSL2
  - Added VPN status detection (connected, server, location, IP)
  - Verified traffic protection via mirrored networking (WSL2 IP = VPN IP)
  - qBittorrent downloads automatically protected (no binding needed)
- [x] **VPN API Enhancements** - Smart Windows Mullvad handling
  - Added `/api/v1/vpn/test` endpoint (checks public IP vs VPN IP)
  - Updated `/api/v1/vpn/status` endpoint to detect Windows Mullvad setup
  - Returns `isWindowsMullvad`, `bindingAvailable`, `trafficProtected` flags
  - Bind endpoint returns success with explanation (binding not needed)
- [x] **Simplified VPN UI** - Removed unnecessary controls
  - Removed "qBittorrent VPN Binding" section (not applicable)
  - Removed "Auto-bind qBittorrent to VPN" preference
  - Removed "VPN Kill Switch" preference (traffic automatically protected)
  - Removed "Preferred VPN Location" (managed via Windows Mullvad GUI)
  - Kept only relevant settings: Enable VPN, Require VPN for Torrents, Auto-connect
  - Updated info box to explain automatic protection via mirrored networking
- [x] **Sidebar VPN Toggle** - One-click VPN control
  - Added interactive toggle switch in sidebar
  - Shows VPN status (Connected/Disconnected) with color indicator
  - Displays server name when connected
  - Optimistic UI updates with quick polling (500ms) for verification
  - Loading states ("Connecting..." / "Disconnecting...")
  - Works from any page in the app
- [x] **Fixed TMDB Trending Endpoint** - Route parameter bug
  - Changed route from `/trending/:mediaType?timeWindow=week` to `/trending/:mediaType/:timeWindow`
  - Frontend was calling `/movie/week` but backend expected `?timeWindow=week`
  - Now matches frontend's URL structure
- [x] **Started qBittorrent Service** - Required for VPN binding tests
  - Started qBittorrent-nox in tmux session
  - Configured with default credentials (admin/adminadmin)
  - Running on port 8080

**Architecture Achievement:**
- ✅ **All-in-One WSL2 Setup**: PostgreSQL, API, Web, Worker, qBittorrent all in WSL2
- ✅ **Windows VPN Integration**: Mullvad runs on Windows, protects WSL2 traffic automatically
- ✅ **No More Crashes**: Eliminated WSL2 networking crashes from daemon conflicts
- ✅ **Automatic Protection**: Torrents use VPN without manual binding (mirrored networking)

**Implementation Details:**
- VPN service uses Windows executable directly via WSL2's ability to run .exe files
- Public IP test confirms traffic protection: `curl https://api.ipify.org` returns VPN IP
- Sidebar toggle uses optimistic updates for instant feedback
- Quick polling (every 500ms for 5 seconds) verifies actual VPN state
- Frontend auto-reloads with Vite HMR for all changes

**Files Created:**
- N/A (all modifications to existing files)

**Files Modified:**
- `apps/api/.env` - Changed POSTGRES_HOST to Unix socket path
- `apps/api/src/services/vpn.service.ts` - Windows Mullvad CLI integration, testConnection method
- `apps/api/src/routes/vpn.ts` - Test endpoint, Windows Mullvad detection, smart bind handling
- `apps/api/src/routes/tmdb.ts` - Fixed trending route parameter
- `apps/web/src/pages/Settings.tsx` - Removed binding controls, simplified VPN preferences
- `apps/web/src/components/layout/Layout.tsx` - Added VPN toggle switch with optimistic updates

**System Configuration:**
- `/etc/postgresql/16/main/postgresql.conf` - `listen_addresses = ''` (Unix sockets only)
- `/etc/postgresql/16/main/pg_hba.conf` - `local all all md5` (password auth)
- Windows Services - postgresql-x64-16 disabled permanently

**User Feedback:**
- "wow nice work" - After VPN integration complete
- "ok better" - After optimistic toggle updates
- "perfect" - After fixing connecting/disconnecting message swap

**Next Session Start Point:**
→ VPN system complete! Consider: Phase 3 browsing UX, Phase 4 automation, or TMDB/IMDb list integration

---

### Session: 2025-12-10 (Session 10) ✅ COMPLETED
**Focus:** Automatic Torrent Search Integration
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Implemented automatic torrent search** across multiple torrent sites
  - Created torrent-search.service.ts using torrent-search-api library
  - Attempted multi-provider search (ThePirateBay, 1337x, YTS)
  - Discovered only ThePirateBay works reliably (SSL/connection issues with others)
  - Final implementation: Auto-Search (PirateBay) with 25 results limit
- [x] **Created backend API** - `/api/v1/torrents/search`
  - POST /torrents/search endpoint with authentication
  - Returns formatted torrent results with title, magnet, seeds, peers, size, quality
  - Deduplication and sorting by seeds
- [x] **Enhanced frontend UI** - Movies, TV Shows, Documentaries pages
  - Added "Auto-Search (PirateBay)" button to download modals
  - Torrent results displayed in table with color-coded source badges
  - Quality extraction from torrent titles (4K, 1080p, 720p, etc.)
  - One-click magnet link selection to queue downloads
  - Removed duplicate PirateBay manual search button
- [x] **Provider testing and troubleshooting**
  - Created test-providers.cjs for individual provider testing
  - Results: ThePirateBay ✓, 1337x ✗, Eztv ✗, Rarbg ✗, YTS ✗
  - Tried parallel and sequential search strategies
  - Final decision: Focus on PirateBay only, keep manual buttons for fallback
- [x] **Dependencies** - Added torrent-search-api to package.json

**Implementation Details:**
- Service: Searches ThePirateBay with sequential provider enable/disable
- Quality detection: Regex patterns for 4K, 1080p, 720p, 480p, HDRip, BluRay, etc.
- Deduplication: Uses Map to filter duplicate magnet links
- Sorting: Prioritizes by seed count with diversity for similar seeds
- UI: Green badges for PirateBay, blue for 1337x, orange for Ext.to

**Files Created:**
- `apps/api/src/services/torrent-search.service.ts`
- `apps/api/src/routes/torrents.ts`
- `apps/api/test-providers.cjs` (testing utility)

**Files Modified:**
- `apps/api/src/index.ts` - Registered torrents router
- `apps/api/package.json` - Added torrent-search-api dependency
- `apps/web/src/pages/Movies.tsx` - Auto-search UI
- `apps/web/src/pages/TVShows.tsx` - Auto-search UI
- `apps/web/src/pages/Documentaries.tsx` - Auto-search UI

**User Feedback:**
- Initial request: "10 results max from each of 3 sites (1337x, PirateBay, Ext.to)"
- Testing revealed: Only PirateBay works (SSL/connection issues with others)
- Final decision: "auto search (pirate bay) then remove the manual pirate bay button, 25 results is fine"
- Final verdict: "ok this is absolutely epic"

**Next Session Start Point:**
→ Choose from High Priority tasks (TMDB/IMDb List Integration, Per-Platform Preferences) or Phase 3/4/5 features

---

### Session: 2025-12-09 (Session 9) ✅ COMPLETED
**Focus:** Major Codebase Cleanup & Organization
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Deep codebase audit** - Comprehensive scan for QuoteMaster/universal-app-starter remnants
  - Found 21 files with wrong project names
  - Categorized into delete (8 files) and edit (14 files)
- [x] **Deleted QuoteMaster files** (8 items, 428 lines removed)
  - scripts/setup-production.sh - QuoteMaster business setup
  - apps/api/src/emails/ - Business email templates
  - apps/api/src/lib/email.ts - Email library
  - apps/web/tests/example.spec.ts - QuoteMaster tests
- [x] **Database configuration cleanup** (6 files)
  - Changed default database from 'quotemaster' to 'mediavault'
  - Updated packages/database/, apps/api configs
- [x] **Package renaming** (4 files)
  - Root: "universal-app-starter" → "media-vault"
  - Apps: "starter-*" → "api", "web", "desktop"
- [x] **Documentation updates**
  - README.md: Added missing migrations (007, 008, 009), PostgreSQL setup, tool paths
  - QUICKSTART.md: Removed /beerm user-specific paths
  - Updated startup script references
- [x] **Tauri desktop rebranding**
  - Product name: "MediaVault", identifier: "com.dwdec.mediavault"
- [x] **Types package cleanup** (183 lines removed, 77% reduction)
  - Removed all QuoteMaster business types
  - Kept only generic utility types
- [x] **File organization**
  - Created scripts/ folder (setup-database.sh, fix_turbo.py)
  - Created apps/api/src/tests/ folder (test-formatter.ts)
  - Added scripts/README.md documentation
- [x] **Testing** - Verified all services work after cleanup

**Commits:**
- d88ed81 - Major codebase cleanup (19 files changed)
- 0a27563 - Types package cleanup & QUICKSTART paths
- 648710f - File organization (scripts/ and tests/ folders)

**Next Session Start Point:**
→ Choose from High Priority tasks below or continue with Phase 3/4/5 features

---

### Session: 2025-12-08 (Session 8) ✅ COMPLETED
**Focus:** Comprehensive Settings System with User Preferences
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Created database migration 009** - user_preferences table
  - 20+ preference columns across 7 categories
  - Download preferences (quality, folder, formats, concurrent downloads)
  - Bandwidth controls (download/upload speed limits)
  - Jellyfin integration (server URL, API key, library paths, auto-scan)
  - Notification preferences (enable/disable, download complete/failed, sound)
  - Storage management (limits, auto-cleanup settings)
  - Behavior settings (auto-organize, auto-fetch thumbnails, history retention)
  - Privacy/advanced (YouTube cookies path, clear search history)
  - Auto-creates default preferences for existing users
  - Triggers for auto-updating timestamps
- [x] **Built backend API** - `/api/v1/preferences`
  - GET /preferences - Fetch user preferences (auto-creates defaults)
  - PUT /preferences - Update preferences (partial updates supported)
  - GET /preferences/storage - Storage usage by media type with limits/percentages
  - POST /preferences/cleanup - Manual cleanup of old files
  - All endpoints require authentication
  - Integrated with index.ts routes
- [x] **Created comprehensive Settings UI** - 7 tabbed sections
  - Download Preferences tab - quality (2160p-360p/audio), default folder, video/audio formats, concurrent downloads slider (1-10)
  - Bandwidth Controls tab - download/upload speed limits in MB/s
  - Jellyfin Integration tab - server URL, API key, library paths for movies/tv/music/docs, auto-scan toggle
  - Notifications tab - master toggle, download complete/failed alerts, sound toggle
  - Storage Management tab - live storage stats by media type, storage limit, auto-cleanup toggle/days slider, manual cleanup button
  - Behavior Settings tab - auto-organize files, auto-fetch TMDB thumbnails, download history retention slider
  - Privacy/Advanced tab - YouTube cookies path for age-restricted content, clear search history toggle
  - Green "Save All Settings" button with success/error messaging
  - Storage visualization with colored progress bar (green/yellow/red)
  - Beautiful UI with lucide-react icons
- [x] **Integrated preferences with download workflow**
  - Downloads POST endpoint fetches user preferences
  - Uses preference defaults if not explicitly provided in request
  - Quality, folder, video format, audio format all use user defaults
  - Download worker respects per-user concurrent download limits
  - Tracks active downloads per user independently
  - Each user can have different concurrent limits (1-10)
- [x] **Fixed export issues** - Settings component export name
- [x] **Fixed storage endpoint** - Changed from `category` to `media_type` column

**Implementation Details:**
- Migration 009: user_preferences table with UNIQUE constraint on user_id
- Preferences router with requireAuth middleware
- Settings page with useState for tab management and preferences state
- Per-user concurrent tracking with Map<userId, Set<downloadId>>
- Preferences fetched on each download to ensure latest settings
- Storage endpoint calculates usage by media_type and shows percentage if limit set

**Files Created:**
- `apps/api/src/migrations/009_create_user_preferences.sql`
- `apps/api/src/routes/preferences.ts`
- `apps/web/src/pages/Settings.tsx` (completely rebuilt)
- `apps/web/src/pages/SettingsPresets.tsx` (old presets-only backup)

**Files Modified:**
- `apps/api/src/index.ts` - Added preferences router registration
- `apps/api/src/routes/downloads.ts` - Integrated user preferences as defaults
- `apps/api/src/workers/download.worker.ts` - Per-user concurrent download limits

**Next Session Start Point:**
→ Settings system complete! Future enhancements:
  - Per-platform download preferences (different settings for Movies, TV, YouTube, iPlayer, etc.)
  - BBC iPlayer quality options (currently HD only, need FHD/SD options)
  - Bandwidth limit enforcement in qBittorrent service
  - Browser notification implementation (UI ready, needs Notification API)
  - Auto-cleanup scheduler (currently manual only)

---

### Session: 2025-12-08 (Session 7) ✅ COMPLETED
**Focus:** BBC iPlayer Download Modal with Folder Selection
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Created BBC iPlayer download modal** with folder selection
  - BBCDownloadOptions component (apps/web/src/components/BBCDownloadOptions.tsx)
  - Defaults to 'iPlayer' folder with options for TV Shows, Movies, Documentaries, Music
  - TMDB metadata search toggle option
  - Simple, clean UI as requested by user
- [x] **Integrated modal into Browse page** (apps/web/src/pages/Browse.tsx)
  - Shows modal on download button click
  - Removed category dropdown from search form (now in modal)
  - Passes selected options to download submission
- [x] **Fixed duplicate key constraint error** (apps/api/src/workers/download.worker.ts)
  - Root cause: Re-downloading same file caused unique constraint violation on media.file_path
  - Solution: PostgreSQL native upsert with ON CONFLICT DO UPDATE
  - Uses raw SQL instead of TypeORM .orUpdate() (which caused entity metadata error)
  - Now updates existing media record instead of failing on re-downloads
- [x] **Fixed TypeORM entity metadata error**
  - Error: "Cannot get entity metadata for the given alias 'media'"
  - Root cause: .orUpdate() method not properly supported
  - Solution: Replaced with raw PostgreSQL INSERT...ON CONFLICT query
  - All fields update on conflict: download_id, user_id, title, description, file_size, duration, format, resolution, thumbnail, media_type, source, metadata

**Implementation Details:**
- Modal state management with useState for showDownloadModal and currentProgramme
- Modal handlers: handleDownload (shows modal), handleDownloadConfirm (submits), handleDownloadCancel (closes)
- Download submission includes category and searchTMDB options from modal
- Upsert SQL handles duplicate file_path by updating all fields with EXCLUDED values
- Timestamps: created_at preserved, updated_at refreshed on conflict

**Files Modified:**
- `apps/web/src/components/BBCDownloadOptions.tsx` - Added iplayer folder option as default
- `apps/web/src/pages/Browse.tsx` - Integrated modal, removed category dropdown
- `apps/api/src/workers/download.worker.ts` - PostgreSQL upsert for media table

**Commit:** 22b78dd - "Add BBC iPlayer download modal with folder selection"

**Next Session Start Point:**
→ All BBC iPlayer download features complete! Consider: Phase 3 browsing UX improvements, Phase 4 advanced automation, or Phase 5 production polish

---

### Session: 2025-12-07 (Session 6) ✅ COMPLETED
**Focus:** Scroll Position Persistence ("Continue Browsing" State)
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Implemented scroll position persistence** for all browse pages
  - Added sessionStorage-based state persistence
  - Saves scroll position (window.scrollY) with debouncing (200ms)
  - Saves browse state (movies/shows/docs, page, totalPages, totalResults, viewMode)
  - Restores state and scroll position on component mount
  - Prevents unnecessary API calls when restoring from cache
  - Implemented for Movies.tsx, TVShows.tsx, and Documentaries.tsx

**Implementation Details:**
- Added refs: `restoringScroll`, `scrollPositionSaved` to track restoration state
- Mount useEffect: Checks sessionStorage for saved state, restores if found
- Browse state useEffect: Saves state when movies/shows/docs change
- Scroll handler useEffect: Debounced scroll position saves
- Uses setTimeout(100ms) to restore scroll after content renders

**Files Modified:**
- `apps/web/src/pages/Movies.tsx` - Added scroll persistence logic
- `apps/web/src/pages/TVShows.tsx` - Added scroll persistence logic
- `apps/web/src/pages/Documentaries.tsx` - Added scroll persistence logic

**Next Session Start Point:**
→ Phase 3 remaining tasks: Quick filter sidebar, Make sort options more visible

---

### Session: 2025-12-07 (Session 5) ✅ COMPLETED
**Focus:** Jellyfin Plugin Installation
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Installed 4 Jellyfin plugins** via container filesystem access
  - Intro Skipper v1.10.11.9 - Auto-skip TV show intros
  - JellyScrub v2.1.0.0 - Video scrubbing with preview thumbnails
  - TheTVDB v20.0.0.0 - Enhanced TV show metadata with better descriptions/artwork
  - TMDb Box Sets v12.0.0.0 - Automatic movie collections/franchises
  - Located Jellyfin running in Docker container (PID 576)
  - Used nsenter to access container's /config/plugins directory
  - Downloaded plugins from GitHub releases
  - Copied DLL files and metadata to plugin directories
  - Restart deferred (someone actively watching content)

**Files Created:**
- Container: `/config/plugins/IntroSkipper/IntroSkipper.dll`
- Container: `/config/plugins/Jellyscrub/Jellyscrub.dll`
- Container: `/config/plugins/TheTVDB/Jellyfin.Plugin.Tvdb.dll`, `Tvdb.Sdk.dll`, `meta.json`
- Container: `/config/plugins/TMDbBoxSets/Jellyfin.Plugin.TMDbBoxSets.dll`, `meta.json`

**Next Steps:**
- Restart Jellyfin server when no one is watching
- Configure plugins via Jellyfin Dashboard → Plugins
- Test intro skipping on TV shows
- Test JellyScrub preview thumbnails

---

### Session: 2025-12-11 (Session 12) ✅ COMPLETED
**Focus:** Settings Simplification + Enhanced VPN Status Indicators
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Simplified Settings page dramatically**
  - Removed Download Preferences tab (redundant - set per-download)
  - Removed Bandwidth Controls tab (use qBittorrent Web UI)
  - Removed Notifications tab (contextual in app flow)
  - Removed Behavior Settings tab (always-on features)
  - Removed VPN Preferences section (automatic routing)
  - Final tabs: VPN, Jellyfin, Storage, Privacy (4 tabs total)
- [x] **Enhanced VPN status monitoring**
  - Added getLocalIP() method to VPN service
  - Added getEnhancedStatus() for comprehensive network info
  - Created /api/v1/vpn/enhanced-status endpoint
  - Returns: VPN IP, local IP, public IP, protection status, local network accessibility
- [x] **Improved VPN Status UI**
  - Visual indicators for VPN connection status
  - Shows Torrent IP with 🔒 Protected badge
  - Displays Local IP address
  - Green/yellow box for Local Network Access status
  - Protection summary cards (Torrent Protection + Jellyfin Access)
  - User-friendly info box explaining VPN + local network setup
- [x] **Configured Mullvad split tunneling solution**
  - Enabled "Local Network Sharing" in Mullvad settings
  - Verified torrents route through VPN (146.70.189.7)
  - Verified Jellyfin accessible on local network
  - Both work simultaneously - perfect setup!
- [x] **Updated UI messaging**
  - Changed technical jargon to user-friendly language
  - Concise info box: "VPN + Local Network: Torrents download privately through VPN, while Jellyfin stays accessible on your local network"
  - Simplified tab labels and section titles

**Files Modified:**
- apps/api/src/services/vpn.service.ts (added getLocalIP, getEnhancedStatus)
- apps/api/src/routes/vpn.ts (added /enhanced-status endpoint)
- apps/web/src/pages/Settings.tsx (massive simplification - removed 4 tabs, enhanced VPN UI)

**Commits:**
- 3d4e27f: Simplify Settings + Add Enhanced VPN Status

**Next Session Start Point:**
- Settings are ultra-clean and focused
- VPN status monitoring is comprehensive
- Ready for UX improvements or new features

---

### Session: 2025-12-11 (Session 11) ✅ COMPLETED
**Focus:** Startup System Hardening & Jellyfin Container Fix
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Fixed WSL DNS networking issues**
  - Configured static DNS (8.8.8.8, 1.1.1.1) in /etc/resolv.conf
  - Set Windows vEthernet adapter DNS properly
  - Locked resolv.conf with chattr +i to prevent WSL overwrites
  - Fixed WSL → internet connectivity after multiple wsl --shutdown cycles
- [x] **Configured passwordless sudo** for MediaVault services
  - Created /etc/sudoers.d/mediavault for PostgreSQL and Docker service commands
  - Eliminated password prompts from startup script
  - Startup now fully automated with zero user interaction
- [x] **Fixed Jellyfin Docker container**
  - Discovered old container had no name (couldn't be found by startup script)
  - Removed corrupted unnamed container
  - Created fresh Jellyfin container with proper configuration:
    - Named: `jellyfin`
    - Port: 8096:8096
    - Volumes: ~/downloads → /media, ~/jellyfin/config, ~/jellyfin/cache
    - Auto-restart: unless-stopped
  - Verified accessible at http://localhost:8096
- [x] **Updated startup scripts**
  - ~/start-mediavault.sh: Auto-starts PostgreSQL, Docker, Jellyfin, qBittorrent, MediaVault (API/Web/Worker)
  - ~/stop-mediavault.sh: Cleanly stops all services
  - ~/status-mediavault.sh: Shows real-time status of all services
  - All scripts run without password prompts
  - Fixed port numbers (Web UI: 5173, not 3000)
- [x] **Created worker .env file**
  - Added POSTGRES_HOST=localhost for database connection
  - Worker now connects to PostgreSQL via TCP instead of Unix sockets
- [x] **Verified full system startup**
  - All 7 services start successfully: PostgreSQL, Docker, Jellyfin, qBittorrent, API, Web, Worker
  - Total startup time: ~15 seconds
  - No errors or warnings
  - Dashboard "Open Jellyfin" button now works

**Files Modified:**
- ~/start-mediavault.sh (passwordless, added Docker/Jellyfin)
- ~/stop-mediavault.sh (updated messages)
- ~/status-mediavault.sh (fixed port numbers)
- ~/MEDIAVAULT-QUICKSTART.md (created quickstart guide)
- apps/worker/.env (created with database config)
- /etc/sudoers.d/mediavault (passwordless sudo)
- /etc/resolv.conf (static DNS)

**Commits:**
- fdf1d21: Add VPN integration and Claude Code commands

**Next Session Start Point:**
- System is fully operational and stable
- All services auto-start with single command
- Ready for feature development or UX improvements

---

### Session: 2025-12-07 (Session 4) ✅ COMPLETED
**Focus:** Infinite Scroll Implementation
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Fixed infinite scroll** on Movies, TV Shows, and Documentaries pages
  - Root cause: Backend parameter parsing bug (min_votes=0 treated as falsy)
  - Fixed backend: Changed to explicit undefined checks in tmdb.ts
  - Root cause: Duplicate useInfiniteScroll calls causing listener conflicts
  - Fixed frontend: Consolidated to single hook per page with conditional logic
  - Root cause: Container scroll instead of window scroll
  - Fixed layout: Changed from overflow-y-auto to window scroll
  - Made sidebar fixed, removed overflow constraint from main
  - Performance: Reduced scroll batch from 20 pages (400 items) to 3 pages (60 items)
  - Performance: Reduced initial load from 50 pages (1000 items) to 10 pages (200 items)
  - UX: Fixed loading indicators to show during infinite scroll
  - Cleanup: Removed all debugging console logs
  - Commits: 6409652

**Files Modified:**
- Backend: `apps/api/src/routes/tmdb.ts` (parameter parsing fix)
- Frontend: `apps/web/src/hooks/useInfiniteScroll.ts` (consolidated hook)
- Frontend: `apps/web/src/pages/Movies.tsx`, `TVShows.tsx`, `Documentaries.tsx` (single hook, batch sizes)
- Layout: `apps/web/src/components/layout/Layout.tsx` (window scroll, fixed sidebar)

---

### Session: 2025-12-07 (Session 3) ✅ COMPLETED
**Focus:** Bug Fixes + Quality/Format Selection Feature
**Status:** ✅ COMPLETED
**Completed:**
- [x] **Fixed decimal duration bug** - SoundCloud downloads failing with "invalid input syntax for type integer"
  - Added Math.floor() to round decimal duration values from yt-dlp
  - Migration 008 not needed (code fix only)
  - Commit: ec6c76e
- [x] **Fixed folder selection bug** - Music folder showing as Movies in preview
  - Updated DownloadFormatPreview to accept category/customFolder props
  - Backend format-preview endpoint respects user's category selection
  - Handles music, documentaries, custom folder, collection categories
  - Commit: 1992b5c
- [x] **Implemented Quality/Format Selection** - Major feature addition
  - Database Migration 008: Added quality, video_format, audio_format columns
  - Enhanced yt-dlp service with 2160p, 1440p, 1080p, 720p, 480p, 360p, audio options
  - Added video format support: MP4, WebM, MKV
  - Added audio format support: MP3, M4A, AAC, Opus, FLAC
  - Auto-route to audio extraction when quality='audio'
  - Frontend UI with quality and format dropdowns
  - Backend endpoint accepts and stores quality/format preferences
  - Worker passes settings to yt-dlp service
  - Commit: 2b4f8e4
- [x] **UX Improvement: Smart Music Category**
  - Music category auto-selects Audio Only quality
  - Hides video quality options when Music selected
  - Only shows audio format dropdown for Music
  - Category labeled "Music (Audio Only)" for clarity
  - Prevents users from downloading videos to Music folder
  - Commit: 4408baf

**Problem Solved:**
YouTube music videos download as MP4, but Jellyfin Music library expects audio formats. Users can now select "Music (Audio Only)" category and choose MP3/M4A/FLAC format for perfect Jellyfin Music integration.

**Key Implementation:**
- Migration 008 adds quality/format columns to downloads table
- yt-dlp service expanded with comprehensive quality/format options
- Download pipeline passes user preferences from UI → endpoint → worker → yt-dlp
- Smart UI prevents confusion (Music = audio only, no video options shown)

**Test Case:**
Ocean Wisdom - Ting Dun Feat. Method Man:
- Before: MP4 video in Music folder, Jellyfin ignores it ❌
- After: MP3 audio in Music folder, Jellyfin finds it ✅

**Next Session Start Point:**
→ All core download features complete! Consider: Phase 3 browsing UX, Phase 4 advanced automation, or Phase 5 production polish

---

### Session: 2025-12-07 (Session 2) ✅ COMPLETED
**Focus:** Download Source Testing → Phase 2, 4, 5 Implementation
**Status:** ✅ COMPLETED
**Completed:**
- [x] Tested YouTube downloads via worker - ✅ Working
- [x] Investigated BBC iPlayer timeout issue - get_iplayer works, just slow (5min for 600MB)
- [x] Investigated SoundCloud download failure - yt-dlp works fine with SoundCloud
- [x] Validated all download sources work correctly
- [x] Documented performance characteristics of each downloader
- [x] **Phase 2: Torrent Management System**
  - [x] Added pause/resume/delete API endpoints
  - [x] Enhanced Downloads page with real-time torrent stats (speed, ETA, seeds/peers, ratio)
  - [x] Implemented torrent control buttons (Pause/Resume/Remove/Delete All)
  - [x] Added bandwidth control API (set/get download/upload limits)
  - [x] Created utility formatters (formatSpeed, formatETA, formatBytes)
- [x] **Phase 4: Concurrent Downloads**
  - [x] Modified download worker to support 3 simultaneous downloads
  - [x] Implemented Set-based active download tracking
  - [x] Smart queue processing with available slot calculation
- [x] **Phase 5: Retry Logic**
  - [x] Added exponential backoff (10s, 20s, 40s delays)
  - [x] Maximum 3 retry attempts per download
  - [x] Enhanced error messages showing retry status
  - [x] Metadata tracking (retryCount, lastError, nextRetryAt)
- [x] Pushed all changes to GitHub (commit e75684e)

**Test Results:**
- ✅ **YouTube**: 889KB video downloaded in ~10s, auto-organized to Movies folder
- ✅ **BBC iPlayer TV**: 600MB programme downloaded in ~5min (slow but works)
- ✅ **SoundCloud**: 2.28MB track downloaded in 28s via yt-dlp

**Features Implemented:**
1. **Torrent Management UI** (downloads.ts:src/routes):
   - POST /downloads/:id/pause - Pause torrents
   - POST /downloads/:id/resume - Resume paused torrents
   - DELETE /downloads/:id?deleteFiles=true/false - Delete with file options
   - Enhanced GET /downloads - Real-time torrent stats enrichment

2. **Bandwidth Controls** (qbittorrent.service.ts):
   - POST /downloads/bandwidth/limits - Set global download/upload limits
   - GET /downloads/bandwidth/info - Get transfer info and current limits

3. **Concurrent Processing** (download.worker.ts):
   - maxConcurrentDownloads = 3 (configurable)
   - Set-based tracking prevents duplicate processing
   - Automatic queue refill as slots become available

4. **Retry System** (download.worker.ts):
   - Exponential backoff: 2^n * 10 seconds (10s, 20s, 40s)
   - Metadata tracking for debugging
   - User-friendly error messages with retry counts

5. **Frontend Enhancements** (Downloads.tsx):
   - Real-time torrent stats display (speeds, ETA, seeds/peers, ratio)
   - Torrent-specific control buttons (Pause/Resume/Remove/Delete All)
   - Utility formatters for human-readable display

**User Decisions:**
- Skipped "Unified search across all platforms" - not needed currently

**Next Session Start Point:**
→ All major phases complete! Consider: Phase 3 remaining tasks, Phase 4 advanced features, or Phase 5 production polish

---

### Session: 2025-12-07 (Session 1) ✅
**Focus:** Phase 1 - Bug Fixes & Core Stabilization
**Status:** ✅ COMPLETED
**Completed:**
- [x] Consolidated README.md and PROJECT_STATUS.md
- [x] Added missing migration 006 to documentation
- [x] Updated QUICKSTART.md with all migrations
- [x] Performed comprehensive codebase analysis
- [x] Identified critical database bug (qBittorrent constraint)
- [x] Created development roadmap
- [x] **Created migration 007** - Fixed qBittorrent database constraint
- [x] **Implemented qBittorrent progress sync** - Real-time torrent progress to database
- [x] **Added TMDB thumbnail integration** - Auto-fetch posters for torrents
- [x] **Fixed torrent completion detection** - All qBittorrent states detected
- [x] **Fixed file path resolution** - Using content_path from qBittorrent
- [x] **Fixed TMDB year extraction** - Extract year before cleaning title
- [x] **Enhanced title cleaning** - Preserve important parts (Part II, SVU)
- [x] **Added TV show detection** - Smart detection for series content
- [x] **Added special handling** - Law & Order SVU and other edge cases
- [x] **Optimized thumbnail size** - Reduced from w500 to w200
- [x] **Fixed frontend display** - Proper aspect ratio (2:3) for movie posters
- [x] **Backfilled all thumbnails** - 4/4 existing torrents have TMDB posters
- [x] Tested end-to-end torrent workflow

**Features Added:**
1. **Migration 007**: Added 'qbittorrent' to valid downloader types
2. **Torrent Progress Sync**: Background polling loop (every 10s) that:
   - Matches torrents by hash extraction from magnet links
   - Updates progress in real-time (0-100%)
   - Detects all completion states (stalledUP, pausedUP, uploading, etc.)
   - Creates media entries automatically
   - Triggers Jellyfin library scans
   - Prevents duplicate processing
3. **TMDB Thumbnail Auto-Fetch**: Intelligent title parsing that:
   - Extracts year BEFORE cleaning (fixed critical bug)
   - Cleans torrent names (removes quality, release groups, file sizes)
   - Detects TV shows vs movies automatically
   - Searches TMDB with fallback (movie → TV or TV → movie)
   - Special handling for common shows (Law & Order SVU)
   - Returns w200 images for optimal UI performance
   - 100% success rate on test dataset (4/4 torrents)
4. **Frontend UI Improvements**:
   - Grid view: aspect-[2/3] portrait ratio for movie posters
   - Table view: w-12 h-18 portrait thumbnails
   - object-contain to show full image without cropping
   - Proper background for transparency

**Test Results:**
- ✅ The Shawshank Redemption (1994) - Downloaded, completed, thumbnail fetched
- ✅ The Godfather (1972) - Downloaded, completed, thumbnail fetched
- ✅ The Godfather Part II (1974) - Downloaded, completed, thumbnail fetched
- ✅ Law & Order SVU - Downloaded, completed, thumbnail fetched

**Issues Fixed:**
1. Database constraint missing 'qbittorrent'
2. Completion detection only checking 2 states (now checks 6)
3. File path using save_path + name instead of content_path
4. Year extraction happening after removing parentheses
5. Title cleaning too aggressive (losing important parts)
6. No TV show detection
7. Thumbnail size too large (w500 → w200)
8. Frontend using landscape aspect ratio for portrait posters
9. Frontend cropping images with object-cover

**Next Session Start Point:**
→ Phase 1 Complete! Ready for Phase 2 (Torrent System Enhancement) or Phase 3 (Content Discovery)

**Notes:**
- **Phase 1 COMPLETE**: All critical bugs fixed, torrent system fully operational
- TMDB integration working perfectly with 100% success rate
- Frontend displays thumbnails beautifully in proper aspect ratio
- All services running successfully in tmux
- System ready for production use

---

### Session History

#### Session: 2025-12-06
**Focus:** Jellyfin auto-formatting inline preview
**Status:** ✅ COMPLETED
**Key Changes:**
- Implemented inline format preview in download modals
- Real-time TMDB metadata enrichment
- Streamlined UX with single modal flow
- Added Dashboard quick access buttons

#### Session: 2025-12-03
**Focus:** qBittorrent torrent integration
**Status:** ⚠️ PARTIAL (database bug discovered later)
**Key Changes:**
- Installed qBittorrent-nox v4.6.3
- Created qBittorrent service with Web API integration
- Added torrent site buttons to Movies/TV/Documentaries
- Automatic magnet link detection
- **BUG:** Database constraint missing 'qbittorrent' (not discovered until 2025-12-07)

#### Session: 2025-11-23
**Focus:** SoundCloud browse improvements
**Status:** ✅ COMPLETED
**Key Changes:**
- Fixed blurry thumbnails (500x500 high-quality)
- Search-based browsing (more reliable)
- "Load All" button functionality
- Artist profile extraction with track counting

---

## 📝 SESSION TEMPLATE (Copy for next session)

```markdown
### Session: YYYY-MM-DD
**Focus:** [What you're working on]
**Status:** 🚧 IN PROGRESS / ✅ COMPLETED / ⚠️ PARTIAL
**Started At:** [Current phase and task]
**Completed:**
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

**Issues Encountered:**
- Issue description and resolution

**Next Session Start Point:**
→ [Exact task/file to start with]

**Notes:**
- Any important learnings or decisions
```

---

## 🎯 QUICK START FOR NEXT SESSION

### If starting fresh:
1. Read "📊 PROJECT STATE SNAPSHOT" for context
2. Check "🔥 CRITICAL BUGS" - start here if not fixed
3. Find "Current Session" in "🔄 SESSION STATE TRACKER"
4. Start with "Next Session Start Point"

### If resuming work:
1. Update current session with progress
2. Mark completed tasks with [x]
3. Document any issues encountered
4. Set "Next Session Start Point" before ending

---

## 🚀 IMMEDIATE ACTION ITEMS (Priority Tasks for Next Session)

Based on Settings system completion and identified gaps:

### High Priority

1. **Automatic Torrent Search** (Torrent Sites Integration) ✅ COMPLETED (Session 10)
   - ✅ Implemented automatic torrent search using torrent-search-api library
   - ✅ Created backend service and API endpoint (/api/v1/torrents/search)
   - ✅ Auto-search button in Movies, TV Shows, Documentaries download modals
   - ✅ Returns 25 results from ThePirateBay sorted by seeds
   - ✅ One-click magnet link selection to queue downloads
   - ✅ Quality extraction from torrent titles (4K, 1080p, 720p, etc.)
   - ✅ Removed duplicate PirateBay manual search button
   - Note: Only ThePirateBay provider works reliably (SSL/connection issues with 1337x, YTS, etc.)
   - Benefit: Users can find and queue torrents without leaving MediaVault!

2. **TMDB/IMDb List Integration** (Enhanced Content Discovery)
   - Add curated list browsing from TMDB and IMDb
   - Lists to support:
     - IMDb Top 250 Movies
     - IMDb Top 100 TV Shows
     - TMDB Popular (daily/weekly trending)
     - TMDB Top Rated Movies/TV
     - TMDB Now Playing (in theaters)
     - TMDB Upcoming releases
     - Genre-specific top lists (Top Action, Top Comedy, etc.)
     - Decade-based lists (Best of 1990s, 2000s, etc.)
     - Custom user-created lists (via TMDB list URLs)
   - UI: New "Browse Lists" page or dropdown in Movies/TV sections
   - Features: Sort by rating, year, popularity; Filter by genre/decade
   - One-click download from any list
   - Save favorite lists for quick access
   - Benefits: Discover highly-rated content without manual searching

3. **Per-Platform Download Preferences** (Settings Enhancement)
   - Extend Settings system to allow platform-specific preferences
   - Each platform (Movies, TV Shows, Documentaries, YouTube, iPlayer, SoundCloud, etc.) gets own settings tab
   - Override global defaults with platform-specific quality, format, folder preferences
   - UI: Sub-tabs or accordion in Settings → Download Preferences
   - Database: Expand user_preferences with JSON columns for per-platform overrides
   - Integration: Download workflow checks platform-specific settings first, falls back to global
   - Benefits: Users can set "Movies = 4K MKV" and "YouTube = 1080p MP4" independently

### Medium Priority

4. **Browser Notification Implementation**
   - Settings UI exists, need to wire up Notification API
   - Request permission on first enable
   - Send notifications on download complete/failed based on preferences
   - Include notification sound if user enabled it

5. **Auto-Cleanup Scheduler**
   - Currently manual-only via "Run Cleanup Now" button
   - Implement cron-like scheduler for automatic cleanup
   - Run daily/weekly based on auto_cleanup_enabled and auto_cleanup_days settings

### Lower Priority (Phase 3 Remaining)

6. **Quick filter sidebar** - Genre pills, year slider, rating filter
7. **Make sort options more visible** - Move sort dropdown to prominent position
8. **Content Discovery Features** - Recommended/trending/popular aggregated views

---

## 🎨 UX ENHANCEMENT IDEAS

### Quick Wins (Immediate Impact)

#### 1. **Toast Notifications Instead of Alerts** ⭐ TOP PICK
   - Replace `alert()` popups with elegant toast notifications
   - Non-intrusive, auto-dismiss after 3-5 seconds
   - Stack multiple notifications in corner
   - Show success/error/info with icons and colors
   - Libraries: react-hot-toast, sonner, react-toastify

#### 2. **Drag & Drop URL/Magnet Support** ⭐ TOP PICK
   - Drop URLs/magnet links anywhere on the page to start download
   - Visual drop zone appears when dragging
   - No need to find the download button
   - Modern, intuitive UX

#### 3. **Download Progress in Browser Tab**
   - Show active download count in favicon/title
   - "MediaVault (3 downloading)" in tab title
   - Quick glance without switching tabs
   - Use browser Favicon API

#### 4. **Keyboard Shortcuts** ⭐ TOP PICK
   - `/` - Focus search
   - `d` - Quick download (paste URL modal)
   - `Ctrl+K` - Command palette
   - `Escape` - Close modals
   - Arrow keys for grid navigation
   - Show keyboard shortcuts help with `?` key

#### 5. **Recently Downloaded Section**
   - Quick access to last 10 downloads on dashboard
   - Click to play/open file location
   - Show thumbnail grid
   - "Open in Jellyfin" link if configured

---

### Search & Discovery

#### 6. **Search Suggestions/Autocomplete**
   - Show popular searches as you type
   - Recent searches dropdown
   - Trending content suggestions
   - "Did you mean..." for typos

#### 7. **Advanced Filters Panel** ⭐ TOP PICK
   - Slide-out filter sidebar instead of dropdowns
   - Multiple genre selection (chips)
   - Year range slider (1990-2024)
   - Rating filter (★★★★+ only)
   - Runtime filter (< 90min, 90-120min, 2h+, etc.)
   - Apply filters without page reload
   - Save filter presets

#### 8. **Continue Where You Left Off**
   - Remember scroll position per page ✅ PARTIALLY DONE
   - "Resume browsing" when returning to Movies/TV
   - Restore filters and search terms
   - Per-user browsing state

#### 9. **Related Content / "More Like This"**
   - Show similar movies/shows based on what you're viewing
   - "If you liked X, you might like Y"
   - Based on genre, director, actors
   - TMDB recommendations API integration

---

### Downloads Page Improvements

#### 10. **Download Queue Reordering**
   - Drag & drop to reorder pending downloads
   - Move to top/bottom buttons
   - Priority levels (high/normal/low)
   - Visual position indicator

#### 11. **Batch Operations** ⭐ TOP PICK
   - Select multiple downloads (checkboxes)
   - Bulk actions: Delete, Retry, Move to folder, Cancel
   - "Select all pending" / "Select all failed"
   - Keyboard: Shift+Click for range selection

#### 12. **Smart Download Grouping**
   - Group by date (Today, Yesterday, This Week, This Month)
   - Group by status (Active, Pending, Completed, Failed)
   - Group by category (Movies, TV, Music, etc.)
   - Collapsible sections
   - Show count per group (e.g., "Completed (42)")

#### 13. **Download ETA Improvements**
   - Show "Starting in 2 minutes" for queued items
   - Visual queue position indicator
   - "Expected completion: 3:45 PM"
   - Estimated disk space needed
   - Speed graph for active downloads

---

### Grid/Browse Experience

#### 14. **Hover Previews**
   - Enlarge thumbnail on hover
   - Show quick info overlay (rating, year, runtime)
   - Quick action buttons (Download, Info, Watch Trailer)
   - Smooth transitions

#### 15. **Multiple View Modes**
   - Grid view (current) - Large thumbnails
   - List view (compact) - More info visible, smaller thumbnails
   - Table view (data-focused) - Sortable columns
   - User preference saved per page
   - Toggle buttons in header

#### 16. **Infinite Scroll Loading Improvements**
   - Skeleton cards while loading ✅ PARTIALLY DONE
   - "Loading 20 more..." at bottom
   - Smooth fade-in for new items
   - "Back to top" button when scrolled far

#### 17. **Quick Info Modal**
   - Click poster → Quick info popup (not full page navigation)
   - Show plot, cast, trailer embed, rating
   - Download button right in modal
   - Arrow keys to navigate next/previous in grid
   - Close with Escape or click outside

---

### Settings & Preferences

#### 18. **Settings Quick Toggle**
   - Show current settings in header/sidebar
   - Quick toggles without going to Settings page
   - "Download quality: HD ▼" dropdown in header
   - "Bandwidth: 5 MB/s ▼" quick adjust

#### 19. **Download Templates/Presets** (Enhancement)
   - Already have presets! But make them more visible
   - Quick preset selector in download modal
   - "Use Movie preset" / "Use YouTube preset" buttons
   - Preset indicators in grid ("Will use: HD preset")

#### 20. **Dark Mode**
   - Toggle in header
   - Saved per user preference
   - Automatic (follow system theme)
   - Smooth transition animation

---

### Feedback & Status

#### 21. **Better Error Messages**
   - Show why download failed with helpful tips
   - "Video unavailable - Try using cookies for age-restricted content [How?]"
   - Link to troubleshooting docs
   - Retry button right in error message
   - Copy error details button

#### 22. **Loading States Everywhere**
   - Skeleton screens instead of blank white pages
   - Progress bars for slow operations
   - "Searching 9000 programmes..." instead of generic spinner
   - Meaningful loading messages

#### 23. **Download Complete Celebrations**
   - Confetti animation for first download 🎉
   - Success sound (optional, from settings)
   - "Open file location" button in notification
   - Share achievement (optional)

---

### Mobile/Responsive

#### 24. **Bottom Sheet Modals on Mobile**
   - Slide up from bottom instead of center popup
   - Native mobile feel
   - Easier to reach with thumb
   - Swipe down to dismiss

#### 25. **Swipe Gestures**
   - Swipe to delete download (with undo)
   - Swipe between pages/tabs
   - Pull to refresh browse pages
   - Mobile-first interactions

---

### Smart Features

#### 26. **Smart Quality Selection**
   - Auto-select quality based on file size preferences
   - "You're running low on space, recommend SD?"
   - Learn from user's past choices
   - Suggest quality based on content type

#### 27. **Download Size Estimator**
   - Show estimated file size BEFORE downloading
   - "~1.2 GB for HD, ~3.5 GB for FHD" in quality dropdown
   - Warn if low disk space detected
   - Show remaining space after download

#### 28. **Duplicate Detection**
   - "You already downloaded this on Dec 5th"
   - Option to re-download or skip
   - Show existing file location
   - "Open existing file" button

#### 29. **Batch URL Paste** ⭐ TOP PICK
   - Paste 10+ URLs at once (one per line)
   - Queue them all simultaneously
   - Perfect for binge downloading entire series
   - Show preview: "Found 12 URLs, queue all?"

#### 30. **Smart Folder Suggestions**
   - Auto-suggest folder based on content type detected
   - "This looks like a documentary - save to Documentaries?"
   - Learn from user corrections
   - Confidence indicator

---

## ⭐ TOP 5 RECOMMENDATIONS (Best ROI)

Priority order for maximum UX improvement with reasonable effort:

1. **Toast Notifications** - Replace alerts, instantly feels more polished and modern
2. **Batch Operations** - Delete/retry multiple downloads at once, huge time saver
3. **Smart Download Grouping** - Much easier to scan and manage Downloads page
4. **Drag & Drop URLs** - Super convenient, modern feel, delightful interaction
5. **Keyboard Shortcuts** - Power users will love it, accessibility win

These 5 would transform the UX significantly without requiring massive architectural changes.

---

## 📚 REFERENCE

### Key Files
- `/apps/api/src/migrations/` - Database migrations
- `/apps/api/src/services/qbittorrent.service.ts` - qBittorrent API client
- `/apps/api/src/workers/download.worker.ts` - Background download processor
- `/apps/api/src/routes/downloads.ts` - Download API endpoints
- `/apps/web/src/pages/` - Frontend pages

### Commands
```bash
# Start all services
~/start-mediavault.sh

# View logs
tmux attach -t mediavault
tmux attach -t qbittorrent

# Database access
PGPASSWORD=mediavault123 psql -h localhost -U mediavault -d mediavault

# Run migration
cd apps/api
psql mediavault < src/migrations/007_xxx.sql

# Check downloads
SELECT id, title, status, downloader, progress FROM downloads ORDER BY created_at DESC LIMIT 10;
```

### Service URLs
- Web UI: http://localhost:5173
- API: http://localhost:3001
- qBittorrent: http://localhost:8080 (no login required from localhost)
- Jellyfin: http://localhost:8096

---

**Remember:** Update this file after every session with progress and next steps!
