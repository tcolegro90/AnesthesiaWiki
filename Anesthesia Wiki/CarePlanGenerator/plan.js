// plan.js — Anesthetic Plan (section 7) logic
// Depends on: med-catalog.js, shared.js (loaded before this file)

function fillSelectFromList(selectId, items, selectedValue) {
  var sel = document.getElementById(selectId);
  if (!sel || !Array.isArray(items)) return;
  sel.innerHTML = '<option value="">Select...</option>' + items.map(function(v) {
    return '<option' + (v === selectedValue ? ' selected' : '') + '>' + v + '</option>';
  }).join('');
}

function populateMedicationCatalogSelects() {
  if (!window.MED_CATALOG || !window.MED_CATALOG.categories) return;
  var s = getGlobalState();
  var c = window.MED_CATALOG.categories;
  fillSelectFromList('ind-agent-select', c.inductionAgents || [], s['ind-agent-select'] || '');
  fillSelectFromList('ind-paralytic', c.paralytics || [], s['ind-paralytic'] || '');
  fillSelectFromList('ind-inhalation', c.inhaledAnesthetics || [], s['ind-inhalation'] || '');
  fillSelectFromList('ind-blunt-select', ['Fentanyl', 'Esmolol', 'Dexmedetomidine'], s['ind-blunt-select'] || '');
}

function toggleGeneralOptions() {
  const t = document.getElementById('anes-type').value;
  document.getElementById('general-options').style.display = t === 'General' ? 'block' : 'none';
  document.getElementById('tiva-wrap').style.display = t === 'General' ? 'block' : 'none';
  saveState();
}

function toggleTivaReason() {
  const chk = document.getElementById('tiva-box').checked;
  document.getElementById('tiva-reason-wrap').style.display = chk ? 'block' : 'none';
  enforceTivaInhalationRule();
  saveState();
}

function enforceTivaInhalationRule() {
  var tivaOn = !!document.getElementById('tiva-box').checked;
  var inh = document.getElementById('ind-inhalation');
  var mac = document.getElementById('ind-mac-plan');
  if (!inh) return;
  if (tivaOn) {
    inh.value = '';
    if (mac) mac.value = '';
    inh.disabled = true;
    if (mac) mac.disabled = true;
  } else {
    inh.disabled = false;
    if (mac) mac.disabled = false;
  }
}

function toggleTivaOther() {
  const isOther = document.getElementById('tiva-reason').value === 'Other';
  document.getElementById('tiva-other').style.display = isOther ? 'inline-block' : 'none';
  saveState();
}

function planDoseSpec(group, drug) {
  const specs = {
    blunt: {
      'Fentanyl':        { min: 12.5, max: 150,  unit: 'mcg', perKg: false },
      'Esmolol':         { min: 0.25, max: 0.5,  unit: 'mg',  perKg: true  },
      'Remifentanil':    { min: 0.5,  max: 1,    unit: 'mcg', perKg: true  },
      'Dexmedetomidine': { min: 0.5,  max: 1,    unit: 'mcg', perKg: true  }
    },
    induction: {
      'Propofol':  { min: 1.5,  max: 2.5,  unit: 'mg', perKg: true },
      'Etomidate': { min: 0.2,  max: 0.3,  unit: 'mg', perKg: true },
      'Ketamine':  { min: 1,    max: 2,    unit: 'mg', perKg: true },
      'Midazolam': { min: 0.05, max: 0.1,  unit: 'mg', perKg: true }
    },
    paralytic: {
      'Succinylcholine': { min: 1,    max: 1.5,  unit: 'mg', perKg: true },
      'Rocuronium':      { min: 0.6,  max: 1.2,  unit: 'mg', perKg: true },
      'Cisatracurium':   { min: 0.1,  max: 0.2,  unit: 'mg', perKg: true },
      'Vecuronium':      { min: 0.08, max: 0.12, unit: 'mg', perKg: true }
    },
    anxiolytic: {
      'Midazolam':        { min: 0.02, max: 0.04, unit: 'mg',      perKg: true  },
      'Lorazepam':        { min: 0.02, max: 0.04, unit: 'mg',      perKg: true  },
      'Diazepam':         { min: 0.1,  max: 0.2,  unit: 'mg',      perKg: true  },
      'Hydroxyzine':      { min: 25,   max: 100,  unit: 'mg',      perKg: false },
      'Alprazolam':       { min: 0.25, max: 0.5,  unit: 'mg',      perKg: false },
      'Dexmedetomidine':  { min: 0.5,  max: 1,    unit: 'mcg',     perKg: true  }
    }
  };
  return (specs[group] || {})[drug] || null;
}

function updatePlanDoseRange(group, selectId, doseId, rangeId) {
  const s = getGlobalState();
  const weight = parseFloat(s['pat-weight-kg']) || 0;
  const sel   = document.getElementById(selectId);
  const dose  = document.getElementById(doseId);
  const range = document.getElementById(rangeId);
  const spec  = planDoseSpec(group, sel ? sel.value : '');
  if (dose) { dose.dataset.min = ''; dose.dataset.max = ''; }
  if (range) range.textContent = '';
  if (!spec || !dose || !range) { if (dose) { dose.style.color = ''; dose.style.fontWeight = ''; } return; }
  if (spec.perKg && weight > 0) {
    const lo = parseFloat((spec.min * weight).toFixed(1));
    const hi = parseFloat((spec.max * weight).toFixed(1));
    dose.dataset.min = String(lo);
    dose.dataset.max = String(hi);
    range.textContent = spec.min + '–' + spec.max + ' ' + spec.unit + '/kg → ' + lo + '–' + hi + ' ' + spec.unit + ' (' + weight + ' kg)';
  } else {
    dose.dataset.min = String(spec.min);
    dose.dataset.max = String(spec.max);
    range.textContent = 'Rec: ' + spec.min + '–' + spec.max + ' ' + spec.unit;
  }
  validateDoseInput(dose);
}

function validateDoseInput(inputEl) {
  const v = parseFloat(inputEl.value);
  const min = parseFloat(inputEl.dataset.min);
  const max = parseFloat(inputEl.dataset.max);
  if (!isNaN(v) && !isNaN(min) && !isNaN(max) && (v < min || v > max)) {
    inputEl.style.color = '#b32424';
    inputEl.style.fontWeight = '700';
  } else {
    inputEl.style.color = '';
    inputEl.style.fontWeight = '';
  }
}

var PAIN_OPTIONS = {
  intraop:  ['Fentanyl','Morphine','Hydromorphone','Remifentanil infusion','Sufentanil','Alfentanil','Ketamine (sub-dissociative)','Neuraxial (epidural/spinal)','Regional nerve block','Multimodal — see adjuncts'],
  postop:   ['Fentanyl PCA','Hydromorphone PCA','Morphine PCA','Oxycodone (oral)','Tramadol','Neuraxial opioids','Regional / nerve block','Non-opioid multimodal'],
  nonopioid:['Acetaminophen IV','Ketorolac','Celecoxib','Ketamine (low-dose)','Dexmedetomidine','Lidocaine infusion','Magnesium sulfate','Pregabalin','Gabapentin','Regional / Nerve Block','Dexamethasone']
};
var PAIN_COUNTS = { intraop: 0, postop: 0, nonopioid: 0 };

function painRowDoseSpec(type, drug) {
  var s = getGlobalState();
  var wt = parseFloat(s['pat-weight-kg']) || 0;
  var specs = {
    intraop: {
      'Fentanyl':                    { min: 12.5,  max: 200,  unit: 'mcg',         perKg: false },
      'Morphine':                    { min: 0.05,  max: 0.1,  unit: 'mg',          perKg: true  },
      'Hydromorphone':               { min: 0.015, max: 0.02, unit: 'mg',          perKg: true  },
      'Remifentanil infusion':       { min: 0.05,  max: 0.5,  unit: 'mcg/kg/min',  perKg: false },
      'Sufentanil':                  { min: 0.1,   max: 0.5,  unit: 'mcg',         perKg: true  },
      'Alfentanil':                  { min: 20,    max: 50,   unit: 'mcg',         perKg: true  },
      'Ketamine (sub-dissociative)': { min: 0.1,   max: 0.5,  unit: 'mg',          perKg: true  }
    },
    postop: {
      'Fentanyl PCA':      { min: 10,  max: 20,  unit: 'mcg/dose', perKg: false },
      'Hydromorphone PCA': { min: 0.2, max: 0.4, unit: 'mg/dose',  perKg: false },
      'Morphine PCA':      { min: 1,   max: 2,   unit: 'mg/dose',  perKg: false },
      'Oxycodone (oral)':  { min: 5,   max: 10,  unit: 'mg q4-6h', perKg: false },
      'Tramadol':          { min: 50,  max: 100, unit: 'mg q6h',   perKg: false },
      'Neuraxial opioids': { min: null, max: null, unit: 'per protocol', perKg: false }
    },
    nonopioid: {
      'Acetaminophen IV':    { min: 650,  max: 1000, unit: 'mg',        perKg: false },
      'Ketorolac':           { min: 15,   max: 30,   unit: 'mg',        perKg: false },
      'Celecoxib':           { min: 200,  max: 400,  unit: 'mg',        perKg: false },
      'Ketamine (low-dose)': { min: 0.1,  max: 0.5,  unit: 'mg',        perKg: true  },
      'Dexmedetomidine':     { min: 0.2,  max: 1,    unit: 'mcg/kg/hr', perKg: false },
      'Lidocaine infusion':  { min: 1,    max: 2,    unit: 'mg/kg/hr',  perKg: false },
      'Magnesium sulfate':   { min: 30,   max: 50,   unit: 'mg',        perKg: true  },
      'Pregabalin':          { min: 75,   max: 300,  unit: 'mg',        perKg: false },
      'Gabapentin':          { min: 300,  max: 1200, unit: 'mg/dose',   perKg: false },
      'Dexamethasone':       { min: 4,    max: 10,   unit: 'mg',        perKg: false }
    }
  };
  var spec = (specs[type] || {})[drug];
  if (!spec) return null;
  if (spec.min == null) return { display: 'Rec: ' + spec.unit, lo: null, hi: null };
  if (spec.perKg && wt > 0) {
    var lo = parseFloat((spec.min * wt).toFixed(1));
    var hi = parseFloat((spec.max * wt).toFixed(1));
    return { display: spec.min + '–' + spec.max + ' ' + spec.unit + '/kg → ' + lo + '–' + hi + ' ' + spec.unit + ' (' + wt + ' kg)', lo: lo, hi: hi };
  }
  return { display: 'Rec: ' + spec.min + '–' + spec.max + ' ' + spec.unit, lo: spec.min, hi: spec.max };
}

function updatePainRowRange(type, selEl, doseEl, rangeEl) {
  var info = painRowDoseSpec(type, selEl.value);
  rangeEl.textContent = info ? info.display : '';
  doseEl.dataset.min = (info && info.lo != null) ? String(info.lo) : '';
  doseEl.dataset.max = (info && info.hi != null) ? String(info.hi) : '';
  doseEl.style.color = '';
  doseEl.style.fontWeight = '';
  if (doseEl.value) validateDoseInput(doseEl);
}

function updatePainRowOptions(type) {
  var container = document.getElementById(type + '-rows');
  if (!container) return;
  var sels = Array.from(container.querySelectorAll('select'));
  var vals = sels.map(function(s) { return s.value; }).filter(function(v) { return v !== ''; });
  sels.forEach(function(s) {
    Array.from(s.options).forEach(function(o) {
      if (o.value !== '') o.disabled = vals.includes(o.value) && o.value !== s.value;
    });
  });
}

function addPainRow(type, drug, dose, skipSave) {
  var container = document.getElementById(type + '-rows');
  var idx = PAIN_COUNTS[type]++;
  var opts = PAIN_OPTIONS[type];
  var id = 'plan-' + type + '-' + idx;

  var row = document.createElement('div');
  row.className = 'repeat-row';
  row.style.flexWrap = 'wrap';

  var sel = document.createElement('select');
  sel.id = id;
  sel.className = 'long';
  sel.innerHTML = '<option value="">Select...</option>' +
    opts.map(function(o) {
      return '<option' + (drug === o ? ' selected' : '') + '>' + o + '</option>';
    }).join('');

  var doseEl = document.createElement('input');
  doseEl.className = 'small';
  doseEl.placeholder = 'Dose';
  if (dose) doseEl.value = dose;

  var rangeEl = document.createElement('span');
  rangeEl.className = 'muted';
  rangeEl.style.fontSize = '12px';

  sel.addEventListener('change', function() {
    updatePainRowRange(type, sel, doseEl, rangeEl);
    updatePainRowOptions(type);
    savePainRows();
  });
  doseEl.addEventListener('input', function() {
    validateDoseInput(doseEl);
    savePainRows();
  });

  var rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'remove-btn';
  rm.textContent = '×';
  rm.onclick = function() { row.remove(); updatePainRowOptions(type); savePainRows(); };

  row.appendChild(sel);
  row.appendChild(doseEl);
  row.appendChild(rangeEl);
  row.appendChild(rm);
  container.appendChild(row);

  if (drug) updatePainRowRange(type, sel, doseEl, rangeEl);
  // Persist newly created rows immediately so cross-frame sync won't drop them.
  if (!skipSave) savePainRows();
}

function savePainRows() {
  var s = getGlobalState();
  ['intraop','postop','nonopioid'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;
    var data = Array.from(container.querySelectorAll('.repeat-row')).map(function(r) {
      return { drug: (r.querySelector('select') || {}).value || '', dose: (r.querySelector('input') || {}).value || '' };
    });
    s['plan-' + type + '-list'] = JSON.stringify(data);
  });
  setGlobalState(s);
}

function restorePainRows() {
  var s = getGlobalState();
  ['intraop','postop','nonopioid'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;
    container.innerHTML = '';
    PAIN_COUNTS[type] = 0;
    var raw = s['plan-' + type + '-list'];
    var data = [];
    try { data = JSON.parse(raw) || []; } catch(e) {}
    if (data.length === 0) data = [{ drug: '', dose: '' }];
    data.forEach(function(item) {
      var drug = typeof item === 'string' ? item : (item.drug || '');
      var dose = typeof item === 'string' ? '' : (item.dose || '');
      addPainRow(type, drug, dose, true);
    });
    updatePainRowOptions(type);
  });
}

function painRowsSignature(rows) {
  return JSON.stringify((rows || []).map(function(r) {
    return {
      drug: String((r && r.drug) || '').trim(),
      dose: String((r && r.dose) || '').trim()
    };
  }));
}

function maybeRestorePainRows() {
  var active = document.activeElement;
  if (active) {
    var inDynamicPainInput =
      (active.tagName === 'SELECT' || active.tagName === 'INPUT') &&
      !!active.closest('#intraop-rows, #postop-rows, #nonopioid-rows');
    if (inDynamicPainInput) return;
  }

  var s = getGlobalState();
  var same = true;
  ['intraop','postop','nonopioid'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;

    var stateRows = [];
    try { stateRows = JSON.parse(s['plan-' + type + '-list'] || '[]') || []; } catch (e) { stateRows = []; }
    if (stateRows.length === 0) stateRows = [{ drug: '', dose: '' }];
    stateRows = stateRows.map(function(item) {
      if (typeof item === 'string') return { drug: item || '', dose: '' };
      return { drug: (item && item.drug) || '', dose: (item && item.dose) || '' };
    });

    var domRows = Array.from(container.querySelectorAll('.repeat-row')).map(function(r) {
      return {
        drug: (r.querySelector('select') || {}).value || '',
        dose: (r.querySelector('input') || {}).value || ''
      };
    });
    if (domRows.length === 0) domRows = [{ drug: '', dose: '' }];

    if (painRowsSignature(stateRows) !== painRowsSignature(domRows)) same = false;
  });

  if (!same) restorePainRows();
}

function toggleAnxiolytic() {
  var yn = document.querySelector('input[name="ind-anxiolytic-yn"]:checked');
  var isYes = yn && yn.value === 'Yes';
  document.getElementById('anxiolytic-wrap').style.display = isYes ? 'block' : 'none';
  if (isYes) updateAnxiolyticRange();
  saveState();
}

function updateAnxiolyticRange() {
  var spec = planDoseSpec('anxiolytic', document.getElementById('ind-anxiolytic-select').value);
  var doseEl = document.getElementById('ind-anxiolytic-dose');
  var rangeEl = document.getElementById('ind-anxiolytic-range');
  doseEl.dataset.min = ''; doseEl.dataset.max = ''; rangeEl.textContent = '';
  if (!spec) { doseEl.style.color = ''; doseEl.style.fontWeight = ''; return; }
  var wt = parseFloat(getGlobalState()['pat-weight-kg']) || 0;
  if (spec.perKg && wt > 0) {
    var lo = parseFloat((spec.min * wt).toFixed(2));
    var hi = parseFloat((spec.max * wt).toFixed(2));
    doseEl.dataset.min = String(lo); doseEl.dataset.max = String(hi);
    rangeEl.textContent = spec.min + '\u2013' + spec.max + ' mg/kg \u2192 ' + lo + '\u2013' + hi + ' mg (' + wt + ' kg)';
  } else {
    doseEl.dataset.min = String(spec.min); doseEl.dataset.max = String(spec.max);
    rangeEl.textContent = 'Rec: ' + spec.min + '\u2013' + spec.max + ' ' + spec.unit;
  }
  validateDoseInput(doseEl);
}

function toggleVesicant() {
  const agent = document.getElementById('ind-agent-select').value;
  const show = agent === 'Propofol' || agent === 'Etomidate';
  document.getElementById('row-vesicant').style.display = show ? 'block' : 'none';
}

function stateRadioValue(state, name) {
  var keyPrefix = name + '::';
  var keys = Object.keys(state || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf(keyPrefix) === 0 && state[k]) return k.substring(keyPrefix.length);
  }
  return '';
}

function triggerCrossConditions() {
  applyCrossConditions();
  highlightAbnormalRSI();
  saveState();
}

function highlightAbnormalRSI() {
  const s = getGlobalState();
  const fastedNo = !!s['pat-fasted-no'];
  const rsiNo = document.getElementById('ind-rsi-no').checked;
  const rsiRow = document.getElementById('row-ind-rsi');
  if (rsiRow && fastedNo && rsiNo) {
    rsiRow.style.color = '#c41c3b';
    rsiRow.style.fontWeight = 'bold';
  } else if (rsiRow) {
    rsiRow.style.color = '';
    rsiRow.style.fontWeight = '';
  }
}

function applyCrossConditions() {
  const s = getGlobalState();
  const fastedNo = !!s['pat-fasted-no'];
  const mhYes = !!s['hx-mh::Yes'];
  const pseudoYes = !!s['hx-pseudo::Yes'];
  const kVal = parseFloat(s['pat-k']);
  const highK = !isNaN(kVal) && kVal > 5.0;
  toggleVesicant();

  let changed = false;
  const rsiYesEl = document.getElementById('ind-rsi-yes');
  const rsiNo = document.getElementById('ind-rsi-no').checked;
  const rsiRow = document.getElementById('row-ind-rsi');
  rsiRow.classList.toggle('alert', fastedNo && rsiNo);
  const rsiAutoNote = document.getElementById('rsi-auto-note');
  if (fastedNo) {
    if (!rsiYesEl.checked) { rsiYesEl.checked = true; changed = true; }
    if (rsiAutoNote) rsiAutoNote.style.display = 'inline-block';
  } else if (rsiAutoNote) {
    rsiAutoNote.style.display = 'none';
  }

  var mp = parseFloat(stateRadioValue(s, 'exam-mallampati'));
  var tmd = parseFloat(stateRadioValue(s, 'exam-tmd'));
  var gap = parseFloat(stateRadioValue(s, 'exam-interincisor'));
  var mand = stateRadioValue(s, 'airway-mandibular');
  var atl = stateRadioValue(s, 'exam-atlanto');
  var airwayAbnormal =
    (!isNaN(mp) && mp > 2) || (!isNaN(tmd) && tmd < 4) ||
    (!isNaN(gap) && gap < 4) || (mand === '2' || mand === '3') ||
    (atl === 'Limited Mobility');
  var airwaySel = document.getElementById('ind-airway-method');
  var airwayNote = document.getElementById('airway-auto-note');
  if (airwayAbnormal) {
    if (airwaySel && airwaySel.value !== 'VL') { airwaySel.value = 'VL'; changed = true; }
    if (airwayNote) airwayNote.style.display = 'inline-block';
  } else if (airwayNote) {
    airwayNote.style.display = 'none';
  }

  const paralytic = document.getElementById('ind-paralytic').value;
  const nmbRow = document.getElementById('row-ind-paralytic');
  const suxWarning = document.getElementById('sux-warning');
  const suxContra = paralytic === 'Succinylcholine' && (mhYes || highK || pseudoYes);
  nmbRow.classList.toggle('alert', suxContra);
  if (suxContra) {
    suxWarning.style.display = 'block';
    if (highK && !mhYes && !pseudoYes) {
      suxWarning.textContent = 'CAUTION: K+ ' + kVal.toFixed(1);
    } else {
      let reasons = [];
      if (mhYes) reasons.push('MH history');
      if (pseudoYes) reasons.push('Pseudocholinesterase deficiency');
      if (highK) reasons.push('K+ ' + kVal.toFixed(1));
      suxWarning.textContent = 'CONTRAINDICATED: ' + reasons.join(', ');
    }
  } else {
    suxWarning.style.display = 'none';
  }

  const anesType = document.getElementById('anes-type').value;
  const tivaBox = document.getElementById('tiva-box');
  const tivaWrap = document.getElementById('tiva-wrap');
  const mhBanner = document.getElementById('mh-banner');
  if (mhYes && anesType === 'General') {
    if (!tivaBox.checked) {
      tivaBox.checked = true;
      document.getElementById('tiva-reason-wrap').style.display = 'block';
      document.getElementById('tiva-reason').value = 'MH history';
    }
    tivaWrap.style.background = '#d4edda';
    tivaWrap.style.border = '2px solid #28a745';
    tivaWrap.style.padding = '6px 10px';
    tivaWrap.style.borderRadius = '4px';
    if (mhBanner) mhBanner.style.display = 'block';
  } else {
    tivaWrap.style.background = '';
    tivaWrap.style.border = '';
    tivaWrap.style.padding = '';
    tivaWrap.style.borderRadius = '';
    if (mhBanner) mhBanner.style.display = 'none';
  }

  const inh = document.getElementById('ind-inhalation');
  ['Sevoflurane','Desflurane','Isoflurane'].forEach(v => {
    const opt = Array.from(inh.options).find(o => o.value === v);
    if (opt) opt.disabled = mhYes;
  });
  if (mhYes && ['Sevoflurane','Desflurane','Isoflurane'].includes(inh.value)) inh.value = '';

  if (changed) saveState();
}

function updateMacVisibility() {
  var inh = document.getElementById('ind-inhalation');
  var macWrap = document.getElementById('mac-wrap');
  if (macWrap) macWrap.style.display = (inh && inh.value) ? 'inline-block' : 'none';
  enforceMacLimitByInhalation();
}

function enforceMacLimitByInhalation() {
  var inh = document.getElementById('ind-inhalation');
  var macSel = document.getElementById('ind-mac-plan');
  if (!inh || !macSel) return;
  var nitrousOnly = inh.value === 'Nitrous Oxide';
  Array.from(macSel.options).forEach(function(opt) {
    if (!opt.value) return;
    var val = parseFloat(opt.value);
    if (isNaN(val)) return;
    opt.disabled = nitrousOnly && val > 0.9;
  });
  if (nitrousOnly) {
    var cur = parseFloat(macSel.value);
    if (!isNaN(cur) && cur > 0.9) macSel.value = '';
  }
}

function onAnyPlanInput() {
  applyCrossConditions();
  enforceTivaInhalationRule();
  highlightAbnormalRSI();
  updateMacVisibility();
  saveState();
}

function boot() {
  populateMedicationCatalogSelects();
  document.getElementById('anes-type').addEventListener('change', toggleGeneralOptions);
  document.getElementById('tiva-box').addEventListener('change', toggleTivaReason);
  document.getElementById('tiva-reason').addEventListener('change', toggleTivaOther);
  document.querySelectorAll('input[name="ind-rsi"]').forEach(r => r.addEventListener('change', onAnyPlanInput));
  document.getElementById('ind-blunt-select').addEventListener('change', function() { updatePlanDoseRange('blunt','ind-blunt-select','ind-blunt-dose','ind-blunt-range'); onAnyPlanInput(); });
  document.getElementById('ind-blunt-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  document.getElementById('ind-agent-select').addEventListener('change', function() { updatePlanDoseRange('induction','ind-agent-select','ind-agent-dose','ind-agent-range'); toggleVesicant(); onAnyPlanInput(); });
  document.getElementById('ind-agent-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  document.getElementById('ind-paralytic').addEventListener('change', function() { updatePlanDoseRange('paralytic','ind-paralytic','ind-paralytic-dose','ind-paralytic-range'); onAnyPlanInput(); });
  document.getElementById('ind-paralytic-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  document.getElementById('ind-inhalation').addEventListener('change', onAnyPlanInput);
  document.querySelectorAll('input[name="vesicant-prop"]').forEach(r => r.addEventListener('change', saveState));
  restorePainRows();
  document.querySelectorAll('input[name="ind-anxiolytic-yn"]').forEach(r => r.addEventListener('change', toggleAnxiolytic));
  document.getElementById('ind-anxiolytic-select').addEventListener('change', function() { updateAnxiolyticRange(); saveState(); });
  document.getElementById('ind-anxiolytic-select').addEventListener('input', updateAnxiolyticRange);
  document.getElementById('ind-anxiolytic-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  updatePlanDoseRange('blunt',     'ind-blunt-select',  'ind-blunt-dose',     'ind-blunt-range');
  updatePlanDoseRange('induction', 'ind-agent-select',  'ind-agent-dose',     'ind-agent-range');
  updatePlanDoseRange('paralytic', 'ind-paralytic',     'ind-paralytic-dose', 'ind-paralytic-range');
  toggleGeneralOptions();
  toggleTivaReason();
  toggleTivaOther();
  toggleAnxiolytic();
  updateAnxiolyticRange();
  applyCrossConditions();
  enforceTivaInhalationRule();
  updateMacVisibility();
}

pageBoot(boot, function() {
  populateMedicationCatalogSelects();
  toggleGeneralOptions();
  toggleTivaReason();
  toggleTivaOther();
  applyCrossConditions();
  enforceTivaInhalationRule();
  updatePlanDoseRange('blunt',     'ind-blunt-select',  'ind-blunt-dose',     'ind-blunt-range');
  updatePlanDoseRange('induction', 'ind-agent-select',  'ind-agent-dose',     'ind-agent-range');
  updatePlanDoseRange('paralytic', 'ind-paralytic',     'ind-paralytic-dose', 'ind-paralytic-range');
  maybeRestorePainRows();
  toggleAnxiolytic();
  updateAnxiolyticRange();
  updateMacVisibility();
});

// Fallback UI sync in case event wiring is delayed by iframe hydration timing.
setTimeout(function() {
  try {
    toggleGeneralOptions();
    toggleTivaReason();
    toggleTivaOther();
    updateMacVisibility();
  } catch (e) {}
}, 700);
