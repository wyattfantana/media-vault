import { AppDataSource } from '../data-source.js';
import { ytdlpService } from '../services/ytdlp.service.js';
import { getIPlayerService, IPlayerProgramme } from '../services/get-iplayer.service.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { fileOrganizerService } from '../services/file-organizer.service.js';
import { jellyfinService } from '../services/jellyfin.service.js';
import { bazarrService } from '../services/bazarr.service.js';
import { tmdbService } from '../services/tmdb.service.js';
import { extractYouTubeVideoId, extractiPlayerPid, getSourceType } from '../utils/platform-ids.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Format iPlayer title for Jellyfin
 * Cleans up ugly filenames like "AI_Decoded_-_Stephen_Fry_Meets_Godfather_of_AI_m002m6dy_original"
 * to "AI Decoded - Stephen Fry Meets Godfather of AI"
 */
function formatIPlayerTitle(info: IPlayerProgramme | undefined, filename: string): string {
  // If we have programme info, use it
  if (info && (info.name || info.episode)) {
    const parts: string[] = [];
    if (info.name) parts.push(info.name);
    if (info.episode) parts.push(info.episode);
    return parts.join(' - ');
  }

  // Fallback: clean up the filename
  const basename = path.basename(filename, path.extname(filename));

  // Remove PID (pattern: underscore followed by 8 alphanumeric characters like m002m6dy)
  let cleaned = basename.replace(/_[a-z0-9]{8,}_/gi, '_');

  // Remove "_original" suffix
  cleaned = cleaned.replace(/_original$/i, '');

  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, ' ');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned || 'Unknown';
}

export class DownloadWorker {
  private isRunning = false;
  private pollInterval = 5000; // Check every 5 seconds
  private torrentPollInterval = 10000; // Check torrents every 10 seconds
  private currentDownloadId: string | null = null;
  private defaultMaxConcurrentDownloads = 3; // Default maximum concurrent downloads
  private activeDownloadsByUser = new Map<string, Set<string>>(); // Track active downloads per user

  private async shouldFetchThumbnails(userId: string): Promise<boolean> {
    try {
      const prefs = await AppDataSource
        .createQueryBuilder()
        .select('auto_fetch_thumbnails')
        .from('user_preferences', 'p')
        .where('p.user_id = :userId', { userId })
        .getRawOne();
      if (prefs && prefs.auto_fetch_thumbnails !== null && prefs.auto_fetch_thumbnails !== undefined) {
        return !!prefs.auto_fetch_thumbnails;
      }
    } catch (err) {
      console.error(`[Download Worker] Failed to fetch thumbnail preference for user ${userId}:`, err);
    }

    return true;
  }

  private async recordDownloadHistory(download: any, title: string, finalPath: string, fileSize: number) {
    try {
      const sourceType = getSourceType(download.downloader, download.url);
      const youtubeId = extractYouTubeVideoId(download.url);
      const iplayerId = extractiPlayerPid(download.url);

      await AppDataSource.query(`
        INSERT INTO download_history (
          user_id, source_type, source_url, title, tmdb_id, tmdb_media_type,
          youtube_video_id, iplayer_pid, file_path, file_size, category, downloaded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (user_id, source_url) WHERE source_url IS NOT NULL DO NOTHING
      `, [
        download.user_id,
        sourceType,
        download.url,
        title,
        download.tmdb_id || null,
        download.tmdb_media_type || null,
        youtubeId,
        iplayerId,
        finalPath,
        fileSize,
        download.category || null
      ]);

      console.log(`[Download Worker] Added to download history: ${title}`);

      // Auto-match TMDB ID if not already set (for torrent downloads)
      if (!download.tmdb_id && sourceType === 'qbittorrent') {
        try {
          console.log(`[Download Worker] Auto-matching TMDB ID for: ${title}`);

          const filename = path.basename(finalPath, path.extname(finalPath));
          const yearMatch = filename.match(/\b(19\d{2}|20\d{2})\b/);
          const year = yearMatch ? parseInt(yearMatch[1]) : null;

          let cleanTitle = filename
            .replace(/\b(19\d{2}|20\d{2})\b/g, '')
            .replace(/\b(1080p|720p|2160p|4K|BluRay|WEBRip|HDTV|DVDRip|x264|x265|H\.?264|H\.?265|HEVC)\b/gi, '')
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

          const isTV = /S\d{2}|Season|Episode/i.test(filename);
          const mediaType = isTV ? 'tv' : (download.category?.toLowerCase().includes('documentary') ? 'documentary' : 'movie');

          let tmdbId = null;
          let tmdbMediaType = null;

          if (mediaType === 'tv') {
            const searchResults = await tmdbService.searchTVShows(cleanTitle, 1, download.user_id, year || undefined);
            if (searchResults.results && searchResults.results.length > 0) {
              tmdbId = searchResults.results[0].id;
              tmdbMediaType = 'tv';
              console.log(`[Download Worker] ✓ Matched TV show: ${searchResults.results[0].name} (TMDB: ${tmdbId})`);
            }
          } else {
            const searchResults = await tmdbService.searchMovies(cleanTitle, 1, download.user_id, year || undefined);
            if (searchResults.results && searchResults.results.length > 0) {
              tmdbId = searchResults.results[0].id;
              // TMDB only recognizes 'movie' or 'tv', so map 'documentary' to 'movie'
              tmdbMediaType = mediaType === 'documentary' ? 'movie' : mediaType;
              console.log(`[Download Worker] ✓ Matched ${mediaType}: ${searchResults.results[0].title} (TMDB: ${tmdbId})`);
            }
          }

          if (tmdbId) {
            await AppDataSource.query(`
              UPDATE download_history
              SET tmdb_id = $1, tmdb_media_type = $2
              WHERE user_id = $3 AND source_url = $4
            `, [tmdbId, tmdbMediaType, download.user_id, download.url]);

            console.log(`[Download Worker] Updated download_history with TMDB ID ${tmdbId}`);
          } else {
            console.log(`[Download Worker] No TMDB match found for: ${cleanTitle}`);
          }
        } catch (tmdbErr) {
          console.error('[Download Worker] TMDB auto-match failed:', tmdbErr);
        }
      }
    } catch (historyErr) {
      console.error('[Download Worker] Failed to insert download history:', historyErr);
    }
  }

  constructor() {
    // Listen for progress events from downloaders
    ytdlpService.on('progress', (progress) => {
      if (this.currentDownloadId) {
        this.updateProgress(this.currentDownloadId, progress.progress, progress.status);
      }
    });

    getIPlayerService.on('progress', (progress) => {
      if (this.currentDownloadId) {
        this.updateProgress(this.currentDownloadId, progress.progress, progress.status);
      }
    });
  }

  /**
   * Start the download worker
   */
  start() {
    if (this.isRunning) {
      console.log('Download worker already running');
      return;
    }

    this.isRunning = true;
    console.log('[19:' + new Date().getMinutes() + ':' + new Date().getSeconds() + ' UTC] INFO: Download worker started');
    this.processQueue();
    this.syncTorrentsProgress(); // Start torrent sync loop
  }

  /**
   * Stop the download worker
   */
  stop() {
    this.isRunning = false;
    console.log('[19:' + new Date().getMinutes() + ':' + new Date().getSeconds() + ' UTC] INFO: Download worker stopped');
  }

  /**
   * Main processing loop - supports concurrent downloads
   */
  private async processQueue() {
    while (this.isRunning) {
      try {
        // Get all pending downloads
        const pendingDownloads = await AppDataSource
          .createQueryBuilder()
          .select('*')
          .from('downloads', 'd')
          .where('d.status = :status', { status: 'pending' })
          .orderBy('d.created_at', 'ASC')
          .getRawMany();

        // Group by user
        const downloadsByUser = new Map<string, any[]>();
        for (const download of pendingDownloads) {
          const userId = download.user_id;
          if (!downloadsByUser.has(userId)) {
            downloadsByUser.set(userId, []);
          }
          downloadsByUser.get(userId)!.push(download);
        }

        // Process downloads for each user up to their concurrent limit
        for (const [userId, userDownloads] of downloadsByUser) {
          // Get user's concurrent download preference
          let maxConcurrent = this.defaultMaxConcurrentDownloads;
          try {
            const prefs = await AppDataSource
              .createQueryBuilder()
              .select('concurrent_downloads')
              .from('user_preferences', 'p')
              .where('p.user_id = :userId', { userId })
              .getRawOne();
            if (prefs && prefs.concurrent_downloads) {
              maxConcurrent = prefs.concurrent_downloads;
            }
          } catch (err) {
            console.error(`Failed to fetch preferences for user ${userId}:`, err);
          }

          // Get or create active downloads set for this user
          if (!this.activeDownloadsByUser.has(userId)) {
            this.activeDownloadsByUser.set(userId, new Set());
          }
          const userActiveDownloads = this.activeDownloadsByUser.get(userId)!;

          // Calculate available slots for this user
          const availableSlots = maxConcurrent - userActiveDownloads.size;

          // Process up to available slots for this user
          const downloadsToProcess = userDownloads.slice(0, availableSlots);
          for (const download of downloadsToProcess) {
            if (!userActiveDownloads.has(download.id)) {
              userActiveDownloads.add(download.id);

              // Process download in background, remove from active when done
              this.processDownload(download)
                .finally(() => {
                  userActiveDownloads.delete(download.id);
                  // Clean up empty sets
                  if (userActiveDownloads.size === 0) {
                    this.activeDownloadsByUser.delete(userId);
                  }
                });
            }
          }
        }

        // Wait before checking again
        await this.sleep(this.pollInterval);
      } catch (err) {
        console.error('[Download Worker] Error:', err);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Process a single download
   */
  private async processDownload(download: any) {
    this.currentDownloadId = download.id;
    console.log(`[Download Worker] Processing download ${download.id}: ${download.title}`);

    try {
      // Update status to downloading
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({
          status: 'downloading',
          started_at: new Date()
        })
        .where('id = :id', { id: download.id })
        .execute();

      let outputPath: string;
      let fileSize: number;
      let duration: number = 0;
      let format: string = '';
      let resolution: string = '';
      let videoInfo: any = null;
      let iplayerInfo: IPlayerProgramme | undefined;
      let thumbnail = download.thumbnail || '';
      let title = download.title || '';
      let description = download.description || '';

      // Download using appropriate service
      if (download.downloader === 'yt-dlp') {
        const result = await ytdlpService.downloadVideo(download.url, {
          quality: (download.quality || 'best') as any,
          videoFormat: (download.video_format || 'mp4') as any,
          audioFormat: (download.audio_format || 'mp3') as any
        });
        outputPath = result.outputPath;
        duration = Math.floor(result.info.duration || 0);
        videoInfo = result.info; // Save video info for organization

        // Get best format info
        const bestFormat = result.info.formats.find(f => f.resolution && f.resolution !== 'unknown');
        if (bestFormat) {
          format = bestFormat.ext;
          resolution = bestFormat.resolution;
        }
      } else if (download.downloader === 'get_iplayer') {
        // Extract PID from URL
        const pidMatch = download.url.match(/[a-z0-9]{8}/i);
        if (!pidMatch) {
          throw new Error('Invalid iPlayer PID');
        }

        // Listen to progress events
        const progressHandler = async (progressData: any) => {
          if (progressData.status === 'downloading' && progressData.progress) {
            await AppDataSource
              .createQueryBuilder()
              .update('downloads')
              .set({ progress: progressData.progress })
              .where('id = :id', { id: download.id })
              .execute();
          }
        };

        getIPlayerService.on('progress', progressHandler);

        let result;
        try {
          // Use quality from download record, default to 'hd' if not specified
          const quality = download.quality || 'hd';
          result = await getIPlayerService.downloadByPid(pidMatch[0], {
            quality: quality as any,
            subtitles: true
          });
          outputPath = result.outputPath;
          iplayerInfo = result.info; // Save iPlayer info for title formatting
          if (iplayerInfo) {
            if ((!title || title === download.url) && (iplayerInfo.name || iplayerInfo.episode)) {
              title = formatIPlayerTitle(iplayerInfo, outputPath);
            }
            if (!description && iplayerInfo.description) {
              description = iplayerInfo.description;
            }
            if (!thumbnail && iplayerInfo.thumbnail) {
              thumbnail = iplayerInfo.thumbnail;
            }
          }

          // Parse duration from programme info
          if (result.info.duration) {
            const durationMatch = result.info.duration.match(/(\d+):(\d+):(\d+)/);
            if (durationMatch) {
              duration = parseInt(durationMatch[1]) * 3600 +
                        parseInt(durationMatch[2]) * 60 +
                        parseInt(durationMatch[3]);
            }
          }

          // Remove listener
          getIPlayerService.off('progress', progressHandler);
        } catch (err) {
          getIPlayerService.off('progress', progressHandler);
          throw err;
        }
      } else if (download.downloader === 'qbittorrent') {
        // For qBittorrent downloads, they are added to qBittorrent immediately in the POST endpoint
        // The worker shouldn't normally process them, but if one ends up here (e.g., failed to add),
        // we'll let the torrent sync loop handle progress/completion
        console.log(`[Download Worker] qBittorrent download found in pending queue - skipping worker processing`);

        // Check if this download has already been added to qBittorrent by checking metadata
        const metadata = typeof download.metadata === 'string' ? JSON.parse(download.metadata) : download.metadata;

        if (!metadata.isTorrent) {
          await AppDataSource
            .createQueryBuilder()
            .update('downloads')
            .set({
              status: 'failed',
              error_message: 'qBittorrent download missing torrent metadata'
            })
            .where('id = :id', { id: download.id })
            .execute();
          return;
        }

        // Since torrents are added immediately in the POST endpoint, finding one here means
        // it likely raced with the worker. Skip processing to avoid retries.
        return;
      } else {
        throw new Error(`Unknown downloader: ${download.downloader}`);
      }

      // Get file stats
      const stats = await fs.stat(outputPath);
      fileSize = stats.size;

      // Update download as completed
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({
          status: 'completed',
          progress: 100,
          completed_at: new Date(),
          output_path: outputPath,
          file_size: fileSize
        })
        .where('id = :id', { id: download.id })
        .execute();

      // Organize file for Jellyfin
      let finalPath = outputPath;
      try {
        // Check if user provided a formatted path from the preview
        if (download.formatted_path) {
          console.log(`[Download Worker] Using Jellyfin-formatted path: ${download.formatted_path}`);

          // Get base download directory
          const downloadDir = process.env.DOWNLOAD_DIR || '/mnt/d/MediaVault';
          const targetPath = path.join(downloadDir, download.formatted_path);

          // Create directory structure
          await fs.mkdir(path.dirname(targetPath), { recursive: true });

          // Move file to formatted path
          await fs.rename(outputPath, targetPath);
          finalPath = targetPath;

          console.log(`[Download Worker] Moved to Jellyfin format: ${targetPath}`);
        } else if (download.downloader === 'yt-dlp' && videoInfo) {
          // Fall back to automatic organization
          // Prepare user category options from database
          const userCategory = download.category ? {
            category: download.category,
            customFolder: download.custom_folder,
            organizeByUploader: download.organize_by_uploader || false,
          } : undefined;

          const organized = await fileOrganizerService.organizeFile(
            outputPath,
            videoInfo,
            userCategory
          );

          if (organized.moved) {
            finalPath = organized.newPath;
            console.log(`[Download Worker] Organized to: ${organized.category}/${path.basename(finalPath)}`);
          }
        } else if (download.downloader === 'get_iplayer') {
          // For get_iplayer downloads, use formatted path if available or category folder
          if (!download.formatted_path) {
            const downloadDir = process.env.DOWNLOAD_DIR || '/mnt/d/MediaVault';
            const category = download.category || 'tv';
            const categoryFolder = category.charAt(0).toUpperCase() + category.slice(1);
            const targetDir = path.join(downloadDir, categoryFolder);

            await fs.mkdir(targetDir, { recursive: true });

            // Clean up the filename for Jellyfin
            const originalFilename = path.basename(outputPath);
            const extension = path.extname(originalFilename);
            const cleanTitle = formatIPlayerTitle(iplayerInfo, originalFilename);
            const cleanFilename = cleanTitle + extension;
            const targetPath = path.join(targetDir, cleanFilename);

            await fs.rename(outputPath, targetPath);
            finalPath = targetPath;

            console.log(`[Download Worker] Renamed and moved: ${cleanFilename}`);

            // Also rename subtitle file if it exists
            const originalSrtPath = outputPath.replace(extension, '.srt');
            const targetSrtPath = targetPath.replace(extension, '.srt');
            try {
              await fs.access(originalSrtPath);
              await fs.rename(originalSrtPath, targetSrtPath);
              console.log(`[Download Worker] Renamed subtitle: ${path.basename(targetSrtPath)}`);
            } catch {
              // Subtitle file doesn't exist, that's okay
            }
          }
        }
      } catch (err) {
        console.log('[Download Worker] File organization skipped:', err instanceof Error ? err.message : 'Unknown error');
      }

      // Clean up empty directories
      try {
        await fileOrganizerService.cleanupEmptyDirectories();
      } catch (err) {
        console.log('[Download Worker] Cleanup skipped');
      }

      // Create or update media entry (handle re-downloads)
      const mediaType = download.downloader === 'get_iplayer' ? 'tv_show' : 'video';

      // Format title for Jellyfin (clean up iPlayer filenames)
      const formattedTitle = download.downloader === 'get_iplayer'
        ? formatIPlayerTitle(iplayerInfo, finalPath)
        : (title || download.title || 'Unknown');

      const shouldFetchThumbs = await this.shouldFetchThumbnails(download.user_id);
      if (download.downloader !== 'get_iplayer' && shouldFetchThumbs && (!thumbnail || thumbnail === '')) {
        try {
          const tmdbThumbnail = await tmdbService.findThumbnailForTitle(formattedTitle, download.user_id);
          if (tmdbThumbnail) {
            thumbnail = tmdbThumbnail;
          }
        } catch (err) {
          console.error('[Download Worker] TMDB thumbnail lookup failed:', err);
        }
      }

      if (title !== download.title || description !== download.description || thumbnail !== download.thumbnail) {
        await AppDataSource
          .createQueryBuilder()
          .update('downloads')
          .set({
            title: title || download.title,
            description: description || download.description,
            thumbnail: thumbnail || download.thumbnail || ''
          })
          .where('id = :id', { id: download.id })
          .execute();
      }

      // Use raw SQL for upsert to handle duplicate file_path constraint
      await AppDataSource.query(`
        INSERT INTO media (download_id, user_id, title, description, file_path, file_size, duration, format, resolution, thumbnail, media_type, source, metadata, tmdb_id, tmdb_media_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (file_path)
        DO UPDATE SET
          download_id = EXCLUDED.download_id,
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          file_size = EXCLUDED.file_size,
          duration = EXCLUDED.duration,
          format = EXCLUDED.format,
          resolution = EXCLUDED.resolution,
          thumbnail = EXCLUDED.thumbnail,
          media_type = EXCLUDED.media_type,
          source = EXCLUDED.source,
          metadata = EXCLUDED.metadata,
          tmdb_id = EXCLUDED.tmdb_id,
          tmdb_media_type = EXCLUDED.tmdb_media_type,
          updated_at = NOW()
      `, [
        download.id,
        download.user_id,
        formattedTitle,
        description || download.description || '',
        finalPath,
        fileSize,
        duration,
        format || path.extname(finalPath).slice(1),
        resolution || '',
        thumbnail || download.thumbnail || '',
        mediaType,
        download.downloader,
        download.metadata || '{}',
        download.tmdb_id || null,
        download.tmdb_media_type || null
      ]);

      // Insert into download_history for permanent tracking (duplicate detection)
      await this.recordDownloadHistory(download, formattedTitle, finalPath, fileSize);

      // Trigger Jellyfin library scan
      try {
        if (jellyfinService.isConfigured()) {
          const scanResult = await jellyfinService.scanMediaFile(finalPath);
          if (scanResult.success) {
            console.log(`[Download Worker] Jellyfin scan triggered: ${scanResult.message}`);
          } else {
            console.log(`[Download Worker] Jellyfin scan failed: ${scanResult.message}`);
          }
        }
      } catch (err) {
        console.log('[Download Worker] Jellyfin scan skipped');
      }

      console.log(`[Download Worker] Completed: ${download.title}`);
      console.log(`[Download Worker] Output: ${finalPath}`);
      console.log(`[Download Worker] Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      console.error(`[Download Worker] Failed: ${download.title}`, err);

      // Retry logic with exponential backoff
      const metadata = typeof download.metadata === 'string' ? JSON.parse(download.metadata || '{}') : download.metadata || {};
      const retryCount = metadata.retryCount || 0;
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        // Calculate exponential backoff delay (2^retryCount * 10 seconds)
        const delaySeconds = Math.pow(2, retryCount) * 10;
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

        console.log(`[Download Worker] Retry ${retryCount + 1}/${maxRetries} scheduled for ${download.title} in ${delaySeconds}s`);

        // Update metadata with retry info and set back to pending
        metadata.retryCount = retryCount + 1;
        metadata.lastError = err instanceof Error ? err.message : 'Unknown error';
        metadata.nextRetryAt = nextRetryAt.toISOString();

        await AppDataSource
          .createQueryBuilder()
          .update('downloads')
          .set({
            status: 'pending',
            metadata: JSON.stringify(metadata),
            error_message: `Retry ${retryCount + 1}/${maxRetries}: ${err instanceof Error ? err.message : 'Unknown error'}`
          })
          .where('id = :id', { id: download.id })
          .execute();
      } else {
        // Max retries exceeded, mark as failed
        console.log(`[Download Worker] Max retries exceeded for ${download.title}`);

        metadata.retryCount = retryCount;
        metadata.lastError = err instanceof Error ? err.message : 'Unknown error';

        await AppDataSource
          .createQueryBuilder()
          .update('downloads')
          .set({
            status: 'failed',
            metadata: JSON.stringify(metadata),
            error_message: `Failed after ${maxRetries} retries: ${err instanceof Error ? err.message : 'Unknown error'}`
          })
          .where('id = :id', { id: download.id })
          .execute();
      }
    } finally {
      this.currentDownloadId = null;
    }
  }

  /**
   * Sync torrent progress from qBittorrent to MediaVault database
   */
  private async syncTorrentsProgress() {
    while (this.isRunning) {
      try {
        // Get all qBittorrent downloads that are downloading
        const torrentDownloads = await AppDataSource
          .createQueryBuilder()
          .select('*')
          .from('downloads', 'd')
          .where('d.downloader = :downloader', { downloader: 'qbittorrent' })
          .andWhere('d.status = :status', { status: 'downloading' })
          .getRawMany();

        if (torrentDownloads.length > 0) {
          // Get all torrents from qBittorrent
          const torrents = await qbittorrentService.getTorrents();

          // Match downloads to torrents by URL (magnet link or name)
          for (const download of torrentDownloads) {
            try {
              const metadata = typeof download.metadata === 'string'
                ? JSON.parse(download.metadata)
                : download.metadata;

              // Find matching torrent
              let torrent = null;

              // If we have a hash saved, use that
              if (metadata.torrentHash) {
                torrent = torrents.find(t => t.hash === metadata.torrentHash);
              } else {
                // Try to find by magnet link or name
                const magnetLink = metadata.magnetLink || download.url;

                // For magnet links, extract the hash
                if (magnetLink.startsWith('magnet:')) {
                  const hashMatch = magnetLink.match(/btih:([a-f0-9]+)/i);
                  if (hashMatch) {
                    const magnetHash = hashMatch[1].toLowerCase();
                    torrent = torrents.find(t => t.hash.toLowerCase() === magnetHash);
                  }
                }

                // If still not found, try matching by name (less reliable)
                if (!torrent && download.title && download.title !== 'Torrent Download') {
                  torrent = torrents.find(t =>
                    t.name.toLowerCase().includes(download.title.toLowerCase()) ||
                    download.title.toLowerCase().includes(t.name.toLowerCase())
                  );
                }

                // Save the hash for future lookups
                if (torrent) {
                  metadata.torrentHash = torrent.hash;

                  // Try to fetch TMDB thumbnail for better visuals
                  let thumbnail = download.thumbnail;
                  if (!thumbnail || thumbnail === '') {
                    try {
                      const tmdbThumbnail = await tmdbService.findThumbnailForTitle(torrent.name, download.user_id);
                      if (tmdbThumbnail) {
                        thumbnail = tmdbThumbnail;
                        console.log(`[Torrent Sync] Found TMDB thumbnail for: ${torrent.name}`);
                      }
                    } catch (err) {
                      console.log(`[Torrent Sync] Could not fetch TMDB thumbnail for: ${torrent.name}`);
                    }
                  }

                  await AppDataSource
                    .createQueryBuilder()
                    .update('downloads')
                    .set({
                      metadata: JSON.stringify(metadata),
                      title: torrent.name, // Update title with real torrent name
                      thumbnail // Update thumbnail if we found one
                    })
                    .where('id = :id', { id: download.id })
                    .execute();
                }
              }

              if (torrent) {
                // Update progress in database
                const progress = Math.round(torrent.progress * 100);

                await AppDataSource
                  .createQueryBuilder()
                  .update('downloads')
                  .set({ progress })
                  .where('id = :id', { id: download.id })
                  .execute();

                // Check if torrent is complete
                // All these states indicate the download is finished (might be seeding)
                const completedStates = ['uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'checkingUP', 'forcedUP'];
                const isComplete = completedStates.includes(torrent.state) || progress === 100;

                if (isComplete) {
                  console.log(`[Torrent Sync] Torrent complete (state: ${torrent.state}): ${torrent.name}`);
                  await this.handleTorrentComplete(download, torrent);
                }
              }
            } catch (err) {
              console.error(`[Torrent Sync] Error syncing download ${download.id}:`, err);
            }
          }
        }

        // Wait before next sync
        await this.sleep(this.torrentPollInterval);
      } catch (err) {
        console.error('[Torrent Sync] Error:', err);
        await this.sleep(this.torrentPollInterval);
      }
    }
  }

  /**
   * Handle torrent completion
   */
  private async handleTorrentComplete(download: any, torrent: any) {
    try {
      // Skip if already completed
      if (download.status === 'completed') {
        return;
      }

      // Get torrent files - use content_path which is the actual file/folder path
      const torrentPath = torrent.content_path || path.join(torrent.save_path, torrent.name);

      // Check if file or directory exists
      let stats;
      try {
        stats = await fs.stat(torrentPath);
      } catch (err) {
        console.error(`[Torrent Sync] File not found: ${torrentPath}`);
        return;
      }

      // Try to fetch TMDB thumbnail if we don't have one
      let thumbnail = download.thumbnail;
      if (!thumbnail || thumbnail === '') {
        try {
          const tmdbThumbnail = await tmdbService.findThumbnailForTitle(torrent.name, download.user_id);
          if (tmdbThumbnail) {
            thumbnail = tmdbThumbnail;
            console.log(`[Torrent Sync] Found TMDB thumbnail on completion: ${torrent.name}`);
          }
        } catch (err) {
          console.log(`[Torrent Sync] Could not fetch TMDB thumbnail on completion`);
        }
      }

      // Update download status
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({
          status: 'completed',
          progress: 100,
          completed_at: new Date(),
          output_path: torrentPath,
          file_size: stats.isDirectory() ? 0 : stats.size,
          thumbnail: thumbnail || download.thumbnail // Update thumbnail if we found one
        })
        .where('id = :id', { id: download.id })
        .execute();

      // Create media entry
      // For torrents, we'll create a single entry pointing to the folder or file
      await AppDataSource
        .createQueryBuilder()
        .insert()
        .into('media')
        .values({
          download_id: download.id,
          user_id: download.user_id,
          title: torrent.name,
          description: download.description || '',
          file_path: torrentPath,
          file_size: torrent.size,
          media_type: stats.isDirectory() ? 'tv_show' : 'video',
          source: 'qbittorrent',
          thumbnail: thumbnail || download.thumbnail || '', // Use TMDB thumbnail
          metadata: JSON.stringify({
            torrentHash: torrent.hash,
            category: torrent.category,
            isDirectory: stats.isDirectory()
          })
        })
        .execute();

      console.log(`[Torrent Sync] Created media entry for: ${torrent.name}`);
      console.log(`[Torrent Sync] Output: ${torrentPath}`);
      console.log(`[Torrent Sync] Size: ${(torrent.size / 1024 / 1024).toFixed(2)} MB`);

      await this.recordDownloadHistory(download, torrent.name, torrentPath, stats.isDirectory() ? 0 : stats.size);

      // Trigger Jellyfin library scan
      try {
        if (jellyfinService.isConfigured()) {
          const scanResult = await jellyfinService.scanMediaFile(torrentPath);
          if (scanResult.success) {
            console.log(`[Torrent Sync] Jellyfin scan triggered: ${scanResult.message}`);
          }
        }
      } catch (err) {
        console.log('[Torrent Sync] Jellyfin scan skipped');
      }

      // Auto-download subtitles via Bazarr (if enabled and TMDB ID available)
      try {
        if (bazarrService.isConfigured() && download.tmdb_id) {
          console.log(`[Torrent Sync] Checking Bazarr for subtitle auto-download...`);

          // Get user's subtitle language preferences
          const prefs = await AppDataSource
            .createQueryBuilder()
            .select('*')
            .from('user_preferences', 'up')
            .where('up.user_id = :userId', { userId: download.user_id })
            .getRawOne();

          if (prefs && prefs.bazarr_enabled) {
            const languages = prefs.bazarr_subtitle_languages || ['en'];
            console.log(`[Torrent Sync] Auto-downloading subtitles for TMDB ID ${download.tmdb_id} in languages: ${languages.join(', ')}`);

            const result = await bazarrService.autoDownloadMovieSubtitles(
              download.tmdb_id,
              languages
            );

            if (result.success) {
              console.log(`[Torrent Sync] Bazarr: ${result.message}`);
            } else {
              console.log(`[Torrent Sync] Bazarr: ${result.message}`);
            }
          }
        }
      } catch (err) {
        console.log('[Torrent Sync] Bazarr subtitle download skipped:', err instanceof Error ? err.message : 'Unknown error');
      }
    } catch (err) {
      console.error(`[Torrent Sync] Error handling completion:`, err);
    }
  }

  /**
   * Update download progress
   */
  private async updateProgress(downloadId: string, progress: number, status: string) {
    try {
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({
          progress: Math.round(progress),
          status: status === 'completed' ? 'downloading' : status
        })
        .where('id = :id', { id: downloadId })
        .execute();
    } catch (err) {
      console.error('[Download Worker] Failed to update progress:', err);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const downloadWorker = new DownloadWorker();
