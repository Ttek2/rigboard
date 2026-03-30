import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronRight, Monitor, Rss, HardDrive, Settings, Cpu, Activity,
  Bookmark, StickyNote, Cloud, Calendar, Container, Network, Globe, Bot, Users, TrendingUp,
  Shield, Palette, Download, Play, Server, Home, Zap, ExternalLink, Info
} from 'lucide-react';

const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Zap,
    items: [
      {
        id: 'first-launch',
        title: 'First Launch',
        content: `When you first open RigBoard, a setup wizard walks you through the basics:

**1. Name your dashboard** — this appears in the navbar and browser tab.
**2. Pick a theme** — choose from 14 color themes. You can change this anytime in Settings.
**3. Start using it** — you'll land on the dashboard with some default widgets ready to go.

The dashboard is your homepage. Open it every morning and everything you care about is right there.`
      },
      {
        id: 'adding-widgets',
        title: 'Adding Widgets',
        content: `Click the **"+ Add Widget"** button at the top of the dashboard. You'll see all available widget types — click one to add it.

Each widget appears on the grid and can be:
- **Dragged** to reposition (grab the grip handle in the header)
- **Resized** by dragging the bottom-right corner
- **Configured** via the gear icon (hover over the widget header)
- **Removed** via the X icon (hover over the widget header)

Click **"Tidy"** to auto-arrange widgets and fill gaps using smart masonry packing.`
      },
      {
        id: 'layout',
        title: 'Dashboard Layout',
        content: `RigBoard supports **multiple dashboard tabs** — switch between them using the tab bar above the widget grid.

**Column layouts:** Choose between 3, 4, or 5 columns in Settings > General. More columns work better on wider screens.

**Auto-arrange:** The "Tidy" button uses a masonry bin-packing algorithm to fill every gap in the grid. Widgets snap to the tightest fit.

Your layout is saved automatically whenever you drag or resize a widget.`
      },
      {
        id: 'pwa',
        title: 'Install as App',
        content: `RigBoard is a Progressive Web App (PWA). You can install it as a standalone app from your browser:

- **Chrome/Edge:** Click the install icon in the address bar, or go to Menu > "Install RigBoard"
- **Firefox:** Not natively supported, but works as a pinned tab
- **Mobile:** Tap "Add to Home Screen" in your browser's share/menu

Once installed, it opens in its own window without browser chrome — feels like a native app.`
      },
    ]
  },
  {
    id: 'widgets',
    title: 'Widgets',
    icon: Monitor,
    items: [
      {
        id: 'widget-pulse',
        title: 'Community Pulse',
        content: `Real-time trending tech intelligence from 39+ sources including Reddit, Hacker News, Google Trends, and RSS outlets.

**Features:**
- AI-powered sentiment analysis (5 levels from very positive to very negative)
- Severity classification and price extraction with currency detection
- **"In your rig"** badges — highlights topics matching your hardware components
- Sparkline charts showing topic velocity over time
- Deals section with price alerts
- Topics organized by sentiment (positive → negative)

**Configuration:** No setup required — powered by the ttek2.com API. Click any topic to expand details, sources, and creator stats.`
      },
      {
        id: 'widget-feeds',
        title: 'News Feed',
        content: `RSS/Atom feed reader showing headlines from your subscribed sources.

**Features:**
- Shows latest headlines with source favicon and time ago
- Click to open articles in a new tab or use the inline reader view
- Star items to read later
- Filter by feed group

**Configuration:** Click the gear icon to select which feed group to display. Manage feeds in the Feeds page (add by URL, organize into groups, import OPML).

Supports Reddit RSS, Hacker News, Mastodon, and Lemmy feeds — no API keys needed.`
      },
      {
        id: 'widget-rigs',
        title: 'Rig Overview',
        content: `At-a-glance view of your PC builds.

Shows each rig's key specs (GPU, CPU, RAM), total build cost, component count, and upcoming maintenance. Warranty alerts appear when components are approaching expiration.

**Configuration:** Add rigs and components on the Hardware page. The widget auto-populates from your hardware data.`
      },
      {
        id: 'widget-bookmarks',
        title: 'Bookmarks',
        content: `Quick-launch grid of your favorite links with automatic favicons.

**Configuration:** Click the gear icon or go to Settings to add bookmarks. Each bookmark has a name, URL, optional icon, and group. Supports drag reordering.`
      },
      {
        id: 'widget-notes',
        title: 'Notes',
        content: `Markdown scratchpad with live preview.

**Features:**
- Full markdown support (headings, lists, code blocks, links)
- Search across all notes
- Pin important notes to the top
- Word count display

**Configuration:** Click into the widget to create/edit notes. All notes persist in the database.`
      },
      {
        id: 'widget-maintenance',
        title: 'Maintenance',
        content: `Shows upcoming and overdue maintenance tasks for your hardware.

Tasks appear color-coded: green for upcoming, amber for due soon, red for overdue. Includes recurring schedules (e.g., "Clean dust filters every 90 days") and one-time reminders.

**Configuration:** Set up maintenance schedules on the Hardware page under each component.`
      },
      {
        id: 'widget-services',
        title: 'Service Health',
        content: `HTTP health checks for your self-hosted services with uptime tracking.

**Features:**
- Status indicators: green (online), amber (slow >2s), red (offline), grey (unknown)
- Uptime percentage and sparkline history
- Average and P95 response times
- Click to open the service URL

**Configuration:** Click the gear icon to set the check interval. Add services in Settings > Services with a URL, name, and optional icon/group.`
      },
      {
        id: 'widget-weather',
        title: 'Weather',
        content: `Current weather conditions and forecast.

Uses wttr.in by default — no API key required. Shows temperature, conditions, humidity, and wind.

**Configuration:** Click the gear icon to set your city/location.`
      },
      {
        id: 'widget-calendar',
        title: 'Calendar',
        content: `Simple date display with current date prominently shown.

Useful as a homepage element to quickly see today's date. Minimal and lightweight.`
      },
      {
        id: 'widget-docker',
        title: 'Docker',
        content: `Manage Docker containers running on your host.

**Features:**
- Container list with status (running/stopped) and health badges
- **Start, stop, restart** actions directly from the dashboard
- Per-container CPU and memory usage stats
- Click to see container details

**Requirements:** The Docker socket must be mounted in docker-compose.yml:
\`\`\`yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
\`\`\`

**Note:** Mounting the Docker socket grants the container significant host access. See the Deployment section for security details.`
      },
      {
        id: 'widget-system',
        title: 'System Stats',
        content: `Real-time host system monitoring.

**Shows:**
- CPU usage with per-core breakdown (delta calculation, updates every 5s)
- RAM usage
- All host disks with usage bars
- Swap usage
- Load average (1m / 5m / 15m)
- Top 5 processes by CPU usage
- Hostname, uptime, architecture

**Requirements in docker-compose.yml:**
\`\`\`yaml
volumes:
  - /proc:/host/proc:ro
  - /sys:/host/sys:ro
environment:
  - HOST_PROC=/host/proc
security_opt:
  - apparmor:unconfined
cap_add:
  - SYS_PTRACE
pid: host
\`\`\`

Without these, the widget falls back to container-only stats (root disk only, no host processes).`
      },
      {
        id: 'widget-network',
        title: 'Network Info',
        content: `Displays the host's network information.

**Shows:** Real host IP addresses (not container IPs), gateway, DNS servers, and hostname.

**Requirements:** Works best with \`pid: host\` in docker-compose.yml for accurate host network info.`
      },
      {
        id: 'widget-embed',
        title: 'Embed',
        content: `Embeds any URL in an iframe on your dashboard.

Useful for Grafana dashboards, internal tools, documentation pages, or any web content you want to keep visible.

**Configuration:** Click the gear icon to set the URL. Some sites block iframe embedding via X-Frame-Options headers.`
      },
      {
        id: 'widget-websearch',
        title: 'Web Search',
        content: `Search the web directly from your dashboard.

**Supported engines:**
- **DuckDuckGo** — no API key required, returns inline results
- **Brave Search** — requires API key, returns inline results
- **SearXNG** — self-hosted, returns inline results
- **Google, Bing, Startpage** — redirects to the search engine

**Configuration:** Set your preferred search engine in Settings > API. Engines with API support show results inline with pagination; others redirect.`
      },
      {
        id: 'widget-ai',
        title: 'AI Assistant',
        content: `Dashboard-aware AI chat that knows about your rigs, services, feeds, and system state.

**Features:**
- Persistent chat history across sessions
- 12 executable actions (add bookmarks, create notes, restart containers, etc.)
- Web search — AI searches the web and synthesizes results
- Persistent memory across conversations
- First-run onboarding that asks your name and preferences
- Shows active model name and local/API badge

**Autonomy levels:**
- **Confirm All** — AI proposes actions, you approve each one
- **Semi-Autonomous** — low-risk actions auto-execute, high-risk requires confirmation
- **Full Autonomous** — all actions auto-execute

**AI Heartbeat:** Optional periodic monitoring where the AI proactively checks your services and hardware, sending notifications if something needs attention.

**Configuration:** Click the gear icon to set your OpenAI-compatible endpoint URL and model name. Works with OpenAI, Ollama, LM Studio, Groq, and any compatible API. Set autonomy level in Settings > API.`
      },
      {
        id: 'widget-community',
        title: 'Community',
        content: `Browse and participate in ttek2 community discussions.

**Features:**
- View articles and trending topic discussions
- Comment with threaded replies
- Vote and report comments
- "Owns This Hardware" verified badges on comments (matched from your rigs)
- Rig badges showing your hardware

**Configuration:** Enable community in Settings > Community. Toggle connects your RigBoard instance to ttek2.com — no OAuth or account creation needed.`
      },
      {
        id: 'widget-youtube',
        title: 'YouTube',
        content: `Track uploads from your favourite YouTube creators.

**Features:**
- Latest videos with thumbnails, titles, channel names, and time ago
- Click to open directly on YouTube
- Supports @handles, channel URLs, and channel IDs
- No YouTube API key required — uses public YouTube RSS feeds
- Refreshes every 10 minutes

**Configuration:** Click the gear icon and add channels as comma-separated @handles (e.g. \`@mkbhd, @LinusTechTips\`), full channel URLs, or channel IDs.`
      },
    ]
  },
  {
    id: 'integrations',
    title: 'Homelab Integrations',
    icon: Server,
    items: [
      {
        id: 'widget-jellyseerr',
        title: 'Jellyseerr / Overseerr',
        content: `View and manage media requests.

**Features:**
- See pending, approved, and available requests
- **Approve or deny** requests directly from the dashboard
- Shows requester, media type, and status

**Configuration:** Click the gear icon and enter your Jellyseerr/Overseerr URL and API key. Find your API key in Jellyseerr Settings > General.`
      },
      {
        id: 'widget-starr',
        title: 'Sonarr / Radarr',
        content: `Monitor your media automation.

**Features:**
- Stats: monitored, missing, and queued items
- Upcoming calendar with air dates
- Download queue with progress bars
- Supports both Sonarr (TV) and Radarr (Movies)

**Configuration:** Click the gear icon and enter your Sonarr/Radarr URL and API key. Select mode (Sonarr or Radarr).`
      },
      {
        id: 'widget-media',
        title: 'Plex / Jellyfin',
        content: `Media server library stats and activity.

**Features:**
- Library counts per collection
- Now playing with progress indicator
- Recently added items with ratings
- Supports both Plex and Jellyfin

**Configuration:** Click the gear icon and enter your server URL and API key/token. Select mode (Plex or Jellyfin).`
      },
      {
        id: 'widget-pihole',
        title: 'Pi-hole',
        content: `DNS ad-blocking statistics and control.

**Features:**
- Donut chart showing blocked vs. allowed queries
- Total queries, blocked percentage, domains on blocklist
- **Toggle blocking** on/off from the dashboard
- Expandable top blocked domains, top queried domains, and top clients

**Supports Pi-hole v5 and v6** with automatic API detection.

**Configuration:** Click the gear icon and enter your Pi-hole URL and API key (v5) or app password (v6). For v6, generate an app password in Pi-hole Settings > API.`
      },
      {
        id: 'widget-downloads',
        title: 'Downloads (qBittorrent / Transmission)',
        content: `Active torrent downloads with progress.

**Features:**
- Active downloads with progress bars
- Upload/download speeds
- Supports qBittorrent and Transmission

**Configuration:** Click the gear icon and enter your client URL and credentials.`
      },
      {
        id: 'widget-homeassistant',
        title: 'Home Assistant',
        content: `Display entity states from your Home Assistant instance.

**Features:**
- Show states of any HA entity (sensors, switches, lights, etc.)
- Configurable entity filter to show only what you care about
- Real-time updates via HA REST API

**Configuration:** Click the gear icon and enter your Home Assistant URL and long-lived access token. Generate a token in HA Profile > Security > Long-Lived Access Tokens.`
      },
      {
        id: 'widget-releases',
        title: 'GitHub Releases',
        content: `Track latest releases for your self-hosted apps.

**Features:**
- Shows latest version, release date, and release notes
- Useful for tracking updates to apps you run (Jellyfin, Sonarr, Pi-hole, etc.)

**Configuration:** Click the gear icon and add GitHub repositories in \`owner/repo\` format (e.g., \`jellyfin/jellyfin\`). No API key needed for public repos.`
      },
    ]
  },
  {
    id: 'community-pulse',
    title: 'Community Pulse',
    icon: TrendingUp,
    items: [
      {
        id: 'pulse-overview',
        title: 'What is Community Pulse?',
        content: `Community Pulse is RigBoard's real-time tech intelligence feed, powered by the ttek2.com API.

It aggregates trending topics from 39+ sources across the tech ecosystem — Reddit, Hacker News, Google Trends, tech news sites, and RSS outlets — then uses AI to analyze sentiment, extract prices, and classify severity.

**No API key required.** The data is provided by ttek2.com and refreshed automatically.`
      },
      {
        id: 'pulse-sentiment',
        title: 'Sentiment & Severity',
        content: `Each topic is analyzed for sentiment across 5 levels:
- **Very Positive** — strong community approval, excitement
- **Positive** — generally favorable reception
- **Mixed** — divided opinions, both pros and cons
- **Negative** — community concerns or criticism
- **Very Negative** — strong backlash or serious issues

Topics are organized from positive to negative in the widget.

**Severity levels** flag impact: informational, notable, significant, critical. Critical items appear with warning banners.`
      },
      {
        id: 'pulse-rig-badges',
        title: '"In Your Rig" Badges',
        content: `When a trending topic mentions hardware that matches components in your rigs, it gets an **"In your rig"** badge.

For example, if you have an RTX 4090 in your rig and a trending topic discusses RTX 4090 driver issues, it'll be flagged so you notice it immediately.

This matching happens automatically based on your hardware data — no configuration needed beyond having your components entered on the Hardware page.`
      },
      {
        id: 'pulse-deals',
        title: 'Deals & Price Alerts',
        content: `Community Pulse extracts price mentions from trending topics with automatic currency detection.

**Deals section:** Aggregates topics tagged as deals with extracted prices.

**Price alerts:** Highlights significant price drops or notable pricing for hardware you own or track.

Click any topic to expand and see price details, source links, and historical velocity.`
      },
    ]
  },
  {
    id: 'community',
    title: 'Community',
    icon: Users,
    items: [
      {
        id: 'community-connect',
        title: 'Connecting to ttek2',
        content: `RigBoard integrates with the ttek2 community platform — no OAuth, no account creation, no popups.

**To connect:**
1. Go to Settings > Community
2. Toggle "Enable Community" on
3. Optionally set your display name and avatar color

That's it. Your RigBoard instance gets a community token that identifies you in discussions. Toggle off at any time to disconnect and revoke your token.`
      },
      {
        id: 'community-comments',
        title: 'Comments & Discussions',
        content: `Once connected, you can:
- **Browse articles** and trending topic discussions from the Community widget
- **Comment** on articles and topics with threaded replies
- **Vote** on comments (upvote/downvote)
- **Report** inappropriate content

Comments support markdown formatting. Your display name and rig badge appear with each comment.`
      },
      {
        id: 'community-badges',
        title: 'Rig Badges',
        content: `Your hardware shows up in the community:

- **Rig badge** — a short summary of your main components (e.g., "RTX 4090 / i9-14900K / 64GB") appears on your profile
- **"Owns This Hardware"** verified badge — when you comment on a topic about hardware you own, a verified badge appears

These badges are derived from your Hardware page data and update automatically.`
      },
      {
        id: 'community-webhooks',
        title: 'Outbound Webhooks',
        content: `RigBoard can send HMAC-signed webhooks for community events.

Configure webhook URLs in Settings > Community to receive notifications when events happen in the community. Webhooks include an HMAC signature for verification.`
      },
    ]
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    icon: Bot,
    items: [
      {
        id: 'ai-setup',
        title: 'Setting Up AI',
        content: `The AI Assistant works with any OpenAI-compatible API endpoint.

**Supported providers:**
- **OpenAI** — use \`https://api.openai.com\` with your API key
- **Ollama** — use \`http://localhost:11434\` (or your Ollama host), no API key needed
- **LM Studio** — use \`http://localhost:1234\`, no API key needed
- **Groq** — use \`https://api.groq.com/openai\` with your API key
- Any other OpenAI-compatible endpoint

**Configuration:** Go to Settings > API and enter your endpoint URL, API key (if required), and model name. The widget shows which model is active and whether it's local or API-based.`
      },
      {
        id: 'ai-context',
        title: 'What Does the AI Know?',
        content: `The AI has full context awareness of your dashboard:

- **Rigs** — all your hardware components, specs, and prices
- **Services** — health status of monitored services
- **Maintenance** — upcoming and overdue tasks
- **Feeds** — recent headlines and starred articles
- **Bookmarks & Notes** — your saved content
- **Docker** — running containers and their status
- **System** — CPU, RAM, disk, network stats
- **Trending** — Community Pulse topics
- **Community** — your community profile and discussions
- **Dashboard** — current theme, layout, and settings
- **Notifications** — pending alerts

This context is rebuilt with each message so the AI always has current information.`
      },
      {
        id: 'ai-actions',
        title: 'AI Actions',
        content: `The AI can execute 12 types of actions on your dashboard:

| Action | Risk | What it does |
|--------|------|-------------|
| Add Bookmark | Low | Creates a new bookmark |
| Create Note | Low | Creates a new note |
| Add Maintenance | Low | Adds a maintenance schedule |
| Log Maintenance | Low | Logs a completed maintenance task |
| Add Service | Low | Adds a service to monitor |
| Subscribe to Feed | Low | Adds an RSS feed |
| Docker Action | **High** | Start/stop/restart a container |
| Toggle Pi-hole | Medium | Enable/disable ad blocking |
| Update Setting | Medium | Change a dashboard setting |
| Save Memory | Low | Stores information for future recall |
| Create Backup | Low | Triggers a database backup |
| Web Search | Low | Searches the web and summarizes results |

Actions appear as clickable buttons in the chat. Your **autonomy level** (Settings > API) controls whether actions auto-execute or require confirmation.`
      },
      {
        id: 'ai-memory',
        title: 'AI Memory',
        content: `The AI has persistent memory that survives across chat sessions.

It automatically remembers important details from your conversations — your name, preferences, hardware notes, and things you've asked it to remember.

You can ask the AI to:
- "Remember that I prefer dark themes"
- "What do you remember about me?"
- "Forget what you know about my GPU"

Memory is stored in the database and loaded into every conversation.`
      },
      {
        id: 'ai-search',
        title: 'Web Search',
        content: `Ask the AI to search the web and it will:

1. Detect your search intent from the conversation
2. Query your configured search engine (Brave, SearXNG, or DuckDuckGo)
3. Read and synthesize the results
4. Respond with a natural summary — not raw search results

**Example:** "What are the latest RTX 5090 benchmarks?" — the AI searches, reads multiple sources, and gives you a coherent answer.

**Configuration:** Set up a search engine with API support in Settings > API.`
      },
      {
        id: 'ai-heartbeat',
        title: 'AI Heartbeat',
        content: `Optional periodic monitoring where the AI proactively checks your dashboard.

When enabled, the AI periodically reviews your services, hardware, and system state. If it notices something noteworthy — a service down, a disk filling up, maintenance overdue — it sends a notification.

**Configuration:** Enable AI Heartbeat in Settings > API and set the check interval.`
      },
    ]
  },
  {
    id: 'hardware',
    title: 'Hardware Tracker',
    icon: HardDrive,
    items: [
      {
        id: 'hardware-rigs',
        title: 'Managing Rigs',
        content: `Create and manage multiple PC builds on the Hardware page.

**Examples:** "Main Desktop", "Living Room HTPC", "Homelab Server", "Steam Deck"

Each rig has a name, description, optional photo, and a tree of components. Click a rig to expand its component hierarchy.`
      },
      {
        id: 'hardware-components',
        title: 'Components',
        content: `Add components to each rig with full detail tracking:

- **Category** — CPU, GPU, Motherboard, RAM, Storage, PSU, Case, Cooling, Fan, Networking, Peripheral, Cable, Other
- **Name, model, serial number**
- **Purchase date and price** (with currency)
- **Warranty expiration**
- **Notes and photos**

Components can be **nested** — e.g., a Fan under a Radiator under a Custom Loop under a Case. This models real hardware hierarchies.

**Bulk import:** Import components from CSV or JSON files.`
      },
      {
        id: 'hardware-maintenance',
        title: 'Maintenance',
        content: `Track maintenance for any component:

**Maintenance logs:** Record completed work ("Reapplied thermal paste", "Flushed loop", "Replaced fan") with timestamps.

**Recurring schedules:** Set repeating tasks with intervals ("Clean dust filters every 90 days"). RigBoard tracks when each task is next due and sends notifications when overdue.

**Webhook alerts:** Optionally send a webhook when maintenance is due.

**Timeline view:** See all maintenance and component events across a rig chronologically.`
      },
      {
        id: 'hardware-sharing',
        title: 'Sharing Builds',
        content: `Share your rig builds via public links.

Generate a shareable URL for any rig — anyone with the link can view the component list and specs without needing access to your dashboard.

Useful for forums, Discord, or showing off your build.`
      },
    ]
  },
  {
    id: 'settings',
    title: 'Settings & Security',
    icon: Settings,
    items: [
      {
        id: 'settings-themes',
        title: 'Themes & Visual Styles',
        content: `RigBoard ships with **14 color themes:**
Nord, Dracula, Tokyo Night, Catppuccin Mocha, Catppuccin Latte, Gruvbox, Synthwave, Solarized, One Dark, Monokai, Everforest, Rosé Pine, High Contrast, and the default Dark/Light themes.

**10 stackable visual styles** can be combined:
Glass, Retro CRT, Brutalist, Compact, Wide, Neon Glow, Paper, Rounded, Minimal, and Flat.

For example, you can use Glass + Wide together for translucent wide-format widgets.

**Custom overrides:** Adjust individual colors (accent, background, text, border) in Settings > General.`
      },
      {
        id: 'settings-wallpaper',
        title: 'Wallpaper & Font Size',
        content: `**Wallpaper:** Upload an image or paste a URL in Settings > General. The wallpaper renders behind all dashboard content at full quality. Works best with the Glass visual style for translucent widgets.

**Font size:** Adjust the global text size (11px–20px) with the slider in Settings > General. Affects all dashboard text.`
      },
      {
        id: 'settings-auth',
        title: 'Password Authentication',
        content: `Optional password protection for your dashboard.

**Setup:** Go to Settings > Security and set a password. When enabled, all API routes require authentication.

**Sessions:** Login sessions last 30 days. You can log out from the Settings page.

**Important:** After a password is set, the setup endpoint is locked — even if you temporarily disable auth, the password cannot be changed without logging in first.`
      },
      {
        id: 'settings-totp',
        title: 'Two-Factor Authentication (2FA)',
        content: `Add TOTP-based two-factor authentication for extra security.

**Setup:**
1. Enable auth with a password first
2. Go to Settings > Security and click "Setup 2FA"
3. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to verify

After setup, login requires both your password and a 2FA code.

**Disable:** Go to Settings > Security while logged in to disable 2FA.`
      },
      {
        id: 'settings-backup',
        title: 'Backups',
        content: `RigBoard auto-backs up your database daily with 7-day retention.

**Manual backup:** Click "Create Backup" in Settings > Data to trigger an immediate backup.

**Export/Import:** Export your full configuration as JSON for migration or sharing. Import a previously exported JSON to restore settings.

Backups are stored in the data directory (\`./data/backups/\`).`
      },
    ]
  },
  {
    id: 'deployment',
    title: 'Docker Deployment',
    icon: Container,
    items: [
      {
        id: 'deploy-quick',
        title: 'Quick Start',
        content: `\`\`\`bash
docker compose up -d
\`\`\`

Open http://localhost:3000. That's it. Accessible on your LAN at \`http://<your-ip>:3000\`.`
      },
      {
        id: 'deploy-modes',
        title: 'Deployment Modes',
        content: `RigBoard supports two deployment profiles:

**Minimal (safe default)** — dashboard features only:
\`\`\`yaml
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
\`\`\`

This runs feeds, notes, bookmarks, rigs, AI, community, and all integrations. No host access.

**Full (host monitoring + Docker control):**
\`\`\`yaml
services:
  rigboard:
    image: ghcr.io/ttek2/rigboard:latest
    container_name: rigboard
    ports:
      - "0.0.0.0:3000:3000"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    environment:
      - TZ=Europe/Dublin
      - HOST_PROC=/host/proc
    security_opt:
      - apparmor:unconfined
    cap_add:
      - SYS_PTRACE
    pid: host
    restart: unless-stopped
\`\`\`

This adds system stats, all disk detection, host processes, Docker container management, and network info.`
      },
      {
        id: 'deploy-security',
        title: 'Security Considerations',
        content: `The full deployment profile grants significant host access. Understand what each option does:

| Option | Purpose | Risk |
|--------|---------|------|
| \`docker.sock\` | Docker container list, stats, start/stop/restart | Effectively root-level host access |
| \`/proc:/host/proc:ro\` | CPU, RAM, swap, disk stats | Read-only host process info |
| \`/sys:/host/sys:ro\` | Hardware detection | Read-only hardware info |
| \`pid: host\` | Host processes, disk detection | Can see all host PIDs |
| \`SYS_PTRACE\` | Disk detection via /proc/1/root | Can inspect host PID 1's filesystem |
| \`apparmor:unconfined\` | Required for SYS_PTRACE to work | Disables AppArmor for this container |

**Recommendations:**
- Use the minimal profile unless you specifically need host monitoring or Docker control
- Enable password auth if the dashboard is accessible beyond your trusted LAN
- The Docker socket is the most powerful option — it effectively grants host-level access
- All host mounts are read-only (\`:ro\`)
- If a widget's required mounts are missing, it degrades gracefully (shows empty state, not errors)`
      },
      {
        id: 'deploy-env',
        title: 'Environment Variables',
        content: `| Variable | Default | Description |
|----------|---------|-------------|
| \`PORT\` | \`3000\` | Server port |
| \`HOST\` | \`0.0.0.0\` | Bind address (0.0.0.0 for LAN access) |
| \`TZ\` | \`Europe/Dublin\` | Timezone for timestamps |
| \`DATA_DIR\` | \`/app/data\` | Database and uploads directory |
| \`HOST_PROC\` | \`/proc\` | Host proc mount path (set to /host/proc in Docker) |

All other configuration is done through the web UI.`
      },
    ]
  },
];

// Build flat search index
const SEARCH_INDEX = HELP_SECTIONS.flatMap(section =>
  section.items.map(item => ({
    sectionId: section.id,
    sectionTitle: section.title,
    ...item,
    searchText: `${item.title} ${item.content}`.toLowerCase()
  }))
);

export function searchHelp(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const terms = q.split(/\s+/);
  return SEARCH_INDEX
    .filter(item => terms.every(t => item.searchText.includes(t)))
    .slice(0, 8)
    .map(({ sectionId, sectionTitle, id, title }) => ({ sectionId, sectionTitle, id, title }));
}

// Map widget types to help section IDs
export const WIDGET_HELP_MAP = {
  pulse: 'widget-pulse', feeds: 'widget-feeds', rigs: 'widget-rigs',
  bookmarks: 'widget-bookmarks', notes: 'widget-notes', maintenance: 'widget-maintenance',
  services: 'widget-services', weather: 'widget-weather', calendar: 'widget-calendar',
  docker: 'widget-docker', system: 'widget-system', network: 'widget-network',
  embed: 'widget-embed', websearch: 'widget-websearch', ai: 'widget-ai',
  community: 'widget-community', jellyseerr: 'widget-jellyseerr', starr: 'widget-starr',
  media: 'widget-media', pihole: 'widget-pihole', downloads: 'widget-downloads',
  homeassistant: 'widget-homeassistant', releases: 'widget-releases',
  youtube: 'widget-youtube', stickynote: 'widget-stickynote', clock: 'widget-clock',
  speedtest: 'widget-speedtest', gpu: 'widget-gpu',
};

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState(() =>
    Object.fromEntries(HELP_SECTIONS.map(s => [s.id, true]))
  );
  const [activeItemId, setActiveItemId] = useState(HELP_SECTIONS[0]?.items[0]?.id || null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const location = useLocation();

  // Handle hash navigation (e.g., /help#widget-system)
  useEffect(() => {
    const hash = location.hash?.slice(1);
    if (hash) {
      for (const section of HELP_SECTIONS) {
        if (section.items.find(i => i.id === hash)) {
          setExpandedSections(prev => ({ ...prev, [section.id]: true }));
          setActiveItemId(hash);
          break;
        }
      }
    }
  }, [location.hash]);

  // Find active item content
  let activeItem = null;
  let activeSection = null;
  for (const section of HELP_SECTIONS) {
    const item = section.items.find(i => i.id === activeItemId);
    if (item) { activeItem = item; activeSection = section; break; }
  }

  // Filter sidebar tree by search
  const filteredSections = search.length >= 2
    ? HELP_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item =>
          `${item.title} ${item.content}`.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(s => s.items.length > 0)
    : HELP_SECTIONS;

  const selectItem = (id) => {
    setActiveItemId(id);
    setMobileSidebar(false);
  };

  // Find prev/next items for navigation
  const allItems = HELP_SECTIONS.flatMap(s => s.items);
  const currentIdx = allItems.findIndex(i => i.id === activeItemId);
  const prevItem = currentIdx > 0 ? allItems[currentIdx - 1] : null;
  const nextItem = currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null;

  return (
    <div className="flex gap-0 -mx-4 -mt-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Sidebar */}
      <aside className={`
        ${mobileSidebar ? 'fixed inset-0 z-50' : 'hidden'} md:relative md:block
        w-72 min-w-[18rem] flex-shrink-0 border-r overflow-hidden flex flex-col
      `} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Mobile overlay */}
        {mobileSidebar && (
          <div className="fixed inset-0 bg-black/50 md:hidden" onClick={() => setMobileSidebar(false)} />
        )}
        <div className={`${mobileSidebar ? 'relative z-10 w-72 h-full' : 'h-full'} flex flex-col`}
          style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {/* Sidebar header + search */}
          <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter topics..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md border text-xs bg-transparent outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Tree */}
          <nav className="flex-1 overflow-y-auto py-1">
            {filteredSections.map(section => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections[section.id] || search.length >= 2;

              return (
                <div key={section.id}>
                  <button
                    onClick={() => setExpandedSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:opacity-80"
                  >
                    {isExpanded
                      ? <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />
                      : <ChevronRight size={12} style={{ color: 'var(--text-secondary)' }} />
                    }
                    <SectionIcon size={13} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {section.title}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4">
                      {section.items.map(item => {
                        const isActive = item.id === activeItemId;
                        return (
                          <button
                            key={item.id}
                            onClick={() => selectItem(item.id)}
                            className="w-full text-left px-4 py-1 text-xs rounded-md truncate block"
                            style={{
                              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                              backgroundColor: isActive ? 'var(--accent)11' : 'transparent',
                              fontWeight: isActive ? 500 : 400,
                            }}
                          >
                            {item.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredSections.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                No topics match "{search}"
              </p>
            )}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 py-2 border-t text-center flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <a href="https://github.com/Ttek2/rigboard" target="_blank" rel="noopener noreferrer"
                className="hover:underline" style={{ color: 'var(--accent)' }}>GitHub</a>
              {' '}&middot;{' '}
              <a href="https://github.com/Ttek2/rigboard/issues" target="_blank" rel="noopener noreferrer"
                className="hover:underline" style={{ color: 'var(--accent)' }}>Report Issue</a>
            </p>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile menu button */}
        <div className="md:hidden sticky top-0 z-10 px-4 py-2 border-b"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
          <button onClick={() => setMobileSidebar(true)}
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--text-secondary)' }}>
            <ChevronRight size={14} />
            {activeSection?.title} &rsaquo; {activeItem?.title}
          </button>
        </div>

        {activeItem ? (
          <div className="max-w-3xl px-8 py-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {activeSection && (
                <>
                  {(() => { const Icon = activeSection.icon; return <Icon size={12} style={{ color: 'var(--accent)' }} />; })()}
                  <span>{activeSection.title}</span>
                  <ChevronRight size={10} />
                </>
              )}
              <span style={{ color: 'var(--text-primary)' }}>{activeItem.title}</span>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
              {activeItem.title}
            </h1>

            {/* Content */}
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <MarkdownContent content={activeItem.content} />
            </div>

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between mt-10 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {prevItem ? (
                <button onClick={() => selectItem(prevItem.id)}
                  className="flex items-center gap-1.5 text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronRight size={12} className="rotate-180" />
                  {prevItem.title}
                </button>
              ) : <div />}
              {nextItem ? (
                <button onClick={() => selectItem(nextItem.id)}
                  className="flex items-center gap-1.5 text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  {nextItem.title}
                  <ChevronRight size={12} />
                </button>
              ) : <div />}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select a topic from the sidebar</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Simple markdown-to-JSX renderer (handles bold, code, links, lists, tables, headings)
function MarkdownContent({ content }) {
  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.includes('|') && lines[i + 1]?.match(/^\|[\s\-|]+$/)) {
      const headers = line.split('|').filter(Boolean).map(h => h.trim());
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {headers.map((h, j) => (
                  <th key={j} className="text-left px-2 py-1.5 border-b font-medium"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3);
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={i} className="rounded-lg p-3 my-2 overflow-x-auto text-xs"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // List item
    if (line.match(/^[-*]\s/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        listItems.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc pl-5 my-2 space-y-1">
          {listItems.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal pl-5 my-2 space-y-1">
          {listItems.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="my-2">{renderInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text) {
  // Process inline markdown: bold, inline code, links
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Link
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    // Find earliest match
    const matches = [
      boldMatch && { type: 'bold', index: boldMatch.index, match: boldMatch },
      codeMatch && { type: 'code', index: codeMatch.index, match: codeMatch },
      linkMatch && { type: 'link', index: linkMatch.index, match: linkMatch },
    ].filter(Boolean).sort((a, b) => a.index - b.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0];
    if (first.index > 0) parts.push(remaining.slice(0, first.index));

    if (first.type === 'bold') {
      parts.push(<strong key={key++} style={{ color: 'var(--text-primary)' }}>{first.match[1]}</strong>);
      remaining = remaining.slice(first.index + first.match[0].length);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded text-xs"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>
          {first.match[1]}
        </code>
      );
      remaining = remaining.slice(first.index + first.match[0].length);
    } else if (first.type === 'link') {
      parts.push(
        <a key={key++} href={first.match[2]} target="_blank" rel="noopener noreferrer"
          className="underline" style={{ color: 'var(--accent)' }}>
          {first.match[1]}
        </a>
      );
      remaining = remaining.slice(first.index + first.match[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
