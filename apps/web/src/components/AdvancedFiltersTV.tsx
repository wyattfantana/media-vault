import { useState, useEffect } from 'react';
import { Search, X, Building2, User } from 'lucide-react';
import { API_BASE } from '@/lib/config';

interface Company {
  id: number;
  name: string;
}

interface Person {
  id: number;
  name: string;
  known_for_department: string;
}

interface AdvancedFiltersTVProps {
  onCompanySelect: (companyId: number | null, name: string) => void;
  onCreatorSelect: (personId: number | null, name: string) => void;
  onActorSelect: (personId: number | null, name: string) => void;
  onShowSearch: (query: string) => void;
  onClearAll: () => void;
  selectedCompany: { id: number; name: string } | null;
  selectedCreator: { id: number; name: string } | null;
  selectedActor: { id: number; name: string } | null;
  showSearchQuery: string;
}

export function AdvancedFiltersTV({
  onCompanySelect,
  onCreatorSelect,
  onActorSelect,
  onShowSearch,
  onClearAll,
  selectedCompany,
  selectedCreator,
  selectedActor,
  showSearchQuery
}: AdvancedFiltersTVProps) {
  const [searchType, setSearchType] = useState<'search' | 'network' | 'creator' | 'actor'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Sync local search query with parent when parent clears it
  useEffect(() => {
    if (showSearchQuery === '' && searchQuery !== '' && searchType === 'search') {
      setSearchQuery('');
      setResults([]);
    }
  }, [showSearchQuery]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      if (searchType === 'search') {
        onShowSearch(''); // Clear show search
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      if (searchType === 'search') {
        // Direct TV show title search - call parent handler
        onShowSearch(searchQuery);
      } else {
        // Other searches (collection, network, person)
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
        case 'network':
          endpoint = `/tmdb/search/companies?query=${encodeURIComponent(searchQuery)}`;
          break;
        case 'creator':
        case 'actor':
          endpoint = `/tmdb/search/people?q=${encodeURIComponent(searchQuery)}`;
          break;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let filteredResults = data.results || [];

        // Filter people by department
        if (searchType === 'creator') {
          filteredResults = filteredResults.filter((p: Person) =>
            p.known_for_department === 'Directing' ||
            p.known_for_department === 'Writing' ||
            p.known_for_department === 'Production'
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
      case 'network':
        onCompanySelect(item.id, item.name);
        break;
      case 'creator':
        onCreatorSelect(item.id, item.name);
        break;
      case 'actor':
        onActorSelect(item.id, item.name);
        break;
    }
    setSearchQuery('');
    setResults([]);
  };

  const activeFilters = [
    selectedCompany && { type: 'network', ...selectedCompany },
    selectedCreator && { type: 'creator', ...selectedCreator },
    selectedActor && { type: 'actor', ...selectedActor }
  ].filter(Boolean);

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
          {selectedCreator && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/50 text-green-300 px-3 py-1.5 rounded-lg text-sm">
              <User className="w-4 h-4" />
              <span>{selectedCreator.name} (Creator)</span>
              <button
                onClick={() => onCreatorSelect(null, '')}
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

          {/* Clear All & Browse Shows Button */}
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All & Browse Shows
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
          onClick={() => setSearchType('network')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'network'
              ? 'bg-blue-900/50 text-blue-300 border border-blue-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Network
        </button>
        <button
          onClick={() => setSearchType('creator')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            searchType === 'creator'
              ? 'bg-green-900/50 text-green-300 border border-green-500/50'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <User className="w-4 h-4" />
          Creator
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
            searchType === 'search' ? 'Search TV shows by title (e.g., Breaking Bad, The Wire)...' :
            searchType === 'network' ? 'Search networks/studios (e.g., HBO, Netflix, AMC)...' :
            searchType === 'creator' ? 'Search creators/showrunners (e.g., Vince Gilligan, David Simon)...' :
            'Search actors (e.g., Bryan Cranston, Peter Dinklage)...'
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
          {searchType === 'search' && ['Breaking Bad', 'The Wire', 'Game of Thrones', 'The Sopranos', 'Stranger Things', 'The Office', 'Friends', 'The Crown', 'Succession', 'True Detective'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'network' && ['HBO', 'Netflix', 'AMC', 'FX', 'Showtime', 'BBC', 'ABC', 'NBC', 'CBS', 'Apple TV'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'creator' && ['Vince Gilligan', 'David Simon', 'David Benioff', 'Matthew Weiner', 'Aaron Sorkin', 'Ryan Murphy', 'Shonda Rhimes', 'Greg Berlanti', 'Dick Wolf'].map(ex => (
            <button
              key={ex}
              onClick={() => setSearchQuery(ex)}
              className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded transition-colors"
            >
              {ex}
            </button>
          ))}
          {searchType === 'actor' && ['Bryan Cranston', 'Peter Dinklage', 'Kit Harington', 'Steve Carell', 'Jennifer Aniston', 'Hugh Laurie', 'Kiefer Sutherland', 'James Gandolfini', 'Sarah Jessica Parker', 'Jon Hamm'].map(ex => (
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
                searchType === 'network' ? 'hover:bg-blue-900/30 hover:border-blue-500/50' :
                searchType === 'creator' ? 'hover:bg-green-900/30 hover:border-green-500/50' :
                searchType === 'actor' ? 'hover:bg-yellow-900/30 hover:border-yellow-500/50' :
                'hover:bg-gray-800'
              }`}
            >
              {searchType === 'network' && <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />}
              {searchType === 'creator' && <User className="w-5 h-5 text-green-400 flex-shrink-0" />}
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
