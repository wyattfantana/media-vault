import axios, { AxiosInstance } from 'axios';

interface SonarrConfig {
  host: string;
  port: number;
  apiKey: string;
  urlBase?: string;
}

interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  tvdbId: number;
  imdbId?: string;
  path: string;
  monitored: boolean;
  seasonFolder: boolean;
  status: string;
  overview?: string;
  network?: string;
  images: Array<{ coverType: string; url: string }>;
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: {
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      percentOfEpisodes: number;
    };
  }>;
  qualityProfileId: number;
  added: string;
  statistics?: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

interface SonarrSystemStatus {
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

interface SonarrQualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
  items: any[];
}

interface SonarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
  unmappedFolders: any[];
}

export class SonarrService {
  private client: AxiosInstance;
  private config: SonarrConfig;

  constructor(config?: Partial<SonarrConfig>) {
    this.config = {
      host: config?.host || process.env.SONARR_HOST || 'localhost',
      port: config?.port || parseInt(process.env.SONARR_PORT || '8989'),
      apiKey: config?.apiKey || process.env.SONARR_API_KEY || '',
      urlBase: config?.urlBase || process.env.SONARR_URL_BASE || '',
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
   * Test connection to Sonarr
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemStatus();
      return true;
    } catch (error) {
      console.error('Sonarr connection test failed:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<SonarrSystemStatus> {
    try {
      const response = await this.client.get('/system/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get Sonarr system status:', error);
      throw new Error('Failed to retrieve Sonarr system status');
    }
  }

  /**
   * Get all TV series
   */
  async getSeries(): Promise<SonarrSeries[]> {
    try {
      const response = await this.client.get('/series');
      return response.data;
    } catch (error) {
      console.error('Failed to get series from Sonarr:', error);
      throw new Error('Failed to retrieve series from Sonarr');
    }
  }

  /**
   * Get a specific series by ID
   */
  async getSeriesById(id: number): Promise<SonarrSeries> {
    try {
      const response = await this.client.get(`/series/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get series ${id} from Sonarr:`, error);
      throw new Error('Failed to retrieve series from Sonarr');
    }
  }

  /**
   * Search for a TV series by title
   */
  async searchSeries(term: string): Promise<SonarrSeries[]> {
    try {
      const response = await this.client.get('/series/lookup', {
        params: { term },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search for series in Sonarr:', error);
      throw new Error('Failed to search for series');
    }
  }

  /**
   * Add a TV series to Sonarr
   */
  async addSeries(series: {
    title: string;
    year?: number;
    tvdbId: number;
    qualityProfileId: number;
    rootFolderPath: string;
    monitored?: boolean;
    seasonFolder?: boolean;
    searchForMissingEpisodes?: boolean;
    seasons?: Array<{ seasonNumber: number; monitored: boolean }>;
  }): Promise<SonarrSeries> {
    try {
      const response = await this.client.post('/series', {
        title: series.title,
        year: series.year,
        tvdbId: series.tvdbId,
        qualityProfileId: series.qualityProfileId,
        titleSlug: series.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        images: [],
        rootFolderPath: series.rootFolderPath,
        monitored: series.monitored !== false,
        seasonFolder: series.seasonFolder !== false,
        seasons: series.seasons || [],
        addOptions: {
          searchForMissingEpisodes: series.searchForMissingEpisodes !== false,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to add series to Sonarr:', error);
      throw new Error(error.response?.data?.message || 'Failed to add series to Sonarr');
    }
  }

  /**
   * Remove a TV series from Sonarr
   */
  async removeSeries(id: number, deleteFiles: boolean = false): Promise<void> {
    try {
      await this.client.delete(`/series/${id}`, {
        params: {
          deleteFiles,
          addImportExclusion: false,
        },
      });
    } catch (error) {
      console.error(`Failed to remove series ${id} from Sonarr:`, error);
      throw new Error('Failed to remove series from Sonarr');
    }
  }

  /**
   * Get quality profiles
   */
  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    try {
      const response = await this.client.get('/qualityprofile');
      return response.data;
    } catch (error) {
      console.error('Failed to get quality profiles from Sonarr:', error);
      throw new Error('Failed to retrieve quality profiles');
    }
  }

  /**
   * Get root folders
   */
  async getRootFolders(): Promise<SonarrRootFolder[]> {
    try {
      const response = await this.client.get('/rootfolder');
      return response.data;
    } catch (error) {
      console.error('Failed to get root folders from Sonarr:', error);
      throw new Error('Failed to retrieve root folders');
    }
  }

  /**
   * Add root folder
   */
  async addRootFolder(path: string): Promise<SonarrRootFolder> {
    try {
      const response = await this.client.post('/rootfolder', { path });
      return response.data;
    } catch (error: any) {
      console.error('Failed to add root folder to Sonarr:', error);
      throw new Error(error.response?.data?.message || 'Failed to add root folder');
    }
  }

  /**
   * Trigger a series search
   */
  async searchSeriesEpisodes(seriesId: number): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'SeriesSearch',
        seriesId,
      });
    } catch (error) {
      console.error(`Failed to search for series ${seriesId}:`, error);
      throw new Error('Failed to trigger series search');
    }
  }

  /**
   * Trigger a season search
   */
  async searchSeason(seriesId: number, seasonNumber: number): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'SeasonSearch',
        seriesId,
        seasonNumber,
      });
    } catch (error) {
      console.error(`Failed to search for season ${seasonNumber} of series ${seriesId}:`, error);
      throw new Error('Failed to trigger season search');
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
      console.error('Failed to get Sonarr queue:', error);
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
export const sonarrService = new SonarrService();
