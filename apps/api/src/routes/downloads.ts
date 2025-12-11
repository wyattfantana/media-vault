import express from 'express';
import { auth } from '../auth.js';
import { ytdlpService } from '../services/ytdlp.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';
import { qbittorrentService, QBittorrentService } from '../services/qbittorrent.service.js';
import { vpnService } from '../services/vpn.service.js';
import { jellyfinFormatter } from '../services/jellyfin-formatter.service.js';
import { AppDataSource } from '../data-source.js';

export const downloadsRouter = express.Router();

// Middleware to check authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).user = session.user;
    (req as any).authSession = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// GET /api/v1/downloads - Get all downloads for current user
downloadsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    const queryBuilder = AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.user_id = :userId', { userId })
      .orderBy('d.created_at', 'DESC')
      .limit(Number(limit))
      .offset(Number(offset));

    if (status) {
      queryBuilder.andWhere('d.status = :status', { status });
    }

    const downloads = await queryBuilder.getRawMany();
    const countResult = await AppDataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('downloads', 'd')
      .where('d.user_id = :userId', { userId })
      .getRawOne();

    // Enrich torrent downloads with real-time stats from qBittorrent
    const enrichedDownloads = await Promise.all(downloads.map(async (download) => {
      if (download.downloader === 'qbittorrent' && download.metadata?.torrentHash) {
        try {
          const torrents = await qbittorrentService.getTorrents();
          const torrent = torrents.find(t => t.hash === download.metadata.torrentHash);

          if (torrent) {
            return {
              ...download,
              torrentInfo: {
                dlspeed: torrent.dlspeed,
                upspeed: torrent.upspeed,
                eta: torrent.eta,
                num_seeds: torrent.num_seeds,
                num_leechs: torrent.num_leechs,
                state: torrent.state,
                size: torrent.size,
                downloaded: torrent.downloaded,
                uploaded: torrent.uploaded,
                ratio: torrent.ratio
              }
            };
          }
        } catch (err) {
          console.error('Failed to get torrent info:', err);
        }
      }
      return download;
    }));

    res.json({
      downloads: enrichedDownloads,
      total: parseInt(countResult.count),
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (err) {
    console.error('Failed to get downloads:', err);
    res.status(500).json({ error: 'Failed to get downloads' });
  }
});

// GET /api/v1/downloads/:id - Get single download
downloadsRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    res.json(download);
  } catch (err) {
    console.error('Failed to get download:', err);
    res.status(500).json({ error: 'Failed to get download' });
  }
});

// POST /api/v1/downloads - Create new download
downloadsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Fetch user preferences to use as defaults
    let userPrefs: any = null;
    try {
      const prefsResult = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('user_preferences', 'p')
        .where('p.user_id = :userId', { userId })
        .getRawOne();
      userPrefs = prefsResult;
    } catch (err) {
      console.error('Failed to fetch user preferences:', err);
    }

    const {
      url,
      downloader = 'yt-dlp',
      options = {},
      category = userPrefs?.default_folder || 'Downloads',
      customFolder,
      organizeByUploader = false,
      quality = userPrefs?.default_quality || 'best',
      videoFormat = userPrefs?.default_video_format || 'mp4',
      audioFormat = userPrefs?.default_audio_format || 'mp3'
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check if this is a torrent (magnet link or .torrent file)
    const isTorrent = QBittorrentService.isTorrentUrl(url);

    // Get video info first
    let title = '';
    let description = '';
    let thumbnail = '';
    let metadata = {};
    let actualDownloader = downloader;

    // If it's a torrent, force qbittorrent downloader
    if (isTorrent) {
      actualDownloader = 'qbittorrent';

      // For torrents, we'll use the URL as title for now
      // We'll update it once qBittorrent fetches the metadata
      title = url.startsWith('magnet:') ? 'Torrent Download' : url.split('/').pop() || 'Torrent Download';
      metadata = { isTorrent: true, magnetLink: url };
    } else {
      try {
        if (downloader === 'yt-dlp') {
          const info = await ytdlpService.getVideoInfo(url);
          title = info.title;
          description = info.description;
          thumbnail = info.thumbnail;
          metadata = info;
        } else if (downloader === 'get_iplayer') {
          // For iPlayer, we'll need the PID
          const pidMatch = url.match(/[a-z0-9]{8}/i);
          if (pidMatch) {
            const programmes = await getIPlayerService.getProgrammeInfo(pidMatch[0]);
            if (programmes.length > 0) {
              const prog = programmes[0];
              title = `${prog.name} - ${prog.episode}`;
              description = prog.description;
              thumbnail = prog.thumbnail;
              metadata = prog;
            }
          }
        }
      } catch (err) {
        console.error('Failed to get video info:', err);
        // Continue anyway, we'll use the URL as fallback
      }
    }

    // Create download record
    const insertResult = await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('downloads')
      .values({
        user_id: userId,
        url,
        title: title || url,
        description,
        thumbnail,
        downloader: actualDownloader,
        status: 'pending',
        progress: 0,
        metadata: JSON.stringify(metadata),
        category,
        custom_folder: customFolder,
        organize_by_uploader: organizeByUploader,
        quality,
        video_format: videoFormat,
        audio_format: audioFormat
      })
      .returning('*')
      .execute();

    const download = insertResult.raw[0];

    // If it's a torrent, immediately add it to qBittorrent
    if (isTorrent) {
      // Check if VPN auto-connect is enabled
      const shouldAutoConnect = await vpnService.shouldAutoConnect(userId);
      let vpnStatus = await vpnService.getStatus();

      // Auto-connect to VPN if enabled and not connected
      if (shouldAutoConnect && !vpnStatus.connected) {
        try {
          console.log('[Downloads] Auto-connecting to VPN...');

          // Check if there's a preferred location
          const preferredLocation = await vpnService.getPreferredLocation(userId);
          if (preferredLocation) {
            console.log(`[Downloads] Setting VPN location to: ${preferredLocation}`);
            await vpnService.setLocation(preferredLocation);
          }

          // Connect to VPN
          await vpnService.connect();

          // Refresh VPN status after connecting
          vpnStatus = await vpnService.getStatus();
          console.log('[Downloads] VPN auto-connected successfully');
        } catch (err: any) {
          console.error('[Downloads] Failed to auto-connect VPN:', err);
          // Continue with download even if auto-connect fails
        }
      }

      // Check if VPN is required
      const vpnRequired = await vpnService.isVPNRequiredForTorrents(userId);

      if (vpnRequired && !vpnStatus.connected) {
        // VPN is required but not connected - warn user but allow download
        console.warn('[Downloads] VPN not connected but torrent download requested');

        // Update download metadata to include VPN warning
        await AppDataSource
          .createQueryBuilder()
          .update('downloads')
          .set({
            metadata: JSON.stringify({
              ...metadata,
              vpnWarning: 'VPN was not connected when this download was started'
            })
          })
          .where('id = :id', { id: download.id })
          .execute();
      }

      // Auto-bind qBittorrent to VPN if connected and user preference is set
      const shouldAutoBind = await vpnService.shouldAutoBindQBittorrent(userId);
      if (vpnStatus.connected && vpnStatus.interface && shouldAutoBind) {
        try {
          const currentInterface = await qbittorrentService.getNetworkInterface();

          // Only bind if not already bound to VPN
          if (currentInterface !== vpnStatus.interface) {
            console.log('[Downloads] Auto-binding qBittorrent to VPN interface');
            await qbittorrentService.bindToVPN(vpnStatus.interface);
          }
        } catch (err) {
          console.error('[Downloads] Failed to auto-bind qBittorrent to VPN:', err);
        }
      }

      try {
        const downloadDir = process.env.DOWNLOAD_DIR || '/mnt/d/MediaVault';
        const savePath = customFolder
          ? `${downloadDir}/${customFolder}`
          : `${downloadDir}/${category}`;

        const result = await qbittorrentService.addTorrent(url, {
          savePath,
          category: category.toLowerCase(),
          paused: false
        });

        if (result.success) {
          // Apply bandwidth limits from user preferences if set
          if (userPrefs) {
            try {
              if (userPrefs.download_speed_limit && userPrefs.download_speed_limit > 0) {
                // Convert MB/s to bytes/s (qBittorrent expects bytes/sec)
                const downloadLimit = userPrefs.download_speed_limit * 1024 * 1024;
                await qbittorrentService.setDownloadLimit(downloadLimit);
                console.log(`Applied download limit: ${userPrefs.download_speed_limit} MB/s for user ${userId}`);
              }

              if (userPrefs.upload_speed_limit && userPrefs.upload_speed_limit > 0) {
                // Convert MB/s to bytes/s (qBittorrent expects bytes/sec)
                const uploadLimit = userPrefs.upload_speed_limit * 1024 * 1024;
                await qbittorrentService.setUploadLimit(uploadLimit);
                console.log(`Applied upload limit: ${userPrefs.upload_speed_limit} MB/s for user ${userId}`);
              }
            } catch (limitErr) {
              console.error('Failed to apply bandwidth limits:', limitErr);
              // Don't fail the download if bandwidth limits can't be set
            }
          }

          // Update status to downloading
          await AppDataSource
            .createQueryBuilder()
            .update('downloads')
            .set({ status: 'downloading' })
            .where('id = :id', { id: download.id })
            .execute();

          download.status = 'downloading';
        } else {
          // Mark as failed
          await AppDataSource
            .createQueryBuilder()
            .update('downloads')
            .set({ status: 'failed', error_message: result.message })
            .where('id = :id', { id: download.id })
            .execute();

          download.status = 'failed';
          download.error_message = result.message;
        }
      } catch (err: any) {
        console.error('Failed to add torrent to qBittorrent:', err);
        // Update download status
        await AppDataSource
          .createQueryBuilder()
          .update('downloads')
          .set({ status: 'failed', error_message: err.message })
          .where('id = :id', { id: download.id })
          .execute();

        download.status = 'failed';
        download.error_message = err.message;
      }
    }

    res.status(201).json(download);
  } catch (err) {
    console.error('Failed to create download:', err);
    res.status(500).json({ error: 'Failed to create download' });
  }
});

// POST /api/v1/downloads/:id/start - Start a download
// NOTE: Downloads auto-start via the worker - this endpoint is kept for compatibility
downloadsRouter.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    // Downloads are automatically processed by the worker
    // Just return success - don't change status to prevent blocking the worker
    res.json({ message: 'Download will be processed automatically', id });
  } catch (err) {
    console.error('Failed to start download:', err);
    res.status(500).json({ error: 'Failed to start download' });
  }
});

// DELETE /api/v1/downloads/:id - Cancel/delete a download
downloadsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { deleteFiles = false } = req.query;

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    // If it's a qBittorrent download, also remove from qBittorrent
    if (download.downloader === 'qbittorrent' && download.metadata?.torrentHash) {
      try {
        await qbittorrentService.deleteTorrent(
          download.metadata.torrentHash,
          deleteFiles === 'true'
        );
      } catch (err) {
        console.error('Failed to delete torrent from qBittorrent:', err);
        // Continue with database deletion even if qBittorrent deletion fails
      }
    }

    // If downloading, mark as cancelled
    if (download.status === 'downloading') {
      await AppDataSource
        .createQueryBuilder()
        .update('downloads')
        .set({ status: 'cancelled' })
        .where('id = :id', { id })
        .execute();
    } else {
      // Otherwise delete it
      await AppDataSource
        .createQueryBuilder()
        .delete()
        .from('downloads')
        .where('id = :id', { id })
        .execute();
    }

    res.json({ message: 'Download cancelled/deleted' });
  } catch (err) {
    console.error('Failed to delete download:', err);
    res.status(500).json({ error: 'Failed to delete download' });
  }
});

// POST /api/v1/downloads/:id/pause - Pause a torrent download
downloadsRouter.post('/:id/pause', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    if (download.downloader !== 'qbittorrent') {
      return res.status(400).json({ error: 'Only torrent downloads can be paused' });
    }

    if (!download.metadata?.torrentHash) {
      return res.status(400).json({ error: 'Torrent hash not found' });
    }

    await qbittorrentService.pauseTorrent(download.metadata.torrentHash);

    res.json({ message: 'Torrent paused successfully' });
  } catch (err) {
    console.error('Failed to pause torrent:', err);
    res.status(500).json({ error: 'Failed to pause torrent' });
  }
});

// POST /api/v1/downloads/:id/resume - Resume a paused torrent download
downloadsRouter.post('/:id/resume', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    if (download.downloader !== 'qbittorrent') {
      return res.status(400).json({ error: 'Only torrent downloads can be resumed' });
    }

    if (!download.metadata?.torrentHash) {
      return res.status(400).json({ error: 'Torrent hash not found' });
    }

    await qbittorrentService.resumeTorrent(download.metadata.torrentHash);

    res.json({ message: 'Torrent resumed successfully' });
  } catch (err) {
    console.error('Failed to resume torrent:', err);
    res.status(500).json({ error: 'Failed to resume torrent' });
  }
});

// POST /api/v1/downloads/bandwidth/limits - Set global bandwidth limits
downloadsRouter.post('/bandwidth/limits', requireAuth, async (req, res) => {
  try {
    const { downloadLimit, uploadLimit } = req.body;

    if (typeof downloadLimit === 'number') {
      await qbittorrentService.setDownloadLimit(downloadLimit);
    }

    if (typeof uploadLimit === 'number') {
      await qbittorrentService.setUploadLimit(uploadLimit);
    }

    res.json({ message: 'Bandwidth limits updated successfully' });
  } catch (err) {
    console.error('Failed to set bandwidth limits:', err);
    res.status(500).json({ error: 'Failed to set bandwidth limits' });
  }
});

// GET /api/v1/downloads/bandwidth/info - Get transfer info and limits
downloadsRouter.get('/bandwidth/info', requireAuth, async (req, res) => {
  try {
    const info = await qbittorrentService.getTransferInfo();
    res.json(info);
  } catch (err) {
    console.error('Failed to get transfer info:', err);
    res.status(500).json({ error: 'Failed to get transfer info' });
  }
});

// GET /api/v1/downloads/search/video - Search for videos
downloadsRouter.get('/search/video', requireAuth, async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const info = await ytdlpService.getVideoInfo(url as string);
    res.json(info);
  } catch (err) {
    console.error('Failed to search video:', err);
    res.status(500).json({ error: 'Failed to search video' });
  }
});

// GET /api/v1/downloads/search/iplayer - Search BBC iPlayer
downloadsRouter.get('/search/iplayer', requireAuth, async (req, res) => {
  try {
    const { q, type, channel, category } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await getIPlayerService.search(q as string, {
      type: type as 'tv' | 'radio' | 'all',
      channel: channel as string,
      category: category as string
    });

    res.json({ results });
  } catch (err) {
    console.error('Failed to search iPlayer:', err);
    res.status(500).json({ error: 'Failed to search iPlayer' });
  }
});

// GET /api/v1/downloads/supported-sites - Get list of supported sites
downloadsRouter.get('/supported-sites', requireAuth, async (req, res) => {
  try {
    const sites = await ytdlpService.getSupportedSites();
    res.json({ sites: sites.slice(0, 100) }); // Return first 100 sites
  } catch (err) {
    console.error('Failed to get supported sites:', err);
    res.status(500).json({ error: 'Failed to get supported sites' });
  }
});

// GET /api/v1/downloads/check-duplicate/:encodedUrl - Check if URL has already been downloaded
downloadsRouter.get('/check-duplicate/:encodedUrl', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const url = decodeURIComponent(req.params.encodedUrl);

    // Check in downloads table (in-progress or completed downloads)
    const existingDownload = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.user_id = :userId AND d.url = :url', { userId, url })
      .andWhere("d.status IN ('pending', 'downloading', 'completed')")
      .getRawOne();

    // Check in media table (already downloaded and saved)
    const existingMedia = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.user_id = :userId AND m.source = :url', { userId, url })
      .getRawOne();

    const isDuplicate = !!(existingDownload || existingMedia);

    res.json({
      isDuplicate,
      existingDownload: existingDownload || null,
      existingMedia: existingMedia || null,
      message: isDuplicate
        ? existingDownload
          ? `Already ${existingDownload.status} in queue`
          : 'Already downloaded'
        : 'No duplicate found'
    });
  } catch (err) {
    console.error('Failed to check duplicate:', err);
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
});

// GET /api/v1/downloads/status - Get downloader status
downloadsRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const [ytdlpStatus, iplayerStatus] = await Promise.all([
      ytdlpService.checkInstallation(),
      getIPlayerService.checkInstallation()
    ]);

    res.json({
      ytdlp: ytdlpStatus,
      get_iplayer: iplayerStatus
    });
  } catch (err) {
    console.error('Failed to get downloader status:', err);
    res.status(500).json({ error: 'Failed to get downloader status' });
  }
});

// POST /api/v1/downloads/format-preview - Get Jellyfin formatting preview
downloadsRouter.post('/format-preview', requireAuth, async (req, res) => {
  try {
    const { filename, contentType, category, customFolder, searchTMDB = true } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    let formatted;

    // Use user's category if provided, otherwise fall back to contentType
    const targetCategory = category || contentType;

    if (targetCategory === 'tv') {
      formatted = await jellyfinFormatter.formatTVShow(filename, undefined, searchTMDB);
    } else if (targetCategory === 'movie' || targetCategory === 'movies') {
      formatted = await jellyfinFormatter.formatMovie(filename, undefined, searchTMDB);
    } else if (targetCategory === 'documentary' || targetCategory === 'documentaries') {
      // Format as movie but with Documentaries folder
      formatted = await jellyfinFormatter.formatMovie(filename, undefined, searchTMDB);
      formatted.baseDir = 'Documentaries';
      formatted.contentType = 'documentary';
    } else if (targetCategory === 'music') {
      // For music, just use the original filename in the Music folder
      formatted = {
        contentType: 'music',
        originalName: filename,
        formattedPath: `Music/${filename}`,
        folderStructure: {},
        preview: `📁 Music\n   └─ 📄 ${filename}`,
        baseDir: 'Music'
      };
    } else if (targetCategory === 'custom' && customFolder) {
      // Custom folder - use original filename
      const folderName = customFolder.split('/').pop() || customFolder;
      formatted = {
        contentType: 'other',
        originalName: filename,
        formattedPath: `${customFolder}/${filename}`,
        folderStructure: {},
        preview: `📁 ${folderName}\n   └─ 📄 ${filename}`,
        baseDir: customFolder
      };
    } else if (targetCategory === 'collection') {
      // No folder organization - just dump it in root
      formatted = {
        contentType: 'other',
        originalName: filename,
        formattedPath: filename,
        folderStructure: {},
        preview: `📄 ${filename}`,
        baseDir: ''
      };
    } else {
      // Auto-detect
      formatted = await jellyfinFormatter.autoFormat(filename, searchTMDB);
    }

    res.json({
      success: true,
      formatted
    });
  } catch (err: any) {
    console.error('Failed to format filename:', err);
    res.status(500).json({ error: 'Failed to format filename', message: err.message });
  }
});

// POST /api/v1/downloads/batch-format-preview - Get formatting preview for multiple files
downloadsRouter.post('/batch-format-preview', requireAuth, async (req, res) => {
  try {
    const { filenames, searchTMDB = true } = req.body;

    if (!filenames || !Array.isArray(filenames)) {
      return res.status(400).json({ error: 'Filenames array is required' });
    }

    const formatted = await jellyfinFormatter.batchFormat(filenames, searchTMDB);

    res.json({
      success: true,
      formatted
    });
  } catch (err: any) {
    console.error('Failed to batch format filenames:', err);
    res.status(500).json({ error: 'Failed to batch format filenames', message: err.message });
  }
});
