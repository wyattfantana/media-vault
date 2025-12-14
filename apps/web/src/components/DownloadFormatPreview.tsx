import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';

interface FormattedPath {
  contentType: 'tv' | 'movie' | 'music' | 'documentary' | 'other';
  originalName: string;
  formattedPath: string;
  folderStructure: {
    showName?: string;
    movieName?: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
  preview: string;
  baseDir: string;
}

interface DownloadFormatPreviewProps {
  filename: string;
  contentType?: 'tv' | 'movie' | 'music' | 'documentaries' | 'custom' | 'collection' | 'auto';
  category?: string; // User-selected category from dropdown
  customFolder?: string; // Custom folder path if category is 'custom'
  onConfirm: (formatted: FormattedPath) => void;
  onCancel: () => void;
  onEdit?: (newPath: string) => void;
}

export function DownloadFormatPreview({
  filename,
  contentType = 'auto',
  category,
  customFolder,
  onConfirm,
  onCancel,
  onEdit
}: DownloadFormatPreviewProps) {
  const [formatted, setFormatted] = useState<FormattedPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPath, setEditedPath] = useState('');

  useEffect(() => {
    fetchFormatPreview();
  }, [filename, contentType, category, customFolder]);

  const fetchFormatPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/downloads/format-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filename,
          contentType: contentType === 'auto' ? undefined : contentType,
          category: category || undefined,
          customFolder: customFolder || undefined,
          searchTMDB: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get format preview');
      }

      const data = await response.json();
      setFormatted(data.formatted);
      setEditedPath(data.formatted.formattedPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (formatted) {
      if (isEditing && editedPath !== formatted.formattedPath) {
        // Use edited path
        onConfirm({
          ...formatted,
          formattedPath: editedPath
        });
      } else {
        onConfirm(formatted);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPath(formatted?.formattedPath || '');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
            <span className="text-gray-700">Analyzing filename and fetching metadata...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={fetchFormatPreview}
              className="px-4 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!formatted) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 rounded-t-lg">
          <h3 className="text-xl font-bold text-white">Download Format Preview</h3>
          <p className="text-brand-100 text-sm mt-1">
            Review and confirm the Jellyfin-compatible formatting
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Content Type Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-600">Content Type:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              formatted.contentType === 'tv' ? 'bg-blue-100 text-blue-800' :
              formatted.contentType === 'movie' ? 'bg-purple-100 text-purple-800' :
              formatted.contentType === 'music' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {formatted.contentType === 'tv' ? 'TV Show' :
               formatted.contentType === 'movie' ? 'Movie' :
               formatted.contentType === 'music' ? 'Music' :
               formatted.contentType === 'documentary' ? 'Documentary' : 'Other'}
            </span>
          </div>

          {/* Original Filename */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Filename:
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <code className="text-sm text-gray-800 break-all">{formatted.originalName}</code>
            </div>
          </div>

          {/* Formatted Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formatted for Jellyfin:
            </label>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                {formatted.preview}
              </pre>
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Folder:
            </label>
            <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <code className="text-sm font-semibold text-green-800">
                D:\MediaVault\{formatted.baseDir}\
              </code>
            </div>
          </div>

          {/* Metadata Info */}
          {formatted.folderStructure && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Metadata:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {formatted.folderStructure.showName && (
                  <div>
                    <span className="text-gray-500">Show:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.showName}</span>
                  </div>
                )}
                {formatted.folderStructure.movieName && (
                  <div>
                    <span className="text-gray-500">Movie:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.movieName}</span>
                  </div>
                )}
                {formatted.folderStructure.year && (
                  <div>
                    <span className="text-gray-500">Year:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.year}</span>
                  </div>
                )}
                {formatted.folderStructure.season !== undefined && (
                  <div>
                    <span className="text-gray-500">Season:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.season}</span>
                  </div>
                )}
                {formatted.folderStructure.episode !== undefined && (
                  <div>
                    <span className="text-gray-500">Episode:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.episode}</span>
                  </div>
                )}
                {formatted.folderStructure.episodeTitle && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Title:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatted.folderStructure.episodeTitle}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit Path (Advanced):
              </label>
              <input
                type="text"
                value={editedPath}
                onChange={(e) => setEditedPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Enter custom path..."
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex items-center justify-between border-t border-gray-200">
          <div>
            {!isEditing && onEdit && (
              <button
                onClick={handleEdit}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Path</span>
              </button>
            )}
            {isEditing && (
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center space-x-2 px-6 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 font-medium shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Confirm Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
