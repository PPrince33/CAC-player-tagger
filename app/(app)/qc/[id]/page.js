'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CAC_LOGIC, getOutcomes, getTypes } from '@/lib/cacLogic';
import PitchCanvas from '@/components/tagger/PitchCanvas';
import AuthGuard   from '@/components/AuthGuard';
import { Download, Save, RefreshCw, ChevronLeft, X } from 'lucide-react';
import { exportToXlsx, exportToCsv } from '@/lib/exportEvents';

export default function QCPage() {
  return <AuthGuard><QCInner /></AuthGuard>;
}

const ACTIONS = Object.keys(CAC_LOGIC);
const QUICK_FILTERS = ['Shoot','Goal','Assist','Key Pass','Corner Kick','Save','Free Kick','Foul','Penalty'];

function QCInner() {
  const { id: matchId } = useParams();
  const router = useRouter();

  const [match,    setMatch]    = useState(null);
  const [players,  setPlayers]  = useState([]);
  const [events,   setEvents]   = useState([]);
  const [dirty,    setDirty]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [selected, setSelected] = useState(null);

  const [filterAction,   setFilterAction]   = useState('');
  const [filterOutcome,  setFilterOutcome]  = useState('');
  const [filterPlayer,   setFilterPlayer]   = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterTimeFrom, setFilterTimeFrom] = useState('');
  const [filterTimeTo,   setFilterTimeTo]   = useState('');
  const [sortField, setSortField] = useState('match_time_seconds');
  const [sortAsc,   setSortAsc]   = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: matchData }, { data: eventsData }] = await Promise.all([
        supabase.from('matches')
          .select('*,home_team:home_team_id(team_name),away_team:away_team_id(team_name)')
          .eq('match_id', matchId).single(),
        supabase.from('match_events')
          .select('*,player:player_id(player_id,player_name,jersey_number),reaction_player:reaction_player_id(player_id,player_name)')
          .eq('match_id', matchId)
          .order('match_time_seconds', { ascending: true }),
      ]);
      setMatch(matchData);
      setEvents(eventsData ?? []);

      const all    = (eventsData ?? []).flatMap(e => [e.player, e.reaction_player]).filter(Boolean);
      const unique = [...new Map(all.map(p => [p.player_id, p])).values()];
      setPlayers(unique);
      setLoading(false);
    }
    load();
  }, [matchId]);

  const filtered = useMemo(() => {
    let list = [...events];

    if (filterAction)  list = list.filter(e => e.action === filterAction);
    if (filterOutcome) list = list.filter(e => e.outcome === filterOutcome);
    if (filterPlayer)  list = list.filter(e => e.player_id === filterPlayer || e.reaction_player_id === filterPlayer);
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      list = list.filter(e =>
        e.player?.player_name?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q) ||
        e.outcome?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
      );
    }
    if (filterTimeFrom) {
      const [mm, ss] = filterTimeFrom.split(':').map(Number);
      list = list.filter(e => e.match_time_seconds >= (mm||0)*60 + (ss||0));
    }
    if (filterTimeTo) {
      const [mm, ss] = filterTimeTo.split(':').map(Number);
      list = list.filter(e => e.match_time_seconds <= (mm||0)*60 + (ss||0));
    }

    list.sort((a, b) => {
      const va = a[sortField] ?? '';
      const vb = b[sortField] ?? '';
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });

    return list;
  }, [events, filterAction, filterOutcome, filterPlayer, filterSearch, filterTimeFrom, filterTimeTo, sortField, sortAsc]);

  function markDirty(id, field, value) {
    setDirty(d => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
    setEvents(evs => evs.map(e => e.match_event_id === id ? { ...e, [field]: value } : e));
  }

  async function saveEdits() {
    if (!Object.keys(dirty).length) return;
    setSaving(true);
    await Promise.all(Object.entries(dirty).map(([id, fields]) =>
      supabase.from('match_events').update(fields).eq('match_event_id', id)
    ));
    setDirty({}); setSaving(false);
  }

  async function deleteEvent(id) {
    await supabase.from('match_events').delete().eq('match_event_id', id);
    setEvents(evs => evs.filter(e => e.match_event_id !== id));
    setDirty(d => { const n = {...d}; delete n[id]; return n; });
    if (selected?.match_event_id === id) setSelected(null);
  }

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from('match_events')
      .select('*,player:player_id(player_id,player_name,jersey_number),reaction_player:reaction_player_id(player_id,player_name)')
      .eq('match_id', matchId).order('match_time_seconds', { ascending: true });
    setEvents(data ?? []);
    setDirty({});
    setLoading(false);
  }

  function toggleSort(field) {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(true); }
  }

  function applyQuick(label) {
    if (['Shoot','Save'].includes(label)) { setFilterAction(label); setFilterOutcome(''); }
    else setFilterOutcome(label);
  }

  function resetFilters() {
    setFilterAction(''); setFilterOutcome(''); setFilterPlayer('');
    setFilterSearch(''); setFilterTimeFrom(''); setFilterTimeTo('');
  }

  const hasFilters = filterAction || filterOutcome || filterPlayer || filterSearch || filterTimeFrom || filterTimeTo;
  const isDirtyAny = Object.keys(dirty).length > 0;

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F9FAFB]">
      <div className="h-8 w-8 animate-spin border-4 border-black border-t-[#34D399]" />
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F9FAFB]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b-2 border-black bg-black px-4">
        <button onClick={() => router.push('/matches')}
          className="border-2 border-gray-700 p-1 text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-500">{match?.tournament_name} · </span>
          <span className="text-sm font-bold text-white">{match?.match_name}</span>
          <span className="ml-2 border-2 border-gray-700 px-1.5 text-xs font-bold text-gray-400">
            QC — {events.length} events
          </span>
        </div>

        <button onClick={() => router.push(`/tag/${matchId}`)}
          className="border-2 border-gray-700 px-3 py-0.5 text-xs font-bold text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          ← Back to Tag
        </button>
        <button onClick={() => exportToXlsx(events, match?.match_name)}
          className="flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          <Download size={13} /> XLSX
        </button>
        <button onClick={() => exportToCsv(events, match?.match_name)}
          className="flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          <Download size={13} /> CSV
        </button>
        <button onClick={reload}
          className="border-2 border-gray-700 p-1 text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          <RefreshCw size={13} />
        </button>
        <button
          onClick={saveEdits}
          disabled={!isDirtyAny || saving}
          className={`flex items-center gap-1 border-2 px-3 py-0.5 text-xs font-bold transition-none ${
            isDirtyAny
              ? 'border-[#34D399] bg-[#34D399] text-black hover:bg-black hover:text-[#34D399]'
              : 'border-gray-700 bg-black text-gray-600 cursor-not-allowed'
          }`}
        >
          <Save size={13} />
          {saving ? 'Saving…' : `Save Edits${isDirtyAny ? ` (${Object.keys(dirty).length})` : ''}`}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main table area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Quick filters */}
          <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-black bg-[#FACC15] px-4 py-2">
            <span className="text-xs font-bold">Quick:</span>
            {QUICK_FILTERS.map(q => (
              <button key={q} onClick={() => applyQuick(q)}
                className="border-2 border-black bg-white px-2 py-0.5 text-xs font-bold hover:bg-black hover:text-white transition-none">
                {q}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-black bg-white px-4 py-2">
            <select className={fsel} value={filterPlayer} onChange={e => setFilterPlayer(e.target.value)}>
              <option value="">All Players</option>
              {players.map(p => <option key={p.player_id} value={p.player_id}>{p.player_name}</option>)}
            </select>
            <select className={fsel} value={filterAction} onChange={e => { setFilterAction(e.target.value); setFilterOutcome(''); }}>
              <option value="">All Actions</option>
              {ACTIONS.map(a => <option key={a}>{a}</option>)}
            </select>
            <select className={fsel} value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
              <option value="">All Outcomes</option>
              {getOutcomes(filterAction).map(o => <option key={o}>{o}</option>)}
            </select>
            <input className={`${fsel} w-32`} placeholder="Search…" value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)} />
            <input className={`${fsel} w-20`} placeholder="mm:ss from" value={filterTimeFrom}
              onChange={e => setFilterTimeFrom(e.target.value)} />
            <span className="text-xs font-bold">–</span>
            <input className={`${fsel} w-20`} placeholder="mm:ss to" value={filterTimeTo}
              onChange={e => setFilterTimeTo(e.target.value)} />
            {hasFilters && (
              <button onClick={resetFilters}
                className="flex items-center gap-0.5 border-2 border-black px-2 py-0.5 text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-none">
                <X size={11} /> Reset
              </button>
            )}
            <span className="ml-auto text-xs font-bold text-gray-600">{filtered.length} / {events.length}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left" style={{ fontSize: '0.72rem', fontFamily: "'Courier New', monospace" }}>
              <thead className="sticky top-0 z-10 bg-[#FACC15]">
                <tr className="border-b-2 border-black">
                  {[
                    ['match_time_seconds','Time'],
                    ['player_id','Player'],
                    ['action','Action'],
                    ['outcome','Outcome'],
                    ['type','Type'],
                    ['body_part','Body'],
                    ['team_direction','Dir'],
                    ['pressure_on','Press'],
                    ['ground_duel','Gnd'],
                    ['aerial_duel','Air'],
                    ['start_x','SX'],['start_y','SY'],
                    ['end_x','EX'],['end_y','EY'],
                    ['notes','Notes'],
                  ].map(([f, label]) => (
                    <th key={f}
                      className="cursor-pointer select-none px-2 py-2 font-bold uppercase whitespace-nowrap border-r border-black hover:bg-[#FACC15]/80"
                      onClick={() => toggleSort(f)}>
                      {label} {sortField === f ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-bold uppercase">Del</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => (
                  <QCRow key={ev.match_event_id}
                    event={ev}
                    players={players}
                    isDirty={!!dirty[ev.match_event_id]}
                    isSelected={selected?.match_event_id === ev.match_event_id}
                    onSelect={() => setSelected(ev)}
                    onChange={(field, val) => markDirty(ev.match_event_id, field, val)}
                    onDelete={() => deleteEvent(ev.match_event_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel: pitch preview */}
        {selected && (
          <div className="w-72 shrink-0 border-l-2 border-black bg-white overflow-y-auto p-3 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <span className="text-xs font-bold uppercase">Event Detail</span>
              <button onClick={() => setSelected(null)}
                className="border-2 border-black p-0.5 hover:bg-black hover:text-white transition-none">
                <X size={12} />
              </button>
            </div>
            <PitchCanvas
              readOnly
              highlightCoords={{
                start: selected.start_x != null ? { x: selected.start_x, y: selected.start_y } : null,
                end:   selected.end_x   != null ? { x: selected.end_x,   y: selected.end_y   } : null,
              }}
            />
            <div className="space-y-1 text-xs">
              <Row label="Time"    value={fmtTime(selected.match_time_seconds)} />
              <Row label="Player"  value={selected.player?.player_name} />
              <Row label="Action"  value={selected.action} />
              <Row label="Outcome" value={selected.outcome} />
              <Row label="Type"    value={selected.type} />
              <Row label="Body"    value={selected.body_part} />
              <Row label="Dir"     value={selected.team_direction} />
              <Row label="React"   value={selected.reaction_player?.player_name} />
              <Row label="Press"   value={selected.pressure_on ? 'Yes' : 'No'} />
              <Row label="Gnd"     value={selected.ground_duel} />
              <Row label="Air"     value={selected.aerial_duel} />
              {selected.notes && <Row label="Notes" value={selected.notes} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QCRow({ event: ev, players, isDirty, isSelected, onSelect, onChange, onDelete }) {
  const outcomes = getOutcomes(ev.action);
  const types    = getTypes(ev.action, ev.outcome);

  return (
    <tr
      onClick={onSelect}
      className={`border-b border-black cursor-pointer transition-none ${
        isSelected ? 'bg-[#34D399]/20' : isDirty ? 'bg-[#FACC15]/20' : 'hover:bg-[#F9FAFB]'
      }`}
    >
      <td className="px-2 py-1 font-mono font-bold whitespace-nowrap">
        <InlineNum value={ev.match_time_seconds} onChange={v => onChange('match_time_seconds', parseInt(v))} />
      </td>
      <td className="px-2 py-1">
        <select className={ecls} value={ev.player_id ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('player_id', e.target.value || null)}>
          <option value="">—</option>
          {players.map(p => <option key={p.player_id} value={p.player_id}>{p.player_name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={ecls} value={ev.action ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('action', e.target.value)}>
          {Object.keys(CAC_LOGIC).map(a => <option key={a}>{a}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={ecls} value={ev.outcome ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('outcome', e.target.value)}>
          <option value="">—</option>
          {outcomes.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={ecls} value={ev.type ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('type', e.target.value || null)}>
          <option value="">—</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={ecls} value={ev.body_part ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('body_part', e.target.value || null)}>
          <option value="">—</option>
          {['Right Foot','Left Foot','Head','Other'].map(b => <option key={b}>{b}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={`${ecls} w-16`} value={ev.team_direction ?? 'L2R'}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('team_direction', e.target.value)}>
          <option value="L2R">L→R</option>
          <option value="R2L">R→L</option>
        </select>
      </td>
      <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={!!ev.pressure_on}
          onChange={e => onChange('pressure_on', e.target.checked)}
          className="accent-red-500" />
      </td>
      <td className="px-2 py-1">
        <select className={`${ecls} w-14`} value={ev.ground_duel ?? 'NA'}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('ground_duel', e.target.value)}>
          {['NA','Won','Lost'].map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select className={`${ecls} w-14`} value={ev.aerial_duel ?? 'NA'}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange('aerial_duel', e.target.value)}>
          {['NA','Won','Lost'].map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">{ev.start_x?.toFixed(1)}</td>
      <td className="px-2 py-1">{ev.start_y?.toFixed(1)}</td>
      <td className="px-2 py-1">{ev.end_x?.toFixed(1) ?? '–'}</td>
      <td className="px-2 py-1">{ev.end_y?.toFixed(1) ?? '–'}</td>
      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
        <input className={`${ecls} w-28`} value={ev.notes ?? ''}
          onChange={e => onChange('notes', e.target.value || null)} />
      </td>
      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
        <button onClick={onDelete}
          className="text-gray-400 hover:text-red-600 transition-none">
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

function InlineNum({ value, onChange }) {
  return (
    <input
      type="number"
      className="w-14 bg-transparent border-b-2 border-black text-xs font-bold font-mono focus:outline-none focus:border-[#34D399]"
      value={value ?? ''}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 font-bold text-gray-500">{label}</span>
      <span className="font-bold text-black">{value}</span>
    </div>
  );
}

function fmtTime(s) {
  if (s == null) return '--:--';
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

const fsel = 'border-2 border-black bg-white px-1.5 py-0.5 text-xs font-bold focus:outline-none transition-none';
const ecls = 'w-full bg-transparent border-b border-transparent text-xs font-bold focus:border-black focus:outline-none hover:border-gray-400 cursor-pointer transition-none';
