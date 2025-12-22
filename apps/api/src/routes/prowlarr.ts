import express from 'express';
import { auth } from '../auth.js';
import { prowlarrService } from '../services/prowlarr.service.js';
import { AppDataSource } from '../data-source.js';

export const prowlarrRouter = express.Router();

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

// GET /api/v1/prowlarr/status - Get Prowlarr system status
prowlarrRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get user's Prowlarr config from preferences
    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    // Update service with user's config
    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    const status = await prowlarrService.getSystemStatus();
    res.json(status);
  } catch (err) {
    console.error('Failed to get Prowlarr status:', err);
    res.status(500).json({ error: 'Failed to get Prowlarr status' });
  }
});

// GET /api/v1/prowlarr/indexers - Get all indexers
prowlarrRouter.get('/indexers', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    const indexers = await prowlarrService.getIndexers();
    res.json(indexers);
  } catch (err) {
    console.error('Failed to get Prowlarr indexers:', err);
    res.status(500).json({ error: 'Failed to get indexers from Prowlarr' });
  }
});

// GET /api/v1/prowlarr/search - Search across all indexers
prowlarrRouter.get('/search', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { query, type } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    const results = await prowlarrService.search(
      query as string,
      type as 'movie' | 'tv' | undefined
    );
    res.json(results);
  } catch (err) {
    console.error('Failed to search in Prowlarr:', err);
    res.status(500).json({ error: 'Failed to search indexers' });
  }
});

// GET /api/v1/prowlarr/applications - Get all applications (Sonarr/Radarr connections)
prowlarrRouter.get('/applications', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    const applications = await prowlarrService.getApplications();
    res.json(applications);
  } catch (err) {
    console.error('Failed to get Prowlarr applications:', err);
    res.status(500).json({ error: 'Failed to get applications from Prowlarr' });
  }
});

// POST /api/v1/prowlarr/applications - Add an application (Sonarr or Radarr)
prowlarrRouter.post('/applications', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, implementation, baseUrl, apiKey, syncLevel } = req.body;

    if (!name || !implementation || !baseUrl || !apiKey) {
      return res.status(400).json({
        error: 'Name, implementation, baseUrl, and apiKey are required',
      });
    }

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    const application = await prowlarrService.addApplication({
      name,
      implementation,
      baseUrl,
      apiKey,
      syncLevel: syncLevel || 'fullSync',
    });

    res.json(application);
  } catch (err: any) {
    console.error('Failed to add application to Prowlarr:', err);
    res.status(500).json({
      error: err.message || 'Failed to add application to Prowlarr',
    });
  }
});

// DELETE /api/v1/prowlarr/applications/:id - Remove an application
prowlarrRouter.delete('/applications/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    await prowlarrService.removeApplication(parseInt(id));

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove application from Prowlarr:', err);
    res.status(500).json({ error: 'Failed to remove application from Prowlarr' });
  }
});

// POST /api/v1/prowlarr/sync - Sync indexers with applications
prowlarrRouter.post('/sync', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const prefs = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'up')
      .where('up.user_id = :userId', { userId })
      .getRawOne();

    if (!prefs || !prefs.prowlarr_enabled) {
      return res.status(400).json({ error: 'Prowlarr is not enabled' });
    }

    prowlarrService.updateApiKey(prefs.prowlarr_api_key);

    await prowlarrService.syncApplications();

    res.json({ success: true, message: 'Application sync initiated' });
  } catch (err) {
    console.error('Failed to sync applications:', err);
    res.status(500).json({ error: 'Failed to sync applications' });
  }
});
