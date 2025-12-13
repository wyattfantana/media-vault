-- Migration: Add TMDB ID to Media Table
-- Purpose: Store TMDB ID in media records to enable matching with watchlist items
-- Date: 2025-12-13

-- Add TMDB-specific fields to media table
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS tmdb_id INTEGER,
  ADD COLUMN IF NOT EXISTS tmdb_media_type TEXT CHECK (tmdb_media_type IN ('movie', 'tv', 'documentary'));

-- Create composite index for efficient TMDB ID lookups
-- This enables fast checking if a favorited item is already downloaded
CREATE INDEX IF NOT EXISTS idx_media_tmdb_id
  ON media(tmdb_id, user_id)
  WHERE tmdb_id IS NOT NULL;
