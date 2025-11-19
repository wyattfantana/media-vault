import { useState } from 'react';

interface Programme {
  pid: string;
  name: string;
  episode: string;
  description: string;
  channel: string;
  categories: string;
  thumbnail: string;
  available: string;
  duration: string;
  type: 'tv' | 'radio';
}

export function Browse() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'tv' | 'radio'>('all');
  const [channel, setChannel] = useState('');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('tv');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'expiry' | 'name'>('recent');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');

  const handleSearch = async (e?: React.FormEvent, categoryFilter?: string) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...(searchType !== 'all' && { type: searchType }),
        ...(channel && { channel }),
        ...(categoryFilter && { category: categoryFilter })
      });

      const res = await fetch(`http://localhost:3001/api/v1/downloads/search/iplayer?${params}`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setProgrammes(data.results || []);
      } else {
        alert('Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      alert('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    setTimeout(() => {
      const form = document.querySelector('form');
      form?.requestSubmit();
    }, 100);
  };

  const handleCategorySearch = (searchPattern: string, type?: 'tv' | 'radio') => {
    setSearchQuery(searchPattern);
    if (type) {
      setSearchType(type);
    }
    setTimeout(() => {
      const form = document.querySelector('form');
      form?.requestSubmit();
    }, 100);
  };

  const handleDownload = async (programme: Programme) => {
    try {
      const url = `https://www.bbc.co.uk/iplayer/episode/${programme.pid}`;

      const res = await fetch('http://localhost:3001/api/v1/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url,
          downloader: 'get_iplayer',
          category: selectedCategory
        })
      });

      if (res.ok) {
        alert(`✓ Download queued: ${programme.name}\n\nThe download will start automatically.`);
      } else {
        const error = await res.json();
        alert(`Failed: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to start download');
    }
  };

  // Filter and sort programmes
  const filteredAndSortedProgrammes = programmes
    .filter(prog => {
      // Filter by channel
      if (filterChannel && prog.channel !== filterChannel) return false;

      // Filter by text (search in title, description, episode)
      if (filterText) {
        const searchText = filterText.toLowerCase();
        const matchesTitle = prog.name.toLowerCase().includes(searchText);
        const matchesDesc = prog.description.toLowerCase().includes(searchText);
        const matchesEpisode = prog.episode.toLowerCase().includes(searchText);
        if (!matchesTitle && !matchesDesc && !matchesEpisode) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'expiry':
          return a.available.localeCompare(b.available);
        default:
          return 0;
      }
    });

  // Get unique channels from loaded programmes
  const uniqueChannels = Array.from(new Set(programmes.map(p => p.channel))).sort();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse BBC iPlayer</h1>
        <p className="text-gray-600">Discover and download from thousands of BBC programmes</p>
      </div>

      {/* Search Bar */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for programmes, shows, or topics..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-lg"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Content</option>
              <option value="tv">TV Only</option>
              <option value="radio">Radio Only</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            >
              <option value="tv">Save to TV Shows</option>
              <option value="movies">Save to Movies</option>
              <option value="music">Save to Music</option>
              <option value="documentaries">Save to Documentaries</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            >
              <option value="recent">Recently Added</option>
              <option value="expiry">Expiring Soon</option>
              <option value="name">Name (A-Z)</option>
            </select>

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-lg ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </form>

        {/* Quick Browse */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Quick Browse:</span>
          <button
            onClick={() => {
              setSearchQuery('.*');
              setSearchType('tv');
              setTimeout(() => document.querySelector('form')?.requestSubmit(), 100);
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 font-medium"
          >
            📺 Browse All TV
          </button>
          <button
            onClick={() => {
              setSearchQuery('.*');
              setSearchType('radio');
              setTimeout(() => document.querySelector('form')?.requestSubmit(), 100);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 font-medium"
          >
            📻 Browse All Radio
          </button>
        </div>
      </div>

      {/* Loading State */}
      {searching && (
        <div className="card text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
          <p className="text-gray-500">Searching BBC iPlayer...</p>
        </div>
      )}

      {/* Results Header */}
      {!searching && programmes.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Showing {filteredAndSortedProgrammes.length} of {programmes.length} result{programmes.length !== 1 ? 's' : ''}
            {filterChannel && ` • ${filterChannel}`}
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white text-sm"
            >
              <option value="">All Channels</option>
              {uniqueChannels.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
            {filterChannel && (
              <button
                onClick={() => setFilterChannel('')}
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid View */}
      {!searching && programmes.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAndSortedProgrammes.map((programme) => (
            <div
              key={programme.pid}
              className="group cursor-pointer bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-200 overflow-hidden">
                {programme.thumbnail ? (
                  <img
                    src={programme.thumbnail.replace('/192xn/', '/512x288/')}
                    alt={programme.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
                    <svg className="w-16 h-16 text-white opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                  <button
                    onClick={() => handleDownload(programme)}
                    className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </div>

                {/* Type Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${programme.type === 'tv' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                    {programme.type.toUpperCase()}
                  </span>
                </div>

                {/* Expiry Badge */}
                {programme.available && (
                  <div className="absolute bottom-2 left-2">
                    <span className="px-2 py-1 bg-black bg-opacity-70 text-white rounded text-xs">
                      ⏰ {programme.available}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-1 mb-1">{programme.name}</h3>
                <p className="text-xs text-gray-600 line-clamp-1 mb-2">{programme.episode}</p>
                <p className="text-xs text-gray-500 line-clamp-2 leading-tight">{programme.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {programme.channel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!searching && programmes.length > 0 && viewMode === 'list' && (
        <div className="card space-y-3">
          {filteredAndSortedProgrammes.map((programme) => (
            <div
              key={programme.pid}
              className="flex gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <img
                src={programme.thumbnail.replace('/192xn/', '/256x144/')}
                alt={programme.name}
                className="w-40 h-24 object-cover rounded"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{programme.name}</h3>
                    <p className="text-sm text-gray-600">{programme.episode}</p>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">{programme.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>{programme.channel}</span>
                      {programme.available && <span>⏰ {programme.available}</span>}
                      <span className={`px-2 py-0.5 rounded ${programme.type === 'tv' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {programme.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(programme)}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 whitespace-nowrap"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!searching && programmes.length === 0 && !searchQuery && (
        <div className="card text-center py-16">
          <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Browse BBC iPlayer</h3>
          <p className="text-gray-500 mb-6">Click "Browse All TV" or "Browse All Radio" above to get started</p>
        </div>
      )}

      {/* No Results */}
      {!searching && programmes.length === 0 && searchQuery && (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 mb-4">No programmes found for "{searchQuery}"</p>
          <p className="text-sm text-gray-400">Try searching for a different show or use Browse All TV/Radio</p>
        </div>
      )}
    </div>
  );
}
