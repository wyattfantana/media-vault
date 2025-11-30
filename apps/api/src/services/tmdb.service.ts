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
  async getPopularMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Popular movies error:', error);
      throw new Error('Failed to get popular movies');
    }
  }

  /**
   * Get top rated movies
   */
  async getTopRatedMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Top rated movies error:', error);
      throw new Error('Failed to get top rated movies');
    }
  }

  /**
   * Get now playing movies (currently in theaters)
   */
  async getNowPlayingMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/now_playing`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Now playing movies error:', error);
      throw new Error('Failed to get now playing movies');
    }
  }

  /**
   * Get upcoming movies
   */
  async getUpcomingMovies(page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/upcoming`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Upcoming movies error:', error);
      throw new Error('Failed to get upcoming movies');
    }
  }

  /**
   * Get popular TV shows
   */
  async getPopularTVShows(page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number }> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/tv/popular`, {
        params: {
          api_key: this.apiKey,
          page
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Popular TV shows error:', error);
      throw new Error('Failed to get popular TV shows');
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
  } = {}): Promise<{ results: TMDBMovie[]; total_pages: number }> {
    try {
      // For top-rated sorting, use stricter vote requirements
      const minVotes = filters.min_votes || (filters.sort_by === 'vote_average.desc' ? 1000 : 500);
      const minRating = filters.min_rating || 0;

      const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
        params: {
          api_key: this.apiKey,
          with_genres: filters.genre,
          primary_release_year: filters.year,
          sort_by: filters.sort_by || 'vote_average.desc',
          page: filters.page || 1,
          'vote_average.gte': minRating,
          'vote_count.gte': minVotes,
          include_adult: false
        }
      });

      return {
        results: response.data.results,
        total_pages: response.data.total_pages
      };
    } catch (error) {
      console.error('[TMDB] Discover movies error:', error);
      throw new Error('Failed to discover movies');
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
}

// Export singleton instance
export const tmdbService = new TMDBService();
