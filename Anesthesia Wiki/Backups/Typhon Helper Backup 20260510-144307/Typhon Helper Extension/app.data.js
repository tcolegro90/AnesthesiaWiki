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

