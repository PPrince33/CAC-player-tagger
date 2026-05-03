'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthGuard from '@/components/AuthGuard';
import { UserPlus, Merge, Trash2, Download, RefreshCw, X } from 'lucide-react';
import { exportToXlsx } from '@/lib/exportEvents';

export default function AdminPage() {
  return <AuthGuard requireAdmin><AdminInner /></AuthGuard>;
}

function AdminInner() {
  const [tab, setTab] = useState('analysts');

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-white">Admin Portal</h1>

      <div className="mb-4 flex gap-1 border-b border-gray-800">
        {[
          ['analysts', 'Analysts'],
          ['matches',  'All Matches'],
          ['teams',    'Merge Teams'],
          ['players',  'Merge Players'],
          ['flow',     'Action Flow'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm transition-colors ${
              tab === key
                ? 'border-b-2 border-green-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'analysts'  && <AnalystsTab />}
      {tab === 'matches'   && <MatchesTab />}
      {tab === 'teams'     && <MergeTeamsTab />}
      {tab === 'players'   && <MergePlayersTab />}
      {tab === 'flow'      && <ActionFlowTab />}
    </div>
  );
}

// ── Analysts ─────────────────────────────────────────────────
function AnalystsTab() {
  const [analysts, setAnalysts] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'analyst' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('id,username,email,role,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setAnalysts(data ?? []));
  }, []);

  async function createAnalyst(e) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error); return; }
    setAnalysts(a => [body.profile, ...a]);
    setForm({ username: '', email: '', password: '', role: 'analyst' });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Create form */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Create Analyst</h2>
        {error && <div className="mb-3 rounded bg-red-950 border border-red-700 px-3 py-1.5 text-xs text-red-300">{error}</div>}
        <form onSubmit={createAnalyst} className="space-y-3">
          {[['Username','text','username'],['Email','email','email'],['Password','password','password']].map(([lbl,type,key]) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-gray-400">{lbl}</label>
              <input type={type} required className={inp}
                value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Role</label>
            <select className={inp} value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
              <option value="analyst">Analyst</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
            <UserPlus size={14} />{saving ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>

      {/* Analysts table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-auto max-h-96">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">All Analysts ({analysts.length})</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="pb-2 text-left">Username</th>
              <th className="pb-2 text-left">Email</th>
              <th className="pb-2 text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {analysts.map(a => (
              <tr key={a.id} className="border-b border-gray-800">
                <td className="py-1.5 text-white">{a.username}</td>
                <td className="py-1.5 text-gray-400">{a.email}</td>
                <td className="py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${a.role === 'super_admin' ? 'bg-yellow-800 text-yellow-200' : 'bg-gray-700 text-gray-300'}`}>
                    {a.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── All Matches ───────────────────────────────────────────────
function MatchesTab() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    supabase.from('matches')
      .select('match_id,match_name,tournament_name,match_date,status,created_by,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setMatches(data ?? []); setLoading(false); });
  }, []);

  async function updateStatus(ids, status) {
    await Promise.all([...ids].map(id => supabase.from('matches').update({ status }).eq('match_id', id)));
    setMatches(m => m.map(r => ids.has(r.match_id) ? {...r, status} : r));
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (!window.confirm(`Delete ${selected.size} match(es)?`)) return;
    await Promise.all([...selected].map(id => supabase.from('matches').delete().eq('match_id', id)));
    setMatches(m => m.filter(r => !selected.has(r.match_id)));
    setSelected(new Set());
  }

  function toggle(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSelected(s => s.size === matches.length ? new Set() : new Set(matches.map(m => m.match_id))); }

  if (loading) return <div className="text-gray-400 text-xs">Loading…</div>;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
          <span className="text-xs text-gray-300">{selected.size} selected</span>
          {['Doing','QC','Done'].map(s => (
            <button key={s} onClick={() => updateStatus(selected, s)}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600">
              → {s}
            </button>
          ))}
          <button onClick={deleteSelected}
            className="ml-2 flex items-center gap-1 rounded bg-red-800 px-2 py-1 text-xs text-white hover:bg-red-700">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead className="bg-gray-900">
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-3 py-2"><input type="checkbox" onChange={toggleAll} checked={selected.size === matches.length && matches.length > 0} /></th>
              <th className="px-3 py-2 text-left">Match</th>
              <th className="px-3 py-2 text-left">Tournament</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.match_id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={selected.has(m.match_id)} onChange={() => toggle(m.match_id)} />
                </td>
                <td className="px-3 py-1.5 text-white">{m.match_name}</td>
                <td className="px-3 py-1.5 text-gray-400">{m.tournament_name}</td>
                <td className="px-3 py-1.5 text-gray-400">{m.match_date}</td>
                <td className="px-3 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 ${
                    m.status === 'Done' ? 'bg-green-800 text-green-200' :
                    m.status === 'QC'   ? 'bg-yellow-800 text-yellow-200' : 'bg-blue-800 text-blue-200'
                  }`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Merge Teams ───────────────────────────────────────────────
function MergeTeamsTab() {
  const [teams,   setTeams]   = useState([]);
  const [keepId,  setKeepId]  = useState('');
  const [mergeId, setMergeId] = useState('');
  const [doing,   setDoing]   = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    supabase.from('teams').select('team_id,team_name').order('team_name')
      .then(({ data }) => setTeams(data ?? []));
  }, []);

  async function merge() {
    if (!keepId || !mergeId || keepId === mergeId) { setMsg('Select two different teams.'); return; }
    setDoing(true); setMsg('');
    await supabase.rpc('merge_teams', { p_keep_id: keepId, p_merge_id: mergeId });
    setTeams(t => t.filter(x => x.team_id !== mergeId));
    setMsg('Merged successfully.'); setDoing(false); setMergeId('');
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-gray-400">All references to the "Merge into" team are repointed to "Keep" and the duplicate is deleted.</p>
      {msg && <div className="rounded border border-green-700 bg-green-950 px-3 py-2 text-xs text-green-300">{msg}</div>}
      <MergeRow label="Keep" items={teams.map(t=>({id:t.team_id,name:t.team_name}))} value={keepId} onChange={setKeepId} />
      <MergeRow label="Merge into Keep" items={teams.map(t=>({id:t.team_id,name:t.team_name}))} value={mergeId} onChange={setMergeId} />
      <button onClick={merge} disabled={doing}
        className="flex items-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
        <Merge size={14} />{doing ? 'Merging…' : 'Merge Teams'}
      </button>
    </div>
  );
}

// ── Merge Players ─────────────────────────────────────────────
function MergePlayersTab() {
  const [players, setPlayers] = useState([]);
  const [keepId,  setKeepId]  = useState('');
  const [mergeId, setMergeId] = useState('');
  const [doing,   setDoing]   = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    supabase.from('players').select('player_id,player_name').order('player_name')
      .then(({ data }) => setPlayers(data ?? []));
  }, []);

  async function merge() {
    if (!keepId || !mergeId || keepId === mergeId) { setMsg('Select two different players.'); return; }
    setDoing(true); setMsg('');
    await supabase.rpc('merge_players', { p_keep_id: keepId, p_merge_id: mergeId });
    setPlayers(p => p.filter(x => x.player_id !== mergeId));
    setMsg('Merged successfully.'); setDoing(false); setMergeId('');
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-gray-400">Merge a duplicate player record into the canonical one.</p>
      {msg && <div className="rounded border border-green-700 bg-green-950 px-3 py-2 text-xs text-green-300">{msg}</div>}
      <MergeRow label="Keep" items={players.map(p=>({id:p.player_id,name:p.player_name}))} value={keepId} onChange={setKeepId} />
      <MergeRow label="Merge into Keep" items={players.map(p=>({id:p.player_id,name:p.player_name}))} value={mergeId} onChange={setMergeId} />
      <button onClick={merge} disabled={doing}
        className="flex items-center gap-2 rounded-md bg-orange-700 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
        <Merge size={14} />{doing ? 'Merging…' : 'Merge Players'}
      </button>
    </div>
  );
}

function MergeRow({ label, items, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <select className={inp} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );
}

// ── Action Flow ───────────────────────────────────────────────
function ActionFlowTab() {
  const [rules,  setRules]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [dirty,  setDirty]  = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('action_flow_rules').select('*').order('id')
      .then(({ data }) => { setRules(data ?? []); setLoading(false); });
  }, []);

  function markDirty(id, field, value) {
    setDirty(d => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
    setRules(r => r.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  }

  async function saveAll() {
    setSaving(true);
    await Promise.all(Object.entries(dirty).map(([id, fields]) =>
      supabase.from('action_flow_rules').update(fields).eq('id', parseInt(id))
    ));
    setDirty({}); setSaving(false);
  }

  if (loading) return <div className="text-xs text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">{rules.length} rules · Edit cells, then Save.</p>
        <button onClick={saveAll} disabled={!Object.keys(dirty).length || saving}
          className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="overflow-auto rounded-lg border border-gray-800 max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-700">
            <tr className="text-gray-400">
              {['Current Action','Outcome','Type','Next Action','Next Outcome','Next Type','Act Player','React Player'].map(h => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} className={`border-b border-gray-800 ${dirty[r.id] ? 'bg-yellow-900/10' : 'hover:bg-gray-800/30'}`}>
                <td className="px-2 py-1 text-gray-300 whitespace-nowrap">{r.current_action}</td>
                <td className="px-2 py-1 text-gray-400">{r.current_outcome ?? '–'}</td>
                <td className="px-2 py-1 text-gray-400">{r.current_type ?? '–'}</td>
                {['next_action','next_outcome','next_type','next_action_player','next_reaction_player'].map(f => (
                  <td key={f} className="px-2 py-1">
                    <input className="w-full bg-transparent border-b border-gray-700 text-xs text-gray-200 focus:border-green-500 focus:outline-none"
                      value={r[f] ?? ''} onChange={e => markDirty(r.id, f, e.target.value || null)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────
const inp = 'w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none';
