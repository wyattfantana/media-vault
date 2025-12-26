-- Migration 009: Create user_preferences table
-- This table stores user-specific settings and preferences

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  -- Download Preferences
  default_quality VARCHAR(50) DEFAULT '1080p',
  default_folder VARCHAR(255) DEFAULT 'Downloads',
  default_video_format VARCHAR(20) DEFAULT 'mp4',
  default_audio_format VARCHAR(20) DEFAULT 'mp3',
  concurrent_downloads INTEGER DEFAULT 3,

  -- Bandwidth Controls (in bytes per second, null = unlimited)
  download_speed_limit BIGINT DEFAULT NULL,
  upload_speed_limit BIGINT DEFAULT NULL,

  -- Jellyfin Integration
  jellyfin_server_url VARCHAR(512) DEFAULT NULL,
  jellyfin_api_key VARCHAR(255) DEFAULT NULL,
  jellyfin_library_paths JSONB DEFAULT '{"movies": "/media/Movies", "tv": "/media/TV Shows", "music": "/media/Music", "documentaries": "/media/Documentaries"}'::jsonb,
  jellyfin_auto_scan BOOLEAN DEFAULT true,

  -- Notification Preferences
  notifications_enabled BOOLEAN DEFAULT true,
  notify_download_complete BOOLEAN DEFAULT true,
  notify_download_failed BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT false,

  -- Storage Management
  storage_limit_gb INTEGER DEFAULT NULL,
  auto_cleanup_enabled BOOLEAN DEFAULT false,
  auto_cleanup_days INTEGER DEFAULT 90,

  -- Behavior Settings
  auto_organize_files BOOLEAN DEFAULT true,
  auto_fetch_thumbnails BOOLEAN DEFAULT true,
  keep_download_history_days INTEGER DEFAULT 365,

  -- Privacy/Advanced
  youtube_cookies_path VARCHAR(512) DEFAULT NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER trigger_update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Insert default preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM "user"
ON CONFLICT (user_id) DO NOTHING;
