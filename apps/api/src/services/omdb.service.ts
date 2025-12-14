import axios from 'axios';

const OMDB_API_KEY = process.env.OMDB_API_KEY || '';
const OMDB_BASE_URL = 'http://www.omdbapi.com/';

export interface OMDbMovie {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{ Source: string; Value: string }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
}

export class OMDbService {
  private apiKey: string;

  constructor() {
    this.apiKey = OMDB_API_KEY;
  }

  /**
   * Check if OMDb is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get movie details by IMDB ID
   */
  async getMovieByImdbId(imdbId: string): Promise<OMDbMovie | null> {
    if (!this.apiKey) {
      console.warn('[OMDb] API key not configured');
      return null;
    }

    try {
      const response = await axios.get(OMDB_BASE_URL, {
        params: {
          apikey: this.apiKey,
          i: imdbId,
          plot: 'short'
        }
      });

      if (response.data.Response === 'True') {
        return response.data;
      } else {
        console.warn(`[OMDb] Movie not found: ${imdbId}`);
        return null;
      }
    } catch (error) {
      console.error('[OMDb] Error fetching movie:', error);
      return null;
    }
  }

  /**
   * Get IMDB rating by IMDB ID (optimized - just returns the rating)
   */
  async getImdbRating(imdbId: string): Promise<{ rating: string | null; votes: string | null }> {
    const movie = await this.getMovieByImdbId(imdbId);
    if (movie) {
      return {
        rating: movie.imdbRating !== 'N/A' ? movie.imdbRating : null,
        votes: movie.imdbVotes !== 'N/A' ? movie.imdbVotes : null
      };
    }
    return { rating: null, votes: null };
  }

  /**
   * Get all ratings (IMDb, Rotten Tomatoes, Metacritic) by IMDB ID
   */
  async getAllRatings(imdbId: string): Promise<{
    imdb_rating: string | null;
    imdb_votes: string | null;
    rotten_tomatoes: string | null;
    metacritic: string | null;
  }> {
    const movie = await this.getMovieByImdbId(imdbId);
    if (!movie) {
      return {
        imdb_rating: null,
        imdb_votes: null,
        rotten_tomatoes: null,
        metacritic: null
      };
    }

    // Extract Rotten Tomatoes rating from Ratings array
    const rtRating = movie.Ratings?.find(r => r.Source === 'Rotten Tomatoes');

    return {
      imdb_rating: movie.imdbRating !== 'N/A' ? movie.imdbRating : null,
      imdb_votes: movie.imdbVotes !== 'N/A' ? movie.imdbVotes : null,
      rotten_tomatoes: rtRating?.Value || null,
      metacritic: movie.Metascore !== 'N/A' ? movie.Metascore : null
    };
  }

  /**
   * Batch fetch IMDB ratings for multiple movies
   */
  async batchGetImdbRatings(imdbIds: (string | null | undefined)[]): Promise<Map<string, { rating: string; votes: string }>> {
    const results = new Map<string, { rating: string; votes: string }>();
    
    // Filter out null/undefined IDs
    const validIds = imdbIds.filter((id): id is string => !!id);

    // Fetch ratings in parallel (but be mindful of rate limits)
    const promises = validIds.map(async (imdbId) => {
      const result = await this.getImdbRating(imdbId);
      if (result.rating) {
        results.set(imdbId, { rating: result.rating, votes: result.votes || '0' });
      }
    });

    await Promise.all(promises);
    return results;
  }
}

// Export singleton instance
export const omdbService = new OMDbService();
