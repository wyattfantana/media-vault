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

  useEffect(() => {
    fetchDownloads();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDownloads = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/downloads', {
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
        <h1 className="text-3xl font-bold text-gray-900">Downloads</h1>
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

      <div className="card">
        {downloads.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <p className="text-gray-500">No downloads yet</p>
            <button
              onClick={() => setShowNewDownload(true)}
              className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
            >
              Create your first download
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {downloads.map((download) => (
                  <tr key={download.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {download.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {download.url}
                        </p>
                        {download.error_message && (
                          <p className="text-xs text-red-600 mt-1">
                            {download.error_message}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(download.status)}`}>
                        {download.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {download.status === 'downloading' ? (
                        <div className="w-full">
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
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {download.downloader}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(download.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
