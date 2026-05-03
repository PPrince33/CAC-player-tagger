'use client';
import { useState } from 'react';
import { useTaggerStore } from '@/store/taggerStore';
import { supabase } from '@/lib/supabase';
import { UserPlus, X } from 'lucide-react';

export default function PlayerSelector({ label, value, onChange, teamId }) {
  const { players, addPlayer, matchData, userId } = useTaggerStore();
  const [creating, setCreating] = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newJersey, setNewJersey] = useState('');
  const [newPos,    setNewPos]    = useState('FW');
  const [saving,    setSaving]    = useState(false);

  const selected = players.find(p => p.player_id === value);

  // Sorted: jersey number first, then name
  const sorted = [...players].sort((a, b) => {
    const ja = a.jersey_number ?? 999, jb = b.jersey_number ?? 999;
    if (ja !== jb) return ja - jb;
    return a.player_name.localeCompare(b.player_name);
  });

  async function createPlayer() {
    if (!newName.trim()) return;
    setSaving(true);
    const tid = teamId ?? null;
    const { data, error } = await supabase
      .from('players')
      .insert({
        player_name:   newName.trim(),
        team_id:       tid,
        jersey_number: newJersey ? parseInt(newJersey) : null,
        position:      newPos,
        created_by:    userId,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { alert(error.message); return; }
    addPlayer(data);
    onChange(data.player_id);

    // Also add to lineup if we have a match and team
    if (matchData?.match_id && tid) {
      await supabase.from('lineups').upsert({
        match_id: matchData.match_id, team_id: tid, player_id: data.player_id,
        jersey_no: data.jersey_number, position: data.position, starting_xi: false,
      }, { onConflict: 'match_id,player_id' });
    }

    setCreating(false);
    setNewName(''); setNewJersey(''); setNewPos('FW');
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400">{label}</label>

      <div className="flex gap-1">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none"
        >
          <option value="">— none —</option>
          {sorted.map(p => (
            <option key={p.player_id} value={p.player_id}>
              {p.jersey_number ? `#${p.jersey_number} ` : ''}{p.player_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(v => !v)}
          className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-green-400"
          title="Add new player"
        >
          <UserPlus size={14} />
        </button>
      </div>

      {creating && (
        <div className="rounded-md border border-gray-700 bg-gray-800 p-2 space-y-1.5">
          <p className="text-xs font-medium text-gray-300">New Player</p>
          <input
            className={inputCls} placeholder="Name *"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createPlayer()}
          />
          <div className="flex gap-1">
            <input
              className={`${inputCls} w-16`} placeholder="#"
              type="number" min="1" max="99"
              value={newJersey} onChange={e => setNewJersey(e.target.value)}
            />
            <select className={`${inputCls} flex-1`}
              value={newPos} onChange={e => setNewPos(e.target.value)}>
              {['GK','DF','MF','FW'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            <button onClick={createPlayer} disabled={saving}
              className="flex-1 rounded bg-green-700 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button onClick={() => setCreating(false)}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none';
