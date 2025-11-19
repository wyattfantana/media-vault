import { Router } from 'express';
import { ytdlpService } from '../services/ytdlp.service';
import { getIPlayerService } from '../services/get-iplayer.service';

const router = Router();

interface UnifiedSearchResult {
  source: 'bbc_iplayer' | 'youtube';
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: number;
  uploader?: string;
  channel?: string;
  uploadDate?: string;
  viewCount?: number;
  available?: string;
  type?: string;
  categories?: string;
}

/**
 * Unified search across BBC iPlayer and YouTube
 * GET /api/v1/search/unified?q=query&sources=bbc,youtube&limit=20
 */
router.get('/unified', async (req, res) => {
  try {
    const query = req.query.q as string;
    const sourcesParam = req.query.sources as string || 'bbc,youtube';
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const sources = sourcesParam.split(',').map(s => s.trim());
    const results: UnifiedSearchResult[] = [];

    // Search BBC iPlayer
    if (sources.includes('bbc') || sources.includes('bbc_iplayer')) {
      try {
        const bbcResults = await getIPlayerService.search(query, { type: 'all' });

        results.push(...bbcResults.map(programme => ({
          source: 'bbc_iplayer' as const,
          id: programme.pid,
          title: programme.name,
          description: programme.description,
          thumbnail: programme.thumbnail,
          url: `https://www.bbc.co.uk/iplayer/episode/${programme.pid}`,
          channel: programme.channel,
          available: programme.available,
          type: programme.type,
          categories: programme.categories,
          duration: programme.duration
        })));
      } catch (err) {
        console.error('BBC iPlayer search error:', err);
      }
    }

    // Search YouTube
    if (sources.includes('youtube') || sources.includes('yt')) {
      try {
        const ytResults = await ytdlpService.searchYouTube(query, limit);

        results.push(...ytResults.map(video => ({
          source: 'youtube' as const,
          id: video.id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          url: video.url,
          duration: video.duration,
          uploader: video.uploader,
          uploadDate: video.uploadDate,
          viewCount: video.viewCount
        })));
      } catch (err) {
        console.error('YouTube search error:', err);
      }
    }

    // Sort by relevance (you can improve this later)
    // For now, interleave results from both sources
    const sortedResults = results.slice(0, limit);

    res.json({
      query,
      total: sortedResults.length,
      results: sortedResults
    });
  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Search YouTube only
 * GET /api/v1/search/youtube?q=query&limit=20
 */
router.get('/youtube', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await ytdlpService.searchYouTube(query, limit);

    res.json({
      query,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ error: 'YouTube search failed' });
  }
});

/**
 * Search BBC iPlayer only
 * GET /api/v1/search/iplayer?q=query&type=tv
 */
router.get('/iplayer', async (req, res) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as 'tv' | 'radio' | 'all' || 'all';
    const channel = req.query.channel as string;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await getIPlayerService.search(query, { type, channel });

    res.json({
      query,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('iPlayer search error:', error);
    res.status(500).json({ error: 'iPlayer search failed' });
  }
});

export default router;
