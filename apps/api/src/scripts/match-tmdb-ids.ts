/**
 * Smart TMDB ID matching script for download_history entries
 * Extracts title/year from filenames and matches against TMDB API
 *
 * Usage: npx tsx src/scripts/match-tmdb-ids.ts
 */

import { AppDataSource } from '../data-source.js';
import { tmdbService } from '../services/tmdb.service.js';

interface DownloadHistoryEntry {
  id: string;
  title: string;
  file_path: string;
  tmdb_id: number | null;
  tmdb_media_type: string | null;
  category: string | null;
}

/**
 * Extract clean title and year from filename
 * Handles formats like:
 * - "Senna 2010 1080p BluRay x265-RBG.mp4"
 * - "Law and Order - SVU (1999 - ongoing) S01-S26.mp4"
 * - "The Godfather 1972 1080p.mkv"
 */
function parseFilename(filename: string): { title: string; year: number | null; isTV: boolean } {
  // Remove file extension
  let name = filename.replace(/\.(mp4|mkv|avi|mov|m4v)$/i, '');

  // Check if it's a TV show (has season/episode indicators)
  const isTV = /S\d{2}|Season|Episode/i.test(name);

  // Extract year (4 digits)
  const yearMatch = name.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Remove common junk from title
  let title = name
    // Remove year
    .replace(/\b(19\d{2}|20\d{2})\b/g, '')
    // Remove quality indicators
    .replace(/\b(1080p|720p|2160p|4K|BluRay|WEBRip|HDTV|DVDRip|x264|x265|H\.?264|H\.?265|HEVC)\b/gi, '')
    // Remove codec/source info
    .replace(/\b(AAC|AC3|DTS|EAC3|DD|5\.1|2\.0|Atmos)\b/gi, '')
    // Remove release group tags (usually after dash at end)
    .replace(/-[A-Z0-9]+$/i, '')
    // Remove season/episode info
    .replace(/S\d{2}.*$/i, '')
    // Remove parenthetical info like "(1999 - ongoing)"
    .replace(/\([^)]*\)/g, '')
    // Remove extra dashes, dots, underscores
    .replace(/[._-]+/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return { title, year, isTV };
}

/**
 * Determine media type from category and file path
 */
function determineMediaType(entry: DownloadHistoryEntry, isTV: boolean): 'movie' | 'tv' | 'documentary' {
  const path = entry.file_path.toLowerCase();
  const category = entry.category?.toLowerCase() || '';

  if (category.includes('documentary') || path.includes('/documentaries/')) {
    return 'documentary';
  }

  if (isTV || category.includes('tv') || path.includes('/tv') || path.includes('/television/')) {
    return 'tv';
  }

  return 'movie';
}

async function matchTmdbIds() {
  console.log('[TMDB Matcher] Starting TMDB ID matching for download_history...\n');

  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('[TMDB Matcher] Database connection established\n');
    }

    // Get all download_history entries without tmdb_id
    const entries: DownloadHistoryEntry[] = await AppDataSource.query(`
      SELECT id, title, file_path, tmdb_id, tmdb_media_type, category
      FROM download_history
      WHERE tmdb_id IS NULL
      ORDER BY downloaded_at DESC
    `);

    console.log(`[TMDB Matcher] Found ${entries.length} entries without TMDB ID\n`);

    if (entries.length === 0) {
      console.log('[TMDB Matcher] Nothing to process!\n');
      process.exit(0);
    }

    let matched = 0;
    let notFound = 0;
    let errors = 0;

    for (const entry of entries) {
      try {
        // Parse filename to extract title and year
        const filename = entry.file_path.split('/').pop() || entry.title;
        const { title, year, isTV } = parseFilename(filename);
        const mediaType = determineMediaType(entry, isTV);

        console.log(`\n[TMDB Matcher] Processing: ${entry.title}`);
        console.log(`  Parsed: "${title}" (${year || 'no year'}) - Type: ${mediaType}`);

        // Search TMDB
        let result = null;

        if (mediaType === 'tv') {
          // Search TV shows
          const searchResults = await tmdbService.searchTVShows(title, 1);
          if (searchResults.results && searchResults.results.length > 0) {
            result = { id: searchResults.results[0].id, media_type: 'tv' };
            console.log(`  ✓ Found TV show: ${searchResults.results[0].name} (TMDB: ${result.id})`);
          }
        } else {
          // Search movies (includes documentaries)
          const searchResults = await tmdbService.searchMovies(title, 1);
          if (searchResults.results && searchResults.results.length > 0) {
            result = { id: searchResults.results[0].id, media_type: mediaType };
            console.log(`  ✓ Found ${mediaType}: ${searchResults.results[0].title} (TMDB: ${result.id})`);
          }
        }

        if (result) {
          // Update download_history with TMDB ID
          await AppDataSource.query(`
            UPDATE download_history
            SET tmdb_id = $1, tmdb_media_type = $2
            WHERE id = $3
          `, [result.id, result.media_type, entry.id]);

          matched++;
        } else {
          console.log(`  ✗ Not found in TMDB`);
          notFound++;
        }

        // Rate limit: wait 250ms between requests to respect TMDB API limits
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (err: any) {
        console.error(`  ✗ Error:`, err.message);
        errors++;
      }
    }

    console.log('\n[TMDB Matcher] Complete!');
    console.log(`  ✓ Matched: ${matched}`);
    console.log(`  ✗ Not found: ${notFound}`);
    console.log(`  ⚠ Errors: ${errors}`);
    console.log(`  Total processed: ${entries.length}\n`);

    // Show updated stats
    const stats = await AppDataSource.query(`
      SELECT
        COUNT(*) as total,
        COUNT(tmdb_id) as with_tmdb,
        COUNT(*) - COUNT(tmdb_id) as without_tmdb
      FROM download_history
    `);

    console.log('[TMDB Matcher] Download history stats:');
    console.log(`  Total entries: ${stats[0].total}`);
    console.log(`  With TMDB ID: ${stats[0].with_tmdb}`);
    console.log(`  Without TMDB ID: ${stats[0].without_tmdb}\n`);

    process.exit(0);
  } catch (err) {
    console.error('[TMDB Matcher] Fatal error:', err);
    process.exit(1);
  }
}

// Run the matcher
matchTmdbIds();
