import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, Search, Download, Star, Loader, BookOpen } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';
import { API_BASE } from '@/lib/config';

interface Audiobook {
  id: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  magnetUrl?: string;
  downloadUrl?: string;
  publishDate?: string;
}

interface BookmarkedAudiobook {
  id: number;
  title: string;
  author?: string;
  thumbnail?: string;
}

export default function Audiobooks() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(true);
  const [downloadingTorrent, setDownloadingTorrent] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  // Bookmarks state
  const [bookmarkedAudiobooks, setBookmarkedAudiobooks] = useState<BookmarkedAudiobook[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);

  // Check VPN status on mount
  useEffect(() => {
    checkVpnStatus();
    fetchBookmarks();
  }, []);

  const checkVpnStatus = async () => {
    setCheckingVpn(true);
    try {
      const res = await fetch(`${API_BASE}/vpn/status`, { credentials: 'include' });
      const data = await res.json();
      setVpnConnected(data.connected || false);
    } catch {
      setVpnConnected(false);
    } finally {
      setCheckingVpn(false);
    }
  };

  const fetchBookmarks = async () => {
    setLoadingBookmarks(true);
    try {
      const res = await fetch(`${API_BASE}/bookmarks?type=audiobook`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedAudiobooks(data.bookmarks || []);
      }
    } catch (err) {
      console.error('Failed to fetch audiobook bookmarks:', err);
    } finally {
      setLoadingBookmarks(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    const cacheKey = `audiobooks:search:${query.toLowerCase()}`;
    const cachedResults = searchCache.get<Audiobook[]>(cacheKey);
    if (cachedResults) {
      setSearchResults(cachedResults);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Search Prowlarr for audiobooks
      const res = await fetch(
        `${API_BASE}/prowlarr/search?query=${encodeURIComponent(query + ' audiobook')}&type=audio`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        throw new Error('Failed to search for audiobooks');
      }

      const results = await res.json();

      // Filter results to likely be audiobooks
      const audiobookResults = results.filter((r: any) => {
        const titleLower = r.title.toLowerCase();
        return (
          titleLower.includes('audiobook') ||
          titleLower.includes('audio book') ||
          titleLower.includes('unabridged') ||
          titleLower.includes('abridged') ||
          titleLower.includes('narrated') ||
          titleLower.includes('mp3') ||
          titleLower.includes('m4b') ||
          r.categories?.some((c: any) =>
            c.name?.toLowerCase().includes('audio') ||
            c.id === 3030 || // Audiobook category
            c.id === 3000   // Audio category
          )
        );
      });

      // Map to our interface
      const mapped: Audiobook[] = audiobookResults.map((r: any, index: number) => ({
        id: `${r.guid || index}-${Date.now()}`,
        title: r.title,
        indexer: r.indexer || 'Unknown',
        size: r.size || 0,
        seeders: r.seeders || 0,
        leechers: r.leechers || 0,
        magnetUrl: r.magnetUrl,
        downloadUrl: r.downloadUrl,
        publishDate: r.publishDate
      }));

      // Sort by seeders
      mapped.sort((a, b) => b.seeders - a.seeders);

      setSearchResults(mapped);
      searchCache.set(cacheKey, mapped, 5 * 60 * 1000);

      if (mapped.length === 0) {
        setError('No audiobooks found. Try a different search term or add more indexers in Prowlarr.');
      }
    } catch (err: any) {
      console.error('Audiobook search failed:', err);
      setError(err.message || 'Failed to search for audiobooks');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleDownload = async (audiobook: Audiobook) => {
    if (downloadingTorrent) return;

    setDownloadingTorrent(audiobook.id);
    setDownloadMessage(null);

    try {
      const response = await fetch(`${API_BASE}/torrents/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          magnetUrl: audiobook.magnetUrl,
          downloadUrl: audiobook.downloadUrl,
          title: audiobook.title,
          category: 'Audiobooks'
        })
      });

      if (response.ok) {
        setDownloadMessage(`Downloading: ${audiobook.title}`);
        setTimeout(() => setDownloadMessage(null), 5000);
      } else if (response.status === 409) {
        setDownloadMessage(`Already downloading: ${audiobook.title}`);
        setTimeout(() => setDownloadMessage(null), 5000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to download');
      }
    } catch (error: any) {
      setDownloadMessage(`Error: ${error.message}`);
      setTimeout(() => setDownloadMessage(null), 5000);
    } finally {
      setDownloadingTorrent(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getIndexerColor = (indexer: string): string => {
    const indexerLower = indexer.toLowerCase();
    if (indexerLower.includes('mam') || indexerLower.includes('myanonamouse')) return 'bg-purple-600/20 text-purple-400';
    if (indexerLower.includes('audiobookbay')) return 'bg-orange-600/20 text-orange-400';
    if (indexerLower.includes('librivox')) return 'bg-green-600/20 text-green-400';
    if (indexerLower.includes('piratebay')) return 'bg-pink-600/20 text-pink-400';
    if (indexerLower.includes('1337x')) return 'bg-orange-600/20 text-orange-400';
    return 'bg-indigo-600/20 text-indigo-400';
  };

  const addToWatchlist = async (audiobook: Audiobook) => {
    try {
      await fetch(`${API_BASE}/bookmarks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'audiobook',
          title: audiobook.title,
          description: `From ${audiobook.indexer}`
        })
      });
      fetchBookmarks();
    } catch (err) {
      console.error('Failed to add to watchlist:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Headphones className="w-8 h-8 text-purple-400" />
              <h1 className="text-3xl font-bold">Audiobooks</h1>
            </div>
            <div className="flex items-center gap-3">
              {checkingVpn ? (
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" /> Checking VPN...
                </span>
              ) : vpnConnected ? (
                <span className="text-green-400 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span> VPN Connected
                </span>
              ) : (
                <span className="text-yellow-400 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span> VPN Not Connected
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audiobooks... (e.g., 'Project Hail Mary', 'Stephen King')"
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Download Message */}
        {downloadMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            downloadMessage.startsWith('Downloading')
              ? 'bg-green-900/30 border-green-500/50 text-green-300'
              : downloadMessage.startsWith('Already')
              ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300'
              : 'bg-red-900/30 border-red-500/50 text-red-300'
          }`}>
            {downloadMessage}
            {downloadMessage.startsWith('Downloading') && (
              <Link to="/downloads" className="ml-2 underline hover:text-green-100">
                View Downloads
              </Link>
            )}
          </div>
        )}

        {/* VPN Warning */}
        {!checkingVpn && !vpnConnected && (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              VPN is not connected. Please enable your VPN before downloading audiobooks.
            </p>
          </div>
        )}

        {/* Empty State - No Search */}
        {!searchQuery && searchResults.length === 0 && (
          <div className="text-center py-16">
            <Headphones className="w-24 h-24 text-gray-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-300 mb-4">Search for Audiobooks</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              Search for your favorite audiobooks by title, author, or narrator.
              Results are sourced from Prowlarr indexers.
            </p>

            {/* Quick Search Suggestions */}
            <div className="max-w-2xl mx-auto">
              <p className="text-gray-500 text-sm mb-3">Popular searches:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Project Hail Mary', 'Dune', 'The Hobbit', 'Harry Potter', 'Stephen King', 'Brandon Sanderson'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookmarked Audiobooks */}
            {!loadingBookmarks && bookmarkedAudiobooks.length > 0 && (
              <div className="mt-12">
                <h3 className="text-xl font-semibold text-gray-300 mb-4">Your Watchlist</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {bookmarkedAudiobooks.map(book => (
                    <button
                      key={book.id}
                      onClick={() => setSearchQuery(book.title)}
                      className="px-4 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-colors flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 fill-purple-400 text-purple-400" />
                      {book.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-400">Searching for audiobooks...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && searchResults.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* Search Results */}
        {!loading && searchResults.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-6 text-gray-200">
              Found {searchResults.length} audiobooks for "{searchQuery}"
            </h2>

            <div className="space-y-3">
              {searchResults.map(audiobook => (
                <div
                  key={audiobook.id}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50 rounded-lg p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white mb-2 line-clamp-2">{audiobook.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                        <span className={`px-2 py-1 rounded font-medium ${getIndexerColor(audiobook.indexer)}`}>
                          {audiobook.indexer}
                        </span>
                        <span>{formatSize(audiobook.size)}</span>
                        <span className="text-green-400 font-semibold"> {audiobook.seeders}</span>
                        <span className="text-red-400"> {audiobook.leechers}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addToWatchlist(audiobook)}
                        className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                        title="Add to Watchlist"
                      >
                        <Star className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDownload(audiobook)}
                        disabled={!vpnConnected || downloadingTorrent === audiobook.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          !vpnConnected
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : downloadingTorrent === audiobook.id
                            ? 'bg-purple-700 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {downloadingTorrent === audiobook.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {downloadingTorrent === audiobook.id ? 'Adding...' : 'Download'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
