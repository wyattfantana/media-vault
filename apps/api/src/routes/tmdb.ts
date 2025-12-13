import { Router } from 'express';
import { tmdbService } from '../services/tmdb.service';
import { omdbService } from '../services/omdb.service';
import { auth } from '../auth.js';

const router = Router();

// Middleware to get user (optional - routes work without auth but use env var fallback)
const getUser = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session) {
      req.user = session.user;
    }
  } catch (err) {
    // User not authenticated - will use env var fallback
  }
  next();
};

// Apply middleware to all routes
router.use(getUser);

/**
 * Search movies
 * GET /api/v1/tmdb/search/movies?q=query&page=1
 */
router.get('/search/movies', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const userId = (req as any).user?.id;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await tmdbService.searchMovies(query, page, userId);

    // Fetch IMDB IDs for top results (first 20 for performance)
    const transformedResults = {
      ...results,
      results: await Promise.all(results.results.slice(0, 20).map(async (movie) => {
        let imdb_id = null;
        try {
          const details = await tmdbService.getMovieDetails(movie.id);
          imdb_id = details.imdb_id;
        } catch (err) {
          // Skip if details fetch fails
        }
        return {
          ...movie,
          poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
          backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'w780'),
          year: movie.release_date ? movie.release_date.substring(0, 4) : null,
          imdb_id
        };
      }))
    };

    res.json(transformedResults);
  } catch (error) {
    console.error('TMDB movie search error:', error);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

/**
 * Search TV shows
 * GET /api/v1/tmdb/search/tv?q=query&page=1
 */
router.get('/search/tv', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured. Please set TMDB_API_KEY in environment variables.' });
    }

    const results = await tmdbService.searchTVShows(query, page);

    // Transform results to include full image URLs
    const transformedResults = {
      ...results,
      results: results.results.map(show => ({
        ...show,
        poster_url: tmdbService.getImageUrl(show.poster_path, 'w500'),
        backdrop_url: tmdbService.getImageUrl(show.backdrop_path, 'w780'),
        year: show.first_air_date ? show.first_air_date.substring(0, 4) : null
      }))
    };

    res.json(transformedResults);
  } catch (error) {
    console.error('TMDB TV search error:', error);
    res.status(500).json({ error: 'Failed to search TV shows' });
  }
});

/**
 * Search people (actors, directors, etc.)
 * GET /api/v1/tmdb/search/people?q=query&page=1
 */
router.get('/search/people', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const userId = (req as any).user?.id;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await tmdbService.searchPeople(query, page, userId);

    // Transform results to include full image URLs
    const transformedResults = {
      ...results,
      results: results.results.map(person => ({
        ...person,
        profile_url: tmdbService.getImageUrl(person.profile_path, 'w200'),
        known_for: person.known_for.map((item: any) => ({
          ...item,
          poster_url: tmdbService.getImageUrl(item.poster_path, 'w200'),
          media_type: (item as any).title ? 'movie' : 'tv',
          title: (item as any).title || (item as any).name,
          year: (item as any).release_date ? (item as any).release_date.substring(0, 4) :
                (item as any).first_air_date ? (item as any).first_air_date.substring(0, 4) : null
        }))
      }))
    };

    res.json(transformedResults);
  } catch (error) {
    console.error('TMDB people search error:', error);
    res.status(500).json({ error: 'Failed to search people' });
  }
});

/**
 * Get movie details
 * GET /api/v1/tmdb/movie/:id
 */
router.get('/movie/:id', async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const movie = await tmdbService.getMovieDetails(movieId);

    const transformedMovie = {
      ...movie,
      poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'original'),
      year: movie.release_date ? movie.release_date.substring(0, 4) : null
    };

    res.json(transformedMovie);
  } catch (error) {
    console.error('TMDB movie details error:', error);
    res.status(500).json({ error: 'Failed to get movie details' });
  }
});

/**
 * Get TV show details
 * GET /api/v1/tmdb/tv/:id
 */
router.get('/tv/:id', async (req, res) => {
  try {
    const tvId = parseInt(req.params.id);

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const show = await tmdbService.getTVShowDetails(tvId);

    const transformedShow = {
      ...show,
      poster_url: tmdbService.getImageUrl(show.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(show.backdrop_path, 'original'),
      year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
      seasons: show.seasons.map(season => ({
        ...season,
        poster_url: tmdbService.getImageUrl(season.poster_path, 'w300')
      }))
    };

    res.json(transformedShow);
  } catch (error) {
    console.error('TMDB TV details error:', error);
    res.status(500).json({ error: 'Failed to get TV show details' });
  }
});

/**
 * Get season details
 * GET /api/v1/tmdb/tv/:id/season/:seasonNumber
 */
router.get('/tv/:id/season/:seasonNumber', async (req, res) => {
  try {
    const tvId = parseInt(req.params.id);
    const seasonNumber = parseInt(req.params.seasonNumber);

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const season = await tmdbService.getSeasonDetails(tvId, seasonNumber);

    const transformedSeason = {
      ...season,
      poster_url: tmdbService.getImageUrl(season.poster_path, 'w500'),
      episodes: season.episodes.map(episode => ({
        ...episode,
        still_url: tmdbService.getImageUrl(episode.still_path, 'w300')
      }))
    };

    res.json(transformedSeason);
  } catch (error) {
    console.error('TMDB season details error:', error);
    res.status(500).json({ error: 'Failed to get season details' });
  }
});

/**
 * Get person's movie credits (cast & crew)
 * GET /api/v1/tmdb/person/:id/movie-credits
 */
router.get('/person/:id/movie-credits', async (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const userId = (req as any).user?.id;

    const credits = await tmdbService.getPersonMovieCredits(personId, userId);

    // Transform cast credits to include full URLs
    const transformedCast = credits.cast.map((movie: any) => ({
      ...movie,
      poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'w780'),
      year: movie.release_date ? movie.release_date.substring(0, 4) : null
    }));

    // Transform crew credits to include full URLs
    const transformedCrew = credits.crew.map((movie: any) => ({
      ...movie,
      poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'w780'),
      year: movie.release_date ? movie.release_date.substring(0, 4) : null
    }));

    res.json({
      id: credits.id,
      cast: transformedCast,
      crew: transformedCrew
    });
  } catch (error) {
    console.error('TMDB person movie credits error:', error);
    res.status(500).json({ error: 'Failed to get person movie credits' });
  }
});

/**
 * Get person's TV credits (cast & crew)
 * GET /api/v1/tmdb/person/:id/tv-credits
 */
router.get('/person/:id/tv-credits', async (req, res) => {
  try {
    const personId = parseInt(req.params.id);
    const userId = (req as any).user?.id;

    const credits = await tmdbService.getPersonTVCredits(personId, userId);

    // Transform cast credits to include full URLs
    const transformedCast = credits.cast.map((show: any) => ({
      ...show,
      poster_url: tmdbService.getImageUrl(show.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(show.backdrop_path, 'w780'),
      year: show.first_air_date ? show.first_air_date.substring(0, 4) : null
    }));

    // Transform crew credits to include full URLs
    const transformedCrew = credits.crew.map((show: any) => ({
      ...show,
      poster_url: tmdbService.getImageUrl(show.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(show.backdrop_path, 'w780'),
      year: show.first_air_date ? show.first_air_date.substring(0, 4) : null
    }));

    res.json({
      id: credits.id,
      cast: transformedCast,
      crew: transformedCrew
    });
  } catch (error) {
    console.error('TMDB person TV credits error:', error);
    res.status(500).json({ error: 'Failed to get person TV credits' });
  }
});

/**
 * Helper function to transform and enrich movie results with IMDB data
 */
const enrichMoviesWithImdb = async (movies: any[]) => {
  // Fetch IMDB IDs and details for all results
  const moviesWithImdb = await Promise.all(movies.map(async (movie) => {
    let imdb_id = null;
    try {
      const details = await tmdbService.getMovieDetails(movie.id);
      imdb_id = details.imdb_id;
    } catch (err) {
      // Skip if details fetch fails
    }
    return {
      ...movie,
      poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
      backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'w780'),
      year: movie.release_date ? movie.release_date.substring(0, 4) : null,
      imdb_id
    };
  }));

  // Batch fetch IMDB ratings if OMDb is configured
  if (omdbService.isConfigured()) {
    const imdbIds = moviesWithImdb.map(m => m.imdb_id);
    const ratings = await omdbService.batchGetImdbRatings(imdbIds);

    return moviesWithImdb.map(movie => {
      const imdbData = movie.imdb_id ? ratings.get(movie.imdb_id) : null;
      return {
        ...movie,
        imdb_rating: imdbData?.rating || null,
        imdb_votes: imdbData?.votes || null
      };
    });
  }

  return moviesWithImdb;
};

/**
 * Get popular movies
 * GET /api/v1/tmdb/popular/movies?page=1
 */
router.get('/popular/movies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const results = await tmdbService.getPopularMovies(page);
    const enrichedResults = await enrichMoviesWithImdb(results.results);

    res.json({ ...results, results: enrichedResults });
  } catch (error) {
    console.error('TMDB popular movies error:', error);
    res.status(500).json({ error: 'Failed to get popular movies' });
  }
});

/**
 * Get top rated movies
 * GET /api/v1/tmdb/top-rated/movies?page=1
 */
router.get('/top-rated/movies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const results = await tmdbService.getTopRatedMovies(page);
    const enrichedResults = await enrichMoviesWithImdb(results.results);

    res.json({ ...results, results: enrichedResults });
  } catch (error) {
    console.error('TMDB top rated movies error:', error);
    res.status(500).json({ error: 'Failed to get top rated movies' });
  }
});

/**
 * Get now playing movies
 * GET /api/v1/tmdb/now-playing/movies?page=1
 */
router.get('/now-playing/movies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const results = await tmdbService.getNowPlayingMovies(page);
    const enrichedResults = await enrichMoviesWithImdb(results.results);

    res.json({ ...results, results: enrichedResults });
  } catch (error) {
    console.error('TMDB now playing movies error:', error);
    res.status(500).json({ error: 'Failed to get now playing movies' });
  }
});

/**
 * Get upcoming movies
 * GET /api/v1/tmdb/upcoming/movies?page=1
 */
router.get('/upcoming/movies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const results = await tmdbService.getUpcomingMovies(page);
    const enrichedResults = await enrichMoviesWithImdb(results.results);

    res.json({ ...results, results: enrichedResults });
  } catch (error) {
    console.error('TMDB upcoming movies error:', error);
    res.status(500).json({ error: 'Failed to get upcoming movies' });
  }
});

/**
 * Get popular TV shows with filters
 * GET /api/v1/tmdb/popular/tv?page=1&genre=10759&min_rating=7&min_votes=1000&year_from=2020&year_to=2024&sort_by=vote_average.desc&enrich=true
 */
router.get('/popular/tv', async (req, res) => {
  try {
    const filters = {
      genre: req.query.genre as string | undefined,
      exclude_genres: req.query.exclude_genres as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      min_rating: req.query.min_rating !== undefined ? parseFloat(req.query.min_rating as string) : undefined,
      min_votes: req.query.min_votes !== undefined ? parseInt(req.query.min_votes as string) : undefined,
      year_from: req.query.year_from ? parseInt(req.query.year_from as string) : undefined,
      year_to: req.query.year_to ? parseInt(req.query.year_to as string) : undefined,
      sort_by: (req.query.sort_by as any) || 'popularity.desc'
    };

    const enrich = req.query.enrich === 'true';

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    // Check if any filters (other than sortBy) are applied
    const hasActualFilters = filters.genre || filters.exclude_genres || filters.min_rating || filters.min_votes ||
                             filters.year_from || filters.year_to;

    let results;
    if (hasActualFilters || filters.sort_by !== 'popularity.desc') {
      // Use discover endpoint for sorting and filtering
      // Only pass min_votes and min_rating if they have actual values (not 0 or undefined)
      const discoverFilters: any = {
        genre: filters.genre,
        exclude_genres: filters.exclude_genres,
        year_from: filters.year_from,
        year_to: filters.year_to,
        sort_by: filters.sort_by,
        page: filters.page
      };

      // Only add min_rating if it's greater than 0
      if (filters.min_rating && filters.min_rating > 0) {
        discoverFilters.min_rating = filters.min_rating;
      }

      // Only add min_votes if it's greater than 0
      if (filters.min_votes && filters.min_votes > 0) {
        discoverFilters.min_votes = filters.min_votes;
      }

      results = await tmdbService.discoverTVShows(discoverFilters);
    } else {
      // Use popular endpoint only for default popularity sort
      results = await tmdbService.getPopularTVShows(filters.page);
    }

    let transformedResults = {
      ...results,
      results: results.results.map(show => ({
        ...show,
        poster_url: tmdbService.getImageUrl(show.poster_path, 'w500'),
        backdrop_url: tmdbService.getImageUrl(show.backdrop_path, 'w780'),
        year: show.first_air_date ? show.first_air_date.substring(0, 4) : null
      }))
    };

    // Enrich with IMDB if requested
    if (enrich) {
      const enrichedResults = await enrichMoviesWithImdb(transformedResults.results);
      transformedResults = { ...transformedResults, results: enrichedResults };
    }

    res.json(transformedResults);
  } catch (error) {
    console.error('TMDB popular TV error:', error);
    res.status(500).json({ error: 'Failed to get popular TV shows' });
  }
});

/**
 * Get trending content
 * GET /api/v1/tmdb/trending/:mediaType/:timeWindow
 */
router.get('/trending/:mediaType/:timeWindow', async (req, res) => {
  try {
    const mediaType = req.params.mediaType as 'movie' | 'tv';
    const timeWindow = (req.params.timeWindow as 'day' | 'week') || 'week';
    const userId = (req as any).user?.id;

    if (!['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be "movie" or "tv"' });
    }

    const results = await tmdbService.getTrending(mediaType, timeWindow, userId);

    const transformedResults = {
      results: await Promise.all(results.results.map(async (item: any) => {
        let imdb_id = null;
        if (mediaType === 'movie') {
          try {
            const details = await tmdbService.getMovieDetails(item.id, userId);
            imdb_id = details.imdb_id;
          } catch (err) {
            // Skip if details fetch fails
          }
        }
        return {
          ...item,
          poster_url: tmdbService.getImageUrl(item.poster_path, 'w500'),
          backdrop_url: tmdbService.getImageUrl(item.backdrop_path, 'w780'),
          year: item.release_date ? item.release_date.substring(0, 4) :
                item.first_air_date ? item.first_air_date.substring(0, 4) : null,
          imdb_id
        };
      }))
    };

    res.json(transformedResults);
  } catch (error) {
    console.error('TMDB trending error:', error);
    res.status(500).json({ error: 'Failed to get trending content' });
  }
});

/**
 * Discover movies with filters (with IMDB enrichment for full views)
 * GET /api/v1/tmdb/discover/movies?genre=28&year=2024&sort_by=vote_average.desc&page=1&min_rating=7&min_votes=1000&enrich=true
 */
router.get('/discover/movies', async (req, res) => {
  try {
    const filters = {
      genre: req.query.genre as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      sort_by: (req.query.sort_by as any) || 'vote_average.desc',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      min_rating: req.query.min_rating !== undefined ? parseFloat(req.query.min_rating as string) : undefined,
      min_votes: req.query.min_votes !== undefined ? parseInt(req.query.min_votes as string) : undefined
    };

    const enrich = req.query.enrich === 'true';

    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const results = await tmdbService.discoverMovies(filters);

    // Only enrich with IMDB if requested (for genre view, not browse rows)
    if (enrich) {
      const enrichedResults = await enrichMoviesWithImdb(results.results);
      res.json({ ...results, results: enrichedResults });
    } else {
      // Fast path: just add image URLs without IMDB lookup
      const transformedResults = results.results.map(movie => ({
        ...movie,
        poster_url: tmdbService.getImageUrl(movie.poster_path, 'w500'),
        backdrop_url: tmdbService.getImageUrl(movie.backdrop_path, 'w780'),
        year: movie.release_date ? movie.release_date.substring(0, 4) : null
      }));
      res.json({ ...results, results: transformedResults });
    }
  } catch (error) {
    console.error('TMDB discover error:', error);
    res.status(500).json({ error: 'Failed to discover movies' });
  }
});

/**
 * Get movie genres
 * GET /api/v1/tmdb/genres/movies
 */
router.get('/genres/movies', async (req, res) => {
  try {
    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const genres = await tmdbService.getMovieGenres();
    res.json({ genres });
  } catch (error) {
    console.error('TMDB movie genres error:', error);
    res.status(500).json({ error: 'Failed to get movie genres' });
  }
});

/**
 * Get TV genres
 * GET /api/v1/tmdb/genres/tv
 */
router.get('/genres/tv', async (req, res) => {
  try {
    if (!tmdbService.isConfigured()) {
      return res.status(503).json({ error: 'TMDB is not configured' });
    }

    const genres = await tmdbService.getTVGenres();
    res.json({ genres });
  } catch (error) {
    console.error('TMDB TV genres error:', error);
    res.status(500).json({ error: 'Failed to get TV genres' });
  }
});

export default router;
