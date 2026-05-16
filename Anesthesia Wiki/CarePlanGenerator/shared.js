

function initAutoSave() {
  const controls = document.querySelectorAll('input, select, textarea');
  controls.forEach(el => {
    const evt = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' ? 'change' : 'input';
    el.addEventListener(evt, saveState);
  });
}

const __selectTypeaheadState = new WeakMap();

function initSelectTypeaheadNavigation() {
  if (window.__carePlanSelectTypeaheadReady) return;
  window.__carePlanSelectTypeaheadReady = true;

  document.addEventListener('keydown', function(e) {
    const select = e.target;
    if (!select || select.tagName !== 'SELECT') return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;

    const typed = e.key.toLowerCase();
    if (!/[a-z0-9]/.test(typed)) return;

    const now = Date.now();
    const prev = __selectTypeaheadState.get(select) || { buffer: '', ts: 0 };
    const buffer = (now - prev.ts > 700 ? '' : prev.buffer) + typed;
    __selectTypeaheadState.set(select, { buffer: buffer, ts: now });

    const options = Array.from(select.options || []);
    if (!options.length) return;

    const start = select.selectedIndex >= 0 ? (select.selectedIndex + 1) % options.length : 0;

    function optionText(opt) {
      return String((opt && (opt.textContent || opt.label)) || '').trim().toLowerCase();
    }

    function findMatch(prefix) {
      if (!prefix) return -1;
      for (let i = 0; i < options.length; i++) {
        const idx = (start + i) % options.length;
        const opt = options[idx];
        if (!opt || opt.disabled) continue;
        if (optionText(opt).indexOf(prefix) === 0) return idx;
      }
      return -1;
    }

    // Try cumulative typing first (e.g., "li" -> Lisinopril), then fall back to single key cycling.
    let nextIndex = findMatch(buffer);
    if (nextIndex === -1 && buffer.length > 1) {
      nextIndex = findMatch(typed);
      __selectTypeaheadState.set(select, { buffer: typed, ts: now });
    }
    if (nextIndex === -1 || nextIndex === select.selectedIndex) return;

    select.selectedIndex = nextIndex;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    e.preventDefault();
  }, true);
}

function saveState() {
  if (window.__carePlanSuspendSave) return;
  // During a carePlanLiveUpdate callback, skip saveState entirely.
  // onExternalUpdate callbacks may call saveState() to sync UI state, but doing so
  // captures ALL current form values — including any newly-added dynamic fields that
  // have no selection yet (e.g. extra-pos-1 = ""). This writes those empty values to
  // the shared localStorage, which the parent then includes in its next snapshot.
  // restoreState() then restores the empty value, wiping the user's selection.
  // Functions that need to persist a specific calculated value during liveUpdate
  // should call setGlobalState() directly with only those keys (as IBW does).
  if (window.__carePlanInLiveUpdate) return;

  const state = getGlobalState();
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.id && !el.name) return;
    // Radio buttons are keyed by name::value so radioVal() and print-card.js
    // can look them up by group name regardless of whether an id is present.
    const key = (el.type === 'radio')
      ? (el.name + '::' + el.value)
      : (el.id || (el.name + '::' + el.value));
    if (el.type === 'checkbox' || el.type === 'radio') {
      state[key] = el.checked;
    } else {
      state[key] = el.value;
    }
  });

  updateOtherFieldTracker(state);
  setGlobalState(state);
  
  // Notify parent window to refit iframes when content changes
  try {
    if (window.parent && window.parent !== window && typeof window.parent.fitAll === 'function') {
      setTimeout(function() {
        window.parent.fitAll();
      }, 50);
    }
  } catch (e) {}
}

function updateOtherFieldTracker(state) {
  const trackerKey = '__otherFieldTracker';
  const existing = (state && typeof state[trackerKey] === 'object' && state[trackerKey]) ? state[trackerKey] : {};
  const next = Object.assign({}, existing);
  const page = (window.location.pathname || '').split('/').pop() || '';
  const nowIso = new Date().toISOString();
  const seenPageKeys = new Set();

  // Track explicit "other" user-entry controls and persist latest non-empty value.
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const rawId = String(el.id || el.name || '').trim();
    if (!rawId) return;
    if (el.type === 'checkbox' || el.type === 'radio') return;
    if (!/other/i.test(rawId)) return;

    const value = String(el.value || '').trim();
    const fieldKey = page + '::' + rawId;
    seenPageKeys.add(fieldKey);

    if (!value) {
      delete next[fieldKey];
      return;
    }

    const prev = existing[fieldKey] || {};
    next[fieldKey] = {
      field: rawId,
      page: page,
      value: value,
      updatedAt: nowIso,
      firstSeenAt: prev.firstSeenAt || nowIso
    };
  });

  // Remove stale entries for "other" controls that no longer exist on this page.
  Object.keys(next).forEach(function(k) {
    if (k.indexOf(page + '::') !== 0) return;
    if (!seenPageKeys.has(k) && /other/i.test(k)) delete next[k];
  });

  state[trackerKey] = next;
}

function getOtherFieldTrackerReport() {
  const state = getGlobalState();
  const tracker = (state && typeof state.__otherFieldTracker === 'object' && state.__otherFieldTracker) ? state.__otherFieldTracker : {};
  const grouped = {};

  Object.keys(tracker).forEach(function(key) {
    const item = tracker[key] || {};
    const field = item.field || key;
    if (!grouped[field]) grouped[field] = [];
    const exists = grouped[field].some(function(row) {
      return row.value === item.value && row.page === item.page;
    });
    if (!exists && item.value) {
      grouped[field].push({
        value: item.value,
        page: item.page || '',
        firstSeenAt: item.firstSeenAt || '',
        updatedAt: item.updatedAt || ''
      });
    }
  });

  return grouped;
}

window.getOtherFieldTrackerReport = getOtherFieldTrackerReport;

function setGlobalState(state) {
  // During iframe hydration, block outgoing writes that can overwrite loaded plans
  // with default/empty controls before snapshot restore completes.
  if (window.__carePlanSuspendSave) return;

  var count = 0;
  try { count = Object.keys(state || {}).length; } catch (e) {}

  try {
    localStorage.setItem('carePlanSplitState', JSON.stringify(state || {}));
  } catch (e) {}

  // During a carePlanLiveUpdate callback, skip postMessage to parent to prevent
  // the infinite feedback loop: liveUpdate → onExternalUpdate → saveState → carePlanState
  // → parent broadcasts liveUpdate to all other iframes → repeat.
  // The 1200ms poll will pick up any state changes written above.
  if (window.__carePlanInLiveUpdate) return;

  // Mirror latest state to parent Combined page (works in file:// via child -> parent postMessage).
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'carePlanState', state: state || {} }, '*');
    }
  } catch (e) {}
}

function getGlobalState() {
  const raw = localStorage.getItem('carePlanSplitState');
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function restoreState() {
  const state = getGlobalState();
  var count = 0;
  try { count = Object.keys(state).length; } catch(e) {}
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.id && !el.name) return;
    const key = (el.type === 'radio')
      ? (el.name + '::' + el.value)
      : (el.id || (el.name + '::' + el.value));
    if (!(key in state)) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!state[key];
    } else {
      el.value = state[key];
    }
  });
}

// ── iOS Yes/No toggles ──────────────────────────────────────────────────────
// Finds all Yes/No radio pairs and injects an iOS toggle on mobile (≤600px).
// The original radio inputs are hidden with .ios-yn-source but remain functional
// so all existing JS that reads/sets radio values continues to work.
function initYNToggles() {

  var processed = new Set();
  var yesInputs = document.querySelectorAll('input[type="radio"][value="Yes"]');
  var idx = 0;

  yesInputs.forEach(function(yesInput) {
    var name = yesInput.name;
    if (!name || processed.has(name)) return;
    var noInput = document.querySelector('input[type="radio"][name="' + CSS.escape(name) + '"][value="No"]');
    if (!noInput) return;
    processed.add(name);

    // Find the <label> elements wrapping each radio
    var yesLabel = yesInput.closest('label');
    var noLabel  = noInput.closest('label');
    if (!yesLabel || !noLabel) return;

    // Mark originals hidden by CSS
    yesLabel.classList.add('ios-yn-source');
    noLabel.classList.add('ios-yn-source');

    var useSegPill = false; // always use iOS toggle style
    idx++;

    var wrap;
    if (useSegPill) {
      // ── Segmented pill style ──
      wrap = document.createElement('div');
      wrap.className = 'seg-yn-wrap';
      wrap.dataset.ynName = name;

      var yesBtn = document.createElement('button');
      yesBtn.type = 'button';
      yesBtn.className = 'seg-btn seg-yes';
      yesBtn.textContent = 'Yes';
      var noBtn = document.createElement('button');
      noBtn.type = 'button';
      noBtn.className = 'seg-btn seg-no';
      noBtn.textContent = 'No';

      function updateSegState() {
        yesBtn.classList.toggle('seg-active', yesInput.checked);
        noBtn.classList.toggle('seg-active', noInput.checked);
      }
      updateSegState();

      yesBtn.addEventListener('click', function() {
        yesInput.checked = true; noInput.checked = false;
        updateSegState();
        yesInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      noBtn.addEventListener('click', function() {
        noInput.checked = true; yesInput.checked = false;
        updateSegState();
        noInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      yesInput.addEventListener('change', updateSegState);
      noInput.addEventListener('change', updateSegState);

      wrap.appendChild(yesBtn);
      wrap.appendChild(noBtn);
    } else {
      // ── iOS toggle style ──
      wrap = document.createElement('div');
      wrap.className = 'ios-yn-wrap';
      wrap.dataset.ynName = name;

      var toggleLabel = document.createElement('label');
      toggleLabel.className = 'ios-toggle';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = yesInput.checked;

      var track = document.createElement('span');
      track.className = 'ios-track';

      toggleLabel.appendChild(cb);
      toggleLabel.appendChild(track);

      var stateLabel = document.createElement('span');
      stateLabel.className = 'yn-state-label';
      stateLabel.textContent = cb.checked ? 'Yes' : 'No';

      wrap.appendChild(toggleLabel);
      wrap.appendChild(stateLabel);

      cb.addEventListener('change', function() {
        yesInput.checked = cb.checked;
        noInput.checked  = !cb.checked;
        stateLabel.textContent = cb.checked ? 'Yes' : 'No';
        var evt = new Event('change', { bubbles: true });
        (cb.checked ? yesInput : noInput).dispatchEvent(evt);
      });

      function syncFromRadio() {
        cb.checked = yesInput.checked;
        stateLabel.textContent = cb.checked ? 'Yes' : 'No';
      }
      yesInput.addEventListener('change', syncFromRadio);
      noInput.addEventListener('change', syncFromRadio);
    }

    // Insert toggle immediately before the first hidden label
    yesLabel.parentNode.insertBefore(wrap, yesLabel);
  });
}

// Re-sync both toggle styles after external state restores
function syncYNToggles() {
  // iOS toggles
  document.querySelectorAll('.ios-yn-wrap').forEach(function(wrap) {
    var name = wrap.dataset.ynName;
    if (!name) return;
    var yesInput = document.querySelector('input[type="radio"][name="' + CSS.escape(name) + '"][value="Yes"]');
    var cb = wrap.querySelector('input[type="checkbox"]');
    var lbl = wrap.querySelector('.yn-state-label');
    if (yesInput && cb) {
      cb.checked = yesInput.checked;
      if (lbl) lbl.textContent = cb.checked ? 'Yes' : 'No';
    }
  });
  // Segmented pills
  document.querySelectorAll('.seg-yn-wrap').forEach(function(wrap) {
    var name = wrap.dataset.ynName;
    if (!name) return;
    var yesInput = document.querySelector('input[type="radio"][name="' + CSS.escape(name) + '"][value="Yes"]');
    var noInput  = document.querySelector('input[type="radio"][name="' + CSS.escape(name) + '"][value="No"]');
    var yesBtn = wrap.querySelector('.seg-yes');
    var noBtn  = wrap.querySelector('.seg-no');
    if (yesBtn && noBtn && yesInput) {
      yesBtn.classList.toggle('seg-active', yesInput.checked);
      noBtn.classList.toggle('seg-active', !!(noInput && noInput.checked));
    }
  });
}

function applyMobileKeyboardHints() {
  // Ensure mobile devices open numeric keyboards for numeric-entry fields.
  document.querySelectorAll('input[type="number"]').forEach(el => {
    if (el.readOnly || el.disabled || el.getAttribute('inputmode')) return;
    const step = el.getAttribute('step');
    const wantsDecimal = !step || step === 'any' || step.indexOf('.') !== -1;
    el.setAttribute('inputmode', wantsDecimal ? 'decimal' : 'numeric');
  });

  document.querySelectorAll('#pat-age, #pat-surg-length').forEach(el => {
    if (!el || el.readOnly || el.disabled) return;
    el.setAttribute('inputmode', 'numeric');
  });

  document.querySelectorAll('input.lab-input, #ind-anxiolytic-dose, #ind-blunt-dose, #ind-agent-dose, #ind-paralytic-dose').forEach(el => {
    if (!el || el.readOnly || el.disabled || el.getAttribute('inputmode')) return;
    el.setAttribute('inputmode', 'decimal');
  });
}

function pageBoot(extraInit, onExternalUpdate) {
  var lastSnapshotRevision = 0;
  var booted = false;

  if (window.self !== window.top) {
    document.documentElement.classList.add('embedded');
    document.body.classList.add('embedded');
  }

  // If this section is loaded with ?reset=..., clear its in-progress state.
  // This is used by Combined-Care-Plan clear action to force each iframe to reset itself.
  try {
    var params = new URLSearchParams(window.location.search || '');
    if (params.has('reset')) {
      localStorage.removeItem('carePlanSplitState');
      // Explicitly uncheck all checkboxes / clear all inputs so DOM is blank
      // regardless of any snapshot or timing edge-cases.
      try {
        document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function(el) { el.checked = false; });
        document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(function(el) { el.value = ''; });
        document.querySelectorAll('select').forEach(function(el) { el.selectedIndex = 0; });
      } catch (eDom) {}
      // Remove reset flag from URL so future reloads don't keep clearing state.
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  } catch (e) {}

  // Expose a shared refresh hook so Combined page can load saved plans into iframes.
  window.refreshFromGlobalState = function() {
    restoreState();
    if (typeof onExternalUpdate === 'function') onExternalUpdate();
  };

  function requestSnapshot(kind) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: kind || 'carePlanRequestState',
          knownRevision: lastSnapshotRevision
        }, '*');
      }
    } catch (e) {}
  }

  function finalizeBoot() {
    if (booted) return;
    booted = true;
    restoreState();
    applyMobileKeyboardHints();
    initSelectTypeaheadNavigation();
    try {
      if (typeof extraInit === 'function') extraInit();
    } catch (e) {
      console.error('[CarePlan] Error in page boot():', e);
    }
    initAutoSave();
    window.__carePlanSuspendSave = false;

    // Send initial state snapshot to parent after boot.
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'carePlanState', state: getGlobalState() }, '*');
      }
    } catch (e) {}
  }

  // If embedded in iframe, measure height and send to parent
  if (window.self !== window.top) {
    try {
      function sendHeightToParent() {
        var container = document.querySelector('.container') || document.body;
        
        // Use container content metrics to avoid parent-child resize feedback loops.
        var height = Math.max(
          Math.ceil(container.scrollHeight || 0),
          Math.ceil(container.offsetHeight || 0)
        );
        
        // If we got a reasonable height, send it.
        // Use sectionPath instead of frameElement access to avoid local file cross-frame restrictions.
        if (height > 0) {
          var sectionPath = (window.location.pathname || '').split('/').pop() || '';
          if (sectionPath) {
            window.parent.postMessage({
              type: 'iframeHeight',
              sectionPath: sectionPath,
              height: Math.ceil(height)
            }, '*');
          }
        }
      }
      window.__carePlanSendHeightToParent = sendHeightToParent;
      
      // Send initial height with increasing delays to catch all loading stages
      setTimeout(sendHeightToParent, 100);
      setTimeout(sendHeightToParent, 600);
      setTimeout(sendHeightToParent, 1500);
      
      // Mutation observer for DOM changes
      var mutTimeout = null;
      var observer = new MutationObserver(function() {
        clearTimeout(mutTimeout);
        mutTimeout = setTimeout(sendHeightToParent, 100);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
        // Note: attributes and characterData intentionally omitted — those options fire
        // on every keypress and attribute toggle, generating enormous background activity
        // across all 12 iframes and causing Safari to reload due to memory pressure.
      });
      
      // ResizeObserver for content size changes
      if (typeof ResizeObserver !== 'undefined') {
        try {
          var resizeTimeout = null;
          var resizeObs = new ResizeObserver(function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(sendHeightToParent, 100);
          });
          var container = document.querySelector('.container');
          if (container) resizeObs.observe(container);
        } catch (e) {}
      }
    } catch (e) {}
  }

  // Keep other open section pages in sync (especially in Combined-Care-Plan iframes).
  window.addEventListener('storage', function(e) {
    if (e.key !== 'carePlanSplitState') return;

    // In embedded (iframe) mode, cross-frame storage restores can interrupt typing.
    if (window.self !== window.top) return;

    // Do not interrupt active typing with external state restores.
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }

    restoreState();
    if (typeof onExternalUpdate === 'function') onExternalUpdate();
  });

  // Listen for messages from parent window (via postMessage)
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'carePlanLiveUpdate') {
      // Don't interrupt active user interaction (typing, open dropdowns).
      var luActive = document.activeElement;
      var luInteracting = luActive && (luActive.tagName === 'INPUT' || luActive.tagName === 'TEXTAREA' || luActive.tagName === 'SELECT');
      if (luInteracting) {
      } else {
        // Lightweight update: just trigger recalculation callbacks, no restoreState.
        // Guard against the feedback loop: any saveState/setGlobalState calls inside
        // onExternalUpdate will write to localStorage but NOT postMessage back to parent.
        window.__carePlanInLiveUpdate = true;
        try {
          if (typeof onExternalUpdate === 'function') onExternalUpdate();
        } finally {
          window.__carePlanInLiveUpdate = false;
        }
      }
    } else if (e.data && e.data.type === 'refreshFromGlobalState') {
      restoreState();
      if (typeof onExternalUpdate === 'function') onExternalUpdate();
    } else if (e.data && e.data.type === 'requestIframeHeight') {
      if (typeof window.__carePlanSendHeightToParent === 'function') {
        window.__carePlanSendHeightToParent();
      }
    } else if (e.data && e.data.type === 'carePlanStateSnapshot' && e.data.state) {
      var rev = parseInt(e.data.revision || 0, 10) || 0;
      // Only apply strictly newer snapshots.
      // Re-applying equal revisions can repeatedly rebuild dynamic rows
      // and interrupt active dropdown interaction in embedded sections.
      if (rev > lastSnapshotRevision) {
        lastSnapshotRevision = rev;
        var snapCount = 0;
        try { snapCount = Object.keys(e.data.state || {}).length; } catch (er) {}
        try {
          localStorage.setItem('carePlanSplitState', JSON.stringify(e.data.state || {}));
        } catch (err) {}

        if (!booted) {
          finalizeBoot();
        } else {
          // Don't interrupt active user interaction (typing, open dropdowns).
          var active = document.activeElement;
          var userInteracting = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
          if (!userInteracting) {
            restoreState();
            if (typeof onExternalUpdate === 'function') {
              // Also block saveState during snapshot-triggered onExternalUpdate
              // to prevent unnecessary writes from cascading to parent.
              window.__carePlanInLiveUpdate = true;
              try { onExternalUpdate(); } finally { window.__carePlanInLiveUpdate = false; }
            }
          } else {
          }
        }
      }
    }
  });

  // Initial request + light polling keeps sections in sync without direct frame access.
  // In embedded mode, defer boot until snapshot arrives (or timeout fallback).
  if (window.self !== window.top) {
    window.__carePlanSuspendSave = true;
    requestSnapshot('carePlanRequestState');
    setTimeout(function() { requestSnapshot('carePlanRequestState'); }, 200);
    setTimeout(function() { finalizeBoot(); }, 500);
    setInterval(function() { requestSnapshot('carePlanPoll'); }, 1200);
  } else {
    window.__carePlanSuspendSave = false;
    finalizeBoot();
  }
}

// === SIDE NAV (to disable: delete this block and the /* === SIDE NAV === */ block in shared.css) ===
function buildSideNav() {
  if (window.self !== window.top) return;
  if (document.getElementById('cp-side-nav')) return;
  // Inject CSS inline so it works regardless of shared.css caching
  if (!document.getElementById('cp-side-nav-style')) {
    var s = document.createElement('style');
    s.id = 'cp-side-nav-style';
    s.textContent =
      '#cp-side-nav{position:fixed;left:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:2px;z-index:900;background:#fff;border:1px solid #dbe5f0;border-radius:8px;padding:8px 6px;box-shadow:0 2px 10px rgba(17,74,141,.09);min-width:108px;max-width:260px;width:136px;resize:horizontal;overflow:auto;}' +
      '#cp-side-nav a{display:block;padding:5px 9px;border-radius:5px;font-size:1em;color:#4f6073;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s;line-height:1.4;}' +
      '#cp-side-nav a:hover{background:#eef5ff;color:#114a8d;}' +
      '#cp-side-nav a.active{background:#dbeaff;color:#1a4f82;font-weight:600;}' +
      '@media(max-width:1039px){#cp-side-nav{display:none;}}' +
      'body.embedded #cp-side-nav{display:none;}';
    document.head.appendChild(s);
  }
  var pages = [
    { label: 'Patient / Surgery', file: '1-Patient-Demographics.html' },
    { label: 'Labs',              file: '3-Labs-Chemistries.html' },
    { label: 'PMH / PSH',         file: '4-PMH.html' },
    { label: 'Meds',              file: '5-Prescribed-Medications.html' },
    { label: 'Preop History',     file: '6-Preop-History.html' },
    { label: 'Airway',            file: '7-Airway-Exam.html' },
    { label: 'Extras',            file: '7b-Extras.html' },
    { label: 'Plan',              file: '8-Anesthetic-Plan.html' },
    { label: 'PONV',              file: '8b-APFEL-PONV.html' },
    { label: 'Fluid / Blood',     file: '9-Fluid-Blood-Plan.html' }
  ];
  var path = window.location.pathname;
  var nav = document.createElement('nav');
  nav.id = 'cp-side-nav';
  nav.setAttribute('aria-label', 'Care Plan sections');
  pages.forEach(function(p) {
    var a = document.createElement('a');
    a.href = p.file;
    a.textContent = p.label;
    if (path.indexOf(p.file) !== -1) a.className = 'active';
    nav.appendChild(a);
  });
  document.body.appendChild(nav);

  // Scale font-size with nav width
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function(entries) {
      var w = entries[0].contentRect.width;
      // Base: 108px wide → 0.72em; scale linearly up to 260px → ~1.1em
      var fs = Math.max(0.72, Math.min(1.1, 0.72 + (w - 108) / (260 - 108) * (1.1 - 0.72)));
      nav.style.fontSize = fs.toFixed(3) + 'em';
    });
    ro.observe(nav);
  }
}
// Fire as early as possible; fall back to load event
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildSideNav);
} else {
  buildSideNav();
}
window.addEventListener('load', buildSideNav);
// === END SIDE NAV ===
