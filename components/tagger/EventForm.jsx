'use client';
import { useTaggerStore } from '@/store/taggerStore';
import { getOutcomes, getTypes, ACTION_RULES, CAC_LOGIC } from '@/lib/cacLogic';
import PlayerSelector from './PlayerSelector';

const ACTIONS     = Object.keys(CAC_LOGIC);
const BODY_PARTS  = ['Right Foot', 'Left Foot', 'Head', 'Other'];
const DIRECTIONS  = [{ v: 'L2R', label: '→ L→R' }, { v: 'R2L', label: '← R→L' }];
const DUEL_OPTS   = ['NA', 'Won', 'Lost'];

export default function EventForm() {
  const s = useTaggerStore();

  const outcomes = getOutcomes(s.action);
  const types    = getTypes(s.action, s.outcome);

  const matchTeamIds = [s.matchData?.home_team_id, s.matchData?.away_team_id].filter(Boolean);

  // Derive active team from selected player
  const actingPlayer  = s.players.find(p => p.player_id === s.playerId);
  const activeTeamId  = actingPlayer?.team_id ?? matchTeamIds[0] ?? null;

  return (
    <div className="space-y-2.5 text-xs">
      {/* ── Action + Outcome + Type ── */}
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="label-xs">Action</label>
          <select className={sel} value={s.action} onChange={e => s.setAction(e.target.value)}>
            {ACTIONS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">Outcome</label>
          <select className={sel} value={s.outcome} onChange={e => s.setOutcome(e.target.value)}>
            <option value="">—</option>
            {outcomes.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">Type</label>
          <select className={sel} value={s.type} onChange={e => s.setType(e.target.value)}
            disabled={!types.length}>
            <option value="">—</option>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Players ── */}
      <div className="grid grid-cols-2 gap-1.5">
        <PlayerSelector
          label="Player (ACT)" value={s.playerId}
          onChange={v => s.setField('playerId', v)}
          teamId={activeTeamId}
        />
        {ACTION_RULES[s.action]?.reaction !== 'None' && (
          <PlayerSelector
            label="React Player (RCT)" value={s.reactionPlayerId}
            onChange={v => s.setField('reactionPlayerId', v)}
            teamId={null}
          />
        )}
      </div>

      {/* ── Body Part + Direction ── */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="label-xs">Body Part</label>
          <select className={sel} value={s.bodyPart} onChange={e => s.setField('bodyPart', e.target.value)}>
            {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs">Direction</label>
          <select className={sel} value={s.teamDirection}
            onChange={e => s.setField('teamDirection', e.target.value)}>
            {DIRECTIONS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Pressure + Duels ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={s.pressureOn}
            onChange={e => s.setField('pressureOn', e.target.checked)}
            className="accent-red-500" />
          <span className={`text-xs font-medium ${s.pressureOn ? 'text-red-400' : 'text-gray-400'}`}>
            Pressure ON
          </span>
        </label>

        <DuelPicker label="Ground" field="groundDuel" />
        <DuelPicker label="Aerial" field="aerialDuel" />
      </div>

      {/* ── Shot extras ── */}
      {s.action === 'Shoot' && (
        <div className="rounded-md border border-gray-700 bg-gray-800/50 p-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-300">Shot Extras</p>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="label-xs">Technique</label>
              <select className={sel} value={s.shotTechnique}
                onChange={e => s.setField('shotTechnique', e.target.value)}>
                <option value="">—</option>
                {['Normal', 'Volley', 'Header', 'Chip', 'Flick'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Assist Type</label>
              <select className={sel} value={s.assistType}
                onChange={e => s.setField('assistType', e.target.value)}>
                <option value="">—</option>
                {['Cross', 'Through Ball', 'Key Pass', 'Pull-back'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
              <input type="checkbox" checked={s.firstTimeShot === 1}
                onChange={e => s.setField('firstTimeShot', e.target.checked ? 1 : 0)}
                className="accent-green-500" />
              <span className="text-xs text-gray-300">1st Time</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      <div>
        <label className="label-xs">Notes [N]</label>
        <input className={sel} placeholder="Additional details…"
          value={s.notes} onChange={e => s.setField('notes', e.target.value)} />
      </div>
    </div>
  );
}

function DuelPicker({ label, field }) {
  const { [field]: value, setField } = useTaggerStore(s => ({
    [field]: s[field], setField: s.setField,
  }));
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-400">{label}:</span>
      {['NA','Won','Lost'].map(opt => (
        <button key={opt} type="button"
          onClick={() => setField(field, opt)}
          className={`px-1.5 py-0.5 rounded text-xs border ${
            value === opt
              ? 'bg-green-700 border-green-500 text-white'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

const sel = 'w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none';
