import express from 'express';
import { auth } from '../auth.js';
import { torrentSearchService } from '../services/torrent-search.service.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { tmdbService } from '../services/tmdb.service.js';
import { AppDataSource } from '../data-source.js';
import crypto from 'crypto';

export const torrentsRouter = express.Router();

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

// POST /api/v1/torrents/search - Search torrents across all sites
torrentsRouter.post('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log(`[TorrentsAPI] Searching for: ${query}`);

    const results = await torrentSearchService.searchAll(query);

    console.log(`[TorrentsAPI] Found ${results.length} total results`);

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (err) {
    console.error('[TorrentsAPI] Search failed:', err);
    res.status(500).json({ error: 'Failed to search torrents' });
  }
});

// POST /api/v1/torrents/download - Download a torrent via qBittorrent
torrentsRouter.post('/download', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { magnetUrl, downloadUrl, title, category } = req.body;

    if (!magnetUrl && !downloadUrl) {
      return res.status(400).json({ error: 'magnetUrl or downloadUrl is required' });
    }

    const url = magnetUrl || downloadUrl;

    // Extract torrent hash from magnet link FIRST (before adding to qBittorrent)
    let torrentHash: string | null = null;
    if (magnetUrl && magnetUrl.includes('btih:')) {
      const match = magnetUrl.match(/btih:([a-fA-F0-9]{40})/i);
      if (match) {
        torrentHash = match[1].toLowerCase();
      }
    }

    // Check if this torrent already exists in our database BEFORE adding to qBittorrent
    // Use a transaction with row-level locking to prevent race conditions
    if (torrentHash) {
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const existingDownload = await queryRunner.manager
          .createQueryBuilder()
          .select('id')
          .from('downloads', 'd')
          .where('d.user_id = :userId', { userId })
          .andWhere("d.metadata->>'torrentHash' = :hash", { hash: torrentHash })
          .setLock('pessimistic_write')
          .getRawOne();

        if (existingDownload) {
          console.log(`[TorrentsAPI] Torrent already exists in downloads: ${torrentHash}`);
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          return res.status(409).json({
            success: false,
            error: 'This torrent is already in your downloads',
            existingId: existingDownload.id
          });
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      // Also check if torrent already exists in qBittorrent
      try {
        const torrents = await qbittorrentService.getTorrents();
        const existingTorrent = torrents.find(t => t.hash === torrentHash);
        if (existingTorrent) {
          console.log(`[TorrentsAPI] Torrent already exists in qBittorrent: ${torrentHash}`);
          return res.status(409).json({
            success: false,
            error: 'This torrent is already being downloaded',
          });
        }
      } catch (err) {
        console.error('Failed to check existing torrents in qBittorrent:', err);
      }
    }

    console.log(`[TorrentsAPI] Adding torrent to qBittorrent: ${title || 'Unknown'}`);

    // Add torrent to qBittorrent
    const result = await qbittorrentService.addTorrent(url, {
      category: category || 'Movies',
      paused: false,
    });

    if (result.success) {
      console.log(`[TorrentsAPI] Torrent added successfully: ${title || url}`)

      // Wait a moment for qBittorrent to process the torrent
      await new Promise(resolve => setTimeout(resolve, 1500));

      // If we don't have the hash yet, try to find it in qBittorrent by matching the title
      if (!torrentHash) {
        try {
          const torrents = await qbittorrentService.getTorrents();
          // Search for torrent by name (more reliable than taking torrents[0])
          const matchingTorrent = torrents.find(t =>
            t.name && title && t.name.toLowerCase().includes(title.toLowerCase().slice(0, 20))
          );

          if (matchingTorrent) {
            torrentHash = matchingTorrent.hash;
            console.log(`[TorrentsAPI] Found torrent by name match: ${torrentHash}`);
          } else {
            console.warn(`[TorrentsAPI] Could not find torrent hash for: ${title}`);
          }
        } catch (err) {
          console.error('Failed to get torrent hash from qBittorrent:', err);
        }
      }

      // Try to match torrent title to TMDB
      let tmdbId: number | null = null;
      let tmdbMediaType: 'movie' | 'tv' | null = null;
      try {
        console.log(`[TorrentsAPI] Searching TMDB for: ${title}`);
        const tmdbMatch = await tmdbService.findMediaForTitle(title || '', userId);
        if (tmdbMatch) {
          tmdbId = tmdbMatch.tmdb_id;
          tmdbMediaType = tmdbMatch.tmdb_media_type;
          console.log(`[TorrentsAPI] TMDB match found: ${tmdbMatch.title} (${tmdbMediaType} ID: ${tmdbId})`);
        } else {
          console.log(`[TorrentsAPI] No TMDB match found for: ${title}`);
        }
      } catch (err) {
        console.error('[TorrentsAPI] TMDB search failed:', err);
      }

      // Create download record in database
      await AppDataSource
        .createQueryBuilder()
        .insert()
        .into('downloads')
        .values({
          user_id: userId,
          title: title || 'Torrent Download',
          url: url,
          downloader: 'qbittorrent',
          status: 'downloading',
          progress: 0,
          metadata: torrentHash ? { torrentHash, category } : { category },
          tmdb_id: tmdbId,
          tmdb_media_type: tmdbMediaType,
          created_at: new Date(),
        })
        .execute();

      res.json({
        success: true,
        message: result.message,
        title: title || 'Torrent',
        torrentHash,
      });
    } else {
      console.error(`[TorrentsAPI] Failed to add torrent: ${result.message}`);
      res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (err: any) {
    console.error('[TorrentsAPI] Download failed:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to download torrent',
    });
  }
});
