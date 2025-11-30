import React, { useState, useEffect } from 'react';
import { Film, Search, Star, Calendar, Download, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, SlidersHorizontal, X, Loader } from 'lucide-react';

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
  const [searchResults, setSearchResults] = useState<TVShow[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState<TVShow | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

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
  const [allShowsLoading, setAllShowsLoading] = useState(false);

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
    setAllShowsPage(1);
    await fetchAllShows(1, 'all-shows');
  };

  const fetchAllShows = async (page: number, mode: 'all-shows' | 'top-rated') => {
    setAllShowsLoading(true);
    try {
      let url: string;
      if (mode === 'top-rated') {
        // Top rated: high rating threshold (7.5+) with strict vote requirements
        url = `${API_BASE}/tmdb/popular/tv?sort_by=vote_average.desc&page=${page}&min_rating=7.5&min_votes=2000&enrich=true`;
      } else {
        // All shows: decent quality (6.5+) with lower vote requirements for more variety
        url = `${API_BASE}/tmdb/popular/tv?sort_by=vote_average.desc&page=${page}&min_rating=6.5&min_votes=500&enrich=true`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Client-side re-sort for perfect order
        const sorted = (data.results || []).sort((a: TVShow, b: TVShow) => {
          const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
          const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
          return ratingB - ratingA;
        });

        if (page === 1) {
          setAllShows(sorted);
        } else {
          // Merge and re-sort when loading more
          const merged = [...allShows, ...sorted];
          setAllShows(merged.sort((a, b) => {
            const ratingA = a.imdb_rating ? parseFloat(a.imdb_rating) : a.vote_average;
            const ratingB = b.imdb_rating ? parseFloat(b.imdb_rating) : b.vote_average;
            return ratingB - ratingA;
          }));
        }

        setAllShowsTotalPages(data.total_pages || 1);
        setAllShowsPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch all shows:', err);
    } finally {
      setAllShowsLoading(false);
    }
  };

  const loadMoreAllShows = () => {
    if (allShowsPage < allShowsTotalPages && !allShowsLoading) {
      const mode = viewMode as 'all-shows' | 'top-rated';
      fetchAllShows(allShowsPage + 1, mode);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      if (viewMode === 'search') setViewMode('browse');
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setViewMode('search');
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/search/tv?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
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

  const searchGoojara = (show: TVShow) => {
    const query = encodeURIComponent(`${show.name || show.title} ${show.year || ''}`);
    window.open(`https://ww1.goojara.to/search/?q=${query}`, '_blank');
  };

  const searchPirateBay = (show: TVShow) => {
    const query = encodeURIComponent(`${show.name || show.title} ${show.year || ''}`);
    window.open(`https://piratebay.party/search/${query}/1/99/0`, '_blank');
  };

  const handleDownload = async (show: TVShow) => {
    if (!downloadUrl.trim()) {
      alert('Please enter a download URL');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: downloadUrl,
          category: 'TV',
          customFolder: `${show.name || show.title} (${show.year})`,
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
              {viewMode === 'browse' && (
                <button
                  onClick={openAllShowsView}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📺 All TV Shows
                </button>
              )}
              {(viewMode === 'search' || viewMode === 'genre' || viewMode === 'all-shows' || viewMode === 'top-rated') && (
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
                placeholder="Search TV shows..."
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Browse Mode */}
      {viewMode === 'browse' && (
        <div className="py-8">
          <TVShowRow title="🔥 Trending This Week" shows={trendingShows} loading={false} />
          <TVShowRow title="⭐ Top Rated TV Shows" shows={topRatedShows} loading={false} onSeeAll={openTopRatedView} />
          <TVShowRow title="📺 Airing Today" shows={airingTodayShows} loading={false} />

          {genreSections.map(section => (
            <TVShowRow
              key={section.id}
              title={`${section.emoji} ${section.name}`}
              shows={section.shows}
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

              {genreCurrentPage < genreTotalPages && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMoreGenreShows}
                    disabled={genreLoading}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {genreLoading ? 'Loading...' : `Load More (${genreCurrentPage}/${genreTotalPages})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All Shows View */}
      {viewMode === 'all-shows' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">All TV Shows (Sorted by Rating)</h2>
            <div className="text-sm text-gray-400">
              {allShows.length} TV shows loaded • Page {allShowsPage}/{allShowsTotalPages}
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

              {allShowsPage < allShowsTotalPages && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMoreAllShows}
                    disabled={allShowsLoading}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {allShowsLoading ? 'Loading...' : `Load More (${allShowsPage}/${allShowsTotalPages})`}
                  </button>
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
            <h2 className="text-2xl font-bold">⭐ Top Rated TV Shows (7.5+)</h2>
            <div className="text-sm text-gray-400">
              {allShows.length} TV shows loaded • Page {allShowsPage}/{allShowsTotalPages}
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

              {allShowsPage < allShowsTotalPages && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMoreAllShows}
                    disabled={allShowsLoading}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {allShowsLoading ? 'Loading...' : `Load More (${allShowsPage}/${allShowsTotalPages})`}
                  </button>
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
          onClick={() => setSelectedShow(null)}
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
                    <li>Copy the direct video URL</li>
                    <li>Paste URL below and click "Queue Download"</li>
                  </ol>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => searchGoojara(selectedShow)}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      Goojara
                    </button>
                    <button
                      onClick={() => searchPirateBay(selectedShow)}
                      className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      PirateBay
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
                    disabled={!downloadUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Queue Download
                  </button>
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
