import { useState, useEffect } from 'react';
import { TrackCardSkeleton } from '../components/VideoCardSkeleton';
import { API_BASE } from '@/lib/config';

interface Track {
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

interface ArtistInfo {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  followerCount: number;
  trackCount: number;
  url: string;
}

interface Preset {
  id: string;
  name: string;
  category: string;
  custom_folder?: string;
  platform?: string;
}

export function SoundCloud() {
  const [inputUrl, setInputUrl] = useState('');
  const [type, setType] = useState<'user' | 'playlist' | 'search'>('user');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentType, setCurrentType] = useState<'user' | 'playlist' | 'search'>('user');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [category, setCategory] = useState('music');
  const [customFolder, setCustomFolder] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [loadingTrackCount, setLoadingTrackCount] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [showLoadAllConfirm, setShowLoadAllConfirm] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState(0);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('soundcloud-page-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.inputUrl) setInputUrl(state.inputUrl);
        if (state.type) setType(state.type);
        if (state.tracks) setTracks(state.tracks);
        if (state.artistInfo) setArtistInfo(state.artistInfo);
        if (state.hasMore !== undefined) setHasMore(state.hasMore);
        if (state.currentUrl) setCurrentUrl(state.currentUrl);
        if (state.currentType) setCurrentType(state.currentType);
        if (state.isBookmarked !== undefined) setIsBookmarked(state.isBookmarked);
      } catch (err) {
        console.error('Failed to restore SoundCloud state:', err);
      }
    }
  }, []);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    if (tracks.length > 0 || artistInfo) {
      const state = {
        inputUrl,
        type,
        tracks,
        artistInfo,
        hasMore,
        currentUrl,
        currentType,
        isBookmarked
      };
      sessionStorage.setItem('soundcloud-page-state', JSON.stringify(state));
    }
  }, [inputUrl, type, tracks, artistInfo, hasMore, currentUrl, currentType, isBookmarked]);

  // Auto-browse when URL parameter is present (from Favorites page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('url');
    // Only auto-load if it's a SoundCloud URL
    if (urlParam && !autoTriggered && urlParam.includes('soundcloud.com')) {
      setInputUrl(urlParam);
      const isPlaylist = urlParam.includes('/sets/');
      setType(isPlaylist ? 'playlist' : 'user');
      setAutoTriggered(true);
    }
  }, [autoTriggered]);

  // Trigger browse after state is set
  useEffect(() => {
    if (autoTriggered && inputUrl) {
      handleBrowse({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [autoTriggered, inputUrl]);

  // Fetch presets when download modal opens
  useEffect(() => {
    if (showDownloadModal) {
      fetchPresets();
    }
  }, [showDownloadModal]);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${API_BASE}/presets?platform=soundcloud`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets || []);
      }
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId) {
      const preset = presets.find(p => p.id === presetId);
      if (preset) {
        setCategory(preset.category);
        if (preset.custom_folder) {
          setCustomFolder(preset.custom_folder);
        }
      }
    }
  };

  const checkBookmark = async (url: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/bookmarks/check/${encodeURIComponent(url)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.isBookmarked);
      }
    } catch (err) {
      console.error('Failed to check bookmark:', err);
    }
  };

  const handleBrowse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setTracks([]);
    setArtistInfo(null);
    setHasMore(false);

    // Convert artist name to search query
    let searchQuery = inputUrl.trim();

    // If it's a soundcloud URL, extract artist name
    if (searchQuery.includes('soundcloud.com/')) {
      const parts = searchQuery.split('/');
      const scIndex = parts.findIndex(p => p === 'soundcloud.com');
      if (scIndex >= 0 && parts[scIndex + 1]) {
        searchQuery = parts[scIndex + 1].replace(/-/g, ' ').replace(/\//g, ' ').trim();
      }
    }

    setCurrentUrl(searchQuery);  // Store the search query
    setCurrentType('user');

    try {
      // Search for tracks (100 to match YouTube initial load)
      const res = await fetch(
        `${API_BASE}/search/unified?q=${encodeURIComponent(searchQuery)}&sources=soundcloud&limit=100`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        const fetchedTracks = (data.results || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description || '',
          thumbnail: r.thumbnail || '',
          url: r.url,
          duration: r.duration,
          uploader: r.uploader,
          uploadDate: r.uploadDate,
          viewCount: r.viewCount
        }));
        setTracks(fetchedTracks);
        setHasMore(fetchedTracks.length >= 90);  // Show Load All button

        // Build artist profile from first track
        if (fetchedTracks.length > 0) {
          const firstTrack = fetchedTracks[0];

          // Extract ACTUAL artist URL from track URL (don't construct it)
          // Track URLs are like: https://api.soundcloud.com/tracks/123 or https://soundcloud.com/artist/track
          let artistUrl = null;

          // Try to extract from track URL
          if (firstTrack.url && firstTrack.url.includes('soundcloud.com/')) {
            const parts = firstTrack.url.split('/');
            const scIndex = parts.findIndex(p => p === 'soundcloud.com');
            if (scIndex >= 0 && parts[scIndex + 1]) {
              artistUrl = `https://soundcloud.com/${parts[scIndex + 1]}`;
            }
          }

          // Fallback: construct from uploader name (might not work)
          if (!artistUrl) {
            artistUrl = `https://soundcloud.com/${(firstTrack.uploader || searchQuery).toLowerCase().replace(/\s+/g, '-')}`;
          }

          const highQualityThumbnail = (firstTrack.thumbnail || '')
            .replace(/-large\.jpg/g, '-t500x500.jpg')
            .replace(/-t67x67\.jpg/g, '-t500x500.jpg')
            .replace(/-t120x120\.jpg/g, '-t500x500.jpg')
            .replace(/-small\.jpg/g, '-t500x500.jpg')
            .replace(/-crop\.jpg/g, '-t500x500.jpg')
            .replace(/-mini\.jpg/g, '-t500x500.jpg');

          const info = {
            id: firstTrack.id,
            name: firstTrack.uploader || searchQuery,
            description: '',
            thumbnail: highQualityThumbnail,
            followerCount: 0,
            trackCount: fetchedTracks.length,
            url: artistUrl
          };
          setArtistInfo(info);
          checkBookmark(artistUrl);
        }
      } else {
        alert('Failed to search SoundCloud');
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
      const isSearch = !currentUrl.startsWith('http');
      const currentOffset = tracks.length;

      if (isSearch) {
        const res = await fetch(
          `${API_BASE}/search/unified?q=${encodeURIComponent(currentUrl)}&sources=soundcloud&limit=50&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          const newTracks = (data.results || []).map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description || '',
            thumbnail: r.thumbnail || '',
            url: r.url,
            duration: r.duration,
            uploader: r.uploader,
            uploadDate: r.uploadDate,
            viewCount: r.viewCount
          }));
          setTracks(prev => [...prev, ...newTracks]);
          setHasMore(newTracks.length === 50);
        }
      } else {
        const res = await fetch(
          `${API_BASE}/search/extract?url=${encodeURIComponent(currentUrl)}&limit=50&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          const newTracks = (data.videos || []).map((v: any) => ({
            id: v.id,
            title: v.title,
            description: v.description || '',
            thumbnail: v.thumbnail || '',
            url: v.url,
            duration: v.duration,
            uploader: v.uploader,
            uploadDate: v.uploadDate,
            viewCount: v.viewCount
          }));
          setTracks(prev => [...prev, ...newTracks]);
          setHasMore(newTracks.length === 50);
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
      alert('Failed to load more tracks');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleBookmark = async () => {
    if (!artistInfo) return;
    setBookmarking(true);

    try {
      if (isBookmarked) {
        // Remove bookmark
        console.log('[Bookmark] Removing bookmark for URL:', artistInfo.url);
        const res = await fetch(
          `${API_BASE}/bookmarks?url=${encodeURIComponent(artistInfo.url)}`,
          {
            method: 'DELETE',
            credentials: 'include'
          }
        );

        console.log('[Bookmark] Delete response status:', res.status);
        if (res.ok) {
          console.log('[Bookmark] Bookmark removed successfully');
          setIsBookmarked(false);
        } else {
          const error = await res.json();
          console.error('[Bookmark] Failed to remove:', error);
          alert(`Failed to remove bookmark: ${error.error || 'Unknown error'}`);
        }
      } else {
        // Add bookmark
        const res = await fetch(`${API_BASE}/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            url: artistInfo.url,
            type: 'soundcloud_user',
            title: artistInfo.name,
            description: artistInfo.description,
            thumbnail: artistInfo.thumbnail,
            channel_name: artistInfo.name,
            subscriber_count: artistInfo.followerCount,
            video_count: artistInfo.trackCount
          })
        });

        if (res.ok) {
          setIsBookmarked(true);
        } else {
          const error = await res.json();
          alert(`Failed to bookmark: ${error.error}`);
        }
      }
    } catch (err) {
      alert('Failed to update bookmark');
    } finally {
      setBookmarking(false);
    }
  };

  const handleLoadAllClick = () => {
    // Check if we have artist info with track count estimate
    const trackCount = artistInfo?.trackCount || 0;

    if (trackCount > 500) {
      setShowLoadAllConfirm(true);
    } else {
      loadAll();
    }
  };

  const loadAll = async () => {
    setShowLoadAllConfirm(false);
    setLoadingAll(true);
    setLoadAllProgress(50);

    try {
      // SoundCloud search returns tracks from MULTIPLE uploaders (unlike YouTube)
      // So just search with maximum limit to get as many results as possible
      console.log(`[Load All] Searching for all tracks matching: ${currentUrl}`);
      const res = await fetch(
        `${API_BASE}/search/unified?q=${encodeURIComponent(currentUrl)}&sources=soundcloud&limit=500`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        const allTracks = (data.results || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description || '',
          thumbnail: r.thumbnail || '',
          url: r.url,
          duration: r.duration,
          uploader: r.uploader,
          uploadDate: r.uploadDate,
          viewCount: r.viewCount
        }));

        console.log(`[Load All] Got ${allTracks.length} total tracks from search`);
        setTracks(allTracks);
        setLoadAllProgress(100);

        // Update artist info with count
        if (artistInfo) {
          setArtistInfo({ ...artistInfo, trackCount: allTracks.length });

          // Update bookmark
          if (isBookmarked && artistInfo.url) {
            try {
              const bookmarkRes = await fetch(
                `${API_BASE}/bookmarks/check/${encodeURIComponent(artistInfo.url)}`,
                { credentials: 'include' }
              );
              if (bookmarkRes.ok) {
                const bookmarkData = await bookmarkRes.json();
                if (bookmarkData.isBookmarked && bookmarkData.bookmark) {
                  await fetch(
                    `${API_BASE}/bookmarks/${bookmarkData.bookmark.id}`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ video_count: allTracks.length })
                    }
                  );
                }
              }
            } catch (err) {
              console.error('Failed to update bookmark:', err);
            }
          }
        }
      }

      setHasMore(false);
    } catch (err) {
      console.error('Load all error:', err);
      alert('Failed to load all tracks');
    } finally {
      setLoadingAll(false);
      setLoadAllProgress(0);
    }
  };

  const handleDownload = (track: Track) => {
    setSelectedTrack(track);
    setShowDownloadModal(true);
  };

  const confirmDownload = async () => {
    if (!selectedTrack) return;

    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: selectedTrack.url,
          downloader: 'yt-dlp',
          category,
          customFolder: category === 'custom' ? customFolder : undefined
        })
      });

      if (res.ok) {
        alert(`Download queued: ${selectedTrack.title}\n\nThe download will start automatically.`);
        setShowDownloadModal(false);
        setSelectedTrack(null);
        setCategory('music');
        setCustomFolder('');
        setSelectedPreset('');
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

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const selectAllTracks = () => {
    setSelectedTracks(new Set(tracks.map(t => t.id)));
  };

  const deselectAllTracks = () => {
    setSelectedTracks(new Set());
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

  const formatCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SoundCloud Browse</h1>
        <p className="text-gray-600">Browse artists, playlists, or search for tracks - with artist profiles!</p>
      </div>

      <form onSubmit={handleBrowse} className="card mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Artist URL or Search Query
          </label>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://soundcloud.com/artist-name or search keywords..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            required
          />
          <p className="mt-2 text-sm text-gray-500">
            Enter a SoundCloud user URL, playlist URL, or search keywords to find tracks.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Browse'}
        </button>
      </form>

      {/* Artist Info */}
      {!loading && artistInfo && (
        <div className="card mb-6">
          <div className="flex gap-6 items-start">
            {/* Artist Avatar */}
            <div className="flex-shrink-0">
              {artistInfo.thumbnail ? (
                <img
                  src={artistInfo.thumbnail}
                  alt={artistInfo.name}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Artist Details */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{artistInfo.name}</h2>

              <div className="flex gap-4 text-sm text-gray-600 mb-4">
                {artistInfo.followerCount > 0 && (
                  <span>{formatCount(artistInfo.followerCount)} followers</span>
                )}
                {tracks.length > 0 && (
                  <span>{formatCount(tracks.length)} tracks{hasMore ? '+' : ''}</span>
                )}
              </div>

              {artistInfo.description && (
                <p className="text-gray-700 mb-4 line-clamp-3">{artistInfo.description}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={toggleBookmark}
                  disabled={bookmarking}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isBookmarked
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {isBookmarked ? (
                    <>
                      <svg className="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Remove from Favorites
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Add to Favorites
                    </>
                  )}
                </button>

                {hasMore && !loadingAll && (
                  <button
                    onClick={handleLoadAllClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
                  >
                    Load All Tracks
                  </button>
                )}

                {loadingAll && (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-600">Loading all... {loadAllProgress}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="card">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <TrackCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Tracks Grid */}
      {!loading && tracks.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tracks.map((track, index) => (
              <div key={`${track.id}-${index}`} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* Thumbnail */}
                <div className="relative aspect-square bg-gray-200">
                  {track.thumbnail && track.thumbnail.startsWith('http') ? (
                    <img
                      src={(() => {
                        const original = track.thumbnail;
                        const replaced = original
                          .replace(/-large\.jpg/g, '-t500x500.jpg')
                          .replace(/-t67x67\.jpg/g, '-t500x500.jpg')
                          .replace(/-t120x120\.jpg/g, '-t500x500.jpg')
                          .replace(/-small\.jpg/g, '-t500x500.jpg')
                          .replace(/-crop\.jpg/g, '-t500x500.jpg')
                          .replace(/-mini\.jpg/g, '-t500x500.jpg');
                        if (index === 0) {
                          console.log('[SoundCloud Thumbnail] Original:', original);
                          console.log('[SoundCloud Thumbnail] Replaced:', replaced);
                        }
                        return replaced;
                      })()}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.log('[SoundCloud] Failed to load thumbnail:', track.thumbnail);
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600">
                      <svg className="w-16 h-16 text-white opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  {track.duration && track.duration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(track.duration)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 min-h-[3rem] mb-2">
                    {track.title}
                  </h3>

                  <p className="text-xs text-gray-600 mb-2">
                    {track.uploader}
                  </p>

                  {track.viewCount && track.viewCount > 0 && (
                    <p className="text-xs text-gray-500 mb-2">
                      {formatCount(track.viewCount)} plays
                    </p>
                  )}

                  <button
                    onClick={() => handleDownload(track)}
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
                {loadingMore ? 'Loading More...' : 'Load More Tracks'}
              </button>
            </div>
          )}

          {!hasMore && tracks.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              All tracks loaded ({tracks.length} total)
            </div>
          )}
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && selectedTrack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Download Settings</h3>

            <p className="text-sm text-gray-700 mb-4">
              <strong>{selectedTrack.title}</strong>
            </p>

            {presets.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Use Preset (Optional)
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Manual Settings</option>
                  {presets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                      {preset.platform === 'soundcloud' ? ' (SoundCloud)' : preset.platform ? ` (${preset.platform})` : ' (Global)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="music">Music</option>
                <option value="movies">Movies</option>
                <option value="tv">TV Shows</option>
                <option value="documentaries">Documentaries</option>
                <option value="custom">Custom Folder...</option>
                <option value="collection">Collection (No folder)</option>
              </select>
            </div>

            {category === 'custom' && (
              <div className="mb-4">
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
                onClick={confirmDownload}
                disabled={downloading || (category === 'custom' && !customFolder)}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {downloading ? 'Adding...' : 'Download'}
              </button>
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedTrack(null);
                  setCategory('music');
                  setCustomFolder('');
                  setSelectedPreset('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load All Confirmation Modal */}
      {showLoadAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Load All Tracks?</h3>
            <p className="text-gray-600 mb-6">
              This artist has over 500 tracks. Loading all tracks may take a while and use significant resources. Do you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={loadAll}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                Yes, Load All
              </button>
              <button
                onClick={() => setShowLoadAllConfirm(false)}
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
