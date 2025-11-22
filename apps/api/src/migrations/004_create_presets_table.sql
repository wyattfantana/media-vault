-- Migration: Create download_presets table
-- Description: Stores user-defined download configurations for quick reuse

CREATE TABLE IF NOT EXISTS download_presets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Download settings
  quality TEXT DEFAULT 'best' CHECK (quality IN ('best', '2160p', '1440p', '1080p', '720p', '480p', 'audio_only')),
  format TEXT DEFAULT 'mp4' CHECK (format IN ('mp4', 'mkv', 'webm', 'mp3', 'flac', 'wav', 'opus')),

  -- Organization settings
  auto_organize BOOLEAN DEFAULT true,
  base_folder TEXT,
  subfolder_pattern TEXT, -- e.g., "{category}/{channel}", "{year}/{month}", etc.
  filename_pattern TEXT, -- e.g., "{title}", "{channel} - {title}", etc.

  -- Advanced settings
  embed_metadata BOOLEAN DEFAULT true,
  embed_thumbnail BOOLEAN DEFAULT true,
  embed_subtitles BOOLEAN DEFAULT false,
  subtitle_languages TEXT[], -- e.g., ['en', 'es']
  extract_audio BOOLEAN DEFAULT false,

  -- Metadata
  is_default BOOLEAN DEFAULT false, -- User's default preset
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),

  -- Ensure unique preset names per user
  UNIQUE(user_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_presets_user_id ON download_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_presets_is_default ON download_presets(user_id, is_default) WHERE is_default = true;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_presets_updated_at
  BEFORE UPDATE ON download_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default presets for existing users
INSERT INTO download_presets (user_id, name, description, quality, format, is_default)
SELECT
  id,
  'Best Quality Video',
  'Download highest quality video (1080p/4K) in MP4 format',
  'best',
  'mp4',
  true
FROM "user"
WHERE NOT EXISTS (
  SELECT 1 FROM download_presets WHERE user_id = "user".id
);

INSERT INTO download_presets (user_id, name, description, quality, format, extract_audio)
SELECT
  id,
  'Audio Only (MP3)',
  'Extract audio only in MP3 format for music/podcasts',
  'audio_only',
  'mp3',
  true
FROM "user";

INSERT INTO download_presets (user_id, name, description, quality, format)
SELECT
  id,
  '720p Standard',
  'Balanced quality and file size at 720p',
  '720p',
  'mp4'
FROM "user";

COMMENT ON TABLE download_presets IS 'User-defined download configuration presets';
COMMENT ON COLUMN download_presets.quality IS 'Video quality preference: best, 2160p, 1440p, 1080p, 720p, 480p, audio_only';
COMMENT ON COLUMN download_presets.format IS 'Output file format: mp4, mkv, webm, mp3, flac, wav, opus';
COMMENT ON COLUMN download_presets.subfolder_pattern IS 'Dynamic subfolder pattern using variables: {category}, {channel}, {year}, {month}';
COMMENT ON COLUMN download_presets.filename_pattern IS 'Dynamic filename pattern using variables: {title}, {channel}, {date}, {id}';
