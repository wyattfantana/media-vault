import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Server,
  HardDrive,
  Save,
  AlertCircle,
  ShieldCheck,
  Film,
  Search,
  Captions,
  Trash2,
  Folder,
  FileVideo,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle
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

  // Notification Preferences
  notifications_enabled: boolean;
  notify_download_complete: boolean;
  notify_download_failed: boolean;
  notification_sound: boolean;


  // Behavior Settings
  auto_organize_files: boolean;
  auto_fetch_thumbnails: boolean;
  keep_download_history_days: number;

  // VPN Preferences
  vpn_enabled: boolean;
  require_vpn_for_torrents: boolean;
  vpn_auto_connect: boolean;
  vpn_auto_bind_qbittorrent: boolean;
  vpn_preferred_location: string | null;
  vpn_kill_switch_enabled: boolean;

  // *arr Services Integration
  prowlarr_enabled: boolean;
  prowlarr_host: string | null;
  prowlarr_port: number | null;
  prowlarr_api_key: string | null;
  prowlarr_url_base: string | null;

  // Bazarr Subtitle Integration
  bazarr_enabled: boolean;
  bazarr_url: string | null;
  bazarr_api_key: string | null;
  bazarr_subtitle_languages: string[];
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

interface StorageItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  sizeFormatted: string;
  modified: string;
  childCount?: number;
}

interface StorageBrowseResponse {
  category: string;
  path: string;
  items: StorageItem[];
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
}

interface StorageStats {
  categories: Array<{
    category: string;
    folder: string;
    path: string;
    size: number;
    sizeFormatted: string;
    itemCount: number;
  }>;
  total: {
    size: number;
    sizeFormatted: string;
    itemCount: number;
  };
}

type TabKey = 'vpn' | 'jellyfin' | 'arr' | 'subtitles' | 'storage';

export function Settings() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabKey | null;
  const validTabs: TabKey[] = ['vpn', 'jellyfin', 'arr', 'subtitles', 'storage'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'vpn';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [vpnStatus, setVpnStatus] = useState<VPNStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [vpnMessage, setVpnMessage] = useState('');
  const [arrMessage, setArrMessage] = useState('');
  const [bazarrMessage, setBazarrMessage] = useState('');
  const [showProwlarrKey, setShowProwlarrKey] = useState(false);
  const [showBazarrKey, setShowBazarrKey] = useState(false);

  // Storage management state
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [browseData, setBrowseData] = useState<StorageBrowseResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Movies');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [storageLoading, setStorageLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAllCategory, setDeleteAllCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
    if (activeTab === 'storage') {
      fetchStorageStats();
      fetchBrowseData(selectedCategory);
    } else if (activeTab === 'vpn') {
      fetchVPNStatus();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'storage') {
      fetchBrowseData(selectedCategory);
      setSelectedPaths(new Set()); // Clear selection when changing category
    }
  }, [selectedCategory]);

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

  // Storage management functions
  const fetchStorageStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/storage/stats`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setStorageStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    }
  };

  const fetchBrowseData = async (category: string) => {
    setStorageLoading(true);
    try {
      const res = await fetch(`${API_BASE}/storage/browse?category=${encodeURIComponent(category)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBrowseData(data);
      }
    } catch (err) {
      console.error('Failed to browse storage:', err);
    } finally {
      setStorageLoading(false);
    }
  };

  const togglePathSelection = (path: string) => {
    const newSelected = new Set(selectedPaths);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedPaths(newSelected);
  };

  const selectAll = () => {
    if (!browseData) return;
    const allPaths = new Set(browseData.items.map(item => item.path));
    setSelectedPaths(allPaths);
  };

  const selectNone = () => {
    setSelectedPaths(new Set());
  };

  const deleteSelectedFiles = async () => {
    if (selectedPaths.size === 0) return;

    setDeleteLoading(true);
    setStorageMessage('Deleting files...');

    try {
      const res = await fetch(`${API_BASE}/storage/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paths: Array.from(selectedPaths) })
      });

      if (res.ok) {
        const data = await res.json();
        setStorageMessage(`Deleted ${data.deletedCount} items (${data.deletedSizeFormatted})`);
        setSelectedPaths(new Set());
        // Refresh data
        fetchStorageStats();
        fetchBrowseData(selectedCategory);
        setTimeout(() => setStorageMessage(''), 5000);
      } else {
        const error = await res.json();
        setStorageMessage(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to delete files:', err);
      setStorageMessage('Failed to delete files');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const deleteAllInCategory = async (category: string) => {
    setDeleteLoading(true);
    setStorageMessage(`Deleting all files in ${category}...`);

    try {
      const res = await fetch(`${API_BASE}/storage/category/${encodeURIComponent(category)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: 'DELETE_ALL' })
      });

      if (res.ok) {
        const data = await res.json();
        setStorageMessage(`Deleted ${data.deletedCount} items (${data.deletedSizeFormatted}) from ${category}`);
        setSelectedPaths(new Set());
        // Refresh data
        fetchStorageStats();
        fetchBrowseData(selectedCategory);
        setTimeout(() => setStorageMessage(''), 5000);
      } else {
        const error = await res.json();
        setStorageMessage(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      setStorageMessage('Failed to delete category');
    } finally {
      setDeleteLoading(false);
      setDeleteAllCategory(null);
    }
  };

  const getSelectedSize = (): string => {
    if (!browseData) return '0 B';
    let total = 0;
    browseData.items.forEach(item => {
      if (selectedPaths.has(item.path)) {
        total += item.size;
      }
    });
    return formatBytes(total);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  // Bazarr Subtitle Functions
  const testBazarrConnection = async () => {
    setBazarrMessage('Testing Bazarr connection...');
    try {
      const res = await fetch(`${API_BASE}/bazarr/status`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setBazarrMessage(`✅ Bazarr connected! Version: ${data.version || 'Unknown'}`);
          setTimeout(() => setBazarrMessage(''), 5000);
        } else {
          setBazarrMessage('❌ Bazarr not connected. Please check your configuration.');
        }
      } else {
        const error = await res.json();
        setBazarrMessage(`❌ Bazarr connection failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Failed to test Bazarr:', err);
      setBazarrMessage(`❌ Bazarr connection failed: ${err.message}`);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const tabs = [
    { key: 'vpn' as TabKey, label: 'VPN', icon: ShieldCheck },
    { key: 'jellyfin' as TabKey, label: 'Jellyfin', icon: Server },
    { key: 'arr' as TabKey, label: 'Torrents', icon: Film },
    { key: 'subtitles' as TabKey, label: 'Subtitles', icon: Captions },
    { key: 'storage' as TabKey, label: 'Storage', icon: HardDrive },
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

              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">
                  <strong>Auto-scan:</strong> Jellyfin libraries are automatically scanned after downloads complete when configured.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* *arr Services Tab */}
        {activeTab === 'arr' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Torrent Search Configuration</h2>
              <p className="text-sm text-gray-400">
                Configure Prowlarr to search torrents across multiple indexers for movies and TV shows
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
                <strong>🎬 Torrent Indexer Management:</strong>
              </p>
              <p className="text-sm text-blue-300">
                <strong>Prowlarr:</strong> Manages torrent indexers and provides search capabilities across multiple torrent sites. MediaVault uses Prowlarr to search for movies and TV shows, then downloads them directly via qBittorrent.
              </p>
              <p className="text-sm text-blue-300 mt-2">
                Access point: <a href="http://localhost:9696" target="_blank" rel="noopener noreferrer" className="underline">Prowlarr</a>
              </p>
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

        {/* Subtitles Tab */}
        {activeTab === 'subtitles' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Subtitle Management</h2>
              <p className="text-sm text-gray-400">
                Configure Bazarr to automatically download subtitles for your movies and TV shows
              </p>
            </div>

            {/* Connection Status Message */}
            {bazarrMessage && (
              <div className={`border rounded-lg p-4 ${
                bazarrMessage.includes('✅')
                  ? 'bg-green-900/20 border-green-500/30'
                  : bazarrMessage.includes('❌')
                  ? 'bg-red-900/20 border-red-500/30'
                  : 'bg-blue-900/20 border-blue-500/30'
              }`}>
                <p className={`text-sm ${
                  bazarrMessage.includes('✅')
                    ? 'text-green-300'
                    : bazarrMessage.includes('❌')
                    ? 'text-red-300'
                    : 'text-blue-300'
                }`}>
                  {bazarrMessage}
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300 mb-2">
                <strong>📝 Subtitle Management:</strong>
              </p>
              <p className="text-sm text-blue-300">
                <strong>Bazarr:</strong> Automatically downloads and manages subtitles for your media library. Integrates with Sonarr and Radarr to provide subtitles in your preferred languages.
              </p>
              <p className="text-sm text-blue-300 mt-2">
                Access point: <a href="http://localhost:6767" target="_blank" rel="noopener noreferrer" className="underline">Bazarr</a>
              </p>
            </div>

            {/* Bazarr Configuration */}
            <div className="border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Captions className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold">Bazarr (Subtitle Manager)</h3>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.bazarr_enabled}
                    onChange={(e) => updatePreference('bazarr_enabled', e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm text-gray-300">Enabled</span>
                </label>
              </div>

              {preferences.bazarr_enabled && (
                <div className="space-y-4 pl-9">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Bazarr URL</label>
                    <input
                      type="text"
                      placeholder="http://localhost:6767"
                      value={preferences.bazarr_url || ''}
                      onChange={(e) => updatePreference('bazarr_url', e.target.value || null)}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type={showBazarrKey ? 'text' : 'password'}
                        placeholder="Your Bazarr API key"
                        value={preferences.bazarr_api_key || ''}
                        onChange={(e) => updatePreference('bazarr_api_key', e.target.value || null)}
                        className="w-full bg-gray-700 text-white px-3 py-2 pr-20 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBazarrKey(!showBazarrKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-600 rounded"
                      >
                        {showBazarrKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Find in Bazarr → Settings → Security → API Key
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Preferred Languages</label>
                    <input
                      type="text"
                      placeholder="en,es,fr"
                      value={preferences.bazarr_subtitle_languages?.join(',') || ''}
                      onChange={(e) => {
                        const langs = e.target.value.split(',').map(l => l.trim()).filter(Boolean);
                        updatePreference('bazarr_subtitle_languages', langs);
                      }}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Comma-separated language codes (e.g., en, es, fr, de)
                    </p>
                  </div>

                  <button
                    onClick={testBazarrConnection}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Storage Management</h2>
              <button
                onClick={() => { fetchStorageStats(); fetchBrowseData(selectedCategory); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* Storage Stats Overview */}
            {storageStats && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {storageStats.categories.map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => setSelectedCategory(cat.category)}
                      className={`p-3 rounded-lg text-left transition-colors ${
                        selectedCategory === cat.category
                          ? 'bg-blue-600 ring-2 ring-blue-400'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-xs text-gray-400">{cat.category}</div>
                      <div className="text-lg font-bold text-white">{cat.sizeFormatted}</div>
                      <div className="text-xs text-gray-500">{cat.itemCount} items</div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-700 mt-4 pt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Total Storage Used</span>
                    <span className="text-lg font-bold text-white">{storageStats.total.sizeFormatted}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            {storageMessage && (
              <div className={`border rounded-lg p-3 ${
                storageMessage.includes('Error')
                  ? 'bg-red-900/20 border-red-500/30 text-red-300'
                  : storageMessage.includes('Deleting')
                  ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300'
                  : 'bg-green-900/20 border-green-500/30 text-green-300'
              }`}>
                <p className="text-sm">{storageMessage}</p>
              </div>
            )}

            {/* File Browser */}
            <div className="bg-gray-900 rounded-lg border border-gray-700">
              {/* Actions Bar */}
              <div className="flex items-center justify-between p-3 border-b border-gray-700">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectedPaths.size === browseData?.items.length ? selectNone : selectAll}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {selectedPaths.size === browseData?.items.length && browseData?.items.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedPaths.size > 0 ? `${selectedPaths.size} selected` : 'Select All'}
                  </button>
                  {selectedPaths.size > 0 && (
                    <span className="text-sm text-gray-500">({getSelectedSize()})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedPaths.size > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteLoading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteAllCategory(selectedCategory)}
                    disabled={deleteLoading || !browseData?.items.length}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-red-600 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All in {selectedCategory}
                  </button>
                </div>
              </div>

              {/* File List */}
              <div className="max-h-[400px] overflow-y-auto">
                {storageLoading ? (
                  <div className="p-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading files...
                  </div>
                ) : browseData?.items.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No files in {selectedCategory}</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        <th className="w-10 px-3 py-2"></th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase">Name</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 uppercase w-24">Size</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 uppercase w-36">Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {browseData?.items.map((item) => (
                        <tr
                          key={item.path}
                          onClick={() => togglePathSelection(item.path)}
                          className={`cursor-pointer transition-colors ${
                            selectedPaths.has(item.path)
                              ? 'bg-blue-900/30'
                              : 'hover:bg-gray-800/50'
                          }`}
                        >
                          <td className="px-3 py-2">
                            {selectedPaths.has(item.path) ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-600" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {item.isDirectory ? (
                                <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                              ) : (
                                <FileVideo className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              )}
                              <span className="text-sm text-white truncate">{item.name}</span>
                              {item.isDirectory && item.childCount !== undefined && (
                                <span className="text-xs text-gray-500">({item.childCount} items)</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-400">{item.sizeFormatted}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-500">
                            {new Date(item.modified).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              {browseData && browseData.items.length > 0 && (
                <div className="p-3 border-t border-gray-700 text-sm text-gray-400 flex justify-between">
                  <span>{browseData.itemCount} items</span>
                  <span>Total: {browseData.totalSizeFormatted}</span>
                </div>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                    <h3 className="text-lg font-semibold">Delete {selectedPaths.size} items?</h3>
                  </div>
                  <p className="text-gray-400 mb-4">
                    This will permanently delete {selectedPaths.size} selected items ({getSelectedSize()}).
                    This action cannot be undone.
                  </p>
                  <div className="max-h-32 overflow-y-auto mb-4 text-sm text-gray-500">
                    {Array.from(selectedPaths).slice(0, 10).map(path => (
                      <div key={path} className="truncate">{path.split('/').pop()}</div>
                    ))}
                    {selectedPaths.size > 10 && (
                      <div className="text-gray-600">...and {selectedPaths.size - 10} more</div>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteSelectedFiles}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete All Category Modal */}
            {deleteAllCategory && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                    <h3 className="text-lg font-semibold">Delete ALL in {deleteAllCategory}?</h3>
                  </div>
                  <p className="text-gray-400 mb-4">
                    This will permanently delete ALL files in the {deleteAllCategory} category.
                    This action cannot be undone.
                  </p>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-300">
                      <strong>Warning:</strong> This will delete{' '}
                      {storageStats?.categories.find(c => c.category === deleteAllCategory)?.sizeFormatted || 'all data'}{' '}
                      ({storageStats?.categories.find(c => c.category === deleteAllCategory)?.itemCount || 0} items)
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteAllCategory(null)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteAllInCategory(deleteAllCategory)}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete All'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
