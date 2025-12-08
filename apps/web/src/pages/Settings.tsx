import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Gauge,
  Server,
  Bell,
  HardDrive,
  Cog,
  Shield,
  Save,
  AlertCircle
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

type TabKey = 'download' | 'bandwidth' | 'jellyfin' | 'notifications' | 'storage' | 'behavior' | 'privacy';

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('download');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
    if (activeTab === 'storage') {
      fetchStorageInfo();
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
      alert('Cleanup failed');
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const tabs = [
    { key: 'download' as TabKey, label: 'Download Preferences', icon: Download },
    { key: 'bandwidth' as TabKey, label: 'Bandwidth', icon: Gauge },
    { key: 'jellyfin' as TabKey, label: 'Jellyfin', icon: Server },
    { key: 'notifications' as TabKey, label: 'Notifications', icon: Bell },
    { key: 'storage' as TabKey, label: 'Storage', icon: HardDrive },
    { key: 'behavior' as TabKey, label: 'Behavior', icon: Cog },
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
        {/* Download Preferences Tab */}
        {activeTab === 'download' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Download Preferences</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Quality</label>
                <select
                  value={preferences.default_quality}
                  onChange={(e) => updatePreference('default_quality', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="2160p">2160p (4K)</option>
                  <option value="1440p">1440p (2K)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p (SD)</option>
                  <option value="360p">360p</option>
                  <option value="audio">Audio Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Folder</label>
                <select
                  value={preferences.default_folder}
                  onChange={(e) => updatePreference('default_folder', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Downloads">Downloads</option>
                  <option value="Movies">Movies</option>
                  <option value="TV Shows">TV Shows</option>
                  <option value="Music">Music</option>
                  <option value="Documentaries">Documentaries</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Video Format</label>
                <select
                  value={preferences.default_video_format}
                  onChange={(e) => updatePreference('default_video_format', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="mp4">MP4</option>
                  <option value="mkv">MKV</option>
                  <option value="webm">WebM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Audio Format</label>
                <select
                  value={preferences.default_audio_format}
                  onChange={(e) => updatePreference('default_audio_format', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="mp3">MP3</option>
                  <option value="m4a">M4A</option>
                  <option value="aac">AAC</option>
                  <option value="opus">Opus</option>
                  <option value="flac">FLAC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Concurrent Downloads: {preferences.concurrent_downloads}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={preferences.concurrent_downloads}
                  onChange={(e) => updatePreference('concurrent_downloads', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">Number of simultaneous downloads</p>
              </div>
            </div>
          </div>
        )}

        {/* Bandwidth Controls Tab */}
        {activeTab === 'bandwidth' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Bandwidth Controls</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Download Speed Limit (MB/s)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={preferences.download_speed_limit ? preferences.download_speed_limit / (1024 * 1024) : ''}
                  onChange={(e) => updatePreference('download_speed_limit', e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Upload Speed Limit (MB/s)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={preferences.upload_speed_limit ? preferences.upload_speed_limit / (1024 * 1024) : ''}
                  onChange={(e) => updatePreference('upload_speed_limit', e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">For torrent seeding</p>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Bandwidth limits apply to all downloads and uploads. Restart the download worker for changes to take effect.
              </p>
            </div>
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

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.notifications_enabled}
                  onChange={(e) => updatePreference('notifications_enabled', e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Enable Notifications</div>
                  <div className="text-sm text-gray-400">Master switch for all notifications</div>
                </div>
              </label>

              {preferences.notifications_enabled && (
                <>
                  <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notify_download_complete}
                      onChange={(e) => updatePreference('notify_download_complete', e.target.checked)}
                      className="w-5 h-5 accent-blue-600"
                    />
                    <div>
                      <div className="font-medium text-white">Download Complete</div>
                      <div className="text-sm text-gray-400">Notify when downloads finish successfully</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notify_download_failed}
                      onChange={(e) => updatePreference('notify_download_failed', e.target.checked)}
                      className="w-5 h-5 accent-blue-600"
                    />
                    <div>
                      <div className="font-medium text-white">Download Failed</div>
                      <div className="text-sm text-gray-400">Notify when downloads fail or encounter errors</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notification_sound}
                      onChange={(e) => updatePreference('notification_sound', e.target.checked)}
                      className="w-5 h-5 accent-blue-600"
                    />
                    <div>
                      <div className="font-medium text-white">Notification Sound</div>
                      <div className="text-sm text-gray-400">Play sound with notifications</div>
                    </div>
                  </label>
                </>
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

        {/* Behavior Settings Tab */}
        {activeTab === 'behavior' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Behavior Settings</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.auto_organize_files}
                  onChange={(e) => updatePreference('auto_organize_files', e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Auto-Organize Files</div>
                  <div className="text-sm text-gray-400">Automatically organize downloads into category folders</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.auto_fetch_thumbnails}
                  onChange={(e) => updatePreference('auto_fetch_thumbnails', e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Auto-Fetch Thumbnails</div>
                  <div className="text-sm text-gray-400">Automatically fetch thumbnails from TMDB for torrents</div>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Keep Download History (days): {preferences.keep_download_history_days}
                </label>
                <input
                  type="range"
                  min="7"
                  max="365"
                  value={preferences.keep_download_history_days}
                  onChange={(e) => updatePreference('keep_download_history_days', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">History of completed/failed downloads</p>
              </div>
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
