import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';

interface Preset {
  id: string;
  name: string;
  description: string;
  platform: string | null; // NEW: platform-specific or null for global
  quality: string;
  format: string;
  auto_organize: boolean;
  base_folder: string;
  subfolder_pattern: string;
  filename_pattern: string;
  embed_metadata: boolean;
  embed_thumbnail: boolean;
  embed_subtitles: boolean;
  subtitle_languages: string[];
  extract_audio: boolean;
  is_default: boolean;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

interface PresetFormData {
  name: string;
  description: string;
  platform: string; // NEW: platform selection
  quality: string;
  format: string;
  auto_organize: boolean;
  base_folder: string;
  subfolder_pattern: string;
  filename_pattern: string;
  embed_metadata: boolean;
  embed_thumbnail: boolean;
  embed_subtitles: boolean;
  subtitle_languages: string;
  extract_audio: boolean;
}

export function Settings() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [formData, setFormData] = useState<PresetFormData>({
    name: '',
    description: '',
    platform: '', // '' = global/all platforms
    quality: 'best',
    format: 'mp4',
    auto_organize: true,
    base_folder: '',
    subfolder_pattern: '{category}',
    filename_pattern: '{title}',
    embed_metadata: true,
    embed_thumbnail: true,
    embed_subtitles: false,
    subtitle_languages: '',
    extract_audio: false
  });

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch('${API_BASE}/presets', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets || []);
      }
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPreset(null);
    setFormData({
      name: '',
      description: '',
      platform: '',
      quality: 'best',
      format: 'mp4',
      auto_organize: true,
      base_folder: '',
      subfolder_pattern: '{category}',
      filename_pattern: '{title}',
      embed_metadata: true,
      embed_thumbnail: true,
      embed_subtitles: false,
      subtitle_languages: '',
      extract_audio: false
    });
    setShowModal(true);
  };

  const handleEdit = (preset: Preset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || '',
      platform: preset.platform || '',
      quality: preset.quality,
      format: preset.format,
      auto_organize: preset.auto_organize,
      base_folder: preset.base_folder || '',
      subfolder_pattern: preset.subfolder_pattern || '{category}',
      filename_pattern: preset.filename_pattern || '{title}',
      embed_metadata: preset.embed_metadata,
      embed_thumbnail: preset.embed_thumbnail,
      embed_subtitles: preset.embed_subtitles,
      subtitle_languages: preset.subtitle_languages?.join(', ') || '',
      extract_audio: preset.extract_audio
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const subtitle_languages = formData.subtitle_languages
      ? formData.subtitle_languages.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const payload = {
      ...formData,
      platform: formData.platform || null, // Send null for global presets
      subtitle_languages
    };

    try {
      if (editingPreset) {
        // Update existing preset
        await fetch(`${API_BASE}/presets/${editingPreset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        // Create new preset
        await fetch('${API_BASE}/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      setShowModal(false);
      fetchPresets();
    } catch (err) {
      alert('Failed to save preset');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this preset?')) return;

    try {
      await fetch(`${API_BASE}/presets/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchPresets();
    } catch (err) {
      alert('Failed to delete preset');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`${API_BASE}/presets/${id}/set-default`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchPresets();
    } catch (err) {
      alert('Failed to set default preset');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your download presets and preferences</p>
      </div>

      {/* Download Presets Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Download Presets</h2>
            <p className="text-sm text-gray-600">Save common download configurations for quick reuse</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Preset
          </button>
        </div>

        {presets.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <p className="text-gray-500 text-lg font-medium">No presets yet</p>
            <p className="text-sm text-gray-400 mt-2">Create your first download preset to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <div key={preset.id} className="card hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{preset.name}</h3>
                      {preset.is_default && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Default</span>
                      )}
                    </div>
                    {preset.description && (
                      <p className="text-sm text-gray-600">{preset.description}</p>
                    )}
                  </div>
                </div>

                {/* Settings Summary */}
                <div className="space-y-2 mb-4">
                  {preset.platform && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                        {preset.platform === 'youtube' && '▶️ YouTube'}
                        {preset.platform === 'soundcloud' && '🎧 SoundCloud'}
                        {preset.platform === 'bbc_iplayer' && '📺 BBC iPlayer'}
                        {preset.platform === 'tiktok' && '🎵 TikTok'}
                        {preset.platform === 'reddit' && '🔴 Reddit'}
                        {preset.platform === 'rumble' && '📹 Rumble'}
                        {preset.platform === 'twitch' && '🎮 Twitch'}
                        {preset.platform === 'vimeo' && '🎬 Vimeo'}
                        {!['youtube', 'soundcloud', 'bbc_iplayer', 'tiktok', 'reddit', 'rumble', 'twitch', 'vimeo'].includes(preset.platform) && preset.platform}
                      </span>
                    </div>
                  )}
                  {!preset.platform && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-medium">
                        🌐 All Platforms
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Quality:</span>
                    <span className="font-medium text-gray-900">{preset.quality}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Format:</span>
                    <span className="font-medium text-gray-900">{preset.format}</span>
                  </div>
                  {preset.subfolder_pattern && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Folder:</span>
                      <span className="font-mono text-xs text-gray-700">{preset.subfolder_pattern}</span>
                    </div>
                  )}
                </div>

                {/* Usage Stats */}
                {preset.usage_count > 0 && (
                  <div className="text-xs text-gray-500 mb-4">
                    Used {preset.usage_count} time{preset.usage_count !== 1 ? 's' : ''}
                    {preset.last_used_at && (
                      <> • Last used {new Date(preset.last_used_at).toLocaleDateString()}</>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!preset.is_default && (
                    <button
                      onClick={() => handleSetDefault(preset.id)}
                      className="flex-1 px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(preset)}
                    className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Preset Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingPreset ? 'Edit Preset' : 'Create New Preset'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preset Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="e.g., Best Quality Video"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="Optional description..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform *
                      </label>
                      <select
                        value={formData.platform}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      >
                        <option value="">🌐 All Platforms (Global)</option>
                        <option value="youtube">▶️ YouTube</option>
                        <option value="soundcloud">🎧 SoundCloud</option>
                        <option value="bbc_iplayer">📺 BBC iPlayer</option>
                        <option value="tiktok">🎵 TikTok</option>
                        <option value="reddit">🔴 Reddit</option>
                        <option value="rumble">📹 Rumble</option>
                        <option value="twitch">🎮 Twitch</option>
                        <option value="vimeo">🎬 Vimeo</option>
                        <option value="other">Other</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose a specific platform or leave as "All Platforms" for a global preset
                      </p>
                    </div>
                  </div>
                </div>

                {/* Download Settings */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Download Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                      <select
                        value={formData.quality}
                        onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="best">Best Quality</option>
                        <option value="2160p">2160p (4K)</option>
                        <option value="1440p">1440p (2K)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="720p">720p (HD)</option>
                        <option value="480p">480p (SD)</option>
                        <option value="audio_only">Audio Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                      <select
                        value={formData.format}
                        onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="mp4">MP4</option>
                        <option value="mkv">MKV</option>
                        <option value="webm">WebM</option>
                        <option value="mp3">MP3</option>
                        <option value="flac">FLAC</option>
                        <option value="wav">WAV</option>
                        <option value="opus">Opus</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">File Organization</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.auto_organize}
                        onChange={(e) => setFormData({ ...formData, auto_organize: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Auto-organize files</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subfolder Pattern
                      </label>
                      <input
                        type="text"
                        value={formData.subfolder_pattern}
                        onChange={(e) => setFormData({ ...formData, subfolder_pattern: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                        placeholder="{category} or {channel}/{year}"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use variables: {'{category}'}, {'{channel}'}, {'{year}'}, {'{month}'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filename Pattern
                      </label>
                      <input
                        type="text"
                        value={formData.filename_pattern}
                        onChange={(e) => setFormData({ ...formData, filename_pattern: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                        placeholder="{title} or {channel} - {title}"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use variables: {'{title}'}, {'{channel}'}, {'{date}'}, {'{id}'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Metadata & Extras</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.embed_metadata}
                        onChange={(e) => setFormData({ ...formData, embed_metadata: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Embed metadata (title, artist, etc.)</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.embed_thumbnail}
                        onChange={(e) => setFormData({ ...formData, embed_thumbnail: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Embed thumbnail</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.embed_subtitles}
                        onChange={(e) => setFormData({ ...formData, embed_subtitles: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Embed subtitles</label>
                    </div>
                    {formData.embed_subtitles && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subtitle Languages
                        </label>
                        <input
                          type="text"
                          value={formData.subtitle_languages}
                          onChange={(e) => setFormData({ ...formData, subtitle_languages: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                          placeholder="en, es, fr (comma-separated)"
                        />
                      </div>
                    )}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.extract_audio}
                        onChange={(e) => setFormData({ ...formData, extract_audio: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Extract audio only (ignore video)</label>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                  >
                    {editingPreset ? 'Update Preset' : 'Create Preset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
