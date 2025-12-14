import { useState, useEffect } from 'react';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: number;
  uploader?: string;
  uploadDate?: string;
  viewCount?: number;
}

export function Rumble() {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [category, setCategory] = useState('movies');
  const [customFolder, setCustomFolder] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('rumble-page-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.videos) setVideos(state.videos);
        if (state.inputUrl) setInputUrl(state.inputUrl);
        if (state.currentUrl) setCurrentUrl(state.currentUrl);
        if (state.hasMore !== undefined) setHasMore(state.hasMore);
      } catch (err) {
        console.error('Failed to restore Rumble state:', err);
      }
    }
  }, []);

  // Save state to sessionStorage when it changes
  useEffect(() => {
    if (videos.length > 0) {
      const state = { videos, inputUrl, currentUrl, hasMore };
      sessionStorage.setItem('rumble-page-state', JSON.stringify(state));
    }
  }, [videos, inputUrl, currentUrl, hasMore]);

  const handleBrowse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setVideos([]);
    setHasMore(false);
    setCurrentUrl(inputUrl);

    try {
      const res = await fetch(
        `http://localhost:3001/api/v1/search/extract?url=${encodeURIComponent(inputUrl)}&limit=50`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        const fetchedVideos = data.videos || [];
        setVideos(fetchedVideos);
        setHasMore(fetchedVideos.length === 50);
      } else {
        alert('Failed to load Rumble content');
      }
    } catch (err) {
      console.error('Browse error:', err);
      alert('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      const currentOffset = videos.length;
      const res = await fetch(
        `http://localhost:3001/api/v1/search/extract?url=${encodeURIComponent(currentUrl)}&limit=50&offset=${currentOffset}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        const newVideos = data.videos || [];
        setVideos(prev => [...prev, ...newVideos]);
        setHasMore(newVideos.length === 50);
      }
    } catch (err) {
      console.error('Load more error:', err);
      alert('Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDownload = (video: Video) => {
    setSelectedVideo(video);
    setShowDownloadModal(true);
  };

  const confirmDownload = async () => {
    if (!selectedVideo) return;

    setDownloading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: selectedVideo.url,
          downloader: 'yt-dlp',
          category,
          customFolder: category === 'custom' ? customFolder : undefined
        })
      });

      if (res.ok) {
        alert(`Download queued: ${selectedVideo.title}\n\nThe download will start automatically.`);
        setShowDownloadModal(false);
        setSelectedVideo(null);
        setCategory('movies');
        setCustomFolder('');
      } else {
        const error = await res.json();
        alert(`Failed to queue download: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to queue download');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Rumble Browse</h1>
        <p className="text-gray-400">Browse Rumble channels and videos</p>
      </div>

      {/* Temporary notice about Rumble access issues */}
      <div className="card mb-6 bg-orange-50 border-orange-200">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <h3 className="font-semibold text-orange-900 mb-1">Rumble Access Temporarily Limited</h3>
            <p className="text-sm text-orange-800">
              Rumble has implemented enhanced anti-bot protection that is currently blocking automated access.
              Channel browsing may not work until yt-dlp is updated to support the new protection.
              Individual video downloads may still work if you have the direct video URL.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleBrowse} className="card mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Channel URL
          </label>
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://rumble.com/c/channelname"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Browse'}
        </button>
      </form>

      {/* Loading Skeleton */}
      {loading && (
        <div className="card">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            {videos.length} video{videos.length !== 1 ? 's' : ''}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video, index) => (
              <div key={`${video.id}-${index}`} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-video bg-gray-200">
                  {video.thumbnail && (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">
                    {video.title}
                  </h3>

                  <p className="text-xs text-gray-600 mb-2">
                    {video.uploader}
                  </p>

                  <button
                    onClick={() => handleDownload(video)}
                    className="w-full px-3 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading More...' : 'Load More Videos'}
              </button>
            </div>
          )}

          {!hasMore && videos.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-400">
              All videos loaded ({videos.length} total)
            </div>
          )}
        </div>
      )}

      {showDownloadModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Download Settings</h3>

            <p className="text-sm text-gray-700 mb-4">
              <strong>{selectedVideo.title}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
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
                onClick={confirmDownload}
                disabled={downloading || (category === 'custom' && !customFolder)}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {downloading ? 'Adding...' : 'Download'}
              </button>
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedVideo(null);
                  setCategory('movies');
                  setCustomFolder('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
