# RigBoard

**Your rig. Your news. Your dashboard.**

A self-hosted personal dashboard for PC gaming enthusiasts, hardware tinkerers, and homelabbers. One Docker container, no cloud dependencies, no API keys required.

## Quick Start

```bash
docker compose up -d
```

Open http://localhost:3000. Done.

## Features

### Dashboard
- 19 widget types with drag-and-drop grid layout
- Smart masonry packing with auto-arrange ("Tidy" button fills every gap)
- Multiple dashboard tabs with configurable 3/4/5 column layouts
- Widget configuration via gear icon -- no YAML editing
- Custom themes: accent color picker, dark/light mode, custom CSS
- PWA installable as a browser app

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
- Global search (Cmd+K) with quick actions

### Homelab Integrations
- **Service Health** -- HTTP health checks with uptime %, sparkline history
- **Jellyseerr/Overseerr** -- View and approve/deny media requests
- **Sonarr/Radarr** -- Upcoming calendar + download queue with progress
- **Plex/Jellyfin** -- Now playing + recently added
- **Pi-hole/AdGuard** -- Stats + toggle blocking on/off
- **Docker** -- Container status with start/stop/restart actions
- **qBittorrent/Transmission** -- Active downloads with progress
- **Home Assistant** -- Entity states via HA REST API
- **GitHub Releases** -- Track updates for self-hosted apps

### System & Monitoring
- System stats widget (CPU, RAM, disk, uptime)
- Network info widget (WAN IP, local IPs, DNS, latency)
- Notification center (maintenance overdue, service down, warranty expiring)
- Incoming webhook receiver (Uptime Kuma, Grafana, GitHub)
- Prometheus metrics endpoint at `/metrics`
- Server-Sent Events for real-time updates

### Security
- Optional password authentication with session management
- TOTP two-factor authentication (Google Authenticator, Authy, etc.)
- Auto-backup daily with 7-day retention + manual backup button

## Docker Compose

```yaml
services:
  rigboard:
    image: ghcr.io/ttek2/rigboard:latest
    container_name: rigboard
    ports:
      - "3000:3000"
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

All configuration through the web UI. Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TZ` | `Europe/Dublin` | Timezone |
| `DATA_DIR` | `/app/data` | Database and uploads |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
