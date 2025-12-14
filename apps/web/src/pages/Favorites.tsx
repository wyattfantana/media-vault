import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, ExternalLink, Star, Calendar, Search, Loader, HardDrive, Play } from 'lucide-react';

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

  // Download modal state
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [torrentResults, setTorrentResults] = useState<any[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

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
    setSelectedBookmark(bookmark);
    // Auto-search torrents
    searchTorrents(bookmark);
  };

  const searchTorrents = async (bookmark: Bookmark) => {
    setSearchingTorrents(true);
    setTorrentSearchError(null);
    setTorrentResults([]);

    try {
      // Clean up title for better torrent search results
      // Remove colons, parentheses, and other special chars that cause issues
      let cleanTitle = bookmark.title
        .replace(/:/g, '')  // Remove colons
        .replace(/\([^)]*\)/g, '')  // Remove anything in parentheses
        .replace(/[^\w\s]/g, ' ')  // Remove special characters except spaces
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .trim();

      // Limit to first 4-5 words to avoid overly long queries
      const words = cleanTitle.split(' ');
      if (words.length > 5) {
        cleanTitle = words.slice(0, 5).join(' ');
      }

      const searchQuery = `${cleanTitle} ${bookmark.release_year || ''}`.trim();
      const res = await fetch('http://localhost:3001/api/v1/torrents/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      if (!res.ok) {
        throw new Error('Failed to search torrents');
      }

      const data = await res.json();
      console.log('[Favorites] Torrent search results:', data);
      setTorrentResults(data.results || []);

      if (data.results.length === 0) {
        setTorrentSearchError('No torrents found. Try manual download below.');
      }
    } catch (err) {
      console.error('Torrent search error:', err);
      setTorrentSearchError('Failed to search torrents. Try manual download below.');
    } finally {
      setSearchingTorrents(false);
    }
  };

  const selectTorrent = (magnetUrl: string) => {
    setDownloadUrl(magnetUrl);
    // Auto-scroll to very bottom of modal
    setTimeout(() => {
      const button = downloadButtonRef.current;
      if (button) {
        // Find the scrollable modal container
        const modal = button.closest('.overflow-y-auto, .overflow-auto');
        if (modal) {
          // Scroll to very bottom
          modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' });
        }
      }
    }, 100);
  };

  const submitDownload = async () => {
    if (!selectedBookmark || !downloadUrl) {
      alert('Please select a torrent first');
      return;
    }

    try {
      const category = selectedBookmark.media_type === 'movie' ? 'Movies' :
                      selectedBookmark.media_type === 'tv' ? 'TV Shows' : 'Documentaries';

      const res = await fetch('http://localhost:3001/api/v1/downloads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: downloadUrl,
          downloader: 'qbittorrent',
          category,
          tmdb_id: selectedBookmark.tmdb_id,
          tmdb_media_type: selectedBookmark.media_type
        })
      });

      if (res.ok) {
        alert('Download started! Check the Downloads page for progress.');
        setSelectedBookmark(null);
        setDownloadUrl('');
        setTorrentResults([]);
        // Refresh bookmarks to update download status
        fetchBookmarks();
      } else {
        const error = await res.json();
        alert(`Download failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    }
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
      <div key={bookmark.id} className="card hover:shadow-xl transition-shadow flex flex-col h-full">
        {/* Poster */}
        <div className="aspect-[2/3] relative overflow-hidden rounded-lg mb-3 flex-shrink-0">
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

        {/* Content wrapper - grows to push buttons to bottom */}
        <div className="flex flex-col flex-grow">
          {/* Title */}
          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem] mb-2">
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

          {/* Spacer to push buttons to bottom */}
          <div className="flex-grow"></div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
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

      {/* Download Modal */}
      {selectedBookmark && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedBookmark(null);
            setTorrentResults([]);
            setTorrentSearchError(null);
            setDownloadUrl('');
          }}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedBookmark.backdrop_url && (
              <img
                src={selectedBookmark.backdrop_url}
                alt={selectedBookmark.title}
                className="w-full h-64 object-cover rounded-t-lg"
              />
            )}

            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedBookmark.title}</h2>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                {selectedBookmark.release_year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedBookmark.release_year}</span>
                  </div>
                )}
                {selectedBookmark.vote_average && typeof selectedBookmark.vote_average === 'number' && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{selectedBookmark.vote_average.toFixed(1)}/10</span>
                  </div>
                )}
                <span className={`px-2 py-1 text-xs rounded ${
                  selectedBookmark.media_type === 'movie' ? 'bg-purple-100 text-purple-700' :
                  selectedBookmark.media_type === 'tv' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {selectedBookmark.media_type === 'movie' ? 'Movie' :
                   selectedBookmark.media_type === 'tv' ? 'TV Show' : 'Documentary'}
                </span>
              </div>

              {selectedBookmark.description && (
                <p className="text-gray-300 mb-6">{selectedBookmark.description}</p>
              )}

              <div className="space-y-4">
                {/* Torrent Search Results */}
                {searchingTorrents && (
                  <div className="bg-gray-900/50 border border-blue-500/30 rounded-lg p-6 text-center">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-400" />
                    <p className="text-blue-400">Searching torrents...</p>
                  </div>
                )}

                {torrentSearchError && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    {torrentSearchError}
                  </div>
                )}

                {torrentResults.length > 0 && (
                  <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Found {torrentResults.length} Torrents (sorted by seeds)
                    </h3>
                    <div className="space-y-2">
                      {torrentResults.map((torrent: any, index: number) => (
                        <div
                          key={index}
                          onClick={() => selectTorrent(torrent.magnet)}
                          className={`bg-gray-800 hover:bg-gray-700 border rounded-lg p-3 cursor-pointer transition-colors ${
                            downloadUrl === torrent.magnet ? 'border-green-500' : 'border-gray-700 hover:border-green-500'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate mb-1">{torrent.title}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className={`px-2 py-1 rounded ${
                                  torrent.source === '1337x' ? 'bg-orange-600/20 text-orange-400' :
                                  torrent.source === 'piratebay' ? 'bg-purple-600/20 text-purple-400' :
                                  'bg-indigo-600/20 text-indigo-400'
                                }`}>
                                  {torrent.source}
                                </span>
                                {torrent.size && <span>{torrent.size}</span>}
                                {torrent.seeds !== undefined && (
                                  <span className="text-green-400">↑ {torrent.seeds}</span>
                                )}
                                {torrent.peers !== undefined && (
                                  <span className="text-red-400">↓ {torrent.peers}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Button */}
                {downloadUrl && (
                  <button
                    ref={downloadButtonRef}
                    onClick={submitDownload}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors shadow-lg text-lg"
                  >
                    <Download className="w-6 h-6" />
                    Download Selected Torrent
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
