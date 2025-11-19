import axios, { AxiosInstance } from 'axios';

export interface JellyfinConfig {
  url: string;
  apiKey: string;
}

export interface JellyfinLibrary {
  id: string;
  name: string;
  collectionType: string;
  path: string;
}

export interface JellyfinScanStatus {
  success: boolean;
  message: string;
}

export class JellyfinService {
  private client: AxiosInstance | null = null;
  private config: JellyfinConfig | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  /**
   * Initialize Jellyfin client from environment variables
   */
  private initializeFromEnv() {
    const url = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (url && apiKey) {
      this.configure({ url, apiKey });
    }
  }

  /**
   * Configure Jellyfin connection
   */
  configure(config: JellyfinConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url,
      headers: {
        'X-Emby-Token': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Check if Jellyfin is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * Test connection to Jellyfin server
   */
  async testConnection(): Promise<{ success: boolean; serverInfo?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Jellyfin not configured' };
    }

    try {
      const response = await this.client.get('/System/Info/Public');
      return {
        success: true,
        serverInfo: {
          name: response.data.ServerName,
          version: response.data.Version,
          id: response.data.Id,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Jellyfin',
      };
    }
  }

  /**
   * Get all libraries from Jellyfin
   */
  async getLibraries(): Promise<JellyfinLibrary[]> {
    if (!this.client) {
      throw new Error('Jellyfin not configured');
    }

    try {
      const response = await this.client.get('/Library/VirtualFolders');
      return response.data.map((lib: any) => ({
        id: lib.ItemId,
        name: lib.Name,
        collectionType: lib.CollectionType || 'mixed',
        path: lib.Locations?.[0] || '',
      }));
    } catch (error: any) {
      console.error('Failed to get Jellyfin libraries:', error.message);
      return [];
    }
  }

  /**
   * Trigger a library scan for a specific path or all libraries
   */
  async triggerLibraryScan(libraryId?: string): Promise<JellyfinScanStatus> {
    if (!this.client) {
      return { success: false, message: 'Jellyfin not configured' };
    }

    try {
      if (libraryId) {
        // Scan specific library
        await this.client.post(`/Items/${libraryId}/Refresh`, {
          Recursive: true,
          ImageRefreshMode: 'Default',
          MetadataRefreshMode: 'Default',
          ReplaceAllImages: false,
          ReplaceAllMetadata: false,
        });
        return { success: true, message: `Library scan triggered for ${libraryId}` };
      } else {
        // Scan all libraries
        await this.client.post('/Library/Refresh');
        return { success: true, message: 'Full library scan triggered' };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to trigger library scan',
      };
    }
  }

  /**
   * Find library by path
   */
  async findLibraryByPath(searchPath: string): Promise<JellyfinLibrary | null> {
    const libraries = await this.getLibraries();
    return libraries.find(lib =>
      searchPath.includes(lib.path) || lib.path.includes(searchPath)
    ) || null;
  }

  /**
   * Trigger scan for specific media file
   * This will scan the library that contains the file
   */
  async scanMediaFile(filePath: string): Promise<JellyfinScanStatus> {
    const library = await this.findLibraryByPath(filePath);

    if (library) {
      return this.triggerLibraryScan(library.id);
    } else {
      // If no specific library found, trigger a full scan
      return this.triggerLibraryScan();
    }
  }

  /**
   * Get Jellyfin server status
   */
  async getServerStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    serverName?: string;
    version?: string;
    libraries?: JellyfinLibrary[];
  }> {
    if (!this.isConfigured()) {
      return { configured: false, connected: false };
    }

    const connectionTest = await this.testConnection();
    if (!connectionTest.success) {
      return { configured: true, connected: false };
    }

    const libraries = await this.getLibraries();

    return {
      configured: true,
      connected: true,
      serverName: connectionTest.serverInfo?.name,
      version: connectionTest.serverInfo?.version,
      libraries,
    };
  }
}

// Export singleton instance
export const jellyfinService = new JellyfinService();
