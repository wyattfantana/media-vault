-- Migration: Add platform field to download_presets
-- Description: Allow presets to be platform-specific (YouTube, SoundCloud, etc.) or global (NULL)

-- Add platform column (nullable for global presets)
ALTER TABLE download_presets
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add check constraint for valid platforms
ALTER TABLE download_presets
ADD CONSTRAINT check_platform_values
CHECK (platform IS NULL OR platform IN (
  'youtube',
  'soundcloud',
  'bbc_iplayer',
  'tiktok',
  'reddit',
  'rumble',
  'twitch',
  'vimeo',
  'twitter',
  'instagram',
  'facebook',
  'dailymotion',
  'other'
));

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_presets_platform ON download_presets(user_id, platform);

-- Update existing presets to be global (NULL platform)
-- This allows them to be used for any platform
COMMENT ON COLUMN download_presets.platform IS 'Platform this preset is optimized for. NULL means global/all platforms';

-- Example platform-specific presets for existing users
-- SoundCloud: Audio Only
INSERT INTO download_presets (user_id, name, description, quality, format, extract_audio, platform)
SELECT
  id,
  'SoundCloud - Audio Only',
  'Optimized for SoundCloud tracks - high quality MP3',
  'best',
  'mp3',
  true,
  'soundcloud'
FROM "user"
WHERE NOT EXISTS (
  SELECT 1 FROM download_presets
  WHERE user_id = "user".id AND platform = 'soundcloud' AND name = 'SoundCloud - Audio Only'
);

-- YouTube: Best Quality Video
INSERT INTO download_presets (user_id, name, description, quality, format, platform)
SELECT
  id,
  'YouTube - Best Quality',
  'Optimized for YouTube - best quality MP4',
  'best',
  'mp4',
  'youtube'
FROM "user"
WHERE NOT EXISTS (
  SELECT 1 FROM download_presets
  WHERE user_id = "user".id AND platform = 'youtube' AND name = 'YouTube - Best Quality'
);

-- BBC iPlayer: 720p Standard
INSERT INTO download_presets (user_id, name, description, quality, format, platform)
SELECT
  id,
  'BBC iPlayer - 720p',
  'Optimized for BBC iPlayer - 720p MP4',
  '720p',
  'mp4',
  'bbc_iplayer'
FROM "user"
WHERE NOT EXISTS (
  SELECT 1 FROM download_presets
  WHERE user_id = "user".id AND platform = 'bbc_iplayer' AND name = 'BBC iPlayer - 720p'
);
