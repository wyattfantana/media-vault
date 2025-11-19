import fs from 'fs/promises';
import path from 'path';
import { VideoInfo } from './ytdlp.service';

export interface OrganizedFile {
  originalPath: string;
  newPath: string;
  category: 'Movies' | 'TV Shows' | 'Music' | 'Documentaries' | 'Other';
  moved: boolean;
}

export class FileOrganizerService {
  private downloadDir: string;

  constructor() {
    this.downloadDir = process.env.DOWNLOAD_DIR || '/home/beerm/media-vault/downloads';
  }

  /**
   * Determine media category based on video info and metadata
   */
  private categorizeMedia(info: VideoInfo, filePath: string): OrganizedFile['category'] {
    const title = info.title.toLowerCase();
    const uploader = info.uploader.toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Check for TV show patterns
    const tvPatterns = [
      /s\d{2}e\d{2}/i,  // S01E01
      /season\s*\d+/i,   // Season 1
      /episode\s*\d+/i,  // Episode 1
      /\d{1,2}x\d{1,2}/i // 1x01
    ];

    if (tvPatterns.some(pattern => pattern.test(title) || pattern.test(fileName))) {
      return 'TV Shows';
    }

    // Check for documentary keywords
    const documentaryKeywords = [
      'documentary', 'bbc', 'national geographic', 'nature',
      'wildlife', 'history', 'science', 'planet', 'attenborough'
    ];

    if (documentaryKeywords.some(keyword =>
      title.includes(keyword) || uploader.includes(keyword)
    )) {
      return 'Documentaries';
    }

    // Check for music
    const musicKeywords = [
      'official music video', 'official video', 'lyrics',
      'audio', 'song', 'album', 'music'
    ];

    if (musicKeywords.some(keyword => title.includes(keyword))) {
      return 'Music';
    }

    // Check duration - short videos might be music/other, long ones likely movies
    if (info.duration && info.duration > 2400) { // > 40 minutes
      return 'Movies';
    }

    // Default to Movies for most content
    return 'Movies';
  }

  /**
   * Generate a clean filename for Jellyfin
   */
  private generateCleanFilename(info: VideoInfo, originalPath: string): string {
    const ext = path.extname(originalPath);

    // Clean the title - remove special characters, keep alphanumeric and spaces
    let cleanTitle = info.title
      .replace(/[^\w\s-]/g, '')  // Remove special chars except spaces and hyphens
      .replace(/\s+/g, ' ')       // Normalize spaces
      .trim();

    // Fallback if title becomes empty after cleaning
    if (!cleanTitle || cleanTitle.length === 0) {
      // Use original filename without extension and ID
      const basename = path.basename(originalPath, ext);
      cleanTitle = basename
        .replace(/-[a-zA-Z0-9_-]{11}$/, '')  // Remove YouTube ID
        .replace(/[_-]/g, ' ')               // Replace underscores/hyphens with spaces
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Final safety check
    if (!cleanTitle || cleanTitle.length === 0) {
      cleanTitle = `video-${Date.now()}`;
    }

    // Add year if available
    if (info.uploadDate) {
      const year = info.uploadDate.substring(0, 4);
      cleanTitle = `${cleanTitle} (${year})`;
    }

    return `${cleanTitle}${ext}`;
  }

  /**
   * Organize a downloaded file into proper Jellyfin structure
   */
  async organizeFile(
    filePath: string,
    videoInfo: VideoInfo,
    userCategory?: {
      category: string;
      customFolder?: string;
      organizeByUploader?: boolean;
    }
  ): Promise<OrganizedFile> {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Determine category based on user choice or auto-detection
      let category: OrganizedFile['category'];
      let targetDir: string;

      if (userCategory) {
        // User specified category
        if (userCategory.category === 'collection') {
          // No folder organization, keep in root
          targetDir = this.downloadDir;
          category = 'Other';
        } else if (userCategory.category === 'custom' && userCategory.customFolder) {
          // Custom folder name
          targetDir = path.join(this.downloadDir, userCategory.customFolder);
          category = 'Other';
        } else {
          // Standard categories: movies, tv, music, docs
          const categoryMap: Record<string, OrganizedFile['category']> = {
            'movies': 'Movies',
            'tv': 'TV Shows',
            'music': 'Music',
            'documentaries': 'Documentaries',
          };
          category = categoryMap[userCategory.category] || 'Movies';
          targetDir = path.join(this.downloadDir, category);
        }
      } else {
        // Fallback to auto-detection
        category = this.categorizeMedia(videoInfo, filePath);
        targetDir = path.join(this.downloadDir, category);
      }

      const cleanFilename = this.generateCleanFilename(videoInfo, filePath);

      // Add uploader sub-folder if requested
      if (userCategory?.organizeByUploader && videoInfo.uploader) {
        const uploaderFolder = videoInfo.uploader
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_')
          .trim();
        targetDir = path.join(targetDir, uploaderFolder);
      }

      // Create target directory if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });

      const newPath = path.join(targetDir, cleanFilename);

      // Check if file already exists at destination
      try {
        await fs.access(newPath);
        console.log(`File already exists at destination: ${newPath}`);
        return {
          originalPath: filePath,
          newPath: filePath, // Keep original if destination exists
          category,
          moved: false,
        };
      } catch {
        // File doesn't exist at destination, proceed with move
      }

      // Move the file
      await fs.rename(filePath, newPath);

      // Also move the .info.json file if it exists
      const infoJsonPath = filePath.replace(/\.[^.]+$/, '.info.json');
      const newInfoJsonPath = newPath.replace(/\.[^.]+$/, '.info.json');

      try {
        await fs.access(infoJsonPath);
        await fs.rename(infoJsonPath, newInfoJsonPath);
      } catch {
        // Info file doesn't exist, that's ok
      }

      console.log(`Organized: ${filePath} -> ${newPath}`);

      return {
        originalPath: filePath,
        newPath,
        category,
        moved: true,
      };
    } catch (error: any) {
      console.error(`Failed to organize file ${filePath}:`, error.message);

      // Return original path if organization failed
      return {
        originalPath: filePath,
        newPath: filePath,
        category: 'Other',
        moved: false,
      };
    }
  }

  /**
   * Clean up empty uploader directories after organizing files
   */
  async cleanupEmptyDirectories(): Promise<void> {
    try {
      const entries = await fs.readdir(this.downloadDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.downloadDir, entry.name);

          // Skip the organized category directories
          const categoryDirs = ['Movies', 'TV Shows', 'Music', 'Documentaries'];
          if (categoryDirs.includes(entry.name)) {
            continue;
          }

          // Check if directory is empty
          const files = await fs.readdir(dirPath);
          if (files.length === 0) {
            await fs.rmdir(dirPath);
            console.log(`Removed empty directory: ${dirPath}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to cleanup empty directories:', error.message);
    }
  }

  /**
   * Get statistics about organized files
   */
  async getOrganizationStats(): Promise<{
    categories: Record<string, { count: number; totalSize: number }>;
  }> {
    const stats: Record<string, { count: number; totalSize: number }> = {
      Movies: { count: 0, totalSize: 0 },
      'TV Shows': { count: 0, totalSize: 0 },
      Music: { count: 0, totalSize: 0 },
      Documentaries: { count: 0, totalSize: 0 },
    };

    for (const category of Object.keys(stats)) {
      const categoryPath = path.join(this.downloadDir, category);

      try {
        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          if (file.endsWith('.mp4') || file.endsWith('.mkv') || file.endsWith('.avi')) {
            stats[category].count++;

            try {
              const filePath = path.join(categoryPath, file);
              const stat = await fs.stat(filePath);
              stats[category].totalSize += stat.size;
            } catch {
              // Skip if can't stat file
            }
          }
        }
      } catch {
        // Category directory doesn't exist yet
      }
    }

    return { categories: stats };
  }
}

// Export singleton instance
export const fileOrganizerService = new FileOrganizerService();
