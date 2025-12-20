import { useState, useEffect } from 'react';
import { Search, X, Folder, Building2, User, Film } from 'lucide-react';
import { API_BASE } from '@/lib/config';

interface Collection {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
}

interface Person {
  id: number;
  name: string;
  known_for_department: string;
}

interface AdvancedFiltersProps {
  onCollectionSelect: (collectionId: number | null, name: string) => void;
  onCompanySelect: (companyId: number | null, name: string) => void;
  onDirectorSelect: (personId: number | null, name: string) => void;
  onActorSelect: (personId: number | null, name: string) => void;
  onMovieSearch: (query: string) => void;
  onClearAll: () => void;
  selectedCollection: { id: number; name: string } | null;
  selectedCompany: { id: number; name: string } | null;
  selectedDirector: { id: number; name: string } | null;
  selectedActor: { id: number; name: string } | null;
  movieSearchQuery: string;
}

export function AdvancedFilters({
  onCollectionSelect,
  onCompanySelect,
  onDirectorSelect,
  onActorSelect,
  onMovieSearch,
  onClearAll,
  selectedCollection,
  selectedCompany,
  selectedDirector,
  selectedActor,
  movieSearchQuery
}: AdvancedFiltersProps) {
  const [searchType, setSearchType] = useState<'search' | 'collection' | 'company' | 'director' | 'actor'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Sync local search query with parent when parent clears it (e.g., when selecting other filters)
  useEffect(() => {
    if (movieSearchQuery === '' && searchQuery !== '' && searchType === 'search') {
      setSearchQuery('');
      setResults([]);
    }
  }, [movieSearchQuery]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      if (searchType === 'search') {
        onMovieSearch(''); // Clear movie search
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      if (searchType === 'search') {
        // Direct movie title search - call parent handler
        onMovieSearch(searchQuery);
      } else {
        // Other searches (collection, company, person)
        performSearch();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchType]);

  const performSearch = async () => {
    setSearching(true);
    try {
      let endpoint = '';

      switch (searchType) {
        case 'collection':
          endpoint = `/tmdb/search/collections?query=${encodeURIComponent(searchQuery)}`;
          break;
        case 'company':
          endpoint = `/tmdb/search/companies?query=${encodeURIComponent(searchQuery)}`;
          break;
        case 'director':
        case 'actor':
          endpoint = `/tmdb/search/people?q=${encodeURIComponent(searchQuery)}`;
          break;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let filteredResults = data.results || [];

        // Filter people by department
        if (searchType === 'director') {
          filteredResults = filteredResults.filter((p: Person) =>
            p.known_for_department === 'Directing' || p.known_for_department === 'Writing'
          );
        } else if (searchType === 'actor') {
          filteredResults = filteredResults.filter((p: Person) =>
            p.known_for_department === 'Acting'
          );
        }

        setResults(filteredResults.slice(0, 10));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (item: any) => {
    switch (searchType) {
      case 'collection':
        onCollectionSelect(item.id, item.name);
        break;
      case 'company':
        onCompanySelect(item.id, item.name);
        break;
      case 'director':
        onDirectorSelect(item.id, item.name);
        break;
      case 'actor':
        onActorSelect(item.id, item.name);
        break;
    }
    setSearchQuery('');
    setResults([]);
  };

  const activeFilters = [
    selectedCollection && { type: 'collection', ...selectedCollection },
    selectedCompany && { type: 'company', ...selectedCompany },
    selectedDirector && { type: 'director', ...selectedDirector },
    selectedActor && { type: 'actor', ...selectedActor }
  ].filter(Boolean);

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCollection && (
            <div className="flex items-center gap-2 bg-purple-900/30 border border-purple-500/50 text-purple-300 px-3 py-1.5 rounded-lg text-sm">
              <Folder className="w-4 h-4" />
              <span>{selectedCollection.name}</span>
              <button
                onClick={() => onCollectionSelect(null, '')}
                className="hover:text-purple-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {selectedCompany && (
            <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/50 text-blue-300 px-3 py-1.5 rounded-lg text-sm">
              <Building2 className="w-4 h-4" />
              <span>{selectedCompany.name}</span>
              <button
                onClick={() => onCompanySelect(null, '')}
                className="hover:text-blue-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {selectedDirector && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/50 text-green-300 px-3 py-1.5 rounded-lg text-sm">
              <User className="w-4 h-4" />
              <span>{selectedDirector.name} (Director)</span>
              <button
                onClick={() => onDirectorSelect(null, '')}
                className="hover:text-green-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {selectedActor && (
            <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-500/50 text-yellow-300 px-3 py-1.5 rounded-lg text-sm">
              <User className="w-4 h-4" />
              <span>{selectedActor.name} (Actor)</span>
              <button
                onClick={() => onActorSelect(null, '')}
                className="hover:text-yellow-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Clear All & Browse Movies Button */}
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All & Browse Movies
          </button>
        </div>
      )}

      {/* Search Type Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setSearchType('search')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'search'
              ? 'bg-brand-900/50 text-brand-300 border border-brand-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Search className="w-4 h-4" />
          Search
        </button>
        <button
          onClick={() => setSearchType('collection')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'collection'
              ? 'bg-purple-900/50 text-purple-300 border border-purple-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Folder className="w-4 h-4" />
          Collection
        </button>
        <button
          onClick={() => setSearchType('company')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'company'
              ? 'bg-blue-900/50 text-blue-300 border border-blue-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Studio
        </button>
        <button
          onClick={() => setSearchType('director')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'director'
              ? 'bg-green-900/50 text-green-300 border border-green-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <User className="w-4 h-4" />
          Director
        </button>
        <button
          onClick={() => setSearchType('actor')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'actor'
              ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <User className="w-4 h-4" />
          Actor
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            searchType === 'search' ? 'Search movies by title (e.g., The Matrix, Inception)...' :
            searchType === 'collection' ? 'Search collections (e.g., James Bond, Marvel)...' :
            searchType === 'company' ? 'Search studios (e.g., Disney, Warner Bros)...' :
            searchType === 'director' ? 'Search directors (e.g., Quentin Tarantino)...' :
            'Search actors (e.g., Arnold Schwarzenegger)...'
          }
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500"></div>
          </div>
        )}
      </div>

      {/* Quick Examples */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          {searchType === 'search' && ['The Matrix', 'Inception', 'The Godfather', 'Interstellar', 'Pulp Fiction', 'The Dark Knight', 'Fight Club', 'Goodfellas', 'The Shawshank Redemption', 'Forrest Gump'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'collection' && ['James Bond', 'Marvel', 'Star Wars', 'Fast & Furious', 'Harry Potter', 'Lord of the Rings', 'Jurassic Park', 'Mission Impossible', 'X-Men', 'Avengers'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'company' && ['Disney', 'Warner Bros', 'A24', 'Pixar', 'Universal', 'Paramount', 'Sony Pictures', '20th Century', 'Lionsgate', 'DreamWorks'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'director' && ['Quentin Tarantino', 'Christopher Nolan', 'Steven Spielberg', 'Martin Scorsese', 'Ridley Scott', 'David Fincher', 'James Cameron', 'Peter Jackson', 'Stanley Kubrick'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'actor' && ['Arnold Schwarzenegger', 'Tom Cruise', 'Leonardo DiCaprio', 'Denzel Washington', 'Brad Pitt', 'Tom Hanks', 'Robert De Niro', 'Al Pacino', 'Keanu Reeves', 'Matt Damon'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Results Dropdown */}
      {results.length > 0 && (
        <div className="bg-gray-900 border-2 border-blue-500/50 rounded-lg max-h-64 overflow-y-auto shadow-xl shadow-blue-500/20">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`w-full px-4 py-3 text-left transition-all flex items-center gap-3 border-b border-gray-800 last:border-b-0 ${
                searchType === 'collection' ? 'hover:bg-purple-900/30 hover:border-purple-500/50' :
                searchType === 'company' ? 'hover:bg-blue-900/30 hover:border-blue-500/50' :
                searchType === 'director' ? 'hover:bg-green-900/30 hover:border-green-500/50' :
                searchType === 'actor' ? 'hover:bg-yellow-900/30 hover:border-yellow-500/50' :
                'hover:bg-gray-800'
              }`}
            >
              {searchType === 'collection' && <Folder className="w-5 h-5 text-purple-400 flex-shrink-0" />}
              {searchType === 'company' && <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />}
              {searchType === 'director' && <User className="w-5 h-5 text-green-400 flex-shrink-0" />}
              {searchType === 'actor' && <User className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-white truncate">{item.name}</div>
                {item.origin_country && (
                  <div className="text-xs text-gray-400">{item.origin_country}</div>
                )}
                {item.known_for_department && (
                  <div className="text-xs text-gray-400">{item.known_for_department}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
