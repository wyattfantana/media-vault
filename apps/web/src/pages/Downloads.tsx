import { useState, useEffect } from 'react';

interface Download {
  id: string;
  title: string;
  url: string;
  status: string;
  progress: number;
  downloader: string;
  created_at: string;
  error_message?: string;
  thumbnail?: string;
  description?: string;
  file_size?: number;
}

interface DownloadStats {
  total: number;
  pending: number;
  downloading: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export function Downloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDownload, setShowNewDownload] = useState(false);
  const [newDownloadUrl, setNewDownloadUrl] = useState('');
  const [downloader, setDownloader] = useState<'yt-dlp' | 'get_iplayer'>('yt-dlp');
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>('movies');
  const [customFolder, setCustomFolder] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  useEffect(() => {
    fetchDownloads();
    // Poll for updates every 3 seconds for active downloads
    const interval = setInterval(fetchDownloads, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchDownloads = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/downloads?limit=100', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setDownloads(data.downloads || []);
      }
    } catch (err) {
      console.error('Failed to fetch downloads:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats: DownloadStats = {
    total: downloads.length,
    pending: downloads.filter(d => d.status === 'pending').length,
    downloading: downloads.filter(d => d.status === 'downloading').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(d => d.status === 'failed').length,
    cancelled: downloads.filter(d => d.status === 'cancelled').length
  };

  const filteredDownloads = statusFilter === 'all'
    ? downloads
    : downloads.filter(d => d.status === statusFilter);

  const handleClearCompleted = async () => {
    if (!confirm('Clear all completed downloads from the list?')) return;

    try {
      const completedIds = downloads.filter(d => d.status === 'completed').map(d => d.id);
      await Promise.all(
        completedIds.map(id =>
          fetch(`http://localhost:3001/api/v1/downloads/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        )
      );
      fetchDownloads();
    } catch (err) {
      alert('Failed to clear completed downloads');
    }
  };

  const handleRetry = async (download: Download) => {
    try {
      // Delete the old download and create a new one
      await fetch(`http://localhost:3001/api/v1/downloads/${download.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      await fetch('http://localhost:3001/api/v1/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: download.url,
          downloader: download.downloader
        })
      });

      fetchDownloads();
    } catch (err) {
      alert('Failed to retry download');
    }
  };

  const handleNewDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:3001/api/v1/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: newDownloadUrl,
          downloader,
          category,
          customFolder: category === 'custom' ? customFolder : undefined
        })
      });

      if (res.ok) {
        // Download will start automatically via worker
        setNewDownloadUrl('');
        setCategory('movies');
        setCustomFolder('');
        setShowNewDownload(false);
        fetchDownloads();
      } else {
        const error = await res.json();
        alert(`Failed to create download: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to create download');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this download?')) return;

    try {
      await fetch(`http://localhost:3001/api/v1/downloads/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchDownloads();
    } catch (err) {
      alert('Failed to delete download');
    }
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
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading downloads...</div>
    </div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Queue Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage all downloads</p>
        </div>
        <div className="flex gap-3">
          {stats.completed > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear Completed
            </button>
          )}
          <button
            onClick={() => setShowNewDownload(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Download
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="card">
          <div className="text-sm text-yellow-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
        </div>
        <div className="card">
          <div className="text-sm text-blue-600 mb-1">Downloading</div>
          <div className="text-2xl font-bold text-blue-700">{stats.downloading}</div>
        </div>
        <div className="card">
          <div className="text-sm text-green-600 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
        </div>
        <div className="card">
          <div className="text-sm text-red-600 mb-1">Failed</div>
          <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Cancelled</div>
          <div className="text-2xl font-bold text-gray-700">{stats.cancelled}</div>
        </div>
      </div>

      {/* Filters and View Mode */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm ${statusFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm ${statusFilter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setStatusFilter('downloading')}
                className={`px-4 py-2 rounded-lg text-sm ${statusFilter === 'downloading' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Active ({stats.downloading})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm ${statusFilter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Completed ({stats.completed})
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-4 py-2 rounded-lg text-sm ${statusFilter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Failed ({stats.failed})
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'table' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewDownload && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">New Download</h2>
          <form onSubmit={handleNewDownload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                value={newDownloadUrl}
                onChange={(e) => setNewDownloadUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Downloader
              </label>
              <select
                value={downloader}
                onChange={(e) => setDownloader(e.target.value as 'yt-dlp' | 'get_iplayer')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="yt-dlp">yt-dlp (YouTube, ITVX, etc.)</option>
                <option value="get_iplayer">get_iplayer (BBC iPlayer)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="movies">Movies</option>
                <option value="tv">TV Shows</option>
                <option value="music">Music</option>
                <option value="documentaries">Documentaries</option>
                <option value="custom">Custom Folder...</option>
                <option value="collection">Collection (No folder)</option>
              </select>
            </div>

            {category === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Folder Name
                </label>
                <input
                  type="text"
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  placeholder="e.g., DJ Mixes, Podcasts, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Download'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewDownload(false);
                  setNewDownloadUrl('');
                  setCategory('movies');
                  setCustomFolder('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Downloads List */}
      {filteredDownloads.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">
            {downloads.length === 0 ? 'No downloads yet' : 'No downloads match your filter'}
          </p>
          {downloads.length === 0 && (
            <button
              onClick={() => setShowNewDownload(true)}
              className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
            >
              Create your first download
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDownloads.map((download) => (
            <div key={download.id} className="card">
              {/* Thumbnail */}
              {download.thumbnail ? (
                <div className="aspect-[2/3] bg-gray-200 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={download.thumbnail}
                    alt={download.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-[2/3] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
              )}

              {/* Title and Status */}
              <div className="mb-3">
                <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 min-h-[3rem]" title={download.title}>
                  {download.title || 'Untitled'}
                </h3>
                <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(download.status)}`}>
                  {download.status}
                </span>
                <span className="ml-2 text-xs text-gray-500">{download.downloader}</span>
              </div>

              {/* Progress Bar */}
              {download.status === 'downloading' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Downloading...</span>
                    <span>{download.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${download.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {download.error_message && (
                <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-700">
                  {download.error_message}
                </div>
              )}

              {/* URL */}
              <div className="text-xs text-gray-400 mb-3 truncate" title={download.url}>
                {download.url}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {download.status === 'failed' && (
                  <button
                    onClick={() => handleRetry(download)}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => handleDelete(download.id)}
                  className="flex-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                >
                  {download.status === 'downloading' ? 'Cancel' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Downloader
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDownloads.map((download) => (
                <tr key={download.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 max-w-md">
                      {download.thumbnail && (
                        <img
                          src={download.thumbnail}
                          alt={download.title}
                          className="w-12 h-18 object-contain rounded bg-gray-100"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {download.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {download.url}
                        </p>
                        {download.error_message && (
                          <p className="text-xs text-red-600 mt-1 line-clamp-1">
                            {download.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(download.status)}`}>
                      {download.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {download.status === 'downloading' ? (
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{download.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${download.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                    {download.downloader}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {download.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(download)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(download.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        {download.status === 'downloading' ? 'Cancel' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
