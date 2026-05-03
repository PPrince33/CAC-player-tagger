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
import { Keyboard, LogOut, Download, RotateCcw, Loader2 } from 'lucide-react';
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

  const [loading,    setLoading]    = useState(true);
  const [locked,     setLocked]     = useState(true); // false = lock failed (someone else in)
  const [error,      setError]      = useState('');
  const [showKeys,   setShowKeys]   = useState(false);
  const [logging,    setLogging]    = useState(false);
  const [localFile,  setLocalFile]  = useState(null);

  const lockHeartbeat = useRef(null);
  const notesRef      = useRef(null);

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // Acquire lock
      let lockOk = false;
      try { lockOk = await acquireMatchLock(matchId); } catch {}
      if (!lockOk) {
        setLocked(false);
        setError('This match is currently locked by another analyst. Try again shortly.');
        setLoading(false);
        return;
      }

      // Start heartbeat
      lockHeartbeat.current = setInterval(() => refreshMatchLock(matchId), 4 * 60 * 1000);

      // Load flow rules
      await loadFlowRules();

      // Fetch match + lineups + events
      const [{ data: match }, { data: lineups }, { data: events }] = await Promise.all([
        supabase.from('matches').select('*,home_team:home_team_id(team_id,team_name),away_team:away_team_id(team_id,team_name)').eq('match_id', matchId).single(),
        supabase.from('lineups').select('player:player_id(player_id,player_name,jersey_number,position,team_id)').eq('match_id', matchId),
        supabase.from('match_events').select('*').eq('match_id', matchId).order('match_time_seconds', { ascending: false }).limit(200),
      ]);

      const players = (lineups ?? []).map(l => l.player).filter(Boolean);

      // Also fetch any ad-hoc players created during previous sessions
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

  // ── Log event [Enter] ──────────────────────────────────────
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

    // Auto-fill next entry from flow rules
    const next = getNextEntry(s.action, s.outcome, s.type, s.playerId, s.reactionPlayerId);
    store.applyNextEntry(next);
  }, [store]);

  // ── Undo [Ctrl+Z] ─────────────────────────────────────────
  const undoLast = useCallback(async () => {
    const last = store.removeLastEvent();
    if (!last) return;
    await supabase.from('match_events').delete().eq('match_event_id', last.match_event_id);
  }, [store]);

  // ── Global keyboard shortcuts ─────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'SELECT') return;

      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        logEvent();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLast();
      }
      if (e.key === 'n' || e.key === 'N') {
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          notesRef.current?.focus();
        }
      }
      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        setShowKeys(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logEvent, undoLast]);

  // ── Exit ──────────────────────────────────────────────────
  async function handleExit() {
    await releaseMatchLock(matchId).catch(() => {});
    router.push('/matches');
  }

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    );
  }

  const match      = store.matchData;
  const videoUrl   = localFile ? URL.createObjectURL(localFile) : match?.video_url ?? '';
  const videoType  = localFile ? 'Local' : (match?.video_source_type ?? 'YouTube');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950">
      {/* ── Top bar ── */}
      <header className="flex h-12 items-center gap-3 border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-500">{match?.tournament_name}</span>
          <span className="mx-1 text-gray-700">·</span>
          <span className="text-sm font-semibold text-white truncate">{match?.match_name}</span>
        </div>

        <span className="text-xs text-gray-500">{store.events.length} events</span>

        {/* Local file upload (if source is Local) */}
        {match?.video_source_type === 'Local' && (
          <label className="cursor-pointer text-xs text-blue-400 hover:underline">
            Load Video
            <input type="file" accept="video/*" className="hidden"
              onChange={e => setLocalFile(e.target.files?.[0] ?? null)} />
          </label>
        )}

        <button onClick={() => exportToXlsx(store.events, match?.match_name)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
          <Download size={14} /> Export
        </button>
        <button onClick={() => setShowKeys(true)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
          <Keyboard size={14} /> Keys [?]
        </button>
        <button onClick={undoLast}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white" title="Undo [Ctrl+Z]">
          <RotateCcw size={14} /> Undo
        </button>
        <button onClick={() => router.push(`/qc/${matchId}`)}
          className="rounded-md bg-yellow-700 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600">
          → QC
        </button>
        <button onClick={handleExit}
          className="flex items-center gap-1 rounded-md bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600">
          <LogOut size={14} /> Exit
        </button>
      </header>

      {/* ── Lock warning ── */}
      {!locked && (
        <div className="bg-red-900/60 px-4 py-2 text-xs text-red-200">{error}</div>
      )}
      {error && locked && (
        <div className="bg-yellow-900/60 px-4 py-2 text-xs text-yellow-200">{error}</div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Video */}
        <div className="flex w-[55%] flex-col gap-3 border-r border-gray-800 overflow-y-auto p-4">
          <VideoPlayer videoUrl={videoUrl} videoType={videoType} />

          {/* Event log */}
          <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
              <span className="text-xs font-semibold text-gray-300">
                Event Log ({store.events.length})
              </span>
            </div>
            <div className="overflow-auto max-h-64">
              <EventLog />
            </div>
          </div>
        </div>

        {/* Right: Pitch + Form */}
        <div className="flex w-[45%] flex-col gap-3 overflow-y-auto p-4">
          <PitchCanvas />

          {/* Current time display */}
          <div className="text-center">
            <span className="font-mono text-lg font-bold text-green-400">
              {String(Math.floor(store.currentTime / 60)).padStart(2,'0')}:
              {String(store.currentTime % 60).padStart(2,'0')}
            </span>
            <span className="ml-2 text-xs text-gray-500">current time</span>
          </div>

          {/* Event form */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <EventForm />
          </div>

          {/* Log button */}
          <button
            onClick={logEvent}
            disabled={logging}
            className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {logging ? 'Logging…' : '⚡ Log Event [Enter]'}
          </button>
        </div>
      </div>

      {showKeys && <HotkeysModal onClose={() => setShowKeys(false)} />}
    </div>
  );
}
