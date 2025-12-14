import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';

interface Documentary {
  id: number;
  title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  year: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  imdb_id?: string | null;
  imdb_rating?: string | null;
  imdb_votes?: string | null;
}

interface Genre {
  id: number;
  name: string;
}

interface GenreSection {
  id: number;
  name: string;
  emoji: string;
  documentaries: Documentary[];
  loading: boolean;
}

type ViewMode = 'browse' | 'search' | 'genre' | 'all-documentaries' | 'top-rated';

export default function Documentaries() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<Documentary[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocumentary, setSelectedDocumentary] = useState<Documentary | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all-documentaries');
  const [showFormatPreview, setShowFormatPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
  const [formattedPath, setFormattedPath] = useState<any>(null);
  const [loadingFormat, setLoadingFormat] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(false);

  // Torrent search state
  const [torrentResults, setTorrentResults] = useState<any[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  // Browse mode sections
  const [genreSections, setGenreSections] = useState<GenreSection[]>([]);
  const [trendingDocumentaries, setTrendingDocumentaries] = useState<Documentary[]>([]);
  const [topRatedDocumentaries, setTopRatedDocumentaries] = useState<Documentary[]>([]);
  const [recentDocumentaries, setRecentDocumentaries] = useState<Documentary[]>([]);

  // Genre view state
  const [selectedGenre, setSelectedGenre] = useState<GenreSection | null>(null);
  const [genreDocumentaries, setGenreDocumentaries] = useState<Documentary[]>([]);
  const [genreCurrentPage, setGenreCurrentPage] = useState(1);
  const [genreTotalPages, setGenreTotalPages] = useState(1);
  const [genreLoading, setGenreLoading] = useState(false);

  // All documentaries / Top Rated view state
  const [allDocumentaries, setAllDocumentaries] = useState<Documentary[]>([]);
  const [allDocumentariesPage, setAllDocumentariesPage] = useState(1);
  const [allDocumentariesTotalPages, setAllDocumentariesTotalPages] = useState(1);
  const [allDocumentariesTotalResults, setAllDocumentariesTotalResults] = useState(0);
  const [allDocumentariesLoading, setAllDocumentariesLoading] = useState(false);
  const [loadingMultiplePages, setLoadingMultiplePages] = useState(false);

  // All documentaries filters (default to NO filters - show everything, let users customize)
  const [allDocumentariesFilters, setAllDocumentariesFilters] = useState({
    minRating: 0,
    minVotes: 0,
    yearFrom: null as number | null,
    yearTo: null as number | null,
    sortBy: 'popularity.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc',
    selectedGenres: [] as number[],
    excludeGenres: [] as number[]
  });
  const [showAllDocumentariesFilters, setShowAllDocumentariesFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Genre filters
  const [genreFilters, setGenreFilters] = useState({
    minRating: 0,
    minVotes: 50,
    year: null as number | null,
    sortBy: 'vote_average.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc' | 'vote_count.desc'
  });
  const [showGenreFilters, setShowGenreFilters] = useState(false);

  // Watchlist state
  const [bookmarkedDocumentaries, setBookmarkedDocumentaries] = useState<Set<number>>(new Set());
  const [downloadedDocumentaries, setDownloadedDocumentaries] = useState<Set<number>>(new Set());

  const API_BASE = 'http://localhost:3001/api/v1';

  const isInitialMount = React.useRef(true);
  const restoringScroll = React.useRef(false);
  const scrollPositionSaved = React.useRef(false);

  // Load documentaries on mount
  useEffect(() => {
    fetchGenres();
    setShowAllDocumentariesFilters(true);

    // Try to restore browse state from sessionStorage
    const savedBrowseState = sessionStorage.getItem('documentariesBrowseState');
    if (savedBrowseState) {
      try {
        const { documentaries, page, totalPages, totalResults, viewMode: savedViewMode, scrollY } = JSON.parse(savedBrowseState);
        restoringScroll.current = true;
        setAllDocumentaries(documentaries || []);
        setAllDocumentariesPage(page || 1);
        setAllDocumentariesTotalPages(totalPages || 1);
        setAllDocumentariesTotalResults(totalResults || 0);
        setViewMode(savedViewMode || 'all-documentaries');

        // Restore scroll position after a short delay to ensure content is rendered
        setTimeout(() => {
          if (typeof scrollY === 'number') {
            window.scrollTo(0, scrollY);
          }
          restoringScroll.current = false;
        }, 100);
      } catch (e) {
        console.error('Failed to restore browse state:', e);
        restoringScroll.current = false;
      }
    }

    // Try to load saved filters from localStorage
    const savedFilters = localStorage.getItem('documentariesFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setAllDocumentariesFilters(parsed);
        setActivePreset('saved');
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    // Only load documentaries if we didn't restore state
    if (!savedBrowseState) {
      loadDocumentaries();
    }
  }, []);

  // Watch for filter changes and reload
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (viewMode === 'all-documentaries' || viewMode === 'top-rated') {
      const timeoutId = setTimeout(() => {
        loadManyPages(1, 10, viewMode, false); // Load 10 pages when filters change
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [allDocumentariesFilters.minRating, allDocumentariesFilters.minVotes, allDocumentariesFilters.sortBy, allDocumentariesFilters.yearFrom, allDocumentariesFilters.yearTo, allDocumentariesFilters.selectedGenres, allDocumentariesFilters.excludeGenres]);

  // Save browse state to sessionStorage when it changes
  useEffect(() => {
    if (restoringScroll.current || allDocumentaries.length === 0) return;

    const browseState = {
      documentaries: allDocumentaries,
      page: allDocumentariesPage,
      totalPages: allDocumentariesTotalPages,
      totalResults: allDocumentariesTotalResults,
      viewMode,
      scrollY: window.scrollY
    };

    sessionStorage.setItem('documentariesBrowseState', JSON.stringify(browseState));
  }, [allDocumentaries, allDocumentariesPage, allDocumentariesTotalPages, allDocumentariesTotalResults, viewMode]);

  // Save scroll position on scroll events
  useEffect(() => {
    const saveScrollPosition = () => {
      if (restoringScroll.current) return;

      const savedState = sessionStorage.getItem('documentariesBrowseState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          state.scrollY = window.scrollY;
          sessionStorage.setItem('documentariesBrowseState', JSON.stringify(state));
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    const handleScroll = () => {
      if (restoringScroll.current) return;
      // Debounce scroll saves
      if (!scrollPositionSaved.current) {
        scrollPositionSaved.current = true;
        setTimeout(() => {
          saveScrollPosition();
          scrollPositionSaved.current = false;
        }, 200);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load bookmarked documentaries
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const res = await fetch(`${API_BASE}/bookmarks?type=tmdb_documentary`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const bookmarkedIds = new Set(data.bookmarks.map((b: any) => b.tmdb_id));
          setBookmarkedDocumentaries(bookmarkedIds);
        }
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
      }
    };
    fetchBookmarks();
  }, []);

  // Load downloaded documentaries
  useEffect(() => {
    const fetchDownloaded = async () => {
      try {
        const res = await fetch(`${API_BASE}/media/downloaded-tmdb-ids`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setDownloadedDocumentaries(new Set(data.documentary || []));
        }
      } catch (err) {
        console.error('Failed to fetch downloaded documentaries:', err);
      }
    };
    fetchDownloaded();
  }, []);

  // Function to load documentaries based on current filters
  const loadDocumentaries = () => {
    loadManyPages(1, 10, 'all-documentaries'); // Load 10 pages initially (~200 documentaries)
  };

  // Genre configuration with emojis - documentary subgenres
  const GENRE_CONFIG = [
    { id: 99, name: 'All Documentaries', emoji: '🎥' },
    { id: 36, name: 'History', emoji: '📜' },
    { id: 10752, name: 'War', emoji: '⚔️' },
    { id: 80, name: 'Crime', emoji: '🔍' },
    { id: 10402, name: 'Music', emoji: '🎵' },
    { id: 18, name: 'Drama', emoji: '🎭' },
  ];

  useEffect(() => {
    fetchGenres();
    loadBrowseSections();
  }, []);

  const fetchGenres = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/genres/movies`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setGenres(data.genres || []);
      }
    } catch (err) {
      console.error('Failed to fetch genres:', err);
    }
  };

  const loadBrowseSections = async () => {
    // Load special sections
    fetchTrending();
    fetchTopRated();
    fetchNowPlaying();

    // Load genre sections
    const sections: GenreSection[] = GENRE_CONFIG.map(config => ({
      ...config,
      documentaries: [],
      loading: true
    }));
    setGenreSections(sections);

    // Fetch top-rated documentaries for each genre
    GENRE_CONFIG.forEach(config => {
      fetchGenreSection(config.id, config.name, config.emoji);
    });
  };

  const fetchTrending = async () => {
    try {
      // Use discover with documentary genre (99) sorted by popularity
      const res = await fetch(`${API_BASE}/tmdb/discover/movies?genre=99&sort_by=popularity.desc&page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by popularity for trending
        const sorted = (data.results || []).sort((a: Documentary, b: Documentary) =>
          b.popularity - a.popularity
        );
        setTrendingDocumentaries(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch trending:', err);
    }
  };

  const fetchTopRated = async () => {
    try {
      // Use discover with documentary genre (99) sorted by rating - relaxed filters for more results
      const res = await fetch(`${API_BASE}/tmdb/discover/movies?genre=99&sort_by=vote_average.desc&page=1&min_rating=6&min_votes=100`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by rating to guarantee perfect order
        const sorted = (data.results || []).sort((a: Documentary, b: Documentary) =>
          b.vote_average - a.vote_average
        );
        setTopRatedDocumentaries(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch top rated:', err);
    }
  };

  const fetchNowPlaying = async () => {
    try {
      // Use discover with documentary genre (99) sorted by release date
      const res = await fetch(`${API_BASE}/tmdb/discover/movies?genre=99&sort_by=release_date.desc&page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by release date (newest first)
        const sorted = (data.results || []).sort((a: Documentary, b: Documentary) => {
          const yearA = a.year ? parseInt(a.year) : 0;
          const yearB = b.year ? parseInt(b.year) : 0;
          return yearB - yearA;
        });
        setRecentDocumentaries(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch now playing:', err);
    }
  };

  const fetchGenreSection = async (genreId: number, genreName: string, emoji: string) => {
    try {
      // Browse mode: Show quality documentaries (relaxed filters for more variety)
      // If it's the Documentary genre (99), use only that genre. Otherwise, combine with documentary genre
      const genreParam = genreId === 99 ? '99' : `99,${genreId}`;
      const res = await fetch(
        `${API_BASE}/tmdb/discover/movies?genre=${genreParam}&sort_by=vote_average.desc&page=1&min_rating=6&min_votes=50`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        // Client-side re-sort to guarantee perfect descending order
        const sortedDocumentaries = (data.results || []).sort((a: Documentary, b: Documentary) =>
          b.vote_average - a.vote_average
        );
        setGenreSections(prev => prev.map(section =>
          section.id === genreId
            ? { ...section, documentaries: sortedDocumentaries, loading: false }
            : section
        ));
      }
    } catch (err) {
      console.error(`Failed to fetch ${genreName}:`, err);
      setGenreSections(prev => prev.map(section =>
        section.id === genreId
          ? { ...section, loading: false }
          : section
      ));
    }
  };

  const openGenreView = async (section: GenreSection) => {
    setSelectedGenre(section);
    setViewMode('genre');
    setGenreCurrentPage(1);
    setGenreFilters({
      minRating: 0,
      minVotes: 50,
      year: null,
      sortBy: 'vote_average.desc'
    });
    await fetchGenreDocumentaries(section.id, 1, {
      minRating: 0,
      minVotes: 50,
      year: null,
      sortBy: 'vote_average.desc'
    });
  };

  const fetchGenreDocumentaries = async (
    genreId: number,
    page: number,
    filters: typeof genreFilters
  ) => {
    setGenreLoading(true);
    try {
      // If it's the Documentary genre (99), use only that genre. Otherwise, combine with documentary genre
      const genreParam = genreId === 99 ? '99' : `99,${genreId}`;
      let url = `${API_BASE}/tmdb/discover/movies?genre=${genreParam}&sort_by=${filters.sortBy}&page=${page}&enrich=true`;
      if (filters.minRating > 0) url += `&min_rating=${filters.minRating}`;
      if (filters.minVotes > 0) url += `&min_votes=${filters.minVotes}`;
      if (filters.year) url += `&year=${filters.year}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let results = data.results || [];

        // Client-side re-sort to guarantee perfect order based on sortBy
        if (filters.sortBy === 'vote_average.desc') {
          results = results.sort((a: Documentary, b: Documentary) => {
            const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
            const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
            return ratingB - ratingA;
          });
        } else if (filters.sortBy === 'popularity.desc') {
          results = results.sort((a: Documentary, b: Documentary) => b.popularity - a.popularity);
        } else if (filters.sortBy === 'release_date.desc') {
          results = results.sort((a: Documentary, b: Documentary) => {
            const yearA = a.year ? parseInt(a.year) : 0;
            const yearB = b.year ? parseInt(b.year) : 0;
            return yearB - yearA;
          });
        } else if (filters.sortBy === 'vote_count.desc') {
          results = results.sort((a: Documentary, b: Documentary) => b.vote_count - a.vote_count);
        }

        if (page === 1) {
          setGenreDocumentaries(results);
        } else {
          // When loading more, merge and re-sort all documentaries
          const allDocumentaries = [...genreDocumentaries, ...results];
          if (filters.sortBy === 'vote_average.desc') {
            setGenreDocumentaries(allDocumentaries.sort((a, b) => {
              const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
              const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
              return ratingB - ratingA;
            }));
          } else {
            setGenreDocumentaries(allDocumentaries);
          }
        }

        setGenreTotalPages(data.total_pages || 1);
        setGenreCurrentPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch genre documentaries:', err);
    } finally {
      setGenreLoading(false);
    }
  };

  const loadMoreGenreDocumentaries = () => {
    if (selectedGenre && genreCurrentPage < genreTotalPages && !genreLoading) {
      fetchGenreDocumentaries(selectedGenre.id, genreCurrentPage + 1, genreFilters);
    }
  };

  const applyGenreFilters = () => {
    if (selectedGenre) {
      fetchGenreDocumentaries(selectedGenre.id, 1, genreFilters);
    }
  };

  const openTopRatedView = async () => {
    setViewMode('top-rated');
    setAllDocumentariesPage(1);
    await fetchAllDocumentaries(1, 'top-rated');
  };

  const openAllDocumentariesView = async () => {
    setViewMode('all-documentaries');
    setAllDocumentariesPage(1);
    await fetchAllDocumentaries(1, 'all-documentaries');
  };

  const fetchAllDocumentaries = async (page: number, mode: 'all-documentaries' | 'top-rated', append = false) => {
    setAllDocumentariesLoading(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 6.5, minVotes: 200, sortBy: 'vote_average.desc' as const }
        : allDocumentariesFilters;

      // Always include documentary genre (99) as base
      let url = `${API_BASE}/tmdb/discover/movies?genre=99&sort_by=${filters.sortBy}&page=${page}&min_rating=${filters.minRating}&min_votes=${filters.minVotes}&enrich=true`;

      if (allDocumentariesFilters.yearFrom) url += `&year_from=${allDocumentariesFilters.yearFrom}`;
      if (allDocumentariesFilters.yearTo) url += `&year_to=${allDocumentariesFilters.yearTo}`;
      if (allDocumentariesFilters.selectedGenres.length > 0) {
        // Add additional genre filters (will be AND with documentary genre)
        url += `&with_genres=${allDocumentariesFilters.selectedGenres.join(',')}`;
      }
      if (allDocumentariesFilters.excludeGenres && allDocumentariesFilters.excludeGenres.length > 0) {
        url += `&exclude_genres=${allDocumentariesFilters.excludeGenres.join(',')}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setAllDocumentaries(prev => [...prev, ...(data.results || [])]);
        } else {
          setAllDocumentaries(data.results || []);
        }
        setAllDocumentariesTotalPages(data.total_pages || 1);
        setAllDocumentariesTotalResults(data.total_results || 0);
        setAllDocumentariesPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch all documentaries:', err);
    } finally {
      setAllDocumentariesLoading(false);
    }
  };

  // Load multiple pages at once for better browsing
  const loadManyPages = async (startPage: number, numPages: number, mode: 'all-documentaries' | 'top-rated', append = false) => {
    setLoadingMultiplePages(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 6.5, minVotes: 200, sortBy: 'vote_average.desc' as const }
        : allDocumentariesFilters;

      // Always include documentary genre (99) as base
      let baseUrl = `${API_BASE}/tmdb/discover/movies?genre=99&sort_by=${filters.sortBy}&min_rating=${filters.minRating}&min_votes=${filters.minVotes}&enrich=true`;
      if (allDocumentariesFilters.yearFrom) baseUrl += `&year_from=${allDocumentariesFilters.yearFrom}`;
      if (allDocumentariesFilters.yearTo) baseUrl += `&year_to=${allDocumentariesFilters.yearTo}`;
      if (allDocumentariesFilters.selectedGenres.length > 0) {
        baseUrl += `&with_genres=${allDocumentariesFilters.selectedGenres.join(',')}`;
      }
      if (allDocumentariesFilters.excludeGenres && allDocumentariesFilters.excludeGenres.length > 0) {
        baseUrl += `&exclude_genres=${allDocumentariesFilters.excludeGenres.join(',')}`;
      }

      // Fetch pages in parallel
      const promises = [];
      for (let i = 0; i < numPages; i++) {
        const page = startPage + i;
        promises.push(fetch(`${baseUrl}&page=${page}`, { credentials: 'include' }));
      }

      const responses = await Promise.all(promises);
      const dataPromises = responses.map(r => r.ok ? r.json() : null);
      const dataResults = await Promise.all(dataPromises);

      const newResults: Documentary[] = [];

      dataResults.forEach((data) => {
        if (data && data.results) {
          newResults.push(...data.results);
        }
      });

      // Get metadata from first valid response that has the data
      const firstValidResponse = dataResults.find(d => d && d.total_pages && d.total_results);
      const actualTotalPages = firstValidResponse?.total_pages || 1;
      const totalResults = firstValidResponse?.total_results || 0;

      // Deduplicate by documentary ID
      const uniqueDocumentaries = Array.from(
        new Map(newResults.map(doc => [doc.id, doc])).values()
      );

      if (append) {
        setAllDocumentaries(prev => {
          const combined = [...prev, ...uniqueDocumentaries];
          // Deduplicate combined array as well
          return Array.from(new Map(combined.map(doc => [doc.id, doc])).values());
        });
      } else {
        setAllDocumentaries(uniqueDocumentaries);
      }
      setAllDocumentariesTotalPages(actualTotalPages);
      setAllDocumentariesTotalResults(totalResults);
      setAllDocumentariesPage(startPage + numPages - 1);
    } catch (err) {
      console.error('Failed to load many pages:', err);
    } finally {
      setLoadingMultiplePages(false);
    }
  };

  const loadMoreAllDocumentaries = () => {
    if (allDocumentariesPage < allDocumentariesTotalPages && !allDocumentariesLoading && !loadingMultiplePages) {
      const mode = viewMode as 'all-documentaries' | 'top-rated';
      // Load 3 pages at a time during scroll (60 documentaries) for smooth performance
      const nextPage = allDocumentariesPage + 1;
      loadManyPages(nextPage, 3, mode, true);
    }
  };

  // Infinite scroll - consolidated into single hook to avoid conflicts
  const hasMoreGenre = viewMode === 'genre' && genreCurrentPage < genreTotalPages;
  const hasMoreAllDocumentaries = (viewMode === 'all-documentaries' || viewMode === 'top-rated') && allDocumentariesPage < allDocumentariesTotalPages;
  const hasMore = hasMoreGenre || hasMoreAllDocumentaries;
  const isLoadingAny = genreLoading || allDocumentariesLoading || loadingMultiplePages;

  const handleLoadMore = () => {
    if (viewMode === 'genre' && hasMoreGenre && !genreLoading) {
      loadMoreGenreDocumentaries();
    } else if ((viewMode === 'all-documentaries' || viewMode === 'top-rated') && hasMoreAllDocumentaries && !allDocumentariesLoading && !loadingMultiplePages) {
      loadMoreAllDocumentaries();
    }
  };

  useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore,
    isLoading: isLoadingAny,
    threshold: 1200,
    useWindow: true
  });

  // Debounced search - automatically triggers when user stops typing
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      if (viewMode === 'search') setViewMode('all-documentaries');
      return;
    }

    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    // Generate cache key
    const cacheKey = `documentaries:search:${query.toLowerCase()}`;

    // Check cache first
    const cachedResults = searchCache.get<Documentary[]>(cacheKey);
    if (cachedResults) {
      setSearchResults(cachedResults);
      setViewMode('search');
      return;
    }

    setLoading(true);
    setViewMode('search');
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/movies?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        // Filter results to only include documentaries (genre ID 99)
        const documentaries = (data.results || []).filter((doc: Documentary) =>
          doc.genre_ids && doc.genre_ids.includes(99)
        );
        setSearchResults(documentaries);

        // Cache results for 5 minutes
        searchCache.set(cacheKey, documentaries, 5 * 60 * 1000);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performSearch(searchQuery);
  };

  const search1337x = (documentary: Documentary) => {
    const query = encodeURIComponent(`${documentary.title} ${documentary.year || ''}`);
    window.open(`https://1337x.to/search/${query}/1/`, '_blank');
  };

  const searchPirateBay = (documentary: Documentary) => {
    const query = encodeURIComponent(`${documentary.title} ${documentary.year || ''}`);
    window.open(`https://thepiratebay.org/search.php?q=${query}`, '_blank');
  };

  const searchExtTo = (documentary: Documentary) => {
    const query = encodeURIComponent(`${documentary.title} ${documentary.year || ''}`);
    window.open(`https://ext.to/search?q=${query}`, '_blank');
  };

  const searchTorrents = async (documentary: Documentary) => {
    const query = `${documentary.title} ${documentary.year || ''}`;
    setSearchingTorrents(true);
    setTorrentSearchError(null);
    setTorrentResults([]);

    try {
      const response = await fetch(`${API_BASE}/torrents/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error('Failed to search torrents');
      }

      const data = await response.json();
      setTorrentResults(data.results || []);

      if (data.results.length === 0) {
        setTorrentSearchError('No torrents found. Try manual search instead.');
      }
    } catch (err: any) {
      console.error('Torrent search failed:', err);
      setTorrentSearchError(err.message || 'Failed to search torrents');
    } finally {
      setSearchingTorrents(false);
    }
  };

  const selectTorrent = (magnet: string) => {
    setDownloadUrl(magnet);
    setTorrentResults([]);
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

  const handleDownload = async (documentary: Documentary) => {
    if (!downloadUrl.trim()) {
      alert('Please enter a download URL');
      return;
    }

    // Extract filename from URL or use documentary title
    const filename = extractFilenameFromUrl(downloadUrl) || `${documentary.title} (${documentary.year}).mkv`;
    setPreviewFilename(filename);
    setLoadingFormat(true);
    setFormatError(null);
    setShowFormatPreview(true);

    // Check VPN status
    setCheckingVpn(true);
    fetch(`${API_BASE}/vpn/status`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setVpnConnected(data.connected || false);
        setCheckingVpn(false);
      })
      .catch(() => {
        setVpnConnected(false);
        setCheckingVpn(false);
      });

    // Fetch format preview
    try {
      const response = await fetch(`${API_BASE}/downloads/format-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filename,
          contentType: 'documentary',
          searchTMDB: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get format preview');
      }

      const data = await response.json();
      setFormattedPath(data.formatted);
    } catch (err: any) {
      setFormatError(err.message);
    } finally {
      setLoadingFormat(false);
    }
  };

  const extractFilenameFromUrl = (url: string): string | null => {
    try {
      // Try to extract filename from URL
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (filename && filename.includes('.')) {
        return filename;
      }
    } catch (e) {
      // Not a valid URL, might be a magnet link or other
    }
    return null;
  };

  const submitDownload = async (documentary: Documentary) => {
    if (!formattedPath) {
      alert('Please wait for format preview to load');
      return;
    }

    // Determine category from formatted path base directory
    const category = formattedPath.baseDir?.toLowerCase() || 'documentaries';

    try {
      const res = await fetch(`${API_BASE}/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: downloadUrl,
          category: category,
          formattedPath: formattedPath.formattedPath,
          jellyfinFormat: formattedPath,
          metadata: {
            tmdb_id: documentary.id,
            imdb_id: documentary.imdb_id,
            title: documentary.title,
            year: documentary.year,
            rating: documentary.vote_average,
            overview: documentary.overview,
            poster_url: documentary.poster_url,
            backdrop_url: documentary.backdrop_url,
            genre_ids: documentary.genre_ids
          },
          downloader: 'yt-dlp'
        })
      });

      if (res.ok) {
        alert(`✓ Download queued: ${documentary.title}`);
        setSelectedDocumentary(null);
        setDownloadUrl('');
        setShowFormatPreview(false);
        setFormattedPath(null);
        setVpnConnected(false);
      } else {
        const error = await res.json();
        alert(`Download failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please check your URL and try again.');
    }
  };

  const toggleBookmark = async (documentary: Documentary, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent opening the download modal

    const isBookmarked = bookmarkedDocumentaries.has(documentary.id);

    try {
      if (isBookmarked) {
        // Remove from watchlist
        const res = await fetch(`${API_BASE}/bookmarks/check-tmdb/${documentary.id}?mediaType=documentary`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (data.bookmark) {
          await fetch(`${API_BASE}/bookmarks/${data.bookmark.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          setBookmarkedDocumentaries(prev => {
            const next = new Set(prev);
            next.delete(documentary.id);
            return next;
          });
        }
      } else {
        // Add to watchlist
        await fetch(`${API_BASE}/bookmarks`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'tmdb_documentary',
            tmdb_id: documentary.id,
            media_type: 'documentary',
            title: documentary.title,
            description: documentary.overview,
            thumbnail: documentary.poster_url,
            backdrop_url: documentary.backdrop_url,
            release_year: documentary.year ? parseInt(documentary.year) : null,
            vote_average: documentary.vote_average
          })
        });
        setBookmarkedDocumentaries(prev => new Set(prev).add(documentary.id));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      alert('Failed to update watchlist');
    }
  };

  const DocumentaryCard = ({ documentary, size = 'normal' }: { documentary: Documentary; size?: 'normal' | 'small' }) => {
    // Color code ratings: 9+ = gold, 8-9 = green, 7-8 = blue, <7 = gray
    const getRatingColor = (rating: number) => {
      if (rating >= 9) return 'bg-yellow-500';
      if (rating >= 8) return 'bg-green-500';
      if (rating >= 7) return 'bg-blue-500';
      return 'bg-gray-500';
    };

    const rating = documentary.imdb_rating ? parseFloat(documentary.imdb_rating) : documentary.vote_average;
    const isBookmarked = bookmarkedDocumentaries.has(documentary.id);
    const isDownloaded = downloadedDocumentaries.has(documentary.id);

    return (
      <div
        className={`group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-2xl flex-shrink-0 ${
          size === 'small' ? 'w-40' : 'w-48'
        }`}
        onClick={() => setSelectedDocumentary(documentary)}
      >
        {documentary.poster_url ? (
          <img
            src={documentary.poster_url}
            alt={documentary.title}
            className={`w-full object-cover ${size === 'small' ? 'h-60' : 'h-72'}`}
          />
        ) : (
          <div className={`w-full bg-gray-700 flex items-center justify-center ${size === 'small' ? 'h-60' : 'h-72'}`}>
            <Film className="w-16 h-16 text-gray-500" />
          </div>
        )}

        {/* Bookmark button - top left */}
        <button
          onClick={(e) => toggleBookmark(documentary, e)}
          className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all z-20 ${
            isBookmarked
              ? 'bg-yellow-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          <Star className={`w-4 h-4 ${isBookmarked ? 'fill-white' : ''}`} />
        </button>

        {/* Downloaded badge - top right, above rating */}
        {isDownloaded && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg font-semibold flex items-center gap-1 z-10">
            ✓ Downloaded
          </div>
        )}

        {/* Rating badge - color coded by score */}
        {!isDownloaded && (
          <div className={`absolute top-2 right-2 ${getRatingColor(rating)} text-white px-2 py-1 rounded-md font-bold text-sm shadow-lg flex items-center gap-1`}>
            <Star className="w-3 h-3 fill-white" />
            {rating.toFixed(1)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-0">
          <div className="absolute bottom-0 p-3 w-full">
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-2">{documentary.title}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              {documentary.year && <span>{documentary.year}</span>}
              <span className="text-gray-400">• {documentary.vote_count.toLocaleString()} votes</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DocumentaryRow = ({ title, documentaries, loading, onSeeAll }: {
    title: string;
    documentaries: Documentary[];
    loading: boolean;
    onSeeAll?: () => void;
  }) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -800 : 800,
          behavior: 'smooth'
        });
      }
    };

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 px-4">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              See All <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative group/row">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-r-lg opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-l-lg opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {loading ? (
            <div className="flex gap-4 px-4 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="w-48 h-72 bg-gray-800 rounded-lg animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex gap-4 px-4 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {documentaries.map(documentary => (
                <DocumentaryCard key={documentary.id} documentary={documentary} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Film className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold">
                {viewMode === 'genre' && selectedGenre ? `${selectedGenre.emoji} ${selectedGenre.name} Documentaries` :
                 viewMode === 'all-documentaries' ? '🎬 All Documentaries' :
                 viewMode === 'top-rated' ? '⭐ Top Rated Documentaries' :
                 'Documentaries'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
            </div>
          </div>

          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentaries..."
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Search Results */}
      {viewMode === 'search' && (
        <div className="max-w-7xl mx-auto px-8 py-8">
          <h2 className="text-2xl font-bold mb-6">
            Search Results for "{searchQuery}" ({searchResults.length})
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {searchResults.map(documentary => (
                <DocumentaryCard key={documentary.id} documentary={documentary} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No documentaries found</p>
            </div>
          )}
        </div>
      )}

      {/* Genre View */}
      {viewMode === 'genre' && selectedGenre && (
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Filters */}
          <div className="mb-6">
            <button
              onClick={() => setShowGenreFilters(!showGenreFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mb-4"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showGenreFilters ? 'Hide Filters' : 'Show Filters'}
            </button>

            {showGenreFilters && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Sort By
                    </label>
                    <select
                      value={genreFilters.sortBy}
                      onChange={(e) => setGenreFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    >
                      <option value="vote_average.desc">Top Rated ⭐</option>
                      <option value="popularity.desc">Most Popular 🔥</option>
                      <option value="release_date.desc">Newest 📅</option>
                      <option value="vote_count.desc">Most Voted 👥</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Min Rating: {genreFilters.minRating.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={genreFilters.minRating}
                      onChange={(e) => setGenreFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Min Votes: {genreFilters.minVotes}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={genreFilters.minVotes}
                      onChange={(e) => setGenreFilters(prev => ({ ...prev, minVotes: parseInt(e.target.value) }))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>5k</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Year
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={genreFilters.year || ''}
                      onChange={(e) => setGenreFilters(prev => ({ ...prev, year: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="Any year"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={applyGenreFilters}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-400">
              Showing {genreDocumentaries.length} documentaries • Page {genreCurrentPage} of {genreTotalPages}
            </div>
          </div>

          {/* Documentaries Grid */}
          {genreLoading && genreCurrentPage === 1 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {genreDocumentaries.map(documentary => (
                  <DocumentaryCard key={documentary.id} documentary={documentary} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {genreLoading && genreCurrentPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more documentaries...</p>
                </div>
              )}

              {!genreLoading && genreCurrentPage >= genreTotalPages && genreDocumentaries.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more documentaries to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All Documentaries View */}
      {viewMode === 'all-documentaries' && (
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
          {/* Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAllDocumentariesFilters(!showAllDocumentariesFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showAllDocumentariesFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <div className="text-sm text-gray-400">
              {allDocumentaries.length} documentaries loaded • Page {allDocumentariesPage}/{allDocumentariesTotalPages}
            </div>
          </div>

          {/* Filter Panel */}
          {showAllDocumentariesFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
                  <select
                    value={allDocumentariesFilters.sortBy}
                    onChange={(e) => setAllDocumentariesFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="vote_average.desc">⭐ Top Rated</option>
                    <option value="popularity.desc">🔥 Most Popular</option>
                    <option value="release_date.desc">📅 Newest First</option>
                  </select>
                </div>

                {/* Quick Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Quick Filters (click to toggle on/off)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (activePreset === 'worth-watching') {
                          // Deselect - reset to no filters
                          setAllDocumentariesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc'
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllDocumentariesFilters({
                            minRating: 6.0,
                            minVotes: 50,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc'
                          });
                          setActivePreset('worth-watching');
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activePreset === 'worth-watching'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-lg scale-105'
                          : 'bg-blue-700 text-gray-300 hover:bg-blue-600'
                      }`}
                    >
                      👍 Worth Watching (6.0+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'quality') {
                          // Deselect - reset to no filters
                          setAllDocumentariesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc'
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllDocumentariesFilters({
                            minRating: 7.0,
                            minVotes: 200,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc'
                          });
                          setActivePreset('quality');
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activePreset === 'quality'
                          ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg scale-105'
                          : 'bg-purple-700 text-gray-300 hover:bg-purple-600'
                      }`}
                    >
                      ⭐ Quality Docs (7.0+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'elite') {
                          // Deselect - reset to no filters
                          setAllDocumentariesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc'
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllDocumentariesFilters({
                            minRating: 8.0,
                            minVotes: 500,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc'
                          });
                          setActivePreset('elite');
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activePreset === 'elite'
                          ? 'bg-yellow-600 text-white ring-2 ring-yellow-300 shadow-lg scale-105'
                          : 'bg-yellow-700 text-gray-300 hover:bg-yellow-600'
                      }`}
                    >
                      🏆 Elite Only (8.0+)
                    </button>
                    {localStorage.getItem('documentariesFilters') && (
                      <button
                        onClick={() => {
                          if (activePreset === 'saved') {
                            // Deselect - reset to no filters
                            setAllDocumentariesFilters({
                              minRating: 0,
                              minVotes: 0,
                              excludeGenres: [],
                              selectedGenres: [],
                              yearFrom: null,
                              yearTo: null,
                              sortBy: 'popularity.desc'
                            });
                            setActivePreset(null);
                          } else {
                            // Select - load saved filters
                            const savedFilters = localStorage.getItem('documentariesFilters');
                            if (savedFilters) {
                              setAllDocumentariesFilters(JSON.parse(savedFilters));
                              setActivePreset('saved');
                            }
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          activePreset === 'saved'
                            ? 'bg-green-600 text-white ring-2 ring-green-300 shadow-lg scale-105'
                            : 'bg-green-700 text-gray-300 hover:bg-green-600'
                        }`}
                      >
                        💾 My Saved Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Min Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Rating: {allDocumentariesFilters.minRating > 0 ? allDocumentariesFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={allDocumentariesFilters.minRating}
                    onChange={(e) => setAllDocumentariesFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allDocumentariesFilters.minVotes > 0 ? allDocumentariesFilters.minVotes : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={allDocumentariesFilters.minVotes}
                    onChange={(e) => setAllDocumentariesFilters(prev => ({ ...prev, minVotes: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Year Range */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Year Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={allDocumentariesFilters.yearFrom || ''}
                      onChange={(e) => setAllDocumentariesFilters(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="From"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={allDocumentariesFilters.yearTo || ''}
                      onChange={(e) => setAllDocumentariesFilters(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="To"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Genre Multi-Select (Click to toggle include/exclude) */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Additional Genres (click to toggle • <span className="text-green-400">included</span> / <span className="text-red-400">excluded</span>)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {genres.map(genre => {
                      const isExcluded = allDocumentariesFilters.excludeGenres.includes(genre.id);
                      return (
                        <button
                          key={genre.id}
                          onClick={() => {
                            setAllDocumentariesFilters(prev => ({
                              ...prev,
                              excludeGenres: isExcluded
                                ? prev.excludeGenres.filter(id => id !== genre.id)
                                : [...prev.excludeGenres, genre.id]
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                            isExcluded
                              ? 'bg-red-900/30 text-red-400 border border-red-500/30 hover:bg-red-900/50'
                              : 'bg-green-900/30 text-green-400 border border-green-500/30 hover:bg-green-900/50'
                          }`}
                        >
                          {isExcluded && <span className="absolute top-1 right-1 text-xs">✕</span>}
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save & Reset Buttons */}
                <div className="col-span-full flex gap-3">
                  <button
                    onClick={() => {
                      localStorage.setItem('documentariesFilters', JSON.stringify(allDocumentariesFilters));
                      setActivePreset('saved');
                      alert('✓ Filters saved! Use "My Saved Filters" button to load them anytime.');
                    }}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-lg"
                  >
                    💾 Save These Filters
                  </button>
                  <button
                    onClick={() => {
                      setAllDocumentariesFilters({
                        minRating: 0,
                        minVotes: 0,
                        yearFrom: null,
                        yearTo: null,
                        sortBy: 'popularity.desc',
                        selectedGenres: [],
                        excludeGenres: []
                      });
                      setActivePreset(null);
                    }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results header */}
          <div className="bg-gray-800/50 p-4 rounded-lg border-l-4 border-blue-500">
            <div className="space-y-1">
              <div className="text-sm text-gray-300">
                <span className="text-gray-400">Loaded:</span>{' '}
                <span className="font-bold text-white">{allDocumentaries.length.toLocaleString()}</span> of{' '}
                <span className="font-bold text-blue-400">{allDocumentariesTotalResults.toLocaleString()}</span>{' '}
                {allDocumentariesFilters.minRating > 0 || allDocumentariesFilters.minVotes > 0 || allDocumentariesFilters.selectedGenres.length > 0 || allDocumentariesFilters.excludeGenres.length > 0 || allDocumentariesFilters.yearFrom || allDocumentariesFilters.yearTo ? (
                  <span className="text-yellow-400">matching documentaries</span>
                ) : (
                  <span className="text-gray-400">documentaries</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Total catalog: <span className="font-semibold text-gray-400">{allDocumentariesTotalResults.toLocaleString()}+ documentaries</span>
                {(allDocumentariesFilters.minRating > 0 || allDocumentariesFilters.minVotes > 0 || allDocumentariesFilters.selectedGenres.length > 0 || allDocumentariesFilters.excludeGenres.length > 0 || allDocumentariesFilters.yearFrom || allDocumentariesFilters.yearTo) && (
                  <span className="ml-2 text-yellow-400">• Filters active</span>
                )}
              </div>
            </div>
          </div>

          {allDocumentariesLoading && allDocumentariesPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allDocumentaries.map(documentary => (
                  <DocumentaryCard key={documentary.id} documentary={documentary} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allDocumentariesLoading || loadingMultiplePages) && allDocumentariesPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more documentaries...</p>
                </div>
              )}

              {!allDocumentariesLoading && allDocumentariesPage >= allDocumentariesTotalPages && allDocumentaries.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more documentaries to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Top Rated View */}
      {viewMode === 'top-rated' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">⭐ Top Rated Documentaries (7.5+)</h2>
            <div className="text-sm text-gray-400">
              {allDocumentaries.length} documentaries loaded • Page {allDocumentariesPage}/{allDocumentariesTotalPages}
            </div>
          </div>

          {allDocumentariesLoading && allDocumentariesPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allDocumentaries.map(documentary => (
                  <DocumentaryCard key={documentary.id} documentary={documentary} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allDocumentariesLoading || loadingMultiplePages) && allDocumentariesPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more documentaries...</p>
                </div>
              )}

              {!allDocumentariesLoading && allDocumentariesPage >= allDocumentariesTotalPages && allDocumentaries.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more documentaries to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Documentary Modal */}
      {selectedDocumentary && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedDocumentary(null);
            setVpnConnected(false);
            setTorrentResults([]);
            setTorrentSearchError(null);
            setDownloadUrl('');
          }}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedDocumentary.backdrop_url && (
              <img
                src={selectedDocumentary.backdrop_url}
                alt={selectedDocumentary.title}
                className="w-full h-64 object-cover rounded-t-lg"
              />
            )}

            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedDocumentary.title}</h2>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                {selectedDocumentary.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedDocumentary.year}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{selectedDocumentary.vote_average.toFixed(1)}/10</span>
                </div>
                {selectedDocumentary.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${selectedDocumentary.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  >
                    IMDb
                  </a>
                )}
              </div>

              <p className="text-gray-300 mb-6">{selectedDocumentary.overview}</p>

              <div className="space-y-4">
                {/* Auto-Search Torrents Button */}
                <button
                  onClick={() => searchTorrents(selectedDocumentary)}
                  disabled={searchingTorrents}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors shadow-lg text-lg"
                >
                  {searchingTorrents ? (
                    <>
                      <Loader className="w-6 h-6 animate-spin" />
                      Searching Torrents...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      Auto-Search (PirateBay)
                    </>
                  )}
                </button>

                {/* Torrent Search Results */}
                {torrentResults.length > 0 && (
                  <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Found {torrentResults.length} Torrents (sorted by seeds)
                    </h3>
                    <div className="space-y-2">
                      {torrentResults.map((torrent, index) => (
                        <div
                          key={index}
                          onClick={() => selectTorrent(torrent.magnet)}
                          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-lg p-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate mb-1">{torrent.title}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className={`px-2 py-1 rounded ${
                                  torrent.source === '1337x' ? 'bg-orange-600/20 text-orange-400' :
                                  torrent.source === 'piratebay' ? 'bg-purple-600/20 text-purple-400' :
                                  torrent.source === 'yts' ? 'bg-red-600/20 text-red-400' :
                                  torrent.source === 'ext' ? 'bg-pink-600/20 text-pink-400' :
                                  torrent.source === 'rarbg' ? 'bg-green-600/20 text-green-400' :
                                  'bg-indigo-600/20 text-indigo-400'
                                }`}>
                                  {torrent.source}
                                </span>
                                {torrent.quality && (
                                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded">{torrent.quality}</span>
                                )}
                                <span>{torrent.size}</span>
                                <span className="text-green-400 font-semibold">↑ {torrent.seeds}</span>
                                <span className="text-red-400">↓ {torrent.peers}</span>
                              </div>
                            </div>
                            <button className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                              Select
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Torrent Search Error */}
                {torrentSearchError && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">{torrentSearchError}</p>
                  </div>
                )}

                {/* Manual Search (Fallback) */}
                <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Manual Search (Fallback)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => search1337x(selectedDocumentary)}
                      className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      1337x
                    </button>
                    <button
                      onClick={() => searchExtTo(selectedDocumentary)}
                      className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      Ext.to
                    </button>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    placeholder="Paste video URL here..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none mb-3"
                  />
                  <button
                    ref={downloadButtonRef}
                    onClick={() => handleDownload(selectedDocumentary)}
                    disabled={!downloadUrl.trim() || loadingFormat}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    {loadingFormat ? 'Analyzing...' : 'Queue Download'}
                  </button>

                  {/* Inline Format Preview */}
                  {showFormatPreview && (
                    <div className="mt-4 space-y-4">
                      {loadingFormat ? (
                        <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                          <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                            <span className="text-gray-300">Analyzing filename and fetching metadata...</span>
                          </div>
                        </div>
                      ) : formatError ? (
                        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                          <h4 className="text-red-400 font-semibold mb-2">Error</h4>
                          <p className="text-gray-300 text-sm">{formatError}</p>
                          <button
                            onClick={() => handleDownload(selectedDocumentary)}
                            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      ) : formattedPath && (
                        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500/30 rounded-lg p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">📁 Download Format Preview</h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              formattedPath.contentType === 'tv' ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50' :
                              formattedPath.contentType === 'movie' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50' :
                              'bg-gray-500/30 text-gray-300 border border-gray-400/50'
                            }`}>
                              {formattedPath.contentType === 'tv' ? 'TV Show' : formattedPath.contentType === 'movie' ? 'Movie' : 'Documentary'}
                            </span>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Original Filename:</label>
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                              <code className="text-sm text-gray-300 break-all">{formattedPath.originalName}</code>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Formatted for Jellyfin:</label>
                            <div className="bg-gray-800/50 border border-green-500/30 rounded-lg p-3">
                              <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap">
                                {formattedPath.preview}
                              </pre>
                            </div>
                          </div>

                          {formattedPath.folderStructure && (
                            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                              <h4 className="text-sm font-semibold text-gray-400 mb-3">Metadata:</h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {formattedPath.folderStructure.movieName && (
                                  <div>
                                    <span className="text-gray-500">Documentary:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.movieName}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.year && (
                                  <div>
                                    <span className="text-gray-500">Year:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.year}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {showFormatPreview && formattedPath && !loadingFormat && !formatError && (
                    <div className="mt-4 space-y-4">
                      {/* VPN Status Check */}
                      <div className={`border rounded-lg p-4 ${
                        checkingVpn ? 'bg-gray-900/30 border-gray-500/50' :
                        vpnConnected ? 'bg-green-900/30 border-green-500/50' :
                        'bg-red-900/30 border-red-500/50'
                      }`}>
                        <div className="flex items-center gap-3">
                          {checkingVpn ? (
                            <>
                              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-gray-300 font-medium text-sm">
                                Checking VPN status...
                              </span>
                            </>
                          ) : vpnConnected ? (
                            <>
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-green-300 font-medium text-sm">
                                VPN Connected - Ready to download
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                              <span className="text-red-300 font-medium text-sm">
                                VPN Disconnected - Please enable VPN to download
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => submitDownload(selectedDocumentary)}
                          disabled={!vpnConnected || checkingVpn}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
                        >
                          <Download className="w-5 h-5" />
                          Confirm Download
                        </button>
                        <button
                          onClick={() => {
                            setShowFormatPreview(false);
                            setFormattedPath(null);
                            setVpnConnected(false);
                          }}
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
