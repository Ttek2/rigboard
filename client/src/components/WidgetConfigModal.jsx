import { useState, useEffect } from 'react';
import { X, Link, Key } from 'lucide-react';
import { getSettings, updateSettings } from '../api';

// Widget-level config (saved to widget_config)
const WIDGET_FIELDS = {
  feeds: [
    { key: 'title', label: 'Widget Title', placeholder: 'News Feed' },
    { key: 'group', label: 'Feed Group', placeholder: 'Leave empty for all' },
    { key: 'limit', label: 'Max Items', type: 'number', placeholder: '20' },
  ],
  embed: [
    { key: 'title', label: 'Widget Title', placeholder: 'Embed' },
    { key: 'url', label: 'URL to embed', placeholder: 'https://grafana.local/...' },
  ],
  weather: [
    { key: 'city', label: 'City', placeholder: 'Dublin' },
  ],
  websearch: [
    { key: 'engine', label: 'Default engine (duckduckgo, brave, searxng, google, bing, startpage)', placeholder: 'duckduckgo' },
  ],
  ai: [
    { key: 'include_context', label: 'Include dashboard context (true/false)', placeholder: 'true' },
    { key: 'ai_heartbeat', label: 'Enable AI heartbeat notifications (true/false)', placeholder: 'false' },
    { key: 'ai_heartbeat_interval', label: 'Heartbeat interval (minutes)', placeholder: '60' },
    { key: 'ai_autonomy', label: 'Autonomy level (confirm, semi, full)', placeholder: 'confirm' },
  ],
  homeassistant: [
    { key: 'entities', label: 'Entity IDs (comma-separated)', placeholder: 'sensor.temperature, switch.lights' },
  ],
  media: [
    { key: 'source', label: 'Source (plex or jellyfin)', placeholder: 'plex' },
  ],
  starr: [
    { key: 'service', label: 'Service (sonarr or radarr)', placeholder: 'sonarr' },
  ],
  downloads: [
    { key: 'client', label: 'Client (qbittorrent or transmission)', placeholder: 'qbittorrent' },
  ],
  releases: [
    { key: 'repos', label: 'GitHub repos (comma-separated)', placeholder: 'jellyfin/jellyfin, sonarr/Sonarr' },
  ],
  youtube: [
    { key: 'channels', label: 'YouTube channels (comma-separated URLs, @handles, or channel IDs)', placeholder: '@mkbhd, @LinusTechTips, @JerryRigEverything' },
  ],
};

// Integration settings (saved to server settings table)
const INTEGRATION_FIELDS = {
  jellyseerr: [
    { key: 'jellyseerr_url', label: 'Jellyseerr URL', placeholder: 'http://jellyseerr:5055', icon: Link },
    { key: 'jellyseerr_api_key', label: 'API Key', placeholder: 'Your Jellyseerr API key', icon: Key, password: true },
  ],
  media: [
    { key: 'plex_url', label: 'Plex URL', placeholder: 'http://plex:32400', icon: Link, showIf: (cfg) => (cfg.source || 'plex') === 'plex' },
    { key: 'plex_token', label: 'Plex Token', placeholder: 'Your X-Plex-Token', icon: Key, password: true, showIf: (cfg) => (cfg.source || 'plex') === 'plex' },
    { key: 'jellyfin_url', label: 'Jellyfin URL', placeholder: 'http://jellyfin:8096', icon: Link, showIf: (cfg) => cfg.source === 'jellyfin' },
    { key: 'jellyfin_api_key', label: 'Jellyfin API Key', placeholder: 'Your Jellyfin API key', icon: Key, password: true, showIf: (cfg) => cfg.source === 'jellyfin' },
  ],
  starr: [
    { key: 'sonarr_url', label: 'Sonarr URL', placeholder: 'http://sonarr:8989', icon: Link, showIf: (cfg) => (cfg.service || 'sonarr') === 'sonarr' },
    { key: 'sonarr_api_key', label: 'Sonarr API Key', placeholder: 'Your Sonarr API key', icon: Key, password: true, showIf: (cfg) => (cfg.service || 'sonarr') === 'sonarr' },
    { key: 'radarr_url', label: 'Radarr URL', placeholder: 'http://radarr:7878', icon: Link, showIf: (cfg) => cfg.service === 'radarr' },
    { key: 'radarr_api_key', label: 'Radarr API Key', placeholder: 'Your Radarr API key', icon: Key, password: true, showIf: (cfg) => cfg.service === 'radarr' },
  ],
  pihole: [
    { key: 'pihole_url', label: 'Pi-hole URL', placeholder: 'http://pihole or https://pihole.example.com', icon: Link },
    { key: 'pihole_api_key', label: 'Web Password (v6) or API Token (v5)', placeholder: 'Your Pi-hole admin password', icon: Key, password: true },
  ],
  downloads: [
    { key: 'qbittorrent_url', label: 'qBittorrent URL', placeholder: 'http://qbittorrent:8080', icon: Link, showIf: (cfg) => (cfg.client || 'qbittorrent') === 'qbittorrent' },
    { key: 'qbittorrent_user', label: 'Username', placeholder: 'admin', showIf: (cfg) => (cfg.client || 'qbittorrent') === 'qbittorrent' },
    { key: 'qbittorrent_pass', label: 'Password', placeholder: 'password', password: true, showIf: (cfg) => (cfg.client || 'qbittorrent') === 'qbittorrent' },
    { key: 'transmission_url', label: 'Transmission URL', placeholder: 'http://transmission:9091', icon: Link, showIf: (cfg) => cfg.client === 'transmission' },
  ],
  homeassistant: [
    { key: 'ha_url', label: 'Home Assistant URL', placeholder: 'http://homeassistant.local:8123', icon: Link },
    { key: 'ha_token', label: 'Long-Lived Access Token', placeholder: 'eyJ...', icon: Key, password: true },
  ],
  websearch: [
    { key: 'search_provider', label: 'Search API provider', placeholder: 'duckduckgo (no key), brave (key required), searxng (URL required)' },
    { key: 'brave_search_api_key', label: 'Brave Search API Key', placeholder: 'BSA...', icon: Key, password: true },
    { key: 'searxng_url', label: 'SearXNG Instance URL', placeholder: 'https://search.example.com', icon: Link },
  ],
  ai: [
    { key: 'ai_url', label: 'API Base URL', placeholder: 'https://api.openai.com (or http://localhost:11434 for Ollama)', icon: Link },
    { key: 'ai_api_key', label: 'API Key', placeholder: 'sk-... (leave empty for local models)', icon: Key, password: true },
    { key: 'ai_model', label: 'Model', placeholder: 'gpt-4o-mini, llama3, mistral, etc.' },
    { key: 'ai_max_tokens', label: 'Max tokens', placeholder: '1024' },
    { key: 'ai_timeout', label: 'Timeout in seconds (for large model loading)', placeholder: '600' },
  ],
};

export default function WidgetConfigModal({ widget, onSave, onClose }) {
  const [config, setConfig] = useState({ ...(widget.widget_config || {}) });
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const widgetFields = WIDGET_FIELDS[widget.widget_type] || [];
  const integrationFields = (INTEGRATION_FIELDS[widget.widget_type] || []).filter(f => !f.showIf || f.showIf(config));
  const hasFields = widgetFields.length > 0 || integrationFields.length > 0;

  useEffect(() => {
    if (integrationFields.length > 0) {
      getSettings().then(setSettings).catch(() => {});
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);

    // Save integration settings to server
    if (integrationFields.length > 0) {
      const settingsUpdate = {};
      for (const field of integrationFields) {
        if (settings[field.key] !== undefined) settingsUpdate[field.key] = settings[field.key];
      }
      if (Object.keys(settingsUpdate).length > 0) {
        await updateSettings(settingsUpdate);
      }
    }

    // Save widget config
    onSave(config);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Configure {widget.widget_type.charAt(0).toUpperCase() + widget.widget_type.slice(1)}
      </h3>

      {!hasFields ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No configuration options for this widget.</p>
      ) : (
        <div className="space-y-3">
          {/* Widget-level config */}
          {widgetFields.map(field => (
            <label key={field.key} className="block">
              <span className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{field.label}</span>
              <input type={field.type || 'text'}
                value={config[field.key] || ''}
                onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full px-3 py-1.5 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </label>
          ))}

          {/* Integration settings (URL/API key) */}
          {integrationFields.length > 0 && widgetFields.length > 0 && (
            <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Connection Settings</p>
            </div>
          )}
          {integrationFields.length > 0 && widgetFields.length === 0 && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Connection Settings</p>
          )}
          {integrationFields.map(field => (
            <label key={field.key} className="block">
              <span className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                {field.icon && <field.icon size={10} />}
                {field.label}
              </span>
              <input type={field.password ? 'password' : 'text'}
                value={settings[field.key] || ''}
                onChange={e => setSettings({ ...settings, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full px-3 py-1.5 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: saved ? '#22c55e' : 'var(--accent)', opacity: saving ? 0.7 : 1 }}>
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-sm"
          style={{ color: 'var(--text-secondary)' }}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-auto p-5 rounded-xl border shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1" style={{ color: 'var(--text-secondary)' }}>
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
