// ============================================================
//  TOURNAMENT CONFIG: the only file you need to edit.
// ============================================================

export const CONFIG = {
  // ---- Branding -------------------------------------------
  tournament: {
    name: 'TOURNAMENT NAME',
    short: 'TN',                       // used where space is tight
    season: 'SEASON 1 · 2026',
    logo: '',                           // e.g. 'assets/logos/tournament.png' (leave empty for text logo)
    hashtag: '#TOURNAMENT',
    website: 'yourtournament.gg',
  },

  // Colors drive the entire look. Hex values only.
  colors: {
    accent: '#FFB800',      // main brand color (highlights, bars, live states)
    accent2: '#00D1FF',     // secondary brand color
    bg: '#0B0D12',          // darkest background
    panel: '#141821',       // panel/card background
    panel2: '#1C2130',      // raised panel
    text: '#F4F6FA',
    muted: '#8A93A6',
  },

  // Sponsor logos that rotate in the corner bug (paths or URLs)
  sponsors: [
    // 'assets/logos/sponsor1.png',
  ],

  // ---- Live sync (Firebase Realtime Database) -------------
  // Paste the web app config from Firebase console → Project settings → Your apps.
  // Leave apiKey empty to run in LOCAL mode (syncs only between tabs of the same browser).
  firebase: {
    apiKey: 'AIzaSyCrlvn4yPvYPR4Q76fiByP5Ac7GX8AmyTE',
    authDomain: 'esports-manager-baadb.firebaseapp.com',
    databaseURL: 'https://esports-manager-baadb-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'esports-manager-baadb',
    appId: '1:385284823902:web:fbad44f8a38d1707adcdcf',
  },

  // Database path. Change it to run several shows from one Firebase project, e.g. 'show-stage2'.
  showPath: 'show',
};
