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
- 23 widget types with drag-and-drop grid layout
- Smart masonry packing with auto-arrange ("Tidy" button fills every gap)
- Multiple dashboard tabs with configurable 3/4/5 column layouts
- Widget configuration via gear icon -- no YAML editing
- 14 color themes (Nord, Dracula, Tokyo Night, Catppuccin, Gruvbox, Synthwave, and more)
- 10 stackable visual styles (Glass, Retro CRT, Brutalist, Compact, Wide, and more)
- PWA installable as a browser app

### Community Pulse
- Real-time trending tech intelligence from 39 sources (Reddit, Hacker News, Google Trends, RSS outlets)
- AI-powered sentiment analysis, severity classification, and price extraction
- "In your rig" badges -- highlights trending topics that match your hardware
- Deals feed, price alerts, velocity keywords
- Per-topic sparkline charts and creator stats
- Powered by [ttek2.com](https://ttek2.com) API

### AI Assistant
- Dashboard-aware AI chat with persistent memory across sessions
- Supports any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, Groq, etc.)
- 11 executable actions with confirmation prompts (add bookmarks, create notes, restart Docker containers, etc.)
- Three autonomy levels: Confirm All, Semi-Autonomous, Full Autonomous
- AI heartbeat: periodic proactive monitoring with notifications
- Context-aware: sees your rigs, services, feeds, trending topics, community activity

### Hardware Tracker
- Document PC builds with nested component hierarchies
- Track warranties, purchase prices, total build costs, price history
- Maintenance logging with recurring schedules and webhook alerts
- Shareable rig builds via public links
- Bulk import components from CSV or JSON
- Rig timeline view (chronological maintenance + component events)
- Component photo gallery

### Content
- RSS/Atom feed reader with group filtering and OPML import/export
- Inline article reader view
- Feed item starring (read later)
- Default feeds ship from configurable `server/defaults/feeds.json`
- Markdown notes with live preview
- Bookmarks with favicons
- Web search widget (DuckDuckGo, Google, Brave, SearXNG)
- Global search (Cmd+K) with quick actions

### Homelab Integrations
- **Service Health** -- HTTP health checks with uptime %, sparkline history, avg/p95 response times
- **Jellyseerr/Overseerr** -- View and approve/deny media requests
- **Sonarr/Radarr** -- Stats, upcoming calendar, download queue with progress
- **Plex/Jellyfin** -- Library counts, now playing, recently added
- **Pi-hole/AdGuard** -- Stats, top domains, toggle blocking on/off
- **Docker** -- Container status with start/stop/restart actions, per-container CPU/memory
- **qBittorrent/Transmission** -- Active downloads with progress and speed
- **Home Assistant** -- Entity states via HA REST API
- **GitHub Releases** -- Track updates for self-hosted apps

### Community
- Ttek2 community integration -- comment on articles, discuss trending topics
- Rig badges and "Owns This Hardware" verified badges
- Threaded comments with voting and reporting
- Community content browsable directly from the dashboard

### System & Monitoring
- System stats widget (CPU per-core, RAM, disk, swap, load average, top processes)
- Network info widget (WAN IP, local IPs, DNS, gateway, latency)
- Notification center (maintenance overdue, service down, warranty expiring, AI insights)
- Incoming webhook receiver (Uptime Kuma, Grafana, GitHub)
- Prometheus metrics endpoint at `/metrics`
- Server-Sent Events for real-time updates

### Security
- Optional password authentication with session management
- TOTP two-factor authentication (Google Authenticator, Authy, etc.)
- Auto-backup daily with 7-day retention + manual backup button
- Export/import full configuration as JSON

## Docker Compose

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
- Community Pulse: powered by [ttek2.com/api/trending/pulse](https://ttek2.com/api/trending/pulse)

All configuration through the web UI. Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address (0.0.0.0 for LAN access) |
| `TZ` | `Europe/Dublin` | Timezone |
| `DATA_DIR` | `/app/data` | Database and uploads |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
