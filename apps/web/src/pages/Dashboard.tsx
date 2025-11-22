import { useEffect, useState } from 'react';

interface Stats {
  downloads: {
    total: number;
    pending: number;
    downloading: number;
    completed: number;
    failed: number;
  };
  media: {
    total_items: number;
    total_size: number;
    total_duration: number;
    by_type: Array<{
      type: string;
      count: string;
      total_size: string;
    }>;
  };
}

interface Download {
  id: string;
  title: string;
  url: string;
  status: string;
  progress: number;
  downloader: string;
  created_at: string;
}

interface PlatformData {
  platform: string;
  total: number;
  completed: number;
  failed: number;
}

interface StorageData {
  category: string;
  count: number;
  size: number;
  duration: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<Download[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [storageData, setStorageData] = useState<StorageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch download stats
      const downloadsRes = await fetch('http://localhost:3001/api/v1/downloads?limit=5', {
        credentials: 'include'
      });

      if (downloadsRes.ok) {
        const downloadsData = await downloadsRes.json();
        setRecentDownloads(downloadsData.downloads || []);

        // Calculate download stats
        const downloadStats = {
          total: downloadsData.total || 0,
          pending: downloadsData.downloads.filter((d: Download) => d.status === 'pending').length,
          downloading: downloadsData.downloads.filter((d: Download) => d.status === 'downloading').length,
          completed: downloadsData.downloads.filter((d: Download) => d.status === 'completed').length,
          failed: downloadsData.downloads.filter((d: Download) => d.status === 'failed').length
        };

        // Fetch media stats
        const mediaRes = await fetch('http://localhost:3001/api/v1/media/stats', {
          credentials: 'include'
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          setStats({
            downloads: downloadStats,
            media: mediaData.total
          });
        }
      }

      // Fetch analytics data
      const [platformRes, storageRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/analytics/platform-distribution', { credentials: 'include' }),
        fetch('http://localhost:3001/api/v1/analytics/storage-breakdown', { credentials: 'include' })
      ]);

      if (platformRes.ok) {
        const platformAnalytics = await platformRes.json();
        setPlatformData(platformAnalytics.distribution || []);
      }

      if (storageRes.ok) {
        const storageAnalytics = await storageRes.json();
        setStorageData(storageAnalytics.breakdown || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'downloading':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Media Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Downloads</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.downloads.total || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex gap-2 text-xs">
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
              {stats?.downloads.pending || 0} pending
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {stats?.downloads.downloading || 0} active
            </span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.downloads.completed || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Media Files</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.media.total_items || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatBytes(stats?.media.total_size || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Downloads</h2>
          {recentDownloads.length === 0 ? (
            <p className="text-gray-500 text-sm">No downloads yet</p>
          ) : (
            <div className="space-y-3">
              {recentDownloads.map((download) => (
                <div key={download.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {download.title || download.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(download.status)}`}>
                        {download.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {download.downloader}
                      </span>
                      {download.status === 'downloading' && (
                        <span className="text-xs text-blue-600">
                          {download.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/downloads"
              className="block p-4 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">New Download</p>
                  <p className="text-sm text-gray-600">Add a new video or audio download</p>
                </div>
              </div>
            </a>

            <a
              href="/media"
              className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Browse Media</p>
                  <p className="text-sm text-gray-600">View your media library</p>
                </div>
              </div>
            </a>

            <a
              href="http://localhost:8096"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Open Jellyfin</p>
                  <p className="text-sm text-gray-600">Stream your media</p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Platform Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Downloads by Platform</h2>
          {platformData.length === 0 ? (
            <p className="text-gray-500 text-sm">No platform data yet</p>
          ) : (
            <div className="space-y-3">
              {platformData.slice(0, 6).map((platform) => {
                const maxTotal = Math.max(...platformData.map(p => p.total));
                const widthPercent = (platform.total / maxTotal) * 100;
                const successRate = platform.total > 0
                  ? Math.round((platform.completed / platform.total) * 100)
                  : 0;

                return (
                  <div key={platform.platform}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{platform.platform}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">{platform.total} total</span>
                        <span className="text-green-600">{successRate}% success</span>
                      </div>
                    </div>
                    <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute h-full bg-gradient-to-r from-brand-500 to-brand-600 flex items-center justify-end pr-2"
                        style={{ width: `${widthPercent}%` }}
                      >
                        {widthPercent > 20 && (
                          <span className="text-xs font-medium text-white">{platform.completed}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Storage Breakdown */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Storage by Category</h2>
          {storageData.length === 0 ? (
            <p className="text-gray-500 text-sm">No storage data yet</p>
          ) : (
            <div className="space-y-3">
              {storageData.slice(0, 6).map((category) => {
                const maxSize = Math.max(...storageData.map(c => c.size));
                const widthPercent = (category.size / maxSize) * 100;

                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{category.category}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">{category.count} files</span>
                        <span className="text-purple-600">{formatBytes(category.size)}</span>
                      </div>
                    </div>
                    <div className="relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-end pr-2"
                        style={{ width: `${widthPercent}%` }}
                      >
                        {widthPercent > 20 && (
                          <span className="text-xs font-medium text-white">{formatBytes(category.size)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
