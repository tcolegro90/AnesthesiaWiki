    var mirroredState = {};
    var stateRevision = 0;
    var pageLoadTime = Date.now();
    // Suppress dirty flag during initial iframe boot-up state echo (first 4 seconds)
    var suspendIncomingStateUntil = pageLoadTime + 4000;
    var previewMode = 'single';
    var multiPreviewSelectedNames = [];
    var multiPreviewPlans = {};
    var draftSyncTimer = null;
    var lastDraftSyncWarningAt = 0;
    // Track last JSON written to localStorage so we skip redundant writes from the poll loop.
    var lastPersistedStateJson = '';
    // Snapshot localStorage at session start so we can detect user changes before cloud draft restore.
    var sessionStartStateJson = '';
    try { sessionStartStateJson = localStorage.getItem('carePlanSplitState') || ''; } catch (e) {}
    lastPersistedStateJson = sessionStartStateJson;
    window.__combinedJsLoaded = true;
    function _diag() {}

    // ── Custom modal helpers (replace native confirm/alert/prompt to avoid browser dialog suppression) ──

    function showSimpleModal(message, confirmLabel, cancelLabel) {
      return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;max-width:380px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:inherit;';
        var msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 20px;font-size:1rem;color:#1a365d;line-height:1.5;white-space:pre-wrap;';
        msg.textContent = message;
        var foot = document.createElement('div');
        foot.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelLabel || 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid #b9c8da;background:#fff;color:#444;font-size:0.9rem;cursor:pointer;font-family:inherit;';
        var confirmBtn = document.createElement('button');
        confirmBtn.textContent = confirmLabel || 'OK';
        confirmBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#c0392b;color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;';
        foot.appendChild(cancelBtn);
        foot.appendChild(confirmBtn);
        box.appendChild(msg);
        box.appendChild(foot);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        function close(val) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(val);
        }
        function onKey(ev) {
          if (ev.key === 'Escape') { document.removeEventListener('keydown', onKey, true); close(false); }
          if (ev.key === 'Enter')  { ev.preventDefault(); document.removeEventListener('keydown', onKey, true); close(true); }
        }
        cancelBtn.addEventListener('click', function() { document.removeEventListener('keydown', onKey, true); close(false); });
        confirmBtn.addEventListener('click', function() { document.removeEventListener('keydown', onKey, true); close(true); });
        overlay.addEventListener('click', function(ev) { if (ev.target === overlay) { document.removeEventListener('keydown', onKey, true); close(false); } });
        document.addEventListener('keydown', onKey, true);
      });
    }

    function showAlertModal(message) {
      return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;max-width:380px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:inherit;';
        var msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 20px;font-size:1rem;color:#1a365d;line-height:1.5;white-space:pre-wrap;';
        msg.textContent = message;
        var foot = document.createElement('div');
        foot.style.cssText = 'display:flex;justify-content:flex-end;';
        var okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:8px 20px;border-radius:8px;border:none;background:#0b5cab;color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;';
        foot.appendChild(okBtn);
        box.appendChild(msg);
        box.appendChild(foot);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        okBtn.focus();
        function close() {
          document.removeEventListener('keydown', onKey, true);
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve();
        }
        function onKey(ev) {
          if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); close(); }
        }
        okBtn.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);
      });
    }

    function showPromptModal(message, defaultValue) {
      return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;max-width:420px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:inherit;';
        var msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 12px;font-size:1rem;color:#1a365d;';
        msg.textContent = message;
        var input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #b9c8da;border-radius:6px;font-size:1rem;margin-bottom:16px;font-family:inherit;';
        var foot = document.createElement('div');
        foot.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid #b9c8da;background:#fff;color:#444;font-size:0.9rem;cursor:pointer;font-family:inherit;';
        var okBtn = document.createElement('button');
        okBtn.textContent = 'Save';
        okBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#0b5cab;color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;';
        foot.appendChild(cancelBtn);
        foot.appendChild(okBtn);
        box.appendChild(msg);
        box.appendChild(input);
        box.appendChild(foot);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(function() { input.focus(); input.select(); }, 30);
        function close(val) {
          document.removeEventListener('keydown', onKey, true);
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(val);
        }
        function onKey(ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); close(input.value || null); }
          if (ev.key === 'Escape') { ev.preventDefault(); close(null); }
        }
        cancelBtn.addEventListener('click', function() { close(null); });
        okBtn.addEventListener('click', function() { close(input.value || null); });
        overlay.addEventListener('click', function(ev) { if (ev.target === overlay) close(null); });
        document.addEventListener('keydown', onKey, true);
      });
    }

    function getDeviceId() {
      var key = 'carePlanDeviceId';
      try {
        var id = localStorage.getItem(key);
        if (id) return id;
        id = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
        localStorage.setItem(key, id);
        return id;
      } catch (e) { return 'dev-unknown'; }
    }

    function scheduleDraftSync() {
      if (draftSyncTimer) clearTimeout(draftSyncTimer);
      draftSyncTimer = setTimeout(function() {
        draftSyncTimer = null;
        var cs = window.carePlanCloudStorage;
        if (!cs || !cs.isEnabled || !cs.isEnabled()) return;
        var userId = cs.getUserId ? cs.getUserId() : '';
        if (!userId) return;
        var now = new Date().toISOString();
        // Merge full localStorage + mirroredState BEFORE writing, so we never
        // overwrite other sections' data with a partial mirroredState snapshot.
        var fullState = getState();
        fullState.__draftSavedAt = now;
        mirroredState.__draftSavedAt = now; // keep mirroredState timestamp in sync
        var fullJson = JSON.stringify(fullState);
        lastPersistedStateJson = fullJson;
        try { localStorage.setItem('carePlanSplitState', fullJson); } catch (e) {}
        cs.saveDraft(fullState, userId, getDeviceId()).catch(function(error) {
          var nowMs = Date.now();
          if (nowMs - lastDraftSyncWarningAt < 20000) return;
          lastDraftSyncWarningAt = nowMs;
          setStorageStatus(
            'Cloud sync issue: draft changes are currently saving only on this device. ' +
              ((error && error.message) ? error.message : String(error || 'Unknown error')),
            'warn'
          );
        });
      }, 3000);
    }

    function fitIframe(frame) {
      // Cannot access iframe contentDocument due to CORS restrictions on local files
      // Use postMessage approach instead (see setup below)
      return false;
    }

    function fitAll() {
      // Ask each iframe to send its latest measured height immediately.
      document.querySelectorAll('iframe').forEach(function(frame) {
        try {
          if (frame.contentWindow && typeof frame.contentWindow.postMessage === 'function') {
            frame.contentWindow.postMessage({ type: 'requestIframeHeight' }, '*');
          }
        } catch (e) {}
      });
    }

    function findFrameBySectionPath(sectionPath) {
      if (!sectionPath) return null;
      var frames = document.querySelectorAll('iframe');
      for (var i = 0; i < frames.length; i++) {
        var src = String(frames[i].getAttribute('src') || '');
        var base = src.split('?')[0].split('#')[0].split('/').pop();
        if (base === sectionPath) return frames[i];
      }
      return null;
    }

    function enforceIframeNoScrollDefaults() {
      document.querySelectorAll('iframe').forEach(function(frame) {
        frame.setAttribute('scrolling', 'no');
        frame.style.overflow = 'hidden';
      });
    }

    // Listen for height updates from iframes via postMessage
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'iframeHeight') {
        var sectionPath = e.data.sectionPath || '';
        var frameId = e.data.frameId;
        var height = e.data.height;
        var frame = null;
        if (sectionPath) {
          frame = findFrameBySectionPath(sectionPath);
        }
        if (!frame && frameId) {
          frame = document.getElementById(frameId);
        }
        if (frame && height) {
          frame.style.height = Math.max(120, (parseInt(height, 10) || 0)) + 'px';
        }
      } else if (e.data && e.data.type === 'carePlanState' && e.data.state) {
        // During load/reload, ignore stale state pushes from pre-reload iframes.
        if (Date.now() < suspendIncomingStateUntil) return;

        // Merge latest section-reported state into parent snapshot.
        var incoming = e.data.state || {};
        Object.keys(incoming).forEach(function(k) {
          mirroredState[k] = incoming[k];
        });
        stateRevision += 1;
        // Use getState() (localStorage merged with mirroredState) so one section
        // reporting in doesn't overwrite all other sections' data.
        // Only write if state actually changed to avoid ~10 writes/second churn from the poll loop.
        var newJson = JSON.stringify(getState());
        if (newJson !== lastPersistedStateJson) {
          lastPersistedStateJson = newJson;
          try { localStorage.setItem('carePlanSplitState', newJson); } catch (e2) {}
        }
        updateDeskTopbarPatient();
        scheduleDraftSync();
        // Broadcast a lightweight update signal to all OTHER iframes so scores/summaries recalculate in real-time.
        // Skip the sender to avoid interrupting their own active input.
        var senderSource = e.source;
        document.querySelectorAll('iframe').forEach(function(frame) {
          try {
            if (frame.contentWindow && frame.contentWindow !== senderSource) {
              frame.contentWindow.postMessage({ type: 'carePlanLiveUpdate' }, '*');
            }
          } catch (eb) {}
        });
        // Live-update print card while preview panel is open.
        try {
          var previewScreen = document.getElementById('preview-screen');
          if (previewScreen && previewScreen.style.display === 'flex') buildPrintCard();
        } catch (e4) {}
      } else if (e.data && (e.data.type === 'carePlanRequestState' || e.data.type === 'carePlanPoll')) {
        // Reply directly to requesting child without touching frame.contentWindow.
        try {
          var snap = getState();
          if (e.source && typeof e.source.postMessage === 'function') {
            e.source.postMessage({
              type: 'carePlanStateSnapshot',
              state: snap,
              revision: stateRevision
            }, '*');
          }
        } catch (e3) {}
      }
    });

    function getState() {
      var local = {};
      try {
        local = JSON.parse(localStorage.getItem('carePlanSplitState') || '{}') || {};
      } catch (e) {}

      // Merge persisted state with live child-reported state.
      // Child-reported values win because they reflect the currently edited sections.
      var merged = {};
      Object.keys(local || {}).forEach(function(k) { merged[k] = local[k]; });
      Object.keys(mirroredState || {}).forEach(function(k) { merged[k] = mirroredState[k]; });
      return merged;
    }

    async function clearAllData() {
      if (!(await showSimpleModal('Clear all currently entered data on this page?\n\nSaved plans are kept.', 'Clear', 'Cancel'))) return;
      try {
        // Clear only current in-progress state in Combined page context.
        localStorage.removeItem('carePlanSplitState');
      } catch (e) {}

      // Ignore late state pushes from old iframe instances while reset reloads occur.
      suspendIncomingStateUntil = Date.now() + 3000;

      // Clear parent-side mirrored snapshot so children cannot rehydrate stale values.
      mirroredState = {};
      stateRevision += 1;

      // Clear topbar patient display immediately
      updateDeskTopbarPatient();
      var mobTopName = document.getElementById('mob-topbar-name');
      if (mobTopName) mobTopName.textContent = '';

      // Clear the notes list on the parent page
      if (typeof restoreNoteRows === 'function') {
        if (typeof noteRowCount !== 'undefined') noteRowCount = 0;
        var nl = document.getElementById('notes-list');
        if (nl) nl.innerHTML = '';
        restoreNoteRows();
      }

      // Reload each section iframe with a reset token so it clears its own in-progress state.
      var stamp = Date.now();
      document.querySelectorAll('iframe').forEach(function(frame) {
        var src = frame.getAttribute('src') || '';
        var base = src.split('?')[0];
        frame.removeAttribute('name');
        frame.setAttribute('src', base + '?reset=' + stamp);
      });

      // Keep main page URL stable and clear print preview data.
      setTimeout(function() {
        if (document.getElementById('preview-screen')) {
          document.getElementById('preview-screen').style.display = 'none';
        }
        if (document.getElementById('main-content')) {
          document.getElementById('main-content').style.display = 'block';
        }
      }, 50);
    }

    function setStorageStatus(message, tone) {
      var el = document.getElementById('storage-status');
      if (!el) return;
      if (!message) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.textContent = message;
      el.setAttribute('data-tone', tone || 'warn');
      if (tone === 'ok') {
        if (setStorageStatus._timer) clearTimeout(setStorageStatus._timer);
        setStorageStatus._timer = setTimeout(function() { el.style.display = 'none'; }, 5000);
      }
    }

    function showTopbarFlash(msg) {
      var el = document.getElementById('topbar-flash');
      if (!el) return;
      if (showTopbarFlash._timer) clearTimeout(showTopbarFlash._timer);
      el.textContent = msg;
      el.style.display = '';
      el.style.opacity = '1';
      showTopbarFlash._timer = setTimeout(function() {
        el.style.opacity = '0';
        setTimeout(function() { el.style.display = 'none'; el.style.opacity = '1'; }, 420);
      }, 5000);
    }

    function getCloudUserId() {
      // Use real Firebase Auth UID when available
      try {
        if (window.firebase && window.firebase.auth) {
          var fbUser = window.firebase.auth().currentUser;
          if (fbUser && fbUser.uid) return fbUser.uid;
        }
      } catch (e) {}
      return '';
    }

    function updateCloudLoginUi() {
      var fbUser = null;
      try {
        if (window.firebase && window.firebase.auth) fbUser = window.firebase.auth().currentUser;
      } catch (e) {}
      var isLoggedIn = !!(fbUser && fbUser.uid);
      var displayName = isLoggedIn
        ? (fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : ''))
        : '';

      // Desktop header
      var loginBtn  = document.getElementById('cloud-login-btn');
      var logoutBtn = document.getElementById('cloud-logout-btn');
      var nameEl    = document.getElementById('header-auth-name');
      if (loginBtn)  loginBtn.style.display  = isLoggedIn ? 'none' : 'inline-block';
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
      if (nameEl)    nameEl.textContent = displayName;

      // Mobile drawer
      var mobLoginBtn  = document.getElementById('mob-cloud-login-btn');
      var mobLogoutBtn = document.getElementById('mob-cloud-logout-btn');
      var mobAuthName  = document.getElementById('mob-drawer-auth-name');
      var mobTopName   = document.getElementById('mob-topbar-name');
      if (mobLoginBtn)  mobLoginBtn.style.display  = isLoggedIn ? 'none' : 'inline-block';
      if (mobLogoutBtn) mobLogoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
      if (mobAuthName)  mobAuthName.textContent    = isLoggedIn ? ('👤 ' + displayName) : '';
      if (mobTopName)   mobTopName.textContent     = displayName;
    }

    function updateDeskTopbarPatient() {
      var el = document.getElementById('desk-topbar-patient');
      if (!el) return;
      var s = getState();
      var initials = String(s['pat-initials'] || '').trim();
      var surgery  = String(s['pat-surgery']  || '').trim();
      var parts = [];
      if (initials) parts.push(initials);
      if (surgery)  parts.push(surgery);
      el.textContent = parts.length ? '— ' + parts.join(' • ') : '';
    }

    async function applyCloudLogin() {
      // Sign-in is handled globally by AnesthesiaAuth overlay
      if (window.AnesthesiaAuth) window.AnesthesiaAuth.showLogin();
    }

    async function clearCloudLogin() {
      if (window.AnesthesiaAuth) await window.AnesthesiaAuth.signOut();
      updateCloudLoginUi();
      await shouldUseCloudPlans();
    }

    function getLocalSavedPlans() {
      try { return JSON.parse(localStorage.getItem('carePlanSavedPlans') || '{}') || {}; }
      catch (e) { return {}; }
    }

    var MAX_SAVED_PLANS = 2000;

    function getSavedPlanNamesSorted(plans) {
      plans = plans || {};
      return Object.keys(plans).sort(function(a, b) {
        var sa = (plans[a] && plans[a].state && plans[a].state['pat-surg-date']) || '';
        var sb = (plans[b] && plans[b].state && plans[b].state['pat-surg-date']) || '';
        var da = sa ? new Date(sa).getTime() : 0;
        var db = sb ? new Date(sb).getTime() : 0;
        if (db !== da) return db - da; // newest surgery date first
        // Tiebreak by when the plan was saved
        var ta = (plans[a] && plans[a].savedAt) ? new Date(plans[a].savedAt).getTime() : 0;
        var tb = (plans[b] && plans[b].savedAt) ? new Date(plans[b].savedAt).getTime() : 0;
        return tb - ta;
      });
    }

    function setLocalSavedPlans(plans) {
      localStorage.setItem('carePlanSavedPlans', JSON.stringify(plans || {}));
    }

    async function shouldUseCloudPlans() {
      var userId = getCloudUserId();

      if (!window.carePlanCloudStorage || !window.carePlanCloudStorage.isEnabled()) {
        setStorageStatus('Plans you create and save will ONLY be available on this specific device UNLESS you log in', 'warn');
        return false;
      }

      try {
        var ready = await window.carePlanCloudStorage.ensureReady();
        var status = window.carePlanCloudStorage.getStatus(userId);
        setStorageStatus(status.message, status.tone);
        if (ready && userId) {
          checkAndRestoreCloudDraft(userId);
        }
        return !!(ready && userId);
      } catch (error) {
        setStorageStatus('Cloud sync is unavailable right now. ' + (error.message || String(error)), 'warn');
        return false;
      }
    }

    async function checkAndRestoreCloudDraft(userId) {
      // Only attempt once per page session. shouldUseCloudPlans() is called from
      // onAuthStateChanged, getSavedPlans(), saveNamedPlan(), etc. — without this guard,
      // every Save/Load/Delete click re-runs the restore logic and can wipe current work.
      _diag('checkAndRestoreCloudDraft: called (done=' + !!checkAndRestoreCloudDraft._done + ')');
      if (checkAndRestoreCloudDraft._done) { _diag('checkAndRestoreCloudDraft: already done, skip'); return; }
      checkAndRestoreCloudDraft._done = true;

      try {
        var draft = await window.carePlanCloudStorage.loadDraft(userId);
        if (!draft || !draft.savedAt) { _diag('checkAndRestoreCloudDraft: no cloud draft, done'); return; }

        var cloudTime = new Date(draft.savedAt).getTime();
        if (isNaN(cloudTime)) { _diag('checkAndRestoreCloudDraft: invalid savedAt'); return; }

        var currentLocalJson = '';
        try { currentLocalJson = localStorage.getItem('carePlanSplitState') || ''; } catch (e) {}
        var localLen = 0, startLen = 0;
        try { localLen = Object.keys(JSON.parse(currentLocalJson || '{}')).length; } catch (e) {}
        try { startLen = Object.keys(JSON.parse(sessionStartStateJson || '{}')).length; } catch (e) {}
        var jsonsMatch = currentLocalJson === sessionStartStateJson;
        _diag('checkAndRestoreCloudDraft: currentLocal=' + localLen + 'keys, sessionStart=' + startLen + 'keys, match=' + jsonsMatch);
        if (!jsonsMatch) { _diag('checkAndRestoreCloudDraft: JSON guard BLOCKED restore (user changed data)'); return; }

        // Compare to local state timestamp if available.
        var localRaw = currentLocalJson;
        var localState = {};
        try { localState = JSON.parse(localRaw) || {}; } catch (e) {}
        var localTime = 0;
        if (localState.__draftSavedAt) {
          localTime = new Date(localState.__draftSavedAt).getTime() || 0;
        } else {
          // No __draftSavedAt means this content was never cloud-synced (user just started
          // typing, cloud sync was disabled, or the browser reloaded due to memory pressure
          // before the 3-second debounce could fire). Protect it by using page load time
          // as the floor — any existing cloud draft predates this page load and cannot win.
          var hasLocalContent = Object.keys(localState).some(function(k) {
            return !k.startsWith('__') && !!localState[k];
          });
          if (hasLocalContent) localTime = pageLoadTime;
        }

        var timeDiff = cloudTime - localTime;
        _diag('checkAndRestoreCloudDraft: cloudTime=' + new Date(cloudTime).toLocaleTimeString() + ' localTime=' + new Date(localTime).toLocaleTimeString() + ' diff=' + Math.round(timeDiff / 1000) + 's');
        if (cloudTime > localTime + 10000) {
          _diag('checkAndRestoreCloudDraft: RESTORING CLOUD DRAFT (cloud is newer by ' + Math.round(timeDiff / 1000) + 's)');
          // Cloud draft is meaningfully newer — restore it.
          var nextState = draft.state || {};
          suspendIncomingStateUntil = Date.now() + 2000;
          mirroredState = Object.assign({}, nextState);
          stateRevision += 1;
          var cloudJson = JSON.stringify(mirroredState);
          lastPersistedStateJson = cloudJson;
          try { localStorage.setItem('carePlanSplitState', cloudJson); } catch (e) {}
          var notesEl = document.getElementById('notes-freetext');
          if (notesEl) notesEl.value = nextState['notes-freetext'] || '';
          syncFramesFromState();
          fitAll();
          var fromOtherDevice = draft.deviceId && draft.deviceId !== getDeviceId();
          var timeStr = new Date(cloudTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          if (fromOtherDevice) {
            setStorageStatus('Restored your work from another device (' + timeStr + ').', 'ok');
          } else {
            setStorageStatus('Restored your recent work (' + timeStr + ').', 'ok');
          }
        } else {
          _diag('checkAndRestoreCloudDraft: cloud NOT newer enough, no restore');
        }
      } catch (e) { _diag('checkAndRestoreCloudDraft: ERROR ' + e); }
    }

    async function getSavedPlans() {
      if (!(await shouldUseCloudPlans())) {
        return getLocalSavedPlans();
      }

      try {
        var plans = await window.carePlanCloudStorage.listPlans(getCloudUserId());
        setLocalSavedPlans(plans);
        return plans;
      } catch (error) {
        setStorageStatus('Cloud sync is unavailable right now. Showing this device\'s cached plans (may be stale). ' + (error.message || String(error)), 'warn');
        return getLocalSavedPlans();
      }
    }

    function syncFramesFromState() {
      // Reload each section iframe so it requests latest snapshot from parent.
      _diag('syncFramesFromState: CALLED - reloading all iframes');
      var stamp = Date.now();
      document.querySelectorAll('iframe').forEach(function(frame) {
        var src = frame.getAttribute('src') || '';
        var base = src.split('?')[0];
        frame.setAttribute('src', base + '?sync=' + stamp);
      });
    }

    function buildDefaultPlanName(state, fallbackLabel) {
      var s = state || {};
      var nameParts = [
        s['pat-initials'] || fallbackLabel || 'Patient',
        s['pat-surg-date'] || 'NoDate',
        s['pat-sched-surg-time'] || 'NoTime'
      ];
      if (s['pat-surg-end-time']) nameParts.push(s['pat-surg-end-time']);
      nameParts.push(s['pat-surgery'] || 'NoSurgery');
      return nameParts.join(' | ');
    }

    function addMinutesToTime(startHHMM, minutesText) {
      var start = String(startHHMM || '').trim();
      var m = start.match(/^(\d{2}):(\d{2})$/);
      if (!m) return '';
      var hh = parseInt(m[1], 10);
      var mm = parseInt(m[2], 10);
      var mins = parseInt(String(minutesText || '').trim(), 10);
      if (!isFinite(hh) || !isFinite(mm) || !isFinite(mins)) return '';
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || mins < 0) return '';

      var total = (hh * 60) + mm + mins;
      total = ((total % 1440) + 1440) % 1440;
      var endH = Math.floor(total / 60);
      var endM = total % 60;
      return String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0');
    }

    function buildImportedCaseName(state, fallbackLabel) {
      var s = state || {};
      var start = String(s['pat-sched-surg-time'] || '').trim() || 'NoStart';
      var end = String(s['pat-surg-end-time'] || '').trim() || 'NoEnd';
      var surgery = String(s['pat-surgery'] || '').trim() || String(fallbackLabel || 'NoProcedure');
      var roomToken = String(s['pat-or-number'] || '').toUpperCase().replace(/\s+/g, '') || 'CPG';
      var dateToken = String(s['pat-surg-date'] || '').trim();
      var startToken = start.replace(':', '');
      var endToken = end.replace(':', '');
      return [roomToken, dateToken, startToken, endToken, surgery].join(' | ');
    }

    function makeUniquePlanName(baseName, plans) {
      var cleanBase = String(baseName || '').trim() || 'Patient | NoDate | NoTime | NoSurgery';
      var existing = plans || {};
      if (!existing[cleanBase]) return cleanBase;
      var i = 2;
      var next = cleanBase + ' (' + i + ')';
      while (existing[next]) {
        i += 1;
        next = cleanBase + ' (' + i + ')';
      }
      return next;
    }

    function parseDateFromText(rawText) {
      var text = String(rawText || '');
      if (!text) return '';

      var m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))\b/);
      if (!m) return '';
      var mm = parseInt(m[1], 10);
      var dd = parseInt(m[2], 10);
      var yyyy = m[3] ? parseInt(m[3], 10) : (new Date()).getFullYear();
      if (yyyy < 100) yyyy += 2000;
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 2000 || yyyy > 2100) return '';
      return mm + '/' + dd + '/' + yyyy;
    }

    function normalizeTimeText(rawTime) {
      var text = String(rawTime || '').trim().toUpperCase();
      if (!text) return '';

      var compact = text.replace(/\s+/g, '');
      var m = compact.match(/^(\d{1,2})(?::?(\d{2}))?(AM|PM)?$/);
      if (!m) return '';

      var hh = parseInt(m[1], 10);
      var mm = parseInt(m[2] || '0', 10);
      var mer = m[3] || '';
      if (isNaN(hh) || isNaN(mm) || mm < 0 || mm > 59) return '';

      if (mer) {
        if (hh < 1 || hh > 12) return '';
        if (mer === 'AM') hh = hh % 12;
        if (mer === 'PM') hh = (hh % 12) + 12;
      } else if (hh > 23) {
        return '';
      }

      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    function parseTimeFromText(rawText) {
      var text = String(rawText || '');
      if (!text) return '';

      var withLabel = text.match(/(?:time|start|sx|surg(?:ery)?)\s*[:\-]?\s*([0-2]?\d(?::\d{2})?\s*(?:AM|PM)?)/i);
      if (withLabel && withLabel[1]) {
        var normalizedLabeled = normalizeTimeText(withLabel[1]);
        if (normalizedLabeled) return normalizedLabeled;
      }

      var generic = text.match(/\b([0-2]?\d(?::\d{2})\s*(?:AM|PM)?)\b/i);
      if (generic && generic[1]) return normalizeTimeText(generic[1]);

      var compact = text.match(/\b([01]?\d|2[0-3])[0-5]\d\b/);
      if (compact && compact[0]) return normalizeTimeText(compact[0]);

      return '';
    }

    function parseAgeFromText(rawText) {
      var text = String(rawText || '');
      if (!text) return '';

      var m = text.match(/(?:age|yrs?|yo|y\/o)\s*[:\-]?\s*(\d{1,3})\b/i);
      if (!m) m = text.match(/\b(\d{1,3})\s*(?:yo|yr|yrs|years?)\b/i);
      if (!m) return '';

      var age = parseInt(m[1], 10);
      if (isNaN(age) || age < 0 || age > 120) return '';
      return String(age);
    }

    function parseInitialsFromText(rawText) {
      var text = String(rawText || '');
      if (!text) return '';

      var yoName = text.match(/\b\d{1,3}\s*y\.?o\.?\s*([A-Z][A-Z'\-]+),\s*([A-Z][A-Z'\-]+)/i);
      if (yoName && yoName[1] && yoName[2]) {
        var yoInitials = (yoName[2].charAt(0) + yoName[1].charAt(0)).toUpperCase();
        if (yoInitials.length === 2) return yoInitials;
      }

      var labeled = text.match(/(?:initials?|patient|pt)\s*[:\-]?\s*([A-Z][A-Z\.]{1,5})\b/i);
      if (labeled && labeled[1]) {
        var cleanedLabeled = String(labeled[1]).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        if (cleanedLabeled.length >= 2) return cleanedLabeled;
      }

      var candidates = text.toUpperCase().match(/\b[A-Z]{2,3}\b/g) || [];
      var blocked = {
        AGE: true, OR: true, PMH: true, ASA: true, DOB: true, DOS: true,
        MRI: true, CT: true, PACU: true, ROOM: true, CASE: true, TIME: true
      };
      for (var i = 0; i < candidates.length; i++) {
        if (!blocked[candidates[i]]) return candidates[i];
      }
      return '';
    }

    function parseSurgeryFromText(rawText, fallbackName) {
      var text = String(rawText || '').replace(/\r/g, '\n');
      var lines = text.split('\n').map(function(line) {
        return String(line || '').trim().replace(/\s+/g, ' ');
      }).filter(function(line) { return !!line; });

      var surgeryHint = /(procedure|surgery|operation|appendectomy|cholecystectomy|arthro|fusion|repair|revision|scope|biopsy|crani|cesarean|c-section|laminectomy|orif)/i;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (ln.length < 6 || ln.length > 110) continue;
        if (/\b(age|dob|mrn|room|or\s*#|time|date)\b/i.test(ln)) continue;
        if (surgeryHint.test(ln)) return ln;
      }

      var cleanedFallback = String(fallbackName || '').replace(/\.[^.]+$/, '').replace(/[\-_]+/g, ' ').trim();
      return cleanedFallback || '';
    }

    function buildRoomPattern(roomFilter) {
      var raw = String(roomFilter || '').trim().toUpperCase();
      if (!raw) return null;

      var m = raw.match(/^(?:OR\s*[-#]?\s*)?(\d{1,2})\b/);
      if (!m) return null;

      var num = parseInt(m[1], 10);
      if (!isFinite(num) || num < 0 || num > 99) return null;

      return {
        number: num,
        label: 'OR ' + String(num).padStart(2, '0'),
        regex: new RegExp('\\bOR\\s*[-#]?\\s*0?' + num + '\\b', 'i')
      };
    }

    function isValidMilitaryTimeHHMM(token) {
      var text = String(token || '').trim();
      if (!/^\d{4}$/.test(text)) return false;
      var hh = parseInt(text.slice(0, 2), 10);
      var mm = parseInt(text.slice(2), 10);
      return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
    }

    function parseStartTimeFromBoardBlock(blockText) {
      var tokens = String(blockText || '').match(/\b\d{4}\b/g) || [];
      for (var i = 0; i < tokens.length; i++) {
        if (isValidMilitaryTimeHHMM(tokens[i])) {
          return tokens[i].slice(0, 2) + ':' + tokens[i].slice(2);
        }
      }
      return '';
    }

    function parseCaseLengthMinutesFromBoardBlock(blockText) {
      var roomCols = parseRoomColumnsFromBoardBlock(blockText);
      if (roomCols && roomCols.length) return roomCols.length;

      var flat = String(blockText || '').replace(/\r/g, ' ').replace(/\n/g, ' ');
      var tokens = flat.match(/\b\d{1,4}\b/g) || [];
      if (!tokens.length) return '';

      var startIdx = -1;
      for (var i = 0; i < tokens.length; i++) {
        if (isValidMilitaryTimeHHMM(tokens[i])) {
          startIdx = i;
          break;
        }
      }

      if (startIdx === -1 || startIdx + 1 >= tokens.length) return '';

      for (var j = startIdx + 1; j < Math.min(tokens.length, startIdx + 5); j++) {
        var n = parseInt(tokens[j], 10);
        if (!isFinite(n)) continue;
        if (n >= 1 && n <= 1500) return String(n);
      }
      return '';
    }

    function parseRoomColumnsFromBoardBlock(blockText) {
      var text = String(blockText || '').replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ');
      var m = text.match(/\b(\d{3,4})\b(.*?)\bOR\s*[-#]?\s*0?(\d{1,2})\b/i);
      if (!m) return null;

      var startToken = String(m[1] || '');
      var between = String(m[2] || '');
      var roomToken = String(m[3] || '');
      if (!isValidMilitaryTimeHHMM(startToken)) return null;

      // Length column is numeric only; ignore OCR punctuation/noise.
      var lenToken = between.replace(/[^0-9]/g, '');
      if (!lenToken) return null;
      if (lenToken.length > 4) lenToken = lenToken.slice(0, 4);
      var minutes = parseInt(lenToken, 10);
      if (!isFinite(minutes) || minutes < 1 || minutes > 1500) return null;

      return {
        start: startToken.slice(0, 2) + ':' + startToken.slice(2),
        length: String(minutes),
        room: 'OR ' + String(parseInt(roomToken, 10)).padStart(2, '0')
      };
    }

    function parseAgeFromBoardBlock(blockText) {
      var text = String(blockText || '');
      var m = text.match(/\b(\d{1,3})\s*y\.?o\.?\b/i);
      if (!m) m = text.match(/\b(\d{1,3})\s*(?:yo|yr|yrs|years?)\b/i);
      if (!m) m = text.match(/\bOR\s*[-#]?\s*\d{1,2}\s+\w*\s*(\d{1,3})\b/i);
      if (!m) return '';
      var age = parseInt(m[1], 10);
      if (!isFinite(age) || age < 0 || age > 120) return '';
      return String(age);
    }

    function parseProcedureFromBoardBlock(blockText, fallbackName) {
      var text = String(blockText || '').replace(/\r/g, '\n');
      text = text.replace(/direct\s+admit\s+hp\s+by\s+service\s+line/ig, ' ');
      text = text.replace(/\/\s*direct\s+admit[^\n]*/ig, ' ');

      // Never import equipment/special-needs column content into CPG surgery.
      var stopAt = [
        /\bequipment\b/i,
        /\bspecial\s*needs\b/i,
        /\bmedtronic\b/i,
        /\bstryker\b/i,
        /\bjackson\b/i,
        /\bneuro\s*monitor(?:ing)?\b/i,
        /\bservice\s*line\b/i,
        /\bdirect\s*admit\b/i,
        /\bneeds\s*post[- ]?op\b/i,
        /\brequesting\b/i
      ];
      var cut = -1;
      for (var i = 0; i < stopAt.length; i++) {
        var mStop = text.match(stopAt[i]);
        if (!mStop || typeof mStop.index !== 'number') continue;
        if (cut === -1 || mStop.index < cut) cut = mStop.index;
      }
      if (cut > 0) text = text.slice(0, cut);

      var procedureStart = /(gastroscopy|egd|esophagogastroduodenoscopy|open|laparoscopic|robotic|excision|resection|fusion|repair|revision|arthro|biopsy|laminectomy|cholecystectomy|appendectomy|crani|c-section|cesarean|cabg|endarterectomy|bronchoscopy|endoscopy|colonoscopy|cystoscopy|hernia|thyroid|parathyroid|hysterectomy|mastectomy|orchiectomy|nephrectomy|lobectomy|tonsillectomy|debridement|fixation|orif)/i;
      var match = text.match(procedureStart);
      if (match && match.index >= 0) {
        return text
          .slice(match.index)
          .replace(/direct\s+admit\s+hp\s+by\s+service\s+line/ig, ' ')
          .replace(/\s*[-|]\s*$/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return parseSurgeryFromText(text, fallbackName);
    }

    function parseDispositionFromBoardBlock(blockText) {
      var text = String(blockText || '').toLowerCase().replace(/\s+/g, ' ');
      if (!text) return '';

      if (/same\s*day\s*surgery|\bsds\b|\bcar\b|\bpo\b/.test(text)) {
        return 'Same Day Surgery (Home)';
      }
      if (/floor\s*\/\s*med\s*-?\s*surg|med\s*-?\s*surg|\bfloor\b|\bdoor\b|\bms\b/.test(text)) {
        return 'Floor / Med-Surg';
      }
      if (/\binpatient\b|\bin\s*-?\s*pt\b|\bip\b|\bbed\b/.test(text)) {
        return 'Inpatient';
      }

      var rowMatch = text.match(/\b\d{3,4}\s+\d{1,4}\s+or\s*[-#]?\s*0?\d{1,2}\b\s*([a-z]{1,6})?/i);
      var hint = rowMatch && rowMatch[1] ? String(rowMatch[1]).toLowerCase() : '';
      if (hint === 'po' || hint === 'car' || hint === 'sds') return 'Same Day Surgery (Home)';
      if (hint === 'door' || hint === 'ms' || hint === 'flr') return 'Floor / Med-Surg';
      if (hint === 'ip' || hint === 'inp' || hint === 'bed') return 'Inpatient';

      return '';
    }

    function suggestLengthCorrection(lengthText, surgeryText) {
      var n = parseInt(String(lengthText || '').trim(), 10);
      if (!isFinite(n) || n >= 10) return '';
      var surg = String(surgeryText || '').toLowerCase();

      // Common short GI cases frequently OCR-drop the trailing digit (e.g. 31 -> 3).
      if (/gastroscopy|egd|endoscopy|colonoscopy|biopsy/.test(surg)) {
        return String((n * 10) + 1);
      }

      return String((n * 10) + 1);
    }

    function extractCaseBlocksForRoom(rawText, roomFilter) {
      var room = buildRoomPattern(roomFilter);
      if (!room) return [];

      var lines = String(rawText || '').replace(/\r/g, '\n').split('\n').map(function(line) {
        return String(line || '').trim().replace(/\s+/g, ' ');
      }).filter(function(line) { return !!line; });
      if (!lines.length) return [];

      var rowMarker = /\bOR\s*[-#]?\s*\d{1,2}\b/i;
      var blocks = [];

      for (var i = 0; i < lines.length; i++) {
        if (!room.regex.test(lines[i])) continue;

        var start = i;
        var end = i;
        var hardLimit = Math.min(lines.length - 1, i + 8);
        while (end < hardLimit) {
          var nextLine = lines[end + 1];
          if (!nextLine) break;
          if (rowMarker.test(nextLine)) break;
          end += 1;
        }

        var blockLines = lines.slice(start, end + 1);
        var blockText = blockLines.join('\n');
        if (blockText.length > 8) {
          var cols = parseRoomColumnsFromBoardBlock(blockText);
          if (cols && cols.room === room.label) blocks.push(blockText);
        }
      }

      var seen = {};
      return blocks.filter(function(block) {
        var key = String(block || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    async function extractCaseSeedsFromScreenshot(file, index, options) {
      var fileLabel = String((file && file.name) || ('Case ' + (index + 1)));
      var fromFileText = fileLabel.replace(/\.[^.]+$/, '').replace(/[\-_]+/g, ' ');
      var roomFilter = String((options && options.roomFilter) || '').trim();

      var ocrText = '';
      try {
        var recognized = await window.Tesseract.recognize(file, 'eng');
        ocrText = (recognized && recognized.data && recognized.data.text) ? recognized.data.text : '';
      } catch (e) {
        ocrText = '';
      }

      var sourceBlocks = [];
      if (roomFilter) {
        sourceBlocks = extractCaseBlocksForRoom(ocrText, roomFilter);
        if (!sourceBlocks.length) return [];
      }
      if (!sourceBlocks.length) sourceBlocks = [ocrText || fromFileText];

      var seeds = [];
      for (var i = 0; i < sourceBlocks.length; i++) {
        var blockText = sourceBlocks[i];
        var roomCols = parseRoomColumnsFromBoardBlock(blockText);
        var age = parseAgeFromBoardBlock(blockText) || parseAgeFromText(blockText) || parseAgeFromText(fromFileText);
        var surgery = parseProcedureFromBoardBlock(blockText, fromFileText);
        var startTime = (roomCols && roomCols.start) || parseStartTimeFromBoardBlock(blockText) || parseTimeFromText(blockText) || parseTimeFromText(ocrText) || parseTimeFromText(fromFileText);
        var caseLength = (roomCols && roomCols.length) || parseCaseLengthMinutesFromBoardBlock(blockText);
        var room = buildRoomPattern(roomFilter);
        var disposition = parseDispositionFromBoardBlock(blockText);

        if (roomFilter) {
          if (!roomCols || roomCols.room !== room.label) continue;
          if (!startTime || !caseLength) continue;
        }

        var state = {};
        // Leave patient name/initials blank for this board-import workflow.
        if (!age) {
          var agePrompt = await showPromptModal(
            'Could not confidently read age for ' +
            ((room && room.label) ? room.label : 'this case') +
            (startTime ? (' at ' + startTime) : '') +
            '. Enter age to save in CPG.',
            ''
          );
          if (agePrompt !== null) {
            var ageDigits = String(agePrompt || '').replace(/[^0-9]/g, '');
            var ageN = parseInt(ageDigits, 10);
            if (isFinite(ageN) && ageN >= 0 && ageN <= 120) age = String(ageN);
          }
        }
        if (age) state['pat-age'] = age;
        if (surgery) state['pat-surgery'] = surgery;
        if (startTime) state['pat-sched-surg-time'] = startTime;
        if (caseLength) state['pat-surg-length'] = caseLength;
        if (room && room.label) state['pat-or-number'] = room.label;
        if (disposition) state['pat-disposition'] = disposition;

        var parsedLen = parseInt(String(caseLength || '').trim(), 10);
        if (isFinite(parsedLen) && parsedLen > 0 && parsedLen < 10) {
          var suggestedLen = suggestLengthCorrection(caseLength, surgery);
          var promptMsg =
            'Parsed a suspicious case length of ' + caseLength + ' minutes for ' +
            (room && room.label ? room.label : 'this room') +
            (startTime ? (' at ' + startTime) : '') + '.\n\n' +
            'Enter corrected minutes, or leave as-is.';
          var corrected = await showPromptModal(promptMsg, suggestedLen || String(caseLength));
          if (corrected !== null) {
            var clean = String(corrected || '').replace(/[^0-9]/g, '');
            var cleanN = parseInt(clean, 10);
            if (isFinite(cleanN) && cleanN > 0 && cleanN <= 1500) {
              caseLength = String(cleanN);
              state['pat-surg-length'] = caseLength;
            }
          }
        }

        if (startTime && caseLength) {
          var endTime = addMinutesToTime(startTime, caseLength);
          if (endTime) state['pat-surg-end-time'] = endTime;
        }

        if (!Object.keys(state).length) continue;

        seeds.push({
          fileName: fileLabel,
          state: state,
          nameBase: buildImportedCaseName(state, 'Patient ' + (index + 1) + (sourceBlocks.length > 1 ? ('-' + (i + 1)) : ''))
        });
      }

      var seenSeed = {};
      return seeds.filter(function(seed) {
        var s = seed.state || {};
        var sig = [s['pat-or-number'] || '', s['pat-sched-surg-time'] || '', s['pat-surg-length'] || '', s['pat-age'] || '', (s['pat-surgery'] || '').slice(0, 60)].join('|');
        if (!sig || seenSeed[sig]) return false;
        seenSeed[sig] = true;
        return true;
      });
    }

    async function bulkImportCasesFromScreenshots(fileList) {
      var files = Array.from(fileList || []);
      if (!files.length) return;

      if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
        await showAlertModal('Screenshot import is not ready yet. Please refresh and try again.');
        return;
      }

      var roomFilterAnswer = await showPromptModal(
        'Optional: enter your room to import only your cases (example: OR 06).\n\nLeave blank to use broad matching.',
        ''
      );
      if (roomFilterAnswer === null) return;
      var roomFilter = String(roomFilterAnswer || '').trim();

      var cloudEnabled = await shouldUseCloudPlans();
      var plans = getLocalSavedPlans();
      if (cloudEnabled) {
        try {
          plans = await window.carePlanCloudStorage.listPlans(getCloudUserId());
        } catch (error) {
          setStorageStatus('Cloud sync is unavailable right now. Importing into this browser only. ' + (error.message || String(error)), 'warn');
          cloudEnabled = false;
        }
      }

      var seeds = [];
      for (var i = 0; i < files.length; i++) {
        setStorageStatus('Reading screenshot ' + (i + 1) + ' of ' + files.length + '...', 'warn');
        var found = await extractCaseSeedsFromScreenshot(files[i], i, { roomFilter: roomFilter });
        seeds = seeds.concat(found);
      }

      if (!seeds.length) {
        var noMatchMsg = roomFilter
          ? ('No cases were detected for room ' + roomFilter + '. Try a clearer screenshot or verify the room format (example: OR 06).')
          : 'No cases were detected from the screenshot(s). Try a clearer screenshot or enter a room filter (example: OR 06).';
        await showAlertModal(noMatchMsg);
        return;
      }

      var createdNames = [];
      var nowIso = new Date().toISOString();
      var limitHit = false;
      for (var j = 0; j < seeds.length; j++) {
        if (Object.keys(plans).length >= MAX_SAVED_PLANS) {
          limitHit = true;
          break;
        }
        var seed = seeds[j];
        var uniqueName = makeUniquePlanName(seed.nameBase, plans);
        var entry = { savedAt: nowIso, state: seed.state || {} };
        plans[uniqueName] = entry;

        if (cloudEnabled) {
          try {
            await window.carePlanCloudStorage.savePlan(uniqueName, seed.state || {}, getCloudUserId());
          } catch (error) {
            cloudEnabled = false;
            setStorageStatus('Cloud save failed during import. Remaining cases were saved in this browser only. ' + (error.message || String(error)), 'warn');
          }
        }
        createdNames.push(uniqueName);
      }

      setLocalSavedPlans(plans);

      if (!createdNames.length) {
        if (limitHit) {
          await showAlertModal('No cases were created because you are at the max of ' + MAX_SAVED_PLANS + ' saved plans. Delete some plans and try again.');
        } else {
          await showAlertModal('No cases were created from the parsed rows. Try a clearer screenshot or adjust room filter.');
        }
        return;
      }

      if (cloudEnabled) {
        setStorageStatus('Firebase cloud sync is on.', 'ok');
      }

      showTopbarFlash('Imported ' + createdNames.length + ' case' + (createdNames.length > 1 ? 's' : '') + '.');
      var summary = 'Created ' + createdNames.length + ' saved case' + (createdNames.length > 1 ? 's' : '') + ' from screenshots.\n\n' +
        createdNames.slice(0, 8).join('\n') +
        (createdNames.length > 8 ? ('\n...and ' + (createdNames.length - 8) + ' more') : '');
      await showAlertModal(summary);
    }

    async function saveNamedPlan() {
      // Iframes auto-save via their own event listeners
      // No need to actively call saveState (causes CORS errors)

      var s = (mirroredState && Object.keys(mirroredState).length) ? mirroredState : getState();
      var defaultName = buildDefaultPlanName(s, 'Patient');
      var name = await showPromptModal('Save plan as:', defaultName);
      if (!name) return;
      name = name.trim();
      if (!name) return;

      var cloudEnabled = await shouldUseCloudPlans();
      var savedToCloud = false;
      var plans = getLocalSavedPlans();
      if (cloudEnabled) {
        try {
          plans = await window.carePlanCloudStorage.listPlans(getCloudUserId());
        } catch (error) {
          setStorageStatus('Cloud sync is unavailable right now. Saving in this browser only. ' + (error.message || String(error)), 'warn');
          cloudEnabled = false;
        }
      }
      var isOverwrite = !!plans[name];
      if (!isOverwrite && Object.keys(plans).length >= MAX_SAVED_PLANS) {
        await showAlertModal('You can save up to ' + MAX_SAVED_PLANS + ' plans. Delete one first or overwrite an existing name.');
        return;
      }
      var entry = {
        savedAt: new Date().toISOString(),
        state: s
      };

      plans[name] = entry;

      if (cloudEnabled) {
        try {
          await window.carePlanCloudStorage.savePlan(name, s, getCloudUserId());
          savedToCloud = true;
          setStorageStatus('Firebase cloud sync is on.', 'ok');
        } catch (error) {
          setStorageStatus('Cloud save failed. Saving in this browser only. ' + (error.message || String(error)), 'warn');
          cloudEnabled = false;
        }
      }

      setLocalSavedPlans(plans);
      if (savedToCloud) {
        showTopbarFlash('Saved to cloud');
      } else if (cloudEnabled) {
        showTopbarFlash('Saved locally (cloud not confirmed)');
      } else {
        showTopbarFlash('Saved locally: ' + name + ' (log in to sync)');
      }
    }

    async function loadNamedPlan() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        showTopbarFlash('No saved plans found.');
        return;
      }

      var picked = await showSavedPlanPicker(names, names.slice(0, 1), {
        maxSelection: 1,
        title: 'Select a saved plan to load',
        subtitle: 'Click one bubble, then load it.',
        confirmLabel: 'Load Selected',
        plans: plans
      });
      if (!picked || !picked.length) return;
      var selected = picked[0];

      var entry = plans[selected];
      var nextState = (entry && entry.state) ? JSON.parse(JSON.stringify(entry.state)) : {};
      suspendIncomingStateUntil = Date.now() + 2000;
      mirroredState = nextState;
      stateRevision += 1;
      try { localStorage.setItem('carePlanSplitState', JSON.stringify(nextState)); } catch (e) {}
      // Restore notes list on the parent page when loading a plan
      if (typeof restoreNoteRows === 'function') restoreNoteRows();
      syncFramesFromState();
      fitAll();
      showTopbarFlash('Loaded: ' + selected);
    }

    async function deleteNamedPlan() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        showTopbarFlash('No saved plans found.');
        return;
      }

      var picked = await showSavedPlanPicker(names, [], {
        maxSelection: names.length,
        title: 'Select plans to delete',
        subtitle: 'Select one or more plans to delete.',
        confirmLabel: 'Delete Selected',
        plans: plans
      });
      if (!picked || !picked.length) return;

      var confirmMsg = picked.length === 1
        ? 'Delete saved plan: ' + picked[0] + '?'
        : 'Delete ' + picked.length + ' saved plans?\n\n' + picked.join('\n');
      if (!(await showSimpleModal(confirmMsg, 'Delete', 'Cancel'))) return;

      var cloudEnabled = await shouldUseCloudPlans();
      for (var i = 0; i < picked.length; i++) {
        var selected = picked[i];
        if (cloudEnabled) {
          try {
            await window.carePlanCloudStorage.deletePlan(selected, getCloudUserId());
          } catch (error) {
            setStorageStatus('Cloud delete failed for "' + selected + '". Removing local copy only. ' + (error.message || String(error)), 'warn');
          }
        }
        delete plans[selected];
      }

      setLocalSavedPlans(plans);
      if (cloudEnabled) {
        setStorageStatus('Firebase cloud sync is on.', 'ok');
      }
      showTopbarFlash('Deleted ' + picked.length + ' plan' + (picked.length > 1 ? 's' : '') + '.');
    }


    (function initStorageMode() {
      enforceIframeNoScrollDefaults();
      // Remove legacy text-based user ID — only Firebase Auth is used now.
      try { localStorage.removeItem('carePlanCloudUserId'); } catch (e) {}

      var logoutBtn = document.getElementById('cloud-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
          clearCloudLogin();
        });
      }

      // Keep global fallback for existing inline onclick attributes.
      window.applyCloudLogin = applyCloudLogin;
      window.clearCloudLogin = clearCloudLogin;

      updateCloudLoginUi();
      // Always listen to Firebase auth state — fires on load with persisted user AND on sign-in/out
      var _authFired = false;
      try {
        if (window.firebase && window.firebase.auth) {
          window.firebase.auth().onAuthStateChanged(function(user) {
            _authFired = true;
            updateCloudLoginUi();
            if (user) {
              shouldUseCloudPlans().then(function(ready) {
                if (ready) { try { getSavedPlans(); } catch (e) {} }
              });
            } else {
              shouldUseCloudPlans();
            }
          });
        }
      } catch (e) {}
      // Fallback: if Firebase never fires onAuthStateChanged, clear Checking... after 4s
      setTimeout(function() {
        if (_authFired) return;
        updateCloudLoginUi();
        shouldUseCloudPlans();
      }, 4000);
      // Also listen via AnesthesiaAuth overlay for sign-ins triggered on this page
      if (window.AnesthesiaAuth) {
        window.AnesthesiaAuth.onAuthChange(function(user) {
          updateCloudLoginUi();
        });
      } else {
        if (!window.carePlanCloudStorage) {
          setStorageStatus('Plans you create and save will ONLY be available on this specific device UNLESS you log in', 'warn');
        }
      }
    })();

    // Expose internals needed by the phone-share feature
    // var mirroredState is already a non-configurable global var, so defineProperty
    // will throw if we try to change its configurable attribute. Suppress the error.
    try {
      Object.defineProperty(window, 'mirroredState', {
        get: function() { return mirroredState; },
        set: function(v) { mirroredState = v; },
        configurable: true
      });
    } catch(e) {}
    window.openPreview = function() { openPreview(); };
    window.buildPrintCard = function(state) { buildPrintCard(state || {}); };
    window.bulkImportCasesFromScreenshots = bulkImportCasesFromScreenshots;


