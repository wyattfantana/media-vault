# MediaVault - Quick Start Guide

Get MediaVault running in 5 minutes!

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 14
- yt-dlp installed at `~/bin/yt-dlp`
- get_iplayer installed at `~/get_iplayer/get_iplayer`
- qBittorrent-nox for torrent downloads

## 1. Clone and Install

```bash
git clone https://github.com/wyattfantana/media-vault.git ~/projects/media-vault
cd ~/projects/media-vault
npm install
```

## 2. Set Up Database

```bash
# Start PostgreSQL (if using WSL)
sudo service postgresql start

# Create database
createdb mediavault

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'mediavault123';"
```

## 3. Configure Environment

Create `~/projects/media-vault/.env`:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=postgres
POSTGRES_PASSWORD=mediavault123

# Server
PORT=3001
NODE_ENV=development

# Better Auth
BETTER_AUTH_SECRET=your_random_secret_key_here
BETTER_AUTH_URL=http://localhost:3001

# TMDB API (for movie/TV browsing) - Get free key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key

# YouTube API (optional)
YOUTUBE_API_KEY=your_youtube_api_key

# qBittorrent Web API
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

# Download paths
DOWNLOAD_DIR=/home/beerm/downloads
YTDLP_PATH=/home/beerm/bin/yt-dlp
GET_IPLAYER_PATH=/home/beerm/get_iplayer/get_iplayer
```

## 4. Run Database Migrations

```bash
cd ~/projects/media-vault/apps/api
npx tsx src/scripts/migrate-better-auth.ts
psql mediavault < src/migrations/002_create_media_tables.sql
psql mediavault < src/migrations/003_create_bookmarks_table.sql
psql mediavault < src/migrations/004_create_presets_table.sql
psql mediavault < src/migrations/005_add_platform_to_presets.sql
psql mediavault < src/migrations/006_add_jellyfin_formatting_columns.sql
psql mediavault < src/migrations/007_add_qbittorrent_downloader.sql
psql mediavault < src/migrations/008_add_quality_format_columns.sql
psql mediavault < src/migrations/009_create_user_preferences.sql
```

## 5. Start MediaVault

### Option A: Using the Startup Script (Recommended)

The startup script runs all services in tmux sessions that persist even when you close your terminal:

```bash
~/start-mediavault.sh
```

This will start:
- qBittorrent Web UI on http://localhost:8080
- MediaVault API on http://localhost:3001
- MediaVault Web on http://localhost:5173

**View logs:**
```bash
tmux attach -t mediavault    # View API & Web logs
tmux attach -t qbittorrent   # View qBittorrent logs
```

**Detach from tmux:** Press `Ctrl+B`, then `D`

**Stop services:**
```bash
tmux kill-session -t mediavault
tmux kill-session -t qbittorrent
```

### Option B: Manual Start

If you prefer to run services manually:

```bash
# Terminal 1: Start qBittorrent
qbittorrent-nox --webui-port=8080 --confirm-legal-notice

# Terminal 2: Start MediaVault services
cd ~/projects/media-vault
npx turbo dev --filter=api --filter=web --filter=worker
```

## 6. Access MediaVault

Open your browser to: **http://localhost:5173**

1. Sign up for an account
2. Start browsing and downloading content!

## URLs

- **Web UI**: http://localhost:5173
- **API**: http://localhost:3001
- **qBittorrent**: http://localhost:8080 (default: admin/adminadmin)

## Keeping Services Running

Services running in tmux will:
- ✅ Keep running when you close the terminal
- ✅ Persist until you explicitly stop them
- ✅ Survive WSL restarts (will auto-resume)
- ⚠️ Stop if Windows goes to sleep (set power settings to "Never")

## Troubleshooting

### Services not starting?
Check if ports are already in use:
```bash
ss -tlnp | grep -E ":(3001|5173|8080)"
```

### Database connection failed?
```bash
sudo service postgresql status
sudo service postgresql start
```

### Check if services are running:
```bash
tmux ls  # List tmux sessions
ps aux | grep -E "(node|qbittorrent)" | grep -v grep
```

## Next Steps

- See [README.md](./README.md) for full documentation and technical details
- Configure download paths in qBittorrent Web UI
- Add your TMDB API key for movie/TV browsing
