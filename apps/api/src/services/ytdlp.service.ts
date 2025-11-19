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
      quality?: 'best' | 'worst' | '720p' | '1080p';
    } = {}
  ): Promise<{ outputPath: string; info: VideoInfo }> {
    // Ensure download directory exists
    await fs.mkdir(this.downloadDir, { recursive: true });

    const outputTemplate = options.outputTemplate ||
      path.join(this.downloadDir, '%(title)s-%(id)s.%(ext)s');

    // Build format string based on quality
    let formatString = options.format;
    if (!formatString && options.quality) {
      switch (options.quality) {
        case 'best':
          formatString = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
          break;
        case '1080p':
          formatString = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best';
          break;
        case '720p':
          formatString = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best';
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
      format?: 'mp3' | 'aac' | 'm4a' | 'opus';
      quality?: 'best' | 'worst';
    } = {}
  ): Promise<{ outputPath: string; info: VideoInfo }> {
    const outputTemplate = path.join(
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
}

// Export singleton instance
export const ytdlpService = new YtDlpService();
