import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const storageRouter = express.Router();

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/mnt/d/MediaVault';

// Category folder mapping
const CATEGORY_FOLDERS: Record<string, string> = {
  'Movies': 'Movies',
  'TV Shows': 'TV Shows',
  'Documentaries': 'Documentaries',
  'Music': 'Music',
  'iPlayer': 'iplayer',
};

// Media file extensions
const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];

// Middleware to check authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).user = session.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get directory size recursively
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch (err) {
    // Directory might not exist or be inaccessible
  }
  return totalSize;
}

// Scan directory for files/folders
async function scanDirectory(dirPath: string, shallow: boolean = true): Promise<any[]> {
  const items: any[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stat = await fs.stat(fullPath);

      if (entry.isDirectory()) {
        const size = await getDirectorySize(fullPath);
        const children = shallow ? [] : await scanDirectory(fullPath, false);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          size,
          sizeFormatted: formatBytes(size),
          modified: stat.mtime.toISOString(),
          childCount: (await fs.readdir(fullPath)).length,
          children: shallow ? undefined : children,
        });
      } else {
        // Check if it's a media file
        const ext = path.extname(entry.name).toLowerCase();
        if (MEDIA_EXTENSIONS.includes(ext)) {
          items.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            modified: stat.mtime.toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error(`Failed to scan directory ${dirPath}:`, err);
  }

  // Sort: directories first, then by name
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

// Validate path is within DOWNLOAD_DIR
function isValidPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const downloadDirResolved = path.resolve(DOWNLOAD_DIR);
  return resolved.startsWith(downloadDirResolved);
}

// GET /api/v1/storage/stats - Get storage stats by category
storageRouter.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats: any[] = [];
    let totalSize = 0;
    let totalItems = 0;

    for (const [category, folder] of Object.entries(CATEGORY_FOLDERS)) {
      const categoryPath = path.join(DOWNLOAD_DIR, folder);
      try {
        const size = await getDirectorySize(categoryPath);
        const entries = await fs.readdir(categoryPath);
        const itemCount = entries.length;

        stats.push({
          category,
          folder,
          path: categoryPath,
          size,
          sizeFormatted: formatBytes(size),
          itemCount,
        });

        totalSize += size;
        totalItems += itemCount;
      } catch (err) {
        // Category folder doesn't exist
        stats.push({
          category,
          folder,
          path: categoryPath,
          size: 0,
          sizeFormatted: '0 B',
          itemCount: 0,
        });
      }
    }

    res.json({
      categories: stats,
      total: {
        size: totalSize,
        sizeFormatted: formatBytes(totalSize),
        itemCount: totalItems,
      },
    });
  } catch (err) {
    console.error('Failed to get storage stats:', err);
    res.status(500).json({ error: 'Failed to get storage stats' });
  }
});

// GET /api/v1/storage/browse - Browse files in a category
storageRouter.get('/browse', requireAuth, async (req, res) => {
  try {
    const { category, subpath } = req.query;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }

    const folder = CATEGORY_FOLDERS[category];
    if (!folder) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    let browsePath = path.join(DOWNLOAD_DIR, folder);
    if (subpath && typeof subpath === 'string') {
      browsePath = path.join(browsePath, subpath);
    }

    // Validate path
    if (!isValidPath(browsePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await scanDirectory(browsePath);
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    res.json({
      category,
      path: browsePath,
      items,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      itemCount: items.length,
    });
  } catch (err) {
    console.error('Failed to browse storage:', err);
    res.status(500).json({ error: 'Failed to browse storage' });
  }
});

// DELETE /api/v1/storage/files - Delete specific files/folders
storageRouter.delete('/files', requireAuth, async (req, res) => {
  try {
    const { paths } = req.body;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Paths array is required' });
    }

    const results: { path: string; success: boolean; error?: string }[] = [];
    let deletedCount = 0;
    let deletedSize = 0;

    for (const targetPath of paths) {
      // Validate path
      if (!isValidPath(targetPath)) {
        results.push({ path: targetPath, success: false, error: 'Access denied' });
        continue;
      }

      try {
        const stat = await fs.stat(targetPath);
        const size = stat.isDirectory() ? await getDirectorySize(targetPath) : stat.size;

        if (stat.isDirectory()) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.unlink(targetPath);

          // Also delete related files (subtitles, info files)
          const dir = path.dirname(targetPath);
          const baseName = path.basename(targetPath, path.extname(targetPath));
          try {
            const dirFiles = await fs.readdir(dir);
            for (const file of dirFiles) {
              const fileBaseName = path.basename(file, path.extname(file));
              if (fileBaseName === baseName && file !== path.basename(targetPath)) {
                const relatedPath = path.join(dir, file);
                await fs.unlink(relatedPath);
              }
            }
          } catch (e) {
            // Ignore errors cleaning up related files
          }
        }

        // Clean up database entries
        await AppDataSource.query(
          `DELETE FROM media WHERE file_path = $1 OR file_path LIKE $2`,
          [targetPath, targetPath + '%']
        );

        await AppDataSource.query(
          `DELETE FROM download_history WHERE file_path = $1 OR file_path LIKE $2`,
          [targetPath, targetPath + '%']
        );

        results.push({ path: targetPath, success: true });
        deletedCount++;
        deletedSize += size;
      } catch (err: any) {
        results.push({ path: targetPath, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      deletedCount,
      deletedSize,
      deletedSizeFormatted: formatBytes(deletedSize),
      results,
    });
  } catch (err) {
    console.error('Failed to delete files:', err);
    res.status(500).json({ error: 'Failed to delete files' });
  }
});

// DELETE /api/v1/storage/category/:category - Delete all files in a category
storageRouter.delete('/category/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Send { confirm: "DELETE_ALL" } to confirm deletion'
      });
    }

    const folder = CATEGORY_FOLDERS[category];
    if (!folder) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const categoryPath = path.join(DOWNLOAD_DIR, folder);

    // Get size before deletion
    const sizeBefore = await getDirectorySize(categoryPath);

    // Get items to delete
    const entries = await fs.readdir(categoryPath);
    let deletedCount = 0;

    for (const entry of entries) {
      const entryPath = path.join(categoryPath, entry);
      try {
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          await fs.rm(entryPath, { recursive: true, force: true });
        } else {
          await fs.unlink(entryPath);
        }
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete ${entryPath}:`, err);
      }
    }

    // Clean up database entries for this category
    const categoryPathPattern = categoryPath + '%';
    await AppDataSource.query(
      `DELETE FROM media WHERE file_path LIKE $1`,
      [categoryPathPattern]
    );

    await AppDataSource.query(
      `DELETE FROM download_history WHERE file_path LIKE $1`,
      [categoryPathPattern]
    );

    res.json({
      success: true,
      category,
      deletedCount,
      deletedSize: sizeBefore,
      deletedSizeFormatted: formatBytes(sizeBefore),
    });
  } catch (err) {
    console.error('Failed to delete category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});
