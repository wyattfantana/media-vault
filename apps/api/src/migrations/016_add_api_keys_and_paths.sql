-- Migration 016: Add API keys and tool paths to user preferences
-- Makes the app user-friendly by moving config from env vars to settings UI

-- Add API Keys
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS tmdb_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS omdb_api_key VARCHAR(255) DEFAULT NULL;

-- Add Tool Paths
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS download_directory VARCHAR(512) DEFAULT '/home/beerm/media-vault/downloads',
ADD COLUMN IF NOT EXISTS ytdlp_path VARCHAR(512) DEFAULT '/home/beerm/bin/yt-dlp',
ADD COLUMN IF NOT EXISTS get_iplayer_path VARCHAR(512) DEFAULT '/home/beerm/bin/get_iplayer';

-- Add comments for clarity
COMMENT ON COLUMN user_preferences.tmdb_api_key IS 'TMDB API key for movie/TV metadata and thumbnails (get from themoviedb.org)';
COMMENT ON COLUMN user_preferences.omdb_api_key IS 'OMDB API key for alternative metadata (optional, get from omdbapi.com)';
COMMENT ON COLUMN user_preferences.download_directory IS 'Base directory where downloads are saved';
COMMENT ON COLUMN user_preferences.ytdlp_path IS 'Full path to yt-dlp executable';
COMMENT ON COLUMN user_preferences.get_iplayer_path IS 'Full path to get_iplayer executable';
