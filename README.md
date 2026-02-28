# MediaVault

A personal media management system for discovering, downloading, and organising movies, TV shows, documentaries, music and more. Browse 800,000+ titles via TMDB, search torrents through Prowlarr, download via qBittorrent or yt-dlp, and stream everything through Jellyfin.

---

## What It Does

- **Browse** — Movies, TV Shows, Documentaries via TMDB with filters (genre, rating, actor, network, year, country)
- **Search Torrents** — Integrated Prowlarr search across multiple indexers with quality selection (4K, 1080p, 720p)
- **Download** — qBittorrent for torrents, yt-dlp for YouTube/SoundCloud/TikTok/1000+ sites, get_iplayer for BBC iPlayer
- **Stream** — Jellyfin media server, accessible from any device on your network
- **Subtitles** — Bazarr automatically downloads subtitles via Sonarr/Radarr integration
- **Favourites** — Bookmark titles to watch later
- **Multi-user** — Account system with email/password auth

---

## Architecture

```
media-vault/
├── apps/
│   ├── api/        # Express backend (port 3001)
│   ├── web/        # React frontend (port 5173)
│   └── worker/     # Background download processor
├── data/           # Docker volume data (auto-created)
├── scripts/
│   ├── start-mediavault.sh
│   └── stop-mediavault.sh
└── docker-compose.yml
```

**Docker services** (managed separately via docker-compose):

| Service | Port | Purpose |
|---|---|---|
| Jellyfin | 8096 | Media streaming server |
| Prowlarr | 9696 | Torrent indexer aggregator |
| Sonarr | 8989 | TV show library manager |
| Radarr | 7878 | Movie library manager |
| Bazarr | 6767 | Subtitle downloader |
| FlareSolverr | 8191 | Cloudflare bypass for Prowlarr |

---

## Requirements

- **OS:** Ubuntu 22.04+ or WSL2 (Ubuntu) on Windows
- **Node.js** 20+
- **npm** 10+
- **PostgreSQL** 14+
- **Docker Engine** + Docker Compose plugin
- **tmux**
- **qbittorrent-nox**
- **Media directory** — a folder where downloads will be saved (e.g. `/mnt/d/MediaVault` on WSL2 or `/home/user/MediaVault` on Linux)

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/wyattfantana/media-vault.git
cd media-vault
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Install system dependencies

```bash
# PostgreSQL (if not already installed)
sudo apt-get install -y postgresql

# Docker Engine
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
ARCH=$(dpkg --print-architecture)
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
sudo bash -c "echo 'deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable' > /etc/apt/sources.list.d/docker.list"
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to the docker group
sudo usermod -aG docker $USER

# qBittorrent headless
sudo apt-get install -y qbittorrent-nox

# tmux
sudo apt-get install -y tmux

# sqlite3 (useful for debugging)
sudo apt-get install -y sqlite3
```

### 4. Start PostgreSQL and create the database

```bash
sudo service postgresql start
```

Create the database. Replace `your_password` with your postgres password (default is often `postgres`):

```bash
PGPASSWORD=your_password psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE mediavault;"
```

### 5. Configure your media directory

Create the folders where downloads will be saved. Adjust the path to wherever you want your media stored:

```bash
# Example: local Linux path
MEDIA_DIR="$HOME/MediaVault"

# Example: WSL2 with Windows D: drive
# MEDIA_DIR="/mnt/d/MediaVault"

mkdir -p "$MEDIA_DIR/Movies"
mkdir -p "$MEDIA_DIR/TV Shows"
mkdir -p "$MEDIA_DIR/Documentaries"
mkdir -p "$MEDIA_DIR/Music"
mkdir -p "$MEDIA_DIR/iplayer"
```

**Important on WSL2:** Make sure your user owns the media directory:

```bash
sudo chown -R $USER:$USER /mnt/d/MediaVault
```

### 6. Update docker-compose.yml media paths

Open `docker-compose.yml` and replace all `/mnt/d/MediaVault` references with your actual media directory path:

```yaml
volumes:
  - /your/media/path:/data
  - /your/media/path:/media
  - /your/media/path/Movies:/movies
  - /your/media/path/TV Shows:/tv
  - /your/media/path/Documentaries:/documentaries
  - /your/media/path/Music:/music
  - /your/media/path/iplayer:/iplayer
```

### 7. Create environment files

**`apps/api/.env`** — copy and fill in your values:

```bash
# Database
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Auth (generate a random 32+ char string for BETTER_AUTH_SECRET)
BETTER_AUTH_SECRET=change_this_to_a_random_string_at_least_32_chars
BETTER_AUTH_URL=http://localhost:3001

# Admin panel credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
SESSION_SECRET=change_this_to_a_random_string

# TMDB — get a free API key at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key

# Download directory (must match your media directory from step 5)
DOWNLOAD_DIR=/your/media/path

# qBittorrent (fill in after step 10)
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=admin

# Prowlarr (fill in after step 12)
PROWLARR_HOST=localhost
PROWLARR_PORT=9696
PROWLARR_API_KEY=

# Sonarr (fill in after step 12)
SONARR_HOST=localhost
SONARR_PORT=8989
SONARR_API_KEY=

# Radarr (fill in after step 12)
RADARR_HOST=localhost
RADARR_PORT=7878
RADARR_API_KEY=

# Bazarr (fill in after step 12)
BAZARR_HOST=localhost
BAZARR_PORT=6767
BAZARR_API_KEY=
```

**`apps/web/.env`**:

```bash
VITE_API_URL=http://localhost:3001
VITE_JELLYFIN_URL=http://localhost:8096
VITE_QBITTORRENT_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:3001
VITE_ENABLE_VPN_CHECK=true
VITE_ENABLE_TORRENT_SEARCH=true
```

**`apps/worker/.env`**:

```bash
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=mediavault
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
```

### 8. Run database migrations

This must be done in two steps:

```bash
# Step 1: TypeORM schema migration
cd apps/api
npm run migration:run
cd ../..

# Step 2: Better Auth tables (user, session, account, etc.)
cd apps/api
npx tsx src/scripts/migrate-better-auth.ts
cd ../..
```

The SQL migrations in `apps/api/src/migrations/` run automatically when the API first starts.

### 9. Set up qBittorrent

Start qBittorrent once to generate its config:

```bash
qbittorrent-nox --daemon
sleep 3
pkill -f qbittorrent-nox
```

Set your desired WebUI password by adding a `[Preferences]` section to `~/.config/qBittorrent/qBittorrent.conf`. The easiest way is to generate a PBKDF2 hash:

```bash
python3 - << 'EOF'
import hashlib, os, base64
password = b'admin'  # change to your desired password
salt = os.urandom(16)
key = hashlib.pbkdf2_hmac('sha512', password, salt, 100000)
print(f"[Preferences]")
print(f"WebUI\\Username=admin")
print(f"WebUI\\Password_PBKDF2=@ByteArray({base64.b64encode(salt).decode()}:{base64.b64encode(key).decode()})")
print(f"WebUI\\LocalHostAuth=false")
EOF
```

Prepend that output to `~/.config/qBittorrent/qBittorrent.conf`.

### 10. Start Docker services

```bash
sudo service docker start
cd /path/to/media-vault
sudo docker compose up -d
```

Wait ~30 seconds for all containers to initialise.

### 11. Disable authentication in Prowlarr, Sonarr, Radarr

The *arr services start with authentication enabled but no users — this causes a DryIoc error. Fix it by setting `AuthenticationMethod` to `None`:

> **Important:** Set `AuthenticationRequired` to `Enabled` (not `Disabled`) — using `Disabled` causes a DryIoc crash on Sonarr/Radarr.

```bash
for service in prowlarr sonarr radarr; do
  FILE="data/$service/config.xml"
  sed -i 's|<AuthenticationMethod>Forms</AuthenticationMethod>|<AuthenticationMethod>None</AuthenticationMethod>|g' "$FILE"
  sed -i 's|<AuthenticationRequired>Enabled</AuthenticationRequired>|<AuthenticationRequired>Enabled</AuthenticationRequired>|g' "$FILE"
  echo "Updated $service"
done

sudo docker restart prowlarr sonarr radarr
```

### 12. Collect API keys from the *arr services

After the containers have restarted, grab the auto-generated API keys:

```bash
echo "Prowlarr: $(grep -oP '(?<=<ApiKey>)[^<]+' data/prowlarr/config.xml)"
echo "Sonarr:   $(grep -oP '(?<=<ApiKey>)[^<]+' data/sonarr/config.xml)"
echo "Radarr:   $(grep -oP '(?<=<ApiKey>)[^<]+' data/radarr/config.xml)"
echo "Bazarr:   $(grep -oP 'apikey: \K\S+' data/bazarr/config/config.yaml | head -1)"
```

Paste these into your `apps/api/.env` file.

### 13. Set up FlareSolverr in Prowlarr

Many torrent indexers are protected by Cloudflare. FlareSolverr bypasses this automatically.

Run this script to add FlareSolverr as a proxy and create a `cloudflare` tag in Prowlarr:

```bash
PROWLARR_KEY=$(grep -oP '(?<=<ApiKey>)[^<]+' data/prowlarr/config.xml)

# Create cloudflare tag
curl -s -X POST -H "X-Api-Key: $PROWLARR_KEY" -H "Content-Type: application/json" \
  -d '{"label":"cloudflare"}' http://localhost:9696/api/v1/tag

# Add FlareSolverr proxy (uses Docker internal hostname)
curl -s -X POST -H "X-Api-Key: $PROWLARR_KEY" -H "Content-Type: application/json" \
  -d '{
    "name": "FlareSolverr",
    "implementation": "FlareSolverr",
    "configContract": "FlareSolverrSettings",
    "tags": [1],
    "fields": [
      {"name": "host", "value": "http://flaresolverr:8191/"},
      {"name": "requestTimeout", "value": 60}
    ]
  }' http://localhost:9696/api/v1/indexerProxy
```

When adding indexers in Prowlarr, tag any Cloudflare-protected indexers (e.g. 1337x, KickassTorrents, LimeTorrents, TorrentGalaxy, EZTV) with the `cloudflare` tag.

### 14. Connect Sonarr and Radarr to Prowlarr

This lets Prowlarr push indexers to Sonarr and Radarr automatically. Run:

```bash
PROWLARR_KEY=$(grep -oP '(?<=<ApiKey>)[^<]+' data/prowlarr/config.xml)
SONARR_KEY=$(grep -oP '(?<=<ApiKey>)[^<]+' data/sonarr/config.xml)
RADARR_KEY=$(grep -oP '(?<=<ApiKey>)[^<]+' data/radarr/config.xml)

# Add Sonarr — uses Docker internal hostname, not localhost
curl -s -X POST -H "X-Api-Key: $PROWLARR_KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"Sonarr\",\"implementation\":\"Sonarr\",\"configContract\":\"SonarrSettings\",\"syncLevel\":\"fullSync\",\"tags\":[],\"fields\":[{\"name\":\"apiKey\",\"value\":\"$SONARR_KEY\"},{\"name\":\"baseUrl\",\"value\":\"http://sonarr:8989\"},{\"name\":\"prowlarrUrl\",\"value\":\"http://prowlarr:9696\"}]}" \
  http://localhost:9696/api/v1/applications

# Add Radarr
curl -s -X POST -H "X-Api-Key: $PROWLARR_KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"Radarr\",\"implementation\":\"Radarr\",\"configContract\":\"RadarrSettings\",\"syncLevel\":\"fullSync\",\"tags\":[],\"fields\":[{\"name\":\"apiKey\",\"value\":\"$RADARR_KEY\"},{\"name\":\"baseUrl\",\"value\":\"http://radarr:7878\"},{\"name\":\"prowlarrUrl\",\"value\":\"http://prowlarr:9696\"}]}" \
  http://localhost:9696/api/v1/applications
```

> **Why Docker hostnames?** Prowlarr runs inside Docker and cannot reach `localhost` on the host machine. Use the Docker service names (`sonarr`, `radarr`, `prowlarr`, `flaresolverr`) when containers need to talk to each other.

### 15. Set up Jellyfin

**a) Complete the setup wizard**

On WSL2, Jellyfin is not directly reachable via `localhost` from Windows — use the WSL2 IP:

```bash
ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
```

Open `http://<WSL2-IP>:8096` in your Windows browser and complete the wizard:
- Create an admin account
- Add media libraries pointing to the container paths: `/movies`, `/tv`, `/documentaries`, `/music`, `/iplayer`

> **WSL2 note:** The IP changes on every reboot. Use it for all Docker service URLs from your Windows browser.

**b) Get your API key**

In Jellyfin: Dashboard → API Keys → `+` → name it `media-vault` → copy the key.

**c) Create libraries via API** (if you skipped the wizard library setup)

```bash
JKEY=your_jellyfin_api_key

for lib in "Movies:movies:movies" "TV Shows:tvshows:tv" "Documentaries:movies:documentaries" "Music:music:music" "iPlayer:tvshows:iplayer"; do
  NAME=$(echo $lib | cut -d: -f1)
  TYPE=$(echo $lib | cut -d: -f2)
  PATH_=$(echo $lib | cut -d: -f3)
  curl -s -X POST \
    -H "Authorization: MediaBrowser Token=\"$JKEY\"" \
    -H "Content-Type: application/json" \
    "http://localhost:8096/Library/VirtualFolders?name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$NAME'))")&collectionType=$TYPE&refreshLibrary=false" \
    -d '{"LibraryOptions":{"EnableRealtimeMonitor":true}}'
  curl -s -X POST \
    -H "Authorization: MediaBrowser Token=\"$JKEY\"" \
    -H "Content-Type: application/json" \
    "http://localhost:8096/Library/VirtualFolders/Paths?name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$NAME'))")&refreshLibrary=true" \
    -d "{\"Name\":\"$NAME\",\"Path\":\"/$PATH_\"}"
  echo "Created: $NAME"
done
```

> **Important:** The Jellyfin API requires `Authorization: MediaBrowser Token="<key>"` — NOT `X-Api-Key`. Using the wrong header returns 401.

**d) Save Jellyfin config to the database**

```bash
PGPASSWORD=your_postgres_password psql -U postgres -h 127.0.0.1 -d mediavault -c "
UPDATE user_preferences SET
  jellyfin_server_url = 'http://localhost:8096',
  jellyfin_api_key = 'your_jellyfin_api_key';
"
```

### 16. Save all service configs to the database

After collecting all API keys, run this to populate the settings so the Media Vault UI picks them up:

```bash
PGPASSWORD=your_postgres_password psql -U postgres -h 127.0.0.1 -d mediavault -c "
UPDATE user_preferences SET
  prowlarr_enabled = true,
  prowlarr_host = 'localhost',
  prowlarr_port = 9696,
  prowlarr_api_key = 'your_prowlarr_key',
  sonarr_enabled = true,
  sonarr_host = 'localhost',
  sonarr_port = 8989,
  sonarr_api_key = 'your_sonarr_key',
  radarr_enabled = true,
  radarr_host = 'localhost',
  radarr_port = 7878,
  radarr_api_key = 'your_radarr_key',
  bazarr_enabled = true,
  bazarr_url = 'http://localhost:6767',
  bazarr_api_key = 'your_bazarr_key',
  tmdb_api_key = 'your_tmdb_key',
  download_directory = '/your/media/path',
  jellyfin_server_url = 'http://localhost:8096',
  jellyfin_api_key = 'your_jellyfin_key';
"
```

### 17. Update the startup script

Open `scripts/start-mediavault.sh` and update `MEDIAVAULT_DIR` to your actual path. Also update the sudo password lines if your sudo password is different (or better, configure passwordless sudo for the service commands).

### 18. Create symlinks for convenience

```bash
chmod +x scripts/start-mediavault.sh scripts/stop-mediavault.sh
ln -sf $(pwd)/scripts/start-mediavault.sh ~/start-mediavault.sh
ln -sf $(pwd)/scripts/stop-mediavault.sh ~/stop-mediavault.sh
```

### 19. First run

```bash
~/start-mediavault.sh
```

Open the web UI (check the printed URL), register an account, then go to **Settings** to verify all service connections.

---

## Daily Usage

```bash
# Start everything
~/start-mediavault.sh

# Stop everything
~/stop-mediavault.sh

# View logs
tmux attach -t mediavault     # API + Web + Worker
tmux attach -t qbittorrent    # qBittorrent
# Ctrl+B then D to detach
```

---

## URLs

> On WSL2, use your WSL IP instead of `localhost` when accessing from Windows browser.
> Run `ip addr show eth0 | grep "inet "` to get your current WSL2 IP (changes on reboot).

| Service | URL | Credentials |
|---|---|---|
| **Web UI** | http://localhost:5173 | Register on first visit |
| **Admin Panel** | http://localhost:5173/system/control | Set in `apps/api/.env` |
| **API** | http://localhost:3001 | — |
| **qBittorrent** | http://localhost:8080 | admin / admin |
| **Jellyfin** | http://localhost:8096 | Set during wizard |
| **Prowlarr** | http://localhost:9696 | No login (auth disabled) |
| **Sonarr** | http://localhost:8989 | No login (auth disabled) |
| **Radarr** | http://localhost:7878 | No login (auth disabled) |
| **Bazarr** | http://localhost:6767 | No login (auth disabled) |

---

## Troubleshooting

### PostgreSQL won't connect
```bash
sudo service postgresql start
pg_isready
```
Make sure `POSTGRES_HOST=127.0.0.1` in your `.env` — not `localhost`. On some systems the socket path differs.

### Docker services won't start
```bash
sudo service docker start
sudo docker compose up -d
sudo docker ps
```

### Sonarr/Radarr DryIoc crash on startup
This happens if `AuthenticationRequired` is set to `Disabled` (invalid value). It must be `Enabled` even when `AuthenticationMethod` is `None`:
```xml
<AuthenticationMethod>None</AuthenticationMethod>
<AuthenticationRequired>Enabled</AuthenticationRequired>
```
Then `sudo docker restart sonarr radarr`.

### qBittorrent torrents stuck in error state
Usually a write permission issue on the media directory:
```bash
sudo chown -R $USER:$USER /your/media/path
```
Then resume torrents via the qBittorrent WebUI or:
```bash
curl -c /tmp/qbit.txt -d "username=admin&password=admin" http://localhost:8080/api/v2/auth/login
curl -b /tmp/qbit.txt -d "hashes=all" http://localhost:8080/api/v2/torrents/resume
```

### Jellyfin shows blank page
The `docker-compose.yml` originally had volume mounts that override Jellyfin's web UI files. Make sure these lines are **not** in your compose file:
```yaml
# REMOVE these lines if present:
- ./data/jellyfin/config/index.html:/usr/share/jellyfin/web/index.html
- ./data/jellyfin/config/ratings:/usr/share/jellyfin/web/ratings
```

### Jellyfin API returns 401
Use `Authorization: MediaBrowser Token="<key>"` — not `X-Api-Key` or `X-Emby-Token`:
```bash
curl -H 'Authorization: MediaBrowser Token="your_key"' http://localhost:8096/Library/VirtualFolders
```

### Prowlarr can't reach Sonarr/Radarr
Prowlarr runs inside Docker and cannot use `localhost` to reach host services. When configuring apps inside Prowlarr, use Docker service names:
- Sonarr URL: `http://sonarr:8989`
- Radarr URL: `http://radarr:7878`
- FlareSolverr URL: `http://flaresolverr:8191`

### Cloudflare-blocked indexers in Prowlarr
Add the `cloudflare` tag to any Cloudflare-protected indexer in Prowlarr. FlareSolverr will automatically handle the bypass for tagged indexers.

### WSL2 IP changes on reboot
This is normal. Run `ip addr show eth0 | grep "inet "` after each reboot to get the new IP. The start script prints the current IP automatically each time.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Backend:** Express, TypeScript, PostgreSQL, TypeORM
- **Auth:** Better Auth
- **Build:** Turborepo
- **APIs:** TMDB, Prowlarr, Sonarr, Radarr, Bazarr, qBittorrent, Jellyfin
- **Downloaders:** yt-dlp, get_iplayer, qBittorrent
- **Streaming:** Jellyfin

---

## License

MIT
