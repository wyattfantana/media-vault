-- Migration 022: Create download_history table for permanent download tracking
-- This table is never cleared and is used to detect duplicate downloads across all platforms

CREATE TABLE IF NOT EXISTS download_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,

  -- Source identification
  source_type TEXT NOT NULL,  -- 'youtube', 'iplayer', 'qbittorrent', 'yt-dlp', 'soundcloud', etc.
  source_url TEXT,            -- Original URL/magnet link

  -- Content identification (platform-specific IDs for duplicate detection)
  title TEXT NOT NULL,
  tmdb_id INTEGER,            -- For movies/TV shows from TMDB
  tmdb_media_type TEXT,       -- 'movie', 'tv', 'documentary'
  youtube_video_id TEXT,      -- For YouTube videos (extracted from URL)
  iplayer_pid TEXT,           -- For BBC iPlayer programmes (e.g., 'b00p4hgm')

  -- File information
  file_path TEXT NOT NULL,
  file_size BIGINT,
  category TEXT,              -- Movies, TV Shows, Music, Documentaries, etc.

  -- Metadata
  downloaded_at TIMESTAMP DEFAULT NOW(),
  media_id TEXT,              -- References media(id) but no FK constraint

  created_at TIMESTAMP DEFAULT NOW()
);

-- Prevent duplicate URLs per user (but allow NULL urls for non-URL downloads)
CREATE UNIQUE INDEX idx_download_history_unique_url ON download_history(user_id, source_url)
  WHERE source_url IS NOT NULL;

-- Indexes for fast duplicate detection by user
CREATE INDEX idx_download_history_user_id ON download_history(user_id);

-- Indexes for platform-specific duplicate detection
CREATE INDEX idx_download_history_tmdb ON download_history(tmdb_id, user_id)
  WHERE tmdb_id IS NOT NULL;

CREATE INDEX idx_download_history_youtube ON download_history(youtube_video_id, user_id)
  WHERE youtube_video_id IS NOT NULL;

CREATE INDEX idx_download_history_iplayer ON download_history(iplayer_pid, user_id)
  WHERE iplayer_pid IS NOT NULL;

-- Index for recent downloads lookup
CREATE INDEX idx_download_history_downloaded_at ON download_history(user_id, downloaded_at DESC);

-- Index for category filtering
CREATE INDEX idx_download_history_category ON download_history(user_id, category)
  WHERE category IS NOT NULL;
