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

  const looksLikeEvalEntry =
    heading.includes('evaluation') ||
    heading.includes('daily eval') ||
    title.includes('evaluation') ||
    title.includes('daily eval') ||
    body.includes('daily evaluation') ||
    body.includes('preceptor comments') ||
    body.includes('preceptor signature');

  // Time log LIST page (report view with Add New Time Log button — must detect before entry form)
  const looksLikeTimeLogList =
    (heading.includes('time log') || title.includes('time log')) &&
    body.includes('add new time log') &&
    !heading.includes('add a time log') && !heading.includes('edit time log');
  if (looksLikeTimeLogList) {
    return 'timeloglist';
  }

  // Time log ENTRY page (the actual add/edit form)
  if (heading.includes('edit time log') || heading.includes('add a time log') ||
      looksLikeTimeEntry) {
    return 'timelog';
  }
  // Evaluation page
  if (looksLikeEvalEntry) {
    return 'eval';
  }
  // Case log entry page (the actual data entry form, not the list view)
  if ((heading.includes('case log') && document.querySelector('select, input[type="text"]')) ||
      url.includes('caselog') || url.includes('case_log') || url.includes('casedata') ||
      url.includes('/nast/data/data2.asp') ||
      title.includes('case log - data') ||
      looksLikeCaseEntry) {
    return 'caselog';
  }
  // Date picker page — "Add a Case Log" step before the full form
  // Detected after caselog so the full form always wins if both signals present
  const hasFullForm = body.includes('physical status') || body.includes('clinical site') || body.includes('biological sex');
  const looksLikeDatePicker =
    heading.includes('add a case log') ||
    body.includes('date of encounter') ||
    body.includes('is the patient returning on the same day');
  if (looksLikeDatePicker && !hasFullForm && !looksLikeCaseEntry) {
    return 'casedate';
  }
  // Main menu page
  const looksLikeMainMenu =
    body.includes('main menu') &&
    body.includes('add new case log') &&
    body.includes('case log management');
  if (looksLikeMainMenu) {
    return 'mainmenu';
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
// FILL CASE DATE PICKER PAGE
// Fills the date input and clicks Next so you land on the pre-filled form.
// ============================================================
function isoToTyphonDate(iso) {
  if (!iso) return '';
  const raw = String(iso).trim();
  const pad2 = n => String(parseInt(n, 10)).padStart(2, '0');

  // Already MM/DD/YYYY (or M/D/YYYY)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const parts = raw.split('/');
    const mm = pad2(parts[0]);
    const dd = pad2(parts[1]);
    const yyyy = parts[2];
    return `${mm}/${dd}/${yyyy}`;
  }

  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${pad2(m)}/${pad2(d)}/${y}`;
  }

  return '';
}

function setInputNative(el, value) {
  if (!el) return false;
  try { el.focus(); } catch (e) {}
  try { el.click(); } catch (e) {}
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('keyup', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

function clickAddNewCaseLog() {
  const links = [...document.querySelectorAll('a')];
  const link = links.find(a => a.textContent.trim().toLowerCase() === 'add new case log');
  if (link) { link.click(); return true; }
  return false;
}

function clickAddNewTimeLog() {
  // From the main menu: navigate to the My Time Logs list page
  const links = [...document.querySelectorAll('a')];
  const myTimeLogs = links.find(a => /my time logs/i.test(a.textContent.trim()));
  if (myTimeLogs) { myTimeLogs.click(); return true; }
  return false;
}

function clickAddNewTimeLogBtn() {
  // From the time log list page: click the green "+ Add New Time Log" button
  const btn = [...document.querySelectorAll('a, button')]
    .find(el => /add new time log/i.test(el.textContent.trim()));
  if (btn) { btn.click(); return true; }
  return false;
}

function clickAddNewEval() {
  const links = [...document.querySelectorAll('a, button')];
  const target = links.find(el => {
    const txt = (el.textContent || '').trim().toLowerCase();
    return (
      txt === 'daily evaluations' ||
      txt === 'my daily evaluations' ||
      txt === 'add daily evaluation' ||
      txt === 'add new daily evaluation' ||
      txt.includes('daily eval') ||
      txt.includes('daily evaluation')
    );
  });
  if (target) { target.click(); return true; }
  return false;
}

function fillCaseDatePage(data) {
  const dateStr = isoToTyphonDate(data.date);
  if (!dateStr) return false;

  // Target the "Date of Encounter:" text input (placeholder MM/DD/YYYY)
  const dateInput =
    findFieldByLabel('Date of Encounter') ||
    document.querySelector('input[placeholder="MM/DD/YYYY"]') ||
    document.querySelector('input[type="date"]') ||
    [...document.querySelectorAll('input[type="text"]')].find(i => i.offsetParent !== null);

  if (!dateInput) return false;
  setInput(dateInput, dateStr);

  // "Is the patient returning on the same day?" — radio buttons
  // App values: 'no' | '2nd' | '3rd'
  // Typhon radio text: "No." | "Yes, patient is here for the second time today." | "Yes, patient is here for the third time today."
  const returnVal = (data.returnVisit || 'no').toLowerCase();
  const radioMap = {
    'no':  'no.',
    '2nd': 'second time',
    '3rd': 'third time'
  };
  const targetText = radioMap[returnVal] || 'no.';
  for (const radio of document.querySelectorAll('input[type="radio"]')) {
    const labelEl = radio.closest('label') ||
      (radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null) ||
      radio.parentElement;
    const text = (labelEl?.textContent || '').toLowerCase();
    if (text.includes(targetText)) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  }

  return true;
}

function clickNextButton() {
  // Find the "Continue" button on the date picker page
  const candidates = [
    ...document.querySelectorAll('input[type="submit"], input[type="button"], button')
  ];
  const next = candidates.find(el => {
    const t = (el.value || el.textContent || '').toLowerCase().trim();
    return t.includes('continue') || t === 'next' || t === 'submit';
  });
  if (next) { next.click(); return true; }
  return false;
}

function fillTimeLogDateStep(data) {
  const dateStr = isoToTyphonDate(data?.date);
  if (!dateStr) return { handled: false, continued: false, reason: 'No valid date found in selected time log.' };

  const headingText = (document.querySelector('h1, h2, h3')?.textContent || '').toLowerCase();
  const bodyText = (document.body?.innerText || '').toLowerCase();
  const hasDateInputHints =
    !!document.querySelector('input[placeholder*="MM" i][placeholder*="YYYY" i]') ||
    !!document.querySelector('input[id*="date" i], input[name*="date" i], input[type="date"]');
  const looksLikeDateStep =
    (headingText.includes('add a time log') || headingText.includes('edit time log')) &&
    (bodyText.includes('time log date') || hasDateInputHints);

  if (!looksLikeDateStep) return { handled: false, continued: false, reason: 'Not on time log date step.' };

  let dateInput = null;
  let allDateInputs = [];

  // Strongest match: row containing "Time Log Date"
  for (const row of document.querySelectorAll('tr, div, td')) {
    const t = (row.textContent || '').toLowerCase();
    if (!t.includes('time log date')) continue;
    allDateInputs = [...row.querySelectorAll('input[type="text"], input[type="date"]')];
    dateInput = allDateInputs[0] || null;
    if (dateInput) break;
  }

  if (!dateInput) {
    dateInput =
      findFieldByLabel('Time Log Date') ||
      document.querySelector('input[placeholder="MM/DD/YYYY"]') ||
      document.querySelector('input[type="date"]') ||
      [...document.querySelectorAll('input[type="text"]')].find(i => i.offsetParent !== null);
    if (dateInput) allDateInputs = [dateInput];
  }

  if (!dateInput) return { handled: false, continued: false, reason: 'Could not find Time Log Date input on page.' };

  const globalDateCandidates = [
    ...document.querySelectorAll('input[placeholder*="MM" i][placeholder*="YYYY" i]'),
    ...document.querySelectorAll('input[id*="date" i], input[name*="date" i]')
  ];
  allDateInputs = [...new Set([...allDateInputs, ...globalDateCandidates].filter(Boolean))];
  if (!allDateInputs.length) allDateInputs = [dateInput];

  allDateInputs.forEach(inp => {
    setInputNative(inp, dateStr);
    try { inp.setAttribute('value', dateStr); } catch (e) {}
  });

  // Prefer the Continue button in the same form as the date input.
  function clickContinueNearDateInput() {
    const form = dateInput.closest('form') || document;
    const candidates = [
      ...form.querySelectorAll('input[type="submit"], input[type="button"], button, a')
    ];
    const next = candidates.find(el => {
      const t = (el.value || el.textContent || '').toLowerCase().trim();
      if (t.includes('cancel')) return false;
      return t.includes('continue') || t === 'next' || t === 'submit';
    });
    if (next) {
      next.click();
      return true;
    }
    return false;
  }

  // Typhon sometimes attaches validation handlers asynchronously; retry for several seconds.
  [120, 320, 620, 950, 1300, 1800].forEach(ms => {
    setTimeout(() => {
      allDateInputs.forEach(inp => setInputNative(inp, dateStr));
      if (!clickContinueNearDateInput()) {
        if (!clickNextButton()) {
          const form = dateInput.closest('form');
          if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
          else if (form && typeof form.submit === 'function') form.submit();
        }
      }
    }, ms);
  });

  return { handled: true, continued: true };
}

function isTimeLogDateStepPage() {
  const headingText = (document.querySelector('h1, h2, h3')?.textContent || '').toLowerCase();
  const bodyText = (document.body?.innerText || '').toLowerCase();
  return (headingText.includes('add a time log') || headingText.includes('edit time log')) &&
    bodyText.includes('time log date');
}

function autoRunTimeLogDateStepIfPossible() {
  if (!isTimeLogDateStepPage()) return;
  if (window.__typhonAutoTimeLogDateDone) return;
  if (window.__typhonAutoTimeLogDateRetriesStarted) return;
  window.__typhonAutoTimeLogDateRetriesStarted = true;

  let attempts = 0;
  const maxAttempts = 12;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.__typhonAutoTimeLogDateDone || attempts > maxAttempts) {
      clearInterval(timer);
      return;
    }

    chrome.storage.local.get('typhon-items', (data) => {
      const items = (data['typhon-items'] || []).filter(i => i && i.type === 'timelog' && !i.submitted && !!i.date);
      if (!items.length) return;

      let candidate = null;
      const last = data['typhon-last-filled-timelog'] || window.__typhonLastFilledTimeLog || null;
      if (last && last.id) {
        candidate = items.find(i => String(i.id || '') === String(last.id || '')) || null;
      }
      if (!candidate && last) {
        candidate = items.find(i =>
          String(i.date || '') === String(last.date || '') &&
          String(i.clockIn1 || '') === String(last.clockIn1 || '') &&
          String(i.clockOut1 || '') === String(last.clockOut1 || '')
        ) || null;
      }
      // Safe fallback only when there is exactly one unsubmitted time log.
      if (!candidate && items.length === 1) candidate = items[0];
      if (!candidate) return;

      const result = fillTimeLogDateStep(candidate);
      if (result && result.handled) {
        window.__typhonAutoTimeLogDateDone = true;
        clearInterval(timer);
      }
    });
  }, 450);
}

// ============================================================
// FILL TIME LOG
// ============================================================
function fillTimeLog(data) {
  rememberLastFilledTimeLog(data);

  const dateStep = fillTimeLogDateStep(data);
  if (dateStep.handled) return { mode: 'date-step', continued: dateStep.continued };
  if (isTimeLogDateStepPage()) {
    return {
      mode: 'date-step',
      continued: false,
      error: dateStep.reason || 'Could not set Time Log Date on date step page.'
    };
  }

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

  return { mode: 'entry' };
}

function rememberLastFilledTimeLog(data) {
  if (!data || data.type !== 'timelog') return;
  const payload = {
    id: data.id || '',
    type: 'timelog',
    date: data.date || '',
    clockIn1: data.clockIn1 || '',
    clockOut1: data.clockOut1 || '',
    recordedAt: Date.now()
  };
  window.__typhonLastFilledTimeLog = payload;
  try { chrome.storage.local.set({ 'typhon-last-filled-timelog': payload }); } catch (e) {}
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
  if (data.general) {
    check('General Anesthesia', true) ||
    check('General Anesthetic', true) ||
    check('Perform General Anesthetic', true);
  }

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

  rememberLastFilledCase(data);
}

function fillEvaluation(data) {
  if (!data) return false;

  const dateStr = isoToTyphonDate(data.date);
  if (dateStr) {
    const dateInput =
      findFieldByLabel('Date') ||
      findFieldByLabel('Evaluation Date') ||
      document.querySelector('input[placeholder="MM/DD/YYYY"], input[type="date"]');
    if (dateInput) setInputNative(dateInput, dateStr);
  }

  const preceptorInput =
    findFieldByLabel('Preceptor') ||
    findFieldByLabel('Preceptor Name') ||
    document.querySelector('input[id*="preceptor" i], input[name*="preceptor" i]');
  if (preceptorInput && data.preceptorName) setInput(preceptorInput, data.preceptorName);

  const summaryInput =
    findFieldByLabel('Summary') ||
    findFieldByLabel('Day Summary') ||
    document.querySelector('textarea[id*="summary" i], textarea[name*="summary" i]');
  if (summaryInput && data.daySummary) setInput(summaryInput, data.daySummary);

  const commentsInput =
    findFieldByLabel('Preceptor Comments') ||
    findFieldByLabel('Comments') ||
    document.querySelector('textarea[id*="comment" i], textarea[name*="comment" i]');
  if (commentsInput && data.preceptorComments) setInput(commentsInput, data.preceptorComments);

  return true;
}

function rememberLastFilledCase(data) {
  if (!data || data.type !== 'case') return;
  const payload = {
    id: data.id || '',
    type: 'case',
    date: data.date || '',
    age: data.age || '',
    biologicalSex: data.biologicalSex || '',
    asa: data.asa || '',
    anesStart: data.anesStart || '',
    anesFinish: data.anesFinish || '',
    recordedAt: Date.now()
  };
  window.__typhonLastFilledCase = payload;
  try { chrome.storage.local.set({ 'typhon-last-filled-case': payload }); } catch (e) {}
}

function markLastFilledCaseSubmitted(onDone) {
  const finish = function(ok, msg) {
    if (typeof onDone === 'function') onDone(ok, msg || '');
  };

  try {
    chrome.storage.local.get(['typhon-items', 'typhon-last-filled-case'], (data) => {
      const items = (data['typhon-items'] || []).slice();
      const last = data['typhon-last-filled-case'] || window.__typhonLastFilledCase || null;
      if (!items.length || !last) {
        finish(false, 'No matching pending case found.');
        return;
      }

      let idx = -1;
      if (last.id) {
        idx = items.findIndex(i => i && i.type === 'case' && !i.submitted && String(i.id || '') === String(last.id));
      }

      // Fallback matcher when id is unavailable.
      if (idx < 0) {
        idx = items.findIndex(i => i && i.type === 'case' && !i.submitted &&
          String(i.date || '') === String(last.date || '') &&
          String(i.asa || '') === String(last.asa || '') &&
          String(i.age || '') === String(last.age || '') &&
          String(i.biologicalSex || '') === String(last.biologicalSex || '') &&
          String(i.anesStart || '') === String(last.anesStart || '') &&
          String(i.anesFinish || '') === String(last.anesFinish || '')
        );
      }

      // Final fallback: most-recent pending case on the same date.
      if (idx < 0 && last.date) {
        for (let j = items.length - 1; j >= 0; j--) {
          const it = items[j];
          if (it && it.type === 'case' && !it.submitted && String(it.date || '') === String(last.date || '')) {
            idx = j;
            break;
          }
        }
      }

      if (idx < 0) {
        finish(false, 'No matching pending case found.');
        return;
      }

      items[idx].submitted = true;
      chrome.storage.local.set({ 'typhon-items': items }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(false, 'Could not update Typhon Helper storage.');
          return;
        }
        finish(true, 'Marked submitted in Typhon Helper.');
      });
    });
  } catch (e) {
    finish(false, 'Unable to update Typhon Helper status.');
  }
}

function markLastFilledTimeLogSubmitted(onDone) {
  const finish = function(ok, msg) {
    if (typeof onDone === 'function') onDone(ok, msg || '');
  };

  try {
    chrome.storage.local.get(['typhon-items', 'typhon-last-filled-timelog'], (data) => {
      const items = (data['typhon-items'] || []).slice();
      const last = data['typhon-last-filled-timelog'] || window.__typhonLastFilledTimeLog || null;
      if (!items.length || !last) {
        finish(false, 'No matching pending time log found.');
        return;
      }

      let idx = -1;
      if (last.id) {
        idx = items.findIndex(i => i && i.type === 'timelog' && !i.submitted && String(i.id || '') === String(last.id || ''));
      }

      // Fallback matcher when id is unavailable.
      if (idx < 0) {
        idx = items.findIndex(i => i && i.type === 'timelog' && !i.submitted &&
          String(i.date || '') === String(last.date || '') &&
          String(i.clockIn1 || '') === String(last.clockIn1 || '') &&
          String(i.clockOut1 || '') === String(last.clockOut1 || '')
        );
      }

      // Final fallback: most-recent pending timelog on the same date.
      if (idx < 0 && last.date) {
        for (let j = items.length - 1; j >= 0; j--) {
          const it = items[j];
          if (it && it.type === 'timelog' && !it.submitted && String(it.date || '') === String(last.date || '')) {
            idx = j;
            break;
          }
        }
      }

      if (idx < 0) {
        finish(false, 'No matching pending time log found.');
        return;
      }

      items[idx].submitted = true;
      chrome.storage.local.set({ 'typhon-items': items }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(false, 'Could not update Typhon Helper storage.');
          return;
        }
        finish(true, 'Marked time log submitted in Typhon Helper.');
      });
    });
  } catch (e) {
    finish(false, 'Unable to update Typhon Helper status.');
  }
}

function installCaseSubmitPrompt() {
  if (window.__typhonCaseSubmitPromptInstalled) return;
  window.__typhonCaseSubmitPromptInstalled = true;

  document.addEventListener('click', function(event) {
    if (getPageType() !== 'caselog') return;

    const el = event.target && event.target.closest
      ? event.target.closest('input[type="submit"], input[type="button"], button, a')
      : null;
    if (!el) return;

    const text = (el.value || el.textContent || '').toLowerCase().trim();
    if (!text) return;
    if (text.includes('cancel')) return;
    if (!(text.includes('save data') || text === 'save' || text.includes('submit'))) return;

    const now = Date.now();
    if (window.__typhonSubmitPromptAt && now - window.__typhonSubmitPromptAt < 1200) return;
    window.__typhonSubmitPromptAt = now;

    const ok = window.confirm('Mark this case as Submitted in Typhon Helper?');
    if (!ok) return;

    markLastFilledCaseSubmitted(function(marked, msg) {
      if (!marked) {
        try { window.alert(msg || 'Could not mark as submitted.'); } catch (e) {}
      }
    });
  }, true);
}

function installTimeLogSubmitPrompt() {
  if (window.__typhonTimeLogSubmitPromptInstalled) return;
  window.__typhonTimeLogSubmitPromptInstalled = true;

  document.addEventListener('click', function(event) {
    if (getPageType() !== 'timelog') return;

    const el = event.target && event.target.closest
      ? event.target.closest('input[type="submit"], input[type="button"], button, a')
      : null;
    if (!el) return;

    const text = (el.value || el.textContent || '').toLowerCase().trim();
    if (!text) return;
    if (text.includes('cancel')) return;
    if (!(text.includes('save data') || text === 'save' || text.includes('submit'))) return;

    const now = Date.now();
    if (window.__typhonTimeSubmitPromptAt && now - window.__typhonTimeSubmitPromptAt < 1200) return;
    window.__typhonTimeSubmitPromptAt = now;

    const ok = window.confirm('Mark this time log as Submitted in Typhon Helper?');
    if (!ok) return;

    markLastFilledTimeLogSubmitted(function(marked, msg) {
      if (!marked) {
        try { window.alert(msg || 'Could not mark as submitted.'); } catch (e) {}
      }
    });
  }, true);
}

// ============================================================
// FLOATING FILL BUTTON
// Injected directly onto Typhon entry pages so you never need to open the popup.
// ============================================================
function fmtDateShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function injectFloatingFillButton() {
  const pageType = getPageType();
  if (pageType === 'unknown') return;
  if (document.getElementById('typhon-helper-float')) return; // already injected

  chrome.storage.local.get('typhon-items', (data) => {
    const items = (data['typhon-items'] || []).filter(i => !i.submitted);
    const matching = items.filter(i =>
      (pageType === 'caselog'   && i.type === 'case') ||
      (pageType === 'casedate'    && i.type === 'case') ||
      (pageType === 'mainmenu'    && (i.type === 'case' || i.type === 'timelog' || i.type === 'eval')) ||
      (pageType === 'timeloglist' && i.type === 'timelog') ||
      (pageType === 'timelog'     && i.type === 'timelog') ||
      (pageType === 'eval'        && i.type === 'eval')
    );
    if (!matching.length) return;

    const caseItems = matching.filter(i => i.type === 'case');
    const timeItems = matching.filter(i => i.type === 'timelog');
    const evalItems = matching.filter(i => i.type === 'eval');

    const wrapper = document.createElement('div');
    wrapper.id = 'typhon-helper-float';
    wrapper.style.cssText = [
      'position:fixed', 'bottom:22px', 'right:22px', 'z-index:2147483647',
      'display:flex', 'flex-direction:column', 'align-items:flex-end', 'gap:6px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
    ].join(';');

    const totalPending = matching.length;
    if (totalPending > 1) {
      const badge = document.createElement('div');
      badge.textContent = `${totalPending} pending`;
      badge.style.cssText = [
        'font-size:11px', 'font-weight:700', 'color:white',
        'background:rgba(0,0,0,0.45)', 'border-radius:20px',
        'padding:3px 9px', 'letter-spacing:0.3px'
      ].join(';');
      wrapper.appendChild(badge);
    }

    function makeBtn(item, btnPageType) {
      const isTimeLogBtn = (btnPageType === 'timelog' || item.type === 'timelog');
      const isEvalBtn = (btnPageType === 'eval' || item.type === 'eval');
      const timeLabel = `${fmtDateShort(item.date)}  ${item.clockIn1 || '?'} → ${item.clockOut1 || '?'}`;
      const caseLine1 = `Age ${item.age || '?'} · ${item.biologicalSex || '?'} · ASA ${item.asa || '?'}`;
      const caseLine2 = `${item.anesStart || '?'} → ${item.anesFinish || '?'}`;
      const evalLine1 = item.preceptorName ? `Preceptor: ${item.preceptorName}` : 'Preceptor pending';
      const evalLine2 = (item.facility && item.facility.length) ? item.facility.join(' / ') : 'No facility selected';

      const btn = document.createElement('button');
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:8px',
        'padding:11px 18px', 'border:none', 'border-radius:14px', 'cursor:pointer',
        'background:linear-gradient(135deg,#0d6e6e,#1e8f5b)',
        'color:white', 'box-shadow:0 6px 20px rgba(13,110,110,0.45)',
        'font-size:13px', 'font-weight:700', 'letter-spacing:0.1px',
        'transition:transform 0.15s,box-shadow 0.15s', 'white-space:nowrap'
      ].join(';');

      const icon = document.createElement('span');
      icon.textContent = item.type === 'timelog' ? '⏱' : item.type === 'eval' ? '📋' : '⚡';
      icon.style.fontSize = '15px';

      const textWrap = document.createElement('span');
      const mainLine = document.createElement('div');
      mainLine.textContent = item.type === 'timelog' && btnPageType === 'mainmenu'    ? 'Add New Time Log →'
                           : item.type === 'timelog' && btnPageType === 'timeloglist' ? 'Add New Time Log →'
                           : item.type === 'timelog'    ? 'Fill Time Log'
                           : item.type === 'eval' && btnPageType === 'mainmenu' ? 'Add Daily Evaluation →'
                           : item.type === 'eval' ? 'Fill Daily Evaluation'
                           : btnPageType === 'casedate' ? 'Fill Date & Continue →'
                           : btnPageType === 'mainmenu' ? 'Add Case Log'
                           : 'Fill Case Log';
      const subLine = document.createElement('div');
      subLine.textContent = isTimeLogBtn ? timeLabel : isEvalBtn ? evalLine1 : caseLine1;
      subLine.style.cssText = 'font-size:11px;opacity:0.82;font-weight:500;margin-top:1px';
      textWrap.appendChild(mainLine);
      textWrap.appendChild(subLine);
      if (!isTimeLogBtn) {
        const subLine2 = document.createElement('div');
        subLine2.textContent = isEvalBtn ? evalLine2 : caseLine2;
        subLine2.style.cssText = 'font-size:11px;opacity:0.82;font-weight:500;margin-top:1px';
        textWrap.appendChild(subLine2);
      }
      btn.appendChild(icon);
      btn.appendChild(textWrap);

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 10px 28px rgba(13,110,110,0.55)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.boxShadow = '0 6px 20px rgba(13,110,110,0.45)';
      });

      btn.addEventListener('click', () => {
        btn.style.pointerEvents = 'none';
        try {
          if (item.type === 'timelog' && btnPageType === 'timelog') {
            const result = fillTimeLog(item);
            icon.textContent = '✓';
            mainLine.textContent = result && result.mode === 'date-step'
              ? 'Date filled — continuing…'
              : 'Filled — review & save';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
          } else if (item.type === 'timelog' && btnPageType === 'timeloglist') {
            icon.textContent = '✓';
            mainLine.textContent = 'Opening form…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            if (!clickAddNewTimeLogBtn()) throw new Error('Could not find Add New Time Log button.');
          } else if (item.type === 'timelog' && btnPageType === 'mainmenu') {
            icon.textContent = '✓';
            mainLine.textContent = 'Opening…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            if (!clickAddNewTimeLog()) throw new Error('Could not find My Time Logs link.');
          } else if (item.type === 'eval' && btnPageType === 'mainmenu') {
            icon.textContent = '✓';
            mainLine.textContent = 'Opening…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            if (!clickAddNewEval()) throw new Error('Could not find Daily Evaluation link.');
          } else if (item.type === 'eval') {
            fillEvaluation(item);
            icon.textContent = '✓';
            mainLine.textContent = 'Filled — review & save';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
          } else if (btnPageType === 'mainmenu') {
            icon.textContent = '✓';
            mainLine.textContent = 'Opening…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            if (!clickAddNewCaseLog()) throw new Error('Could not find Add New Case Log link.');
          } else if (btnPageType === 'casedate') {
            const filled = fillCaseDatePage(item);
            if (!filled) throw new Error('Could not find date field on this page.');
            icon.textContent = '✓';
            mainLine.textContent = 'Date filled — continuing…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            setTimeout(() => {
              if (!clickNextButton()) mainLine.textContent = 'Date filled — click Next';
            }, 300);
          } else {
            fillCaseLog(item);
            icon.textContent = '✓';
            mainLine.textContent = 'Filled — review & save';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
          }
        } catch (e) {
          icon.textContent = '⚠';
          mainLine.textContent = 'Fill failed';
          subLine.textContent = e.message || 'Unknown error';
          btn.style.background = 'linear-gradient(135deg,#c0392b,#e74c3c)';
          btn.style.pointerEvents = 'auto';
        }
      });

      return btn;
    }

    // On main menu: show a button for each type that has pending items
    if (pageType === 'mainmenu') {
      if (timeItems.length)  wrapper.appendChild(makeBtn(timeItems[0],  'mainmenu'));
      if (caseItems.length)  wrapper.appendChild(makeBtn(caseItems[0],  'mainmenu'));
      if (evalItems.length)  wrapper.appendChild(makeBtn(evalItems[0],  'mainmenu'));
    } else {
      const item = matching[0];
      wrapper.appendChild(makeBtn(item, pageType));
    }
    document.body.appendChild(wrapper);
  });
}

// Run after DOM is fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectFloatingFillButton();
    installCaseSubmitPrompt();
    installTimeLogSubmitPrompt();
    setTimeout(autoRunTimeLogDateStepIfPossible, 300);
  });
} else {
  // Small delay so Typhon's own JS finishes rendering the form
  setTimeout(() => {
    injectFloatingFillButton();
    installCaseSubmitPrompt();
    installTimeLogSubmitPrompt();
    autoRunTimeLogDateStepIfPossible();
  }, 600);
}

// ============================================================
// MESSAGE LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageType') {
    sendResponse({ pageType: getPageType() });
    return true;
  }

  if (message.action === 'navigateToAddCaseLog') {
    const ok = clickAddNewCaseLog();
    sendResponse({ success: ok });
    return true;
  }

  if (message.action === 'navigateToAddTimeLog') {
    const ok = clickAddNewTimeLog();
    sendResponse({ success: ok });
    return true;
  }

  if (message.action === 'navigateToAddTimeLogForm') {
    const ok = clickAddNewTimeLogBtn();
    sendResponse({ success: ok });
    return true;
  }

  if (message.action === 'navigateToAddEval') {
    const ok = clickAddNewEval();
    sendResponse({ success: ok });
    return true;
  }

  if (message.action === 'fill') {
    const pageType = getPageType();
    const dataType = message.data?.type;

    if (pageType === 'timelog' && dataType === 'timelog') {
      const result = fillTimeLog(message.data);
      if (result?.error) {
        sendResponse({ success: false, filled: 'timelog', mode: result?.mode || 'entry', reason: result.error });
      } else {
        sendResponse({ success: true, filled: 'timelog', mode: result?.mode || 'entry' });
      }
    } else if (pageType === 'eval' && dataType === 'eval') {
      const ok = fillEvaluation(message.data);
      if (!ok) {
        sendResponse({ success: false, filled: 'eval', reason: 'Could not fill evaluation fields on this page.' });
      } else {
        sendResponse({ success: true, filled: 'eval', mode: 'entry' });
      }
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
