// content.js — injected into all typhon.net pages
// Detects page type and fills forms based on data from the popup

// ============================================================
// DETECT PAGE TYPE
// ============================================================
function getPageType() {
  const title   = document.title.toLowerCase();
  const url     = window.location.href.toLowerCase();

  // Collect text from the top-level document AND any same-origin iframes
  // (Typhon renders real content inside iframes; outer doc only has nav chrome)
  function gatherText(doc) {
    return (doc?.body?.innerText || '').toLowerCase();
  }
  function gatherHeadings(doc) {
    return [...(doc?.querySelectorAll('h1,h2,h3') || [])].map(h => h.textContent).join(' ').toLowerCase();
  }
  const iframeDocs = [...document.querySelectorAll('iframe')].map(f => {
    try { return f.contentDocument; } catch (e) { return null; }
  }).filter(Boolean);
  const allDocs = [document, ...iframeDocs];

  const body    = allDocs.map(gatherText).join(' ');
  const heading = allDocs.map(gatherHeadings).join(' ');

  // ── URL-based detection (most reliable — Typhon uses predictable ASP filenames) ──
  // timelog1.asp covers both the date-picker step AND the clock in/out entry form
  if (url.includes('timelog1.asp')) return 'timelog';
  // Time log list: timelogs.asp
  if (url.includes('timelogs.asp')) return 'timeloglist';
  // Case log data entry: data2.asp
  if (url.includes('/nast/data/data2.asp')) return 'caselog';
  // Lumina EASI SJF survey page (respond/survey URL) — must be before text-based detection
  if (url.includes('/EASI/respond/survey/') || url.includes('/easi/respond/survey/')) return 'sjfsurvey';

  // ── Text-based detection (fallback for unknown URL patterns) ──
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
  // Eval selection list — "My Evaluations & Surveys" (must detect before generic eval entry)
  const looksLikeEvalList =
    heading.includes('my evaluations') ||
    (body.includes('daily clinical evaluation sjf') && !body.includes('preceptor comments') && !body.includes('preceptor signature'));
  if (looksLikeEvalList) {
    return 'evallist';
  }
  // Evaluation page
  if (looksLikeEvalEntry) {
    return 'eval';
  }
  // Case log entry page (the actual data entry form, not the list view)
  if ((heading.includes('case log') && document.querySelector('select, input[type="text"]')) ||
      url.includes('caselog') || url.includes('case_log') || url.includes('casedata') ||
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

// Returns all searchable documents: top-level + same-origin iframes.
// Typhon renders page content inside iframes; all DOM queries should use this.
function getAllSearchDocs() {
  const docs = [document];
  for (const frame of document.querySelectorAll('iframe')) {
    try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (e) {}
  }
  return docs;
}

// querySelector across all docs (top-level + iframes)
function docQuerySelector(selector) {
  for (const doc of getAllSearchDocs()) {
    const el = doc.querySelector(selector);
    if (el) return el;
  }
  return null;
}

// querySelectorAll across all docs (top-level + iframes), returns flat array
function docQuerySelectorAll(selector) {
  const results = [];
  for (const doc of getAllSearchDocs()) {
    results.push(...doc.querySelectorAll(selector));
  }
  return results;
}

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
  // findFieldByLabel may return the chosen.js container <div> (id="location")
  // instead of the underlying hidden <select>. Unwrap it.
  const byLabel = findFieldByLabel('Clinical Site');
  if (byLabel?.tagName === 'SELECT') return byLabel;
  if (byLabel) {
    // chosen.js hides the original <select> just before its container div, or inside it
    const inner = byLabel.querySelector('select');
    if (inner) return inner;
    let sib = byLabel.previousElementSibling;
    while (sib) {
      if (sib.tagName === 'SELECT') return sib;
      sib = sib.previousElementSibling;
    }
    const parentSel = byLabel.parentElement?.querySelector('select');
    if (parentSel) return parentSel;
  }
  return findLikelySelectByHints(['clinical site', 'clinical_site', 'site', 'facility', 'hospital']);
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

  // Set value SILENTLY — do NOT fire 'change'. Typhon listens to change on this
  // select and makes an AJAX call (check.asp?facility=...) which reloads the form,
  // wiping all our filled values. We set the native value directly, then update
  // chosen.js cosmetically via an injected page script.
  const result = setSelectSilent(selectEl, candidates) || setSelectSilent(selectEl, [siteName]);
  if (result) {
    // Notify chosen.js / tomselect via page-bridge.js (MAIN world), which has
    // access to the page's own jQuery instance. We can't call jQuery directly
    // from the isolated content script world, and inline script injection is
    // blocked by Typhon's CSP — so we bridge via a CustomEvent on document.
    try {
      document.dispatchEvent(new CustomEvent('__typhon_chosen_update', {
        detail: { selId: selectEl.id || '', selName: selectEl.name || '' }
      }));
    } catch(e) {}
  }
  return result;
}

// Set a select value by matching candidate texts — without dispatching 'change'.
// Used for dropdowns whose change event triggers unwanted AJAX (e.g. Clinical Site).
function setSelectSilent(el, candidates) {
  if (!el || el.tagName !== 'SELECT') return false;
  const needles = (candidates || []).map(normalizeText).filter(Boolean);
  if (!needles.length) return false;
  const options = [...el.options].filter(opt => !opt.disabled && opt.value !== '');
  // Exact match first
  for (const needle of needles) {
    for (const opt of options) {
      if (normalizeText(opt.text) === needle) {
        el.value = opt.value;
        el.dispatchEvent(new Event('input', { bubbles: true })); // input only, no change
        return true;
      }
    }
  }
  // Contains match
  for (const needle of needles) {
    for (const opt of options) {
      const text = normalizeText(opt.text);
      if (text && (text.includes(needle) || needle.includes(text))) {
        el.value = opt.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
  }
  return false;
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
  // NOTE: Do NOT dispatch 'change' on the Clinical Site select — Typhon listens
  // to that event and fires an AJAX reload of the form (check.asp?facility=...).
  // We skip it here; setClinicalSite() will set it silently after reset.
  const clinicalSiteSel = findClinicalSiteSelect();
  document.querySelectorAll('select').forEach(sel => {
    sel.selectedIndex = 0;
    if (sel === clinicalSiteSel) return; // skip change — would trigger AJAX reload
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
  // From the time log list page: click the green "+ Add New Time Log" button (search iframes too)
  const btn = docQuerySelectorAll('a, button')
    .find(el => /add new time log/i.test(el.textContent.trim()));
  if (btn) { btn.click(); return true; }
  return false;
}

function clickAddNewEval() {
  const links = [...document.querySelectorAll('a, button')];
  // First try: "My Evaluations & Surveys" menu link (Typhon main menu)
  const menuLink = links.find(el => /my evaluations/i.test((el.textContent || '').trim()));
  if (menuLink) { menuLink.click(); return true; }
  // Fallback: direct daily eval links
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

function clickDailyEvalSJF() {
  const target = docQuerySelectorAll('a, button, td').find(el =>
    /daily clinical evaluation sjf/i.test((el.textContent || '').trim())
  );
  if (target) { target.click(); return true; }
  return false;
}

// Incremented each time a new fill is initiated — lets stale timers detect they've been superseded
let _fillGeneration = 0;

function fillEvalSJFPanel(item) {
  const myGeneration = ++_fillGeneration;
  // After clicking "Daily Clinical Evaluation SJF", the ng-select panel renders.
  // Store the eval item so the survey page can auto-fill from it after "Begin New Survey" navigates.
  if (item) {
    try { chrome.storage.local.set({ 'typhon-pending-sjf-fill': item }); } catch(e) {}
  }
  // The reviewee dropdown always contains only the student (self) — open it and click first option.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const input = document.querySelector('input#reviewee-dropdown, input[role="combobox"]');
    if (!input) {
      if (attempts >= 20) clearInterval(timer);
      return;
    }
    clearInterval(timer);

    // ng-select opens on mousedown on the container, not click on the input
    const container = input.closest('.ng-select-container') || input.closest('.ng-select') || input.parentElement;
    const openTarget = container || input;
    openTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    openTarget.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    input.focus();

    // Poll for options to appear (up to ~3s)
    let optAttempts = 0;
    const optTimer = setInterval(() => {
      optAttempts++;
      const option = document.querySelector('.ng-option:not(.ng-option-disabled)');
      if (!option) {
        if (optAttempts >= 15) clearInterval(optTimer);
        return;
      }
      clearInterval(optTimer);
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option.click();

      // After selection, click Begin New Survey
      setTimeout(() => {
        const beginBtn = [...document.querySelectorAll('button')].find(b =>
          /begin new survey/i.test((b.textContent || '').trim())
        );
        if (beginBtn) {
          beginBtn.click();
          // The survey form is loaded via Angular SPA routing (pushState) — no new page load,
          // so content.js is NOT re-injected. Poll here until the survey URL and form appear.
          let surveyAttempts = 0;
          const surveyTimer = setInterval(() => {
            surveyAttempts++;
            const onSurveyPage = window.location.href.toLowerCase().includes('/easi/respond/survey/');
            const inputCount = document.querySelectorAll('input[type="radio"], input[type="checkbox"]').length;
            if (!onSurveyPage || inputCount < 6) {
              if (surveyAttempts >= 75) { // ~15s timeout
                clearInterval(surveyTimer);
                showTyphonToast('⚠ Survey page not detected — please fill manually');
              }
              return;
            }
            if (_fillGeneration !== myGeneration) { clearInterval(surveyTimer); return; }
            clearInterval(surveyTimer);
            // Remove old floating button (from evallist page, now stale)
            const oldFloat = document.getElementById('typhon-helper-float');
            if (oldFloat) oldFloat.remove();
            // Give Angular one extra tick to finish rendering all form controls
            setTimeout(() => {
              if (_fillGeneration !== myGeneration) return; // still stale-check before filling
              fillSJFSurvey(item);
              rememberLastFilledEval(item);
              showTyphonToast('Daily Eval SJF filled ✓ — review and submit');
              chrome.storage.local.remove('typhon-pending-sjf-fill');
            }, 300);
          }, 200);
        }
      }, 500);
    }, 200);
  }, 200);
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
  // Find the "Continue" button on the date picker page (search iframes too)
  const candidates = docQuerySelectorAll('input[type="submit"], input[type="button"], button');
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

  // Check via iframe-aware body text: date step has 'time log date' but no clock fields
  const docs = getAllSearchDocs();
  const bodyText = docs.map(d => d.body?.innerText || '').join(' ').toLowerCase();
  const hasTimeLogDate = bodyText.includes('time log date');
  const hasClockFields = bodyText.includes('clock in') || bodyText.includes('clock out');

  if (!hasTimeLogDate || hasClockFields) {
    return { handled: false, continued: false, reason: 'Not on time log date step.' };
  }

  let dateInput = null;
  let allDateInputs = [];

  // Strongest match: row containing "Time Log Date" (search all docs including iframes)
  for (const row of docQuerySelectorAll('tr, div, td')) {
    const t = (row.textContent || '').toLowerCase();
    if (!t.includes('time log date')) continue;
    allDateInputs = [...row.querySelectorAll('input[type="text"], input[type="date"]')];
    dateInput = allDateInputs[0] || null;
    if (dateInput) break;
  }

  if (!dateInput) {
    dateInput =
      docQuerySelector('input[placeholder="MM/DD/YYYY"]') ||
      docQuerySelector('input[type="date"]') ||
      docQuerySelectorAll('input[type="text"]').find(i => i.offsetParent !== null);
    if (dateInput) allDateInputs = [dateInput];
  }

  if (!dateInput) return { handled: false, continued: false, reason: 'Could not find Time Log Date input on page.' };

  const globalDateCandidates = [
    ...docQuerySelectorAll('input[placeholder*="MM" i][placeholder*="YYYY" i]'),
    ...docQuerySelectorAll('input[id*="date" i], input[name*="date" i]')
  ];
  allDateInputs = [...new Set([...allDateInputs, ...globalDateCandidates].filter(Boolean))];
  if (!allDateInputs.length) allDateInputs = [dateInput];

  allDateInputs.forEach(inp => {
    setInputNative(inp, dateStr);
    try { inp.setAttribute('value', dateStr); } catch (e) {}
  });

  // Prefer the Continue button in the same form as the date input.
  function clickContinueNearDateInput() {
    const form = dateInput.closest('form') || dateInput.ownerDocument;
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
  // The date-picker step has "time log date" label but NO clock in/out fields.
  // The full time entry form has clock fields — that's how we distinguish them
  // even when both share the same URL (timelog1.asp).
  const docs = getAllSearchDocs();
  const bodyText = docs.map(d => d.body?.innerText || '').join(' ').toLowerCase();
  const hasTimeLogDate = bodyText.includes('time log date');
  const hasClockFields = bodyText.includes('clock in') || bodyText.includes('clock out');
  return hasTimeLogDate && !hasClockFields;
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

  // Find clock in/out inputs by looking for rows with "Clock" in the label (search iframes too)
  const clockInputs = [];
  for (const td of docQuerySelectorAll('td, th, label')) {
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
    : docQuerySelectorAll('input[type="text"]').filter(i => i.offsetParent !== null);

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
  const siteEl = findClinicalSiteSelect();

  // If no clinical site was saved in the item, read whatever Typhon has
  // pre-selected on the page (from server/cookie) BEFORE we reset the form.
  // Then we can restore it without firing the AJAX again.
  const preSelectedSiteVal  = siteEl ? siteEl.value : '';
  const preSelectedSiteText = (siteEl && siteEl.selectedIndex >= 0)
    ? (siteEl.options[siteEl.selectedIndex] || {}).text || ''
    : '';

  resetCaseLogForm();

  if (siteEl && data.clinicalSite) {
    // We have a stored site name — fire change so Typhon's check.asp AJAX
    // registers the facility server-side, then fill after it settles.
    setClinicalSite(siteEl, data.clinicalSite);
    siteEl.dispatchEvent(new Event('change', { bubbles: true }));

    let done = false;
    let timer;
    const finish = () => {
      if (done) return;
      done = true;
      obs.disconnect();
      clearTimeout(timer);
      fillCaseLogFields(data);
    };
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(finish, 400);
    });
    obs.observe(document.body, { subtree: true, childList: true });
    timer = setTimeout(finish, 1500);
  } else {
    // No stored clinical site — restore Typhon's pre-selected value silently
    // (no change event = no AJAX = server-side Facility hidden field stays intact).
    if (siteEl && preSelectedSiteVal) {
      siteEl.value = preSelectedSiteVal;
      // Notify chosen.js cosmetically
      document.dispatchEvent(new CustomEvent('__typhon_chosen_update', {
        detail: { selId: siteEl.id || '', selName: siteEl.name || '' }
      }));
    }
    // Store the restored value so the pre-submit interceptor can re-assert it
    window.__typhonLastFilledClinicalSite = preSelectedSiteText || preSelectedSiteVal || null;
    fillCaseLogFields(data);
  }
}

function fillCaseLogFields(data) {
  // Store the clinical site name so the pre-submit interceptor can re-assert it.
  // Use stored value if available; otherwise keep whatever fillCaseLog already set.
  if (data.clinicalSite) {
    window.__typhonLastFilledClinicalSite = data.clinicalSite;
  }
  // (if no data.clinicalSite, fillCaseLog already set it from Typhon's pre-selection)

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

// ============================================================
// FILL SJF SURVEY (Lumina EASI respond/survey page)
// ============================================================
function fillSJFSurvey(data) {
  if (!data) return;

  // Find the nearest ancestor of a text node matching snippet that also contains an input/textarea.
  // Uses TreeWalker (text nodes only) — much faster than querySelectorAll('div,...') on large Angular DOMs.
  function findQContainer(snippet) {
    const lower = snippet.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.toLowerCase().includes(lower)) continue;
      // Walk up from the text node until we find an ancestor that contains an input/textarea
      let el = node.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!el || el === document.body) break;
        if (el.querySelector('input, textarea')) return el;
        el = el.parentElement;
      }
    }
    return null;
  }

  // Fill the inline text input adjacent to a checked "Other:" checkbox.
  // container: scope search within this element.
  // before: only consider checkboxes that precede this element (for Q3 scoping).
  function fillOtherCheckboxText(value, options) {
    if (!value) return;
    const {container, before} = options || {};
    const cbs = [...document.querySelectorAll('input[type="checkbox"]:checked')].filter(cb => {
      const lbl = cb.closest('label');
      return lbl && lbl.textContent.trim().toLowerCase().replace(/[:\s]/g, '') === 'other';
    });
    let targetCb;
    if (container) {
      targetCb = cbs.find(cb => container.contains(cb));
    } else if (before) {
      targetCb = cbs.find(cb => before.compareDocumentPosition(cb) & Node.DOCUMENT_POSITION_PRECEDING);
    } else {
      targetCb = cbs[0];
    }
    if (!targetCb) return;
    for (const inp of document.querySelectorAll('input[type="text"], textarea, input:not([type])')) {
      if (targetCb.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING) {
        setInputNative(inp, value);
        return;
      }
    }
  }

  // Fill a comment/textarea field for a survey question.
  // Strategy: find the question label, then find the first "Additional Comments"
  // label after it, then fill the first text input after that label.
  // This correctly skips any inline "Other:" or question-specific text boxes
  // that appear before the Additional Comments field.
  function fillTA(snippet, value) {
    if (!value) return;
    const lower = snippet.toLowerCase();
    // Collect all text nodes in document order
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    // Find last text node matching the question label snippet
    let qIdx = -1;
    for (let i = textNodes.length - 1; i >= 0; i--) {
      if (textNodes[i].textContent.toLowerCase().includes(lower)) { qIdx = i; break; }
    }
    if (qIdx === -1) return;
    // Find first "Additional Comments" label after the question anchor
    let acNode = null;
    for (let i = qIdx + 1; i < textNodes.length; i++) {
      if (textNodes[i].textContent.toLowerCase().includes('additional comment')) {
        acNode = textNodes[i]; break;
      }
    }
    if (!acNode) return;
    // Fill first text input after the "Additional Comments" label
    for (const inp of document.querySelectorAll('input[type="text"], textarea, input:not([type])')) {
      if (acNode.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING) {
        setInputNative(inp, value);
        return;
      }
    }
  }

  // Click a radio whose label text matches value (case-insensitive, partial for longer values)
  function clickRadio(container, value) {
    if (!container || !value) return false;
    const val = value.toLowerCase();
    for (const radio of container.querySelectorAll('input[type="radio"]')) {
      const lbl = radio.closest('label') ||
        (radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null);
      const text = (lbl ? lbl.textContent : (radio.parentElement || {}).textContent || '').trim().toLowerCase();
      if (text === val || text.startsWith(val) || (val.length > 3 && text.includes(val))) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Tick checkboxes globally whose labels fuzzy-match any value in the array
  function tickCheckboxes(values) {
    if (!values || !values.length) return;
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const normVals = values.map(normalize);
    for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
      const lbl = cb.closest('label') ||
        (cb.id ? document.querySelector(`label[for="${CSS.escape(cb.id)}"]`) : null);
      const text = normalize(lbl ? lbl.textContent : '');
      if (!text) continue;
      const matches = normVals.some(v => {
        if (text === v || text.includes(v) || v.includes(text)) return true;
        // Word-level fallback: only for single-significant-word labels (e.g. "neonate" vs "neonates")
        // Do NOT use for multi-word labels — "intrathoracic lung" must not match "intrathoracic heart"
        const vW = v.split(' ').filter(w => w.length > 3);
        const tW = text.split(' ').filter(w => w.length > 3);
        return vW.length === 1 && tW.length === 1 &&
          (vW[0] === tW[0] || tW[0].startsWith(vW[0]) || vW[0].startsWith(tW[0]));
      });
      if (matches && !cb.checked) {
        cb.click();
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  // Fill the first text input / textarea inside a container
  // Prefers input[name="singleLine"] (Typhon EASI comment/text fields) over generic text inputs
  function fillText(container, value) {
    if (!container || !value) return;
    const input = container.querySelector('input[name="singleLine"], textarea, input[type="text"], input:not([type])');
    if (input) setInputNative(input, value);
  }

  // Q2: Clinical Preceptor Name
  if (data.preceptorName) {
    const q2 = findQContainer('Clinical Preceptor Name');
    fillText(q2, data.preceptorName);
  }

  // Q3: Facility (checkboxes) + optional Other text
  if (data.facility && data.facility.length) tickCheckboxes(data.facility);
  if (data.facilityOther && (data.facility || []).includes('Other')) {
    const q7anchor = findQContainer('surgical case');
    fillOtherCheckboxText(data.facilityOther, { before: q7anchor });
  }

  // Q4: Arrived on time prepared (Yes/No) + comments
  if (data.arrivedPrepared) clickRadio(findQContainer('arrived on time prepared'), data.arrivedPrepared);
  fillTA('arrived on time prepared', data.arrivedComments);

  // Q5: Age ranges (checkboxes)
  if (data.ageRanges && data.ageRanges.length) tickCheckboxes(data.ageRanges);

  // Q6: ASA classes (checkboxes)
  if (data.asaClasses && data.asaClasses.length) tickCheckboxes(data.asaClasses);

  // Q7: Surgical cases (checkboxes) + Other text + comments
  if (data.surgicalCases && data.surgicalCases.length) tickCheckboxes(data.surgicalCases);
  if (data.surgicalCasesOther && (data.surgicalCases || []).includes('Other')) {
    fillOtherCheckboxText(data.surgicalCasesOther, { container: findQContainer('surgical case') });
  }
  fillTA('surgical case', data.surgicalComments);

  // Q8–Q11: Self-evaluation ratings + comments
  const ratingFields = [
    [data.q8,  data.q8Comments,  'preoperative assessment, anesthesia care plan'],
    [data.q9,  data.q9Comments,  'perioperative anesthesia care'],
    [data.q10, data.q10Comments, 'performance of clinical skills'],
    [data.q11, data.q11Comments, 'critical thinking'],
  ];
  for (const [val, comment, snippet] of ratingFields) {
    if (val) clickRadio(findQContainer(snippet), val);
    fillTA(snippet, comment);
  }

  // Q12: Vigilant (Yes/No) + comments
  if (data.vigilant) clickRadio(findQContainer('remained vigilant'), data.vigilant);
  fillTA('remained vigilant', data.vigilantComments);

  // Q13: Documentation (Yes/No/preceptor)
  if (data.documentation) clickRadio(findQContainer('completed all documentation'), data.documentation);

  // Q14: Post-op care — hardcode Yes + comments
  clickRadio(findQContainer('completed post operative care'), 'yes');
  fillTA('completed post operative care', data.postOpCareComments);

  // Q15: Day summary
  if (data.daySummary) fillText(findQContainer('brief summary of the day'), data.daySummary);

  // Q16: Discussed strengths (Yes/No/Other) + other text + comments
  const q16 = findQContainer('discussed my strengths');
  if (data.discussedStrengths) clickRadio(q16, data.discussedStrengths);
  if (data.discussedStrengthsOther && q16) {
    const otherInput = [...(q16.querySelectorAll('input[type="text"], input:not([type])') || [])][0];
    if (otherInput) setInputNative(otherInput, data.discussedStrengthsOther);
  }
  fillTA('discussed my strengths', data.discussedStrengthsComments);

  // Q17: Preceptor comments / areas of improvement
  if (data.preceptorComments) fillText(findQContainer('summarize or have your preceptor'), data.preceptorComments);

  // Q18: Please Type Name (below signature pad)
  if (data.sigName) {
    const typeNameInput =
      document.querySelector('input[placeholder*="ype name" i]') ||
      document.querySelector('input[placeholder*="type your" i]') ||
      document.querySelector('input[placeholder*="your name" i]') ||
      document.querySelector('input[placeholder*="full name" i]') ||
      document.querySelector('input[placeholder*="print name" i]') ||
      (() => {
        for (const snippet of ['type your name', 'type name', 'please type', 'print name', 'printed name', 'student name']) {
          const c = findQContainer(snippet);
          if (c) {
            const inp = c.querySelector('input[type="text"], input:not([type])');
            if (inp) return inp;
          }
        }
        return null;
      })();
    if (typeNameInput) setInputNative(typeNameInput, data.sigName);
  }

  // Preceptor signature canvas — draw the stored signature image onto the survey's canvas
  if (data.sigDataUrl) {
    // Find the signature canvas: look near a "signature" label first, then fall back to largest canvas
    let sigCanvas = null;
    for (const snippet of ['preceptor signature', 'clinical preceptor', 'signature']) {
      const c = findQContainer(snippet);
      if (c) { const cv = c.querySelector('canvas'); if (cv) { sigCanvas = cv; break; } }
    }
    if (!sigCanvas) {
      const canvases = [...document.querySelectorAll('canvas')];
      if (canvases.length) {
        sigCanvas = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      }
    }
    if (sigCanvas) {
      // If the page uses signature_pad.js, fromDataURL() updates both visual and internal state
      const pad = sigCanvas._signaturePad || sigCanvas.signaturePad;
      if (pad && typeof pad.fromDataURL === 'function') {
        pad.fromDataURL(data.sigDataUrl);
      } else {
        const img = new Image();
        img.onload = () => {
          const ctx = sigCanvas.getContext('2d');
          ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          const scale = Math.min(sigCanvas.width / img.width, sigCanvas.height / img.height) * 0.85;
          const x = (sigCanvas.width - img.width * scale) / 2;
          const y = (sigCanvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          sigCanvas.dispatchEvent(new Event('change', { bubbles: true }));
        };
        img.src = data.sigDataUrl;
      }
    }
  }
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

function rememberLastFilledEval(data) {
  if (!data || data.type !== 'eval') return;
  const payload = {
    id: data.id || '',
    type: 'eval',
    date: data.date || '',
    preceptorName: data.preceptorName || '',
    recordedAt: Date.now()
  };
  window.__typhonLastFilledEval = payload;
  try { chrome.storage.local.set({ 'typhon-last-filled-eval': payload }); } catch (e) {}
}

function markLastFilledEvalSubmitted(onDone) {
  const finish = function(ok, msg) {
    if (typeof onDone === 'function') onDone(ok, msg || '');
  };

  try {
    chrome.storage.local.get(['typhon-items', 'typhon-last-filled-eval'], (data) => {
      const items = (data['typhon-items'] || []).slice();
      const last = data['typhon-last-filled-eval'] || window.__typhonLastFilledEval || null;
      if (!items.length || !last) {
        finish(false, 'No matching pending eval found.');
        return;
      }

      let idx = -1;
      if (last.id) {
        idx = items.findIndex(i => i && i.type === 'eval' && !i.submitted && String(i.id || '') === String(last.id));
      }

      // Fallback: match by date + preceptor name
      if (idx < 0) {
        idx = items.findIndex(i => i && i.type === 'eval' && !i.submitted &&
          String(i.date || '') === String(last.date || '') &&
          String(i.preceptorName || '') === String(last.preceptorName || '')
        );
      }

      // Final fallback: most-recent pending eval on same date
      if (idx < 0 && last.date) {
        for (let j = items.length - 1; j >= 0; j--) {
          const it = items[j];
          if (it && it.type === 'eval' && !it.submitted && String(it.date || '') === String(last.date || '')) {
            idx = j;
            break;
          }
        }
      }

      if (idx < 0) {
        finish(false, 'No matching pending eval found.');
        return;
      }

      items[idx].submitted = true;
      chrome.storage.local.set({ 'typhon-items': items }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(false, 'Could not update Typhon Helper storage.');
          return;
        }
        chrome.runtime.sendMessage({ action: 'syncSubmittedToFirestore', items: items });
        const floatEl = document.getElementById('typhon-helper-float');
        if (floatEl) floatEl.remove();
        finish(true, 'Marked eval submitted in Typhon Helper.');
      });
    });
  } catch (e) {
    finish(false, 'Unable to update Typhon Helper status.');
  }
}

function installEvalSubmitPrompt() {
  if (window.__typhonEvalSubmitPromptInstalled) return;
  window.__typhonEvalSubmitPromptInstalled = true;

  document.addEventListener('click', function(event) {
    if (getPageType() !== 'eval') return;

    const el = event.target && event.target.closest
      ? event.target.closest('input[type="submit"], input[type="button"], button, a')
      : null;
    if (!el) return;

    const text = (el.value || el.textContent || '').toLowerCase().trim();
    if (!text) return;
    if (text.includes('cancel')) return;
    if (!(text.includes('save data') || text === 'save' || text.includes('submit'))) return;

    const now = Date.now();
    if (window.__typhonEvalSubmitPromptAt && now - window.__typhonEvalSubmitPromptAt < 1200) return;
    window.__typhonEvalSubmitPromptAt = now;

    const ok = window.confirm('Mark this eval as Submitted in Typhon Helper?');
    if (!ok) return;

    markLastFilledEvalSubmitted(function(marked, msg) {
      if (!marked) {
        try { window.alert(msg || 'Could not mark as submitted.'); } catch (e) {}
      }
    });
  }, true);
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
        // Sync updated submitted state back to Firestore so popup doesn't re-fetch stale data
        chrome.runtime.sendMessage({ action: 'syncSubmittedToFirestore', items: items });
        // Remove the overlay immediately so it doesn't linger during page navigation
        const floatEl = document.getElementById('typhon-helper-float');
        if (floatEl) floatEl.remove();
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
        // Sync updated submitted state back to Firestore so popup doesn't re-fetch stale data
        chrome.runtime.sendMessage({ action: 'syncSubmittedToFirestore', items: items });
        // Remove the overlay immediately so it doesn't linger during page navigation
        const floatEl = document.getElementById('typhon-helper-float');
        if (floatEl) floatEl.remove();
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

  // Combined fix + diagnostic: capture phase, runs before Typhon's handlers.
  document.addEventListener('click', function(event) {
    if (getPageType() !== 'caselog') return;
    const el = event.target && event.target.closest
      ? event.target.closest('input[type="submit"], input[type="button"], button, a')
      : null;
    if (!el) return;
    const text = (el.value || el.textContent || '').toLowerCase().trim();
    if (!(text.includes('save data') || text === 'save' || text.includes('submit'))) return;
    if (text.includes('cancel')) return;

    const site = window.__typhonLastFilledClinicalSite || null;
    const siteSel = findClinicalSiteSelect();
    const siteValBefore = siteSel ? siteSel.value : '(no select)';
    const optionsList = siteSel
      ? [...siteSel.options].slice(0, 8).map(o => `${o.value}="${o.text}"`).join(' | ')
      : '(no select)';

    // Attempt fix: re-assert select if blank
    let fixResult = 'not_needed';
    if (siteSel && !siteSel.value) {
      if (site) {
        // Try matching by text name first
        const didSet = setClinicalSite(siteSel, site);
        if (!didSet) {
          // site might be a raw option value (e.g. "23") — set directly
          const opt = [...siteSel.options].find(o => o.value === site || o.text === site);
          if (opt) { siteSel.value = opt.value; fixResult = 'direct→' + siteSel.value; }
          else fixResult = 'no_match';
        } else {
          fixResult = 'set→' + siteSel.value;
        }
      } else {
        fixResult = 'no_site_in_window';
      }
    }

    const siteValAfter = siteSel ? siteSel.value : '(no select)';
    const hiddenFacility = [...document.querySelectorAll('input[type="hidden"]')]
      .filter(h => /facil|site|loc/i.test(h.name || h.id))
      .map(h => `${h.name||h.id}=${h.value}`)
      .join(', ') || '(none)';

    try {
      sessionStorage.setItem('__typhon_diag_submit', JSON.stringify({
        ts: new Date().toLocaleTimeString(),
        site, siteValBefore, siteValAfter, fixResult, hiddenFacility, optionsList
      }));
    } catch(e) {}
  }, true);

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

function injectDiagnosticBadge(pageType, allItems, matchingItems) {
  if (document.getElementById('typhon-diag-icon')) return;

  const heading = document.querySelector('h1,h2,h3')?.textContent?.trim() || '(no heading)';

  // --- Slide-out panel ---
  const panel = document.createElement('div');
  panel.id = 'typhon-diag-panel';
  panel.style.cssText = [
    'position:fixed','top:0','left:0','height:100%',
    'width:280px','z-index:2147483646',
    'background:#1a1a2e','color:#e0e0e0',
    'font-size:12px','font-family:monospace',
    'padding:16px 14px','box-sizing:border-box',
    'box-shadow:4px 0 24px rgba(0,0,0,0.5)',
    'transform:translateX(-100%)','transition:transform 0.25s ease',
    'overflow-y:auto','line-height:1.6'
  ].join(';');
  panel.innerHTML = [
    `<div style="font-size:14px;font-weight:700;color:#7ec8e3;margin-bottom:10px">🔧 Typhon Helper Diag</div>`,
    `<div><span style="color:#aaa">pageType:</span> <b style="color:#f5c542">${pageType}</b></div>`,
    `<div><span style="color:#aaa">heading:</span> "${heading}"</div>`,
    `<div><span style="color:#aaa">allItems (unsubmitted):</span> ${allItems.length}</div>`,
    `<div><span style="color:#aaa">matching:</span> ${matchingItems.length}</div>`,
    `<div style="margin-top:8px;color:#aaa">Matched items:</div>`,
    matchingItems.length
      ? matchingItems.map(i => `<div style="padding-left:8px;color:#90ee90">• ${i.type} · ${i.date||'?'} · id=${i.id||'?'}</div>`).join('')
      : `<div style="padding-left:8px;color:#888">(none)</div>`
  ].join('');

  // Show last pre-submit snapshot if available
  try {
    const raw = sessionStorage.getItem('__typhon_diag_submit');
    if (raw) {
      const snap = JSON.parse(raw);
      const div = document.createElement('div');
      div.style.cssText = 'margin-top:12px;padding-top:8px;border-top:1px solid #444;';
      div.innerHTML = [
        `<div style="color:#f5c542;font-weight:700">LAST PRE-SUBMIT @ ${snap.ts}</div>`,
        `<div><span style="color:#aaa">window site name:</span> <b style="color:#fff">${snap.site}</b></div>`,
        `<div><span style="color:#aaa">select before fix:</span> <b style="color:#f88">${snap.siteValBefore}</b></div>`,
        `<div><span style="color:#aaa">fix result:</span> <b style="color:#7fc">${snap.fixResult}</b></div>`,
        `<div><span style="color:#aaa">select after fix:</span> <b style="color:#fff">${snap.siteValAfter}</b></div>`,
        `<div><span style="color:#aaa">hidden fields:</span> ${snap.hiddenFacility}</div>`,
        `<div style="margin-top:4px;color:#aaa;font-size:10px">options: ${snap.optionsList}</div>`,
        `<div style="margin-top:6px"><span style="color:#e88;cursor:pointer;font-size:11px" id="__typhon_diag_clear">clear snapshot</span></div>`
      ].join('');
      panel.appendChild(div);
      setTimeout(() => {
        const clr = document.getElementById('__typhon_diag_clear');
        if (clr) clr.addEventListener('click', () => { sessionStorage.removeItem('__typhon_diag_submit'); div.remove(); });
      }, 0);
    }
  } catch(e) {}
  document.body.appendChild(panel);

  // --- Small icon button ---
  const icon = document.createElement('div');
  icon.id = 'typhon-diag-icon';
  icon.title = 'Typhon Helper Diagnostics';
  icon.textContent = '🔧';
  icon.style.cssText = [
    'position:fixed','top:10px','left:10px','z-index:2147483647',
    'width:28px','height:28px','border-radius:50%',
    'background:rgba(0,0,0,0.55)','color:#fff',
    'font-size:15px','line-height:28px','text-align:center',
    'cursor:pointer','user-select:none',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
    'transition:background 0.15s'
  ].join(';');

  let open = false;
  icon.addEventListener('click', () => {
    open = !open;
    panel.style.transform = open ? 'translateX(0)' : 'translateX(-100%)';
    icon.style.left = open ? '290px' : '10px';
  });
  document.body.appendChild(icon);
}

function injectFloatingFillButton() {
  const pageType = getPageType();
  if (pageType === 'unknown') {
    // Still show diag badge so we can see what the page type resolved to
    chrome.storage.local.get('typhon-items', (data) => {
      const allItems = (data['typhon-items'] || []).filter(i => !i.submitted);
      injectDiagnosticBadge('unknown', allItems, []);
    });
    return;
  }

  if (pageType === 'sjfsurvey') {
    // Auto-fill the SJF survey from the eval item stored before navigation
    chrome.storage.local.get('typhon-pending-sjf-fill', (stored) => {
      const item = stored['typhon-pending-sjf-fill'];
      if (!item) return;
      // Poll until the survey form has rendered (radio/checkbox inputs present)
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        const ready = document.querySelectorAll('input[type="radio"], input[type="checkbox"]').length > 5;
        if (!ready) {
          if (attempts >= 40) clearInterval(timer); // give up after 8s
          return;
        }
        clearInterval(timer);
        fillSJFSurvey(item);
        rememberLastFilledEval(item);
        showTyphonToast('Daily Eval SJF filled ✓ — review and submit');
        chrome.storage.local.remove('typhon-pending-sjf-fill');
      }, 200);
    });
    return;
  }

  if (document.getElementById('typhon-helper-float')) return; // already injected

  chrome.storage.local.get('typhon-items', (data) => {
    const items = (data['typhon-items'] || []).filter(i => !i.submitted);
    const matching = items.filter(i =>
      (pageType === 'caselog'   && i.type === 'case') ||
      (pageType === 'casedate'    && i.type === 'case') ||
      (pageType === 'mainmenu'    && (i.type === 'case' || i.type === 'timelog' || i.type === 'eval')) ||
      (pageType === 'timeloglist' && i.type === 'timelog') ||
      (pageType === 'timelog'     && i.type === 'timelog') ||
      (pageType === 'evallist'    && i.type === 'eval') ||
      (pageType === 'eval'        && i.type === 'eval')
    );
    injectDiagnosticBadge(pageType, items, matching);
    if (!matching.length) return;

    // Sort chronologically by date then start time
    matching.sort((a, b) => {
      const aKey = (a.date || '') + ' ' + (a.anesStart || a.clockIn1 || '');
      const bKey = (b.date || '') + ' ' + (b.anesStart || b.clockIn1 || '');
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });

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
                           : item.type === 'timelog' && isTimeLogDateStepPage()       ? 'Set Date & Continue →'
                           : item.type === 'timelog'    ? 'Fill Time Log'
                           : item.type === 'eval' && btnPageType === 'mainmenu' ? 'Add Daily Evaluation →'
                           : item.type === 'eval' && btnPageType === 'evallist' ? 'Open Daily Eval SJF →'
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
          } else if (item.type === 'eval' && btnPageType === 'evallist') {
            icon.textContent = '✓';
            mainLine.textContent = 'Selecting preceptor…';
            btn.style.background = 'linear-gradient(135deg,#1a7a4a,#0f9b5e)';
            btn.style.boxShadow = '0 6px 20px rgba(15,155,94,0.45)';
            if (!clickDailyEvalSJF()) throw new Error('Could not find Daily Clinical Evaluation SJF link.');
            fillEvalSJFPanel(item);
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
    installEvalSubmitPrompt();
  });
} else {
  // Small delay so Typhon's own JS finishes rendering the form
  setTimeout(() => {
    injectFloatingFillButton();
    installCaseSubmitPrompt();
    installTimeLogSubmitPrompt();
    installEvalSubmitPrompt();
  }, 600);
}

// Re-inject if storage changes after initial load (e.g. popup pulled items from Firestore)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['typhon-items']) {
    const existing = document.getElementById('typhon-helper-float');
    if (existing) existing.remove();
    injectFloatingFillButton();
  }
});

// ============================================================
// MESSAGE LISTENER
// ============================================================
function showTyphonToast(text) {
  const existing = document.getElementById('__typhon-helper-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = '__typhon-helper-toast';
  toast.textContent = text;

  toast.style.cssText = [
    'position:fixed', 'bottom:180px', 'right:22px',
    'background:#f5a800', 'color:#1a1a1a', 'padding:10px 16px', 'border-radius:8px',
    'font-size:13px', 'font-family:sans-serif', 'z-index:2147483647',
    'box-shadow:0 4px 16px rgba(0,0,0,0.35)', 'cursor:pointer',
    'max-width:320px', 'line-height:1.4'
  ].join(';');
  toast.addEventListener('click', function() { toast.remove(); });
  document.body.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, 8000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showToast') {
    showTyphonToast(message.message);
    sendResponse({ ok: true });
    return true;
  }

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
