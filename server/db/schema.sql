-- Rigs
CREATE TABLE IF NOT EXISTS rigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Components (self-referencing for nesting)
CREATE TABLE IF NOT EXISTS components (
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
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    notes TEXT,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recurring maintenance schedules
CREATE TABLE IF NOT EXISTS maintenance_schedules (
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
CREATE TABLE IF NOT EXISTS feeds (
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
CREATE TABLE IF NOT EXISTS feed_items (
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
CREATE TABLE IF NOT EXISTS services (
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
CREATE TABLE IF NOT EXISTS widget_layout (
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
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    group_name TEXT DEFAULT 'Default',
    sort_order INTEGER DEFAULT 0
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT 'Untitled',
    content TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service health check history (for uptime sparklines)
CREATE TABLE IF NOT EXISTS service_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response_ms INTEGER,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Starred feed items
CREATE TABLE IF NOT EXISTS starred_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_item_id INTEGER NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_item_id)
);

-- Component images
CREATE TABLE IF NOT EXISTS component_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard tabs (multiple layouts)
CREATE TABLE IF NOT EXISTS dashboard_tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
    cols INTEGER DEFAULT 4,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Component price history
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    source TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Incoming webhooks log
CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    payload JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shared rig links
CREATE TABLE IF NOT EXISTS shared_rigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rig_id INTEGER NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI chat history
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI memory (persistent knowledge the AI accumulates)
CREATE TABLE IF NOT EXISTS ai_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- === COMMUNITY SYSTEM ===

-- Community user accounts (separate from dashboard auth)
CREATE TABLE IF NOT EXISTS community_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    avatar_color TEXT DEFAULT '#3b82f6',
    bio TEXT,
    karma INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth clients (registered apps like ttek2)
CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    allowed_scopes TEXT DEFAULT 'community.read community.write profile.read',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth authorization codes (short-lived)
CREATE TABLE IF NOT EXISTS oauth_codes (
    code TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
    user_id TEXT NOT NULL REFERENCES community_users(id),
    scope TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth access tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
    token TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
    user_id TEXT NOT NULL REFERENCES community_users(id),
    scope TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comments (for articles on external sites)
CREATE TABLE IF NOT EXISTS community_comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES community_users(id),
    site_id TEXT NOT NULL,
    page_type TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id TEXT REFERENCES community_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'approved',
    report_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comment votes
CREATE TABLE IF NOT EXISTS community_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES community_users(id),
    direction TEXT NOT NULL DEFAULT 'up',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);

-- Comment reports
CREATE TABLE IF NOT EXISTS community_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES community_users(id),
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);
