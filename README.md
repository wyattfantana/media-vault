# MediaVault

**Your Personal Media Hub - Self-hosted media download and management platform**

MediaVault is a powerful, self-hosted application for downloading and organizing media from BBC iPlayer, YouTube, and social media platforms. Built with a modern tech stack and designed for ease of use.

**Current Status:** ✅ Core functionality working - downloads, streaming, and background services operational

---

## 🎬 Features

### Content Sources
- **TMDB Movie Database** - 
  - 🎬 Movies - Browse 1,000,000+ movies and TV shows with ratings, posters, and trailers
  - 📺 TV Shows - Browse 200,000+ series by popularity, genre, and release date
  - 🎞️ Documentaries - Browse 200,000+ documentaries (History, War, Crime, Music, Drama)
  - ⭐ Advanced Filtering - Filter by rating, votes, year range, and multiple genres
  - 🧲 **Torrent Integration** - One-click access to curated torrent sites (1337x, PirateBay, Ext.to)
- **Torrent Downloads** - Full qBittorrent integration for magnet links and .torrent files
  - Automatic detection and handling of magnet links
  - Real-time progress tracking via qBittorrent Web UI
  - Category-based organization with custom save paths
  - Pause/resume/delete torrent management
- **BBC iPlayer** - Browse and download 9000+ TV and radio programmes (DRM-free via get_iplayer)
- **YouTube** - Channel/playlist browsing with multi-select bulk download, pagination, Load All
- **SoundCloud** - Search and download tracks, playlists, and albums
- **Social Media** - TikTok, Reddit, Twitch support (via yt-dlp)
- **Universal URL Support** - Extract and download from any yt-dlp compatible platform

### Media Management
- 🗂️ **Automatic Organization** - Files sorted into Movies, TV Shows, Music, Documentaries, or custom folders
- 📊 **Download Queue** - Background worker processes downloads automatically
- 🎨 **Netflix-Style Interface** - Beautiful grid browse with thumbnails, ratings, and descriptions
- 🔍 **Advanced Search** - Filter by genre, rating, year, popularity across all content types
- 📺 **Jellyfin Ready** - Organized folder structure perfect for Jellyfin media server
- ✨ **Jellyfin Auto-Formatting** - Intelligent filename parsing with inline preview before download
  - Automatically detects TV shows (S01E01), movies (Year), and documentaries
  - Real-time TMDB metadata enrichment for accurate show/movie names and years
  - Shows formatted Jellyfin-compatible path structure before downloading
  - No separate modals - preview appears inline in the same download dialog
- ✅ **Multi-Select Downloads** - Select multiple videos and download in bulk
- ⭐ **Favorites/Bookmarks** - Save YouTube channels, playlists, and favorite movies/shows
- 🎛️ **Download Presets** - Create platform-specific presets (e.g., 320kbps audio for SoundCloud)
- 🌐 **Discover Tab** - Browse all platforms in one unified interface with persistent tabs
- 🎯 **Smart Filtering** - Adjustable quality filters for finding best content (rating, votes, year)

### BBC iPlayer Browse
- Search across all TV and radio programmes
- Filter by channel (BBC One, Two, Three, Four, News, Parliament, Alba, Radio stations)
- Sort by Recently Added, Expiring Soon, or Name A-Z
- View programme thumbnails, descriptions, and availability countdown
- One-click download with automatic category detection

### YouTube Browse
- Browse channels with pagination and "Load All" support
- **Accurate video counts** - Background counting shows true channel size (e.g., 3486 videos)
- Browse playlists with full metadata (playlist name, channel, video count)
- Multi-select videos with checkboxes
- Bulk download selected videos
- Channel info display (name, subscriber count, accurate video count)
- Load More and Load All functionality for large channels
- **Bookmark channels** - Save favorites with automatic video count updates
- Smart URL matching - Handles various YouTube URL formats automatically

### Download Management
- Real-time progress tracking
- Support for both yt-dlp and get_iplayer
- Automatic quality selection (best available)
- Subtitle download support
- Custom folder naming
- Download history with status tracking
- Category-based organization (Movies, TV, Music, Documentaries, Custom)

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite (port 5173) + TailwindCSS + Lucide Icons
- **Backend:** Express + TypeScript + PostgreSQL (port 3001)
- **Database:** PostgreSQL (port 5432) with TypeORM
- **Authentication:** Better Auth (email/password + session management)
- **APIs:** TMDB API (movies/TV metadata), YouTube Data API, BBC iPlayer API
- **Tools:** get_iplayer, yt-dlp, qBittorrent-nox
- **Architecture:** Turborepo monorepo

---

## 📋 Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 14
- **get_iplayer** (for BBC iPlayer downloads)
- **yt-dlp** (for YouTube & social media downloads)
- **qBittorrent-nox** (for torrent downloads)

### Installing Tools

**get_iplayer:**
```bash
# Clone get_iplayer
git clone https://github.com/get-iplayer/get_iplayer.git ~/get_iplayer

# Install Perl dependencies
sudo apt-get install libwww-perl liblwp-protocol-https-perl libxml-libxml-perl ffmpeg atomicparsley
```

**yt-dlp:**
```bash
# Install to ~/bin/
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ~/bin/yt-dlp
sudo chmod a+rx ~/bin/yt-dlp
```

**qBittorrent-nox (headless torrent client):**
```bash
# Install qBittorrent without GUI
sudo apt-get install -y qbittorrent-nox

# Start qBittorrent Web UI (run in background)
qbittorrent-nox --webui-port=8080 &

# Access Web UI at http://localhost:8080
# Default credentials: admin/adminadmin
# Configure download path in Web UI settings
```

---

## 🏁 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/wyattfantana/media-vault.git
cd media-vault
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb mediavault

# Run migrations
cd apps/api

# Migration 1: Better Auth tables
npx tsx src/scripts/migrate-better-auth.ts

# Migration 2-6: MediaVault tables
psql mediavault < src/migrations/002_create_media_tables.sql
psql mediavault < src/migrations/003_create_bookmarks_table.sql
psql mediavault < src/migrations/004_create_presets_table.sql
psql mediavault < src/migrations/005_add_platform_to_presets.sql
psql mediavault < src/migrations/006_add_jellyfin_formatting_columns.sql
```

Or use the setup script:
```bash
chmod +x setup-database.sh
./setup-database.sh
```

### 3. Environment Variables

**apps/api/.env:**
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Server
PORT=3001
NODE_ENV=development

# Better Auth
BETTER_AUTH_SECRET=your_random_secret_key
BETTER_AUTH_URL=http://localhost:3001

# TMDB API (for movie/TV browsing)
TMDB_API_KEY=your_tmdb_api_key  # Get free key at https://www.themoviedb.org/settings/api

# YouTube API (optional - for channel metadata)
YOUTUBE_API_KEY=your_youtube_api_key  # Get at https://console.cloud.google.com

# qBittorrent Web API (for torrent downloads)
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

# Paths
DOWNLOAD_DIR=/home/beerm/media-vault/downloads
YTDLP_PATH=/home/beerm/bin/yt-dlp
```

**apps/web/.env:**
```bash
VITE_API_URL=http://localhost:3001
```

### 4. Configure Tool Paths

Update paths in the backend services if needed:
- `apps/api/src/services/get-iplayer.service.ts` (line 10)
- `apps/api/src/services/ytdlp.service.ts` (line 8)

### 5. Run Development Servers

#### Option A: Using Startup Script (Recommended)

Use the startup script to run all services in persistent tmux sessions:

```bash
~/start-mediavault.sh
```

This starts:
- **qBittorrent** (Web UI on port 8080)
- **MediaVault API** (port 3001)
- **MediaVault Web** (port 5173)
- **Worker** (background download processor)

**Advantages:**
- Services persist even if you close the terminal
- Run in background using tmux
- Survives terminal disconnections
- Easy log viewing with `tmux attach`

**Managing tmux sessions:**
```bash
# View logs
tmux attach -t mediavault    # API, Web, Worker logs
tmux attach -t qbittorrent   # qBittorrent logs

# Detach from tmux: Press Ctrl+B, then D

# Stop services
tmux kill-session -t mediavault
tmux kill-session -t qbittorrent
```

#### Option B: Manual Start

```bash
# Terminal 1: Start qBittorrent
qbittorrent-nox --webui-port=8080

# Terminal 2: Start MediaVault services (API, Web, Worker)
cd ~/projects/media-vault
npx turbo dev --filter=starter-api --filter=starter-web --filter=worker

# Note: Use turbo filters to avoid starting the desktop app (requires Rust)
```

---

## 🎯 Usage

1. **Sign Up/Sign In** - Create your account at http://localhost:5173
2. **Browse Content**:
   - **Browse iPlayer** - Search 9000+ BBC programmes
   - **Discover** - Browse TMDB movies/TV shows, search YouTube channels
   - **Downloads** - Paste custom URLs from any supported platform
3. **Manage Downloads** - View progress and history in the Downloads page
4. **Access Media** - Files are organized in the `downloads/` folder by category

---

## 📁 Project Structure

```
/home/beerm/media-vault/
├── apps/
│   ├── api/                    # Express backend (port 3001)
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   │   ├── downloads.ts
│   │   │   │   ├── media.ts
│   │   │   │   └── auth.ts
│   │   │   ├── services/       # Download services
│   │   │   │   ├── ytdlp.service.ts
│   │   │   │   └── get-iplayer.service.ts
│   │   │   ├── workers/        # Background jobs
│   │   │   │   └── download.worker.ts
│   │   │   ├── migrations/     # Database migrations
│   │   │   ├── data-source.ts  # TypeORM config
│   │   │   └── index.ts        # Server entry
│   │   └── package.json
│   └── web/                    # React frontend (port 5173)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Downloads.tsx
│       │   │   ├── Browse.tsx
│       │   │   └── Media.tsx
│       │   └── App.tsx
│       └── package.json
├── downloads/                  # Downloaded media files
│   ├── Movies/
│   ├── TV/
│   ├── Music/
│   ├── Documentaries/
│   └── [Custom Folders]/
└── docker-compose.yml          # PostgreSQL container
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/sign-up` - Create account
- `POST /api/auth/sign-in` - Login
- `GET /api/auth/get-session` - Get current session

### TMDB
- `GET /api/v1/tmdb/trending/movie` - Trending movies
- `GET /api/v1/tmdb/trending/tv` - Trending TV shows
- `GET /api/v1/tmdb/discover/movies?genre=99` - Discover with filters
- `GET /api/v1/tmdb/search/movies?q=query` - Search movies
- `GET /api/v1/tmdb/search/tv?q=query` - Search TV shows

### Downloads
- `GET /api/v1/downloads` - List downloads
- `GET /api/v1/downloads/:id` - Get download details
- `POST /api/v1/downloads` - Create new download
- `DELETE /api/v1/downloads/:id` - Delete download
- `GET /api/v1/downloads/search/video` - Get video info
- `GET /api/v1/downloads/search/iplayer` - Search BBC iPlayer
- `GET /api/v1/downloads/status` - Check downloader status

### Media
- `GET /api/v1/media` - List media (paginated, filtered, searchable)
- `GET /api/v1/media/:id` - Get media details
- `GET /api/v1/media/:id/stream` - Stream media file
- `GET /api/v1/media/stats` - Get media statistics
- `PUT /api/v1/media/:id` - Update media metadata
- `DELETE /api/v1/media/:id?deleteFile=true` - Delete media

### YouTube
- `GET /api/v1/youtube/channel/:id` - Get channel info and videos

### Bookmarks
- `GET /api/v1/bookmarks` - List bookmarks
- `POST /api/v1/bookmarks` - Create bookmark
- `DELETE /api/v1/bookmarks/:id` - Delete bookmark

### Presets
- `GET /api/v1/presets` - List download presets
- `POST /api/v1/presets` - Create preset
- `DELETE /api/v1/presets/:id` - Delete preset

### Health
- `GET /health` - System health check

---

## 🐛 Known Limitations

- UK commercial broadcasters (Channel 4, ITVX, My5) are DRM-protected and cannot be downloaded
- Some international broadcasters have broken extractors in yt-dlp
- **Rumble temporarily limited** - Anti-bot protection blocking automated access (awaiting yt-dlp update)
- Currently focused on reliable sources: BBC iPlayer, YouTube, and social media
- No concurrent downloads - worker processes one at a time
- Cannot cancel in-progress downloads (can delete pending)
- Age-restricted YouTube videos require cookie authentication

---

## 🔐 Authentication

- Email/password authentication via Better Auth
- Session management with 7-day expiry
- Protected routes (must be logged in to download)
- User-specific download history

---

## 🚀 Background Service Architecture

### Services Running
- **qBittorrent**: Port 8080 (tmux session: qbittorrent)
- **API**: Port 3001 (tmux session: mediavault)
- **Web**: Port 5173 (tmux session: mediavault)
- **Worker**: Background process (tmux session: mediavault)
- **PostgreSQL**: Port 5432 (systemd service)

### How Downloads Work

```
1. User pastes URL in frontend
2. POST /api/v1/downloads
   ↓
3. Backend fetches video info via yt-dlp
   ↓
4. Creates download record (status: pending)
   ↓
5. Download worker picks it up (every 5 seconds)
   ↓
6. Worker marks as "downloading" and calls yt-dlp
   ↓
7. yt-dlp downloads to /downloads/[category]/[formatted-name]
   ↓
8. Worker updates progress in database
   ↓
9. On completion: status=completed, creates media entry
   ↓
10. User can stream from /api/v1/media/:id/stream
```

### Download Worker
- Located at: `apps/api/src/workers/download.worker.ts`
- Polls database every 5 seconds for `status='pending'`
- Processes one download at a time sequentially
- Emits progress events that update the database
- Creates media entry automatically on successful download

---

## 🔧 Troubleshooting

### Downloads Not Starting
**Symptom:** Download stuck at 0%, status shows "downloading"
**Cause:** Worker not picking up the download
**Fix:**
```sql
UPDATE downloads
SET status = 'pending', started_at = NULL
WHERE id = 'download-id-here';
```

### Port Already in Use
**Symptom:** `EADDRINUSE: address already in use :::3001`
**Fix:**
```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null
```

### Database Connection Failed
**Symptom:** Cannot connect to PostgreSQL
**Fix:**
```bash
cd /home/beerm/media-vault
docker compose down
docker compose up -d
```

### yt-dlp Not Found
**Symptom:** Downloads fail with "command not found"
**Fix:**
```bash
# Check if yt-dlp exists
ls -la /home/beerm/bin/yt-dlp

# Update if needed
sudo wget -O /home/beerm/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
sudo chmod a+rx /home/beerm/bin/yt-dlp
```

### Services Not Starting
**Symptom:** tmux sessions not running
**Fix:**
```bash
# Check running sessions
tmux ls

# Restart all services
~/start-mediavault.sh
```

---

## 📊 Quick Commands Reference

### Database
```bash
# Connect to database
PGPASSWORD=mediavault123 psql -h localhost -U mediavault -d mediavault

# Check downloads
SELECT id, title, status, progress FROM downloads ORDER BY created_at DESC;

# Reset stuck download
UPDATE downloads SET status = 'pending', started_at = NULL WHERE id = 'xxx';

# View media
SELECT id, title, media_type, file_size/1024/1024 as size_mb FROM media;
```

### Server Management
```bash
# Kill all dev servers
pkill -f "npm run dev"

# View logs
tmux attach -t mediavault
tmux attach -t qbittorrent

# Stop services
tmux kill-session -t mediavault
tmux kill-session -t qbittorrent
```

### File Management
```bash
# List downloads
ls -lh /home/beerm/media-vault/downloads/*/*

# Check disk usage
du -sh /home/beerm/media-vault/downloads/

# Find large files
find /home/beerm/media-vault/downloads -type f -size +500M -exec ls -lh {} \;
```

## 📄 License

MIT License - Feel free to use and modify!

---

## 🙏 Credits

- **get_iplayer** - BBC iPlayer downloader
- **yt-dlp** - Universal video downloader
- **qBittorrent** - Torrent client
- **TMDB** - Movie database
- Built with Better Auth, TypeORM, React, and Turborepo

---

**Made with ❤️ for media enthusiasts who want control over their content**

**Last Updated:** 2025-12-07
**Status:** Active Development - All Core Features Operational
