import { useState } from 'react';
import { Monitor, ArrowRight, Check } from 'lucide-react';
import { updateSettings, addFeed, saveWidgetLayout, getDefaultFeeds } from '../api';

// rowHeight=40px grid units
const DEFAULT_LAYOUT = [
  { widget_type: 'pulse', widget_config: {}, grid_x: 0, grid_y: 0, grid_w: 2, grid_h: 12, is_visible: 1 },
  { widget_type: 'feeds', widget_config: { title: 'Tech News' }, grid_x: 2, grid_y: 0, grid_w: 2, grid_h: 10, is_visible: 1 },
  { widget_type: 'rigs', widget_config: {}, grid_x: 0, grid_y: 12, grid_w: 1, grid_h: 7, is_visible: 1 },
  { widget_type: 'bookmarks', widget_config: {}, grid_x: 1, grid_y: 12, grid_w: 1, grid_h: 7, is_visible: 1 },
  { widget_type: 'maintenance', widget_config: {}, grid_x: 2, grid_y: 10, grid_w: 2, grid_h: 7, is_visible: 1 },
  { widget_type: 'notes', widget_config: {}, grid_x: 0, grid_y: 19, grid_w: 2, grid_h: 7, is_visible: 1 },
  { widget_type: 'services', widget_config: {}, grid_x: 2, grid_y: 17, grid_w: 2, grid_h: 4, is_visible: 1 },
];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('RigBoard');
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    setLoading(true);
    try {
      await updateSettings({ dashboard_title: title, theme, setup_complete: 'true' });
      document.documentElement.setAttribute('data-theme', theme);

      // Fetch default feeds from server config (server/defaults/feeds.json)
      const defaultFeeds = await getDefaultFeeds().catch(() => []);
      for (const feed of defaultFeeds) {
        try { await addFeed(feed); } catch (e) { console.warn('Feed add failed:', e.message); }
      }

      await saveWidgetLayout(DEFAULT_LAYOUT);
      onComplete();
    } catch (err) {
      console.error('Setup failed:', err);
    }
    setLoading(false);
  };

  const steps = [
    // Welcome
    <div key="welcome" className="text-center">
      <Monitor size={64} style={{ color: 'var(--accent)' }} className="mx-auto mb-6" />
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome to RigBoard</h1>
      <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Your rig. Your news. Your dashboard.</p>
      <button onClick={() => setStep(1)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white"
        style={{ backgroundColor: 'var(--accent)' }}>
        Get Started <ArrowRight size={18} />
      </button>
    </div>,
    // Config
    <div key="config" className="max-w-sm mx-auto">
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Quick Setup</h2>
      <label className="block mb-4">
        <span className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>Dashboard Title</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
      </label>
      <label className="block mb-6">
        <span className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>Theme</span>
        <div className="flex gap-3">
          {['dark', 'light'].map(t => (
            <button key={t} onClick={() => { setTheme(t); document.documentElement.setAttribute('data-theme', t); }}
              className={`flex-1 px-4 py-2 rounded-lg border text-sm capitalize ${theme === t ? 'font-medium' : ''}`}
              style={{
                borderColor: theme === t ? 'var(--accent)' : 'var(--border)',
                backgroundColor: theme === t ? 'var(--accent)11' : 'var(--bg-primary)',
                color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              {t}
            </button>
          ))}
        </div>
      </label>
      <button onClick={finish} disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white"
        style={{ backgroundColor: 'var(--accent)', opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Setting up...' : <><Check size={18} /> Finish Setup</>}
      </button>
    </div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-lg p-8 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {steps[step]}
      </div>
    </div>
  );
}
