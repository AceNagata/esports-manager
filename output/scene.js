import { bootOutput, team, logoHTML, setHTML, esc, mmss, asset } from '../assets/js/common.js';
import { GAMES, seriesMaps, modeName, currentStep } from '../assets/js/games.js';
import { roundsOf, roundName } from '../assets/js/bracket.js';

const $ = id => document.getElementById(id);
const sections = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map(el => [el.dataset.scene, el]));
const gameName = s => (GAMES[s.game] || {}).name || '';

let shown = null;        // scene currently visible
let switching = false;
let lastState = null;

// Accent the last word of a title: "STARTING SOON" -> "STARTING <span>SOON</span>"
function accentLast(text) {
  const w = esc(text).split(' ');
  if (w.length < 2) return `<span>${w[0] || ''}</span>`;
  const last = w.pop();
  return `${w.join(' ')} <span>${last}</span>`;
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mapImg = name => name ? `--mapimg:url('${asset('assets/maps/' + slug(name) + '.jpg')}')` : '';
const side = (s, ab) => team(s, ab === 'A' ? s.match.a : s.match.b);

// ---------------- Scene renderers ----------------
const R = {
  holding(s, now) {
    const m = s.match, A = team(s, m.a), B = team(s, m.b);
    const cd = s.scene.countdownTo > now;
    return `
      <div class="kicker rise">${esc(gameName(s))}</div>
      <div class="big rise d1" style="margin-top:24px">${accentLast(s.scene.title || 'STARTING SOON')}</div>
      ${s.scene.subtitle ? `<div class="sub rise d2">${esc(s.scene.subtitle)}</div>` : ''}
      ${cd ? `<div class="rise d3"><div class="cd"><div class="l">STARTING IN</div><div class="v" data-cd="${s.scene.countdownTo}">--:--</div></div></div>` : ''}
      <div class="next-card rise d4">
        <div class="hd">UP NEXT <span>${esc(m.label)}</span></div>
        <div class="row">
          <div class="tm a">${logoHTML(A)}<span>${esc(A.tag)}</span></div>
          <div class="vs">VS</div>
          <div class="tm b">${logoHTML(B)}<span>${esc(B.tag)}</span></div>
        </div>
      </div>`;
  },

  countdown(s) {
    return `<div>
      <div class="kicker rise">${esc(s.scene.subtitle || 'THE SHOW STARTS IN')}</div>
      <div class="num rise d1" data-cd="${s.scene.countdownTo}" data-cdbar="1">--:--</div>
      <div class="ttl rise d2">${esc(s.scene.title || 'STARTING SOON')}</div>
      <div class="bar rise d3"><i data-bar style="width:0%"></i></div>
    </div>`;
  },

  pause(s) {
    const p = s.pause, type = p.type || 'technical';
    sections.pause.classList.toggle('technical', type === 'technical');
    const t = p.team ? side(s, p.team) : null;
    const title = type === 'technical' ? 'Technical<br>Pause' : 'Tactical<br>Pause';
    const sub = type === 'technical' ? 'We are resolving a technical issue. Play will resume shortly.' : 'A team has called a tactical timeout.';
    return `<div class="stripe"></div>
      <div>
        <div class="icon rise"><i></i><i></i></div>
        <div class="ttl rise d1">${title}</div>
        <div class="sub rise d2">${esc(sub)}</div>
        <div class="meta rise d3">
          ${t && type === 'tactical' ? `<div>${logoHTML(t)}<span>${esc(t.name)}</span></div>` : ''}
          <div class="tm" data-pause>00:00</div>
        </div>
      </div>`;
  },

  intro(s) {
    const g = GAMES[s.game] || GAMES.generic, m = s.match;
    const A = team(s, m.a), B = team(s, m.b);
    const maps = g.hasVeto ? seriesMaps(s.veto.steps || []).filter(x => x.map) : [];
    const sideHTML = (t, cls, pick) => `
      <div class="side ${cls}" style="--tc:${esc(t.color)}">
        <div class="rise d1">${logoHTML(t)}</div>
        <div class="nm rise d2">${esc(t.name)}</div>
        ${pick ? `<div class="pick rise d3">${esc(pick)}</div>` : ''}
        ${t.players ? `<div class="pl rise d3">${esc(t.players).split(',').map(x => x.trim()).join(' · ')}</div>` : ''}
      </div>`;
    return `
      ${sideHTML(A, 'a', g.hasClock ? m.pickA : '')}
      ${sideHTML(B, 'b', g.hasClock ? m.pickB : '')}
      <div class="vs rise d2"><span>VS</span></div>
      <div class="meta rise"><div class="lbl">${esc(m.label)}</div>${m.bestOf > 1 ? `<div class="bo">BEST OF ${m.bestOf}</div>` : ''}</div>
      ${maps.length ? `<div class="maps rise d4">${maps.map(x => {
        const by = x.team ? side(s, x.team) : null;
        return `<div class="mp" style="--tc:${by ? by.color : 'var(--accent)'}"><small>MAP ${x.game} · ${esc(modeName(s.game, x.mode))}</small><b>${esc(x.map)}</b></div>`;
      }).join('')}</div>` : ''}`;
  },

  veto(s) {
    const m = s.match, steps = s.veto.steps || [];
    const A = team(s, m.a), B = team(s, m.b);
    const cur = currentStep(steps);
    const modes = [...new Set(steps.map(x => x.mode))];
    const fresh = new Set();
    steps.forEach((x, i) => { if (x.map && prevFilled && !prevFilled.has(i)) fresh.add(i); });
    prevFilled = new Set(steps.map((x, i) => x.map ? i : -1).filter(i => i >= 0));

    const card = (x, i) => {
      const by = x.team ? side(s, x.team) : null;
      const actLabel = x.act === 'ban' ? 'BAN' : x.act === 'pick' ? 'PICK' : 'DECIDER';
      const cls = [x.map ? x.act : 'empty', i === cur ? 'current' : '', fresh.has(i) ? 'fresh' : ''].join(' ');
      return `<div class="mcard ${cls}" style="${by ? `--tc:${esc(by.color)};` : ''}${mapImg(x.map)}">
        <div class="act ${x.act}">${actLabel}</div>
        ${x.game ? `<div class="gm">MAP ${x.game}</div>` : ''}
        <div class="mp">${esc(x.map || (i === cur ? 'PICKING…' : '—'))}</div>
        <div class="by">${by ? esc(by.name) : 'Last map standing'}</div>
      </div>`;
    };
    const rows = modes.map(md => `
      <div class="mode-row">
        ${modes.length > 1 ? `<div class="ml">${esc(modeName(s.game, md))}</div>` : ''}
        <div class="cards">${steps.map((x, i) => x.mode === md ? card(x, i) : '').join('')}</div>
      </div>`).join('');
    const series = seriesMaps(steps).map(x => {
      const by = x.team ? side(s, x.team) : null;
      return `<div class="vs-row" style="--tc:${by ? esc(by.color) : 'var(--panel2)'}">
        <div class="g">${x.game}</div>
        <div class="info"><div class="mp">${esc(x.map || 'TBD')}</div><div class="md">${esc(modeName(s.game, x.mode))}</div></div>
        <div class="by">${by ? esc(by.tag) : 'DEC'}</div></div>`;
    }).join('');
    return `
      <div class="main">
        <div class="teams">
          <div class="t a">${logoHTML(A)}<span>${esc(A.name)}</span></div>
          <div class="mid"><div class="kicker">${esc(m.label)}</div><div class="h-title">MAP <i>VETO</i></div></div>
          <div class="t b">${logoHTML(B)}<span>${esc(B.name)}</span></div>
        </div>
        <div class="rows">${rows}</div>
      </div>
      <div class="series"><div class="hd">SERIES ORDER</div>${series}</div>`;
  },

  bracket(s) {
    const b = s.bracket || {};
    const sec = b.type === 'double' ? (s.scene.bracketSec || 'UB') : 'UB';
    const compact = sec === 'ALL';
    sections.bracket.classList.toggle('compact', compact);
    const match = x => {
      const ta = team(s, x.a), tb = team(s, x.b);
      const row = (t, sc, me) => `<div class="r ${x.win ? (x.win === me ? 'w' : 'l') : ''} ${t.id ? '' : 'tbd'}" style="--tc:${esc(t.color)}">
        ${t.id ? logoHTML(t) : '<span class="logo"></span>'}<div class="n">${esc(t.id ? t.name : 'TBD')}</div><div class="sc">${esc(sc ?? '')}</div></div>`;
      return `<div class="bm">${row(ta, x.sa, 'a')}${row(tb, x.sb, 'b')}</div>`;
    };
    const cols = (secId) => {
      const rounds = roundsOf(b, secId);
      return rounds.map((r, i) => `<div class="col"><div class="rn">${roundName(b, secId, i + 1, rounds.length)}</div><div class="ms">${r.map(match).join('')}</div></div>`).join('');
    };
    let body;
    if (sec === 'ALL') body = `<div class="sec"><div class="sec-label">UPPER</div>${cols('UB')}${cols('GF')}</div><div class="sec"><div class="sec-label">LOWER</div>${cols('LB')}</div>`;
    else if (sec === 'LB') body = `<div class="sec">${cols('LB')}</div>`;
    else body = `<div class="sec">${cols('UB')}${b.type === 'double' ? cols('GF') : ''}</div>`;
    const sub = b.type === 'double' ? (sec === 'LB' ? 'LOWER BRACKET' : sec === 'ALL' ? 'DOUBLE ELIMINATION' : 'UPPER BRACKET') : 'SINGLE ELIMINATION';
    return `<div class="hdr rise"><div><div class="kicker">${sub}</div><div class="h-title">PLAYOFF <i>BRACKET</i></div></div></div>
      <div class="secs rise d1">${body}</div>`;
  },

  schedule(s) {
    const rows = (s.schedule || []).map((r, i) => {
      const A = team(s, r.a), B = team(s, r.b);
      const hasScore = r.sa !== '' && r.sa != null && r.sb !== '' && r.sb != null;
      const st = r.status === 'live' ? 'LIVE NOW' : r.status === 'done' ? 'FINAL' : 'UPCOMING';
      return `<div class="sr ${r.status} rise d${Math.min(i + 1, 4)}">
        <div class="time">${esc(r.time)}</div>
        <div class="tm a">${logoHTML(A)}<span>${esc(A.name)}</span></div>
        <div class="mid ${hasScore ? 'score' : ''}">${hasScore ? `${esc(r.sa)} - ${esc(r.sb)}` : 'VS'}</div>
        <div class="tm b">${logoHTML(B)}<span>${esc(B.name)}</span></div>
        <div class="lbl"><b>${esc(r.label)}</b><i>${st}</i></div>
      </div>`;
    }).join('');
    return `<div class="rise"><div class="kicker">${esc(gameName(s))}</div><div class="h-title">TODAY'S <i>SCHEDULE</i></div></div><div class="list">${rows}</div>`;
  },

  standings(s) {
    const rows = [...(s.standings || [])]
      .sort((a, b) => (+b.pts || 0) - (+a.pts || 0) || (+b.diff || 0) - (+a.diff || 0))
      .map((r, i) => {
        const t = team(s, r.team);
        const diff = +r.diff || 0;
        return `<div class="st-row rise d${Math.min(i + 1, 4)}" style="--tc:${esc(t.color)}">
          <div class="rk">${i + 1}</div><div class="tm">${logoHTML(t)}<span>${esc(t.name)}</span></div>
          <div class="c">${esc(r.w)}</div><div class="c">${esc(r.l)}</div><div class="c">${diff > 0 ? '+' : ''}${diff}</div><div class="c pts">${esc(r.pts)}</div></div>`;
      }).join('');
    return `<div class="rise"><div class="kicker">${esc(gameName(s))}</div><div class="h-title">${accentStandings(s.standingsTitle)}</div></div>
      <div class="st-table">
        <div class="st-row head"><div class="rk">#</div><div class="tm">TEAM</div><div class="c">W</div><div class="c">L</div><div class="c">DIFF</div><div class="c pts">PTS</div></div>
        ${rows}
      </div>`;
  },

  winner(s) {
    const t = team(s, s.winner.team);
    sections.winner.style.setProperty('--tc', t.color);
    return `<div class="rays"></div><div class="glow"></div><div class="confetti">${confetti}</div>
      <div class="inner">
        <div class="rise">${logoHTML(t)}</div>
        <div class="ttl rise d1">${esc(s.winner.title || 'CHAMPIONS')}</div>
        <div class="nm rise d2">${esc(t.name)}</div>
        ${t.players ? `<div class="pl rise d3">${esc(t.players).split(',').map(x => x.trim()).join(' · ')}</div>` : ''}
      </div>`;
  },
};

let prevFilled = null;
const accentStandings = t => `${esc(t || 'STANDINGS').split(' ').slice(0, -1).join(' ')} <i>${esc((t || 'STANDINGS').split(' ').pop())}</i>`;
const confetti = Array.from({ length: 70 }, (_, i) => {
  const colors = ['var(--accent)', 'var(--accent2)', 'var(--tc)', '#fff'];
  return `<i style="left:${(i * 137) % 100}%;background:${colors[i % 4]};animation-duration:${4 + (i % 7) * .7}s;animation-delay:-${(i * 0.37) % 6}s;opacity:${.5 + (i % 5) / 10}"></i>`;
}).join('');

// ---------------- Frame + switching ----------------
function frame(s) {
  setHTML($('top'), `<div></div><div class="right">${esc(gameName(s))}</div>`);
  // The intro and winner scenes are full-bleed; hide the top frame there.
  $('top').style.display = ['intro', 'winner'].includes(s.scene.active) ? 'none' : '';
}

function paint(s, now, entering = false) {
  const active = s.scene.active;
  frame(s);
  if (entering && sections[active]) {
    // Entry animations play once per scene switch, not on every data update.
    const el = sections[active];
    el.classList.add('enter');
    clearTimeout(el._enterT);
    el._enterT = setTimeout(() => el.classList.remove('enter'), 1400);
  }
  if (R[active]) setHTML(sections[active], R[active](s, now));
  Object.entries(sections).forEach(([k, el]) => el.classList.toggle('on', k === active));
  $('root').classList.toggle('on', !!R[active]);
  tick(s, now);
}

function render(s, now) {
  lastState = s;
  const next = R[s.scene.active] ? s.scene.active : 'none';
  if (shown === null) { shown = next; paint(s, now, true); return; }   // first load: no wipe
  if (next === shown) { if (!switching) paint(s, now); return; }
  shown = next;
  if (next === 'veto') prevFilled = null;
  switching = true;
  const w = $('wipe');
  w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
  setTimeout(() => { switching = false; paint(lastState, Date.now(), true); }, 430);
}

function tick(s, now) {
  document.querySelectorAll('[data-cd]').forEach(el => {
    const left = +el.dataset.cd - now;
    el.textContent = left > 0 ? mmss(left) : '00:00';
    if (el.dataset.cdbar) {
      const total = (s.scene.countdownTotal || 0) * 1000;
      const bar = el.parentElement.querySelector('[data-bar]');
      if (bar && total) bar.style.width = Math.min(100, Math.max(0, 100 - (left / total) * 100)) + '%';
    }
  });
  document.querySelectorAll('[data-pause]').forEach(el => {
    const p = s.pause;
    const elapsed = p.startedAt ? now - p.startedAt : 0;
    const rem = p.limitSec ? p.limitSec * 1000 - elapsed : null;
    el.textContent = rem !== null ? mmss(rem) : mmss(elapsed);
    el.classList.toggle('over', rem !== null && rem < 0);
  });
}

bootOutput(render, tick);
