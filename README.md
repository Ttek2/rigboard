# RigBoard

**Your rig. Your news. Your dashboard.**

A self-hosted personal dashboard for PC gaming enthusiasts, hardware tinkerers, and homelabbers. One Docker container, no cloud dependencies, no API keys required for core functionality.

## Quick Start

```bash
docker compose up -d
```

Open http://localhost:3000. Done. Accessible from your LAN at `http://<your-ip>:3000`.

## Features

### Dashboard
- 24 widget types with drag-and-drop grid layout
- Smart masonry packing with auto-arrange ("Tidy" button fills every gap)
- Multiple dashboard tabs with configurable 3/4/5 column layouts
- Widget configuration via gear icon -- no YAML editing
- 14 color themes (Nord, Dracula, Tokyo Night, Catppuccin, Gruvbox, Synthwave, and more)
- 10 stackable visual styles (Glass, Retro CRT, Brutalist, Compact, Wide, and more)
- Custom background wallpaper (upload or URL) with adjustable text size
- PWA installable as a browser app

### Community Pulse
- Real-time trending tech intelligence from 39+ sources (Reddit, Hacker News, Google Trends, RSS outlets)
- AI-powered sentiment analysis (5 levels), severity classification, and price extraction with currency detection
- "In your rig" badges -- highlights trending topics that match your hardware
- Deals feed, price alerts, velocity keywords
- Per-topic sparkline charts, creator stats, and grouped source links
- Topics organized by sentiment (positive to negative)
- Powered by [ttek2.com](https://ttek2.com) API

### AI Assistant
- Dashboard-aware AI chat with persistent memory and chat history across sessions
- Supports any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, Groq, etc.)
- 12 executable actions with confirmation prompts (add bookmarks, create notes, restart Docker containers, etc.)
- Three autonomy levels: Confirm All, Semi-Autonomous, Full Autonomous
- AI heartbeat: periodic proactive monitoring with notifications
- Web search: AI searches the web (Brave/SearXNG/DuckDuckGo), synthesizes results into natural responses
- First-run onboarding: asks your name, setup preferences, offers to save hardware to My Rigs
- Shows active model name and local/API badge in the widget
- Full context awareness: rigs, services, feeds, trending topics, community, Docker, system stats
- Live widget updates when AI executes actions

### Hardware Tracker
- Document PC builds with nested component hierarchies
- Track warranties, purchase dates, prices, total build costs, price history
- Edit any component inline with full field set
- Maintenance logging with recurring schedules and webhook alerts
- Shareable rig builds via public links
- Bulk import components from CSV or JSON
- Rig timeline view (chronological maintenance + component events)
- Component photo gallery
- Rig overview widget shows GPU/CPU/RAM specs, total cost, warranty alerts

### Content
- RSS/Atom feed reader with group filtering and OPML import/export
- Works with Reddit RSS, Hacker News, Mastodon, Lemmy feeds
- Inline article reader view
- Feed item starring (read later)
- Default feeds ship from configurable `server/defaults/feeds.json`
- Markdown notes with live preview, search, word count, pin support
- Bookmarks with favicons
- Web search widget with inline API results (DuckDuckGo, Brave Search, SearXNG) or redirect (Google, Bing, Startpage)
- Global search (Cmd+K) with quick actions command palette

### Homelab Integrations
- **Service Health** -- HTTP health checks with uptime %, sparkline history, avg/p95 response times
- **Jellyseerr/Overseerr** -- View and approve/deny media requests
- **Sonarr/Radarr** -- Stats (monitored/missing/queue), upcoming calendar, download queue with progress
- **Plex/Jellyfin** -- Library counts per collection, now playing with progress, recently added with ratings
- **Pi-hole** -- Donut chart, stats, toggle blocking, expandable top blocked/queried/clients bar charts (supports v5 and v6)
- **Docker** -- Container status with health badges, start/stop/restart actions, per-container CPU/memory via Docker socket API
- **qBittorrent/Transmission** -- Active downloads with progress bars and speed
- **Home Assistant** -- Entity states via HA REST API, configurable entity filter
- **GitHub Releases** -- Track latest releases for self-hosted apps you run

### Community
- Ttek2 community integration -- browse articles, comment, discuss trending topics from dashboard
- Rig badges and "Owns This Hardware" verified badges on comments
- Threaded comments with voting and reporting
- Outbound webhooks for community events (HMAC-signed)
- OAuth-free: simple toggle to connect, no popups

### System & Monitoring
- System stats widget with real-time delta CPU calculation (updates every 5s)
- Full host monitoring from inside Docker: CPU, RAM, multi-disk detection, swap, load average, top processes
- Network widget shows real host IPs, gateway, DNS, hostname (not container IPs)
- Docker widget with container health badges, start/stop/restart via socket API
- Notification center (maintenance overdue, service down, warranty expiring, AI insights, webhook alerts)
- Incoming webhook receiver (Uptime Kuma, Grafana, GitHub, generic)
- Prometheus metrics endpoint at `/metrics`
- Server-Sent Events for real-time status updates

### Security & Settings
- Optional password authentication with session management (SQLite-backed sessions)
- TOTP two-factor authentication (Google Authenticator, Authy, etc.)
- Auto-backup daily with 7-day retention + manual backup button
- Export/import full configuration as JSON
- Tabbed settings UI (General, Services, Data, Security, Community, API)

## Docker Compose

**Full (recommended)** -- includes host monitoring, Docker control, and real network info:

```yaml
services:
  rigboard:
    image: ghcr.io/ttek2/rigboard:latest
    container_name: rigboard
    ports:
      - "0.0.0.0:3000:3000"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Docker widget: container list, start/stop/restart
      - /proc:/host/proc:ro                            # System widget: real CPU, RAM, swap, processes
      - /sys:/host/sys:ro                              # System widget: host hardware info
      - /:/host/root:ro                                # System widget: detect all host disks
    environment:
      - TZ=Europe/Dublin
      - HOST_PROC=/host/proc                           # Tell RigBoard where host /proc is mounted
    pid: host                                          # System widget: see host processes, not container
    restart: unless-stopped
```

**Minimal** -- no host monitoring, dashboard features only:

```yaml
services:
  rigboard:
    image: ghcr.io/ttek2/rigboard:latest
    container_name: rigboard
    ports:
      - "0.0.0.0:3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Europe/Dublin
    restart: unless-stopped
```

## Development

```bash
# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Terminal 1: Backend
cd server && node index.js

# Terminal 2: Frontend (hot reload)
cd client && npm run dev
```

Vite dev server on http://localhost:5173 proxies `/api` to Express on http://localhost:3000.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Frontend | React + Tailwind CSS |
| Database | SQLite (better-sqlite3) |
| Deployment | Single Docker container |

## API

- Interactive docs: `/api/docs` (Swagger UI)
- Prometheus metrics: `/metrics`
- Incoming webhooks: `POST /api/v1/webhooks/incoming`
- Web search: `GET /api/v1/websearch?q=...` (Brave/SearXNG/DuckDuckGo)
- Community Pulse: powered by [ttek2.com/api/trending/pulse](https://ttek2.com/api/trending/pulse)

All configuration through the web UI. Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address (0.0.0.0 for LAN access) |
| `TZ` | `Europe/Dublin` | Timezone |
| `DATA_DIR` | `/app/data` | Database and uploads |
| `HOST_PROC` | `/proc` | Host proc mount path (set to /host/proc in Docker) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
