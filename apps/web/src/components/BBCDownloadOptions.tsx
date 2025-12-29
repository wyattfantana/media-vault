import { useState } from 'react';

interface BBCDownloadOptionsProps {
  programmeName: string;
  programmeType?: 'tv' | 'radio';
  onConfirm: (options: { category: string; quality: string }) => void;
  onCancel: () => void;
}

export function BBCDownloadOptions({ programmeName, programmeType = 'tv', onConfirm, onCancel }: BBCDownloadOptionsProps) {
  const [category, setCategory] = useState<string>('iplayer');
  const [quality, setQuality] = useState<string>('hd');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ category, quality });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-100">Download Options</h2>
        <p className="text-gray-300 mb-4">Configure download for: <strong className="text-gray-100">{programmeName}</strong></p>

        {/* VPN Warning */}
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <p className="text-sm text-yellow-200 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>VPN Warning:</strong> Turn off your VPN to access BBC iPlayer content. VPNs and proxies may be blocked by BBC.
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Destination Folder
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-100 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="iplayer">iPlayer (Default)</option>
              <option value="tv">TV Shows</option>
              <option value="movies">Movies</option>
              <option value="documentaries">Documentaries</option>
              <option value="music">Music</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Files will be organized into: /MediaVault/{category === 'iplayer' ? 'iplayer' : category === 'tv' ? 'TV Shows' : category === 'movies' ? 'Movies' : category === 'documentaries' ? 'Documentaries' : 'Music'}
            </p>
          </div>

          {/* Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Quality
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-100 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {programmeType === 'tv' ? (
                <>
                  <option value="fhd">Full HD (1080p) - Best quality, largest file</option>
                  <option value="hd">HD (720p) - Good quality, balanced size (Default)</option>
                  <option value="sd">SD (540p) - Standard quality, smaller file</option>
                  <option value="web">Web (396p) - Lower quality, fast download</option>
                  <option value="mobile">Mobile (288p) - Lowest quality, smallest file</option>
                </>
              ) : (
                <>
                  <option value="high">High (320k) - Best quality (Default)</option>
                  <option value="std">Standard (128k) - Good quality</option>
                  <option value="med">Medium (96k) - Lower quality</option>
                  <option value="low">Low (48k) - Lowest quality</option>
                </>
              )}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Higher quality = larger file size and longer download time
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
            >
              Start Download
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
