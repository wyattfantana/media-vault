# MediaVault

**Your Personal Media Hub - Download and organize content from across the web**

MediaVault lets you download and manage media from BBC iPlayer, YouTube, torrents, and social platforms. Everything is organized automatically and ready to watch on your media server.

**Status:** ✅ Fully working - downloads, streaming, and automatic organization operational

---

## ✨ What Can It Do?

### Browse & Discover
- 🎬 **1 Million+ Movies & TV Shows** - Browse with ratings, posters, and trailers
- 📺 **BBC iPlayer** - 9000+ TV and radio programmes (DRM-free)
- 🎵 **YouTube & SoundCloud** - Channels, playlists, and individual tracks
- 🎞️ **Documentaries** - 200,000+ docs across History, Crime, Music, and more
- 🧲 **Torrents** - Integrated search with 1337x, PirateBay, and more

### Smart Downloads
- ✅ **One-Click Downloads** - Just paste a URL and go
- 📊 **Real-Time Progress** - Watch your downloads in action
- ⚡ **Bulk Downloads** - Select multiple videos and download together
- 🎛️ **Quality Control** - Choose from 4K down to 360p, or audio-only
- 🗂️ **Auto-Organization** - Files sorted into Movies, TV, Music, Documentaries automatically
- 📺 **Jellyfin Ready** - Perfect naming for your media server (S01E01, movie years, etc.)
- 🔒 **VPN Integration** - Windows Mullvad support with automatic traffic protection and sidebar toggle

### Beautiful Interface
- 🎨 **Netflix-Style Browse** - Grid view with thumbnails and ratings
- 🔍 **Smart Search** - Filter by genre, year, rating across all platforms
- ⭐ **Bookmarks** - Save your favorite channels and playlists
- 🌐 **Unified Discovery** - All platforms in one tab

### What You Can Download
✅ BBC iPlayer (TV & Radio)
✅ YouTube (videos, channels, playlists)
✅ SoundCloud (tracks, albums, playlists)
✅ Torrents (magnet links & .torrent files)
✅ TikTok, Reddit, Twitch
✅ Any site supported by yt-dlp (1000+ platforms)

---

## 🚀 Getting Started

### What You Need

- **Node.js** (version 20 or newer)
- **PostgreSQL** (database)
- **yt-dlp** (YouTube downloader)
- **get_iplayer** (BBC iPlayer downloader)
- **qBittorrent-nox** (torrent client)


### Installation

**1. Install the download tools:**

```bash
# yt-dlp (for YouTube and social media)
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ~/bin/yt-dlp
sudo chmod a+rx ~/bin/yt-dlp

# get_iplayer (for BBC iPlayer)
git clone https://github.com/get-iplayer/get_iplayer.git ~/get_iplayer
sudo apt-get install libwww-perl liblwp-protocol-https-perl libxml-libxml-perl ffmpeg atomicparsley

# qBittorrent (for torrents)
sudo apt-get install -y qbittorrent-nox
```

**2. Get MediaVault:**

```bash
git clone https://github.com/wyattfantana/media-vault.git
cd media-vault
npm install
```

**3. Set up the database:**

```bash
# Start PostgreSQL in WSL2 (recommended for all-in-one setup)
sudo service postgresql start

# Create mediavault user and database
sudo -u postgres psql <<EOF
CREATE USER mediavault WITH PASSWORD 'mediavault123';
CREATE DATABASE mediavault OWNER mediavault;
\q
EOF

# Configure PostgreSQL for password authentication
sudo sed -i 's/^local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/16/main/pg_hba.conf
sudo service postgresql reload

# Run the migrations (this creates all the tables)
cd apps/api
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/002_create_media_tables.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/003_create_bookmarks_table.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/004_create_presets_table.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/005_add_platform_to_presets.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/006_add_jellyfin_formatting_columns.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/007_add_qbittorrent_downloader.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/008_add_quality_format_columns.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/009_create_user_preferences.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/010_add_vpn_preferences.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/014_add_iplayer_to_jellyfin_paths.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/015_convert_jellyfin_paths_to_array.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/016_add_api_keys_and_paths.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/017_add_tmdb_watchlist_support.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/018_add_tmdb_id_to_downloads.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/019_add_tmdb_id_to_media.sql
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/020_add_missing_user_columns.sql

# Run Better Auth migration (creates user and session tables)
npm run migration:run
```

**4. Configure your settings:**

Create a file at `apps/api/.env` with these settings:

```bash
# Database (using Unix socket for WSL2)
POSTGRES_HOST=/var/run/postgresql
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=mediavault
POSTGRES_PASSWORD=mediavault123

# Get a free TMDB API key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key

# Where to save downloads
DOWNLOAD_DIR=/home/yourusername/downloads

# Tool paths (optional - these are the defaults)
YTDLP_PATH=/home/yourusername/bin/yt-dlp
GET_IPLAYER_PATH=/home/yourusername/get_iplayer/get_iplayer

# Other settings (use these defaults)
PORT=3001
BETTER_AUTH_SECRET=change_this_to_random_text
BETTER_AUTH_URL=http://localhost:3001
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin
```

Create `apps/web/.env`:
```bash
VITE_API_URL=http://localhost:3001
```

**5. Start MediaVault:**

```bash
~/start-mediavault.sh
```

This starts everything you need and keeps it running in the background.

**6. Open your browser:**

Go to **http://localhost:5173** and create your account!

---

## 📖 How to Use

1. **Sign up** - Create your account on the home page
2. **Browse** - Use the Discover tab to find movies, TV shows, or BBC programmes
3. **Download** - Click download on anything you like, or paste a YouTube/torrent link
4. **Watch** - Files are automatically organized in your downloads folder, ready for Jellyfin or any media player

---

## 🔒 VPN Setup (Optional but Recommended)

MediaVault integrates with **Windows Mullvad VPN** for automatic torrent protection.

**How it works:**
- Install [Mullvad VPN](https://mullvad.net/) on Windows (not in WSL2)
- MediaVault automatically detects and uses it
- All WSL2 traffic (including torrents) routes through the VPN thanks to mirrored networking
- One-click toggle in the sidebar to connect/disconnect
- VPN status displayed with server location and IP

**No binding needed!** - Unlike traditional setups, qBittorrent doesn't need to bind to a VPN interface. When Mullvad is connected on Windows, all WSL2 traffic automatically uses it.

**Features:**
- ✅ Sidebar toggle - Connect/disconnect with one click
- ✅ Real-time status - See connection state, server, and IP
- ✅ Auto-connect - Automatically connect before torrent downloads
- ✅ Require VPN - Block torrents unless VPN is active
- ✅ Traffic verification - Test endpoint confirms protection

---

## 🤖 *arr Services Integration (Optional - Advanced Automation)

MediaVault now integrates with the **\*arr stack** for automated movie and TV series management!

**What are \*arr services?**
- **Radarr** - Automatically finds, downloads, and organizes movies
- **Sonarr** - Automatically finds, downloads, and organizes TV series
- **Prowlarr** - Manages all your torrent indexers in one place
- **Recyclarr** - Automatically syncs quality settings from TRaSH guides

### Installation

**1. Install Docker Compose (if not already installed):**

```bash
# For WSL2/Ubuntu
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

**2. Start the \*arr services:**

The start script will automatically start all \*arr services when you run:

```bash
~/start-mediavault.sh
```

**3. Configure each service:**

After starting, visit each service's web interface to complete setup:

- **Prowlarr** (http://localhost:9696) - Set up first
  - Copy the API key from Settings > General
  - Add indexers (Settings > Indexers > Add Indexer)
  - Common indexers: 1337x, ThePirateBay, RARBG, etc.

- **Radarr** (http://localhost:7878) - Movies
  - Copy the API key from Settings > General
  - Add a root folder: Settings > Media Management > Add Root Folder (`/downloads/Movies`)
  - Set up quality profiles: Settings > Profiles

- **Sonarr** (http://localhost:8989) - TV Series
  - Copy the API key from Settings > General
  - Add a root folder: Settings > Media Management > Add Root Folder (`/downloads/TV`)
  - Set up quality profiles: Settings > Profiles

**4. Connect Prowlarr to Radarr/Sonarr:**

In Prowlarr:
- Go to Settings > Apps > Add Application
- Select Radarr or Sonarr
- Enter the URL: `http://radarr:7878` or `http://sonarr:8989`
- Paste the API key from step 3
- Test and Save

**5. Configure in MediaVault:**

- Go to Settings in MediaVault
- Scroll to the \*arr Services section
- Enable each service and paste its API key
- Save settings

### How It Works

Once configured, you can:

1. **Browse movies/TV shows** in MediaVault's Discover page
2. **Click "Add to Radarr"** or **"Add to Sonarr"** on any title
3. The \*arr service will:
   - Search your configured indexers
   - Find the best quality release
   - Download it via qBittorrent
   - Organize it with proper naming (e.g., `Movie Title (2023).mkv`)
   - Update Jellyfin automatically

### Benefits

- ✅ **Automatic quality selection** - Based on your preferences
- ✅ **Proper file naming** - Ready for Jellyfin
- ✅ **Upgrade handling** - Automatically replaces files when better quality is available
- ✅ **Season monitoring** - Get new episodes automatically
- ✅ **Failed download handling** - Automatically tries alternative releases
- ✅ **Import management** - Moves and renames files automatically

### Recyclarr (Quality Management)

Recyclarr automatically applies community-recommended quality settings from [TRaSH Guides](https://trash-guides.info/).

The configuration is pre-set in `data/recyclarr/recyclarr.yml` - just add your API keys and run:

```bash
docker exec recyclarr recyclarr sync
```

This will optimize your quality profiles for the best balance of quality and file size.

---

## ⚙️ Managing Services

MediaVault runs several services in the background. Here's how to control them:

**View what's running:**
```bash
tmux ls
```

**Check the logs:**
```bash
tmux attach -t mediavault    # See API and web interface logs
tmux attach -t qbittorrent   # See torrent client logs
```

Press `Ctrl+B` then `D` to exit without stopping the services.

**Stop everything:**
```bash
tmux kill-session -t mediavault
tmux kill-session -t qbittorrent
```

**Access points:**
- MediaVault: http://localhost:5173
- qBittorrent: http://localhost:8080 (login: admin/adminadmin)

---

## ❓ Troubleshooting

**Login/Register not working? (Error about missing columns)**
If you see errors about missing `twoFactorEnabled`, `banReason`, or `banExpires` columns, your database needs migration 020:
```bash
cd apps/api
PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < src/migrations/020_add_missing_user_columns.sql
```

**Downloads not starting?**
The worker might not be running. Restart with `~/start-mediavault.sh`

**Port already in use?**
```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null  # Kill process on port 3001
lsof -ti:5173 | xargs kill -9 2>/dev/null  # Kill process on port 5173
```

**Database won't connect?**
```bash
sudo service postgresql start  # Start PostgreSQL
```

**Can't find downloads?**
Check your `DOWNLOAD_DIR` in `apps/api/.env` - that's where files are saved.

---

## ℹ️ What Works (and what doesn't)

### ✅ Works Great
- BBC iPlayer (all TV and radio)
- YouTube (videos, channels, playlists)
- SoundCloud
- Torrents (magnet links and .torrent files)
- TikTok, Reddit, Twitch
- 1000+ other sites via yt-dlp

### ❌ Doesn't Work
- Channel 4, ITVX, My5 (DRM-protected)
- Rumble (temporarily broken, awaiting yt-dlp fix)
- Age-restricted YouTube (needs cookie authentication)

### ⚠️ Limitations
- Downloads process 3 at a time (configurable)
- Can't cancel in-progress downloads (only pending ones)

---

## 🛠️ Tech Stack

For developers interested in what's under the hood:

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Express + TypeScript + PostgreSQL
- **Authentication:** Better Auth (email/password sessions)
- **APIs:** TMDB API, YouTube Data API, BBC iPlayer API
- **Download Tools:** yt-dlp, get_iplayer, qBittorrent-nox
- **Architecture:** Turborepo monorepo

---

## 📁 Project Structure

```
media-vault/
├── apps/
│   ├── api/          # Backend server (port 3001)
│   └── web/          # Frontend interface (port 5173)
├── downloads/        # Your downloaded media files
│   ├── Movies/
│   ├── TV/
│   ├── Music/
│   └── Documentaries/
```

---

## 📄 License

MIT License - Feel free to use and modify!

---

## 🙏 Credits

Built with:
- **yt-dlp** - Universal video downloader (1000+ sites)
- **get_iplayer** - BBC iPlayer downloader
- **qBittorrent** - Torrent client
- **TMDB** - Movie database API

---

**Made with ❤️ for people who want control over their media collection**

**Status:** Fully operational - Download, organize, and enjoy!
