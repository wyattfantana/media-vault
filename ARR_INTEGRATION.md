# *arr Services Integration

## Overview

MediaVault now integrates with the *arr automation suite (Radarr, Sonarr, Prowlarr, Recyclarr) for automated media downloading and management. This allows users to add movies and TV shows directly from the MediaVault UI, which are then automatically downloaded via torrents at the desired quality level.

## What We've Implemented

### 1. Backend Infrastructure

#### Services
- **RadarrService** (`apps/api/src/services/radarr.service.ts`)
  - Movie lookup, addition, removal
  - Quality profile and root folder management
  - Search triggering and queue monitoring
  - Implements lookup-before-add pattern to get complete metadata

- **SonarrService** (`apps/api/src/services/sonarr.service.ts`)
  - TV series lookup, addition, removal
  - Season/episode management
  - Quality profile and root folder management
  - Search triggering and queue monitoring

- **ProwlarrService** (`apps/api/src/services/prowlarr.service.ts`)
  - Indexer management
  - Search capabilities across multiple torrent sites

#### API Routes
- **Radarr Routes** (`apps/api/src/routes/radarr.ts`)
  - `GET /api/v1/radarr/status` - System status
  - `GET /api/v1/radarr/movies` - List all movies
  - `POST /api/v1/radarr/movies` - Add movie
  - `DELETE /api/v1/radarr/movies/:id` - Remove movie
  - `GET /api/v1/radarr/quality-profiles` - List quality profiles
  - `GET /api/v1/radarr/root-folders` - List root folders
  - `GET /api/v1/radarr/queue` - Download queue

- **Sonarr Routes** (`apps/api/src/routes/sonarr.ts`)
  - Similar endpoints for TV series management

- **Prowlarr Routes** (`apps/api/src/routes/prowlarr.ts`)
  - Indexer management and search endpoints

#### Database
- **user_preferences table** - Extended with *arr configuration fields:
  - `radarr_enabled`, `radarr_host`, `radarr_port`, `radarr_api_key`, `radarr_url_base`
  - `sonarr_enabled`, `sonarr_host`, `sonarr_port`, `sonarr_api_key`, `sonarr_url_base`
  - `prowlarr_enabled`, `prowlarr_host`, `prowlarr_port`, `prowlarr_api_key`, `prowlarr_url_base`

- **arr_automation table** - Tracks automation status:
  - Links TMDB IDs to Radarr/Sonarr IDs
  - Tracks automation status and errors

### 2. Frontend Integration

#### Settings Page
- New "*arr Services" tab in Settings (`apps/web/src/pages/Settings.tsx`)
- Configuration UI for Radarr, Sonarr, and Prowlarr:
  - Enable/disable toggles
  - Host, port, API key, and URL base configuration
  - Test connection buttons with live status feedback
  - Color-coded sections: Blue (Radarr), Purple (Sonarr), Orange (Prowlarr)

#### Movies Page
- "Add to Radarr (Auto-Download)" button in movie modals
- Automatic quality profile and root folder selection
- Real-time feedback on add status
- Integration with existing movie discovery and search

#### TV Shows Page
- "Add to Sonarr (Auto-Download)" button in TV show modals
- Similar UX to Movies page
- Season and episode management support

### 3. Docker Infrastructure

#### Docker Compose Services
- **Prowlarr** - Port 9696
  - Manages torrent indexers (BitSearch, The Pirate Bay)
  - Syncs indexers to Radarr/Sonarr automatically

- **Radarr** - Port 7878
  - Automated movie downloading
  - Quality management and upgrading
  - Connected to qBittorrent for downloads

- **Sonarr** - Port 8989
  - Automated TV series downloading
  - Season/episode tracking
  - Connected to qBittorrent for downloads

- **Recyclarr** - Background service
  - Automatically syncs TRaSH guides to Radarr/Sonarr
  - Configures optimal quality settings

#### Volume Mappings
```yaml
radarr:
  volumes:
    - ./data/radarr:/config
    - /mnt/d/MediaVault:/downloads
    - /home/beerm/Downloads:/home/beerm/Downloads  # qBittorrent download path

sonarr:
  volumes:
    - ./data/sonarr:/config
    - /mnt/d/MediaVault:/downloads
    - /home/beerm/Downloads:/home/beerm/Downloads  # qBittorrent download path
```

### 4. Quality Configuration

#### Recyclarr Setup
- Configured in `data/recyclarr/recyclarr.yml`
- Quality profiles synced from TRaSH guides:
  - **HD-1080p** - Standard quality (Bluray-1080p, WEB-1080p, HDTV-1080p)
  - **Ultra-HD** - 4K quality (Bluray-2160p, WEB-2160p)
- Automatic quality definition optimization

### 5. Integration Fixes

#### Indexer Sync Issue
- **Problem:** Radarr/Sonarr had no indexers configured, preventing searches
- **Solution:** Triggered Prowlarr's `ApplicationIndexerSync` command
- **Result:** BitSearch and The Pirate Bay now synced to both Radarr and Sonarr

#### Docker Volume Mapping
- **Problem:** Radarr couldn't see qBittorrent's download folder
- **Solution:** Added `/home/beerm/Downloads` volume mount to Radarr/Sonarr containers
- **Result:** No more health warnings, downloads properly tracked

## Current Status

### Working Features
✅ Settings page configuration for all *arr services
✅ Add movies to Radarr from Movies page
✅ Add TV shows to Sonarr from TV Shows page
✅ Automatic torrent search via Prowlarr indexers
✅ Quality profile selection (defaulting to HD-1080p)
✅ Download queue monitoring
✅ qBittorrent integration for torrent downloads
✅ Docker volume path mapping resolved
✅ Health check warnings resolved

### Configuration Details
- **Indexers:** BitSearch, The Pirate Bay (synced via Prowlarr)
- **Default Quality:** HD-1080p (Bluray/WEB/HDTV)
- **Download Client:** qBittorrent (port 8080)
- **Download Path:** `/home/beerm/Downloads`
- **Root Folders:**
  - Movies: `/downloads/Movies`
  - TV Shows: `/downloads/TV Shows`

## What's Next

### High Priority

1. **Enhanced UI Feedback**
   - Show download progress in MediaVault UI
   - Display queue status on Movies/TV Shows pages
   - Add notifications for download completion/failure

2. **Better Error Handling**
   - Detect and display duplicate movie/show errors gracefully
   - Show specific error messages from Radarr/Sonarr
   - Validate quality profiles and root folders before adding

3. **Queue Management UI**
   - Create a dedicated Downloads/Queue page
   - Show active downloads from Radarr/Sonarr queues
   - Allow pause/resume/cancel from MediaVault UI
   - Display ETA and download speed

4. **Quality Profile Selection**
   - Allow users to select quality profile per movie/show
   - Remember user's preferred quality settings
   - Show available quality options in UI

### Medium Priority

5. **Existing Library Detection**
   - Check if movie/show is already in Radarr/Sonarr before adding
   - Show "Already in library" status
   - Provide option to search for upgrades

6. **Batch Operations**
   - Add multiple movies/shows at once
   - Bulk quality profile changes
   - Mass search/refresh commands

7. **Advanced Search Options**
   - Manual torrent selection (instead of automatic)
   - Filter by quality, size, seeders
   - Preview available releases before adding

8. **Jellyfin Integration Enhancement**
   - Auto-update Jellyfin library when downloads complete
   - Link Radarr/Sonarr downloads to Jellyfin library items
   - Show playback status in MediaVault

### Low Priority

9. **Statistics and Monitoring**
   - Download statistics dashboard
   - Disk space monitoring
   - Download speed graphs
   - Popular/trending content suggestions

10. **Additional *arr Services**
    - Lidarr integration (music)
    - Readarr integration (books/audiobooks)
    - Whisparr integration (adult content)

11. **Custom Lists and Collections**
    - Import TMDB/IMDB lists directly
    - Create custom watchlists
    - Automated collection downloading

12. **Scheduling and Automation**
    - Scheduled search/refresh times
    - Bandwidth limiting schedules
    - Auto-upgrade on better quality releases

## Troubleshooting

### Movies/Shows Not Downloading

1. **Check Indexers:**
   ```bash
   # Verify indexers are synced to Radarr
   curl "http://localhost:7878/api/v3/indexer?apikey=YOUR_API_KEY"

   # If empty, trigger sync from Prowlarr
   curl -X POST "http://localhost:9696/api/v1/command?apikey=YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name": "ApplicationIndexerSync"}'
   ```

2. **Check Download Client:**
   ```bash
   # Verify qBittorrent is connected in Radarr
   curl "http://localhost:7878/api/v3/downloadclient?apikey=YOUR_API_KEY"
   ```

3. **Check Health:**
   ```bash
   # Check Radarr health warnings
   curl "http://localhost:7878/api/v3/health?apikey=YOUR_API_KEY"
   ```

### Docker Volume Issues

If you see "directory does not appear to exist inside the container" errors:

1. Check volume mappings in `docker-compose.yml`
2. Ensure paths exist on host system
3. Recreate containers: `docker compose up -d radarr sonarr`
4. Verify mount inside container: `docker exec radarr ls /home/beerm/Downloads`

### Duplicate Movie/Show Errors

When adding a movie/show that already exists in Radarr/Sonarr:
- Check the library in Radarr/Sonarr UI
- Remove duplicates if needed
- Or trigger a manual search for the existing entry

## API Keys

Located in `.env` file:
```env
RADARR_API_KEY=85660fa98c9946e69634b52a4d29826b
SONARR_API_KEY=55aaf7dd9e034a159a8050e30ed3f0c5
PROWLARR_API_KEY=c7f082674bec48cfb65ab3eb0b097d6b
```

Also configured in `data/recyclarr/recyclarr.yml` for TRaSH guides sync.

## Architecture Notes

### Why Lookup-Before-Add?

Radarr/Sonarr require complete metadata when adding movies/shows. The lookup endpoints (`/movie/lookup?term=tmdb:ID` and `/series/lookup?term=tvdb:ID`) fetch all necessary metadata from TMDB/TVDB, including:
- Images (posters, fanart)
- Title slug
- Alternative titles
- Genre tags
- Release information

Without this lookup step, the add operation fails with validation errors.

### Prowlarr as Indexer Hub

Prowlarr acts as a central indexer manager:
1. Configure indexers once in Prowlarr
2. Prowlarr syncs them to all connected *arr apps
3. Changes in Prowlarr automatically propagate
4. Reduces configuration duplication

### Quality Profile Strategy

Using Recyclarr to sync TRaSH guides ensures:
- Optimal file size vs quality balance
- Consistent naming and organization
- Automatic updates to quality definitions
- Community-vetted best practices

## Session History

### Session 10 (2025-12-22)
- ✅ Created Settings UI for *arr configuration
- ✅ Added "Add to Radarr" button on Movies page
- ✅ Added "Add to Sonarr" button on TV Shows page
- ✅ Fixed indexer sync issue (Prowlarr → Radarr/Sonarr)
- ✅ Fixed Docker volume mapping for download paths
- ✅ Resolved all Radarr health warnings
- ✅ Tested end-to-end movie download workflow
- ✅ Configured Recyclarr with TRaSH guides for HD-1080p quality

---

**Last Updated:** 2025-12-22
**Status:** Fully functional, ready for production use
**Next Steps:** Enhanced UI feedback and queue management
