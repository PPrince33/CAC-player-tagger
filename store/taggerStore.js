import { create } from 'zustand';

export const useTaggerStore = create((set, get) => ({
  // ── Match context ──────────────────────────────────────────
  matchId:   null,
  matchData: null,
  players:   [],   // all players for this match (lineups + ad-hoc)
  events:    [],   // events already saved to DB
  userId:    null,

  // ── Video ──────────────────────────────────────────────────
  currentTime: 0,  // seconds
  playerRef:   null,  // ref to the video/YT player instance

  // ── Pitch ─────────────────────────────────────────────────
  startCoord:   null,  // { x, y }  (0-100 %)
  endCoord:     null,
  drawingPhase: 'start',  // 'start' | 'end' | 'done'

  // ── Event form ────────────────────────────────────────────
  playerId:         null,
  reactionPlayerId: null,
  teamId:           null,
  action:           'Pass',
  outcome:          'Successful',
  type:             '',
  bodyPart:         'Right Foot',
  pressureOn:       false,
  teamDirection:    'L2R',
  groundDuel:       'NA',
  aerialDuel:       'NA',
  notes:            '',

  // ── Shot extras ───────────────────────────────────────────
  shotTechnique:  '',
  firstTimeShot:  0,
  assistType:     '',

  // ── Actions ───────────────────────────────────────────────
  init(matchId, matchData, players, events, userId) {
    set({ matchId, matchData, players, events, userId });
  },

  setCurrentTime(t)    { set({ currentTime: t }); },
  setPlayerRef(ref)    { set({ playerRef: ref }); },

  setStartCoord(c)     { set({ startCoord: c, drawingPhase: 'end' }); },
  setEndCoord(c)       { set({ endCoord: c, drawingPhase: 'done' }); },
  clearCoords()        { set({ startCoord: null, endCoord: null, drawingPhase: 'start' }); },

  setField(k, v)       { set({ [k]: v }); },

  setAction(action) {
    set({ action, outcome: '', type: '', startCoord: null, endCoord: null, drawingPhase: 'start' });
  },
  setOutcome(outcome)  { set({ outcome, type: '' }); },
  setType(type)        { set({ type }); },

  addPlayer(p)         { set(s => ({ players: [...s.players, p] })); },

  addEvent(event)      { set(s => ({ events: [event, ...s.events] })); },

  removeLastEvent() {
    const events = get().events;
    if (!events.length) return null;
    const last = events[0];
    set({ events: events.slice(1) });
    return last;
  },

  replaceEvent(updatedEvent) {
    set(s => ({
      events: s.events.map(e =>
        e.match_event_id === updatedEvent.match_event_id ? updatedEvent : e
      ),
    }));
  },

  removeEvent(id) {
    set(s => ({ events: s.events.filter(e => e.match_event_id !== id) }));
  },

  // Auto-fill form from action-flow next entry
  applyNextEntry(next) {
    set({
      action:           next.action   ?? 'Pass',
      outcome:          next.outcome  ?? 'Successful',
      type:             next.type     ?? '',
      playerId:         next.actionPlayer   ?? null,
      reactionPlayerId: next.reactionPlayer ?? null,
      startCoord:  null,
      endCoord:    null,
      drawingPhase: 'start',
    });
  },
}));
