/**
 * Backfill TMDB thumbnails for existing downloads
 */
import { AppDataSource } from '../data-source.js';
import { tmdbService } from '../services/tmdb.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';

async function backfillThumbnails() {
  try {
    // Initialize database
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Get all downloads without thumbnails
    const downloads = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('(d.thumbnail IS NULL OR d.thumbnail = \'\')')
      .andWhere('d.title IS NOT NULL')
      .andWhere('d.title != \'Torrent Download\'')
      .getRawMany();

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
          thumbnail = await tmdbService.findThumbnailForTitle(download.title, download.user_id);
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
