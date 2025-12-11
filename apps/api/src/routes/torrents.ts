import express from 'express';
import { auth } from '../auth.js';
import { torrentSearchService } from '../services/torrent-search.service.js';

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
