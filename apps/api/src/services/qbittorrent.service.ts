import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';

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

    // Try to load cookie from file on initialization
    this.loadCookieFromFile();
  }

  /**
   * Load cookie from cookie file (if exists)
   */
  private loadCookieFromFile(): void {
    try {
      const cookieFile = '/tmp/qbt-cookies.txt';
      const content = readFileSync(cookieFile, 'utf-8');

      // Parse Netscape cookie file format
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;

        const parts = line.split('\t');
        if (parts.length >= 7) {
          const name = parts[5];
          const value = parts[6];
          this.cookie = `${name}=${value}`;
          console.log('Loaded qBittorrent cookie from file');
          return;
        }
      }
    } catch (error) {
      // Cookie file doesn't exist or can't be read, will use login() instead
      console.log('Cookie file not found, will use login()');
    }
  }

  /**
   * Authenticate with qBittorrent Web API
   */
  async login(): Promise<void> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', this.config.username);
      formData.append('password', this.config.password);

      const response = await this.client.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      });

      // Extract SID cookie from set-cookie header
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader && setCookieHeader.length > 0) {
        // Parse the cookie (format: "SID=value; path=/")
        const cookieString = setCookieHeader[0];
        const sidMatch = cookieString.match(/SID=([^;]+)/);
        if (sidMatch) {
          this.cookie = `SID=${sidMatch[1]}`;
          console.log('qBittorrent login successful, cookie set');
          return;
        }
      }

      throw new Error('No cookie returned from login');
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
   * Ensure we're authenticated before making requests
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.cookie) {
      await this.login();
    }
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
   * Set global download speed limit (bytes/sec, 0 = unlimited)
   */
  async setDownloadLimit(limit: number): Promise<void> {
    try {
      await this.ensureAuthenticated();
      const formData = new URLSearchParams();
      formData.append('limit', limit.toString());

      await this.client.post('/transfer/setDownloadLimit', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.cookie,
        },
      });
    } catch (error) {
      console.error('Failed to set download limit:', error);
      throw error;
    }
  }

  /**
   * Set global upload speed limit (bytes/sec, 0 = unlimited)
   */
  async setUploadLimit(limit: number): Promise<void> {
    try {
      await this.ensureAuthenticated();
      const formData = new URLSearchParams();
      formData.append('limit', limit.toString());

      await this.client.post('/transfer/setUploadLimit', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.cookie,
        },
      });
    } catch (error) {
      console.error('Failed to set upload limit:', error);
      throw error;
    }
  }

  /**
   * Get global transfer information including speed limits
   */
  async getTransferInfo(): Promise<{
    dl_info_speed: number;
    up_info_speed: number;
    dl_rate_limit: number;
    up_rate_limit: number;
    dl_info_data: number;
    up_info_data: number;
  }> {
    try {
      await this.ensureAuthenticated();
      const response = await this.client.get('/transfer/info', {
        headers: {
          Cookie: this.cookie,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get transfer info:', error);
      throw error;
    }
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

  /**
   * Get application preferences (including network interface)
   */
  async getPreferences(): Promise<any> {
    try {
      await this.ensureAuthenticated();
      const response = await this.client.get('/app/preferences', {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get preferences:', error);
      throw error;
    }
  }

  /**
   * Set application preferences
   */
  async setPreferences(preferences: any): Promise<void> {
    try {
      await this.ensureAuthenticated();
      const formData = new URLSearchParams();
      formData.append('json', JSON.stringify(preferences));

      await this.client.post('/app/setPreferences', formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('[qBittorrent] Preferences updated successfully');
    } catch (error) {
      console.error('Failed to set preferences:', error);
      throw error;
    }
  }

  /**
   * Get current network interface binding
   */
  async getNetworkInterface(): Promise<string | null> {
    try {
      const prefs = await this.getPreferences();
      const currentInterface = prefs.current_interface_name || null;
      console.log('[qBittorrent] Current network interface:', currentInterface || 'None (all interfaces)');
      return currentInterface;
    } catch (error) {
      console.error('Failed to get network interface:', error);
      return null;
    }
  }

  /**
   * Set network interface binding for qBittorrent
   * This ensures torrents only work when connected to the specified interface
   */
  async setNetworkInterface(interfaceName: string | null): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const preferences: any = {
        current_interface_name: interfaceName || '',
      };

      // If interface is set, also set the interface address type to prefer IPv4
      if (interfaceName) {
        preferences.current_interface_address = '';
        console.log(`[qBittorrent] Binding to network interface: ${interfaceName}`);
      } else {
        console.log('[qBittorrent] Unbinding from network interface (allowing all interfaces)');
      }

      await this.setPreferences(preferences);

      console.log('[qBittorrent] Network interface binding updated successfully');
    } catch (error) {
      console.error('Failed to set network interface:', error);
      throw error;
    }
  }

  /**
   * Bind qBittorrent to VPN interface (auto-kill switch)
   * When bound to VPN interface, torrents will only work when VPN is connected
   */
  async bindToVPN(vpnInterface: string): Promise<void> {
    try {
      console.log(`[qBittorrent] Binding to VPN interface: ${vpnInterface}`);
      await this.setNetworkInterface(vpnInterface);
      console.log('[qBittorrent] Successfully bound to VPN interface - torrents will only work when VPN is active');
    } catch (error) {
      console.error('Failed to bind to VPN:', error);
      throw new Error('Failed to bind qBittorrent to VPN interface');
    }
  }

  /**
   * Unbind qBittorrent from VPN interface
   */
  async unbindFromVPN(): Promise<void> {
    try {
      console.log('[qBittorrent] Unbinding from VPN interface');
      await this.setNetworkInterface(null);
      console.log('[qBittorrent] Successfully unbound from VPN interface');
    } catch (error) {
      console.error('Failed to unbind from VPN:', error);
      throw new Error('Failed to unbind qBittorrent from VPN interface');
    }
  }
}

// Singleton instance
export const qbittorrentService = new QBittorrentService();
