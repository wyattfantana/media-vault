-- Add Jellyfin formatting columns to downloads table
-- This migration adds support for auto-formatting file names and paths for Jellyfin compatibility

ALTER TABLE downloads ADD COLUMN IF NOT EXISTS formatted_path TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS jellyfin_format JSONB;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS custom_folder TEXT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS organize_by_uploader BOOLEAN DEFAULT FALSE;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_downloads_category ON downloads(category);

-- Add comment to describe the columns
COMMENT ON COLUMN downloads.formatted_path IS 'Jellyfin-compatible formatted file path (e.g., "TV Shows/Breaking Bad (2008)/Season 01/Breaking Bad - S01E01 - Pilot.mkv")';
COMMENT ON COLUMN downloads.jellyfin_format IS 'Full formatting metadata from jellyfin-formatter service';
COMMENT ON COLUMN downloads.category IS 'Download category (movies, tv, music, documentaries, custom)';
COMMENT ON COLUMN downloads.custom_folder IS 'Custom folder name for organization';
COMMENT ON COLUMN downloads.organize_by_uploader IS 'Whether to organize files by uploader name';
