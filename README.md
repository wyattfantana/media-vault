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
# Create the database
createdb mediavault

# Run the setup (this creates all the tables)
cd apps/api
npx tsx src/scripts/migrate-better-auth.ts
psql mediavault < src/migrations/002_create_media_tables.sql
psql mediavault < src/migrations/003_create_bookmarks_table.sql
psql mediavault < src/migrations/004_create_presets_table.sql
psql mediavault < src/migrations/005_add_platform_to_presets.sql
psql mediavault < src/migrations/006_add_jellyfin_formatting_columns.sql
```

**4. Configure your settings:**

Create a file at `apps/api/.env` with these settings:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Get a free TMDB API key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key

# Where to save downloads
DOWNLOAD_DIR=/home/yourusername/downloads

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
