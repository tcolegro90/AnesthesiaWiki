// ============================================================
// STORAGE — priority: chrome.storage > Firestore > localStorage
// ============================================================

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

const store = {
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

// ============================================================
// TAB NAVIGATION
// ============================================================
function goTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['case','time','saved'][i] === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-' + name).classList.add('active');
  if (name === 'saved') renderSaved();
}

// ============================================================
// BUTTON HELPERS
// ============================================================
function pick(el, grpId) {
  const wasOn = el.classList.contains('on');
  document.querySelectorAll(`#${grpId} .btn-tog`).forEach(b => b.classList.remove('on'));
  if (!wasOn) el.classList.add('on');
}
function multi(el, grpId) {
  el.classList.toggle('on');
  const group = grpId || el.closest('.btn-group')?.id;
  if (group === 'grp-anat') updateAnatomicalDetailsVisibility();
}
function pickASA(el) {
  const wasOn = el.classList.contains('on');
  document.querySelectorAll('#grp-asa .asa-btn').forEach(b => b.classList.remove('on'));
  if (!wasOn) el.classList.add('on');
}
function toggleSec(id) {
  const tog = document.getElementById(id);
  const body = tog.querySelector('.sec-body');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  tog.classList.toggle('expanded', !isOpen);
}
function autoOpen(id, cb) {
  if (cb.checked) {
    const body = document.querySelector(`#${id} .sec-body`);
    if (body) { body.classList.add('open'); document.getElementById(id).classList.add('expanded'); }
  }
}

function updateAnatomicalDetailsVisibility() {
  const selected = multiVals('grp-anat');
  const toggleDropdown = (id, on) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('open', on);
  };

  toggleDropdown('anat-dd-head-intra', selected.includes('Head - Intracranial'));
  toggleDropdown('anat-dd-heart', selected.includes('Intrathoracic - Heart'));
  toggleDropdown('anat-dd-other', selected.includes('Other'));
}

function syncSelectionRowStates() {
  document.querySelectorAll('#card-anes-type .sec-header').forEach((header) => {
    const cb = header.querySelector('input[type="checkbox"]');
    if (!cb) return;
    header.classList.toggle('selected', cb.checked);
  });

  document.querySelectorAll('.chk-item').forEach((label) => {
    const cb = label.querySelector('input[type="checkbox"]');
    if (!cb) return;
    label.classList.toggle('selected', cb.checked);
  });

  document.querySelectorAll('.count-row').forEach((row) => {
    const cb = row.querySelector('label input[type="checkbox"]');
    if (!cb) return;
    row.classList.toggle('selected', cb.checked);
  });
}

function val(id) { return document.getElementById(id)?.value ?? ''; }
function chk(id) { return document.getElementById(id)?.checked ?? false; }
function pickVal(grpId) {
  const el = document.querySelector(`#${grpId} .btn-tog.on, #${grpId} .asa-btn.on`);
  return el ? el.dataset.v : '';
}
function multiVals(grpId) {
  return [...document.querySelectorAll(`#${grpId} .btn-tog.on`)].map(b => b.dataset.v);
}

// ============================================================
// READ FORMS
// ============================================================
function readCase() {
  const preceptorType = pickVal('grp-preceptor') || 'CRNA';
  const asaBase = pickVal('grp-asa');
  const urgencyType = pickVal('grp-urgency');
  const neonateType = pickVal('grp-neonate');
  return {
    id: Date.now().toString(), type: 'case', submitted: false,
    date: getSelectedISO('day-pills'), returnSameDay: val('c-return'),
    clinicalSite: val('c-site'),
    biologicalSex: pickVal('grp-sex'),
    admitType: pickVal('grp-admit'),
    age: val('c-age'), isNeonate: neonateType === 'yes',
    preceptorType,
    mdaPrimary: preceptorType === 'MDA' ? '1' : '',
    crnaPrimary: preceptorType === 'CRNA' ? '1' : '',
    asa: asaBase ? (urgencyType ? `${asaBase}E` : asaBase) : '',
    traumaEmergency: !!urgencyType,
    urgencyType,
    positions: multiVals('grp-pos'),
    anatomical: multiVals('grp-anat'),
    anatomicalDetails: {
      headIntraOpen: chk('c-anat-head-intra-open'),
      headIntraClosed: chk('c-anat-head-intra-closed'),
      heartOpenBypass: chk('c-anat-heart-open-bypass'),
      heartOpenNoBypass: chk('c-anat-heart-open-no-bypass'),
      heartClosed: chk('c-anat-heart-closed'),
      otherECT: chk('c-anat-other-ect'),
      otherEBUS: chk('c-anat-other-ebus'),
      otherColonoscopy: chk('c-anat-other-colonoscopy'),
      otherEGD: chk('c-anat-other-egd'),
    },
    general: chk('c-general'),
    generalItems: {
      minimal: chk('c-gen-minimal'), ivInduction: chk('c-gen-iv'),
      inhalInduction: chk('c-gen-inhal'), maskInd: chk('c-gen-mask-ind'),
      maskMaint: chk('c-gen-mask-maint'), maskResus: chk('c-gen-mask-resus'),
      lma: chk('c-gen-lma'), sga: chk('c-gen-sga'),
      ettOral: chk('c-gen-ett-oral'), ettNasal: chk('c-gen-ett-nasal'),
      tiva: chk('c-gen-tiva'), emerge: chk('c-gen-emerge'),
    },
    regional: chk('c-regional'),
    regionalItems: {
      spinal: chk('c-reg-spinal'), epidural: chk('c-reg-epidural'),
      peripheral: chk('c-reg-peripheral'), other: chk('c-reg-other'),
      mgmt: chk('c-reg-mgmt'),
      peripheralUpper: chk('c-reg-peripheral-upper'),
      peripheralLower: chk('c-reg-peripheral-lower'),
    },
    mac: chk('c-mac'), sedation: chk('c-sedation'),
    assessment: {
      initial: multiVals('grp-assess').includes('initial'),
      post: multiVals('grp-assess').includes('post'),
      hxpActual: multiVals('grp-assess').includes('actual'),

    },
    procedures: {
      artActual: chk('c-art-actual'), artBP: chk('c-art-bp'),
      cvlActual: chk('c-cvl-actual') || chk('c-cvl-picc') || chk('c-cvl-nonpicc'),
      cvlPICC: chk('c-cvl-picc'), cvlNonPICC: chk('c-cvl-nonpicc'), cvlMonitor: chk('c-cvl-monitor'),
      endoTrachealTubePlacement: chk('c-endo-tt-placement'),
      endoAirwayAssessment: chk('c-endo-airway-assess'),
      otherTechniques: chk('c-tech-other'),
      hemo: chk('c-hemo'), mechVent: chk('c-mech-vent'),
      cxr: chk('c-cxr'), pain: chk('c-pain'),
      ivStarts: chk('c-iv-starts'), ivStartsN: val('c-iv-n'),
      pocusA: chk('c-pocus-a'), pocusAN: val('c-pocus-a-n'),
      usrA: chk('c-usr-a'), usrAN: val('c-usr-a-n'),
      usvA: chk('c-usv-a'), usvAN: val('c-usv-a-n'),
      paPlacement: chk('c-pa-placement'), paMonitor: chk('c-pa-monitor'),
    },
    medications: {
      none: chk('c-med-none'), inhal: chk('c-med-inhal'),
      ivInd: chk('c-med-iv-ind'), nmb: chk('c-med-nmb'),
      opioid: chk('c-med-opioid'), other: chk('c-med-other'),
    },
    anesStart: val('c-as'), anesFinish: val('c-af'),
    clinicalNotes: val('c-notes'),
  };
}

function readTimeLog() {
  return {
    id: Date.now().toString(), type: 'timelog', submitted: false,
    date: getSelectedISO('t-day-pills'),
    clockIn1: val('t-in1'), clockOut1: val('t-out1'),
    notes: val('t-notes'),
  };
}

// ============================================================
// DRAFT AUTOSAVE
// ============================================================
function saveDraft() {
  try { localStorage.setItem('typhon-draft', JSON.stringify(readCase())); } catch(e) {}
}
function clearDraft() {
  localStorage.removeItem('typhon-draft');
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem('typhon-draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return;
    // Only restore if there's something meaningful entered
    if (!d.biologicalSex && !d.anesStart && !(d.anatomical||[]).length && !d.age) return;
    resetCase();
    if (d.clinicalSite) document.getElementById('c-site').value = d.clinicalSite;
    if (d.date) {
      const pill = document.querySelector(`#day-pills .day-pill[data-iso="${d.date}"]`);
      if (pill) { document.querySelectorAll('#day-pills .day-pill').forEach(p => p.classList.remove('on')); pill.classList.add('on'); }
    }
    document.querySelectorAll('#grp-sex .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === d.biologicalSex));
    document.querySelectorAll('#grp-admit .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === d.admitType));
    document.querySelectorAll('#grp-preceptor .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === (d.preceptorType || 'CRNA')));
    if (d.age) document.getElementById('c-age').value = d.age;
    const rawAsa = String(d.asa || '').toUpperCase().trim();
    const baseAsa = rawAsa.replace(/E$/, '');
    document.querySelectorAll('#grp-asa .asa-btn').forEach(b => b.classList.toggle('on', b.dataset.v === baseAsa));
    document.querySelectorAll('#grp-urgency .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === d.urgencyType));
    document.querySelectorAll('#grp-neonate .btn-tog').forEach(b => b.classList.toggle('on', !!d.isNeonate && b.dataset.v === 'yes'));
    document.querySelectorAll('#grp-pos .btn-tog').forEach(b => b.classList.toggle('on', (d.positions||[]).includes(b.dataset.v)));
    document.querySelectorAll('#grp-anat .btn-tog').forEach(b => b.classList.toggle('on', (d.anatomical||[]).includes(b.dataset.v)));
    updateAnatomicalDetailsVisibility();
    const adMap = { headIntraOpen:'c-anat-head-intra-open', headIntraClosed:'c-anat-head-intra-closed',
      heartOpenBypass:'c-anat-heart-open-bypass', heartOpenNoBypass:'c-anat-heart-open-no-bypass',
      heartClosed:'c-anat-heart-closed', otherECT:'c-anat-other-ect', otherEBUS:'c-anat-other-ebus',
      otherColonoscopy:'c-anat-other-colonoscopy', otherEGD:'c-anat-other-egd' };
    Object.entries(d.anatomicalDetails||{}).forEach(([k,v]) => { if(adMap[k]) document.getElementById(adMap[k]).checked=!!v; });
    const genCb = document.getElementById('c-general');
    genCb.checked = !!d.general;
    if (d.general) autoOpen('sec-general', genCb);
    const giMap = { minimal:'c-gen-minimal', ivInduction:'c-gen-iv', inhalInduction:'c-gen-inhal',
      maskInd:'c-gen-mask-ind', maskMaint:'c-gen-mask-maint', maskResus:'c-gen-mask-resus',
      lma:'c-gen-lma', sga:'c-gen-sga', ettOral:'c-gen-ett-oral', ettNasal:'c-gen-ett-nasal',
      tiva:'c-gen-tiva', emerge:'c-gen-emerge' };
    Object.entries(d.generalItems||{}).forEach(([k,v]) => { if(giMap[k]) document.getElementById(giMap[k]).checked=!!v; });
    const regCb = document.getElementById('c-regional');
    regCb.checked = !!d.regional;
    if (d.regional) autoOpen('sec-regional', regCb);
    const riMap = { spinal:'c-reg-spinal', epidural:'c-reg-epidural', peripheral:'c-reg-peripheral',
      other:'c-reg-other', mgmt:'c-reg-mgmt', peripheralUpper:'c-reg-peripheral-upper', peripheralLower:'c-reg-peripheral-lower' };
    Object.entries(d.regionalItems||{}).forEach(([k,v]) => { if(riMap[k]) document.getElementById(riMap[k]).checked=!!v; });
    document.getElementById('c-mac').checked = !!d.mac;
    document.getElementById('c-sedation').checked = !!d.sedation;
    const assessMap = { initial:'initial', post:'post', hxpActual:'actual' };
    Object.entries(assessMap).forEach(([key, valName]) => {
      const btn = document.querySelector(`#grp-assess .btn-tog[data-v="${valName}"]`);
      if (btn) btn.classList.toggle('on', !!(d.assessment||{})[key]);
    });
    const pMap = { artActual:'c-art-actual', artBP:'c-art-bp', cvlActual:'c-cvl-actual',
      cvlPICC:'c-cvl-picc', cvlNonPICC:'c-cvl-nonpicc', cvlMonitor:'c-cvl-monitor',
      paPlacement:'c-pa-placement', paMonitor:'c-pa-monitor',
      endoTrachealTubePlacement:'c-endo-tt-placement', endoAirwayAssessment:'c-endo-airway-assess', otherTechniques:'c-tech-other',
      hemo:'c-hemo', mechVent:'c-mech-vent', cxr:'c-cxr', pain:'c-pain',
      ivStarts:'c-iv-starts', pocusA:'c-pocus-a', usrA:'c-usr-a', usvA:'c-usv-a' };
    const pNumMap = { ivStartsN:'c-iv-n', pocusAN:'c-pocus-a-n', usrAN:'c-usr-a-n', usvAN:'c-usv-a-n' };
    Object.entries(d.procedures||{}).forEach(([k,v]) => {
      if (pMap[k])    document.getElementById(pMap[k]).checked = !!v;
      if (pNumMap[k]) document.getElementById(pNumMap[k]).value = v || '';
    });
    const mMap = { none:'c-med-none', inhal:'c-med-inhal', ivInd:'c-med-iv-ind', nmb:'c-med-nmb', opioid:'c-med-opioid', other:'c-med-other' };
    Object.entries(d.medications||{}).forEach(([k,v]) => { if(mMap[k]) document.getElementById(mMap[k]).checked=!!v; });
    if (d.anesStart)    document.getElementById('c-as').value = d.anesStart;
    if (d.anesFinish)   document.getElementById('c-af').value = d.anesFinish;
    if (d.clinicalNotes) document.getElementById('c-notes').value = d.clinicalNotes;
    syncSelectionRowStates();
    toast('Draft restored — your previous entry was not lost');
  } catch(e) { console.warn('Draft restore failed', e); }
}

// ============================================================
// SAVE
// ============================================================
async function saveCase() {
  const c = readCase();
  if (!c.date)         { toast('Enter a date'); return; }
  if (!c.biologicalSex){ toast('Select biological sex'); return; }
  if (!c.asa)          { toast('Select ASA status'); return; }
  const items = (await store.get('typhon-items')) || [];
  items.push(c);
  console.log('[saveCase] About to save case. UID:', _getAuthUid(), 'Items count:', items.length);
  const writeResult = await store.set('typhon-items', items);
  console.log('[saveCase] Case saved successfully');
  updateBadge(items);
  if (writeResult?.cloud) toast('Case saved + cloud synced');
  else if (_getAuthUid()) toast('Saved locally. Cloud sync failed.');
  else toast('Case saved locally (not signed in)');
  clearDraft();
  resetCase();
}

async function saveTimeLog() {
  const t = readTimeLog();
  if (!t.date)     { toast('Enter a date'); return; }
  if (!t.clockIn1) { toast('Enter Clock IN time'); return; }
  if (!t.clockOut1){ toast('Enter Clock OUT time'); return; }
  const items = (await store.get('typhon-items')) || [];
  items.push(t);
  const writeResult = await store.set('typhon-items', items);
  updateBadge(items);
  if (writeResult?.cloud) toast('Time log saved + cloud synced');
  else if (_getAuthUid()) toast('Saved locally. Cloud sync failed.');
  else toast('Time log saved locally (not signed in)');
  resetTimeLog();
}

// ============================================================
// RESET
// ============================================================
function resetCase() {
  clearDraft();
  document.querySelectorAll('#pane-case .btn-tog, #pane-case .asa-btn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('#pane-case input[type="checkbox"]').forEach(c => c.checked = false);
  ['c-age','c-as','c-af','c-notes','c-iv-n',
   'c-pocus-a-n','c-usr-a-n','c-usv-a-n'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Default preceptor selection to CRNA.
  document.querySelectorAll('#grp-preceptor .btn-tog').forEach(b => b.classList.remove('on'));
  const crnaBtn = document.querySelector('#grp-preceptor .btn-tog[data-v="CRNA"]');
  if (crnaBtn) crnaBtn.classList.add('on');
  document.querySelectorAll('#pane-case .stamped').forEach(el => el.classList.remove('stamped'));
  document.querySelectorAll('#pane-case .sec-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('#pane-case .sec-tog').forEach(t => t.classList.remove('expanded'));
  document.querySelectorAll('.anat-dropdown').forEach((el) => el.classList.remove('open'));
  syncSelectionRowStates();
  // Reset day pills to today
  const pills = document.querySelectorAll('#day-pills .day-pill');
  pills.forEach(p => p.classList.remove('on'));
  if (pills[0]) pills[0].classList.add('on');
  document.getElementById('c-return').value = 'no';

  // After saving/resetting, bring mobile users back to step 1.
  if (casePager && typeof casePager.render === 'function') {
    casePager.index = 0;
    casePager.render();
  }
}

function resetTimeLog() {
  ['t-in1','t-out1','t-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('stamped'); }
  });
  const pills = document.querySelectorAll('#t-day-pills .day-pill');
  pills.forEach(p => p.classList.remove('on'));
  if (pills[0]) pills[0].classList.add('on');
}

// ============================================================
// RENDER SAVED
// ============================================================
async function renderSaved() {
  const items = (await store.get('typhon-items')) || [];
  const el = document.getElementById('saved-list');

  if (!items.length) {
    el.innerHTML = '<div class="empty"><div class="icon">📋</div><p>No saved items yet.<br>Add cases and time logs above.</p></div>';
    return;
  }

  const sorted = [...items].map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));

  el.innerHTML = sorted.map(({ item, i }) => {
    const isPending = !item.submitted;
    if (item.type === 'timelog') {
      return `<div class="saved-item ${isPending ? '' : 'done'}">
        <div class="saved-item-top">
          <div>
            <div class="saved-item-title">⏰ Time Log — ${fmtDate(item.date)}</div>
            <div class="saved-item-sub">${item.clockIn1} → ${item.clockOut1}${item.clockIn2 ? ` &nbsp;|&nbsp; ${item.clockIn2} → ${item.clockOut2}` : ''}</div>
          </div>
          <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit-timelog" data-idx="${i}">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
        </div>
      </div>`;
    } else {
      const anesLine = [item.general?'General':'', item.regional?'Regional':'', item.mac?'MAC':'', item.sedation?'Sedation':''].filter(Boolean).join(' · ') || '—';
      return `<div class="saved-item ${isPending ? '' : 'done'}">
        <div class="saved-item-top">
          <div>
            <div class="saved-item-title">📋 Case — ${fmtDate(item.date)} · ASA ${item.asa||'?'} · ${item.biologicalSex||'?'} · Age ${item.age||'?'}</div>
            <div class="saved-item-sub">${anesLine} &nbsp;|&nbsp; ${item.anatomical?.join(', ')||'No category'}</div>
          </div>
          <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit-case" data-idx="${i}">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
        </div>
      </div>`;
    }
  }).join('');
}

async function toggleSubmit(i) {
  const items = (await store.get('typhon-items')) || [];
  items[i].submitted = !items[i].submitted;
  await store.set('typhon-items', items);
  updateBadge(items);
  renderSaved();
}

async function deleteItem(i) {
  const items = (await store.get('typhon-items')) || [];
  items.splice(i, 1);
  await store.set('typhon-items', items);
  updateBadge(items);
  renderSaved();
}

function copyCase(i) {
  store.get('typhon-items').then(items => {
    const c = items[i];
    const gi = c.generalItems || {}, ri = c.regionalItems || {}, p = c.procedures || {}, m = c.medications || {}, ad = c.anatomicalDetails || {};
    const truthyKeys = obj => Object.entries(obj)
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v))
      .map(([k]) => k);
    const lines = [
      `CASE LOG — ${fmtDate(c.date)}`,
      `Site: ${c.clinicalSite}  |  Sex: ${c.biologicalSex}  |  Age: ${c.age}  |  ASA: ${c.asa}  |  Admit: ${c.admitType}`,
      c.traumaEmergency ? '⚠ TRAUMA/EMERGENCY' : null,
      `Positions: ${c.positions?.join(', ') || 'None'}`,
      `Anatomical: ${c.anatomical?.join(', ') || 'None'}`,
      truthyKeys(ad).length ? `  Anatomical sub: ${truthyKeys(ad).join(', ')}` : null,
      `Anesthesia: ${[c.general?'General':'', c.regional?'Regional':'', c.mac?'MAC':'', c.sedation?'Sedation':''].filter(Boolean).join(', ')}`,
      c.general ? `  General sub: ${truthyKeys(gi).join(', ')}` : null,
      c.regional ? `  Regional sub: ${truthyKeys(ri).join(', ')}` : null,
      `Meds: ${truthyKeys(m).join(', ') || 'None'}`,
      `Times: AS ${c.anesStart} → AF ${c.anesFinish}`,
      c.clinicalNotes ? `Notes: ${c.clinicalNotes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    toast('Copied!');
  });
}

function copyTimelog(i) {
  store.get('typhon-items').then(items => {
    const t = items[i];
    const lines = [
      `TIME LOG — ${fmtDate(t.date)}`,
      `1st: IN ${t.clockIn1}  OUT ${t.clockOut1}`,
      t.clockIn2 ? `2nd: IN ${t.clockIn2}  OUT ${t.clockOut2}` : null,
      t.notes ? `Notes: ${t.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    toast('Copied!');
  });
}

// ============================================================
// UTILS
// ============================================================
function todayISO() { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso) { if (!iso) return '?'; const [y,m,d] = iso.split('-'); return `${m}/${d}/${y}`; }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

function updateBadge(items) {
  const n = items.filter(i => !i.submitted).length;
  const b = document.getElementById('badge-count');
  b.textContent = n; b.style.display = n ? 'inline' : 'none';
}

// ============================================================
// TEST PRESETS
// ============================================================
const TEST_CASES = {
  1: {
    // GETA, intra-abdominal, ASA 2, male, outpatient
    site: 'Rochester General Hospital', sex: 'Male', admit: 'Outpatient', age: '45',
    preceptorType: 'CRNA',
    asa: '2', trauma: false, neonate: false, positions: ['Supine'],
    anatomical: ['Intra-abdominal'],
    anatomicalDetails: {},
    general: true,
    generalItems: { minimal: false, ivInduction: true, inhalInduction: false, maskInd: false,
      maskMaint: false, maskResus: false, lma: false, sga: false,
      ettOral: true, ettNasal: false, tiva: false, emerge: true },
    regional: false, regionalItems: {},
    mac: false, sedation: false,
    assessment: { initial: true, post: true, hxpActual: true, hxpSim: false, hxpSimN: '' },
    procedures: { artActual: false, artBP: false, cvlActual: false, cvlPICC: false,
      cvlNonPICC: false, cvlMonitor: false, paPlacement: false, paMonitor: false,
      endoTrachealTubePlacement: false, endoAirwayAssessment: false, otherTechniques: false,
      hemo: false, mechVent: true, cxr: false, pain: false, ivStarts: true, ivStartsN: '1',
      pocusA: false, pocusAN: '', usrA: false, usrAN: '', usvA: false, usvAN: '' },
    medications: { none: false, inhal: true, ivInd: true, nmb: true, opioid: true, other: false },
    anesStart: '0715', anesFinish: '1030',
    notes: 'Test case 1 — GETA for laparoscopic cholecystectomy. Uneventful induction and emergence.'
  },
  2: {
    // Spinal, OB, C-section, ASA 2, female
    site: 'Rochester General Hospital', sex: 'Female', admit: 'Inpatient', age: '29',
    preceptorType: 'MDA',
    asa: '2', trauma: false, neonate: false, positions: ['Lithotomy'],
    anatomical: ['Cesarean delivery'],
    anatomicalDetails: {},
    general: false, generalItems: {},
    regional: true,
    regionalItems: { spinal: true, epidural: false, peripheral: false, other: false,
      mgmt: false, peripheralUpper: false, peripheralLower: false },
    mac: false, sedation: false,
    assessment: { initial: true, post: true, hxpActual: true, hxpSim: false, hxpSimN: '' },
    procedures: { artActual: false, artBP: false, cvlActual: false, cvlPICC: false,
      cvlNonPICC: false, cvlMonitor: false, paPlacement: false, paMonitor: false,
      endoTrachealTubePlacement: false, endoAirwayAssessment: false, otherTechniques: false,
      hemo: false, mechVent: false, cxr: false, pain: false, ivStarts: true, ivStartsN: '1',
      pocusA: false, pocusAN: '', usrA: false, usrAN: '', usvA: false, usvAN: '' },
    medications: { none: false, inhal: false, ivInd: false, nmb: false, opioid: true, other: true },
    anesStart: '1420', anesFinish: '1608',
    notes: 'Test case 2 — Spinal for primary C-section. T4 level achieved bilaterally.'
  },
  3: {
    // MAC, extremity, ASA 3, female, outpatient, arterial line, POCUS
    site: 'Rochester General Hospital', sex: 'Female', admit: 'Outpatient', age: '67',
    preceptorType: 'CRNA',
    asa: '3', trauma: false, neonate: false, positions: ['Lateral'],
    anatomical: ['Extremities'],
    anatomicalDetails: {},
    general: false, generalItems: {},
    regional: true,
    regionalItems: { spinal: false, epidural: false, peripheral: true, other: false,
      mgmt: false, peripheralUpper: true, peripheralLower: false },
    mac: true, sedation: false,
    assessment: { initial: true, post: true, hxpActual: true, hxpSim: false, hxpSimN: '' },
    procedures: { artActual: true, artBP: true, cvlActual: false, cvlPICC: false,
      cvlNonPICC: false, cvlMonitor: false, paPlacement: false, paMonitor: false,
      endoTrachealTubePlacement: false, endoAirwayAssessment: false, otherTechniques: false,
      hemo: false, mechVent: false, cxr: false, pain: false, ivStarts: true, ivStartsN: '1',
      pocusA: true, pocusAN: '1', usrA: true, usrAN: '1', usvA: false, usvAN: '' },
    medications: { none: false, inhal: false, ivInd: false, nmb: false, opioid: true, other: true },
    anesStart: '0830', anesFinish: '1115',
    notes: 'Test case 3 — MAC with peripheral nerve block (upper extremity). Arterial line for BP monitoring.'
  }
};

// ============================================================
// LOAD CASE DATA (reusable for both test cases and editing)
// ============================================================
function loadCaseData(t) {
  // Site
  document.getElementById('c-site').value = t.site;
  // Sex
  document.querySelectorAll('#grp-sex .btn-tog').forEach(b => {
    b.classList.toggle('on', b.dataset.v === t.sex);
  });
  // Admit
  document.querySelectorAll('#grp-admit .btn-tog').forEach(b => {
    b.classList.toggle('on', b.dataset.v === t.admit);
  });
  // Preceptor
  document.querySelectorAll('#grp-preceptor .btn-tog').forEach(b => {
    b.classList.toggle('on', b.dataset.v === (t.preceptorType || 'CRNA'));
  });
  // Age
  document.getElementById('c-age').value = t.age;
  // ASA
  const rawAsa = String(t.asa || '').toUpperCase().trim();
  const baseAsa = rawAsa.replace(/E$/, '');
  document.querySelectorAll('#grp-asa .asa-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.v === baseAsa);
  });
  // Urgency / neonate
  const urgencyFromData = t.urgencyType || (rawAsa.endsWith('E') ? 'Emergency' : (t.trauma ? 'Trauma' : ''));
  document.querySelectorAll('#grp-urgency .btn-tog').forEach(b => {
    b.classList.toggle('on', !!urgencyFromData);
  });
  document.querySelectorAll('#grp-neonate .btn-tog').forEach(b => {
    b.classList.toggle('on', !!t.neonate && b.dataset.v === 'yes');
  });
  // Positions
  document.querySelectorAll('#grp-pos .btn-tog').forEach(b => {
    b.classList.toggle('on', (t.positions||[]).includes(b.dataset.v));
  });
  // Anatomical
  document.querySelectorAll('#grp-anat .btn-tog').forEach(b => {
    b.classList.toggle('on', (t.anatomical||[]).includes(b.dataset.v));
  });
  updateAnatomicalDetailsVisibility();
  // Anatomical details
  const ad = t.anatomicalDetails || {};
  Object.entries(ad).forEach(([k, v]) => {
    const map = { headIntraOpen:'c-anat-head-intra-open', headIntraClosed:'c-anat-head-intra-closed',
      heartOpenBypass:'c-anat-heart-open-bypass', heartOpenNoBypass:'c-anat-heart-open-no-bypass',
      heartClosed:'c-anat-heart-closed', otherECT:'c-anat-other-ect', otherEBUS:'c-anat-other-ebus',
      otherColonoscopy:'c-anat-other-colonoscopy', otherEGD:'c-anat-other-egd' };
    if (map[k]) document.getElementById(map[k]).checked = !!v;
  });
  // General anesthesia
  const genCb = document.getElementById('c-general');
  genCb.checked = !!t.general;
  if (t.general) { autoOpen('sec-general', genCb); }
  const giMap = { minimal:'c-gen-minimal', ivInduction:'c-gen-iv', inhalInduction:'c-gen-inhal',
    maskInd:'c-gen-mask-ind', maskMaint:'c-gen-mask-maint', maskResus:'c-gen-mask-resus',
    lma:'c-gen-lma', sga:'c-gen-sga', ettOral:'c-gen-ett-oral', ettNasal:'c-gen-ett-nasal',
    tiva:'c-gen-tiva', emerge:'c-gen-emerge' };
  Object.entries(t.generalItems||{}).forEach(([k,v]) => { if(giMap[k]) document.getElementById(giMap[k]).checked=!!v; });
  // Regional
  const regCb = document.getElementById('c-regional');
  regCb.checked = !!t.regional;
  if (t.regional) { autoOpen('sec-regional', regCb); }
  const riMap = { spinal:'c-reg-spinal', epidural:'c-reg-epidural', peripheral:'c-reg-peripheral',
    other:'c-reg-other', mgmt:'c-reg-mgmt', peripheralUpper:'c-reg-peripheral-upper', peripheralLower:'c-reg-peripheral-lower' };
  Object.entries(t.regionalItems||{}).forEach(([k,v]) => { if(riMap[k]) document.getElementById(riMap[k]).checked=!!v; });
  // MAC / sedation
  document.getElementById('c-mac').checked = !!t.mac;
  document.getElementById('c-sedation').checked = !!t.sedation;
  // Assessment
  const a = t.assessment || {};
  const assessMap = { initial: 'initial', post: 'post', hxpActual: 'actual', hxpSim: 'sim' };
  Object.entries(assessMap).forEach(([key, valName]) => {
    const btn = document.querySelector(`#grp-assess .btn-tog[data-v="${valName}"]`);
    if (btn) btn.classList.toggle('on', !!a[key]);
  });

  // Procedures
  const p = t.procedures || {};
  const pMap = { artActual:'c-art-actual', artBP:'c-art-bp', cvlActual:'c-cvl-actual',
    cvlPICC:'c-cvl-picc', cvlNonPICC:'c-cvl-nonpicc', cvlMonitor:'c-cvl-monitor',
    paPlacement:'c-pa-placement', paMonitor:'c-pa-monitor',
    endoTrachealTubePlacement:'c-endo-tt-placement', endoAirwayAssessment:'c-endo-airway-assess', otherTechniques:'c-tech-other',
    hemo:'c-hemo', mechVent:'c-mech-vent', cxr:'c-cxr', pain:'c-pain',
    ivStarts:'c-iv-starts', pocusA:'c-pocus-a', usrA:'c-usr-a', usvA:'c-usv-a' };
  const pNumMap = { ivStartsN:'c-iv-n', pocusAN:'c-pocus-a-n', usrAN:'c-usr-a-n', usvAN:'c-usv-a-n' };
  Object.entries(p).forEach(([k,v]) => {
    if (pMap[k])    document.getElementById(pMap[k]).checked = !!v;
    if (pNumMap[k]) document.getElementById(pNumMap[k]).value  = v || '';
  });
  // Medications
  const m = t.medications || {};
  const mMap = { none:'c-med-none', inhal:'c-med-inhal', ivInd:'c-med-iv-ind',
    nmb:'c-med-nmb', opioid:'c-med-opioid', other:'c-med-other' };
  Object.entries(m).forEach(([k,v]) => { if(mMap[k]) document.getElementById(mMap[k]).checked=!!v; });
  // Times
  document.getElementById('c-as').value = t.anesStart;
  document.getElementById('c-af').value = t.anesFinish;
  // Notes
  document.getElementById('c-notes').value = t.notes || '';
  syncSelectionRowStates();
}

function loadTestCase(n) {
  resetCase();
  const t = TEST_CASES[n];
  loadCaseData(t);
  toast(`Test ${n} loaded — scroll to review all fields`);
}

async function editCase(i) {
  const items = (await store.get('typhon-items')) || [];
  const c = items[i];
  if (!c || c.type !== 'case') return;
  resetCase();
  // Set the date pill
  const pill = document.querySelector(`#day-pills .day-pill[data-iso="${c.date}"]`);
  if (pill) {
    document.querySelectorAll('#day-pills .day-pill').forEach(p => p.classList.remove('on'));
    pill.classList.add('on');
  }
  loadCaseData(c);
  goTab('case');
  toast('Case opened for editing');
}

const TEST_TIMELOGS = {
  1: { in1: '0600', out1: '1500', notes: 'Test time log 1 — standard day shift at RGH.' },
  2: { in1: '0600', out1: '1200', notes: 'Test time log 2 — split shift.' }
};

function loadTimeLogData(t) {
  document.getElementById('t-in1').value  = t.clockIn1 || t.in1 || '';
  document.getElementById('t-out1').value = t.clockOut1 || t.out1 || '';
  document.getElementById('t-notes').value = t.notes || '';
}

function loadTestTime(n) {
  resetTimeLog();
  const t = TEST_TIMELOGS[n];
  loadTimeLogData(t);
  toast(`Time log test ${n} loaded`);
}

async function editTimelog(i) {
  const items = (await store.get('typhon-items')) || [];
  const t = items[i];
  if (!t || t.type !== 'timelog') return;
  resetTimeLog();
  // Set the date pill
  const pill = document.querySelector(`#t-day-pills .day-pill[data-iso="${t.date}"]`);
  if (pill) {
    document.querySelectorAll('#t-day-pills .day-pill').forEach(p => p.classList.remove('on'));
    pill.classList.add('on');
  }
  loadTimeLogData(t);
  goTab('time');
  toast('Time log opened for editing');
}

// ============================================================
// DAY PILLS
// ============================================================
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function buildDayPills(containerId, dateStorageId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const today = new Date();
  for (let offset = 0; offset < 4; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = d.toISOString().split('T')[0];
    const dow = DAYS[d.getDay()];
    const label = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : dow;
    const shortDow = dow.substring(0, 3);
    const pill = document.createElement('div');
    pill.className = 'day-pill' + (offset === 0 ? ' today' : '') + (offset === 0 ? ' on' : '');
    pill.dataset.iso = iso;
    pill.dataset.container = containerId;
    pill.innerHTML = `<div class="dp-dow">${shortDow}</div><div class="dp-label">${label}</div>`;
    pill.addEventListener('click', () => {
      container.querySelectorAll('.day-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      if (dateStorageId) document.getElementById(dateStorageId).value = iso;
    });
    container.appendChild(pill);
  }
}

function getSelectedISO(containerId) {
  const on = document.querySelector(`#${containerId} .day-pill.on`);
  return on ? on.dataset.iso : todayISO();
}

// ============================================================
// TIMESTAMP
// ============================================================
function stampNow(inputId) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById(inputId);
  if (!el) return;
  el.value = hh + mm;
  el.classList.add('stamped');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  toast(`Stamped ${hh}:${mm}`);
}

let casePager = null;

function initWelcomeScreen() {
  const welcome = document.getElementById('welcome-screen');
  const startBtn = document.getElementById('welcome-start');
  if (!welcome || !startBtn) {
    document.body.classList.add('app-started');
    return;
  }

  const startApp = () => {
    document.body.classList.add('app-started');
    startBtn.blur();
  };

  startBtn.addEventListener('click', startApp);
  startBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startApp();
    }
  });
}

function enhanceNumericInputs() {
  // Force numeric keyboard on mobile for every numeric count field.
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('pattern', '[0-9]*');
  });

  // Time fields stay text for flexible formatting but should still show number keypad.
  ['c-as', 'c-af', 't-in1', 't-out1'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('pattern', '[0-9]*');
    el.setAttribute('autocomplete', 'off');
  });
}

function initCaseMobilePager() {
  const pane = document.getElementById('pane-case');
  if (!pane) return;

  const cards = [...pane.querySelectorAll(':scope > .card')];
  const prevBtn = document.getElementById('case-step-prev');
  const nextBtn = document.getElementById('case-step-next');
  const countEl = document.getElementById('case-step-count');
  const titleEl = document.getElementById('case-step-title');
  if (!cards.length || !prevBtn || !nextBtn || !countEl || !titleEl) return;

  const getCardTitle = (card) => card.dataset.stepTitle || card.querySelector('.card-title')?.textContent?.replace(/\s+/g, ' ').trim() || 'Case Section';

  const render = () => {
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    pane.classList.toggle('mobile-paged', mobile);

    if (!mobile) {
      pane.classList.remove('last-step');
      cards.forEach(card => card.classList.remove('active-step'));
      countEl.textContent = `Step 1 of ${cards.length}`;
      titleEl.textContent = getCardTitle(cards[0]);
      prevBtn.disabled = true;
      nextBtn.disabled = false;
      return;
    }

    casePager.index = Math.max(0, Math.min(casePager.index, cards.length - 1));
    cards.forEach((card, idx) => card.classList.toggle('active-step', idx === casePager.index));

    countEl.textContent = `Step ${casePager.index + 1} of ${cards.length}`;
    titleEl.textContent = getCardTitle(cards[casePager.index]);
    prevBtn.disabled = casePager.index === 0;
    nextBtn.disabled = casePager.index === cards.length - 1;
    pane.classList.toggle('last-step', casePager.index === cards.length - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepBy = (delta) => {
    casePager.index += delta;
    render();
  };

  casePager = { index: 0, cards, render };

  // Swipe left/right to move between case cards on mobile.
  let touchStartX = null;
  let touchStartY = null;
  pane.addEventListener('touchstart', (event) => {
    if (!window.matchMedia('(max-width: 820px)').matches) return;
    if (!event.touches || event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  pane.addEventListener('touchend', (event) => {
    if (!window.matchMedia('(max-width: 820px)').matches) return;
    if (touchStartX == null || touchStartY == null) return;
    if (!event.changedTouches || !event.changedTouches.length) return;

    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 30 || absDx < absDy) return;

    if (dx < 0) stepBy(1);
    else stepBy(-1);
  }, { passive: true });

  prevBtn.addEventListener('click', () => stepBy(-1));
  nextBtn.addEventListener('click', () => stepBy(1));
  window.addEventListener('resize', render);
  render();
}

function bindUiEvents() {
  const tabNames = ['case', 'time', 'saved'];
  document.querySelectorAll('.tab').forEach((tab, idx) => {
    tab.addEventListener('click', () => goTab(tab.dataset.tab || tabNames[idx]));
  });

  document.querySelectorAll('.btn-stamp').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.target || btn.closest('.ts-row')?.querySelector('input')?.id;
      if (inputId) stampNow(inputId);
    });
  });

  document.getElementById('btn-save-case')?.addEventListener('click', saveCase);
  document.getElementById('btn-save-time')?.addEventListener('click', saveTimeLog);

  document.addEventListener('click', (event) => {
    const asaBtn = event.target.closest('.asa-btn');
    if (asaBtn) {
      // Legacy markup still has inline onclick on ASA buttons.
      // Skip delegated handling in that case to avoid double-toggle.
      if (!asaBtn.hasAttribute('onclick')) pickASA(asaBtn);
      return;
    }

    const btnTog = event.target.closest('.btn-tog');
    if (btnTog) {
      // Legacy markup still has inline onclick on many .btn-tog elements.
      // Skip delegated handling for those so one tap = one toggle.
      if (btnTog.hasAttribute('onclick')) return;
      const groupId = btnTog.closest('.btn-group')?.id;
      if (!groupId) return;
      if (groupId === 'grp-sex' || groupId === 'grp-admit' || groupId === 'grp-preceptor' || groupId === 'grp-urgency' || groupId === 'grp-neonate') pick(btnTog, groupId);
      else multi(btnTog, groupId);
      return;
    }

    const secHeader = event.target.closest('.sec-header');
    if (secHeader) {
      const section = secHeader.closest('.sec-tog');
      const inAnesType = !!secHeader.closest('#card-anes-type');

      if (inAnesType) {
        const cb = secHeader.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (section && (section.id === 'sec-general' || section.id === 'sec-regional')) {
          const body = section.querySelector('.sec-body');
          if (body && cb) {
            body.classList.toggle('open', cb.checked);
            section.classList.toggle('expanded', cb.checked);
          }
        }

        // MAC and Sedation rows are simple sec-tog blocks without ids.
        // Ensure their visual selected state is refreshed immediately.
        syncSelectionRowStates();
        return;
      }

      if (section && section.id && !event.target.closest('input[type="checkbox"]')) toggleSec(section.id);
      return;
    }

    const actionBtn = event.target.closest('[data-action][data-idx]');
    if (actionBtn) {
      const i = Number(actionBtn.dataset.idx);
      const action = actionBtn.dataset.action;
      if (action === 'edit-case') editCase(i);
      if (action === 'edit-timelog') editTimelog(i);
      if (action === 'toggle-submit') toggleSubmit(i);
      if (action === 'delete-item') deleteItem(i);
    }
  });

  document.getElementById('c-general')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-regional')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-mac')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-sedation')?.addEventListener('click', (event) => event.stopPropagation());

  document.getElementById('c-general')?.addEventListener('change', function () {
    autoOpen('sec-general', this);
  });
  document.getElementById('c-regional')?.addEventListener('change', function () {
    autoOpen('sec-regional', this);
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('.chk-item input[type="checkbox"], .count-row label input[type="checkbox"]')) {
      syncSelectionRowStates();
    }
  });

  syncSelectionRowStates();
  updateAnatomicalDetailsVisibility();
}

function bindProcedureDependencies() {
  const base = document.getElementById('c-cvl-actual');
  const picc = document.getElementById('c-cvl-picc');
  const nonPicc = document.getElementById('c-cvl-nonpicc');
  if (!base || !picc || !nonPicc) return;

  const syncCentralLineBase = () => {
    if (picc.checked || nonPicc.checked) {
      base.checked = true;
      base.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  picc.addEventListener('change', syncCentralLineBase);
  nonPicc.addEventListener('change', syncCentralLineBase);
}

// ============================================================
// INIT
// ============================================================
(async () => {
  initWelcomeScreen();
  bindUiEvents();
  bindProcedureDependencies();
  enhanceNumericInputs();
  initCaseMobilePager();

  // Autosave draft on any input change in the case pane
  document.getElementById('pane-case')?.addEventListener('input', saveDraft);
  document.getElementById('pane-case')?.addEventListener('change', saveDraft);

  // One-time migration: if running as extension page and chrome.storage is empty,
  // import any items previously saved to localStorage (file:// fallback).
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const existing = await new Promise(r => chrome.storage.local.get('typhon-items', d => r(d['typhon-items'])));
      if (!existing || existing.length === 0) {
        const lsData = localStorage.getItem('typhon-items');
        if (lsData) {
          const parsed = JSON.parse(lsData);
          if (parsed && parsed.length > 0) {
            await new Promise(r => chrome.storage.local.set({ 'typhon-items': parsed }, r));
            localStorage.removeItem('typhon-items');
            toast(`Migrated ${parsed.length} saved item(s) from local storage ✓`);
          }
        }
      }
    } catch (e) { /* ignore migration errors */ }
  }

  buildDayPills('day-pills',   null);
  buildDayPills('t-day-pills', null);
  restoreDraft();
  const items = (await store.get('typhon-items')) || [];
  updateBadge(items);

  // Refresh list/badge when auth changes (sign in/out) so cloud data appears immediately.
  window.addEventListener('typhon-auth-changed', async () => {
    const refreshed = (await store.get('typhon-items')) || [];
    updateBadge(refreshed);
    if (document.getElementById('pane-saved')?.classList.contains('active')) renderSaved();
  });
})();
