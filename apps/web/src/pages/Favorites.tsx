import { useState, useEffect } from 'react';

interface Bookmark {
  id: string;
  url?: string;
  type: string;
  title: string;
  description?: string;
  thumbnail: string;
  // YouTube/SoundCloud fields
  channel_name?: string;
  subscriber_count?: number;
  video_count?: number;
  // TMDB fields
  tmdb_id?: number;
  media_type?: 'movie' | 'tv' | 'documentary';
  release_year?: number;
  vote_average?: number;
  backdrop_url?: string;
  // Download status
  download_status?: {
    is_downloaded: boolean;
    media_id?: string;
    file_path?: string;
    file_size?: number;
    status?: 'pending' | 'downloading';
    progress?: number;
  };
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
      const res = await fetch('http://localhost:3001/api/v1/bookmarks?enrichWithDownloadStatus=true', {
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
      window.location.href = '/discover?tab=youtube&url=' + encodeURIComponent(url);
    } else if (url.includes('soundcloud.com')) {
      window.location.href = '/discover?tab=soundcloud&url=' + encodeURIComponent(url);
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
    tmdb_movie: bookmarks.filter(b => b.type === 'tmdb_movie').length,
    tmdb_tv: bookmarks.filter(b => b.type === 'tmdb_tv').length,
    tmdb_documentary: bookmarks.filter(b => b.type === 'tmdb_documentary').length,
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

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const handleQuickDownload = (bookmark: Bookmark) => {
    // Redirect to browse page with pre-selected item
    const page = bookmark.media_type === 'movie' ? 'movies' :
                 bookmark.media_type === 'tv' ? 'tv' : 'documentaries';
    window.location.href = `/${page}?tmdbId=${bookmark.tmdb_id}`;
  };

  const openInJellyfin = async (bookmark: Bookmark) => {
    try {
      // Get Jellyfin preferences
      const res = await fetch('http://localhost:3001/api/v1/preferences', { credentials: 'include' });
      const prefs = await res.json();

      if (prefs.jellyfin_server_url) {
        // Try to find the item in Jellyfin by title
        const jellyfinUrl = `${prefs.jellyfin_server_url}/web/index.html#!/search?query=${encodeURIComponent(bookmark.title)}`;
        window.open(jellyfinUrl, '_blank');
      } else {
        alert('Jellyfin not configured. Please set up Jellyfin in Settings.');
      }
    } catch (err) {
      console.error('Failed to open Jellyfin:', err);
      alert('Failed to open Jellyfin');
    }
  };

  const renderTMDBCard = (bookmark: Bookmark) => {
    const isDownloaded = bookmark.download_status?.is_downloaded;
    const isDownloading = bookmark.download_status?.status === 'downloading';

    return (
      <div key={bookmark.id} className="card hover:shadow-xl transition-shadow">
        {/* Poster */}
        <div className="aspect-[2/3] relative overflow-hidden rounded-lg mb-3">
          {bookmark.thumbnail ? (
            <img
              src={bookmark.thumbnail}
              alt={bookmark.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
              </svg>
            </div>
          )}

          {/* Status badge - top right */}
          {isDownloaded && (
            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow">
              ✓ Downloaded
            </div>
          )}
          {isDownloading && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow">
              Downloading {bookmark.download_status?.progress}%
            </div>
          )}

          {/* Rating badge - top left */}
          {bookmark.vote_average && typeof bookmark.vote_average === 'number' && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-yellow-400 text-xs px-2 py-1 rounded">
              ★ {bookmark.vote_average.toFixed(1)}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg line-clamp-2 min-h-[2.5rem] mb-2">
          {bookmark.title}
          {bookmark.release_year && (
            <span className="text-gray-500 ml-2">({bookmark.release_year})</span>
          )}
        </h3>

        {/* Type badge */}
        <div className="mb-2">
          <span className={`inline-block px-2 py-1 text-xs rounded ${
            bookmark.media_type === 'movie' ? 'bg-purple-100 text-purple-700' :
            bookmark.media_type === 'tv' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {bookmark.media_type === 'movie' ? 'Movie' :
             bookmark.media_type === 'tv' ? 'TV Show' : 'Documentary'}
          </span>
        </div>

        {/* File info if downloaded */}
        {isDownloaded && bookmark.download_status?.file_size && (
          <div className="mb-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <span>{formatFileSize(bookmark.download_status.file_size)}</span>
            </div>
            {bookmark.download_status.file_path && (
              <div className="mt-1 text-gray-500 truncate" title={bookmark.download_status.file_path}>
                {bookmark.download_status.file_path.split('/').pop()}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isDownloaded && !isDownloading && (
            <button
              onClick={() => handleQuickDownload(bookmark)}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}

          {isDownloaded && (
            <button
              onClick={() => openInJellyfin(bookmark)}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch
            </button>
          )}

          <button
            onClick={() => handleDelete(bookmark.id)}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
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
          <button
            onClick={() => setFilter('tmdb_movie')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_movie' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Movies ({stats.tmdb_movie})
          </button>
          <button
            onClick={() => setFilter('tmdb_tv')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_tv' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            TV Shows ({stats.tmdb_tv})
          </button>
          <button
            onClick={() => setFilter('tmdb_documentary')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_documentary' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Documentaries ({stats.tmdb_documentary})
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
          {filteredBookmarks.map((bookmark) => {
            // Render TMDB cards differently from YouTube/SoundCloud cards
            if (bookmark.type.startsWith('tmdb_')) {
              return renderTMDBCard(bookmark);
            }

            // Render YouTube/SoundCloud cards (existing logic)
            return (
            <div key={bookmark.id} className="card hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              {bookmark.thumbnail && bookmark.thumbnail.trim() !== '' ? (
                <div className={`${bookmark.type === 'soundcloud_user' ? 'aspect-square' : 'aspect-video'} bg-gray-200 rounded-lg mb-3 overflow-hidden relative`}>
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
                  {/* Video/Track Count Badge */}
                  {bookmark.video_count && bookmark.video_count > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
                      </svg>
                      {formatCount(bookmark.video_count)} {bookmark.type === 'soundcloud_user' ? 'tracks' : 'videos'}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`${bookmark.type === 'soundcloud_user' ? 'aspect-square' : 'aspect-video'} bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400 relative`}>
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {/* Video/Track Count Badge */}
                  {bookmark.video_count && bookmark.video_count > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
                      </svg>
                      {formatCount(bookmark.video_count)} {bookmark.type === 'soundcloud_user' ? 'tracks' : 'videos'}
                    </div>
                  )}
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
                  onClick={() => handleVisit(bookmark.url!)}
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
            )
          })}
        </div>
      )}
    </div>
  );
}
