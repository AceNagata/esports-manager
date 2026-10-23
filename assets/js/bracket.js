// Bracket generator: single or double elimination for 4, 8 or 16 teams.
// Matches are stored flat, keyed by id. Each match knows where its winner (wTo) and loser (lTo) go, as "matchId:slot".

const m = (id, sec, round, idx) => ({ id, sec, round, idx, a: '', b: '', sa: '', sb: '', win: '', wTo: '', lTo: '' });

export function buildBracket(type, size, teamIds = []) {
  const L = Math.log2(size);
  const matches = {};
  const ub = [];
  for (let r = 1; r <= L; r++) {
    const row = [];
    for (let i = 0; i < size / 2 ** r; i++) {
      const id = `U${r}-${i + 1}`;
      matches[id] = m(id, 'UB', r, i);
      row.push(id);
    }
    ub.push(row);
  }
  // Upper bracket progression
  ub.forEach((row, r) => row.forEach((id, i) => {
    if (r + 1 < ub.length) matches[id].wTo = `${ub[r + 1][Math.floor(i / 2)]}:${i % 2 ? 'b' : 'a'}`;
  }));
  // Seed first round
  ub[0].forEach((id, i) => { matches[id].a = teamIds[i * 2] || ''; matches[id].b = teamIds[i * 2 + 1] || ''; });

  if (type === 'double') {
    const lb = [];
    let lr = 1;
    const addRound = (count) => {
      const row = [];
      for (let i = 0; i < count; i++) { const id = `L${lr}-${i + 1}`; matches[id] = m(id, 'LB', lr, i); row.push(id); }
      lb.push(row); lr++;
      return row;
    };
    // LB round 1: losers of UB round 1, paired
    const lb1 = addRound(size / 4);
    ub[0].forEach((id, i) => { matches[id].lTo = `${lb1[Math.floor(i / 2)]}:${i % 2 ? 'b' : 'a'}`; });
    let prev = lb1;
    for (let j = 1; j <= L - 1; j++) {
      // Drop round: LB winners vs UB round j+1 losers
      const drop = addRound(size / 2 ** (j + 1));
      prev.forEach((id, i) => { matches[id].wTo = `${drop[i]}:a`; });
      ub[j].forEach((id, i) => { matches[id].lTo = `${drop[drop.length - 1 - i]}:b`; }); // crossover
      prev = drop;
      if (j < L - 1) {
        const merge = addRound(size / 2 ** (j + 2));
        prev.forEach((id, i) => { matches[id].wTo = `${merge[Math.floor(i / 2)]}:${i % 2 ? 'b' : 'a'}`; });
        prev = merge;
      }
    }
    matches.GF = m('GF', 'GF', 1, 0);
    matches[ub[L - 1][0]].wTo = 'GF:a';
    matches[prev[0]].wTo = 'GF:b';
  }
  return { type, size, matches };
}

export function roundsOf(bracket, sec) {
  const list = Object.values(bracket?.matches || {}).filter(x => x.sec === sec);
  const rounds = {};
  list.forEach(x => { (rounds[x.round] ||= []).push(x); });
  return Object.keys(rounds).sort((a, b) => a - b).map(r => rounds[r].sort((a, b) => a.idx - b.idx));
}

export function roundName(bracket, sec, r, total) {
  if (sec === 'GF') return 'GRAND FINAL';
  const left = total - r;
  if (sec === 'UB') {
    const prefix = bracket.type === 'double' ? 'UPPER ' : '';
    if (left === 0) return prefix + 'FINAL';
    if (left === 1) return prefix + 'SEMIFINALS';
    if (left === 2) return prefix + 'QUARTERFINALS';
    return `${prefix}ROUND ${r}`;
  }
  return left === 0 ? 'LOWER FINAL' : `LOWER ROUND ${r}`;
}

// Returns a patch object (Firebase-style paths) that sets the winner and sends both teams onward.
export function winnerPatch(bracket, id, side, base = 'bracket/matches') {
  const x = bracket.matches[id];
  const patch = { [`${base}/${id}/win`]: side };
  const winTeam = side === 'a' ? x.a : x.b;
  const loseTeam = side === 'a' ? x.b : x.a;
  if (x.wTo) { const [t, slot] = x.wTo.split(':'); patch[`${base}/${t}/${slot}`] = winTeam || ''; }
  if (x.lTo) { const [t, slot] = x.lTo.split(':'); patch[`${base}/${t}/${slot}`] = loseTeam || ''; }
  return patch;
}
