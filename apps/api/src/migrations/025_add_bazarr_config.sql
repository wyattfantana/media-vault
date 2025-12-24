-- Migration 025: Add Bazarr configuration to user preferences
-- Adds Bazarr URL and API key for subtitle management

-- Add Bazarr configuration columns
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS bazarr_url VARCHAR(512) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bazarr_api_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bazarr_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bazarr_subtitle_languages JSONB DEFAULT '["en"]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.bazarr_url IS 'Bazarr server URL (e.g., http://localhost:6767)';
COMMENT ON COLUMN user_preferences.bazarr_api_key IS 'API key for Bazarr authentication';
COMMENT ON COLUMN user_preferences.bazarr_enabled IS 'Enable automatic subtitle downloads';
COMMENT ON COLUMN user_preferences.bazarr_subtitle_languages IS 'Preferred subtitle languages as JSON array';
