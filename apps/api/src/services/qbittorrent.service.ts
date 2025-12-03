import axios, { AxiosInstance } from 'axios';

interface QBittorrentConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface TorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  state: string;
  category: string;
  save_path: string;
}

export class QBittorrentService {
  private client: AxiosInstance;
  private config: QBittorrentConfig;
  private cookie: string = '';

  constructor(config?: Partial<QBittorrentConfig>) {
    this.config = {
      host: config?.host || process.env.QBITTORRENT_HOST || 'localhost',
      port: config?.port || parseInt(process.env.QBITTORRENT_PORT || '8080'),
      username: config?.username || process.env.QBITTORRENT_USERNAME || 'admin',
      password: config?.password || process.env.QBITTORRENT_PASSWORD || 'adminadmin',
    };

    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}/api/v2`,
      timeout: 10000,
    });
  }

  /**
   * Authenticate with qBittorrent Web API
   */
  async login(): Promise<void> {
    try {
      const response = await this.client.post('/auth/login', null, {
        params: {
          username: this.config.username,
          password: this.config.password,
        },
      });

      // Extract SID cookie
      const cookies = response.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.cookie = cookies[0].split(';')[0];
      }
    } catch (error) {
      console.error('qBittorrent login failed:', error);
      throw new Error('Failed to authenticate with qBittorrent');
    }
  }

  /**
   * Get auth headers with cookie
   */
  private getHeaders() {
    return {
      Cookie: this.cookie,
    };
  }

  /**
   * Add torrent by URL (magnet link or .torrent URL)
   */
  async addTorrent(
    url: string,
    options: {
      savePath?: string;
      category?: string;
      paused?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure we're logged in
      if (!this.cookie) {
        await this.login();
      }

      const formData = new URLSearchParams();
      formData.append('urls', url);

      if (options.savePath) {
        formData.append('savepath', options.savePath);
      }
      if (options.category) {
        formData.append('category', options.category);
      }
      if (options.paused !== undefined) {
        formData.append('paused', options.paused.toString());
      }

      const response = await this.client.post('/torrents/add', formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data === 'Ok.') {
        return { success: true, message: 'Torrent added successfully' };
      } else {
        return { success: false, message: response.data || 'Failed to add torrent' };
      }
    } catch (error: any) {
      console.error('Failed to add torrent:', error);
      return {
        success: false,
        message: error.response?.data || error.message || 'Failed to add torrent'
      };
    }
  }

  /**
   * Get list of all torrents
   */
  async getTorrents(filter?: string): Promise<TorrentInfo[]> {
    try {
      if (!this.cookie) {
        await this.login();
      }

      const response = await this.client.get('/torrents/info', {
        headers: this.getHeaders(),
        params: filter ? { filter } : {},
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get torrents:', error);
      throw new Error('Failed to retrieve torrents');
    }
  }

  /**
   * Get torrent properties
   */
  async getTorrentProperties(hash: string): Promise<any> {
    try {
      if (!this.cookie) {
        await this.login();
      }

      const response = await this.client.get('/torrents/properties', {
        headers: this.getHeaders(),
        params: { hash },
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get torrent properties:', error);
      throw error;
    }
  }

  /**
   * Delete torrent
   */
  async deleteTorrent(hashes: string | string[], deleteFiles: boolean = false): Promise<void> {
    try {
      if (!this.cookie) {
        await this.login();
      }

      const hashList = Array.isArray(hashes) ? hashes.join('|') : hashes;
      const formData = new URLSearchParams();
      formData.append('hashes', hashList);
      formData.append('deleteFiles', deleteFiles.toString());

      await this.client.post('/torrents/delete', formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error('Failed to delete torrent:', error);
      throw error;
    }
  }

  /**
   * Pause torrent
   */
  async pauseTorrent(hashes: string | string[]): Promise<void> {
    try {
      if (!this.cookie) {
        await this.login();
      }

      const hashList = Array.isArray(hashes) ? hashes.join('|') : hashes;
      const formData = new URLSearchParams();
      formData.append('hashes', hashList);

      await this.client.post('/torrents/pause', formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error('Failed to pause torrent:', error);
      throw error;
    }
  }

  /**
   * Resume torrent
   */
  async resumeTorrent(hashes: string | string[]): Promise<void> {
    try {
      if (!this.cookie) {
        await this.login();
      }

      const hashList = Array.isArray(hashes) ? hashes.join('|') : hashes;
      const formData = new URLSearchParams();
      formData.append('hashes', hashList);

      await this.client.post('/torrents/resume', formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error('Failed to resume torrent:', error);
      throw error;
    }
  }

  /**
   * Check if URL is a magnet link or torrent
   */
  static isTorrentUrl(url: string): boolean {
    return url.startsWith('magnet:') || url.endsWith('.torrent');
  }

  /**
   * Get application version
   */
  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get('/app/version');
      return response.data;
    } catch (error) {
      console.error('Failed to get qBittorrent version:', error);
      throw error;
    }
  }
}

// Singleton instance
export const qbittorrentService = new QBittorrentService();
