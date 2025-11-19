import express from 'express';
import { auth } from '../auth.js';
import { ytdlpService } from '../services/ytdlp.service.js';
import { getIPlayerService } from '../services/get-iplayer.service.js';
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

    // Get video info first
    let title = '';
    let description = '';
    let thumbnail = '';
    let metadata = {};

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
        downloader,
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
