import express from 'express';
import { auth } from '../auth.js';
import { bazarrService } from '../services/bazarr.service.js';
import { AppDataSource } from '../data-source.js';

export const bazarrRouter = express.Router();

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

// GET /api/v1/bazarr/status - Get Bazarr system status
bazarrRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get user's Bazarr config from preferences
    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Bazarr is not enabled',
      });
    }

    const status = await bazarrService.getStatus();
    res.json(status);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get status:', err);
    res.status(500).json({ error: 'Failed to get Bazarr status' });
  }
});

// GET /api/v1/bazarr/languages - Get available subtitle languages
bazarrRouter.get('/languages', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const languages = await bazarrService.getLanguages();
    res.json(languages);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get languages:', err);
    res.status(500).json({ error: 'Failed to get languages from Bazarr' });
  }
});

// GET /api/v1/bazarr/movies - Get all movies with subtitle status
bazarrRouter.get('/movies', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const movies = await bazarrService.getMovies();
    res.json(movies);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get movies:', err);
    res.status(500).json({ error: 'Failed to get movies from Bazarr' });
  }
});

// GET /api/v1/bazarr/series - Get all series with subtitle status
bazarrRouter.get('/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const series = await bazarrService.getSeries();
    res.json(series);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get series:', err);
    res.status(500).json({ error: 'Failed to get series from Bazarr' });
  }
});

// GET /api/v1/bazarr/missing/movies - Get movies missing subtitles
bazarrRouter.get('/missing/movies', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const movies = await bazarrService.getMissingMovieSubtitles();
    res.json(movies);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get missing movie subtitles:', err);
    res.status(500).json({ error: 'Failed to get missing movie subtitles' });
  }
});

// GET /api/v1/bazarr/missing/series - Get series episodes missing subtitles
bazarrRouter.get('/missing/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const series = await bazarrService.getMissingSeriesSubtitles();
    res.json(series);
  } catch (err) {
    console.error('[BazarrAPI] Failed to get missing series subtitles:', err);
    res.status(500).json({ error: 'Failed to get missing series subtitles' });
  }
});

// POST /api/v1/bazarr/search/movie - Search for movie subtitles
bazarrRouter.post('/search/movie', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { radarrId, language } = req.body;

    if (!radarrId || !language) {
      return res.status(400).json({ error: 'radarrId and language are required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const results = await bazarrService.searchMovieSubtitles(radarrId, language);
    res.json(results);
  } catch (err) {
    console.error('[BazarrAPI] Failed to search movie subtitles:', err);
    res.status(500).json({ error: 'Failed to search subtitles' });
  }
});

// POST /api/v1/bazarr/search/series - Search for series subtitles
bazarrRouter.post('/search/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { episodeId, language } = req.body;

    if (!episodeId || !language) {
      return res.status(400).json({ error: 'episodeId and language are required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const results = await bazarrService.searchSeriesSubtitles(episodeId, language);
    res.json(results);
  } catch (err) {
    console.error('[BazarrAPI] Failed to search series subtitles:', err);
    res.status(500).json({ error: 'Failed to search subtitles' });
  }
});

// POST /api/v1/bazarr/download/movie - Download subtitle for a movie
bazarrRouter.post('/download/movie', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { radarrId, language, subtitleId, hi, forced } = req.body;

    if (!radarrId || !language || !subtitleId) {
      return res.status(400).json({
        error: 'radarrId, language, and subtitleId are required',
      });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const result = await bazarrService.downloadMovieSubtitle(
      radarrId,
      language,
      subtitleId,
      hi || false,
      forced || false
    );

    res.json(result);
  } catch (err) {
    console.error('[BazarrAPI] Failed to download movie subtitle:', err);
    res.status(500).json({ error: 'Failed to download subtitle' });
  }
});

// POST /api/v1/bazarr/download/series - Download subtitle for a series episode
bazarrRouter.post('/download/series', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { episodeId, language, subtitleId, hi, forced } = req.body;

    if (!episodeId || !language || !subtitleId) {
      return res.status(400).json({
        error: 'episodeId, language, and subtitleId are required',
      });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const result = await bazarrService.downloadSeriesSubtitle(
      episodeId,
      language,
      subtitleId,
      hi || false,
      forced || false
    );

    res.json(result);
  } catch (err) {
    console.error('[BazarrAPI] Failed to download series subtitle:', err);
    res.status(500).json({ error: 'Failed to download subtitle' });
  }
});

// POST /api/v1/bazarr/auto-download - Auto-download subtitles for a movie by TMDB ID
bazarrRouter.post('/auto-download', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { tmdbId, languages } = req.body;

    if (!tmdbId) {
      return res.status(400).json({ error: 'tmdbId is required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    // Use user's preferred languages if not specified
    const languagesToDownload = languages || prefs.bazarr_subtitle_languages || ['en'];

    const result = await bazarrService.autoDownloadMovieSubtitles(
      tmdbId,
      languagesToDownload
    );

    res.json(result);
  } catch (err) {
    console.error('[BazarrAPI] Failed to auto-download subtitles:', err);
    res.status(500).json({ error: 'Failed to auto-download subtitles' });
  }
});

// POST /api/v1/bazarr/search-all-missing - Trigger search for all missing subtitles
bazarrRouter.post('/search-all-missing', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.bazarr_enabled) {
      return res.status(400).json({ error: 'Bazarr is not enabled' });
    }

    const result = await bazarrService.searchAllMissing();
    res.json(result);
  } catch (err) {
    console.error('[BazarrAPI] Failed to trigger missing subtitle search:', err);
    res.status(500).json({ error: 'Failed to trigger search' });
  }
});

// POST /api/v1/bazarr/test - Test connection to Bazarr
bazarrRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const { url, apiKey } = req.body;

    if (!url || !apiKey) {
      return res.status(400).json({ error: 'url and apiKey are required' });
    }

    // Parse URL to get host and port
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const port = parseInt(urlObj.port || '6767');

    // Create a temporary service instance to test
    bazarrService.configure({ host, port, apiKey });

    const isConnected = await bazarrService.testConnection();

    if (isConnected) {
      const status = await bazarrService.getSystemStatus();
      res.json({
        success: true,
        version: status.bazarr_version,
        message: 'Connected to Bazarr successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to connect to Bazarr. Please check your URL and API key.',
      });
    }
  } catch (err: any) {
    console.error('[BazarrAPI] Connection test failed:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to connect to Bazarr',
    });
  }
});
