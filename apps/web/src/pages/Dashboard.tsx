import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '@/lib/config';

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

interface DiskSpace {
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
  };
  media: {
    used: number;
    percentOfDisk: string;
  };
}

interface RealStorageStats {
  categories: Array<{
    category: string;
    folder: string;
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

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<Download[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [storageData, setStorageData] = useState<StorageData[]>([]);
  const [realStorageStats, setRealStorageStats] = useState<RealStorageStats | null>(null);
  const [diskSpace, setDiskSpace] = useState<DiskSpace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch download stats
      const downloadsRes = await fetch(`${API_BASE}/downloads?limit=5`, {
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
        const mediaRes = await fetch(`${API_BASE}/media/stats`, {
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
      const [platformRes, storageRes, diskSpaceRes, realStorageRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/platform-distribution`, { credentials: 'include' }),
        fetch(`${API_BASE}/analytics/storage-breakdown`, { credentials: 'include' }),
        fetch(`${API_BASE}/analytics/disk-space`, { credentials: 'include' }),
        fetch(`${API_BASE}/storage/stats`, { credentials: 'include' })
      ]);

      if (platformRes.ok) {
        const platformAnalytics = await platformRes.json();
        setPlatformData(platformAnalytics.distribution || []);
      }

      if (storageRes.ok) {
        const storageAnalytics = await storageRes.json();
        setStorageData(storageAnalytics.breakdown || []);
      }

      if (diskSpaceRes.ok) {
        const diskSpaceData = await diskSpaceRes.json();
        setDiskSpace(diskSpaceData);
      }

      if (realStorageRes.ok) {
        const realStorageData = await realStorageRes.json();
        setRealStorageStats(realStorageData);
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
        return 'bg-green-900/50 text-green-300';
      case 'downloading':
        return 'bg-blue-900/50 text-blue-300';
      case 'pending':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'failed':
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100">Media Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Movies Card */}
        {(() => {
          const moviesData = realStorageStats?.categories.find(c => c.category === 'Movies');
          const totalSize = realStorageStats?.total.size || 1;
          const percent = moviesData ? (moviesData.size / totalSize) * 100 : 0;
          return (
            <a
              href="http://localhost:8096/web/#/movies?topParentId=f137a2dd21bbc1b99aa5c0f6bf02a805&collectionType=movies"
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:ring-2 hover:ring-blue-500 transition-all text-left block"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-400">Movies</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">
                    {moviesData?.sizeFormatted || '0 B'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{moviesData?.itemCount || 0} items</span>
                  <span>{percent.toFixed(1)}% of library</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            </a>
          );
        })()}

        {/* TV Shows Card */}
        {(() => {
          const tvData = realStorageStats?.categories.find(c => c.category === 'TV Shows');
          const totalSize = realStorageStats?.total.size || 1;
          const percent = tvData ? (tvData.size / totalSize) * 100 : 0;
          return (
            <a
              href="http://localhost:8096/web/#/tv?topParentId=767bffe4f11c93ef34b805451a696a4e&collectionType=tvshows"
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:ring-2 hover:ring-purple-500 transition-all text-left block"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-400">TV Shows</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">
                    {tvData?.sizeFormatted || '0 B'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{tvData?.itemCount || 0} items</span>
                  <span>{percent.toFixed(1)}% of library</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            </a>
          );
        })()}

        {/* Documentaries Card */}
        {(() => {
          const docsData = realStorageStats?.categories.find(c => c.category === 'Documentaries');
          const totalSize = realStorageStats?.total.size || 1;
          const percent = docsData ? (docsData.size / totalSize) * 100 : 0;
          return (
            <a
              href="http://localhost:8096/web/#/movies?topParentId=c248dc0bec4b0ce8fb01231d1f12c5c1&collectionType=movies"
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:ring-2 hover:ring-green-500 transition-all text-left block"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-400">Documentaries</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">
                    {docsData?.sizeFormatted || '0 B'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{docsData?.itemCount || 0} items</span>
                  <span>{percent.toFixed(1)}% of library</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            </a>
          );
        })()}

        {/* Storage Card - Clickable to Settings > Storage */}
        <button
          onClick={() => navigate('/settings?tab=storage')}
          className="card hover:ring-2 hover:ring-orange-500 transition-all text-left"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-400">Total Storage</p>
              <p className="text-2xl font-bold text-gray-100 mt-1">
                {realStorageStats?.total.sizeFormatted || '0 B'}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-900/50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{realStorageStats?.total.itemCount || 0} items</span>
              <span>{diskSpace ? `${diskSpace.disk.usedPercent.toFixed(1)}% of disk` : '0% of disk'}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${diskSpace?.disk.usedPercent || 0}%` }}
              ></div>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Recent Downloads</h2>
          {recentDownloads.length === 0 ? (
            <p className="text-gray-400 text-sm">No downloads yet</p>
          ) : (
            <div className="space-y-3">
              {recentDownloads.map((download) => (
                <div key={download.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {download.title || download.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(download.status)}`}>
                        {download.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {download.downloader}
                      </span>
                      {download.status === 'downloading' && (
                        <span className="text-xs text-blue-400">
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
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="http://localhost:8096"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-purple-900/30 hover:bg-purple-900/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-100">Open Jellyfin</p>
                  <p className="text-sm text-gray-400">Stream your media</p>
                </div>
              </div>
            </a>

            <a
              href="http://localhost:8080"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-green-900/30 hover:bg-green-900/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-100">Open qBittorrent</p>
                  <p className="text-sm text-gray-400">Manage torrent downloads</p>
                </div>
              </div>
            </a>

            <a
              href="http://localhost:9696"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-orange-900/30 hover:bg-orange-900/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-100">Open Prowlarr</p>
                  <p className="text-sm text-gray-400">Manage torrent indexers</p>
                </div>
              </div>
            </a>

            <button
              onClick={() => {
                window.open('http://localhost:6767', '_blank', 'noopener,noreferrer');
                window.open('http://localhost:8989', '_blank', 'noopener,noreferrer');
                window.open('http://localhost:7878', '_blank', 'noopener,noreferrer');
              }}
              className="block w-full p-4 bg-blue-900/30 hover:bg-blue-900/50 rounded-lg transition-colors text-left relative"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-100">Manage Subtitles</p>
                  <p className="text-sm text-gray-400">Opens Bazarr, Sonarr & Radarr</p>
                </div>
                {/* Info icon with tooltip */}
                <div className="relative group/info" onClick={(e) => e.stopPropagation()}>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-gray-400 text-xs font-bold cursor-help">
                    i
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full right-0 mb-2 w-64 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none">
                    <p className="font-semibold mb-1">📌 Popup Blocker Notice</p>
                    <p>Allow popups in your browser's address bar, or add localhost:5173 to your browser popup settings to allow popups permanently.</p>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Platform Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Downloads by Platform</h2>
          {platformData.length === 0 ? (
            <p className="text-gray-400 text-sm">No platform data yet</p>
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
                      <span className="text-sm font-medium text-gray-300">{platform.platform}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">{platform.total} total</span>
                        <span className="text-green-400">{successRate}% success</span>
                      </div>
                    </div>
                    <div className="relative h-6 bg-gray-700 rounded-lg overflow-hidden">
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

        {/* Storage Breakdown - Real Disk Stats */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Storage by Category</h2>
            <button
              onClick={() => navigate('/settings?tab=storage')}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Manage →
            </button>
          </div>
          {!realStorageStats || realStorageStats.categories.length === 0 ? (
            <p className="text-gray-400 text-sm">No storage data yet</p>
          ) : (
            <div className="space-y-3">
              {realStorageStats.categories.map((category) => {
                const maxSize = Math.max(...realStorageStats.categories.map(c => c.size));
                const widthPercent = maxSize > 0 ? (category.size / maxSize) * 100 : 0;

                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-300">{category.category}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">{category.itemCount} items</span>
                        <span className="text-purple-400">{category.sizeFormatted}</span>
                      </div>
                    </div>
                    <div className="relative h-6 bg-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(widthPercent, 2)}%` }}
                      >
                        {widthPercent > 20 && (
                          <span className="text-xs font-medium text-white">{category.sizeFormatted}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Total */}
              <div className="border-t border-gray-700 pt-3 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="font-semibold text-white">{realStorageStats.total.sizeFormatted}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
