import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect, createContext } from 'react';
import { Monitor, Rss, HardDrive, Settings, Menu, X, Search } from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import FeedsPage from './pages/FeedsPage';
import HardwarePage from './pages/HardwarePage';
import SettingsPage from './pages/SettingsPage';
import SetupWizard from './components/SetupWizard';
import SearchModal from './components/SearchModal';
import NotificationBell from './components/NotificationBell';
import LoginScreen from './components/LoginScreen';
import { getSettings, getAuthStatus, logout } from './api';
import { applyTheme as applyThemePreset } from './themes';
import { applyStyle } from './styles';

export const SettingsContext = createContext({});

function App() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const applyAppTheme = (s) => {
    // Apply color theme + overrides
    let overrides = {};
    try { overrides = JSON.parse(s.color_overrides || '{}'); } catch {}
    applyThemePreset(s.theme || 'dark', overrides);

    // Apply visual style layers
    try { applyStyle(JSON.parse(s.visual_styles || '[]')); } catch { applyStyle([]); }

    // Apply font size
    if (s.font_size) document.documentElement.style.setProperty('--font-size', s.font_size + 'px');

    // Apply wallpaper
    if (s.wallpaper_url) {
      document.documentElement.style.setProperty('--bg-wallpaper', `url(${s.wallpaper_url})`);
    } else {
      document.documentElement.style.setProperty('--bg-wallpaper', 'none');
    }

    // Apply custom CSS
    let styleEl = document.getElementById('rigboard-custom-css');
    if (s.custom_css) {
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'rigboard-custom-css'; document.head.appendChild(styleEl); }
      styleEl.textContent = s.custom_css;
    } else if (styleEl) { styleEl.remove(); }
  };

  useEffect(() => {
    // Check auth first, then load settings
    getAuthStatus().then(auth => {
      setAuthenticated(auth.authenticated);
      setAuthChecked(true);
      if (auth.authenticated) {
        getSettings().then(s => {
          setSettings(s);
          applyAppTheme(s);
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => { setAuthChecked(true); setLoading(false); });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd/Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      // Escape to close search
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const refreshSettings = () => {
    getSettings().then(s => {
      setSettings(s);
      applyAppTheme(s);
    });
  };

  if (loading) return null;

  if (authChecked && !authenticated) {
    return <LoginScreen onLogin={() => { setAuthenticated(true); refreshSettings(); }} />;
  }

  if (settings.setup_complete !== 'true') {
    return (
      <SettingsContext.Provider value={{ settings, refreshSettings }}>
        <SetupWizard onComplete={refreshSettings} />
      </SettingsContext.Provider>
    );
  }

  const navLinks = [
    { to: '/', icon: Monitor, label: 'Dashboard' },
    { to: '/feeds', icon: Rss, label: 'Feeds' },
    { to: '/hardware', icon: HardDrive, label: 'Hardware' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      <BrowserRouter>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
              <NavLink to="/" className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                <Monitor size={22} />
                {settings.dashboard_title || 'RigBoard'}
              </NavLink>
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'font-medium' : 'opacity-70 hover:opacity-100'}`
                    }
                    style={({ isActive }) => ({
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      backgroundColor: isActive ? 'var(--accent)11' : 'transparent',
                      textDecoration: 'none',
                    })}
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
                <button onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ml-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <Search size={14} />
                  <span className="hidden lg:inline">Search</span>
                  <kbd className="text-xs px-1 rounded border" style={{ borderColor: 'var(--border)' }}>⌘K</kbd>
                </button>
                <NotificationBell />
              </div>
              <button className="md:hidden p-2" onClick={() => setMobileNav(!mobileNav)} style={{ color: 'var(--text-primary)' }}>
                {mobileNav ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
            {mobileNav && (
              <div className="md:hidden border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
                {navLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileNav(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={({ isActive }) => ({
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      textDecoration: 'none',
                    })}
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
                <button onClick={() => { setSearchOpen(true); setMobileNav(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full"
                  style={{ color: 'var(--text-secondary)' }}>
                  <Search size={16} /> Search
                </button>
              </div>
            )}
          </nav>
          <main className="max-w-7xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/feeds" element={<FeedsPage />} />
              <Route path="/hardware" element={<HardwarePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        </div>
      </BrowserRouter>
    </SettingsContext.Provider>
  );
}

export default App;
