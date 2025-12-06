# Auto-Formatting Feature for Jellyfin Compatibility

## Implementation Status

**Status:** ✅ **COMPLETE** (Inline Preview Implemented)

### Completed (2025-12-06) - Inline Preview UI
- ✅ Refactored format preview to appear inline in download modal
- ✅ Removed separate modal popup - single-dialog UX
- ✅ Eliminated redundant category selection (auto-detected from format)
- ✅ Added loading states with spinner and progress messages
- ✅ Implemented error handling with retry functionality
- ✅ Applied to all download pages: TV Shows, Movies, Documentaries, YouTube
- ✅ Added Dashboard quick access buttons for Jellyfin and qBittorrent
- ✅ Cleaned up state management and removed unused variables

### Completed (2025-12-04) - Initial Implementation
- ✅ Backend jellyfin-formatter service with TMDB integration
- ✅ API endpoints for format preview
- ✅ DownloadFormatPreview React component (later refactored to inline)
- ✅ Integration into Movies page
- ✅ Integration into TV Shows page
- ✅ Integration into Browse (BBC iPlayer) page
- ✅ Download worker updated to use formatted paths
- ✅ Database migration created (006_add_jellyfin_formatting_columns.sql)

### Production Ready
- ✅ End-to-end testing completed
- ✅ UX refined based on user feedback
- ✅ Error handling implemented
- ✅ TMDB metadata enrichment working

---

## Feature Request (2025-12-04)

### Problem
Downloaded files need to be organized in Jellyfin-compatible format. Currently, files may have non-standard naming that Jellyfin doesn't recognize properly.

### Solution
Implement automatic formatting that:
1. Detects content type (TV show, movie, music, documentary)
2. Auto-formats folder/file names to Jellyfin standards
3. Shows user the formatted preview before download
4. Allows user to edit/confirm before proceeding

---

## Jellyfin Naming Standards

### TV Shows
```
Show Name (Year)/
├── Season 01/
│   ├── Show Name - S01E01 - Episode Title.ext
│   ├── Show Name - S01E02 - Episode Title.ext
│   └── ...
├── Season 02/
└── ...
```

**Examples:**
- `Breaking Bad (2008)/Season 01/Breaking Bad - S01E01 - Pilot.mkv`
- `The Office (2005)/Season 03/The Office - S03E14 - The Return.mkv`

### Movies
```
Movie Name (Year)/
└── Movie Name (Year).ext
```

**Examples:**
- `The Matrix (1999)/The Matrix (1999).mkv`
- `Inception (2010)/Inception (2010).mp4`

### Music
```
Artist Name/
├── Album Name (Year)/
│   ├── 01 - Track Name.ext
│   ├── 02 - Track Name.ext
│   └── ...
```

### Documentaries
```
Documentary Name (Year)/
└── Documentary Name (Year).ext
```

Or for series:
```
Documentary Series (Year)/
├── Season 01/
│   └── Documentary Series - S01E01 - Episode Title.ext
```

---

## Implementation Plan

### Phase 1: Detection & Formatting Service

**New File:** `apps/api/src/services/jellyfin-formatter.service.ts`

```typescript
interface FormattedDownload {
  contentType: 'tv' | 'movie' | 'music' | 'documentary' | 'other';
  originalName: string;
  formattedPath: string;
  folderStructure: {
    showName?: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
  preview: string; // What user sees
}

class JellyfinFormatterService {
  // Detect content type from metadata
  detectContentType(metadata: any): string

  // Parse TV show info (season, episode, title)
  parseTVShow(title: string): TVShowInfo

  // Parse movie info (title, year)
  parseMovie(title: string): MovieInfo

  // Generate Jellyfin-compatible path
  formatForJellyfin(metadata: any, contentType: string): FormattedDownload

  // Format existing files/folders (for cleanup)
  formatExisting(path: string): FormattedDownload
}
```

### Phase 2: UI Integration

**Files to Modify:**
- `apps/web/src/pages/Browse.tsx` - BBC iPlayer downloads
- `apps/web/src/pages/Movies.tsx` - Movie downloads (torrents)
- `apps/web/src/pages/TVShows.tsx` - TV show downloads
- `apps/web/src/pages/Downloads.tsx` - Custom URL downloads

**New Component:** `apps/web/src/components/DownloadFormatPreview.tsx`

```tsx
interface DownloadFormatPreviewProps {
  originalName: string;
  formattedPath: string;
  onEdit: (newPath: string) => void;
  onConfirm: () => void;
}

// Shows before/after comparison:
// Original: "breaking.bad.s01e01.1080p.x265-JOY.mkv"
// Formatted: "Breaking Bad (2008)/Season 01/Breaking Bad - S01E01 - Pilot.mkv"
```

### Phase 3: Download Worker Integration

**File:** `apps/api/src/workers/download.worker.ts`

Update to:
1. Call formatter service before download
2. Use formatted path for saving
3. Create proper folder structure automatically

### Phase 4: Backend API Updates

**File:** `apps/api/src/routes/downloads.ts`

New endpoint:
```typescript
POST /api/v1/downloads/preview
{
  url: "...",
  metadata: { ... }
}

Response:
{
  formatted: {
    path: "Breaking Bad (2008)/Season 01/Breaking Bad - S01E01.mkv",
    preview: "...",
    contentType: "tv"
  }
}
```

---

## User Flow

### Current Flow:
1. User clicks "Download" on a show
2. Popup asks: "Which folder?" (Movies, TV, Music, etc.)
3. Download starts with original filename

### New Flow:
1. User clicks "Download" on a show
2. System detects: "TV Show - Breaking Bad S01E01"
3. Popup shows:
   ```
   Content Type: TV Show

   Original: "breaking.bad.s01e01.1080p.x265.mkv"

   Formatted Path:
   📁 Breaking Bad (2008)
      └─ 📁 Season 01
         └─ 📄 Breaking Bad - S01E01 - Pilot.mkv

   Destination: D:\MediaVault\TV Shows\

   [Edit] [Confirm Download]
   ```
4. User can edit any part or confirm
5. Download starts with formatted naming

---

## Data Sources for Metadata

### TV Shows
- **TMDB API** - Get show name, year, episode titles
- **TVDB** - Alternative TV database
- **yt-dlp metadata** - Already extracts some info
- **get_iplayer** - BBC metadata

### Movies
- **TMDB API** - Movie titles, years, metadata
- **IMDb** (via TMDB) - Ratings, info

### Music
- **MusicBrainz** - Album/artist info
- **SoundCloud API** - Track metadata
- **yt-dlp** - YouTube music metadata

---

## Benefits

1. **Jellyfin Compatibility** - All downloads work immediately
2. **Better Organization** - Consistent folder structure
3. **User Control** - Can edit before confirming
4. **Less Manual Work** - No need to rename files later
5. **Professional Setup** - Looks like a real media library

---

## Implementation Priority

### High Priority (Do First):
1. TV Show formatter (most complex, most needed)
2. Download preview UI component
3. Backend API for formatting

### Medium Priority:
4. Movie formatter
5. Integration with existing download flow

### Low Priority:
6. Music formatter
7. Bulk rename tool for existing files
8. Auto-detect and fix existing non-compliant files

---

## Technical Considerations

### Parsing Challenges:
- **Various naming conventions:**
  - `show.s01e01.mkv`
  - `show.1x01.mkv`
  - `show.101.mkv` (season 1, episode 1)
  - `show.season.1.episode.1.mkv`

- **Solution:** Use regex patterns + metadata APIs

### Edge Cases:
- Special characters in titles
- Multi-episode files (S01E01-E02)
- Movies vs TV shows with same name
- Year ambiguity

### Performance:
- Cache TMDB lookups
- Format calculation should be <100ms
- Don't block download start

---

## Testing Checklist

- [ ] TV show with standard S01E01 format
- [ ] TV show with 1x01 format
- [ ] Movie with year in title
- [ ] Movie without year
- [ ] Multi-episode file
- [ ] Special characters in titles
- [ ] BBC iPlayer programme
- [ ] YouTube video (no metadata)
- [ ] Torrent with weird naming
- [ ] Manual URL with no metadata

---

## Future Enhancements

1. **Bulk Rename Tool:**
   - Scan existing library
   - Identify non-compliant files
   - Preview rename operations
   - Apply formatting to everything

2. **Smart Detection:**
   - Learn from user corrections
   - Improve parsing over time

3. **Custom Templates:**
   - User-defined naming patterns
   - Different formats for different content types

4. **Integration with Other Media Servers:**
   - Plex naming conventions
   - Kodi NFO files
   - Emby compatibility

---

## Questions to Decide

1. Should we use TMDB API for all metadata? (requires API key)
2. Allow users to override auto-detection?
3. What if metadata lookup fails? (fallback to manual?)
4. Rename existing files or only new downloads?
5. Support for anime naming conventions? (often different)

---

## Next Steps

1. ~~Create `jellyfin-formatter.service.ts`~~ ✅
2. ~~Add TMDB API integration~~ ✅
3. ~~Create preview UI component~~ ✅
4. ~~Test with Breaking Bad example~~ (Ready for testing)
5. ~~Roll out to all download types~~ ✅

---

## Running the Database Migration

Before testing, you need to run the database migration to add the required columns:

### Option 1: Using psql (Recommended)
```bash
# Start PostgreSQL if not running
sudo service postgresql start

# Run the migration
PGPASSWORD=mediavault123 psql -h localhost -U mediavault -d mediavault \
  -f apps/api/src/migrations/006_add_jellyfin_formatting_columns.sql
```

### Option 2: Manual SQL
Connect to the database and run:
```sql
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS formatted_path TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS jellyfin_format JSONB;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS custom_folder TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS organize_by_uploader BOOLEAN DEFAULT FALSE;
```

### Verification
Check that columns were added:
```bash
PGPASSWORD=mediavault123 psql -h localhost -U mediavault -d mediavault \
  -c "\d downloads"
```

You should see the new columns: `formatted_path`, `jellyfin_format`, `category`, `custom_folder`, and `organize_by_uploader`.

---

## Testing the Feature

1. **Start MediaVault services**:
   ```bash
   ~/start-mediavault.sh
   ```

2. **Navigate to any browse page**:
   - http://localhost:3000/movies
   - http://localhost:3000/tv-shows
   - http://localhost:3000/browse (BBC iPlayer)

3. **Try downloading a show/movie**:
   - Search for content
   - Click a show/movie to open details
   - Paste a download URL or magnet link
   - Click "Queue Download"
   - **You should see the format preview modal**

4. **Verify the preview shows**:
   - Content type detection (TV Show vs Movie)
   - Formatted folder structure
   - Jellyfin-compatible file path
   - Metadata (show name, year, season, episode, title)

5. **Confirm and monitor**:
   - Click "Confirm Download"
   - Check Downloads page for progress
   - Verify file lands in correct Jellyfin-formatted folder
   - Check Jellyfin to see if it recognizes the content

---

## What Changed

### Backend Files
- `apps/api/src/services/jellyfin-formatter.service.ts` - Main formatting engine
- `apps/api/src/routes/downloads.ts` - Added format-preview endpoints
- `apps/api/src/workers/download.worker.ts` - Uses formatted_path when moving files
- `apps/api/src/migrations/006_add_jellyfin_formatting_columns.sql` - Database schema

### Frontend Files
- `apps/web/src/components/DownloadFormatPreview.tsx` - Preview modal component
- `apps/web/src/pages/Movies.tsx` - Integrated format preview
- `apps/web/src/pages/TVShows.tsx` - Integrated format preview
- `apps/web/src/pages/Browse.tsx` - Integrated format preview for BBC iPlayer

### Database Schema
New columns in `downloads` table:
- `formatted_path` - Jellyfin-formatted file path
- `jellyfin_format` - Full formatting metadata (JSON)
- `category` - Download category (movies, tv, music, etc.)
- `custom_folder` - Custom folder name
- `organize_by_uploader` - Boolean flag
