import React, { useState, useEffect } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';

interface TVShow {
  id: number;
  name: string;
  title?: string; // For compatibility
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
  shows: TVShow[];
  loading: boolean;
}

type ViewMode = 'browse' | 'search' | 'genre' | 'all-shows' | 'top-rated';

export default function TVShows() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<TVShow[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState<TVShow | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all-shows');
  const [showFormatPreview, setShowFormatPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
  const [formattedPath, setFormattedPath] = useState<any>(null);
  const [loadingFormat, setLoadingFormat] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [vpnConfirmed, setVpnConfirmed] = useState(false);
  const isInitialMount = React.useRef(true);

  // Browse mode sections
  const [genreSections, setGenreSections] = useState<GenreSection[]>([]);
  const [trendingShows, setTrendingShows] = useState<TVShow[]>([]);
  const [topRatedShows, setTopRatedShows] = useState<TVShow[]>([]);
  const [airingTodayShows, setAiringTodayShows] = useState<TVShow[]>([]);

  // Genre view state
  const [selectedGenre, setSelectedGenre] = useState<GenreSection | null>(null);
  const [genreShows, setGenreShows] = useState<TVShow[]>([]);
  const [genreCurrentPage, setGenreCurrentPage] = useState(1);
  const [genreTotalPages, setGenreTotalPages] = useState(1);
  const [genreLoading, setGenreLoading] = useState(false);

  // All shows / Top Rated view state
  const [allShows, setAllShows] = useState<TVShow[]>([]);
  const [allShowsPage, setAllShowsPage] = useState(1);
  const [allShowsTotalPages, setAllShowsTotalPages] = useState(1);
  const [allShowsTotalResults, setAllShowsTotalResults] = useState(0);
  const [allShowsLoading, setAllShowsLoading] = useState(false);
  const [loadingMultiplePages, setLoadingMultiplePages] = useState(false);

  // All Shows filters (default to NO filters - show everything, let users customize)
  const [allShowsFilters, setAllShowsFilters] = useState({
    minRating: 0,
    minVotes: 0,
    yearFrom: null as number | null,
    yearTo: null as number | null,
    sortBy: 'popularity.desc' as 'vote_average.desc' | 'popularity.desc' | 'first_air_date.desc',
    selectedGenres: [] as number[],
    excludeGenres: [] as number[]
  });
  const [showAllShowsFilters, setShowAllShowsFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Genre filters
  const [genreFilters, setGenreFilters] = useState({
    minRating: 0,
    minVotes: 1000,
    year: null as number | null,
    sortBy: 'vote_average.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc' | 'vote_count.desc'
  });
  const [showGenreFilters, setShowGenreFilters] = useState(false);

  const API_BASE = 'http://localhost:3001/api/v1';

  // Genre configuration with emojis - ordered by popularity
  const GENRE_CONFIG = [
    { id: 28, name: 'Action', emoji: '💥' },
    { id: 35, name: 'Comedy', emoji: '😂' },
    { id: 18, name: 'Drama', emoji: '🎭' },
    { id: 27, name: 'Horror', emoji: '👻' },
    { id: 878, name: 'Sci-Fi', emoji: '🚀' },
    { id: 53, name: 'Thriller', emoji: '😱' },
  ];

  useEffect(() => {
    fetchGenres();
    setShowAllShowsFilters(true); // Show filters by default
    // Try to load saved filters from localStorage
    const savedFilters = localStorage.getItem('tvShowsFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setAllShowsFilters(parsed);
        setActivePreset('saved');
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }
    // Load shows with default/saved filters
    loadShows();
  }, []);

  // Function to load shows based on current filters
  const loadShows = () => {
    loadManyPages(1, 50, 'all-shows'); // Load 50 pages initially (~1000 shows)
  };

  const fetchGenres = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/genres/tv`, {
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
      shows: [],
      loading: true
    }));
    setGenreSections(sections);

    // Fetch top-rated shows for each genre
    GENRE_CONFIG.forEach(config => {
      fetchGenreSection(config.id, config.name, config.emoji);
    });
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/trending/tv?timeWindow=week`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by popularity for trending
        const sorted = (data.results || []).sort((a: TVShow, b: TVShow) =>
          b.popularity - a.popularity
        );
        setTrendingShows(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch trending:', err);
    }
  };

  const fetchTopRated = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/popular/tv?page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by rating to guarantee perfect order
        const sorted = (data.results || []).sort((a: TVShow, b: TVShow) =>
          b.vote_average - a.vote_average
        );
        setTopRatedShows(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch top rated:', err);
    }
  };

  const fetchNowPlaying = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/popular/tv?page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by release date (newest first)
        const sorted = (data.results || []).sort((a: TVShow, b: TVShow) => {
          const yearA = a.year ? parseInt(a.year) : 0;
          const yearB = b.year ? parseInt(b.year) : 0;
          return yearB - yearA;
        });
        setAiringTodayShows(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch airing today:', err);
    }
  };

  const fetchGenreSection = async (genreId: number, genreName: string, emoji: string) => {
    try {
      // Browse mode: Show ONLY the best of the best (7.5+, 2000+ votes)
      const res = await fetch(
        `${API_BASE}/tmdb/popular/tv?genre=${genreId}&sort_by=vote_average.desc&page=1&min_rating=7.5&min_votes=2000`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        // Client-side re-sort to guarantee perfect descending order
        const sortedShows = (data.results || []).sort((a: TVShow, b: TVShow) =>
          b.vote_average - a.vote_average
        );
        setGenreSections(prev => prev.map(section =>
          section.id === genreId
            ? { ...section, shows: sortedShows, loading: false }
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
      minVotes: 1000,
      year: null,
      sortBy: 'vote_average.desc'
    });
    await fetchGenreShows(section.id, 1, {
      minRating: 0,
      minVotes: 1000,
      year: null,
      sortBy: 'vote_average.desc'
    });
  };

  const fetchGenreShows = async (
    genreId: number,
    page: number,
    filters: typeof genreFilters
  ) => {
    setGenreLoading(true);
    try {
      let url = `${API_BASE}/tmdb/popular/tv?genre=${genreId}&sort_by=${filters.sortBy}&page=${page}&enrich=true`;
      if (filters.minRating > 0) url += `&min_rating=${filters.minRating}`;
      if (filters.minVotes > 0) url += `&min_votes=${filters.minVotes}`;
      if (filters.year) url += `&year=${filters.year}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let results = data.results || [];

        // Client-side re-sort to guarantee perfect order based on sortBy
        if (filters.sortBy === 'vote_average.desc') {
          results = results.sort((a: TVShow, b: TVShow) => {
            const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
            const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
            return ratingB - ratingA;
          });
        } else if (filters.sortBy === 'popularity.desc') {
          results = results.sort((a: TVShow, b: TVShow) => b.popularity - a.popularity);
        } else if (filters.sortBy === 'release_date.desc') {
          results = results.sort((a: TVShow, b: TVShow) => {
            const yearA = a.year ? parseInt(a.year) : 0;
            const yearB = b.year ? parseInt(b.year) : 0;
            return yearB - yearA;
          });
        } else if (filters.sortBy === 'vote_count.desc') {
          results = results.sort((a: TVShow, b: TVShow) => b.vote_count - a.vote_count);
        }

        if (page === 1) {
          setGenreShows(results);
        } else {
          // When loading more, merge and re-sort all shows
          const allShows = [...genreShows, ...results];
          if (filters.sortBy === 'vote_average.desc') {
            setGenreShows(allShows.sort((a, b) => {
              const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
              const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
              return ratingB - ratingA;
            }));
          } else {
            setGenreShows(allShows);
          }
        }

        setGenreTotalPages(data.total_pages || 1);
        setGenreCurrentPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch genre shows:', err);
    } finally {
      setGenreLoading(false);
    }
  };

  const loadMoreGenreShows = () => {
    if (selectedGenre && genreCurrentPage < genreTotalPages && !genreLoading) {
      fetchGenreShows(selectedGenre.id, genreCurrentPage + 1, genreFilters);
    }
  };

  const applyGenreFilters = () => {
    if (selectedGenre) {
      fetchGenreShows(selectedGenre.id, 1, genreFilters);
    }
  };

  const openTopRatedView = async () => {
    setViewMode('top-rated');
    setAllShowsPage(1);
    await fetchAllShows(1, 'top-rated');
  };

  const openAllShowsView = async () => {
    setViewMode('all-shows');
    setShowAllShowsFilters(true); // Show filters by default
    setAllShowsPage(1);
    setAllShowsFilters({
      minRating: 0,
      minVotes: 0,
      yearFrom: null,
      yearTo: null,
      sortBy: 'popularity.desc',
      selectedGenres: [],
      excludeGenres: []
    });
    await fetchAllShows(1, 'all-shows');
  };

  // Auto-apply filters when they change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (viewMode === 'all-shows' || viewMode === 'top-rated') {
      const timeoutId = setTimeout(() => {
        console.log('Applying filters:', allShowsFilters);
        loadManyPages(1, 50, viewMode, false); // Load 50 pages when filters change
      }, 500); // Debounce for 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [allShowsFilters.minRating, allShowsFilters.minVotes, allShowsFilters.sortBy, allShowsFilters.yearFrom, allShowsFilters.yearTo, allShowsFilters.selectedGenres, allShowsFilters.excludeGenres]);

  const fetchAllShows = async (page: number, mode: 'all-shows' | 'top-rated', append = false) => {
    setAllShowsLoading(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 7.5, minVotes: 2000, sortBy: 'vote_average.desc' }
        : allShowsFilters;

      let url = `${API_BASE}/tmdb/popular/tv?page=${page}`;
      url += `&sort_by=${filters.sortBy}`;
      if (filters.minRating > 0) url += `&min_rating=${filters.minRating}`;
      if (filters.minVotes > 0) url += `&min_votes=${filters.minVotes}`;
      if (allShowsFilters.yearFrom) url += `&year_from=${allShowsFilters.yearFrom}`;
      if (allShowsFilters.yearTo) url += `&year_to=${allShowsFilters.yearTo}`;
      if (allShowsFilters.selectedGenres.length > 0) {
        url += `&genre=${allShowsFilters.selectedGenres.join(',')}`;
      }
      if (allShowsFilters.excludeGenres && allShowsFilters.excludeGenres.length > 0) {
        url += `&exclude_genres=${allShowsFilters.excludeGenres.join(',')}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setAllShows(prev => [...prev, ...(data.results || [])]);
        } else {
          setAllShows(data.results || []);
        }
        setAllShowsTotalPages(data.total_pages || 1);
        setAllShowsTotalResults(data.total_results || 0);
        setAllShowsPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch all shows:', err);
    } finally {
      setAllShowsLoading(false);
    }
  };

  // Load multiple pages at once for better browsing
  const loadManyPages = async (startPage: number, numPages: number, mode: 'all-shows' | 'top-rated', append = false) => {
    setLoadingMultiplePages(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 7.5, minVotes: 2000, sortBy: 'vote_average.desc' }
        : allShowsFilters;

      let baseUrl = `${API_BASE}/tmdb/popular/tv?sort_by=${filters.sortBy}`;
      if (filters.minRating > 0) baseUrl += `&min_rating=${filters.minRating}`;
      if (filters.minVotes > 0) baseUrl += `&min_votes=${filters.minVotes}`;
      if (allShowsFilters.yearFrom) baseUrl += `&year_from=${allShowsFilters.yearFrom}`;
      if (allShowsFilters.yearTo) baseUrl += `&year_to=${allShowsFilters.yearTo}`;
      if (allShowsFilters.selectedGenres.length > 0) {
        baseUrl += `&genre=${allShowsFilters.selectedGenres.join(',')}`;
      }
      if (allShowsFilters.excludeGenres && allShowsFilters.excludeGenres.length > 0) {
        baseUrl += `&exclude_genres=${allShowsFilters.excludeGenres.join(',')}`;
      }

      console.log('Loading with URL:', baseUrl);

      // Fetch pages in parallel
      const promises = [];
      for (let i = 0; i < numPages; i++) {
        const page = startPage + i;
        promises.push(fetch(`${baseUrl}&page=${page}`, { credentials: 'include' }));
      }

      const responses = await Promise.all(promises);
      const dataPromises = responses.map(r => r.ok ? r.json() : null);
      const dataResults = await Promise.all(dataPromises);

      const newResults: TVShow[] = [];
      let actualTotalPages = 1;
      let totalResults = 0;

      dataResults.forEach((data, index) => {
        if (data && data.results) {
          newResults.push(...data.results);
          // Get metadata from first valid response
          if (index === 0 || totalResults === 0) {
            actualTotalPages = data.total_pages || actualTotalPages;
            totalResults = data.total_results || totalResults;
          }
        }
      });

      // Deduplicate by show ID
      const uniqueShows = Array.from(
        new Map(newResults.map(show => [show.id, show])).values()
      );

      if (append) {
        setAllShows(prev => {
          const combined = [...prev, ...uniqueShows];
          // Deduplicate combined array as well
          return Array.from(new Map(combined.map(show => [show.id, show])).values());
        });
      } else {
        setAllShows(uniqueShows);
      }
      setAllShowsTotalPages(actualTotalPages);
      setAllShowsTotalResults(totalResults);
      setAllShowsPage(startPage + numPages - 1);
    } catch (err) {
      console.error('Failed to load many pages:', err);
    } finally {
      setLoadingMultiplePages(false);
    }
  };

  const loadMoreAllShows = () => {
    if (allShowsPage < allShowsTotalPages && !allShowsLoading && !loadingMultiplePages) {
      const mode = viewMode as 'all-shows' | 'top-rated';
      // Load 20 pages at a time for faster browsing through large catalogs
      const nextPage = allShowsPage + 1;
      loadManyPages(nextPage, 20, mode, true);
    }
  };

  // Infinite scroll - automatically loads more when scrolling near bottom
  useInfiniteScroll({
    onLoadMore: loadMoreGenreShows,
    hasMore: viewMode === 'genre' && genreCurrentPage < genreTotalPages,
    isLoading: genreLoading,
    threshold: 800,
    useWindow: true
  });

  useInfiniteScroll({
    onLoadMore: loadMoreAllShows,
    hasMore: (viewMode === 'all-shows' || viewMode === 'top-rated') && allShowsPage < allShowsTotalPages,
    isLoading: allShowsLoading || loadingMultiplePages,
    threshold: 1200, // Trigger earlier (1200px from bottom instead of 800px)
    useWindow: true
  });

  // Debounced search - automatically triggers when user stops typing
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      if (viewMode === 'search') setViewMode('all-shows');
      return;
    }

    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    // Generate cache key
    const cacheKey = `tv:search:${query.toLowerCase()}`;

    // Check cache first
    const cachedResults = searchCache.get<TVShow[]>(cacheKey);
    if (cachedResults) {
      setSearchResults(cachedResults);
      setViewMode('search');
      return;
    }

    setLoading(true);
    setViewMode('search');
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/tv?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        setSearchResults(results);

        // Cache results for 5 minutes
        searchCache.set(cacheKey, results, 5 * 60 * 1000);
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

  const search1337x = (show: TVShow) => {
    const query = encodeURIComponent(`${show.name || show.title} ${show.year || ''}`);
    window.open(`https://1337x.to/search/${query}/1/`, '_blank');
  };

  const searchPirateBay = (show: TVShow) => {
    const query = encodeURIComponent(`${show.name || show.title} ${show.year || ''}`);
    window.open(`https://thepiratebay.org/search.php?q=${query}`, '_blank');
  };

  const searchExtTo = (show: TVShow) => {
    const query = encodeURIComponent(`${show.name || show.title} ${show.year || ''}`);
    window.open(`https://ext.to/search?q=${query}`, '_blank');
  };

  const handleDownload = async (show: TVShow) => {
    if (!downloadUrl.trim()) {
      alert('Please enter a download URL');
      return;
    }

    // Extract filename from URL or use show title
    const filename = extractFilenameFromUrl(downloadUrl) || `${show.name || show.title} S01E01.mkv`;
    setPreviewFilename(filename);
    setLoadingFormat(true);
    setFormatError(null);
    setShowFormatPreview(true);

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
          contentType: 'tv',
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
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (filename && filename.includes('.')) {
        return filename;
      }
    } catch (e) {
      // Not a valid URL
    }
    return null;
  };

  const submitDownload = async (show: TVShow) => {
    if (!formattedPath) {
      alert('Please wait for format preview to load');
      return;
    }

    // Determine category from formatted path base directory
    const category = formattedPath.baseDir?.toLowerCase() || 'tv';

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
            tmdb_id: show.id,
            imdb_id: show.imdb_id,
            title: show.name || show.title,
            year: show.year,
            rating: show.vote_average,
            overview: show.overview,
            poster_url: show.poster_url,
            backdrop_url: show.backdrop_url,
            genre_ids: show.genre_ids
          },
          downloader: 'yt-dlp'
        })
      });

      if (res.ok) {
        alert(`✓ Download queued: ${show.name || show.title}`);
        setSelectedShow(null);
        setDownloadUrl('');
        setShowFormatPreview(false);
        setFormattedPath(null);
        setVpnConfirmed(false);
      } else {
        const error = await res.json();
        alert(`Download failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please check your URL and try again.');
    }
  };

  const TVShowCard = ({ show, size = 'normal' }: { show: TVShow; size?: 'normal' | 'small' }) => {
    // Color code ratings: 9+ = gold, 8-9 = green, 7-8 = blue, <7 = gray
    const getRatingColor = (rating: number) => {
      if (rating >= 9) return 'bg-yellow-500';
      if (rating >= 8) return 'bg-green-500';
      if (rating >= 7) return 'bg-blue-500';
      return 'bg-gray-500';
    };

    const rating = show.imdb_rating ? parseFloat(show.imdb_rating) : show.vote_average;

    return (
      <div
        className={`group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-2xl flex-shrink-0 ${
          size === 'small' ? 'w-40' : 'w-48'
        }`}
        onClick={() => setSelectedShow(show)}
      >
        {show.poster_url ? (
          <img
            src={show.poster_url}
            alt={show.name || show.title}
            className={`w-full object-cover ${size === 'small' ? 'h-60' : 'h-72'}`}
          />
        ) : (
          <div className={`w-full bg-gray-700 flex items-center justify-center ${size === 'small' ? 'h-60' : 'h-72'}`}>
            <Film className="w-16 h-16 text-gray-500" />
          </div>
        )}

        {/* Always show rating badge - color coded by score */}
        <div className={`absolute top-2 right-2 ${getRatingColor(rating)} text-white px-2 py-1 rounded-md font-bold text-sm shadow-lg flex items-center gap-1`}>
          <Star className="w-3 h-3 fill-white" />
          {rating.toFixed(1)}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 p-3 w-full">
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-2">{show.name || show.title}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              {show.year && <span>{show.year}</span>}
              <span className="text-gray-400">• {show.vote_count.toLocaleString()} votes</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TVShowRow = ({ title, shows, loading, onSeeAll }: {
    title: string;
    shows: TVShow[];
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
              {shows.map(show => (
                <TVShowCard key={show.id} show={show} />
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
                {viewMode === 'genre' && selectedGenre ? `${selectedGenre.emoji} ${selectedGenre.name} TV Shows` :
                 viewMode === 'all-shows' ? '📺 All TV Shows' :
                 viewMode === 'top-rated' ? '⭐ Top Rated TV Shows' :
                 'TV Shows'}
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
                placeholder="Search TV shows..."
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
              {searchResults.map(show => (
                <TVShowCard key={show.id} show={show} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No TV shows found</p>
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
              Showing {genreShows.length} TV shows • Page {genreCurrentPage} of {genreTotalPages}
            </div>
          </div>

          {/* Shows Grid */}
          {genreLoading && genreCurrentPage === 1 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {genreShows.map(show => (
                  <TVShowCard key={show.id} show={show} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {genreLoading && genreCurrentPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more shows...</p>
                </div>
              )}

              {!genreLoading && genreCurrentPage >= genreTotalPages && genreShows.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more shows to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All Shows View */}
      {viewMode === 'all-shows' && (
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
          {/* Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAllShowsFilters(!showAllShowsFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showAllShowsFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <div className="text-sm text-gray-400">
              {allShows.length} TV shows loaded • Page {allShowsPage}/{allShowsTotalPages}
            </div>
          </div>

          {/* Filter Panel */}
          {showAllShowsFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
                  <select
                    value={allShowsFilters.sortBy}
                    onChange={(e) => setAllShowsFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="vote_average.desc">⭐ Top Rated</option>
                    <option value="popularity.desc">🔥 Most Popular</option>
                    <option value="first_air_date.desc">📅 Newest First</option>
                  </select>
                </div>

                {/* Quality Presets */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Quick Filters (click to toggle on/off)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (activePreset === 'worth-watching') {
                          // Deselect - reset to no filters
                          setAllShowsFilters({
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
                          setAllShowsFilters({
                            minRating: 6.0,
                            minVotes: 100,
                            excludeGenres: [16, 10762, 10764, 10767],
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
                          setAllShowsFilters({
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
                          setAllShowsFilters({
                            minRating: 7.0,
                            minVotes: 500,
                            excludeGenres: [16, 10762, 10764, 10767],
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
                      ⭐ Quality Shows (7.0+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'elite') {
                          // Deselect - reset to no filters
                          setAllShowsFilters({
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
                          setAllShowsFilters({
                            minRating: 8.0,
                            minVotes: 1000,
                            excludeGenres: [16, 10762, 10764, 10767],
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
                    {localStorage.getItem('tvShowsFilters') && (
                      <button
                        onClick={() => {
                          if (activePreset === 'saved') {
                            // Deselect - reset to no filters
                            setAllShowsFilters({
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
                            const savedFilters = localStorage.getItem('tvShowsFilters');
                            if (savedFilters) {
                              setAllShowsFilters(JSON.parse(savedFilters));
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
                    Min Rating: {allShowsFilters.minRating > 0 ? allShowsFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={allShowsFilters.minRating}
                    onChange={(e) => setAllShowsFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allShowsFilters.minVotes > 0 ? allShowsFilters.minVotes : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={allShowsFilters.minVotes}
                    onChange={(e) => setAllShowsFilters(prev => ({ ...prev, minVotes: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Year Range */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Year Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1950"
                      max={new Date().getFullYear()}
                      value={allShowsFilters.yearFrom || ''}
                      onChange={(e) => setAllShowsFilters(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="From"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <input
                      type="number"
                      min="1950"
                      max={new Date().getFullYear()}
                      value={allShowsFilters.yearTo || ''}
                      onChange={(e) => setAllShowsFilters(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="To"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Genre Multi-Select (Click to toggle include/exclude) */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Genres (click to toggle • <span className="text-green-400">included</span> / <span className="text-red-400">excluded</span>)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {genres.map(genre => {
                      const isExcluded = allShowsFilters.excludeGenres.includes(genre.id);
                      return (
                        <button
                          key={genre.id}
                          onClick={() => {
                            setAllShowsFilters(prev => ({
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
                      localStorage.setItem('tvShowsFilters', JSON.stringify(allShowsFilters));
                      setActivePreset('saved');
                      alert('✓ Filters saved! Use "My Saved Filters" button to load them anytime.');
                    }}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-lg"
                  >
                    💾 Save These Filters
                  </button>
                  <button
                    onClick={() => {
                      setAllShowsFilters({
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
              {loadingMultiplePages ? (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Loader className="w-4 h-4 animate-spin" />
                  Loading shows...
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-300">
                    <span className="text-gray-400">Loaded:</span>{' '}
                    <span className="font-bold text-white">{allShows.length.toLocaleString()}</span> of{' '}
                    <span className="font-bold text-blue-400">{allShowsTotalResults.toLocaleString()}</span>{' '}
                    {allShowsFilters.minRating > 0 || allShowsFilters.minVotes > 0 || allShowsFilters.selectedGenres.length > 0 || allShowsFilters.excludeGenres.length > 0 || allShowsFilters.yearFrom || allShowsFilters.yearTo ? (
                      <span className="text-yellow-400">matching shows</span>
                    ) : (
                      <span className="text-gray-400">shows</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Total catalog: <span className="font-semibold text-gray-400">210,119+ TV shows</span>
                    {(allShowsFilters.minRating > 0 || allShowsFilters.minVotes > 0 || allShowsFilters.selectedGenres.length > 0 || allShowsFilters.excludeGenres.length > 0 || allShowsFilters.yearFrom || allShowsFilters.yearTo) && (
                      <span className="ml-2 text-yellow-400">• Filters active</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {allShowsLoading && allShowsPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allShows.map(show => (
                  <TVShowCard key={show.id} show={show} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allShowsLoading || loadingMultiplePages) && allShowsPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more shows...</p>
                </div>
              )}

              {!allShowsLoading && !loadingMultiplePages && allShowsPage >= allShowsTotalPages && allShows.length > 0 && (
                <div className="text-center mt-8 py-6">
                  <div className="inline-block bg-green-900/30 border border-green-500/50 rounded-lg px-6 py-3">
                    <p className="text-green-400 font-medium">✓ All {allShows.length.toLocaleString()} matching results loaded</p>
                    <p className="text-xs text-gray-400 mt-1">Showing all shows that match your current filters</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Top Rated View */}
      {viewMode === 'top-rated' && (
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
          {/* Results header */}
          <div className="bg-gray-800/50 p-4 rounded-lg border-l-4 border-yellow-500">
            <h2 className="text-xl font-bold mb-2">⭐ Top Rated TV Shows (Rating ≥ 7.5)</h2>
            <div className="space-y-1">
              {loadingMultiplePages ? (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Loader className="w-4 h-4 animate-spin" />
                  Loading shows...
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-300">
                    <span className="text-gray-400">Loaded:</span>{' '}
                    <span className="font-bold text-white">{allShows.length.toLocaleString()}</span> of{' '}
                    <span className="font-bold text-yellow-400">{allShowsTotalResults.toLocaleString()}</span>{' '}
                    <span className="text-yellow-400">top-rated shows</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Total catalog: <span className="font-semibold text-gray-400">210,119+ TV shows</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {allShowsLoading && allShowsPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allShows.map(show => (
                  <TVShowCard key={show.id} show={show} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allShowsLoading || loadingMultiplePages) && allShowsPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more shows...</p>
                </div>
              )}

              {!allShowsLoading && !loadingMultiplePages && allShowsPage >= allShowsTotalPages && allShows.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more shows to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TV Show Modal */}
      {selectedShow && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedShow(null);
            setVpnConfirmed(false);
          }}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedShow.backdrop_url && (
              <img
                src={selectedShow.backdrop_url}
                alt={selectedShow.name || selectedShow.title}
                className="w-full h-64 object-cover rounded-t-lg"
              />
            )}

            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedShow.name || selectedShow.title}</h2>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                {selectedShow.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedShow.year}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{selectedShow.vote_average.toFixed(1)}/10</span>
                </div>
                {selectedShow.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${selectedShow.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  >
                    IMDb
                  </a>
                )}
              </div>

              <p className="text-gray-300 mb-6">{selectedShow.overview}</p>

              <div className="space-y-4">
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">How to Download</h3>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Click a search button below to find this TV show</li>
                    <li>Copy the magnet link URL</li>
                    <li>Paste URL below and click "Queue Download"</li>
                  </ol>
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => search1337x(selectedShow)}
                      className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      1337x
                    </button>
                    <button
                      onClick={() => searchPirateBay(selectedShow)}
                      className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      PirateBay
                    </button>
                    <button
                      onClick={() => searchExtTo(selectedShow)}
                      className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      Ext.to
                    </button>
                  </div>
                  <input
                    type="text"
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    placeholder="Paste video URL here..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none mb-3"
                  />
                  <button
                    onClick={() => handleDownload(selectedShow)}
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
                            onClick={() => handleDownload(selectedShow)}
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
                              {formattedPath.contentType === 'tv' ? 'TV Show' : 'Movie'}
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
                                {formattedPath.folderStructure.showName && (
                                  <div>
                                    <span className="text-gray-500">Show:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.showName}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.movieName && (
                                  <div>
                                    <span className="text-gray-500">Movie:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.movieName}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.year && (
                                  <div>
                                    <span className="text-gray-500">Year:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.year}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.season !== undefined && (
                                  <div>
                                    <span className="text-gray-500">Season:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.season}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.episode !== undefined && (
                                  <div>
                                    <span className="text-gray-500">Episode:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.episode}</span>
                                  </div>
                                )}
                                {formattedPath.folderStructure.episodeTitle && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500">Title:</span>
                                    <span className="ml-2 font-medium text-gray-300">{formattedPath.folderStructure.episodeTitle}</span>
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
                      {/* VPN Safety Check */}
                      <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vpnConfirmed}
                            onChange={(e) => setVpnConfirmed(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className="text-orange-300 font-medium text-sm">
                            I confirm that my VPN is connected before downloading
                          </span>
                        </label>
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => submitDownload(selectedShow)}
                          disabled={!vpnConfirmed}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
                        >
                          <Download className="w-5 h-5" />
                          Confirm Download
                        </button>
                        <button
                          onClick={() => {
                            setShowFormatPreview(false);
                            setFormattedPath(null);
                            setVpnConfirmed(false);
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
