'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Play, CheckSquare, RefreshCw } from 'lucide-react';

const STATUS_COLOR = {
  Doing: 'bg-blue-800 text-blue-200',
  QC:    'bg-yellow-800 text-yellow-200',
  Done:  'bg-green-800 text-green-200',
};

export default function MatchesPage() {
  const router  = useRouter();
  const [matches, setMatches] = useState([]);
  const [userId,  setUserId]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); fetchMatches(user.id); }
    });
  }, []);

  async function fetchMatches(uid) {
    setLoading(true);
    // Get matches I created OR am assigned to
    const { data: assigned } = await supabase
      .from('match_assignments').select('match_id').eq('user_id', uid);
    const assignedIds = (assigned ?? []).map(a => a.match_id);

    let query = supabase
      .from('matches')
      .select(`
        match_id, match_name, tournament_name, match_date, status, video_url,
        home_team:home_team_id(team_name),
        away_team:away_team_id(team_name),
        event_count:match_events(count)
      `)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (!error) setMatches(data ?? []);
    setLoading(false);
  }

  async function updateStatus(matchId, newStatus) {
    await supabase.from('matches').update({ status: newStatus }).eq('match_id', matchId);
    setMatches(prev => prev.map(m => m.match_id === matchId ? { ...m, status: newStatus } : m));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">My Matches</h1>
          <p className="text-sm text-gray-400">{matches.length} matches</p>
        </div>
        <Link
          href="/matches/create"
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
        >
          <PlusCircle size={16} /> Create Match
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 py-20 text-center">
          <p className="text-gray-400">No matches yet.</p>
          <Link href="/matches/create" className="mt-3 inline-block text-sm text-green-400 hover:underline">
            Create your first match →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map(m => (
            <MatchCard key={m.match_id} match={m} onStatusChange={updateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, onStatusChange }) {
  const router = useRouter();
  const eventCount = match.event_count?.[0]?.count ?? 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">{match.tournament_name}</p>
          <h3 className="font-semibold text-white leading-tight">{match.match_name}</h3>
          {(match.home_team || match.away_team) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {match.home_team?.team_name ?? '–'} vs {match.away_team?.team_name ?? '–'}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[match.status] ?? 'bg-gray-700 text-gray-300'}`}>
          {match.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span>{match.match_date}</span>
        <span>·</span>
        <span>{eventCount} events</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => router.push(`/tag/${match.match_id}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-700 py-1.5 text-xs font-medium text-white hover:bg-green-600"
        >
          <Play size={12} /> Tag
        </button>
        <button
          onClick={() => router.push(`/qc/${match.match_id}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-700 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
        >
          <CheckSquare size={12} /> QC
        </button>
        {match.status === 'Doing' && (
          <button
            onClick={() => onStatusChange(match.match_id, 'QC')}
            title="Mark as QC"
            className="rounded-md bg-gray-800 px-2 py-1.5 text-xs text-gray-400 hover:bg-yellow-800 hover:text-yellow-200"
          >
            → QC
          </button>
        )}
        {match.status === 'QC' && (
          <button
            onClick={() => onStatusChange(match.match_id, 'Done')}
            title="Mark as Done"
            className="rounded-md bg-gray-800 px-2 py-1.5 text-xs text-gray-400 hover:bg-green-800 hover:text-green-200"
          >
            → Done
          </button>
        )}
      </div>
    </div>
  );
}
