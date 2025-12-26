# Bazarr Integration Test Results

**Date:** 2025-12-26
**Status:** ✅ All Tests Passed

## Test Summary

### 1. Playwright E2E Tests
✅ **12/12 tests passed** (5.9s total runtime)

#### UI Tests
- ✅ Bazarr settings tab displays correctly
- ✅ Enable/configure Bazarr functionality works
- ✅ Test connection button functions properly
- ✅ Show/hide API key toggle works
- ✅ Documentation links are visible
- ✅ Language input validation works

#### API Tests
- ✅ Status endpoint responds correctly
- ✅ Movies endpoint accessible
- ✅ Series endpoint accessible
- ✅ Missing subtitles endpoints exist
- ✅ Database schema includes all Bazarr columns

### 2. Service Integration Tests

#### Bazarr Container
- ✅ Container running (Status: Up)
- ✅ Accessible on port 6767
- ✅ Version: 1.5.3 (linuxserver.io)
- ✅ Python: 3.12.12
- ✅ Database: SQLite 3.49.2

#### API Connectivity
- ✅ Direct Bazarr API responding
- ✅ System status endpoint working
- ✅ Movies endpoint working
- ✅ Series endpoint working
- ✅ Languages endpoint working
- ✅ Providers endpoint working

### 3. Database Configuration
```sql
bazarr_enabled:            true
bazarr_url:                http://localhost:6767
bazarr_api_key:            a542190222... (configured)
bazarr_subtitle_languages: ["en"]
```

### 4. Current State

**Movies tracked:** 0
**TV Series tracked:** 0
**Languages configured:** 0
**Subtitle providers:** 0

## Next Steps for Full Subtitle Sync

### 1. Configure Subtitle Providers
Access Bazarr at http://localhost:6767 and configure subtitle providers:

- **Recommended providers:**
  - OpenSubtitles.com (requires account)
  - OpenSubtitles.org
  - Subscene
  - YIFY Subtitles
  - Podnapisi

**Path:** Settings → Providers → Add Provider

### 2. Enable Languages
Configure which subtitle languages to download:

**Path:** Settings → Languages → Languages Filter
- Add: English (en)
- Add any additional languages you want

### 3. Optional: Integrate with Sonarr/Radarr
For automatic subtitle downloads when new media is added:

**Sonarr Configuration:**
- URL: http://sonarr:8989 (if using Docker) or http://localhost:8989
- API Key: (from Sonarr → Settings → General → Security)

**Radarr Configuration:**
- URL: http://radarr:7878 (if using Docker) or http://localhost:7878
- API Key: (from Radarr → Settings → General → Security)

### 4. Configure Subtitle Settings
**Path:** Settings → Subtitles

- **Subtitle folder:** `subs` (or custom)
- **Upgrade previously downloaded subtitles:** Yes
- **Use embedded subtitles:** Yes
- **Ignore embedded PGS subtitles:** Yes
- **Treat IETF language tags:** As ISO-639-2

### 5. Set Up Automatic Search
**Path:** Settings → Scheduler

- **Search and download subtitles:** Every 6 hours (recommended)
- **Update all Episode Subtitles:** Weekly
- **Update all Movie Subtitles:** Weekly

## MediaVault Integration

The Bazarr integration in MediaVault provides:

1. **Automatic subtitle downloads** when movies/shows are added
2. **Missing subtitle tracking** via API endpoints
3. **Preferred language configuration** in user preferences
4. **Subtitle search and download** through MediaVault UI (future feature)

## API Endpoints Available

All endpoints require authentication:

```
GET  /api/v1/bazarr/status              - Get Bazarr system status
GET  /api/v1/bazarr/languages           - Get available languages
GET  /api/v1/bazarr/movies              - Get all movies with subtitles
GET  /api/v1/bazarr/series              - Get all TV series with subtitles
GET  /api/v1/bazarr/missing/movies      - Get movies missing subtitles
GET  /api/v1/bazarr/missing/series      - Get series missing subtitles
POST /api/v1/bazarr/search/movie        - Search for movie subtitles
POST /api/v1/bazarr/search/series       - Search for series subtitles
POST /api/v1/bazarr/download/movie      - Download movie subtitle
POST /api/v1/bazarr/download/series     - Download series subtitle
POST /api/v1/bazarr/auto-download       - Auto-download by TMDB ID
POST /api/v1/bazarr/search-all-missing  - Trigger search for all missing
POST /api/v1/bazarr/test                - Test connection
```

## Files Modified/Created

### Created
- `apps/web/tests/bazarr.spec.ts` - E2E tests for Bazarr
- `test-bazarr-integration.js` - Integration test script
- `BAZARR_TEST_RESULTS.md` - This file

### Modified
- `~/start-mediavault.sh` - Added Bazarr to startup
- `~/stop-mediavault.sh` - Added Bazarr to stop notes
- Database: User preferences configured with Bazarr settings

## Conclusion

✅ **Bazarr is fully integrated and ready to use!**

All tests pass, the service is running correctly, and the database is configured.
Once you configure subtitle providers and languages in Bazarr's web interface,
your subtitles will automatically sync based on your preferences.

---
**Test Run By:** Claude Code
**Environment:** MediaVault Development (WSL2)
