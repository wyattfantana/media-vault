import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';

export const analyticsRouter = express.Router();

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

// GET /api/v1/analytics/downloads-timeline - Get downloads over time
analyticsRouter.get('/downloads-timeline', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { days = 30 } = req.query;

    const results = await AppDataSource.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM downloads
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [userId]);

    res.json({
      period_days: parseInt(days as string),
      data: results.map((row: any) => ({
        date: row.date,
        total: parseInt(row.count),
        completed: parseInt(row.completed),
        failed: parseInt(row.failed)
      }))
    });
  } catch (err) {
    console.error('Failed to get downloads timeline:', err);
    res.status(500).json({ error: 'Failed to get downloads timeline' });
  }
});

// GET /api/v1/analytics/platform-distribution - Get downloads by platform
analyticsRouter.get('/platform-distribution', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Analyze source URLs to determine platform
    const downloads = await AppDataSource
      .createQueryBuilder()
      .select('url, status')
      .from('downloads', 'd')
      .where('d.user_id = :userId', { userId })
      .getRawMany();

    const platformCounts: Record<string, { total: number; completed: number; failed: number }> = {};

    downloads.forEach(d => {
      let platform = 'Other';
      if (d.url.includes('youtube.com') || d.url.includes('youtu.be')) platform = 'YouTube';
      else if (d.url.includes('bbc.co.uk/iplayer')) platform = 'BBC iPlayer';
      else if (d.url.includes('soundcloud.com')) platform = 'SoundCloud';
      else if (d.url.includes('tiktok.com')) platform = 'TikTok';
      else if (d.url.includes('reddit.com')) platform = 'Reddit';
      else if (d.url.includes('vimeo.com')) platform = 'Vimeo';
      else if (d.url.includes('rumble.com')) platform = 'Rumble';

      if (!platformCounts[platform]) {
        platformCounts[platform] = { total: 0, completed: 0, failed: 0 };
      }

      platformCounts[platform].total++;
      if (d.status === 'completed') platformCounts[platform].completed++;
      if (d.status === 'failed') platformCounts[platform].failed++;
    });

    const distribution = Object.entries(platformCounts)
      .map(([platform, counts]) => ({
        platform,
        ...counts
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ distribution });
  } catch (err) {
    console.error('Failed to get platform distribution:', err);
    res.status(500).json({ error: 'Failed to get platform distribution' });
  }
});

// GET /api/v1/analytics/storage-breakdown - Get storage usage by category
analyticsRouter.get('/storage-breakdown', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const media = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .getRawMany();

    const categoryStorage: Record<string, { count: number; size: number; duration: number }> = {};

    media.forEach(m => {
      // Determine category from file_path
      let category = 'Other';
      const path = m.file_path.toLowerCase();

      if (path.includes('/movies/')) category = 'Movies';
      else if (path.includes('/tv/') || path.includes('/television/')) category = 'TV Shows';
      else if (path.includes('/music/')) category = 'Music';
      else if (path.includes('/documentaries/')) category = 'Documentaries';
      else if (path.includes('/podcasts/')) category = 'Podcasts';
      else if (path.includes('/youtube/')) category = 'YouTube';

      if (!categoryStorage[category]) {
        categoryStorage[category] = { count: 0, size: 0, duration: 0 };
      }

      categoryStorage[category].count++;
      categoryStorage[category].size += parseInt(m.file_size) || 0;
      categoryStorage[category].duration += parseInt(m.duration) || 0;
    });

    const breakdown = Object.entries(categoryStorage)
      .map(([category, stats]) => ({
        category,
        ...stats
      }))
      .sort((a, b) => b.size - a.size);

    res.json({ breakdown });
  } catch (err) {
    console.error('Failed to get storage breakdown:', err);
    res.status(500).json({ error: 'Failed to get storage breakdown' });
  }
});

// GET /api/v1/analytics/top-downloads - Get most downloaded content
analyticsRouter.get('/top-downloads', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 10 } = req.query;

    const topDownloads = await AppDataSource.query(`
      SELECT
        title,
        url,
        downloader,
        status,
        COUNT(*) as download_count
      FROM downloads
      WHERE user_id = $1 AND title IS NOT NULL
      GROUP BY title, url, downloader, status
      HAVING COUNT(*) > 1
      ORDER BY download_count DESC
      LIMIT $2
    `, [userId, parseInt(limit as string)]);

    res.json({
      topDownloads: topDownloads.map((row: any) => ({
        title: row.title,
        url: row.url,
        downloader: row.downloader,
        status: row.status,
        downloadCount: parseInt(row.download_count)
      }))
    });
  } catch (err) {
    console.error('Failed to get top downloads:', err);
    res.status(500).json({ error: 'Failed to get top downloads' });
  }
});

// GET /api/v1/analytics/media-formats - Get distribution of media formats
analyticsRouter.get('/media-formats', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const formats = await AppDataSource.query(`
      SELECT
        format,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM media
      WHERE user_id = $1 AND format IS NOT NULL
      GROUP BY format
      ORDER BY count DESC
    `, [userId]);

    res.json({
      formats: formats.map((row: any) => ({
        format: row.format,
        count: parseInt(row.count),
        totalSize: parseInt(row.total_size) || 0
      }))
    });
  } catch (err) {
    console.error('Failed to get media formats:', err);
    res.status(500).json({ error: 'Failed to get media formats' });
  }
});

// GET /api/v1/analytics/summary - Get comprehensive analytics summary
analyticsRouter.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Total counts
    const downloadCount = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM downloads WHERE user_id = $1',
      [userId]
    );

    const mediaCount = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM media WHERE user_id = $1',
      [userId]
    );

    const bookmarkCount = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = $1',
      [userId]
    );

    const presetCount = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM download_presets WHERE user_id = $1',
      [userId]
    );

    // Storage stats
    const storageStats = await AppDataSource.query(`
      SELECT
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size,
        SUM(duration) as total_duration
      FROM media
      WHERE user_id = $1
    `, [userId]);

    // Recent activity (last 7 days)
    const recentActivity = await AppDataSource.query(`
      SELECT
        COUNT(*) as downloads_last_7_days
      FROM downloads
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    `, [userId]);

    res.json({
      totals: {
        downloads: parseInt(downloadCount[0].count),
        media: parseInt(mediaCount[0].count),
        bookmarks: parseInt(bookmarkCount[0].count),
        presets: parseInt(presetCount[0].count)
      },
      storage: {
        totalSize: parseInt(storageStats[0].total_size) || 0,
        avgSize: parseInt(storageStats[0].avg_size) || 0,
        totalDuration: parseInt(storageStats[0].total_duration) || 0
      },
      activity: {
        downloadsLast7Days: parseInt(recentActivity[0].downloads_last_7_days)
      }
    });
  } catch (err) {
    console.error('Failed to get analytics summary:', err);
    res.status(500).json({ error: 'Failed to get analytics summary' });
  }
});
