import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, Search, Download, Star, Loader, BookOpen, Calendar, User } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { API_BASE } from '@/lib/config';

interface Book {
  id: string;
  title: string;
  authors: string[];
  authorKeys: string[];
  coverUrl: string | null;
  year: number | null;
  subjects: string[];
  workKey: string;
  editionCount: number;
  description?: string;
}

interface Genre {
  id: string;
  name: string;
  emoji: string;
}

interface TorrentResult {
  id: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  magnetUrl?: string;
  downloadUrl?: string;
}

type ViewMode = 'browse' | 'search';

export default function Audiobooks() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  // Book catalog state
  const [books, setBooks] = useState<Book[]>([]);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Selected book for download modal
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [torrentResults, setTorrentResults] = useState<TorrentResult[]>([]);
  const [loadingTorrents, setLoadingTorrents] = useState(false);
  const [torrentError, setTorrentError] = useState<string | null>(null);

  // VPN and download state
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(true);
  const [downloadingTorrent, setDownloadingTorrent] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Load initial data - use ref to prevent double-mount in React Strict Mode
  const hasInitialized = React.useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      checkVpnStatus();
      fetchBookmarks();
      await fetchGenres();
      // Delay to let API settle before batch requests
      await new Promise(r => setTimeout(r, 300));
      loadInitialBooks(null);
    };
    init();
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

  const fetchGenres = async () => {
    try {
      const res = await fetch(`${API_BASE}/audiobooks/genres`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGenres(data.genres || []);
      }
    } catch (err) {
      console.error('Failed to fetch genres:', err);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks?type=audiobook`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>(
          data.bookmarks.map((b: any) => b.external_id || b.metadata?.external_id || b.title)
        );
        setBookmarkedIds(ids);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    }
  };

  // Load initial books (multiple pages at once)
  const loadInitialBooks = async (genreId: string | null) => {
    setLoading(true);
    setBooks([]);
    setCurrentPage(1);

    try {
      if (genreId) {
        // Load from specific genre
        const res = await fetch(
          `${API_BASE}/audiobooks/genre/${genreId}/batch?startPage=1&numPages=10&limit=20`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setBooks(data.results || []);
          setTotalResults(data.total || 0);
          setTotalPages(data.totalPages || 1);
          setCurrentPage(data.page || 10);
        }
      } else {
        // Load "all books" from popular genres - load in smaller batches to avoid overwhelming the API
        const popularGenres = ['fiction', 'science_fiction', 'fantasy', 'mystery', 'thriller', 'romance', 'history', 'horror'];

        // Load in two batches of 4 to reduce parallel load
        const batch1 = popularGenres.slice(0, 4);
        const batch2 = popularGenres.slice(4);

        const results1 = await Promise.all(
          batch1.map(g =>
            fetch(`${API_BASE}/audiobooks/genre/${g}/batch?startPage=1&numPages=3&limit=20`, { credentials: 'include' })
              .then(r => r.ok ? r.json() : { results: [], total: 0 })
              .catch(() => ({ results: [], total: 0 }))
          )
        );

        // Delay between batches to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));

        const results2 = await Promise.all(
          batch2.map(g =>
            fetch(`${API_BASE}/audiobooks/genre/${g}/batch?startPage=1&numPages=3&limit=20`, { credentials: 'include' })
              .then(r => r.ok ? r.json() : { results: [], total: 0 })
              .catch(() => ({ results: [], total: 0 }))
          )
        );

        const results = [...results1, ...results2];

        // Combine and deduplicate all books
        const allBooks = results.flatMap(r => r.results || []);
        const uniqueBooks = Array.from(new Map(allBooks.map(b => [b.id, b])).values());

        // Shuffle for variety
        for (let i = uniqueBooks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [uniqueBooks[i], uniqueBooks[j]] = [uniqueBooks[j], uniqueBooks[i]];
        }

        // Calculate total from all genres
        const totalFromAllGenres = results.reduce((sum, r) => sum + (r.total || 0), 0);

        setBooks(uniqueBooks);
        setTotalResults(totalFromAllGenres);
        setTotalPages(999); // Allow infinite scroll for "all"
        setCurrentPage(3);
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load more books (for infinite scroll)
  const loadMoreBooks = async () => {
    if (loadingMore || currentPage >= totalPages) return;

    setLoadingMore(true);
    try {
      if (selectedGenre) {
        // Load more from selected genre
        const nextPage = currentPage + 1;
        const res = await fetch(
          `${API_BASE}/audiobooks/genre/${selectedGenre.id}/batch?startPage=${nextPage}&numPages=3&limit=20`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setBooks(prev => {
            const combined = [...prev, ...(data.results || [])];
            return Array.from(new Map(combined.map(b => [b.id, b])).values());
          });
          setCurrentPage(data.page || nextPage + 2);
        }
      } else {
        // Load more from random genres for "all books"
        const allGenres = ['fiction', 'science_fiction', 'fantasy', 'mystery', 'thriller', 'romance', 'history', 'biography', 'horror', 'humor', 'classics', 'young_adult'];
        const randomGenres = allGenres.sort(() => Math.random() - 0.5).slice(0, 4);
        const nextPage = currentPage + 1;

        const promises = randomGenres.map(g =>
          fetch(`${API_BASE}/audiobooks/genre/${g}/batch?startPage=${nextPage}&numPages=2&limit=20`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { results: [] })
            .catch(() => ({ results: [] }))
        );

        const results = await Promise.all(promises);
        const newBooks = results.flatMap(r => r.results || []);

        setBooks(prev => {
          const combined = [...prev, ...newBooks];
          const unique = Array.from(new Map(combined.map(b => [b.id, b])).values());
          // Shuffle the new additions
          return unique;
        });
        setCurrentPage(nextPage + 1);
      }
    } catch (err) {
      console.error('Failed to load more books:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle genre selection (click again to deselect)
  const handleGenreSelect = async (genre: Genre | null) => {
    if (genre && selectedGenre?.id === genre.id) {
      // Clicking same genre - deselect and show all
      setSelectedGenre(null);
      setViewMode('browse');
      setSearchQuery('');
      await loadInitialBooks(null);
    } else {
      // Select new genre
      setSelectedGenre(genre);
      setViewMode('browse');
      setSearchQuery('');
      await loadInitialBooks(genre?.id || null);
    }
  };

  // Infinite scroll
  const hasMore = currentPage < totalPages;
  useInfiniteScroll({
    onLoadMore: loadMoreBooks,
    hasMore: hasMore && viewMode === 'browse',
    isLoading: loading || loadingMore,
    threshold: 1200,
    useWindow: true,
  });

  // Debounced catalog search
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      if (viewMode === 'search') {
        setViewMode('browse');
      }
      setSearchResults([]);
      return;
    }

    performCatalogSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  const performCatalogSearch = async (query: string) => {
    setSearchLoading(true);
    setViewMode('search');
    try {
      const res = await fetch(`${API_BASE}/audiobooks/search?q=${encodeURIComponent(query)}&limit=100`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Catalog search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // When a book is selected, search for torrents
  const handleBookClick = async (book: Book) => {
    setSelectedBook(book);
    setTorrentResults([]);
    setTorrentError(null);
    setLoadingTorrents(true);

    try {
      const searchTerms = [book.title];
      if (book.authors.length > 0) {
        searchTerms.push(book.authors[0]);
      }
      const query = searchTerms.join(' ') + ' audiobook';

      const res = await fetch(
        `${API_BASE}/prowlarr/search?query=${encodeURIComponent(query)}&type=audio`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Failed to search torrents');

      const results = await res.json();

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
            c.id === 3030 ||
            c.id === 3000
          )
        );
      });

      const mapped: TorrentResult[] = audiobookResults.map((r: any, i: number) => ({
        id: `${r.guid || i}-${Date.now()}`,
        title: r.title,
        indexer: r.indexer || 'Unknown',
        size: r.size || 0,
        seeders: r.seeders || 0,
        leechers: r.leechers || 0,
        magnetUrl: r.magnetUrl,
        downloadUrl: r.downloadUrl,
      }));

      mapped.sort((a, b) => b.seeders - a.seeders);
      setTorrentResults(mapped);

      if (mapped.length === 0) {
        setTorrentError('No audiobook torrents found. Try searching with different terms.');
      }
    } catch (err: any) {
      setTorrentError(err.message || 'Failed to search for torrents');
    } finally {
      setLoadingTorrents(false);
    }
  };

  const handleDownload = async (torrent: TorrentResult) => {
    if (downloadingTorrent) return;

    setDownloadingTorrent(torrent.id);
    try {
      // Build thumbnail URL for audiobook (use cover proxy)
      const audiobookThumbnail = selectedBook?.coverUrl
        ? `${API_BASE}/audiobooks/cover?url=${encodeURIComponent(selectedBook.coverUrl)}`
        : null;

      const response = await fetch(`${API_BASE}/torrents/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          magnetUrl: torrent.magnetUrl,
          downloadUrl: torrent.downloadUrl,
          title: torrent.title,
          category: 'Audiobooks',
          thumbnail: audiobookThumbnail
        })
      });

      if (response.ok) {
        setDownloadMessage(`Downloading: ${selectedBook?.title || torrent.title}`);
        setTimeout(() => setDownloadMessage(null), 5000);
        setSelectedBook(null);
      } else if (response.status === 409) {
        setDownloadMessage('Already in downloads');
        setTimeout(() => setDownloadMessage(null), 3000);
      } else {
        throw new Error('Failed to start download');
      }
    } catch (err: any) {
      setDownloadMessage(`Error: ${err.message}`);
      setTimeout(() => setDownloadMessage(null), 5000);
    } finally {
      setDownloadingTorrent(null);
    }
  };

  const isBookBookmarked = (book: Book) =>
    bookmarkedIds.has(book.id) || bookmarkedIds.has(book.title);

  const toggleBookmark = async (book: Book, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isBookmarked = isBookBookmarked(book);

    try {
      if (isBookmarked) {
        const res = await fetch(`${API_BASE}/bookmarks?type=audiobook`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const bookmark = data.bookmarks.find(
            (b: any) => b.external_id === book.id || b.metadata?.external_id === book.id || b.title === book.title
          );
          if (bookmark) {
            await fetch(`${API_BASE}/bookmarks/${bookmark.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });
          }
        }
        setBookmarkedIds(prev => {
          const next = new Set(prev);
          next.delete(book.id);
          next.delete(book.title);
          return next;
        });
      } else {
        await fetch(`${API_BASE}/bookmarks`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'audiobook',
            external_id: book.id,
            title: book.title,
            description: book.authors.join(', '),
            thumbnail: book.coverUrl
          })
        });
        setBookmarkedIds(prev => new Set(prev).add(book.id));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
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

  const BookCard = ({ book }: { book: Book }) => {
    const isBookmarked = isBookBookmarked(book);
    const coverSrc = book.coverUrl
      ? `${API_BASE}/audiobooks/cover?url=${encodeURIComponent(book.coverUrl)}`
      : null;

    return (
      <div
        className="group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-2xl w-48 flex-shrink-0"
        onClick={() => handleBookClick(book)}
      >
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="w-full h-72 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-72 bg-gradient-to-br from-purple-900 to-gray-800 flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-purple-400/50" />
          </div>
        )}

        <button
          onClick={(e) => toggleBookmark(book, e)}
          className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all z-20 ${
            isBookmarked
              ? 'bg-yellow-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          <Star className={`w-4 h-4 ${isBookmarked ? 'fill-white' : ''}`} />
        </button>

        {book.year && (
          <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-md font-bold text-xs shadow-lg">
            {book.year}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 p-3 w-full">
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-2">{book.title}</h3>
            {book.authors.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-300">
                <User className="w-3 h-3" />
                <span className="line-clamp-1">{book.authors.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentBooks = viewMode === 'search' ? searchResults : books;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Headphones className="w-8 h-8 text-purple-400" />
              <h1 className="text-3xl font-bold">
                {selectedGenre ? `${selectedGenre.emoji} ${selectedGenre.name}` : '📚 All Books'}
              </h1>
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audiobooks by title or author..."
              className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Popular Authors */}
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Popular Authors:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Stephen King',
                'Agatha Christie',
                'George Orwell',
                'Aldous Huxley',
                'Ray Bradbury',
                'Philip K. Dick',
                'Franz Kafka',
                'Fyodor Dostoevsky',
                'Kurt Vonnegut',
                'H.G. Wells',
                'Isaac Asimov',
                'Arthur C. Clarke',
                'Margaret Atwood',
                'J.R.R. Tolkien',
                'Ernest Hemingway',
                'Leo Tolstoy',
                'Jules Verne',
                'Edgar Allan Poe',
                'H.P. Lovecraft',
                'Bram Stoker'
              ].map(author => (
                <button
                  key={author}
                  onClick={() => setSearchQuery(author)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    searchQuery === author
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-purple-600/30 hover:text-purple-300 border border-gray-700 hover:border-purple-500/50'
                  }`}
                >
                  {author}
                </button>
              ))}
            </div>
          </div>
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

        {/* Genre Pills */}
        {viewMode === 'browse' && !searchQuery && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">Browse by Genre</h2>
            <div className="flex flex-wrap gap-2">
              {/* All Books button */}
              <button
                onClick={() => handleGenreSelect(null)}
                className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                  selectedGenre === null
                    ? 'bg-purple-600 text-white border border-purple-400'
                    : 'bg-gray-800 hover:bg-purple-600/30 border border-gray-700 hover:border-purple-500/50 text-gray-300'
                }`}
              >
                <span>📚</span>
                <span>All Books</span>
              </button>
              {genres.map(genre => (
                <button
                  key={genre.id}
                  onClick={() => handleGenreSelect(genre)}
                  className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                    selectedGenre?.id === genre.id
                      ? 'bg-purple-600 text-white border border-purple-400'
                      : 'bg-gray-800 hover:bg-purple-600/30 border border-gray-700 hover:border-purple-500/50 text-gray-300'
                  }`}
                >
                  <span>{genre.emoji}</span>
                  <span>{genre.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Info - Like Documentaries */}
        {viewMode === 'browse' && !loading && books.length > 0 && (
          <div className="mb-6 bg-gray-800/50 p-4 rounded-lg border-l-4 border-purple-500">
            <div className="space-y-2">
              <div className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400">Loaded:</span>{' '}
                <span className="font-bold text-white">{books.length.toLocaleString()}</span> of{' '}
                <span className="font-bold text-purple-400">{totalResults.toLocaleString()}</span>{' '}
                <span className="text-gray-400">books</span>
                {loadingMore && <Loader className="w-4 h-4 animate-spin text-purple-400" />}
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-gray-500">Total catalog:</span>{' '}
                <span className="font-semibold text-gray-400">{totalResults.toLocaleString()}+ books {selectedGenre ? `in ${selectedGenre.name}` : 'across all genres'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading audiobooks...</p>
          </div>
        )}

        {/* Search Loading */}
        {searchLoading && (
          <div className="text-center py-12">
            <Loader className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-400">Searching...</p>
          </div>
        )}

        {/* Books Grid */}
        {!loading && !searchLoading && currentBooks.length > 0 && (
          <div>
            {viewMode === 'search' && (
              <h2 className="text-xl font-bold mb-6 text-gray-200">
                Found {currentBooks.length} results for "{searchQuery}"
              </h2>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {currentBooks.map(book => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="text-center mt-8 py-8">
                <Loader className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                <p className="text-gray-400 mt-3 text-sm">Loading more books...</p>
              </div>
            )}

            {/* End of results - only show for specific genres, not "all books" */}
            {!loadingMore && viewMode === 'browse' && selectedGenre && currentPage >= totalPages && books.length > 0 && (
              <div className="text-center mt-8 py-6">
                <div className="inline-block bg-green-900/30 border border-green-500/50 rounded-lg px-6 py-3">
                  <p className="text-green-400 font-medium">All {books.length.toLocaleString()} books loaded</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !searchLoading && currentBooks.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No audiobooks found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Book Detail / Download Modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBook(null)}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-6 p-6">
              {selectedBook.coverUrl ? (
                <img
                  src={`${API_BASE}/audiobooks/cover?url=${encodeURIComponent(selectedBook.coverUrl)}`}
                  alt={selectedBook.title}
                  className="w-32 h-48 object-cover rounded-lg shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-32 h-48 bg-gradient-to-br from-purple-900 to-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-12 h-12 text-purple-400/50" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold mb-2">{selectedBook.title}</h2>
                {selectedBook.authors.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <User className="w-4 h-4" />
                    <span>{selectedBook.authors.join(', ')}</span>
                  </div>
                )}
                {selectedBook.year && (
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedBook.year}</span>
                  </div>
                )}
                {selectedBook.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedBook.subjects.slice(0, 4).map((subject, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                        {subject}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-400" />
                Available Downloads
              </h3>

              {loadingTorrents && (
                <div className="text-center py-8">
                  <Loader className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Searching for audiobook torrents...</p>
                </div>
              )}

              {torrentError && !loadingTorrents && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-yellow-300 text-sm">
                  {torrentError}
                </div>
              )}

              {!loadingTorrents && torrentResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {torrentResults.map(torrent => (
                    <div
                      key={torrent.id}
                      className="bg-gray-900/50 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 rounded-lg p-3 cursor-pointer transition-all"
                      onClick={() => handleDownload(torrent)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white mb-1 line-clamp-2">{torrent.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                            <span className={`px-2 py-0.5 rounded font-medium ${getIndexerColor(torrent.indexer)}`}>
                              {torrent.indexer}
                            </span>
                            <span>{formatSize(torrent.size)}</span>
                            <span className="text-green-400 font-semibold">↑ {torrent.seeders}</span>
                            <span className="text-red-400">↓ {torrent.leechers}</span>
                          </div>
                        </div>
                        {downloadingTorrent === torrent.id ? (
                          <Loader className="w-5 h-5 animate-spin text-purple-400 flex-shrink-0" />
                        ) : (
                          <Download className="w-5 h-5 text-purple-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!vpnConnected && (
                <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
                  VPN is not connected. Enable VPN before downloading.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
