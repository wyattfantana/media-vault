import { useState, useEffect } from 'react';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { DownloadFormatPreview } from '../components/DownloadFormatPreview';

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

interface ChannelInfo {
  id: string;
  name: string;
  channelName?: string; // For playlists: the channel that owns the playlist
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  url: string;
}

interface Preset {
  id: string;
  name: string;
  category: string;
  custom_folder?: string;
  platform?: string;
}

export function YouTube() {
  const [inputUrl, setInputUrl] = useState('');
  const [type, setType] = useState<'channel' | 'playlist'>('channel');
  const [searchMode, setSearchMode] = useState<'url' | 'search'>('url');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentType, setCurrentType] = useState<'channel' | 'playlist'>('channel');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [category, setCategory] = useState('movies');
  const [customFolder, setCustomFolder] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState(0);
  const [showLoadAllConfirm, setShowLoadAllConfirm] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [loadingVideoCount, setLoadingVideoCount] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showFormatPreview, setShowFormatPreview] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('youtube-page-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.channelInfo) setChannelInfo(state.channelInfo);
        if (state.videos) setVideos(state.videos);
        if (state.currentUrl) {
          setCurrentUrl(state.currentUrl);
          // Re-check bookmark status after restoration
          checkBookmark(state.currentUrl);
        }
        if (state.currentType) setCurrentType(state.currentType);
        if (state.inputUrl) setInputUrl(state.inputUrl);
        if (state.type) setType(state.type);
        if (state.hasMore !== undefined) setHasMore(state.hasMore);
      } catch (err) {
        console.error('Failed to restore YouTube state:', err);
      }
    }
  }, []);

  // Save state to sessionStorage when it changes
  // NOTE: isBookmarked is NOT saved - it should always be checked fresh from the API
  useEffect(() => {
    if (channelInfo || videos.length > 0) {
      const state = {
        channelInfo,
        videos,
        currentUrl,
        currentType,
        inputUrl,
        type,
        hasMore
      };
      sessionStorage.setItem('youtube-page-state', JSON.stringify(state));
    }
  }, [channelInfo, videos, currentUrl, currentType, inputUrl, type, hasMore]);

  // Auto-browse when URL parameter is present (from Favorites page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('url');
    // Only auto-load if it's a YouTube URL
    if (urlParam && !autoTriggered && (urlParam.includes('youtube.com') || urlParam.includes('youtu.be'))) {
      setInputUrl(urlParam);
      // Determine if it's a channel or playlist
      const isPlaylist = urlParam.includes('/playlist');
      setType(isPlaylist ? 'playlist' : 'channel');
      setAutoTriggered(true);
    }
  }, [autoTriggered]);

  // Re-check bookmark status when page becomes visible (e.g., returning from Favorites tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUrl && channelInfo) {
        checkBookmark(currentUrl);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUrl, channelInfo]);

  // Fetch presets when download modal opens
  useEffect(() => {
    if (showDownloadModal) {
      fetchPresets();
    }
  }, [showDownloadModal]);

  const fetchPresets = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/presets?platform=youtube', {
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

  // Trigger browse after state is set
  useEffect(() => {
    if (autoTriggered && inputUrl) {
      // Create a synthetic form submit
      handleBrowse({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [autoTriggered, inputUrl]);

  const checkBookmark = async (url: string) => {
    try {
      console.log('[Bookmark Check] Checking URL:', url);
      const res = await fetch(`http://localhost:3001/api/v1/bookmarks/check/${encodeURIComponent(url)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[Bookmark Check] Result:', data.isBookmarked, 'Saved URL:', data.bookmark?.url);
        setIsBookmarked(data.isBookmarked);
      }
    } catch (err) {
      console.error('Failed to check bookmark:', err);
    }
  };

  const handleBookmark = async () => {
    if (!channelInfo) return;
    setBookmarking(true);

    try {
      if (isBookmarked) {
        // Remove bookmark
        await fetch(`http://localhost:3001/api/v1/bookmarks/by-url/${encodeURIComponent(currentUrl)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        setIsBookmarked(false);
      } else {
        // Prefer video thumbnail over channel thumbnail (more reliable)
        let thumbnail = '';
        if (videos.length > 0 && videos[0].thumbnail) {
          thumbnail = videos[0].thumbnail;
        } else if (channelInfo.thumbnail?.trim()) {
          thumbnail = channelInfo.thumbnail;
        }

        // Use the higher of: background-fetched count OR loaded videos count
        // This gives us the accurate total if available, or loaded count as minimum
        const videoCount = Math.max(channelInfo.videoCount || 0, videos.length);

        console.log('[Bookmark Save] Saving bookmark with URL:', currentUrl);
        await fetch('http://localhost:3001/api/v1/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            url: currentUrl,
            type: currentType === 'channel' ? 'youtube_channel' : 'youtube_playlist',
            title: channelInfo.name,
            description: channelInfo.description,
            thumbnail: thumbnail,
            channel_name: channelInfo.channelName,
            subscriber_count: channelInfo.subscriberCount,
            video_count: videoCount
          })
        });
        console.log('[Bookmark Save] Bookmark saved successfully');
        setIsBookmarked(true);
      }
    } catch (err) {
      alert('Failed to update bookmark');
    } finally {
      setBookmarking(false);
    }
  };

  const handleBrowse = async (e: React.FormEvent) => {
    e.preventDefault();

    // Handle search mode
    if (searchMode === 'search') {
      if (!searchQuery.trim()) return;

      setLoading(true);
      setChannelInfo(null);
      setVideos([]);
      setHasMore(false);

      try {
        const res = await fetch(
          `http://localhost:3001/api/v1/search/youtube?q=${encodeURIComponent(searchQuery)}&limit=50`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          setVideos(data.results || []);
          setHasMore(false); // Search results don't support pagination
        } else {
          alert('Search failed');
        }
      } catch (err) {
        console.error('Search error:', err);
        alert('Search failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Handle URL mode (existing logic)
    if (!inputUrl.trim()) return;

    setLoading(true);
    setChannelInfo(null);
    setVideos([]);
    setHasMore(false);

    // Clean channel URL (without /videos or trailing slash) for channel info
    let cleanUrl = inputUrl.trim().replace(/\/videos$/, '').replace(/\/$/, '');

    // Videos URL includes /videos tab for consistent playlist results
    let videosUrl = cleanUrl;
    if (type === 'channel' && !videosUrl.includes('/playlist')) {
      videosUrl = cleanUrl + '/videos';
    }

    setCurrentUrl(videosUrl);
    setCurrentType(type);

    try {
      if (type === 'channel') {
        // Get channel videos first (this is more reliable)
        const videosRes = await fetch(
          `http://localhost:3001/api/v1/search/youtube/channel/videos?url=${encodeURIComponent(videosUrl)}&limit=100`,
          { credentials: 'include' }
        );

        let fetchedVideos: Video[] = [];
        if (videosRes.ok) {
          const data = await videosRes.json();
          fetchedVideos = data.videos || [];
          setVideos(fetchedVideos);
          setHasMore(fetchedVideos.length >= 90);
        }

        // Try to get channel info (may fail due to YouTube blocking)
        let channelInfoFetched = false;
        try {
          const infoRes = await fetch(
            `http://localhost:3001/api/v1/search/youtube/channel?url=${encodeURIComponent(cleanUrl)}`,
            { credentials: 'include' }
          );

          if (infoRes.ok) {
            const info = await infoRes.json();

            // Set loading state BEFORE setting channel info to prevent race condition
            // This ensures the bookmark button is disabled while counting
            setLoadingVideoCount(true);
            setChannelInfo(info);
            checkBookmark(videosUrl);
            channelInfoFetched = true;

            // Fetch video count in background (don't await)
            fetch(
              `http://localhost:3001/api/v1/search/youtube/channel/count?url=${encodeURIComponent(cleanUrl)}`,
              { credentials: 'include' }
            )
              .then(res => res.json())
              .then(async (data) => {
                const newCount = data.videoCount;
                setChannelInfo(prev => prev ? { ...prev, videoCount: newCount } : null);

                // If this channel is bookmarked, update the bookmark's video count
                try {
                  const bookmarkCheckRes = await fetch(
                    `http://localhost:3001/api/v1/bookmarks/check/${encodeURIComponent(videosUrl)}`,
                    { credentials: 'include' }
                  );
                  if (bookmarkCheckRes.ok) {
                    const bookmarkData = await bookmarkCheckRes.json();
                    if (bookmarkData.isBookmarked && bookmarkData.bookmark) {
                      // Update the bookmark with the accurate video count
                      await fetch(
                        `http://localhost:3001/api/v1/bookmarks/${bookmarkData.bookmark.id}`,
                        {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ video_count: newCount })
                        }
                      );
                      console.log('[Video Count] Updated bookmark with accurate count:', newCount);
                    }
                  }
                } catch (err) {
                  console.error('[Video Count] Failed to update bookmark:', err);
                }
              })
              .catch(() => {}) // Silently fail - not critical
              .finally(() => setLoadingVideoCount(false));
          }
        } catch (err) {
          // Silently catch - will use fallback below
        }

        if (!channelInfoFetched) {
          // Fallback: Create basic channel info from videos or URL
          if (fetchedVideos.length > 0) {
            const firstVideo = fetchedVideos[0];

            // Try to extract channel name from URL
            let channelName = 'Unknown Channel';
            if (cleanUrl.includes('/@')) {
              // Format: https://www.youtube.com/@ChannelName
              const match = cleanUrl.match(/@([^/?]+)/);
              if (match) channelName = match[1];
            } else if (cleanUrl.includes('/channel/')) {
              // Format: https://www.youtube.com/channel/ID
              const match = cleanUrl.match(/\/channel\/([^/?]+)/);
              if (match) channelName = match[1];
            } else if (cleanUrl.includes('/c/')) {
              // Format: https://www.youtube.com/c/ChannelName
              const match = cleanUrl.match(/\/c\/([^/?]+)/);
              if (match) channelName = match[1];
            }

            // Try uploader from video as backup
            if (channelName === 'Unknown Channel' && firstVideo.uploader) {
              channelName = firstVideo.uploader;
            }

            const fallbackInfo: ChannelInfo = {
              id: cleanUrl,
              name: channelName,
              description: '',
              thumbnail: firstVideo.thumbnail || '',
              subscriberCount: 0,
              videoCount: fetchedVideos.length,
              url: cleanUrl
            };

            // Set loading state BEFORE setting channel info to prevent race condition
            setLoadingVideoCount(true);
            setChannelInfo(fallbackInfo);
            checkBookmark(videosUrl);

            // Fetch accurate video count in background (same as non-fallback)
            fetch(
              `http://localhost:3001/api/v1/search/youtube/channel/count?url=${encodeURIComponent(cleanUrl)}`,
              { credentials: 'include' }
            )
              .then(res => res.json())
              .then(async (data) => {
                const newCount = data.videoCount;
                setChannelInfo(prev => prev ? { ...prev, videoCount: newCount } : null);

                // If this channel is bookmarked, update the bookmark's video count
                try {
                  const bookmarkCheckRes = await fetch(
                    `http://localhost:3001/api/v1/bookmarks/check/${encodeURIComponent(videosUrl)}`,
                    { credentials: 'include' }
                  );
                  if (bookmarkCheckRes.ok) {
                    const bookmarkData = await bookmarkCheckRes.json();
                    if (bookmarkData.isBookmarked && bookmarkData.bookmark) {
                      await fetch(
                        `http://localhost:3001/api/v1/bookmarks/${bookmarkData.bookmark.id}`,
                        {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ video_count: newCount })
                        }
                      );
                      console.log('[Video Count] Updated bookmark with accurate count:', newCount);
                    }
                  }
                } catch (err) {
                  console.error('[Video Count] Failed to update bookmark:', err);
                }
              })
              .catch(() => {}) // Silently fail - not critical
              .finally(() => setLoadingVideoCount(false));
          }
        }
      } else {
        // Get playlist info first
        const infoRes = await fetch(
          `http://localhost:3001/api/v1/search/youtube/playlist/info?url=${encodeURIComponent(cleanUrl)}`,
          { credentials: 'include' }
        );

        if (infoRes.ok) {
          const info = await infoRes.json();
          setChannelInfo(info);
          checkBookmark(cleanUrl);
        }

        // Get playlist videos (use clean URL for playlists)
        const res = await fetch(
          `http://localhost:3001/api/v1/search/youtube/playlist?url=${encodeURIComponent(cleanUrl)}&limit=100`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          const fetchedVideos = data.videos || [];
          setVideos(fetchedVideos);
          setHasMore(fetchedVideos.length >= 90);
        }
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

      if (currentType === 'channel') {
        const res = await fetch(
          `http://localhost:3001/api/v1/search/youtube/channel/videos?url=${encodeURIComponent(currentUrl)}&limit=100&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          const newVideos = data.videos || [];
          setVideos(prev => [...prev, ...newVideos]);
          setHasMore(newVideos.length >= 90);
        }
      } else {
        const res = await fetch(
          `http://localhost:3001/api/v1/search/youtube/playlist?url=${encodeURIComponent(currentUrl)}&limit=100&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          const newVideos = data.videos || [];
          setVideos(prev => [...prev, ...newVideos]);
          setHasMore(newVideos.length >= 90);
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
      alert('Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLoadAllClick = () => {
    // Check if we have channel info with video count
    const videoCount = channelInfo?.videoCount || 0;

    if (videoCount > 500) {
      setShowLoadAllConfirm(true);
    } else {
      loadAll();
    }
  };

  const loadAll = async () => {
    setShowLoadAllConfirm(false);
    setLoadingAll(true);
    setLoadAllProgress(0);

    try {
      let currentOffset = videos.length;
      let allVideos = [...videos];
      const batchSize = 100;
      const estimatedTotal = channelInfo?.videoCount || 5000; // Fallback to 5000 if unknown

      while (true) {
        const endpoint = currentType === 'channel'
          ? `/api/v1/search/youtube/channel/videos`
          : `/api/v1/search/youtube/playlist`;

        const res = await fetch(
          `http://localhost:3001${endpoint}?url=${encodeURIComponent(currentUrl)}&limit=${batchSize}&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (!res.ok) break;

        const data = await res.json();
        const newVideos = data.videos || [];

        if (newVideos.length === 0) break;

        allVideos = [...allVideos, ...newVideos];
        setVideos(allVideos);
        currentOffset += newVideos.length;

        // Update progress
        const progress = Math.min(100, Math.round((allVideos.length / estimatedTotal) * 100));
        setLoadAllProgress(progress);

        // If we got less than 90 videos, we're at the end
        if (newVideos.length < 90) break;
      }

      setHasMore(false);
    } catch (err) {
      console.error('Load all error:', err);
      alert('Failed to load all videos');
    } finally {
      setLoadingAll(false);
      setLoadAllProgress(0);
    }
  };

  const toggleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideos(newSelection);
  };

  const downloadSelected = async () => {
    if (selectedVideos.size === 0) return;

    setBulkDownloading(true);
    let successCount = 0;
    let failCount = 0;

    const selectedVideosList = videos.filter(v => selectedVideos.has(v.id));

    for (const video of selectedVideosList) {
      try {
        const res = await fetch('http://localhost:3001/api/v1/downloads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            url: video.url,
            downloader: 'yt-dlp',
            category,
            customFolder: category === 'custom' ? customFolder : undefined
          })
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setBulkDownloading(false);
    setSelectedVideos(new Set());

    alert(`Bulk download complete!\n\nQueued: ${successCount}\nFailed: ${failCount}\n\nDownloads will start automatically.`);
  };

  const handleDownload = (video: Video) => {
    setSelectedVideo(video);
    setShowDownloadModal(true);
  };

  const confirmDownload = () => {
    if (!selectedVideo) return;
    // Show format preview instead of directly downloading
    setShowDownloadModal(false);
    setShowFormatPreview(true);
  };

  const handleFormatPreviewConfirm = async (formattedPath: any) => {
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
        setShowFormatPreview(false);
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

  const handleFormatPreviewCancel = () => {
    setShowFormatPreview(false);
    setShowDownloadModal(true);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    // yt-dlp returns dates in format YYYYMMDD
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);

      // Format as "Jan 15, 2024" or "2 days ago" for recent dates
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return dateString;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">YouTube</h1>
        <p className="text-gray-600">Search videos or browse channels and playlists</p>
      </div>

      {/* Browse/Search Form */}
      <form onSubmit={handleBrowse} className="card mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mode
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="url"
                checked={searchMode === 'url'}
                onChange={(e) => setSearchMode(e.target.value as 'url' | 'search')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">Browse by URL</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="search"
                checked={searchMode === 'search'}
                onChange={(e) => setSearchMode(e.target.value as 'url' | 'search')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">Search Videos</span>
            </label>
          </div>
        </div>

        {searchMode === 'url' ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="channel"
                    checked={type === 'channel'}
                    onChange={(e) => setType(e.target.value as 'channel' | 'playlist')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm">Channel</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="playlist"
                    checked={type === 'playlist'}
                    onChange={(e) => setType(e.target.value as 'channel' | 'playlist')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm">Playlist</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {type === 'channel' ? 'Channel URL' : 'Playlist URL'}
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={
                  type === 'channel'
                    ? 'https://www.youtube.com/@channelname or https://www.youtube.com/c/channelname'
                    : 'https://www.youtube.com/playlist?list=...'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                required
              />
            </div>
          </>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Query
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter keywords to search YouTube..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Search for videos across all of YouTube (up to 50 results)
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : searchMode === 'search' ? 'Search' : 'Browse'}
        </button>
      </form>

      {/* Channel/Playlist Info */}
      {channelInfo && (
        <div className="card mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{channelInfo.name}</h2>
              <div className="flex gap-4 text-sm text-gray-600">
                {channelInfo.channelName && (
                  <span>by {channelInfo.channelName}</span>
                )}
                {channelInfo.subscriberCount > 0 && (
                  <span>{formatCount(channelInfo.subscriberCount)} subscribers</span>
                )}
                {loadingVideoCount ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">counting videos...</span>
                  </span>
                ) : channelInfo.videoCount > 0 ? (
                  <span>{formatCount(channelInfo.videoCount)} videos</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleBookmark}
              disabled={bookmarking || (loadingVideoCount && !isBookmarked)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isBookmarked
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                loadingVideoCount && !isBookmarked
                  ? 'Counting videos... bookmark available when complete'
                  : isBookmarked
                  ? 'Remove from Favorites'
                  : 'Add to Favorites'
              }
            >
              <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {loadingVideoCount && !isBookmarked
                ? 'Counting videos...'
                : isBookmarked
                ? 'Remove from Favorites'
                : 'Add to Favorites'
              }
            </button>
          </div>
        </div>
      )}

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

      {/* Videos Grid */}
      {!loading && videos.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {videos.length} video{videos.length !== 1 ? 's' : ''}
              {selectedVideos.size > 0 && (
                <span className="ml-3 text-sm text-brand-600">
                  ({selectedVideos.size} selected)
                </span>
              )}
            </h2>

            <div className="flex gap-3">
              <button
                onClick={toggleSelectAll}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {selectedVideos.size === videos.length ? 'Deselect All' : 'Select All'}
              </button>

              {selectedVideos.size > 0 && (
                <button
                  onClick={downloadSelected}
                  disabled={bulkDownloading}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {bulkDownloading ? 'Downloading...' : `Download Selected (${selectedVideos.size})`}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video, index) => (
              <div key={`${video.id}-${index}`} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative">
                {/* Selection Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.id)}
                    onChange={() => toggleVideoSelection(video.id)}
                    className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </div>

                {/* Thumbnail */}
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

                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] mb-1">
                    {video.title}
                  </h3>

                  <p className="text-xs text-gray-600 mb-1">
                    {video.uploader}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    {video.viewCount && (
                      <span>{formatCount(video.viewCount)} views</span>
                    )}
                    {video.viewCount && video.uploadDate && (
                      <span>•</span>
                    )}
                    {video.uploadDate && (
                      <span>{formatDate(video.uploadDate)}</span>
                    )}
                  </div>

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

          {/* Load More / Load All Buttons */}
          {hasMore && (
            <div className="mt-6 text-center">
              <div className="flex gap-3 justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore || loadingAll}
                  className="px-8 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading More...' : 'Load More'}
                </button>
                <button
                  onClick={handleLoadAllClick}
                  disabled={loadingMore || loadingAll}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAll ? `Loading All... ${loadAllProgress}%` : 'Load All'}
                </button>
              </div>
            </div>
          )}

          {/* Loading All Progress Indicator */}
          {loadingAll && (
            <div className="mt-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 max-w-md bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadAllProgress}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 min-w-[80px]">
                  {videos.length} videos
                </span>
              </div>
            </div>
          )}

          {!hasMore && videos.length > 0 && !loadingAll && (
            <div className="mt-6 text-center text-sm text-gray-500">
              All videos loaded ({videos.length} total)
            </div>
          )}
        </div>
      )}

      {/* Load All Confirmation Modal */}
      {showLoadAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Load All Videos?</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-3">
                This channel has <strong>{formatCount(channelInfo?.videoCount)}</strong> videos.
                Loading all of them may take several minutes.
              </p>
              <p className="text-sm text-gray-600">
                Estimated time: {Math.ceil((channelInfo?.videoCount || 0) / 100 * 3)} seconds
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={loadAll}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Load All Anyway
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

      {/* Download Modal */}
      {showDownloadModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Download Settings</h3>

            <p className="text-sm text-gray-700 mb-4">
              <strong>{selectedVideo.title}</strong>
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
                      {preset.platform === 'youtube' ? ' (YouTube)' : preset.platform ? ` (${preset.platform})` : ' (Global)'}
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
                {downloading ? 'Adding...' : 'Queue Download'}
              </button>
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedVideo(null);
                  setCategory('movies');
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

      {/* Format Preview Modal */}
      {showFormatPreview && selectedVideo && (
        <DownloadFormatPreview
          filename={selectedVideo.title}
          contentType="auto"
          category={category}
          customFolder={customFolder}
          onConfirm={handleFormatPreviewConfirm}
          onCancel={handleFormatPreviewCancel}
        />
      )}
    </div>
  );
}
