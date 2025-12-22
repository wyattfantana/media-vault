-- Migration 023: Add *arr services configuration (Radarr, Sonarr, Prowlarr)
-- Enables automation for movies and TV shows with the *arr stack

-- Add *arr service API keys and configuration
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS radarr_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS radarr_host VARCHAR(255) DEFAULT 'localhost',
ADD COLUMN IF NOT EXISTS radarr_port INTEGER DEFAULT 7878,
ADD COLUMN IF NOT EXISTS radarr_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS radarr_url_base VARCHAR(255) DEFAULT '',

ADD COLUMN IF NOT EXISTS sonarr_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sonarr_host VARCHAR(255) DEFAULT 'localhost',
ADD COLUMN IF NOT EXISTS sonarr_port INTEGER DEFAULT 8989,
ADD COLUMN IF NOT EXISTS sonarr_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sonarr_url_base VARCHAR(255) DEFAULT '',

ADD COLUMN IF NOT EXISTS prowlarr_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prowlarr_host VARCHAR(255) DEFAULT 'localhost',
ADD COLUMN IF NOT EXISTS prowlarr_port INTEGER DEFAULT 9696,
ADD COLUMN IF NOT EXISTS prowlarr_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prowlarr_url_base VARCHAR(255) DEFAULT '';

-- Add comments for clarity
COMMENT ON COLUMN user_preferences.radarr_enabled IS 'Enable Radarr integration for automated movie downloads';
COMMENT ON COLUMN user_preferences.radarr_host IS 'Radarr server hostname or IP address';
COMMENT ON COLUMN user_preferences.radarr_port IS 'Radarr server port (default: 7878)';
COMMENT ON COLUMN user_preferences.radarr_api_key IS 'Radarr API key (found in Settings > General)';
COMMENT ON COLUMN user_preferences.radarr_url_base IS 'Radarr URL base (if using reverse proxy)';

COMMENT ON COLUMN user_preferences.sonarr_enabled IS 'Enable Sonarr integration for automated TV series downloads';
COMMENT ON COLUMN user_preferences.sonarr_host IS 'Sonarr server hostname or IP address';
COMMENT ON COLUMN user_preferences.sonarr_port IS 'Sonarr server port (default: 8989)';
COMMENT ON COLUMN user_preferences.sonarr_api_key IS 'Sonarr API key (found in Settings > General)';
COMMENT ON COLUMN user_preferences.sonarr_url_base IS 'Sonarr URL base (if using reverse proxy)';

COMMENT ON COLUMN user_preferences.prowlarr_enabled IS 'Enable Prowlarr integration for indexer management';
COMMENT ON COLUMN user_preferences.prowlarr_host IS 'Prowlarr server hostname or IP address';
COMMENT ON COLUMN user_preferences.prowlarr_port IS 'Prowlarr server port (default: 9696)';
COMMENT ON COLUMN user_preferences.prowlarr_api_key IS 'Prowlarr API key (found in Settings > General)';
COMMENT ON COLUMN user_preferences.prowlarr_url_base IS 'Prowlarr URL base (if using reverse proxy)';

-- Create a table for tracking *arr automation status
CREATE TABLE IF NOT EXISTS arr_automation (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL, -- 'radarr' or 'sonarr'
  tmdb_id INTEGER NOT NULL,
  media_type VARCHAR(20) NOT NULL, -- 'movie' or 'tv'
  service_id INTEGER, -- ID in Radarr/Sonarr
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'added', 'downloading', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, service_type, tmdb_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_arr_automation_user_id ON arr_automation(user_id);
CREATE INDEX IF NOT EXISTS idx_arr_automation_tmdb_id ON arr_automation(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_arr_automation_status ON arr_automation(status);

-- Add comments
COMMENT ON TABLE arr_automation IS 'Tracks automation status for movies and TV shows added to Radarr/Sonarr';
COMMENT ON COLUMN arr_automation.service_type IS 'Which *arr service (radarr or sonarr)';
COMMENT ON COLUMN arr_automation.tmdb_id IS 'TMDB ID of the media';
COMMENT ON COLUMN arr_automation.media_type IS 'Type of media (movie or tv)';
COMMENT ON COLUMN arr_automation.service_id IS 'ID in the *arr service';
COMMENT ON COLUMN arr_automation.status IS 'Current automation status';
