import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export interface IPlayerProgramme {
  pid: string;
  name: string;
  episode: string;
  description: string;
  channel: string;
  categories: string;
  thumbnail: string;
  available: string;
  duration: string;
  type: 'tv' | 'radio';
}

export interface IPlayerDownloadProgress {
  status: 'searching' | 'downloading' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

export class GetIPlayerService extends EventEmitter {
  private getIPlayerPath: string;
  private downloadDir: string;

  constructor() {
    super();
    this.getIPlayerPath = process.env.GET_IPLAYER_PATH || '/home/beerm/get_iplayer/get_iplayer';
    this.downloadDir = process.env.DOWNLOAD_DIR || '/home/beerm/media-vault/downloads';
  }

  /**
   * Search for programmes on BBC iPlayer
   */
  async search(query: string, options: {
    type?: 'tv' | 'radio' | 'all';
    channel?: string;
    category?: string;
  } = {}): Promise<IPlayerProgramme[]> {
    return new Promise((resolve, reject) => {
      const args = [
        query,
        '--listformat=<pid>|<name>|<episode>|<channel>|<thumbnail>|<desc>|<available>|<type>|<categories>|<duration>'
      ];

      if (options.type && options.type !== 'all') {
        args.push(`--type=${options.type}`);
      }

      if (options.channel) {
        args.push(`--channel=${options.channel}`);
      }

      // Note: --category only works with --history, not for live searches
      // We'll filter by category after getting results

      const process = spawn('perl', [this.getIPlayerPath, ...args]);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0 && !output) {
          reject(new Error(`Search failed: ${errorOutput}`));
          return;
        }

        try {
          let programmes = this.parseSearchResults(output);

          // Filter by category if specified
          if (options.category) {
            const categoryLower = options.category.toLowerCase();
            programmes = programmes.filter(prog =>
              prog.categories.toLowerCase().includes(categoryLower)
            );
          }

          resolve(programmes);
        } catch (err) {
          reject(new Error(`Failed to parse search results: ${err}`));
        }
      });
    });
  }

  /**
   * Parse get_iplayer search results with custom list format
   * Format: pid|name|episode|channel|thumbnail|desc|available|type|categories|duration
   */
  private parseSearchResults(output: string): IPlayerProgramme[] {
    const programmes: IPlayerProgramme[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Skip header lines and empty lines
      if (!line.trim() || line.includes('get_iplayer') || line.includes('Copyright') || line.includes('INFO:')) {
        continue;
      }

      // Parse pipe-delimited format
      const parts = line.split('|');
      if (parts.length >= 8) {
        const [pid, name, episode, channel, thumbnail, description, available, type, categories = '', duration = ''] = parts;

        // Convert ISO date to human-readable expiry
        let availableText = '';
        if (available) {
          try {
            const expiryDate = new Date(available);
            const now = new Date();
            const diffMs = expiryDate.getTime() - now.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            if (diffDays > 0) {
              availableText = `${diffDays} days ${diffHours} hours`;
            } else if (diffHours > 0) {
              availableText = `${diffHours} hours`;
            } else {
              availableText = 'expiring soon';
            }
          } catch {
            availableText = available;
          }
        }

        programmes.push({
          pid: pid.trim(),
          name: name.trim(),
          episode: episode.trim(),
          description: description.trim(),
          channel: channel.trim(),
          categories: categories.trim(),
          thumbnail: thumbnail.trim(),
          available: availableText,
          duration: duration.trim(),
          type: (type.trim() as 'tv' | 'radio') || 'tv'
        });
      }
    }

    return programmes;
  }

  /**
   * Download a programme by PID
   */
  async downloadByPid(
    pid: string,
    options: {
      quality?: 'fhd' | 'hd' | 'sd' | 'web' | 'mobile' | '1080p' | '720p' | '540p' | '396p' | '288p' | 'high' | 'std' | 'med' | 'low' | '320k' | '128k' | '96k' | '48k' | 'default';
      type?: 'tv' | 'radio';
      subtitles?: boolean;
    } = {}
  ): Promise<{ outputPath: string; info: IPlayerProgramme }> {
    // Ensure download directory exists
    const iplayerDir = path.join(this.downloadDir, 'iplayer');
    await fs.mkdir(iplayerDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        '--get',
        '--pid', pid,
        '--output', iplayerDir
      ];

      if (options.quality) {
        args.push(`--quality=${options.quality}`);
      }

      if (options.type) {
        args.push(`--type=${options.type}`);
      }

      if (options.subtitles !== false) {
        args.push('--subtitles');
      }

      const downloadProcess = spawn('perl', [this.getIPlayerPath, ...args]);
      let output = '';
      let errorOutput = '';
      let outputPath = '';

      downloadProcess.stdout.on('data', (data) => {
        const line = data.toString();
        output += line;

        // Look for download progress
        if (line.includes('Downloaded')) {
          const pathMatch = line.match(/Downloaded:\s+(.+)$/);
          if (pathMatch) {
            outputPath = pathMatch[1].trim();
          }
        }

        // Emit progress updates
        const progressMatch = line.match(/(\d+)%/);
        if (progressMatch) {
          const progress: IPlayerDownloadProgress = {
            status: 'downloading',
            progress: parseInt(progressMatch[1]),
            message: line.trim()
          };
          this.emit('progress', progress);
        }
      });

      downloadProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      downloadProcess.on('close', async (code) => {
        if (code !== 0) {
          // Include both stdout and stderr in error for better debugging
          const fullError = errorOutput || output || 'Unknown error';
          console.error('[get_iplayer] Download failed with code:', code);
          console.error('[get_iplayer] stdout:', output);
          console.error('[get_iplayer] stderr:', errorOutput);

          const error: IPlayerDownloadProgress = {
            status: 'failed',
            progress: 0,
            message: 'Download failed',
            error: fullError
          };
          this.emit('progress', error);
          reject(new Error(`Download failed (exit code ${code}): ${fullError}`));
          return;
        }

        // If outputPath wasn't found in output, scan the directory for the newest file
        if (!outputPath) {
          try {
            // Small delay to ensure filesystem has synced (especially on WSL)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const files = await fs.readdir(iplayerDir);

            // Filter for media files only (not .txt metadata files)
            const mediaExtensions = ['.mp4', '.mkv', '.avi', '.m4a', '.mp3', '.ts'];
            const mediaFiles = files.filter(f =>
              mediaExtensions.some(ext => f.toLowerCase().endsWith(ext))
            );

            if (mediaFiles.length === 0) {
              reject(new Error('Download completed but no media files found in output directory'));
              return;
            }

            // Find the most recently modified media file
            let newestFile = mediaFiles[0];
            let newestTime = (await fs.stat(path.join(iplayerDir, mediaFiles[0]))).mtime;

            for (const file of mediaFiles.slice(1)) {
              const filePath = path.join(iplayerDir, file);
              const stats = await fs.stat(filePath);
              if (stats.mtime > newestTime) {
                newestFile = file;
                newestTime = stats.mtime;
              }
            }

            outputPath = path.join(iplayerDir, newestFile);
            console.log('[get_iplayer] Found downloaded file:', outputPath);
          } catch (err) {
            reject(new Error(`Failed to find downloaded file: ${err}`));
            return;
          }
        }

        const completed: IPlayerDownloadProgress = {
          status: 'completed',
          progress: 100,
          message: 'Download completed'
        };
        this.emit('progress', completed);

        // Try to get programme info
        try {
          const results = await this.getProgrammeInfo(pid);
          const info = results[0] || {
            pid,
            name: '',
            episode: '',
            description: '',
            channel: '',
            categories: '',
            thumbnail: '',
            available: '',
            duration: '',
            type: 'tv' as const
          };
          resolve({ outputPath, info });
        } catch (err) {
          // If we can't get info but download succeeded, still resolve
          resolve({
            outputPath,
            info: {
              pid,
              name: '',
              episode: '',
              description: '',
              channel: '',
              categories: '',
              thumbnail: '',
              available: '',
              duration: '',
              type: 'tv'
            }
          });
        }
      });
    });
  }

  /**
   * Get programme information by PID
   */
  async getProgrammeInfo(pid: string): Promise<IPlayerProgramme[]> {
    return new Promise((resolve, reject) => {
      const args = ['--pid', pid, '--info'];

      const process = spawn('perl', [this.getIPlayerPath, ...args]);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0 && !output) {
          reject(new Error(`Failed to get programme info: ${errorOutput}`));
          return;
        }

        try {
          const programmes = this.parseSearchResults(output);
          resolve(programmes);
        } catch (err) {
          reject(new Error(`Failed to parse programme info: ${err}`));
        }
      });
    });
  }

  /**
   * Refresh get_iplayer cache
   */
  async refreshCache(type: 'tv' | 'radio' | 'all' = 'all'): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['--refresh'];

      if (type !== 'all') {
        args.push(`--type=${type}`);
      }

      const process = spawn('perl', [this.getIPlayerPath, ...args]);
      let errorOutput = '';

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Cache refresh failed: ${errorOutput}`));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Check if get_iplayer is installed and accessible
   */
  async checkInstallation(): Promise<{ installed: boolean; version: string }> {
    return new Promise((resolve) => {
      const process = spawn('perl', [this.getIPlayerPath, '--help']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          resolve({ installed: false, version: '' });
          return;
        }

        // Try to extract version
        const versionMatch = output.match(/get_iplayer\s+v?([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        resolve({ installed: true, version });
      });

      process.on('error', () => {
        resolve({ installed: false, version: '' });
      });
    });
  }

  /**
   * Get list of available channels
   */
  getChannels(): string[] {
    return [
      'BBC One',
      'BBC Two',
      'BBC Three',
      'BBC Four',
      'BBC News',
      'BBC Parliament',
      'CBBC',
      'CBeebies',
      'BBC Radio 1',
      'BBC Radio 2',
      'BBC Radio 3',
      'BBC Radio 4',
      'BBC Radio 5 Live',
      'BBC Radio 6 Music',
      'BBC World Service'
    ];
  }
}

// Export singleton instance
export const getIPlayerService = new GetIPlayerService();
