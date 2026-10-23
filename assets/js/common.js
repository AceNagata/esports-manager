// Shared helpers for output pages and the control panel.
import { CONFIG } from './config.js';

export const ROOT = new URL('../../', import.meta.url);

export function asset(path) {
  if (!path) return '';
  try { return new URL(path, ROOT).href; } catch { return path; }
}

// Push brand colors from config.js into CSS variables.
export function applyTheme() {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(CONFIG.colors)) r.setProperty(`--${k}`, v);
  if (new URLSearchParams(location.search).has('preview')) document.body.classList.add('preview');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function team(state, id) {
  const t = state.teams?.[id];
  return t ? { id, ...t } : { id: '', name: 'TBD', tag: 'TBD', color: '#555B6E', logo: '', players: '' };
}

// Team logo, or a monogram badge in the team color when no logo is set.
export function logoHTML(t, cls = '') {
  if (t.logo) return `<img class="logo ${cls}" src="${esc(asset(t.logo))}" alt="">`;
  return `<div class="logo mono ${cls}" style="--tc:${esc(t.color)}"><span>${esc((t.tag || '?').slice(0, 3))}</span></div>`;
}

export function mmss(ms, showHours = false) {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = n => String(n).padStart(2, '0');
  const body = h || showHours ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return (neg ? '-' : '') + body;
}

export function clockMs(clock, now) {
  if (!clock) return 0;
  return (clock.baseMs || 0) + (clock.running ? Math.max(0, now - (clock.startedAt || 0)) : 0);
}

// Set innerHTML only when it changed, so CSS animations don't restart on every sync.
export function setHTML(el, html) {
  if (el && el._html !== html) { el.innerHTML = html; el._html = html; }
}

export function toggle(el, on) {
  if (!el) return;
  el.classList.toggle('on', !!on);
}

// Scale the 1920x1080 stage to the window (vMix renders at exactly 1920x1080, so this is a no-op there).
export function fitStage(stage) {
  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener('resize', fit); fit();
}

// Boot an output page: theme, stage scaling, live sync, and a 4 Hz tick for clocks and timers.
export async function bootOutput(render, tick) {
  applyTheme();
  fitStage(document.querySelector('.stage'));
  const { connectShow } = await import('./sync.js');
  let state = null, show = null;
  const now = () => (show ? show.now() : Date.now());
  show = await connectShow(s => { state = s; render(s, now()); });
  if (tick) setInterval(() => state && tick(state, now()), 250);
  return show;
}

export function seriesTarget(bestOf) {
  return Math.ceil((bestOf || 1) / 2);
}
