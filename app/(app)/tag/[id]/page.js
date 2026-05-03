'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, acquireMatchLock, refreshMatchLock, releaseMatchLock } from '@/lib/supabase';
import { useTaggerStore } from '@/store/taggerStore';
import { loadFlowRules, getNextEntry } from '@/lib/actionFlow';
import { needsEndPoint } from '@/lib/cacLogic';
import VideoPlayer   from '@/components/tagger/VideoPlayer';
import PitchCanvas   from '@/components/tagger/PitchCanvas';
import EventForm     from '@/components/tagger/EventForm';
import EventLog      from '@/components/tagger/EventLog';
import HotkeysModal  from '@/components/tagger/HotkeysModal';
import AuthGuard     from '@/components/AuthGuard';
import { Keyboard, LogOut, Download, RotateCcw } from 'lucide-react';
import { exportToXlsx } from '@/lib/exportEvents';

export default function TaggerPage() {
  return (
    <AuthGuard>
      <TaggerInner />
    </AuthGuard>
  );
}

function TaggerInner() {
  const { id: matchId } = useParams();
  const router          = useRouter();
  const store           = useTaggerStore();

  const [loading,   setLoading]   = useState(true);
  const [locked,    setLocked]    = useState(true);
  const [error,     setError]     = useState('');
  const [showKeys,  setShowKeys]  = useState(false);
  const [logging,   setLogging]   = useState(false);
  const [localFile, setLocalFile] = useState(null);

  const lockHeartbeat = useRef(null);
  const notesRef      = useRef(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      let lockOk = false;
      try { lockOk = await acquireMatchLock(matchId); } catch {}
      if (!lockOk) {
        setLocked(false);
        setError('This match is currently locked by another analyst. Try again shortly.');
        setLoading(false);
        return;
      }

      lockHeartbeat.current = setInterval(() => refreshMatchLock(matchId), 4 * 60 * 1000);
      await loadFlowRules();

      const [{ data: match }, { data: lineups }, { data: events }] = await Promise.all([
        supabase.from('matches').select('*,home_team:home_team_id(team_id,team_name),away_team:away_team_id(team_id,team_name)').eq('match_id', matchId).single(),
        supabase.from('lineups').select('player:player_id(player_id,player_name,jersey_number,position,team_id)').eq('match_id', matchId),
        supabase.from('match_events').select('*').eq('match_id', matchId).order('match_time_seconds', { ascending: false }).limit(200),
      ]);

      const players = (lineups ?? []).map(l => l.player).filter(Boolean);

      if (events?.length) {
        const extraIds = [...new Set(events.flatMap(e => [e.player_id, e.reaction_player_id]).filter(Boolean))];
        const knownIds = new Set(players.map(p => p.player_id));
        const missing  = extraIds.filter(id => !knownIds.has(id));
        if (missing.length) {
          const { data: extras } = await supabase.from('players').select('player_id,player_name,jersey_number,position,team_id').in('player_id', missing);
          players.push(...(extras ?? []));
        }
      }

      store.init(matchId, match, players, events ?? [], user.id);
      setLoading(false);
    }
    bootstrap();

    return () => {
      clearInterval(lockHeartbeat.current);
      releaseMatchLock(matchId).catch(() => {});
    };
  }, [matchId]);

  const logEvent = useCallback(async () => {
    const s = store;
    if (!s.startCoord) { setError('Click the pitch to set a start position.'); return; }
    if (!s.playerId)   { setError('Select a player.'); return; }
    if (!s.outcome)    { setError('Select an outcome.'); return; }
    if (needsEndPoint(s.action) && !s.endCoord) {
      setError('Click the pitch again to set the end position.'); return;
    }
    setError('');
    setLogging(true);

    const payload = {
      match_id:           s.matchId,
      analyst_id:         s.userId,
      match_time_seconds: s.currentTime,
      start_x:            s.startCoord.x,
      start_y:            s.startCoord.y,
      end_x:              s.endCoord?.x ?? null,
      end_y:              s.endCoord?.y ?? null,
      action:             s.action,
      outcome:            s.outcome,
      type:               s.type || null,
      body_part:          s.bodyPart || null,
      player_id:          s.playerId,
      reaction_player_id: s.reactionPlayerId || null,
      team_id:            s.players.find(p => p.player_id === s.playerId)?.team_id ?? null,
      team_direction:     s.teamDirection,
      ground_duel:        s.groundDuel,
      aerial_duel:        s.aerialDuel,
      pressure_on:        s.pressureOn,
      shot_technique:     s.shotTechnique || null,
      first_time_shot:    s.firstTimeShot || null,
      assist_type:        s.assistType || null,
      notes:              s.notes || null,
    };

    const { data, error: err } = await supabase
      .from('match_events').insert(payload).select().single();
    setLogging(false);

    if (err) { setError(err.message); return; }

    store.addEvent(data);
    const next = getNextEntry(s.action, s.outcome, s.type, s.playerId, s.reactionPlayerId);
    store.applyNextEntry(next);
  }, [store]);

  const undoLast = useCallback(async () => {
    const last = store.removeLastEvent();
    if (!last) return;
    await supabase.from('match_events').delete().eq('match_event_id', last.match_event_id);
  }, [store]);

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'SELECT') return;

      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); logEvent();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undoLast();
      }
      if ((e.key === 'n' || e.key === 'N') && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); notesRef.current?.focus();
      }
      if (e.key === '?' || e.key === '/') {
        e.preventDefault(); setShowKeys(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logEvent, undoLast]);

  async function handleExit() {
    await releaseMatchLock(matchId).catch(() => {});
    router.push('/matches');
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin border-4 border-[#34D399] border-t-black" />
      </div>
    );
  }

  const match     = store.matchData;
  const videoUrl  = localFile ? URL.createObjectURL(localFile) : match?.video_url ?? '';
  const videoType = localFile ? 'Local' : (match?.video_source_type ?? 'YouTube');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b-2 border-[#34D399] bg-black px-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-500">{match?.tournament_name}</span>
          <span className="mx-1 text-gray-700">·</span>
          <span className="text-sm font-bold text-white truncate">{match?.match_name}</span>
        </div>

        <span className="border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400">
          {store.events.length} events
        </span>

        {match?.video_source_type === 'Local' && (
          <label className="cursor-pointer border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
            Load Video
            <input type="file" accept="video/*" className="hidden"
              onChange={e => setLocalFile(e.target.files?.[0] ?? null)} />
          </label>
        )}

        <button onClick={() => exportToXlsx(store.events, match?.match_name)}
          className="flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-[#34D399] hover:text-[#34D399] transition-none">
          <Download size={13} /> Export
        </button>
        <button onClick={() => setShowKeys(true)}
          className="flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-[#FACC15] hover:text-[#FACC15] transition-none">
          <Keyboard size={13} /> Keys [?]
        </button>
        <button onClick={undoLast}
          className="flex items-center gap-1 border-2 border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-none" title="Undo [Ctrl+Z]">
          <RotateCcw size={13} /> Undo
        </button>
        <button onClick={() => router.push(`/qc/${matchId}`)}
          className="border-2 border-[#FACC15] bg-[#FACC15] px-3 py-0.5 text-xs font-bold text-black hover:bg-black hover:text-[#FACC15] transition-none">
          → QC
        </button>
        <button onClick={handleExit}
          className="flex items-center gap-1 border-2 border-gray-700 px-3 py-0.5 text-xs font-bold text-gray-400 hover:border-red-500 hover:text-red-400 transition-none">
          <LogOut size={13} /> Exit
        </button>
      </header>

      {/* Lock / error warnings */}
      {!locked && (
        <div className="border-b-2 border-red-500 bg-red-900/80 px-4 py-2 text-xs font-bold text-red-200">{error}</div>
      )}
      {error && locked && (
        <div className="border-b-2 border-[#FACC15] bg-[#FACC15]/10 px-4 py-2 text-xs font-bold text-[#FACC15]">{error}</div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Video + Event log */}
        <div className="flex w-[55%] flex-col gap-3 border-r-2 border-gray-800 overflow-y-auto p-4">
          <VideoPlayer videoUrl={videoUrl} videoType={videoType} />

          <div className="flex-1 border-2 border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-gray-700 bg-black px-3 py-2">
              <span className="text-xs font-bold uppercase text-gray-400">
                Event Log ({store.events.length})
              </span>
            </div>
            <div className="overflow-auto max-h-64 bg-black">
              <EventLog />
            </div>
          </div>
        </div>

        {/* Right: Pitch + Form */}
        <div className="flex w-[45%] flex-col gap-3 overflow-y-auto p-4">
          <PitchCanvas />

          {/* Current time */}
          <div className="border-2 border-gray-700 bg-black py-1 text-center">
            <span className="font-mono text-lg font-bold text-[#34D399]">
              {String(Math.floor(store.currentTime / 60)).padStart(2,'0')}:
              {String(store.currentTime % 60).padStart(2,'0')}
            </span>
            <span className="ml-2 text-xs font-bold text-gray-500">current time</span>
          </div>

          {/* Event form */}
          <div className="border-2 border-gray-700 bg-black p-3">
            <EventForm />
          </div>

          {/* Log button */}
          <button
            onClick={logEvent}
            disabled={logging}
            className="w-full border-2 border-[#34D399] bg-[#34D399] py-3 text-sm font-bold text-black hover:bg-black hover:text-[#34D399] disabled:opacity-50 transition-none shadow-[4px_4px_0px_0px_rgba(52,211,153,0.5)]"
          >
            {logging ? 'Logging…' : '⚡ Log Event [Enter]'}
          </button>
        </div>
      </div>

      {showKeys && <HotkeysModal onClose={() => setShowKeys(false)} />}
    </div>
  );
}
