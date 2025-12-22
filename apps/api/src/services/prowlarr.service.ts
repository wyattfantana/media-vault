import axios, { AxiosInstance } from 'axios';

interface ProwlarrConfig {
  host: string;
  port: number;
  apiKey: string;
  urlBase?: string;
}

interface ProwlarrIndexer {
  id: number;
  name: string;
  fields: any[];
  implementationName: string;
  implementation: string;
  configContract: string;
  infoLink: string;
  tags: number[];
  enable: boolean;
  protocol: string;
  priority: number;
  downloadClientId: number;
  categories: any[];
  capabilities: {
    categories: any[];
    supportsRawSearch: boolean;
  };
}

interface ProwlarrSystemStatus {
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

interface ProwlarrSearchResult {
  guid: string;
  indexerId: number;
  indexer: string;
  title: string;
  publishDate: string;
  size: number;
  infoUrl?: string;
  downloadUrl?: string;
  magnetUrl?: string;
  seeders?: number;
  leechers?: number;
  categories: number[];
  protocol: string;
}

interface ProwlarrApplication {
  id: number;
  name: string;
  fields: any[];
  implementationName: string;
  implementation: string;
  configContract: string;
  infoLink: string;
  tags: number[];
  syncLevel: string;
}

export class ProwlarrService {
  private client: AxiosInstance;
  private config: ProwlarrConfig;

  constructor(config?: Partial<ProwlarrConfig>) {
    this.config = {
      host: config?.host || process.env.PROWLARR_HOST || 'localhost',
      port: config?.port || parseInt(process.env.PROWLARR_PORT || '9696'),
      apiKey: config?.apiKey || process.env.PROWLARR_API_KEY || '',
      urlBase: config?.urlBase || process.env.PROWLARR_URL_BASE || '',
    };

    const baseURL = `http://${this.config.host}:${this.config.port}${this.config.urlBase}/api/v1`;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    });
  }

  /**
   * Test connection to Prowlarr
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemStatus();
      return true;
    } catch (error) {
      console.error('Prowlarr connection test failed:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<ProwlarrSystemStatus> {
    try {
      const response = await this.client.get('/system/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get Prowlarr system status:', error);
      throw new Error('Failed to retrieve Prowlarr system status');
    }
  }

  /**
   * Get all indexers
   */
  async getIndexers(): Promise<ProwlarrIndexer[]> {
    try {
      const response = await this.client.get('/indexer');
      return response.data;
    } catch (error) {
      console.error('Failed to get indexers from Prowlarr:', error);
      throw new Error('Failed to retrieve indexers from Prowlarr');
    }
  }

  /**
   * Get a specific indexer by ID
   */
  async getIndexer(id: number): Promise<ProwlarrIndexer> {
    try {
      const response = await this.client.get(`/indexer/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get indexer ${id} from Prowlarr:`, error);
      throw new Error('Failed to retrieve indexer from Prowlarr');
    }
  }

  /**
   * Update indexer
   */
  async updateIndexer(id: number, indexer: Partial<ProwlarrIndexer>): Promise<ProwlarrIndexer> {
    try {
      const response = await this.client.put(`/indexer/${id}`, indexer);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update indexer ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to update indexer');
    }
  }

  /**
   * Search across all enabled indexers
   */
  async search(query: string, type?: 'movie' | 'tv'): Promise<ProwlarrSearchResult[]> {
    try {
      const params: any = { query };
      if (type === 'movie') {
        params.categories = [2000]; // Movies category
      } else if (type === 'tv') {
        params.categories = [5000]; // TV category
      }

      const response = await this.client.get('/search', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to search in Prowlarr:', error);
      throw new Error('Failed to search indexers');
    }
  }

  /**
   * Get all applications (Sonarr/Radarr connections)
   */
  async getApplications(): Promise<ProwlarrApplication[]> {
    try {
      const response = await this.client.get('/applications');
      return response.data;
    } catch (error) {
      console.error('Failed to get applications from Prowlarr:', error);
      throw new Error('Failed to retrieve applications from Prowlarr');
    }
  }

  /**
   * Add an application (Sonarr or Radarr)
   */
  async addApplication(application: {
    name: string;
    implementation: 'Radarr' | 'Sonarr';
    baseUrl: string;
    apiKey: string;
    syncLevel: 'disabled' | 'addOnly' | 'fullSync';
  }): Promise<ProwlarrApplication> {
    try {
      const appData: any = {
        name: application.name,
        fields: [
          {
            name: 'baseUrl',
            value: application.baseUrl,
          },
          {
            name: 'apiKey',
            value: application.apiKey,
          },
          {
            name: 'syncLevel',
            value: application.syncLevel,
          },
        ],
        implementationName: application.implementation,
        implementation: application.implementation,
        configContract: `${application.implementation}Settings`,
        tags: [],
        syncLevel: application.syncLevel,
      };

      const response = await this.client.post('/applications', appData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to add application to Prowlarr:', error);
      throw new Error(error.response?.data?.message || 'Failed to add application to Prowlarr');
    }
  }

  /**
   * Remove an application
   */
  async removeApplication(id: number): Promise<void> {
    try {
      await this.client.delete(`/applications/${id}`);
    } catch (error) {
      console.error(`Failed to remove application ${id} from Prowlarr:`, error);
      throw new Error('Failed to remove application from Prowlarr');
    }
  }

  /**
   * Test indexer (without saving)
   */
  async testIndexer(indexerId: number): Promise<{ isValid: boolean; errors: any[] }> {
    try {
      const indexer = await this.getIndexer(indexerId);
      const response = await this.client.post('/indexer/test', indexer);
      return { isValid: true, errors: [] };
    } catch (error: any) {
      console.error(`Failed to test indexer ${indexerId}:`, error);
      return {
        isValid: false,
        errors: error.response?.data?.errors || [{ message: 'Test failed' }],
      };
    }
  }

  /**
   * Sync indexers with applications
   */
  async syncApplications(): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'ApplicationSync',
      });
    } catch (error) {
      console.error('Failed to sync applications:', error);
      throw new Error('Failed to sync applications');
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
export const prowlarrService = new ProwlarrService();
