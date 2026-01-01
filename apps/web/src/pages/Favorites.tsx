import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, ExternalLink, Star, Calendar, Search, Loader, HardDrive, Play, Headphones, BookOpen, User } from 'lucide-react';
import { API_BASE } from '@/lib/config';

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
  // Audiobook fields
  external_id?: string;
  metadata?: {
    authors?: string[];
    year?: number;
    subjects?: string[];
    external_id?: string;
  };
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
  const [downloadFilter, setDownloadFilter] = useState<'all' | 'downloaded' | 'not_downloaded'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16;

  // Download modal state
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [torrentResults, setTorrentResults] = useState<any[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  // Prowlarr state (matching Movies/TV/Docs pages)
  const [prowlarrEnabled, setProwlarrEnabled] = useState(false);
  const [availableReleases, setAvailableReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string>('1080p');
  const [packTypeFilter, setPackTypeFilter] = useState<string>('all'); // For TV shows
  const [downloadingTorrent, setDownloadingTorrent] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(false);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  // Check Prowlarr status and VPN on mount
  useEffect(() => {
    const checkProwlarrStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/preferences`, { credentials: 'include' });
        if (response.ok) {
          const prefs = await response.json();
          setProwlarrEnabled(prefs.prowlarr_enabled || false);
        }
      } catch (error) {
        console.error('Failed to check Prowlarr status:', error);
      }
    };
    checkProwlarrStatus();
  }, []);

  // Check VPN status when modal opens
  useEffect(() => {
    if (selectedBookmark && prowlarrEnabled) {
      checkVpnStatus();
    }
  }, [selectedBookmark, prowlarrEnabled]);

  const checkVpnStatus = async () => {
    setCheckingVpn(true);
    try {
      const response = await fetch(`${API_BASE}/vpn/status`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setVpnConnected(data.connected || false);
      }
    } catch (error) {
      console.error('Failed to check VPN status:', error);
      setVpnConnected(false);
    } finally {
      setCheckingVpn(false);
    }
  };

  // Helper function to extract quality from torrent title
  const extractQuality = (title: string): string => {
    if (title.includes('2160p') || title.includes('4K') || title.includes('UHD')) return '2160p';
    if (title.includes('1080p')) return '1080p';
    if (title.includes('720p')) return '720p';
    if (title.includes('480p')) return '480p';
    return 'Other';
  };

  // Helper function for indexer colors (matching Movies/TV/Docs pages)
  const getIndexerColor = (indexer: string): string => {
    const indexerLower = indexer.toLowerCase();
    if (indexerLower.includes('torrentgalaxy')) return 'bg-purple-600/20 text-purple-400';
    if (indexerLower.includes('1337x')) return 'bg-orange-600/20 text-orange-400';
    if (indexerLower.includes('piratebay') || indexerLower.includes('pirate bay')) return 'bg-pink-600/20 text-pink-400';
    if (indexerLower.includes('yts')) return 'bg-red-600/20 text-red-400';
    if (indexerLower.includes('eztv')) return 'bg-green-600/20 text-green-400';
    if (indexerLower.includes('torrentdownload')) return 'bg-blue-600/20 text-blue-400';
    if (indexerLower.includes('rarbg')) return 'bg-emerald-600/20 text-emerald-400';
    if (indexerLower.includes('kickass')) return 'bg-yellow-600/20 text-yellow-400';
    if (indexerLower.includes('limetorrents')) return 'bg-lime-600/20 text-lime-400';
    if (indexerLower.includes('nyaa')) return 'bg-fuchsia-600/20 text-fuchsia-400';
    return 'bg-indigo-600/20 text-indigo-400'; // Default color
  };

  // Detect pack type for TV shows (matching TVShows.tsx)
  const detectPackType = (title: string): string => {
    const titleLower = title.toLowerCase();

    // Complete series detection
    if (titleLower.includes('complete') && (titleLower.includes('series') || titleLower.includes('collection'))) {
      return 'series';
    }
    if (/s\d+-s\d+/.test(titleLower)) { // e.g., S01-S08
      return 'series';
    }

    // Season pack detection
    if (titleLower.includes('season') && titleLower.includes('complete')) {
      return 'season';
    }
    if (/s\d+\s*(complete|pack|1080p|720p|2160p)/i.test(title)) { // e.g., S01 Complete, S02 1080p
      return 'season';
    }

    // Multi-episode detection
    if (/s\d+e\d+-e\d+/i.test(title)) { // e.g., S01E01-E05
      return 'multi';
    }
    if (/\d+x\d+-\d+x\d+/i.test(title)) { // e.g., 1x01-1x05
      return 'multi';
    }

    // Single episode detection
    if (/s\d+e\d+/i.test(title) || /\d+x\d+/i.test(title)) {
      return 'episode';
    }

    return 'other';
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks?enrichWithDownloadStatus=true`, {
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
      await fetch(`${API_BASE}/bookmarks/${id}`, {
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

  // Apply type filter
  let filteredBookmarks = filter === 'all'
    ? bookmarks
    : bookmarks.filter(b => b.type === filter);

  // Apply download status filter
  if (downloadFilter === 'downloaded') {
    filteredBookmarks = filteredBookmarks.filter(b => b.download_status?.is_downloaded === true);
  } else if (downloadFilter === 'not_downloaded') {
    filteredBookmarks = filteredBookmarks.filter(b => !b.download_status?.is_downloaded);
  }

  // Pagination
  const totalPages = Math.ceil(filteredBookmarks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookmarks = filteredBookmarks.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, downloadFilter]);

  const stats = {
    total: bookmarks.length,
    youtube_channel: bookmarks.filter(b => b.type === 'youtube_channel').length,
    youtube_playlist: bookmarks.filter(b => b.type === 'youtube_playlist').length,
    soundcloud_user: bookmarks.filter(b => b.type === 'soundcloud_user').length,
    tmdb_movie: bookmarks.filter(b => b.type === 'tmdb_movie').length,
    tmdb_tv: bookmarks.filter(b => b.type === 'tmdb_tv').length,
    tmdb_documentary: bookmarks.filter(b => b.type === 'tmdb_documentary').length,
    audiobook: bookmarks.filter(b => b.type === 'audiobook').length,
    other: bookmarks.filter(b => b.type === 'other').length,
    downloaded: bookmarks.filter(b => b.download_status?.is_downloaded === true).length,
    not_downloaded: bookmarks.filter(b => !b.download_status?.is_downloaded).length
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
    setAvailableReleases([]);
    setDownloadMessage(null);
    setQualityFilter('1080p');
    // Don't auto-search, let user click Download button
  };

  // Prowlarr-based torrent search (matching Movies/TV/Docs pages)
  const browseTorrents = async () => {
    if (!selectedBookmark) return;

    setLoadingReleases(true);
    setAvailableReleases([]);
    setDownloadMessage(null);
    setQualityFilter('1080p');
    setPackTypeFilter('all');

    try {
      // Build search query
      const searchQuery = `${selectedBookmark.title} ${selectedBookmark.release_year || ''}`.trim();
      const mediaType = selectedBookmark.media_type === 'tv' ? 'tv' : 'movie';

      const releasesResponse = await fetch(`${API_BASE}/prowlarr/search?query=${encodeURIComponent(searchQuery)}&type=${mediaType}`, {
        credentials: 'include'
      });

      if (!releasesResponse.ok) {
        throw new Error('Failed to search Prowlarr');
      }

      const releases = await releasesResponse.json();
      const totalResults = releases.length || 0;

      // Filter out irrelevant results (matching Movies.tsx and TVShows.tsx logic)
      const titleLower = selectedBookmark.title.toLowerCase();
      const allKeywords = titleLower.split(/[\s:]+/).filter((word: string) => word.length > 2);

      // Filter out adult content
      const adultKeywords = ['xxx', 'onlyfans', 'nfbusty', 'girlsoutwest', 'girlsrimming', 'playboy'];

      const filteredReleases = releases.filter((r: any) => {
        const releaseTitleLower = (r.title || '').toLowerCase();

        // Filter out adult content
        if (adultKeywords.some(keyword => releaseTitleLower.includes(keyword))) {
          return false;
        }

        // Match keywords
        const matchedKeywords = allKeywords.filter((keyword: string) => releaseTitleLower.includes(keyword));
        const matchPercentage = matchedKeywords.length / allKeywords.length;

        if (allKeywords.length > 2) {
          // Require at least 50% overall match
          if (matchPercentage < 0.5) return false;

          // Also require at least one keyword from beyond the first two words
          const uniqueKeywords = allKeywords.slice(2);
          const hasUniqueMatch = uniqueKeywords.some((keyword: string) => releaseTitleLower.includes(keyword));
          return hasUniqueMatch;
        }

        // For short titles (1-2 words), require higher match percentage
        return matchPercentage >= 0.5;
      });

      // Map results to expected format
      const formattedReleases = filteredReleases.map((r: any) => ({
        guid: r.guid,
        title: r.title,
        indexerId: r.indexerId,
        indexer: r.indexer,
        size: r.size,
        seeders: r.seeders || 0,
        leechers: r.leechers || 0,
        magnetUrl: r.magnetUrl,
        downloadUrl: r.downloadUrl,
        publishDate: r.publishDate,
      }));

      setAvailableReleases(formattedReleases);

      if (formattedReleases.length === 0) {
        if (totalResults > 0) {
          setDownloadMessage(`⚠️ Found ${totalResults} results but none matched "${selectedBookmark.title}". Try adding more indexers in Prowlarr.`);
        } else {
          setDownloadMessage(`⚠️ No torrents found. This may not be available on your indexers.`);
        }
      }
    } catch (error) {
      console.error('Prowlarr search error:', error);
      setDownloadMessage('❌ Failed to search torrents. Check Prowlarr settings.');
    } finally {
      setLoadingReleases(false);
    }
  };

  // Legacy search function (kept for fallback)
  const searchTorrents = async (bookmark: Bookmark) => {
    setSearchingTorrents(true);
    setTorrentSearchError(null);
    setTorrentResults([]);

    try {
      let cleanTitle = bookmark.title
        .replace(/:/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const words = cleanTitle.split(' ');
      if (words.length > 5) {
        cleanTitle = words.slice(0, 5).join(' ');
      }

      const searchQuery = `${cleanTitle} ${bookmark.release_year || ''}`.trim();
      const res = await fetch(`${API_BASE}/torrents/search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      if (!res.ok) {
        throw new Error('Failed to search torrents');
      }

      const data = await res.json();
      setTorrentResults(data.results || []);

      if (data.results.length === 0) {
        setTorrentSearchError('No torrents found.');
      }
    } catch (err) {
      console.error('Torrent search error:', err);
      setTorrentSearchError('Failed to search torrents.');
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

      const res = await fetch(`${API_BASE}/downloads`, {
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
      const res = await fetch(`${API_BASE}/preferences`, { credentials: 'include' });
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
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
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
            <div className="mb-3 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
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

  const renderAudiobookCard = (bookmark: Bookmark) => {
    const coverUrl = bookmark.thumbnail
      ? `${API_BASE}/audiobooks/cover?url=${encodeURIComponent(bookmark.thumbnail)}`
      : null;

    return (
      <div key={bookmark.id} className="card hover:shadow-xl transition-shadow flex flex-col h-full">
        {/* Cover */}
        <div className="aspect-[2/3] relative overflow-hidden rounded-lg mb-3 flex-shrink-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={bookmark.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 to-gray-800 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-purple-400/50" />
            </div>
          )}

          {/* Purple audiobook badge */}
          <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow flex items-center gap-1">
            <Headphones className="w-3 h-3" />
            Audiobook
          </div>
        </div>

        {/* Content wrapper */}
        <div className="flex flex-col flex-grow">
          {/* Title */}
          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem] mb-2">
            {bookmark.title}
          </h3>

          {/* Author */}
          {bookmark.description && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <User className="w-4 h-4" />
              <span className="line-clamp-1">{bookmark.description}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-grow"></div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => handleDelete(bookmark.id)}
              className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove
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
        <h1 className="text-3xl font-bold text-gray-100">Favorites</h1>
        <p className="text-gray-400 mt-1">Your bookmarked channels, playlists, movies, shows, documentaries, and audiobooks</p>
      </div>

      {/* Filters and View Mode */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Type</label>
            <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('tmdb_movie')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_movie' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Movies ({stats.tmdb_movie})
          </button>
          <button
            onClick={() => setFilter('tmdb_tv')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_tv' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            TV Shows ({stats.tmdb_tv})
          </button>
          <button
            onClick={() => setFilter('tmdb_documentary')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'tmdb_documentary' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Documentaries ({stats.tmdb_documentary})
          </button>
          <button
            onClick={() => setFilter('audiobook')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'audiobook' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Audiobooks ({stats.audiobook})
          </button>
          <button
            onClick={() => setFilter('youtube_channel')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'youtube_channel' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            YouTube Channels ({stats.youtube_channel})
          </button>
          <button
            onClick={() => setFilter('youtube_playlist')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'youtube_playlist' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            YouTube Playlists ({stats.youtube_playlist})
          </button>
          <button
            onClick={() => setFilter('soundcloud_user')}
            className={`px-4 py-2 rounded-lg text-sm ${filter === 'soundcloud_user' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            SoundCloud ({stats.soundcloud_user})
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Download Status</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDownloadFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm ${downloadFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setDownloadFilter('downloaded')}
            className={`px-4 py-2 rounded-lg text-sm ${downloadFilter === 'downloaded' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            ✓ Downloaded ({stats.downloaded})
          </button>
          <button
            onClick={() => setDownloadFilter('not_downloaded')}
            className={`px-4 py-2 rounded-lg text-sm ${downloadFilter === 'not_downloaded' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            ⬇ Not Downloaded ({stats.not_downloaded})
          </button>
        </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">View Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'table' ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                Table
              </button>
            </div>
          </div>
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
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedBookmarks.map((bookmark) => {
            // Render TMDB cards differently from YouTube/SoundCloud cards
            if (bookmark.type.startsWith('tmdb_')) {
              return renderTMDBCard(bookmark);
            }

            // Render audiobook cards
            if (bookmark.type === 'audiobook') {
              return renderAudiobookCard(bookmark);
            }

            // Render YouTube/SoundCloud cards (existing logic)
            return (
            <div key={bookmark.id} className="card hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              {bookmark.thumbnail && bookmark.thumbnail.trim() !== '' ? (
                <div className={`${bookmark.type === 'soundcloud_user' ? 'aspect-square' : 'aspect-video'} bg-gray-700 rounded-lg mb-3 overflow-hidden relative`}>
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
                          <div class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-700">
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
                <div className={`${bookmark.type === 'soundcloud_user' ? 'aspect-square' : 'aspect-video'} bg-gray-700 rounded-lg mb-3 flex items-center justify-center text-gray-400 relative`}>
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
              <h3 className="font-medium text-gray-100 mb-2 line-clamp-2 min-h-[2.5rem]" title={bookmark.title}>
                {bookmark.title}
              </h3>

              {/* Type Badge */}
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 text-xs rounded ${
                  bookmark.type === 'youtube_channel' || bookmark.type === 'youtube_playlist'
                    ? 'bg-red-900/50 text-red-300'
                    : bookmark.type === 'soundcloud_user'
                    ? 'bg-orange-900/50 text-orange-300'
                    : 'bg-gray-700 text-gray-300'
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
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {paginatedBookmarks.map((bookmark) => (
                <tr key={bookmark.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 max-w-md">
                      {bookmark.thumbnail && (
                        <img
                          src={bookmark.thumbnail}
                          alt={bookmark.title}
                          className="w-12 h-12 object-cover rounded bg-gray-700"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {bookmark.title}
                        </p>
                        {bookmark.url && (
                          <p className="text-xs text-gray-400 truncate">
                            {bookmark.url}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                      {bookmark.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {bookmark.download_status?.is_downloaded ? (
                      <span className="px-2 py-1 text-xs rounded bg-green-900/50 text-green-300">
                        ✓ Downloaded
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-400">
                        Not Downloaded
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {bookmark.url && (
                        <button
                          onClick={() => handleVisit(bookmark.url!)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Visit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(bookmark.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="card mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredBookmarks.length)} of {filteredBookmarks.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {/* Smart pagination: Show first, last, current, and nearby pages */}
                {currentPage > 2 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className="text-gray-500 px-2">...</span>}
                  </>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show current page and 1 page on each side
                    return page >= currentPage - 1 && page <= currentPage + 1;
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg ${
                        currentPage === page
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                {currentPage < totalPages - 1 && (
                  <>
                    {currentPage < totalPages - 2 && <span className="text-gray-500 px-2">...</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal - Prowlarr-based (matching Movies/TV/Docs pages) */}
      {selectedBookmark && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedBookmark(null);
            setAvailableReleases([]);
            setDownloadMessage(null);
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
                {/* VPN Warning */}
                {prowlarrEnabled && !vpnConnected && !checkingVpn && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-sm text-yellow-300">
                      ⚠️ VPN is not connected. Please enable your VPN before downloading torrents.
                    </p>
                  </div>
                )}

                {/* Download Success/Error Message */}
                {downloadMessage && (
                  <div className={`border rounded-lg p-4 transition-all duration-300 ${
                    downloadMessage.startsWith('✅')
                      ? 'bg-green-900/30 border-green-400/50 shadow-lg shadow-green-500/20'
                      : downloadMessage.startsWith('⚠️')
                      ? 'bg-yellow-900/20 border-yellow-500/30'
                      : 'bg-red-900/20 border-red-500/30'
                  }`}>
                    <p className={`text-sm ${
                      downloadMessage.startsWith('✅')
                        ? 'text-green-200 font-semibold'
                        : downloadMessage.startsWith('⚠️')
                        ? 'text-yellow-300'
                        : 'text-red-300'
                    }`}>
                      {downloadMessage}
                      {downloadMessage.startsWith('✅') && (
                        <>, <Link to="/downloads" className="underline font-bold hover:text-green-100 transition-colors">click here to see your downloads</Link></>
                      )}
                    </p>
                  </div>
                )}

                {/* Download Button - Search Prowlarr */}
                {prowlarrEnabled && availableReleases.length === 0 && (
                  <button
                    onClick={() => browseTorrents()}
                    disabled={loadingReleases || !vpnConnected || checkingVpn}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors shadow-lg text-lg"
                  >
                    {checkingVpn ? (
                      <>
                        <Loader className="w-6 h-6 animate-spin" />
                        Checking VPN...
                      </>
                    ) : loadingReleases ? (
                      <>
                        <Loader className="w-6 h-6 animate-spin" />
                        Searching Torrents...
                      </>
                    ) : !vpnConnected ? (
                      <>
                        <Download className="w-6 h-6" />
                        VPN Required
                      </>
                    ) : (
                      <>
                        <Download className="w-6 h-6" />
                        Download
                      </>
                    )}
                  </button>
                )}

                {/* Prowlarr not enabled message */}
                {!prowlarrEnabled && (
                  <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 text-center">
                    <p className="text-gray-400 mb-2">Prowlarr is not configured.</p>
                    <Link to="/settings" className="text-brand-400 hover:text-brand-300 underline">
                      Configure Prowlarr in Settings →
                    </Link>
                  </div>
                )}

                {/* Prowlarr Torrent Results */}
                {availableReleases.length > 0 && (
                  <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Found {availableReleases.filter(r => {
                        const quality = extractQuality(r.title);
                        const packType = detectPackType(r.title);
                        const qualityMatch = qualityFilter === 'all' || quality === qualityFilter;
                        const packMatch = selectedBookmark?.media_type !== 'tv' || packTypeFilter === 'all' || packType === packTypeFilter;
                        return qualityMatch && packMatch;
                      }).length} Torrents
                    </h3>

                    {/* Quality Filter Buttons */}
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {['all', '2160p', '1080p', '720p', 'Other'].map((quality) => {
                        const count = quality === 'all'
                          ? availableReleases.length
                          : availableReleases.filter(r => extractQuality(r.title) === quality).length;

                        if (count === 0 && quality !== 'all') return null;

                        return (
                          <button
                            key={quality}
                            onClick={() => {
                              setQualityFilter(quality);
                              setPackTypeFilter('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              qualityFilter === quality
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {quality === 'all' ? 'All' : quality} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Pack Type Filter Buttons - TV Shows only */}
                    {selectedBookmark?.media_type === 'tv' && (
                      <>
                        <div className="border-t border-gray-700 my-3"></div>
                        <div className="flex gap-2 mb-3 flex-wrap items-center">
                          {[
                            { value: 'all', label: 'All' },
                            { value: 'series', label: 'Complete Series' },
                            { value: 'season', label: 'Seasons' },
                            { value: 'multi', label: 'Multi-Episode' },
                            { value: 'episode', label: 'Episodes' }
                          ].map((packType) => {
                            const count = availableReleases.filter(r => {
                              const quality = extractQuality(r.title);
                              const pack = detectPackType(r.title);
                              const qualityMatch = qualityFilter === 'all' || quality === qualityFilter;
                              const packMatch = packType.value === 'all' || pack === packType.value;
                              return qualityMatch && packMatch;
                            }).length;

                            if (count === 0 && packType.value !== 'all') return null;

                            return (
                              <button
                                key={packType.value}
                                onClick={() => setPackTypeFilter(packType.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  packTypeFilter === packType.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {packType.label} ({count})
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      {[...availableReleases]
                        .filter(r => {
                          const quality = extractQuality(r.title);
                          const packType = detectPackType(r.title);
                          const qualityMatch = qualityFilter === 'all' || quality === qualityFilter;
                          const packMatch = selectedBookmark?.media_type !== 'tv' || packTypeFilter === 'all' || packType === packTypeFilter;
                          return qualityMatch && packMatch;
                        })
                        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
                        .map((release, index) => {
                          const sizeInGB = release.size ? (release.size / 1073741824).toFixed(1) : 'Unknown';
                          const seeders = release.seeders || 0;
                          const leechers = release.leechers || 0;
                          const indexer = release.indexer || 'Unknown';

                          return (
                            <div
                              key={index}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (downloadingTorrent) return;

                                setSelectedRelease(release);
                                setDownloadingTorrent(true);

                                try {
                                  const category = selectedBookmark.media_type === 'movie' ? 'Movies' :
                                                  selectedBookmark.media_type === 'tv' ? 'TV Shows' : 'Documentaries';

                                  const response = await fetch(`${API_BASE}/torrents/download`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      magnetUrl: release.magnetUrl,
                                      downloadUrl: release.downloadUrl,
                                      title: release.title,
                                      category,
                                      tmdb_id: selectedBookmark.tmdb_id,
                                      tmdb_media_type: selectedBookmark.media_type,
                                    })
                                  });

                                  if (response.ok) {
                                    setDownloadMessage(`✅ ${selectedBookmark.title} is now downloading`);
                                    setAvailableReleases([]);
                                    fetchBookmarks(); // Refresh to update download status
                                    setTimeout(() => setDownloadMessage(null), 10000);
                                  } else if (response.status === 409) {
                                    setDownloadMessage(`⚠️ This torrent is already in your downloads`);
                                    setTimeout(() => setDownloadMessage(null), 5000);
                                  } else {
                                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                    throw new Error(errorData.error || 'Failed to download');
                                  }
                                } catch (error: any) {
                                  setDownloadMessage(`❌ ${error.message}`);
                                  setTimeout(() => setDownloadMessage(null), 5000);
                                } finally {
                                  setDownloadingTorrent(false);
                                  setSelectedRelease(null);
                                }
                              }}
                              className={`bg-gray-800 border border-gray-700 rounded-lg p-3 transition-colors ${
                                downloadingTorrent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 hover:border-green-500 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate mb-1">{release.title}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-400">
                                    <span className={`px-2 py-1 rounded font-medium ${getIndexerColor(indexer)}`}>
                                      {indexer}
                                    </span>
                                    <span>{sizeInGB} GB</span>
                                    <span className="text-green-400 font-semibold">↑ {seeders}</span>
                                    <span className="text-red-400">↓ {leechers}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
