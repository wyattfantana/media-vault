import express from 'express';
import { auth } from '../auth.js';
import { radarrService } from '../services/radarr.service.js';
import { AppDataSource } from '../data-source.js';

export const radarrRouter = express.Router();

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

// GET /api/v1/radarr/status - Get Radarr system status
radarrRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get user's Radarr config from preferences
    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    // Update service with user's config
    radarrService.updateApiKey(prefs.radarr_api_key);

    const status = await radarrService.getSystemStatus();
    res.json(status);
  } catch (err) {
    console.error('Failed to get Radarr status:', err);
    res.status(500).json({ error: 'Failed to get Radarr status' });
  }
});

// GET /api/v1/radarr/movies - Get all movies in Radarr
radarrRouter.get('/movies', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    const movies = await radarrService.getMovies();
    res.json(movies);
  } catch (err) {
    console.error('Failed to get Radarr movies:', err);
    res.status(500).json({ error: 'Failed to get movies from Radarr' });
  }
});

// GET /api/v1/radarr/search - Search for a movie
radarrRouter.get('/search', requireAuth, async (req, res) => {
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

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    const results = await radarrService.searchMovie(term as string);
    res.json(results);
  } catch (err) {
    console.error('Failed to search for movie:', err);
    res.status(500).json({ error: 'Failed to search for movie' });
  }
});

// POST /api/v1/radarr/movies - Add a movie to Radarr
radarrRouter.post('/movies', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, year, tmdbId, qualityProfileId, rootFolderPath, monitored, searchForMovie } = req.body;

    if (!title || !year || !tmdbId) {
      return res.status(400).json({ error: 'Title, year, and TMDB ID are required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    // Get default quality profile and root folder if not provided
    let qProfileId = qualityProfileId;
    let rFolderPath = rootFolderPath;

    if (!qProfileId) {
      const profiles = await radarrService.getQualityProfiles();
      qProfileId = profiles[0]?.id;
    }

    if (!rFolderPath) {
      const folders = await radarrService.getRootFolders();
      rFolderPath = folders[0]?.path;
    }

    if (!qProfileId || !rFolderPath) {
      return res.status(400).json({
        error: 'Quality profile and root folder must be configured in Radarr first'
      });
    }

    const movie = await radarrService.addMovie({
      title,
      year,
      tmdbId,
      qualityProfileId: qProfileId,
      rootFolderPath: rFolderPath,
      monitored,
      searchForMovie,
    });

    // Track in arr_automation table
    await AppDataSource
      .createQueryBuilder()
      .insert()
      .into('arr_automation')
      .values({
        user_id: userId,
        service_type: 'radarr',
        tmdb_id: tmdbId,
        media_type: 'movie',
        service_id: movie.id,
        status: 'added',
      })
      .onConflict('(user_id, service_type, tmdb_id) DO UPDATE SET service_id = EXCLUDED.service_id, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP')
      .execute();

    res.json(movie);
  } catch (err: any) {
    console.error('Failed to add movie to Radarr:', err);
    res.status(500).json({
      error: err.message || 'Failed to add movie to Radarr'
    });
  }
});

// DELETE /api/v1/radarr/movies/:id - Remove a movie from Radarr
radarrRouter.delete('/movies/:id', requireAuth, async (req, res) => {
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

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    await radarrService.removeMovie(parseInt(id), deleteFiles === 'true');

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove movie from Radarr:', err);
    res.status(500).json({ error: 'Failed to remove movie from Radarr' });
  }
});

// GET /api/v1/radarr/quality-profiles - Get quality profiles
radarrRouter.get('/quality-profiles', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    const profiles = await radarrService.getQualityProfiles();
    res.json(profiles);
  } catch (err) {
    console.error('Failed to get quality profiles:', err);
    res.status(500).json({ error: 'Failed to get quality profiles' });
  }
});

// GET /api/v1/radarr/root-folders - Get root folders
radarrRouter.get('/root-folders', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    const folders = await radarrService.getRootFolders();
    res.json(folders);
  } catch (err) {
    console.error('Failed to get root folders:', err);
    res.status(500).json({ error: 'Failed to get root folders' });
  }
});

// GET /api/v1/radarr/queue - Get download queue
radarrRouter.get('/queue', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    const queue = await radarrService.getQueue();
    res.json(queue);
  } catch (err) {
    console.error('Failed to get Radarr queue:', err);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// POST /api/v1/radarr/movies/:id/search - Trigger movie search
radarrRouter.post('/movies/:id/search', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    await radarrService.searchMovieReleases(parseInt(id));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to trigger movie search:', err);
    res.status(500).json({ error: 'Failed to trigger search' });
  }
});

// GET /api/v1/radarr/releases/:movieId - Get available releases for a movie
radarrRouter.get('/releases/:movieId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { movieId } = req.params;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    // First add movie to Radarr (unmonitored) so we can search for releases
    const releases = await radarrService.getReleases(parseInt(movieId));
    res.json(releases);
  } catch (err) {
    console.error('Failed to get releases:', err);
    res.status(500).json({ error: 'Failed to get releases' });
  }
});

// POST /api/v1/radarr/releases/download - Download a specific release
radarrRouter.post('/releases/download', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { guid, indexerId } = req.body;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.radarr_enabled) {
      return res.status(400).json({ error: 'Radarr is not enabled' });
    }

    radarrService.updateApiKey(prefs.radarr_api_key);

    await radarrService.downloadRelease(guid, indexerId);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to download release:', err);
    res.status(500).json({ error: 'Failed to download release' });
  }
});
