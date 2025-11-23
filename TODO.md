# MediaVault TODO

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

### Media Server Integration
- [ ] Jellyfin integration setup
- [ ] Automatic media library scanning
- [ ] Metadata synchronization

### Future Features
- [ ] User preferences/settings page
- [ ] Download history and analytics
- [ ] Playlist creation and management
- [ ] Scheduled downloads
- [ ] Quality presets per platform

---

**Last Updated:** 2025-11-23
**Current Focus:** SoundCloud browse functionality parity with YouTube
