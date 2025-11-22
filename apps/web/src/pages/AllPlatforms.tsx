import { useState, useEffect } from 'react';

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
  platform?: string;
}

interface TrendingSource {
  platform: string;
  emoji: string;
  url: string;
}

const TRENDING_SOURCES: TrendingSource[] = [
  // Fast platforms (unified search API ~2-4s each)
  { platform: 'YouTube', emoji: '▶️', url: 'trending' }, // Uses unified search
  { platform: 'BBC iPlayer', emoji: '📺', url: 'drama' }, // Uses unified search
  { platform: 'SoundCloud', emoji: '🎧', url: 'trending' }, // Uses unified search

  // Slower platforms (yt-dlp extract ~9s each, but load independently)
  // NOTE: Rumble temporarily disabled due to 403 anti-bot protection blocking yt-dlp
  // { platform: 'Rumble', emoji: '📹', url: 'https://rumble.com/c/Timcast' },
  { platform: 'TikTok', emoji: '🎵', url: 'https://www.tiktok.com/@khaby.lame' },
  { platform: 'Twitch', emoji: '🎮', url: 'https://www.twitch.tv/xqc/videos' },
];

interface PlatformSection {
  platform: string;
  emoji: string;
  videos: Video[];
  hasMore?: boolean;
  sourceUrl?: string; // Store source URL for fetching more
  isSearch?: boolean; // Track if this is a search result or trending
}

export function AllPlatforms() {
  const [loading, setLoading] = useState(true);
  const [platformSections, setPlatformSections] = useState<PlatformSection[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('movies');
  const [customFolder, setCustomFolder] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['YouTube', 'BBC iPlayer', 'SoundCloud']);
  const [allSearchResults, setAllSearchResults] = useState<any[]>([]);

  // Auto-load trending videos from all platforms on page load
  useEffect(() => {
    loadTrendingFeed();
  }, []);

  const loadTrendingFeed = async () => {
    setLoading(true);
    setSearchQuery(''); // Clear search when loading trending
    setAllSearchResults([]); // Clear search results

    // Initialize sections in the correct order with empty videos
    const initialSections = TRENDING_SOURCES.map(source => ({
      platform: source.platform,
      emoji: source.emoji,
      videos: [],
      hasMore: false,
      sourceUrl: source.url,
      isSearch: false
    }));
    setPlatformSections(initialSections);

    let loadedCount = 0;

    try {
      // Load each source independently and show results as they come in
      TRENDING_SOURCES.forEach(async (source, sourceIndex) => {
        try {
          let videos: Video[] = [];

          // Use fast unified search API for YouTube, BBC iPlayer, and SoundCloud
          if (source.platform === 'YouTube') {
            try {
              const res = await fetch(
                `http://localhost:3001/api/v1/search/unified?q=trending&sources=youtube&limit=4`,
                { credentials: 'include' }
              );

              if (res.ok) {
                const data = await res.json();
                videos = (data.results || [])
                  .filter((r: any) => r.source === 'youtube')
                  .map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description || '',
                    thumbnail: r.thumbnail || '',
                    url: r.url,
                    duration: r.duration,
                    uploader: r.uploader || 'YouTube',
                    uploadDate: r.uploadDate,
                    viewCount: r.viewCount,
                    platform: 'YouTube'
                  }));
              }
            } catch (err) {
              console.error('YouTube failed:', err);
            }
          } else if (source.platform === 'BBC iPlayer') {
            try {
              const res = await fetch(
                `http://localhost:3001/api/v1/search/unified?q=${encodeURIComponent(source.url)}&sources=bbc&limit=4`,
                { credentials: 'include' }
              );

              if (res.ok) {
                const data = await res.json();
                videos = (data.results || [])
                  .filter((r: any) => r.source === 'bbc_iplayer')
                  .map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description || '',
                    thumbnail: r.thumbnail || '',
                    url: `https://www.bbc.co.uk/iplayer/episode/${r.id}`,
                    duration: r.duration,
                    uploader: r.channel || 'BBC',
                    uploadDate: r.uploadDate,
                    viewCount: r.viewCount,
                    platform: 'BBC iPlayer'
                  }));
              }
            } catch (err) {
              console.error('BBC iPlayer failed:', err);
            }
          } else if (source.platform === 'SoundCloud') {
            try {
              const res = await fetch(
                `http://localhost:3001/api/v1/search/unified?q=trending&sources=soundcloud&limit=4`,
                { credentials: 'include' }
              );

              if (res.ok) {
                const data = await res.json();
                videos = (data.results || [])
                  .filter((r: any) => r.source === 'soundcloud')
                  .map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description || '',
                    thumbnail: r.thumbnail || '',
                    url: r.url,
                    duration: r.duration,
                    uploader: r.uploader || 'SoundCloud',
                    uploadDate: r.uploadDate,
                    viewCount: r.viewCount,
                    platform: 'SoundCloud'
                  }));
              }
            } catch (err) {
              console.error('SoundCloud failed:', err);
            }
          } else {
            // Use yt-dlp extract for slower platforms (Rumble, TikTok, Twitch)
            const res = await fetch(
              `http://localhost:3001/api/v1/search/extract?url=${encodeURIComponent(source.url)}&limit=4`,
              { credentials: 'include' }
            );

            if (res.ok) {
              const data = await res.json();
              videos = (data.videos || []).map((v: Video) => ({
                ...v,
                platform: source.platform,
              }));
            }
          }

          // Update section with videos
          setPlatformSections(prev => {
            const updated = [...prev];
            updated[sourceIndex] = {
              ...updated[sourceIndex],
              videos: videos,
              hasMore: videos.length >= 4,
              sourceUrl: source.url,
              isSearch: false
            };
            return updated;
          });

          loadedCount++;
          if (loadedCount >= TRENDING_SOURCES.length) {
            setLoading(false);
          }
        } catch (err) {
          console.error(`Failed to load from ${source.platform}:`, err);
          loadedCount++;
          if (loadedCount >= TRENDING_SOURCES.length) {
            setLoading(false);
          }
        }
      });
    } catch (err) {
      console.error('Failed to load trending feed:', err);
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || selectedPlatforms.length === 0) return;

    setLoading(true);

    // Initialize sections for selected platforms in the correct order
    const sourcesToSearch = TRENDING_SOURCES.filter(s => selectedPlatforms.includes(s.platform));
    const initialSections = sourcesToSearch.map(source => ({
      platform: source.platform,
      emoji: source.emoji,
      videos: []
    }));
    setPlatformSections(initialSections);

    try {
      // Separate platforms into unified search (BBC, YouTube, SoundCloud) and direct search (others)
      const unifiedPlatforms = selectedPlatforms.filter(p =>
        ['YouTube', 'BBC iPlayer', 'SoundCloud'].includes(p)
      );

      // Use unified search API for BBC, YouTube, SoundCloud
      if (unifiedPlatforms.length > 0) {
        const sourceMap: Record<string, string> = {
          'YouTube': 'youtube',
          'BBC iPlayer': 'bbc',
          'SoundCloud': 'soundcloud'
        };

        const sources = unifiedPlatforms.map(p => sourceMap[p]).join(',');

        try {
          const res = await fetch(
            `http://localhost:3001/api/v1/search/unified?q=${encodeURIComponent(searchQuery)}&sources=${sources}&limit=100`,
            { credentials: 'include' }
          );

          if (res.ok) {
            const data = await res.json();
            const results = data.results || [];

            // Store all results for "Load More" functionality
            setAllSearchResults(results);

            // Group results by platform
            const platformMap: Record<string, string> = {
              'bbc_iplayer': 'BBC iPlayer',
              'youtube': 'YouTube',
              'soundcloud': 'SoundCloud'
            };

            // Update each platform section with its results (initially show 10)
            sourcesToSearch.forEach((source, sourceIndex) => {
              if (!unifiedPlatforms.includes(source.platform)) return;

              const platformKey = Object.entries(platformMap).find(
                ([_, name]) => name === source.platform
              )?.[0];

              const allPlatformResults = results.filter((r: any) => r.source === platformKey);

              const platformResults = allPlatformResults
                .slice(0, 10)
                .map((r: any) => ({
                  id: r.id,
                  title: r.title,
                  description: r.description || '',
                  thumbnail: getHighQualityThumbnail(r.thumbnail || '', source.platform),
                  url: r.url || (r.source === 'bbc_iplayer' ? `https://www.bbc.co.uk/iplayer/episode/${r.id}` : ''),
                  duration: r.duration,
                  uploader: r.uploader || r.channel,
                  uploadDate: r.uploadDate,
                  viewCount: r.viewCount,
                  platform: source.platform
                }));

              if (platformResults.length > 0 || allPlatformResults.length > 0) {
                setPlatformSections(prev => {
                  const updated = [...prev];
                  updated[sourceIndex] = {
                    ...updated[sourceIndex],
                    videos: platformResults,
                    hasMore: allPlatformResults.length > 10,
                    isSearch: true
                  };
                  return updated;
                });
              }
            });
          }
        } catch (err) {
          console.error('Unified search failed:', err);
        }
      }

      // Turn off loading immediately after unified search completes
      setLoading(false);
    } catch (err) {
      console.error('Search failed:', err);
      setLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const loadMoreForPlatform = async (platformName: string) => {
    const section = platformSections.find(s => s.platform === platformName);
    if (!section) return;

    if (section.isSearch) {
      // Search section - load from cached search results
      setPlatformSections(prev => {
        return prev.map(s => {
          if (s.platform !== platformName) return s;

          const platformMap: Record<string, string> = {
            'BBC iPlayer': 'bbc_iplayer',
            'YouTube': 'youtube',
            'SoundCloud': 'soundcloud'
          };

          const platformKey = platformMap[platformName];
          if (!platformKey) return s;

          const allPlatformResults = allSearchResults
            .filter((r: any) => r.source === platformKey)
            .map((r: any) => ({
              id: r.id,
              title: r.title,
              description: r.description || '',
              thumbnail: getHighQualityThumbnail(r.thumbnail || '', platformName),
              url: r.url || (r.source === 'bbc_iplayer' ? `https://www.bbc.co.uk/iplayer/episode/${r.id}` : ''),
              duration: r.duration,
              uploader: r.uploader || r.channel,
              uploadDate: r.uploadDate,
              viewCount: r.viewCount,
              platform: platformName
            }));

          const currentCount = s.videos.length;
          const newVideos = allPlatformResults.slice(currentCount, currentCount + 10);

          return {
            ...s,
            videos: [...s.videos, ...newVideos],
            hasMore: currentCount + newVideos.length < allPlatformResults.length
          };
        });
      });
    } else {
      // Trending section - fetch more videos from API
      if (!section.sourceUrl) return;

      try {
        const currentCount = section.videos.length;
        const newLimit = currentCount + 10;

        let res;
        // Use unified search API for fast platforms
        if (platformName === 'YouTube' || platformName === 'SoundCloud') {
          const sourcesMap: Record<string, string> = {
            'YouTube': 'youtube',
            'SoundCloud': 'soundcloud'
          };
          res = await fetch(
            `http://localhost:3001/api/v1/search/unified?q=${encodeURIComponent(section.sourceUrl)}&sources=${sourcesMap[platformName]}&limit=${newLimit}`,
            { credentials: 'include' }
          );
        } else if (platformName === 'BBC iPlayer') {
          res = await fetch(
            `http://localhost:3001/api/v1/search/unified?q=${encodeURIComponent(section.sourceUrl)}&sources=bbc&limit=${newLimit}`,
            { credentials: 'include' }
          );
        } else {
          // Use extract endpoint for slower platforms
          res = await fetch(
            `http://localhost:3001/api/v1/search/extract?url=${encodeURIComponent(section.sourceUrl)}&limit=${newLimit}`,
            { credentials: 'include' }
          );
        }

        if (res.ok) {
          const data = await res.json();

          // Handle different response formats
          let allVideos: Video[] = [];
          if (platformName === 'YouTube' || platformName === 'BBC iPlayer' || platformName === 'SoundCloud') {
            // Unified API returns 'results'
            allVideos = (data.results || []).map((r: any) => ({
              id: r.id,
              title: r.title,
              description: r.description || '',
              thumbnail: r.thumbnail || '',
              url: r.url || (r.source === 'bbc_iplayer' ? `https://www.bbc.co.uk/iplayer/episode/${r.id}` : ''),
              duration: r.duration,
              uploader: r.uploader || r.channel,
              uploadDate: r.uploadDate,
              viewCount: r.viewCount,
              platform: platformName
            }));
          } else {
            // Extract API returns 'videos'
            allVideos = (data.videos || []).map((v: Video) => ({
              ...v,
              platform: platformName,
            }));
          }

          setPlatformSections(prev => {
            return prev.map(s => {
              if (s.platform !== platformName) return s;

              return {
                ...s,
                videos: allVideos,
                hasMore: allVideos.length >= currentCount + 10
              };
            });
          });
        }
      } catch (err) {
        console.error(`Failed to load more from ${platformName}:`, err);
      }
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

  const selectAll = () => {
    const allVideoIds: string[] = [];
    platformSections.forEach(section => {
      section.videos.forEach(v => allVideoIds.push(v.id));
    });
    setSelectedVideos(new Set(allVideoIds));
  };

  const deselectAll = () => {
    setSelectedVideos(new Set());
  };

  const handleBulkDownload = async () => {
    if (selectedVideos.size === 0) return;

    // Collect all videos from all sections
    const allVideos: Video[] = [];
    platformSections.forEach(section => {
      allVideos.push(...section.videos);
    });

    const videosToDownload = allVideos.filter(v => selectedVideos.has(v.id));
    setDownloading(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const video of videosToDownload) {
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

      alert(`Bulk download queued!\n\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
      setSelectedVideos(new Set());
    } catch (err) {
      alert('Failed to queue bulk downloads');
    } finally {
      setDownloading(false);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';

    // Handle YYYYMMDD format
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);

      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 1) return 'Today';
      if (diffDays < 2) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    }

    return dateStr;
  };

  const getHighQualityThumbnail = (thumbnail: string, platform?: string) => {
    // Upgrade SoundCloud thumbnails from mini to high quality
    if (platform === 'SoundCloud' && thumbnail.includes('sndcdn.com')) {
      return thumbnail.replace('-mini.jpg', '-t500x500.jpg');
    }
    return thumbnail;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover</h1>
        <p className="text-gray-600">
          Search and browse trending content from all platforms
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="card mb-6">
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all platforms..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Search in:</span>
          {TRENDING_SOURCES.map((source) => (
            <label key={source.platform} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(source.platform)}
                onChange={() => togglePlatform(source.platform)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">{source.emoji} {source.platform}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || selectedPlatforms.length === 0 || !searchQuery.trim()}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={loadTrendingFeed}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Load Trending
          </button>
        </div>
      </form>

      {/* Skeleton Loading State */}
      {loading && platformSections.every(s => s.videos.length === 0) && (
        <div className="space-y-8">
          {[1, 2].map(skeletonIndex => (
            <div key={skeletonIndex} className="card">
              <div className="mb-4">
                <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <div className="aspect-video bg-gray-200 animate-pulse"></div>
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Download Bar */}
      {selectedVideos.size > 0 && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg flex items-center gap-4 sticky top-0 z-10">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-2">{selectedVideos.size} videos selected</p>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="movies">Movies</option>
                <option value="tv">TV Shows</option>
                <option value="music">Music</option>
                <option value="documentaries">Documentaries</option>
                <option value="custom">Custom Folder...</option>
                <option value="collection">Collection (No folder)</option>
              </select>
              {category === 'custom' && (
                <input
                  type="text"
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  placeholder="Folder name..."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={deselectAll}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={downloading || (category === 'custom' && !customFolder)}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : `Download ${selectedVideos.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Platform Sections */}
      {platformSections.map((section) => (
        <div key={section.platform} className="mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">{section.emoji}</span>
                <span>Trending on {section.platform}</span>
                <span className="text-sm font-normal text-gray-500">({section.videos.length} videos)</span>
              </h2>
              <button
                onClick={selectAll}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
              {section.videos.map((video, index) => (
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
                    {video.platform && (
                      <div className="absolute top-2 right-2 bg-white bg-opacity-90 backdrop-blur-sm text-xs px-2 py-1 rounded font-medium">
                        {video.platform === 'Rumble' && '📹 Rumble'}
                        {video.platform === 'YouTube' && '▶️ YouTube'}
                        {video.platform === 'TikTok' && '🎵 TikTok'}
                        {video.platform === 'Twitch' && '🎮 Twitch'}
                        {video.platform === 'SoundCloud' && '🎧 SoundCloud'}
                        {video.platform === 'BBC iPlayer' && '📺 BBC'}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={selectedVideos.has(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        className="w-5 h-5 rounded border-2 border-white bg-white bg-opacity-90 text-brand-600 focus:ring-brand-500 focus:ring-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-2">
                      {video.title}
                    </h3>

                    {video.uploader && (
                      <p className="text-xs text-gray-700 font-medium mb-1">
                        {video.uploader}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
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

            {/* Load More Button */}
            {section.hasMore && (
              <div className="text-center pt-2 border-t border-gray-200">
                <button
                  onClick={() => loadMoreForPlatform(section.platform)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Load More {section.platform} Results
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Download Modal */}
      {showDownloadModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Download Settings</h3>

            <p className="text-sm text-gray-700 mb-4">
              <strong>{selectedVideo.title}</strong>
            </p>

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
