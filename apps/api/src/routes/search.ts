import { Router } from 'express';
import { ytdlpService } from '../services/ytdlp.service';
import { getIPlayerService } from '../services/get-iplayer.service';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';

const router = Router();

interface UnifiedSearchResult {
  source: 'bbc_iplayer' | 'youtube' | 'soundcloud';
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

    // Search SoundCloud
    if (sources.includes('soundcloud') || sources.includes('sc')) {
      try {
        const scResults = await ytdlpService.searchPlatform('sc', query, limit);

        results.push(...scResults.map(audio => ({
          source: 'soundcloud' as const,
          id: audio.id,
          title: audio.title,
          description: audio.description,
          thumbnail: audio.thumbnail,
          url: audio.url,
          duration: audio.duration,
          uploader: audio.uploader,
          uploadDate: audio.uploadDate,
          viewCount: audio.viewCount
        })));
      } catch (err) {
        console.error('SoundCloud search error:', err);
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
 * GET /api/v1/search/iplayer?q=query&type=tv&limit=200&offset=0
 */
router.get('/iplayer', async (req, res) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as 'tv' | 'radio' | 'all' || 'all';
    const channel = req.query.channel as string;
    const limit = parseInt(req.query.limit as string) || 200;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const allResults = await getIPlayerService.search(query, { type, channel });
    const paginatedResults = allResults.slice(offset, offset + limit);

    res.json({
      query,
      total: allResults.length,
      limit,
      offset,
      hasMore: offset + limit < allResults.length,
      results: paginatedResults
    });
  } catch (error) {
    console.error('iPlayer search error:', error);
    res.status(500).json({ error: 'iPlayer search failed' });
  }
});

/**
 * Get YouTube channel information
 * GET /api/v1/search/youtube/channel?url=...
 */
router.get('/youtube/channel', async (req, res) => {
  try {
    const channelUrl = req.query.url as string;

    if (!channelUrl) {
      return res.status(400).json({ error: 'Channel URL is required' });
    }

    const channelInfo = await ytdlpService.getChannelInfo(channelUrl);
    res.json(channelInfo);
  } catch (error) {
    console.error('Get channel info error:', error);
    res.status(500).json({ error: 'Failed to get channel information' });
  }
});

/**
 * Get YouTube channel video count (separate endpoint for async loading)
 * GET /api/v1/search/youtube/channel/count?url=...
 */
router.get('/youtube/channel/count', async (req, res) => {
  try {
    const channelUrl = req.query.url as string;

    if (!channelUrl) {
      return res.status(400).json({ error: 'Channel URL is required' });
    }

    const videoCount = await ytdlpService.getChannelVideoCount(channelUrl);

    // Automatically update any bookmarks for this channel with the accurate count
    // This ensures bookmarks stay up-to-date even if the user navigates away
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session?.user) {
        const userId = session.user.id;

        // Check if there's a bookmark for this channel (try with and without /videos)
        const urlVariants = [
          channelUrl,
          channelUrl + '/videos',
          channelUrl.replace(/\/videos$/, '')
        ];

        for (const urlVariant of urlVariants) {
          const bookmark = await AppDataSource
            .createQueryBuilder()
            .select('*')
            .from('bookmarks', 'b')
            .where('b.user_id = :userId AND b.url = :url', { userId, url: urlVariant })
            .getRawOne();

          if (bookmark && bookmark.video_count !== videoCount) {
            await AppDataSource
              .createQueryBuilder()
              .update('bookmarks')
              .set({ video_count: videoCount })
              .where('id = :id', { id: bookmark.id })
              .execute();
            console.log(`[Video Count] Auto-updated bookmark ${bookmark.id} with count: ${videoCount}`);
            break;
          }
        }
      }
    } catch (err) {
      // Silently fail - bookmark update is not critical
      console.error('[Video Count] Failed to auto-update bookmark:', err);
    }

    res.json({ videoCount });
  } catch (error) {
    console.error('Get channel video count error:', error);
    res.status(500).json({ error: 'Failed to get video count' });
  }
});

/**
 * Get SoundCloud user track count
 * GET /api/v1/search/soundcloud/user/count?url=...
 */
router.get('/soundcloud/user/count', async (req, res) => {
  try {
    const userUrl = req.query.url as string;

    if (!userUrl) {
      return res.status(400).json({ error: 'User URL is required' });
    }

    const trackCount = await ytdlpService.getSoundCloudUserTrackCount(userUrl);

    // Automatically update any bookmarks for this user with the accurate count
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session?.user) {
        const userId = session.user.id;

        // Check if there's a bookmark for this user
        const bookmark = await AppDataSource
          .createQueryBuilder()
          .select('*')
          .from('bookmarks', 'b')
          .where('b.user_id = :userId AND b.url = :url', { userId, url: userUrl })
          .getRawOne();

        if (bookmark && bookmark.video_count !== trackCount) {
          await AppDataSource
            .createQueryBuilder()
            .update('bookmarks')
            .set({ video_count: trackCount })
            .where('id = :id', { id: bookmark.id })
            .execute();
          console.log(`[SoundCloud Track Count] Auto-updated bookmark ${bookmark.id} with count: ${trackCount}`);
        }
      }
    } catch (err) {
      // Silently fail - bookmark update is not critical
      console.error('[SoundCloud Track Count] Failed to auto-update bookmark:', err);
    }

    res.json({ trackCount });
  } catch (error) {
    console.error('Get SoundCloud track count error:', error);
    res.status(500).json({ error: 'Failed to get track count' });
  }
});

/**
 * Get YouTube playlist information
 * GET /api/v1/search/youtube/playlist/info?url=...
 */
router.get('/youtube/playlist/info', async (req, res) => {
  try {
    const playlistUrl = req.query.url as string;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'Playlist URL is required' });
    }

    const playlistInfo = await ytdlpService.getPlaylistInfo(playlistUrl);
    res.json(playlistInfo);
  } catch (error) {
    console.error('Get playlist info error:', error);
    res.status(500).json({ error: 'Failed to get playlist information' });
  }
});

/**
 * Get YouTube channel videos
 * GET /api/v1/search/youtube/channel/videos?url=...&limit=50&offset=0
 */
router.get('/youtube/channel/videos', async (req, res) => {
  try {
    const channelUrl = req.query.url as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!channelUrl) {
      return res.status(400).json({ error: 'Channel URL is required' });
    }

    const videos = await ytdlpService.getChannelVideos(channelUrl, limit, offset);
    res.json({
      total: videos.length,
      videos
    });
  } catch (error) {
    console.error('Get channel videos error:', error);
    res.status(500).json({ error: 'Failed to get channel videos' });
  }
});

/**
 * Get YouTube playlist videos
 * GET /api/v1/search/youtube/playlist?url=...&limit=100&offset=0
 */
router.get('/youtube/playlist', async (req, res) => {
  try {
    const playlistUrl = req.query.url as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'Playlist URL is required' });
    }

    const videos = await ytdlpService.getPlaylistVideos(playlistUrl, limit, offset);
    res.json({
      total: videos.length,
      videos
    });
  } catch (error) {
    console.error('Get playlist videos error:', error);
    res.status(500).json({ error: 'Failed to get playlist videos' });
  }
});

/**
 * Universal URL extraction - works with ANY yt-dlp supported platform
 * GET /api/v1/search/extract?url=...&limit=100&offset=0
 * Supports: TikTok, Instagram, Reddit, Rumble, Twitch, Vimeo, Dailymotion, Archive.org, etc.
 */
router.get('/extract', async (req, res) => {
  try {
    const url = req.query.url as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const videos = await ytdlpService.extractFromUrl(url, limit, offset);
    res.json({
      url,
      total: videos.length,
      videos
    });
  } catch (error) {
    console.error('URL extraction error:', error);
    res.status(500).json({ error: 'Failed to extract videos from URL' });
  }
});

export default router;
