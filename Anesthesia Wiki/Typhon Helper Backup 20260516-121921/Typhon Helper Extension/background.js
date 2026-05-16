// Background service worker — handles external messages from the web app
// so the web app (already signed in) can sync items into chrome.storage.local.

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'syncItems' && Array.isArray(msg.items)) {
    chrome.storage.local.set({ 'typhon-items': msg.items }, () => {
      console.log('[bg] Synced', msg.items.length, 'items from web app');
      sendResponse({ ok: true, count: msg.items.length });
    });
    return true; // keep channel open for async response
  }
});

// ---- Firestore REST sync ----
// Called after content.js marks an item submitted in chrome.storage.
// Mirrors the change to Firestore so the web app reflects the submitted state.

function _toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(_toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      fields[k] = _toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

async function _getValidToken(auth) {
  const AGE_LIMIT = 55 * 60 * 1000; // 55 minutes — refresh before 60-min expiry
  if (auth.idToken && auth.tokenTs && (Date.now() - auth.tokenTs) < AGE_LIMIT) {
    return auth.idToken;
  }
  if (!auth.refreshToken) return null;
  const apiKey = 'AIzaSyC64NnAB0rH9Ne5gFINhaFSbqkJ4ygYZfY';
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.id_token;
    if (newToken) {
      await new Promise(r => chrome.storage.local.set({
        'typhon-auth': { ...auth, idToken: newToken, tokenTs: Date.now(), refreshToken: data.refresh_token || auth.refreshToken }
      }, r));
    }
    return newToken || null;
  } catch (e) {
    console.warn('[bg] Token refresh failed:', e);
    return null;
  }
}

async function _syncItemsToFirestore(items) {
  const auth = await new Promise(r => chrome.storage.local.get('typhon-auth', d => r(d['typhon-auth'] || null)));
  if (!auth || !auth.uid) {
    console.log('[bg] No auth — skipping Firestore sync');
    return;
  }
  const token = await _getValidToken(auth);
  if (!token) {
    console.warn('[bg] Could not obtain valid token — skipping Firestore sync');
    return;
  }
  const url = `https://firestore.googleapis.com/v1/projects/anesthesia-wiki-saved-files/databases/(default)/documents/typhonCases/${auth.uid}?updateMask.fieldPaths=typhon-items`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { 'typhon-items': _toFirestoreValue(items) } })
  });
  if (res.ok) {
    console.log('[bg] Firestore sync success:', items.length, 'items');
  } else {
    const txt = await res.text().catch(() => res.status);
    console.warn('[bg] Firestore sync failed:', res.status, txt);
  }
}

// Internal messages from content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'firestoreSync' && Array.isArray(msg.items)) {
    _syncItemsToFirestore(msg.items)
      .then(() => sendResponse({ ok: true }))
      .catch(e => { console.error('[bg] firestoreSync error:', e); sendResponse({ ok: false }); });
    return true; // keep channel open for async response
  }
});
