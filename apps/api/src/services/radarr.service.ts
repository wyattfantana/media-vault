import axios, { AxiosInstance } from 'axios';

interface RadarrConfig {
  host: string;
  port: number;
  apiKey: string;
  urlBase?: string;
}

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  path: string;
  monitored: boolean;
  hasFile: boolean;
  downloaded: boolean;
  sizeOnDisk: number;
  status: string;
  overview?: string;
  images: Array<{ coverType: string; url: string }>;
  qualityProfileId: number;
  added: string;
}

interface RadarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isMonoRuntime: boolean;
  isMono: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  branch: string;
  authentication: string;
  sqliteVersion: string;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
}

interface RadarrQualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
  items: any[];
}

interface RadarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
  unmappedFolders: any[];
}

export class RadarrService {
  private client: AxiosInstance;
  private config: RadarrConfig;

  constructor(config?: Partial<RadarrConfig>) {
    this.config = {
      host: config?.host || process.env.RADARR_HOST || 'localhost',
      port: config?.port || parseInt(process.env.RADARR_PORT || '7878'),
      apiKey: config?.apiKey || process.env.RADARR_API_KEY || '',
      urlBase: config?.urlBase || process.env.RADARR_URL_BASE || '',
    };

    const baseURL = `http://${this.config.host}:${this.config.port}${this.config.urlBase}/api/v3`;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    });
  }

  /**
   * Test connection to Radarr
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemStatus();
      return true;
    } catch (error) {
      console.error('Radarr connection test failed:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<RadarrSystemStatus> {
    try {
      const response = await this.client.get('/system/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get Radarr system status:', error);
      throw new Error('Failed to retrieve Radarr system status');
    }
  }

  /**
   * Get all movies
   */
  async getMovies(): Promise<RadarrMovie[]> {
    try {
      const response = await this.client.get('/movie');
      return response.data;
    } catch (error) {
      console.error('Failed to get movies from Radarr:', error);
      throw new Error('Failed to retrieve movies from Radarr');
    }
  }

  /**
   * Get a specific movie by ID
   */
  async getMovie(id: number): Promise<RadarrMovie> {
    try {
      const response = await this.client.get(`/movie/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get movie ${id} from Radarr:`, error);
      throw new Error('Failed to retrieve movie from Radarr');
    }
  }

  /**
   * Search for a movie by title
   */
  async searchMovie(term: string): Promise<RadarrMovie[]> {
    try {
      const response = await this.client.get('/movie/lookup', {
        params: { term },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search for movie in Radarr:', error);
      throw new Error('Failed to search for movie');
    }
  }

  /**
   * Add a movie to Radarr
   */
  async addMovie(movie: {
    title: string;
    year: number;
    tmdbId: number;
    qualityProfileId: number;
    rootFolderPath: string;
    monitored?: boolean;
    searchForMovie?: boolean;
  }): Promise<RadarrMovie> {
    try {
      // First, lookup the movie to get complete metadata
      const lookupResponse = await this.client.get('/movie/lookup', {
        params: { term: `tmdb:${movie.tmdbId}` }
      });

      if (!lookupResponse.data || lookupResponse.data.length === 0) {
        throw new Error('Movie not found in TMDB');
      }

      const movieData = lookupResponse.data[0];

      // Now add the movie with complete metadata
      const response = await this.client.post('/movie', {
        ...movieData,
        qualityProfileId: movie.qualityProfileId,
        rootFolderPath: movie.rootFolderPath,
        monitored: movie.monitored !== false,
        addOptions: {
          searchForMovie: movie.searchForMovie !== false,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to add movie to Radarr:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw new Error(error.response?.data?.message || error.message || 'Failed to add movie to Radarr');
    }
  }

  /**
   * Remove a movie from Radarr
   */
  async removeMovie(id: number, deleteFiles: boolean = false): Promise<void> {
    try {
      await this.client.delete(`/movie/${id}`, {
        params: {
          deleteFiles,
          addImportExclusion: false,
        },
      });
    } catch (error) {
      console.error(`Failed to remove movie ${id} from Radarr:`, error);
      throw new Error('Failed to remove movie from Radarr');
    }
  }

  /**
   * Get quality profiles
   */
  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    try {
      const response = await this.client.get('/qualityprofile');
      return response.data;
    } catch (error) {
      console.error('Failed to get quality profiles from Radarr:', error);
      throw new Error('Failed to retrieve quality profiles');
    }
  }

  /**
   * Get root folders
   */
  async getRootFolders(): Promise<RadarrRootFolder[]> {
    try {
      const response = await this.client.get('/rootfolder');
      return response.data;
    } catch (error) {
      console.error('Failed to get root folders from Radarr:', error);
      throw new Error('Failed to retrieve root folders');
    }
  }

  /**
   * Add root folder
   */
  async addRootFolder(path: string): Promise<RadarrRootFolder> {
    try {
      const response = await this.client.post('/rootfolder', { path });
      return response.data;
    } catch (error: any) {
      console.error('Failed to add root folder to Radarr:', error);
      throw new Error(error.response?.data?.message || 'Failed to add root folder');
    }
  }

  /**
   * Trigger a movie search
   */
  async searchMovieReleases(movieId: number): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'MoviesSearch',
        movieIds: [movieId],
      });
    } catch (error) {
      console.error(`Failed to search for movie ${movieId}:`, error);
      throw new Error('Failed to trigger movie search');
    }
  }

  /**
   * Get download queue
   */
  async getQueue(): Promise<any[]> {
    try {
      const response = await this.client.get('/queue');
      return response.data.records || [];
    } catch (error) {
      console.error('Failed to get Radarr queue:', error);
      throw new Error('Failed to retrieve download queue');
    }
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.client.defaults.headers['X-Api-Key'] = apiKey;
  }
}

// Singleton instance
export const radarrService = new RadarrService();
