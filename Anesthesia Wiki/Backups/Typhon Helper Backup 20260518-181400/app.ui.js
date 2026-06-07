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
  // Clear any step-based scroll lock applied by the case pager.
  document.documentElement.style.overflowY = '';
  document.body.style.overflowY = '';
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
function medSelectAll() {
  ['c-med-inhal','c-med-iv-ind','c-med-nmb','c-med-opioid','c-med-other'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) cb.checked = true;
  });
  // Uncheck "No Medications" since we're selecting everything else
  const none = document.getElementById('c-med-none');
  if (none) none.checked = false;
  syncSelectionRowStates();
}
function medToggleAll() {
  const ids = ['c-med-inhal','c-med-iv-ind','c-med-nmb','c-med-opioid','c-med-other'];
  const allChecked = ids.every(id => { const cb = document.getElementById(id); return cb && cb.checked; });
  ids.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = !allChecked; });
  if (!allChecked) { const none = document.getElementById('c-med-none'); if (none) none.checked = false; }
  syncSelectionRowStates();
  const btn = document.getElementById('btn-med-select-all');
  if (btn) btn.textContent = allChecked ? 'Select All' : 'Unselect All';
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

