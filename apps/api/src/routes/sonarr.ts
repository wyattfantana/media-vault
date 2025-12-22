import express from 'express';
import { auth } from '../auth.js';
import { sonarrService } from '../services/sonarr.service.js';
import { AppDataSource } from '../data-source.js';

export const sonarrRouter = express.Router();

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

// GET /api/v1/sonarr/status - Get Sonarr system status
sonarrRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get user's Sonarr config from preferences
    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    // Update service with user's config
    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const status = await sonarrService.getSystemStatus();
    res.json(status);
  } catch (err) {
    console.error('Failed to get Sonarr status:', err);
    res.status(500).json({ error: 'Failed to get Sonarr status' });
  }
});

// GET /api/v1/sonarr/series - Get all TV series in Sonarr
sonarrRouter.get('/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const series = await sonarrService.getSeries();
    res.json(series);
  } catch (err) {
    console.error('Failed to get Sonarr series:', err);
    res.status(500).json({ error: 'Failed to get series from Sonarr' });
  }
});

// GET /api/v1/sonarr/search - Search for a TV series
sonarrRouter.get('/search', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { term } = req.query;

    if (!term) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const results = await sonarrService.searchSeries(term as string);
    res.json(results);
  } catch (err) {
    console.error('Failed to search for series:', err);
    res.status(500).json({ error: 'Failed to search for series' });
  }
});

// POST /api/v1/sonarr/series - Add a TV series to Sonarr
sonarrRouter.post('/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      title,
      year,
      tvdbId,
      qualityProfileId,
      rootFolderPath,
      monitored,
      seasonFolder,
      searchForMissingEpisodes,
      seasons,
    } = req.body;

    if (!title || !tvdbId) {
      return res.status(400).json({ error: 'Title and TVDB ID are required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    // Get default quality profile and root folder if not provided
    let qProfileId = qualityProfileId;
    let rFolderPath = rootFolderPath;

    if (!qProfileId) {
      const profiles = await sonarrService.getQualityProfiles();
      qProfileId = profiles[0]?.id;
    }

    if (!rFolderPath) {
      const folders = await sonarrService.getRootFolders();
      rFolderPath = folders[0]?.path;
    }

    if (!qProfileId || !rFolderPath) {
      return res.status(400).json({
        error: 'Quality profile and root folder must be configured in Sonarr first',
      });
    }

    const series = await sonarrService.addSeries({
      title,
      year,
      tvdbId,
      qualityProfileId: qProfileId,
      rootFolderPath: rFolderPath,
      monitored,
      seasonFolder,
      searchForMissingEpisodes,
      seasons,
    });

    // Track in arr_automation table
    await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('arr_automation')
      .values({
        user_id: userId,
        service_type: 'sonarr',
        tmdb_id: req.body.tmdbId || tvdbId, // Use TMDB ID if provided, fallback to TVDB
        media_type: 'tv',
        service_id: series.id,
        status: 'added',
      })
      .onConflict('(user_id, service_type, tmdb_id) DO UPDATE SET service_id = EXCLUDED.service_id, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP')
      .execute();

    res.json(series);
  } catch (err: any) {
    console.error('Failed to add series to Sonarr:', err);
    res.status(500).json({
      error: err.message || 'Failed to add series to Sonarr',
    });
  }
});

// DELETE /api/v1/sonarr/series/:id - Remove a TV series from Sonarr
sonarrRouter.delete('/series/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { deleteFiles } = req.query;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    await sonarrService.removeSeries(parseInt(id), deleteFiles === 'true');

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove series from Sonarr:', err);
    res.status(500).json({ error: 'Failed to remove series from Sonarr' });
  }
});

// GET /api/v1/sonarr/quality-profiles - Get quality profiles
sonarrRouter.get('/quality-profiles', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const profiles = await sonarrService.getQualityProfiles();
    res.json(profiles);
  } catch (err) {
    console.error('Failed to get quality profiles:', err);
    res.status(500).json({ error: 'Failed to get quality profiles' });
  }
});

// GET /api/v1/sonarr/root-folders - Get root folders
sonarrRouter.get('/root-folders', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const folders = await sonarrService.getRootFolders();
    res.json(folders);
  } catch (err) {
    console.error('Failed to get root folders:', err);
    res.status(500).json({ error: 'Failed to get root folders' });
  }
});

// GET /api/v1/sonarr/queue - Get download queue
sonarrRouter.get('/queue', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    const queue = await sonarrService.getQueue();
    res.json(queue);
  } catch (err) {
    console.error('Failed to get Sonarr queue:', err);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// POST /api/v1/sonarr/search/:id/:season - Search for a specific season
sonarrRouter.post('/search/:id/:season', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id, season } = req.params;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.sonarr_enabled) {
      return res.status(400).json({ error: 'Sonarr is not enabled' });
    }

    sonarrService.updateApiKey(prefs.sonarr_api_key);

    await sonarrService.searchSeason(parseInt(id), parseInt(season));

    res.json({ success: true, message: 'Season search initiated' });
  } catch (err) {
    console.error('Failed to search season:', err);
    res.status(500).json({ error: 'Failed to search season' });
  }
});
