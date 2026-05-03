'use client';
import { useTaggerStore } from '@/store/taggerStore';
import { getOutcomes, getTypes, ACTION_RULES, CAC_LOGIC } from '@/lib/cacLogic';
import PlayerSelector from './PlayerSelector';

const ACTIONS     = Object.keys(CAC_LOGIC);
const BODY_PARTS  = ['Right Foot', 'Left Foot', 'Head', 'Other'];
const DIRECTIONS  = [{ v: 'L2R', label: '→ L→R' }, { v: 'R2L', label: '← R→L' }];

export default function EventForm() {
  const s = useTaggerStore();

  const outcomes = getOutcomes(s.action);
  const types    = getTypes(s.action, s.outcome);

  const matchTeamIds = [s.matchData?.home_team_id, s.matchData?.away_team_id].filter(Boolean);
  const actingPlayer  = s.players.find(p => p.player_id === s.playerId);
  const activeTeamId  = actingPlayer?.team_id ?? matchTeamIds[0] ?? null;

  return (
    <div className="space-y-2.5 text-xs">
      {/* Action + Outcome + Type */}
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="nb-label">Action</label>
          <select className={sel} value={s.action} onChange={e => s.setAction(e.target.value)}>
            {ACTIONS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="nb-label">Outcome</label>
          <select className={sel} value={s.outcome} onChange={e => s.setOutcome(e.target.value)}>
            <option value="">—</option>
            {outcomes.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="nb-label">Type</label>
          <select className={sel} value={s.type} onChange={e => s.setType(e.target.value)}
            disabled={!types.length}>
            <option value="">—</option>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Players */}
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

      {/* Body Part + Direction */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="nb-label">Body Part</label>
          <select className={sel} value={s.bodyPart} onChange={e => s.setField('bodyPart', e.target.value)}>
            {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="nb-label">Direction</label>
          <select className={sel} value={s.teamDirection}
            onChange={e => s.setField('teamDirection', e.target.value)}>
            {DIRECTIONS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {/* Pressure + Duels */}
      <div className="flex items-center gap-3 flex-wrap border-2 border-black bg-white p-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={s.pressureOn}
            onChange={e => s.setField('pressureOn', e.target.checked)}
            className="accent-red-500" />
          <span className={`text-xs font-bold ${s.pressureOn ? 'text-red-600' : 'text-gray-600'}`}>
            Pressure ON
          </span>
        </label>

        <DuelPicker label="Ground" field="groundDuel" />
        <DuelPicker label="Aerial" field="aerialDuel" />
      </div>

      {/* Shot extras */}
      {s.action === 'Shoot' && (
        <div className="border-2 border-black bg-[#FACC15]/10 p-2 space-y-1.5">
          <p className="text-xs font-bold uppercase text-black">Shot Extras</p>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="nb-label">Technique</label>
              <select className={sel} value={s.shotTechnique}
                onChange={e => s.setField('shotTechnique', e.target.value)}>
                <option value="">—</option>
                {['Normal', 'Volley', 'Header', 'Chip', 'Flick'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="nb-label">Assist Type</label>
              <select className={sel} value={s.assistType}
                onChange={e => s.setField('assistType', e.target.value)}>
                <option value="">—</option>
                {['Cross', 'Through Ball', 'Key Pass', 'Pull-back'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
              <input type="checkbox" checked={s.firstTimeShot === 1}
                onChange={e => s.setField('firstTimeShot', e.target.checked ? 1 : 0)}
                className="accent-black" />
              <span className="text-xs font-bold text-black">1st Time</span>
            </label>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="nb-label">Notes [N]</label>
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
      <span className="font-bold text-black">{label}:</span>
      {['NA','Won','Lost'].map(opt => (
        <button key={opt} type="button"
          onClick={() => setField(field, opt)}
          className={`px-1.5 py-0.5 text-xs border-2 font-bold transition-none ${
            value === opt
              ? 'bg-black border-black text-[#34D399]'
              : 'bg-white border-black text-black hover:bg-[#FACC15]'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

const sel = 'w-full border-2 border-black bg-white px-2 py-1 text-xs font-bold focus:outline-none focus:shadow-brutal-sm transition-none';
