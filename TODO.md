# MediaVault TODO

## Completed (Session: 2025-12-06)

### Jellyfin Auto-Formatting - Inline Preview UI
- [x] Implemented inline format preview in download modals (TV Shows, Movies, Documentaries)
- [x] Removed redundant category selection after format preview
- [x] Added loading states with spinner during filename analysis
- [x] Integrated error handling with retry functionality
- [x] Real-time TMDB metadata fetching for accurate show/movie names
- [x] Jellyfin-compatible path preview with folder structure visualization
- [x] Updated YouTube page with inline format preview
- [x] Added Dashboard quick access buttons for Jellyfin and qBittorrent
- [x] Streamlined UX - single modal flow without popup switching

### Technical Changes
- Modified `/apps/web/src/pages/TVShows.tsx` - Inline format preview integration
- Modified `/apps/web/src/pages/Movies.tsx` - Inline format preview integration
- Modified `/apps/web/src/pages/Documentaries.tsx` - Inline format preview integration
- Modified `/apps/web/src/pages/YouTube.tsx` - Format preview for YouTube downloads
- Modified `/apps/web/src/pages/Dashboard.tsx` - Added qBittorrent and Jellyfin quick links
- Removed separate DownloadFormatPreview modal - now fully inline
- Cleaned up unused state variables (selectedCategory, selectedCustomFolder, showFolderSelection)

### UI/UX Improvements
- Format preview appears in same modal after clicking "Queue Download"
- Shows loading spinner with "Analyzing filename and fetching metadata..." message
- Displays content type badge (TV Show / Movie / Documentary)
- Shows original filename and formatted Jellyfin path side-by-side
- Metadata grid with show/movie name, year, season, episode info
- Single "Confirm Download" button with Cancel option
- Error states with retry button for failed preview loads

## Completed (Session: 2025-12-03)

### Torrent Integration - qBittorrent
- [x] Replaced Goojara with curated torrent site buttons (1337x, PirateBay, Ext.to)
- [x] Installed qBittorrent-nox v4.6.3 headless client
- [x] Configured qBittorrent Web UI on port 8080 (credentials: admin/adminadmin)
- [x] Created comprehensive qBittorrent service (`/apps/api/src/services/qbittorrent.service.ts`)
  - Login/authentication with Web API
  - Add torrents via magnet links or .torrent URLs
  - Get torrent list with progress tracking
  - Pause/resume/delete torrent management
  - Category and save path configuration
- [x] Updated downloads route to detect and handle magnet links/torrents automatically
- [x] Fixed database constraint to allow 'qbittorrent' as valid downloader type
- [x] Implemented automatic torrent detection (magnet: prefix or .torrent extension)
- [x] Added immediate torrent submission to qBittorrent on download creation
- [x] Updated Movies.tsx with 3-column grid layout and color-coded torrent buttons
- [x] Updated TVShows.tsx with same torrent site integration
- [x] Updated Documentaries.tsx with same torrent site integration
- [x] Successfully tested end-to-end torrent workflow

### Technical Changes
- Modified `/apps/api/src/routes/downloads.ts` - Added torrent detection and qBittorrent integration
- Created `/apps/api/src/services/qbittorrent.service.ts` - Full qBittorrent Web API client
- Updated `/apps/web/src/pages/Movies.tsx` - 5 torrent sites with 3-column layout
- Updated `/apps/web/src/pages/TVShows.tsx` - Same torrent site updates
- Updated `/apps/web/src/pages/Documentaries.tsx` - Same torrent site updates
- Modified database schema - Added 'qbittorrent' to downloads.downloader constraint
- Configured `/home/beerm/.config/qBittorrent/qBittorrent.conf` - Downloads to `/home/beerm/media-vault/downloads/torrents`

### System Services
- qBittorrent Web UI: http://localhost:8080 (admin/adminadmin)
- MediaVault API: http://localhost:3001
- MediaVault Web: http://localhost:5173
- Jellyfin: http://localhost:8096

## Completed (Session: 2025-11-23)

### SoundCloud Browse Improvements
- [x] Fixed blurry thumbnails - upgraded to high-quality 500x500 variants
- [x] Implemented uniform 2-line title spacing for consistent grid layout
- [x] Switched from URL extraction to search-based browsing (more reliable)
- [x] Added "Load All" button to match YouTube browse functionality
- [x] Removed artificial 100-result backend cap in search API
- [x] Discovered SoundCloud/yt-dlp has hard 300-result search limit
- [x] Implemented artist profile extraction from track URLs
- [x] Added track count fetching and auto-bookmark updates
- [x] Fixed square aspect ratio for SoundCloud thumbnails in Favorites
- [x] Added state persistence via sessionStorage
- [x] Disabled bookmark button while counting tracks

### Technical Changes
- Modified `/apps/api/src/routes/search.ts` - removed Math.min(limit, 100) cap
- Updated `/apps/web/src/pages/SoundCloud.tsx` - complete rewrite with search-based approach
- Updated `/apps/web/src/pages/Favorites.tsx` - square thumbnails for SoundCloud
- Added backup file: `/apps/web/src/pages/SoundCloud-BACKUP.tsx`

## Pending / Future Work

### **PRIORITY: Enhanced Content Discovery & Search**
- [ ] **Improved Search/Filtering Across Platforms**
  - Unified search bar that searches across Movies, TV Shows, Documentaries simultaneously
  - Advanced filters accessible from search results (genre, year, rating, etc.)
  - Search history and suggestions
  - "Similar to this" recommendations based on selected content
- [ ] **Better Content Browsing**
  - Infinite scroll instead of pagination
  - "Continue browsing" state persistence
  - Quick filters sidebar (genre pills, year slider, rating filter)
  - Sort options more visible (trending, top rated, newest, etc.)
- [ ] **Content Discovery Features**
  - "Recommended for you" section based on download history
  - "Trending now" across all platforms in one place
  - "Popular this week/month" aggregated view
  - Genre-based carousels (like Netflix)
- [ ] **Search Performance Optimization**
  - Cache TMDB search results
  - Debounce search input
  - Pre-fetch popular content

### **COMPLETED: Jellyfin Integration**
- [x] Configure Jellyfin to access MediaVault downloads
- [x] Test that completed torrents appear in Jellyfin automatically
- [x] Set up automatic library scan on download completion
- [x] Jellyfin auto-formatting with inline preview

### Torrent System Enhancements
- [ ] **Sync qBittorrent progress to MediaVault database**
  - Currently torrents are tracked in qBittorrent but progress not synced to downloads table
  - Create background worker to poll qBittorrent API and update download status/progress
- [ ] **Handle torrent completion**
  - Update download status to 'completed' when torrent finishes
  - Optional: Move from temp folder to final destination
  - Optional: Stop seeding after X hours or ratio reached
- [ ] **Add qBittorrent systemd service** for auto-start on boot
- [ ] **Frontend UI for torrent management**
  - Show download speed, upload speed, ETA from qBittorrent
  - Pause/resume torrents from MediaVault UI
  - Delete torrents with option to keep/remove files
- [ ] **Download speed limits and bandwidth controls**
- [ ] **Seeding management** - Configure when to stop seeding

### Worker Service Improvements
- [ ] **Fix worker environment variables** - Worker needs POSTGRES_HOST, etc. for database connection
- [ ] Add proper error handling for failed downloads
- [ ] Implement download retry logic with exponential backoff

### SoundCloud Enhancements
- [ ] Investigate workaround for 300-result search limit
  - Option 1: Direct artist profile URL extraction (bypasses search API)
  - Option 2: Multiple search queries with different filters
  - Option 3: Accept 300 as reasonable limit (most use cases covered)
- [ ] Test with various SoundCloud artists to ensure reliability
- [ ] Add error handling for artists with no public tracks

### General Improvements
- [ ] Add loading states and progress indicators throughout app
- [ ] Implement proper error boundaries for React components
- [ ] Add retry logic for failed API calls
- [ ] Optimize thumbnail loading (lazy loading, placeholder images)
- [ ] Duplicate detection before adding torrents (check if already downloaded)

### Future Features
- [ ] User preferences/settings page
- [ ] Download history and analytics
- [ ] Playlist creation and management
- [ ] Scheduled downloads
- [ ] Quality presets per platform

---

## Session Notes (2025-12-03)

### What We Accomplished
Successfully integrated full torrent download support into MediaVault:
1. Browse movies/TV/docs and click torrent site buttons (1337x, PirateBay, Ext.to)
2. Copy magnet links from torrent sites
3. Paste into MediaVault download field
4. Torrents automatically detected and sent to qBittorrent
5. Downloads tracked in database and accessible via qBittorrent Web UI

### Technical Implementation
- Created qBittorrent service with full Web API integration
- Added automatic magnet link detection in downloads route
- Updated database schema to support 'qbittorrent' downloader
- Implemented 3-button torrent search UI across all media pages
- Successfully tested end-to-end workflow

### Known Issues to Address
1. **Jellyfin path configuration** - Need to add MediaVault downloads folder to Jellyfin library
2. **Progress tracking sync** - qBittorrent progress not syncing to MediaVault database
3. **Worker environment** - Background worker missing database credentials

### Quick Reference
```bash
# Start qBittorrent Web UI
qbittorrent-nox --webui-port=8080 &

# Start MediaVault servers
cd /home/beerm/media-vault/apps/api && npm run dev &
cd /home/beerm/media-vault/apps/web && npm run dev &

# Database access
PGPASSWORD=mediavault123 psql -h localhost -U mediavault -d mediavault
```

---

**Last Updated:** 2025-12-03
**Current Focus:** Torrent integration complete - **NEXT: Jellyfin path configuration**
