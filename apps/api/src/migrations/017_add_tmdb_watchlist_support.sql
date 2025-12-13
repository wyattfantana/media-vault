-- Migration: Add TMDB Watchlist Support to Bookmarks Table
-- Purpose: Extend bookmarks table to support movies, TV shows, and documentaries from TMDB
-- Date: 2025-12-13

-- Extend bookmarks table type constraint to include TMDB content types
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_type_check;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_type_check
  CHECK (type IN (
    'youtube_channel',
    'youtube_playlist',
    'soundcloud_user',
    'tmdb_movie',
    'tmdb_tv',
    'tmdb_documentary',
    'other'
  ));

-- Add TMDB-specific fields
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS tmdb_id INTEGER,
  ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('movie', 'tv', 'documentary')),
  ADD COLUMN IF NOT EXISTS release_year INTEGER,
  ADD COLUMN IF NOT EXISTS vote_average DECIMAL(3,1),
  ADD COLUMN IF NOT EXISTS backdrop_url TEXT;

-- Create indexes for TMDB lookups (partial indexes for efficiency)
CREATE INDEX IF NOT EXISTS idx_bookmarks_tmdb_id
  ON bookmarks(tmdb_id)
  WHERE tmdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_media_type
  ON bookmarks(media_type)
  WHERE media_type IS NOT NULL;

-- Update unique constraints
-- Allow URL to be null for TMDB items (which use tmdb_id instead)
ALTER TABLE bookmarks ALTER COLUMN url DROP NOT NULL;
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_url_key;

-- Unique constraint for URL-based bookmarks (YouTube, SoundCloud, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_url
  ON bookmarks(user_id, url)
  WHERE tmdb_id IS NULL;

-- Unique constraint for TMDB bookmarks (prevent duplicate favorites)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_tmdb
  ON bookmarks(user_id, tmdb_id, media_type)
  WHERE tmdb_id IS NOT NULL;
