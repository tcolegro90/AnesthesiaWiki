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

  const state = getGlobalState();
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.id && !el.name) return;
    const key = el.id || (el.name + '::' + el.value);
    if (el.type === 'checkbox' || el.type === 'radio') {
      state[key] = el.checked;
    } else {
      state[key] = el.value;
    }
  });
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

function setGlobalState(state) {
  // During iframe hydration, block outgoing writes that can overwrite loaded plans
  // with default/empty controls before snapshot restore completes.
  if (window.__carePlanSuspendSave) return;

  try {
    localStorage.setItem('carePlanSplitState', JSON.stringify(state || {}));
  } catch (e) {}

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
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.id && !el.name) return;
    const key = el.id || (el.name + '::' + el.value);
    if (!(key in state)) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!state[key];
    } else {
      el.value = state[key];
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
    if (typeof extraInit === 'function') extraInit();
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
      setTimeout(sendHeightToParent, 300);
      setTimeout(sendHeightToParent, 600);
      setTimeout(sendHeightToParent, 1000);
      setTimeout(sendHeightToParent, 1500);
      setTimeout(sendHeightToParent, 2000);
      setTimeout(sendHeightToParent, 2500);
      
      // Mutation observer for DOM changes
      var mutTimeout = null;
      var observer = new MutationObserver(function() {
        clearTimeout(mutTimeout);
        mutTimeout = setTimeout(sendHeightToParent, 100);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
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
    if (e.data && e.data.type === 'refreshFromGlobalState') {
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
            if (typeof onExternalUpdate === 'function') onExternalUpdate();
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
