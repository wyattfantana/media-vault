# MediaVault

A personal media management system for discovering, downloading, and organizing movies, TV shows, and documentaries.

## Features

### Discovery
- **Movies** - Browse 800,000+ movies from TMDB with ratings, posters, and metadata
- **TV Shows** - 210,000+ TV series with episode information
- **Documentaries** - Curated documentary discovery with genre filtering

### Advanced Filtering
- **By Person** - Filter by actor, director, or creator
- **By Network/Studio** - Find content from HBO, Netflix, BBC, etc.
- **By Genre** - Action, Comedy, Drama, Sci-Fi, and more
- **Quality Presets** - Quick filters for highly-rated content (7.5+, 6.5+, etc.)
- **Year Range** - Filter by release year
- **Rating/Votes** - Minimum rating and vote count thresholds
- **Country** - Filter by origin country, English-only option

### Downloads
- **Torrent Search** - Integrated Prowlarr search across multiple indexers
- **Quality Selection** - Choose 4K, 1080p, 720p, or let it auto-select
- **qBittorrent Integration** - Direct magnet link handling
- **Progress Tracking** - Real-time download status in the Downloads page
- **Auto-Organization** - Files sorted into Movies/, TV/, Documentaries/ folders
- **Jellyfin Naming** - Proper naming format (Movie (Year), Show S01E01)

### Additional Sources
- **BBC iPlayer** - Download TV and radio programmes (UK)
- **YouTube** - Videos, channels, and playlists
- **SoundCloud** - Tracks and playlists
- **TikTok, Reddit, Twitch** - Social media content
- **1000+ sites** - Anything supported by yt-dlp

### Extras
- **Favorites** - Bookmark movies and shows to watch later
- **VPN Toggle** - One-click Mullvad VPN connection for torrent protection
- **Subtitle Support** - Bazarr integration for automatic subtitle downloads
- **Multi-user** - Account system with email/password authentication

---

## Requirements

- Node.js 20+
- PostgreSQL
- qBittorrent-nox
- yt-dlp
- get_iplayer (for BBC content)
- Docker (for Prowlarr/Bazarr)

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/wyattfantana/media-vault.git
cd media-vault
npm install
```

### 2. Set up PostgreSQL

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mediavault WITH PASSWORD 'mediavault123';"
sudo -u postgres psql -c "CREATE DATABASE mediavault OWNER mediavault;"
```

### 3. Run migrations

```bash
cd apps/api
for f in src/migrations/*.sql; do
  PGPASSWORD=mediavault123 psql -h /var/run/postgresql -U mediavault -d mediavault < "$f"
done
npm run migration:run
```

### 4. Configure environment

Create `apps/api/.env`:

```bash
POSTGRES_HOST=/var/run/postgresql
POSTGRES_DB=mediavault
POSTGRES_USER=mediavault
POSTGRES_PASSWORD=mediavault123

TMDB_API_KEY=your_tmdb_api_key  # Get free at themoviedb.org
DOWNLOAD_DIR=/path/to/downloads

PORT=3001
BETTER_AUTH_SECRET=random_secret_string
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

### 5. Start services

```bash
# Start PostgreSQL
sudo service postgresql start

# Start qBittorrent
qbittorrent-nox --webui-port=8080 &

# Start Prowlarr (optional, for torrent search)
docker compose up -d prowlarr

# Start MediaVault
npm run dev
```

### 6. Open browser

Go to **http://localhost:5173** and create an account.

---

## Configuration

### Prowlarr (Torrent Search)

1. Open Prowlarr at http://localhost:9696
2. Add indexers (1337x, ThePirateBay, etc.)
3. Copy API key from Settings > General
4. In MediaVault Settings, enable Prowlarr and paste the API key

### Bazarr (Subtitles)

1. Start Bazarr: `docker compose up -d bazarr`
2. Open Bazarr at http://localhost:6767
3. Configure subtitle providers (OpenSubtitles, etc.)
4. Copy API key from Settings > General
5. In MediaVault Settings, enable Bazarr and paste the API key

### VPN (Mullvad)

Install Mullvad VPN on Windows. MediaVault auto-detects it and provides a sidebar toggle. All WSL2 traffic routes through VPN when connected.

---

## Usage

1. **Browse** - Use Movies, TV Shows, or Documentaries tabs
2. **Filter** - Apply filters for actor, genre, rating, etc.
3. **Download** - Click a title, search torrents, select quality
4. **Track** - Monitor progress in Downloads page
5. **Watch** - Files are organized in your download directory

---

## Project Structure

```
media-vault/
├── apps/
│   ├── api/        # Express backend (port 3001)
│   ├── web/        # React frontend (port 5173)
│   └── worker/     # Background download processor
├── data/           # Docker volume data (Prowlarr, Bazarr, etc.)
└── docker-compose.yml
```

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Express, TypeScript, PostgreSQL, TypeORM
- **Auth**: Better Auth
- **APIs**: TMDB, Prowlarr, Bazarr, qBittorrent
- **Tools**: yt-dlp, get_iplayer, qBittorrent-nox
- **Build**: Turborepo

---

## Troubleshooting

**Database connection failed**
```bash
sudo service postgresql start
```

**Port in use**
```bash
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**Downloads not processing**
Restart the worker: `npm run dev`

---

## License

MIT
