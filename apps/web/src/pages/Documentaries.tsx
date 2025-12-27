import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, Loader } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';
import { API_BASE } from '@/lib/config';

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

  // Prowlarr torrent state
  const [availableReleases, setAvailableReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string>('1080p');
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(false);
  const [downloadingTorrent, setDownloadingTorrent] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  // Browse mode sections
  const [genreSections, setGenreSections] = useState<GenreSection[]>([]);

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
    excludeGenres: [] as number[],
    originCountries: [] as string[]
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

  const isInitialMount = React.useRef(true);
  const isRestoring = React.useRef(true); // Track if we're restoring state from localStorage
  const restoringScroll = React.useRef(false);
  const scrollPositionSaved = React.useRef(false);

  // Load documentaries on mount
  useEffect(() => {
    fetchGenres();
    setShowAllDocumentariesFilters(true);

    // Try to restore browse state from sessionStorage
    const savedBrowseState = localStorage.getItem('documentariesBrowseState');
    if (savedBrowseState) {
      try {
        const { documentaries, page, totalPages, totalResults, viewMode: savedViewMode, scrollY } = JSON.parse(savedBrowseState);
        restoringScroll.current = true;
        setAllDocumentaries(documentaries || []);
        setAllDocumentariesPage(page || 1);
        setAllDocumentariesTotalPages(totalPages || 1);
        setAllDocumentariesTotalResults(totalResults || 0);
        setViewMode(savedViewMode || 'all-documentaries');
        // Ensure no loading states are active when restoring from cache
        setAllDocumentariesLoading(false);
        setLoadingMultiplePages(false);

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
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    // Restore active preset
    const savedPreset = localStorage.getItem('documentariesActivePreset');
    if (savedPreset) {
      setActivePreset(savedPreset);
    }

    // Only load documentaries if we didn't restore state
    if (!savedBrowseState) {
      loadDocumentaries();
    }

    // Mark restoration complete - do this AFTER all state restoration is done
    // This prevents the filter watch useEffect from triggering during restoration
    setTimeout(() => {
      isRestoring.current = false;
      isInitialMount.current = false;
    }, 100); // Small delay to ensure all React state updates have processed
  }, []);

  // Save filters to localStorage when they change (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    localStorage.setItem('documentariesFilters', JSON.stringify(allDocumentariesFilters));
  }, [allDocumentariesFilters]);

  // Save active preset to localStorage (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    if (activePreset) {
      localStorage.setItem('documentariesActivePreset', activePreset);
    }
  }, [activePreset]);

  // Watch for filter changes and reload
  useEffect(() => {
    // Skip if we're restoring state from localStorage
    if (isRestoring.current || isInitialMount.current) {
      return;
    }

    if (viewMode === 'all-documentaries' || viewMode === 'top-rated') {
      const timeoutId = setTimeout(() => {
        loadManyPages(1, 10, viewMode, false); // Load 10 pages when filters change
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [allDocumentariesFilters.minRating, allDocumentariesFilters.minVotes, allDocumentariesFilters.sortBy, allDocumentariesFilters.yearFrom, allDocumentariesFilters.yearTo, allDocumentariesFilters.selectedGenres, allDocumentariesFilters.excludeGenres, allDocumentariesFilters.originCountries]);

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

    localStorage.setItem('documentariesBrowseState', JSON.stringify(browseState));
  }, [allDocumentaries, allDocumentariesPage, allDocumentariesTotalPages, allDocumentariesTotalResults, viewMode]);

  // Save scroll position on scroll events
  useEffect(() => {
    const saveScrollPosition = () => {
      if (restoringScroll.current) return;

      const savedState = localStorage.getItem('documentariesBrowseState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          state.scrollY = window.scrollY;
          localStorage.setItem('documentariesBrowseState', JSON.stringify(state));
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
      if (allDocumentariesFilters.originCountries && allDocumentariesFilters.originCountries.length > 0) {
        baseUrl += `&origin_countries=${allDocumentariesFilters.originCountries.join(',')}`;
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

  // Helper function to extract quality from torrent title
  const extractQuality = (title: string): string => {
    const upperTitle = title.toUpperCase();
    if (upperTitle.includes('2160P') || upperTitle.includes('4K') || upperTitle.includes('UHD')) return '2160p';
    if (upperTitle.includes('1080P')) return '1080p';
    if (upperTitle.includes('720P')) return '720p';
    if (upperTitle.includes('480P')) return '480p';
    return 'Other';
  };

  // Helper function to get indexer color
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

  // Reset torrent state when selecting a new documentary
  const handleDocumentaryClick = (documentary: Documentary) => {
    setAvailableReleases([]);
    setSelectedRelease(null);
    setQualityFilter('1080p');
    setTorrentSearchError(null);
    setVpnConnected(false);
    setSelectedDocumentary(documentary);

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
  };

  // Browse torrents using Prowlarr
  const browseTorrents = async () => {
    if (!selectedDocumentary) return;

    const searchQuery = `${selectedDocumentary.title} ${selectedDocumentary.year || ''}`;
    setLoadingReleases(true);
    setTorrentSearchError(null);

    try {
      const releasesResponse = await fetch(`${API_BASE}/prowlarr/search?query=${encodeURIComponent(searchQuery)}&type=movie`, {
        credentials: 'include'
      });

      if (!releasesResponse.ok) {
        throw new Error('Failed to search Prowlarr');
      }

      const releases = await releasesResponse.json();

      // Smart filtering
      const titleLower = selectedDocumentary.title.toLowerCase();
      const yearStr = selectedDocumentary.year || '';

      // Extract all keywords from the title
      const allKeywords = titleLower.split(/\s+/).filter(word => word.length > 2);

      const filteredReleases = releases.filter((r: any) => {
        const releaseTitleLower = r.title.toLowerCase();

        // Filter out adult content
        const adultKeywords = ['xxx', 'onlyfans', 'nfbusty', 'girlsoutwest', 'girlsrimming', 'playboy'];
        if (adultKeywords.some(keyword => releaseTitleLower.includes(keyword))) {
          return false;
        }

        // Calculate keyword match percentage
        const matchedKeywords = allKeywords.filter(keyword => releaseTitleLower.includes(keyword));
        const matchPercentage = matchedKeywords.length / allKeywords.length;

        // For titles with 3+ keywords, require at least 50% match + at least one unique keyword (beyond first two common words)
        if (allKeywords.length > 2) {
          if (matchPercentage < 0.5) return false;

          // Require at least one unique identifier beyond the first two words
          const uniqueKeywords = allKeywords.slice(2);
          const hasUniqueMatch = uniqueKeywords.some(keyword => releaseTitleLower.includes(keyword));
          return hasUniqueMatch;
        }

        // For shorter titles, require at least 60% match
        return matchPercentage >= 0.6;
      });

      if (filteredReleases.length === 0) {
        setTorrentSearchError('No torrents found. Try adding more indexers in Prowlarr (Dashboard > Open Prowlarr).');
      }

      setAvailableReleases(filteredReleases);
    } catch (err: any) {
      console.error('Prowlarr search failed:', err);
      setTorrentSearchError(err.message || 'Failed to search torrents');
      setAvailableReleases([]);
    } finally {
      setLoadingReleases(false);
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
        onClick={() => handleDocumentaryClick(documentary)}
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
          {/* Show/Hide Additional Filters Toggle */}
          {!showAllDocumentariesFilters && (
            <div className="flex items-center justify-start">
              <button
                onClick={() => setShowAllDocumentariesFilters(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300 font-medium"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Show Additional Filters
              </button>
            </div>
          )}

          {/* Additional Filters Panel - Collapsible */}
          {showAllDocumentariesFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              {/* Hide Filters Button & Reset Button */}
              <div className="flex items-center justify-start gap-3 mb-4">
                <button
                  onClick={() => setShowAllDocumentariesFilters(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300 font-medium"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Hide Additional Filters
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
                      excludeGenres: [],
                      originCountries: []
                    });
                    setActivePreset('all-docs'); // Auto-select All Docs on reset
                  }}
                  disabled={
                    allDocumentariesFilters.minRating === 0 &&
                    allDocumentariesFilters.minVotes === 0 &&
                    !allDocumentariesFilters.yearFrom &&
                    !allDocumentariesFilters.yearTo &&
                    allDocumentariesFilters.selectedGenres.length === 0 &&
                    allDocumentariesFilters.excludeGenres.length === 0 &&
                    allDocumentariesFilters.originCountries.length === 0
                  }
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                    allDocumentariesFilters.minRating === 0 &&
                    allDocumentariesFilters.minVotes === 0 &&
                    !allDocumentariesFilters.yearFrom &&
                    !allDocumentariesFilters.yearTo &&
                    allDocumentariesFilters.selectedGenres.length === 0 &&
                    allDocumentariesFilters.excludeGenres.length === 0 &&
                    allDocumentariesFilters.originCountries.length === 0
                      ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  Reset Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Quick Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Quick Filters</label>
                  <div className="flex flex-wrap gap-3">
                    {/* All Docs - No filters */}
                    <button
                      onClick={() => {
                        if (activePreset === 'all-docs') {
                          // Deselect - already at defaults, do nothing
                          setActivePreset(null);
                        } else {
                          // Select - reset to no rating/vote filters
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset('all-docs');
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'all-docs'
                          ? 'bg-green-600 text-white ring-2 ring-green-300 shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-green-600'
                      }`}
                    >
                      🎬 All Docs
                    </button>

                    <button
                      onClick={() => {
                        if (activePreset === 'worth-watching') {
                          // Deselect - reset ONLY rating/votes/sort
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);
                        } else {
                          // Select - apply preset with additional filters
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 5.5,
                            minVotes: 50,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('worth-watching');
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'worth-watching'
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-blue-600'
                      }`}
                    >
                      👍 Worth Watching (5.5+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'quality') {
                          // Deselect - reset ONLY rating/votes/sort
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);
                        } else {
                          // Select - apply preset with additional filters
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 6.5,
                            minVotes: 100,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('quality');
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'quality'
                          ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-purple-600'
                      }`}
                    >
                      ⭐ Quality Docs (6.5+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'elite') {
                          // Deselect - reset ONLY rating/votes/sort
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);
                        } else {
                          // Select - apply preset with additional filters
                          setAllDocumentariesFilters(prev => ({
                            ...prev,
                            minRating: 7.5,
                            minVotes: 200,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('elite');
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'elite'
                          ? 'bg-yellow-600 text-white ring-2 ring-yellow-300 shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-yellow-600'
                      }`}
                    >
                      🏆 Elite Only (7.5+)
                    </button>
                  </div>
                </div>

                {/* Additional Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Additional Filters</label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setAllDocumentariesFilters(prev => {
                          const hasExclusions = prev.excludeGenres.includes(16) && prev.excludeGenres.includes(10751);
                          if (hasExclusions) {
                            // Remove exclusions
                            return {
                              ...prev,
                              excludeGenres: prev.excludeGenres.filter(id => id !== 16 && id !== 10751)
                            };
                          } else {
                            // Add exclusions
                            const newExclusions = [...prev.excludeGenres];
                            if (!newExclusions.includes(16)) newExclusions.push(16);
                            if (!newExclusions.includes(10751)) newExclusions.push(10751);
                            return {
                              ...prev,
                              excludeGenres: newExclusions
                            };
                          }
                        });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allDocumentariesFilters.excludeGenres.includes(16) && allDocumentariesFilters.excludeGenres.includes(10751)
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-red-600'
                      }`}
                    >
                      🚫 No Kids/Anime
                    </button>

                    <button
                      onClick={() => {
                        setAllDocumentariesFilters(prev => {
                          const isActive = prev.originCountries.length > 0;
                          if (isActive) {
                            // Remove English-speaking filter
                            return {
                              ...prev,
                              originCountries: []
                            };
                          } else {
                            // Add English-speaking countries (US, UK, Canada, Australia, New Zealand, Ireland)
                            return {
                              ...prev,
                              originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                            };
                          }
                        });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allDocumentariesFilters.originCountries.length > 0
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-blue-600'
                      }`}
                      title="Filter to English-speaking countries: US, UK, Canada, Australia, New Zealand, Ireland"
                    >
                      🇺🇸🇬🇧 English Only
                    </button>
                  </div>
                </div>

                {/* Genres Multi-Select Dropdown */}
                <div className="col-span-full">
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg transition-colors">
                        <span className="text-sm font-medium text-gray-300">
                          Genres {allDocumentariesFilters.selectedGenres.length > 0 && `(${allDocumentariesFilters.selectedGenres.length} selected)`}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="mt-3 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {genres.map(genre => {
                          const isSelected = allDocumentariesFilters.selectedGenres.includes(genre.id);
                          return (
                            <button
                              key={genre.id}
                              onClick={() => {
                                setAllDocumentariesFilters(prev => ({
                                  ...prev,
                                  selectedGenres: isSelected
                                    ? prev.selectedGenres.filter(id => id !== genre.id)
                                    : [...prev.selectedGenres, genre.id]
                                }));
                              }}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30 hover:bg-blue-900/50'
                                  : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
                              }`}
                            >
                              {genre.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                </div>

                {/* Min Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Rating: {allDocumentariesFilters.minRating > 0 ? allDocumentariesFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <div className="pt-2">
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
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allDocumentariesFilters.minVotes > 0 ? allDocumentariesFilters.minVotes : 'Any'}
                  </label>
                  <div className="pt-2">
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
              </div>
            </div>
          )}

          {/* Results header */}
          <div className="bg-gray-800/50 p-4 rounded-lg border-l-4 border-blue-500">
            <div className="space-y-2">
              <div className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400">Loaded:</span>{' '}
                <span className="font-bold text-white">{allDocumentaries.length.toLocaleString()}</span> of{' '}
                <span className="font-bold text-blue-400">{allDocumentariesTotalResults.toLocaleString()}</span>{' '}
                <span className="text-gray-400">documentaries</span>
                {(allDocumentariesLoading || loadingMultiplePages) && <Loader className="w-4 h-4 animate-spin text-blue-400" />}
              </div>

              {/* Always show total catalog for reference */}
              <div className="text-xs text-gray-500">
                <span className="text-gray-500">Total catalog:</span>{' '}
                <span className="font-semibold text-gray-400">205,482+ documentaries</span>
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

              {/* Stats at bottom */}
              <div className="flex items-center justify-center mt-6">
                <div className="text-sm text-gray-400 bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
                  {allDocumentaries.length} documentaries loaded • Page {allDocumentariesPage}/{allDocumentariesTotalPages}
                  {(allDocumentariesLoading || loadingMultiplePages) && <Loader className="w-4 h-4 animate-spin text-blue-400 inline-block ml-2" />}
                </div>
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allDocumentariesLoading || loadingMultiplePages) && allDocumentariesPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more documentaries...</p>
                </div>
              )}

              {!allDocumentariesLoading && !loadingMultiplePages && allDocumentariesPage >= allDocumentariesTotalPages && allDocumentaries.length > 0 && (
                <div className="text-center mt-8 py-6">
                  <div className="inline-block bg-green-900/30 border border-green-500/50 rounded-lg px-6 py-3">
                    <p className="text-green-400 font-medium">✓ All {allDocumentaries.length.toLocaleString()} matching results loaded</p>
                    <p className="text-xs text-gray-400 mt-1">Showing all documentaries that match your current filters</p>
                  </div>
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
            setAvailableReleases([]);
            setSelectedRelease(null);
            setQualityFilter('1080p');
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
                {/* VPN Warning */}
                {availableReleases.length === 0 && !vpnConnected && !checkingVpn && (
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
                      ? 'bg-green-900/30 border-green-400/50 shadow-lg shadow-green-500/20 animate-pulse'
                      : downloadMessage.startsWith('⚠️')
                      ? 'bg-yellow-900/20 border-yellow-500/30'
                      : downloadMessage.startsWith('⏳')
                      ? 'bg-green-900/20 border-green-500/30'
                      : 'bg-red-900/20 border-red-500/30'
                  }`}>
                    <p className={`${
                      downloadMessage.startsWith('✅') ? 'text-base font-semibold' : 'text-sm'
                    } ${
                      downloadMessage.startsWith('✅')
                        ? 'text-green-200'
                        : downloadMessage.startsWith('⚠️')
                        ? 'text-yellow-300'
                        : downloadMessage.startsWith('⏳')
                        ? 'text-green-300'
                        : 'text-red-300'
                    }`}>
                      {downloadMessage}
                      {downloadMessage.startsWith('✅') && (
                        <>, <Link to="/downloads" className="underline font-bold hover:text-green-100 transition-colors">click here to see your downloads</Link></>
                      )}
                    </p>
                  </div>
                )}

                {/* Download Button */}
                {availableReleases.length === 0 && (
                  <button
                    onClick={browseTorrents}
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

                {/* Prowlarr Search Results with Quality Filters */}
                {availableReleases.length > 0 && (
                  <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Found {availableReleases.filter(r => qualityFilter === 'all' || extractQuality(r.title) === qualityFilter).length} Torrents (sorted by seeds)
                    </h3>

                    {/* Quality Filter Buttons */}
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {['all', '2160p', '1080p', '720p', 'Other'].map(quality => {
                        const count = quality === 'all'
                          ? availableReleases.length
                          : availableReleases.filter(r => extractQuality(r.title) === quality).length;

                        if (count === 0 && quality !== 'all') return null;

                        return (
                          <button
                            key={quality}
                            onClick={() => setQualityFilter(quality)}
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
                    <div className="space-y-2">
                      {[...availableReleases]
                        .filter(r => qualityFilter === 'all' || extractQuality(r.title) === qualityFilter)
                        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
                        .map((release, index) => {
                            const quality = extractQuality(release.title);
                            const sizeMB = release.size ? (release.size / (1024 * 1024)) : null;
                            const sizeGB = sizeMB && sizeMB > 1024 ? (sizeMB / 1024).toFixed(1) : null;
                            const sizeDisplay = sizeGB ? `${sizeGB} GB` : sizeMB ? `${sizeMB.toFixed(0)} MB` : 'Unknown';

                            return (
                              <div
                                key={index}
                                onClick={async () => {
                                  // Prevent duplicate downloads
                                  if (downloadingTorrent) return;

                                  setDownloadingTorrent(true);

                                  try {
                                    const response = await fetch(`${API_BASE}/torrents/download`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      credentials: 'include',
                                      body: JSON.stringify({
                                        magnetUrl: release.magnetUrl,
                                        downloadUrl: release.downloadUrl,
                                        title: release.title,
                                        category: 'Documentaries',
                                      })
                                    });

                                    if (response.ok) {
                                      setDownloadMessage(`✅ ${selectedDocumentary?.title} is now downloading`);
                                      setAvailableReleases([]);
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
                                  }
                                }}
                                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-lg p-3 cursor-pointer transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white mb-1 line-clamp-2">{release.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                                      <span className={`px-2 py-1 rounded font-medium ${getIndexerColor(release.indexer)}`}>
                                        {release.indexer}
                                      </span>
                                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded font-medium">
                                        {quality}
                                      </span>
                                      <span>{sizeDisplay}</span>
                                      {release.seeders !== undefined && (
                                        <span className="text-green-400 font-semibold">↑ {release.seeders}</span>
                                      )}
                                      {release.leechers !== undefined && (
                                        <span className="text-red-400">↓ {release.leechers}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {torrentSearchError && availableReleases.length === 0 && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">{torrentSearchError}</p>
                  </div>
                )}
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
