import express from 'express';
import { auth } from '../auth.js';
import { ytdlpService } from '../services/ytdlp.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';
import { qbittorrentService, QBittorrentService } from '../services/qbittorrent.service.js';
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

    res.json({
      downloads,
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
    const {
      url,
      downloader = 'yt-dlp',
      options = {},
      category = 'movies',
      customFolder,
      organizeByUploader = false
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
        organize_by_uploader: organizeByUploader
      })
      .returning('*')
      .execute();

    const download = insertResult.raw[0];

    // If it's a torrent, immediately add it to qBittorrent
    if (isTorrent) {
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

    const download = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.id = :id AND d.user_id = :userId', { id, userId })
      .getRawOne();

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
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
    const { filename, contentType, searchTMDB = true } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    let formatted;

    if (contentType === 'tv') {
      formatted = await jellyfinFormatter.formatTVShow(filename, undefined, searchTMDB);
    } else if (contentType === 'movie') {
      formatted = await jellyfinFormatter.formatMovie(filename, undefined, searchTMDB);
    } else if (contentType === 'documentary') {
      // Format as movie but with Documentaries folder
      formatted = await jellyfinFormatter.formatMovie(filename, undefined, searchTMDB);
      formatted.baseDir = 'Documentaries';
      formatted.contentType = 'documentary';
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
