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

function prioritizeFrames(frames) {
  const score = frame => {
    const url = (frame?.url || '').toLowerCase();
    if (url.includes('/nast/data/data2.asp')) return 100;
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
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
}

function fmtDate(iso) {
  if (!iso) return '?';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

async function loadItems() {
  return new Promise(resolve => {
    chrome.storage.local.get('typhon-items', d => resolve(d['typhon-items'] || []));
  });
}

async function fillItem(itemIndex) {
  const item = pendingItems[itemIndex];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const el = document.getElementById('fill-result');
  el.style.display = 'block';

  const frames = prioritizeFrames(await getAllFrames(tab.id));
  let lastFailure = null;

  for (const frame of frames) {
    const response = await sendToFrame(tab.id, frame.frameId, { action: 'fill', data: item });
    if (!response) continue;
    if (response.success) {
      el.className = 'fill-result ok';
      el.textContent = `✓ Filled ${response.filled === 'timelog' ? 'time log' : 'case log'} — review and hit Save Data in Typhon.`;
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
    el.textContent = `✓ Filled ${response.filled === 'timelog' ? 'time log' : 'case log'} — review and hit Save Data in Typhon.`;
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
    } else if (currentPageType === 'timelog') {
      sub.textContent = 'On: Time Log entry page';
      pill.textContent = '⏰ Time Log page detected';
      pill.className = 'page-pill pill-timelog';
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
  const allItems = await loadItems();
  if (isOnTyphon && currentPageType !== 'unknown') {
    pendingItems = allItems.filter(i => !i.submitted && i.type === (currentPageType === 'timelog' ? 'timelog' : 'case'));
  } else {
    pendingItems = allItems.filter(i => !i.submitted);
  }

  // Render list
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
      ((currentPageType === 'caselog' && item.type === 'case') ||
       (currentPageType === 'timelog' && item.type === 'timelog'));

    if (item.type === 'timelog') {
      div.innerHTML = `
        <div class="item-info">
          <div class="item-title">⏰ ${fmtDate(item.date)}</div>
          <div class="item-sub">${item.clockIn1} → ${item.clockOut1}</div>
        </div>
        <button class="btn-fill" ${canFill ? '' : 'disabled'}>Fill</button>`;
    } else {
      const anesLine = [item.general ? 'General' : '', item.regional ? 'Regional' : '', item.mac ? 'MAC' : '', item.sedation ? 'Sedation' : ''].filter(Boolean).join('/') || '—';
      div.innerHTML = `
        <div class="item-info">
          <div class="item-title">📋 ${fmtDate(item.date)} · ASA ${item.asa || '?'} · ${item.biologicalSex || '?'}</div>
          <div class="item-sub">${anesLine} · Age ${item.age || '?'}</div>
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
init();
