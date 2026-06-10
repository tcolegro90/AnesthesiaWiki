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
  const siteVal = t.clinicalSite || t.site || '';
  const sexVal = t.biologicalSex || t.sex || '';
  const admitVal = t.admitType || t.admit || '';
  const notesVal = t.clinicalNotes || t.notes || '';
  const isNeonate = typeof t.isNeonate === 'boolean' ? t.isNeonate : !!t.neonate;

  // Site
  document.getElementById('c-site').value = siteVal;
  // Sex
  document.querySelectorAll('#grp-sex .btn-tog').forEach(b => {
    b.classList.toggle('on', b.dataset.v === sexVal);
  });
  // Admit
  document.querySelectorAll('#grp-admit .btn-tog').forEach(b => {
    b.classList.toggle('on', b.dataset.v === admitVal);
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
    b.classList.toggle('on', isNeonate && b.dataset.v === 'yes');
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
  document.getElementById('c-notes').value = notesVal;
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
  const facilitySelect = document.getElementById('e-facility-select');
  if (facilitySelect) facilitySelect.value = (e.facility || [])[0] || '';
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

