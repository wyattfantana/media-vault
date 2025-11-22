import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';

export const presetsRouter = express.Router();

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

// GET /api/v1/presets - Get all presets for current user
// Query params: ?platform=youtube (optional) - filter by platform
presetsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { platform } = req.query;

    const queryBuilder = AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.user_id = :userId', { userId });

    // Filter by platform if specified, or show global + platform-specific presets
    if (platform) {
      queryBuilder.andWhere('(p.platform = :platform OR p.platform IS NULL)', { platform });
    }

    const presets = await queryBuilder
      .orderBy('p.platform IS NULL', 'ASC') // Platform-specific first, then global
      .addOrderBy('p.is_default', 'DESC')
      .addOrderBy('p.usage_count', 'DESC')
      .addOrderBy('p.name', 'ASC')
      .getRawMany();

    res.json({
      presets,
      total: presets.length
    });
  } catch (err) {
    console.error('Failed to get presets:', err);
    res.status(500).json({ error: 'Failed to get presets' });
  }
});

// GET /api/v1/presets/default - Get user's default preset
presetsRouter.get('/default', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.user_id = :userId AND p.is_default = true', { userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'No default preset found' });
    }

    res.json(preset);
  } catch (err) {
    console.error('Failed to get default preset:', err);
    res.status(500).json({ error: 'Failed to get default preset' });
  }
});

// GET /api/v1/presets/:id - Get single preset
presetsRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.id = :id AND p.user_id = :userId', { id, userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json(preset);
  } catch (err) {
    console.error('Failed to get preset:', err);
    res.status(500).json({ error: 'Failed to get preset' });
  }
});

// POST /api/v1/presets - Create new preset
presetsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      name,
      description,
      platform, // NEW: platform-specific preset (null = global)
      quality = 'best',
      format = 'mp4',
      auto_organize = true,
      base_folder,
      subfolder_pattern,
      filename_pattern,
      embed_metadata = true,
      embed_thumbnail = true,
      embed_subtitles = false,
      subtitle_languages = [],
      extract_audio = false,
      is_default = false
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Preset name is required' });
    }

    // Check if preset name already exists for this user
    const existing = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.user_id = :userId AND p.name = :name', { userId, name })
      .getRawOne();

    if (existing) {
      return res.status(409).json({
        error: 'A preset with this name already exists',
        preset: existing
      });
    }

    // If this is being set as default, unset other defaults
    if (is_default) {
      await AppDataSource
        .createQueryBuilder()
        .update('download_presets')
        .set({ is_default: false })
        .where('user_id = :userId', { userId })
        .execute();
    }

    const insertResult = await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('download_presets')
      .values({
        user_id: userId,
        name,
        description,
        platform: platform || null, // NULL = global preset
        quality,
        format,
        auto_organize,
        base_folder,
        subfolder_pattern,
        filename_pattern,
        embed_metadata,
        embed_thumbnail,
        embed_subtitles,
        subtitle_languages,
        extract_audio,
        is_default
      })
      .returning('*')
      .execute();

    const preset = insertResult.raw[0];
    res.status(201).json(preset);
  } catch (err) {
    console.error('Failed to create preset:', err);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

// PUT /api/v1/presets/:id - Update preset
presetsRouter.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const {
      name,
      description,
      platform, // NEW: can update platform
      quality,
      format,
      auto_organize,
      base_folder,
      subfolder_pattern,
      filename_pattern,
      embed_metadata,
      embed_thumbnail,
      embed_subtitles,
      subtitle_languages,
      extract_audio,
      is_default
    } = req.body;

    // Check if preset exists and belongs to user
    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.id = :id AND p.user_id = :userId', { id, userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // If setting as default, unset other defaults
    if (is_default && !preset.is_default) {
      await AppDataSource
        .createQueryBuilder()
        .update('download_presets')
        .set({ is_default: false })
        .where('user_id = :userId', { userId })
        .execute();
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (platform !== undefined) updates.platform = platform || null; // NEW: update platform
    if (quality !== undefined) updates.quality = quality;
    if (format !== undefined) updates.format = format;
    if (auto_organize !== undefined) updates.auto_organize = auto_organize;
    if (base_folder !== undefined) updates.base_folder = base_folder;
    if (subfolder_pattern !== undefined) updates.subfolder_pattern = subfolder_pattern;
    if (filename_pattern !== undefined) updates.filename_pattern = filename_pattern;
    if (embed_metadata !== undefined) updates.embed_metadata = embed_metadata;
    if (embed_thumbnail !== undefined) updates.embed_thumbnail = embed_thumbnail;
    if (embed_subtitles !== undefined) updates.embed_subtitles = embed_subtitles;
    if (subtitle_languages !== undefined) updates.subtitle_languages = subtitle_languages;
    if (extract_audio !== undefined) updates.extract_audio = extract_audio;
    if (is_default !== undefined) updates.is_default = is_default;

    const updateResult = await AppDataSource
      .createQueryBuilder()
      .update('download_presets')
      .set(updates)
      .where('id = :id', { id })
      .returning('*')
      .execute();

    const updatedPreset = updateResult.raw[0];
    res.json(updatedPreset);
  } catch (err) {
    console.error('Failed to update preset:', err);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

// DELETE /api/v1/presets/:id - Delete preset
presetsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.id = :id AND p.user_id = :userId', { id, userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // If deleting the default preset, warn the user
    if (preset.is_default) {
      // Check if there are other presets
      const otherPresets = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('download_presets', 'p')
        .where('p.user_id = :userId AND p.id != :id', { userId, id })
        .getRawMany();

      // Auto-set another preset as default if available
      if (otherPresets.length > 0) {
        await AppDataSource
          .createQueryBuilder()
          .update('download_presets')
          .set({ is_default: true })
          .where('id = :newDefaultId', { newDefaultId: otherPresets[0].id })
          .execute();
      }
    }

    await AppDataSource
      .createQueryBuilder()
      .delete()
      .from('download_presets')
      .where('id = :id', { id })
      .execute();

    res.json({ message: 'Preset deleted' });
  } catch (err) {
    console.error('Failed to delete preset:', err);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// POST /api/v1/presets/:id/set-default - Set preset as default
presetsRouter.post('/:id/set-default', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.id = :id AND p.user_id = :userId', { id, userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Unset all other defaults for this user
    await AppDataSource
      .createQueryBuilder()
      .update('download_presets')
      .set({ is_default: false })
      .where('user_id = :userId', { userId })
      .execute();

    // Set this one as default
    const updateResult = await AppDataSource
      .createQueryBuilder()
      .update('download_presets')
      .set({ is_default: true })
      .where('id = :id', { id })
      .returning('*')
      .execute();

    const updatedPreset = updateResult.raw[0];
    res.json(updatedPreset);
  } catch (err) {
    console.error('Failed to set default preset:', err);
    res.status(500).json({ error: 'Failed to set default preset' });
  }
});

// POST /api/v1/presets/:id/use - Increment usage counter and update last_used_at
presetsRouter.post('/:id/use', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const preset = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('download_presets', 'p')
      .where('p.id = :id AND p.user_id = :userId', { id, userId })
      .getRawOne();

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const updateResult = await AppDataSource
      .createQueryBuilder()
      .update('download_presets')
      .set({
        usage_count: () => 'usage_count + 1',
        last_used_at: new Date()
      })
      .where('id = :id', { id })
      .returning('*')
      .execute();

    const updatedPreset = updateResult.raw[0];
    res.json(updatedPreset);
  } catch (err) {
    console.error('Failed to update preset usage:', err);
    res.status(500).json({ error: 'Failed to update preset usage' });
  }
});
