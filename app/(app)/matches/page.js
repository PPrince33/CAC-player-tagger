'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Play, CheckSquare } from 'lucide-react';

const STATUS_BADGE = {
  Doing: 'nb-badge-blue',
  QC:    'nb-badge-yellow',
  Done:  'nb-badge-green',
};

export default function MatchesPage() {
  const router  = useRouter();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchMatches(user.id);
    });
  }, []);

  async function fetchMatches(uid) {
    setLoading(true);
    const { data: assigned } = await supabase
      .from('match_assignments').select('match_id').eq('user_id', uid);
    const assignedIds = (assigned ?? []).map(a => a.match_id);

    const { data, error } = await supabase
      .from('matches')
      .select(`
        match_id, match_name, tournament_name, match_date, status, video_url,
        home_team:home_team_id(team_name),
        away_team:away_team_id(team_name),
        event_count:match_events(count)
      `)
      .order('created_at', { ascending: false });

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
          <h1 className="text-xl font-bold text-black">My Matches</h1>
          <p className="text-xs text-gray-500">{matches.length} matches</p>
        </div>
        <Link href="/matches/create" className="nb-btn-green flex items-center gap-2">
          <PlusCircle size={14} /> Create Match
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin border-4 border-black border-t-[#34D399]" />
        </div>
      ) : matches.length === 0 ? (
        <div className="border-2 border-dashed border-black py-20 text-center">
          <p className="text-sm font-bold text-gray-500">No matches yet.</p>
          <Link href="/matches/create" className="mt-3 inline-block text-xs font-bold text-black underline hover:text-[#34D399]">
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
    <div className="nb-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">{match.tournament_name}</p>
          <h3 className="font-bold text-black leading-tight">{match.match_name}</h3>
          {(match.home_team || match.away_team) && (
            <p className="text-xs text-gray-600 mt-0.5">
              {match.home_team?.team_name ?? '–'} vs {match.away_team?.team_name ?? '–'}
            </p>
          )}
        </div>
        <span className={`shrink-0 ${STATUS_BADGE[match.status] ?? 'nb-badge'}`}>
          {match.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 border-t-2 border-black pt-2">
        <span>{match.match_date}</span>
        <span>·</span>
        <span>{eventCount} events</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => router.push(`/tag/${match.match_id}`)}
          className="nb-btn-green flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs"
        >
          <Play size={11} /> Tag
        </button>
        <button
          onClick={() => router.push(`/qc/${match.match_id}`)}
          className="nb-btn flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs"
        >
          <CheckSquare size={11} /> QC
        </button>
        {match.status === 'Doing' && (
          <button
            onClick={() => onStatusChange(match.match_id, 'QC')}
            title="Mark as QC"
            className="border-2 border-black px-2 py-1.5 text-xs font-bold hover:bg-[#FACC15] hover:border-[#FACC15] transition-none"
          >
            → QC
          </button>
        )}
        {match.status === 'QC' && (
          <button
            onClick={() => onStatusChange(match.match_id, 'Done')}
            title="Mark as Done"
            className="border-2 border-black px-2 py-1.5 text-xs font-bold hover:bg-[#34D399] hover:border-[#34D399] transition-none"
          >
            → Done
          </button>
        )}
      </div>
    </div>
  );
}
