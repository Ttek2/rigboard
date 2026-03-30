import { useState, useEffect } from 'react';
import { Monitor, ArrowRight, Check, Shield, AlertTriangle } from 'lucide-react';
import { updateSettings, addFeed, saveWidgetLayout, getDefaultFeeds, getSecurityStatus, setupAuth } from '../api';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableAuth, setEnableAuth] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState([]);

  useEffect(() => {
    getSecurityStatus().then(s => {
      setSecurityWarnings(s.warnings || []);
    }).catch(() => {});
  }, []);

  const finish = async () => {
    setLoading(true);
    try {
      // Save auth if user chose to enable it
      if (enableAuth && password && password === confirmPassword) {
        await setupAuth(password, true);
      }

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

  const hasDockerWarnings = securityWarnings.some(w => w.includes('Docker socket') || w.includes('host'));

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
      <button onClick={() => setStep(2)}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white"
        style={{ backgroundColor: 'var(--accent)' }}>
        Next <ArrowRight size={18} />
      </button>
    </div>,
    // Security
    <div key="security" className="max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={24} style={{ color: 'var(--accent)' }} />
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Security</h2>
      </div>

      {hasDockerWarnings && (
        <div className="mb-4 px-3 py-2 rounded-lg border text-xs" style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b11', color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
            <span className="font-medium" style={{ color: '#f59e0b' }}>Elevated privileges detected</span>
          </div>
          Your RigBoard has access to the Docker socket and/or host system. Setting a password is recommended to prevent unauthorized access from your network.
        </div>
      )}

      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enableAuth} onChange={e => setEnableAuth(e.target.checked)}
            className="rounded" />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Enable password protection</span>
        </label>
      </div>

      {enableAuth && (
        <div className="space-y-3 mb-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-xs" style={{ color: '#ef4444' }}>Passwords don't match</p>
          )}
        </div>
      )}

      <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
        You can change this later in Settings &gt; Security. 2FA is also available.
      </p>

      <button onClick={finish} disabled={loading || (enableAuth && (!password || password !== confirmPassword))}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white"
        style={{ backgroundColor: 'var(--accent)', opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Setting up...' : <><Check size={18} /> Finish Setup</>}
      </button>

      {!enableAuth && (
        <button onClick={finish} disabled={loading}
          className="w-full mt-2 text-xs py-2"
          style={{ color: 'var(--text-secondary)' }}>
          Skip — I'll set this up later
        </button>
      )}
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
