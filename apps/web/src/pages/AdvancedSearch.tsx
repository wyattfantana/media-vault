import { useState, useEffect } from 'react';
import { Search, Film, Tv, User, Folder, Building2, Download, Play, Star } from 'lucide-react';
import { API_BASE } from '@/lib/config';

interface MovieResult {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  media_type: 'movie';
}

interface TVResult {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  media_type: 'tv';
}

interface PersonResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  known_for: Array<MovieResult | TVResult>;
  media_type: 'person';
}

type SearchResult = MovieResult | TVResult | PersonResult;

interface Collection {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

interface Company {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export default function AdvancedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'all' | 'movies' | 'tv' | 'people' | 'collections' | 'companies'>('all');
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string; role: 'cast' | 'crew' } | null>(null);
  const [personMovies, setPersonMovies] = useState<MovieResult[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [collectionMovies, setCollectionMovies] = useState<MovieResult[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null);
  const [companyMovies, setCompanyMovies] = useState<MovieResult[]>([]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCollections([]);
      setCompanies([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      // Multi-search (movies, TV, people)
      const multiRes = await fetch(
        `${API_BASE}/tmdb/search/multi?query=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      // Collection search
      const collectionRes = await fetch(
        `${API_BASE}/tmdb/search/collections?query=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      // Company search
      const companyRes = await fetch(
        `${API_BASE}/tmdb/search/companies?query=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      if (multiRes.ok) {
        const data = await multiRes.json();
        setResults(data.results || []);
      }

      if (collectionRes.ok) {
        const data = await collectionRes.json();
        setCollections(data.results || []);
      }

      if (companyRes.ok) {
        const data = await companyRes.json();
        setCompanies(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonMovies = async (personId: number, role: 'cast' | 'crew') => {
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/discover/person/${personId}?role=${role}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setPersonMovies(data.results || []);
      }
    } catch (error) {
      console.error('Error loading person movies:', error);
    }
  };

  const loadCollectionMovies = async (collectionId: number) => {
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/collection/${collectionId}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setCollectionMovies(data.parts || []);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    }
  };

  const loadCompanyMovies = async (companyId: number) => {
    try {
      const res = await fetch(
        `${API_BASE}/tmdb/discover/company/${companyId}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setCompanyMovies(data.results || []);
      }
    } catch (error) {
      console.error('Error loading company movies:', error);
    }
  };

  const handlePersonClick = (person: PersonResult) => {
    const role = person.known_for_department === 'Directing' ? 'crew' : 'cast';
    setSelectedPerson({ id: person.id, name: person.name, role });
    loadPersonMovies(person.id, role);
  };

  const handleCollectionClick = (collection: Collection) => {
    setSelectedCollection(collection.id);
    loadCollectionMovies(collection.id);
  };

  const handleCompanyClick = (company: Company) => {
    setSelectedCompany({ id: company.id, name: company.name });
    loadCompanyMovies(company.id);
  };

  const getImageUrl = (path: string | null, size: 'w200' | 'w500' = 'w200') => {
    if (!path) return '/placeholder-movie.png';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  const movies = results.filter((r): r is MovieResult => r.media_type === 'movie');
  const tvShows = results.filter((r): r is TVResult => r.media_type === 'tv');
  const people = results.filter((r): r is PersonResult => r.media_type === 'person');

  // If viewing a person's filmography
  if (selectedPerson) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setSelectedPerson(null);
                setPersonMovies([]);
              }}
              className="text-brand-400 hover:text-brand-300 mb-2"
            >
              ← Back to search
            </button>
            <h2 className="text-2xl font-bold text-gray-100">
              {selectedPerson.name}'s {selectedPerson.role === 'cast' ? 'Movies' : 'Directed Films'}
            </h2>
            <p className="text-gray-400">{personMovies.length} results</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {personMovies.map((movie) => (
            <div key={movie.id} className="group cursor-pointer">
              <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                <img
                  src={getImageUrl(movie.poster_path, 'w500')}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span>{movie.vote_average.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2">{movie.title}</h3>
              <p className="text-xs text-gray-400">{movie.release_date?.split('-')[0]}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If viewing a collection
  if (selectedCollection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setSelectedCollection(null);
                setCollectionMovies([]);
              }}
              className="text-brand-400 hover:text-brand-300 mb-2"
            >
              ← Back to search
            </button>
            <h2 className="text-2xl font-bold text-gray-100">Collection Movies</h2>
            <p className="text-gray-400">{collectionMovies.length} movies</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {collectionMovies.map((movie) => (
            <div key={movie.id} className="group cursor-pointer">
              <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                <img
                  src={getImageUrl(movie.poster_path, 'w500')}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2">{movie.title}</h3>
              <p className="text-xs text-gray-400">{movie.release_date?.split('-')[0]}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If viewing company movies
  if (selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setSelectedCompany(null);
                setCompanyMovies([]);
              }}
              className="text-brand-400 hover:text-brand-300 mb-2"
            >
              ← Back to search
            </button>
            <h2 className="text-2xl font-bold text-gray-100">{selectedCompany.name} Movies</h2>
            <p className="text-gray-400">{companyMovies.length} results</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {companyMovies.map((movie) => (
            <div key={movie.id} className="group cursor-pointer">
              <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                <img
                  src={getImageUrl(movie.poster_path, 'w500')}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2">{movie.title}</h3>
              <p className="text-xs text-gray-400">{movie.release_date?.split('-')[0]}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Main search view
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for movies, TV shows, actors, directors, collections, or studios..."
            className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-lg"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500"></div>
            </div>
          )}
        </div>

        {/* Quick Examples */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-sm text-gray-400">Try:</span>
          {['James Bond', 'Quentin Tarantino', 'Disney', 'Arnold Schwarzenegger', 'Marvel'].map((example) => (
            <button
              key={example}
              onClick={() => setQuery(example)}
              className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {query && !loading && (
        <div className="space-y-8">
          {/* Collections */}
          {collections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-bold text-gray-100">Collections</h3>
                <span className="text-sm text-gray-400">({collections.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {collections.slice(0, 5).map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => handleCollectionClick(collection)}
                    className="group text-left"
                  >
                    <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                      <img
                        src={getImageUrl(collection.poster_path, 'w500')}
                        alt={collection.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h4 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-purple-400">
                      {collection.name}
                    </h4>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Companies/Studios */}
          {companies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-bold text-gray-100">Studios</h3>
                <span className="text-sm text-gray-400">({companies.length})</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {companies.slice(0, 10).map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleCompanyClick(company)}
                    className="px-4 py-2 bg-gray-800 hover:bg-blue-900/30 border border-gray-700 hover:border-blue-500 rounded-lg transition-all flex items-center gap-2"
                  >
                    {company.logo_path && (
                      <img
                        src={getImageUrl(company.logo_path, 'w200')}
                        alt={company.name}
                        className="h-6 object-contain"
                      />
                    )}
                    <span className="text-gray-200">{company.name}</span>
                    <span className="text-xs text-gray-400">{company.origin_country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* People */}
          {people.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-gray-100">People</h3>
                <span className="text-sm text-gray-400">({people.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {people.slice(0, 6).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => handlePersonClick(person)}
                    className="group text-left"
                  >
                    <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                      <img
                        src={getImageUrl(person.profile_path, 'w500')}
                        alt={person.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <h4 className="mt-2 text-sm font-medium text-gray-200 line-clamp-1 group-hover:text-green-400">
                      {person.name}
                    </h4>
                    <p className="text-xs text-gray-400">{person.known_for_department}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Movies */}
          {movies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-5 h-5 text-red-400" />
                <h3 className="text-xl font-bold text-gray-100">Movies</h3>
                <span className="text-sm text-gray-400">({movies.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {movies.map((movie) => (
                  <div key={movie.id} className="group cursor-pointer">
                    <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                      <img
                        src={getImageUrl(movie.poster_path, 'w500')}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-2 left-2 bg-black/75 text-yellow-400 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        {movie.vote_average.toFixed(1)}
                      </div>
                    </div>
                    <h4 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2">{movie.title}</h4>
                    <p className="text-xs text-gray-400">{movie.release_date?.split('-')[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TV Shows */}
          {tvShows.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Tv className="w-5 h-5 text-orange-400" />
                <h3 className="text-xl font-bold text-gray-100">TV Shows</h3>
                <span className="text-sm text-gray-400">({tvShows.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {tvShows.map((show) => (
                  <div key={show.id} className="group cursor-pointer">
                    <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
                      <img
                        src={getImageUrl(show.poster_path, 'w500')}
                        alt={show.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-2 left-2 bg-black/75 text-yellow-400 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        {show.vote_average.toFixed(1)}
                      </div>
                    </div>
                    <h4 className="mt-2 text-sm font-medium text-gray-200 line-clamp-2">{show.name}</h4>
                    <p className="text-xs text-gray-400">{show.first_air_date?.split('-')[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {results.length === 0 && collections.length === 0 && companies.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-400">No results found</h3>
              <p className="text-gray-500 mt-2">Try searching for movies, actors, directors, or studios</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!query && (
        <div className="text-center py-16">
          <Search className="w-20 h-20 text-gray-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-300 mb-2">Discover Amazing Content</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Search for movies, TV shows, actors, directors, collections, or studios. Get instant, intelligent results.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-gray-800/50 rounded-lg p-6 text-left">
              <Folder className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="font-semibold text-gray-200 mb-2">Collections</h3>
              <p className="text-sm text-gray-400">Find movie franchises like James Bond, Marvel, or Star Wars</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 text-left">
              <User className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-gray-200 mb-2">People</h3>
              <p className="text-sm text-gray-400">Browse filmographies of actors, directors, and crew</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 text-left">
              <Building2 className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-semibold text-gray-200 mb-2">Studios</h3>
              <p className="text-sm text-gray-400">Explore catalogs from Disney, Warner Bros, A24, and more</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
