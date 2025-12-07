-- Add quality and format columns to downloads table
-- Migration 008: Support for user-selectable quality and format preferences

-- Add quality column (video resolution or 'audio' for audio-only)
ALTER TABLE downloads
ADD COLUMN IF NOT EXISTS quality TEXT DEFAULT 'best';

-- Add video_format column (mp4, webm, mkv)
ALTER TABLE downloads
ADD COLUMN IF NOT EXISTS video_format TEXT DEFAULT 'mp4';

-- Add audio_format column (mp3, m4a, aac, opus, flac)
ALTER TABLE downloads
ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'mp3';

-- Add comment to explain columns
COMMENT ON COLUMN downloads.quality IS 'Video quality: best, 2160p, 1440p, 1080p, 720p, 480p, 360p, worst, audio';
COMMENT ON COLUMN downloads.video_format IS 'Preferred video container format: mp4, webm, mkv';
COMMENT ON COLUMN downloads.audio_format IS 'Audio format for audio-only downloads: mp3, m4a, aac, opus, flac';
