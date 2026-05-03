import * as XLSX from 'xlsx';

export function exportToXlsx(events, matchName = 'match') {
  const rows = events.map(e => ({
    Time:           formatTime(e.match_time_seconds),
    Player:         e.player?.player_name ?? e.player_id,
    'React Player': e.reaction_player?.player_name ?? '',
    Team:           e.team?.team_name ?? '',
    Direction:      e.team_direction,
    Action:         e.action,
    Outcome:        e.outcome,
    Type:           e.type ?? '',
    'Body Part':    e.body_part ?? '',
    Pressure:       e.pressure_on ? 'Y' : 'N',
    'Ground Duel':  e.ground_duel,
    'Aerial Duel':  e.aerial_duel,
    'Start X':      e.start_x,
    'Start Y':      e.start_y,
    'End X':        e.end_x ?? '',
    'End Y':        e.end_y ?? '',
    'End Z':        e.end_z ?? '',
    'Shot Tech':    e.shot_technique ?? '',
    'First Time':   e.first_time_shot === 1 ? 'Y' : '',
    'Assist Type':  e.assist_type ?? '',
    Notes:          e.notes ?? '',
    Analyst:        e.analyst?.username ?? e.analyst_id,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Events');
  XLSX.writeFile(wb, `${matchName}_events.xlsx`);
}

export function exportToCsv(events, matchName = 'match') {
  const rows = events.map(e =>
    [
      formatTime(e.match_time_seconds),
      e.player?.player_name ?? e.player_id,
      e.reaction_player?.player_name ?? '',
      e.team?.team_name ?? '',
      e.team_direction,
      e.action, e.outcome, e.type ?? '', e.body_part ?? '',
      e.pressure_on ? 'Y' : 'N',
      e.ground_duel, e.aerial_duel,
      e.start_x, e.start_y, e.end_x ?? '', e.end_y ?? '', e.end_z ?? '',
      e.notes ?? '',
    ].join(',')
  );

  const header = 'Time,Player,React Player,Team,Direction,Action,Outcome,Type,Body Part,Pressure,Ground Duel,Aerial Duel,Start X,Start Y,End X,End Y,End Z,Notes';
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${matchName}_events.csv`; a.click();
  URL.revokeObjectURL(url);
}

function formatTime(secs) {
  if (secs == null) return '';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
