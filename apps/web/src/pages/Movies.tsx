import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader, Plus } from 'lucide-react';
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
  const requestIdRef = useRef(0); // Track request IDs to prevent race conditions
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

  // Prowlarr state (for torrent search)
  const [prowlarrEnabled, setProwlarrEnabled] = useState(false);
  const [showTorrentBrowser, setShowTorrentBrowser] = useState(false);
  const [availableReleases, setAvailableReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string>('1080p');
  const [downloadingTorrent, setDownloadingTorrent] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

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
    originCountries: [] as string[],
    excludeCountries: [] as string[]
  });
  const [showAllMoviesFilters, setShowAllMoviesFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('all-movies');

  // Advanced filters (collection, company, director, actor)
  const [selectedCollection, setSelectedCollection] = useState<{ id: number; name: string } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null);
  const [selectedDirector, setSelectedDirector] = useState<{ id: number; name: string } | null>(null);
  const [selectedActor, setSelectedActor] = useState<{ id: number; name: string } | null>(null);
  const [advancedFilterMovies, setAdvancedFilterMovies] = useState<Movie[]>([]);

  // Cache for filter results - so we can quickly switch between filters
  const [filterCache, setFilterCache] = useState<Record<string, { movies: Movie[]; totalResults: number }>>({});
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
  const isRestoring = React.useRef(true); // Track if we're restoring state from localStorage
  const restoringScroll = React.useRef(false);
  const scrollPositionSaved = React.useRef(false);

  // Load movies on mount
  useEffect(() => {
    console.log('[Movies Mount] Starting mount useEffect');
    fetchGenres();
    setShowAllMoviesFilters(true);

    // Try to restore browse state from sessionStorage
    const savedBrowseState = localStorage.getItem('moviesBrowseState');
    console.log('[Movies Mount] savedBrowseState exists:', !!savedBrowseState);
    if (savedBrowseState) {
      try {
        const { movies, page, totalPages, totalResults, viewMode: savedViewMode, scrollY } = JSON.parse(savedBrowseState);
        console.log('[Movies Mount] Restoring browse state:', { movieCount: movies?.length, page, viewMode: savedViewMode });
        restoringScroll.current = true;
        setAllMovies(movies || []);
        setAllMoviesPage(page || 1);
        setAllMoviesTotalPages(totalPages || 1);
        setAllMoviesTotalResults(totalResults || 0);
        setViewMode(savedViewMode || 'all-movies');
        // Ensure no loading states are active when restoring from cache
        setAllMoviesLoading(false);
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
    const savedFilters = localStorage.getItem('moviesFilters');
    console.log('[Movies Mount] savedFilters exists:', !!savedFilters);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        console.log('[Movies Mount] Restoring filters:', parsed);
        setAllMoviesFilters(parsed);
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    // Restore active preset
    const savedPreset = localStorage.getItem('moviesActivePreset');
    console.log('[Movies Mount] savedPreset:', savedPreset);
    if (savedPreset) {
      setActivePreset(savedPreset);
    }

    // Restore advanced filters
    const savedAdvanced = localStorage.getItem('moviesAdvancedFilters');
    if (savedAdvanced) {
      try {
        const { collection, company, director, actor } = JSON.parse(savedAdvanced);
        if (collection) setSelectedCollection(collection);
        if (company) setSelectedCompany(company);
        if (director) setSelectedDirector(director);
        if (actor) setSelectedActor(actor);
      } catch (e) {
        console.error('Failed to load advanced filters:', e);
      }
    }

    // Restore filter panel state
    const savedShowFilters = localStorage.getItem('moviesShowFilters');
    if (savedShowFilters !== null) {
      try {
        setShowAllMoviesFilters(JSON.parse(savedShowFilters));
      } catch (e) {
        console.error('Failed to load show filters state:', e);
      }
    }

    // Restore selected genre
    const savedGenre = localStorage.getItem('moviesSelectedGenre');
    if (savedGenre) {
      try {
        setSelectedGenre(JSON.parse(savedGenre));
      } catch (e) {
        console.error('Failed to load selected genre:', e);
      }
    }

    // Only load movies if we didn't restore state
    // This ensures search and filters work properly
    if (!savedBrowseState) {
      // Small delay to let the page render first, then load initial batch
      setTimeout(() => {
        loadMovies();
      }, 100);
    }

    // Mark restoration complete - do this AFTER all state restoration is done
    // This prevents the filter watch useEffect from triggering during restoration
    setTimeout(() => {
      console.log('[Movies Mount] Restoration complete');
      isRestoring.current = false;
      isInitialMount.current = false;
    }, 100); // Small delay to ensure all React state updates have processed
  }, []);

  // Check if Prowlarr is enabled
  useEffect(() => {
    const checkProwlarrStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/preferences`, {
          credentials: 'include'
        });
        if (res.ok) {
          const prefs = await res.json();
          setProwlarrEnabled(prefs.prowlarr_enabled || false);
        }
      } catch (error) {
        console.error('Failed to check Prowlarr status:', error);
      }
    };
    checkProwlarrStatus();
  }, []);

  // Save filters to localStorage when they change (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    console.log('[Movies Save] Saving filters to localStorage');
    localStorage.setItem('moviesFilters', JSON.stringify(allMoviesFilters));
  }, [allMoviesFilters]);

  // Save active preset to localStorage (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    if (activePreset) {
      console.log('[Movies Save] Saving preset to localStorage:', activePreset);
      localStorage.setItem('moviesActivePreset', activePreset);
    }
  }, [activePreset]);

  // Save advanced filters to localStorage (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    const advancedFilters = {
      collection: selectedCollection,
      company: selectedCompany,
      director: selectedDirector,
      actor: selectedActor
    };
    localStorage.setItem('moviesAdvancedFilters', JSON.stringify(advancedFilters));
  }, [selectedCollection, selectedCompany, selectedDirector, selectedActor]);

  // Save filter panel state (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    localStorage.setItem('moviesShowFilters', JSON.stringify(showAllMoviesFilters));
  }, [showAllMoviesFilters]);

  // Save selected genre (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    if (selectedGenre) {
      localStorage.setItem('moviesSelectedGenre', JSON.stringify(selectedGenre));
    }
  }, [selectedGenre]);

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
    console.log('[Filter Watch] Triggered. isRestoring:', isRestoring.current, 'isInitialMount:', isInitialMount.current);
    // Skip if we're restoring state from localStorage
    if (isRestoring.current || isInitialMount.current) {
      console.log('[Filter Watch] Skipping - restoring state');
      return;
    }

    // Skip loading if advanced filter OR search is active
    const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor || searchQuery.trim() !== '';
    if (hasAdvancedFilter) {
      console.log('[Filter Watch] Skipping - advanced filter active');
      return;
    }

    if (viewMode === 'all-movies' || viewMode === 'top-rated') {
      console.log('[Filter Watch] Will call loadManyPages in 300ms');
      const timeoutId = setTimeout(() => {
        console.log('[Filter Watch] Calling loadManyPages NOW');
        loadManyPages(1, 3, viewMode, false); // Load 3 pages initially (~50 movies)
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [allMoviesFilters.minRating, allMoviesFilters.minVotes, allMoviesFilters.sortBy, allMoviesFilters.yearFrom, allMoviesFilters.yearTo, allMoviesFilters.selectedGenres, allMoviesFilters.excludeGenres, allMoviesFilters.originCountries, allMoviesFilters.excludeCountries, selectedCollection, selectedCompany, selectedDirector, selectedActor, searchQuery]);

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

    localStorage.setItem('moviesBrowseState', JSON.stringify(browseState));
  }, [allMovies, allMoviesPage, allMoviesTotalPages, allMoviesTotalResults, viewMode]);

  // Save scroll position on scroll events
  useEffect(() => {
    const saveScrollPosition = () => {
      if (restoringScroll.current) return;

      const savedState = localStorage.getItem('moviesBrowseState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          state.scrollY = window.scrollY;
          localStorage.setItem('moviesBrowseState', JSON.stringify(state));
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

      if (allMoviesFilters.excludeCountries && allMoviesFilters.excludeCountries.length > 0) {
        url += `&exclude_countries=${allMoviesFilters.excludeCountries.join(',')}`;
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

      if (allMoviesFilters.excludeCountries && allMoviesFilters.excludeCountries.length > 0) {
        baseUrl += `&exclude_countries=${allMoviesFilters.excludeCountries.join(',')}`;
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

  // Helper function to clear ALL advanced filters and reload general catalog
  const clearAllAdvancedFilters = () => {
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');
    setAllMovies([]);
    setAdvancedFilterLoading(false);
    setActivePreset('all-movies'); // Reset to All Movies preset
    // Reload general catalog
    loadManyPages(1, 3, viewMode, false);
  };

  // Advanced Filter Handlers
  const handleCollectionSelect = async (collectionId: number | null, name: string) => {
    if (!collectionId) {
      setSelectedCollection(null);
      setAllMovies([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types (not this one)
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');

    // Set this filter and show loading
    setSelectedCollection({ id: collectionId, name });

    // Check cache first
    const cacheKey = `collection:${collectionId}`;
    if (filterCache[cacheKey]) {
      setAllMovies(filterCache[cacheKey].movies);
      setAllMoviesTotalPages(1); // Collection is just one "page"
      setAllMoviesPage(1);
      setAllMoviesTotalResults(filterCache[cacheKey].totalResults);
      // Ensure infinite scroll is disabled
      return;
    }

    setAllMovies([]); // Clear movies for instant feedback
    setAllMoviesPage(1); // Reset page immediately to prevent race conditions
    setAllMoviesTotalPages(1); // Set to 1 immediately to prevent infinite scroll
    setAdvancedFilterLoading(true);

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(`${API_BASE}/tmdb/collection/${collectionId}`, { credentials: 'include' });

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();

        // Transform TMDB format to Movie format (poster_path -> poster_url, etc.)
        const transformedMovies = (data.parts || []).map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date ? movie.release_date.split('-')[0] : null
        }));

        // Cache the results
        setFilterCache(prev => ({
          ...prev,
          [cacheKey]: { movies: transformedMovies, totalResults: transformedMovies.length }
        }));

        setAllMovies(transformedMovies);
        setAllMoviesTotalPages(1); // Collection is just one "page"
        setAllMoviesPage(1);
        setAllMoviesTotalResults(transformedMovies.length);
      }
    } catch (error) {
      console.error('Failed to load collection:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllMovies([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleCompanySelect = async (companyId: number | null, name: string) => {
    if (!companyId) {
      setSelectedCompany(null);
      setAllMovies([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedDirector(null);
    setSelectedActor(null);
    setSearchQuery('');

    setSelectedCompany({ id: companyId, name });

    // Check cache first
    const cacheKey = `company:${companyId}`;
    if (filterCache[cacheKey]) {
      setAllMovies(filterCache[cacheKey].movies);
      const totalPages = Math.ceil(filterCache[cacheKey].movies.length / 20);
      setAllMoviesTotalPages(totalPages);
      setAllMoviesPage(totalPages);
      setAllMoviesTotalResults(filterCache[cacheKey].totalResults);
      // Ensure infinite scroll is disabled (hasAdvancedFilter check handles this)
      return;
    }

    setAllMovies([]);
    setAllMoviesPage(1); // Reset page immediately to prevent race conditions
    setAdvancedFilterLoading(true);

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      // Fetch first page to get total_pages
      const firstPageRes = await fetch(`${API_BASE}/tmdb/discover/company/${companyId}?page=1`, { credentials: 'include' });

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!firstPageRes.ok) {
        throw new Error('Failed to fetch first page');
      }

      const firstPage = await firstPageRes.json();
      const totalPages = firstPage.total_pages || 1;
      const totalResults = firstPage.total_results || 0;

      // Load all remaining pages
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(page =>
          fetch(`${API_BASE}/tmdb/discover/company/${companyId}?page=${page}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
        )
      );

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Combine all results
      const allResults = [
        ...(firstPage.results || []),
        ...remainingPages.flatMap(data => data?.results || [])
      ];

      // Deduplicate by movie ID
      const uniqueResults = Array.from(
        new Map(allResults.map((movie: any) => [movie.id, movie])).values()
      );

      const transformedMovies = uniqueResults.map((movie: any) => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        year: movie.release_date ? movie.release_date.split('-')[0] : null
      }));

      // Cache the results
      setFilterCache(prev => ({
        ...prev,
        [cacheKey]: { movies: transformedMovies, totalResults }
      }));

      setAllMovies(transformedMovies);
      setAllMoviesTotalPages(totalPages);
      setAllMoviesPage(totalPages);
      setAllMoviesTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load company movies:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllMovies([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleDirectorSelect = async (personId: number | null, name: string) => {
    if (!personId) {
      setSelectedDirector(null);
      setAllMovies([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedActor(null);
    setSearchQuery('');

    setSelectedDirector({ id: personId, name });

    // Check cache first
    const cacheKey = `director:${personId}`;
    if (filterCache[cacheKey]) {
      setAllMovies(filterCache[cacheKey].movies);
      setAllMoviesTotalPages(1);
      setAllMoviesPage(1);
      setAllMoviesTotalResults(filterCache[cacheKey].totalResults);
      // Ensure infinite scroll is disabled (hasAdvancedFilter check handles this)
      return;
    }

    setAllMovies([]);
    setAllMoviesPage(1); // Reset page immediately to prevent race conditions
    setAllMoviesTotalPages(1); // Set to 1 immediately to prevent infinite scroll
    setAdvancedFilterLoading(true);

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(`${API_BASE}/tmdb/discover/person/${personId}?role=crew`, { credentials: 'include' });

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();

        // Directors usually have fewer movies, load all in one go
        const transformedMovies = (data.results || []).map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date ? movie.release_date.split('-')[0] : null
        }));

        // Cache the results
        setFilterCache(prev => ({
          ...prev,
          [cacheKey]: { movies: transformedMovies, totalResults: transformedMovies.length }
        }));

        setAllMovies(transformedMovies);
        setAllMoviesTotalPages(1);
        setAllMoviesPage(1);
        setAllMoviesTotalResults(transformedMovies.length);
      }
    } catch (error) {
      console.error('Failed to load director movies:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllMovies([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleActorSelect = async (personId: number | null, name: string) => {
    if (!personId) {
      setSelectedActor(null);
      setAllMovies([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedDirector(null);
    setSearchQuery('');

    setSelectedActor({ id: personId, name });

    // Check cache first
    const cacheKey = `actor:${personId}`;
    if (filterCache[cacheKey]) {
      setAllMovies(filterCache[cacheKey].movies);
      setAllMoviesTotalPages(Math.ceil(filterCache[cacheKey].movies.length / 20));
      setAllMoviesPage(5);
      setAllMoviesTotalResults(filterCache[cacheKey].totalResults);
      // Ensure infinite scroll is disabled (hasAdvancedFilter check handles this)
      return;
    }

    setAllMovies([]);
    setAllMoviesPage(1); // Reset page immediately to prevent race conditions
    setAdvancedFilterLoading(true);

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      // Load first 5 pages (100 movies) for actors who typically have many films
      const pages = await Promise.all([1, 2, 3, 4, 5].map(page =>
        fetch(`${API_BASE}/tmdb/discover/person/${personId}?role=cast&page=${page}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
      ));

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const allResults = pages.flatMap(data => data?.results || []);
      const totalResults = pages[0]?.total_results || 0;
      const totalPages = pages[0]?.total_pages || 1;

      // Deduplicate by movie ID
      const uniqueResults = Array.from(
        new Map(allResults.map((movie: any) => [movie.id, movie])).values()
      );

      const transformedMovies = uniqueResults.map((movie: any) => ({
        ...movie,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        year: movie.release_date ? movie.release_date.split('-')[0] : null
      }));

      // Cache the results
      setFilterCache(prev => ({
        ...prev,
        [cacheKey]: { movies: transformedMovies, totalResults }
      }));

      setAllMovies(transformedMovies);
      setAllMoviesTotalPages(totalPages);
      setAllMoviesPage(5);
      setAllMoviesTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load actor movies:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllMovies([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleMovieSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      setAllMovies([]); // Just clear, don't reload
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

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/movies?q=${encodeURIComponent(query)}&page=1`,
        { credentials: 'include' }
      );

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        // Transform results to ensure poster_url and backdrop_url are set
        // (API only transforms first 20, so we need to handle all results)
        const transformedResults = results.map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null),
          backdrop_url: movie.backdrop_url || (movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null),
          year: movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : null)
        }));

        setAllMovies(transformedResults);
        setAllMoviesTotalPages(data.total_pages || 1);
        setAllMoviesPage(1);
        setAllMoviesTotalResults(data.total_results || transformedResults.length);
      }
    } catch (err) {
      console.error('Search failed:', err);
      // Only clear movies if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setAllMovies([]);
      }
    } finally {
      // Only stop loading if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  // Load more search results (pagination for search)
  const loadMoreSearchResults = async () => {
    if (!searchQuery.trim() || allMoviesPage >= allMoviesTotalPages || allMoviesLoading || loadingMultiplePages) {
      return;
    }

    setAllMoviesLoading(true);
    try {
      const nextPage = allMoviesPage + 1;
      const res = await fetch(
        `${API_BASE}/tmdb/search/movies?q=${encodeURIComponent(searchQuery)}&page=${nextPage}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        // Transform results to ensure poster_url and backdrop_url are set
        // (API only transforms first 20, so we need to handle all results)
        const transformedResults = results.map((movie: any) => ({
          ...movie,
          poster_url: movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null),
          backdrop_url: movie.backdrop_url || (movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null),
          year: movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : null)
        }));

        // Append new results to existing ones
        setAllMovies(prev => {
          const combined = [...prev, ...transformedResults];
          // Deduplicate by movie ID
          return Array.from(new Map(combined.map(movie => [movie.id, movie])).values());
        });
        setAllMoviesPage(nextPage);
        setAllMoviesTotalPages(data.total_pages || 1);
        setAllMoviesTotalResults(data.total_results || 0);
      }
    } catch (err) {
      console.error('Failed to load more search results:', err);
    } finally {
      setAllMoviesLoading(false);
    }
  };

  // Infinite scroll - consolidated into single hook to avoid conflicts
  const hasMoreGenre = viewMode === 'genre' && genreCurrentPage < genreTotalPages;
  
  // Check if advanced filters are active (Collection/Director/Actor/Company - these disable infinite scroll)
  const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;
  
  // Search has its own pagination - enable infinite scroll for search when there are more pages
  const hasMoreSearch = searchQuery.trim() !== '' && allMoviesPage < allMoviesTotalPages;
  
  // Only enable infinite scroll for all-movies/top-rated when NOT searching or filtering
  // (Search has its own hasMoreSearch check above)
  const hasMoreAllMovies = !hasAdvancedFilter && 
    searchQuery.trim() === '' && // No search active
    (viewMode === 'all-movies' || viewMode === 'top-rated') && 
    allMoviesPage < allMoviesTotalPages;
  
  const hasMore = hasMoreGenre || hasMoreAllMovies || hasMoreSearch;
  const isLoadingAny = genreLoading || allMoviesLoading || loadingMultiplePages || advancedFilterLoading;

  const handleLoadMore = () => {
    // Safety check: never load more if advanced filters are active
    if (hasAdvancedFilter) {
      return;
    }

    if (viewMode === 'genre' && hasMoreGenre && !genreLoading) {
      loadMoreGenreMovies();
    } else if (hasMoreSearch && !allMoviesLoading && !loadingMultiplePages && !advancedFilterLoading) {
      // Load more search results
      loadMoreSearchResults();
    } else if ((viewMode === 'all-movies' || viewMode === 'top-rated') && hasMoreAllMovies && !allMoviesLoading && !loadingMultiplePages) {
      // Load more general catalog movies
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


  // Handle movie click - reset torrent state and open modal
  const handleMovieClick = (movie: Movie) => {
    // Reset all torrent-related state when opening a new movie modal
    setAvailableReleases([]);
    setSelectedRelease(null);
    setQualityFilter('1080p');
    setTorrentResults([]);
    setTorrentSearchError(null);
    setVpnConnected(false);
    setSelectedMovie(movie);
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

  const browseTorrents = async () => {
    if (!selectedMovie) return;

    setLoadingReleases(true);
    setAvailableReleases([]);
    setQualityFilter('1080p'); // Reset filter when browsing new torrents

    try {
      // Search Prowlarr directly with movie title and year
      const searchQuery = `${selectedMovie.title} ${selectedMovie.year}`;
      const releasesResponse = await fetch(`${API_BASE}/prowlarr/search?query=${encodeURIComponent(searchQuery)}&type=movie`, {
        credentials: 'include'
      });

      if (!releasesResponse.ok) {
        throw new Error('Failed to search torrents');
      }

      const releases = await releasesResponse.json();

      // Filter out irrelevant results
      const movieTitle = selectedMovie.title.toLowerCase();
      const allKeywords = movieTitle.split(/[\s:]+/).filter(word => word.length > 2);

      const filteredReleases = releases.filter((r: any) => {
        const titleLower = r.title.toLowerCase();

        // Filter out adult content keywords
        const adultKeywords = ['xxx', 'onlyfans', 'nfbusty', 'girlsoutwest', 'girlsrimming', 'playboy'];
        if (adultKeywords.some(keyword => titleLower.includes(keyword))) {
          return false;
        }

        // For movies with more than 2 keywords, require at least 50% match AND
        // at least one keyword beyond the first two (to avoid person-name-only matches)
        const matchedKeywords = allKeywords.filter(keyword => titleLower.includes(keyword));
        const matchPercentage = matchedKeywords.length / allKeywords.length;

        if (allKeywords.length > 2) {
          // Require at least 50% overall match
          if (matchPercentage < 0.5) return false;

          // Also require at least one keyword from beyond the first two words
          // (to filter out results that only match person names or common words)
          const uniqueKeywords = allKeywords.slice(2);
          const hasUniqueMatch = uniqueKeywords.some(keyword => titleLower.includes(keyword));
          return hasUniqueMatch;
        }

        // For short titles (1-2 words), require higher match percentage
        return matchPercentage >= 0.6;
      });

      // Map Prowlarr results to expected format
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

      // Show message if no results found after filtering
      if (formattedReleases.length === 0) {
        const totalResults = releases.length;
        if (totalResults > 0) {
          setDownloadMessage(`⚠️ Found ${totalResults} results but all were irrelevant. This movie may not be available on your indexers. Try adding more indexers in Prowlarr.`);
        } else {
          setDownloadMessage(`⚠️ No torrents found. This movie may not be available on your indexers. Try adding more indexers in Prowlarr.`);
        }
      }
    } catch (error: any) {
      console.error('Failed to browse torrents:', error);
      setDownloadMessage(`❌ ${error.message}`);
      setAvailableReleases([]);
    } finally {
      setLoadingReleases(false);
    }
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
    e?.preventDefault(); // Prevent default browser behavior

    // Save current scroll position to prevent page jumping
    const scrollY = window.scrollY;

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

      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
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
        onClick={() => handleMovieClick(movie)}
      >
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className={`w-full object-cover ${size === 'small' ? 'h-60' : 'h-72'}`}
            loading="lazy"
            decoding="async"
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
            <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
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
              {movies.filter(movie => movie.poster_url).map(movie => (
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
          ) : searchResults.filter(movie => movie.poster_url).length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {searchResults.filter(movie => movie.poster_url).map(movie => (
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
                {genreMovies.filter(movie => movie.poster_url).map(movie => (
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
          {/* Advanced Filters - Always Visible */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">Advanced Discovery</h3>
            <AdvancedFilters
              onCollectionSelect={handleCollectionSelect}
              onCompanySelect={handleCompanySelect}
              onDirectorSelect={handleDirectorSelect}
              onActorSelect={handleActorSelect}
              onMovieSearch={handleMovieSearch}
              onClearAll={clearAllAdvancedFilters}
              selectedCollection={selectedCollection}
              selectedCompany={selectedCompany}
              selectedDirector={selectedDirector}
              selectedActor={selectedActor}
              movieSearchQuery={searchQuery}
            />
          </div>

          {/* Show/Hide Additional Filters Toggle */}
          {!showAllMoviesFilters && (
            <div className="flex items-center justify-start">
              <button
                onClick={() => setShowAllMoviesFilters(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300 font-medium"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Show Additional Filters
              </button>
            </div>
          )}

          {/* Additional Filters Panel - Collapsible */}
          {showAllMoviesFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              {/* Hide Filters Button & Reset Button */}
              <div className="flex items-center justify-start gap-3 mb-4">
                <button
                  onClick={() => setShowAllMoviesFilters(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300 font-medium"
                >
                  <X className="w-4 h-4" />
                  Hide Additional Filters
                </button>
                <button
                  onClick={() => {
                    setAllMoviesFilters({
                      minRating: 0,
                      minVotes: 0,
                      yearFrom: null,
                      yearTo: null,
                      sortBy: 'popularity.desc',
                      selectedGenres: [],
                      excludeGenres: [],
                      originCountries: [],
                      excludeCountries: []
                    });
                    setActivePreset('all-movies'); // Auto-select All Movies
                  }}
                  disabled={
                    allMoviesFilters.minRating === 0 &&
                    allMoviesFilters.minVotes === 0 &&
                    !allMoviesFilters.yearFrom &&
                    !allMoviesFilters.yearTo &&
                    allMoviesFilters.selectedGenres.length === 0 &&
                    allMoviesFilters.excludeGenres.length === 0 &&
                    allMoviesFilters.originCountries.length === 0 &&
                    allMoviesFilters.excludeCountries.length === 0
                  }
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                    allMoviesFilters.minRating === 0 &&
                    allMoviesFilters.minVotes === 0 &&
                    !allMoviesFilters.yearFrom &&
                    !allMoviesFilters.yearTo &&
                    allMoviesFilters.selectedGenres.length === 0 &&
                    allMoviesFilters.excludeGenres.length === 0 &&
                    allMoviesFilters.originCountries.length === 0 &&
                    allMoviesFilters.excludeCountries.length === 0
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  Reset All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Quick Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Quick Filters</label>
                  <div className="flex flex-wrap gap-3">
                    {/* All Movies - No filters */}
                    <button
                      onClick={() => {
                        // Check if advanced filter is active
                        const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;

                        if (activePreset === 'all-movies') {
                          // Deselect - already at defaults, do nothing
                          setActivePreset(null);
                        } else {
                          // Select - reset to no rating/vote filters (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset('all-movies');

                          // If advanced filter is active, restore from cache
                          if (hasAdvancedFilter) {
                            const cacheKey = selectedCollection ? `collection:${selectedCollection.id}` :
                                           selectedCompany ? `company:${selectedCompany.id}` :
                                           selectedDirector ? `director:${selectedDirector.id}` :
                                           selectedActor ? `actor:${selectedActor.id}` : null;

                            if (cacheKey && filterCache[cacheKey]) {
                              setAllMovies(filterCache[cacheKey].movies);
                            }
                          }
                        }
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'all-movies'
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white ring-2 ring-blue-400 shadow-lg shadow-blue-500/50 scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      🎬 All Movies
                    </button>

                    <button
                      onClick={() => {
                        // Check if advanced filter is active
                        const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;

                        if (activePreset === 'worth-watching') {
                          // Deselect - reset ONLY rating/votes/sort (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);

                          // If advanced filter is active, restore from cache
                          if (hasAdvancedFilter) {
                            const cacheKey = selectedCollection ? `collection:${selectedCollection.id}` :
                                           selectedCompany ? `company:${selectedCompany.id}` :
                                           selectedDirector ? `director:${selectedDirector.id}` :
                                           selectedActor ? `actor:${selectedActor.id}` : null;

                            if (cacheKey && filterCache[cacheKey]) {
                              setAllMovies(filterCache[cacheKey].movies);
                            }
                          }
                        } else {
                          // Select - apply preset (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 5.5,
                            minVotes: 250,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('worth-watching');

                          // If advanced filter is active, apply filter client-side
                          if (hasAdvancedFilter) {
                            const filtered = allMovies.filter(movie =>
                              movie.vote_average >= 5.5 && movie.vote_count >= 250
                            );
                            setAllMovies(filtered);
                          }
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
                        // Check if advanced filter is active
                        const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;

                        if (activePreset === 'quality') {
                          // Deselect - reset ONLY rating/votes/sort (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);

                          // If advanced filter is active, restore from cache
                          if (hasAdvancedFilter) {
                            const cacheKey = selectedCollection ? `collection:${selectedCollection.id}` :
                                           selectedCompany ? `company:${selectedCompany.id}` :
                                           selectedDirector ? `director:${selectedDirector.id}` :
                                           selectedActor ? `actor:${selectedActor.id}` : null;

                            if (cacheKey && filterCache[cacheKey]) {
                              setAllMovies(filterCache[cacheKey].movies);
                            }
                          }
                        } else {
                          // Select - apply preset (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 6.5,
                            minVotes: 500,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('quality');

                          // If advanced filter is active, apply filter client-side
                          if (hasAdvancedFilter) {
                            const filtered = allMovies.filter(movie =>
                              movie.vote_average >= 6.5 && movie.vote_count >= 500
                            );
                            setAllMovies(filtered);
                          }
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
                        // Check if advanced filter is active
                        const hasAdvancedFilter = selectedCollection || selectedCompany || selectedDirector || selectedActor;

                        if (activePreset === 'elite') {
                          // Deselect - reset ONLY rating/votes/sort (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 0,
                            minVotes: 0,
                            sortBy: 'popularity.desc'
                          }));
                          setActivePreset(null);

                          // If advanced filter is active, restore from cache
                          if (hasAdvancedFilter) {
                            const cacheKey = selectedCollection ? `collection:${selectedCollection.id}` :
                                           selectedCompany ? `company:${selectedCompany.id}` :
                                           selectedDirector ? `director:${selectedDirector.id}` :
                                           selectedActor ? `actor:${selectedActor.id}` : null;

                            if (cacheKey && filterCache[cacheKey]) {
                              setAllMovies(filterCache[cacheKey].movies);
                            }
                          }
                        } else {
                          // Select - apply preset (preserve additional filters)
                          setAllMoviesFilters(prev => ({
                            ...prev,
                            minRating: 7.5,
                            minVotes: 1000,
                            sortBy: 'vote_average.desc',
                            excludeGenres: [10751, 16],
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
                          }));
                          setActivePreset('elite');

                          // If advanced filter is active, apply filter client-side
                          if (hasAdvancedFilter) {
                            const filtered = allMovies.filter(movie =>
                              movie.vote_average >= 7.5 && movie.vote_count >= 1000
                            );
                            setAllMovies(filtered);
                          }
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
                  <label className="block text-sm font-medium text-gray-400 mb-3">Content Filters</label>
                  <div className="flex flex-wrap gap-3">
                    {/* No Kids */}
                    <button
                      onClick={() => {
                        setAllMoviesFilters(prev => ({
                          ...prev,
                          excludeGenres: prev.excludeGenres.includes(10751)
                            ? prev.excludeGenres.filter(id => id !== 10751)
                            : [...prev.excludeGenres, 10751]
                        }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allMoviesFilters.excludeGenres.includes(10751)
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-red-600'
                      }`}
                      title="Exclude Family movies"
                    >
                      🚫 No Kids
                    </button>

                    {/* No Anime */}
                    <button
                      onClick={() => {
                        setAllMoviesFilters(prev => ({
                          ...prev,
                          excludeGenres: prev.excludeGenres.includes(16)
                            ? prev.excludeGenres.filter(id => id !== 16)
                            : [...prev.excludeGenres, 16]
                        }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allMoviesFilters.excludeGenres.includes(16)
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-red-600'
                      }`}
                      title="Exclude Animation"
                    >
                      🚫 No Anime
                    </button>

                    {/* English Only */}
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

                {/* Genre Multi-Select Dropdown */}
                <div className="col-span-full">
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg transition-colors">
                        <span className="text-sm font-medium text-gray-300">
                          Genres {allMoviesFilters.selectedGenres.length > 0 && `(${allMoviesFilters.selectedGenres.length} selected)`}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="mt-3 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {genres.map(genre => {
                          const isSelected = allMoviesFilters.selectedGenres.includes(genre.id);
                          return (
                            <button
                              key={genre.id}
                              onClick={() => {
                                setAllMoviesFilters(prev => ({
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
                    Min Rating: {allMoviesFilters.minRating > 0 ? allMoviesFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <div className="pt-2">
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
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allMoviesFilters.minVotes > 0 ? allMoviesFilters.minVotes : 'Any'}
                  </label>
                  <div className="pt-2">
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
                {allMovies.filter(movie => movie.poster_url).map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {/* Stats at bottom */}
              <div className="flex items-center justify-center mt-6">
                <div className="text-sm text-gray-400 bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
                  {allMovies.filter(movie => movie.poster_url).length} movies loaded • Page {allMoviesPage}/{allMoviesTotalPages}
                </div>
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
          </div>

          {allMoviesLoading && allMoviesPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allMovies.filter(movie => movie.poster_url).map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {/* Stats at bottom */}
              <div className="flex items-center justify-center mt-6">
                <div className="text-sm text-gray-400 bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
                  {allMovies.filter(movie => movie.poster_url).length} movies loaded • Page {allMoviesPage}/{allMoviesTotalPages}
                </div>
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
            setAvailableReleases([]);
            setSelectedRelease(null);
            setQualityFilter('1080p');
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
                <a
                  href={selectedMovie.imdb_id
                    ? `https://www.imdb.com/title/${selectedMovie.imdb_id}`
                    : `https://www.imdb.com/find?q=${encodeURIComponent(selectedMovie.title + (selectedMovie.year ? ` ${selectedMovie.year}` : ''))}&s=tt`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  title={selectedMovie.imdb_id ? 'View on IMDb' : 'Search on IMDb'}
                >
                  IMDb
                </a>
              </div>

              <p className="text-gray-300 mb-6">{selectedMovie.overview}</p>

              <div className="space-y-4">
                {/* Download Button */}
                {prowlarrEnabled && (
                  <button
                    onClick={() => browseTorrents()}
                    disabled={loadingReleases}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors shadow-lg text-lg"
                  >
                    {loadingReleases ? (
                      <>
                        <Loader className="w-6 h-6 animate-spin" />
                        Loading Torrents...
                      </>
                    ) : (
                      <>
                        <Download className="w-6 h-6" />
                        Download
                      </>
                    )}
                  </button>
                )}

                {/* Prowlarr Torrent Results */}
                {availableReleases.length > 0 && (
                  <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">
                      Found {availableReleases.filter(r => qualityFilter === 'all' || extractQuality(r.title) === qualityFilter).length} Torrents (sorted by seeds)
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
                          const sizeInGB = release.size ? (release.size / 1073741824).toFixed(1) : 'Unknown';
                          const seeders = release.seeders || 0;
                          const leechers = release.leechers || 0;
                          const indexer = release.indexer || 'Unknown';

                          return (
                            <div
                              key={index}
                              onClick={async () => {
                                setSelectedRelease(release);
                                setDownloadingTorrent(true);
                                // Show message immediately
                                setDownloadMessage(`⏳ Downloading "${selectedMovie?.title}"`);

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
                                      category: 'Movies',
                                    })
                                  });

                                  if (response.ok) {
                                    setDownloadMessage(`✅ Downloading "${selectedMovie?.title}"`);
                                    setAvailableReleases([]);
                                    setTimeout(() => setDownloadMessage(null), 5000);
                                  } else if (response.status === 409) {
                                    setDownloadMessage(`⚠️ This torrent is already in your downloads`);
                                    setTimeout(() => setDownloadMessage(null), 5000);
                                  } else {
                                    const error = await response.json();
                                    throw new Error(error.error || 'Failed to download');
                                  }
                                } catch (error: any) {
                                  setDownloadMessage(`❌ ${error.message}`);
                                } finally {
                                  setDownloadingTorrent(false);
                                  setSelectedRelease(null);
                                }
                              }}
                              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 rounded-lg p-3 cursor-pointer transition-colors"
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
