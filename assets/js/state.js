// Default show state. The control panel's "Reset show" writes this to the database.
import { DEFAULT_POOLS, buildVeto } from './games.js';
import { buildBracket } from './bracket.js';

const SAMPLE_TEAMS = [
  ['t1', 'Team Alpha', 'ALP', '#3DA9FC'],
  ['t2', 'Team Bravo', 'BRV', '#EF4565'],
  ['t3', 'Team Charlie', 'CHR', '#2CB67D'],
  ['t4', 'Team Delta', 'DLT', '#FF8906'],
  ['t5', 'Team Echo', 'ECH', '#7F5AF0'],
  ['t6', 'Team Foxtrot', 'FOX', '#E53170'],
  ['t7', 'Team Golf', 'GLF', '#00C2A8'],
  ['t8', 'Team Hotel', 'HTL', '#F9C80E'],
];

export function defaultState() {
  const teams = {};
  SAMPLE_TEAMS.forEach(([id, name, tag, color]) => { teams[id] = { name, tag, color, logo: '', players: '' }; });
  const ids = SAMPLE_TEAMS.map(t => t[0]);
  return {
    game: 'cod',
    teams,
    match: {
      label: 'GRAND FINAL',
      a: 't1', b: 't2',
      scoreA: 0, scoreB: 0,
      seriesA: 0, seriesB: 0,
      bestOf: 5,
      mapNo: 1,
      showMapScore: true,
      // EA FC
      clock: { running: false, baseMs: 0, startedAt: 0 },
      period: '1ST HALF',
      agg: { on: false, a: 0, b: 0 },
      pickA: '', pickB: '',
    },
    pools: DEFAULT_POOLS,
    veto: { format: 'cod_bo5', steps: buildVeto('cod_bo5', DEFAULT_POOLS) },
    scene: { active: 'none', title: 'STARTING SOON', subtitle: 'The broadcast will begin shortly', countdownTo: 0, bracketSec: 'UB' },
    overlay: { scorebug: true, vetoStrip: false, ticker: false },
    pause: { type: '', team: '', startedAt: 0, limitSec: 0, banner: true },
    lowerThird: { visible: false, title: 'PLAYER NAME', subtitle: 'Team Alpha · Captain' },
    ticker: { text: 'Welcome to the broadcast  •  Follow us for highlights  •  Use the tournament hashtag' },
    cast: { layout: 2, title: '', casters: [{ name: 'CASTER ONE', handle: '@caster1' }, { name: 'CASTER TWO', handle: '@caster2' }, { name: 'ANALYST', handle: '@analyst' }], showNext: true },
    bracket: buildBracket('single', 8, ids),
    schedule: [
      { time: '18:00', a: 't1', b: 't2', label: 'Quarterfinal 1', status: 'live', sa: '', sb: '' },
      { time: '19:00', a: 't3', b: 't4', label: 'Quarterfinal 2', status: 'upcoming', sa: '', sb: '' },
      { time: '20:00', a: 't5', b: 't6', label: 'Quarterfinal 3', status: 'upcoming', sa: '', sb: '' },
      { time: '21:00', a: 't7', b: 't8', label: 'Quarterfinal 4', status: 'upcoming', sa: '', sb: '' },
    ],
    standings: ids.slice(0, 6).map(id => ({ team: id, w: 0, l: 0, diff: 0, pts: 0 })),
    standingsTitle: 'GROUP A',
    winner: { team: 't1', title: 'CHAMPIONS' },
  };
}

// Merge a (possibly partial) remote state onto the defaults, restoring arrays Firebase turned into objects.
export function normalize(remote) {
  return merge(defaultState(), remote || {}, '');
}

// Keyed collections the user edits freely: never refill them with sample entries.
const DYNAMIC = new Set(['teams', 'bracket/matches', 'pools/cod', 'pools/generic']);

function merge(def, val, path) {
  if (DYNAMIC.has(path) && val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      const v = val[k];
      out[k] = Array.isArray(v) || (v && typeof v === 'object' && '0' in v) ? merge([], v, '') : v;
    }
    return out;
  }
  if (Array.isArray(def)) {
    if (val == null) return [];
    const arr = Array.isArray(val) ? val : Object.keys(val).sort((a, b) => a - b).map(k => val[k]);
    return arr.filter(x => x != null);
  }
  if (def && typeof def === 'object') {
    if (val == null || typeof val !== 'object') return def;
    const out = { ...val };
    for (const k of Object.keys(def)) out[k] = merge(def[k], val[k], path ? `${path}/${k}` : k);
    return out;
  }
  return val === undefined ? def : val;
}

export function setPath(obj, path, value) {
  const keys = path.split('/');
  let o = obj;
  keys.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  o[keys[keys.length - 1]] = value;
}
