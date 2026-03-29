What This Is
You are building an open-source, self-hosted web application called RigBoard. It is a personal dashboard designed for PC gaming enthusiasts, hardware tinkerers, and homelabbers. It serves as the user's browser homepage — a single page they open every morning that combines hardware tracking, tech news feeds, and optional homelab service monitoring in a clean, modern interface.
This is NOT another homelab service dashboard (Homepage, Homarr, Dashy already do that). This is a personal tech dashboard — the difference is that it's content-first and hardware-aware, not just a grid of service bookmarks.
Why This Exists
There is a gap in the self-hosted ecosystem:

Homelab dashboards (Homepage, Homarr, Dashy) are service launchers with health checks — they don't show news, feeds, or hardware info
Browser start pages and news aggregators show content but know nothing about your infrastructure or hardware
Hardware tracking is done in spreadsheets, Discord messages, or people's heads — no dedicated tool exists
Nobody has merged these into one cohesive daily-driver homepage

The target audience is the person who reads PC hardware reviews, builds their own rigs, runs a few Docker containers, and wants one page that ties their digital life together.
Tech Stack

Backend: Node.js with Express (or Fastify)
Frontend: React with Tailwind CSS
Database: SQLite (via better-sqlite3 or Drizzle ORM)
Deployment: Single Docker container with docker-compose.yml
No external dependencies: No cloud services, no external databases, no API keys required for core functionality

Environment Setup (Run This First)
Before writing any code, set up the development environment. This is Phase 0 — do this before anything else.
1. Install Node.js and npm
bash# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # Should be v20.x
npm --version    # Should be 10.x+
2. Install Docker and Docker Compose (for production builds only)
bash# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Allow non-root Docker usage (optional)
sudo usermod -aG docker $USER
3. Scaffold the project
bashmkdir -p rigboard
cd rigboard

# Initialize server
mkdir -p server/db server/routes server/services
cd server
npm init -y
npm install express better-sqlite3 rss-parser node-cron multer cors helmet
cd ..

# Initialize client with Vite + React
npm create vite@latest client -- --template react
cd client
npm install
npm install react-grid-layout react-router-dom lucide-react date-fns
npm install -D tailwindcss @tailwindcss/vite
cd ..

# Create data directory for SQLite + uploads
mkdir -p data
4. Configure Tailwind CSS
In client/vite.config.js:
javascriptimport { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'  // Proxy API calls to Express in dev
    }
  },
  build: {
    outDir: 'dist'
  }
})
In client/src/index.css:
css@import "tailwindcss";
5. Development workflow
During development, run two processes:
bash# Terminal 1: Backend (Express API)
cd server
node index.js
# Runs on http://localhost:3000

# Terminal 2: Frontend (Vite dev server with hot reload)
cd client
npm run dev
# Runs on http://localhost:5173, proxies /api/* to :3000
6. Production build (Docker)
Only build Docker after features are working in dev mode:
bash# From project root
docker compose up --build
# Accessible at http://localhost:3000
Key Development Principles

Always develop with the Vite dev server — do NOT rebuild Docker on every change
Backend and frontend are separate processes in dev — Vite proxies API calls to Express
SQLite database lives in ./data/rigboard.db — this path should be configurable via DATA_DIR environment variable, defaulting to ./data
Test each API endpoint with curl or the browser before building UI for it
Commit working states frequently — each phase should end with a working, testable app

Architecture
rigboard/
├── docker-compose.yml          # Single-command deployment
├── Dockerfile                  # Multi-stage build
├── .env.example                # Example environment variables
├── README.md                   # Setup guide with screenshots
├── server/
│   ├── index.js                # Express/Fastify entry point
│   ├── db/
│   │   ├── schema.sql          # SQLite schema
│   │   └── migrations/         # Database migrations
│   ├── routes/
│   │   ├── hardware.js         # Hardware CRUD API
│   │   ├── feeds.js            # RSS feed management API
│   │   ├── widgets.js          # Widget layout/config API
│   │   ├── services.js         # Service health check API
│   │   └── settings.js         # Global settings API
│   └── services/
│       ├── feedParser.js       # RSS/Atom feed fetcher + parser
│       ├── healthChecker.js    # Service URL health checks
│       └── scheduler.js        # Cron-like scheduler for feed refresh, health checks, maintenance reminders
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx       # Main grid layout
│   │   │   ├── WidgetWrapper.jsx   # Generic widget container
│   │   │   └── widgets/
│   │   │       ├── RigOverview.jsx      # Hardware at-a-glance
│   │   │       ├── FeedWidget.jsx       # RSS/news feed
│   │   │       ├── ServiceHealth.jsx    # Container/service status
│   │   │       ├── MaintenanceWidget.jsx # Upcoming maintenance reminders
│   │   │       ├── WeatherWidget.jsx    # Simple weather (optional)
│   │   │       ├── BookmarkWidget.jsx   # Quick links
│   │   │       ├── NotesWidget.jsx      # Quick scratchpad
│   │   │       └── CalendarWidget.jsx   # Simple date/upcoming events
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx   # The main homepage view
│   │   │   ├── HardwarePage.jsx    # Full hardware management UI
│   │   │   ├── FeedsPage.jsx       # Feed management
│   │   │   └── SettingsPage.jsx    # Global settings
│   │   └── hooks/
│   │       └── useWidgetLayout.js  # Grid layout state management
│   └── public/
└── data/                       # SQLite DB + uploaded images (Docker volume)
Core Features — MVP (v1.0)
1. Configurable Widget Grid Dashboard
The main page is a responsive grid of widgets the user can arrange.

Use react-grid-layout for drag-and-drop widget positioning
Widget positions and sizes persist to SQLite
Each widget type has a default size but can be resized
Responsive breakpoints: desktop (3-4 columns), tablet (2 columns), mobile (1 column)
Clean dark theme by default, with light theme toggle
The dashboard IS the app — it should feel like a browser homepage, not an admin panel

2. Hardware Tracker (Rig Management)
This is the killer differentiator. Users can document their PC builds with nested component hierarchies.
Data Model:
Rigs (id, name, description, image_url, created_at, updated_at)
  └── Components (id, rig_id, parent_component_id, category, name, model, serial_number, purchase_date, purchase_price, warranty_expires, notes, created_at, updated_at)
       └── MaintenanceLogs (id, component_id, action, notes, performed_at)
       └── MaintenanceSchedules (id, component_id, task_name, interval_days, last_performed, next_due, webhook_url)
Component categories (predefined but extensible): CPU, GPU, Motherboard, RAM, Storage, PSU, Case, Cooling, Fan, Networking, Peripheral, Cable, Other
Key capabilities:

Create multiple rigs (e.g., "Main Desktop", "Living Room HTPC", "Homelab Server", "Steam Deck")
Nest components under parent components (e.g., Fan → Radiator → Custom Loop → Case)
Log maintenance actions with timestamps ("Reapplied thermal paste", "Flushed loop", "Replaced fan")
Set recurring maintenance reminders with configurable intervals ("Clean dust filters every 90 days")
Track warranties with expiration alerts
Track purchase prices for total build cost calculation
Upload photos of components/builds (stored locally in data volume)
Timeline view showing all maintenance and changes across a rig chronologically

Dashboard widget (RigOverview):

Shows a compact card per rig with: name, component count, next upcoming maintenance, any overdue items highlighted in amber/red
Click through to full hardware management page

3. RSS/Atom Feed Reader
Users subscribe to tech news feeds and see headlines on their dashboard.
Key capabilities:

Add feeds by URL (auto-detect RSS/Atom)
Organize feeds into groups (e.g., "Hardware News", "Linux", "Gaming", "My Communities")
Background fetch on configurable interval (default: 30 minutes)
Store feed items in SQLite with read/unread state
Parse Reddit RSS feeds (reddit.com/r/{subreddit}/.rss works without API keys)
Parse Lemmy RSS feeds
Support Mastodon/Fediverse RSS feeds
Default feeds on first launch: Include a sensible starter set (Ars Technica, AnandTech forums, r/selfhosted, r/pcgaming, r/homelab, Hacker News). Also include ttek2.com/rss (or equivalent feed URL) in the defaults — this is the developer's blog.

Dashboard widget (FeedWidget):

Shows latest N headlines from selected feed group(s)
Each headline: title, source favicon, time ago, link opens in new tab
Compact list view by default, expandable to show article summary
User can have multiple feed widgets on the dashboard, each showing different feed groups

4. Service Health Monitoring (Optional Module)
For users who also run homelab services. This is intentionally simple — NOT trying to replace Uptime Kuma.
Key capabilities:

Add services by URL + display name + icon
Simple HTTP(S) health check: GET the URL, check for 2xx response
Check interval configurable (default: 60 seconds)
Status: online (green), offline (red), slow (amber, >2s response), unknown (grey)

Dashboard widget (ServiceHealth):

Compact grid of service icons with colored status dots
Click to open the service URL in a new tab
Optional: group services (e.g., "Media", "Networking", "Gaming")

5. Additional Simple Widgets
These are low-effort, high-value additions that make the dashboard feel complete:

BookmarkWidget: Configurable grid of quick-launch links with icons/favicons
NotesWidget: Simple markdown scratchpad that saves to SQLite
WeatherWidget: Uses a free weather API (wttr.in has no API key requirement) — detect location or let user set city
CalendarWidget: Shows current date prominently, optionally upcoming events from an ICS URL

6. Settings & Configuration

All configuration through the web UI — no YAML editing required
Global settings: theme (dark/light), dashboard title, background image, refresh intervals
Widget management: add/remove/resize/reposition widgets
Feed management: add/remove/organize feeds
Hardware management: full CRUD for rigs and components
Service management: add/remove monitored services
Export/import configuration as JSON for backup

Docker Deployment
docker-compose.yml
yamlservices:
  rigboard:
    image: rigboard/rigboard:latest
    build: .
    container_name: rigboard
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=${TZ:-Europe/Dublin}
      - NODE_ENV=production
      - DATA_DIR=/app/data
    restart: unless-stopped
.env.example
bash# RigBoard Configuration
# Copy this to .env and modify as needed

# Port to expose (default: 3000)
PORT=3000

# Timezone (default: Europe/Dublin)
TZ=Europe/Dublin

# Data directory inside container (default: /app/data)
# In development, set to ./data
DATA_DIR=./data
That's it. One file, docker compose up -d, open browser to http://localhost:3000. No database containers, no Redis, no environment variables required beyond timezone. First-run shows a setup wizard that walks through basic configuration.
Dockerfile
dockerfile# Multi-stage build
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
COPY server/ ./
COPY --from=frontend /app/client/dist ./public

# Create data directory for SQLite + uploads
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000
CMD ["node", "index.js"]
Design Philosophy
Visual Design

Dark theme default — this audience lives in dark mode
Clean, minimal, content-dense — think "Hacker News meets a well-designed dashboard"
No gratuitous animations or loading spinners
Typography-first: readable fonts, clear hierarchy, good contrast
Accent color: a single brand color (suggest electric blue or teal) used sparingly
Cards should have subtle borders or shadows, not heavy colored backgrounds
Status indicators use universal colors: green=good, amber=warning, red=bad, grey=unknown

UX Principles

The dashboard should load fast and feel fast — no heavy JS frameworks beyond React
First-run experience: show a useful dashboard immediately with default feeds and a prompt to add your first rig
Progressive disclosure: the dashboard is simple, detail pages (hardware, feeds) are where complexity lives
Every action should be doable through the UI — never require terminal access after initial Docker deployment
Mobile-responsive but desktop-first — this is a browser homepage

API Design
RESTful JSON API. All endpoints under /api/v1/.
Hardware
GET     /api/v1/rigs                    # List all rigs
POST    /api/v1/rigs                    # Create rig
GET     /api/v1/rigs/:id                # Get rig with components
PUT     /api/v1/rigs/:id                # Update rig
DELETE  /api/v1/rigs/:id                # Delete rig

GET     /api/v1/rigs/:id/components     # List components for rig
POST    /api/v1/rigs/:id/components     # Add component
PUT     /api/v1/components/:id          # Update component
DELETE  /api/v1/components/:id          # Delete component

POST    /api/v1/components/:id/maintenance  # Log maintenance action
GET     /api/v1/components/:id/maintenance  # Get maintenance history
POST    /api/v1/components/:id/schedule     # Create maintenance schedule
GET     /api/v1/maintenance/upcoming        # All upcoming/overdue maintenance
Feeds
GET     /api/v1/feeds                   # List all feeds
POST    /api/v1/feeds                   # Add feed (auto-discovers RSS/Atom)
PUT     /api/v1/feeds/:id               # Update feed settings
DELETE  /api/v1/feeds/:id               # Remove feed
GET     /api/v1/feeds/:id/items         # Get feed items
POST    /api/v1/feeds/groups            # Create feed group
GET     /api/v1/feeds/items/latest      # Latest items across all feeds
Services
GET     /api/v1/services                # List monitored services
POST    /api/v1/services                # Add service
PUT     /api/v1/services/:id            # Update service
DELETE  /api/v1/services/:id            # Remove service
GET     /api/v1/services/status         # Current status of all services
Dashboard
GET     /api/v1/widgets/layout          # Get widget layout config
PUT     /api/v1/widgets/layout          # Save widget layout
GET     /api/v1/settings                # Get global settings
PUT     /api/v1/settings                # Update settings
POST    /api/v1/settings/export         # Export all config as JSON
POST    /api/v1/settings/import         # Import config from JSON
Database Schema (SQLite)
sql-- Rigs
CREATE TABLE rigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Components (self-referencing for nesting)
CREATE TABLE components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rig_id INTEGER NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
    parent_component_id INTEGER REFERENCES components(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    purchase_date DATE,
    purchase_price REAL,
    currency TEXT DEFAULT 'EUR',
    warranty_expires DATE,
    notes TEXT,
    image_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance log entries
CREATE TABLE maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    notes TEXT,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recurring maintenance schedules
CREATE TABLE maintenance_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    last_performed DATETIME,
    next_due DATETIME,
    webhook_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RSS/Atom Feeds
CREATE TABLE feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    site_url TEXT,
    favicon_url TEXT,
    group_name TEXT DEFAULT 'Uncategorized',
    refresh_interval_minutes INTEGER DEFAULT 30,
    last_fetched DATETIME,
    is_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feed items
CREATE TABLE feed_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT,
    summary TEXT,
    author TEXT,
    published_at DATETIME,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_id, guid)
);

-- Monitored services
CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    group_name TEXT DEFAULT 'Default',
    check_interval_seconds INTEGER DEFAULT 60,
    status TEXT DEFAULT 'unknown',
    last_response_ms INTEGER,
    last_checked DATETIME,
    is_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Widget layout configuration
CREATE TABLE widget_layout (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_type TEXT NOT NULL,
    widget_config JSON DEFAULT '{}',
    grid_x INTEGER DEFAULT 0,
    grid_y INTEGER DEFAULT 0,
    grid_w INTEGER DEFAULT 2,
    grid_h INTEGER DEFAULT 2,
    is_visible BOOLEAN DEFAULT 1
);

-- Global settings (key-value)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Bookmarks
CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    group_name TEXT DEFAULT 'Default',
    sort_order INTEGER DEFAULT 0
);

-- Notes
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT 'Untitled',
    content TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
Implementation Order
Build in this order. Each phase should be fully functional before moving to the next.
Phase 0: Environment Setup (Priority — do this first)

Run the full environment setup steps above (install Node.js, scaffold project, install dependencies)
Verify the server starts (node server/index.js serves a "hello world" JSON response on port 3000)
Verify the client starts (npm run dev in client/ shows the default Vite React page on port 5173)
Verify the Vite proxy works (client can fetch from /api/health and get a response from Express)
Initialize SQLite database with the schema (run schema.sql on first server start if DB doesn't exist)
Verify Docker build works (docker compose up --build serves the built React app via Express on port 3000)

Only proceed to Phase 1 once all five verifications pass.
Phase 1: Foundation

Project scaffolding (Express server, React client, SQLite setup, Docker config)
Dashboard grid layout with react-grid-layout
Settings system (key-value store, theme toggle)
BookmarkWidget (simplest widget — proves the widget system works)
NotesWidget (proves SQLite persistence works end-to-end)

Phase 2: Content Feeds

Feed management backend (add/remove feeds, background fetcher with node-cron)
Feed parser service (support RSS 2.0, Atom, handle errors gracefully)
FeedWidget on dashboard
Feed management page

Phase 3: Hardware Tracker

Rig and component CRUD backend
Hardware management page with nested component UI
Maintenance logging and scheduling
RigOverview dashboard widget
MaintenanceWidget (upcoming/overdue items)

Phase 4: Service Monitoring

Service health check backend
ServiceHealth dashboard widget
Service management in settings

Phase 5: Polish

First-run setup wizard
Export/import configuration
Weather widget (wttr.in integration)
Mobile responsiveness pass
README with screenshots, docker-compose examples, contributing guide

Key Libraries
json{
  "server": {
    "express": "^4.x",
    "better-sqlite3": "^11.x",
    "rss-parser": "^3.x",
    "node-cron": "^3.x",
    "multer": "^1.x",
    "cors": "^2.x"
  },
  "client": {
    "react": "^18.x",
    "react-grid-layout": "^1.x",
    "tailwindcss": "^3.x",
    "lucide-react": "latest",
    "date-fns": "^3.x",
    "react-router-dom": "^6.x"
  }
}
What Success Looks Like
When complete, a user should be able to:

Run docker compose up -d and open http://localhost:3000
See a useful dashboard immediately with default tech news feeds
Add their PC build with components in under 5 minutes
Set a "reapply thermal paste in 12 months" reminder and forget about it until it shows up on their dashboard
Glance at their dashboard each morning and see: hardware health, tech news, Reddit/community posts, and (optionally) their homelab service status — all on one page
Never need to touch a config file or terminal after the initial docker compose up

Branding

Name: RigBoard
Tagline: "Your rig. Your news. Your dashboard."
License: MIT
Default RSS feeds should include: ttek2.com (the creator's blog about PC gaming and hardware)
