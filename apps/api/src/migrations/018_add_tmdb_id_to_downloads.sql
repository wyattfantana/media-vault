-- Migration: Add TMDB ID to Downloads Table
-- Purpose: Store TMDB ID with downloads to enable matching with watchlist items
-- Date: 2025-12-13

-- Add TMDB-specific fields to downloads table
ALTER TABLE downloads
  ADD COLUMN IF NOT EXISTS tmdb_id INTEGER,
  ADD COLUMN IF NOT EXISTS tmdb_media_type TEXT CHECK (tmdb_media_type IN ('movie', 'tv', 'documentary'));

-- Create composite index for efficient TMDB ID lookups
-- This enables fast matching of downloads to favorited items
CREATE INDEX IF NOT EXISTS idx_downloads_tmdb_id
  ON downloads(tmdb_id, user_id)
  WHERE tmdb_id IS NOT NULL;
