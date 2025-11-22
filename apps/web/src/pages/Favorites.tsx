import { useState, useEffect } from 'react';

interface Bookmark {
  id: string;
  url: string;
  type: string;
  title: string;
  description: string;
  thumbnail: string;
  channel_name?: string;
  subscriber_count?: number;
  video_count?: number;
  created_at: string;
}

export function Favorites() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/bookmarks', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this bookmark?')) return;

    try {
      await fetch(`http://localhost:3001/api/v1/bookmarks/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchBookmarks();
    } catch (err) {
      alert('Failed to delete bookmark');
    }
  };

  const handleVisit = (url: string) => {
    if (url.includes('youtube.com')) {
      window.location.href = '/youtube?url=' + encodeURIComponent(url);
    } else if (url.includes('soundcloud.com')) {
      window.location.href = '/soundcloud?url=' + encodeURIComponent(url);
    } else {
      window.location.href = url;
    }
  };

  const filteredBookmarks = filter === 'all'
    ? bookmarks
    : bookmarks.filter(b => b.type === filter);

  const stats = {
    total: bookmarks.length,
    youtube_channel: bookmarks.filter(b => b.type === 'youtube_channel').length,
    youtube_playlist: bookmarks.filter(b => b.type === 'youtube_playlist').length,
    soundcloud_user: bookmarks.filter(b => b.type === 'soundcloud_user').length,
    other: bookmarks.filter(b => b.type === 'other').length
  };

  const formatCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading bookmarks...</div>
    </div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Favorites</h1>
        <p className="text-gray-600 mt-1">Your bookmarked channels and playlists</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="card">
          <div className="text-sm text-red-600 mb-1">YT Channels</div>
          <div className="text-2xl font-bold text-red-700">{stats.youtube_channel}</div>
        </div>
        <div className="card">
          <div className="text-sm text-red-600 mb-1">YT Playlists</div>
          <div className="text-2xl font-bold text-red-700">{stats.youtube_playlist}</div>
        </div>
        <div className="card">
          <div className="text-sm text-orange-600 mb-1">SoundCloud</div>
          <div className="text-2xl font-bold text-orange-700">{stats.soundcloud_user}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Other</div>
          <div className="text-2xl font-bold text-gray-700">{stats.other}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('youtube_channel')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'youtube_channel' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            YouTube Channels ({stats.youtube_channel})
          </button>
          <button
            onClick={() => setFilter('youtube_playlist')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'youtube_playlist' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            YouTube Playlists ({stats.youtube_playlist})
          </button>
          <button
            onClick={() => setFilter('soundcloud_user')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'soundcloud_user' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            SoundCloud ({stats.soundcloud_user})
          </button>
        </div>
      </div>

      {/* Bookmarks Grid */}
      {filteredBookmarks.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">
            {bookmarks.length === 0 ? 'No bookmarks yet' : 'No bookmarks match your filter'}
          </p>
          {bookmarks.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">
              Bookmark your favorite channels and playlists for quick access
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBookmarks.map((bookmark) => (
            <div key={bookmark.id} className="card hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              {bookmark.thumbnail && bookmark.thumbnail.trim() !== '' ? (
                <div className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={bookmark.thumbnail}
                    alt={bookmark.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // If image fails to load, replace with fallback
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                            <svg class="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400">
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
              )}

              {/* Title */}
              <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]" title={bookmark.title}>
                {bookmark.title}
              </h3>

              {/* Type Badge */}
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 text-xs rounded ${
                  bookmark.type === 'youtube_channel' || bookmark.type === 'youtube_playlist'
                    ? 'bg-red-100 text-red-700'
                    : bookmark.type === 'soundcloud_user'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {bookmark.type.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                {bookmark.subscriber_count && bookmark.subscriber_count > 0 && (
                  <span>{formatCount(bookmark.subscriber_count)} {bookmark.type === 'soundcloud_user' ? 'followers' : 'subscribers'}</span>
                )}
                {bookmark.video_count && bookmark.video_count > 0 && (
                  <span>{formatCount(bookmark.video_count)} {bookmark.type === 'soundcloud_user' ? 'tracks' : 'videos'}</span>
                )}
                {(!bookmark.video_count || bookmark.video_count === 0) && bookmark.type.includes('youtube') && (
                  <span className="text-gray-400 italic">video count unavailable</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleVisit(bookmark.url)}
                  className="flex-1 px-3 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700"
                >
                  Browse
                </button>
                <button
                  onClick={() => handleDelete(bookmark.id)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
