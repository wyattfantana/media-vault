import { AppDataSource } from '../data-source.js';
import { ytdlpService } from '../services/ytdlp.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { fileOrganizerService } from '../services/file-organizer.service.js';
import { jellyfinService } from '../services/jellyfin.service.js';
import fs from 'fs/promises';
import path from 'path';

export class DownloadWorker {
  private isRunning = false;
  private pollInterval = 5000; // Check every 5 seconds
  private currentDownloadId: string | null = null;

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
  }

  /**
   * Stop the download worker
   */
  stop() {
    this.isRunning = false;
    console.log('[19:' + new Date().getMinutes() + ':' + new Date().getSeconds() + ' UTC] INFO: Download worker stopped');
  }

  /**
   * Main processing loop
   */
  private async processQueue() {
    while (this.isRunning) {
      try {
        // Get next pending download
        const download = await AppDataSource
          .createQueryBuilder()
          .select('*')
          .from('downloads', 'd')
          .where('d.status = :status', { status: 'pending' })
          .orderBy('d.created_at', 'ASC')
          .limit(1)
          .getRawOne();

        if (download) {
          await this.processDownload(download);
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

      // Download using appropriate service
      if (download.downloader === 'yt-dlp') {
        const result = await ytdlpService.downloadVideo(download.url, {
          quality: 'best'
        });
        outputPath = result.outputPath;
        duration = result.info.duration;
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

        const result = await getIPlayerService.downloadByPid(pidMatch[0], {
          quality: 'best',
          subtitles: true
        });
        outputPath = result.outputPath;

        // Parse duration from programme info
        if (result.info.duration) {
          const durationMatch = result.info.duration.match(/(\d+):(\d+):(\d+)/);
          if (durationMatch) {
            duration = parseInt(durationMatch[1]) * 3600 +
                      parseInt(durationMatch[2]) * 60 +
                      parseInt(durationMatch[3]);
          }
        }
      } else if (download.downloader === 'qbittorrent') {
        // For qBittorrent downloads, they are added to qBittorrent immediately in the POST endpoint
        // The worker shouldn't normally process them, but if one ends up here (e.g., failed to add),
        // we'll mark it as failed since torrents are handled differently
        console.log(`[Download Worker] qBittorrent download found in pending queue - torrents are handled separately`);

        // Check if this download has already been added to qBittorrent by checking metadata
        const metadata = typeof download.metadata === 'string' ? JSON.parse(download.metadata) : download.metadata;

        if (!metadata.isTorrent) {
          throw new Error('qBittorrent downloader specified but URL is not a torrent');
        }

        // Since torrents are added immediately in the POST endpoint, finding one here means
        // it likely failed to add to qBittorrent. Skip processing.
        throw new Error('Torrent should have been added to qBittorrent immediately. Please check qBittorrent service.');
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

      // Organize file for Jellyfin (if video info available)
      let finalPath = outputPath;
      try {
        if (download.downloader === 'yt-dlp' && videoInfo) {
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

      // Create media entry
      const mediaType = download.downloader === 'get_iplayer' ? 'tv_show' : 'video';

      await AppDataSource
        .createQueryBuilder()
        .insert()
        .into('media')
        .values({
          download_id: download.id,
          user_id: download.user_id,
          title: download.title || 'Unknown',
          description: download.description || '',
          file_path: finalPath,
          file_size: fileSize,
          duration: duration,
          format: format || path.extname(finalPath).slice(1),
          resolution: resolution || '',
          thumbnail: download.thumbnail || '',
          media_type: mediaType,
          source: download.downloader,
          metadata: download.metadata || '{}'
        })
        .execute();

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

      // Update download as failed
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error'
        })
        .where('id = :id', { id: download.id })
        .execute();
    } finally {
      this.currentDownloadId = null;
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
