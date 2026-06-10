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

const FIREBASE_PROJECT = 'anesthesia-wiki-saved-files';
const FIREBASE_API_KEY = 'AIzaSyCDTAFoQavaUvw2MJnobdn50LmKgSBItsw';
const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token?key=' + FIREBASE_API_KEY;
const IDPTOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' + FIREBASE_API_KEY;

function firestoreValueToJs(val) {
  if (val.stringValue  !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue  !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue    !== undefined) return null;
  if (val.arrayValue)  return (val.arrayValue.values || []).map(firestoreValueToJs);
  if (val.mapValue)    return firestoreFieldsToObj(val.mapValue.fields || {});
  return undefined;
}
function firestoreFieldsToObj(fields) {
  const out = {};
  for (const [key, val] of Object.entries(fields)) out[key] = firestoreValueToJs(val);
  return out;
}

function jsToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = jsToFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Returns a valid Firebase { idToken, uid }, trying three paths in order:
//   1. Cached typhon-auth (if token still fresh)
//   2. Refresh-token exchange (if stored refreshToken is valid)
//   3. chrome.identity (Google account already signed into Chrome) → Firebase signInWithIdp
async function getValidFirebaseToken() {
  const data = await new Promise(r => chrome.storage.local.get(['typhon-auth'], r));
  const auth = data['typhon-auth'];

  if (auth && auth.uid && auth.idToken) {
    // Path 1: token still fresh
    if (Date.now() < (auth.expiresAt || 0) - 60000) {
      return { idToken: auth.idToken, uid: auth.uid };
    }
    // Path 2: refresh token exchange
    if (auth.refreshToken) {
      try {
        const r = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken)
        });
        if (r.ok) {
          const t = await r.json();
          const newAuth = Object.assign({}, auth, {
            idToken: t.id_token, refreshToken: t.refresh_token || auth.refreshToken,
            tokenTs: Date.now(), expiresAt: Date.now() + (parseInt(t.expires_in, 10) || 3600) * 1000
          });
          chrome.storage.local.set({ 'typhon-auth': newAuth });
          return { idToken: t.id_token, uid: auth.uid };
        }
      } catch (e) { console.warn('[bg] Refresh token failed:', e.message); }
    }
  }

  // Path 3: exchange the Google account already signed into Chrome for a Firebase token.
  // chrome.identity.getAuthToken uses the extension's OAuth2 client_id — no user prompt needed
  // if the user is already signed into Chrome with a Google account.
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, async (googleAccessToken) => {
      if (chrome.runtime.lastError || !googleAccessToken) {
        reject(new Error(chrome.runtime.lastError?.message || 'chrome.identity: no token'));
        return;
      }
      try {
        const r = await fetch(IDPTOOLKIT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postBody: 'access_token=' + googleAccessToken + '&providerId=google.com',
            requestUri: 'http://localhost',
            returnIdpCredential: true,
            returnSecureToken: true
          })
        });
        if (!r.ok) throw new Error('signInWithIdp HTTP ' + r.status);
        const t = await r.json();
        const newAuth = {
          uid: t.localId, email: t.email || '',
          idToken: t.idToken, refreshToken: t.refreshToken,
          tokenTs: Date.now(), expiresAt: Date.now() + (parseInt(t.expiresIn, 10) || 3600) * 1000
        };
        chrome.storage.local.set({ 'typhon-auth': newAuth });
        resolve({ idToken: t.idToken, uid: t.localId });
      } catch (e) { reject(e); }
    });
  });
}

async function writeItemsToFirestore(items) {
  try {
    const { idToken, uid } = await getValidFirebaseToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/typhonCases/${uid}?updateMask.fieldPaths=typhon-items`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + idToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'typhon-items': jsToFirestoreValue(items) } })
    });
    if (!resp.ok) console.warn('[bg] writeItemsToFirestore PATCH failed:', resp.status);
    return resp.ok;
  } catch (e) {
    console.warn('[bg] writeItemsToFirestore failed:', e.message);
    return false;
  }
}

// Handle syncSubmitted message from content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'syncSubmittedToFirestore' && Array.isArray(msg.items)) {
    writeItemsToFirestore(msg.items).then(ok => sendResponse({ ok }));
    return true;
  }
});

async function refreshItemsFromFirestore(tabId) {
  const oldData = await new Promise(r => chrome.storage.local.get(['typhon-items'], r));
  const oldItems = oldData['typhon-items'] || [];
  const oldPending = oldItems.filter(i => !i.submitted).length;

  try {
    return await new Promise(resolve => {
      (async () => {
        let idToken, uid;
        try {
          ({ idToken, uid } = await getValidFirebaseToken());
        } catch (e) {
          console.warn('[bg] refreshItemsFromFirestore: no auth:', e.message);
          resolve(false); return;
        }

        const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/typhonCases/${uid}`;
        const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + idToken } });
        if (!resp.ok) {
          if (tabId) chrome.tabs.sendMessage(tabId, { action: 'showToast', message: '⚠️ Typhon Case Helper couldn\'t auto-update. Click the extension icon to get the latest items.' });
          resolve(false);
        } else {
          const json = await resp.json();
          const rawField = json.fields?.['typhon-items'];
          if (rawField?.arrayValue?.values) {
            const items = rawField.arrayValue.values.map(v => firestoreFieldsToObj(v.mapValue?.fields || {}));
            // Preserve any submitted:true flags set locally but not yet synced to Firestore
            const localSubmittedIds = new Set(
              oldItems.filter(i => i.submitted).map(i => i.id).filter(Boolean)
            );
            const merged = items.map(item => {
              if (!item.submitted && item.id && localSubmittedIds.has(item.id)) {
                return Object.assign({}, item, { submitted: true });
              }
              return item;
            });
            chrome.storage.local.set({ 'typhon-items': merged });
            const newPending = merged.filter(i => !i.submitted).length;
            console.log('[bg] Auto-refreshed', items.length, 'items on Typhon page load');
            if (tabId && newPending > oldPending) {
              const diff = newPending - oldPending;
              const label = diff === 1 ? '1 new item' : diff + ' new items';
              chrome.tabs.sendMessage(tabId, { action: 'showToast', message: '📋 Typhon Case Helper: ' + label + ' ready to log. Click the extension icon.' });
            } else if (tabId && newPending > 0 && newPending !== oldPending) {
              chrome.tabs.sendMessage(tabId, { action: 'showToast', message: '📋 Typhon Case Helper: ' + newPending + ' item' + (newPending === 1 ? '' : 's') + ' ready to log.' });
            }
            resolve(true);
            return;
          }
          resolve(false);
        }
      })();
    });
  } catch (e) {
    console.warn('[bg] Auto-refresh failed:', e.message);
    if (tabId) chrome.tabs.sendMessage(tabId, { action: 'showToast', message: '⚠️ Typhon Case Helper couldn\'t auto-update. Click the extension icon to get the latest items.' });
    return false;
  }
}

// Auto-refresh items whenever a Typhon page finishes loading (main frame only)
chrome.webNavigation.onCompleted.addListener(details => {
  if (details.frameId === 0) refreshItemsFromFirestore(details.tabId);
}, {
  url: [
    { hostSuffix: 'typhon.net' },
    { hostSuffix: 'typhongroup.net' }
  ]
});
