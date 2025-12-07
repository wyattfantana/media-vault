import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  video: boolean;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  budget: number;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string | null }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  imdb_id: string | null;
  homepage: string | null;
}

export interface TMDBTVShowDetails extends TMDBTVShow {
  created_by: Array<{ id: number; name: string }>;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  homepage: string | null;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  number_of_episodes: number;
  number_of_seasons: number;
  seasons: Array<{
    id: number;
    season_number: number;
    episode_count: number;
    air_date: string;
    name: string;
    overview: string;
    poster_path: string | null;
  }>;
  status: string;
  tagline: string;
  type: string;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string;
  poster_path: string | null;
  episodes: Array<{
    id: number;
    episode_number: number;
    name: string;
    overview: string;
    air_date: string;
    still_path: string | null;
    vote_average: number;
    runtime: number;
  }>;
}

export class TMDBService {
  private apiKey: string;

  constructor() {
    this.apiKey = TMDB_API_KEY;
    if (!this.apiKey) {
      console.warn('[TMDB] API key not configured. Set TMDB_API_KEY in environment variables.');
    }
  }

  /**
   * Check if TMDB is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get full image URL from path
   */
  getImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }

  /**
   * Search for movies
   */
  async searchMovies(query: string, page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          include_adult: false
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Movie search error:', error);
      throw new Error('Failed to search movies');
    }
  }

  /**
   * Search for TV shows
   */
  async searchTVShows(query: string, page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          include_adult: false
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] TV show search error:', error);
      throw new Error('Failed to search TV shows');
    }
  }

  /**
   * Get movie details
   */
  async getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('[TMDB] Movie details error:', error);
      throw new Error('Failed to get movie details');
    }
  }

  /**
   * Get TV show details
   */
  async getTVShowDetails(tvId: number): Promise<TMDBTVShowDetails> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/${tvId}`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('[TMDB] TV show details error:', error);
      throw new Error('Failed to get TV show details');
    }
  }

  /**
   * Get TV show season details
   */
  async getSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('[TMDB] Season details error:', error);
      throw new Error('Failed to get season details');
    }
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Popular movies error:', error);
      throw new Error('Failed to get popular movies');
    }
  }

  /**
   * Get top rated movies
   */
  async getTopRatedMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Top rated movies error:', error);
      throw new Error('Failed to get top rated movies');
    }
  }

  /**
   * Get now playing movies (currently in theaters)
   */
  async getNowPlayingMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/now_playing`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Now playing movies error:', error);
      throw new Error('Failed to get now playing movies');
    }
  }

  /**
   * Get upcoming movies
   */
  async getUpcomingMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/upcoming`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Upcoming movies error:', error);
      throw new Error('Failed to get upcoming movies');
    }
  }

  /**
   * Get popular TV shows
   */
  async getPopularTVShows(page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/popular`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Popular TV shows error:', error);
      throw new Error('Failed to get popular TV shows');
    }
  }

  /**
   * Get top rated TV shows
   */
  async getTopRatedTVShows(page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/top_rated`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Top rated TV shows error:', error);
      throw new Error('Failed to get top rated TV shows');
    }
  }

  /**
   * Get on the air TV shows (currently airing)
   */
  async getOnTheAirTVShows(page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/on_the_air`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] On the air TV shows error:', error);
      throw new Error('Failed to get on the air TV shows');
    }
  }

  /**
   * Get trending movies/TV (day or week)
   */
  async getTrending(mediaType: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week'): Promise<{ results: (TMDBMovie | TMDBTVShow)[] }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}`, {
        params: {
          api_key: this.apiKey
        }
      });

      return {
        results: response.data.results
      };
    } catch (error) {
      console.error('[TMDB] Trending error:', error);
      throw new Error('Failed to get trending content');
    }
  }

  /**
   * Discover movies with filters
   */
  async discoverMovies(filters: {
    genre?: string | number;
    year?: number;
    sort_by?: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'vote_count.desc';
    page?: number;
    min_rating?: number;
    min_votes?: number;
  } = {}): Promise<{ results: TMDBMovie[]; total_pages: number; total_results: number }> {
    try {
      // Only apply minimum vote requirements if not explicitly set to 0
      const minVotes = filters.min_votes !== undefined ? filters.min_votes : (filters.sort_by === 'vote_average.desc' ? 1000 : 500);
      const minRating = filters.min_rating !== undefined ? filters.min_rating : 0;

      const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
        params: {
          api_key: this.apiKey,
          with_genres: filters.genre,
          primary_release_year: filters.year,
          sort_by: filters.sort_by || 'vote_average.desc',
          page: filters.page || 1,
          'vote_average.gte': minRating > 0 ? minRating : undefined,
          'vote_count.gte': minVotes > 0 ? minVotes : undefined,
          include_adult: false
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Discover movies error:', error);
      throw new Error('Failed to discover movies');
    }
  }

  /**
   * Discover TV shows with filters
   */
  async discoverTVShows(filters: {
    genre?: string | number;
    exclude_genres?: string | number;
    year_from?: number;
    year_to?: number;
    sort_by?: 'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc' | 'vote_count.desc';
    page?: number;
    min_rating?: number;
    min_votes?: number;
  } = {}): Promise<{ results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    try {
      // Only apply minimum requirements if explicitly provided (not undefined)
      const minVotes = filters.min_votes !== undefined ? filters.min_votes : undefined;
      const minRating = filters.min_rating !== undefined ? filters.min_rating : undefined;

      const response = await axios.get(`${TMDB_BASE_URL}/discover/tv`, {
        params: {
          api_key: this.apiKey,
          with_genres: filters.genre,
          without_genres: filters.exclude_genres,
          'first_air_date.gte': filters.year_from ? `${filters.year_from}-01-01` : undefined,
          'first_air_date.lte': filters.year_to ? `${filters.year_to}-12-31` : undefined,
          sort_by: filters.sort_by || 'popularity.desc',
          page: filters.page || 1,
          'vote_average.gte': minRating,
          'vote_count.gte': minVotes,
          include_adult: false
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('[TMDB] Discover TV shows error:', error);
      throw new Error('Failed to discover TV shows');
    }
  }

  /**
   * Get movie genres
   */
  async getMovieGenres(): Promise<Array<{ id: number; name: string }>> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data.genres;
    } catch (error) {
      console.error('[TMDB] Movie genres error:', error);
      throw new Error('Failed to get movie genres');
    }
  }

  /**
   * Get TV show genres
   */
  async getTVGenres(): Promise<Array<{ id: number; name: string }>> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/genre/tv/list`, {
        params: {
          api_key: this.apiKey
        }
      });

      return response.data.genres;
    } catch (error) {
      console.error('[TMDB] TV genres error:', error);
      throw new Error('Failed to get TV genres');
    }
  }

  /**
   * Find thumbnail for a title (searches both movies and TV shows)
   * Returns the best match thumbnail URL or null if not found
   */
  async findThumbnailForTitle(title: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      // First, extract year before cleaning (year is often in parentheses)
      const yearMatch = title.match(/\(?(19\d{2}|20\d{2})\)?/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;

      // Special handling for common shows
      let cleanTitle = title;

      // Law & Order SVU variations
      if (/Law\s+(and|&)\s+Order.*SVU/i.test(title)) {
        cleanTitle = 'Law & Order: Special Victims Unit';
      } else {
        // Clean up title - remove common torrent indicators
        cleanTitle = title
        .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '') // Remove extensions
        .replace(/\b(720p|1080p|2160p|4k|HDTV|WEB-DL|BluRay|BRRip|WEBRip|x264|x265|HEVC|AAC|AC3|DTS|H\.?265|H\.?264)\b/gi, '') // Remove quality indicators
        .replace(/\b(YIFY|YTS|RARBG|ETRG|Ozlem|EAC3)\b/gi, '') // Remove release groups
        .replace(/\d+(\.\d+)?\s?(GB|MB|KB)/gi, '') // Remove file sizes
        .replace(/\bS\d{2}(-S\d{2})?\b/gi, '') // Remove season ranges like S01-S26
        .replace(/\b(ongoing)\b/gi, '') // Remove "ongoing"
        .replace(/\[.*?\]/g, '') // Remove [tags]
        .replace(/\((?!.*\d{4}).*?\)/g, '') // Remove (tags) but keep (year) - only remove if no 4-digit number inside
        .replace(/\(\s*\)/g, '') // Remove empty parentheses
        .replace(/\s*-\s*$/gi, '') // Remove trailing dashes
        .replace(/\s*-\s*-\s*/g, ' - ') // Normalize multiple dashes to single
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      }

      // Determine if it's likely a TV show
      const isTVShow = /\b(S\d{2}|Season|Episode|ongoing|series|SVU)\b/i.test(title);

      if (isTVShow) {
        // Search TV shows first for TV content
        const tvResults = await this.searchTVShows(cleanTitle, 1);
        if (tvResults.results.length > 0) {
          const bestMatch = year
            ? tvResults.results.find(tv => tv.first_air_date && tv.first_air_date.startsWith(year.toString()))
            : tvResults.results[0];

          const show = bestMatch || tvResults.results[0];
          if (show.poster_path) {
            return this.getImageUrl(show.poster_path, 'w200');
          }
        }
      }

      // Search movies (or fallback if TV didn't find anything)
      const movieResults = await this.searchMovies(cleanTitle, 1);
      if (movieResults.results.length > 0) {
        const bestMatch = year
          ? movieResults.results.find(m => m.release_date && m.release_date.startsWith(year.toString()))
          : movieResults.results[0];

        const movie = bestMatch || movieResults.results[0];
        if (movie.poster_path) {
          return this.getImageUrl(movie.poster_path, 'w200');
        }
      }

      // If movie search failed and we haven't tried TV yet, try it now
      if (!isTVShow) {
        const tvResults = await this.searchTVShows(cleanTitle, 1);
        if (tvResults.results.length > 0) {
          const bestMatch = year
            ? tvResults.results.find(tv => tv.first_air_date && tv.first_air_date.startsWith(year.toString()))
            : tvResults.results[0];

          const show = bestMatch || tvResults.results[0];
          if (show.poster_path) {
            return this.getImageUrl(show.poster_path, 'w200');
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[TMDB] Error finding thumbnail for title:', title, error);
      return null;
    }
  }
}

// Export singleton instance
export const tmdbService = new TMDBService();
