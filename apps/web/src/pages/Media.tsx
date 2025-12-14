import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';

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
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [filter, sortBy, sortOrder]);

  const fetchMedia = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      if (search) params.append('search', search);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('limit', '100'); // Increased limit for library view

      const res = await fetch(`${API_BASE}/media?${params}`, {
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
      await fetch(`${API_BASE}/media/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchMedia();
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      alert('Failed to delete media');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} items from the database? (Files will not be deleted)`)) return;

    try {
      await Promise.all(
        Array.from(selectedItems).map(id =>
          fetch(`${API_BASE}/media/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        )
      );
      setSelectedItems(new Set());
      setShowBulkActions(false);
      fetchMedia();
    } catch (err) {
      alert('Failed to delete some items');
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredMedia.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMedia.map(item => item.id)));
    }
  };

  const getPlatform = (source: string): string => {
    if (!source) return 'Unknown';
    if (source.includes('youtube.com') || source.includes('youtu.be')) return 'YouTube';
    if (source.includes('bbc.co.uk/iplayer')) return 'BBC iPlayer';
    if (source.includes('soundcloud.com')) return 'SoundCloud';
    if (source.includes('tiktok.com')) return 'TikTok';
    if (source.includes('reddit.com') || source.includes('redd.it')) return 'Reddit';
    if (source.includes('twitch.tv')) return 'Twitch';
    if (source.includes('vimeo.com')) return 'Vimeo';
    if (source.includes('rumble.com')) return 'Rumble';
    return 'Other';
  };

  const getCategory = (filePath: string): string => {
    if (!filePath) return 'Unknown';
    if (filePath.includes('/Movies/')) return 'Movies';
    if (filePath.includes('/TV/')) return 'TV Shows';
    if (filePath.includes('/Music/')) return 'Music';
    if (filePath.includes('/Documentaries/')) return 'Documentaries';
    const match = filePath.match(/\/downloads\/([^\/]+)\//);
    return match ? match[1] : 'Other';
  };

  const filteredMedia = media.filter(item => {
    if (platformFilter !== 'all' && getPlatform(item.source) !== platformFilter) return false;
    if (categoryFilter !== 'all' && getCategory(item.file_path) !== categoryFilter) return false;
    return true;
  });

  const platforms = Array.from(new Set(media.map(item => getPlatform(item.source)))).sort();
  const categories = Array.from(new Set(media.map(item => getCategory(item.file_path)))).sort();

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
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Media Library</h1>
          <p className="text-gray-400 mt-1">
            {filteredMedia.length} {filteredMedia.length === 1 ? 'item' : 'items'}
            {selectedItems.size > 0 && ` (${selectedItems.size} selected)`}
          </p>
        </div>
        {selectedItems.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete Selected ({selectedItems.size})
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search media by title or description..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Type Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Media Type</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-lg text-sm ${filter === 'video' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Videos
            </button>
            <button
              onClick={() => setFilter('audio')}
              className={`px-4 py-2 rounded-lg text-sm ${filter === 'audio' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Audio
            </button>
            <button
              onClick={() => setFilter('tv_show')}
              className={`px-4 py-2 rounded-lg text-sm ${filter === 'tv_show' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              TV Shows
            </button>
          </div>
        </div>

        {/* Platform Filter */}
        {platforms.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPlatformFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm ${platformFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All
              </button>
              {platforms.map(platform => (
                <button
                  key={platform}
                  onClick={() => setPlatformFilter(platform)}
                  className={`px-4 py-2 rounded-lg text-sm ${platformFilter === platform ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm ${categoryFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-4 py-2 rounded-lg text-sm ${categoryFilter === category ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort Controls */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="created_at">Date Added</option>
              <option value="title">Title</option>
              <option value="file_size">File Size</option>
              <option value="duration">Duration</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'ASC' | 'DESC')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">No media files found</p>
          <p className="text-sm text-gray-400 mt-2">Start downloading content from BBC iPlayer, YouTube, or other platforms</p>
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/iplayer" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              Browse iPlayer
            </a>
            <a href="/youtube" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              Browse YouTube
            </a>
            <a href="/downloads" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Add Download
            </a>
          </div>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">No items match your filters</p>
          <p className="text-sm text-gray-400 mt-2">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <>
          {/* Select All / Deselect All */}
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {selectedItems.size === filteredMedia.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedItems.size > 0 && (
              <span className="text-sm text-gray-600">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMedia.map((item) => (
                <div key={item.id} className="card hover:shadow-lg transition-shadow relative">
                {/* Checkbox for selection */}
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </div>

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

                <h3 className="font-medium text-gray-900 mb-2 truncate" title={item.title}>
                  {item.title}
                </h3>

                {/* Platform and Category badges */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                    {getPlatform(item.source)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                    {getCategory(item.file_path)}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {item.media_type}
                  </span>
                </div>

                {/* Duration and file info */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  {item.duration > 0 && (
                    <span>{formatDuration(item.duration)}</span>
                  )}
                  {item.duration > 0 && <span>•</span>}
                  <span>{formatBytes(item.file_size || 0)}</span>
                  {item.resolution && (
                    <>
                      <span>•</span>
                      <span>{item.resolution}</span>
                    </>
                  )}
                </div>

                {/* Date added */}
                <div className="text-xs text-gray-400 mb-3">
                  Added {new Date(item.created_at).toLocaleDateString()}
                </div>

                {/* Source URL (truncated) */}
                {item.source && (
                  <div className="text-xs text-gray-400 mb-3 truncate" title={item.source}>
                    <a href={item.source} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">
                      {item.source}
                    </a>
                  </div>
                )}

                <div className="flex gap-2">
                  <a
                    href={`${API_BASE}/media/${item.id}/stream`}
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
        </>
      )}
    </div>
  );
}
