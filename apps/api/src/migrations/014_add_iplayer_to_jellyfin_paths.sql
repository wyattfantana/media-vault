-- Migration 014: Add iPlayer path to jellyfin_library_paths
-- Updates the default jellyfin_library_paths to include /media/iPlayer

-- Update existing records to add iplayer path if not present
UPDATE user_preferences
SET jellyfin_library_paths = jellyfin_library_paths || '{"iplayer": "/media/iPlayer"}'::jsonb
WHERE NOT (jellyfin_library_paths ? 'iplayer');

-- Update the default value for new records (PostgreSQL 12+)
ALTER TABLE user_preferences
ALTER COLUMN jellyfin_library_paths
SET DEFAULT '{"movies": "/media/Movies", "tv": "/media/TV Shows", "music": "/media/Music", "documentaries": "/media/Documentaries", "iplayer": "/media/iPlayer"}'::jsonb;
