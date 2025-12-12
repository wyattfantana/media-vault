import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  HardDrive,
  Shield,
  Save,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

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
  jellyfin_library_paths: {
    movies: string;
    tv: string;
    music: string;
    documentaries: string;
  };
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

  // VPN Preferences
  vpn_enabled: boolean;
  require_vpn_for_torrents: boolean;
  vpn_auto_connect: boolean;
  vpn_auto_bind_qbittorrent: boolean;
  vpn_preferred_location: string | null;
  vpn_kill_switch_enabled: boolean;
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

type TabKey = 'vpn' | 'jellyfin' | 'storage' | 'privacy';

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('vpn');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [vpnStatus, setVpnStatus] = useState<VPNStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [vpnMessage, setVpnMessage] = useState('');

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
      const res = await fetch('http://localhost:3001/api/v1/preferences', {
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
      const res = await fetch('http://localhost:3001/api/v1/preferences/storage', {
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
      const res = await fetch('http://localhost:3001/api/v1/preferences', {
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
      const res = await fetch('http://localhost:3001/api/v1/preferences/cleanup', {
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
      const enhancedRes = await fetch('http://localhost:3001/api/v1/vpn/enhanced-status', {
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
      const res = await fetch('http://localhost:3001/api/v1/vpn/status', {
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
      const res = await fetch('http://localhost:3001/api/v1/vpn/connect', {
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
      const res = await fetch('http://localhost:3001/api/v1/vpn/disconnect', {
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
      const res = await fetch('http://localhost:3001/api/v1/vpn/bind-qbittorrent', {
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
      const res = await fetch('http://localhost:3001/api/v1/vpn/unbind-qbittorrent', {
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

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const tabs = [
    { key: 'vpn' as TabKey, label: 'VPN', icon: ShieldCheck },
    { key: 'jellyfin' as TabKey, label: 'Jellyfin', icon: Server },
    { key: 'storage' as TabKey, label: 'Storage', icon: HardDrive },
    { key: 'privacy' as TabKey, label: 'Privacy', icon: Shield },
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
                <h3 className="text-lg font-medium mb-3">Library Paths</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Movies Path</label>
                    <input
                      type="text"
                      value={preferences.jellyfin_library_paths.movies}
                      onChange={(e) => updatePreference('jellyfin_library_paths', { ...preferences.jellyfin_library_paths, movies: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">TV Shows Path</label>
                    <input
                      type="text"
                      value={preferences.jellyfin_library_paths.tv}
                      onChange={(e) => updatePreference('jellyfin_library_paths', { ...preferences.jellyfin_library_paths, tv: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Music Path</label>
                    <input
                      type="text"
                      value={preferences.jellyfin_library_paths.music}
                      onChange={(e) => updatePreference('jellyfin_library_paths', { ...preferences.jellyfin_library_paths, music: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Documentaries Path</label>
                    <input
                      type="text"
                      value={preferences.jellyfin_library_paths.documentaries}
                      onChange={(e) => updatePreference('jellyfin_library_paths', { ...preferences.jellyfin_library_paths, documentaries: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
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
            <h2 className="text-xl font-semibold mb-4">Privacy & Advanced</h2>

            <div className="space-y-4">
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
