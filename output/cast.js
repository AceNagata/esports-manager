import { bootOutput, team, logoHTML, setHTML, esc } from '../assets/js/common.js';

// Camera windows (x, y, w, h) in 1920x1080 pixels. Position your camera inputs in vMix to match these.
export const CAM_RECTS = {
  1: [[360, 170, 1200, 675]],
  2: [[90, 250, 840, 473], [990, 250, 840, 473]],
  3: [[48, 300, 576, 324], [672, 300, 576, 324], [1296, 300, 576, 324]],
};

function render(s) {
  const c = s.cast;
  const rects = CAM_RECTS[c.layout];
  const root = document.getElementById('root');
  root.classList.toggle('on', !!rects);
  if (!rects) return;

  // Background with transparent holes where the cameras go
  const holes = rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('');
  const m = s.match, A = team(s, m.a), B = team(s, m.b);
  const casters = c.casters || [];

  setHTML(root, `
    <svg class="bgmask" viewBox="0 0 1920 1080" width="1920" height="1080">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:var(--panel)"/><stop offset="1" style="stop-color:var(--bg)"/>
        </linearGradient>
        <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width="2" height="48" fill="rgba(255,255,255,.03)"/>
        </pattern>
      </defs>
      <path fill-rule="evenodd" fill="url(#g)" d="M0 0H1920V1080H0Z${holes}"/>
      <path fill-rule="evenodd" fill="url(#p)" d="M0 0H1920V1080H0Z${holes}"/>
    </svg>
    <div class="cast-top" style="justify-content:center">
      <div class="ttl">${esc(c.title || m.label)}</div>
    </div>
    ${rects.map(([x, y, w, h], i) => {
      const cs = casters[i] || {};
      return `<div class="camframe" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
        <div class="bd"></div>
        ${cs.name ? `<div class="np"><div class="n">${esc(cs.name)}</div>${cs.handle ? `<div class="h">${esc(cs.handle)}</div>` : ''}</div>` : ''}
      </div>`;
    }).join('')}
    ${c.showNext ? `<div class="cast-next"><div class="l">UP NEXT</div>
      <div class="m">${logoHTML(A)}<span>${esc(A.name)}</span><span class="v">VS</span><span>${esc(B.name)}</span>${logoHTML(B)}</div></div>` : ''}
  `);
}

bootOutput(render);
