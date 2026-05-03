'use client';
import { useTaggerStore } from '@/store/taggerStore';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';

function fmtTime(s) {
  if (s == null) return '--:--';
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

export default function EventLog({ onUndo }) {
  const { events, players, removeEvent } = useTaggerStore();

  function getPlayerName(id) {
    return players.find(p => p.player_id === id)?.player_name ?? id?.slice(0,6) ?? '–';
  }

  async function handleDelete(eventId) {
    await supabase.from('match_events').delete().eq('match_event_id', eventId);
    removeEvent(eventId);
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-xs font-bold text-gray-500 border-2 border-dashed border-black">
        <p>No events yet.</p>
        <p className="mt-1">Log an event to see it here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="tagger-table w-full border-collapse text-left">
        <thead>
          <tr>
            <th>Time</th>
            <th>Dir</th>
            <th>Player</th>
            <th>Action</th>
            <th>Outcome</th>
            <th>Type</th>
            <th>RCT</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {events.map(ev => (
            <tr key={ev.match_event_id}>
              <td className="font-mono font-bold">{fmtTime(ev.match_time_seconds)}</td>
              <td>{ev.team_direction}</td>
              <td className="font-bold">{getPlayerName(ev.player_id)}</td>
              <td className="text-blue-700 font-bold">{ev.action}</td>
              <td className={outcomeColor(ev.outcome)}>{ev.outcome}</td>
              <td>{ev.type ?? '–'}</td>
              <td>{ev.reaction_player_id ? getPlayerName(ev.reaction_player_id) : '–'}</td>
              <td>
                <button
                  onClick={() => handleDelete(ev.match_event_id)}
                  className="text-gray-400 hover:text-red-600 transition-none"
                  title="Delete event"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function outcomeColor(outcome) {
  if (!outcome) return '';
  const o = outcome.toLowerCase();
  if (o.includes('successful') || o === 'goal' || o === 'assist') return 'text-green-700 font-bold';
  if (o.includes('unsuccessful') || o === 'missed' || o === 'off-target') return 'text-red-600 font-bold';
  if (o === 'save' || o === 'block' || o === 'woodwork') return 'text-orange-600 font-bold';
  return '';
}
