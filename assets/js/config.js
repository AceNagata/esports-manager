// ============================================================
//  ESPORTS MANAGER CONFIG
//  Team colors and logos are set in the control panel (Match and Teams tabs).
// ============================================================

export const CONFIG = {
  // Interface colors for the graphics (highlights, backgrounds). Hex values only.
  colors: {
    accent: '#FFB800',      // highlights, bars, live states
    accent2: '#00D1FF',     // secondary highlight
    bg: '#0B0D12',          // darkest background
    panel: '#141821',       // panel/card background
    panel2: '#1C2130',      // raised panel
    text: '#F4F6FA',
    muted: '#8A93A6',
  },

  // ---- Live sync (Firebase Realtime Database) -------------
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
