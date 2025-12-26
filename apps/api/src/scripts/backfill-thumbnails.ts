/**
 * Backfill TMDB thumbnails for existing downloads
 */
import { AppDataSource } from '../data-source.js';
import { tmdbService } from '../services/tmdb.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';

function buildTmdbSearchParams(rawTitle: string) {
  const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  let cleanTitle = rawTitle
    .replace(/\b(19\d{2}|20\d{2})\b/g, '')
    .replace(/\b(1080p|720p|2160p|4K|BluRay|WEBRip|WEB-DL|HDTV|DVDRip|x264|x265|H\.?264|H\.?265|HEVC)\b/gi, '')
    .replace(/\b(AAC|AC3|DTS|EAC3|DD|5\.1|2\.0|Atmos)\b/gi, '')
    .replace(/-[A-Z0-9]+$/i, '')
    .replace(/S\d{2}.*$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (year && cleanTitle.endsWith(year.toString())) {
    cleanTitle = cleanTitle.replace(new RegExp(`\\s*${year}$`), '').trim();
  }

  const isTV = /S\d{2}|Season|Episode/i.test(rawTitle);
  return { cleanTitle, year, isTV };
}

async function backfillThumbnails() {
  try {
    const titleFilter = process.argv[2]?.trim() || null;
    const searchOverride = process.argv[3]?.trim() || null;

    // Initialize database
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Get all downloads without thumbnails
    let query = AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('(d.thumbnail IS NULL OR d.thumbnail = \'\')')
      .andWhere('d.title IS NOT NULL')
      .andWhere('d.title != \'Torrent Download\'');

    if (titleFilter) {
      console.log(`\n🔎 Limiting to title: ${titleFilter}\n`);
      query = query.andWhere('d.title ILIKE :title', { title: titleFilter });
    }

    const downloads = await query.getRawMany();

    console.log(`\n📊 Found ${downloads.length} downloads without thumbnails\n`);

    const prefRows = await AppDataSource
      .createQueryBuilder()
      .select(['p.user_id', 'p.get_iplayer_path'])
      .from('user_preferences', 'p')
      .getRawMany();
    const iplayerPathByUser = new Map<string, string>();
    for (const pref of prefRows) {
      if (pref.get_iplayer_path) {
        iplayerPathByUser.set(pref.user_id, pref.get_iplayer_path);
      }
    }

    for (const download of downloads) {
      console.log(`\n--- Processing: ${download.title} ---`);

      try {
        let thumbnail: string | null = null;

        if (download.downloader === 'get_iplayer' && download.url) {
          const preferredPath = iplayerPathByUser.get(download.user_id);
          if (preferredPath) {
            getIPlayerService.setBinaryPath(preferredPath);
          }
          const pidMatch = download.url.match(/[a-z0-9]{8}/i);
          if (pidMatch) {
            let programmes = await getIPlayerService.getProgrammeInfo(pidMatch[0]);
            if (programmes.length === 0) {
              programmes = await getIPlayerService.search(pidMatch[0]);
            }
            if (programmes.length > 0) {
              thumbnail = programmes[0].thumbnail || null;
            }
          }
        }

        if (!thumbnail && download.metadata) {
          try {
            const metadata = typeof download.metadata === 'string'
              ? JSON.parse(download.metadata)
              : download.metadata;
            thumbnail = metadata?.thumbnail || metadata?.thumbnails?.[0]?.url || null;
          } catch (err) {
            console.error(`⚠️  Failed to parse metadata for thumbnail: ${(err as Error).message}`);
          }
        }

        if (!thumbnail && download.downloader !== 'get_iplayer') {
          const { cleanTitle: derivedTitle, year, isTV } = buildTmdbSearchParams(download.title || '');
          const cleanTitle = searchOverride || derivedTitle;
          const preferTV = isTV || download.category?.toLowerCase().includes('tv');
          if (cleanTitle) {
            if (preferTV) {
              const searchResults = await tmdbService.searchTVShows(cleanTitle, 1, download.user_id, year);
              if (searchResults.results && searchResults.results.length > 0) {
                thumbnail = tmdbService.getImageUrl(searchResults.results[0].poster_path, 'w200');
              }
            } else {
              const searchResults = await tmdbService.searchMovies(cleanTitle, 1, download.user_id, year);
              if (searchResults.results && searchResults.results.length > 0) {
                thumbnail = tmdbService.getImageUrl(searchResults.results[0].poster_path, 'w200');
              }
            }
          }
        }

        if (thumbnail) {
          // Update download with thumbnail
          await AppDataSource
            .createQueryBuilder()
            .update('downloads')
            .set({ thumbnail })
            .where('id = :id', { id: download.id })
            .execute();

          console.log(`✅ Thumbnail found and saved: ${thumbnail}`);

          // Also update media entry if it exists
          await AppDataSource
            .createQueryBuilder()
            .update('media')
            .set({ thumbnail })
            .where('download_id = :id', { id: download.id })
            .execute();

          console.log(`✅ Media entry updated`);
        } else {
          console.log(`⚠️  No thumbnail found in TMDB`);
        }
      } catch (err: any) {
        console.error(`❌ Error fetching thumbnail: ${err.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log('\n✅ Backfill complete!');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

backfillThumbnails();
