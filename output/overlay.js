import { bootOutput, team, logoHTML, setHTML, toggle, esc, mmss, clockMs, seriesTarget } from '../assets/js/common.js';
import { GAMES, seriesMaps, modeName } from '../assets/js/games.js';

const $ = id => document.getElementById(id);
const prevScore = { a: null, b: null };

function teamBlock(el, side, t, score, showScore) {
  el.style.setProperty('--tc', t.color);
  setHTML(el.querySelector('[data-f=logo]'), logoHTML(t));
  el.querySelector('[data-f=tag]').textContent = t.tag;
  el.querySelector('[data-f=nm]').textContent = t.name;
  const sc = el.querySelector('[data-f=score]');
  sc.style.display = showScore ? '' : 'none';
  if (prevScore[side] !== null && prevScore[side] !== score) {
    sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
  }
  prevScore[side] = score;
  sc.textContent = score;
}

function pips(el, won, target, color) {
  el.style.setProperty('--tc', color);
  el.parentElement.style.display = target > 1 ? '' : 'none';
  let html = '';
  for (let i = 0; i < target; i++) html += `<i class="pip ${i < won ? 'won' : ''}"></i>`;
  setHTML(el, html);
}

function render(s, now) {
  const g = GAMES[s.game] || GAMES.generic;
  const m = s.match;
  const A = team(s, m.a), B = team(s, m.b);
  const ov = s.overlay;

  // ---- Scorebug
  toggle($('sb'), ov.scorebug);
  const showScore = g.hasClock || m.showMapScore;
  teamBlock($('sbA'), 'a', A, m.scoreA, showScore);
  teamBlock($('sbB'), 'b', B, m.scoreB, showScore);
  const target = seriesTarget(m.bestOf);
  pips($('pipsA'), m.seriesA, target, A.color);
  pips($('pipsB'), m.seriesB, target, B.color);

  let label = `${esc(m.label)}`;
  if (m.bestOf > 1) label += ` · <b>BO${m.bestOf}</b>`;
  if (g.hasClock && m.agg?.on) label += ` · AGG <b>${m.agg.a}-${m.agg.b}</b>`;
  setHTML($('sbLabel'), label);
  tick(s, now);

  // ---- Series maps strip
  const maps = g.hasVeto ? seriesMaps(s.veto.steps || []) : [];
  toggle($('vstrip'), ov.vetoStrip && maps.length);
  setHTML($('vstrip'), `<div class="hd">SERIES · BO${m.bestOf}</div>` + maps.map(st => {
    const by = st.team ? team(s, st.team === 'A' ? m.a : m.b) : null;
    const cls = st.game === m.mapNo ? 'current' : st.game < m.mapNo ? 'done' : '';
    return `<div class="vs-row ${cls}" style="--tc:${by ? by.color : 'var(--panel2)'}">
      <div class="g">${st.game}</div>
      <div class="info"><div class="mp">${esc(st.map || 'TBD')}</div><div class="md">${esc(modeName(s.game, st.mode))}</div></div>
      <div class="by">${by ? esc(by.tag) : 'DEC'}</div></div>`;
  }).join(''));

  // ---- Pause banner
  const p = s.pause;
  const pb = $('pause');
  pb.classList.toggle('technical', p.type === 'technical');
  toggle(pb, p.type && p.banner);
  $('pauseKind').textContent = p.type === 'technical' ? 'Technical Pause' : 'Tactical Pause';
  const pt = p.team ? team(s, p.team === 'A' ? m.a : m.b) : null;
  $('pauseWho').style.display = pt && p.type === 'tactical' ? '' : 'none';
  if (pt) setHTML($('pauseWho'), `${logoHTML(pt)}<span>${esc(pt.name)}</span>`);

  // ---- Lower third
  toggle($('l3'), s.lowerThird.visible);
  $('l3t').textContent = s.lowerThird.title;
  $('l3s').textContent = s.lowerThird.subtitle;
  $('l3s').style.display = s.lowerThird.subtitle ? '' : 'none';

  // ---- Ticker
  toggle($('ticker'), ov.ticker);
  setHTML($('tkLabel'), `<span>LIVE</span>`);
  const txt = s.ticker.text || '';
  if ($('tkText').textContent !== txt) {
    $('tkText').textContent = txt;
    $('tkText').style.setProperty('--dur', Math.max(18, txt.length * 0.22) + 's');
  }
}

// Timers: match clock, pause timer.
function tick(s, now) {
  const g = GAMES[s.game] || GAMES.generic;
  const m = s.match;
  if (g.hasClock) {
    $('sbBig').classList.remove('map');
    $('sbBig').textContent = mmss(clockMs(m.clock, now));
    $('sbSmall').textContent = m.period;
  } else {
    const cur = seriesMaps(s.veto.steps || []).find(x => x.game === m.mapNo);
    $('sbBig').classList.toggle('map', true);
    $('sbBig').textContent = cur?.map || `MAP ${m.mapNo}`;
    $('sbSmall').textContent = cur ? `MAP ${m.mapNo} · ${modeName(s.game, cur.mode)}` : `MAP ${m.mapNo}`;
  }
  const p = s.pause;
  if (p.type) {
    const el = now - (p.startedAt || now);
    const remaining = p.limitSec ? p.limitSec * 1000 - el : null;
    $('pauseTm').textContent = remaining !== null ? mmss(Math.max(remaining, -5999000)) : mmss(el);
    $('pauseTm').classList.toggle('over', remaining !== null && remaining < 0);
  }
}

bootOutput(render, tick);
