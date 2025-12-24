import React, { useState, useEffect, useRef } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader, Plus } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';
import { API_BASE } from '@/lib/config';
import { AdvancedFiltersTV } from '../components/AdvancedFiltersTV';

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
  const [vpnConnected, setVpnConnected] = useState(false);
  const [checkingVpn, setCheckingVpn] = useState(false);
  const [bookmarkedShows, setBookmarkedShows] = useState<Set<number>>(new Set());
  const [downloadedShows, setDownloadedShows] = useState<Set<number>>(new Set());

  // Torrent search state
  const [torrentResults, setTorrentResults] = useState<any[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [torrentSearchError, setTorrentSearchError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string>('1080p');
  const [packTypeFilter, setPackTypeFilter] = useState<string>('all');
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  // Prowlarr state (for torrent search)
  const [prowlarrEnabled, setProwlarrEnabled] = useState(false);
  const [addingToSonarr, setAddingToSonarr] = useState(false);
  const [sonarrMessage, setSonarrMessage] = useState<string | null>(null);
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [qualityProfiles, setQualityProfiles] = useState<any[]>([]);
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<number | null>(null);
  const [showToAdd, setShowToAdd] = useState<TVShow | null>(null);
  const [rootFolders, setRootFolders] = useState<any[]>([]);
  const [availableReleases, setAvailableReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null);

  const isInitialMount = React.useRef(true);
  const isRestoring = React.useRef(true); // Track if we're restoring state from localStorage

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

  // IMDB Top 250 state
  const [imdbTop250Shows, setImdbTop250Shows] = useState<TVShow[]>([]);
  const [imdbTop250Loading, setImdbTop250Loading] = useState(false);

  // All Shows filters (default to NO filters - show everything, let users customize)
  const [allShowsFilters, setAllShowsFilters] = useState({
    minRating: 0,
    minVotes: 0,
    yearFrom: null as number | null,
    yearTo: null as number | null,
    sortBy: 'popularity.desc' as 'vote_average.desc' | 'popularity.desc' | 'first_air_date.desc',
    selectedGenres: [] as number[],
    excludeGenres: [] as number[],
    originCountries: [] as string[]
  });
  const [showAllShowsFilters, setShowAllShowsFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('all-shows');
  const requestIdRef = useRef(0); // Track request IDs to prevent race conditions

  // Advanced Discovery state
  const [showSearchQuery, setShowSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<{ id: number; name: string } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<{ id: number; name: string } | null>(null);
  const [selectedActor, setSelectedActor] = useState<{ id: number; name: string } | null>(null);
  const [filterCache, setFilterCache] = useState<Record<string, { shows: TVShow[]; totalResults: number }>>({});
  const [advancedFilterLoading, setAdvancedFilterLoading] = useState(false);

  // Genre filters
  const [genreFilters, setGenreFilters] = useState({
    minRating: 0,
    minVotes: 1000,
    year: null as number | null,
    sortBy: 'vote_average.desc' as 'vote_average.desc' | 'popularity.desc' | 'release_date.desc' | 'vote_count.desc'
  });
  const [showGenreFilters, setShowGenreFilters] = useState(false);

  const restoringScroll = React.useRef(false);
  const scrollPositionSaved = React.useRef(false);

  // Genre configuration with emojis - ordered by popularity (TV-specific genres)
  const GENRE_CONFIG = [
    { id: 18, name: 'Drama', emoji: '🎭' },
    { id: 35, name: 'Comedy', emoji: '😂' },
    { id: 10759, name: 'Action & Adventure', emoji: '💥' },
    { id: 80, name: 'Crime', emoji: '🔍' },
    { id: 10765, name: 'Sci-Fi & Fantasy', emoji: '🚀' },
    { id: 9648, name: 'Mystery', emoji: '🔎' },
    { id: 10764, name: 'Reality', emoji: '📺' },
    { id: 99, name: 'Documentary', emoji: '🎬' },
    { id: 16, name: 'Animation', emoji: '🎨' },
    { id: 10751, name: 'Family', emoji: '👨‍👩‍👧‍👦' },
    { id: 10762, name: 'Kids', emoji: '🧒' },
    { id: 10767, name: 'Talk', emoji: '💬' },
  ];

  useEffect(() => {
    fetchGenres();
    setShowAllShowsFilters(true); // Show filters by default

    // Try to restore browse state from sessionStorage
    const savedBrowseState = localStorage.getItem('tvShowsBrowseState');
    if (savedBrowseState) {
      try {
        const { shows, page, totalPages, totalResults, viewMode: savedViewMode, scrollY } = JSON.parse(savedBrowseState);
        restoringScroll.current = true;
        setAllShows(shows || []);
        setAllShowsPage(page || 1);
        setAllShowsTotalPages(totalPages || 1);
        setAllShowsTotalResults(totalResults || 0);
        setViewMode(savedViewMode || 'all-shows');
        // Ensure no loading states are active when restoring from cache
        setAllShowsLoading(false);
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
    const savedFilters = localStorage.getItem('tvShowsFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setAllShowsFilters(parsed);
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    // Restore active preset
    const savedPreset = localStorage.getItem('tvShowsActivePreset');
    if (savedPreset) {
      setActivePreset(savedPreset);
    }

    // Restore advanced filters
    const savedAdvanced = localStorage.getItem('tvShowsAdvancedFilters');
    if (savedAdvanced) {
      try {
        const { collection, company, creator, actor } = JSON.parse(savedAdvanced);
        if (collection) setSelectedCollection(collection);
        if (company) setSelectedCompany(company);
        if (creator) setSelectedCreator(creator);
        if (actor) setSelectedActor(actor);
      } catch (e) {
        console.error('Failed to load advanced filters:', e);
      }
    }

    // Restore filter panel state
    const savedShowFilters = localStorage.getItem('tvShowsShowFilters');
    if (savedShowFilters !== null) {
      try {
        setShowAllShowsFilters(JSON.parse(savedShowFilters));
      } catch (e) {
        console.error('Failed to load show filters state:', e);
      }
    }

    // Restore selected genre
    const savedGenre = localStorage.getItem('tvShowsSelectedGenre');
    if (savedGenre) {
      try {
        setSelectedGenre(JSON.parse(savedGenre));
      } catch (e) {
        console.error('Failed to load selected genre:', e);
      }
    }

    // Only load shows if we didn't restore state
    if (!savedBrowseState) {
      loadShows();
    }

    // Mark restoration complete - do this AFTER all state restoration is done
    // This prevents the filter watch useEffect from triggering during restoration
    setTimeout(() => {
      isRestoring.current = false;
      isInitialMount.current = false;
    }, 100); // Small delay to ensure all React state updates have processed
  }, []);

  // Check if Sonarr is enabled
  useEffect(() => {
    const checkSonarrStatus = async () => {
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
    checkSonarrStatus();
  }, []);

  // Save filters to localStorage when they change (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    localStorage.setItem('tvShowsFilters', JSON.stringify(allShowsFilters));
  }, [allShowsFilters]);

  // Save active preset to localStorage (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    if (activePreset) {
      localStorage.setItem('tvShowsActivePreset', activePreset);
    }
  }, [activePreset]);

  // Save advanced filters to localStorage (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    const advancedFilters = {
      collection: selectedCollection,
      company: selectedCompany,
      creator: selectedCreator,
      actor: selectedActor
    };
    localStorage.setItem('tvShowsAdvancedFilters', JSON.stringify(advancedFilters));
  }, [selectedCollection, selectedCompany, selectedCreator, selectedActor]);

  // Save filter panel state (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    localStorage.setItem('tvShowsShowFilters', JSON.stringify(showAllShowsFilters));
  }, [showAllShowsFilters]);

  // Save selected genre (skip during restoration)
  useEffect(() => {
    if (isRestoring.current) return;
    if (selectedGenre) {
      localStorage.setItem('tvShowsSelectedGenre', JSON.stringify(selectedGenre));
    }
  }, [selectedGenre]);

  // Load bookmarked shows
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const res = await fetch(`${API_BASE}/bookmarks?type=tmdb_tv`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const bookmarkedIds = new Set(data.bookmarks.map((b: any) => b.tmdb_id));
          setBookmarkedShows(bookmarkedIds);
        }
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
      }
    };
    fetchBookmarks();
  }, []);

  // Load downloaded shows
  useEffect(() => {
    const fetchDownloaded = async () => {
      try {
        const res = await fetch(`${API_BASE}/media/downloaded-tmdb-ids`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setDownloadedShows(new Set(data.tv || []));
        }
      } catch (err) {
        console.error('Failed to fetch downloaded shows:', err);
      }
    };
    fetchDownloaded();
  }, []);

  // Save browse state to sessionStorage when it changes
  useEffect(() => {
    if (restoringScroll.current || allShows.length === 0) return;

    const browseState = {
      shows: allShows,
      page: allShowsPage,
      totalPages: allShowsTotalPages,
      totalResults: allShowsTotalResults,
      viewMode,
      scrollY: window.scrollY
    };

    localStorage.setItem('tvShowsBrowseState', JSON.stringify(browseState));
  }, [allShows, allShowsPage, allShowsTotalPages, allShowsTotalResults, viewMode]);

  // Save scroll position on scroll events
  useEffect(() => {
    const saveScrollPosition = () => {
      if (restoringScroll.current) return;

      const savedState = localStorage.getItem('tvShowsBrowseState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          state.scrollY = window.scrollY;
          localStorage.setItem('tvShowsBrowseState', JSON.stringify(state));
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

  // Function to load shows based on current filters
  const loadShows = () => {
    loadManyPages(1, 10, 'all-shows'); // Load 10 pages initially (~200 shows)
  };

  // Advanced Discovery handlers
  const clearAllAdvancedFilters = () => {
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedCreator(null);
    setSelectedActor(null);
    setShowSearchQuery('');
    setAllShows([]);
    setAdvancedFilterLoading(false);
    setActivePreset('all-shows'); // Reset to All Shows preset
    // Reload general catalog
    loadManyPages(1, 10, 'all-shows');
  };

  const handleShowSearch = async (query: string) => {
    if (!query.trim()) {
      setShowSearchQuery('');
      setAllShows([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types
    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedCreator(null);
    setSelectedActor(null);

    setShowSearchQuery(query);
    setAllShows([]);
    setAdvancedFilterLoading(true);

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/tv?q=${encodeURIComponent(query)}&page=1`,
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
        const transformedResults = results.map((show: any) => ({
          ...show,
          poster_url: show.poster_url || (show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null),
          backdrop_url: show.backdrop_url || (show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null),
          year: show.year || (show.first_air_date ? show.first_air_date.substring(0, 4) : null)
        }));

        setAllShows(transformedResults);
        setAllShowsTotalPages(data.total_pages || 1);
        setAllShowsPage(1);
        setAllShowsTotalResults(data.total_results || transformedResults.length);
      }
    } catch (err) {
      console.error('Search failed:', err);
      if (currentRequestId === requestIdRef.current) {
        setAllShows([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleCollectionSelect = async (collectionId: number | null, name: string) => {
    if (!collectionId) {
      setSelectedCollection(null);
      setAllShows([]); // Just clear, don't reload
      return;
    }

    // Clear OTHER filter types
    setSelectedCompany(null);
    setSelectedCreator(null);
    setSelectedActor(null);
    setShowSearchQuery('');

    setSelectedCollection({ id: collectionId, name });

    // Check cache first
    const cacheKey = `collection:${collectionId}`;
    if (filterCache[cacheKey]) {
      setAllShows(filterCache[cacheKey].shows);
      setAllShowsTotalPages(1);
      setAllShowsPage(1);
      setAllShowsTotalResults(filterCache[cacheKey].totalResults);
      return;
    }

    setAllShows([]);
    setAllShowsPage(1);
    setAllShowsTotalPages(1);
    setAdvancedFilterLoading(true);

    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(`${API_BASE}/tmdb/collection/${collectionId}?type=tv`, { credentials: 'include' });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();

        const transformedShows = (data.parts || []).map((show: any) => ({
          ...show,
          poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
          backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
          year: show.first_air_date ? show.first_air_date.split('-')[0] : null
        }));

        setFilterCache(prev => ({
          ...prev,
          [cacheKey]: { shows: transformedShows, totalResults: transformedShows.length }
        }));

        setAllShows(transformedShows);
        setAllShowsTotalPages(1);
        setAllShowsPage(1);
        setAllShowsTotalResults(transformedShows.length);
      }
    } catch (error) {
      console.error('Failed to load collection:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllShows([]);
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
      setAllShows([]);
      return;
    }

    setSelectedCollection(null);
    setSelectedCreator(null);
    setSelectedActor(null);
    setShowSearchQuery('');

    setSelectedCompany({ id: companyId, name });

    const cacheKey = `company:${companyId}`;
    if (filterCache[cacheKey]) {
      setAllShows(filterCache[cacheKey].shows);
      const totalPages = Math.ceil(filterCache[cacheKey].shows.length / 20);
      setAllShowsTotalPages(totalPages);
      setAllShowsPage(totalPages);
      setAllShowsTotalResults(filterCache[cacheKey].totalResults);
      return;
    }

    setAllShows([]);
    setAllShowsPage(1);
    setAdvancedFilterLoading(true);

    const currentRequestId = ++requestIdRef.current;

    try {
      // Fetch first page to get total_pages
      const firstPageRes = await fetch(`${API_BASE}/tmdb/discover/company/${companyId}?page=1&type=tv`, { credentials: 'include' });

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
          fetch(`${API_BASE}/tmdb/discover/company/${companyId}?page=${page}&type=tv`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
        )
      );

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Combine all results
      const allResults = [
        ...(firstPage.results || []),
        ...remainingPages.flatMap(data => data?.results || [])
      ];

      const uniqueResults = Array.from(
        new Map(allResults.map((show: any) => [show.id, show])).values()
      );

      const transformedShows = uniqueResults.map((show: any) => ({
        ...show,
        poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
        backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
        year: show.first_air_date ? show.first_air_date.split('-')[0] : null
      }));

      setFilterCache(prev => ({
        ...prev,
        [cacheKey]: { shows: transformedShows, totalResults }
      }));

      setAllShows(transformedShows);
      setAllShowsTotalPages(totalPages);
      setAllShowsPage(totalPages);
      setAllShowsTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load company shows:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllShows([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
  };

  const handleCreatorSelect = async (personId: number | null, name: string) => {
    if (!personId) {
      setSelectedCreator(null);
      setAllShows([]);
      return;
    }

    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedActor(null);
    setShowSearchQuery('');

    setSelectedCreator({ id: personId, name });

    const cacheKey = `creator:${personId}`;
    if (filterCache[cacheKey]) {
      setAllShows(filterCache[cacheKey].shows);
      setAllShowsTotalPages(1);
      setAllShowsPage(1);
      setAllShowsTotalResults(filterCache[cacheKey].totalResults);
      return;
    }

    setAllShows([]);
    setAllShowsPage(1);
    setAllShowsTotalPages(1);
    setAdvancedFilterLoading(true);

    const currentRequestId = ++requestIdRef.current;

    try {
      const res = await fetch(`${API_BASE}/tmdb/discover/person/${personId}?role=crew&type=tv`, { credentials: 'include' });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();

        const transformedShows = (data.results || []).map((show: any) => ({
          ...show,
          poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
          backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
          year: show.first_air_date ? show.first_air_date.split('-')[0] : null
        }));

        setFilterCache(prev => ({
          ...prev,
          [cacheKey]: { shows: transformedShows, totalResults: transformedShows.length }
        }));

        setAllShows(transformedShows);
        setAllShowsTotalPages(1);
        setAllShowsPage(1);
        setAllShowsTotalResults(transformedShows.length);
      }
    } catch (error) {
      console.error('Failed to load creator shows:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllShows([]);
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
      setAllShows([]);
      return;
    }

    setSelectedCollection(null);
    setSelectedCompany(null);
    setSelectedCreator(null);
    setShowSearchQuery('');

    setSelectedActor({ id: personId, name });

    const cacheKey = `actor:${personId}`;
    if (filterCache[cacheKey]) {
      setAllShows(filterCache[cacheKey].shows);
      setAllShowsTotalPages(Math.ceil(filterCache[cacheKey].shows.length / 20));
      setAllShowsPage(5);
      setAllShowsTotalResults(filterCache[cacheKey].totalResults);
      return;
    }

    setAllShows([]);
    setAllShowsPage(1);
    setAdvancedFilterLoading(true);

    const currentRequestId = ++requestIdRef.current;

    try {
      const pages = await Promise.all([1, 2, 3, 4, 5].map(page =>
        fetch(`${API_BASE}/tmdb/discover/person/${personId}?role=cast&page=${page}&type=tv`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
      ));

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const allResults = pages.flatMap(data => data?.results || []);
      const totalResults = pages[0]?.total_results || 0;
      const totalPages = pages[0]?.total_pages || 1;

      const uniqueResults = Array.from(
        new Map(allResults.map((show: any) => [show.id, show])).values()
      );

      const transformedShows = uniqueResults.map((show: any) => ({
        ...show,
        poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
        backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
        year: show.first_air_date ? show.first_air_date.split('-')[0] : null
      }));

      setFilterCache(prev => ({
        ...prev,
        [cacheKey]: { shows: transformedShows, totalResults }
      }));

      setAllShows(transformedShows);
      setAllShowsTotalPages(totalPages);
      setAllShowsPage(5);
      setAllShowsTotalResults(totalResults);
    } catch (error) {
      console.error('Failed to load actor shows:', error);
      if (currentRequestId === requestIdRef.current) {
        setAllShows([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setAdvancedFilterLoading(false);
      }
    }
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
      const res = await fetch(`${API_BASE}/tmdb/trending/tv/week`, {
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
      excludeGenres: [],
      originCountries: []
    });
    await fetchAllShows(1, 'all-shows');
  };

  const loadIMDBTop250Shows = async () => {
    setAllShowsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/curated-lists/imdb-top-250-tv/items`, {
        credentials: 'include'
      });
      console.log('[IMDB Top 250 TV] Response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[IMDB Top 250 TV] Received data:', data);
        console.log('[IMDB Top 250 TV] Items count:', data.items?.length || 0);
        // Set the IMDB Top 250 shows as the all shows list
        setAllShows(data.items || []);
        setAllShowsTotalResults(data.items?.length || 0);
        setAllShowsPage(1);
        setAllShowsTotalPages(1);
        setViewMode('all-shows');
      } else {
        console.error('[IMDB Top 250 TV] Request failed with status:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch IMDB Top 250 TV:', err);
    } finally {
      setAllShowsLoading(false);
    }
  };

  // Auto-apply filters when they change (skip initial mount)
  useEffect(() => {
    // Skip if we're restoring state from localStorage
    if (isRestoring.current || isInitialMount.current) {
      return;
    }

    // Skip loading if advanced filter OR search is active
    const hasAdvancedFilter = selectedCollection || selectedCompany || selectedCreator || selectedActor || showSearchQuery.trim() !== '';
    if (hasAdvancedFilter) {
      return;
    }

    if (viewMode === 'all-shows' || viewMode === 'top-rated') {
      const timeoutId = setTimeout(() => {
        console.log('Applying filters:', allShowsFilters);
        loadManyPages(1, 10, viewMode, false); // Load 10 pages when filters change
      }, 500); // Debounce for 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [allShowsFilters.minRating, allShowsFilters.minVotes, allShowsFilters.sortBy, allShowsFilters.yearFrom, allShowsFilters.yearTo, allShowsFilters.selectedGenres, allShowsFilters.excludeGenres, allShowsFilters.originCountries]);

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
      if (allShowsFilters.originCountries && allShowsFilters.originCountries.length > 0) {
        baseUrl += `&origin_countries=${allShowsFilters.originCountries.join(',')}`;
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
          console.log(`[TVShows] Page ${startPage + index} response:`, {
            results: data.results.length,
            total_pages: data.total_pages,
            total_results: data.total_results
          });
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
      console.log('[TVShows] loadManyPages complete:', {
        actualTotalPages,
        totalResults,
        startPage,
        numPages,
        newPage: startPage + numPages - 1,
        uniqueShowsCount: uniqueShows.length
      });
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
      // Load 3 pages at a time during scroll (60 shows) for smooth performance
      const nextPage = allShowsPage + 1;
      loadManyPages(nextPage, 3, mode, true);
    }
  };

  // Infinite scroll - consolidated into single hook to avoid conflicts
  const hasMoreGenre = viewMode === 'genre' && genreCurrentPage < genreTotalPages;

  // Check if advanced filters are active (Collection/Creator/Actor/Company - these disable infinite scroll)
  const hasAdvancedFilter = selectedCollection || selectedCompany || selectedCreator || selectedActor;

  // Search has its own pagination - enable infinite scroll for search when there are more pages
  const hasMoreSearch = showSearchQuery.trim() !== '' && allShowsPage < allShowsTotalPages;

  // Only enable infinite scroll for all-shows/top-rated when NOT searching or filtering
  // (Search has its own hasMoreSearch check above)
  const hasMoreAllShows = !hasAdvancedFilter &&
    showSearchQuery.trim() === '' && // No search active
    (viewMode === 'all-shows' || viewMode === 'top-rated') &&
    allShowsPage < allShowsTotalPages;

  const hasMore = hasMoreGenre || hasMoreAllShows || hasMoreSearch;
  const isLoadingAny = genreLoading || allShowsLoading || loadingMultiplePages || advancedFilterLoading;

  const handleLoadMore = () => {
    // Safety check: never load more if advanced filters are active
    if (hasAdvancedFilter) {
      return;
    }

    if (viewMode === 'genre' && hasMoreGenre && !genreLoading) {
      loadMoreGenreShows();
    } else if ((viewMode === 'all-shows' || viewMode === 'top-rated') && hasMoreAllShows && !allShowsLoading && !loadingMultiplePages) {
      loadMoreAllShows();
    } else if (showSearchQuery.trim() !== '' && hasMoreSearch && !allShowsLoading && !loadingMultiplePages) {
      loadMoreAllShows();
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

  // Handle show click - reset torrent state and open modal
  const handleShowClick = (show: TVShow) => {
    // Reset all torrent-related state when opening a new show modal
    setTorrentResults([]);
    setAvailableReleases([]);
    setSelectedRelease(null);
    setQualityFilter('1080p');
    setPackTypeFilter('all');
    setTorrentSearchError(null);
    setVpnConnected(false);
    setDownloadUrl('');
    setSelectedShow(show);
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

  // Helper function to detect pack type from torrent title
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

  const browseTorrents = async () => {
    if (!selectedShow) return;

    setLoadingReleases(true);
    setAvailableReleases([]);
    setQualityFilter('1080p'); // Reset filter when browsing new torrents
    setPackTypeFilter('all');

    try {
      // Search Prowlarr directly with show title and year
      const searchQuery = `${selectedShow.name || selectedShow.title} ${selectedShow.year || ''}`;
      const releasesResponse = await fetch(`${API_BASE}/prowlarr/search?query=${encodeURIComponent(searchQuery)}&type=tv`, {
        credentials: 'include'
      });

      if (!releasesResponse.ok) {
        throw new Error('Failed to search torrents');
      }

      const releases = await releasesResponse.json();

      // Filter out irrelevant results
      const showName = (selectedShow.name || selectedShow.title).toLowerCase();
      const allKeywords = showName.split(/[\s:]+/).filter(word => word.length > 2);

      const filteredReleases = releases.filter((r: any) => {
        const titleLower = r.title.toLowerCase();

        // Filter out adult content keywords
        const adultKeywords = ['xxx', 'onlyfans', 'nfbusty', 'girlsoutwest', 'girlsrimming', 'playboy'];
        if (adultKeywords.some(keyword => titleLower.includes(keyword))) {
          return false;
        }

        // For shows with more than 2 keywords, require at least 50% match AND
        // at least one keyword beyond the first two (to avoid person-name-only matches)
        const matchedKeywords = allKeywords.filter(keyword => titleLower.includes(keyword));
        const matchPercentage = matchedKeywords.length / allKeywords.length;

        if (allKeywords.length > 2) {
          // Require at least 50% overall match
          if (matchPercentage < 0.5) return false;

          // Also require at least one keyword from beyond the first two words
          // (to filter out results that only match person names)
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
          setSonarrMessage(`⚠️ Found ${totalResults} results but all were for other shows. This show may not be available on your indexers. Try adding more indexers in Prowlarr.`);
        } else {
          setSonarrMessage(`⚠️ No torrents found. This show may not be available on your indexers. Try adding more indexers in Prowlarr.`);
        }
      }
    } catch (error: any) {
      console.error('Failed to browse torrents:', error);
      setSonarrMessage(`❌ ${error.message}`);
      setAvailableReleases([]);
    } finally {
      setLoadingReleases(false);
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

  // Sonarr Integration
  const addToSonarr = async (show: TVShow) => {
    setAddingToSonarr(true);
    setSonarrMessage(null);

    try {
      // First, get quality profiles and root folders
      const profilesRes = await fetch(`${API_BASE}/sonarr/quality-profiles`, {
        credentials: 'include'
      });
      const foldersRes = await fetch(`${API_BASE}/sonarr/root-folders`, {
        credentials: 'include'
      });

      if (!profilesRes.ok || !foldersRes.ok) {
        throw new Error('Failed to fetch Sonarr configuration');
      }

      const profiles = await profilesRes.json();
      const folders = await foldersRes.json();

      if (profiles.length === 0 || folders.length === 0) {
        throw new Error('Please configure quality profiles and root folders in Sonarr first');
      }

      // Store the profiles, folders, and show, then show quality selection dialog
      setQualityProfiles(profiles);
      setRootFolders(folders);
      setShowToAdd(show);

      // Default to HD-1080p if available, otherwise first profile
      const defaultProfile = profiles.find((p: any) => p.name === 'HD-1080p') || profiles[0];
      setSelectedQualityProfile(defaultProfile.id);

      setShowQualityDialog(true);
    } catch (error: any) {
      console.error('Failed to load Sonarr configuration:', error);
      setSonarrMessage(`❌ ${error.message}`);
    } finally {
      setAddingToSonarr(false);
    }
  };

  const confirmAddToSonarr = async () => {
    if (!showToAdd || !selectedQualityProfile) return;

    setAddingToSonarr(true);
    setShowQualityDialog(false);

    try {
      const rootFolderPath = rootFolders[0]?.path;

      // Add show to Sonarr with selected quality
      const response = await fetch(`${API_BASE}/sonarr/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: showToAdd.name || showToAdd.title,
          tvdbId: showToAdd.id,
          qualityProfileId: selectedQualityProfile,
          rootFolderPath,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add series to Sonarr');
      }

      const data = await response.json();
      setSonarrMessage(`✅ Added "${showToAdd.name || showToAdd.title}" to Sonarr! Downloading in ${qualityProfiles.find(p => p.id === selectedQualityProfile)?.name || 'selected quality'}...`);
      setTimeout(() => setSonarrMessage(null), 5000);
    } catch (error: any) {
      console.error('Failed to add to Sonarr:', error);
      setSonarrMessage(`❌ ${error.message}`);
    } finally {
      setAddingToSonarr(false);
      setShowToAdd(null);
    }
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

  const toggleBookmark = async (show: TVShow, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent opening the download modal

    const isBookmarked = bookmarkedShows.has(show.id);

    try {
      if (isBookmarked) {
        // Remove from watchlist
        const res = await fetch(`${API_BASE}/bookmarks/check-tmdb/${show.id}?mediaType=tv`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (data.bookmark) {
          await fetch(`${API_BASE}/bookmarks/${data.bookmark.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          setBookmarkedShows(prev => {
            const next = new Set(prev);
            next.delete(show.id);
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
            type: 'tmdb_tv',
            tmdb_id: show.id,
            media_type: 'tv',
            title: show.name || show.title,
            description: show.overview,
            thumbnail: show.poster_url,
            backdrop_url: show.backdrop_url,
            release_year: show.year ? parseInt(show.year) : null,
            vote_average: show.vote_average
          })
        });
        setBookmarkedShows(prev => new Set(prev).add(show.id));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      alert('Failed to update watchlist');
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
    const isBookmarked = bookmarkedShows.has(show.id);
    const isDownloaded = downloadedShows.has(show.id);

    return (
      <div
        className={`group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-2xl flex-shrink-0 ${
          size === 'small' ? 'w-40' : 'w-48'
        }`}
        onClick={() => handleShowClick(show)}
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
          onClick={(e) => toggleBookmark(show, e)}
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
                 viewMode === 'all-shows' && activePreset === 'imdb-top-250' ? '📺 IMDB Top 250' :
                 viewMode === 'all-shows' ? '📺 All TV Shows' :
                 viewMode === 'top-rated' ? '⭐ Top Rated TV Shows' :
                 'TV Shows'}
              </h1>
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
              {searchResults.filter(show => show.poster_url).map(show => (
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
                {genreShows.filter(show => show.poster_url).map(show => (
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
          {/* Advanced Discovery - Always Visible */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">Advanced Discovery</h3>
            <AdvancedFiltersTV
              onCollectionSelect={handleCollectionSelect}
              onCompanySelect={handleCompanySelect}
              onCreatorSelect={handleCreatorSelect}
              onActorSelect={handleActorSelect}
              onShowSearch={handleShowSearch}
              onClearAll={clearAllAdvancedFilters}
              selectedCollection={selectedCollection}
              selectedCompany={selectedCompany}
              selectedCreator={selectedCreator}
              selectedActor={selectedActor}
              showSearchQuery={showSearchQuery}
            />
          </div>

          {/* Show Additional Filters Button */}
          {!showAllShowsFilters && (
            <button
              onClick={() => setShowAllShowsFilters(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 font-medium"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Show Additional Filters
            </button>
          )}

          {/* Additional Filters Panel - Collapsible */}
          {showAllShowsFilters && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              {/* Hide Filters Button & Reset Button */}
              <div className="flex items-center justify-start gap-3 mb-4">
                <button
                  onClick={() => setShowAllShowsFilters(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300 font-medium"
                >
                  <X className="w-4 h-4" />
                  Hide Additional Filters
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
                      excludeGenres: [],
                      originCountries: []
                    });
                    setActivePreset('all-shows');
                    loadManyPages(1, 10, 'all-shows');
                  }}
                  disabled={
                    allShowsFilters.minRating === 0 &&
                    allShowsFilters.minVotes === 0 &&
                    !allShowsFilters.yearFrom &&
                    !allShowsFilters.yearTo &&
                    allShowsFilters.selectedGenres.length === 0 &&
                    allShowsFilters.excludeGenres.length === 0 &&
                    allShowsFilters.originCountries.length === 0
                  }
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                    allShowsFilters.minRating === 0 &&
                    allShowsFilters.minVotes === 0 &&
                    !allShowsFilters.yearFrom &&
                    !allShowsFilters.yearTo &&
                    allShowsFilters.selectedGenres.length === 0 &&
                    allShowsFilters.excludeGenres.length === 0 &&
                    allShowsFilters.originCountries.length === 0
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
                    <button
                      onClick={() => {
                        setAllShowsFilters({
                          minRating: 0,
                          minVotes: 0,
                          excludeGenres: [],
                          selectedGenres: [],
                          yearFrom: null,
                          yearTo: null,
                          sortBy: 'popularity.desc',
                          originCountries: []
                        });
                        setActivePreset('all-shows');
                        loadManyPages(1, 10, 'all-shows');
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        activePreset === 'all-shows'
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white ring-2 ring-blue-400 shadow-lg shadow-blue-500/50 scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      📺 All Shows
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'worth-watching') {
                          // Deselect - reset to all shows
                          setAllShowsFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset('all-shows');
                        } else {
                          // Select - apply preset
                          setAllShowsFilters({
                            minRating: 5.5,
                            minVotes: 250,
                            excludeGenres: [10762, 16],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
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
                          // Deselect - reset to all shows
                          setAllShowsFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset('all-shows');
                        } else {
                          // Select - apply preset
                          setAllShowsFilters({
                            minRating: 6.5,
                            minVotes: 500,
                            excludeGenres: [10762, 16],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
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
                      ⭐ Quality Shows (6.5+)
                    </button>
                    <button
                      onClick={() => {
                        if (activePreset === 'elite') {
                          // Deselect - reset to all shows
                          setAllShowsFilters({
                            minRating: 0,
                            minVotes: 0,
                            excludeGenres: [],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'popularity.desc',
                            originCountries: []
                          });
                          setActivePreset('all-shows');
                        } else {
                          // Select - apply preset
                          setAllShowsFilters({
                            minRating: 7.5,
                            minVotes: 1000,
                            excludeGenres: [10762, 16],
                            selectedGenres: [],
                            yearFrom: null,
                            yearTo: null,
                            sortBy: 'vote_average.desc',
                            originCountries: ['US', 'GB', 'CA', 'AU', 'NZ', 'IE']
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

                {/* Content Filters */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Content Filters</label>
                  <div className="flex flex-wrap gap-3">
                    {/* No Kids */}
                    <button
                      onClick={() => {
                        setAllShowsFilters(prev => ({
                          ...prev,
                          excludeGenres: prev.excludeGenres.includes(10762)
                            ? prev.excludeGenres.filter(id => id !== 10762)
                            : [...prev.excludeGenres, 10762]
                        }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allShowsFilters.excludeGenres.includes(10762)
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-gray-700 text-gray-300 hover:bg-red-600'
                      }`}
                      title="Exclude Kids shows"
                    >
                      🚫 No Kids
                    </button>

                    {/* No Anime */}
                    <button
                      onClick={() => {
                        setAllShowsFilters(prev => ({
                          ...prev,
                          excludeGenres: prev.excludeGenres.includes(16)
                            ? prev.excludeGenres.filter(id => id !== 16)
                            : [...prev.excludeGenres, 16]
                        }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        allShowsFilters.excludeGenres.includes(16)
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
                        setAllShowsFilters(prev => {
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
                        allShowsFilters.originCountries.length > 0
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
                          Genres {allShowsFilters.selectedGenres.length > 0 && `(${allShowsFilters.selectedGenres.length} selected)`}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="mt-3 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {genres.map(genre => {
                          const isSelected = allShowsFilters.selectedGenres.includes(genre.id);
                          return (
                            <button
                              key={genre.id}
                              onClick={() => {
                                setAllShowsFilters(prev => ({
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
                    Min Rating: {allShowsFilters.minRating > 0 ? allShowsFilters.minRating.toFixed(1) : 'Any'}
                  </label>
                  <div className="pt-2">
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
                </div>

                {/* Min Votes */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Min Votes: {allShowsFilters.minVotes > 0 ? allShowsFilters.minVotes : 'Any'}
                  </label>
                  <div className="pt-2">
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
                </div>

                {/* Year Range */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Year Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={allShowsFilters.yearFrom || ''}
                      onChange={(e) => setAllShowsFilters(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="From"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={allShowsFilters.yearTo || ''}
                      onChange={(e) => setAllShowsFilters(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
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
            {loadingMultiplePages ? (
              <div className="flex items-center gap-3 py-2">
                <Loader className="w-6 h-6 animate-spin text-blue-400" />
                <div className="space-y-1">
                  <div className="text-base font-semibold text-blue-400 animate-pulse">
                    Loading shows...
                  </div>
                  <div className="text-xs text-gray-400">
                    Please wait while we fetch more results
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
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
                <div className="text-xs text-gray-500 space-y-1">
                  {(allShowsFilters.minRating > 0 || allShowsFilters.minVotes > 0 || allShowsFilters.selectedGenres.length > 0 || allShowsFilters.excludeGenres.length > 0 || allShowsFilters.yearFrom || allShowsFilters.yearTo) ? (
                    <>
                      <div>
                        <span className="text-yellow-400">Filtered:</span> <span className="font-semibold text-yellow-300">{allShowsTotalResults.toLocaleString()}+ matching shows</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total catalog:</span> <span className="font-semibold text-gray-400">210,119+ shows</span>
                      </div>
                    </>
                  ) : (
                    <div>
                      Total catalog: <span className="font-semibold text-gray-400">{allShowsTotalResults.toLocaleString()}+ shows</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {allShowsLoading && allShowsPage === 1 ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {allShows.filter(show => show.poster_url).map(show => (
                  <TVShowCard key={show.id} show={show} />
                ))}
              </div>

              {/* Stats at bottom */}
              <div className="flex items-center justify-center mt-6">
                <div className="text-sm text-gray-400 bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
                  {allShows.filter(show => show.poster_url).length} TV shows loaded • Page {allShowsPage}/{allShowsTotalPages}
                </div>
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
                {allShows.filter(show => show.poster_url).map(show => (
                  <TVShowCard key={show.id} show={show} />
                ))}
              </div>

              {/* Stats at bottom */}
              <div className="flex items-center justify-center mt-6">
                <div className="text-sm text-gray-400 bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
                  {allShows.filter(show => show.poster_url).length} TV shows loaded • Page {allShowsPage}/{allShowsTotalPages}
                </div>
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
            setVpnConnected(false);
            setTorrentResults([]);
            setAvailableReleases([]);
            setSelectedRelease(null);
            setTorrentSearchError(null);
            setDownloadUrl('');
            setQualityFilter('1080p');
            setPackTypeFilter('all');
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
                <a
                  href={selectedShow.imdb_id
                    ? `https://www.imdb.com/title/${selectedShow.imdb_id}`
                    : `https://www.imdb.com/find?q=${encodeURIComponent((selectedShow.name || selectedShow.title || '') + (selectedShow.year ? ` ${selectedShow.year}` : ''))}&s=tt`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  title={selectedShow.imdb_id ? 'View on IMDb' : 'Search on IMDb'}
                >
                  IMDb
                </a>
              </div>

              <p className="text-gray-300 mb-6">{selectedShow.overview}</p>

              <div className="space-y-4">
                {/* Sonarr Message */}
                {sonarrMessage && (
                  <div className={`border rounded-lg p-4 ${
                    sonarrMessage.includes('✅')
                      ? 'bg-green-900/20 border-green-500/30'
                      : 'bg-red-900/20 border-red-500/30'
                  }`}>
                    <p className={`text-sm ${
                      sonarrMessage.includes('✅')
                        ? 'text-green-300'
                        : 'text-red-300'
                    }`}>
                      {sonarrMessage}
                    </p>
                  </div>
                )}


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
                      Found {availableReleases.filter(r => {
                        const quality = extractQuality(r.title);
                        const packType = detectPackType(r.title);
                        const qualityMatch = qualityFilter === 'all' || quality === qualityFilter;
                        const packMatch = packTypeFilter === 'all' || packType === packTypeFilter;
                        return qualityMatch && packMatch;
                      }).length} Torrents (sorted by seeds)
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
                              setPackTypeFilter('all'); // Reset pack filter when changing quality
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

                    {/* Separator Line */}
                    <div className="border-t border-gray-700 my-3"></div>

                    {/* Pack Type Filter Buttons */}
                    <div className="flex gap-2 mb-3 flex-wrap items-center">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'series', label: 'Complete Series' },
                        { value: 'season', label: 'Seasons' },
                        { value: 'multi', label: 'Multi-Episode' },
                        { value: 'episode', label: 'Episodes' }
                      ].map((packType) => {
                        // Count should respect the current quality filter
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

                    <div className="space-y-2">
                      {[...availableReleases]
                        .filter(r => {
                          const quality = extractQuality(r.title);
                          const packType = detectPackType(r.title);
                          const qualityMatch = qualityFilter === 'all' || quality === qualityFilter;
                          const packMatch = packTypeFilter === 'all' || packType === packTypeFilter;
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
                              onClick={async () => {
                                setSelectedRelease(release);
                                setAddingToSonarr(true);
                                // Show message immediately
                                setSonarrMessage(`⏳ Downloading "${selectedShow?.name || selectedShow?.title}"`);

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
                                      category: 'TV Shows',
                                    })
                                  });

                                  if (response.ok) {
                                    setSonarrMessage(`✅ Downloading "${selectedShow?.name || selectedShow?.title}"`);
                                    setAvailableReleases([]);
                                    setTimeout(() => setSonarrMessage(null), 5000);
                                  } else if (response.status === 409) {
                                    setSonarrMessage(`⚠️ This torrent is already in your downloads`);
                                    setTimeout(() => setSonarrMessage(null), 5000);
                                  } else {
                                    const error = await response.json();
                                    throw new Error(error.error || 'Failed to download');
                                  }
                                } catch (error: any) {
                                  setSonarrMessage(`❌ ${error.message}`);
                                } finally {
                                  setAddingToSonarr(false);
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

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quality Selection Dialog */}
      {showQualityDialog && showToAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-2xl border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Select Quality for "{showToAdd.name || showToAdd.title}"</h3>

            <div className="space-y-3 mb-6">
              {qualityProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedQualityProfile(profile.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedQualityProfile === profile.id
                      ? 'border-purple-500 bg-purple-900/30'
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{profile.name}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {profile.name === 'HD-1080p' && 'Recommended - Best quality/size balance'}
                        {profile.name === 'Ultra-HD' && '4K quality - Large file sizes'}
                        {profile.name === 'HD-720p' && 'Good quality - Smaller files'}
                        {profile.name === 'SD' && 'Low quality - Smallest files'}
                        {!['HD-1080p', 'Ultra-HD', 'HD-720p', 'SD'].includes(profile.name) && 'Custom quality profile'}
                      </div>
                    </div>
                    {selectedQualityProfile === profile.id && (
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQualityDialog(false);
                  setShowToAdd(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToSonarr}
                disabled={!selectedQualityProfile || addingToSonarr}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {addingToSonarr ? 'Adding...' : 'Add to Sonarr'}
              </button>
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
