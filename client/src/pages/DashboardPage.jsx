import { Responsive, useContainerWidth } from 'react-grid-layout';
import { Plus, PlusCircle, X, Settings, LayoutGrid } from 'lucide-react';
import { useState, useEffect } from 'react';
import useWidgetLayout, { masonryPack } from '../hooks/useWidgetLayout';
import { getTabs, createTab, deleteTab, updateTab, saveWidgetLayout } from '../api';

// reflowWidgets is now imported as masonryPack from useWidgetLayout
import FeedWidget from '../components/widgets/FeedWidget';
import RigOverview from '../components/widgets/RigOverview';
import BookmarkWidget from '../components/widgets/BookmarkWidget';
import NotesWidget from '../components/widgets/NotesWidget';
import MaintenanceWidget from '../components/widgets/MaintenanceWidget';
import ServiceHealth from '../components/widgets/ServiceHealth';
import WeatherWidget from '../components/widgets/WeatherWidget';
import CalendarWidget from '../components/widgets/CalendarWidget';
import DockerWidget from '../components/widgets/DockerWidget';
import SystemWidget from '../components/widgets/SystemWidget';
import EmbedWidget from '../components/widgets/EmbedWidget';
import HomeAssistantWidget from '../components/widgets/HomeAssistantWidget';
import WebSearchWidget from '../components/widgets/WebSearchWidget';
import AIWidget from '../components/widgets/AIWidget';
import CommunityWidget from '../components/widgets/CommunityWidget';
import JellyseerrWidget from '../components/widgets/JellyseerrWidget';
import MediaWidget from '../components/widgets/MediaWidget';
import StarrWidget from '../components/widgets/StarrWidget';
import PiholeWidget from '../components/widgets/PiholeWidget';
import DownloadsWidget from '../components/widgets/DownloadsWidget';
import NetworkWidget from '../components/widgets/NetworkWidget';
import ReleasesWidget from '../components/widgets/ReleasesWidget';
import PulseWidget from '../components/widgets/PulseWidget';
import WidgetConfigModal from '../components/WidgetConfigModal';
import { WIDGET_HELP_MAP } from './HelpPage';
import { WidgetHelpContext } from '../components/WidgetWrapper';

const WIDGET_TYPES = {
  pulse: { label: 'Community Pulse', component: PulseWidget },
  feeds: { label: 'News Feed', component: FeedWidget },
  rigs: { label: 'Rig Overview', component: RigOverview },
  bookmarks: { label: 'Bookmarks', component: BookmarkWidget },
  notes: { label: 'Notes', component: NotesWidget },
  maintenance: { label: 'Maintenance', component: MaintenanceWidget },
  services: { label: 'Service Health', component: ServiceHealth },
  weather: { label: 'Weather', component: WeatherWidget },
  calendar: { label: 'Calendar', component: CalendarWidget },
  docker: { label: 'Docker', component: DockerWidget },
  system: { label: 'System Stats', component: SystemWidget },
  embed: { label: 'Embed', component: EmbedWidget },
  homeassistant: { label: 'Home Assistant', component: HomeAssistantWidget },
  jellyseerr: { label: 'Jellyseerr', component: JellyseerrWidget },
  media: { label: 'Media (Plex/Jellyfin)', component: MediaWidget },
  starr: { label: 'Sonarr/Radarr', component: StarrWidget },
  pihole: { label: 'Pi-hole', component: PiholeWidget },
  downloads: { label: 'Downloads', component: DownloadsWidget },
  network: { label: 'Network Info', component: NetworkWidget },
  releases: { label: 'GitHub Releases', component: ReleasesWidget },
  websearch: { label: 'Web Search', component: WebSearchWidget },
  ai: { label: 'AI Assistant', component: AIWidget },
  community: { label: 'Community', component: CommunityWidget },
};

export default function DashboardPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addingTab, setAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [configWidget, setConfigWidget] = useState(null);
  const { width, containerRef } = useContainerWidth();

  const [tabsLoaded, setTabsLoaded] = useState(false);

  const loadTabs = () => getTabs().then(t => {
    setTabs(t);
    if (!activeTab && t.length > 0) setActiveTab(t[0].id);
    setTabsLoaded(true);
  }).catch(() => setTabsLoaded(true));

  useEffect(() => { loadTabs(); }, []);

  const currentTab = tabs.find(t => t.id === activeTab);
  const cols = currentTab?.cols || 4;
  const { widgets, layout, loading, onLayoutChange, onInteractionEnd, addWidget, removeWidget, autoArrange, setCols } = useWidgetLayout(activeTab, layoutVersion);

  // Keep the hook's col count in sync — but only after tabs have loaded
  useEffect(() => { if (tabsLoaded) setCols(cols); }, [cols, setCols, tabsLoaded]);


  return (
    <div ref={containerRef}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${activeTab === tab.id ? 'font-medium' : ''}`}
            style={{
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              backgroundColor: activeTab === tab.id ? 'var(--accent)11' : 'transparent',
            }}>
            {tab.name}
            {tabs.length > 1 && activeTab === tab.id && (
              <span onClick={async (e) => { e.stopPropagation(); await deleteTab(tab.id); const t = tabs.filter(t => t.id !== tab.id); setTabs(t); setActiveTab(t[0]?.id); loadTabs(); }}
                className="ml-1 opacity-40 hover:opacity-100 cursor-pointer"><X size={12} /></span>
            )}
          </button>
        ))}
        {addingTab ? (
          <form onSubmit={async (e) => { e.preventDefault(); if (newTabName) { await createTab({ name: newTabName }); setNewTabName(''); setAddingTab(false); loadTabs(); } }}
            className="flex items-center gap-1">
            <input value={newTabName} onChange={e => setNewTabName(e.target.value)} placeholder="Tab name"
              className="px-2 py-1 rounded border text-xs w-24" autoFocus
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </form>
        ) : (
          <button onClick={() => setAddingTab(true)}
            className="p-1.5 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}>
            <PlusCircle size={16} />
          </button>
        )}

        <div className="flex-1" />

        {/* Layout controls */}
        {currentTab && (
          <div className="flex items-center gap-1 mr-2">
            <button onClick={async () => { await autoArrange(); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
              title="Auto-arrange widgets">
              <LayoutGrid size={12} /> Tidy
            </button>
            <span className="mx-1 text-xs" style={{ color: 'var(--border)' }}>|</span>
            {[3, 4, 5].map(c => (
              <button key={c} onClick={async () => {
                await updateTab(activeTab, { cols: c });
                const repacked = masonryPack(widgets, c);
                await saveWidgetLayout(repacked.map(w => ({ ...w, tab_id: activeTab })));
                loadTabs();
                setLayoutVersion(v => v + 1);
              }}
                className={`px-2 py-1 rounded text-xs ${cols === c ? 'font-medium' : ''}`}
                style={{ color: cols === c ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: cols === c ? 'var(--accent)11' : 'transparent' }}>
                {c}col
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <Plus size={14} /> Add Widget
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border flex flex-wrap gap-2"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {Object.entries(WIDGET_TYPES).map(([type, { label }]) => (
            <button key={type} onClick={() => { addWidget(type); setShowAdd(false); }}
              className="px-3 py-1.5 rounded-lg border text-sm hover:border-cyan-500 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      ) : widgets.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>This tab is empty</p>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}>
            Add your first widget
          </button>
        </div>
      ) : width > 0 ? (
        <Responsive
          className="layout"
          width={width}
          layouts={{ lg: layout, md: layout, sm: layout }}
          breakpoints={{ lg: 1200, md: 768, sm: 0 }}
          cols={{ lg: cols, md: 2, sm: 1 }}
          rowHeight={40}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={() => {}}
          onDragStop={(newLayout) => onInteractionEnd(newLayout)}
          onResizeStop={(newLayout) => onInteractionEnd(newLayout)}
          isResizable={true}
          compactType="vertical"
        >
          {widgets.filter(w => w.is_visible).map((widget, index) => {
            const WidgetComponent = WIDGET_TYPES[widget.widget_type]?.component;
            if (!WidgetComponent) return <div key={String(widget.id || index)} />;
            return (
              <div key={String(widget.id || index)}>
                <WidgetHelpContext.Provider value={WIDGET_HELP_MAP[widget.widget_type]}>
                  <WidgetComponent
                    config={widget.widget_config || {}}
                    onRemove={() => removeWidget(index)}
                    onConfigure={() => setConfigWidget({ ...widget, _index: index })}
                  />
                </WidgetHelpContext.Provider>
              </div>
            );
          })}
        </Responsive>
      ) : null}

      {configWidget && (
        <WidgetConfigModal
          widget={configWidget}
          onClose={() => setConfigWidget(null)}
          onSave={async (newConfig) => {
            const updated = widgets.map((w, i) =>
              i === configWidget._index ? { ...w, widget_config: newConfig } : w
            );
            await saveWidgetLayout(updated.map(w => ({ ...w, tab_id: activeTab || w.tab_id })));
            setConfigWidget(null);
            setLayoutVersion(v => v + 1);
          }}
        />
      )}
    </div>
  );
}
