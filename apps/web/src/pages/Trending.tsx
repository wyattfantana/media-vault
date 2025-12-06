import React, { useState, useEffect } from 'react';
import { TrendingUp, Film, Tv, FileText, Star, Calendar, Flame } from 'lucide-react';

interface TrendingItem {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  year: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  type: 'movie' | 'tv' | 'documentary';
  genre_ids: number[];
}

type TimeWindow = 'day' | 'week';
type ContentType = 'all' | 'movies' | 'tv' | 'documentaries';

export default function Trending() {
  const [trendingContent, setTrendingContent] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');
  const [contentFilter, setContentFilter] = useState<ContentType>('all');

  const API_BASE = 'http://localhost:3001/api/v1';

  useEffect(() => {
    fetchTrendingContent();
  }, [timeWindow, contentFilter]);

  const fetchTrendingContent = async () => {
    setLoading(true);
    try {
      const promises = [];

      // Fetch trending movies
      if (contentFilter === 'all' || contentFilter === 'movies') {
        promises.push(
          fetch(`${API_BASE}/tmdb/trending/movie/${timeWindow}?enrich=true`, {
            credentials: 'include'
          })
            .then(res => res.json())
            .then(data => data.results.map((item: any) => ({ ...item, type: 'movie' as const })))
        );
      }

      // Fetch trending TV shows
      if (contentFilter === 'all' || contentFilter === 'tv') {
        promises.push(
          fetch(`${API_BASE}/tmdb/trending/tv/${timeWindow}?enrich=true`, {
            credentials: 'include'
          })
            .then(res => res.json())
            .then(data => data.results.map((item: any) => ({ ...item, type: 'tv' as const })))
        );
      }

      // Fetch trending documentaries
      if (contentFilter === 'all' || contentFilter === 'documentaries') {
        promises.push(
          fetch(`${API_BASE}/tmdb/discover/movies?genre=99&sort_by=popularity.desc&enrich=true`, {
            credentials: 'include'
          })
            .then(res => res.json())
            .then(data => data.results.slice(0, 20).map((item: any) => ({ ...item, type: 'documentary' as const })))
        );
      }

      const results = await Promise.all(promises);
      const allContent = results.flat();

      // Sort by popularity
      allContent.sort((a, b) => b.popularity - a.popularity);

      setTrendingContent(allContent);
    } catch (err) {
      console.error('Failed to fetch trending content:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-4 h-4" />;
      case 'tv':
        return <Tv className="w-4 h-4" />;
      case 'documentary':
        return <FileText className="w-4 h-4" />;
      default:
        return <Film className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'bg-purple-500/20 text-purple-300 border-purple-400/50';
      case 'tv':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/50';
      case 'documentary':
        return 'bg-green-500/20 text-green-300 border-green-400/50';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-400/50';
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 7) return 'bg-blue-500';
    if (rating >= 6) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              <h1 className="text-3xl font-bold">Trending Now</h1>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-6">
            {/* Time Window */}
            <div className="flex gap-2">
              <button
                onClick={() => setTimeWindow('day')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeWindow === 'day'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeWindow('week')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeWindow === 'week'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                This Week
              </button>
            </div>

            {/* Content Type Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setContentFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  contentFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setContentFilter('movies')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  contentFilter === 'movies'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Film className="w-4 h-4" />
                Movies
              </button>
              <button
                onClick={() => setContentFilter('tv')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  contentFilter === 'tv'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Tv className="w-4 h-4" />
                TV Shows
              </button>
              <button
                onClick={() => setContentFilter('documentaries')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  contentFilter === 'documentaries'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Documentaries
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading trending content...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {trendingContent.map((item, index) => (
              <div
                key={`${item.type}-${item.id}`}
                className="group relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer"
              >
                {/* Rank Badge */}
                <div className="absolute top-2 left-2 z-10 bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  #{index + 1}
                </div>

                {/* Type Badge */}
                <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getTypeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                  <span className="capitalize">{item.type === 'tv' ? 'TV' : item.type}</span>
                </div>

                {/* Poster */}
                {item.poster_url ? (
                  <img
                    src={item.poster_url}
                    alt={item.title || item.name || ''}
                    className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center">
                    <Film className="w-16 h-16 text-gray-600" />
                  </div>
                )}

                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                    {item.title || item.name}
                  </h3>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{item.vote_average.toFixed(1)}</span>
                    </div>
                    {item.year && (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{item.year}</span>
                      </div>
                    )}
                  </div>

                  {/* Popularity Bar */}
                  <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                      style={{ width: `${Math.min((item.popularity / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && trendingContent.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No trending content found</p>
          </div>
        )}
      </div>
    </div>
  );
}
