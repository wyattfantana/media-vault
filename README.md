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
- **Auto-Organization** - Files sorted into Movies/, TV Shows/, Documentaries/ folders
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
- Docker (for Prowlarr, Bazarr, Sonarr, Radarr, FlareSolverr)
- Jellyfin (for media streaming)

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

### 5. Start all services

Run the startup script to launch everything in tmux sessions:

```bash
~/start-mediavault.sh
```

This starts:
- PostgreSQL database
- Docker services (Prowlarr, Bazarr, Sonarr, Radarr, FlareSolverr)
- qBittorrent in a tmux session
- MediaVault (API + Web + Worker) in a tmux session
- Jellyfin media server

### 6. Open browser

Go to **http://localhost:5173** and create an account.

---

## Docker Services

MediaVault uses several Docker containers for media management:

### Prowlarr (Port 9696)
Indexer manager that aggregates torrent and usenet indexers. When you search for a movie or TV show in MediaVault, Prowlarr queries multiple sources (1337x, ThePirateBay, etc.) simultaneously.

### FlareSolverr (Port 8191)
Cloudflare bypass proxy. Many torrent sites use Cloudflare protection - FlareSolverr solves the challenges automatically so Prowlarr can access them.

### Sonarr (Port 8989)
TV show library manager. Tracks your TV show collection and provides metadata to Bazarr for subtitle matching. Required for Bazarr to find subtitles for TV episodes.

### Radarr (Port 7878)
Movie library manager. Same as Sonarr but for movies. Required for Bazarr to find subtitles for movies.

### Bazarr (Port 6767)
Subtitle manager that automatically downloads subtitles from providers like OpenSubtitles. Works with Sonarr/Radarr to match subtitles to your media files.

---

## Jellyfin Media Server

Jellyfin is your personal streaming platform - like having your own Netflix.

### How it works

1. **Library Scanning** - Point Jellyfin at your download folders (Movies/, TV Shows/, Documentaries/). It scans the files and fetches metadata, artwork, and descriptions automatically.

2. **Stream Anywhere** - Once scanned, stream to any device:
   - **Home Network**: Any device on your WiFi - smart TVs, phones, tablets, game consoles
   - **Apps**: Jellyfin has apps for iOS, Android, Roku, Fire TV, Apple TV, Samsung/LG TVs
   - **Web**: Access via browser at http://localhost:8096

### Streaming Outside Your Home

To access your media when away from home:

**Option 1: Tailscale (Recommended)**

Tailscale creates a secure mesh VPN between your devices. No port forwarding needed.

1. Install Tailscale on Windows: https://tailscale.com/download/windows
2. Sign up with Google/Microsoft/GitHub (free)
3. Install Tailscale on your phone/tablet
4. Sign in with same account

**WSL2 Setup (if running Jellyfin in Docker on WSL2):**

Tailscale runs on Windows but Jellyfin is in WSL2, so you need subnet routing:

```powershell
# Run in PowerShell as Admin
tailscale up --advertise-routes=192.168.0.0/24
```

Then go to https://login.tailscale.com → find your PC → approve the subnet route.

Now access Jellyfin from anywhere using your local IP:
```
http://192.168.x.x:8096
```

Find your PC's local IP with `ipconfig` in Command Prompt.

**Option 2: Port Forwarding**

Forward port 8096 on your router to your Jellyfin server. Access via your public IP or a dynamic DNS service (DuckDNS, No-IP, etc.).

**Option 3: NAS Setup**

Run MediaVault and Jellyfin on a NAS (Synology, QNAP, Unraid, etc.):
- Always-on hardware designed for 24/7 operation
- Built-in remote access features (Synology QuickConnect, etc.)
- RAID for data protection
- Lower power consumption than a full PC

---

## Configuration

### Prowlarr (Torrent Search)

1. Open Prowlarr at http://localhost:9696
2. Add indexers (1337x, ThePirateBay, etc.)
3. For Cloudflare-protected sites, add FlareSolverr as a proxy (http://flaresolverr:8191)
4. Copy API key from Settings > General
5. In MediaVault Settings, enable Prowlarr and paste the API key

### Bazarr (Subtitles)

1. Open Bazarr at http://localhost:6767
2. Add Sonarr connection (http://sonarr:8989 + API key from Sonarr)
3. Add Radarr connection (http://radarr:7878 + API key from Radarr)
4. Configure subtitle providers (OpenSubtitles, etc.)
5. Copy API key from Settings > General
6. In MediaVault Settings, enable Bazarr and paste the API key

### VPN (Mullvad)

Install Mullvad VPN on Windows. MediaVault auto-detects it and provides a sidebar toggle. All WSL2 traffic routes through VPN when connected.

---

## Usage

1. **Browse** - Use Movies, TV Shows, or Documentaries tabs
2. **Filter** - Apply filters for actor, genre, rating, etc.
3. **Download** - Click a title, search torrents, select quality
4. **Track** - Monitor progress in Downloads page
5. **Watch** - Open Jellyfin, scan your libraries, and stream to any device

---

## URLs

| Service      | URL                    | Purpose                    |
|--------------|------------------------|----------------------------|
| Web UI       | http://localhost:5173  | MediaVault frontend        |
| API          | http://localhost:3001  | MediaVault backend         |
| qBittorrent  | http://localhost:8080  | Torrent client             |
| Jellyfin     | http://localhost:8096  | Media streaming            |
| Prowlarr     | http://localhost:9696  | Indexer management         |
| Bazarr       | http://localhost:6767  | Subtitle management        |
| Sonarr       | http://localhost:8989  | TV show tracking           |
| Radarr       | http://localhost:7878  | Movie tracking             |

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

## tmux Sessions

MediaVault runs in tmux sessions so it keeps running after you close the terminal.

```bash
# View MediaVault logs
tmux attach -t mediavault

# View qBittorrent logs
tmux attach -t qbittorrent

# Detach from tmux (keep running)
Ctrl+B, then D

# Stop everything
~/stop-mediavault.sh
```

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Express, TypeScript, PostgreSQL, TypeORM
- **Auth**: Better Auth
- **APIs**: TMDB, Prowlarr, Bazarr, Sonarr, Radarr, qBittorrent
- **Tools**: yt-dlp, get_iplayer, qBittorrent-nox
- **Streaming**: Jellyfin
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
Restart the worker: `~/start-mediavault.sh`

**Docker services not starting**
```bash
sudo service docker start
docker compose up -d
```

---

## License

MIT
