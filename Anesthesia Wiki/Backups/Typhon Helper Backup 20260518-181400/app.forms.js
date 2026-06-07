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
    facilityOther: val('e-facility-other'),
    arrivedPrepared: pickVal('e-arrived'),
    arrivedComments: val('e-arrived-comments'),
    ageRanges: getCheckedVals('e-age-grid'),
    asaClasses: getCheckedVals('e-asa-grid'),
    surgicalCases: getCheckedVals('e-surg-grid'),
    surgicalCasesOther: val('e-surg-other'),
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

