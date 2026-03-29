const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Settings
export const getSettings = () => request('/settings');
export const updateSettings = (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) });
export const exportConfig = () => request('/settings/export', { method: 'POST' });
export const importConfig = (data) => request('/settings/import', { method: 'POST', body: JSON.stringify(data) });

// Widgets
export const getWidgetLayout = () => request('/widgets/layout');
export const saveWidgetLayout = (widgets) => request('/widgets/layout', { method: 'PUT', body: JSON.stringify(widgets) });

// Bookmarks
export const getBookmarks = () => request('/bookmarks');
export const createBookmark = (data) => request('/bookmarks', { method: 'POST', body: JSON.stringify(data) });
export const updateBookmark = (id, data) => request(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBookmark = (id) => request(`/bookmarks/${id}`, { method: 'DELETE' });

// Notes
export const getNotes = () => request('/notes');
export const createNote = (data) => request('/notes', { method: 'POST', body: JSON.stringify(data) });
export const updateNote = (id, data) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteNote = (id) => request(`/notes/${id}`, { method: 'DELETE' });

// Feeds
export const getFeeds = () => request('/feeds');
export const getDefaultFeeds = () => request('/feeds/defaults');
export const addFeed = (data) => request('/feeds', { method: 'POST', body: JSON.stringify(data) });
export const updateFeed = (id, data) => request(`/feeds/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFeed = (id) => request(`/feeds/${id}`, { method: 'DELETE' });
export const getFeedItems = (id, limit) => request(`/feeds/${id}/items?limit=${limit || 50}`);
export const getLatestFeedItems = (limit, group) => request(`/feeds/items/latest?limit=${limit || 30}${group ? `&group=${encodeURIComponent(group)}` : ''}`);
export const getFeedGroups = () => request('/feeds/groups');
export const refreshFeed = (id) => request(`/feeds/${id}/refresh`, { method: 'POST' });
export const markFeedItemRead = (itemId, isRead) => request(`/feeds/items/${itemId}/read`, { method: 'PUT', body: JSON.stringify({ is_read: isRead }) });
export const toggleStarItem = (itemId) => request(`/feeds/items/${itemId}/star`, { method: 'POST' });
export const getStarredItems = () => request('/feeds/items/starred');

// Rigs
export const getRigs = () => request('/rigs');
export const createRig = (formData) => fetch(`${BASE}/rigs`, { method: 'POST', body: formData }).then(r => r.json());
export const getRig = (id) => request(`/rigs/${id}`);
export const updateRig = (id, formData) => fetch(`${BASE}/rigs/${id}`, { method: 'PUT', body: formData }).then(r => r.json());
export const deleteRig = (id) => request(`/rigs/${id}`, { method: 'DELETE' });
export const addComponent = (rigId, data) => request(`/rigs/${rigId}/components`, { method: 'POST', body: JSON.stringify(data) });
export const getRigTimeline = (id) => request(`/rigs/${id}/timeline`);
export const bulkImportComponents = (rigId, components) => request(`/rigs/${rigId}/import`, { method: 'POST', body: JSON.stringify({ components }) });

// Components
export const updateComponent = (id, data) => request(`/components/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteComponent = (id) => request(`/components/${id}`, { method: 'DELETE' });
export const logMaintenance = (componentId, data) => request(`/components/${componentId}/maintenance`, { method: 'POST', body: JSON.stringify(data) });
export const getMaintenanceHistory = (componentId) => request(`/components/${componentId}/maintenance`);
export const createSchedule = (componentId, data) => request(`/components/${componentId}/schedule`, { method: 'POST', body: JSON.stringify(data) });
export const uploadComponentImage = (componentId, formData) => fetch(`${BASE}/components/${componentId}/images`, { method: 'POST', body: formData }).then(r => r.json());
export const getComponentImages = (componentId) => request(`/components/${componentId}/images`);
export const deleteComponentImage = (imageId) => request(`/components/images/${imageId}`, { method: 'DELETE' });

// Maintenance
export const getUpcomingMaintenance = () => request('/maintenance/upcoming');
export const deleteSchedule = (id) => request(`/maintenance/schedules/${id}`, { method: 'DELETE' });

// Services
export const getServices = () => request('/services');
export const createService = (data) => request('/services', { method: 'POST', body: JSON.stringify(data) });
export const updateService = (id, data) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteService = (id) => request(`/services/${id}`, { method: 'DELETE' });
export const getServiceStatus = () => request('/services/status');

// Search
export const globalSearch = (q) => request(`/search?q=${encodeURIComponent(q)}`);

// Docker
export const getDockerContainers = () => request('/docker/containers');

// Notifications
export const getNotifications = () => request('/notifications');
export const getUnreadCount = () => request('/notifications/unread-count');
export const markAllRead = () => request('/notifications/read-all', { method: 'PUT' });
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: 'PUT' });
export const deleteNotification = (id) => request(`/notifications/${id}`, { method: 'DELETE' });
export const clearNotifications = () => request('/notifications', { method: 'DELETE' });

// System
export const getSystemStats = () => request('/system/stats');
export const createBackup = (backupPath) => request('/system/backup', { method: 'POST', body: JSON.stringify({ path: backupPath }) });

// Dashboard Tabs
export const getTabs = () => request('/tabs');
export const createTab = (data) => request('/tabs', { method: 'POST', body: JSON.stringify(data) });
export const updateTab = (id, data) => request(`/tabs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTab = (id) => request(`/tabs/${id}`, { method: 'DELETE' });

// OPML
export const exportOPML = () => fetch(`${BASE}/feeds/opml`).then(r => r.text());
export const importOPML = (opmlText) => fetch(`${BASE}/feeds/opml`, { method: 'POST', body: opmlText }).then(r => r.json());

// Auth
export const getAuthStatus = () => request('/auth/status');
export const login = (password, totp_code) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password, totp_code }) });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const setupAuth = (password, enable) => request('/auth/setup', { method: 'POST', body: JSON.stringify({ password, enable }) });
export const setupTOTP = () => request('/auth/totp/setup', { method: 'POST' });
export const verifyTOTP = (code) => request('/auth/totp/verify', { method: 'POST', body: JSON.stringify({ code }) });
export const disableTOTP = () => request('/auth/totp/disable', { method: 'POST' });

// Articles
export const getArticle = (itemId) => request(`/articles/${itemId}`);

// Share
export const shareRig = (rigId) => request(`/share/rig/${rigId}`, { method: 'POST' });
export const unshareRig = (rigId) => request(`/share/rig/${rigId}`, { method: 'DELETE' });
export const getSharedRig = (token) => request(`/share/${token}`);

// Prices
export const recordPrice = (componentId, data) => request(`/prices/${componentId}`, { method: 'POST', body: JSON.stringify(data) });
export const getPriceHistory = (componentId) => request(`/prices/${componentId}`);

// Home Assistant
export const getHAEntities = () => request('/homeassistant/entities');

// Webhooks
export const getWebhookLog = () => request('/webhooks/log');

// Integrations
export const getJellyseerrRequests = () => request('/integrations/jellyseerr/requests');
export const approveJellyseerrRequest = (id) => request(`/integrations/jellyseerr/requests/${id}/approve`, { method: 'POST' });
export const declineJellyseerrRequest = (id) => request(`/integrations/jellyseerr/requests/${id}/decline`, { method: 'POST' });
export const getSonarrCalendar = () => request('/integrations/sonarr/calendar');
export const getRadarrCalendar = () => request('/integrations/radarr/calendar');
export const getSonarrQueue = () => request('/integrations/sonarr/queue');
export const getRadarrQueue = () => request('/integrations/radarr/queue');
export const getPlexPlaying = () => request('/integrations/plex/playing');
export const getPlexRecent = () => request('/integrations/plex/recent');
export const getPlexLibraries = () => request('/integrations/plex/libraries');
export const getJellyfinPlaying = () => request('/integrations/jellyfin/playing');
export const getJellyfinLibraries = () => request('/integrations/jellyfin/libraries');
export const getJellyfinRecent = () => request('/integrations/jellyfin/recent');
export const getSonarrStats = () => request('/integrations/sonarr/stats');
export const getRadarrStats = () => request('/integrations/radarr/stats');
export const getPiholeStats = () => request('/integrations/pihole/stats');
export const getPiholeTop = () => request('/integrations/pihole/top');
export const togglePihole = (enable) => request('/integrations/pihole/toggle', { method: 'POST', body: JSON.stringify({ enable }) });
export const getQbitTorrents = () => request('/integrations/qbittorrent/torrents');
export const getTransmissionTorrents = () => request('/integrations/transmission/torrents');
export const getNetworkInfo = () => request('/integrations/network/info');
export const getGithubReleases = (repos) => request(`/integrations/releases?repos=${encodeURIComponent(repos || '')}`);
export const dockerAction = (name, action) => request(`/docker/containers/${name}/${action}`, { method: 'POST' });
export const getDockerStats = () => request('/docker/stats');

// Community Pulse
export const getPulse = () => request('/integrations/pulse');
export const getRigMatchKeywords = () => request('/integrations/pulse/rig-match');
export const getPulseCreator = (slug) => request(`/integrations/pulse/creator/${slug}`);

// AI
export const getAIContext = () => request('/ai/context');
export const streamAIChat = (messages, includeContext = true) =>
  fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, include_context: includeContext }),
  });
export const getPulseHistory = (slug) => request(`/integrations/pulse/history/${slug}`);
export const triggerHeartbeat = () => request('/ai/heartbeat', { method: 'POST' });
export const getHeartbeatStatus = () => request('/ai/heartbeat/status');
export const getAIHistory = () => request('/ai/history');
export const saveAIMessage = (role, content) => request('/ai/history', { method: 'POST', body: JSON.stringify({ role, content }) });
export const clearAIHistory = () => request('/ai/history', { method: 'DELETE' });
export const extractMemories = (text) => request('/ai/memory/extract', { method: 'POST', body: JSON.stringify({ text }) });
export const getAIMemory = () => request('/ai/memory');
export const executeAIAction = (action, params) => request('/ai/actions/execute', { method: 'POST', body: JSON.stringify({ action, params }) });
export const getAIAutonomy = () => request('/ai/actions/autonomy');

// Community
export const toggleCommunity = (enabled, displayName) => request('/community/toggle', { method: 'POST', body: JSON.stringify({ enabled, display_name: displayName }) });
export const registerSite = (data) => request('/community/sites', { method: 'POST', body: JSON.stringify(data) });
