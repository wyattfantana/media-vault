import express from 'express';
import { auth } from '../auth.js';
import { jellyfinService } from '../services/jellyfin.service.js';
import { fileOrganizerService } from '../services/file-organizer.service.js';

export const jellyfinRouter = express.Router();

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

// GET /api/v1/jellyfin/status - Get Jellyfin connection status
jellyfinRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await jellyfinService.getServerStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get Jellyfin status',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// GET /api/v1/jellyfin/libraries - Get Jellyfin libraries
jellyfinRouter.get('/libraries', requireAuth, async (req, res) => {
  try {
    const libraries = await jellyfinService.getLibraries();
    res.json({ libraries });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get libraries',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// POST /api/v1/jellyfin/scan - Trigger library scan
jellyfinRouter.post('/scan', requireAuth, async (req, res) => {
  try {
    const { libraryId } = req.body;
    const result = await jellyfinService.triggerLibraryScan(libraryId);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to trigger scan',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// GET /api/v1/jellyfin/organization-stats - Get file organization statistics
jellyfinRouter.get('/organization-stats', requireAuth, async (req, res) => {
  try {
    const stats = await fileOrganizerService.getOrganizationStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get organization stats',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// POST /api/v1/jellyfin/test-connection - Test Jellyfin connection
jellyfinRouter.post('/test-connection', requireAuth, async (req, res) => {
  try {
    const result = await jellyfinService.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to test connection',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});
