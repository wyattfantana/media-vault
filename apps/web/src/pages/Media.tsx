import { useState, useEffect } from 'react';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_path: string;
  file_size: number;
  duration: number;
  format: string;
  resolution: string;
  thumbnail: string;
  media_type: string;
  source: string;
  created_at: string;
}

export function Media() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMedia();
  }, [filter]);

  const fetchMedia = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      if (search) params.append('search', search);

      const res = await fetch(`http://localhost:3001/api/v1/media?${params}`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setMedia(data.media || []);
      }
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMedia();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media file from the database? (File will not be deleted)')) return;

    try {
      await fetch(`http://localhost:3001/api/v1/media/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchMedia();
    } catch (err) {
      alert('Failed to delete media');
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
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading media...</div>
    </div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Media Library</h1>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-lg ${filter === 'video' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Videos
            </button>
            <button
              onClick={() => setFilter('audio')}
              className={`px-4 py-2 rounded-lg ${filter === 'audio' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Audio
            </button>
            <button
              onClick={() => setFilter('tv_show')}
              className={`px-4 py-2 rounded-lg ${filter === 'tv_show' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              TV Shows
            </button>
          </div>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500">No media files found</p>
          <p className="text-sm text-gray-400 mt-2">Download some content to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {media.map((item) => (
            <div key={item.id} className="card hover:shadow-lg transition-shadow">
              {item.thumbnail ? (
                <div className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-gray-100">
                          ${getTypeIcon(item.media_type)}
                        </div>
                      `;
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400">
                  {getTypeIcon(item.media_type)}
                </div>
              )}

              <h3 className="font-medium text-gray-900 mb-1 truncate" title={item.title}>
                {item.title}
              </h3>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {item.media_type}
                </span>
                {item.duration > 0 && (
                  <span>{formatDuration(item.duration)}</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{formatBytes(item.file_size || 0)}</span>
                <span>{item.resolution || item.format || 'N/A'}</span>
              </div>

              <div className="flex gap-2">
                <a
                  href={`http://localhost:3001/api/v1/media/${item.id}/stream`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 text-center"
                >
                  Play
                </a>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
