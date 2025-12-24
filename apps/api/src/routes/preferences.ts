import express from 'express';
import { auth } from '../auth.js';
import { AppDataSource } from '../data-source.js';

export const preferencesRouter = express.Router();

// Middleware to check authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).user = session.user;
    (req as any).authSession = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// GET /api/v1/preferences - Get user preferences
preferencesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    let preferences = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    // If no preferences exist, create default ones
    if (!preferences) {
      await AppDataSource
        .createQueryBuilder()
        .insert()
        .into('user_preferences')
        .values({ user_id: userId })
        .execute();

      preferences = await AppDataSource
        .createQueryBuilder()
        .select('*')
        .from('user_preferences', 'p')
        .where('p.user_id = :userId', { userId })
        .getRawOne();
    }

    // Parse JSON fields
    if (preferences && typeof preferences.jellyfin_library_paths === 'string') {
      try {
        preferences.jellyfin_library_paths = JSON.parse(preferences.jellyfin_library_paths);
      } catch (e) {
        console.error('Failed to parse jellyfin_library_paths:', e);
      }
    }

    res.json(preferences);
  } catch (err) {
    console.error('Failed to get preferences:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// PUT /api/v1/preferences - Update user preferences
preferencesRouter.put('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      // Download Preferences
      default_quality,
      default_folder,
      default_video_format,
      default_audio_format,
      concurrent_downloads,

      // Bandwidth Controls
      download_speed_limit,
      upload_speed_limit,

      // Jellyfin Integration
      jellyfin_server_url,
      jellyfin_api_key,
      jellyfin_library_paths,
      jellyfin_auto_scan,

      // Notification Preferences
      notifications_enabled,
      notify_download_complete,
      notify_download_failed,
      notification_sound,

      // Storage Management
      storage_limit_gb,
      auto_cleanup_enabled,
      auto_cleanup_days,

      // Behavior Settings
      auto_organize_files,
      auto_fetch_thumbnails,
      keep_download_history_days,

      // Privacy/Advanced
      youtube_cookies_path,
      clear_search_history_on_exit,

      // API Keys & Paths
      tmdb_api_key,
      omdb_api_key,
      download_directory,
      ytdlp_path,
      get_iplayer_path,

      // VPN Preferences
      vpn_enabled,
      require_vpn_for_torrents,
      vpn_auto_connect,
      vpn_auto_bind_qbittorrent,
      vpn_preferred_location,
      vpn_kill_switch_enabled,

      // *arr Services Integration
      prowlarr_enabled,
      prowlarr_host,
      prowlarr_port,
      prowlarr_api_key,
      prowlarr_url_base,
    } = req.body;

    // Build update object with only provided fields
    const updateFields: any = {};
    if (default_quality !== undefined) updateFields.default_quality = default_quality;
    if (default_folder !== undefined) updateFields.default_folder = default_folder;
    if (default_video_format !== undefined) updateFields.default_video_format = default_video_format;
    if (default_audio_format !== undefined) updateFields.default_audio_format = default_audio_format;
    if (concurrent_downloads !== undefined) updateFields.concurrent_downloads = concurrent_downloads;

    if (download_speed_limit !== undefined) updateFields.download_speed_limit = download_speed_limit;
    if (upload_speed_limit !== undefined) updateFields.upload_speed_limit = upload_speed_limit;

    if (jellyfin_server_url !== undefined) updateFields.jellyfin_server_url = jellyfin_server_url;
    if (jellyfin_api_key !== undefined) updateFields.jellyfin_api_key = jellyfin_api_key;
    if (jellyfin_library_paths !== undefined) updateFields.jellyfin_library_paths = JSON.stringify(jellyfin_library_paths);
    if (jellyfin_auto_scan !== undefined) updateFields.jellyfin_auto_scan = jellyfin_auto_scan;

    if (notifications_enabled !== undefined) updateFields.notifications_enabled = notifications_enabled;
    if (notify_download_complete !== undefined) updateFields.notify_download_complete = notify_download_complete;
    if (notify_download_failed !== undefined) updateFields.notify_download_failed = notify_download_failed;
    if (notification_sound !== undefined) updateFields.notification_sound = notification_sound;

    if (storage_limit_gb !== undefined) updateFields.storage_limit_gb = storage_limit_gb;
    if (auto_cleanup_enabled !== undefined) updateFields.auto_cleanup_enabled = auto_cleanup_enabled;
    if (auto_cleanup_days !== undefined) updateFields.auto_cleanup_days = auto_cleanup_days;

    if (auto_organize_files !== undefined) updateFields.auto_organize_files = auto_organize_files;
    if (auto_fetch_thumbnails !== undefined) updateFields.auto_fetch_thumbnails = auto_fetch_thumbnails;
    if (keep_download_history_days !== undefined) updateFields.keep_download_history_days = keep_download_history_days;

    if (youtube_cookies_path !== undefined) updateFields.youtube_cookies_path = youtube_cookies_path;
    if (clear_search_history_on_exit !== undefined) updateFields.clear_search_history_on_exit = clear_search_history_on_exit;

    if (tmdb_api_key !== undefined) updateFields.tmdb_api_key = tmdb_api_key;
    if (omdb_api_key !== undefined) updateFields.omdb_api_key = omdb_api_key;
    if (download_directory !== undefined) updateFields.download_directory = download_directory;
    if (ytdlp_path !== undefined) updateFields.ytdlp_path = ytdlp_path;
    if (get_iplayer_path !== undefined) updateFields.get_iplayer_path = get_iplayer_path;

    // VPN Preferences
    if (vpn_enabled !== undefined) updateFields.vpn_enabled = vpn_enabled;
    if (require_vpn_for_torrents !== undefined) updateFields.require_vpn_for_torrents = require_vpn_for_torrents;
    if (vpn_auto_connect !== undefined) updateFields.vpn_auto_connect = vpn_auto_connect;
    if (vpn_auto_bind_qbittorrent !== undefined) updateFields.vpn_auto_bind_qbittorrent = vpn_auto_bind_qbittorrent;
    if (vpn_preferred_location !== undefined) updateFields.vpn_preferred_location = vpn_preferred_location;
    if (vpn_kill_switch_enabled !== undefined) updateFields.vpn_kill_switch_enabled = vpn_kill_switch_enabled;

    // *arr Services Integration
    if (prowlarr_enabled !== undefined) updateFields.prowlarr_enabled = prowlarr_enabled;
    if (prowlarr_host !== undefined) updateFields.prowlarr_host = prowlarr_host;
    if (prowlarr_port !== undefined) updateFields.prowlarr_port = prowlarr_port;
    if (prowlarr_api_key !== undefined) updateFields.prowlarr_api_key = prowlarr_api_key;
    if (prowlarr_url_base !== undefined) updateFields.prowlarr_url_base = prowlarr_url_base;

    // Check if preferences exist
    const existing = await AppDataSource
      .createQueryBuilder()
      .select('id')
      .from('user_preferences', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    if (!existing) {
      // Create new preferences
      await AppDataSource
        .createQueryBuilder()
        .insert()
        .into('user_preferences')
        .values({
          user_id: userId,
          ...updateFields
        })
        .execute();
    } else {
      // Update existing preferences
      await AppDataSource
        .createQueryBuilder()
        .update('user_preferences')
        .set(updateFields)
        .where('user_id = :userId', { userId })
        .execute();
    }

    // Fetch and return updated preferences
    const preferences = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('user_preferences', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    // Parse JSON fields
    if (preferences && typeof preferences.jellyfin_library_paths === 'string') {
      try {
        preferences.jellyfin_library_paths = JSON.parse(preferences.jellyfin_library_paths);
      } catch (e) {
        console.error('Failed to parse jellyfin_library_paths:', e);
      }
    }

    res.json(preferences);
  } catch (err) {
    console.error('Failed to update preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// GET /api/v1/preferences/storage - Get storage usage statistics
preferencesRouter.get('/storage', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get total storage used by media type
    const storageByCategory = await AppDataSource
      .createQueryBuilder()
      .select('media_type', 'category')
      .addSelect('COUNT(*)', 'file_count')
      .addSelect('SUM(file_size)', 'total_bytes')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .groupBy('media_type')
      .getRawMany();

    // Get total storage across all categories
    const totalStorage = await AppDataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'total_files')
      .addSelect('SUM(file_size)', 'total_bytes')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .getRawOne();

    // Get storage limit from preferences
    const preferences = await AppDataSource
      .createQueryBuilder()
      .select('storage_limit_gb')
      .from('user_preferences', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne();

    const storageLimitBytes = preferences?.storage_limit_gb
      ? preferences.storage_limit_gb * 1024 * 1024 * 1024
      : null;

    res.json({
      by_category: storageByCategory.map((cat: any) => ({
        category: cat.category,
        file_count: parseInt(cat.file_count),
        bytes: parseInt(cat.total_bytes || '0'),
        gb: (parseInt(cat.total_bytes || '0') / (1024 * 1024 * 1024)).toFixed(2)
      })),
      total: {
        file_count: parseInt(totalStorage.total_files),
        bytes: parseInt(totalStorage.total_bytes || '0'),
        gb: (parseInt(totalStorage.total_bytes || '0') / (1024 * 1024 * 1024)).toFixed(2)
      },
      limit: {
        bytes: storageLimitBytes,
        gb: preferences?.storage_limit_gb || null,
        percentage: storageLimitBytes
          ? ((parseInt(totalStorage.total_bytes || '0') / storageLimitBytes) * 100).toFixed(1)
          : null
      }
    });
  } catch (err) {
    console.error('Failed to get storage info:', err);
    res.status(500).json({ error: 'Failed to get storage info' });
  }
});

// POST /api/v1/preferences/cleanup - Run manual cleanup of old files
preferencesRouter.post('/cleanup', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { days } = req.body;

    if (!days || days < 1) {
      return res.status(400).json({ error: 'Invalid days parameter' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find files older than cutoff
    const oldFiles = await AppDataSource
      .createQueryBuilder()
      .select('*')
      .from('media', 'm')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.created_at < :cutoffDate', { cutoffDate })
      .getRawMany();

    // Delete the files from database
    // Note: Actual file deletion should be handled by a background job
    // This just marks them as deleted or removes from database
    await AppDataSource
      .createQueryBuilder()
      .delete()
      .from('media')
      .where('user_id = :userId', { userId })
      .andWhere('created_at < :cutoffDate', { cutoffDate })
      .execute();

    res.json({
      deleted_count: oldFiles.length,
      deleted_files: oldFiles
    });
  } catch (err) {
    console.error('Failed to cleanup files:', err);
    res.status(500).json({ error: 'Failed to cleanup files' });
  }
});
