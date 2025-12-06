# Downloads Folder Organization Notes

## Current Status (2025-12-04)

### Folder Structure Created

```
D:\MediaVault\
├── Movies/           ← For movie downloads
├── TV Shows/         ← For TV series (Breaking Bad is here)
├── Music/            ← For music downloads (SoundCloud, etc.)
├── Documentaries/    ← For documentary content
└── downloads/        ← PENDING: Determine usage
```

### Downloads Folder - To Be Decided

The `D:\MediaVault\downloads\` folder currently exists but is empty.

**Possible Uses:**
1. **Temporary staging area** - Downloads go here first, then get moved/organized
2. **YouTube/misc content** - Non-categorized YouTube videos, social media, etc.
3. **Unsorted/other** - Catch-all for content that doesn't fit categories
4. **Remove it** - If redundant, could be deleted

**Current MediaVault Behavior:**
- Downloads are configured to go to `/mnt/d/MediaVault` (see `apps/api/.env`)
- Need to verify: Does MediaVault create subfolders automatically?
- Need to verify: Where do downloads actually land?

## TODO: Decisions Needed

1. **Test download behavior:**
   - Download a YouTube video
   - Download a movie via torrent
   - Download a BBC iPlayer show
   - See where each one lands

2. **Configure MediaVault download paths:**
   - Update backend to use category-specific folders:
     - Movies → `D:\MediaVault\Movies\`
     - TV Shows → `D:\MediaVault\TV Shows\`
     - Music → `D:\MediaVault\Music\`
     - Documentaries → `D:\MediaVault\Documentaries\`
     - Other/YouTube → `D:\MediaVault\downloads\` (?)

3. **Update Jellyfin library paths** after testing:
   - Set up automatic library scans when new content added
   - Configure metadata scrapers

## Questions to Answer

- Should Breaking Bad episodes go in `TV Shows/Breaking Bad (2008)/Season X/` structure?
- Should we use Jellyfin naming conventions from the start?
- Do we want automatic organization or manual categorization?
- Keep downloads folder as "Other" category or remove it?

## Breaking Bad - To Move Later

**Current Location:** `D:\MediaVault\Breaking Bad (2008)` (root level)
**Target Location:** `D:\MediaVault\TV Shows\Breaking Bad (2008)`

**Why not moved yet:** Seasons 1, 2, and 5 are still downloading (incomplete)

**TODO:** Once all seasons finish downloading, move Breaking Bad to TV Shows folder:
```bash
rsync -av "/mnt/d/MediaVault/Breaking Bad (2008)/" "/mnt/d/MediaVault/TV Shows/Breaking Bad (2008)/" && rm -rf "/mnt/d/MediaVault/Breaking Bad (2008)"
```

## Next Session Tasks

- [ ] **Move Breaking Bad to TV Shows folder** (after downloads complete)
- [ ] Test actual download flow end-to-end
- [ ] Verify where files land
- [ ] Update MediaVault backend if needed
- [ ] Set up proper Jellyfin library scanning
- [ ] Decide on downloads folder fate
