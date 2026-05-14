    var mirroredState = {};
    var isDirty = false;
    var stateRevision = 0;
    // Suppress dirty flag during initial iframe boot-up state echo (first 4 seconds)
    var suspendIncomingStateUntil = Date.now() + 4000;
    var previewMode = 'single';
    var multiPreviewSelectedNames = [];
    var draftSyncTimer = null;
    var lastDraftSyncWarningAt = 0;
    // Snapshot localStorage at session start so we can detect user changes before cloud draft restore.
    var sessionStartStateJson = '';
    try { sessionStartStateJson = localStorage.getItem('carePlanSplitState') || ''; } catch (e) {}
    // DIAGNOSTIC: mark that combined.js loaded successfully
    window.__combinedJsLoaded = true;

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
        mirroredState.__draftSavedAt = now;
        try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e) {}
        var stateToSync = getState();
        cs.saveDraft(stateToSync, userId, getDeviceId()).catch(function(error) {
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
        isDirty = true;
        stateRevision += 1;
        try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e2) {}
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

    function clearAllData() {
      if (!confirm('Clear all currently entered data on this page? (Saved plans are kept)')) return;
      try {
        // Clear only current in-progress state in Combined page context.
        localStorage.removeItem('carePlanSplitState');
      } catch (e) {}

      // Ignore late state pushes from old iframe instances while reset reloads occur.
      suspendIncomingStateUntil = Date.now() + 3000;

      // Clear parent-side mirrored snapshot so children cannot rehydrate stale values.
      mirroredState = {};
      stateRevision += 1;
      isDirty = false;

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

    var MAX_SAVED_PLANS = 20;

    function getSavedPlanNamesSorted(plans) {
      plans = plans || {};
      return Object.keys(plans).sort(function(a, b) {
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
      try {
        var draft = await window.carePlanCloudStorage.loadDraft(userId);
        if (!draft || !draft.savedAt) return;

        var cloudTime = new Date(draft.savedAt).getTime();
        if (isNaN(cloudTime)) return;

        // Don't clobber data the user has typed in this session — even if it happened
        // during the 4-second boot suppression window before isDirty gets set.
        if (isDirty) return;
        var currentLocalJson = '';
        try { currentLocalJson = localStorage.getItem('carePlanSplitState') || ''; } catch (e) {}
        if (currentLocalJson !== sessionStartStateJson) return;

        // Compare to local state timestamp if available, else use 0.
        var localRaw = currentLocalJson;
        var localState = {};
        try { localState = JSON.parse(localRaw) || {}; } catch (e) {}
        var localTime = 0;
        if (localState.__draftSavedAt) {
          localTime = new Date(localState.__draftSavedAt).getTime() || 0;
        }

        if (cloudTime > localTime + 10000) {
          // Cloud draft is meaningfully newer — restore it.
          var nextState = draft.state || {};
          suspendIncomingStateUntil = Date.now() + 2000;
          mirroredState = Object.assign({}, nextState);
          stateRevision += 1;
          try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e) {}
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
        }
      } catch (e) {}
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
      var defaultName = [
        s['pat-initials'] || 'Patient',
        s['pat-surg-date'] || 'NoDate',
        s['pat-sched-surg-time'] || 'NoTime',
        s['pat-surgery'] || 'NoSurgery'
      ].join(' | ');
      var name = prompt('Save plan as:', defaultName);
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
        alert('You can save up to ' + MAX_SAVED_PLANS + ' plans. Delete one or overwrite an existing name.');
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
      isDirty = false;
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
        alert('No saved plans found.');
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
      isDirty = false;
      showTopbarFlash('Loaded: ' + selected);
    }

    async function deleteNamedPlan() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        alert('No saved plans found.');
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
      if (!confirm(confirmMsg)) return;

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
      alert('Deleted ' + picked.length + ' plan' + (picked.length > 1 ? 's' : '') + '.');
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
    Object.defineProperty(window, 'mirroredState', {
      get: function() { return mirroredState; },
      set: function(v) { mirroredState = v; },
      configurable: true
    });
    window.openPreview = function() { openPreview(); };
    window.buildPrintCard = function(state) { buildPrintCard(state || {}); };
