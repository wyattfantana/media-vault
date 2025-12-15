import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';
import { jellyfinService } from '../services/jellyfin.service.js';

export const bookmarksRouter = express.Router();

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

// GET /api/v1/bookmarks - Get all bookmarks for current user
bookmarksRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { type, enrichWithDownloadStatus } = req.query;

    // If enrichment requested, use LEFT JOIN to get download status from download_history
    // download_history is the permanent record that's never cleared
    if (enrichWithDownloadStatus === 'true') {
      let query = `
        SELECT
          b.*,
          dh.id AS history_id,
          dh.file_path AS media_file_path,
          dh.file_size AS media_file_size,
          dh.downloaded_at,
          d.id AS download_id,
          d.status AS download_status,
          d.progress AS download_progress
        FROM bookmarks b
        LEFT JOIN download_history dh ON (
          b.user_id = dh.user_id
          AND (
            -- Match TMDB content by tmdb_id
            (b.tmdb_id IS NOT NULL AND b.tmdb_id = dh.tmdb_id AND b.media_type = dh.tmdb_media_type)
            -- Match URL-based content by source_url
            OR (b.url IS NOT NULL AND b.url = dh.source_url)
          )
        )
        LEFT JOIN downloads d ON (
          b.tmdb_id = d.tmdb_id
          AND b.user_id = d.user_id
          AND d.status IN ('pending', 'downloading')
        )
        WHERE b.user_id = $1
      `;

      const params: any[] = [userId];

      if (type) {
        query += ` AND b.type = $2`;
        params.push(type);
      }

      query += ` ORDER BY b.created_at DESC`;

      const rawBookmarks = await AppDataSource.query(query, params);

      // Transform to nest download_status object
      // Also check Jellyfin for TMDB items not in download_history
      const bookmarks = await Promise.all(rawBookmarks.map(async (b: any) => {
        const { history_id, media_file_path, media_file_size, downloaded_at, download_id, download_status, download_progress, ...bookmark } = b;

        // If found in download_history, mark as downloaded
        if (history_id) {
          return {
            ...bookmark,
            download_status: {
              is_downloaded: true,
              history_id,
              file_path: media_file_path,
              file_size: media_file_size,
              downloaded_at,
              source: 'download_history'
            }
          };
        }

        // If currently downloading, show progress
        if (download_id) {
          return {
            ...bookmark,
            download_status: {
              is_downloaded: false,
              status: download_status,
              progress: download_progress
            }
          };
        }

        // For TMDB items, check Jellyfin as fallback (TEMPORARILY DISABLED - debugging)
        // TODO: Re-enable after fixing Jellyfin query
        /*
        if (bookmark.tmdb_id && jellyfinService.isConfigured()) {
          try {
            console.log(`[Bookmarks] Checking Jellyfin for: ${bookmark.title} (TMDB: ${bookmark.tmdb_id})`);
            const existsInJellyfin = await jellyfinService.hasItemWithTmdbId(
              bookmark.tmdb_id,
              bookmark.media_type
            );

            console.log(`[Bookmarks] ${bookmark.title} exists in Jellyfin: ${existsInJellyfin}`);

            if (existsInJellyfin) {
              return {
                ...bookmark,
                download_status: {
                  is_downloaded: true,
                  source: 'jellyfin',
                  tmdb_id: bookmark.tmdb_id
                }
              };
            }
          } catch (err) {
            console.error(`[Bookmarks] Failed to check Jellyfin for ${bookmark.title}:`, err);
          }
        }
        */

        // Not found anywhere
        return {
          ...bookmark,
          download_status: null
        };
      }));

      return res.json({
        bookmarks,
        total: bookmarks.length
      });
    }

    // Standard query without enrichment
    const queryBuilder = AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.user_id = :userId', { userId })
      .orderBy('b.created_at', 'DESC');

    if (type) {
      queryBuilder.andWhere('b.type = :type', { type });
    }

    const bookmarks = await queryBuilder.getRawMany();

    res.json({
      bookmarks,
      total: bookmarks.length
    });
  } catch (err) {
    console.error('Failed to get bookmarks:', err);
    res.status(500).json({ error: 'Failed to get bookmarks' });
  }
});

// GET /api/v1/bookmarks/:id - Get single bookmark
bookmarksRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.id = :id AND b.user_id = :userId', { id, userId })
      .getRawOne();

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    res.json(bookmark);
  } catch (err) {
    console.error('Failed to get bookmark:', err);
    res.status(500).json({ error: 'Failed to get bookmark' });
  }
});

// POST /api/v1/bookmarks - Create new bookmark
bookmarksRouter.post('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      url,
      type,
      title,
      description,
      thumbnail,
      channel_name,
      subscriber_count,
      video_count,
      metadata = {},
      // TMDB-specific fields
      tmdb_id,
      media_type,
      release_year,
      vote_average,
      backdrop_url
    } = req.body;

    // Validate TMDB bookmarks
    if (type?.startsWith('tmdb_')) {
      if (!tmdb_id || !media_type) {
        return res.status(400).json({
          error: 'tmdb_id and media_type are required for TMDB bookmarks'
        });
      }

      // Check for duplicate TMDB bookmark
      const existing = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('bookmarks', 'b')
        .where('b.user_id = :userId AND b.tmdb_id = :tmdbId AND b.media_type = :mediaType', {
          userId,
          tmdbId: tmdb_id,
          mediaType: media_type
        })
        .getRawOne();

      if (existing) {
        return res.status(409).json({
          error: 'Already in watchlist',
          bookmark: existing
        });
      }
    } else {
      // Validate URL-based bookmarks (YouTube, SoundCloud, etc.)
      if (!url || !type || !title) {
        return res.status(400).json({
          error: 'URL, type, and title are required'
        });
      }

      // Check if bookmark already exists
      const existing = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('bookmarks', 'b')
        .where('b.user_id = :userId AND b.url = :url', { userId, url })
        .getRawOne();

      if (existing) {
        return res.status(409).json({
          error: 'Bookmark already exists',
          bookmark: existing
        });
      }
    }

    const insertResult = await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('bookmarks')
      .values({
        user_id: userId,
        url: url || null,
        type,
        title,
        description,
        thumbnail,
        channel_name,
        subscriber_count,
        video_count,
        metadata,
        // TMDB fields
        tmdb_id: tmdb_id || null,
        media_type: media_type || null,
        release_year: release_year || null,
        vote_average: vote_average || null,
        backdrop_url: backdrop_url || null
      })
      .returning('*')
      .execute();

    const bookmark = insertResult.raw[0];
    res.status(201).json(bookmark);
  } catch (err) {
    console.error('Failed to create bookmark:', err);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
});

// PUT /api/v1/bookmarks/:id - Update bookmark
bookmarksRouter.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const {
      title,
      description,
      thumbnail,
      channel_name,
      subscriber_count,
      video_count
    } = req.body;

    // Check if bookmark exists and belongs to user
    const bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.id = :id AND b.user_id = :userId', { id, userId })
      .getRawOne();

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;
    if (channel_name !== undefined) updates.channel_name = channel_name;
    if (subscriber_count !== undefined) updates.subscriber_count = subscriber_count;
    if (video_count !== undefined) updates.video_count = video_count;

    const updateResult = await AppDataSource
      .createQueryBuilder()
      .update('bookmarks')
      .set(updates)
      .where('id = :id', { id })
      .returning('*')
      .execute();

    const updatedBookmark = updateResult.raw[0];
    res.json(updatedBookmark);
  } catch (err) {
    console.error('Failed to update bookmark:', err);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
});

// DELETE /api/v1/bookmarks/:id - Delete bookmark
bookmarksRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.id = :id AND b.user_id = :userId', { id, userId })
      .getRawOne();

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    await AppDataSource
      .createQueryBuilder()
      .delete()
      .from('bookmarks')
      .where('id = :id', { id })
      .execute();

    res.json({ message: 'Bookmark deleted' });
  } catch (err) {
    console.error('Failed to delete bookmark:', err);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// DELETE /api/v1/bookmarks/by-url - Delete bookmark by URL
bookmarksRouter.delete('/by-url/:encodedUrl', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const url = decodeURIComponent(req.params.encodedUrl);

    const bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.user_id = :userId AND b.url = :url', { userId, url })
      .getRawOne();

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    await AppDataSource
      .createQueryBuilder()
      .delete()
      .from('bookmarks')
      .where('id = :id', { id: bookmark.id })
      .execute();

    res.json({ message: 'Bookmark deleted' });
  } catch (err) {
    console.error('Failed to delete bookmark:', err);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// Helper function to normalize YouTube URLs for comparison
// Removes protocol, www, trailing slashes, and /videos suffix for consistent matching
function normalizeYouTubeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/videos$/, '')
    .replace(/\/$/, '');
}

// GET /api/v1/bookmarks/check-tmdb/:tmdbId - Check if TMDB item is bookmarked
bookmarksRouter.get('/check-tmdb/:tmdbId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const tmdbId = parseInt(req.params.tmdbId);
    const mediaType = req.query.mediaType as string;

    if (!mediaType) {
      return res.status(400).json({ error: 'mediaType query parameter is required' });
    }

    const bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.user_id = :userId AND b.tmdb_id = :tmdbId AND b.media_type = :mediaType', {
        userId,
        tmdbId,
        mediaType
      })
      .getRawOne();

    res.json({
      isBookmarked: !!bookmark,
      bookmark: bookmark || null
    });
  } catch (err) {
    console.error('Failed to check TMDB bookmark:', err);
    res.status(500).json({ error: 'Failed to check bookmark' });
  }
});

// GET /api/v1/bookmarks/check/:encodedUrl - Check if URL is bookmarked
bookmarksRouter.get('/check/:encodedUrl', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const url = decodeURIComponent(req.params.encodedUrl);

    // Try exact match first
    let bookmark = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('bookmarks', 'b')
      .where('b.user_id = :userId AND b.url = :url', { userId, url })
      .getRawOne();

    // If no exact match and it's a YouTube URL, try normalized matching
    if (!bookmark && url.includes('youtube.com')) {
      const normalizedUrl = normalizeYouTubeUrl(url);
      console.log('[Bookmark Check] No exact match, trying normalized:', normalizedUrl);

      // Get all user's YouTube bookmarks and check with normalization
      const allBookmarks = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('bookmarks', 'b')
        .where('b.user_id = :userId AND (b.type = :yt_channel OR b.type = :yt_playlist)', {
          userId,
          yt_channel: 'youtube_channel',
          yt_playlist: 'youtube_playlist'
        })
        .getRawMany();

      bookmark = allBookmarks.find(b => normalizeYouTubeUrl(b.url) === normalizedUrl);

      if (bookmark) {
        console.log('[Bookmark Check] Found via normalized match:', bookmark.url);
      }
    }

    res.json({
      isBookmarked: !!bookmark,
      bookmark: bookmark || null
    });
  } catch (err) {
    console.error('Failed to check bookmark:', err);
    res.status(500).json({ error: 'Failed to check bookmark' });
  }
});
