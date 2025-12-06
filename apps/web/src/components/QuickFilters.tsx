import React from 'react';
import { X, Star, Calendar, SlidersHorizontal } from 'lucide-react';

interface Genre {
  id: number;
  name: string;
  emoji?: string;
}

interface QuickFiltersProps {
  genres: Genre[];
  selectedGenres: number[];
  onGenreToggle: (genreId: number) => void;

  minRating: number;
  onRatingChange: (rating: number) => void;

  yearRange: { min: number; max: number };
  selectedYearRange: { min: number; max: number };
  onYearRangeChange: (range: { min: number; max: number }) => void;

  sortBy: string;
  onSortChange: (sortBy: string) => void;

  onClearAll: () => void;
  isVisible: boolean;
  onToggle: () => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  genres,
  selectedGenres,
  onGenreToggle,
  minRating,
  onRatingChange,
  yearRange,
  selectedYearRange,
  onYearRangeChange,
  sortBy,
  onSortChange,
  onClearAll,
  isVisible,
  onToggle
}) => {
  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-blue-600 hover:bg-blue-700 text-white px-3 py-6 rounded-l-lg shadow-lg transition-colors"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold writing-mode-vertical">FILTERS</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-16 bottom-0 w-80 bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 z-30 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" />
            Quick Filters
          </h3>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-3">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
          >
            <option value="vote_average.desc">⭐ Top Rated</option>
            <option value="popularity.desc">🔥 Most Popular</option>
            <option value="release_date.desc">📅 Newest First</option>
            <option value="vote_count.desc">👥 Most Voted</option>
          </select>
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            <Star className="w-4 h-4 inline mr-1" />
            Minimum Rating: {minRating.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={minRating}
            onChange={(e) => onRatingChange(parseFloat(e.target.value))}
            className="w-full accent-blue-600 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>5.0</span>
            <span>10</span>
          </div>
        </div>

        {/* Year Range */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Year Range: {selectedYearRange.min} - {selectedYearRange.max}
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min={yearRange.min}
              max={yearRange.max}
              value={selectedYearRange.min}
              onChange={(e) => onYearRangeChange({ ...selectedYearRange, min: parseInt(e.target.value) })}
              className="w-full accent-blue-600 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="range"
              min={yearRange.min}
              max={yearRange.max}
              value={selectedYearRange.max}
              onChange={(e) => onYearRangeChange({ ...selectedYearRange, max: parseInt(e.target.value) })}
              className="w-full accent-green-600 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{yearRange.min}</span>
            <span>2025</span>
            <span>{yearRange.max}</span>
          </div>
        </div>

        {/* Genre Pills */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-3">Genres</label>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const isSelected = selectedGenres.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  onClick={() => onGenreToggle(genre.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {genre.emoji ? `${genre.emoji} ` : ''}{genre.name}
                </button>
              );
            })}
          </div>
          {selectedGenres.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {selectedGenres.length} genre{selectedGenres.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Clear All Button */}
        <button
          onClick={onClearAll}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Clear All Filters
        </button>
      </div>
    </div>
  );
};
