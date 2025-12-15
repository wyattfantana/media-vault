/**
 * Utility functions to extract platform-specific IDs from URLs
 * Used for duplicate detection in download_history table
 */

/**
 * Extract YouTube video ID from various YouTube URL formats
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, etc.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    // Pattern 1: youtube.com/watch?v=VIDEO_ID
    let match = url.match(/[?&]v=([^&]+)/);
    if (match) return match[1];

    // Pattern 2: youtu.be/VIDEO_ID
    match = url.match(/youtu\.be\/([^?]+)/);
    if (match) return match[1];

    // Pattern 3: youtube.com/embed/VIDEO_ID
    match = url.match(/youtube\.com\/embed\/([^?]+)/);
    if (match) return match[1];

    // Pattern 4: youtube.com/v/VIDEO_ID
    match = url.match(/youtube\.com\/v\/([^?]+)/);
    if (match) return match[1];

    return null;
  } catch (err) {
    console.error('[Platform IDs] Failed to extract YouTube ID:', err);
    return null;
  }
}

/**
 * Extract BBC iPlayer programme ID (PID) from iPlayer URLs
 * Format: https://www.bbc.co.uk/iplayer/episode/b00p4hgm/...
 */
export function extractiPlayerPid(url: string): string | null {
  if (!url) return null;

  try {
    // Pattern: /episode/PID or /live/PID
    const match = url.match(/\/(episode|live)\/([a-z0-9]+)/i);
    if (match) return match[2];

    return null;
  } catch (err) {
    console.error('[Platform IDs] Failed to extract iPlayer PID:', err);
    return null;
  }
}

/**
 * Extract SoundCloud track/user from URL
 * Returns the last segment of the path (track or user slug)
 */
export function extractSoundCloudId(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);

    // Return the last meaningful part (usually track or user name)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }

    return null;
  } catch (err) {
    console.error('[Platform IDs] Failed to extract SoundCloud ID:', err);
    return null;
  }
}

/**
 * Determine source type from downloader name
 */
export function getSourceType(downloader: string, url?: string): string {
  if (downloader === 'qbittorrent') return 'qbittorrent';
  if (downloader === 'get_iplayer') return 'iplayer';
  if (downloader === 'yt-dlp') {
    // Detect platform from URL
    if (url?.includes('youtube.com') || url?.includes('youtu.be')) return 'youtube';
    if (url?.includes('soundcloud.com')) return 'soundcloud';
    if (url?.includes('tiktok.com')) return 'tiktok';
    if (url?.includes('twitch.tv')) return 'twitch';
    if (url?.includes('reddit.com')) return 'reddit';
    if (url?.includes('rumble.com')) return 'rumble';
    if (url?.includes('vimeo.com')) return 'vimeo';
    return 'yt-dlp'; // Generic
  }
  return downloader;
}
