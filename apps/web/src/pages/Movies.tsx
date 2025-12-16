import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';
import { API_BASE } from '@/lib/config';
import { AdvancedFilters } from '../components/AdvancedFilters';

interface Movie {
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
  movies: Movie[];
  loading: boolean;
}

type ViewMode = 'browse' | 'search' | 'genre' | 'all-movies' | 'top-rated';

export default function Movies() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all-movies');
  const [showFormatPreview, setShowFormatPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
  const [formattedPath, setFormattedPath] = useState<any>(null);
  const [loadingFormat, setLoadingFormat] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(false);
  const [bookmarkedMovies, setBookmarkedMovies] = useState<Set<number>>(new Set());
  const [downloadedMovies, setDownloadedMovies] = useState<Set<number>>(new Set());

  // Torrent search state
  const [torrentResults, setTorrentResults] = useState<any[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  // Browse mode sections
  const [genreSections, setGenreSections] = useState<GenreSection[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<Movie[]>([]);

  // Genre view state
  const [selectedGenre, setSelectedGenre] = useState<GenreSection | null>(null);
  const [genreMovies, setGenreMovies] = useState<Movie[]>([]);
  const [genreCurrentPage, setGenreCurrentPage] = useState(1);
  const [genreTotalPages, setGenreTotalPages] = useState(1);
  const [genreLoading, setGenreLoading] = useState(false);

  // All movies / Top Rated view state
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [allMoviesPage, setAllMoviesPage] = useState(1);
  const [allMoviesTotalPages, setAllMoviesTotalPages] = useState(1);
  const [allMoviesTotalResults, setAllMoviesTotalResults] = useState(0);
  const [allMoviesLoading, setAllMoviesLoading] = useState(false);
  const [loadingMultiplePages, setLoadingMultiplePages] = useState(false);

  // IMDB Top 250 state
  const [imdbTop250Movies, setImdbTop250Movies] = useState<Movie[]>([]);
  const [imdbTop250Loading, setImdbTop250Loading] = useState(false);

  // All movies filters (default to NO filters - show everything, let users customize)
  const [allMoviesFilters, setAllMoviesFilters] = useState({
    minRating: 0,
    minVotes: 0,
    yearFrom: null as number | null,
    yearTo: null as number | null,
    sortBy: 'popularity.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc',
    selectedGenres: [] as number[],
    excludeGenres: [] as number[],
    originCountries: [] as string[]
  });
  const [showAllMoviesFilters, setShowAllMoviesFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Advanced filters (collection, company, director, actor)
  const [selectedCollection, setSelectedCollection] = useState<{ id: number; name: string } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null);
  const [selectedDirector, setSelectedDirector] = useState<{ id: number; name: string } | null>(null);
  const [selectedActor, setSelectedActor] = useState<{ id: number; name: string } | null>(null);
  const [advancedFilterMovies, setAdvancedFilterMovies] = useState<Movie[]>([]);
  const [advancedFilterLoading, setAdvancedFilterLoading] = useState(false);
  const [advancedFilterPage, setAdvancedFilterPage] = useState(1);

  // Genre filters
  const [genreFilters, setGenreFilters] = useState({
    minRating: 0,
    minVotes: 1000,
    year: null as number | null,
    sortBy: 'vote_average.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc' | 'vote_count.desc'
  });
  const [showGenreFilters, setShowGenreFilters] = useState(false);

  const isInitialMount = React.useRef(true);
  const restoringScroll = React.useRef(false);
  const scrollPositionSaved = React.useRef(false);

  // Load movies on mount
  useEffect(() => {
    fetchGenres();
    setShowAllMoviesFilters(true);

    // Try to restore browse state from sessionStorage
    const savedBrowseState = sessionStorage.getItem('moviesBrowseState');
    if (savedBrowseState) {
      try {
        const { movies, page, totalPages, totalResults, viewMode: savedViewMode, scrollY } = JSON.parse(savedBrowseState);
        restoringScroll.current = true;
        setAllMovies(movies || []);
        setAllMoviesPage(page || 1);
        setAllMoviesTotalPages(totalPages || 1);
        setAllMoviesTotalResults(totalResults || 0);
        setViewMode(savedViewMode || 'all-movies');

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
    const savedFilters = localStorage.getItem('moviesFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setAllMoviesFilters(parsed);
        setActivePreset('saved');
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    // Only load movies if we didn't restore state
    if (!savedBrowseState) {
      loadMovies();
    }
  }, []);

  // Load bookmarked movies
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const res = await fetch(`${API_BASE}/bookmarks?type=tmdb_movie`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const bookmarkedIds = new Set(data.bookmarks.map((b: any) => b.tmdb_id));
          setBookmarkedMovies(bookmarkedIds);
        }
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
      }
    };
    fetchBookmarks();
  }, []);

  // Load downloaded movies
  useEffect(() => {
    const fetchDownloaded = async () => {
      try {
        const res = await fetch(`${API_BASE}/media/downloaded-tmdb-ids`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setDownloadedMovies(new Set(data.movie || []));
        }
      } catch (err) {
        console.error('Failed to fetch downloaded movies:', err);
      }
    };
    fetchDownloaded();
  }, []);

  // Watch for filter changes and reload
  useEffect(() => {
    console.log('[DEBUG useEffect] Filter change detected', {
      isInitialMount: isInitialMount.current,
      selectedCollection,
      selectedCompany,
      selectedDirector,
      selectedActor,
      viewMode
    });

    if (isInitialMount.current) {
      console.log('[DEBUG useEffect] Skipping - initial mount');
      isInitialMount.current = false;
      return;
    }

    // Skip loading if advanced filter is active
    const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;
    if (hasAdvancedFilter) {
      console.log('[DEBUG useEffect] Skipping - advanced filter active');
      return;
    }

    if (viewMode === 'all-movies' || viewMode === 'top-rated') {
      console.log('[DEBUG useEffect] Scheduling loadManyPages');
      const timeoutId = setTimeout(() => {
        console.log('[DEBUG useEffect] Executing loadManyPages');
        loadManyPages(1, 3, viewMode, false); // Load 3 pages initially (~50 movies)
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [allMoviesFilters.minRating, allMoviesFilters.minVotes, allMoviesFilters.sortBy, allMoviesFilters.yearFrom, allMoviesFilters.yearTo, allMoviesFilters.selectedGenres, allMoviesFilters.excludeGenres, allMoviesFilters.originCountries, selectedCollection, selectedCompany, selectedDirector, selectedActor]);

  // Save browse state to sessionStorage when it changes
  useEffect(() => {
    if (restoringScroll.current || allMovies.length === 0) return;

    const browseState = {
      movies: allMovies,
      page: allMoviesPage,
      totalPages: allMoviesTotalPages,
      totalResults: allMoviesTotalResults,
      viewMode,
      scrollY: window.scrollY
    };

    sessionStorage.setItem('moviesBrowseState', JSON.stringify(browseState));
  }, [allMovies, allMoviesPage, allMoviesTotalPages, allMoviesTotalResults, viewMode]);

  // Save scroll position on scroll events
  useEffect(() => {
    const saveScrollPosition = () => {
      if (restoringScroll.current) return;

      const savedState = sessionStorage.getItem('moviesBrowseState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          state.scrollY = window.scrollY;
          sessionStorage.setItem('moviesBrowseState', JSON.stringify(state));
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

  // Function to load movies based on current filters
  const loadMovies = () => {
    loadManyPages(1, 3, 'all-movies'); // Load 3 pages initially (~50 movies)
  };

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
      movies: [],
      loading: true
    }));
    setGenreSections(sections);

    // Fetch top-rated movies for each genre
    GENRE_CONFIG.forEach(config => {
      fetchGenreSection(config.id, config.name, config.emoji);
    });
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/trending/movie/week`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by popularity for trending
        const sorted = (data.results || []).sort((a: Movie, b: Movie) =>
          b.popularity - a.popularity
        );
        setTrendingMovies(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch trending:', err);
    }
  };

  const fetchTopRated = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/top-rated/movies?page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by rating to guarantee perfect order
        const sorted = (data.results || []).sort((a: Movie, b: Movie) =>
          b.vote_average - a.vote_average
        );
        setTopRatedMovies(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch top rated:', err);
    }
  };

  const fetchNowPlaying = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/now-playing/movies?page=1`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort by release date (newest first)
        const sorted = (data.results || []).sort((a: Movie, b: Movie) => {
          const yearA = a.year ? parseInt(a.year) : 0;
          const yearB = b.year ? parseInt(b.year) : 0;
          return yearB - yearA;
        });
        setNowPlayingMovies(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch now playing:', err);
    }
  };

  const fetchGenreSection = async (genreId: number, genreName: string, emoji: string) => {
    try {
      // Browse mode: Show ONLY the best of the best (7.5+, 2000+ votes)
      // Always exclude documentaries (99), music (10402), and TV movies (10770)
      const res = await fetch(
        `${API_BASE}/tmdb/discover/movies?genre=${genreId}&sort_by=vote_average.desc&page=1&min_rating=7.5&min_votes=2000&exclude_genres=99,10402,10770`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        // Client-side re-sort to guarantee perfect descending order
        const sortedMovies = (data.results || []).sort((a: Movie, b: Movie) =>
          b.vote_average - a.vote_average
        );
        setGenreSections(prev => prev.map(section =>
          section.id === genreId
            ? { ...section, movies: sortedMovies, loading: false }
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
    await fetchGenreMovies(section.id, 1, {
      minRating: 0,
      minVotes: 1000,
      year: null,
      sortBy: 'vote_average.desc'
    });
  };

  const fetchGenreMovies = async (
    genreId: number,
    page: number,
    filters: typeof genreFilters
  ) => {
    setGenreLoading(true);
    try {
      // Always exclude documentaries (99), music (10402), and TV movies (10770)
      let url = `${API_BASE}/tmdb/discover/movies?genre=${genreId}&sort_by=${filters.sortBy}&page=${page}&enrich=true&exclude_genres=99,10402,10770`;
      if (filters.minRating > 0) url += `&min_rating=${filters.minRating}`;
      if (filters.minVotes > 0) url += `&min_votes=${filters.minVotes}`;
      if (filters.year) url += `&year=${filters.year}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let results = data.results || [];

        // Client-side re-sort to guarantee perfect order based on sortBy
        if (filters.sortBy === 'vote_average.desc') {
          results = results.sort((a: Movie, b: Movie) => {
            const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
            const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
            return ratingB - ratingA;
          });
        } else if (filters.sortBy === 'popularity.desc') {
          results = results.sort((a: Movie, b: Movie) => b.popularity - a.popularity);
        } else if (filters.sortBy === 'release_date.desc') {
          results = results.sort((a: Movie, b: Movie) => {
            const yearA = a.year ? parseInt(a.year) : 0;
            const yearB = b.year ? parseInt(b.year) : 0;
            return yearB - yearA;
          });
        } else if (filters.sortBy === 'vote_count.desc') {
          results = results.sort((a: Movie, b: Movie) => b.vote_count - a.vote_count);
        }

        if (page === 1) {
          setGenreMovies(results);
        } else {
          // When loading more, merge and re-sort all movies
          const allMovies = [...genreMovies, ...results];
          if (filters.sortBy === 'vote_average.desc') {
            setGenreMovies(allMovies.sort((a, b) => {
              const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
              const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
              return ratingB - ratingA;
            }));
          } else {
            setGenreMovies(allMovies);
          }
        }

        setGenreTotalPages(data.total_pages || 1);
        setGenreCurrentPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch genre movies:', err);
    } finally {
      setGenreLoading(false);
    }
  };

  const loadMoreGenreMovies = () => {
    if (selectedGenre && genreCurrentPage < genreTotalPages && !genreLoading) {
      fetchGenreMovies(selectedGenre.id, genreCurrentPage + 1, genreFilters);
    }
  };

  const applyGenreFilters = () => {
    if (selectedGenre) {
      fetchGenreMovies(selectedGenre.id, 1, genreFilters);
    }
  };

  const openTopRatedView = async () => {
    setViewMode('top-rated');
    setAllMoviesPage(1);
    await fetchAllMovies(1, 'top-rated');
  };

  const openAllMoviesView = async () => {
    setViewMode('all-movies');
    setAllMoviesPage(1);
    await fetchAllMovies(1, 'all-movies');
  };

  const loadIMDBTop250Movies = async () => {
    setAllMoviesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/curated-lists/imdb-top-250-movies/items`, {
        credentials: 'include'
      });
      console.log('[IMDB Top 250] Response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[IMDB Top 250] Received data:', data);
        console.log('[IMDB Top 250] Items count:', data.items?.length || 0);
        // Set the IMDB Top 250 movies as the all movies list
        setAllMovies(data.items || []);
        setAllMoviesTotalResults(data.items?.length || 0);
        setAllMoviesPage(1);
        setAllMoviesTotalPages(1);
        setViewMode('all-movies');
      } else {
        console.error('[IMDB Top 250] Request failed with status:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch IMDB Top 250:', err);
    } finally {
      setAllMoviesLoading(false);
    }
  };

  const fetchAllMovies = async (page: number, mode: 'all-movies' | 'top-rated', append = false) => {
    setAllMoviesLoading(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 7.5, minVotes: 2000, sortBy: 'vote_average.desc' as const }
        : allMoviesFilters;

      let url = `${API_BASE}/tmdb/discover/movies?sort_by=${filters.sortBy}&page=${page}&min_rating=${filters.minRating}&min_votes=${filters.minVotes}&enrich=true`;

      if (allMoviesFilters.yearFrom) url += `&year_from=${allMoviesFilters.yearFrom}`;
      if (allMoviesFilters.yearTo) url += `&year_to=${allMoviesFilters.yearTo}`;
      if (allMoviesFilters.selectedGenres.length > 0) {
        url += `&genre=${allMoviesFilters.selectedGenres.join(',')}`;
      }

      // Always exclude documentaries (99), music (10402), and TV movies (10770), plus any user exclusions
      const autoExclude = [99, 10402, 10770]; // Documentary, Music, and TV Movie genres
      const userExclude = allMoviesFilters.excludeGenres || [];
      const allExclusions = [...new Set([...autoExclude, ...userExclude])]; // Merge and deduplicate
      if (allExclusions.length > 0) {
        url += `&exclude_genres=${allExclusions.join(',')}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setAllMovies(prev => [...prev, ...(data.results || [])]);
        } else {
          setAllMovies(data.results || []);
        }
        setAllMoviesTotalPages(data.total_pages || 1);
        setAllMoviesTotalResults(data.total_results || 0);
        setAllMoviesPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch all movies:', err);
    } finally {
      setAllMoviesLoading(false);
    }
  };

  // Load multiple pages at once for better browsing
  const loadManyPages = async (startPage: number, numPages: number, mode: 'all-movies' | 'top-rated', append = false) => {
    console.log('[DEBUG loadManyPages] Called with:', { startPage, numPages, mode, append });
    console.log('[DEBUG loadManyPages] Stack trace:', new Error().stack);
    setLoadingMultiplePages(true);
    try {
      const filters = mode === 'top-rated'
        ? { minRating: 7.5, minVotes: 2000, sortBy: 'vote_average.desc' as const }
        : allMoviesFilters;

      let baseUrl = `${API_BASE}/tmdb/discover/movies?sort_by=${filters.sortBy}&min_rating=${filters.minRating}&min_votes=${filters.minVotes}&enrich=true`;
      if (allMoviesFilters.yearFrom) baseUrl += `&year_from=${allMoviesFilters.yearFrom}`;
      if (allMoviesFilters.yearTo) baseUrl += `&year_to=${allMoviesFilters.yearTo}`;
      if (allMoviesFilters.selectedGenres.length > 0) {
        baseUrl += `&genre=${allMoviesFilters.selectedGenres.join(',')}`;
      }

      // Always exclude documentaries (99), music (10402), and TV movies (10770), plus any user exclusions
      const autoExclude = [99, 10402, 10770]; // Documentary, Music, and TV Movie genres
      const userExclude = allMoviesFilters.excludeGenres || [];
      const allExclusions = [...new Set([...autoExclude, ...userExclude])]; // Merge and deduplicate
      if (allExclusions.length > 0) {
        baseUrl += `&exclude_genres=${allExclusions.join(',')}`;
      }

      if (allMoviesFilters.originCountries && allMoviesFilters.originCountries.length > 0) {
        baseUrl += `&origin_countries=${allMoviesFilters.originCountries.join(',')}`;
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

      const newResults: Movie[] = [];

      dataResults.forEach((data) => {
        if (data && data.results) {
          newResults.push(...data.results);
        }
      });

      // Get metadata from first valid response that has the data
      const firstValidResponse = dataResults.find(d => d && d.total_pages && d.total_results);
      const actualTotalPages = firstValidResponse?.total_pages || 1;
      const totalResults = firstValidResponse?.total_results || 0;

      // Deduplicate by movie ID
      const uniqueMovies = Array.from(
        new Map(newResults.map(movie => [movie.id, movie])).values()
      );

      if (append) {
        setAllMovies(prev => {
          const combined = [...prev, ...uniqueMovies];
          // Deduplicate combined array as well
          return Array.from(new Map(combined.map(movie => [movie.id, movie])).values());
        });
      } else {
        setAllMovies(uniqueMovies);
      }
      setAllMoviesTotalPages(actualTotalPages);
      setAllMoviesTotalResults(totalResults);
      setAllMoviesPage(startPage + numPages - 1);
    } catch (err) {
      console.error('Failed to load many pages:', err);
    } finally {
      setLoadingMultiplePages(false);
    }
  };

  const loadMoreAllMovies = () => {
    if (allMoviesPage < allMoviesTotalPages && !allMoviesLoading && !loadingMultiplePages) {
      const mode = viewMode as 'all-movies' | 'top-rated';
      // Load 3 pages at a time during scroll (60 movies) for smooth performance
      const nextPage = allMoviesPage + 1;
      loadManyPages(nextPage, 3, mode, true);
    }
  };

  // Helper function to clear ALL advanced filters and reset state
  const clearAllAdvancedFilters = () => {
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');
    setAllMovies([]);
    setAdvancedFilterLoading(false);
  };

  // Advanced Filter Handlers
  const handleCollectionSelect = async (collectionId: number | null, name: string) => {
    if (!collectionId) {
      // Only clear THIS filter
      setSelectedCollection(null);
      // If no other filters active, reload catalog
      if (!selectedCompany && !selectedDirector && !selectedActor && !searchQuery) {
        setAllMovies([]);
        loadManyPages(1, 3, viewMode, false);
      }
      return;
    }

    // Clear OTHER filter types (not this one)
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');

    // Set this filter and show loading
    setSelectedCollection({ id: collectionId, name });
    setAllMovies([]); // Clear movies for instant feedback
    setAdvancedFilterLoading(true);

    try {
      const res = await fetch(`${API_BASE}/tmdb/collection/${collectionId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();

        // Transform TMDB format to Movie format (poster_path -> poster_url, etc.)
        const transformedMovies = (data.parts || []).map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date ? movie.release_date.split('-')[0] : null
        }));

        setAllMovies(transformedMovies);
        setAllMoviesTotalPages(1); // Collection is just one "page"
        setAllMoviesPage(1);
        setAllMoviesTotalResults(transformedMovies.length);
      }
    } catch (error) {
      console.error('Failed to load collection:', error);
      setAllMovies([]);
    } finally {
      setAdvancedFilterLoading(false);
    }
  };

  const handleCompanySelect = async (companyId: number | null, name: string) => {
    if (!companyId) {
      setSelectedCompany(null);
      if (!selectedCollection && !selectedDirector && !selectedActor && !searchQuery) {
        setAllMovies([]);
        loadManyPages(1, 3, viewMode, false);
      }
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');

    setSelectedCompany({ id: companyId, name });
    setAllMovies([]);
    setAdvancedFilterLoading(true);

    try {
      // Load first 3 pages (60 movies) immediately
      const pages = await Promise.all([1, 2, 3].map(page =>
        fetch(`${API_BASE}/tmdb/discover/company/${companyId}?page=${page}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
      ));

      const allResults = pages.flatMap(data => data?.results || []);
      const totalResults = pages[0]?.total_results || 0;
      const totalPages = pages[0]?.total_pages || 1;

      const transformedMovies = allResults.map((movie: any) => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        year: movie.release_date ? movie.release_date.split('-')[0] : null
      }));

      setAllMovies(transformedMovies);
      setAllMoviesTotalPages(totalPages);
      setAllMoviesPage(3);
      setAllMoviesTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load company movies:', error);
      setAllMovies([]);
    } finally {
      setAdvancedFilterLoading(false);
    }
  };

  const handleDirectorSelect = async (personId: number | null, name: string) => {
    console.log('[DEBUG] handleDirectorSelect called:', { personId, name });

    if (!personId) {
      console.log('[DEBUG] Clearing director filter');
      setSelectedDirector(null);
      if (!selectedCollection && !selectedCompany && !selectedActor && !searchQuery) {
        setAllMovies([]);
        loadManyPages(1, 3, viewMode, false);
      }
      return;
    }

    // Clear OTHER filter types
    console.log('[DEBUG] Clearing other filters');
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedActor(null);
    setSearchQuery('');

    console.log('[DEBUG] Setting director and clearing movies');
    setSelectedDirector({ id: personId, name });
    setAllMovies([]);
    setAdvancedFilterLoading(true);

    try {
      const url = `${API_BASE}/tmdb/discover/person/${personId}?role=crew`;
      console.log('[DEBUG] Fetching director movies from:', url);
      const res = await fetch(url, { credentials: 'include' });

      console.log('[DEBUG] Response status:', res.status, res.ok);

      if (res.ok) {
        const data = await res.json();
        console.log('[DEBUG] API response:', {
          resultsCount: data.results?.length,
          totalResults: data.total_results,
          totalPages: data.total_pages,
          firstMovie: data.results?.[0]?.title
        });

        // Directors usually have fewer movies, load all in one go
        const transformedMovies = (data.results || []).map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date ? movie.release_date.split('-')[0] : null
        }));

        console.log('[DEBUG] Setting movies:', {
          count: transformedMovies.length,
          titles: transformedMovies.slice(0, 5).map((m: any) => m.title)
        });

        setAllMovies(transformedMovies);
        setAllMoviesTotalPages(1);
        setAllMoviesPage(1);
        setAllMoviesTotalResults(transformedMovies.length);

        console.log('[DEBUG] State updated successfully');
      } else {
        console.error('[DEBUG] API request failed:', res.status);
      }
    } catch (error) {
      console.error('[DEBUG] Failed to load director movies:', error);
      setAllMovies([]);
    } finally {
      setAdvancedFilterLoading(false);
      console.log('[DEBUG] handleDirectorSelect complete');
    }
  };

  const handleActorSelect = async (personId: number | null, name: string) => {
    if (!personId) {
      setSelectedActor(null);
      if (!selectedCollection && !selectedCompany && !selectedDirector && !searchQuery) {
        setAllMovies([]);
        loadManyPages(1, 3, viewMode, false);
      }
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSearchQuery('');

    setSelectedActor({ id: personId, name });
    setAllMovies([]);
    setAdvancedFilterLoading(true);

    try {
      // Load first 5 pages (100 movies) for actors who typically have many films
      const pages = await Promise.all([1, 2, 3, 4, 5].map(page =>
        fetch(`${API_BASE}/tmdb/discover/person/${personId}?role=cast&page=${page}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
      ));

      const allResults = pages.flatMap(data => data?.results || []);
      const totalResults = pages[0]?.total_results || 0;
      const totalPages = pages[0]?.total_pages || 1;

      const transformedMovies = allResults.map((movie: any) => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        year: movie.release_date ? movie.release_date.split('-')[0] : null
      }));

      setAllMovies(transformedMovies);
      setAllMoviesTotalPages(totalPages);
      setAllMoviesPage(5);
      setAllMoviesTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load actor movies:', error);
      setAllMovies([]);
    } finally {
      setAdvancedFilterLoading(false);
    }
  };

  const handleMovieSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      if (!selectedCollection && !selectedCompany && !selectedDirector && !selectedActor) {
        setAllMovies([]);
        loadManyPages(1, 3, viewMode, false);
      }
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSelectedActor(null);

    setSearchQuery(query);
    setAllMovies([]);
    setAdvancedFilterLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/movies?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        setAllMovies(results);
        setAllMoviesTotalPages(data.total_pages || 1);
        setAllMoviesPage(1);
        setAllMoviesTotalResults(data.total_results || results.length);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setAllMovies([]);
    } finally {
      setAdvancedFilterLoading(false);
    }
  };

  // Infinite scroll - consolidated into single hook to avoid conflicts
  const hasMoreGenre = viewMode === 'genre' && genreCurrentPage < genreTotalPages;
  const hasMoreAllMovies = (viewMode === 'all-movies' || viewMode === 'top-rated') && allMoviesPage < allMoviesTotalPages;
  const hasMore = hasMoreGenre || hasMoreAllMovies;
  const isLoadingAny = genreLoading || allMoviesLoading || loadingMultiplePages;

  const handleLoadMore = () => {
    if (viewMode === 'genre' && hasMoreGenre && !genreLoading) {
      loadMoreGenreMovies();
    } else if ((viewMode === 'all-movies' || viewMode === 'top-rated') && hasMoreAllMovies && !allMoviesLoading && !loadingMultiplePages) {
      loadMoreAllMovies();
    }
  };

  useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore,
    isLoading: isLoadingAny,
    threshold: 1200,
    useWindow: true
  });

  // Debounced search - disabled, now handled by AdvancedFilters component
  // useEffect(() => {
  //   if (!debouncedSearchQuery.trim()) {
  //     setSearchResults([]);
  //     if (viewMode === 'search') setViewMode('all-movies');
  //     return;
  //   }
  //   performSearch(debouncedSearchQuery);
  // }, [debouncedSearchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    // Generate cache key
    const cacheKey = `movies:search:${query.toLowerCase()}`;

    // Check cache first
    const cachedResults = searchCache.get<Movie[]>(cacheKey);
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

  const search1337x = (movie: Movie) => {
    const query = encodeURIComponent(`${movie.title} ${movie.year || ''}`);
    window.open(`https://1337x.to/search/${query}/1/`, '_blank');
  };

  const searchPirateBay = (movie: Movie) => {
    const query = encodeURIComponent(`${movie.title} ${movie.year || ''}`);
    window.open(`https://thepiratebay.org/search.php?q=${query}`, '_blank');
  };

  const searchExtTo = (movie: Movie) => {
    const query = encodeURIComponent(`${movie.title} ${movie.year || ''}`);
    window.open(`https://ext.to/search?q=${query}`, '_blank');
  };

  const searchTorrents = async (movie: Movie) => {
    // Clean up title for better torrent search results
    // Remove colons, parentheses, and other special chars that cause issues
    let cleanTitle = movie.title
      .replace(/:/g, '')  // Remove colons
      .replace(/\([^)]*\)/g, '')  // Remove anything in parentheses
      .replace(/[^\w\s]/g, ' ')  // Remove special characters except spaces
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();

    // Limit to first 4-5 words to avoid overly long queries
    const words = cleanTitle.split(' ');
    if (words.length > 5) {
      cleanTitle = words.slice(0, 5).join(' ');
    }

    const query = `${cleanTitle} ${movie.year || ''}`.trim();
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
      console.log('[Movies] Torrent search query:', query);
      console.log('[Movies] Torrent search results:', data);
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

  const handleDownload = async (movie: Movie) => {
    if (!downloadUrl.trim()) {
      alert('Please enter a download URL');
      return;
    }

    // Extract filename from URL or use movie title
    const filename = extractFilenameFromUrl(downloadUrl) || `${movie.title} (${movie.year}).mkv`;
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
          contentType: 'movie',
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

  const submitDownload = async (movie: Movie) => {
    if (!formattedPath) {
      alert('Please wait for format preview to load');
      return;
    }

    // Determine category from formatted path base directory
    const category = formattedPath.baseDir?.toLowerCase() || 'movies';

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
            tmdb_id: movie.id,
            imdb_id: movie.imdb_id,
            title: movie.title,
            year: movie.year,
            rating: movie.vote_average,
            overview: movie.overview,
            poster_url: movie.poster_url,
            backdrop_url: movie.backdrop_url,
            genre_ids: movie.genre_ids
          },
          downloader: 'yt-dlp'
        })
      });

      if (res.ok) {
        alert(`✓ Download queued: ${movie.title}`);
        setSelectedMovie(null);
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

  const toggleBookmark = async (movie: Movie, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent opening the download modal

    const isBookmarked = bookmarkedMovies.has(movie.id);

    try {
      if (isBookmarked) {
        // Remove from watchlist
        const res = await fetch(`${API_BASE}/bookmarks/check-tmdb/${movie.id}?mediaType=movie`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (data.bookmark) {
          await fetch(`${API_BASE}/bookmarks/${data.bookmark.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          setBookmarkedMovies(prev => {
            const next = new Set(prev);
            next.delete(movie.id);
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
            type: 'tmdb_movie',
            tmdb_id: movie.id,
            media_type: 'movie',
            title: movie.title,
            description: movie.overview,
            thumbnail: movie.poster_url,
            backdrop_url: movie.backdrop_url,
            release_year: movie.year ? parseInt(movie.year) : null,
            vote_average: movie.vote_average
          })
        });
        setBookmarkedMovies(prev => new Set(prev).add(movie.id));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      alert('Failed to update watchlist');
    }
  };

  const MovieCard = ({ movie, size = 'normal' }: { movie: Movie; size?: 'normal' | 'small' }) => {
    // Color code ratings: 9+ = gold, 8-9 = green, 7-8 = blue, <7 = gray
    const getRatingColor = (rating: number) => {
      if (rating >= 9) return 'bg-yellow-500';
      if (rating >= 8) return 'bg-green-500';
      if (rating >= 7) return 'bg-blue-500';
      return 'bg-gray-500';
    };

    const rating = movie.imdb_rating ? parseFloat(movie.imdb_rating) : movie.vote_average;
    const isBookmarked = bookmarkedMovies.has(movie.id);
    const isDownloaded = downloadedMovies.has(movie.id);

    return (
      <div
        className={`group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-2xl flex-shrink-0 ${
          size === 'small' ? 'w-40' : 'w-48'
        }`}
        onClick={() => setSelectedMovie(movie)}
      >
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className={`w-full object-cover ${size === 'small' ? 'h-60' : 'h-72'}`}
          />
        ) : (
          <div className={`w-full bg-gray-700 flex items-center justify-center ${size === 'small' ? 'h-60' : 'h-72'}`}>
            <Film className="w-16 h-16 text-gray-500" />
          </div>
        )}

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

        {/* Bookmark button */}
        <button
          onClick={(e) => toggleBookmark(movie, e)}
          className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all z-20 ${
            isBookmarked
              ? 'bg-yellow-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          <Star className={`w-4 h-4 ${isBookmarked ? 'fill-white' : ''}`} />
        </button>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-0">
          <div className="absolute bottom-0 p-3 w-full">
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-2">{movie.title}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              {movie.year && <span>{movie.year}</span>}
              <span className="text-gray-400">• {movie.vote_count.toLocaleString()} votes</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MovieRow = ({ title, movies, loading, onSeeAll }: {
    title: string;
    movies: Movie[];
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
              {movies.map(movie => (
                <MovieCard key={movie.id} movie={movie} />
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
                {viewMode === 'genre' && selectedGenre ? `${selectedGenre.emoji} ${selectedGenre.name} Movies` :
                 viewMode === 'all-movies' && activePreset === 'imdb-top-250' ? '🎬 IMDB Top 250' :
                 viewMode === 'all-movies' ? '🎬 All Movies' :
                 viewMode === 'top-rated' ? '⭐ Top Rated Movies' :
                 'Movies'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
            </div>
          </div>
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
              {searchResults.map(movie => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No movies found</p>
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
              Showing {genreMovies.length} movies • Page {genreCurrentPage} of {genreTotalPages}
            </div>
          </div>

          {/* Movies Grid */}
          {genreLoading && genreCurrentPage === 1 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {genreMovies.map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {genreLoading && genreCurrentPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more movies...</p>
                </div>
              )}

              {!genreLoading && genreCurrentPage >= genreTotalPages && genreMovies.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more movies to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All Movies View */}
      {viewMode === 'all-movies' && (
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
          {/* Stats */}
          <div className="flex items-center justify-end">
            <div className="text-sm text-gray-400">
              {allMovies.length} movies loaded • Page {allMoviesPage}/{allMoviesTotalPages}
            </div>
          </div>

          {/* Advanced Filters - Always Visible */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">Advanced Discovery</h3>
            <AdvancedFilters
              onCollectionSelect={handleCollectionSelect}
              onCompanySelect={handleCompanySelect}
              onDirectorSelect={handleDirectorSelect}
              onActorSelect={handleActorSelect}
              onMovieSearch={handleMovieSearch}
              selectedCollection={selectedCollection}
              selectedCompany={selectedCompany}
              selectedDirector={selectedDirector}
              selectedActor={selectedActor}
              movieSearchQuery={searchQuery}
            />
          </div>

          {/* Additional Filters Panel - Collapsible */}
          {showAllMoviesFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              {/* Hide Filters Button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-200">Additional Filters</h3>
                <button
                  onClick={() => setShowAllMoviesFilters(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300"
                >
                  <X className="w-4 h-4" />
                  Hide
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Quick Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Quick Filters</label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (activePreset === 'worth-watching') {
                          // Deselect - reset to no filters
                          setAllMoviesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllMoviesFilters({
                            minRating: 5.5,
                            minVotes: 25,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: []
                          });
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
                          // Deselect - reset to no filters
                          setAllMoviesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllMoviesFilters({
                            minRating: 6.5,
                            minVotes: 50,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: []
                          });
                          setActivePreset('quality');
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'quality'
                          ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-purple-600'
                      }`}
                    >
                      ⭐ Quality Movies (6.5+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'elite') {
                          // Deselect - reset to no filters
                          setAllMoviesFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset(null);
                        } else {
                          // Select - apply preset
                          setAllMoviesFilters({
                            minRating: 7.5,
                            minVotes: 100,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: []
                          });
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
                        setAllMoviesFilters(prev => {
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
                        allMoviesFilters.excludeGenres.includes(16) && allMoviesFilters.excludeGenres.includes(10751)
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-red-600'
                      }`}
                    >
                      🚫 No Kids/Anime
                    </button>

                    <button
                      onClick={() => {
                        setAllMoviesFilters(prev => {
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
                        allMoviesFilters.originCountries.length > 0
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-blue-600'
                      }`}
                      title="Filter to English-speaking countries: US, UK, Canada, Australia, New Zealand, Ireland"
                    >
                      🇺🇸🇬🇧 English Only
                    </button>
                  </div>
                </div>

                {/* Min Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Rating: {allMoviesFilters.minRating > 0 ? allMoviesFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={allMoviesFilters.minRating}
                    onChange={(e) => setAllMoviesFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allMoviesFilters.minVotes > 0 ? allMoviesFilters.minVotes : 'Any'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={allMoviesFilters.minVotes}
                    onChange={(e) => setAllMoviesFilters(prev => ({ ...prev, minVotes: parseInt(e.target.value) }))}
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
                      value={allMoviesFilters.yearFrom || ''}
                      onChange={(e) => setAllMoviesFilters(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="From"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={allMoviesFilters.yearTo || ''}
                      onChange={(e) => setAllMoviesFilters(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="To"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Genre Multi-Select Dropdown */}
                <div className="col-span-full">
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg transition-colors">
                        <span className="text-sm font-medium text-gray-300">
                          Genres (click to toggle • <span className="text-green-400">included</span> / <span className="text-red-400">excluded</span>)
                        </span>
                        <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="mt-3 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {genres.map(genre => {
                          const isExcluded = allMoviesFilters.excludeGenres.includes(genre.id);
                          return (
                            <button
                              key={genre.id}
                              onClick={() => {
                                setAllMoviesFilters(prev => ({
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
                  </details>
                </div>

                {/* Reset Button */}
                <div className="col-span-full">
                  <button
                    onClick={() => {
                      setAllMoviesFilters({
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
                    className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results header */}
          <div className="bg-gray-800/50 p-4 rounded-lg border-l-4 border-blue-500">
            <div className="space-y-2">
              <div className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400">Loaded:</span>{' '}
                <span className="font-bold text-white">{allMovies.length.toLocaleString()}</span> of{' '}
                <span className="font-bold text-blue-400">{allMoviesTotalResults.toLocaleString()}</span>{' '}
                <span className="text-gray-400">movies</span>

                {/* Show active filter */}
                {selectedCollection && (
                  <span className="text-purple-400">- {selectedCollection.name}</span>
                )}
                {selectedCompany && (
                  <span className="text-blue-400">- {selectedCompany.name} (Studio)</span>
                )}
                {selectedDirector && (
                  <span className="text-green-400">- {selectedDirector.name} (Director)</span>
                )}
                {selectedActor && (
                  <span className="text-yellow-400">- {selectedActor.name} (Actor)</span>
                )}
                {searchQuery && (
                  <span className="text-gray-400">- Search: "{searchQuery}"</span>
                )}

                {loadingMultiplePages && (
                  <Loader className="w-4 h-4 animate-spin text-blue-400" />
                )}
              </div>

              {/* Always show total catalog for reference */}
              <div className="text-xs text-gray-500">
                <span className="text-gray-500">Total catalog:</span>{' '}
                <span className="font-semibold text-gray-400">814,562+ movies</span>
              </div>
            </div>
          </div>

          {allMoviesLoading && allMoviesPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allMovies.map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allMoviesLoading || loadingMultiplePages) && allMoviesPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more movies...</p>
                </div>
              )}

              {!allMoviesLoading && allMoviesPage >= allMoviesTotalPages && allMovies.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more movies to load</p>
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
            <h2 className="text-2xl font-bold">⭐ Top Rated Movies (7.5+)</h2>
            <div className="text-sm text-gray-400">
              {allMovies.length} movies loaded • Page {allMoviesPage}/{allMoviesTotalPages}
            </div>
          </div>

          {allMoviesLoading && allMoviesPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allMovies.map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {/* Loading indicator for infinite scroll */}
              {(allMoviesLoading || loadingMultiplePages) && allMoviesPage > 1 && (
                <div className="text-center mt-8 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-3 text-sm">Loading more movies...</p>
                </div>
              )}

              {!allMoviesLoading && allMoviesPage >= allMoviesTotalPages && allMovies.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <p className="text-gray-500 text-sm">No more movies to load</p>
                </div>
              )}
            </>
          )}
        </div>
      )}


      {/* Movie Modal */}
      {selectedMovie && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedMovie(null);
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
            {selectedMovie.backdrop_url && (
              <img
                src={selectedMovie.backdrop_url}
                alt={selectedMovie.title}
                className="w-full h-64 object-cover rounded-t-lg"
              />
            )}

            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedMovie.title}</h2>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                {selectedMovie.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedMovie.year}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{selectedMovie.vote_average.toFixed(1)}/10</span>
                </div>
                {selectedMovie.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${selectedMovie.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  >
                    IMDb
                  </a>
                )}
              </div>

              <p className="text-gray-300 mb-6">{selectedMovie.overview}</p>

              <div className="space-y-4">
                {/* Auto-Search Torrents Button */}
                <button
                  onClick={() => searchTorrents(selectedMovie)}
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
                      onClick={() => search1337x(selectedMovie)}
                      className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      1337x
                    </button>
                    <button
                      onClick={() => searchExtTo(selectedMovie)}
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
                    onClick={() => handleDownload(selectedMovie)}
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
                            onClick={() => handleDownload(selectedMovie)}
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
                          onClick={() => submitDownload(selectedMovie)}
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
