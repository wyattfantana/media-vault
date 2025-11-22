# MediaVault

**Your Personal Media Hub - Self-hosted media download and management platform**

MediaVault is a powerful, self-hosted application for downloading and organizing media from BBC iPlayer, YouTube, and social media platforms. Built with a modern tech stack and designed for ease of use.

## 🎬 Features

### Content Sources
- **BBC iPlayer** - Browse and download 9000+ TV and radio programmes (DRM-free via get_iplayer)
- **YouTube** - Channel/playlist browsing with multi-select bulk download, pagination, Load All
- **SoundCloud** - Search and download tracks, playlists, and albums
- **Social Media** - TikTok, Reddit, Twitch, Vimeo, Rumble support (via yt-dlp)
- **Universal URL Support** - Extract and download from any yt-dlp compatible platform

### Media Management
- 🗂️ **Automatic Organization** - Files sorted into Movies, TV Shows, Music, Documentaries, or custom folders
- 📊 **Download Queue** - Background worker processes downloads automatically
- 🎨 **Netflix-Style Interface** - Beautiful grid browse with thumbnails and descriptions
- 🔍 **Advanced Search** - Filter by channel, sort by recently added or expiring soon
- 📺 **Jellyfin Ready** - Organized folder structure perfect for Jellyfin media server
- ✅ **Multi-Select Downloads** - Select multiple videos and download in bulk
- ⭐ **Favorites/Bookmarks** - Save YouTube channels and playlists for quick access
- 🎛️ **Download Presets** - Create platform-specific presets (e.g., 320kbps audio for SoundCloud)
- 🌐 **Discover Tab** - Browse all platforms in one unified interface with persistent tabs

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

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Express + TypeScript + PostgreSQL + Better Auth
- **Database:** PostgreSQL with TypeORM
- **Tools:** get_iplayer, yt-dlp
- **Architecture:** Turborepo monorepo

## 📋 Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 14
- **get_iplayer** (for BBC iPlayer downloads)
- **yt-dlp** (for YouTube & social media downloads)

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
npx tsx src/scripts/migrate-better-auth.ts
psql mediavault < src/migrations/002_create_media_tables.sql
psql mediavault < src/migrations/003_create_bookmarks_table.sql
psql mediavault < src/migrations/004_create_presets_table.sql
psql mediavault < src/migrations/005_add_platform_to_presets.sql
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

```bash
# Start all services
npm run dev

# Or start individually:
npm run dev:api      # API server on http://localhost:3001
npm run dev:web      # Web app on http://localhost:5173
```

## 🎯 Usage

1. **Sign Up/Sign In** - Create your account at http://localhost:5173
2. **Browse iPlayer** - Click "Browse iPlayer" to search BBC programmes
3. **Download Media** - Click "Download" on any programme or use the Downloads page for custom URLs
4. **Manage Downloads** - View progress and history in the Downloads page
5. **Access Media** - Files are organized in the `downloads/` folder by category

## 📁 Folder Structure

```
downloads/
├── Movies/
├── TV/
├── Music/
├── Documentaries/
└── [Custom Folders]/
```

Perfect for scanning into Jellyfin or other media servers!

## 🔐 Authentication

- Email/password authentication via Better Auth
- Session management with 7-day expiry
- Protected routes (must be logged in to download)
- User-specific download history

## 📡 API Endpoints

- **Downloads:** `GET/POST /api/v1/downloads`
- **BBC iPlayer Search:** `GET /api/v1/iplayer/search?query=...`
- **Media Library:** `GET /api/v1/media`
- **Jellyfin Integration:** `GET /api/v1/jellyfin/items`

## 🚧 Roadmap

### ✅ Completed
- BBC iPlayer integration with 9000+ programmes
- YouTube channel/playlist browsing with pagination and accurate video counts
- Multi-select and bulk download
- SoundCloud, TikTok, Reddit, Vimeo, Twitch support
- Category-based organization
- Download queue with background worker
- **Favorites/Bookmarks System** - Save YouTube channels and playlists with smart URL matching
- **Platform-Specific Presets** - Save download settings per platform (e.g., audio-only for SoundCloud)
- **Discover Tab** - Unified browsing interface with session persistence across all platforms
- **All Platforms Feed** - Trending content from YouTube, SoundCloud, BBC iPlayer in one place
- Queue Management Dashboard with real-time progress tracking
- Download History with grid/table view modes

### 🚀 In Progress
- Enhanced Unified Search - Search across all platforms simultaneously
- Smart Organization - Auto-folders, duplicate detection
- Statistics Dashboard - Analytics and usage stats
- Media Library Browser - View and organize downloaded media

### 📋 Planned
- Notification system for completed downloads
- Media player integration for in-app playback
- Scheduled downloads
- Auto-update for bookmarked channels
- Advanced filtering and sorting
- Mobile-responsive improvements

## 🐛 Known Limitations

- UK commercial broadcasters (Channel 4, ITVX, My5) are DRM-protected and cannot be downloaded
- Some international broadcasters have broken extractors in yt-dlp
- **Rumble temporarily limited** - Anti-bot protection blocking automated access (awaiting yt-dlp update)
- Currently focused on reliable sources: BBC iPlayer, YouTube, and social media

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

- **get_iplayer** - BBC iPlayer downloader
- **yt-dlp** - Universal video downloader
- Built with Better Auth, TypeORM, React, and Turborepo

---

**Made with ❤️ for media enthusiasts who want control over their content**
