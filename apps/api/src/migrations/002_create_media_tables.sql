-- Media management database schema
-- This creates tables for managing downloads and media files

-- Downloads table - tracks all download jobs
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  thumbnail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  file_size BIGINT,
  output_path TEXT,
  downloader TEXT NOT NULL CHECK (downloader IN ('yt-dlp', 'get_iplayer', 'streamlink')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITHOUT TIME ZONE,
  completed_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Media table - tracks downloaded media files
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  download_id TEXT REFERENCES downloads(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT,
  duration INTEGER, -- in seconds
  format TEXT,
  resolution TEXT,
  thumbnail TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio', 'podcast', 'tv_show', 'movie')),
  source TEXT, -- original URL or source
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Download queue table - manages download queue order
CREATE TABLE IF NOT EXISTS download_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  download_id TEXT NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_queue_position ON download_queue(position);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_downloads_updated_at BEFORE UPDATE ON downloads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
