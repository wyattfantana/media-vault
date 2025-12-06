import React, { useState, useEffect } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';
import { searchCache } from '../utils/searchCache';

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
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [showFormatPreview, setShowFormatPreview] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');
  const [formattedPath, setFormattedPath] = useState<any>(null);
  const [loadingFormat, setLoadingFormat] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

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
  const [allMoviesLoading, setAllMoviesLoading] = useState(false);

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
      const res = await fetch(`${API_BASE}/tmdb/trending/movie?timeWindow=week`, {
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
      const res = await fetch(
        `${API_BASE}/tmdb/discover/movies?genre=${genreId}&sort_by=vote_average.desc&page=1&min_rating=7.5&min_votes=2000`,
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
      let url = `${API_BASE}/tmdb/discover/movies?genre=${genreId}&sort_by=${filters.sortBy}&page=${page}&enrich=true`;
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

  const fetchAllMovies = async (page: number, mode: 'all-movies' | 'top-rated') => {
    setAllMoviesLoading(true);
    try {
      let url: string;
      if (mode === 'top-rated') {
        // Top rated: high rating threshold (7.5+) with strict vote requirements
        url = `${API_BASE}/tmdb/discover/movies?sort_by=vote_average.desc&page=${page}&min_rating=7.5&min_votes=2000&enrich=true`;
      } else {
        // All movies: decent quality (6.5+) with lower vote requirements for more variety
        url = `${API_BASE}/tmdb/discover/movies?sort_by=vote_average.desc&page=${page}&min_rating=6.5&min_votes=500&enrich=true`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Client-side re-sort for perfect order
        const sorted = (data.results || []).sort((a: Movie, b: Movie) => {
          const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
          const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
          return ratingB - ratingA;
        });

        if (page === 1) {
          setAllMovies(sorted);
        } else {
          // Merge and re-sort when loading more
          const merged = [...allMovies, ...sorted];
          setAllMovies(merged.sort((a, b) => {
            const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
            const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
            return ratingB - ratingA;
          }));
        }

        setAllMoviesTotalPages(data.total_pages || 1);
        setAllMoviesPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch all movies:', err);
    } finally {
      setAllMoviesLoading(false);
    }
  };

  const loadMoreAllMovies = () => {
    if (allMoviesPage < allMoviesTotalPages && !allMoviesLoading) {
      const mode = viewMode as 'all-movies' | 'top-rated';
      fetchAllMovies(allMoviesPage + 1, mode);
    }
  };

  // Infinite scroll - automatically loads more when scrolling near bottom
  useInfiniteScroll({
    onLoadMore: loadMoreGenreMovies,
    hasMore: viewMode === 'genre' && genreCurrentPage < genreTotalPages,
    isLoading: genreLoading,
    threshold: 800,
    useWindow: true
  });

  useInfiniteScroll({
    onLoadMore: loadMoreAllMovies,
    hasMore: (viewMode === 'all-movies' || viewMode === 'top-rated') && allMoviesPage < allMoviesTotalPages,
    isLoading: allMoviesLoading,
    threshold: 800,
    useWindow: true
  });

  // Debounced search - automatically triggers when user stops typing
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      if (viewMode === 'search') setViewMode('browse');
      return;
    }

    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

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
      } else {
        const error = await res.json();
        alert(`Download failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please check your URL and try again.');
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

        {/* Always show rating badge - color coded by score */}
        <div className={`absolute top-2 right-2 ${getRatingColor(rating)} text-white px-2 py-1 rounded-md font-bold text-sm shadow-lg flex items-center gap-1`}>
          <Star className="w-3 h-3 fill-white" />
          {rating.toFixed(1)}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
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
                 viewMode === 'all-movies' ? '🎬 All Movies' :
                 viewMode === 'top-rated' ? '⭐ Top Rated Movies' :
                 'Movies'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {viewMode === 'browse' && (
                <button
                  onClick={openAllMoviesView}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🎬 All Movies
                </button>
              )}
              {(viewMode === 'search' || viewMode === 'genre' || viewMode === 'all-movies' || viewMode === 'top-rated') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setViewMode('browse');
                    setSelectedGenre(null);
                  }}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Back to Browse
                </button>
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
                placeholder="Search movies..."
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Browse Mode */}
      {viewMode === 'browse' && (
        <div className="py-8">
          <MovieRow title="🔥 Trending This Week" movies={trendingMovies} loading={false} />
          <MovieRow title="⭐ Top Rated Movies" movies={topRatedMovies} loading={false} onSeeAll={openTopRatedView} />
          <MovieRow title="🎬 Now Playing in Theaters" movies={nowPlayingMovies} loading={false} />

          {genreSections.map(section => (
            <MovieRow
              key={section.id}
              title={`${section.emoji} ${section.name}`}
              movies={section.movies}
              loading={section.loading}
              onSeeAll={() => openGenreView(section)}
            />
          ))}
        </div>
      )}

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
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">All Movies (Sorted by Rating)</h2>
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
              {allMoviesLoading && allMoviesPage > 1 && (
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
              {allMoviesLoading && allMoviesPage > 1 && (
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
          onClick={() => setSelectedMovie(null)}
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
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">How to Download</h3>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Click a search button below to find this movie</li>
                    <li>Copy the magnet link URL</li>
                    <li>Paste URL below and click "Queue Download"</li>
                  </ol>
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => search1337x(selectedMovie)}
                      className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      1337x
                    </button>
                    <button
                      onClick={() => searchPirateBay(selectedMovie)}
                      className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      <Search className="w-4 h-4" />
                      PirateBay
                    </button>
                    <button
                      onClick={() => searchExtTo(selectedMovie)}
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
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => submitDownload(selectedMovie)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
                      >
                        <Download className="w-5 h-5" />
                        Confirm Download
                      </button>
                      <button
                        onClick={() => {
                          setShowFormatPreview(false);
                          setFormattedPath(null);
                        }}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
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
