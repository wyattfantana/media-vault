import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';

interface SearchResult {
  source: 'bbc_iplayer' | 'youtube' | 'soundcloud';
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: number;
  uploader?: string;
  channel?: string;
  uploadDate?: string;
  viewCount?: number;
  available?: string;
  type?: string;
  categories?: string;
}

export function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(['bbc', 'youtube']);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [category, setCategory] = useState('movies');
  const [customFolder, setCustomFolder] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const sources = selectedSources.join(',');
      const res = await fetch(
        `${API_BASE}/search/unified?q=${encodeURIComponent(searchQuery)}&sources=${sources}&limit=100`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        console.error('Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (result: SearchResult) => {
    setSelectedResult(result);
    setShowDownloadModal(true);
  };

  const confirmDownload = async () => {
    if (!selectedResult) return;

    setDownloading(true);
    try {
      // Use get_iplayer for BBC, yt-dlp for all other platforms
      const downloader = selectedResult.source === 'bbc_iplayer' ? 'get_iplayer' : 'yt-dlp';
      const url = selectedResult.source === 'bbc_iplayer'
        ? `https://www.bbc.co.uk/iplayer/episode/${selectedResult.id}`
        : selectedResult.url;

      const res = await fetch('${API_BASE}/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url,
          downloader,
          category,
          customFolder: category === 'custom' ? customFolder : undefined
        })
      });

      if (res.ok) {
        alert(`Download queued: ${selectedResult.title}\n\nThe download will start automatically.`);
        setShowDownloadModal(false);
        setSelectedResult(null);
        setCategory('movies');
        setCustomFolder('');
      } else {
        const error = await res.json();
        alert(`Failed to queue download: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to queue download');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatViewCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Unified Search</h1>
        <p className="text-gray-600">Search across BBC iPlayer, YouTube, and SoundCloud</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="card mb-6">
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for shows, videos, channels..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-lg"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 mb-4">
          <span className="text-sm font-medium text-gray-700">Search in:</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedSources.includes('bbc')}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSources([...selectedSources, 'bbc']);
                } else {
                  setSelectedSources(selectedSources.filter(s => s !== 'bbc'));
                }
              }}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">BBC iPlayer</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedSources.includes('youtube')}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSources([...selectedSources, 'youtube']);
                } else {
                  setSelectedSources(selectedSources.filter(s => s !== 'youtube'));
                }
              }}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">YouTube</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedSources.includes('soundcloud')}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSources([...selectedSources, 'soundcloud']);
                } else {
                  setSelectedSources(selectedSources.filter(s => s !== 'soundcloud'));
                }
              }}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">SoundCloud</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || selectedSources.length === 0}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map((result, index) => (
              <div key={`${result.source}-${result.id}-${index}`} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-200">
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {result.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(result.duration)}
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      result.source === 'bbc_iplayer'
                        ? 'bg-red-600 text-white'
                        : result.source === 'youtube'
                        ? 'bg-red-500 text-white'
                        : 'bg-orange-500 text-white' // soundcloud
                    }`}>
                      {result.source === 'bbc_iplayer' ? 'BBC' :
                       result.source === 'youtube' ? 'YouTube' : 'SoundCloud'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">
                    {result.title}
                  </h3>

                  <p className="text-xs text-gray-600 mb-2">
                    {result.source === 'bbc_iplayer' ? result.channel : result.uploader}
                  </p>

                  {result.source !== 'bbc_iplayer' && result.viewCount && (
                    <p className="text-xs text-gray-500 mb-2">
                      {formatViewCount(result.viewCount)}
                    </p>
                  )}

                  {result.source === 'bbc_iplayer' && result.available && (
                    <p className="text-xs text-gray-500 mb-2">
                      Expires in {result.available}
                    </p>
                  )}

                  {result.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                      {result.description}
                    </p>
                  )}

                  <button
                    onClick={() => handleDownload(result)}
                    className="w-full px-3 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && searchQuery && (
        <div className="card text-center py-12">
          <p className="text-gray-500">No results found for "{searchQuery}"</p>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Download Settings</h3>

            <p className="text-sm text-gray-700 mb-4">
              <strong>{selectedResult.title}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="movies">Movies</option>
                <option value="tv">TV Shows</option>
                <option value="music">Music</option>
                <option value="documentaries">Documentaries</option>
                <option value="custom">Custom Folder...</option>
                <option value="collection">Collection (No folder)</option>
              </select>
            </div>

            {category === 'custom' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Folder Name
                </label>
                <input
                  type="text"
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  placeholder="e.g., DJ Mixes, Podcasts, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={confirmDownload}
                disabled={downloading || (category === 'custom' && !customFolder)}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {downloading ? 'Adding...' : 'Download'}
              </button>
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedResult(null);
                  setCategory('movies');
                  setCustomFolder('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
