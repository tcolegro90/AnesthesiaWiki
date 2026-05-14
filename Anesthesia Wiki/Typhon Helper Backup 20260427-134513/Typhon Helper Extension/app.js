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
const _evalShareCol = 'typhonEvalShares';
let _activePreceptorToken = null;

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
    t.classList.toggle('active', ['case','time','eval','saved'][i] === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-' + name).classList.add('active');
  updateMobileEntryScrollLock();
  if (name === 'saved') renderSaved();
}

function updateMobileEntryScrollLock() {
  // Force unlock: scrolling must always be available.
  document.documentElement.classList.remove('mobile-entry-scroll-lock');
  document.body.classList.remove('mobile-entry-scroll-lock');
}

function installMobileScrollGuard() {
  // Disabled intentionally. Any global preventDefault on touch/wheel can freeze form scroll.
  return;
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
    const countInput = row.querySelector('.count-input');
    const hasCount = countInput ? Number(countInput.value || 0) > 0 : false;
    row.classList.toggle('selected', hasCount);
  });
}

function adjustCountInput(inputId, delta) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 99);
  const current = Number(input.value || 0);
  const next = Math.max(min, Math.min(max, current + delta));
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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
      ivStarts: Number(val('c-iv-n') || 0) > 0, ivStartsN: val('c-iv-n'),
      pocusA: Number(val('c-pocus-a-n') || 0) > 0, pocusAN: val('c-pocus-a-n'),
      usrA: Number(val('c-usr-a-n') || 0) > 0, usrAN: val('c-usr-a-n'),
      usvA: Number(val('c-usv-a-n') || 0) > 0, usvAN: val('c-usv-a-n'),
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

function getCheckedVals(gridId) {
  return [...document.querySelectorAll(`#${gridId} input[type="checkbox"]:checked`)].map(c => c.value);
}

function readEval() {
  return {
    id: Date.now().toString(), type: 'eval', submitted: false,
    date: getSelectedISO('e-day-pills'),
    preceptorName: val('e-preceptor'),
    preceptorPhone: val('e-preceptor-phone'),
    studentPhone: val('e-student-phone'),
    preceptorShareToken: val('e-preceptor-share-token'),
    facility: getCheckedVals('e-facility-grid'),
    arrivedPrepared: pickVal('e-arrived'),
    arrivedComments: val('e-arrived-comments'),
    ageRanges: getCheckedVals('e-age-grid'),
    asaClasses: getCheckedVals('e-asa-grid'),
    surgicalCases: getCheckedVals('e-surg-grid'),
    surgicalComments: val('e-surg-comments'),
    q8: pickVal('e-q8'), q8Comments: val('e-q8-comments'),
    q9: pickVal('e-q9'), q9Comments: val('e-q9-comments'),
    q10: pickVal('e-q10'), q10Comments: val('e-q10-comments'),
    q11: pickVal('e-q11'), q11Comments: val('e-q11-comments'),
    vigilant: pickVal('e-q12'), vigilantComments: val('e-q12-comments'),
    documentation: pickVal('e-q13'),
    postOpCare: pickVal('e-q14'), postOpCareComments: val('e-q14-comments'),
    daySummary: val('e-summary'),
    discussedStrengths: pickVal('e-q16'),
    discussedStrengthsOther: val('e-q16-other'),
    discussedStrengthsComments: val('e-q16-comments'),
    preceptorComments: val('e-preceptor-comments'),
    sigDataUrl: getSignatureDataUrl(),
    sigName: val('e-sig-name'),
  };
}

// ============================================================
// DRAFT AUTOSAVE
// ============================================================
function saveDraft() {
  try {
    localStorage.setItem('typhon-draft', JSON.stringify(readCase()));
    localStorage.setItem('typhon-case-progress-updated', String(Date.now()));
  } catch(e) {}
}
function clearDraft() {
  localStorage.removeItem('typhon-draft');
  localStorage.removeItem('typhon-case-progress-updated');
}
function saveTimeProgress() {
  try {
    localStorage.setItem('typhon-time-progress', JSON.stringify(readTimeLog()));
    localStorage.setItem('typhon-time-progress-updated', String(Date.now()));
  } catch(e) {}
}
function clearTimeProgress() {
  localStorage.removeItem('typhon-time-progress');
  localStorage.removeItem('typhon-time-progress-updated');
}
function saveEvalProgress() {
  try {
    localStorage.setItem('typhon-eval-progress', JSON.stringify(readEval()));
    localStorage.setItem('typhon-eval-progress-updated', String(Date.now()));
  } catch(e) {}
}
function clearEvalProgress() {
  localStorage.removeItem('typhon-eval-progress');
  localStorage.removeItem('typhon-eval-progress-updated');
}
function hasEvalProgress() {
  try {
    const raw = localStorage.getItem('typhon-eval-progress');
    if (!raw) return false;
    const e = JSON.parse(raw);
    if (!e || typeof e !== 'object') return false;
    return !!(e.preceptorName || e.q8 || e.arrivedPrepared || (e.facility || []).length);
  } catch { return false; }
}
function hasCaseProgress() {
  try {
    const raw = localStorage.getItem('typhon-draft');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return false;
    return !!(d.biologicalSex || d.anesStart || (d.anatomical || []).length || d.age);
  } catch {
    return false;
  }
}
function hasTimeProgress() {
  try {
    const raw = localStorage.getItem('typhon-time-progress');
    if (!raw) return false;
    const t = JSON.parse(raw);
    if (!t || typeof t !== 'object') return false;
    return !!(t.date || t.clockIn1 || t.clockOut1 || t.notes);
  } catch {
    return false;
  }
}
function progressUpdatedAt(kind) {
  const key = kind === 'case' ? 'typhon-case-progress-updated' : 'typhon-time-progress-updated';
  const raw = localStorage.getItem(key);
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}
function restoreTimeProgress() {
  try {
    const raw = localStorage.getItem('typhon-time-progress');
    if (!raw) return false;
    const t = JSON.parse(raw);
    if (!t || typeof t !== 'object') return false;
    resetTimeLog();
    if (t.date) setSelectedDayPill('t-day-pills', t.date);
    document.getElementById('t-in1').value = t.clockIn1 || '';
    document.getElementById('t-out1').value = t.clockOut1 || '';
    document.getElementById('t-notes').value = t.notes || '';
    toast('Continued your in-progress time log');
    return true;
  } catch {
    return false;
  }
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
      hemo:'c-hemo', mechVent:'c-mech-vent', cxr:'c-cxr', pain:'c-pain' };
    const pNumMap = { ivStartsN:'c-iv-n', pocusAN:'c-pocus-a-n', usrAN:'c-usr-a-n', usvAN:'c-usv-a-n' };
    Object.entries(d.procedures||{}).forEach(([k,v]) => {
      if (pMap[k]) {
        const el = document.getElementById(pMap[k]);
        if (el) el.checked = !!v;
      }
      if (pNumMap[k]) {
        const el = document.getElementById(pNumMap[k]);
        if (el) el.value = v || '';
      }
    });
    // Back-compat: older saved drafts may have only boolean flags for count rows.
    const proc = d.procedures || {};
    if (!val('c-iv-n') && proc.ivStarts) document.getElementById('c-iv-n').value = '1';
    if (!val('c-pocus-a-n') && proc.pocusA) document.getElementById('c-pocus-a-n').value = '1';
    if (!val('c-usr-a-n') && proc.usrA) document.getElementById('c-usr-a-n').value = '1';
    if (!val('c-usv-a-n') && proc.usvA) document.getElementById('c-usv-a-n').value = '1';
    const mMap = { none:'c-med-none', inhal:'c-med-inhal', ivInd:'c-med-iv-ind', nmb:'c-med-nmb', opioid:'c-med-opioid', other:'c-med-other' };
    Object.entries(d.medications||{}).forEach(([k,v]) => { if(mMap[k]) document.getElementById(mMap[k]).checked=!!v; });
    if (d.anesStart)    document.getElementById('c-as').value = d.anesStart;
    if (d.anesFinish)   document.getElementById('c-af').value = d.anesFinish;
    if (d.clinicalNotes) document.getElementById('c-notes').value = d.clinicalNotes;
    syncSelectionRowStates();
    toast('Continued your in-progress case');
  } catch(e) { console.warn('Draft restore failed', e); }
}

function setSelectedDayPill(containerId, iso) {
  if (!iso) return;
  const pill = document.querySelector(`#${containerId} .day-pill[data-iso="${iso}"]`);
  if (pill) {
    document.querySelectorAll(`#${containerId} .day-pill`).forEach(p => p.classList.remove('on'));
    pill.classList.add('on');
  }
}

function restoreTimeLogDraftFromItem(draft) {
  if (!draft || draft.type !== 'timelog') return;
  resetTimeLog();
  setSelectedDayPill('t-day-pills', draft.date);
  document.getElementById('t-in1').value = draft.clockIn1 || '';
  document.getElementById('t-out1').value = draft.clockOut1 || '';
  document.getElementById('t-notes').value = draft.notes || '';
  toast('Draft restored — your previous time log was not lost');
}

function restoreEvalDraftFromItem(draft) {
  if (!draft || draft.type !== 'eval') return;
  resetEval();
  setSelectedDayPill('e-day-pills', draft.date);
  loadEvalData(draft);
  toast('Draft restored — your previous evaluation was not lost');
}

function restoreEvalProgress() {
  try {
    const raw = localStorage.getItem('typhon-eval-progress');
    if (!raw) return false;
    const e = JSON.parse(raw);
    if (!e || typeof e !== 'object') return false;
    resetEval();
    if (e.date) setSelectedDayPill('e-day-pills', e.date);
    loadEvalData(e);
    toast('Continued your in-progress evaluation');
    return true;
  } catch { return false; }
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
  showStartScreen();
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
  clearTimeProgress();
  showStartScreen();
}

async function saveEval() {
  const e = readEval();
  if (!e.date)            { toast('Enter a date'); return; }
  if (!e.preceptorName)   { toast('Enter preceptor name'); return; }
  if (!e.facility.length) { toast('Select a facility'); return; }
  if (!e.arrivedPrepared) { toast('Answer arrival/preparation question (Q4)'); return; }
  if (!e.ageRanges.length){ toast('Select at least one age range (Q5)'); return; }
  if (!e.asaClasses.length){ toast('Select at least one ASA class (Q6)'); return; }
  if (!e.q8)              { toast('Rate preoperative assessment (Q8)'); return; }
  if (!e.q9)              { toast('Rate perioperative care (Q9)'); return; }
  if (!e.q10)             { toast('Rate clinical skills (Q10)'); return; }
  if (!e.q11)             { toast('Rate critical thinking (Q11)'); return; }
  if (!e.vigilant)        { toast('Answer vigilance question (Q12)'); return; }
  if (!e.postOpCare)      { toast('Answer post-op care question (Q14)'); return; }
  if (!e.discussedStrengths) { toast('Answer strength/weakness discussion (Q16)'); return; }
  const items = (await store.get('typhon-items')) || [];
  items.push(e);
  const writeResult = await store.set('typhon-items', items);
  updateBadge(items);
  if (writeResult?.cloud) toast('Evaluation saved + cloud synced');
  else if (_getAuthUid()) toast('Saved locally. Cloud sync failed.');
  else toast('Evaluation saved locally (not signed in)');
  clearEvalProgress();
  resetEval();
  showStartScreen();
}

async function saveDraftEval() {
  const e = readEval();
  e.draft = true;
  const items = (await store.get('typhon-items')) || [];
  const existingIdx = items.findIndex(i => i.draft && i.type === 'eval');
  if (existingIdx >= 0) {
    items[existingIdx] = e;
  } else {
    items.push(e);
  }
  await store.set('typhon-items', items);
  updateBadge(items);
  clearEvalProgress();
  resetEval();
  toast('Evaluation draft saved — resume it anytime from the Saved tab');
  showStartScreen();
}

async function saveDraftCase() {
  const c = readCase();
  c.draft = true;
  const items = (await store.get('typhon-items')) || [];
  // One draft at a time — replace any existing case draft
  const existingIdx = items.findIndex(i => i.draft && i.type === 'case');
  if (existingIdx >= 0) {
    items[existingIdx] = c;
  } else {
    items.push(c);
  }
  await store.set('typhon-items', items);
  updateBadge(items);
  clearDraft();
  resetCase();
  hideDraftBanner();
  toast('Draft saved — resume it anytime from the Saved tab');
  showStartScreen();
}

async function saveDraftTimeLog() {
  const t = readTimeLog();
  t.draft = true;
  const items = (await store.get('typhon-items')) || [];
  // One draft at a time — replace any existing time log draft
  const existingIdx = items.findIndex(i => i.draft && i.type === 'timelog');
  if (existingIdx >= 0) {
    items[existingIdx] = t;
  } else {
    items.push(t);
  }
  await store.set('typhon-items', items);
  updateBadge(items);
  resetTimeLog();
  clearTimeProgress();
  toast('Time log draft saved — resume it anytime from the Saved tab');
  showStartScreen();
}

async function resumeDraftItem(i) {
  const items = (await store.get('typhon-items')) || [];
  const draft = items[i];
  if (!draft || !draft.draft) return;
  items.splice(i, 1);
  await store.set('typhon-items', items);
  updateBadge(items);
  renderSaved();
  if (draft.type === 'timelog') {
    restoreTimeLogDraftFromItem(draft);
    goTab('time');
  } else if (draft.type === 'eval') {
    restoreEvalDraftFromItem(draft);
    goTab('eval');
  } else {
    // Reuse restoreDraft machinery by writing into the temp localStorage key
    localStorage.setItem('typhon-draft', JSON.stringify(draft));
    restoreDraft();
    goTab('case');
  }
  hideDraftBanner();
}

function showDraftBanner() {
  document.getElementById('draft-banner')?.classList.add('visible');
}

function hideDraftBanner() {
  document.getElementById('draft-banner')?.classList.remove('visible');
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

function resetEval() {
  clearEvalProgress();
  document.querySelectorAll('#pane-eval .btn-tog').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('#pane-eval input[type="checkbox"]').forEach(c => c.checked = false);
  document.querySelectorAll('#pane-eval input[type="text"]').forEach(i => i.value = '');
  document.querySelectorAll('#pane-eval textarea').forEach(t => t.value = '');
  const otherInput = document.getElementById('e-q16-other');
  if (otherInput) otherInput.style.display = 'none';
  clearSignature();
  const pills = document.querySelectorAll('#e-day-pills .day-pill');
  pills.forEach(p => p.classList.remove('on'));
  if (pills[0]) pills[0].classList.add('on');
  syncSelectionRowStates();
  if (evalPager && typeof evalPager.render === 'function') {
    evalPager.index = 0;
    evalPager.render();
  }
}

// ============================================================
// SIGNATURE CANVAS
// ============================================================
let _sigCtx = null;
let _sigDrawing = false;
let _sigHasSig = false;

function initSignatureCanvas() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  canvas.style.touchAction = 'none';
  _sigCtx = canvas.getContext('2d');
  _sigCtx.strokeStyle = '#1a1a1a';
  _sigCtx.lineWidth = 2;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('mousedown', (e) => {
    _sigDrawing = true;
    _sigCtx.beginPath();
    const p = getPos(e);
    _sigCtx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!_sigDrawing) return;
    const p = getPos(e);
    _sigCtx.lineTo(p.x, p.y);
    _sigCtx.stroke();
    _sigHasSig = true;
  });
  canvas.addEventListener('mouseup', () => { _sigDrawing = false; });
  canvas.addEventListener('mouseleave', () => { _sigDrawing = false; });
  canvas.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    _sigDrawing = true;
    _sigCtx.beginPath();
    const p = getPos(e);
    _sigCtx.moveTo(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!_sigDrawing) return;
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    _sigCtx.lineTo(p.x, p.y);
    _sigCtx.stroke();
    _sigHasSig = true;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (e.cancelable) e.preventDefault();
    _sigDrawing = false;
  }, { passive: false });
  canvas.addEventListener('touchcancel', () => { _sigDrawing = false; }, { passive: true });
  document.getElementById('e-sig-clear')?.addEventListener('click', clearSignature);
}

function clearSignature() {
  if (!_sigCtx) return;
  const canvas = document.getElementById('sig-canvas');
  if (canvas) _sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  _sigHasSig = false;
}

function getSignatureDataUrl() {
  if (!_sigHasSig) return '';
  const canvas = document.getElementById('sig-canvas');
  return canvas ? canvas.toDataURL('image/png') : '';
}

// ============================================================
// RENDER SAVED
// ============================================================
function renderItemCard({ item, i }) {
  if (item.draft && item.type === 'timelog') {
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📝 Draft Time Log — ${dateStr}</div>
          <div class="saved-item-sub">${item.clockIn1 || '?'} → ${item.clockOut1 || '?'}${item.notes ? '  |  Notes saved' : ''}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }

  if (item.draft && item.type === 'eval') {
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Draft Eval — ${dateStr}</div>
          <div class="saved-item-sub">Preceptor: ${item.preceptorName || '—'}${item.facility?.[0] ? '  |  ' + item.facility[0] : ''}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }

  if (item.draft) {
    const anesLine = [item.general?'General':'', item.regional?'Regional':'', item.mac?'MAC':'', item.sedation?'Sedation':''].filter(Boolean).join(' · ') || '—';
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📝 Draft Case — ${dateStr} · ASA ${item.asa||'?'} · ${item.biologicalSex||'?'} · Age ${item.age||'?'}</div>
          <div class="saved-item-sub">${anesLine} &nbsp;|&nbsp; ${item.anatomical?.join(', ')||'No category'}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
  if (item.type === 'timelog') {
    const isPending = !item.submitted;
    return `<div class="saved-item">
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
  }
  if (item.type === 'eval') {
    const isPending = !item.submitted;
    const ratingLine = [item.q8, item.q9, item.q10, item.q11].filter(Boolean).join(' · ') || '—';
    const phoneLine = item.preceptorPhone ? ` &nbsp;|&nbsp; ${item.preceptorPhone}` : '';
    const preceptorBadge = item.preceptorReviewStatus === 'completed'
      ? ' &nbsp;<span class="badge badge-preceptor-done">✅ Preceptor Signed</span>'
      : (item.preceptorShareToken ? ' &nbsp;<span class="badge badge-preceptor-pending">⏳ Awaiting Preceptor</span>' : '');
    return `<div class="saved-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Daily Eval — ${fmtDate(item.date)}</div>
          <div class="saved-item-sub">Preceptor: ${item.preceptorName || '—'} &nbsp;|&nbsp; ${item.facility?.[0] || '—'}${phoneLine}${preceptorBadge}</div>
          <div class="saved-item-sub">${ratingLine}</div>
        </div>
        <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="edit-eval" data-idx="${i}">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" data-action="text-eval" data-idx="${i}">📱 Text Preceptor</button>
        <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
  // Case log (default)
  {
    const isPending = !item.submitted;
    const anesLine = [item.general?'General':'', item.regional?'Regional':'', item.mac?'MAC':'', item.sedation?'Sedation':''].filter(Boolean).join(' · ') || '—';
    const anatomLine = item.anatomical?.join(', ') || 'No category';
    const timeLine = (item.anesStart || item.anesFinish)
      ? `${item.anesStart||'?'} → ${item.anesFinish||'?'}`
      : 'No times recorded';
    return `<div class="saved-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Age ${item.age||'?'} · ${item.biologicalSex||'?'} · ASA ${item.asa||'?'}</div>
          <div class="saved-item-sub">${timeLine}</div>
          <div class="saved-item-sub">${anesLine} &nbsp;|&nbsp; ${anatomLine}</div>
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
}

function captureSavedUiState(rootEl) {
  if (!rootEl) return null;
  const openKeys = [...rootEl.querySelectorAll('.submitted-folder.open, .date-folder.open')]
    .map((el) => el.dataset.folderKey)
    .filter(Boolean);
  return {
    scrollY: window.scrollY,
    openKeys
  };
}

function restoreSavedUiState(rootEl, state) {
  if (!rootEl || !state) return;
  (state.openKeys || []).forEach((key) => {
    const folder = rootEl.querySelector(`[data-folder-key="${key}"]`);
    if (folder) folder.classList.add('open');
  });
  window.scrollTo({ top: state.scrollY || 0, behavior: 'auto' });
}

async function renderSaved(options = {}) {
  const preserveUi = !!options.preserveUi;
  const items = (await store.get('typhon-items')) || [];
  const el = document.getElementById('saved-list');
  const savedUiState = preserveUi ? captureSavedUiState(el) : null;

  const indexed = [...items].map((item, i) => ({ item, i }));

  // Split into drafts, pending (non-draft), and submitted
  const drafts = indexed.filter(({ item }) => !!item.draft)
    .sort((a, b) => {
      const dateCmp = (b.item.date || '').localeCompare(a.item.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.item.anesStart || '').localeCompare(b.item.anesStart || '');
    });
  const pending = indexed.filter(({ item }) => !item.draft && !item.submitted)
    .sort((a, b) => {
      const dateCmp = (b.item.date || '').localeCompare(a.item.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.item.anesStart || '').localeCompare(b.item.anesStart || '');
    });
  const submitted = indexed.filter(({ item }) => !item.draft && item.submitted)
    .sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
  const submittedCases = submitted.filter(({ item }) => item.type === 'case');
  const submittedTimeLogs = submitted.filter(({ item }) => item.type === 'timelog');
  const submittedEvals = submitted.filter(({ item }) => item.type === 'eval');

  let html = '';

  // --- Drafts folder ---
  const draftCards = drafts.length
    ? drafts.map(entry => renderItemCard(entry)).join('')
    : '<div class="saved-item"><div class="saved-item-sub">No drafts here yet.</div></div>';
  html += `<div class="submitted-folder open" id="drafts-folder" data-folder-key="drafts-root">
    <div class="submitted-folder-header">
      <div class="submitted-folder-title">📝 Drafts <span class="submitted-folder-meta">${drafts.length} item${drafts.length !== 1 ? 's' : ''}</span></div>
      <span class="folder-chevron">▶</span>
    </div>
    <div class="submitted-folder-body">${draftCards}</div>
  </div>`;

  // --- Pending section ---
  if (pending.length) {
    html += `<div id="pending-list">${pending.map(entry => renderItemCard(entry)).join('')}</div>`;
  }

  // --- Submitted folder ---
  let submittedHtml = '';

  if (submittedCases.length) {
      const byDate = {};
      submittedCases.forEach(entry => {
        const key = entry.item.date || 'unknown';
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(entry);
      });
      const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

      const caseDateFolders = dateKeys.map(iso => {
        const entries = byDate[iso].sort((a, b) => (a.item.anesStart || '').localeCompare(b.item.anesStart || ''));
        const label = fmtDateLong(iso);
        const cards = entries.map(entry => renderItemCard(entry)).join('');
        return `<div class="date-folder" data-folder-key="case-date-${iso}">
          <div class="date-folder-header">
            <div class="date-folder-title">📅 ${label}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
              <span class="folder-chevron">▶</span>
            </div>
          </div>
          <div class="date-folder-body">${cards}</div>
        </div>`;
      }).join('');

    submittedHtml += `<div class="date-folder" data-folder-key="submitted-case-logs">
        <div class="date-folder-header">
          <div class="date-folder-title">📋 Case Logs</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${submittedCases.length} item${submittedCases.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${caseDateFolders}</div>
      </div>`;
  }

  if (submittedTimeLogs.length) {
      const byMonth = {};
      submittedTimeLogs.forEach(entry => {
        const key = monthKey(entry.item.date);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(entry);
      });
      const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

      const monthFolders = monthKeys.map(key => {
        const entries = byMonth[key].sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
        const cards = entries.map(entry => renderItemCard(entry)).join('');
        return `<div class="date-folder" data-folder-key="timelog-month-${key}">
          <div class="date-folder-header">
            <div class="date-folder-title">🗂 ${fmtMonthYear(key)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
              <span class="folder-chevron">▶</span>
            </div>
          </div>
          <div class="date-folder-body">${cards}</div>
        </div>`;
      }).join('');

    submittedHtml += `<div class="date-folder" data-folder-key="submitted-time-logs">
        <div class="date-folder-header">
          <div class="date-folder-title">⏱ Time Logs</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${submittedTimeLogs.length} item${submittedTimeLogs.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${monthFolders}</div>
      </div>`;
  }

  if (submittedEvals.length) {
    const byDate = {};
    submittedEvals.forEach(entry => {
      const key = entry.item.date || 'unknown';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(entry);
    });
    const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    const evalDateFolders = dateKeys.map(iso => {
      const entries = byDate[iso];
      const label = fmtDateLong(iso);
      const cards = entries.map(entry => renderItemCard(entry)).join('');
      return `<div class="date-folder" data-folder-key="eval-date-${iso}">
        <div class="date-folder-header">
          <div class="date-folder-title">📅 ${label}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${cards}</div>
      </div>`;
    }).join('');
    submittedHtml += `<div class="date-folder" data-folder-key="submitted-evals">
      <div class="date-folder-header">
        <div class="date-folder-title">📋 Daily Evaluations</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="date-folder-count">${submittedEvals.length} item${submittedEvals.length !== 1 ? 's' : ''}</span>
          <span class="folder-chevron">▶</span>
        </div>
      </div>
      <div class="date-folder-body">${evalDateFolders}</div>
    </div>`;
  }

  if (!submittedHtml) {
    submittedHtml = '<div class="saved-item"><div class="saved-item-sub">No submitted items yet.</div></div>';
  }

  html += `<div class="submitted-folder" id="submitted-folder" data-folder-key="submitted-root">
    <div class="submitted-folder-header">
      <div class="submitted-folder-title">📁 Submitted <span class="submitted-folder-meta">${submitted.length} item${submitted.length !== 1 ? 's' : ''}</span></div>
      <span class="folder-chevron">▶</span>
    </div>
    <div class="submitted-folder-body">${submittedHtml}</div>
  </div>`;

  el.innerHTML = html;
  if (savedUiState) restoreSavedUiState(el, savedUiState);

  // Silently check Firestore for any pending preceptor reviews
  syncPendingEvals().catch(() => {});
}

// Background auto-sync: check all pending evals against Firestore and merge if completed.
let _syncPendingRunning = false;
async function syncPendingEvals() {
  if (_syncPendingRunning) return;
  const db = getFirestore();
  if (!db) return;

  const items = (await store.get('typhon-items')) || [];
  const pendingIdx = items.reduce((acc, item, i) => {
    if (item.type === 'eval' && item.preceptorShareToken && item.preceptorReviewStatus !== 'completed') {
      acc.push(i);
    }
    return acc;
  }, []);
  if (!pendingIdx.length) return;

  _syncPendingRunning = true;
  let anyChanged = false;
  try {
    for (const i of pendingIdx) {
      const item = items[i];
      try {
        const snap = await db.collection(_evalShareCol).doc(item.preceptorShareToken).get();
        if (!snap.exists) continue;
        const d = snap.data() || {};
        if (d.status !== 'completed' || !d.preceptorSubmission) continue;

        items[i] = {
          ...item,
          ...d.preceptorSubmission,
          id: item.id,
          type: 'eval',
          submitted: item.submitted,
          preceptorShareToken: item.preceptorShareToken,
          preceptorReviewStatus: 'completed',
          preceptorReviewCompletedAt: d.completedAt || Date.now()
        };
        anyChanged = true;
      } catch {}
    }

    if (anyChanged) {
      await store.set('typhon-items', items);
      await renderSaved({ preserveUi: true });
      toast('Preceptor review synced ✓');
    }
  } finally {
    _syncPendingRunning = false;
  }
}

async function toggleSubmit(i) {
  const items = (await store.get('typhon-items')) || [];
  items[i].submitted = !items[i].submitted;
  await store.set('typhon-items', items);
  updateBadge(items);
  await renderSaved({ preserveUi: true });
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

function normalizePhoneForSms(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/[^\d+]/g, '');
}

function createRandomToken() {
  const bytes = new Uint8Array(24);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getReviewBaseUrl() {
  const cfg = window.TYPHON_FIREBASE_CONFIG || {};
  if (cfg.preceptorReviewBaseUrl) return cfg.preceptorReviewBaseUrl;
  if (window.location.protocol === 'chrome-extension:') {
    if (cfg.projectId) {
      return `https://${cfg.projectId}.web.app/Typhon%20Helper/TyphonCaseHelper.html`;
    }
    return '';
  }
  const u = new URL(window.location.href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

async function ensureFirebaseAuthForShare() {
  try {
    if (!(firebase && firebase.apps && firebase.apps.length)) return;
    const auth = firebase.auth(firebase.apps[0]);
    if (auth.currentUser) return;
    await auth.signInAnonymously();
  } catch (e) {
    console.warn('Anonymous auth unavailable for share flow', e);
  }
}

async function createOrUpdateEvalShare(evalData, existingToken) {
  const db = getFirestore();
  if (!db) throw new Error('Cloud database unavailable.');

  const baseUrl = getReviewBaseUrl();
  if (!baseUrl) throw new Error('Set preceptorReviewBaseUrl in firebase config for extension use.');

  await ensureFirebaseAuthForShare();
  const ownerUid = _getAuthUid();
  if (!ownerUid) {
    throw new Error('Please sign in before sending a preceptor review link.');
  }

  const incomingRecipientPhone = normalizePhoneForSms(evalData.preceptorPhone || '');
  const incomingRecipientName = String(evalData.preceptorName || '').trim().toLowerCase();

  let token = existingToken || createRandomToken();
  if (existingToken) {
    try {
      const existingSnap = await db.collection(_evalShareCol).doc(existingToken).get();
      if (existingSnap.exists) {
        const existingData = existingSnap.data() || {};
        const existingRecipientPhone = normalizePhoneForSms(existingData.recipientPhone || '');
        const existingRecipientName = String(existingData.recipientName || '').trim().toLowerCase();
        const phoneChanged = !!(incomingRecipientPhone && existingRecipientPhone && incomingRecipientPhone !== existingRecipientPhone);
        const nameChanged = !!(incomingRecipientName && existingRecipientName && incomingRecipientName !== existingRecipientName);
        if (phoneChanged || nameChanged) token = createRandomToken();
      }
    } catch (e) {
      console.warn('Could not validate existing eval share recipient, rotating token', e);
      token = createRandomToken();
    }
  }

  const ref = db.collection(_evalShareCol).doc(token);
  await ref.set({
    token,
    status: 'pending',
    ownerUid,
    recipientName: evalData.preceptorName || null,
    recipientPhone: evalData.preceptorPhone || null,
    studentPhone: evalData.studentPhone || null,
    eval: evalData,
    updatedAt: Date.now(),
    createdAt: firebase?.firestore?.FieldValue?.serverTimestamp
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  }, { merge: true });

  const reviewUrl = new URL(baseUrl);
  reviewUrl.searchParams.set('preceptorToken', token);
  return { token, reviewUrl: reviewUrl.toString() };
}

function buildEvalTextMessage(e) {
  const facilityText = (e.facility || []).join(', ') || 'N/A';
  const ratings = [e.q8, e.q9, e.q10, e.q11].filter(Boolean).join(' | ') || 'N/A';
  return [
    `Daily Eval - ${fmtDate(e.date)}`,
    `Preceptor: ${e.preceptorName || 'N/A'}`,
    `Facility: ${facilityText}`,
    `Ratings (Q8-Q11): ${ratings}`,
    e.daySummary ? `Student Summary: ${e.daySummary}` : null,
    e.preceptorComments ? `Preceptor Comments: ${e.preceptorComments}` : null,
    e.sigName ? `Signature Name: ${e.sigName}` : null,
    '',
    'Please review, edit if needed, and sign in Typhon.'
  ].filter(Boolean).join('\n');
}

function buildEvalShareTextMessage(e, reviewUrl) {
  return [
    `Hi ${e.preceptorName || 'Preceptor'}, please review/sign my Daily Eval from ${fmtDate(e.date)}.`,
    '',
    `Open secure review link: ${reviewUrl}`,
    '',
    'You can edit comments, sign, and submit from that page.'
  ].join('\n');
}

function buildStudentReturnTextMessage(e) {
  return [
    `Daily Eval from ${fmtDate(e.date)} has been completed and sent back.`,
    `Preceptor: ${e.preceptorName || 'N/A'}`,
    '',
    'Open Typhon Helper — your eval will sync automatically.'
  ].join('\n');
}

async function ensureStudentPhoneForAutoConfirm(evalData) {
  const hiddenEl = document.getElementById('e-student-phone');
  let phone = (evalData.studentPhone || hiddenEl?.value || '').trim();

  if (!phone) {
    try {
      phone = (localStorage.getItem('typhon-student-phone') || '').trim();
    } catch {}
  }

  if (!phone) {
    const entered = await promptPhone('Your Phone (Optional)', 'Enter YOUR mobile number so the preceptor can send the eval back to you automatically.');
    if (entered) phone = entered.trim();
  }

  const normalized = normalizePhoneForSms(phone);
  if (phone && !normalized) {
    toast('Student phone skipped: invalid format');
  }

  const finalPhone = normalized ? phone : '';
  if (hiddenEl) hiddenEl.value = finalPhone;
  evalData.studentPhone = finalPhone;

  if (finalPhone) {
    try { localStorage.setItem('typhon-student-phone', finalPhone); } catch {}
  }

  return normalizePhoneForSms(finalPhone);
}

async function openStudentAutoConfirmText(evalData) {
  const normalized = normalizePhoneForSms(evalData.studentPhone || '');
  if (!normalized) return false;

  const body = buildStudentReturnTextMessage(evalData);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied student confirmation text. Paste into your message app.');
      return true;
    } catch {
      return false;
    }
  }
}

function promptPhone(title, subtitle, defaultVal = '') {
  return new Promise((resolve) => {
    const overlay  = document.getElementById('phone-prompt-overlay');
    const titleEl  = document.getElementById('phone-prompt-title');
    const subEl    = document.getElementById('phone-prompt-subtitle');
    const input    = document.getElementById('phone-prompt-input');
    const btnOk    = document.getElementById('phone-prompt-confirm');
    const btnCancel = document.getElementById('phone-prompt-cancel');

    // Fallback for extension environment where modal may not exist
    if (!overlay || !input) {
      const entered = window.prompt(title + (subtitle ? '\n' + subtitle : ''), defaultVal);
      resolve(entered ? entered.trim() : null);
      return;
    }

    titleEl.textContent = title;
    subEl.textContent   = subtitle || '';
    input.value         = defaultVal ? formatPhoneDisplay(defaultVal) : '';

    function formatPhoneDisplay(raw) {
      const digits = raw.replace(/\D/g, '').slice(0, 10);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return digits.slice(0,3) + '-' + digits.slice(3);
      return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
    }

    function onInput() {
      const raw   = input.value.replace(/\D/g, '').slice(0, 10);
      const caret = input.selectionStart;
      const oldLen = input.value.length;
      input.value = formatPhoneDisplay(raw);
      // Restore caret roughly
      const diff = input.value.length - oldLen;
      try { input.setSelectionRange(caret + diff, caret + diff); } catch {}
    }

    function cleanup() {
      input.removeEventListener('input', onInput);
      btnOk.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      overlay.classList.remove('open');
    }

    function onConfirm() {
      cleanup();
      const val = input.value.trim();
      resolve(val || null);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    input.addEventListener('input', onInput);
    btnOk.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);

    overlay.classList.add('open');
    // Small delay so the overlay transition finishes before focusing
    setTimeout(() => { try { input.focus(); } catch {} }, 80);
  });
}

async function textEval(i) {
  const items = (await store.get('typhon-items')) || [];
  const e = items[i];
  if (!e || e.type !== 'eval') return;

  let phone = (e.preceptorPhone || '').trim();
  if (!phone) {
    const entered = await promptPhone('Preceptor Phone', 'Enter the preceptor\'s mobile number to send the eval link.');
    if (!entered) return;
    phone = entered.trim();
    e.preceptorPhone = phone;
    items[i] = e;
    await store.set('typhon-items', items);
    updateBadge(items);
    renderSaved({ preserveUi: true });
  }

  const normalized = normalizePhoneForSms(phone);
  if (!normalized) {
    toast('Enter a valid preceptor phone number');
    return;
  }

  await ensureStudentPhoneForAutoConfirm(e);

  let share;
  try {
    share = await createOrUpdateEvalShare(e, e.preceptorShareToken);
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Could not create preceptor review link');
    return;
  }

  e.preceptorShareToken = share.token;
  e.preceptorReviewStatus = 'pending';
  items[i] = e;
  await store.set('typhon-items', items);
  renderSaved({ preserveUi: true });

  const body = buildEvalShareTextMessage(e, share.reviewUrl);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    toast('Opened text draft');
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied eval text. Paste into your message app.');
    } catch {
      toast('Could not open texting app on this device');
    }
  }
}

async function textCurrentEval() {
  const e = readEval();
  if (!e.preceptorName) {
    toast('Enter preceptor name first');
    return;
  }

  let phone = (e.preceptorPhone || '').trim();
  if (!phone) {
    const entered = await promptPhone('Preceptor Phone', 'Enter the preceptor\'s mobile number to send the eval link.');
    if (!entered) return;
    phone = entered.trim();
    const phoneEl = document.getElementById('e-preceptor-phone');
    if (phoneEl) phoneEl.value = phone;
  }

  const normalized = normalizePhoneForSms(phone);
  if (!normalized) {
    toast('Enter a valid preceptor phone number');
    return;
  }

  e.preceptorPhone = phone;
  await ensureStudentPhoneForAutoConfirm(e);
  let share;
  try {
    share = await createOrUpdateEvalShare(e, e.preceptorShareToken);
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Could not create preceptor review link');
    return;
  }
  e.preceptorShareToken = share.token;
  const tokenEl = document.getElementById('e-preceptor-share-token');
  if (tokenEl) tokenEl.value = share.token;

  const body = buildEvalShareTextMessage(e, share.reviewUrl);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    toast('Opened text draft');
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied eval text. Paste into your message app.');
    } catch {
      toast('Could not open texting app on this device');
    }
  }
}

async function pullPreceptorUpdate(i) {
  const items = (await store.get('typhon-items')) || [];
  const item = items[i];
  if (!item || item.type !== 'eval' || !item.preceptorShareToken) {
    toast('No linked preceptor review found for this eval');
    return;
  }

  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable');
    return;
  }

  try {
    const snap = await db.collection(_evalShareCol).doc(item.preceptorShareToken).get();
    if (!snap.exists) {
      toast('Preceptor link not found');
      return;
    }
    const d = snap.data() || {};
    if (d.status !== 'completed' || !d.preceptorSubmission) {
      toast('Preceptor review is still pending');
      return;
    }

    const merged = {
      ...item,
      ...d.preceptorSubmission,
      id: item.id,
      type: 'eval',
      submitted: item.submitted,
      preceptorShareToken: item.preceptorShareToken,
      preceptorReviewStatus: 'completed',
      preceptorReviewCompletedAt: d.completedAt || Date.now()
    };

    items[i] = merged;
    await store.set('typhon-items', items);
    renderSaved({ preserveUi: true });
    toast('Pulled preceptor edits and signature');
  } catch (e) {
    console.error(e);
    toast('Could not pull preceptor update');
  }
}

async function initPreceptorReviewMode() {
  const params = new URLSearchParams(window.location.search);
  const token = (params.get('preceptorToken') || '').trim();
  if (!token) return;

  _activePreceptorToken = token;
  const tokenEl = document.getElementById('e-preceptor-share-token');
  if (tokenEl) tokenEl.value = token;
  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable for review link');
    return;
  }

  await ensureFirebaseAuthForShare();

  try {
    const snap = await db.collection(_evalShareCol).doc(token).get();
    if (!snap.exists) {
      toast('This review link is invalid or expired');
      return;
    }

    const d = snap.data() || {};
    const evalData = d.preceptorSubmission || d.eval;
    if (!evalData) {
      toast('No evaluation found for this link');
      return;
    }
    if (!evalData.studentPhone && d.studentPhone) evalData.studentPhone = d.studentPhone;

    hideStartScreen();
    goTab('eval');
    resetEval();
    setSelectedDayPill('e-day-pills', evalData.date || todayISO());
    loadEvalData(evalData);

    const banner = document.getElementById('preceptor-review-banner');
    const submitBtn = document.getElementById('btn-submit-preceptor-review');
    const saveBtn = document.getElementById('btn-save-eval');
    const draftBtn = document.getElementById('btn-draft-eval');
    const textBtn = document.getElementById('btn-text-eval');

    if (banner) {
      banner.style.display = 'block';
      banner.textContent = d.status === 'completed'
        ? 'This review was already submitted. You can update and submit again if needed.'
        : 'Preceptor Review Mode: review, edit, sign, then tap Send Back.';
    }
    if (submitBtn) submitBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';
    if (draftBtn) draftBtn.style.display = 'none';
    if (textBtn) textBtn.style.display = 'none';
  } catch (e) {
    console.error(e);
    toast('Could not load preceptor review link');
  }
}

async function submitPreceptorReview() {
  const tokenFromUrl = (() => {
    try { return new URLSearchParams(window.location.search).get('preceptorToken') || ''; } catch { return ''; }
  })();
  const tokenFromField = (document.getElementById('e-preceptor-share-token')?.value || '').trim();
  const submitToken = (_activePreceptorToken || tokenFromUrl || tokenFromField || '').trim();

  if (!submitToken) {
    toast('No active preceptor review token');
    return;
  }
  _activePreceptorToken = submitToken;

  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable');
    return;
  }

  const evalData = readEval();

  try {
    await db.collection(_evalShareCol).doc(_activePreceptorToken).set({
      status: 'completed',
      preceptorSubmission: evalData,
      completedAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });

    await openStudentAutoConfirmText(evalData);

    const banner = document.getElementById('preceptor-review-banner');
    if (banner) banner.textContent = 'Submitted back successfully. You can close this page.';
    toast('Sent back to student');
  } catch (e) {
    console.error(e);
    toast(e?.message ? `Could not submit: ${e.message}` : 'Could not submit preceptor review');
  }
}

// ============================================================
// UTILS
// ============================================================
function todayISO() { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso) { if (!iso) return '?'; const [y,m,d] = iso.split('-'); return `${m}/${d}/${y}`; }
function fmtDateLong(iso) {
  if (!iso) return 'Unknown Date';
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
  return `${dow}, ${m}/${d}/${y}`;
}

function monthKey(iso) {
  if (!iso) return 'unknown';
  const [y, m] = iso.split('-');
  return `${y}-${m}`;
}

function fmtMonthYear(key) {
  if (!key || key === 'unknown') return 'Unknown Month';
  const [y, m] = key.split('-');
  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m) - 1] || m;
  return `${monthName} ${y}`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

function updateBadge(items) {
  const n = items.filter(i => !i.submitted && !i.draft).length;
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
    hemo:'c-hemo', mechVent:'c-mech-vent', cxr:'c-cxr', pain:'c-pain' };
  const pNumMap = { ivStartsN:'c-iv-n', pocusAN:'c-pocus-a-n', usrAN:'c-usr-a-n', usvAN:'c-usv-a-n' };
  Object.entries(p).forEach(([k,v]) => {
    if (pMap[k]) {
      const el = document.getElementById(pMap[k]);
      if (el) el.checked = !!v;
    }
    if (pNumMap[k]) {
      const el = document.getElementById(pNumMap[k]);
      if (el) el.value = v || '';
    }
  });
  if (!val('c-iv-n') && p.ivStarts) document.getElementById('c-iv-n').value = '1';
  if (!val('c-pocus-a-n') && p.pocusA) document.getElementById('c-pocus-a-n').value = '1';
  if (!val('c-usr-a-n') && p.usrA) document.getElementById('c-usr-a-n').value = '1';
  if (!val('c-usv-a-n') && p.usvA) document.getElementById('c-usv-a-n').value = '1';
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

function loadEvalData(e) {
  if (e.preceptorName) document.getElementById('e-preceptor').value = e.preceptorName;
  if (e.preceptorPhone) {
    const phoneEl = document.getElementById('e-preceptor-phone');
    if (phoneEl) phoneEl.value = e.preceptorPhone;
  }
  if (e.studentPhone) {
    const studentPhoneEl = document.getElementById('e-student-phone');
    if (studentPhoneEl) studentPhoneEl.value = e.studentPhone;
  }
  if (e.preceptorShareToken) {
    const tokenEl = document.getElementById('e-preceptor-share-token');
    if (tokenEl) tokenEl.value = e.preceptorShareToken;
  }
  document.querySelectorAll('#e-facility-grid input[type="checkbox"]').forEach(c => {
    c.checked = (e.facility || []).includes(c.value);
  });
  document.querySelectorAll('#e-arrived .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === e.arrivedPrepared));
  if (e.arrivedComments) document.getElementById('e-arrived-comments').value = e.arrivedComments;
  document.querySelectorAll('#e-age-grid input[type="checkbox"]').forEach(c => {
    c.checked = (e.ageRanges || []).includes(c.value);
  });
  document.querySelectorAll('#e-asa-grid input[type="checkbox"]').forEach(c => {
    c.checked = (e.asaClasses || []).includes(c.value);
  });
  document.querySelectorAll('#e-surg-grid input[type="checkbox"]').forEach(c => {
    c.checked = (e.surgicalCases || []).includes(c.value);
  });
  if (e.surgicalComments) document.getElementById('e-surg-comments').value = e.surgicalComments;
  ['q8','q9','q10','q11'].forEach(q => {
    document.querySelectorAll(`#e-${q} .btn-tog`).forEach(b => b.classList.toggle('on', b.dataset.v === e[q]));
    const el = document.getElementById(`e-${q}-comments`);
    if (el && e[`${q}Comments`]) el.value = e[`${q}Comments`];
  });
  document.querySelectorAll('#e-q12 .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === e.vigilant));
  const q12c = document.getElementById('e-q12-comments'); if (q12c && e.vigilantComments) q12c.value = e.vigilantComments;
  document.querySelectorAll('#e-q13 .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === e.documentation));
  document.querySelectorAll('#e-q14 .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === e.postOpCare));
  const q14c = document.getElementById('e-q14-comments'); if (q14c && e.postOpCareComments) q14c.value = e.postOpCareComments;
  const sumEl = document.getElementById('e-summary'); if (sumEl && e.daySummary) sumEl.value = e.daySummary;
  document.querySelectorAll('#e-q16 .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === e.discussedStrengths));
  if (e.discussedStrengthsOther) {
    const otherInput = document.getElementById('e-q16-other');
    if (otherInput) { otherInput.value = e.discussedStrengthsOther; otherInput.style.display = ''; }
  }
  const q16c = document.getElementById('e-q16-comments'); if (q16c && e.discussedStrengthsComments) q16c.value = e.discussedStrengthsComments;
  const pcEl = document.getElementById('e-preceptor-comments'); if (pcEl && e.preceptorComments) pcEl.value = e.preceptorComments;
  if (e.sigName) { const sn = document.getElementById('e-sig-name'); if (sn) sn.value = e.sigName; }
  syncSelectionRowStates();
}

async function editEval(i) {
  const items = (await store.get('typhon-items')) || [];
  const e = items[i];
  if (!e || e.type !== 'eval') return;
  resetEval();
  setSelectedDayPill('e-day-pills', e.date);
  loadEvalData(e);
  goTab('eval');
  if (evalPager && typeof evalPager.render === 'function') {
    evalPager.index = 0;
    evalPager.render();
  }
  toast('Evaluation opened for editing');
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
let evalPager = null;

function showStartScreen() {
  // Login must happen first. If auth landing is visible, don't show chooser yet.
  const landing = document.getElementById('auth-landing-screen');
  if (landing && !landing.classList.contains('hidden')) return;
  document.body.classList.add('show-start-screen');
  updateMobileEntryScrollLock();
  if (typeof window.updateContinueButton === 'function') window.updateContinueButton();
}

function hideStartScreen() {
  document.body.classList.remove('show-start-screen');
  updateMobileEntryScrollLock();
}

function initWelcomeScreen() {
  const welcome = document.getElementById('welcome-screen');
  const continueBtn = document.getElementById('welcome-continue');
  const newCaseBtn = document.getElementById('welcome-new-case');
  const timeLogBtn = document.getElementById('welcome-time-log');
  const evalBtn = document.getElementById('welcome-eval');
  const draftsBtn = document.getElementById('welcome-drafts');
  if (!welcome || !continueBtn || !newCaseBtn || !timeLogBtn || !draftsBtn) return;

  function updateContinueButton() {
    const caseReady = hasCaseProgress();
    const timeReady = hasTimeProgress();
    const visible = caseReady || timeReady;
    continueBtn.style.display = visible ? '' : 'none';
    if (!visible) return;
    if (caseReady && timeReady) {
      continueBtn.textContent = '▶ Continue';
      return;
    }
    continueBtn.textContent = caseReady ? '▶ Continue Case' : '▶ Continue Time Log';
  }

  function continueWhereLeftOff(btn) {
    const caseReady = hasCaseProgress();
    const timeReady = hasTimeProgress();
    if (!caseReady && !timeReady) return;
    hideStartScreen();

    const caseTs = caseReady ? progressUpdatedAt('case') : -1;
    const timeTs = timeReady ? progressUpdatedAt('time') : -1;
    if (timeTs > caseTs) {
      goTab('time');
      restoreTimeProgress();
    } else {
      goTab('case');
      restoreDraft();
    }
    btn.blur();
  }

  window.updateContinueButton = updateContinueButton;

  const choose = (tabName, btn) => {
    hideStartScreen();
    goTab(tabName);
    if (tabName === 'saved') {
      setTimeout(() => {
        const draftsFolder = document.getElementById('drafts-folder');
        if (draftsFolder) {
          draftsFolder.classList.add('open');
          draftsFolder.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }, 50);
    }
    btn.blur();
  };

  continueBtn.addEventListener('click', () => continueWhereLeftOff(continueBtn));
  newCaseBtn.addEventListener('click', () => choose('case', newCaseBtn));
  timeLogBtn.addEventListener('click', () => choose('time', timeLogBtn));
  if (evalBtn) evalBtn.addEventListener('click', () => choose('eval', evalBtn));
  draftsBtn.addEventListener('click', () => choose('saved', draftsBtn));
  const browseBtn = document.getElementById('welcome-browse');
  if (browseBtn) browseBtn.addEventListener('click', () => { hideStartScreen(); browseBtn.blur(); });

  const syncStartScreenToAuth = () => {
    const landing = document.getElementById('auth-landing-screen');
    const authRequired = !!(landing && !landing.classList.contains('hidden'));
    if (authRequired) hideStartScreen();
    else showStartScreen();
  };

  // Run once at startup and whenever auth state changes.
  syncStartScreenToAuth();
  window.addEventListener('typhon-auth-changed', syncStartScreenToAuth);
  window.addEventListener('resize', updateMobileEntryScrollLock);
  installMobileScrollGuard();
}

function enhanceNumericInputs() {
  // Force numeric keyboard on mobile for every numeric count field.
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('pattern', '[0-9]*');
  });

  // Count boxes are button-driven: prevent manual typing/editing.
  document.querySelectorAll('.count-input').forEach((el) => {
    el.readOnly = true;
    el.setAttribute('inputmode', 'none');
    el.setAttribute('autocomplete', 'off');
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

function enforceExtensionScrolling() {
  if (window.location.protocol !== 'chrome-extension:') return;

  document.documentElement.classList.add('ext-runtime');
  document.body.classList.add('ext-runtime');
  document.documentElement.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';

  const setPaneOverflow = () => {
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.style.overflow = 'visible';
    });
  };

  setPaneOverflow();
  window.addEventListener('resize', setPaneOverflow);
}

function initCaseMobilePager() {
  const pane = document.getElementById('pane-case');
  if (!pane) return;

  const shouldUseMobilePager = () =>
    window.matchMedia('(max-width: 820px)').matches && window.location.protocol !== 'chrome-extension:';

  const cards = [...pane.querySelectorAll(':scope > .card')];
  const prevBtn = document.getElementById('case-step-prev');
  const nextBtn = document.getElementById('case-step-next');
  const countEl = document.getElementById('case-step-count');
  const titleEl = document.getElementById('case-step-title');
  if (!cards.length || !prevBtn || !nextBtn || !countEl || !titleEl) return;

  const getCardTitle = (card) => card.dataset.stepTitle || card.querySelector('.card-title')?.textContent?.replace(/\s+/g, ' ').trim() || 'Case Section';

  const render = () => {
    const mobile = shouldUseMobilePager();
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
    if (!shouldUseMobilePager()) return;
    if (!event.touches || event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  pane.addEventListener('touchend', (event) => {
    if (!shouldUseMobilePager()) return;
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

function initEvalMobilePager() {
  const pane = document.getElementById('pane-eval');
  if (!pane) return;

  const shouldUseMobilePager = () =>
    window.matchMedia('(max-width: 820px)').matches && window.location.protocol !== 'chrome-extension:';

  const cards = [...pane.querySelectorAll(':scope > .card')];
  const stepItems = [];

  const pushStep = (el, fallbackTitle) => {
    if (!el) return;
    stepItems.push({
      el,
      card: el.classList.contains('card') ? el : el.closest('.card'),
      title: el.dataset.stepTitle || fallbackTitle || 'Evaluation Section'
    });
  };

  // Keep date and preceptor/facility as dedicated pages.
  pushStep(pane.querySelector(':scope > .card:nth-of-type(1)'), 'Date');
  pushStep(pane.querySelector(':scope > .card[data-step-title="Q3 - Preceptor & Facility"]'), 'Q3 - Preceptor & Facility');

  // Q4-Q17 each as their own page.
  pane.querySelectorAll('.eval-question-step').forEach((q) => {
    pushStep(q, q.querySelector('label')?.textContent?.replace(/\s+/g, ' ').trim());
  });

  // Signature should remain its own page after Q17.
  pushStep(document.getElementById('sig-canvas')?.closest('.card'), 'Preceptor Signature');
  const prevBtn = document.getElementById('eval-step-prev');
  const nextBtn = document.getElementById('eval-step-next');
  const countEl = document.getElementById('eval-step-count');
  const titleEl = document.getElementById('eval-step-title');
  if (!cards.length || !stepItems.length || !prevBtn || !nextBtn || !countEl || !titleEl) return;

  const render = () => {
    const mobile = shouldUseMobilePager();
    pane.classList.toggle('mobile-paged', mobile);

    if (!mobile) {
      pane.classList.remove('last-step');
      cards.forEach(card => card.classList.remove('active-step'));
      pane.querySelectorAll('.eval-question-step').forEach((q) => q.classList.remove('active-question'));
      countEl.textContent = `Step 1 of ${stepItems.length}`;
      titleEl.textContent = stepItems[0].title;
      prevBtn.disabled = true;
      nextBtn.disabled = false;
      return;
    }

    evalPager.index = Math.max(0, Math.min(evalPager.index, stepItems.length - 1));
    const activeStep = stepItems[evalPager.index];
    cards.forEach((card) => card.classList.toggle('active-step', card === activeStep.card));

    const questionsInActiveCard = activeStep.card
      ? [...activeStep.card.querySelectorAll('.eval-question-step')]
      : [];
    pane.querySelectorAll('.eval-question-step').forEach((q) => q.classList.remove('active-question'));
    if (questionsInActiveCard.length) {
      questionsInActiveCard.forEach((q) => q.classList.remove('active-question'));
      if (!activeStep.el.classList.contains('card')) activeStep.el.classList.add('active-question');
    }

    countEl.textContent = `Step ${evalPager.index + 1} of ${stepItems.length}`;
    titleEl.textContent = activeStep.title;
    prevBtn.disabled = evalPager.index === 0;
    nextBtn.disabled = evalPager.index === stepItems.length - 1;
    pane.classList.toggle('last-step', evalPager.index === stepItems.length - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepBy = (delta) => {
    evalPager.index += delta;
    render();
  };

  evalPager = { index: 0, cards: stepItems, render };

  let touchStartX = null;
  let touchStartY = null;
  pane.addEventListener('touchstart', (event) => {
    if (!shouldUseMobilePager()) return;
    if (!event.touches || event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  pane.addEventListener('touchend', (event) => {
    if (!shouldUseMobilePager()) return;
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
  document.getElementById('btn-draft-case')?.addEventListener('click', saveDraftCase);
  document.getElementById('btn-save-time')?.addEventListener('click', saveTimeLog);
  document.getElementById('btn-draft-time')?.addEventListener('click', saveDraftTimeLog);
  document.getElementById('btn-save-eval')?.addEventListener('click', saveEval);
  document.getElementById('btn-draft-eval')?.addEventListener('click', saveDraftEval);
  document.getElementById('btn-text-eval')?.addEventListener('click', textCurrentEval);
  document.getElementById('btn-submit-preceptor-review')?.addEventListener('click', submitPreceptorReview);
  document.getElementById('draft-banner-resume')?.addEventListener('click', async () => {
    const items = (await store.get('typhon-items')) || [];
    const idx = items.findIndex(i => i.draft && i.type === 'case');
    if (idx >= 0) resumeDraftItem(idx);
  });
  document.getElementById('draft-banner-dismiss')?.addEventListener('click', hideDraftBanner);

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
      if (groupId === 'grp-sex' || groupId === 'grp-admit' || groupId === 'grp-preceptor' || groupId === 'grp-urgency' || groupId === 'grp-neonate' ||
          groupId === 'e-arrived' || groupId === 'e-q8' || groupId === 'e-q9' || groupId === 'e-q10' || groupId === 'e-q11' ||
          groupId === 'e-q12' || groupId === 'e-q13' || groupId === 'e-q14' || groupId === 'e-q16') pick(btnTog, groupId);
      else multi(btnTog, groupId);
      // Show/hide Q16 "Other" text field
      if (groupId === 'e-q16') {
        const otherInput = document.getElementById('e-q16-other');
        if (otherInput) {
          const isOther = !!document.querySelector('#e-q16 .btn-tog[data-v="other"].on');
          otherInput.style.display = isOther ? '' : 'none';
          if (!isOther) otherInput.value = '';
        }
      }
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
      if (action === 'edit-eval') editEval(i);
      if (action === 'text-eval') textEval(i);
      if (action === 'toggle-submit') toggleSubmit(i);
      if (action === 'delete-item') deleteItem(i);
      if (action === 'resume-draft') resumeDraftItem(i);
      if (action === 'sync-preceptor') syncPendingEvals();
      return;
    }

    const countStepBtn = event.target.closest('[data-count-adjust][data-target]');
    if (countStepBtn) {
      const delta = Number(countStepBtn.dataset.countAdjust || 0);
      const target = countStepBtn.dataset.target;
      if (delta && target) adjustCountInput(target, delta);
      return;
    }

    const folderHeader = event.target.closest('.submitted-folder-header, .date-folder-header');
    if (folderHeader) {
      const folder = folderHeader.closest('.submitted-folder, .date-folder');
      if (folder) folder.classList.toggle('open');
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
    if (event.target.matches('.count-input')) {
      syncSelectionRowStates();
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('.count-input')) {
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
  enforceExtensionScrolling();
  initWelcomeScreen();
  bindUiEvents();
  bindProcedureDependencies();
  enhanceNumericInputs();
  initCaseMobilePager();
  initEvalMobilePager();
  initSignatureCanvas();
  await initPreceptorReviewMode();

  // Autosave draft on any input change in the case pane
  document.getElementById('pane-case')?.addEventListener('input', saveDraft);
  document.getElementById('pane-case')?.addEventListener('change', saveDraft);
  document.getElementById('pane-time')?.addEventListener('input', saveTimeProgress);
  document.getElementById('pane-time')?.addEventListener('change', saveTimeProgress);
  document.getElementById('pane-eval')?.addEventListener('input', saveEvalProgress);
  document.getElementById('pane-eval')?.addEventListener('change', saveEvalProgress);

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
  buildDayPills('e-day-pills', null);
  if (typeof window.updateContinueButton === 'function') window.updateContinueButton();
  const items = (await store.get('typhon-items')) || [];
  updateBadge(items);
  // Show draft banner if there is a saved draft case
  if (items.some(i => i.draft && i.type === 'case')) showDraftBanner();

  // Refresh list/badge when auth changes (sign in/out) so cloud data appears immediately.
  window.addEventListener('typhon-auth-changed', async () => {
    const refreshed = (await store.get('typhon-items')) || [];
    updateBadge(refreshed);
    if (document.getElementById('pane-saved')?.classList.contains('active')) renderSaved();
  });
})();
