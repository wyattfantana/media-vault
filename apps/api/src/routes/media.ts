import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';
import fs from 'fs/promises';
import path from 'path';

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

// GET /api/v1/media - Get all media for current user
mediaRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      type,
      limit = 50,
      offset = 0,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

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
      .orderBy(`m.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .limit(Number(limit))
      .offset(Number(offset));

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
      limit: Number(limit),
      offset: Number(offset)
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
