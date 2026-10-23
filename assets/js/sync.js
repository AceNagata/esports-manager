// Live state sync. Uses Firebase Realtime Database when configured, otherwise
// LOCAL mode (localStorage + BroadcastChannel) which syncs tabs of the same browser only.
import { CONFIG } from './config.js';
import { defaultState, normalize, setPath } from './state.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LS_KEY = 'esports-overlay:' + CONFIG.showPath;

export async function connectShow(onChange) {
  const useFirebase = !!(CONFIG.firebase.apiKey && CONFIG.firebase.databaseURL);
  return useFirebase ? firebaseShow(onChange) : localShow(onChange);
}

// ---------------- Firebase ----------------
async function firebaseShow(onChange) {
  const [{ initializeApp }, db, auth] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-database.js'),
    import(FB + 'firebase-auth.js'),
  ]);
  const app = initializeApp(CONFIG.firebase);
  const database = db.getDatabase(app);
  const fbAuth = auth.getAuth(app);
  const root = db.ref(database, CONFIG.showPath);

  let offset = 0;
  let state = defaultState();
  let empty = false;
  const listeners = { status: () => {}, auth: () => {} };

  db.onValue(db.ref(database, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  db.onValue(db.ref(database, '.info/connected'), s => listeners.status(s.val() ? 'online' : 'offline'));
  db.onValue(root, snap => {
    empty = !snap.exists();
    state = normalize(snap.val());
    onChange(state);
  });
  auth.onAuthStateChanged(fbAuth, u => listeners.auth(u));

  return {
    mode: 'firebase',
    get state() { return state; },
    get isEmpty() { return empty; },
    now: () => Date.now() + offset,
    update: (patch) => db.update(root, patch),
    replace: (next) => db.set(root, next),
    onStatus: (fn) => { listeners.status = fn; },
    onAuth: (fn) => { listeners.auth = fn; fn(fbAuth.currentUser); },
    signIn: (email, pass) => auth.signInWithEmailAndPassword(fbAuth, email, pass),
    signOut: () => auth.signOut(fbAuth),
  };
}

// ---------------- Local ----------------
function localShow(onChange) {
  const ch = new BroadcastChannel(LS_KEY);
  const read = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } };
  const write = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };
  let raw = read();
  let state = normalize(raw);

  const emit = () => { state = normalize(raw); onChange(state); };
  ch.onmessage = () => { raw = read(); emit(); };
  window.addEventListener('storage', e => { if (e.key === LS_KEY) { raw = read(); emit(); } });
  queueMicrotask(emit);

  const commit = () => { write(raw); ch.postMessage(1); emit(); };

  return {
    mode: 'local',
    get state() { return state; },
    get isEmpty() { return raw == null; },
    now: () => Date.now(),
    update: async (patch) => {
      raw = JSON.parse(JSON.stringify(state));
      for (const [p, v] of Object.entries(patch)) setPath(raw, p, v);
      commit();
    },
    replace: async (next) => { raw = JSON.parse(JSON.stringify(next)); commit(); },
    onStatus: (fn) => fn('local'),
    onAuth: (fn) => fn({ email: 'local mode' }),
    signIn: async () => {},
    signOut: async () => {},
  };
}
