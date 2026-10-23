import { applyTheme, team, logoHTML, esc, mmss, clockMs, setHTML } from '../assets/js/common.js';
import { connectShow } from '../assets/js/sync.js';
import { defaultState } from '../assets/js/state.js';
import { GAMES, VETO_FORMATS, buildVeto, currentStep, availableMaps, autoDecide, modeName } from '../assets/js/games.js';
import { buildBracket, roundsOf, roundName, winnerPatch } from '../assets/js/bracket.js';

applyTheme();
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
let S = null;
let show = null;
let seeded = false;
let user = null;

const get = (path, o = S) => path.split('/').reduce((a, k) => (a == null ? a : a[k]), o);
const clean = v => JSON.parse(JSON.stringify(v ?? null));   // strips undefined (Firebase rejects it)
const now = () => (show ? show.now() : Date.now());

function up(patch) {
  for (const k of Object.keys(patch)) patch[k] = clean(patch[k]);
  return show.update(patch).catch(err => toast('Write failed: ' + err.message));
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------------- Two-way field binding ----------------
function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number') return el.value === '' ? 0 : Number(el.value);
  return el.value;
}
const pending = new Map();
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.bind || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  clearTimeout(pending.get(el));
  pending.set(el, setTimeout(() => up({ [el.dataset.bind]: readInput(el) }), 300));
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.bind) {
    clearTimeout(pending.get(el));
    up({ [el.dataset.bind]: readInput(el) });
  }
  if (el.dataset.actChange) CHANGE[el.dataset.actChange]?.(el);
  if (el.dataset.pool) up({ [el.dataset.pool]: el.value.split('\n').map(x => x.trim()).filter(Boolean) });
  if (el.dataset.upload) uploadLogo(el);
});

function syncBound() {
  $$('[data-bind]').forEach(el => {
    if (el === document.activeElement) return;
    const v = get(el.dataset.bind);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (String(el.value) !== String(v ?? '')) el.value = v ?? '';
  });
}

// Rebuild a list only when its structure changes, so typing is never interrupted.
function renderList(el, sig, html) {
  if (el._sig === sig) return;
  el._sig = sig;
  el.innerHTML = html;
}

// ---------------- Actions ----------------
const PRESETS = {
  starting: { title: 'STARTING SOON', subtitle: 'The broadcast will begin shortly' },
  brb: { title: 'BE RIGHT BACK', subtitle: 'Stay tuned, the action continues shortly' },
  ending: { title: 'THANKS FOR WATCHING', subtitle: 'See you at the next match' },
};

const ACT = {
  score(el) { const k = 'score' + el.dataset.side; up({ ['match/' + k]: Math.max(0, (S.match[k] || 0) + +el.dataset.d) }); },
  series(el) { const k = 'series' + el.dataset.side; up({ ['match/' + k]: Math.max(0, (S.match[k] || 0) + +el.dataset.d) }); },
  mapWin(el) {
    const k = 'series' + el.dataset.side, m = S.match;
    up({ ['match/' + k]: (m[k] || 0) + 1, 'match/mapNo': Math.min(m.bestOf, m.mapNo + 1), 'match/scoreA': 0, 'match/scoreB': 0 });
  },
  mapNo(el) { up({ 'match/mapNo': Math.min(S.match.bestOf, Math.max(1, S.match.mapNo + +el.dataset.d)) }); },
  swap() {
    const m = S.match;
    up({
      'match/a': m.b, 'match/b': m.a, 'match/scoreA': m.scoreB, 'match/scoreB': m.scoreA,
      'match/seriesA': m.seriesB, 'match/seriesB': m.seriesA, 'match/pickA': m.pickB, 'match/pickB': m.pickA,
      'match/agg/a': m.agg.b, 'match/agg/b': m.agg.a,
      'veto/steps': S.veto.steps.map(x => ({ ...x, team: x.team === 'A' ? 'B' : x.team === 'B' ? 'A' : null })),
    });
  },
  resetMatch() {
    if (!confirm('Reset scores, series and clock?')) return;
    up({ 'match/scoreA': 0, 'match/scoreB': 0, 'match/seriesA': 0, 'match/seriesB': 0, 'match/mapNo': 1, 'match/clock': { running: false, baseMs: 0, startedAt: 0 } });
  },
  nextMatch() {
    const rows = S.schedule || [];
    const liveIdx = rows.findIndex(r => r.status === 'live');
    const next = rows.findIndex((r, i) => i > liveIdx && r.status !== 'done');
    if (next < 0) return toast('No upcoming match in the schedule');
    const patch = {
      'match/a': rows[next].a, 'match/b': rows[next].b, 'match/label': rows[next].label || S.match.label,
      'match/scoreA': 0, 'match/scoreB': 0, 'match/seriesA': 0, 'match/seriesB': 0, 'match/mapNo': 1,
      'match/clock': { running: false, baseMs: 0, startedAt: 0 },
      [`schedule/${next}/status`]: 'live',
      'veto/steps': buildVeto(S.veto.format, S.pools),
    };
    if (liveIdx >= 0) patch[`schedule/${liveIdx}/status`] = 'done';
    up(patch);
    toast(`Loaded: ${team(S, rows[next].a).name} vs ${team(S, rows[next].b).name}`);
  },

  // Clock (EA FC)
  clockStart() { const c = S.match.clock; if (!c.running) up({ 'match/clock': { running: true, baseMs: c.baseMs || 0, startedAt: now() } }); },
  clockPause() { const c = S.match.clock; if (c.running) up({ 'match/clock': { running: false, baseMs: clockMs(c, now()), startedAt: 0 } }); },
  clockReset() { up({ 'match/clock': { running: false, baseMs: 0, startedAt: 0 } }); },
  clockSet() { setClock($('clockSet').value); },
  clockPreset(el) { setClock(el.dataset.v); },

  // Veto
  pickMap(el) {
    const steps = clean(S.veto.steps);
    const cur = currentStep(steps);
    if (cur < 0) return;
    steps[cur].map = el.dataset.map;
    up({ 'veto/steps': autoDecide(steps, S.pools, S.game) });
  },
  clearStep(el) { up({ [`veto/steps/${el.dataset.i}/map`]: '' }); },
  vetoUndo() {
    const steps = S.veto.steps;
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].map) return up({ [`veto/steps/${i}/map`]: '' });
  },
  vetoReset() { if (confirm('Clear the whole veto?')) up({ 'veto/steps': buildVeto(S.veto.format, S.pools) }); },

  // Scenes
  scene(el) { const sc = el.dataset.scene; up({ 'scene/active': S.scene.active === sc ? 'none' : sc }); },
  sceneOff() { up({ 'scene/active': 'none' }); },
  holding(el) {
    const p = el.dataset.preset;
    if (S.scene.active === 'holding' && S.scene.preset === p) return up({ 'scene/active': 'none' });
    up({ 'scene/active': 'holding', 'scene/preset': p, 'scene/title': PRESETS[p].title, 'scene/subtitle': PRESETS[p].subtitle });
  },
  cdSet() { const min = +$('cdMin').value || 0; up({ 'scene/countdownTo': now() + min * 60000, 'scene/countdownTotal': min * 60 }); },
  cdClear() { up({ 'scene/countdownTo': 0 }); },
  cdQuick(el) {
    const min = +el.dataset.min;
    up({ 'scene/active': 'holding', 'scene/preset': 'brb', 'scene/title': PRESETS.brb.title, 'scene/subtitle': PRESETS.brb.subtitle, 'scene/countdownTo': now() + min * 60000, 'scene/countdownTotal': min * 60 });
  },

  // Pauses
  pause(el) { up({ 'pause/type': el.dataset.type, 'pause/team': el.dataset.team, 'pause/startedAt': now(), 'pause/limitSec': +$('pauseLimit').value || 0 }); },
  pauseEnd() { const p = { 'pause/type': '' }; if (S.scene.active === 'pause') p['scene/active'] = 'none'; up(p); },

  // Graphics
  l3fill(el) { up({ 'lowerThird/title': el.dataset.t, 'lowerThird/subtitle': el.dataset.s }); },
  castLayout(el) { up({ 'cast/layout': +el.dataset.v }); },

  // Bracket
  bracketGen() {
    if (!confirm('Generate a new bracket? This replaces the current one.')) return;
    up({ bracket: buildBracket($('bType').value, +$('bSize').value, Object.keys(S.teams || {})) });
  },
  bWin(el) {
    const x = S.bracket.matches[el.dataset.id];
    if (x.win === el.dataset.side) return up({ [`bracket/matches/${x.id}/win`]: '' });
    up(winnerPatch(S.bracket, x.id, el.dataset.side));
  },

  // Schedule / standings
  schedAdd() { up({ schedule: [...S.schedule, { time: '', a: '', b: '', label: '', status: 'upcoming', sa: '', sb: '' }] }); },
  schedDel(el) { up({ schedule: S.schedule.filter((_, i) => i !== +el.dataset.i) }); },
  standAdd() { up({ standings: [...S.standings, { team: '', w: 0, l: 0, diff: 0, pts: 0 }] }); },
  standDel(el) { up({ standings: S.standings.filter((_, i) => i !== +el.dataset.i) }); },

  // Teams
  teamAdd() { const id = 't' + Date.now().toString(36); up({ ['teams/' + id]: { name: 'New Team', tag: 'NEW', color: '#888888', logo: '', players: '' } }); },
  logoClear(el) { up({ [`teams/${el.dataset.id}/logo`]: '' }); },
  teamDel(el) { if (confirm('Delete this team?')) up({ ['teams/' + el.dataset.id]: null }); },

  // Settings
  copy(el) { navigator.clipboard.writeText(el.dataset.url).then(() => toast('URL copied')); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `show-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
  },
  resetShow() { if (confirm('Reset EVERYTHING (teams, bracket, schedule) to the sample data?')) show.replace(defaultState()); },
};

const CHANGE = {
  setGame(el) {
    const g = el.value;
    const patch = { game: g };
    if (GAMES[g].hasVeto && VETO_FORMATS[S.veto.format]?.game !== g) {
      const f = g === 'cod' ? 'cod_bo5' : 'generic_bo3';
      Object.assign(patch, { 'veto/format': f, 'veto/steps': buildVeto(f, S.pools), 'match/bestOf': VETO_FORMATS[f].bestOf });
    }
    if (g === 'fc') patch['match/bestOf'] = 1;
    up(patch);
  },
  vetoFormat(el) {
    const f = el.value;
    up({ 'veto/format': f, 'veto/steps': buildVeto(f, S.pools), 'match/bestOf': VETO_FORMATS[f].bestOf });
  },
};

function setClock(str) {
  const [mm, ss] = String(str).split(':').map(Number);
  if (isNaN(mm)) return toast('Use mm:ss');
  const ms = (mm * 60 + (ss || 0)) * 1000;
  const c = S.match.clock;
  up({ 'match/clock': { running: c.running, baseMs: ms, startedAt: c.running ? now() : 0 } });
}

async function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const img = new Image();
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(file); });
  } catch {
    input.value = '';
    return toast('Could not read that image file');
  }
  input.value = '';   // allow re-uploading the same file
  const w = img.naturalWidth || 256, h = img.naturalHeight || 256;   // SVGs may have no intrinsic size
  const scale = Math.min(1, 256 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  up({ [`teams/${input.dataset.upload}/logo`]: c.toDataURL('image/png') });
  toast('Logo uploaded');
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-toggle],[data-tab]');
  if (!el) return;
  if (el.dataset.tab) {
    $$('#nav button').forEach(b => b.classList.toggle('on', b === el));
    $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + el.dataset.tab));
    try { localStorage.setItem('ctl-tab', el.dataset.tab); } catch {}
    return;
  }
  if (!S) return;
  if (el.dataset.toggle) return up({ [el.dataset.toggle]: !get(el.dataset.toggle) });
  ACT[el.dataset.act]?.(el);
});

document.addEventListener('keydown', e => {
  if (!S || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  const side = e.code === 'Digit1' ? 'A' : e.code === 'Digit2' ? 'B' : null;
  if (side) { ACT.score({ dataset: { side, d: e.shiftKey ? -1 : 1 } }); e.preventDefault(); }
  if (e.key === 's' || e.key === 'S') up({ 'overlay/scorebug': !S.overlay.scorebug });
  if (e.key === 'Escape') ACT.sceneOff();
});

$('importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try { const data = JSON.parse(await f.text()); if (confirm('Replace the whole show with this backup?')) await show.replace(data); }
  catch (err) { toast('Import failed: ' + err.message); }
  e.target.value = '';
});

// ---------------- Rendering ----------------
let teamSig = '';
function teamOptions() {
  return `<option value="">— TBD —</option>` + Object.entries(S.teams || {}).map(([id, t]) => `<option value="${esc(id)}">${esc(t.name)}</option>`).join('');
}

function render() {
  const g = GAMES[S.game] || GAMES.generic;
  const m = S.match;

  // Team dropdowns
  const sig = JSON.stringify(Object.entries(S.teams || {}).map(([id, t]) => [id, t.name]));
  if (sig !== teamSig) { teamSig = sig; const html = teamOptions(); $$('select[data-teams]').forEach(s => { s.innerHTML = html; }); }

  // Game-specific sections
  $$('.fc-only').forEach(el => { el.style.display = g.hasClock ? '' : 'none'; });
  $$('.cod-only').forEach(el => { el.style.display = g.hasVeto ? '' : 'none'; });
  setHTML($('periodSel'), (GAMES.fc.periods).map(p => `<option>${p}</option>`).join(''));
  setHTML($('vetoFormat'), Object.entries(VETO_FORMATS).filter(([, f]) => f.game === S.game).map(([id, f]) => `<option value="${id}">${f.label}</option>`).join(''));
  $('vetoFormat').value = S.veto.format;
  $('gameSel').value = S.game;

  renderLists();
  syncBound();

  // Toggles + live scene buttons
  $$('[data-toggle]').forEach(b => b.classList.toggle('on', !!get(b.dataset.toggle)));
  $$('[data-scene-btn]').forEach(b => {
    const [sc, preset] = b.dataset.sceneBtn.split(':');
    b.classList.toggle('on', S.scene.active === sc && (!preset || S.scene.preset === preset));
  });
  $$('[data-act=castLayout]').forEach(b => b.classList.toggle('on', +b.dataset.v === S.cast.layout && S.cast.layout > 0));
  $('sceneNow').textContent = S.scene.active === 'none' ? 'none' : S.scene.active.toUpperCase();

  // Scoreboard
  [['A', m.a, m.scoreA, m.seriesA], ['B', m.b, m.scoreB, m.seriesB]].forEach(([s, id, sc, se]) => {
    const t = team(S, id), el = $('side' + s);
    el.style.setProperty('--tc', t.color);
    el.querySelector('[data-f=name]').textContent = t.name;
    // Quick team color + logo editing for whichever team is on this side
    el.querySelector('.teamstyle').style.visibility = id ? '' : 'hidden';
    setHTML(el.querySelector('[data-f=logo]'), logoHTML(t));
    const color = el.querySelector('[data-f=color]');
    color.dataset.bind = `teams/${id}/color`;
    if (color !== document.activeElement) color.value = t.color;
    el.querySelector('[data-f=upload]').dataset.upload = id;
    el.querySelector('[data-f=clear]').dataset.id = id;
    el.querySelector('[data-f=clear]').disabled = !t.logo;
    el.querySelector('[data-f=score]').textContent = sc;
    el.querySelector('[data-f=series]').textContent = `${se} / ${Math.ceil(m.bestOf / 2)}`;
  });
  $('mapNo').textContent = `${m.mapNo} / ${m.bestOf}`;
  $('tacA').textContent = `Tactical: ${team(S, m.a).tag}`;
  $('tacB').textContent = `Tactical: ${team(S, m.b).tag}`;

  renderVeto();
  tick();
}

function renderVeto() {
  const steps = S.veto.steps || [];
  const cur = currentStep(steps);
  setHTML($('steps'), steps.map((x, i) => {
    const t = x.team ? team(S, x.team === 'A' ? S.match.a : S.match.b) : null;
    return `<div class="step ${i === cur ? 'cur' : ''}" style="--tc:${t ? esc(t.color) : 'var(--accent)'}">
      <span class="n">${i + 1}</span><span class="a ${x.act}">${x.act.toUpperCase()}</span>
      <span class="t">${t ? esc(t.tag) : '—'}</span>
      <span class="m">${esc(x.map || '')}${x.mode !== 'ALL' ? ` <span class="hint">· ${esc(modeName(S.game, x.mode))}${x.game ? ` · map ${x.game}` : ''}</span>` : x.game ? ` <span class="hint">· map ${x.game}</span>` : ''}</span>
      ${x.map ? `<button class="btn sm" data-act="clearStep" data-i="${i}">✕</button>` : ''}
    </div>`;
  }).join(''));
  if (cur < 0) {
    $('vetoPrompt').textContent = 'Veto complete';
    setHTML($('mapbtns'), '');
    return;
  }
  const st = steps[cur];
  const t = st.team ? team(S, st.team === 'A' ? S.match.a : S.match.b) : null;
  $('vetoPrompt').textContent = `${t ? t.name : 'Decider'}: ${st.act} ${st.mode !== 'ALL' ? modeName(S.game, st.mode) : 'a map'}`;
  setHTML($('mapbtns'), availableMaps(steps, cur, S.pools, S.game).map(mp => `<button class="btn" data-act="pickMap" data-map="${esc(mp)}">${esc(mp)}</button>`).join(''));
}

function renderLists() {
  const opts = teamOptions();

  // Teams
  const ids = Object.keys(S.teams || {});
  renderList($('teamRows'), ids.join(), ids.map(id => `
    <div class="teamrow">
      <div class="prev" data-prev="${esc(id)}"></div>
      <input data-bind="teams/${esc(id)}/name">
      <input data-bind="teams/${esc(id)}/tag" maxlength="5">
      <input type="color" data-bind="teams/${esc(id)}/color">
      <div class="row" style="flex-wrap:nowrap"><input data-bind="teams/${esc(id)}/logo" placeholder="assets/logos/…"><label class="btn sm">Upload<input type="file" accept="image/*" data-upload="${esc(id)}" hidden></label></div>
      <input data-bind="teams/${esc(id)}/players" placeholder="Player1, Player2, …">
      <button class="btn sm danger" data-act="teamDel" data-id="${esc(id)}">✕</button>
    </div>`).join(''));
  $$('[data-prev]').forEach(el => setHTML(el, logoHTML(team(S, el.dataset.prev))));

  // Schedule
  renderList($('schedRows'), S.schedule.length + teamSig, S.schedule.map((r, i) => `
    <tr>
      <td><input data-bind="schedule/${i}/time" style="width:80px"></td>
      <td><select data-bind="schedule/${i}/a">${opts}</select></td>
      <td><select data-bind="schedule/${i}/b">${opts}</select></td>
      <td><input data-bind="schedule/${i}/label"></td>
      <td><input data-bind="schedule/${i}/sa" style="width:60px"></td>
      <td><input data-bind="schedule/${i}/sb" style="width:60px"></td>
      <td><select data-bind="schedule/${i}/status"><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="done">Done</option></select></td>
      <td><button class="btn sm danger" data-act="schedDel" data-i="${i}">✕</button></td>
    </tr>`).join(''));

  // Standings
  renderList($('standRows'), S.standings.length + teamSig, S.standings.map((r, i) => `
    <tr>
      <td><select data-bind="standings/${i}/team">${opts}</select></td>
      <td><input type="number" data-bind="standings/${i}/w" style="width:70px"></td>
      <td><input type="number" data-bind="standings/${i}/l" style="width:70px"></td>
      <td><input type="number" data-bind="standings/${i}/diff" style="width:70px"></td>
      <td><input type="number" data-bind="standings/${i}/pts" style="width:70px"></td>
      <td><button class="btn sm danger" data-act="standDel" data-i="${i}">✕</button></td>
    </tr>`).join(''));

  // Bracket editor
  const b = S.bracket || { matches: {} };
  const secs = b.type === 'double' ? ['UB', 'LB', 'GF'] : ['UB'];
  renderList($('bracketEd'), Object.keys(b.matches || {}).join() + teamSig, secs.map(sec => {
    const rounds = roundsOf(b, sec);
    return `<h3>${sec === 'UB' ? (b.type === 'double' ? 'Upper bracket' : 'Bracket') : sec === 'LB' ? 'Lower bracket' : 'Grand final'}</h3>
      <div class="bcols">${rounds.map((r, i) => `<div class="bcol"><div class="hint">${roundName(b, sec, i + 1, rounds.length)}</div>${r.map(x => `
        <div class="bmatch">
          <div class="id">${x.id}</div>
          <select data-teams data-bind="bracket/matches/${x.id}/a">${opts}</select><input data-bind="bracket/matches/${x.id}/sa" placeholder="0"><button class="btn sm" data-act="bWin" data-id="${x.id}" data-side="a">Win</button>
          <select data-teams data-bind="bracket/matches/${x.id}/b">${opts}</select><input data-bind="bracket/matches/${x.id}/sb" placeholder="0"><button class="btn sm" data-act="bWin" data-id="${x.id}" data-side="b">Win</button>
        </div>`).join('')}</div>`).join('')}</div>`;
  }).join(''));
  $$('[data-act=bWin]').forEach(btn => btn.classList.toggle('win', b.matches?.[btn.dataset.id]?.win === btn.dataset.side));

  // Casters
  renderList($('casters'), 'c', [0, 1, 2].map(i => `
    <div class="row"><label class="f">Cam ${i + 1} name <input data-bind="cast/casters/${i}/name"></label><label class="f">Handle / role <input data-bind="cast/casters/${i}/handle"></label></div>`).join(''));

  // Lower-third quick fill: casters + players of the current match
  const presets = [];
  (S.cast.casters || []).forEach(c => c?.name && presets.push([c.name, c.handle || 'Caster']));
  [S.match.a, S.match.b].forEach(id => {
    const t = team(S, id);
    (t.players || '').split(',').map(x => x.trim()).filter(Boolean).forEach(p => presets.push([p, t.name]));
  });
  setHTML($('l3presets'), presets.map(([t, s]) => `<button class="btn sm" data-act="l3fill" data-t="${esc(t)}" data-s="${esc(s)}">${esc(t)}</button>`).join('') || '<span class="hint">Add casters or team players to get quick-fill buttons.</span>');

  // Map pools
  const poolHTML = Object.entries(S.pools || {}).flatMap(([game, modes]) =>
    Object.keys(modes).map(md => `<label class="f" style="margin-top:8px">${esc(GAMES[game]?.name || game)} · ${esc(modeName(game, md))}<textarea rows="5" data-pool="pools/${game}/${md}"></textarea></label>`)).join('');
  renderList($('pools'), Object.entries(S.pools || {}).map(([g, ms]) => g + Object.keys(ms)).join(), poolHTML);
  $$('[data-pool]').forEach(el => { if (el !== document.activeElement) el.value = (get(el.dataset.pool) || []).join('\n'); });
}

function tick() {
  if (!S) return;
  $('clock').textContent = mmss(clockMs(S.match.clock, now()));
  const p = S.pause;
  if (!p.type) { $('pauseNow').textContent = '—'; return; }
  const el = now() - p.startedAt;
  const label = p.type === 'technical' ? 'TECHNICAL' : `TACTICAL ${p.team ? team(S, p.team === 'A' ? S.match.a : S.match.b).tag : ''}`;
  $('pauseNow').textContent = `${label} · ${p.limitSec ? mmss(p.limitSec * 1000 - el) : mmss(el)}`;
}
setInterval(tick, 250);

// ---------------- Static bits ----------------
function renderStatic() {
  setHTML($('brand'), `<div>Esports Manager<small>BROADCAST CONTROL</small></div>`);
  const base = new URL('../output/', location.href);
  const outs = [
    ['Input 1: Scenes (full screen)', 'scene.html'],
    ['Input 2: In-game overlay', 'overlay.html'],
    ['Input 3: Caster frame', 'cast.html'],
  ];
  setHTML($('urls'), outs.map(([n, f]) => {
    const url = new URL(f, base).href;
    return `<div style="margin-top:10px"><b>${n}</b><div class="row"><code>${esc(url)}</code><button class="btn sm" data-act="copy" data-url="${esc(url)}">Copy</button><a class="btn sm" href="${esc(url)}?preview=1" target="_blank">Preview</a></div></div>`;
  }).join(''));
  try {
    const t = localStorage.getItem('ctl-tab');
    if (t) document.querySelector(`[data-tab="${t}"]`)?.click();
  } catch {}
}

// ---------------- Boot ----------------
(async () => {
  show = await connectShow(state => {
    S = state;
    if (!seeded && show && show.isEmpty && user) { seeded = true; show.replace(defaultState()); return; }
    render();
  });
  if (S) render();
  renderStatic();

  const status = $('status');
  show.onStatus(st => {
    status.className = 'status ' + st;
    status.querySelector('span').textContent = st === 'local' ? 'Local mode (this browser only)' : st === 'online' ? 'Live · synced' : 'Offline · reconnecting';
  });
  show.onAuth(u => {
    user = u;
    const needLogin = show.mode === 'firebase' && !u;
    $('login').classList.toggle('on', needLogin);
    $('signout').hidden = show.mode !== 'firebase' || !u;
    if (u && show.isEmpty && !seeded) { seeded = true; show.replace(defaultState()); }
  });
  $('signout').onclick = () => show.signOut();
  $('loginForm').onsubmit = async e => {
    e.preventDefault();
    $('lgErr').textContent = '';
    try { await show.signIn($('lgEmail').value, $('lgPass').value); }
    catch (err) { $('lgErr').textContent = err.code === 'auth/invalid-credential' ? 'Wrong email or password.' : err.message; }
  };
})();
