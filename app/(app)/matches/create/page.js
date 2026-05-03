'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const POSITIONS = ['GK', 'DF', 'MF', 'FW'];
const VIDEO_TYPES = ['YouTube', 'Local'];

export default function CreateMatchPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tournament_name: '',
    match_name: '',
    match_date: new Date().toISOString().slice(0, 10),
    video_source_type: 'YouTube',
    video_url: '',
    is_futsal: false,
    home_team_name: '',
    away_team_name: '',
  });
  const [homeRoster, setHomeRoster] = useState([]);
  const [awayRoster, setAwayRoster] = useState([]);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  // ── Roster CSV/XLSX parsing ──
  async function parseRosterFile(file, side) {
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // Expect columns: jersey_number, player_name, position
    const players = rows.slice(1).map(r => ({
      jersey_number: parseInt(r[0]) || null,
      player_name:   String(r[1] ?? '').trim(),
      position:      POSITIONS.includes(String(r[2] ?? '').trim().toUpperCase())
        ? String(r[2]).trim().toUpperCase() : 'FW',
    })).filter(p => p.player_name);
    if (side === 'home') setHomeRoster(players);
    else setAwayRoster(players);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['jersey_number', 'player_name', 'position'],
      [1, 'Example Player', 'GK'],
      [2, 'Another Player', 'DF'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    XLSX.writeFile(wb, 'roster_template.xlsx');
  }

  // ── Submit ──
  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // Upsert teams
      async function upsertTeam(name) {
        if (!name.trim()) return null;
        const { data: existing } = await supabase
          .from('teams').select('team_id').eq('team_name', name.trim()).maybeSingle();
        if (existing) return existing.team_id;
        const { data: newT, error } = await supabase
          .from('teams').insert({ team_name: name.trim(), created_by: user.id }).select('team_id').single();
        if (error) throw error;
        return newT.team_id;
      }

      const homeTeamId = await upsertTeam(form.home_team_name);
      const awayTeamId = await upsertTeam(form.away_team_name);

      // Create match
      const { data: match, error: mErr } = await supabase
        .from('matches')
        .insert({
          tournament_name:   form.tournament_name,
          match_name:        form.match_name,
          match_date:        form.match_date,
          video_source_type: form.video_source_type,
          video_url:         form.video_url || null,
          is_futsal:         form.is_futsal,
          home_team_id:      homeTeamId,
          away_team_id:      awayTeamId,
          created_by:        user.id,
        })
        .select('match_id').single();
      if (mErr) throw mErr;

      // Upsert players + lineups
      async function insertRoster(roster, teamId) {
        for (const p of roster) {
          if (!p.player_name) continue;
          // Upsert player
          const { data: existing } = await supabase
            .from('players').select('player_id')
            .eq('player_name', p.player_name)
            .eq('team_id', teamId)
            .maybeSingle();
          let playerId = existing?.player_id;
          if (!playerId) {
            const { data: newP, error: pErr } = await supabase
              .from('players')
              .insert({ player_name: p.player_name, team_id: teamId, jersey_number: p.jersey_number, position: p.position, created_by: user.id })
              .select('player_id').single();
            if (pErr) throw pErr;
            playerId = newP.player_id;
          }
          // Lineup
          await supabase.from('lineups').upsert({
            match_id: match.match_id, team_id: teamId, player_id: playerId,
            jersey_no: p.jersey_number, position: p.position, starting_xi: true,
          }, { onConflict: 'match_id,player_id' });
        }
      }

      if (homeTeamId) await insertRoster(homeRoster, homeTeamId);
      if (awayTeamId) await insertRoster(awayRoster, awayTeamId);

      router.push('/matches');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold text-white">Create Match</h1>

      {error && (
        <div className="mb-4 rounded border border-red-600 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Match Metadata ── */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Match Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tournament Name" required>
              <input className={inputCls} required value={form.tournament_name}
                onChange={e => set('tournament_name', e.target.value)} />
            </Field>
            <Field label="Match Name / ID" required>
              <input className={inputCls} required value={form.match_name}
                onChange={e => set('match_name', e.target.value)} />
            </Field>
            <Field label="Match Date" required>
              <input type="date" className={inputCls} required value={form.match_date}
                onChange={e => set('match_date', e.target.value)} />
            </Field>
            <Field label="Format">
              <select className={inputCls} value={form.is_futsal}
                onChange={e => set('is_futsal', e.target.value === 'true')}>
                <option value="false">Football (11v11)</option>
                <option value="true">Futsal</option>
              </select>
            </Field>
          </div>
        </section>

        {/* ── Video Source ── */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Video Source</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source Type">
              <select className={inputCls} value={form.video_source_type}
                onChange={e => set('video_source_type', e.target.value)}>
                {VIDEO_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="YouTube URL">
              <input className={inputCls} placeholder="https://www.youtube.com/watch?v=..."
                value={form.video_url} onChange={e => set('video_url', e.target.value)} />
            </Field>
          </div>
        </section>

        {/* ── Teams & Rosters ── */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Teams & Rosters</h2>
            <button type="button" onClick={downloadTemplate}
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
              <Download size={12} /> Download Template
            </button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <RosterSide label="Home Team" nameVal={form.home_team_name}
              onNameChange={v => set('home_team_name', v)}
              roster={homeRoster} onFile={f => parseRosterFile(f, 'home')} />
            <RosterSide label="Away Team" nameVal={form.away_team_name}
              onNameChange={v => set('away_team_name', v)}
              roster={awayRoster} onFile={f => parseRosterFile(f, 'away')} />
          </div>
        </section>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 rounded-md bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
          <PlusCircle size={16} />
          {saving ? 'Creating…' : 'Create Match'}
        </button>
      </form>
    </div>
  );
}

// ── Sub-components ──

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-400">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function RosterSide({ label, nameVal, onNameChange, roster, onFile }) {
  return (
    <div className="space-y-2">
      <Field label={label}>
        <input className={inputCls} placeholder="Team name"
          value={nameVal} onChange={e => onNameChange(e.target.value)} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-700 px-3 py-2 text-xs text-gray-400 hover:border-gray-500">
        <Upload size={12} /> Upload Roster (CSV/XLSX)
        <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {roster.length > 0 && (
        <p className="text-xs text-green-400">{roster.length} players loaded</p>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none';
