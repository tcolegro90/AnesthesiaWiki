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
    return !!(t.clockIn1 || t.clockOut1);
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

