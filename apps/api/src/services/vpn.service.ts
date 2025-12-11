import { exec } from 'child_process';
import { promisify } from 'util';
import { AppDataSource } from '../data-source.js';

const execAsync = promisify(exec);

// Use Windows Mullvad CLI from WSL2
const MULLVAD_CLI = '/mnt/c/Program Files/Mullvad VPN/resources/mullvad.exe';

export interface VPNStatus {
  connected: boolean;
  server?: string;
  location?: string;
  ip?: string;
  interface?: string;
}

export class VPNService {
  /**
   * Check if Mullvad VPN is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync(`"${MULLVAD_CLI}" version`);
      return true;
    } catch (error) {
      console.error('[VPN] Mullvad CLI not found at:', MULLVAD_CLI);
      return false;
    }
  }

  /**
   * Get current VPN connection status
   */
  async getStatus(): Promise<VPNStatus> {
    try {
      const { stdout } = await execAsync(`"${MULLVAD_CLI}" status`);
      const output = stdout.trim();

      console.log('[VPN] Status output:', output);

      // Parse Windows Mullvad status output
      // Example:
      // Connected
      //     Relay:                  ie-dub-wg-102
      //     Features:               Quantum Resistance
      //     Visible location:       Ireland, Dublin. IPv4: 146.70.189.71
      const connected = output.toLowerCase().startsWith('connected') &&
                       !output.toLowerCase().includes('disconnected');

      if (!connected) {
        return {
          connected: false,
        };
      }

      // Extract relay server name
      const relayMatch = output.match(/Relay:\s+(\S+)/i);
      const server = relayMatch ? relayMatch[1] : undefined;

      // Extract location and IP from "Visible location" line
      const locationMatch = output.match(/Visible location:\s+([^.]+)\.\s+IPv4:\s+(\S+)/i);
      const location = locationMatch ? locationMatch[1].trim() : undefined;
      const ip = locationMatch ? locationMatch[2] : undefined;

      const status: VPNStatus = {
        connected: true,
        server,
        location,
        ip,
        // Windows VPN interface isn't easily accessible from WSL2
        interface: 'Mullvad',
      };

      return status;
    } catch (error: any) {
      console.error('[VPN] Failed to get status:', error.message);
      return {
        connected: false,
      };
    }
  }

  /**
   * Connect to Mullvad VPN
   */
  async connect(): Promise<void> {
    try {
      console.log('[VPN] Connecting to Mullvad...');
      await execAsync(`"${MULLVAD_CLI}" connect`);

      // Wait for connection to establish (max 10 seconds)
      await this.waitForConnection(10000);

      console.log('[VPN] Connected successfully');
    } catch (error: any) {
      console.error('[VPN] Failed to connect:', error.message);
      throw new Error('Failed to connect to VPN: ' + error.message);
    }
  }

  /**
   * Disconnect from Mullvad VPN
   */
  async disconnect(): Promise<void> {
    try {
      console.log('[VPN] Disconnecting from Mullvad...');
      await execAsync(`"${MULLVAD_CLI}" disconnect`);
      console.log('[VPN] Disconnected successfully');
    } catch (error: any) {
      console.error('[VPN] Failed to disconnect:', error.message);
      throw new Error('Failed to disconnect from VPN: ' + error.message);
    }
  }

  /**
   * Wait for VPN connection to establish
   */
  private async waitForConnection(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus();
      if (status.connected) {
        return;
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('VPN connection timeout');
  }

  /**
   * Set VPN server location
   */
  async setLocation(country: string, city?: string): Promise<void> {
    try {
      const location = city ? `${country} ${city}` : country;
      console.log('[VPN] Setting location to:', location);
      await execAsync(`"${MULLVAD_CLI}" relay set location ${location}`);
      console.log('[VPN] Location set successfully');
    } catch (error: any) {
      console.error('[VPN] Failed to set location:', error.message);
      throw new Error('Failed to set VPN location: ' + error.message);
    }
  }

  /**
   * Get available VPN server locations
   */
  async getLocations(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`"${MULLVAD_CLI}" relay list`);

      // Parse location list from output
      // This is a simplified parser - Mullvad's output format may vary
      const locations = stdout
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim());

      return locations;
    } catch (error: any) {
      console.error('[VPN] Failed to get locations:', error.message);
      return [];
    }
  }

  /**
   * Test VPN connection by checking public IP
   */
  async testConnection(): Promise<{
    publicIP: string;
    isProtected: boolean;
  }> {
    try {
      // Get public IP from external service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      const publicIP = data.ip;

      // Get VPN status
      const status = await this.getStatus();

      // Check if public IP matches VPN IP
      const isProtected = status.connected && status.ip === publicIP;

      console.log('[VPN] Test results:', {
        publicIP,
        vpnIP: status.ip,
        isProtected,
      });

      return {
        publicIP,
        isProtected,
      };
    } catch (error: any) {
      console.error('[VPN] Failed to test connection:', error.message);
      throw new Error('Failed to test VPN connection');
    }
  }

  /**
   * Get user VPN preferences from database
   */
  async getUserVPNPreferences(userId: string): Promise<{
    vpn_enabled: boolean;
    require_vpn_for_torrents: boolean;
    vpn_auto_connect: boolean;
    vpn_auto_bind_qbittorrent: boolean;
    vpn_preferred_location: string | null;
    vpn_kill_switch_enabled: boolean;
  } | null> {
    try {
      const preferences = await AppDataSource
        .createQueryBuilder()
        .select([
          'vpn_enabled',
          'require_vpn_for_torrents',
          'vpn_auto_connect',
          'vpn_auto_bind_qbittorrent',
          'vpn_preferred_location',
          'vpn_kill_switch_enabled'
        ])
        .from('user_preferences', 'p')
        .where('p.user_id = :userId', { userId })
        .getRawOne();

      return preferences || null;
    } catch (error: any) {
      console.error('[VPN] Failed to get user preferences:', error.message);
      return null;
    }
  }

  /**
   * Check if VPN is required for torrents (from user preferences)
   */
  async isVPNRequiredForTorrents(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserVPNPreferences(userId);

      // If no preferences found or VPN not enabled, don't require VPN
      if (!preferences || !preferences.vpn_enabled) {
        return false;
      }

      // Return user's preference for requiring VPN on torrents
      return preferences.require_vpn_for_torrents;
    } catch (error: any) {
      console.error('[VPN] Failed to check VPN requirement:', error.message);
      // Default to not requiring VPN if there's an error
      return false;
    }
  }

  /**
   * Check if VPN should auto-connect for torrents
   */
  async shouldAutoConnect(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserVPNPreferences(userId);
      return preferences?.vpn_enabled && preferences?.vpn_auto_connect || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if qBittorrent should auto-bind to VPN
   */
  async shouldAutoBindQBittorrent(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserVPNPreferences(userId);
      return preferences?.vpn_enabled && preferences?.vpn_auto_bind_qbittorrent || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's preferred VPN location
   */
  async getPreferredLocation(userId: string): Promise<string | null> {
    try {
      const preferences = await this.getUserVPNPreferences(userId);
      return preferences?.vpn_preferred_location || null;
    } catch (error) {
      return null;
    }
  }
}

export const vpnService = new VPNService();
