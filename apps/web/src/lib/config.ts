/**
 * Centralized Configuration
 * All URLs and ports should be configured here via environment variables
 */

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API_BASE = `${API_URL}/api/v1`;

// Jellyfin Configuration (default values, can be overridden in user settings)
export const JELLYFIN_DEFAULT_URL = import.meta.env.VITE_JELLYFIN_URL || 'http://localhost:8096';

// qBittorrent Configuration
export const QBITTORRENT_DEFAULT_URL = import.meta.env.VITE_QBITTORRENT_URL || 'http://localhost:8080';

// WebSocket Configuration (for real-time updates)
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// Feature Flags (can be controlled via environment)
export const ENABLE_VPN_CHECK = import.meta.env.VITE_ENABLE_VPN_CHECK !== 'false';
export const ENABLE_TORRENT_SEARCH = import.meta.env.VITE_ENABLE_TORRENT_SEARCH !== 'false';

// Development/Production Detection
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;

// Export all config as a single object for convenience
export const config = {
  api: {
    url: API_URL,
    base: API_BASE,
  },
  jellyfin: {
    defaultUrl: JELLYFIN_DEFAULT_URL,
  },
  qbittorrent: {
    defaultUrl: QBITTORRENT_DEFAULT_URL,
  },
  ws: {
    url: WS_URL,
  },
  features: {
    vpnCheck: ENABLE_VPN_CHECK,
    torrentSearch: ENABLE_TORRENT_SEARCH,
  },
  env: {
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
  },
};

export default config;
