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

      // Clear the notes textarea on the parent page
      var notesEl = document.getElementById('notes-freetext');
      if (notesEl) notesEl.value = '';

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

    var MAX_SAVED_PLANS = 200;

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

    async function saveNamedPlan() {
      // Iframes auto-save via their own event listeners
      // No need to actively call saveState (causes CORS errors)

      var s = (mirroredState && Object.keys(mirroredState).length) ? mirroredState : getState();
      var _nameParts = [
        s['pat-initials'] || 'Patient',
        s['pat-surg-date'] || 'NoDate',
        s['pat-sched-surg-time'] || 'NoTime'
      ];
      if (s['pat-surg-end-time']) _nameParts.push(s['pat-surg-end-time']);
      _nameParts.push(s['pat-surgery'] || 'NoSurgery');
      var defaultName = _nameParts.join(' | ');
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
        showTopbarFlash('Saved to cloud: ' + name);
      } else if (cloudEnabled) {
        showTopbarFlash('Saved locally: ' + name + ' (cloud not confirmed)');
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
      // Restore notes textarea on the parent page when loading a plan
      var notesEl = document.getElementById('notes-freetext');
      if (notesEl) notesEl.value = nextState['notes-freetext'] || '';
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


