import { Router } from 'express';
import axios from 'axios';
import { audiobookService } from '../services/audiobook.service.js';

const router = Router();

/**
 * Search audiobooks
 * GET /api/v1/audiobooks/search?q=query&page=1
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await audiobookService.search(query, page, limit);
    res.json(results);
  } catch (error: any) {
    console.error('[Audiobooks] Search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search audiobooks' });
  }
});

/**
 * Get trending/popular audiobooks
 * GET /api/v1/audiobooks/trending?limit=20
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const results = await audiobookService.getTrending(limit);
    res.json({ results });
  } catch (error: any) {
    console.error('[Audiobooks] Trending error:', error);
    res.status(500).json({ error: error.message || 'Failed to get trending audiobooks' });
  }
});

/**
 * Get available genres
 * GET /api/v1/audiobooks/genres
 */
router.get('/genres', async (_req, res) => {
  try {
    const genres = audiobookService.getGenres();
    res.json({ genres });
  } catch (error: any) {
    console.error('[Audiobooks] Genres error:', error);
    res.status(500).json({ error: error.message || 'Failed to get genres' });
  }
});

/**
 * Get books by genre/subject with pagination
 * GET /api/v1/audiobooks/genre/:genreId?page=1&limit=20
 */
router.get('/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const results = await audiobookService.getBySubject(genreId, page, limit);
    res.json({
      results: results.books,
      name: results.name,
      total: results.workCount,
      page: results.page,
      totalPages: results.totalPages,
    });
  } catch (error: any) {
    console.error('[Audiobooks] Genre error:', error);
    res.status(500).json({ error: error.message || 'Failed to get books by genre' });
  }
});

/**
 * Load multiple pages at once for a genre (for initial load / infinite scroll)
 * GET /api/v1/audiobooks/genre/:genreId/batch?startPage=1&numPages=5&limit=20
 */
router.get('/genre/:genreId/batch', async (req, res) => {
  try {
    const { genreId } = req.params;
    const startPage = parseInt(req.query.startPage as string) || 1;
    const numPages = Math.min(parseInt(req.query.numPages as string) || 5, 10); // Max 10 pages
    const limit = parseInt(req.query.limit as string) || 20;

    // Fetch pages in parallel
    const promises = [];
    for (let i = 0; i < numPages; i++) {
      promises.push(audiobookService.getBySubject(genreId, startPage + i, limit));
    }

    const results = await Promise.all(promises);

    // Combine all books
    const allBooks = results.flatMap(r => r.books);

    // Deduplicate by ID
    const uniqueBooks = Array.from(
      new Map(allBooks.map(book => [book.id, book])).values()
    );

    // Get metadata from first result
    const firstResult = results[0];

    res.json({
      results: uniqueBooks,
      name: firstResult.name,
      total: firstResult.workCount,
      page: startPage + numPages - 1,
      totalPages: firstResult.totalPages,
      loaded: uniqueBooks.length,
    });
  } catch (error: any) {
    console.error('[Audiobooks] Batch genre error:', error);
    res.status(500).json({ error: error.message || 'Failed to get books by genre' });
  }
});

/**
 * Proxy cover images to avoid client-side timeouts
 * GET /api/v1/audiobooks/cover?url=https://...
 */
router.get('/cover', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Query parameter "url" is required' });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const allowedHosts = new Set(['covers.openlibrary.org', 'archive.org', 'download.archive.org']);
    if (!allowedHosts.has(parsed.hostname)) {
      return res.status(400).json({ error: 'Host not allowed' });
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: {
        'User-Agent': 'MediaVault/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(response.data));
  } catch (error) {
    const placeholderSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
        <rect width="10" height="10" fill="#111827"/>
      </svg>
    `.trim();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(placeholderSvg);
  }
});

/**
 * Get audiobook details by work ID
 * GET /api/v1/audiobooks/:workId
 */
router.get('/:workId', async (req, res) => {
  try {
    const { workId } = req.params;
    const details = await audiobookService.getDetails(workId);

    if (!details) {
      return res.status(404).json({ error: 'Audiobook not found' });
    }

    res.json(details);
  } catch (error: any) {
    console.error('[Audiobooks] Details error:', error);
    res.status(500).json({ error: error.message || 'Failed to get audiobook details' });
  }
});

export const audiobooksRouter = router;
