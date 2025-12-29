import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  uploadDate: string;
  viewCount: number;
  likeCount: number;
  formats: Array<{
    format_id: string;
    ext: string;
    resolution: string;
    filesize: number;
  }>;
  url: string;
}

export interface DownloadProgress {
  status: 'downloading' | 'completed' | 'failed';
  progress: number;
  speed: string;
  eta: string;
  totalSize: string;
  downloadedSize: string;
  error?: string;
}

export class YtDlpService extends EventEmitter {
  private ytdlpPath: string;
  private downloadDir: string;

  constructor() {
    super();
    this.ytdlpPath = process.env.YTDLP_PATH || '/home/beerm/bin/yt-dlp';
    this.downloadDir = process.env.DOWNLOAD_DIR || '/home/beerm/media-vault/downloads';
  }

  /**
   * Get video information without downloading
   */
  async getVideoInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-playlist',
        url
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get video info: ${errorOutput}`));
          return;
        }

        try {
          const info = JSON.parse(output);
          resolve({
            id: info.id,
            title: info.title,
            description: info.description || '',
            thumbnail: info.thumbnail || '',
            duration: info.duration || 0,
            uploader: info.uploader || '',
            uploadDate: info.upload_date || '',
            viewCount: info.view_count || 0,
            likeCount: info.like_count || 0,
            formats: (info.formats || []).map((f: any) => ({
              format_id: f.format_id,
              ext: f.ext,
              resolution: f.resolution || 'unknown',
              filesize: f.filesize || 0
            })),
            url
          });
        } catch (err) {
          reject(new Error(`Failed to parse video info: ${err}`));
        }
      });
    });
  }

  /**
   * Download a video with progress tracking
   */
  async downloadVideo(
    url: string,
    options: {
      format?: string;
      outputTemplate?: string;
      quality?: 'best' | '2160p' | '1440p' | '1080p' | '720p' | '480p' | '360p' | 'worst' | 'audio';
      audioFormat?: 'mp3' | 'm4a' | 'aac' | 'opus' | 'flac';
      videoFormat?: 'mp4' | 'webm' | 'mkv';
    } = {}
  ): Promise<{ outputPath: string; info: VideoInfo }> {
    // If audio-only is requested, use downloadAudio instead
    if (options.quality === 'audio') {
      return this.downloadAudio(url, {
        format: options.audioFormat || 'mp3',
        quality: 'best'
      });
    }

    // Ensure download directory exists
    await fs.mkdir(this.downloadDir, { recursive: true });

    const outputTemplate = options.outputTemplate ||
      path.join(this.downloadDir, '%(title)s-%(id)s.%(ext)s');

    // Build format string based on quality and format preference
    let formatString = options.format;
    const preferredFormat = options.videoFormat || 'mp4';

    if (!formatString && options.quality) {
      switch (options.quality) {
        case 'best':
          formatString = `bestvideo[ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=${preferredFormat}]/best`;
          break;
        case '2160p':
          formatString = `bestvideo[height<=2160][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160][ext=${preferredFormat}]/best`;
          break;
        case '1440p':
          formatString = `bestvideo[height<=1440][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440][ext=${preferredFormat}]/best`;
          break;
        case '1080p':
          formatString = `bestvideo[height<=1080][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080][ext=${preferredFormat}]/best`;
          break;
        case '720p':
          formatString = `bestvideo[height<=720][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=${preferredFormat}]/best`;
          break;
        case '480p':
          formatString = `bestvideo[height<=480][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480][ext=${preferredFormat}]/best`;
          break;
        case '360p':
          formatString = `bestvideo[height<=360][ext=${preferredFormat}]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360][ext=${preferredFormat}]/best`;
          break;
        case 'worst':
          formatString = 'worst';
          break;
      }
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--newline',
        '--no-playlist',
        '-o', outputTemplate,
        '--print', 'after_move:filepath',
        '--embed-metadata',
        '--embed-thumbnail',
        '--embed-subs',
        '--sub-langs', 'en.*,en',
        '--merge-output-format', 'mp4'
      ];

      if (formatString) {
        args.push('-f', formatString);
      }

      args.push(url);

      const downloadProcess = spawn(this.ytdlpPath, args);
      let outputPath = '';
      let progressData: DownloadProgress = {
        status: 'downloading',
        progress: 0,
        speed: '',
        eta: '',
        totalSize: '',
        downloadedSize: ''
      };

      downloadProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();

        // Check if this is the output path
        if (line.startsWith('/')) {
          outputPath = line;
        }

        // Parse progress line
        // Example: [download]  45.5% of 123.45MiB at 1.23MiB/s ETA 00:45
        const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/);
        if (progressMatch) {
          progressData = {
            status: 'downloading',
            progress: parseFloat(progressMatch[1]),
            totalSize: progressMatch[2],
            speed: progressMatch[3],
            eta: progressMatch[4],
            downloadedSize: ''
          };
          this.emit('progress', progressData);
        }
      });

      downloadProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('yt-dlp error:', error);
      });

      downloadProcess.on('close', async (code) => {
        if (code !== 0) {
          progressData.status = 'failed';
          progressData.error = 'Download failed';
          this.emit('progress', progressData);
          reject(new Error('Download failed'));
          return;
        }

        progressData.status = 'completed';
        progressData.progress = 100;
        this.emit('progress', progressData);

        try {
          const info = await this.getVideoInfo(url);
          resolve({ outputPath, info });
        } catch (err) {
          // If we can't get info but download succeeded, still resolve
          resolve({
            outputPath,
            info: {
              id: '',
              title: '',
              description: '',
              thumbnail: '',
              duration: 0,
              uploader: '',
              uploadDate: '',
              viewCount: 0,
              likeCount: 0,
              formats: [],
              url
            }
          });
        }
      });
    });
  }

  /**
   * Get list of supported sites
   */
  async getSupportedSites(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.ytdlpPath, ['--list-extractors']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to get supported sites'));
          return;
        }
        const sites = output.split('\n').filter(line => line.trim().length > 0);
        resolve(sites);
      });
    });
  }

  /**
   * Generic search for any platform supported by yt-dlp
   * Platforms: youtube, vimeo, dailymotion, etc.
   */
  async searchPlatform(platform: string, query: string, limit: number = 20): Promise<VideoInfo[]> {
    return new Promise((resolve, reject) => {
      // Platform-specific search prefixes
      const searchPrefix = `${platform}search${limit}:${query}`;

      const args = [
        '--dump-json',
        '--flat-playlist',
        searchPrefix
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`${platform} search failed: ${errorOutput}`));
          return;
        }

        try {
          const results: VideoInfo[] = [];
          const lines = output.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);
              results.push({
                id: info.id || '',
                title: info.title || '',
                description: info.description || '',
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
                duration: info.duration || 0,
                uploader: info.uploader || info.channel || '',
                uploadDate: info.upload_date || '',
                viewCount: info.view_count || 0,
                likeCount: info.like_count || 0,
                formats: [],
                url: info.webpage_url || info.url || ''
              });
            } catch (err) {
              console.error('Failed to parse search result:', err);
            }
          }

          resolve(results);
        } catch (err) {
          reject(new Error(`Failed to parse search results: ${err}`));
        }
      });
    });
  }

  /**
   * Search YouTube for videos
   */
  async searchYouTube(query: string, limit: number = 20): Promise<VideoInfo[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        `ytsearch${limit}:${query}`
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`YouTube search failed: ${errorOutput}`));
          return;
        }

        try {
          const results: VideoInfo[] = [];
          const lines = output.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);
              results.push({
                id: info.id || '',
                title: info.title || '',
                description: info.description || '',
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
                duration: info.duration || 0,
                uploader: info.uploader || info.channel || '',
                uploadDate: info.upload_date || '',
                viewCount: info.view_count || 0,
                likeCount: info.like_count || 0,
                formats: [],
                url: info.url || `https://www.youtube.com/watch?v=${info.id}`
              });
            } catch (err) {
              console.error('Failed to parse search result:', err);
            }
          }

          resolve(results);
        } catch (err) {
          reject(new Error(`Failed to parse search results: ${err}`));
        }
      });
    });
  }

  /**
   * Get YouTube channel information
   */
  async getChannelInfo(channelUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--playlist-end', '1', // Get just the first video to extract channel metadata
        channelUrl
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get channel info: ${errorOutput}`));
          return;
        }

        try {
          const info = JSON.parse(output);
          const channelId = info.channel_id || info.id;

          // Construct YouTube channel avatar URL using channel ID
          const channelThumbnail = channelId
            ? `https://yt3.googleusercontent.com/ytc/${channelId}`
            : '';

          resolve({
            id: channelId,
            name: info.channel || info.uploader || info.title,
            description: '', // Channel description not available from video metadata
            thumbnail: channelThumbnail,
            subscriberCount: info.channel_follower_count || info.subscriber_count || 0,
            videoCount: 0, // Will be fetched separately
            url: channelUrl
          });
        } catch (err) {
          reject(new Error(`Failed to parse channel info: ${err}`));
        }
      });
    });
  }

  /**
   * Get YouTube channel video count (separate call for performance)
   */
  async getChannelVideoCount(channelUrl: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const countArgs = [
        '--flat-playlist',
        '--print', 'id',
        channelUrl
      ];

      const countProcess = spawn(this.ytdlpPath, countArgs);
      let countOutput = '';

      countProcess.stdout.on('data', (data) => {
        countOutput += data.toString();
      });

      countProcess.stderr.on('data', () => {
        // Ignore errors, just return 0
      });

      countProcess.on('close', (countCode) => {
        const videoCount = countCode === 0
          ? countOutput.trim().split('\n').filter(line => line.length > 0).length
          : 0;
        resolve(videoCount);
      });
    });
  }

  /**
   * Get SoundCloud user track count (separate call for performance)
   * Uses flat-playlist with get-id for fast counting
   */
  async getSoundCloudUserTrackCount(userUrl: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const countArgs = [
        '--flat-playlist',
        '--get-id',
        '--quiet',
        '--no-warnings',
        '--skip-download',
        '--playlist-end', '9999',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Referer:https://soundcloud.com/',
        '--add-header', 'Origin:https://soundcloud.com',
        '--add-header', 'Accept:*/*',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--extractor-retries', '5',
        '--no-check-certificate',
        userUrl
      ];

      console.log(`[SoundCloud Track Count] Fetching track IDs for: ${userUrl}`);
      const countProcess = spawn(this.ytdlpPath, countArgs);
      let countOutput = '';
      let errorOutput = '';

      countProcess.stdout.on('data', (data) => {
        countOutput += data.toString();
      });

      countProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      countProcess.on('close', (countCode) => {
        if (countCode !== 0) {
          console.error(`[SoundCloud Track Count] Error for ${userUrl}:`, errorOutput);
          resolve(0);
          return;
        }

        // Count track IDs (one per line)
        const trackIds = countOutput.trim().split('\n').filter(line => line.length > 0);
        const trackCount = trackIds.length;

        console.log(`[SoundCloud Track Count] User: ${userUrl}, Count: ${trackCount} tracks`);
        resolve(trackCount);
      });
    });
  }

  /**
   * Get YouTube playlist information
   */
  async getPlaylistInfo(playlistUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--playlist-end', '1', // Get just the first video to extract playlist metadata
        playlistUrl
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get playlist info: ${errorOutput}`));
          return;
        }

        try {
          const info = JSON.parse(output);

          resolve({
            id: info.playlist_id || info.id,
            name: info.playlist_title || info.playlist || info.title,
            channelName: info.playlist_uploader || info.channel || info.uploader,
            description: '', // Playlist description not available from video metadata
            thumbnail: '', // No playlist thumbnail available
            subscriberCount: info.channel_follower_count || 0,
            videoCount: info.playlist_count || 0,
            url: playlistUrl
          });
        } catch (err) {
          reject(new Error(`Failed to parse playlist info: ${err}`));
        }
      });
    });
  }

  /**
   * Get videos from a YouTube channel
   */
  async getChannelVideos(channelUrl: string, limit: number = 50, offset: number = 0): Promise<VideoInfo[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--playlist-start', (offset + 1).toString(), // yt-dlp is 1-indexed
        '--playlist-end', (offset + limit).toString(),
        channelUrl
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get channel videos: ${errorOutput}`));
          return;
        }

        try {
          const results: VideoInfo[] = [];
          const lines = output.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);
              results.push({
                id: info.id || '',
                title: info.title || '',
                description: info.description || '',
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
                duration: info.duration || 0,
                uploader: info.uploader || info.channel || '',
                uploadDate: info.upload_date || '',
                viewCount: info.view_count || 0,
                likeCount: info.like_count || 0,
                formats: [],
                url: info.url || `https://www.youtube.com/watch?v=${info.id}`
              });
            } catch (err) {
              console.error('Failed to parse video info:', err);
            }
          }

          resolve(results);
        } catch (err) {
          reject(new Error(`Failed to parse channel videos: ${err}`));
        }
      });
    });
  }

  /**
   * Get playlist information and videos
   */
  async getPlaylistVideos(playlistUrl: string, limit: number = 100, offset: number = 0): Promise<VideoInfo[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--playlist-start', (offset + 1).toString(), // yt-dlp is 1-indexed
        '--playlist-end', (offset + limit).toString(),
        playlistUrl
      ];

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get playlist videos: ${errorOutput}`));
          return;
        }

        try {
          const results: VideoInfo[] = [];
          const lines = output.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);
              results.push({
                id: info.id || '',
                title: info.title || '',
                description: info.description || '',
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
                duration: info.duration || 0,
                uploader: info.uploader || info.channel || '',
                uploadDate: info.upload_date || '',
                viewCount: info.view_count || 0,
                likeCount: info.like_count || 0,
                formats: [],
                url: info.url || `https://www.youtube.com/watch?v=${info.id}`
              });
            } catch (err) {
              console.error('Failed to parse video info:', err);
            }
          }

          resolve(results);
        } catch (err) {
          reject(new Error(`Failed to parse playlist videos: ${err}`));
        }
      });
    });
  }

  /**
   * Check if yt-dlp is installed and accessible
   */
  async checkInstallation(): Promise<{ installed: boolean; version: string }> {
    return new Promise((resolve) => {
      const process = spawn(this.ytdlpPath, ['--version']);
      let version = '';

      process.stdout.on('data', (data) => {
        version += data.toString().trim();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          resolve({ installed: false, version: '' });
          return;
        }
        resolve({ installed: true, version });
      });

      process.on('error', () => {
        resolve({ installed: false, version: '' });
      });
    });
  }

  /**
   * Extract audio only from a video
   */
  async downloadAudio(
    url: string,
    options: {
      format?: 'mp3' | 'aac' | 'm4a' | 'opus' | 'flac';
      quality?: 'best' | 'worst';
      outputTemplate?: string;
    } = {}
  ): Promise<{ outputPath: string; info: VideoInfo }> {
    // Ensure download directory exists
    await fs.mkdir(this.downloadDir, { recursive: true });

    const outputTemplate = options.outputTemplate || path.join(
      this.downloadDir,
      '%(title)s-%(id)s.%(ext)s'
    );

    return new Promise((resolve, reject) => {
      const args = [
        '--newline',
        '--no-playlist',
        '-x',
        '--audio-format', options.format || 'mp3',
        '--audio-quality', options.quality === 'worst' ? '9' : '0',
        '-o', outputTemplate,
        '--print', 'after_move:filepath',
        '--embed-metadata',
        '--embed-thumbnail',
        url
      ];

      const downloadProcess = spawn(this.ytdlpPath, args);
      let outputPath = '';

      downloadProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line.startsWith('/')) {
          outputPath = line;
        }
      });

      downloadProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error('Audio download failed'));
          return;
        }

        try {
          const info = await this.getVideoInfo(url);
          resolve({ outputPath, info });
        } catch (err) {
          resolve({
            outputPath,
            info: {
              id: '',
              title: '',
              description: '',
              thumbnail: '',
              duration: 0,
              uploader: '',
              uploadDate: '',
              viewCount: 0,
              likeCount: 0,
              formats: [],
              url
            }
          });
        }
      });
    });
  }

  /**
   * Extract videos from any URL (works with all yt-dlp supported platforms)
   * Supports: TikTok, Instagram, Reddit, Rumble, Twitch, Vimeo, Dailymotion, etc.
   */
  async extractFromUrl(url: string, limit: number = 100, offset: number = 0): Promise<VideoInfo[]> {
    return new Promise(async (resolve, reject) => {
      // For SoundCloud, use hybrid approach: flat-playlist + single full fetch for metadata
      const isSoundCloud = url.includes('soundcloud.com');
      const isRumble = url.includes('rumble.com');
      let soundCloudMetadata: any = null;

      // If SoundCloud, fetch ONE track with full metadata for artist info
      if (isSoundCloud) {
        try {
          const metaArgs = ['--dump-json', '--playlist-end', '1', url];
          const metaProcess = spawn(this.ytdlpPath, metaArgs);
          let metaOutput = '';

          metaProcess.stdout.on('data', (data) => { metaOutput += data.toString(); });
          metaProcess.stderr.on('data', () => {}); // Ignore errors

          await new Promise<void>((res) => {
            metaProcess.on('close', () => {
              try {
                soundCloudMetadata = JSON.parse(metaOutput);
              } catch {}
              res();
            });
          });
        } catch {}
      }

      const args = [
        '--dump-json',
        '--flat-playlist',
        '--playlist-start', (offset + 1).toString(), // yt-dlp is 1-indexed
        '--playlist-end', (offset + limit).toString()
      ];

      // Add platform-specific options
      if (isRumble) {
        // Rumble requires browser-like headers to avoid 403
        args.push(
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--add-header', 'Referer: https://rumble.com/',
          '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          '--add-header', 'Accept-Language: en-US,en;q=0.5',
          '--add-header', 'DNT: 1',
          '--add-header', 'Connection: keep-alive',
          '--add-header', 'Upgrade-Insecure-Requests: 1'
        );
      }

      args.push(url);

      const process = spawn(this.ytdlpPath, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`URL extraction failed: ${errorOutput}`));
          return;
        }

        try {
          const results: VideoInfo[] = [];
          const lines = output.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const info = JSON.parse(line);

              // For SoundCloud flat-playlist results, use metadata from first track
              const thumbnail = info.thumbnail || info.thumbnails?.[0]?.url ||
                               (soundCloudMetadata?.thumbnail) || '';
              const uploader = info.uploader || info.channel || info.uploader_id ||
                              (soundCloudMetadata?.uploader) || '';

              results.push({
                id: info.id || '',
                title: info.title || '',
                description: info.description || '',
                thumbnail,
                duration: info.duration || 0,
                uploader,
                uploadDate: info.upload_date || '',
                viewCount: info.view_count || 0,
                likeCount: info.like_count || 0,
                formats: [],
                url: info.url || info.webpage_url || url
              });
            } catch (err) {
              console.error('Failed to parse video entry:', err);
            }
          }

          resolve(results);
        } catch (err) {
          reject(new Error(`Failed to parse results: ${err}`));
        }
      });
    });
  }
}

// Export singleton instance
export const ytdlpService = new YtDlpService();
