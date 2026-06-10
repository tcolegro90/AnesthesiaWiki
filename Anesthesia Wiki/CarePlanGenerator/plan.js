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
  fillSelectFromList('ind-blunt-select', ['Fentanyl', 'Esmolol', 'Remifentanil', 'Dexmedetomidine'], s['ind-blunt-select'] || '');
}

function toggleLmaSize() {
  var method = document.getElementById('ind-airway-method');
  var wrap = document.getElementById('lma-size-wrap');
  if (!method || !wrap) return;
  wrap.style.display = method.value === 'LMA' ? 'inline' : 'none';
  if (method.value !== 'LMA') {
    var sizeEl = document.getElementById('lma-size');
    if (sizeEl) sizeEl.value = '';
  }
}

function toggleGeneralOptions() {
  const t = document.getElementById('anes-type').value;
  document.getElementById('general-options').style.display = t === 'General' ? 'block' : 'none';
  var rmWrap = document.getElementById('routine-meds-wrap');
  if (rmWrap) rmWrap.style.display = t === 'General' ? 'block' : 'none';
  document.getElementById('tiva-wrap').style.display = t === 'General' ? 'block' : 'none';
  var spinalOpts = document.getElementById('spinal-options');
  if (spinalOpts) spinalOpts.style.display = t === 'Spinal' ? 'block' : 'none';
  var macOpts = document.getElementById('mac-options');
  if (macOpts) macOpts.style.display = t === 'MAC' ? 'block' : 'none';
  var painSecs = document.getElementById('plan-pain-sections');
  if (painSecs) painSecs.style.display = (t === 'General' || t === 'MAC') ? 'block' : 'none';
  var sedBolusSec = document.getElementById('sedation-bolus-section');
  if (sedBolusSec) sedBolusSec.style.display = t === 'MAC' ? 'block' : 'none';
  var sedDripsSec = document.getElementById('sedation-drips-section');
  if (sedDripsSec) sedDripsSec.style.display = t === 'MAC' ? 'block' : 'none';
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
  const val = document.getElementById('tiva-reason').value;
  const showText = val === 'Other' || val === 'Neuromonitoring';
  document.getElementById('tiva-other').style.display = showText ? 'inline-block' : 'none';
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
      'Midazolam':        { min: 0.02, max: 0.04, unit: 'mg',      perKg: true,  flatMin: 0.5 },
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
    range.textContent = spec.min + '–' + spec.max + ' ' + spec.unit + '/kg → ' + lo + '–' + hi + ' ' + spec.unit;
  } else {
    dose.dataset.min = String(spec.min);
    dose.dataset.max = String(spec.max);
    range.textContent = spec.min + '–' + spec.max + ' ' + spec.unit;
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
  intraop:  ['Fentanyl','Morphine','Hydromorphone','Remifentanil infusion','Sufentanil','Alfentanil','Ketamine (sub-dissociative)','Ketamine infusion','Neuraxial (epidural/spinal)','Regional nerve block','Acetaminophen IV','Ketorolac','Celecoxib','Dexmedetomidine (bolus)','Dexmedetomidine (infusion)','Lidocaine infusion','Magnesium sulfate','Pregabalin','Gabapentin','Dexamethasone'],
  postop:   ['Fentanyl PCA','Hydromorphone PCA','Morphine PCA','Oxycodone (oral)','Tramadol','Neuraxial opioids','Regional / nerve block','Non-opioid multimodal'],
  nonopioid:['Acetaminophen IV','Ketorolac','Celecoxib','Ketamine (low-dose)','Dexmedetomidine','Lidocaine infusion','Magnesium sulfate','Pregabalin','Gabapentin','Regional / Nerve Block','Dexamethasone'],
  sedation_bolus: ['Propofol','Ketamine','Dexmedetomidine'],
  sedation_drips: ['Propofol Drip','Ketamine Drip','Dexmedetomidine Drip'],
  vasopressors: ['Ephedrine','Phenylephrine','Epinephrine','Vasopressin','Norepinephrine','Dopamine','Dobutamine','Phenylephrine gtt','Epinephrine gtt','Norepinephrine gtt','Vasopressin gtt','Avoid Epinephrine','Avoid Ephedrine','Other']
};
var PAIN_COUNTS = { intraop: 0, postop: 0, nonopioid: 0, sedation_bolus: 0, sedation_drips: 0, vasopressors: 0 };

var PAIN_GROUPS = {
  intraop: {
    'Opioids': ['Fentanyl','Morphine','Hydromorphone','Remifentanil infusion','Sufentanil','Alfentanil','Neuraxial (epidural/spinal)'],
    'Non-Opioid Adjuncts': ['Ketamine (sub-dissociative)','Ketamine infusion','Regional nerve block','Acetaminophen IV','Ketorolac','Celecoxib','Dexmedetomidine (bolus)','Dexmedetomidine (infusion)','Lidocaine infusion','Magnesium sulfate','Pregabalin','Gabapentin','Dexamethasone']
  }
};

var PAIN_ROW_NOTES = {
  'Dexmedetomidine (bolus)': 'Administer over 10 minutes'
};

document.addEventListener('click', function() {
  document.querySelectorAll('.pain-note-tip').forEach(function(t) { t.style.display = 'none'; });
});

function painRowDoseSpec(type, drug) {
  var s = getGlobalState();
  var wt = parseFloat(s['pat-weight-kg']) || 0;
  var specs = {
    intraop: {
      'Fentanyl':                    { min: 12.5,  max: 200,  unit: 'mcg',         perKg: false },
      'Morphine':                    { min: 0.05,  max: 0.1,  unit: 'mg',          perKg: true  },
      'Hydromorphone':               { min: 0.015, max: 0.02, unit: 'mg',          perKg: true,  flatMin: 0.5 },
      'Remifentanil infusion':       { min: 0.05,  max: 0.5,  unit: 'mcg/kg/min',  perKg: false },
      'Sufentanil':                  { min: 0.1,   max: 0.5,  unit: 'mcg',         perKg: true  },
      'Alfentanil':                  { min: 20,    max: 50,   unit: 'mcg',         perKg: true  },
      'Ketamine (sub-dissociative)': { min: 0.1,   max: 0.5,  unit: 'mg',          perKg: true  },
      'Ketamine infusion':           { min: 0.1,   max: 0.5,  unit: 'mg/kg/hr',    perKg: false },
      'Acetaminophen IV':            { min: 650,   max: 1000, unit: 'mg',          perKg: false },
      'Ketorolac':                   { min: 15,    max: 30,   unit: 'mg',          perKg: false },
      'Celecoxib':                   { min: 200,   max: 400,  unit: 'mg',          perKg: false },
      'Dexmedetomidine (bolus)':     { min: 0.5,   max: 1,    unit: 'mcg',         perKg: true  },
      'Dexmedetomidine (infusion)':  { min: 0.2,   max: 1,    unit: 'mcg/kg/hr',   perKg: false },
      'Lidocaine infusion':          { min: 1,     max: 2,    unit: 'mg/kg/hr',    perKg: false },
      'Magnesium sulfate':           { min: 30,    max: 50,   unit: 'mg',          perKg: true  },
      'Pregabalin':                  { min: 75,    max: 300,  unit: 'mg',          perKg: false },
      'Gabapentin':                  { min: 300,   max: 1200, unit: 'mg/dose',     perKg: false },
      'Dexamethasone':               { min: 4,     max: 10,   unit: 'mg',          perKg: false }
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
    },
    sedation_bolus: {
      'Propofol':        { min: 0.5, max: 2.0, unit: 'mg',      perKg: true  },
      'Ketamine':        { min: 0.1, max: 0.5, unit: 'mg',      perKg: true  },
      'Dexmedetomidine': { min: 0.5, max: 1.0, unit: 'mcg',     perKg: true  }
    },
    sedation_drips: {
      'Propofol Drip':        { min: 50,  max: 150, unit: 'mcg/min', perKg: true  },
      'Ketamine Drip':        { min: 0.1, max: 0.5, unit: 'mg/hr',   perKg: true  },
      'Dexmedetomidine Drip': { min: 0.2, max: 1.5, unit: 'mcg/hr',  perKg: true  }
    },
    vasopressors: {
      'Ephedrine':          { min: 5,    max: 10,   unit: 'mg',          perKg: false },
      'Phenylephrine':      { min: 50,   max: 200,  unit: 'mcg',         perKg: false },
      'Epinephrine':        { min: 10,   max: 100,  unit: 'mcg',         perKg: false },
      'Vasopressin':        { min: 0.2,  max: 0.4,  unit: 'units',       perKg: false },
      'Norepinephrine':     { min: 4,    max: 12,   unit: 'mcg',         perKg: false },
      'Dopamine':           { min: 2,    max: 20,   unit: 'mcg/kg/min',  perKg: false },
      'Dobutamine':         { min: 2,    max: 20,   unit: 'mcg/kg/min',  perKg: false },
      'Phenylephrine gtt':  { min: 0.5,  max: 2,    unit: 'mcg/kg/min',  perKg: false },
      'Epinephrine gtt':    { min: 0.01, max: 0.1,  unit: 'mcg/kg/min',  perKg: false },
      'Norepinephrine gtt': { min: 2,    max: 12,   unit: 'mcg/min',     perKg: false },
      'Vasopressin gtt':    { min: 0.01, max: 0.04, unit: 'units/min',   perKg: false },
      'Avoid Epinephrine':  { unit: '' },
      'Avoid Ephedrine':    { unit: '' }
    }
  };
  var spec = (specs[type] || {})[drug];
  if (!spec) return null;
  if (spec.min == null) return { display: spec.unit, lo: null, hi: null };
  if (spec.perKg && wt > 0) {
    var lo = spec.flatMin != null ? spec.flatMin : parseFloat((spec.min * wt).toFixed(1));
    var hi = parseFloat((spec.max * wt).toFixed(1));
    var display = spec.flatMin != null
      ? spec.flatMin + '\u2013' + hi + ' ' + spec.unit + ' (' + wt + ' kg)'
      : spec.min + '\u2013' + spec.max + ' ' + spec.unit + '/kg \u2192 ' + lo + '\u2013' + hi + ' ' + spec.unit + ' (' + wt + ' kg)';
    return { display: display, lo: lo, hi: hi };
  }
  return { display: spec.min + '–' + spec.max + ' ' + spec.unit, lo: spec.min, hi: spec.max };
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

function refreshAllPainRowRanges() {
  ['intraop', 'postop', 'nonopioid', 'sedation_bolus', 'sedation_drips', 'vasopressors'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;
    container.querySelectorAll('.repeat-row').forEach(function(row) {
      var sel = row.querySelector('select');
      var doseEl = row.querySelector('input.small');
      var rangeEl = row.querySelector('.muted');
      if (sel && doseEl && rangeEl) updatePainRowRange(type, sel, doseEl, rangeEl);
    });
  });
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

function addPainRow(type, drug, dose, skipSave, sub) {
  var container = document.getElementById(type + '-rows');
  var idx = PAIN_COUNTS[type]++;
  var opts = PAIN_OPTIONS[type];
  var id = 'plan-' + type + '-' + idx;
  var hasDoseField = type !== 'postop';

  var row = document.createElement('div');
  row.className = 'repeat-row' + (type === 'intraop' ? ' intraop-row' : '');

  // Note icon (intraop only)
  var noteIconEl = null;
  var noteTipEl = null;
  if (type === 'intraop') {
    noteIconEl = document.createElement('button');
    noteIconEl.type = 'button';
    noteIconEl.className = 'pain-note-icon';
    noteIconEl.textContent = '?';
    noteIconEl.style.visibility = 'hidden';
    noteIconEl.style.position = 'relative';
    noteTipEl = document.createElement('div');
    noteTipEl.className = 'pain-note-tip';
    noteTipEl.style.display = 'none';
    noteIconEl.appendChild(noteTipEl);
    noteIconEl.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('.pain-note-tip').forEach(function(t) { t.style.display = 'none'; });
      noteTipEl.style.display = noteTipEl.style.display === 'none' ? '' : 'none';
    });
  }
  // grid layout is handled by .repeat-row CSS in 8-Anesthetic-Plan.html

  var sel = document.createElement('select');
  sel.id = id;
  sel.className = 'long';
  var groups = PAIN_GROUPS[type];
  if (groups) {
    sel.innerHTML = '<option value="">Select...</option>' +
      Object.keys(groups).map(function(grp) {
        return '<optgroup label="' + grp + '">' +
          groups[grp].map(function(o) {
            return '<option' + (drug === o ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
  } else {
    sel.innerHTML = '<option value="">Select...</option>' +
      opts.map(function(o) {
        return '<option' + (drug === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('');
  }

  var doseEl = null;
  var rangeEl = null;
  if (hasDoseField) {
    doseEl = document.createElement('input');
    doseEl.className = 'small';
    doseEl.placeholder = 'Dose';
    if (dose) doseEl.value = dose;

    rangeEl = document.createElement('span');
    rangeEl.className = 'muted';
    rangeEl.style.fontSize = '12px';
  }

  var subEl = null;
  if (!hasDoseField) {
    subEl = document.createElement('div');
    subEl.style.display = 'none';
    subEl.style.gridColumn = '2 / 4';
  }

  // Vasopressors: "Other" name text input
  var vasoOtherEl = null;
  if (type === 'vasopressors') {
    vasoOtherEl = document.createElement('input');
    vasoOtherEl.className = 'small';
    vasoOtherEl.style.width = '160px';
    vasoOtherEl.placeholder = 'Drug name...';
    vasoOtherEl.style.display = (drug === 'Other') ? '' : 'none';
    if (drug === 'Other' && sub) vasoOtherEl.value = sub;
    vasoOtherEl.addEventListener('input', function() { row.dataset.sub = vasoOtherEl.value; savePainRows(); });
  }

  sel.addEventListener('change', function() {
    if (hasDoseField) updatePainRowRange(type, sel, doseEl, rangeEl);
    if (!hasDoseField) updatePostopSub(row, sel, subEl);
    if (noteIconEl && noteTipEl) {
      var note = PAIN_ROW_NOTES[sel.value];
      noteIconEl.style.visibility = note ? '' : 'hidden';
      noteTipEl.style.display = 'none';
      if (note) noteTipEl.textContent = note;
    }
    if (vasoOtherEl) {
      var isOther = sel.value === 'Other';
      var isAvoid = sel.value === 'Avoid Epinephrine' || sel.value === 'Avoid Ephedrine';
      vasoOtherEl.style.display = isOther ? '' : 'none';
      sel.style.width = isOther ? '80px' : '';
      doseEl.style.display = isAvoid ? 'none' : '';
      rangeEl.style.display = (isOther || isAvoid) ? 'none' : '';
      if (!isOther) { row.dataset.sub = ''; vasoOtherEl.value = ''; }
      if (isOther) {
        row.insertBefore(vasoOtherEl, doseEl);
      } else {
        row.insertBefore(doseEl, rangeEl);
      }
    }
    updatePainRowOptions(type);
    savePainRows();
  });
  if (hasDoseField) {
    doseEl.addEventListener('input', function() {
      validateDoseInput(doseEl);
      savePainRows();
    });
    doseEl.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      addPainRow(type, '', '', false);
      var rows = container.querySelectorAll('.repeat-row');
      var newest = rows[rows.length - 1];
      var focusEl = newest ? newest.querySelector('select') : null;
      if (focusEl) focusEl.focus();
    });
  }

  var rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'remove-btn';
  rm.textContent = 'Delete';
  rm.onclick = function() { row.remove(); updatePainRowOptions(type); savePainRows(); };
  if (!hasDoseField) rm.style.gridColumn = '4';

  row.appendChild(sel);
  if (hasDoseField) {
    row.appendChild(doseEl);
    row.appendChild(rangeEl);
  }
  if (vasoOtherEl) row.appendChild(vasoOtherEl);
  if (!hasDoseField && subEl) row.appendChild(subEl);
  if (noteIconEl) row.appendChild(noteIconEl);
  row.appendChild(rm);
  container.appendChild(row);

  if (drug && hasDoseField && drug !== 'Other') updatePainRowRange(type, sel, doseEl, rangeEl);
  if (drug && noteIconEl && noteTipEl) {
    var note = PAIN_ROW_NOTES[drug];
    noteIconEl.style.visibility = note ? '' : 'hidden';
    if (note) noteTipEl.textContent = note;
  }
  // Restore Other state: shrink select, move name box before dose, hide range
  if (vasoOtherEl && drug === 'Other') {
    sel.style.width = '80px';
    rangeEl.style.display = 'none';
    row.insertBefore(vasoOtherEl, doseEl);
  }
  // Restore avoid state: hide dose and range
  if (vasoOtherEl && (drug === 'Avoid Epinephrine' || drug === 'Avoid Ephedrine')) {
    doseEl.style.display = 'none';
    rangeEl.style.display = 'none';
  }
  if (!hasDoseField && sub && subEl) {
    updatePostopSub(row, sel, subEl);
    var subSelect = subEl.querySelector('select');
    if (subSelect) { subSelect.value = sub; row.dataset.sub = sub; }
    // Restore dose input for neuraxial rows (saved as the row's dose field)
    var subDoseInput = subEl.querySelector('input');
    if (subDoseInput && dose) subDoseInput.value = dose;
  }
  // Persist newly created rows immediately so cross-frame sync won't drop them.
  if (!skipSave) savePainRows();
}

function updatePostopSub(row, sel, subEl) {
  var v = sel.value;
  subEl.innerHTML = '';
  subEl.style.display = 'none';
  row.dataset.sub = '';
  if (v === 'Neuraxial opioids') {
    var s = document.createElement('select');
    s.className = 'small';
    s.style.width = '140px';
    ['', 'Fentanyl', 'Sufentanil', 'Duramorph', 'Precedex'].forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt; o.textContent = opt || 'Drug...';
      s.appendChild(o);
    });
    s.addEventListener('change', function() { row.dataset.sub = s.value; savePainRows(); });
    var doseInp = document.createElement('input');
    doseInp.className = 'small';
    doseInp.style.width = '90px';
    doseInp.placeholder = 'Dose';
    doseInp.addEventListener('input', function() { savePainRows(); });
    subEl.appendChild(s);
    subEl.appendChild(doseInp);
    subEl.style.display = 'flex';
    subEl.style.alignItems = 'center';
    subEl.style.gap = '6px';
  } else if (v === 'Regional / nerve block') {
    var inp = document.createElement('input');
    inp.className = 'small';
    inp.style.width = '252px';
    inp.placeholder = 'Block type...';
    inp.addEventListener('input', function() { row.dataset.sub = inp.value; savePainRows(); });
    subEl.appendChild(inp);
    subEl.style.display = 'flex';
    subEl.style.alignItems = 'center';
  }
}

function savePainRows() {
  var s = getGlobalState();
  ['intraop','postop','nonopioid','sedation_bolus','sedation_drips','vasopressors'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;
    var data = Array.from(container.querySelectorAll('.repeat-row')).map(function(r) {
      return { drug: (r.querySelector('select') || {}).value || '', dose: (r.querySelector('input') || {}).value || '', sub: r.dataset.sub || '' };
    });
    s['plan-' + type + '-list'] = JSON.stringify(data);
  });
  setGlobalState(s);
}

function restorePainRows() {
  var s = getGlobalState();
  ['intraop','postop','nonopioid','sedation_bolus','sedation_drips','vasopressors'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;
    container.innerHTML = '';
    PAIN_COUNTS[type] = 0;
    var raw = s['plan-' + type + '-list'];
    var data = [];
    try { data = JSON.parse(raw) || []; } catch(e) {}
    data.forEach(function(item) {
      var drug = typeof item === 'string' ? item : (item.drug || '');
      var dose = typeof item === 'string' ? '' : (item.dose || '');
      var sub = typeof item === 'object' ? (item.sub || '') : '';
      addPainRow(type, drug, dose, true, sub);
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
      !!active.closest('#intraop-rows, #postop-rows, #nonopioid-rows, #sedation_bolus-rows, #sedation_drips-rows, #vasopressors-rows');
    if (inDynamicPainInput) return;
  }

  var s = getGlobalState();
  var same = true;
  ['intraop','postop','nonopioid','sedation_bolus','sedation_drips','vasopressors'].forEach(function(type) {
    var container = document.getElementById(type + '-rows');
    if (!container) return;

    var stateRows = [];
    try { stateRows = JSON.parse(s['plan-' + type + '-list'] || '[]') || []; } catch (e) { stateRows = []; }
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
    if (domRows.length === 0) {
      if (stateRows.length !== 0) same = false;
      return;
    }

    if (painRowsSignature(stateRows) !== painRowsSignature(domRows)) same = false;
  });

  if (!same) restorePainRows();
}

function toggleAnxiolytic() {
  var isYes = document.getElementById('ind-anxiolytic-yes').checked;
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
    var lo = spec.flatMin != null ? spec.flatMin : parseFloat((spec.min * wt).toFixed(2));
    var hi = parseFloat((spec.max * wt).toFixed(2));
    doseEl.dataset.min = String(lo); doseEl.dataset.max = String(hi);
    rangeEl.textContent = spec.flatMin != null
      ? spec.flatMin + '\u2013' + hi + ' mg (' + wt + ' kg)'
      : spec.min + '\u2013' + spec.max + ' mg/kg \u2192 ' + lo + '\u2013' + hi + ' mg (' + wt + ' kg)';
  } else {
    doseEl.dataset.min = String(spec.min); doseEl.dataset.max = String(spec.max);
    rangeEl.textContent = spec.min + '\u2013' + spec.max + ' ' + spec.unit;
  }
  validateDoseInput(doseEl);
}

function toggleMacAnxiolytic() {
  var isYes = document.getElementById('mac-anxiolytic-yes').checked;
  var wrap = document.getElementById('mac-anxiolytic-wrap');
  if (wrap) wrap.style.display = isYes ? 'block' : 'none';
  if (isYes) updateMacAnxiolyticRange();
  saveState();
}

function updateMacAnxiolyticRange() {
  var selEl = document.getElementById('mac-anxiolytic-select');
  var doseEl = document.getElementById('mac-anxiolytic-dose');
  var rangeEl = document.getElementById('mac-anxiolytic-range');
  if (!selEl || !doseEl || !rangeEl) return;
  var spec = planDoseSpec('anxiolytic', selEl.value);
  doseEl.dataset.min = ''; doseEl.dataset.max = ''; rangeEl.textContent = '';
  if (!spec) { doseEl.style.color = ''; doseEl.style.fontWeight = ''; return; }
  var wt = parseFloat(getGlobalState()['pat-weight-kg']) || 0;
  if (spec.perKg && wt > 0) {
    var lo = spec.flatMin != null ? spec.flatMin : parseFloat((spec.min * wt).toFixed(2));
    var hi = parseFloat((spec.max * wt).toFixed(2));
    doseEl.dataset.min = String(lo); doseEl.dataset.max = String(hi);
    rangeEl.textContent = spec.flatMin != null
      ? spec.flatMin + '\u2013' + hi + ' mg (' + wt + ' kg)'
      : spec.min + '\u2013' + spec.max + ' mg/kg \u2192 ' + lo + '\u2013' + hi + ' mg (' + wt + ' kg)';
  } else {
    doseEl.dataset.min = String(spec.min); doseEl.dataset.max = String(spec.max);
    rangeEl.textContent = spec.min + '\u2013' + spec.max + ' ' + spec.unit;
  }
  validateDoseInput(doseEl);
}

function toggleVesicant() {
  const agent = document.getElementById('ind-agent-select').value;
  const paralytic = document.getElementById('ind-paralytic').value;
  const vesicantAgents = ['Propofol', 'Etomidate', 'Methohexital'];
  const show = vesicantAgents.includes(agent) || paralytic === 'Succinylcholine';
  document.getElementById('row-vesicant').style.display = show ? 'block' : 'none';
  if (show) {
    var sel = document.getElementById('vesicant-prop');
    var doseEl = document.getElementById('vesicant-dose');
    var defaultLidocaine = vesicantAgents.includes(agent) || paralytic === 'Succinylcholine';
    if (!sel.dataset.userSet) {
      sel.value = defaultLidocaine ? 'lidocaine' : '0';
      if (defaultLidocaine && doseEl && !doseEl.value) doseEl.value = '50';
      if (!defaultLidocaine && doseEl) doseEl.value = '';
    }
  } else {
    var sel = document.getElementById('vesicant-prop');
    var doseEl = document.getElementById('vesicant-dose');
    delete sel.dataset.userSet;
    sel.value = '0';
    if (doseEl) doseEl.value = '';
  }
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
  var s = getGlobalState();
  var fastedNo = !!s['pat-fasted::No'];
  var overrideEl = document.getElementById('rsi-override');
  var rsiNoEl = document.getElementById('ind-rsi-no');
  var rsiYesEl2 = document.getElementById('ind-rsi-yes');
  if (overrideEl) {
    if (fastedNo && rsiNoEl && rsiNoEl.checked) {
      overrideEl.value = '1'; // user explicitly chose No despite not fasted
    } else if (rsiYesEl2 && rsiYesEl2.checked) {
      overrideEl.value = ''; // user chose Yes — clear override
    }
  }
  applyCrossConditions();
  highlightAbnormalRSI();
  saveState();
}

function highlightAbnormalRSI() {
  const s = getGlobalState();
  const fastedNo = !!s['pat-fasted::No'];
  const rsiNo = !document.getElementById('ind-rsi-yes').checked;
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
  const fastedNo = !!s['pat-fasted::No'];
  const mhYes = !!s['hx-mh::Yes'];
  const pseudoYes = !!s['hx-pseudo::Yes'];
  const kVal = parseFloat(s['pat-k']);
  const highK = !isNaN(kVal) && kVal >= 5.5;
  const cautionK = !isNaN(kVal) && kVal > 5.0 && kVal < 5.5;
  toggleVesicant();

  let changed = false;
  const rsiYesEl = document.getElementById('ind-rsi-yes');
  const rsiNo = !rsiYesEl.checked;
  const rsiRow = document.getElementById('row-ind-rsi');
  rsiRow.classList.toggle('alert', fastedNo && rsiNo);
  const rsiAutoNote = document.getElementById('rsi-auto-note');
  if (fastedNo) {
    var overrideEl = document.getElementById('rsi-override');
    var rsiOverride = overrideEl && overrideEl.value === '1';
    if (!rsiYesEl.checked && !rsiOverride) { rsiYesEl.checked = true; changed = true; }
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
    (!isNaN(mp) && mp > 2) || (!isNaN(tmd) && tmd < 3) ||
    (!isNaN(gap) && gap < 3) || (mand === '2' || mand === '3') ||
    (atl === 'Limited Mobility');
  // ECT, EBUS, colonoscopy, EGD — no tracheal intubation planned, never auto-force VL
  var _sn = (s['pat-surgery'] || '').toLowerCase();
  var isNoIntubationProc = /\bect\b|electroconvulsive|\bebus\b|colonoscopy|\begd\b|esophagogastroduodenoscop/.test(_sn);
  var airwaySel = document.getElementById('ind-airway-method');
  var airwayNote = document.getElementById('airway-auto-note');
  if (airwayAbnormal && !isNoIntubationProc) {
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
    suxWarning.style.color = '#b32424';
    suxWarning.style.fontWeight = '700';
    let reasons = [];
    if (mhYes) reasons.push('MH history');
    if (pseudoYes) reasons.push('Pseudocholinesterase deficiency');
    if (highK) reasons.push('K+ ' + kVal.toFixed(1));
    suxWarning.textContent = 'CONTRAINDICATED: ' + reasons.join(', ');
  } else if (paralytic === 'Succinylcholine' && cautionK) {
    suxWarning.style.display = 'block';
    suxWarning.style.color = '#c47a00';
    suxWarning.style.fontWeight = 'normal';
    suxWarning.textContent = 'Use caution: K+ ' + kVal.toFixed(1);
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
  var agent = inh ? inh.value : '';
  var show = !!agent;
  if (macWrap) macWrap.style.display = show ? 'inline-block' : 'none';
  if (show && typeof updateMacOptions === 'function') updateMacOptions('ind-mac-plan', agent);
  var macSel = document.getElementById('ind-mac-plan');
  if (show && macSel && !macSel.value) macSel.value = (agent === 'Nitrous Oxide') ? '0.5' : '1.0';
}

function enforceMacLimitByInhalation() {
  // No-op: MAC options are now set per-agent by updateMacOptions() in 8-Anesthetic-Plan.html
}

function onAnyPlanInput() {
  applyCrossConditions();
  enforceTivaInhalationRule();
  highlightAbnormalRSI();
  updateMacVisibility();
  saveState();
}

function updateNeuroMonitorBanner() {
  var s = getGlobalState();
  var isYes = (s['pat-neuro-monitoring::Yes'] === true) ||
              (s['pat-neuro-monitoring-yes'] === true);
  var banner = document.getElementById('neuro-monitor-banner');
  if (banner) banner.style.display = isYes ? 'block' : 'none';
}

function boot() {
  populateMedicationCatalogSelects();
  document.getElementById('anes-type').addEventListener('change', toggleGeneralOptions);
  document.getElementById('tiva-box').addEventListener('change', toggleTivaReason);
  document.getElementById('tiva-reason').addEventListener('change', toggleTivaOther);
  document.querySelectorAll('input[name="ind-rsi"]').forEach(function(el) { el.addEventListener('change', onAnyPlanInput); });
  document.getElementById('ind-blunt-select').addEventListener('change', function() { updatePlanDoseRange('blunt','ind-blunt-select','ind-blunt-dose','ind-blunt-range'); onAnyPlanInput(); });
  document.getElementById('ind-blunt-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  document.getElementById('ind-agent-select').addEventListener('change', function() { updatePlanDoseRange('induction','ind-agent-select','ind-agent-dose','ind-agent-range'); toggleVesicant(); var n = document.getElementById('ind-agent-rationale'); if (n) { n.textContent = ''; n.style.display = 'none'; } onAnyPlanInput(); });
  document.getElementById('ind-agent-dose').addEventListener('input', function() { validateDoseInput(this); var n = document.getElementById('ind-agent-rationale'); if (n) { n.textContent = ''; n.style.display = 'none'; } saveState(); });
  document.getElementById('ind-paralytic').addEventListener('change', function() { updatePlanDoseRange('paralytic','ind-paralytic','ind-paralytic-dose','ind-paralytic-range'); toggleVesicant(); var n = document.getElementById('ind-paralytic-rationale'); if (n) { n.textContent = ''; n.style.display = 'none'; } onAnyPlanInput(); });
  document.getElementById('ind-paralytic-dose').addEventListener('input', function() { validateDoseInput(this); var n = document.getElementById('ind-paralytic-rationale'); if (n) { n.textContent = ''; n.style.display = 'none'; } saveState(); });
  document.getElementById('ind-inhalation').addEventListener('change', onAnyPlanInput);
  document.getElementById('vesicant-prop').addEventListener('change', function() {
    var doseEl = document.getElementById('vesicant-dose');
    this.dataset.userSet = '1';
    if (this.value === 'lidocaine' && doseEl && !doseEl.value) doseEl.value = '50';
    if (this.value === '0') { if (doseEl) doseEl.value = ''; }
    saveState();
  });
  restorePainRows();
  document.querySelectorAll('input[name="ind-anxiolytic-yn"]').forEach(function(el) { el.addEventListener('change', toggleAnxiolytic); });
  document.getElementById('ind-anxiolytic-select').addEventListener('change', function() {
    var doseEl = document.getElementById('ind-anxiolytic-dose');
    if (this.value === 'Midazolam' && !doseEl.value) doseEl.value = '2';
    updateAnxiolyticRange();
    saveState();
  });
  document.getElementById('ind-anxiolytic-select').addEventListener('input', updateAnxiolyticRange);
  document.getElementById('ind-anxiolytic-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  document.querySelectorAll('input[name="mac-anxiolytic-yn"]').forEach(function(el) { el.addEventListener('change', toggleMacAnxiolytic); });
  document.getElementById('mac-anxiolytic-select').addEventListener('change', function() {
    var doseEl = document.getElementById('mac-anxiolytic-dose');
    if (this.value === 'Midazolam' && doseEl && !doseEl.value) doseEl.value = '2';
    updateMacAnxiolyticRange();
    saveState();
  });
  document.getElementById('mac-anxiolytic-select').addEventListener('input', updateMacAnxiolyticRange);
  document.getElementById('mac-anxiolytic-dose').addEventListener('input', function() { validateDoseInput(this); saveState(); });
  updatePlanDoseRange('blunt',     'ind-blunt-select',  'ind-blunt-dose',     'ind-blunt-range');
  updatePlanDoseRange('induction', 'ind-agent-select',  'ind-agent-dose',     'ind-agent-range');
  updatePlanDoseRange('paralytic', 'ind-paralytic',     'ind-paralytic-dose', 'ind-paralytic-range');
  toggleGeneralOptions();
  toggleTivaReason();
  toggleTivaOther();
  toggleAnxiolytic();
  updateAnxiolyticRange();
  toggleMacAnxiolytic();
  updateMacAnxiolyticRange();
  applyCrossConditions();
  enforceTivaInhalationRule();
  updateMacVisibility();
  if (typeof onInhAgent1Change === 'function') onInhAgent1Change();
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
  toggleMacAnxiolytic();
  updateMacAnxiolyticRange();
  updateMacVisibility();
  updateNeuroMonitorBanner();
  if (typeof onInhAgent1Change === 'function') onInhAgent1Change();
  var _rmWarn = document.getElementById('routine-meds-warn');
  if (_rmWarn) _rmWarn.style.display = 'none';
});

// Called by shared.js whenever a fresh state snapshot arrives from the parent.
// Refreshes weight-based dose ranges so they reflect current patient weight.
function onExternalUpdate() {
  try {
    updatePlanDoseRange('blunt',     'ind-blunt-select',  'ind-blunt-dose',     'ind-blunt-range');
    updatePlanDoseRange('induction', 'ind-agent-select',  'ind-agent-dose',     'ind-agent-range');
    updatePlanDoseRange('paralytic', 'ind-paralytic',     'ind-paralytic-dose', 'ind-paralytic-range');
    updateAnxiolyticRange();
    updateMacAnxiolyticRange();
    refreshAllPainRowRanges();
    updateNeuroMonitorBanner();
  } catch (e) {}
}

// Fallback UI sync in case event wiring is delayed by iframe hydration timing.
setTimeout(function() {
  try {
    toggleGeneralOptions();
    toggleTivaReason();
    toggleTivaOther();
    toggleMacAnxiolytic();
    updateMacVisibility();
  } catch (e) {}
}, 700);
