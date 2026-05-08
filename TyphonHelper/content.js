// content.js — injected into all typhon.net pages
// Detects page type and fills forms based on data from the popup

// ============================================================
// DETECT PAGE TYPE
// ============================================================
function getPageType() {
  const heading = (document.querySelector('h1, h2, h3')?.textContent || '').toLowerCase();
  const title   = document.title.toLowerCase();
  const url     = window.location.href.toLowerCase();
  const body    = (document.body?.innerText || '').toLowerCase();

  const looksLikeCaseEntry =
    body.includes('case log - data entry') ||
    body.includes('case id #') ||
    (body.includes('clinical site:') && body.includes('physical status - class/asa'));

  const looksLikeTimeEntry =
    body.includes('time log') && (body.includes('clock in') || body.includes('clock out'));

  // Time log entry page
  if (heading.includes('edit time log') || heading.includes('add a time log') ||
      title.includes('time log') || url.includes('timelog') || url.includes('time_log') ||
      looksLikeTimeEntry) {
    return 'timelog';
  }
  // Case log entry page (the actual data entry form, not the list view)
  if ((heading.includes('case log') && document.querySelector('select, input[type="text"]')) ||
      url.includes('caselog') || url.includes('case_log') || url.includes('casedata') ||
      url.includes('/nast/data/data2.asp') ||
      title.includes('case log - data') ||
      looksLikeCaseEntry) {
    return 'caselog';
  }
  return 'unknown';
}

// ============================================================
// UTILITIES
// ============================================================

// Find a <select> or <input> by searching labels and td cells for matching text
function findFieldByLabel(labelText) {
  const needle = labelText.toLowerCase().trim();

  // Strategy 1: <label for="...">
  for (const lbl of document.querySelectorAll('label')) {
    if (lbl.textContent.toLowerCase().includes(needle)) {
      const id = lbl.getAttribute('for');
      if (id) {
        const el = document.getElementById(id);
        if (el) return el;
      }
      // Sibling input/select in same parent
      const el = lbl.parentElement?.querySelector('input:not([type="checkbox"]):not([type="radio"]), select');
      if (el) return el;
    }
  }

  // Strategy 2: <td> containing the label text — look in sibling td or within same td
  for (const td of document.querySelectorAll('td')) {
    const text = td.textContent.toLowerCase().trim();
    if (text === needle || text.startsWith(needle)) {
      const next = td.nextElementSibling;
      if (next) {
        const el = next.querySelector('input:not([type="checkbox"]):not([type="radio"]), select');
        if (el) return el;
      }
      const el = td.querySelector('input:not([type="checkbox"]):not([type="radio"]), select');
      if (el) return el;
    }
  }
  return null;
}

// Set a <select> value by matching option text
function setSelect(el, optionText) {
  if (!el || el.tagName !== 'SELECT') return false;
  const needle = normalizeText(optionText);
  if (!needle) return false;

  // Exact normalized text match first.
  for (const opt of el.options) {
    if (normalizeText(opt.text) === needle) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  // Then contains match.
  for (const opt of el.options) {
    if (normalizeText(opt.text).includes(needle)) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  return false;
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function setSelectFromCandidates(el, candidates) {
  if (!el || el.tagName !== 'SELECT') return false;
  const needles = (candidates || []).map(normalizeText).filter(Boolean);
  if (!needles.length) return false;

  // Prefer selecting a real option, never a placeholder.
  const options = [...el.options].filter(opt => !opt.disabled && opt.value !== '');

  for (const needle of needles) {
    for (const opt of options) {
      const text = normalizeText(opt.text);
      if (text && text === needle) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
  }

  for (const needle of needles) {
    for (const opt of options) {
      const text = normalizeText(opt.text);
      if (!text) continue;
      if (text.includes(needle) || needle.includes(text)) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
  }
  return false;
}

function findLikelySelectByHints(hints) {
  const all = [...document.querySelectorAll('select')];
  const needles = (hints || []).map(normalizeText).filter(Boolean);
  if (!all.length || !needles.length) return null;

  for (const sel of all) {
    const hay = normalizeText(`${sel.id || ''} ${sel.name || ''} ${sel.getAttribute('aria-label') || ''}`);
    if (needles.some(n => hay.includes(n))) return sel;
  }
  return null;
}

function findClinicalSiteSelect() {
  return (
    findFieldByLabel('Clinical Site') ||
    findLikelySelectByHints(['clinical site', 'clinical_site', 'site', 'facility', 'hospital'])
  );
}

function setClinicalSite(selectEl, siteName) {
  if (!selectEl || !siteName) return false;
  const aliases = {
    'rochester general hospital': ['rochester general hospital', 'rochester general', 'rgh'],
    'strong memorial hospital': ['strong memorial hospital of the university of rochester', 'strong memorial hospital', 'strong memorial', 'smh', 'strong'],
    'unity hospital': ['unity hospital', 'unity'],
    'highland hospital': ['highland hospital', 'highland'],
    'clifton springs hospital clinic': ['clifton springs hospital clinic', 'clifton springs hospital & clinic'],
    'crouse hospital': ['crouse hospital'],
    'ff thompson hospital': ['ff thompson hospital', 'f f thompson hospital'],
    'linden surgery center': ['linden surgery center'],
    'newark wayne community hospital': ['newark wayne community hospital'],
    'noyes health services': ['noyes health services'],
    'rochester surgery center': ['rochester surgery center'],
    'saunders surgical center': ['saunders surgical center'],
    'st josephs hospital': ['st josephs hospital', "st joseph's hospital"],
    'surgery center at sawgrass': ['surgery center at sawgrass', 'sawgrass'],
    'united memorial medical center': ['united memorial medical center', 'ummc'],
    'upstate university hospital community campus community general hospital': ['upstate university hospital community campus community general hospital'],
    'westfall surgery center': ['westfall surgery center'],
    'other': ['other']
  };
  const key = normalizeText(siteName);
  const candidates = aliases[key] || [siteName];
  return setSelectFromCandidates(selectEl, candidates) || setSelect(selectEl, siteName);
}

function findPreceptorTypeSelect() {
  // First try by label text.
  const byLabel =
    findFieldByLabel('Preceptor') ||
    findFieldByLabel('Provider Type') ||
    findFieldByLabel('Anesthesia Provider');
  if (byLabel?.tagName === 'SELECT') return byLabel;

  // Then scan selects for options that look like CRNA/MDA choice.
  for (const sel of document.querySelectorAll('select')) {
    const optionText = [...sel.options].map(o => normalizeText(o.text)).join(' | ');
    const hasCrna = optionText.includes('crna');
    const hasMda = optionText.includes('mda') || optionText.includes('physician') || optionText.includes('anesthesiologist');
    if (hasCrna && hasMda) return sel;
  }
  return null;
}

function setPreceptorTypeSelect(preceptorType) {
  const sel = findPreceptorTypeSelect();
  if (!sel) return false;
  const isMda = String(preceptorType || '').toUpperCase() === 'MDA';
  const candidates = isMda
    ? ['mda', 'md', 'physician', 'anesthesiologist', 'anesthesia physician', 'anes physician']
    : ['crna', 'nurse anesthetist', 'certified registered nurse anesthetist'];
  return setSelectFromCandidates(sel, candidates);
}

// Fill a text input
function setInput(el, value, opts = {}) {
  const { blur = true } = opts;
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  if (blur) el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

function findPrimaryInputByRowLabel(labelText) {
  const needle = labelText.toLowerCase().trim();
  for (const td of document.querySelectorAll('td')) {
    if (!td.textContent.toLowerCase().includes(needle)) continue;
    const row = td.closest('tr');
    if (!row) continue;

    const tds = [...row.querySelectorAll('td')];
    const idx = tds.indexOf(td);

    // Best-effort: find the input associated with the "Primary" caption.
    const primaryTd = tds.find(c => c.textContent.toLowerCase().includes('primary'));
    if (primaryTd) {
      const inSame = primaryTd.querySelector('input[type="text"], input[type="number"]');
      if (inSame) return inSame;
      let sib = primaryTd.nextElementSibling;
      while (sib) {
        const inNext = sib.querySelector('input[type="text"], input[type="number"]');
        if (inNext) return inNext;
        sib = sib.nextElementSibling;
      }
    }

    // Fallback: first input in cells to the right of the label cell.
    for (let i = idx + 1; i < tds.length; i++) {
      const inp = tds[i].querySelector('input[type="text"], input[type="number"]');
      if (inp) return inp;
    }

    // Last fallback: first input on the row.
    const first = row.querySelector('input[type="text"], input[type="number"]');
    if (first) return first;
  }
  return null;
}

function setPrimaryCodeByLabel(labelText, value) {
  const inp = findPrimaryInputByRowLabel(labelText);
  if (!inp) return false;
  // Typhon may coerce blank to 0 on blur; avoid blur when explicitly clearing.
  return setInput(inp, value, { blur: value !== '' });
}

function setPrimaryCodeByAnyLabel(labels, value) {
  for (const label of labels) {
    if (setPrimaryCodeByLabel(label, value)) return true;
    const direct = findFieldByLabel(label);
    if (direct && direct.tagName === 'INPUT') {
      if (setInput(direct, value, { blur: true })) return true;
    }
  }
  return false;
}

function findInputByIdOrName(keys) {
  for (const key of keys) {
    const byId = document.getElementById(key);
    if (byId && byId.tagName === 'INPUT') return byId;
    const byName = document.querySelector(`input[name="${key}"]`);
    if (byName) return byName;
  }
  return null;
}

function setInputByIdOrName(keys, value) {
  const el = findInputByIdOrName(keys);
  if (!el) return false;
  return setInput(el, value, { blur: true });
}

function enforcePreceptorPrimaryCodes(preceptorType) {
  const isMDA = String(preceptorType || '').toUpperCase() === 'MDA';

  // Hard-target known Typhon fields when present.
  const mdaPrimaryKeys = ['MDA1', 'mda1'];
  const crnaPrimaryKeys = ['CRNA1', 'crna1'];
  const mdaSecondaryKeys = ['MDA2', 'mda2'];
  const crnaSecondaryKeys = ['CRNA2', 'crna2'];

  const wroteMda = setInputByIdOrName(mdaPrimaryKeys, isMDA ? '1' : '0');
  const wroteCrna = setInputByIdOrName(crnaPrimaryKeys, isMDA ? '0' : '1');

  // Keep secondary boxes blank unless user explicitly uses them in Typhon.
  setInputByIdOrName(mdaSecondaryKeys, '');
  setInputByIdOrName(crnaSecondaryKeys, '');

  if (wroteMda || wroteCrna) return;

  // These are plain numeric text fields in Typhon: explicitly set 0/1.
  const anesPhysicianLabels = [
    'Anes Physician Code',
    'Anesthesia Physician Code',
    'MDA Code',
    'MDA'
  ];
  const crnaLabels = [
    'CRNA Code',
    'CRNA'
  ];

  setPrimaryCodeByAnyLabel(anesPhysicianLabels, isMDA ? '1' : '0');
  setPrimaryCodeByAnyLabel(crnaLabels, isMDA ? '0' : '1');
}

// Find a checkbox whose associated label contains the given text (exact or includes)
function findCheckbox(labelText, exact = false) {
  const needle = labelText.toLowerCase().trim();

  // Strategy 1: <label> element
  for (const lbl of document.querySelectorAll('label')) {
    const text = lbl.textContent.toLowerCase().trim();
    const match = exact ? text === needle : text.includes(needle);
    if (match) {
      const id = lbl.getAttribute('for');
      if (id) {
        const cb = document.getElementById(id);
        if (cb?.type === 'checkbox') return cb;
      }
      const cb = lbl.querySelector('input[type="checkbox"]');
      if (cb) return cb;
    }
  }

  // Strategy 2: checkbox inside a <td> whose text matches
  for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
    const td = cb.closest('td');
    if (td) {
      const text = td.textContent.toLowerCase().trim();
      const match = exact ? text === needle : text.includes(needle);
      if (match) return cb;
    }
    // Check parent element text
    const parent = cb.parentElement;
    if (parent) {
      const text = parent.textContent.toLowerCase().trim();
      const match = exact ? text === needle : text.includes(needle);
      if (match) return cb;
    }
  }
  return null;
}

function check(labelText, shouldCheck, exact = false) {
  const cb = findCheckbox(labelText, exact);
  if (cb) {
    cb.checked = shouldCheck;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

// Fill a count/number field — searches for a text input near a td containing labelText
function setCountField(labelText, value) {
  if (!value || value === '0' || value === '') return;
  const needle = labelText.toLowerCase().trim();
  for (const td of document.querySelectorAll('td')) {
    if (td.textContent.toLowerCase().includes(needle)) {
      // count inputs are typically in the preceding sibling td
      const prev = td.previousElementSibling;
      if (prev) {
        const inp = prev.querySelector('input[type="text"], input[type="number"]');
        if (inp) { setInput(inp, value); return; }
      }
      const inp = td.querySelector('input[type="text"], input[type="number"]');
      if (inp) { setInput(inp, value); return; }
    }
  }
}

// Fill a rich-text / contenteditable notes area
function fillRichText(text) {
  if (!text) return;
  const editors = document.querySelectorAll('[contenteditable="true"]');
  if (!editors.length) return;
  // Use the last contenteditable (notes is typically the last one on the page)
  const editor = editors[editors.length - 1];
  editor.focus();
  // Clear existing content and insert new text
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function resetCaseLogForm() {
  // Clear checkboxes/radios first to prevent carryover between fills.
  document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => {
    el.checked = false;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Reset selects to first option.
  document.querySelectorAll('select').forEach(sel => {
    sel.selectedIndex = 0;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Clear text and number inputs so omitted fields stay blank.
  document.querySelectorAll('input[type="text"], input[type="number"]').forEach(inp => {
    if (inp.readOnly || inp.disabled) return;
    setInput(inp, '');
  });

  // Clear rich-text notes area.
  const editors = document.querySelectorAll('[contenteditable="true"]');
  if (editors.length) {
    const editor = editors[editors.length - 1];
    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, '');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ============================================================
// FILL TIME LOG
// ============================================================
function fillTimeLog(data) {
  // Find clock in/out inputs by looking for rows with "Clock" in the label
  const clockInputs = [];
  for (const td of document.querySelectorAll('td, th, label')) {
    if (td.textContent.toLowerCase().includes('clock')) {
      const row = td.closest('tr') || td.parentElement;
      for (const inp of (row?.querySelectorAll('input[type="text"]') || [])) {
        if (!clockInputs.includes(inp)) clockInputs.push(inp);
      }
    }
  }

  // Fallback: use all visible text inputs in document order
  const inputs = clockInputs.length >= 2
    ? clockInputs
    : [...document.querySelectorAll('input[type="text"]')].filter(i => i.offsetParent !== null);

  if (data.clockIn1  && inputs[0]) setInput(inputs[0], data.clockIn1);
  if (data.clockOut1 && inputs[1]) setInput(inputs[1], data.clockOut1);
  if (data.clockIn2  && inputs[2]) setInput(inputs[2], data.clockIn2);
  if (data.clockOut2 && inputs[3]) setInput(inputs[3], data.clockOut2);

  if (data.notes) fillRichText(data.notes);
}

// ============================================================
// FILL CASE LOG
// ============================================================
function fillCaseLog(data) {
  resetCaseLogForm();

  // --- Dropdowns ---
  setClinicalSite(findClinicalSiteSelect(), data.clinicalSite);
  setSelect(findFieldByLabel('Biological Sex'),  data.biologicalSex);
  setSelect(findFieldByLabel('Admit Type'),      data.admitType);
  setSelect(findFieldByLabel('Physical Status'), data.asa);

  // Age
  setInput(findFieldByLabel('Age (Years)') || findFieldByLabel('Age'), data.age);

  // Preceptor code mapping:
  // - CRNA selected: CRNA Primary = 1, Anes Physician Primary = blank
  // - MDA selected:  Anes Physician Primary = 1, CRNA Primary = blank
  const preceptorType = (data.preceptorType || (data.mdaPrimary ? 'MDA' : 'CRNA')).toUpperCase();
  // If Typhon has a direct preceptor/provider dropdown, set it too.
  setPreceptorTypeSelect(preceptorType);
  // Write preceptor primary fields deterministically.
  enforcePreceptorPrimaryCodes(preceptorType);

  // --- Checkboxes: Other clinical info ---
  if (data.traumaEmergency) {
    // The Trauma/Emergency row has a "Yes" checkbox
    for (const td of document.querySelectorAll('td')) {
      if (td.textContent.trim() === 'Trauma/Emergency:') {
        const next = td.nextElementSibling;
        if (next) {
          const cb = next.querySelector('input[type="checkbox"]');
          if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        break;
      }
    }
  }
  if (data.isNeonate) check('4 weeks old', true);

  // Positions
  (data.positions || []).forEach(p => check(p.toLowerCase(), true));

  // Anatomical categories
  (data.anatomical || []).forEach(a => check(a, true));
  const ad = data.anatomicalDetails || {};
  if (ad.headIntraOpen)      check('Open', true);
  if (ad.headIntraClosed)    check('Closed', true);
  if (ad.heartOpenBypass)    check('Open Heart - WITH Bypass', true);
  if (ad.heartOpenNoBypass)  check('Open Heart - WITHOUT Bypass', true);
  if (ad.heartClosed)        check('Closed Heart', true);
  if (ad.otherECT)           check('ECT', true, true);
  if (ad.otherEBUS)          check('EBUS', true, true);
  if (ad.otherColonoscopy)   check('Colonoscopy', true, true);
  if (ad.otherEGD)           check('EGD', true, true);

  // --- Anesthesia Type ---
  const gi = data.generalItems || {};
  if (gi.minimal)      check('Perform General Anesthetic Induction - Minimal/No Assistance', true);
  if (gi.ivInduction)  check('Intravenous Induction', true);
  if (gi.inhalInduction) check('Inhalation Induction', true);
  if (gi.maskInd)      check('Mask Ventilation - Induction', true);
  if (gi.maskMaint)    check('Mask Ventilation - Management/Maintenance', true);
  if (gi.maskResus)    check('Mask Ventilation - Resuscitation', true);
  if (gi.lma)          check('Laryngeal Mask Airway', true);
  if (gi.sga)          check('Other Supraglottic Airway', true);
  if (gi.ettOral)      check('Tracheal Intubation - Oral', true);
  if (gi.ettNasal)     check('Tracheal Intubation - Nasal', true);
  if (gi.tiva)         check('Total Intravenous Anesthesia', true);
  if (gi.emerge)       check('Emergence from Anesthesia', true);

  const ri = data.regionalItems || {};
  if (ri.spinal)      check('Administration - Spinal', true);
  if (ri.epidural)    check('Administration - Epidural', true);
  if (ri.peripheral)  check('Administration - Peripheral', true);
  if (ri.other)       check('Administration - Other', true);
  if (ri.mgmt)        check('Management', true);
  if (ri.peripheralUpper) check('Upper', true, true);
  if (ri.peripheralLower) check('Lower', true, true);

  if (data.mac)      check('MONITORED ANESTHESIA CARE', true);
  if (data.sedation) check('MODERATE/DEEP SEDATION', true);

  // --- Patient Assessment ---
  const a = data.assessment || {};
  if (a.initial)   check('Initial Preanesthetic Assessment', true);
  if (a.post)      check('Postanesthetic Assessment', true);
  if (a.hxpActual) check('Comprehensive History & Physical - Actual', true);
  if (a.hxpSim)    setCountField('Comprehensive History & Physical - Simulated', a.hxpSimN);

  // --- Procedures ---
  const p = data.procedures || {};
  if (p.artActual)  check('Arterial Puncture/Catheter Insertion', true);
  if (p.artBP)      check('Intra-arterial BP Monitoring', true);
  if (p.cvlActual || p.cvlPICC || p.cvlNonPICC) check('Placement - Actual', true);
  if (p.cvlPICC)    check('Placement - PICC', true);
  if (p.cvlNonPICC) check('Placement - Non-PICC', true);
  if (p.cvlMonitor) {
    // "Monitoring" is ambiguous — find the one inside the Central Venous Catheter section
    const cbs = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of cbs) {
      const td = cb.closest('td');
      if (td?.textContent.trim() === 'Monitoring') {
        cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
  if (p.paPlacement) check('Pulmonary Artery Catheter - Placement', true);
  if (p.paMonitor)   check('Pulmonary Artery Catheter - Monitoring', true);
  if (p.endoTrachealTubePlacement) check('Endoscopic - Actual Tracheal Tube Placement', true) || check('Endoscopic Tracheal Tube Placement', true);
  if (p.endoAirwayAssessment)      check('Endoscopic - Airway Assessment', true);
  if (p.otherTechniques)           check('Other Techniques', true);
  if (p.hemo)     check('Advanced Minimally- and Non-invasive Hemodynamic Monitoring', true);
  if (p.mechVent) check('Mechanical Ventilation', true);
  if (p.cxr)      check('Assessment of Chest X-Ray', true);
  if (p.pain)     check('Pain Management Encounter', true);
  if (p.ivStarts) setCountField('Intravenous Catheter Placements', p.ivStartsN);
  if (p.pocusA)   setCountField('Point of Care Ultrasound (POCUS) - Actual', p.pocusAN);
  if (p.usrA)     setCountField('Ultrasound Guided Techniques - Regional - Actual', p.usrAN);
  if (p.usvA)     setCountField('Ultrasound Guided Techniques - Vascular - Actual', p.usvAN);

  // --- Medications ---
  const m = data.medications || {};
  if (m.none)    check('No Medications', true);
  if (m.inhal)   check('Inhalation Agents', true);
  if (m.ivInd)   check('IV Induction Agents', true);
  if (m.nmb)     check('IV Agent - Muscle Relaxants', true);
  if (m.opioid)  check('IV Agent - Opioids', true);
  if (m.other)   check('IV Agent - Other', true);

  // --- Anesthesia Times ---
  if (data.anesStart) {
    const el = findFieldByLabel('Anesthesia Start') || findFieldByLabel('(AS)');
    setInput(el, data.anesStart);
  }
  if (data.anesFinish) {
    const el = findFieldByLabel('Anesthesia Finish') || findFieldByLabel('(AF)');
    setInput(el, data.anesFinish);
  }

  // Re-assert preceptor primary values after Typhon's own on-change handlers run.
  [120, 350, 700, 1200].forEach(ms => {
    setTimeout(() => enforcePreceptorPrimaryCodes(preceptorType), ms);
  });

  // --- Clinical Notes ---
  if (data.clinicalNotes) fillRichText(data.clinicalNotes);
}

// ============================================================
// MESSAGE LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageType') {
    sendResponse({ pageType: getPageType() });
    return true;
  }

  if (message.action === 'fill') {
    const pageType = getPageType();
    const dataType = message.data?.type;

    if (pageType === 'timelog' && dataType === 'timelog') {
      fillTimeLog(message.data);
      sendResponse({ success: true, filled: 'timelog' });
    } else if (pageType === 'caselog' && dataType === 'case') {
      fillCaseLog(message.data);
      sendResponse({ success: true, filled: 'caselog' });
    } else {
      sendResponse({
        success: false,
        reason: pageType === 'unknown'
          ? 'Navigate to the case log or time log data entry page first, then click Fill.'
          : `Page is a ${pageType} but you're trying to fill a ${dataType}.`
      });
    }
    return true;
  }
});
