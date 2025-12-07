-- Add qBittorrent as a valid downloader type
-- This migration fixes the database constraint to support torrent downloads via qBittorrent

-- Drop the existing constraint
ALTER TABLE downloads DROP CONSTRAINT IF EXISTS downloads_downloader_check;

-- Add the new constraint with qBittorrent included
ALTER TABLE downloads ADD CONSTRAINT downloads_downloader_check
  CHECK (downloader IN ('yt-dlp', 'get_iplayer', 'streamlink', 'qbittorrent'));

-- Add comment to document the change
COMMENT ON COLUMN downloads.downloader IS 'Download service used: yt-dlp (YouTube/social media), get_iplayer (BBC iPlayer), streamlink (live streams), qbittorrent (torrents)';
