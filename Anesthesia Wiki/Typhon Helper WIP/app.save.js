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
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Case saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: case saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Case saved locally (not signed in)');
  }
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
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Time log saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: time log saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Time log saved locally (not signed in)');
  }
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
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Evaluation saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: evaluation saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Evaluation saved locally (not signed in)');
  }
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
  const writeResult = await store.set('typhon-items', items);
  updateBadge(items);
  clearEvalProgress();
  resetEval();
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Evaluation draft saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: evaluation draft saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Evaluation draft saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Evaluation draft saved locally (not signed in)');
  }
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
  const writeResult = await store.set('typhon-items', items);
  updateBadge(items);
  clearDraft();
  resetCase();
  hideDraftBanner();
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Draft saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: case draft saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Draft saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Draft saved locally (not signed in)');
  }
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
  const writeResult = await store.set('typhon-items', items);
  updateBadge(items);
  resetTimeLog();
  clearTimeProgress();
  if (writeResult?.cloud) {
    hideCloudSyncWarning();
    toast('Time log draft saved + cloud synced');
  } else if (_getAuthUid()) {
    showCloudSyncWarning('Cloud sync issue: time log draft saved locally only. ' + (writeResult?.error || 'Cloud write failed.'));
    toast('Time log draft saved locally. Cloud sync failed.');
  } else {
    hideCloudSyncWarning();
    toast('Time log draft saved locally (not signed in)');
  }
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

