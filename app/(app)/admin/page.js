'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthGuard from '@/components/AuthGuard';
import { UserPlus, Merge, Trash2, Download } from 'lucide-react';
import { exportToXlsx } from '@/lib/exportEvents';

export default function AdminPage() {
  return <AuthGuard requireAdmin><AdminInner /></AuthGuard>;
}

function AdminInner() {
  const [tab, setTab] = useState('analysts');

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-black">Admin Portal</h1>

      <div className="mb-4 flex gap-0 border-b-2 border-black">
        {[
          ['analysts', 'Analysts'],
          ['matches',  'All Matches'],
          ['teams',    'Merge Teams'],
          ['players',  'Merge Players'],
          ['flow',     'Action Flow'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-bold uppercase border-2 border-b-0 transition-none ${
              tab === key
                ? 'bg-[#FACC15] border-black text-black'
                : 'bg-white border-transparent text-gray-500 hover:bg-[#F9FAFB] hover:border-black'
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
      <div className="nb-card p-4">
        <h2 className="nb-section-title">Create Analyst</h2>
        {error && <div className="mb-3 border-2 border-red-500 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">{error}</div>}
        <form onSubmit={createAnalyst} className="space-y-3">
          {[['Username','text','username'],['Email','email','email'],['Password','password','password']].map(([lbl,type,key]) => (
            <div key={key}>
              <label className="nb-label">{lbl}</label>
              <input type={type} required className={inp}
                value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div>
            <label className="nb-label">Role</label>
            <select className={inp} value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
              <option value="analyst">Analyst</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <button type="submit" disabled={saving}
            className="nb-btn-green flex items-center gap-2 disabled:opacity-50">
            <UserPlus size={14} />{saving ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>

      <div className="nb-card p-4 overflow-auto max-h-96">
        <h2 className="nb-section-title">All Analysts ({analysts.length})</h2>
        <table className="tagger-table w-full border-collapse text-left">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {analysts.map(a => (
              <tr key={a.id}>
                <td className="font-bold">{a.username}</td>
                <td>{a.email}</td>
                <td>
                  <span className={a.role === 'super_admin' ? 'nb-badge-yellow' : 'nb-badge'}>
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

  if (loading) return <div className="text-xs font-bold text-gray-500">Loading…</div>;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 border-2 border-black bg-[#FACC15] px-3 py-2 shadow-brutal-sm">
          <span className="text-xs font-bold">{selected.size} selected</span>
          {['Doing','QC','Done'].map(s => (
            <button key={s} onClick={() => updateStatus(selected, s)}
              className="border-2 border-black bg-white px-2 py-1 text-xs font-bold hover:bg-black hover:text-white transition-none">
              → {s}
            </button>
          ))}
          <button onClick={deleteSelected}
            className="ml-2 flex items-center gap-1 border-2 border-black bg-red-500 px-2 py-1 text-xs font-bold text-white hover:bg-black transition-none">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
      <div className="overflow-auto border-2 border-black">
        <table className="tagger-table w-full border-collapse text-left">
          <thead>
            <tr>
              <th><input type="checkbox" onChange={toggleAll} checked={selected.size === matches.length && matches.length > 0} /></th>
              <th>Match</th>
              <th>Tournament</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.match_id} className={selected.has(m.match_id) ? 'bg-[#FACC15]/20' : ''}>
                <td>
                  <input type="checkbox" checked={selected.has(m.match_id)} onChange={() => toggle(m.match_id)} />
                </td>
                <td className="font-bold">{m.match_name}</td>
                <td>{m.tournament_name}</td>
                <td>{m.match_date}</td>
                <td>
                  <span className={
                    m.status === 'Done' ? 'nb-badge-green' :
                    m.status === 'QC'   ? 'nb-badge-yellow' : 'nb-badge-blue'
                  }>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
      <p className="text-xs font-bold text-gray-600">All references to the "Merge into" team are repointed to "Keep" and the duplicate is deleted.</p>
      {msg && <div className="border-2 border-[#34D399] bg-[#34D399]/10 px-3 py-2 text-xs font-bold text-black">{msg}</div>}
      <MergeRow label="Keep" items={teams.map(t=>({id:t.team_id,name:t.team_name}))} value={keepId} onChange={setKeepId} />
      <MergeRow label="Merge into Keep" items={teams.map(t=>({id:t.team_id,name:t.team_name}))} value={mergeId} onChange={setMergeId} />
      <button onClick={merge} disabled={doing}
        className="nb-btn-yellow flex items-center gap-2 disabled:opacity-50">
        <Merge size={14} />{doing ? 'Merging…' : 'Merge Teams'}
      </button>
    </div>
  );
}

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
      <p className="text-xs font-bold text-gray-600">Merge a duplicate player record into the canonical one.</p>
      {msg && <div className="border-2 border-[#34D399] bg-[#34D399]/10 px-3 py-2 text-xs font-bold text-black">{msg}</div>}
      <MergeRow label="Keep" items={players.map(p=>({id:p.player_id,name:p.player_name}))} value={keepId} onChange={setKeepId} />
      <MergeRow label="Merge into Keep" items={players.map(p=>({id:p.player_id,name:p.player_name}))} value={mergeId} onChange={setMergeId} />
      <button onClick={merge} disabled={doing}
        className="nb-btn-yellow flex items-center gap-2 disabled:opacity-50">
        <Merge size={14} />{doing ? 'Merging…' : 'Merge Players'}
      </button>
    </div>
  );
}

function MergeRow({ label, items, value, onChange }) {
  return (
    <div>
      <label className="nb-label">{label}</label>
      <select className={inp} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );
}

function ActionFlowTab() {
  const [rules,   setRules]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty,   setDirty]   = useState({});
  const [saving,  setSaving]  = useState(false);

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

  if (loading) return <div className="text-xs font-bold text-gray-500">Loading…</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-600">{rules.length} rules · Edit cells, then Save.</p>
        <button onClick={saveAll} disabled={!Object.keys(dirty).length || saving}
          className="nb-btn-green disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="overflow-auto border-2 border-black max-h-[60vh]">
        <table className="tagger-table w-full border-collapse text-left">
          <thead className="sticky top-0">
            <tr>
              {['Current Action','Outcome','Type','Next Action','Next Outcome','Next Type','Act Player','React Player'].map(h => (
                <th key={h} className="whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} className={dirty[r.id] ? 'bg-[#FACC15]/30' : ''}>
                <td className="font-bold whitespace-nowrap">{r.current_action}</td>
                <td>{r.current_outcome ?? '–'}</td>
                <td>{r.current_type ?? '–'}</td>
                {['next_action','next_outcome','next_type','next_action_player','next_reaction_player'].map(f => (
                  <td key={f}>
                    <input className="w-full bg-transparent border-b-2 border-black text-xs font-bold focus:outline-none focus:border-[#34D399]"
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

const inp = 'w-full border-2 border-black bg-white px-2 py-1.5 text-xs font-bold focus:outline-none focus:shadow-brutal-sm transition-none';
