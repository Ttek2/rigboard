import { useState, useEffect, useRef } from 'react';
import { HardDrive, Plus, Trash2, ChevronDown, ChevronRight, Wrench, Clock, AlertTriangle, DollarSign, Upload, Image, History, X, Edit3 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getRigs, createRig, deleteRig, getRig, addComponent, updateComponent, deleteComponent, logMaintenance, createSchedule, getRigTimeline, bulkImportComponents, uploadComponentImage, getComponentImages, deleteComponentImage } from '../api';

const CATEGORIES = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Case', 'Cooling', 'Fan', 'Networking', 'Peripheral', 'Cable', 'Other'];

function ComponentItem({ component, allComponents, rigId, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [taskName, setTaskName] = useState('');
  const [intervalDays, setIntervalDays] = useState(90);

  const children = allComponents.filter(c => c.parent_component_id === component.id);

  const handleLogMaintenance = async (e) => {
    e.preventDefault();
    await logMaintenance(component.id, { action, notes });
    setAction(''); setNotes(''); setShowMaintenance(false);
    onRefresh();
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    await createSchedule(component.id, { task_name: taskName, interval_days: intervalDays });
    setTaskName(''); setShowSchedule(false);
    onRefresh();
  };

  const startEdit = () => {
    setEditData({
      category: component.category,
      name: component.name,
      model: component.model || '',
      purchase_price: component.purchase_price || '',
      currency: component.currency || 'EUR',
      purchase_date: component.purchase_date || '',
      warranty_expires: component.warranty_expires || '',
      serial_number: component.serial_number || '',
      notes: component.notes || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    await updateComponent(component.id, {
      ...editData,
      purchase_price: editData.purchase_price ? Number(editData.purchase_price) : null,
    });
    setEditing(false);
    onRefresh();
  };

  const warrantyValid = component.warranty_expires && new Date(component.warranty_expires) >= new Date();
  const warrantyExpired = component.warranty_expires && new Date(component.warranty_expires) < new Date();

  return (
    <div className="ml-4 border-l" style={{ borderColor: 'var(--border)' }}>
      <div className="pl-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {children.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5" style={{ color: 'var(--text-secondary)' }}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent)22', color: 'var(--accent)' }}>
            {component.category}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{component.name}</span>
          {component.model && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{component.model}</span>}
          {component.purchase_price && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {component.currency || 'EUR'} {component.purchase_price}
            </span>
          )}
          {component.purchase_date && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Bought {component.purchase_date}
            </span>
          )}
          {warrantyValid && (
            <span className="text-xs text-green-400">Warranty until {component.warranty_expires}</span>
          )}
          {warrantyExpired && (
            <span className="text-xs text-amber-400">Warranty expired {component.warranty_expires}</span>
          )}
          {!component.warranty_expires && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>No warranty set</span>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <form onSubmit={handleSaveEdit} className="mt-2 ml-6 p-3 rounded-lg border space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                <select value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} required
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Model</label>
                <input value={editData.model} onChange={e => setEditData({ ...editData, model: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Price</label>
                <div className="flex gap-1">
                  <select value={editData.currency} onChange={e => setEditData({ ...editData, currency: e.target.value })}
                    className="w-16 px-1 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {['EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input type="number" step="0.01" value={editData.purchase_price} onChange={e => setEditData({ ...editData, purchase_price: e.target.value })}
                    className="flex-1 px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Purchase Date</label>
                <input type="date" value={editData.purchase_date} onChange={e => setEditData({ ...editData, purchase_date: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Warranty Expires</label>
                <input type="date" value={editData.warranty_expires} onChange={e => setEditData({ ...editData, warranty_expires: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Serial Number</label>
                <input value={editData.serial_number} onChange={e => setEditData({ ...editData, serial_number: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full px-2 py-1 rounded border text-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Save</button>
              <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-2 mt-1 ml-6">
          <button onClick={startEdit}
            className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--accent)' }}>
            <Edit3 size={10} /> Edit
          </button>
          <button onClick={() => setShowMaintenance(!showMaintenance)}
            className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}>
            <Wrench size={10} /> Log
          </button>
          <button onClick={() => setShowSchedule(!showSchedule)}
            className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}>
            <Clock size={10} /> Schedule
          </button>
          <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async (e) => { const fd = new FormData(); fd.append('image', e.target.files[0]); await uploadComponentImage(component.id, fd); onRefresh(); }; input.click(); }}
            className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}>
            <Image size={10} /> Photo
          </button>
          <button onClick={async () => { await deleteComponent(component.id); onRefresh(); }}
            className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 text-red-400/50 hover:text-red-400">
            <Trash2 size={10} /> Remove
          </button>
        </div>

        {/* Maintenance schedules */}
        {component.schedules?.length > 0 && (
          <div className="ml-6 mt-1 space-y-0.5">
            {component.schedules.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {s.next_due && new Date(s.next_due) < new Date() ? (
                  <AlertTriangle size={10} className="text-amber-400" />
                ) : (
                  <Clock size={10} />
                )}
                {s.task_name} — {s.next_due ? `due ${formatDistanceToNow(new Date(s.next_due), { addSuffix: true })}` : 'not scheduled'}
              </div>
            ))}
          </div>
        )}

        {/* Recent maintenance logs */}
        {component.recent_logs?.length > 0 && (
          <div className="ml-6 mt-1 space-y-0.5">
            {component.recent_logs.slice(0, 2).map(log => (
              <div key={log.id} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {log.action} — {format(new Date(log.performed_at), 'MMM d, yyyy')}
              </div>
            ))}
          </div>
        )}

        {showMaintenance && (
          <form onSubmit={handleLogMaintenance} className="ml-6 mt-2 p-2 rounded border space-y-2" style={{ borderColor: 'var(--border)' }}>
            <input value={action} onChange={e => setAction(e.target.value)} placeholder="Action performed" required
              className="w-full px-2 py-1 rounded border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full px-2 py-1 rounded border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <button type="submit" className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Log Maintenance</button>
          </form>
        )}

        {showSchedule && (
          <form onSubmit={handleCreateSchedule} className="ml-6 mt-2 p-2 rounded border space-y-2" style={{ borderColor: 'var(--border)' }}>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Task name (e.g. Clean dust filter)" required
              className="w-full px-2 py-1 rounded border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Every</span>
              <input type="number" value={intervalDays} onChange={e => setIntervalDays(Number(e.target.value))} min="1"
                className="w-20 px-2 py-1 rounded border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>days</span>
            </div>
            <button type="submit" className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Create Schedule</button>
          </form>
        )}

        {expanded && children.map(child => (
          <ComponentItem key={child.id} component={child} allComponents={allComponents} rigId={rigId} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

export default function HardwarePage() {
  const [rigs, setRigs] = useState([]);
  const [selectedRig, setSelectedRig] = useState(null);
  const [rigDetail, setRigDetail] = useState(null);
  const [showAddRig, setShowAddRig] = useState(false);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [importText, setImportText] = useState('');
  const [rigName, setRigName] = useState('');
  const [rigDesc, setRigDesc] = useState('');
  const [comp, setComp] = useState({ category: 'CPU', name: '', model: '', purchase_price: '', currency: 'EUR', purchase_date: '', warranty_expires: '', parent_component_id: '' });

  const loadRigs = () => getRigs().then(r => { setRigs(r); }).catch(console.error);
  const loadRigDetail = (id) => getRig(id).then(r => { setRigDetail(r); setSelectedRig(id); }).catch(console.error);

  useEffect(() => { loadRigs(); }, []);
  useEffect(() => { if (selectedRig) loadRigDetail(selectedRig); }, [selectedRig]);

  const handleAddRig = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', rigName);
    fd.append('description', rigDesc);
    await createRig(fd);
    setRigName(''); setRigDesc(''); setShowAddRig(false);
    loadRigs();
  };

  const handleAddComponent = async (e) => {
    e.preventDefault();
    await addComponent(selectedRig, {
      ...comp,
      purchase_price: comp.purchase_price ? Number(comp.purchase_price) : null,
      parent_component_id: comp.parent_component_id || null,
    });
    setComp({ category: 'CPU', name: '', model: '', purchase_price: '', currency: 'EUR', purchase_date: '', warranty_expires: '', parent_component_id: '' });
    setShowAddComponent(false);
    loadRigDetail(selectedRig);
  };

  const topLevelComponents = rigDetail?.components?.filter(c => !c.parent_component_id) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Rig list */}
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Rigs</h2>
          <button onClick={() => setShowAddRig(!showAddRig)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white"
            style={{ backgroundColor: 'var(--accent)' }}>
            <Plus size={14} /> New Rig
          </button>
        </div>

        {showAddRig && (
          <form onSubmit={handleAddRig} className="mb-4 p-4 rounded-xl border space-y-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <input value={rigName} onChange={e => setRigName(e.target.value)} placeholder="Rig name" required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={rigDesc} onChange={e => setRigDesc(e.target.value)} placeholder="Description"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <button type="submit" className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
              Create Rig
            </button>
          </form>
        )}

        <div className="space-y-2">
          {rigs.map(rig => (
            <button key={rig.id} onClick={() => setSelectedRig(rig.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedRig === rig.id ? 'border-cyan-500/50' : ''}`}
              style={{ borderColor: selectedRig === rig.id ? undefined : 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rig.name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{rig.component_count} components</div>
              {rig.overdue_count > 0 && (
                <div className="text-xs mt-0.5 text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={10} /> {rig.overdue_count} overdue maintenance
                </div>
              )}
            </button>
          ))}
          {rigs.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No rigs yet. Create one to start tracking your hardware.</p>
          )}
        </div>
      </div>

      {/* Rig detail */}
      <div className="lg:col-span-3">
        {rigDetail ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{rigDetail.name}</h2>
                {rigDetail.description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{rigDetail.description}</p>}
                {rigDetail.total_cost > 0 && (
                  <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <DollarSign size={12} /> Total cost: {rigDetail.components[0]?.currency || 'EUR'} {rigDetail.total_cost.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddComponent(!showAddComponent)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white"
                  style={{ backgroundColor: 'var(--accent)' }}>
                  <Plus size={14} /> Add Component
                </button>
                <button onClick={() => setShowImport(!showImport)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <Upload size={14} /> Import
                </button>
                <button onClick={async () => {
                  const t = await getRigTimeline(selectedRig);
                  setTimeline(t);
                  setShowTimeline(!showTimeline);
                }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <History size={14} /> Timeline
                </button>
                <button onClick={async () => { await deleteRig(selectedRig); setSelectedRig(null); setRigDetail(null); loadRigs(); }}
                  className="px-3 py-1.5 rounded-lg text-sm border text-red-400 border-red-400/30 hover:bg-red-400/10">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Bulk Import */}
            {showImport && (
              <div className="mb-4 p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Paste JSON array or upload a CSV. JSON format: [{"{"}&quot;category&quot;: &quot;GPU&quot;, &quot;name&quot;: &quot;RTX 4080&quot;, &quot;model&quot;: &quot;...&quot;, &quot;purchase_price&quot;: 999{"}"}]
                </p>
                <textarea value={importText} onChange={e => setImportText(e.target.value)}
                  rows={4} placeholder='[{"category": "GPU", "name": "RTX 4080", "model": "NVIDIA", "purchase_price": 999}]'
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      const components = JSON.parse(importText);
                      const result = await bulkImportComponents(selectedRig, components);
                      setImportText(''); setShowImport(false);
                      loadRigDetail(selectedRig); loadRigs();
                      alert(`Imported ${result.imported} components`);
                    } catch (e) { alert('Invalid JSON: ' + e.message); }
                  }}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--accent)' }}>
                    Import JSON
                  </button>
                  <button onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = '.csv,.json';
                    input.onchange = async (e) => {
                      const text = await e.target.files[0].text();
                      if (e.target.files[0].name.endsWith('.csv')) {
                        const lines = text.trim().split('\n');
                        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                        const components = lines.slice(1).map(line => {
                          const vals = line.split(',').map(v => v.trim());
                          const obj = {};
                          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
                          if (obj.purchase_price) obj.purchase_price = Number(obj.purchase_price);
                          return obj;
                        });
                        const result = await bulkImportComponents(selectedRig, components);
                        loadRigDetail(selectedRig); loadRigs();
                        alert(`Imported ${result.imported} components from CSV`);
                      } else {
                        setImportText(text);
                      }
                    };
                    input.click();
                  }}
                    className="px-3 py-1.5 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    Upload File
                  </button>
                </div>
              </div>
            )}

            {/* Timeline View */}
            {showTimeline && (
              <div className="mb-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Timeline</h3>
                  <button onClick={() => setShowTimeline(false)} className="p-1" style={{ color: 'var(--text-secondary)' }}><X size={14} /></button>
                </div>
                {timeline.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No events yet.</p>
                ) : (
                  <div className="space-y-2 border-l-2 ml-2 pl-4" style={{ borderColor: 'var(--border)' }}>
                    {timeline.map((event, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2"
                          style={{
                            borderColor: event.event_type === 'maintenance' ? 'var(--accent)' : '#22c55e',
                            backgroundColor: 'var(--bg-card)'
                          }} />
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {event.event_type === 'maintenance' ? event.action : `Added ${event.category}: ${event.component_name}`}
                          {event.model && ` (${event.model})`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {event.component_name && event.event_type === 'maintenance' && `${event.component_name} · `}
                          {format(new Date(event.timestamp), 'MMM d, yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showAddComponent && (
              <form onSubmit={handleAddComponent} className="mb-4 p-4 rounded-xl border space-y-3"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Add a component to this rig. Only Category and Name are required.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Category *</label>
                    <select value={comp.category} onChange={e => setComp({ ...comp, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                    <input value={comp.name} onChange={e => setComp({ ...comp, name: e.target.value })} placeholder="e.g. NVIDIA GeForce RTX 4090" required
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Model</label>
                    <input value={comp.model} onChange={e => setComp({ ...comp, model: e.target.value })} placeholder="e.g. Founders Edition"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Price</label>
                    <div className="flex gap-1">
                      <select value={comp.currency} onChange={e => setComp({ ...comp, currency: e.target.value })}
                        className="w-16 px-1 py-2 rounded-lg border text-sm"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                        {['EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="number" step="0.01" value={comp.purchase_price} onChange={e => setComp({ ...comp, purchase_price: e.target.value })} placeholder="0.00"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Purchase Date</label>
                    <input type="date" value={comp.purchase_date} onChange={e => setComp({ ...comp, purchase_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Warranty Expires</label>
                    <input type="date" value={comp.warranty_expires} onChange={e => setComp({ ...comp, warranty_expires: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-secondary)' }}>Parent Component (for nesting, e.g. Fan → Case)</label>
                    <select value={comp.parent_component_id} onChange={e => setComp({ ...comp, parent_component_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <option value="">No parent (top-level)</option>
                      {rigDetail.components.map(c => <option key={c.id} value={c.id}>{c.category}: {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
                  Add Component
                </button>
              </form>
            )}

            {/* Component tree */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              {topLevelComponents.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No components yet. Add one above.</p>
              ) : (
                topLevelComponents.map(c => (
                  <ComponentItem key={c.id} component={c} allComponents={rigDetail.components} rigId={selectedRig}
                    onRefresh={() => loadRigDetail(selectedRig)} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <HardDrive size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Select a rig to view its components</p>
          </div>
        )}
      </div>
    </div>
  );
}
