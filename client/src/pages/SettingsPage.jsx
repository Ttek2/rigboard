import { useState, useEffect, useContext } from 'react';
import { Sun, Moon, Download, Upload, Plus, Trash2, Activity, Database, Rss, Lock, Palette, Globe, Code, Check, Users } from 'lucide-react';
import { SettingsContext } from '../App';
import { updateSettings, exportConfig, importConfig, getServices, createService, deleteService, exportOPML, importOPML, createBackup, getAuthStatus, setupAuth, setupTOTP, verifyTOTP, disableTOTP, toggleCommunity, registerSite, getSettings as fetchSettings } from '../api';
import { THEMES, applyTheme, getThemeGroups } from '../themes';
import { STYLES, applyStyle, getStyleGroups } from '../styles';

const TABS = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'services', label: 'Services', icon: Activity },
  { id: 'data', label: 'Data & Feeds', icon: Database },
  { id: 'auth', label: 'Security', icon: Lock },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'api', label: 'API & Integrations', icon: Code },
];

export default function SettingsPage() {
  const { settings, refreshSettings } = useContext(SettingsContext);
  const [activeTab, setActiveTab] = useState('general');
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('dark');
  const [activeStyles, setActiveStyles] = useState([]);
  const [colorOverrides, setColorOverrides] = useState({});
  const [customCss, setCustomCss] = useState('');
  const [weatherCity, setWeatherCity] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [services, setServices] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [svc, setSvc] = useState({ name: '', url: '', icon: '', group_name: 'Default' });
  const [saved, setSaved] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');

  useEffect(() => {
    setTitle(settings.dashboard_title || 'RigBoard');
    setTheme(settings.theme || 'dark');
    try { setActiveStyles(JSON.parse(settings.visual_styles || '[]')); } catch { setActiveStyles([]); }
    try { setColorOverrides(JSON.parse(settings.color_overrides || '{}')); } catch { setColorOverrides({}); }
    setCustomCss(settings.custom_css || '');
    setWeatherCity(settings.weather_city || '');
    setFontSize(parseInt(settings.font_size) || 14);
    setWallpaperUrl(settings.wallpaper_url || '');
    getServices().then(setServices).catch(console.error);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings({
      dashboard_title: title, theme, visual_styles: JSON.stringify(activeStyles),
      color_overrides: JSON.stringify(colorOverrides),
      custom_css: customCss, weather_city: weatherCity,
      font_size: String(fontSize), wallpaper_url: wallpaperUrl
    });
    applyTheme(theme, colorOverrides);
    refreshSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const data = await exportConfig();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rigboard-config.json'; a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => { const text = await e.target.files[0].text(); await importConfig(JSON.parse(text)); refreshSettings(); };
    input.click();
  };

  const input = (props) => (
    <input {...props} className={`w-full px-3 py-2 rounded-lg border text-sm ${props.className || ''}`}
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)', ...props.style }} />
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? 'font-medium' : ''}`}
            style={{
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
            }}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <>
            <Card title="Dashboard">
              <div className="space-y-4">
                <Field label="Title">
                  {input({ value: title, onChange: e => setTitle(e.target.value) })}
                </Field>
                <Field label="Text Size">
                  <div className="flex items-center gap-3">
                    <input type="range" min="11" max="20" value={fontSize}
                      onChange={e => { setFontSize(Number(e.target.value)); document.documentElement.style.setProperty('--font-size', e.target.value + 'px'); }}
                      className="flex-1" />
                    <span className="text-sm font-mono w-12 text-right" style={{ color: 'var(--text-primary)' }}>{fontSize}px</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {[{ label: 'Small', size: 12 }, { label: 'Default', size: 14 }, { label: 'Large', size: 16 }, { label: 'XL', size: 18 }].map(p => (
                      <button key={p.size} onClick={() => { setFontSize(p.size); document.documentElement.style.setProperty('--font-size', p.size + 'px'); }}
                        className={`px-2 py-1 rounded text-xs ${fontSize === p.size ? 'font-medium' : ''}`}
                        style={{
                          color: fontSize === p.size ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: fontSize === p.size ? 'var(--accent)11' : 'transparent',
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Background Wallpaper">
                  <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Paste an image URL or upload a local file. Works best with the Glass visual style.
                  </p>
                  <div className="flex gap-2">
                    <input value={wallpaperUrl} onChange={e => {
                        setWallpaperUrl(e.target.value);
                        document.documentElement.style.setProperty('--bg-wallpaper', e.target.value ? `url(${e.target.value})` : 'none');
                      }}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <button onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setWallpaperUrl(reader.result);
                            document.documentElement.style.setProperty('--bg-wallpaper', `url(${reader.result})`);
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      Upload
                    </button>
                  </div>
                  {wallpaperUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={wallpaperUrl} alt="" className="h-12 w-20 object-cover rounded" />
                      <button onClick={() => { setWallpaperUrl(''); document.documentElement.style.setProperty('--bg-wallpaper', 'none'); }}
                        className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Remove
                      </button>
                    </div>
                  )}
                </Field>

                <Field label="Weather City">
                  {input({ value: weatherCity, onChange: e => setWeatherCity(e.target.value), placeholder: 'e.g. Dublin' })}
                </Field>
              </div>
            </Card>

            <Card>
              <div className="mb-4">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Pick a color theme and a visual style independently -- any combination works. Changes preview live.
                </p>
              </div>

              {/* Active combo display */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border flex-wrap" style={{ borderColor: 'var(--accent)33', backgroundColor: 'var(--accent)08' }}>
                <Palette size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  <strong>{THEMES[theme]?.label || theme}</strong>
                </span>
                {activeStyles.length > 0 && activeStyles.map(id => (
                  <span key={id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent)22', color: 'var(--accent)' }}>
                    {STYLES[id]?.label || id}
                  </span>
                ))}
                {activeStyles.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>No style layers</span>
                )}
              </div>

              {/* Color Theme */}
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Palette size={14} /> Color Theme
                </h3>
                {Object.entries(getThemeGroups()).map(([group, themes]) => (
                  <div key={group} className="mb-3">
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{group}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {themes.map(t => (
                        <button key={t.id} onClick={() => { setTheme(t.id); applyTheme(t.id, colorOverrides); }}
                          className={`relative p-2 rounded-lg border text-xs text-left transition-all ${theme === t.id ? 'ring-2 ring-offset-1' : 'hover:border-gray-400'}`}
                          style={{
                            borderColor: theme === t.id ? t.vars['--accent'] : 'var(--border)',
                            ringColor: t.vars['--accent'],
                            backgroundColor: t.vars['--bg-secondary'],
                          }}>
                          {theme === t.id && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: t.vars['--accent'] }}>
                              <Check size={10} style={{ color: t.vars['--bg-primary'] }} />
                            </div>
                          )}
                          <div className="flex gap-1 mb-1.5">
                            {[t.vars['--accent'], t.vars['--bg-primary'], t.vars['--text-primary'], t.vars['--text-secondary']].map((c, i) => (
                              <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                          <span style={{ color: t.vars['--text-primary'] }}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Color overrides (collapsed by default) */}
                <details className="mt-3">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    Fine-tune individual colors...
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      ['--accent', 'Accent'],
                      ['--bg-primary', 'Background'],
                      ['--bg-card', 'Card Background'],
                      ['--border', 'Borders'],
                      ['--text-primary', 'Text'],
                      ['--text-secondary', 'Text Muted'],
                    ].map(([varName, label]) => {
                      const currentTheme = THEMES[theme];
                      const baseValue = currentTheme?.vars[varName] || '#000000';
                      const overrideValue = colorOverrides[varName];
                      return (
                        <div key={varName} className="flex items-center gap-2 p-1.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                          <input type="color"
                            value={overrideValue || baseValue}
                            onChange={e => {
                              const newOverrides = { ...colorOverrides, [varName]: e.target.value };
                              setColorOverrides(newOverrides);
                              applyTheme(theme, newOverrides);
                            }}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                          <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
                          {overrideValue && (
                            <button onClick={() => {
                              const { [varName]: _, ...rest } = colorOverrides;
                              setColorOverrides(rest);
                              applyTheme(theme, rest);
                            }}
                              className="text-[10px] px-1 rounded" style={{ color: 'var(--text-secondary)' }}>
                              Reset
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>

              {/* Divider */}
              <div className="border-t mb-6" style={{ borderColor: 'var(--border)' }} />

              {/* Visual Style */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  Visual Style
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Toggle multiple -- they stack. E.g. Glass + Wide + Compact all work together.
                </p>
                {Object.entries(getStyleGroups()).map(([group, styles]) => (
                  <div key={group} className="mb-3">
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{group}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {styles.map(s => {
                        const isActive = activeStyles.includes(s.id);
                        return (
                          <button key={s.id} onClick={() => {
                            const next = isActive ? activeStyles.filter(x => x !== s.id) : [...activeStyles, s.id];
                            setActiveStyles(next);
                            applyStyle(next);
                          }}
                            className={`p-3 rounded-lg border text-left transition-all ${isActive ? 'ring-2 ring-offset-1' : 'hover:border-gray-400'}`}
                            style={{
                              borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                              ringColor: 'var(--accent)',
                              backgroundColor: isActive ? 'var(--accent)11' : 'var(--bg-secondary)',
                            }}>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isActive ? '' : ''}`}
                                style={{ borderColor: isActive ? 'var(--accent)' : 'var(--border)', backgroundColor: isActive ? 'var(--accent)' : 'transparent' }}>
                                {isActive && <Check size={9} style={{ color: 'var(--bg-primary)' }} />}
                              </div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                            </div>
                            <span className="text-[10px] block mt-1 ml-5" style={{ color: 'var(--text-secondary)' }}>{s.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t mb-4" style={{ borderColor: 'var(--border)' }} />

              <details>
                <summary className="text-xs cursor-pointer mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Custom CSS (advanced)...
                </summary>
                <textarea value={customCss} onChange={e => setCustomCss(e.target.value)}
                  rows={3} placeholder="body { ... }"
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </details>
            </Card>

            <button onClick={handleSave}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white w-full"
              style={{ backgroundColor: saved ? '#22c55e' : 'var(--accent)' }}>
              {saved ? 'Saved!' : 'Save All Settings'}
            </button>
          </>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Monitored Services</h2>
              <button onClick={() => setShowAddService(!showAddService)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white"
                style={{ backgroundColor: 'var(--accent)' }}>
                <Plus size={14} /> Add
              </button>
            </div>

            {showAddService && (
              <form onSubmit={async (e) => { e.preventDefault(); await createService(svc); setSvc({ name: '', url: '', icon: '', group_name: 'Default' }); setShowAddService(false); getServices().then(setServices); }}
                className="mb-4 p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-2 gap-3">
                  {input({ value: svc.name, onChange: e => setSvc({ ...svc, name: e.target.value }), placeholder: 'Service name', required: true })}
                  {input({ value: svc.url, onChange: e => setSvc({ ...svc, url: e.target.value }), placeholder: 'URL (https://...)', required: true })}
                  {input({ value: svc.icon, onChange: e => setSvc({ ...svc, icon: e.target.value }), placeholder: 'Icon (emoji)' })}
                  {input({ value: svc.group_name, onChange: e => setSvc({ ...svc, group_name: e.target.value }), placeholder: 'Group' })}
                </div>
                <button type="submit" className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Add Service</button>
              </form>
            )}

            <div className="space-y-2">
              {services.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.icon ? `${s.icon} ` : ''}{s.name}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{s.url}</span>
                  </div>
                  <button onClick={async () => { await deleteService(s.id); getServices().then(setServices); }}
                    className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}><Trash2 size={14} /></button>
                </div>
              ))}
              {services.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No services monitored.</p>}
            </div>

            <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
              Integration widgets (Jellyseerr, Sonarr, Plex, Pi-hole, etc.) can be configured directly from the dashboard -- click the gear icon on any widget.
            </p>
          </Card>
        )}

        {/* DATA & FEEDS TAB */}
        {activeTab === 'data' && (
          <>
            <Card title="Feed Import/Export (OPML)">
              <div className="flex gap-3">
                <button onClick={async () => {
                  const opml = await exportOPML();
                  const blob = new Blob([opml], { type: 'application/xml' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rigboard-feeds.opml'; a.click();
                }} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <Download size={14} /> Export OPML
                </button>
                <button onClick={() => {
                  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.opml,.xml';
                  inp.onchange = async (e) => { const text = await e.target.files[0].text(); const r = await importOPML(text); alert(`Imported ${r.imported} of ${r.total} feeds`); };
                  inp.click();
                }} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <Upload size={14} /> Import OPML
                </button>
              </div>
            </Card>

            <Card title="Data & Backup">
              <div className="flex flex-wrap gap-3">
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <Download size={14} /> Export Config
                </button>
                <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <Upload size={14} /> Import Config
                </button>
                <button onClick={async () => {
                  setBackupStatus('Creating...');
                  try { const r = await createBackup(); setBackupStatus(`Saved to ${r.path}`); }
                  catch (e) { setBackupStatus('Failed: ' + e.message); }
                  setTimeout(() => setBackupStatus(''), 5000);
                }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--accent)' }}>
                  <Database size={14} /> Backup Now
                </button>
              </div>
              {backupStatus && <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{backupStatus}</p>}
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Auto-backup runs daily at 2:00 AM, keeping the last 7 backups.</p>
            </Card>
          </>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'auth' && (
          <Card title="Authentication">
            <AuthSettings />
          </Card>
        )}

        {/* COMMUNITY TAB */}
        {activeTab === 'community' && (
          <CommunitySettings />
        )}

        {/* API & INTEGRATIONS TAB */}
        {activeTab === 'api' && (
          <Card title="API & Integrations">
            <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>API docs: <a href="/api/docs" target="_blank" className="underline" style={{ color: 'var(--accent)' }}>/api/docs</a> (Swagger UI)</p>
              <p>Prometheus metrics: <a href="/metrics" target="_blank" className="underline" style={{ color: 'var(--accent)' }}>/metrics</a></p>
              <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Webhooks</p>
                <p>Endpoint: <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>POST /api/v1/webhooks/incoming</code></p>
                <p className="text-xs mt-1">Supports Uptime Kuma, Grafana, GitHub. Add <code>?source=myapp</code> or <code>X-Webhook-Source</code> header.</p>
              </div>
              <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Integration Widgets</p>
                <p>All integration widgets (Jellyseerr, Sonarr, Radarr, Plex, Jellyfin, Pi-hole, qBittorrent, Transmission, Home Assistant) are configurable directly from the dashboard.</p>
                <p className="mt-1">Add the widget to your dashboard, then click the <strong>gear icon</strong> to enter the URL and API key.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {title && <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h2>}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

function AuthSettings() {
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [totpSetup, setTotpSetup] = useState(null); // { qr, secret }
  const [totpCode, setTotpCode] = useState('');
  const [totpStatus, setTotpStatus] = useState('');

  useEffect(() => {
    getAuthStatus().then(s => {
      setEnabled(s.auth_enabled);
      setTotpEnabled(s.totp_enabled);
    }).catch(() => {});
  }, []);

  const handleStartTotpSetup = async () => {
    const data = await setupTOTP();
    setTotpSetup(data);
    setTotpCode('');
    setTotpStatus('');
  };

  const handleVerifyTotp = async () => {
    try {
      await verifyTOTP(totpCode);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpStatus('2FA enabled successfully!');
      setTimeout(() => setTotpStatus(''), 3000);
    } catch (e) {
      setTotpStatus(e.message || 'Invalid code');
    }
  };

  const handleDisableTotp = async () => {
    await disableTOTP();
    setTotpEnabled(false);
    setTotpSetup(null);
    setTotpStatus('2FA disabled');
    setTimeout(() => setTotpStatus(''), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Password auth */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Password</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Enable password protection</span>
        </label>
        {enabled && (
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Set or change password"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        )}
        <button onClick={async () => {
          try { await setupAuth(password, enabled); setStatus(enabled ? 'Auth enabled' : 'Auth disabled'); setPassword(''); setTimeout(() => setStatus(''), 3000); }
          catch (e) { setStatus('Error: ' + e.message); }
        }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Save Password Settings
        </button>
        {status && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{status}</p>}
      </div>

      {/* TOTP 2FA */}
      <div className="border-t pt-5 space-y-3" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Two-Factor Authentication (2FA)
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) for an extra layer of security. Requires password auth to be enabled.
        </p>

        {totpEnabled && !totpSetup ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" /> 2FA is enabled
            </span>
            <button onClick={handleDisableTotp}
              className="px-3 py-1.5 rounded-lg text-sm border text-red-400 border-red-400/30 hover:bg-red-400/10">
              Disable 2FA
            </button>
          </div>
        ) : !totpSetup ? (
          <button onClick={handleStartTotpSetup} disabled={!enabled}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)', opacity: enabled ? 1 : 0.5 }}>
            Set Up 2FA
          </button>
        ) : null}

        {!enabled && !totpEnabled && (
          <p className="text-xs text-amber-400">Enable password protection first to use 2FA.</p>
        )}

        {/* TOTP Setup flow */}
        {totpSetup && (
          <div className="p-4 rounded-lg border space-y-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              1. Scan this QR code with your authenticator app:
            </p>
            <div className="flex justify-center">
              <img src={totpSetup.qr} alt="TOTP QR Code" className="rounded-lg" style={{ width: 200, height: 200 }} />
            </div>
            <details className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <summary className="cursor-pointer">Can't scan? Enter this key manually</summary>
              <code className="block mt-1 p-2 rounded break-all font-mono" style={{ backgroundColor: 'var(--bg-primary)' }}>
                {totpSetup.secret}
              </code>
            </details>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              2. Enter the 6-digit code to verify:
            </p>
            <div className="flex gap-2">
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" maxLength={6}
                className="px-3 py-2 rounded-lg border text-sm font-mono tracking-widest text-center w-32"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button onClick={handleVerifyTotp}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}>
                Verify & Enable
              </button>
              <button onClick={() => setTotpSetup(null)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {totpStatus && <p className="text-sm" style={{ color: totpStatus.includes('enabled') ? '#22c55e' : 'var(--text-secondary)' }}>{totpStatus}</p>}
      </div>
    </div>
  );
}

function CommunitySettings() {
  const [enabled, setEnabled] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetchSettings().then(s => {
      setEnabled(s.community_opted_in === 'true');
      setDisplayName(s.community_display_name || '');
      setSiteKey(s.community_site_key || '');
    }).catch(() => {});
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    try {
      await toggleCommunity(next, displayName);
      setEnabled(next);
      setStatus(next ? 'Community enabled' : 'Community disabled');
      setTimeout(() => setStatus(''), 3000);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const handleSaveName = async () => {
    try {
      await toggleCommunity(enabled, displayName);
      setStatus('Display name saved');
      setTimeout(() => setStatus(''), 3000);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const handleRegisterSite = async () => {
    try {
      const result = await registerSite({ name: siteName, url: siteUrl, webhook_url: webhookUrl });
      setSiteKey(result.site_key);
      setWebhookSecret(result.webhook_secret);
      setStatus('Site registered');
      setTimeout(() => setStatus(''), 3000);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  return (
    <>
      <Card title="Ttek2 Community">
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Connect to Ttek2 to comment on articles, discuss trending topics, and show your rig badge to the community.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={handleToggle}
              className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ backgroundColor: enabled ? 'var(--accent)' : 'var(--border)' }}>
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
                style={{ left: enabled ? '22px' : '2px' }} />
            </button>
            <div>
              <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                {enabled ? 'Connected' : 'Disconnected'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {enabled ? 'Your rig badge and comments are visible on ttek2.com' : 'Toggle on to join the community'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg text-[10px] leading-relaxed" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Privacy:</strong> When enabled, only your display name, rig badge (e.g. "RTX 4090"), and comments you post are shared with the ttek2.com community.
            No other data leaves your RigBoard instance. Ttek2 stores zero user data -- all accounts and content are managed by your RigBoard server.
            You can disconnect at any time by toggling this off.
          </div>

          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>Display Name</label>
            <div className="flex gap-2">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Your community display name"
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button onClick={handleSaveName}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}>
                Save
              </button>
            </div>
          </div>

          {status && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{status}</p>}

          {siteKey && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Connected Site Key</p>
              <code className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{siteKey}</code>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <button onClick={() => setShowAdmin(!showAdmin)}
          className="text-sm font-medium flex items-center gap-1"
          style={{ color: 'var(--text-secondary)' }}>
          {showAdmin ? 'Hide' : 'Show'} Site Administration
        </button>

        {showAdmin && (
          <div className="mt-4 space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Register a new site to enable community features. This generates a site key and webhook secret.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Site name (e.g. ttek2)"
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="Site URL (https://ttek2.com)"
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="Webhook URL (optional)"
                className="col-span-2 px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={handleRegisterSite}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}>
              Register Site
            </button>

            {webhookSecret && (
              <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Site Key (give to site admin)</p>
                  <code className="text-xs font-mono block mt-0.5" style={{ color: 'var(--accent)' }}>{siteKey}</code>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Webhook Secret (keep secure)</p>
                  <code className="text-xs font-mono block mt-0.5 break-all" style={{ color: '#f59e0b' }}>{webhookSecret}</code>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
