/**
 * Backfill script to populate download_history from existing media table
 * This is a one-time script to migrate existing downloads into the permanent history
 *
 * Usage: npx tsx src/scripts/backfill-download-history.ts
 */

import { AppDataSource } from '../data-source.js';
import { extractYouTubeVideoId, extractiPlayerPid, getSourceType } from '../utils/platform-ids.js';

async function backfillDownloadHistory() {
  console.log('[Backfill] Starting download_history backfill from media table...\n');

  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('[Backfill] Database connection established\n');
    }

    // Get all media entries
    const mediaEntries = await AppDataSource.query(`
      SELECT
        m.id,
        m.user_id,
        m.title,
        m.file_path,
        m.file_size,
        m.source,
        m.tmdb_id,
        m.tmdb_media_type,
        m.created_at,
        d.url,
        d.downloader,
        d.category
      FROM media m
      LEFT JOIN downloads d ON m.download_id = d.id
      ORDER BY m.created_at DESC
    `);

    console.log(`[Backfill] Found ${mediaEntries.length} media entries to process\n`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const media of mediaEntries) {
      try {
        // Determine source type
        const downloader = media.downloader || media.source || 'unknown';
        const url = media.url || '';
        const sourceType = getSourceType(downloader, url);

        // Extract platform-specific IDs
        const youtubeId = extractYouTubeVideoId(url);
        const iplayerId = extractiPlayerPid(url);

        // Determine category from file path if not set
        let category = media.category;
        if (!category) {
          const path = media.file_path.toLowerCase();
          if (path.includes('/movies/')) category = 'Movies';
          else if (path.includes('/tv/') || path.includes('/television/')) category = 'TV Shows';
          else if (path.includes('/music/')) category = 'Music';
          else if (path.includes('/documentaries/')) category = 'Documentaries';
          else if (path.includes('/youtube/')) category = 'YouTube';
          else if (path.includes('/iplayer/')) category = 'BBC iPlayer';
        }

        // Insert into download_history
        // Only use ON CONFLICT if source_url is not null (due to partial unique index)
        let result;
        if (url) {
          result = await AppDataSource.query(`
            INSERT INTO download_history (
              user_id, source_type, source_url, title, tmdb_id, tmdb_media_type,
              youtube_video_id, iplayer_pid, file_path, file_size, category,
              media_id, downloaded_at, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (user_id, source_url) WHERE source_url IS NOT NULL DO NOTHING
            RETURNING id
          `, [
            media.user_id,
            sourceType,
            url,
            media.title || 'Unknown',
            media.tmdb_id || null,
            media.tmdb_media_type || null,
            youtubeId,
            iplayerId,
            media.file_path,
            media.file_size || 0,
            category || null,
            media.id,
            media.created_at || new Date(),
            media.created_at || new Date()
          ]);
        } else {
          // For entries without source_url, just insert (no conflict check)
          result = await AppDataSource.query(`
            INSERT INTO download_history (
              user_id, source_type, source_url, title, tmdb_id, tmdb_media_type,
              youtube_video_id, iplayer_pid, file_path, file_size, category,
              media_id, downloaded_at, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
          `, [
            media.user_id,
            sourceType,
            null,
            media.title || 'Unknown',
            media.tmdb_id || null,
            media.tmdb_media_type || null,
            youtubeId,
            iplayerId,
            media.file_path,
            media.file_size || 0,
            category || null,
            media.id,
            media.created_at || new Date(),
            media.created_at || new Date()
          ]);
        }

        if (result.length > 0) {
          inserted++;
          if (inserted % 10 === 0) {
            console.log(`[Backfill] Progress: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
          }
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors++;
        console.error(`[Backfill] Error processing media ${media.id}:`, err.message);
      }
    }

    console.log('\n[Backfill] Complete!');
    console.log(`  ✓ Inserted: ${inserted}`);
    console.log(`  ⊘ Skipped (duplicates): ${skipped}`);
    console.log(`  ✗ Errors: ${errors}`);
    console.log(`  Total processed: ${mediaEntries.length}\n`);

    // Show some stats
    const stats = await AppDataSource.query(`
      SELECT
        source_type,
        COUNT(*) as count
      FROM download_history
      GROUP BY source_type
      ORDER BY count DESC
    `);

    console.log('[Backfill] Download history by source:');
    stats.forEach((stat: any) => {
      console.log(`  ${stat.source_type}: ${stat.count}`);
    });

    // Show TMDB content stats
    const tmdbStats = await AppDataSource.query(`
      SELECT
        tmdb_media_type,
        COUNT(*) as count
      FROM download_history
      WHERE tmdb_id IS NOT NULL
      GROUP BY tmdb_media_type
      ORDER BY count DESC
    `);

    if (tmdbStats.length > 0) {
      console.log('\n[Backfill] TMDB content:');
      tmdbStats.forEach((stat: any) => {
        console.log(`  ${stat.tmdb_media_type || 'unknown'}: ${stat.count}`);
      });
    }

    console.log('\n[Backfill] Backfill complete! You can now use download_history for duplicate detection.');

    process.exit(0);
  } catch (err) {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
  }
}

// Run the backfill
backfillDownloadHistory();
