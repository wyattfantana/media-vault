import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Film, Tv, FileText, Star } from 'lucide-react';
import { API_BASE } from '@/lib/config';

interface RecommendedItem {
  id: number;
  title?: string;
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

interface GenrePreference {
  genreId: number;
  count: number;
}

export const RecommendedForYou: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [genrePreferences, setGenrePreferences] = useState<number[]>([]);
  const [preferredCategory, setPreferredCategory] = useState<string>('movies');
  const [downloadCount, setDownloadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      // Get user's genre preferences
      const prefsRes = await fetch(`${API_BASE}/recommendations`, {
        credentials: 'include'
      });

      if (!prefsRes.ok) {
        setLoading(false);
        return;
      }

      const prefsData = await prefsRes.json();
      setGenrePreferences(prefsData.genrePreferences || []);
      setPreferredCategory(prefsData.preferredCategory || 'movies');
      setDownloadCount(prefsData.downloadCount || 0);

      // If no download history, show trending instead
      if (!prefsData.genrePreferences || prefsData.genrePreferences.length === 0) {
        await fetchTrendingFallback();
        return;
      }

      // Fetch recommendations based on preferred genres
      const genreId = prefsData.genrePreferences[0]; // Use top genre
      const category = prefsData.preferredCategory;

      let endpoint = '';
      if (category === 'tv') {
        endpoint = `/tmdb/discover/tv?genre=${genreId}&sort_by=vote_average.desc&page=1&min_rating=7.0&min_votes=500`;
      } else if (category === 'documentaries') {
        endpoint = `/tmdb/discover/movies?genre=99&sort_by=vote_average.desc&page=1&min_rating=7.0&min_votes=500`;
      } else {
        endpoint = `/tmdb/discover/movies?genre=${genreId}&sort_by=vote_average.desc&page=1&min_rating=7.0&min_votes=500`;
      }

      const contentRes = await fetch(`${API_BASE}${endpoint}&enrich=true`, {
        credentials: 'include'
      });

      if (contentRes.ok) {
        const contentData = await contentRes.json();
        const results = contentData.results || [];
        setRecommendations(
          results.slice(0, 12).map((item: any) => ({
            ...item,
            type: category === 'tv' ? 'tv' : category === 'documentaries' ? 'documentary' : 'movie'
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      await fetchTrendingFallback();
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingFallback = async () => {
    try {
      const res = await fetch(`${API_BASE}/tmdb/trending/movie/week?enrich=true`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setRecommendations(
          (data.results || []).slice(0, 12).map((item: any) => ({
            ...item,
            type: 'movie'
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch trending fallback:', err);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -800 : 800,
        behavior: 'smooth'
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-3 h-3" />;
      case 'tv':
        return <Tv className="w-3 h-3" />;
      case 'documentary':
        return <FileText className="w-3 h-3" />;
      default:
        return <Film className="w-3 h-3" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'bg-purple-500/20 text-purple-300';
      case 'tv':
        return 'bg-blue-500/20 text-blue-300';
      case 'documentary':
        return 'bg-green-500/20 text-green-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg p-6 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
          <h2 className="text-xl font-bold text-white">Recommended For You</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="w-40 h-60 bg-gray-700 rounded-lg animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null; // Don't show if no recommendations
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg p-6 border border-purple-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-white">Recommended For You</h2>
        </div>
        {downloadCount > 0 && (
          <span className="text-sm text-purple-300">
            Based on your {downloadCount} download{downloadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-r-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {recommendations.map(item => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex-shrink-0 w-40 group/card"
            >
              <div className="relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all cursor-pointer">
                {item.poster_url ? (
                  <img
                    src={item.poster_url}
                    alt={item.title || item.name || ''}
                    className="w-full aspect-[2/3] object-cover group-hover/card:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center">
                    <Film className="w-12 h-12 text-gray-600" />
                  </div>
                )}

                {/* Type Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getTypeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                </div>

                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                  <h3 className="font-semibold text-xs line-clamp-2 mb-1 text-white">
                    {item.title || item.name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-white">{item.vote_average.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
