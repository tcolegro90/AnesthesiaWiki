// ============================================================
// STORAGE — priority: chrome.storage > Firestore > localStorage
// ============================================================

// Shared pager state — declared here as var so all modules can access them.
var casePager = null;
var evalPager = null;

// Lazy-init Firestore. Returns the db instance or null.
let _db = null;
let _colName = 'typhonCases';
function getFirestore() {
  if (_db) return _db;
  try {
    const cfg = window.TYPHON_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) {
      console.error('[getFirestore] No Firebase config found');
      return null;
    }
    _colName = cfg.collectionName || 'typhonCases';
    console.log('[getFirestore] Initializing Firestore for project:', cfg.projectId);
    // Re-use existing Firebase app if already initialized (same project).
    let app;
    if (firebase.apps && firebase.apps.length) {
      app = firebase.apps[0];
      console.log('[getFirestore] Using existing Firebase app');
    } else {
      app = firebase.initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId
      }, 'typhon');
      console.log('[getFirestore] Initialized new Firebase app');
    }
    _db = firebase.firestore(app);
    console.log('[getFirestore] Firestore ready, collection:', _colName);
    return _db;
  } catch (e) {
    console.error('[getFirestore] Fatal error:', e);
    return null;
  }
}

// Get current Firebase Auth UID (web/extension with auth), else null.
function _getAuthUid() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
      const app = firebase.apps[0];
      const auth = firebase.auth(app);
      const uid = auth.currentUser?.uid || null;
      if (uid !== __lastLoggedUid) {
        console.log(`[_getAuthUid] Current user:`, uid);
        __lastLoggedUid = uid;
      }
      return uid;
    }
  } catch {}
  return null;
}
let __lastLoggedUid = null;
const _evalShareCol = 'typhonEvalShares';
let _activePreceptorToken = null;
let _cloudSyncWarningEl = null;

function ensureCloudSyncWarningBanner() {
  if (_cloudSyncWarningEl && _cloudSyncWarningEl.parentNode) return _cloudSyncWarningEl;
  const existing = document.getElementById('cloud-sync-warning-banner');
  if (existing) {
    _cloudSyncWarningEl = existing;
    return existing;
  }
  const el = document.createElement('div');
  el.id = 'cloud-sync-warning-banner';
  el.style.display = 'none';
  el.style.background = '#fff4e5';
  el.style.borderBottom = '1px solid #f2c078';
  el.style.color = '#8a4b08';
  el.style.fontSize = '0.82em';
  el.style.fontWeight = '700';
  el.style.padding = '8px 14px';
  el.style.lineHeight = '1.35';
  el.textContent = 'Cloud sync issue: currently saving on this device only.';

  const authBar = document.getElementById('ext-auth-bar');
  if (authBar && authBar.parentNode) {
    authBar.parentNode.insertBefore(el, authBar.nextSibling);
  } else {
    document.body.insertBefore(el, document.body.firstChild);
  }

  _cloudSyncWarningEl = el;
  return el;
}

function showCloudSyncWarning(message) {
  const el = ensureCloudSyncWarningBanner();
  if (!el) return;
  el.textContent = message || 'Cloud sync issue: currently saving on this device only.';
  el.style.display = 'block';
}

function hideCloudSyncWarning() {
  const el = ensureCloudSyncWarningBanner();
  if (!el) return;
  el.style.display = 'none';
}

var store = {
  async get(key) {
    // 1. Chrome extension storage + Firestore (cloud-first when signed in)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const uid = _getAuthUid();

      // Signed in: prefer Firestore so phone -> desktop sync appears immediately.
      if (uid) {
        const db = getFirestore();
        if (db) {
          try {
            console.log(`[store.get] Fetching from Firestore: ${_colName}/${uid}`);
            const snap = await db.collection(_colName).doc(uid).get();
            if (snap.exists) {
              const data = snap.data()[key] ?? null;
              console.log(`[store.get] Firestore returned:`, data ? 'data found' : 'null');
              // Cache it in chrome.storage for next time
              if (data !== null) {
                chrome.storage.local.set({ [key]: data });
                return data;
              }
            } else {
              console.log(`[store.get] Firestore doc does not exist`);
            }
          } catch (e) { console.error('Firestore fallback get failed', e); }
        } else {
          console.warn('[store.get] Firestore unavailable');
        }
      }

      // Not signed in, or Firestore miss/failure: fall back to local cache.
      const result = await new Promise(r => chrome.storage.local.get(key, d => r(d[key] ?? null)));
      if (result !== null) {
        console.log(`[store.get] Found in chrome.storage:`, key);
        return result;
      }
      console.log(`[store.get] No value in Firestore or chrome.storage for "${key}"`);
      return null;
    }
    // 2. Firestore — UID-scoped when signed in, 'default' as anonymous fallback
    const db = getFirestore();
    if (db) {
      try {
        const docId = _getAuthUid() || 'default';
        const snap = await db.collection(_colName).doc(docId).get();
        if (snap.exists) return snap.data()[key] ?? null;
        return null;
      } catch (e) { console.warn('Firestore get failed, using localStorage', e); }
    }
    // 3. localStorage fallback
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  async set(key, val) {
    // 1. Chrome extension storage — also mirror to Firestore if signed in (cross-device sync)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(r => chrome.storage.local.set({ [key]: val }, r));
      const db = getFirestore();
      const uid = _getAuthUid();
      if (db && uid) {
        try {
          await db.collection(_colName).doc(uid).set({ [key]: val }, { merge: true });
          console.log(`[store.set] Firestore sync: ${_colName}/${uid}`);
          return { local: true, cloud: true, mode: 'chrome+firestore' };
        } catch (e) {
          console.error('Firestore background sync failed:', e.code, e.message);
          return { local: true, cloud: false, mode: 'chrome', error: e?.code || e?.message || 'firestore-sync-failed' };
        }
      }
      return { local: true, cloud: false, mode: 'chrome' };
    }
    // 2. Firestore — UID-scoped
    const db = getFirestore();
    if (db) {
      try {
        const docId = _getAuthUid() || 'default';
        console.log(`[store.set] Writing to Firestore: ${_colName}/${docId}`);
        await db.collection(_colName).doc(docId).set({ [key]: val }, { merge: true });
        console.log(`[store.set] Firestore write succeeded`);
        localStorage.setItem(key, JSON.stringify(val));
        return { local: true, cloud: true, mode: 'firestore' };
      } catch (e) { 
        console.error('[store.set] Firestore write failed:', e.code, e.message);
        console.warn('Firestore set failed, using localStorage fallback', e); 
        localStorage.setItem(key, JSON.stringify(val));
        return { local: true, cloud: false, mode: 'localStorage', error: e?.code || e?.message || 'firestore-write-failed' };
      }
    }
    // 3. localStorage fallback
    console.log(`[store.set] Using localStorage fallback for "${key}"`);
    localStorage.setItem(key, JSON.stringify(val));
    return { local: true, cloud: false, mode: 'localStorage', error: 'firestore-unavailable' };
  }
};

