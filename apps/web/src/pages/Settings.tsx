import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  HardDrive,
  Shield,
  Save,
  AlertCircle,
  ShieldCheck,
  Plus,
  Trash2,
  Film,
  Tv,
  Search
} from 'lucide-react';
import { API_BASE } from '@/lib/config';

interface UserPreferences {
  // Download Preferences
  default_quality: string;
  default_folder: string;
  default_video_format: string;
  default_audio_format: string;
  concurrent_downloads: number;

  // Bandwidth Controls
  download_speed_limit: number | null;
  upload_speed_limit: number | null;

  // Jellyfin Integration
  jellyfin_server_url: string | null;
  jellyfin_api_key: string | null;
  jellyfin_library_paths: Array<{
    name: string;
    path: string;
  }>;
  jellyfin_auto_scan: boolean;

  // Notification Preferences
  notifications_enabled: boolean;
  notify_download_complete: boolean;
  notify_download_failed: boolean;
  notification_sound: boolean;

  // Storage Management
  storage_limit_gb: number | null;
  auto_cleanup_enabled: boolean;
  auto_cleanup_days: number;

  // Behavior Settings
  auto_organize_files: boolean;
  auto_fetch_thumbnails: boolean;
  keep_download_history_days: number;

  // Privacy/Advanced
  youtube_cookies_path: string | null;
  clear_search_history_on_exit: boolean;

  // API Keys & Paths
  tmdb_api_key: string | null;
  omdb_api_key: string | null;
  download_directory: string;
  ytdlp_path: string;
  get_iplayer_path: string;

  // VPN Preferences
  vpn_enabled: boolean;
  require_vpn_for_torrents: boolean;
  vpn_auto_connect: boolean;
  vpn_auto_bind_qbittorrent: boolean;
  vpn_preferred_location: string | null;
  vpn_kill_switch_enabled: boolean;

  // *arr Services Integration
  radarr_enabled: boolean;
  radarr_host: string | null;
  radarr_port: number | null;
  radarr_api_key: string | null;
  radarr_url_base: string | null;
  sonarr_enabled: boolean;
  sonarr_host: string | null;
  sonarr_port: number | null;
  sonarr_api_key: string | null;
  sonarr_url_base: string | null;
  prowlarr_enabled: boolean;
  prowlarr_host: string | null;
  prowlarr_port: number | null;
  prowlarr_api_key: string | null;
  prowlarr_url_base: string | null;
}

interface StorageInfo {
  by_category: Array<{
    category: string;
    file_count: number;
    bytes: number;
    gb: string;
  }>;
  total: {
    file_count: number;
    bytes: number;
    gb: string;
  };
  limit: {
    bytes: number | null;
    gb: number | null;
    percentage: string | null;
  };
}

interface VPNStatus {
  installed: boolean;
  connected: boolean;
  server?: string;
  location?: string;
  ip?: string;
  interface?: string;
  qbittorrent?: {
    interface: string | null;
    boundToVPN: boolean;
  };
  message?: string;
  localIP?: string | null;
  publicIP?: string | null;
  isProtected?: boolean;
  localNetworkAccessible?: boolean;
}

type TabKey = 'vpn' | 'jellyfin' | 'arr' | 'storage' | 'privacy';

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('vpn');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [vpnStatus, setVpnStatus] = useState<VPNStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [vpnMessage, setVpnMessage] = useState('');
  const [arrMessage, setArrMessage] = useState('');
  const [showRadarrKey, setShowRadarrKey] = useState(false);
  const [showSonarrKey, setShowSonarrKey] = useState(false);
  const [showProwlarrKey, setShowProwlarrKey] = useState(false);

  useEffect(() => {
    fetchPreferences();
    if (activeTab === 'storage') {
      fetchStorageInfo();
    } else if (activeTab === 'vpn') {
      fetchVPNStatus();
    }
  }, [activeTab]);

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE}/preferences`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/preferences/storage`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setStorageInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch storage info:', err);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    setSaving(true);
    setSaveMessage('');

    try {
      const res = await fetch(`${API_BASE}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences)
      });

      if (res.ok) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setSaveMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    if (!preferences?.auto_cleanup_days) return;
    if (!confirm(`Delete all files older than ${preferences.auto_cleanup_days} days?`)) return;

    try {
      const res = await fetch(`${API_BASE}/preferences/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days: preferences.auto_cleanup_days })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Deleted ${data.deleted_count} files`);
        fetchStorageInfo();
      }
    } catch (err) {
      console.error('Failed to cleanup:', err);
    }
  };

  // VPN Functions
  const fetchVPNStatus = async () => {
    try {
      // Try enhanced status first
      const enhancedRes = await fetch(`${API_BASE}/vpn/enhanced-status`, {
        credentials: 'include'
      });

      if (enhancedRes.ok) {
        const data = await enhancedRes.json();
        // Transform enhanced status to VPNStatus format
        setVpnStatus({
          installed: true,
          connected: data.vpn?.connected || false,
          server: data.vpn?.server,
          location: data.vpn?.location,
          ip: data.vpn?.ip,
          interface: data.vpn?.interface,
          localIP: data.localIP,
          publicIP: data.publicIP,
          isProtected: data.isProtected,
          localNetworkAccessible: data.localNetworkAccessible,
          message: data.message,
        });
        return;
      }

      // Fallback to regular status
      const res = await fetch(`${API_BASE}/vpn/status`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setVpnStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch VPN status:', err);
    }
  };

  const connectVPN = async () => {
    setVpnMessage('Connecting to VPN...');
    try {
      const res = await fetch(`${API_BASE}/vpn/connect`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setVpnMessage('Connected to VPN successfully!');
        setTimeout(() => setVpnMessage(''), 3000);
        fetchVPNStatus();
      } else {
        const data = await res.json();
        setVpnMessage(data.message || 'Failed to connect to VPN');
      }
    } catch (err: any) {
      console.error('Failed to connect VPN:', err);
      setVpnMessage('Failed to connect to VPN');
    }
  };

  const disconnectVPN = async () => {
    setVpnMessage('Disconnecting from VPN...');
    try {
      const res = await fetch(`${API_BASE}/vpn/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setVpnMessage('Disconnected from VPN');
        setTimeout(() => setVpnMessage(''), 3000);
        fetchVPNStatus();
      } else {
        setVpnMessage('Failed to disconnect from VPN');
      }
    } catch (err) {
      console.error('Failed to disconnect VPN:', err);
      setVpnMessage('Failed to disconnect from VPN');
    }
  };

  const bindQBittorrent = async () => {
    setVpnMessage('Binding qBittorrent to VPN...');
    try {
      const res = await fetch(`${API_BASE}/vpn/bind-qbittorrent`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setVpnMessage('qBittorrent bound to VPN successfully!');
        setTimeout(() => setVpnMessage(''), 3000);
        fetchVPNStatus();
      } else {
        const data = await res.json();
        setVpnMessage(data.message || 'Failed to bind qBittorrent');
      }
    } catch (err) {
      console.error('Failed to bind qBittorrent:', err);
      setVpnMessage('Failed to bind qBittorrent');
    }
  };

  const unbindQBittorrent = async () => {
    setVpnMessage('Unbinding qBittorrent from VPN...');
    try {
      const res = await fetch(`${API_BASE}/vpn/unbind-qbittorrent`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setVpnMessage('qBittorrent unbound from VPN');
        setTimeout(() => setVpnMessage(''), 3000);
        fetchVPNStatus();
      } else {
        setVpnMessage('Failed to unbind qBittorrent');
      }
    } catch (err) {
      console.error('Failed to unbind qBittorrent:', err);
      setVpnMessage('Failed to unbind qBittorrent');
    }
  };

  // *arr Services Functions
  const testRadarrConnection = async () => {
    setArrMessage('Testing Radarr connection...');
    try {
      const res = await fetch(`${API_BASE}/radarr/status`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setArrMessage(`✅ Radarr connected! Version: ${data.version}`);
        setTimeout(() => setArrMessage(''), 5000);
      } else {
        const error = await res.json();
        setArrMessage(`❌ Radarr connection failed: ${error.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Failed to test Radarr:', err);
      setArrMessage(`❌ Radarr connection failed: ${err.message}`);
    }
  };

  const testSonarrConnection = async () => {
    setArrMessage('Testing Sonarr connection...');
    try {
      const res = await fetch(`${API_BASE}/sonarr/status`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setArrMessage(`✅ Sonarr connected! Version: ${data.version}`);
        setTimeout(() => setArrMessage(''), 5000);
      } else {
        const error = await res.json();
        setArrMessage(`❌ Sonarr connection failed: ${error.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Failed to test Sonarr:', err);
      setArrMessage(`❌ Sonarr connection failed: ${err.message}`);
    }
  };

  const testProwlarrConnection = async () => {
    setArrMessage('Testing Prowlarr connection...');
    try {
      const res = await fetch(`${API_BASE}/prowlarr/status`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setArrMessage(`✅ Prowlarr connected! Version: ${data.version}`);
        setTimeout(() => setArrMessage(''), 5000);
      } else {
        const error = await res.json();
        setArrMessage(`❌ Prowlarr connection failed: ${error.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Failed to test Prowlarr:', err);
      setArrMessage(`❌ Prowlarr connection failed: ${err.message}`);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const addLibraryPath = () => {
    if (!preferences) return;
    const newPath = { name: '', path: '' };
    setPreferences({
      ...preferences,
      jellyfin_library_paths: [...preferences.jellyfin_library_paths, newPath]
    });
  };

  const removeLibraryPath = (index: number) => {
    if (!preferences) return;
    const updatedPaths = preferences.jellyfin_library_paths.filter((_, i) => i !== index);
    setPreferences({
      ...preferences,
      jellyfin_library_paths: updatedPaths
    });
  };

  const updateLibraryPath = (index: number, field: 'name' | 'path', value: string) => {
    if (!preferences) return;
    const updatedPaths = [...preferences.jellyfin_library_paths];
    updatedPaths[index] = { ...updatedPaths[index], [field]: value };
    setPreferences({
      ...preferences,
      jellyfin_library_paths: updatedPaths
    });
  };

  const tabs = [
    { key: 'vpn' as TabKey, label: 'VPN', icon: ShieldCheck },
    { key: 'jellyfin' as TabKey, label: 'Jellyfin', icon: Server },
    { key: 'arr' as TabKey, label: '*arr Services', icon: Film },
    { key: 'storage' as TabKey, label: 'Storage', icon: HardDrive },
    { key: 'privacy' as TabKey, label: 'Advanced', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-gray-400 mt-1">Configure your MediaVault preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Save button and message */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
        {saveMessage && (
          <div className={`flex items-center gap-2 ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
            <AlertCircle className="w-5 h-5" />
            {saveMessage}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        {/* VPN Tab */}
        {activeTab === 'vpn' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">VPN Status</h2>

            {/* VPN Status Card */}
            <div className={`border rounded-lg p-6 ${
              vpnStatus?.connected
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-gray-800 border-gray-700'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className={vpnStatus?.connected ? 'text-green-400' : 'text-gray-400'} size={24} />
                  VPN Status
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  vpnStatus?.connected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {vpnStatus?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {!vpnStatus?.installed && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-300">
                    <strong>Mullvad VPN not installed.</strong> Install with: <code className="bg-gray-800 px-2 py-1 rounded">sudo apt install mullvad-vpn</code>
                  </p>
                </div>
              )}

              {vpnStatus?.connected && (
                <div className="space-y-4">
                  {/* VPN Connection Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Server:</span>
                      <span className="text-white font-mono">{vpnStatus.server || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Location:</span>
                      <span className="text-white">{vpnStatus.location || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Torrent IP:</span>
                      <span className="text-white font-mono flex items-center gap-2">
                        {vpnStatus.ip || vpnStatus.publicIP || 'Unknown'}
                        {vpnStatus.isProtected && (
                          <span className="text-green-400 text-xs">🔒 Protected</span>
                        )}
                      </span>
                    </div>
                    {vpnStatus.localIP && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Local IP:</span>
                        <span className="text-white font-mono">{vpnStatus.localIP}</span>
                      </div>
                    )}
                  </div>

                  {/* Local Network Status */}
                  {vpnStatus.localNetworkAccessible !== undefined && (
                    <div className={`p-3 rounded-lg border ${
                      vpnStatus.localNetworkAccessible
                        ? 'bg-green-900/20 border-green-500/30'
                        : 'bg-yellow-900/20 border-yellow-500/30'
                    }`}>
                      <div className="flex items-start gap-2 text-sm">
                        <span className={vpnStatus.localNetworkAccessible ? 'text-green-400' : 'text-yellow-400'}>
                          {vpnStatus.localNetworkAccessible ? '✅' : '⚠️'}
                        </span>
                        <div>
                          <div className={`font-medium ${vpnStatus.localNetworkAccessible ? 'text-green-300' : 'text-yellow-300'}`}>
                            {vpnStatus.localNetworkAccessible
                              ? 'Local Network Access: Enabled'
                              : 'Local Network Access: Disabled'
                            }
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            {vpnStatus.localNetworkAccessible
                              ? 'Jellyfin is accessible from devices on your local network'
                              : 'Enable "Local Network Sharing" in Mullvad to access Jellyfin from other devices'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Protection Summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1">Torrent Protection</div>
                      <div className="text-green-400 font-medium flex items-center gap-1">
                        <ShieldCheck size={16} />
                        VPN Active
                      </div>
                    </div>
                    <div className="bg-gray-900/50 p-3 rounded-lg">
                      <div className="text-gray-400 text-xs mb-1">Jellyfin Access</div>
                      <div className={`font-medium flex items-center gap-1 ${
                        vpnStatus.localNetworkAccessible ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        <Server size={16} />
                        {vpnStatus.localNetworkAccessible ? 'Local Network' : 'VPN Only'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {vpnStatus?.connected ? (
                  <button
                    onClick={disconnectVPN}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Disconnect VPN
                  </button>
                ) : (
                  <button
                    onClick={connectVPN}
                    disabled={!vpnStatus?.installed}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Connect VPN
                  </button>
                )}
                <button
                  onClick={fetchVPNStatus}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <strong>💡 VPN + Local Network:</strong> Torrents download privately through VPN, while Jellyfin stays accessible on your local network. Enable "Local Network Sharing" in Mullvad to use both simultaneously.
              </p>
            </div>

            {/* VPN Message */}
            {vpnMessage && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-green-300">{vpnMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* Jellyfin Integration Tab */}
        {activeTab === 'jellyfin' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Jellyfin Integration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Server URL</label>
                <input
                  type="url"
                  placeholder="http://localhost:8096"
                  value={preferences.jellyfin_server_url || ''}
                  onChange={(e) => updatePreference('jellyfin_server_url', e.target.value || null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                <input
                  type="password"
                  placeholder="Your Jellyfin API key"
                  value={preferences.jellyfin_api_key || ''}
                  onChange={(e) => updatePreference('jellyfin_api_key', e.target.value || null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Help Text Info Box */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>📍 Where to find these settings:</strong>
                </p>
                <ul className="text-sm text-blue-300 space-y-1 ml-4">
                  <li><strong>Server URL:</strong> Default is <code className="bg-gray-800 px-2 py-0.5 rounded">http://localhost:8096</code>. Or check Jellyfin → Dashboard → Networking</li>
                  <li><strong>API Key:</strong> Generate in Jellyfin → Dashboard → API Keys → New API Key</li>
                </ul>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.jellyfin_auto_scan}
                    onChange={(e) => updatePreference('jellyfin_auto_scan', e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-300">Auto-scan library after downloads</span>
                </label>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">Library Paths</h3>
                  <button
                    onClick={addLibraryPath}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Path
                  </button>
                </div>

                <div className="space-y-3">
                  {preferences.jellyfin_library_paths.map((libPath, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-end bg-gray-900/50 p-3 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                        <input
                          type="text"
                          placeholder="Movies"
                          value={libPath.name}
                          onChange={(e) => updateLibraryPath(index, 'name', e.target.value)}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Path</label>
                        <input
                          type="text"
                          placeholder="/media/movies"
                          value={libPath.path}
                          onChange={(e) => updateLibraryPath(index, 'path', e.target.value)}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <button
                          onClick={() => removeLibraryPath(index)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Remove path"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {preferences.jellyfin_library_paths.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No library paths configured. Click "Add Path" to create one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* *arr Services Tab */}
        {activeTab === 'arr' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">*arr Services Integration</h2>
              <p className="text-sm text-gray-400">
                Configure Radarr, Sonarr, and Prowlarr for automated movie and TV series downloads
              </p>
            </div>

            {/* Connection Status Message */}
            {arrMessage && (
              <div className={`border rounded-lg p-4 ${
                arrMessage.includes('✅')
                  ? 'bg-green-900/20 border-green-500/30'
                  : arrMessage.includes('❌')
                  ? 'bg-red-900/20 border-red-500/30'
                  : 'bg-blue-900/20 border-blue-500/30'
              }`}>
                <p className={`text-sm ${
                  arrMessage.includes('✅')
                    ? 'text-green-300'
                    : arrMessage.includes('❌')
                    ? 'text-red-300'
                    : 'text-blue-300'
                }`}>
                  {arrMessage}
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300 mb-2">
                <strong>🎬 Automated Media Management:</strong>
              </p>
              <ul className="text-sm text-blue-300 space-y-1 ml-4">
                <li><strong>Radarr:</strong> Automatically finds and downloads movies</li>
                <li><strong>Sonarr:</strong> Automatically finds and downloads TV series</li>
                <li><strong>Prowlarr:</strong> Manages torrent indexers for both services</li>
              </ul>
              <p className="text-sm text-blue-300 mt-2">
                Access points: <a href="http://localhost:7878" target="_blank" rel="noopener noreferrer" className="underline">Radarr</a> | <a href="http://localhost:8989" target="_blank" rel="noopener noreferrer" className="underline">Sonarr</a> | <a href="http://localhost:9696" target="_blank" rel="noopener noreferrer" className="underline">Prowlarr</a>
              </p>
            </div>

            {/* Radarr Configuration */}
            <div className="border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Film className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-semibold">Radarr (Movies)</h3>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.radarr_enabled}
                    onChange={(e) => updatePreference('radarr_enabled', e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
              </div>

              {preferences.radarr_enabled && (
                <div className="space-y-4 pl-9">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Host</label>
                      <input
                        type="text"
                        placeholder="localhost"
                        value={preferences.radarr_host || ''}
                        onChange={(e) => updatePreference('radarr_host', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Port</label>
                      <input
                        type="number"
                        placeholder="7878"
                        value={preferences.radarr_port || ''}
                        onChange={(e) => updatePreference('radarr_port', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type={showRadarrKey ? 'text' : 'password'}
                        placeholder="Your Radarr API key"
                        value={preferences.radarr_api_key || ''}
                        onChange={(e) => updatePreference('radarr_api_key', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 pr-20 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRadarrKey(!showRadarrKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-600 rounded"
                      >
                        {showRadarrKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Find in Radarr → Settings → General → API Key
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">URL Base (Optional)</label>
                    <input
                      type="text"
                      placeholder="/radarr"
                      value={preferences.radarr_url_base || ''}
                      onChange={(e) => updatePreference('radarr_url_base', e.target.value || null)}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only needed if Radarr runs on a URL base path
                    </p>
                  </div>

                  <button
                    onClick={testRadarrConnection}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Test Connection
                  </button>
                </div>
              )}
            </div>

            {/* Sonarr Configuration */}
            <div className="border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Tv className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold">Sonarr (TV Series)</h3>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.sonarr_enabled}
                    onChange={(e) => updatePreference('sonarr_enabled', e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
              </div>

              {preferences.sonarr_enabled && (
                <div className="space-y-4 pl-9">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Host</label>
                      <input
                        type="text"
                        placeholder="localhost"
                        value={preferences.sonarr_host || ''}
                        onChange={(e) => updatePreference('sonarr_host', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Port</label>
                      <input
                        type="number"
                        placeholder="8989"
                        value={preferences.sonarr_port || ''}
                        onChange={(e) => updatePreference('sonarr_port', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type={showSonarrKey ? 'text' : 'password'}
                        placeholder="Your Sonarr API key"
                        value={preferences.sonarr_api_key || ''}
                        onChange={(e) => updatePreference('sonarr_api_key', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 pr-20 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSonarrKey(!showSonarrKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-600 rounded"
                      >
                        {showSonarrKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Find in Sonarr → Settings → General → API Key
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">URL Base (Optional)</label>
                    <input
                      type="text"
                      placeholder="/sonarr"
                      value={preferences.sonarr_url_base || ''}
                      onChange={(e) => updatePreference('sonarr_url_base', e.target.value || null)}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only needed if Sonarr runs on a URL base path
                    </p>
                  </div>

                  <button
                    onClick={testSonarrConnection}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Test Connection
                  </button>
                </div>
              )}
            </div>

            {/* Prowlarr Configuration */}
            <div className="border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Search className="w-6 h-6 text-orange-400" />
                  <h3 className="text-lg font-semibold">Prowlarr (Indexer Manager)</h3>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.prowlarr_enabled}
                    onChange={(e) => updatePreference('prowlarr_enabled', e.target.checked)}
                    className="w-4 h-4 accent-orange-600"
                  />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
              </div>

              {preferences.prowlarr_enabled && (
                <div className="space-y-4 pl-9">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Host</label>
                      <input
                        type="text"
                        placeholder="localhost"
                        value={preferences.prowlarr_host || ''}
                        onChange={(e) => updatePreference('prowlarr_host', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Port</label>
                      <input
                        type="number"
                        placeholder="9696"
                        value={preferences.prowlarr_port || ''}
                        onChange={(e) => updatePreference('prowlarr_port', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type={showProwlarrKey ? 'text' : 'password'}
                        placeholder="Your Prowlarr API key"
                        value={preferences.prowlarr_api_key || ''}
                        onChange={(e) => updatePreference('prowlarr_api_key', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 pr-20 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProwlarrKey(!showProwlarrKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-600 rounded"
                      >
                        {showProwlarrKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Find in Prowlarr → Settings → General → API Key
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">URL Base (Optional)</label>
                    <input
                      type="text"
                      placeholder="/prowlarr"
                      value={preferences.prowlarr_url_base || ''}
                      onChange={(e) => updatePreference('prowlarr_url_base', e.target.value || null)}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only needed if Prowlarr runs on a URL base path
                    </p>
                  </div>

                  <button
                    onClick={testProwlarrConnection}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Test Connection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Storage Management Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Storage Management</h2>

            {storageInfo && (
              <div className="bg-gray-900 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium mb-4">Current Usage</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {storageInfo.by_category.map((cat) => (
                    <div key={cat.category} className="bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">{cat.category}</div>
                      <div className="text-2xl font-bold text-white">{cat.gb} GB</div>
                      <div className="text-xs text-gray-500">{cat.file_count} files</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Storage Used</span>
                    <span className="text-2xl font-bold text-white">{storageInfo.total.gb} GB</span>
                  </div>
                  {storageInfo.limit.percentage && (
                    <div className="mt-2">
                      <div className="bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            parseFloat(storageInfo.limit.percentage) > 90 ? 'bg-red-500' :
                            parseFloat(storageInfo.limit.percentage) > 75 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(parseFloat(storageInfo.limit.percentage), 100)}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {storageInfo.limit.percentage}% of {storageInfo.limit.gb} GB limit
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Storage Limit (GB)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={preferences.storage_limit_gb || ''}
                  onChange={(e) => updatePreference('storage_limit_gb', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited storage</p>
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.auto_cleanup_enabled}
                  onChange={(e) => updatePreference('auto_cleanup_enabled', e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Enable Auto-Cleanup</div>
                  <div className="text-sm text-gray-400">Automatically delete old files</div>
                </div>
              </label>

              {preferences.auto_cleanup_enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Delete files older than (days): {preferences.auto_cleanup_days}
                  </label>
                  <input
                    type="range"
                    min="7"
                    max="365"
                    value={preferences.auto_cleanup_days}
                    onChange={(e) => updatePreference('auto_cleanup_days', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}

              <button
                onClick={handleCleanup}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                Run Cleanup Now
              </button>
            </div>
          </div>
        )}

        {/* Privacy/Advanced Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>

            {/* API Keys Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b border-gray-700 pb-2">API Keys</h3>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  TMDB API Key
                </label>
                <input
                  type="password"
                  placeholder="Your TMDB API key"
                  value={preferences.tmdb_api_key || ''}
                  onChange={(e) => updatePreference('tmdb_api_key', e.target.value || null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For movie/TV thumbnails and metadata. Get free API key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">themoviedb.org/settings/api</a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  OMDB API Key (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Your OMDB API key (optional)"
                  value={preferences.omdb_api_key || ''}
                  onChange={(e) => updatePreference('omdb_api_key', e.target.value || null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alternative metadata source. Get free API key at <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">omdbapi.com</a>
                </p>
              </div>
            </div>

            {/* Paths Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b border-gray-700 pb-2">Tool Paths</h3>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Download Directory
                </label>
                <input
                  type="text"
                  placeholder="/home/beerm/media-vault/downloads"
                  value={preferences.download_directory}
                  onChange={(e) => updatePreference('download_directory', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Base directory where all downloads are saved
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  yt-dlp Path
                </label>
                <input
                  type="text"
                  placeholder="/home/beerm/bin/yt-dlp"
                  value={preferences.ytdlp_path}
                  onChange={(e) => updatePreference('ytdlp_path', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Full path to yt-dlp executable (for YouTube downloads)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  get_iplayer Path
                </label>
                <input
                  type="text"
                  placeholder="/home/beerm/bin/get_iplayer"
                  value={preferences.get_iplayer_path}
                  onChange={(e) => updatePreference('get_iplayer_path', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Full path to get_iplayer executable (for BBC iPlayer downloads)
                </p>
              </div>
            </div>

            {/* Privacy Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b border-gray-700 pb-2">Privacy</h3>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  YouTube Cookies File Path
                </label>
                <input
                  type="text"
                  placeholder="/path/to/cookies.txt"
                  value={preferences.youtube_cookies_path || ''}
                  onChange={(e) => updatePreference('youtube_cookies_path', e.target.value || null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For age-restricted videos. Export cookies from your browser using a cookies.txt extension.
                </p>
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.clear_search_history_on_exit}
                  onChange={(e) => updatePreference('clear_search_history_on_exit', e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Clear Search History on Exit</div>
                  <div className="text-sm text-gray-400">Automatically clear search history when closing the app</div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
