import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';

export const recommendationsRouter = express.Router();

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

// GET /api/v1/recommendations - Get personalized recommendations
recommendationsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 20, type } = req.query; // type: 'movies' | 'tv' | 'documentaries'

    // Get user's download history
    const downloads = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('downloads', 'd')
      .where('d.user_id = :userId', { userId })
      .andWhere('d.status = :status', { status: 'completed' })
      .orderBy('d.created_at', 'DESC')
      .limit(100) // Analyze last 100 downloads
      .getRawMany();

    if (downloads.length === 0) {
      // No history, return empty recommendations
      return res.json({
        recommendations: [],
        genrePreferences: [],
        message: 'Start downloading content to get personalized recommendations!'
      });
    }

    // Analyze download history to extract genre preferences
    const genreCount = new Map<number, number>();
    const categoryCount = new Map<string, number>();

    downloads.forEach(download => {
      try {
        const metadata = typeof download.metadata === 'string'
          ? JSON.parse(download.metadata)
          : download.metadata;

        // Count categories
        if (download.category) {
          categoryCount.set(download.category, (categoryCount.get(download.category) || 0) + 1);
        }

        // Count genres (from TMDB metadata)
        if (metadata && metadata.genre_ids && Array.isArray(metadata.genre_ids)) {
          metadata.genre_ids.forEach((genreId: number) => {
            genreCount.set(genreId, (genreCount.get(genreId) || 0) + 1);
          });
        }
      } catch (err) {
        // Skip invalid metadata
      }
    });

    // Get top genres (sorted by frequency)
    const topGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genreId]) => genreId);

    // Get preferred category
    const preferredCategory = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'movies';

    res.json({
      recommendations: [],
      genrePreferences: topGenres,
      categoryPreferences: Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count })),
      preferredCategory,
      downloadCount: downloads.length
    });
  } catch (err) {
    console.error('Failed to get recommendations:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

export default recommendationsRouter;
