// popup.js — runs inside the extension popup

let currentPageType = 'unknown';
let pendingItems = [];

function getAllFrames(tabId) {
  return new Promise(resolve => {
    if (!chrome.webNavigation || !chrome.webNavigation.getAllFrames) {
      resolve([]);
      return;
    }
    chrome.webNavigation.getAllFrames({ tabId }, frames => resolve(frames || []));
  });
}

function sendToFrame(tabId, frameId, message) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, { frameId }, response => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendToAnyFrame(tabId, message, opts = {}) {
  const requireSuccess = !!opts.requireSuccess;
  const frames = prioritizeFrames(await getAllFrames(tabId));
  let firstResponse = null;
  for (const frame of frames) {
    const response = await sendToFrame(tabId, frame.frameId, message);
    if (!response) continue;
    if (!firstResponse) firstResponse = response;
    if (!requireSuccess || response.success) return response;
  }

  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, r => {
      if (chrome.runtime.lastError) {
        resolve(firstResponse);
      } else if (!r) {
        resolve(firstResponse);
      } else if (!requireSuccess || r.success) {
        resolve(r);
      } else {
        resolve(firstResponse || r);
      }
    });
  });
}

function prioritizeFrames(frames) {
  const score = frame => {
    const url = (frame?.url || '').toLowerCase();
    if (url.includes('/nast/data/data2.asp')) return 100;
    if (url.includes('evaluation') || url.includes('eval')) return 95;
    if (url.includes('caselog') || url.includes('case_log') || url.includes('casedata')) return 90;
    if (url.includes('timelog') || url.includes('time_log')) return 80;
    if (url.includes('typhon.net') || url.includes('typhongroup.net')) return 40;
    return 0;
  };
  return [...frames].sort((a, b) => score(b) - score(a));
}

async function detectPageTypeAcrossFrames(tabId) {
  const frames = prioritizeFrames(await getAllFrames(tabId));

  for (const frame of frames) {
    const response = await sendToFrame(tabId, frame.frameId, { action: 'getPageType' });
    if (response?.pageType && response.pageType !== 'unknown') {
      return response.pageType;
    }
  }

  // Fallback: legacy top-frame call
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'getPageType' }, r => {
      if (chrome.runtime.lastError) resolve('unknown');
      else resolve(r?.pageType || 'unknown');
    });
  });
}

function openApp() {
  chrome.tabs.create({ url: 'https://courtstatus.gear.host/Typhon%20Helper/TyphonCaseHelper.html?v=20260424c' });
}

function fmtDate(iso) {
  if (!iso) return '?';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

const FIREBASE_API_KEY = 'AIzaSyCDTAFoQavaUvw2MJnobdn50LmKgSBItsw';
const FIREBASE_PROJECT = 'anesthesia-wiki-saved-files';

async function signInWithGoogle() {
  // Step 1: Get Google access token via Chrome's native auth (uses logged-in Chrome profile)
  const accessToken = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });

  // Step 2: Exchange Google access token for Firebase ID + refresh token
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }
  const json = await resp.json();
  const idToken = json.idToken;
  const refreshToken = json.refreshToken;
  const uid = json.localId;
  const email = json.email || '';

  // Step 3: Store in chrome.storage.local
  await new Promise(r => chrome.storage.local.set({
    'typhon-auth': { uid, email, idToken, tokenTs: Date.now(), refreshToken, expiresAt: Date.now() + 3600000 }
  }, r));

  return { uid, email, idToken, refreshToken };
}

async function getValidIdToken(auth, diagFn) {
  const TOKEN_MAX_AGE = 55 * 60 * 1000;
  // Token still fresh
  if (auth && auth.idToken && (Date.now() - (auth.tokenTs || 0)) < TOKEN_MAX_AGE) {
    diagFn && diagFn(`✓ Token fresh (${Math.round((Date.now() - auth.tokenTs) / 60000)}m old)`);
    return auth.idToken;
  }
  // Exchange refresh token for new ID token
  if (auth && auth.refreshToken) {
    diagFn && diagFn(`⟳ Token expired — exchanging refresh token...`);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`,
        signal: controller.signal
      });
      clearTimeout(tid);
      if (resp.ok) {
        const json = await resp.json();
        const newToken = json.id_token;
        const newRefresh = json.refresh_token || auth.refreshToken;
        await new Promise(r => chrome.storage.local.set({
          'typhon-auth': { ...auth, idToken: newToken, tokenTs: Date.now(), refreshToken: newRefresh, expiresAt: Date.now() + 3600000 }
        }, r));
        diagFn && diagFn(`✓ Token refreshed silently`);
        return newToken;
      } else {
        const txt = await resp.text();
        diagFn && diagFn(`⚠ Token refresh failed HTTP ${resp.status}: ${txt.slice(0, 80)}`);
      }
    } catch (e) {
      diagFn && diagFn(`⚠ Token refresh error: ${e.message}`);
    }
  }
  return null;
}


async function loadItems() {
  return new Promise(resolve => {
    chrome.storage.local.get(['typhon-auth', 'typhon-items'], async data => {
      const auth = data['typhon-auth'];
      const cached = data['typhon-items'] || [];

      if (auth && (auth.idToken || auth.refreshToken) && auth.uid) {
        try {
          const idToken = await getValidIdToken(auth, null);
          if (!idToken) { resolve(cached); return; }
          const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/typhonCases/${auth.uid}`;
          const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + idToken } });
          if (resp.ok) {
            const json = await resp.json();
            const rawField = json.fields?.['typhon-items'];
            if (rawField?.arrayValue?.values) {
              const items = rawField.arrayValue.values.map(v => firestoreFieldsToObj(v.mapValue?.fields || {}));
              // Preserve any submitted:true set locally but not yet synced to Firestore
              const localSubmittedIds = new Set(
                cached.filter(i => i.submitted).map(i => i.id).filter(Boolean)
              );
              const merged = items.map(item =>
                (!item.submitted && item.id && localSubmittedIds.has(item.id))
                  ? Object.assign({}, item, { submitted: true })
                  : item
              );
              chrome.storage.local.set({ 'typhon-items': merged });
              resolve(merged);
              return;
            }
          }
        } catch (e) { /* fall through to cache */ }
      }

      resolve(cached);
    });
  });
}

// Convert a Firestore REST mapValue fields object to a plain JS object
function firestoreFieldsToObj(fields) {
  const out = {};
  for (const [key, val] of Object.entries(fields)) {
    out[key] = firestoreValueToJs(val);
  }
  return out;
}
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

async function fillItem(itemIndex) {
  const item = pendingItems[itemIndex];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const el = document.getElementById('fill-result');
  el.style.display = 'block';

  // On the main menu, clicking Fill navigates to the correct Typhon section.
  if (currentPageType === 'mainmenu') {
    if (item.type === 'timelog') {
      const navResp = await sendToAnyFrame(tab.id, { action: 'navigateToAddTimeLog' }, { requireSuccess: true });
      if (!navResp?.success) {
        el.className = 'fill-result err';
        el.textContent = '⚠ Could not find My Time Logs link. Make sure you are on the Typhon home screen.';
        return;
      }

      el.className = 'fill-result ok';
      el.textContent = '✓ Opening Time Logs and starting auto-fill…';

      await sleep(900);
      const addResp = await sendToAnyFrame(tab.id, { action: 'navigateToAddTimeLogForm' }, { requireSuccess: true });
      if (!addResp?.success) {
        el.className = 'fill-result ok';
        el.textContent = '✓ Opened My Time Logs. Click Fill once to open Add New Time Log.';
        return;
      }

      await sleep(900);
      await sendToAnyFrame(tab.id, { action: 'fill', data: item }, { requireSuccess: true });
      await sleep(1200);
      const fillResp = await sendToAnyFrame(tab.id, { action: 'fill', data: item }, { requireSuccess: true });

      el.className = 'fill-result ok';
      el.textContent = fillResp?.success
        ? '✓ Time Log automation complete — review and hit Save Data in Typhon.'
        : '✓ Opened Time Log flow. If needed, click Fill once more on the entry page.';
    } else if (item.type === 'eval') {
      const response = await sendToAnyFrame(tab.id, { action: 'navigateToAddEval' }, { requireSuccess: true });
      if (response?.success) {
        el.className = 'fill-result ok';
        el.textContent = '✓ Navigating to Daily Evaluation…';
      } else {
        el.className = 'fill-result err';
        el.textContent = '⚠ Could not find Daily Evaluation link. Open Daily Eval in Typhon, then click Fill.';
      }
    } else {
      const response = await sendToAnyFrame(tab.id, { action: 'navigateToAddCaseLog' }, { requireSuccess: true });
      if (response?.success) {
        el.className = 'fill-result ok';
        el.textContent = '✓ Navigating to Add New Case Log…';
      } else {
        el.className = 'fill-result err';
        el.textContent = '⚠ Could not find Add New Case Log link. Make sure you are on the Typhon home screen.';
      }
    }
    return;
  }

  // On the time log list page, clicking Fill opens the Add New Time Log form
  if (currentPageType === 'timeloglist') {
    const response = await sendToAnyFrame(tab.id, { action: 'navigateToAddTimeLogForm' }, { requireSuccess: true });
    if (response?.success) {
      el.className = 'fill-result ok';
      el.textContent = '✓ Opening Add New Time Log form and auto-filling…';

      await sleep(900);
      await sendToAnyFrame(tab.id, { action: 'fill', data: item }, { requireSuccess: true });
      await sleep(1200);
      const fillResp = await sendToAnyFrame(tab.id, { action: 'fill', data: item }, { requireSuccess: true });
      if (fillResp?.success) {
        el.textContent = '✓ Time Log automation complete — review and hit Save Data in Typhon.';
      } else {
        el.textContent = '✓ Opened Add Time Log. If needed, click Fill once on the entry page.';
      }
    } else {
      el.className = 'fill-result err';
      el.textContent = '⚠ Could not find Add New Time Log button on this page.';
    }
    return;
  }

  const frames = prioritizeFrames(await getAllFrames(tab.id));
  let lastFailure = null;

  for (const frame of frames) {
    const response = await sendToFrame(tab.id, frame.frameId, { action: 'fill', data: item });
    if (!response) continue;
    if (response.success) {
      el.className = 'fill-result ok';
      el.textContent = `✓ Filled ${response.filled === 'timelog' ? 'time log' : response.filled === 'eval' ? 'evaluation' : 'case log'} — review and hit Save Data in Typhon.`;
      return;
    }
    lastFailure = response;
  }

  // Fallback: legacy top-frame call
  const response = await new Promise(resolve => {
    chrome.tabs.sendMessage(tab.id, { action: 'fill', data: item }, r => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(r || null);
    });
  });

  if (response?.success) {
    el.className = 'fill-result ok';
    if (response.filled === 'timelog' && response.mode === 'date-step') {
      el.textContent = '✓ Date set. Continuing and filling time entry…';
      await sleep(1300);
      const secondPass = await sendToAnyFrame(tab.id, { action: 'fill', data: item }, { requireSuccess: true });
      if (secondPass?.success) {
        el.textContent = '✓ Time Log automation complete — review and hit Save Data in Typhon.';
      }
    } else {
      el.textContent = `✓ Filled ${response.filled === 'timelog' ? 'time log' : response.filled === 'eval' ? 'evaluation' : 'case log'} — review and hit Save Data in Typhon.`;
    }
    return;
  }

  const reason = response?.reason || lastFailure?.reason;
  el.className = 'fill-result err';
  el.textContent = reason
    ? `⚠ ${reason}`
    : '⚠ Could not reach Typhon page. Make sure you are on the case log or time log entry page.';
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  let isOnTyphon = false;
  try {
    const host = new URL(url).hostname;
    isOnTyphon = /(^|\.)typhon\.net$|(^|\.)typhongroup\.net$/.test(host);
  } catch {
    isOnTyphon = false;
  }

  const sub = document.getElementById('header-sub');
  const pill = document.getElementById('page-pill');
  const content = document.getElementById('main-content');

  // Detect Typhon page type via content script
  if (isOnTyphon) {
    try {
      currentPageType = await detectPageTypeAcrossFrames(tab.id);
    } catch {
      currentPageType = 'unknown';
    }
  }

  // Set header subtitle and pill
  if (isOnTyphon) {
    if (currentPageType === 'caselog') {
      sub.textContent = 'On: Case Log entry page';
      pill.textContent = '📋 Case Log page detected';
      pill.className = 'page-pill pill-case';
      pill.style.display = 'block';
    } else if (currentPageType === 'casedate') {
      sub.textContent = 'On: Add Case Log (date step)';
      pill.textContent = '📅 Date picker page — click ⚡ to fill & continue';
      pill.className = 'page-pill pill-case';
      pill.style.display = 'block';
    } else if (currentPageType === 'timelog') {
      sub.textContent = 'On: Time Log entry page';
      pill.textContent = '⏰ Time Log page detected';
      pill.className = 'page-pill pill-timelog';
      pill.style.display = 'block';
    } else if (currentPageType === 'timeloglist') {
      sub.textContent = 'On: My Time Logs';
      pill.textContent = '⏱ Time Logs list — click Fill to add new';
      pill.className = 'page-pill pill-timelog';
      pill.style.display = 'block';
    } else if (currentPageType === 'eval') {
      sub.textContent = 'On: Evaluation entry page';
      pill.textContent = '📋 Evaluation page detected';
      pill.className = 'page-pill pill-case';
      pill.style.display = 'block';
    } else if (currentPageType === 'mainmenu') {
      sub.textContent = 'On: Typhon Home';
      pill.textContent = '🏠 Home screen — click Fill to navigate & log';
      pill.className = 'page-pill pill-other';
      pill.style.display = 'block';
    } else {
      sub.textContent = 'On Typhon — navigate to an entry page';
      pill.textContent = '↗ Go to Add New Case Log or Add New Time Log';
      pill.className = 'page-pill pill-other';
      pill.style.display = 'block';
    }
  } else {
    sub.textContent = 'Not on Typhon';
  }

  // Load and filter items
  const allItems = await Promise.race([
    loadItems(),
    new Promise(r => setTimeout(() => r([]), 8000))
  ]);
  if (isOnTyphon && currentPageType !== 'unknown') {
    pendingItems = allItems.filter(i => !i.submitted && (
      (currentPageType === 'timelog'      && i.type === 'timelog') ||
      (currentPageType === 'timeloglist'  && i.type === 'timelog') ||
      (currentPageType === 'eval'         && i.type === 'eval') ||
      (currentPageType === 'mainmenu'     && (i.type === 'case' || i.type === 'timelog' || i.type === 'eval')) ||
      (currentPageType !== 'timelog' && currentPageType !== 'timeloglist' && currentPageType !== 'eval' && currentPageType !== 'mainmenu' && i.type === 'case')
    ));
  } else {
    pendingItems = allItems.filter(i => !i.submitted);
  }

  // Sort chronologically by date then start time
  pendingItems.sort((a, b) => {
    const aKey = (a.date || '') + ' ' + (a.anesStart || a.clockIn1 || '');
    const bKey = (b.date || '') + ' ' + (b.anesStart || b.clockIn1 || '');
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  // Render list
  content.innerHTML = '';
  if (!pendingItems.length) {
    const ctx = currentPageType === 'caselog' ? 'cases' : currentPageType === 'timelog' ? 'time logs' : 'items';
    content.innerHTML = `<div class="empty">No pending ${ctx}.<br>Open the Full App to add some.</div>`;
    return;
  }

  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = isOnTyphon && currentPageType !== 'unknown'
    ? 'Click Fill to autofill the current Typhon page:'
    : 'Pending items (navigate to Typhon to fill):';
  content.appendChild(label);

  const box = document.createElement('div');
  box.className = 'list-box';

  pendingItems.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item';

    const canFill = isOnTyphon &&
      ((currentPageType === 'caselog'     && item.type === 'case') ||
       (currentPageType === 'casedate'    && item.type === 'case') ||
       (currentPageType === 'timelog'     && item.type === 'timelog') ||
       (currentPageType === 'timeloglist' && item.type === 'timelog') ||
       (currentPageType === 'eval'        && item.type === 'eval') ||
       (currentPageType === 'mainmenu'));

    if (item.type === 'timelog') {
      div.innerHTML = `
        <div class="item-info">
          <div class="item-title">⏰ ${fmtDate(item.date)}</div>
          <div class="item-sub">${item.clockIn1} → ${item.clockOut1}</div>
        </div>
        <button class="btn-fill" ${canFill ? '' : 'disabled'}>Fill</button>`;
    } else if (item.type === 'eval') {
      div.innerHTML = `
        <div class="item-info">
          <div class="item-title">📋 Eval ${fmtDate(item.date)}</div>
          <div class="item-sub">${item.preceptorName || 'Preceptor'} · ${item.facility?.join(', ') || 'No facility selected'}</div>
        </div>
        <button class="btn-fill" ${canFill ? '' : 'disabled'}>Fill</button>`;
    } else {
      const anesLine = [item.general ? 'General' : '', item.regional ? 'Regional' : '', item.mac ? 'MAC' : '', item.sedation ? 'Sedation' : ''].filter(Boolean).join('/') || '—';
      const timeLine = (item.anesStart && item.anesFinish) ? `${item.anesStart} → ${item.anesFinish} · ` : '';
      div.innerHTML = `
        <div class="item-info">
          <div class="item-title">📋 ${fmtDate(item.date)} · ASA ${item.asa || '?'} · ${item.biologicalSex || '?'}</div>
          <div class="item-sub">${timeLine}${anesLine} · Age ${item.age || '?'}</div>
        </div>
        <button class="btn-fill" ${canFill ? '' : 'disabled'}>Fill</button>`;
    }
    const fillBtn = div.querySelector('.btn-fill');
    if (fillBtn && canFill) fillBtn.addEventListener('click', () => fillItem(i));

    box.appendChild(div);
  });

  content.appendChild(box);
}

document.getElementById('btn-open-app').addEventListener('click', openApp);

document.getElementById('btn-sync').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync');
  btn.textContent = '⏳ Signing in…';
  btn.disabled = true;

  try {
    const data = await new Promise(r => chrome.storage.local.get('typhon-auth', r));
    const stored = data['typhon-auth'];
    if (stored && stored.refreshToken) {
      await getValidIdToken(stored, null);
    } else {
      await signInWithGoogle();
    }
    await init();
  } catch (e) {
    console.warn('[popup] sync error:', e.message);
  } finally {
    btn.textContent = '🔄 Refresh from Cloud';
    btn.disabled = false;
  }
});

// When storage changes re-run init()
let _initInFlight = false;
let _pendingInitTimer = null;

async function _throttledInit() {
  if (_initInFlight) return;            // already running — skip
  clearTimeout(_pendingInitTimer);
  _initInFlight = true;
  try { await init(); } finally { _initInFlight = false; }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes['typhon-items'] || changes['typhon-auth'])) {
    clearTimeout(_pendingInitTimer);
    _pendingInitTimer = setTimeout(() => _throttledInit(), 400);
  }
});

// Re-init when the active tab finishes navigating to/within Typhon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.active) return;
  let isTyphon = false;
  try { isTyphon = /(^|\.)typhon\.net$|(^|\.)typhongroup\.net$/.test(new URL(tab.url).hostname); } catch {}
  if (!isTyphon) return;
  clearTimeout(_pendingInitTimer);
  _pendingInitTimer = setTimeout(() => _throttledInit(), 600); // slight delay so content script is ready
});

_throttledInit();
