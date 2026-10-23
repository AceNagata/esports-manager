// Game definitions and the map veto engine.

export const GAMES = {
  fc: {
    id: 'fc',
    name: 'EA SPORTS FC',
    hasVeto: false,
    hasClock: true,
    scoreLabel: 'GOALS',
    periods: ['1ST HALF', 'HALF TIME', '2ND HALF', 'FULL TIME', 'EXTRA TIME', 'PENALTIES'],
  },
  cod: {
    id: 'cod',
    name: 'CALL OF DUTY',
    hasVeto: true,
    hasClock: false,
    scoreLabel: 'MAP SCORE',
    modes: { HP: 'Hardpoint', SND: 'Search & Destroy', OVL: 'Overload' },
  },
  generic: {
    id: 'generic',
    name: 'OTHER GAME',
    hasVeto: true,
    hasClock: false,
    scoreLabel: 'ROUNDS',
    modes: { ALL: 'Map' },
  },
};

// CDL 2026 (Black Ops 7) competitive pool, as announced for launch. Editable in the control panel.
export const DEFAULT_POOLS = {
  cod: {
    HP: ['Blackheart', 'Colossus', 'Den', 'Exposure', 'Scar'],
    SND: ['Colossus', 'Den', 'Exposure', 'Raid', 'Scar'],
    OVL: ['Den', 'Exposure', 'Scar'],
  },
  generic: {
    ALL: ['Map One', 'Map Two', 'Map Three', 'Map Four', 'Map Five', 'Map Six', 'Map Seven'],
  },
};

// Veto formats. Each step: act (ban | pick | decider), team (A | B | null), mode, game (series game number for picks).
const s = (act, team, mode, game = null) => ({ act, team, mode, game, map: '' });

export const VETO_FORMATS = {
  cod_bo5: {
    game: 'cod', label: 'CDL Best of 5', bestOf: 5,
    steps: () => [
      s('ban', 'A', 'HP'), s('ban', 'B', 'HP'), s('pick', 'A', 'HP', 1), s('pick', 'B', 'HP', 4),
      s('ban', 'B', 'SND'), s('ban', 'A', 'SND'), s('pick', 'B', 'SND', 2), s('pick', 'A', 'SND', 5),
      s('ban', 'A', 'OVL'), s('ban', 'B', 'OVL'), s('decider', null, 'OVL', 3),
    ],
  },
  cod_bo3: {
    game: 'cod', label: 'Best of 3', bestOf: 3,
    steps: () => [
      s('ban', 'A', 'HP'), s('ban', 'B', 'HP'), s('pick', 'A', 'HP', 1),
      s('ban', 'B', 'SND'), s('ban', 'A', 'SND'), s('pick', 'B', 'SND', 2),
      s('ban', 'A', 'OVL'), s('ban', 'B', 'OVL'), s('decider', null, 'OVL', 3),
    ],
  },
  generic_bo1: { game: 'generic', label: 'Best of 1', bestOf: 1, steps: (n) => genericSteps(n, 0) },
  generic_bo3: { game: 'generic', label: 'Best of 3', bestOf: 3, steps: (n) => genericSteps(n, 2) },
  generic_bo5: { game: 'generic', label: 'Best of 5', bestOf: 5, steps: (n) => genericSteps(n, 4) },
};

// Generic: 2 bans, then `picks` alternating picks, then alternating bans until one map remains (decider).
function genericSteps(poolSize, picks) {
  const out = [];
  let team = 'A';
  const flip = () => { const t = team; team = team === 'A' ? 'B' : 'A'; return t; };
  let left = poolSize;
  if (picks > 0 && left > picks + 2) { out.push(s('ban', flip(), 'ALL')); out.push(s('ban', flip(), 'ALL')); left -= 2; }
  for (let g = 1; g <= picks; g++) { out.push(s('pick', flip(), 'ALL', g)); left--; }
  while (left > 1) { out.push(s('ban', flip(), 'ALL')); left--; }
  out.push(s('decider', null, 'ALL', picks + 1));
  return out;
}

export function buildVeto(formatId, pools) {
  const f = VETO_FORMATS[formatId];
  if (!f) return [];
  return f.steps((pools?.generic?.ALL || []).length);
}

export function currentStep(steps) {
  return steps.findIndex(st => !st.map);
}

// Maps still available for the step at `idx` (same mode, not already banned or picked in that mode).
export function availableMaps(steps, idx, pools, game) {
  const st = steps[idx];
  if (!st) return [];
  const pool = (pools?.[game]?.[st.mode]) || [];
  const used = new Set(steps.filter((x, i) => i !== idx && x.mode === st.mode && x.map).map(x => x.map));
  return pool.filter(m => !used.has(m));
}

// Fill any decider whose mode has exactly one map left. Returns a new array.
export function autoDecide(steps, pools, game) {
  const out = steps.map(x => ({ ...x }));
  out.forEach((st, i) => {
    if (st.act !== 'decider' || st.map) return;
    const before = out.slice(0, i);
    if (before.some(b => !b.map)) return;
    const avail = availableMaps(out, i, pools, game);
    if (avail.length === 1) st.map = avail[0];
  });
  return out;
}

// Ordered list of the maps that will be played.
export function seriesMaps(steps) {
  return steps
    .filter(st => (st.act === 'pick' || st.act === 'decider') && st.game)
    .sort((a, b) => a.game - b.game);
}

export function modeName(game, mode) {
  return GAMES[game]?.modes?.[mode] || '';
}
