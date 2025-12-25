import axios, { AxiosInstance } from 'axios';
import { AppDataSource } from '../data-source.js';

interface BazarrConfig {
  host: string;
  port: number;
  apiKey: string;
  urlBase?: string;
}

interface BazarrSystemStatus {
  bazarr_version: string;
  sonarr_version?: string;
  radarr_version?: string;
  operating_system: string;
  python_version: string;
  bazarr_directory: string;
}

interface BazarrSubtitle {
  code2: string;  // Language code (en, es, fr, etc.)
  code3: string;  // ISO 639-3 code
  name: string;   // Language name
  enabled: boolean;
}

interface BazarrMovieSubtitle {
  path: string;
  video_path: string;
  subtitles: Array<{
    code2: string;
    code3: string;
    name: string;
    path: string;
    forced: boolean;
    hi: boolean;
  }>;
  missing_subtitles: string[];
}

interface BazarrSeriesSubtitle {
  path: string;
  video_path: string;
  subtitles: Array<{
    code2: string;
    code3: string;
    name: string;
    path: string;
    forced: boolean;
    hi: boolean;
  }>;
  missing_subtitles: string[];
}

interface BazarrSearchResult {
  subtitle_id: string;
  provider: string;
  language: string;
  hearing_impaired: boolean;
  forced: boolean;
  score: number;
  matches: string[];
  release_info: string;
  url: string;
}

interface BazarrMovie {
  radarrId: number;
  title: string;
  path: string;
  tmdbId: string;
  subtitles: string[];
  missing_subtitles: string[];
  monitored: boolean;
}

interface BazarrSeries {
  sonarrSeriesId: number;
  title: string;
  path: string;
  tvdbId: string;
  subtitles: string[];
  missing_subtitles: string[];
  monitored: boolean;
}

export class BazarrService {
  private client: AxiosInstance | null = null;
  private config: BazarrConfig | null = null;
  private dbInitialized: boolean = false;

  constructor() {
    this.initializeFromDatabase();
  }

  /**
   * Initialize Bazarr configuration from database
   */
  private async initializeFromDatabase() {
    if (this.dbInitialized) return;

    try {
      if (!AppDataSource.isInitialized) {
        return; // Database not ready yet
      }

      const result = await AppDataSource.query(
        `SELECT bazarr_url, bazarr_api_key FROM user_preferences WHERE user_id = 1 LIMIT 1`
      );

      if (result.length > 0 && result[0].bazarr_url && result[0].bazarr_api_key) {
        const url = result[0].bazarr_url;
        const apiKey = result[0].bazarr_api_key;

        // Parse URL to get host and port
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const port = parseInt(urlObj.port || '6767');

        this.configure({ host, port, apiKey });
        this.dbInitialized = true;
        console.log('[Bazarr] Service configured from database ✓');
      }
    } catch (error) {
      // Database might not be initialized yet or table doesn't exist
      console.log('[Bazarr] Database configuration not available yet');
    }
  }

  /**
   * Configure Bazarr connection
   */
  configure(config: Partial<BazarrConfig>) {
    this.config = {
      host: config.host || process.env.BAZARR_HOST || 'localhost',
      port: config.port || parseInt(process.env.BAZARR_PORT || '6767'),
      apiKey: config.apiKey || process.env.BAZARR_API_KEY || '',
      urlBase: config.urlBase || process.env.BAZARR_URL_BASE || '',
    };

    const baseURL = `http://${this.config.host}:${this.config.port}${this.config.urlBase}/api`;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    });
  }

  /**
   * Check if Bazarr is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * Ensure client is configured before making requests
   */
  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new Error('Bazarr not configured. Please configure Bazarr in settings.');
    }
  }

  /**
   * Test connection to Bazarr
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemStatus();
      return true;
    } catch (error) {
      console.error('[Bazarr] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get system status and version info
   */
  async getSystemStatus(): Promise<BazarrSystemStatus> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/system/status');
      // Bazarr wraps response in a 'data' object
      return response.data.data || response.data;
    } catch (error) {
      console.error('[Bazarr] Failed to get system status:', error);
      throw new Error('Failed to retrieve Bazarr system status');
    }
  }

  /**
   * Get enabled languages
   */
  async getLanguages(): Promise<BazarrSubtitle[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/system/languages');
      return response.data;
    } catch (error) {
      console.error('[Bazarr] Failed to get languages:', error);
      throw new Error('Failed to retrieve languages from Bazarr');
    }
  }

  /**
   * Get all movies with subtitle status
   */
  async getMovies(): Promise<BazarrMovie[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/movies');
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to get movies:', error);
      throw new Error('Failed to retrieve movies from Bazarr');
    }
  }

  /**
   * Get all series with subtitle status
   */
  async getSeries(): Promise<BazarrSeries[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/series');
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to get series:', error);
      throw new Error('Failed to retrieve series from Bazarr');
    }
  }

  /**
   * Search for subtitles for a movie
   */
  async searchMovieSubtitles(
    radarrId: number,
    language: string
  ): Promise<BazarrSearchResult[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/movies/subtitles', {
        params: {
          radarrid: radarrId,
          language,
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to search movie subtitles:', error);
      throw new Error('Failed to search subtitles for movie');
    }
  }

  /**
   * Search for subtitles for a series episode
   */
  async searchSeriesSubtitles(
    sonarrEpisodeId: number,
    language: string
  ): Promise<BazarrSearchResult[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/episodes/subtitles', {
        params: {
          episodeid: sonarrEpisodeId,
          language,
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to search series subtitles:', error);
      throw new Error('Failed to search subtitles for series');
    }
  }

  /**
   * Download subtitle for a movie
   */
  async downloadMovieSubtitle(
    radarrId: number,
    language: string,
    subtitleId: string,
    hi: boolean = false,
    forced: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    this.ensureConfigured();

    try {
      const response = await this.client!.post('/movies/subtitles', {
        radarrid: radarrId,
        language,
        subtitleid: subtitleId,
        hi,
        forced,
      });

      return {
        success: true,
        message: 'Subtitle downloaded successfully',
      };
    } catch (error: any) {
      console.error('[Bazarr] Failed to download movie subtitle:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to download subtitle',
      };
    }
  }

  /**
   * Download subtitle for a series episode
   */
  async downloadSeriesSubtitle(
    sonarrEpisodeId: number,
    language: string,
    subtitleId: string,
    hi: boolean = false,
    forced: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    this.ensureConfigured();

    try {
      const response = await this.client!.post('/episodes/subtitles', {
        episodeid: sonarrEpisodeId,
        language,
        subtitleid: subtitleId,
        hi,
        forced,
      });

      return {
        success: true,
        message: 'Subtitle downloaded successfully',
      };
    } catch (error: any) {
      console.error('[Bazarr] Failed to download series subtitle:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to download subtitle',
      };
    }
  }

  /**
   * Get missing subtitles for movies
   */
  async getMissingMovieSubtitles(): Promise<BazarrMovie[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/movies/wanted');
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to get missing movie subtitles:', error);
      throw new Error('Failed to retrieve missing movie subtitles');
    }
  }

  /**
   * Get missing subtitles for series
   */
  async getMissingSeriesSubtitles(): Promise<any[]> {
    this.ensureConfigured();

    try {
      const response = await this.client!.get('/episodes/wanted');
      return response.data.data || [];
    } catch (error) {
      console.error('[Bazarr] Failed to get missing series subtitles:', error);
      throw new Error('Failed to retrieve missing series subtitles');
    }
  }

  /**
   * Trigger a search for missing subtitles
   */
  async searchAllMissing(): Promise<{ success: boolean; message: string }> {
    this.ensureConfigured();

    try {
      await this.client!.post('/system/tasks', {
        taskid: 'SearchAllWantedSubtitles',
      });

      return {
        success: true,
        message: 'Search for missing subtitles initiated',
      };
    } catch (error: any) {
      console.error('[Bazarr] Failed to trigger missing subtitle search:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to search for missing subtitles',
      };
    }
  }

  /**
   * Get subtitle for a specific movie by path
   * This is useful when we have a movie file path from our downloads
   */
  async getMovieSubtitlesByPath(moviePath: string): Promise<BazarrMovieSubtitle | null> {
    this.ensureConfigured();

    try {
      const movies = await this.getMovies();
      const movie = movies.find(m => m.path === moviePath);

      if (!movie) {
        return null;
      }

      // Get detailed subtitle info for this movie
      const response = await this.client!.get(`/movies/${movie.radarrId}`);
      return response.data;
    } catch (error) {
      console.error('[Bazarr] Failed to get movie subtitles by path:', error);
      return null;
    }
  }

  /**
   * Search and download best subtitle for a movie by TMDB ID
   * This is the simplified method we'll use for auto-download
   */
  async autoDownloadMovieSubtitles(
    tmdbId: number,
    languages: string[] = ['en']
  ): Promise<{ success: boolean; message: string; downloadedLanguages: string[] }> {
    this.ensureConfigured();

    try {
      console.log(`[Bazarr] Auto-downloading subtitles for TMDB ID ${tmdbId}`);

      // First, we need to find the movie in Bazarr by TMDB ID
      const movies = await this.getMovies();
      const movie = movies.find(m => m.tmdbId === tmdbId.toString());

      if (!movie) {
        return {
          success: false,
          message: 'Movie not found in Bazarr. Please add it first.',
          downloadedLanguages: [],
        };
      }

      const downloadedLanguages: string[] = [];

      // Search and download for each requested language
      for (const language of languages) {
        // Check if subtitle already exists
        if (movie.subtitles.includes(language)) {
          console.log(`[Bazarr] Subtitle for ${language} already exists`);
          continue;
        }

        // Search for subtitles
        const results = await this.searchMovieSubtitles(movie.radarrId, language);

        if (results.length === 0) {
          console.log(`[Bazarr] No subtitles found for language: ${language}`);
          continue;
        }

        // Download the best match (highest score)
        const bestMatch = results.sort((a, b) => b.score - a.score)[0];
        const downloadResult = await this.downloadMovieSubtitle(
          movie.radarrId,
          language,
          bestMatch.subtitle_id,
          bestMatch.hearing_impaired,
          bestMatch.forced
        );

        if (downloadResult.success) {
          downloadedLanguages.push(language);
          console.log(`[Bazarr] Downloaded ${language} subtitle from ${bestMatch.provider}`);
        }
      }

      return {
        success: downloadedLanguages.length > 0,
        message:
          downloadedLanguages.length > 0
            ? `Downloaded subtitles: ${downloadedLanguages.join(', ')}`
            : 'No subtitles were downloaded',
        downloadedLanguages,
      };
    } catch (error: any) {
      console.error('[Bazarr] Failed to auto-download subtitles:', error);
      return {
        success: false,
        message: error.message || 'Failed to auto-download subtitles',
        downloadedLanguages: [],
      };
    }
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    if (this.config) {
      this.config.apiKey = apiKey;
    }
    if (this.client) {
      this.client.defaults.headers['X-Api-Key'] = apiKey;
    }
  }

  /**
   * Get Bazarr status for display
   */
  async getStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    version?: string;
    moviesCount?: number;
    seriesCount?: number;
  }> {
    if (!this.isConfigured()) {
      return { configured: false, connected: false };
    }

    try {
      const status = await this.getSystemStatus();
      const movies = await this.getMovies();
      const series = await this.getSeries();

      return {
        configured: true,
        connected: true,
        version: status.bazarr_version,
        moviesCount: movies.length,
        seriesCount: series.length,
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
      };
    }
  }
}

// Export singleton instance
export const bazarrService = new BazarrService();
