import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';
import fs from 'fs/promises';
import path from 'path';
import { MediaFilterSchema } from '../schemas/filters.schema.js';

export const mediaRouter = express.Router();

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

// GET /api/v1/media/stats - Get media statistics (MUST be before /:id route)
mediaRouter.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const typeStats = await AppDataSource
      .createQueryBuilder()
      .select('media_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(file_size)', 'total_size')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .groupBy('media_type')
      .getRawMany();

    const totalStats = await AppDataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'total_items')
      .addSelect('SUM(file_size)', 'total_size')
      .addSelect('SUM(duration)', 'total_duration')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .getRawOne();

    res.json({
      by_type: typeStats,
      total: {
        total_items: parseInt(totalStats.total_items) || 0,
        total_size: parseInt(totalStats.total_size) || 0,
        total_duration: parseInt(totalStats.total_duration) || 0
      }
    });
  } catch (err) {
    console.error('Failed to get media stats:', err);
    res.status(500).json({ error: 'Failed to get media stats' });
  }
});

// GET /api/v1/media/downloaded-tmdb-ids - Get all downloaded TMDB IDs for current user
mediaRouter.get('/downloaded-tmdb-ids', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const results = await AppDataSource
      .createQueryBuilder()
      .select('DISTINCT tmdb_id', 'tmdb_id')
      .addSelect('tmdb_media_type', 'media_type')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.tmdb_id IS NOT NULL')
      .getRawMany();

    // Return as an object with arrays by media type for easy lookup
    const downloadedIds = {
      movie: results.filter(r => r.media_type === 'movie').map(r => r.tmdb_id),
      tv: results.filter(r => r.media_type === 'tv').map(r => r.tmdb_id),
      documentary: results.filter(r => r.media_type === 'documentary').map(r => r.tmdb_id)
    };

    res.json(downloadedIds);
  } catch (err) {
    console.error('Failed to get downloaded TMDB IDs:', err);
    res.status(500).json({ error: 'Failed to get downloaded TMDB IDs' });
  }
});

// GET /api/v1/media - Get all media for current user
mediaRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate and parse query parameters using Zod schema
    const validationResult = MediaFilterSchema.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid filter parameters',
        details: validationResult.error.issues
      });
    }

    const { type, limit, offset, search, sortBy, sortOrder } = validationResult.data;

    const queryBuilder = AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId });

    if (type) {
      queryBuilder.andWhere('m.media_type = :type', { type });
    }

    if (search) {
      queryBuilder.andWhere(
        '(m.title ILIKE :search OR m.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    queryBuilder
      .orderBy(`m.${sortBy}`, sortOrder)
      .limit(limit)
      .offset(offset);

    const media = await queryBuilder.getRawMany();

    const countResult = await AppDataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .getRawOne();

    res.json({
      media,
      total: parseInt(countResult.count),
      limit,
      offset
    });
  } catch (err) {
    console.error('Failed to get media:', err);
    res.status(500).json({ error: 'Failed to get media' });
  }
});

// GET /api/v1/media/:id - Get single media item
mediaRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const mediaItem = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.id = :id AND m.user_id = :userId', { id, userId })
      .getRawOne();

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Check if file still exists
    try {
      await fs.access(mediaItem.file_path);
      mediaItem.file_exists = true;
    } catch {
      mediaItem.file_exists = false;
    }

    res.json(mediaItem);
  } catch (err) {
    console.error('Failed to get media:', err);
    res.status(500).json({ error: 'Failed to get media' });
  }
});

// POST /api/v1/media - Create new media entry
mediaRouter.post('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      download_id,
      title,
      description,
      file_path,
      file_size,
      duration,
      format,
      resolution,
      thumbnail,
      media_type,
      source,
      metadata = {}
    } = req.body;

    if (!title || !file_path || !media_type) {
      return res.status(400).json({
        error: 'Title, file_path, and media_type are required'
      });
    }

    // Check if file exists
    try {
      const stats = await fs.stat(file_path);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'File path is not a file' });
      }
    } catch {
      return res.status(400).json({ error: 'File does not exist' });
    }

    const insertResult = await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('media')
      .values({
        download_id,
        user_id: userId,
        title,
        description,
        file_path,
        file_size,
        duration,
        format,
        resolution,
        thumbnail,
        media_type,
        source,
        metadata: JSON.stringify(metadata)
      })
      .returning('*')
      .execute();

    const mediaItem = insertResult.raw[0];
    res.status(201).json(mediaItem);
  } catch (err) {
    console.error('Failed to create media:', err);
    res.status(500).json({ error: 'Failed to create media' });
  }
});

// PUT /api/v1/media/:id - Update media entry
mediaRouter.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const mediaItem = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.id = :id AND m.user_id = :userId', { id, userId })
      .getRawOne();

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const {
      title,
      description,
      media_type,
      thumbnail,
      metadata
    } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (media_type !== undefined) updateData.media_type = media_type;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    await AppDataSource
      .createQueryBuilder()
      .update('media')
      .set(updateData)
      .where('id = :id', { id })
      .execute();

    const updated = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.id = :id', { id })
      .getRawOne();

    res.json(updated);
  } catch (err) {
    console.error('Failed to update media:', err);
    res.status(500).json({ error: 'Failed to update media' });
  }
});

// DELETE /api/v1/media/:id - Delete media entry
mediaRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { deleteFile = false } = req.query;

    const mediaItem = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.id = :id AND m.user_id = :userId', { id, userId })
      .getRawOne();

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete the file if requested
    if (deleteFile === 'true') {
      try {
        await fs.unlink(mediaItem.file_path);
      } catch (err) {
        console.error('Failed to delete file:', err);
        // Continue anyway, file might already be deleted
      }
    }

    await AppDataSource
      .createQueryBuilder()
      .delete()
      .from('media')
      .where('id = :id', { id })
      .execute();

    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('Failed to delete media:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// POST /api/v1/media/bulk-organize - Reorganize multiple media files
mediaRouter.post('/bulk-organize', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { mediaIds, targetFolder, mode = 'copy' } = req.body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({ error: 'mediaIds array is required' });
    }

    if (!targetFolder) {
      return res.status(400).json({ error: 'targetFolder is required' });
    }

    const results = {
      succeeded: [] as string[],
      failed: [] as Array<{ id: string; error: string }>
    };

    // Ensure target folder exists
    await fs.mkdir(targetFolder, { recursive: true });

    for (const mediaId of mediaIds) {
      try {
        const mediaItem = await AppDataSource
          .createQueryBuilder()
          .select('*')
          .from('media', 'm')
          .where('m.id = :id AND m.user_id = :userId', { id: mediaId, userId })
          .getRawOne();

        if (!mediaItem) {
          results.failed.push({ id: mediaId, error: 'Media not found' });
          continue;
        }

        const oldPath = mediaItem.file_path;
        const fileName = path.basename(oldPath);
        const newPath = path.join(targetFolder, fileName);

        // Check if old file exists
        try {
          await fs.access(oldPath);
        } catch {
          results.failed.push({ id: mediaId, error: 'Source file not found' });
          continue;
        }

        // Move or copy the file
        if (mode === 'move') {
          await fs.rename(oldPath, newPath);
        } else {
          await fs.copyFile(oldPath, newPath);
        }

        // Update database
        await AppDataSource
          .createQueryBuilder()
          .update('media')
          .set({ file_path: newPath })
          .where('id = :id', { id: mediaId })
          .execute();

        results.succeeded.push(mediaId);
      } catch (err) {
        results.failed.push({
          id: mediaId,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: `Reorganized ${results.succeeded.length} of ${mediaIds.length} files`,
      results
    });
  } catch (err) {
    console.error('Failed to reorganize media:', err);
    res.status(500).json({ error: 'Failed to reorganize media' });
  }
});

// POST /api/v1/media/find-duplicates - Find duplicate media files
mediaRouter.post('/find-duplicates', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { method = 'source' } = req.body;

    let duplicates: any[] = [];

    if (method === 'source') {
      // Find duplicates by source URL
      const results = await AppDataSource.query(`
        SELECT source, COUNT(*) as count, array_agg(id) as media_ids, array_agg(title) as titles
        FROM media
        WHERE user_id = $1 AND source IS NOT NULL
        GROUP BY source
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `, [userId]);

      duplicates = results.map((row: any) => ({
        source: row.source,
        count: parseInt(row.count),
        mediaIds: row.media_ids,
        titles: row.titles
      }));
    } else if (method === 'title') {
      // Find duplicates by title
      const results = await AppDataSource.query(`
        SELECT title, COUNT(*) as count, array_agg(id) as media_ids, array_agg(file_path) as file_paths
        FROM media
        WHERE user_id = $1
        GROUP BY title
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `, [userId]);

      duplicates = results.map((row: any) => ({
        title: row.title,
        count: parseInt(row.count),
        mediaIds: row.media_ids,
        filePaths: row.file_paths
      }));
    } else if (method === 'filename') {
      // Find duplicates by filename (basename of file_path)
      const allMedia = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('media', 'm')
        .where('m.user_id = :userId', { userId })
        .getRawMany();

      const filenameMap = new Map<string, any[]>();
      allMedia.forEach(media => {
        const filename = path.basename(media.file_path);
        if (!filenameMap.has(filename)) {
          filenameMap.set(filename, []);
        }
        filenameMap.get(filename)!.push(media);
      });

      duplicates = Array.from(filenameMap.entries())
        .filter(([_, items]) => items.length > 1)
        .map(([filename, items]) => ({
          filename,
          count: items.length,
          mediaIds: items.map(i => i.id),
          filePaths: items.map(i => i.file_path)
        }));
    }

    res.json({
      method,
      total: duplicates.length,
      duplicates
    });
  } catch (err) {
    console.error('Failed to find duplicates:', err);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// GET /api/v1/media/:id/stream - Stream media file
mediaRouter.get('/:id/stream', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const mediaItem = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.id = :id AND m.user_id = :userId', { id, userId })
      .getRawOne();

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Check if file exists
    try {
      await fs.access(mediaItem.file_path);
    } catch {
      return res.status(404).json({ error: 'Media file not found' });
    }

    // Stream the file
    const stat = await fs.stat(mediaItem.file_path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });

      const readStream = require('fs').createReadStream(mediaItem.file_path, { start, end });
      readStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });

      const readStream = require('fs').createReadStream(mediaItem.file_path);
      readStream.pipe(res);
    }
  } catch (err) {
    console.error('Failed to stream media:', err);
    res.status(500).json({ error: 'Failed to stream media' });
  }
});
