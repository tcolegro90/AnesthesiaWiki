// Extension auth: Email/Password sign-in for Firestore sync
(function() {
  console.log('Auth init: checking for Firebase config...');
  
  const cfg = window.TYPHON_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) {
    console.warn('No TYPHON_FIREBASE_CONFIG found');
    return;
  }

  // Initialize Firebase unconditionally — needed for ?sync=1 mode even with no UI elements
  let app;
  try {
    app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp({
      apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId,
      storageBucket: cfg.storageBucket, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId
    });
    console.log('Firebase initialized');
  } catch (e) {
    console.error('Firebase init failed:', e);
    return;
  }

  const auth = firebase.auth(app);
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => {
    console.warn('[auth] setPersistence failed:', e);
  });

  // --- pullCloudCasesToLocal must be defined before any onAuthStateChanged handlers ---
  async function pullCloudCasesToLocal(user) {
    try {
      const db = firebase.firestore(app);
      const col = cfg.collectionName || 'typhonCases';
      const snap = await db.collection(col).doc(user.uid).get();
      if (!snap.exists) {
        console.log('[auth] No cloud document yet for uid:', user.uid);
        return;
      }
      const cloudItems = snap.data()?.['typhon-items'];
      if (!Array.isArray(cloudItems)) {
        console.log('[auth] Cloud document has no typhon-items array');
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(resolve => chrome.storage.local.set({ 'typhon-items': cloudItems }, resolve));
        console.log(`[auth] Pulled ${cloudItems.length} cloud item(s) into chrome.storage`);
      }
    } catch (e) {
      console.error('[auth] Cloud pull failed:', e.code || e.message || e);
    }
  }

  // isSyncMode: opened by popup to refresh data — auto-close after sync
  const isSyncMode = new URLSearchParams(window.location.search).get('sync') === '1' || new URLSearchParams(window.location.search).get('gettoken') === '1';

  function syncLog(msg) { console.log('[sync]', msg); }
  function showSyncCloseBtn() {}

  const bar   = document.getElementById('ext-auth-bar');
  const label = document.getElementById('ext-auth-label');
  const reset = document.getElementById('ext-reset-btn');
  const btn   = document.getElementById('ext-auth-btn');
  const googleBtn = document.getElementById('ext-google-btn');

  if (!bar || !label || !reset || !btn) {
    console.error('Auth bar elements not found');
    return;
  }
  
  const extApi = (typeof browser !== 'undefined' && browser.tabs)
    ? browser
    : ((typeof chrome !== 'undefined' && chrome.tabs) ? chrome : null);
  let googlePollTimer = null;

  function setInlineStatus(message) {
    const createOverlayEl = document.getElementById('auth-create-modal-overlay');
    const createErrorEl = document.getElementById('auth-create-error');
    const signInErrorEl = document.getElementById('auth-error');
    const target = createOverlayEl && createOverlayEl.classList.contains('open') ? createErrorEl : signInErrorEl;
    if (target) target.textContent = message || '';
  }

  function stopGooglePoll() {
    if (googlePollTimer) {
      clearInterval(googlePollTimer);
      googlePollTimer = null;
    }
    if (googleBtn) googleBtn.disabled = false;
  }

  function tabsCreate(url) {
    if (!extApi || !extApi.tabs || !extApi.tabs.create) return Promise.reject(new Error('Extension tabs API unavailable'));
    if (extApi.tabs.create.length >= 2) {
      return new Promise((resolve, reject) => {
        extApi.tabs.create({ url, active: true }, (tab) => {
          const err = chrome?.runtime?.lastError;
          if (err) reject(err);
          else resolve(tab);
        });
      });
    }
    return extApi.tabs.create({ url, active: true });
  }

  function tabsGet(tabId) {
    if (!extApi || !extApi.tabs || !extApi.tabs.get) return Promise.reject(new Error('Extension tabs API unavailable'));
    if (extApi.tabs.get.length >= 2) {
      return new Promise((resolve, reject) => {
        extApi.tabs.get(tabId, (tab) => {
          const err = chrome?.runtime?.lastError;
          if (err) reject(err);
          else resolve(tab);
        });
      });
    }
    return extApi.tabs.get(tabId);
  }

  function tabsRemove(tabId) {
    if (!extApi || !extApi.tabs || !extApi.tabs.remove) return Promise.resolve();
    if (extApi.tabs.remove.length >= 2) {
      return new Promise(resolve => {
        extApi.tabs.remove(tabId, () => resolve());
      });
    }
    return extApi.tabs.remove(tabId).catch(() => {});
  }

  async function signInWithGoogleToken(idToken, accessToken) {
    const credential = firebase.auth.GoogleAuthProvider.credential(idToken || null, accessToken || null);
    const uc = await auth.signInWithCredential(credential);
    return uc.user;
  }

  function getGoogleBridgeUrl() {
    return cfg.googleAuthBridgeUrl || 'https://courtstatus.gear.host/Typhon%20Helper/TyphonCaseHelper.html?v=20260413b';
  }

  async function consumeBridgeHashFromTab(tabId) {
    try {
      const tab = await tabsGet(tabId);
      const url = tab?.url || '';
      if (!url.includes('googleAccessToken=') && !url.includes('googleAuthError=')) return false;

      const parsed = new URL(url);
      const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      const accessToken = hash.get('googleAccessToken');
      const idToken = hash.get('googleIdToken');
      const authError = hash.get('googleAuthError');

      stopGooglePoll();
      await tabsRemove(tabId);

      if (authError) {
        setInlineStatus(authError.replace(/^auth\//, '').replace(/-/g, ' '));
        return true;
      }
      if (!accessToken && !idToken) {
        setInlineStatus('Google sign-in finished but no token was returned.');
        return true;
      }

      setInlineStatus('Finishing Google sign-in...');
      const signedInUser = await signInWithGoogleToken(idToken, accessToken);
      setInlineStatus('');
      // Write credentials immediately using the returned user — don't rely on auth.currentUser
      try {
        const u = signedInUser || auth.currentUser;
        if (u && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const tok = await u.getIdToken(true);
          await new Promise(r => chrome.storage.local.set({
            'typhon-auth': { uid: u.uid, email: u.email || '', idToken: tok, tokenTs: Date.now(), refreshToken: u.refreshToken, expiresAt: Date.now() + 3600000 }
          }, r));
          // Pull cloud cases immediately
          await pullCloudCasesToLocal(u);
          // Show visible toast
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#0d6e6e;color:white;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
          toast.textContent = '✅ Signed in & synced: ' + (u.email || u.uid);
          document.body.appendChild(toast);
          if (label) label.textContent = '✅ Signed in & synced: ' + (u.email || u.uid);
        } else if (!u) {
          if (label) label.textContent = '⚠ Sign-in returned no user object';
        } else {
          if (label) label.textContent = '⚠ chrome.storage not available';
        }
      } catch (writeErr) {
        if (label) label.textContent = '⚠ Save failed: ' + (writeErr.message || writeErr);
      }
      return true;
    } catch (e) {
      if (/No tab with id|Invalid tab ID|tabs API unavailable/i.test(String(e && (e.message || e)))) {
        stopGooglePoll();
        setInlineStatus('Google sign-in tab was closed before completion.');
        return true;
      }
      return false;
    }
  }

  async function signInWithGoogleFlow() {
    if (!extApi || !extApi.tabs) {
      setInlineStatus('Google sign-in is unavailable in this browser context.');
      return;
    }
    stopGooglePoll();
    if (googleBtn) googleBtn.disabled = true;
    setInlineStatus('Opening Google sign-in...');

    try {
      const bridgeUrl = new URL(getGoogleBridgeUrl());
      bridgeUrl.searchParams.set('extGoogle', '1');
      bridgeUrl.searchParams.set('ts', String(Date.now()));
      const tab = await tabsCreate(bridgeUrl.toString());
      const tabId = tab && tab.id;
      if (typeof tabId !== 'number') throw new Error('Could not open Google sign-in tab');

      googlePollTimer = setInterval(() => {
        consumeBridgeHashFromTab(tabId).catch(() => {});
      }, 1000);
      setInlineStatus('Complete Google sign-in in the new tab. It will close automatically when done.');
    } catch (e) {
      stopGooglePoll();
      setInlineStatus(e?.message || 'Could not open Google sign-in');
    }
  }

  // Wire the landing screen Google button directly so it works before onAuthStateChanged fires
  const landingGoogleBtn = document.getElementById('auth-landing-google-btn');
  if (landingGoogleBtn) landingGoogleBtn.addEventListener('click', signInWithGoogleFlow);
  if (googleBtn) googleBtn.onclick = signInWithGoogleFlow;

  // Auto-trigger sign-in if opened from popup with ?signin=1
  if (new URLSearchParams(window.location.search).get('signin') === '1') {
    setTimeout(signInWithGoogleFlow, 400);
  }

  // Auto sign-in from popup-passed token (opened via "Open Full App" button)
  // Landing screen starts hidden (see app.html). Show it only if no stored auth found.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get('typhon-auth', function(data) {
      const stored = data['typhon-auth'];
      if (stored && stored.uid && (stored.idToken || stored.refreshToken) && !auth.currentUser) {
        // Stay hidden — user is already authenticated via the popup/extension
        // Update the auth bar to show signed-in state
        if (bar) bar.classList.add('signed-in');
        if (label) label.textContent = '✅ Syncing as ' + (stored.email || stored.uid);
        if (reset) reset.style.display = 'none';
        if (btn) {
          btn.textContent = 'Sign out';
          btn.onclick = () => {
            chrome.storage.local.remove('typhon-auth');
            auth.signOut();
            if (landingScreen) landingScreen.classList.remove('hidden');
          };
        }
        if (googleBtn) googleBtn.style.display = 'none';
        // Refresh token silently in the background
        (async () => {
          try {
            const FIREBASE_API_KEY = cfg.apiKey;
            if (stored.refreshToken) {
              const r = await fetch(
                `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(stored.refreshToken)
                }
              );
              if (r.ok) {
                const t = await r.json();
                chrome.storage.local.set({ 'typhon-auth': Object.assign({}, stored, {
                  idToken: t.id_token, refreshToken: t.refresh_token || stored.refreshToken, tokenTs: Date.now(), expiresAt: Date.now() + 3600000
                }) });
              }
            }
          } catch (e) {
            console.warn('[auth] background token refresh failed:', e.message);
          }
        })();
      } else {
        // No valid stored auth — show the landing screen
        const ls = document.getElementById('auth-landing-screen');
        if (ls) ls.classList.remove('hidden');
      }
    });
  } else {
    // No chrome.storage available — show the landing screen
    const ls = document.getElementById('auth-landing-screen');
    if (ls) ls.classList.remove('hidden');
  }




  // --- Modal helpers ---
  const landingScreen = document.getElementById('auth-landing-screen');
  const loginLandingBtn = document.getElementById('auth-landing-login');
  const createLandingBtn = document.getElementById('auth-landing-create');

  const signInOverlay = document.getElementById('auth-modal-overlay');
  const signInModal = document.getElementById('auth-modal');
  const signInTitle = document.getElementById('auth-modal-title');
  const signInSub = document.getElementById('auth-modal-sub');
  const signInEmailField = document.getElementById('auth-email-field');
  const signInPwField = document.getElementById('auth-password-field');
  const signInEmailInput = document.getElementById('auth-email-input');
  const signInPwInput = document.getElementById('auth-password-input');
  const signInError = document.getElementById('auth-error');
  const signInSubmitBtn = document.getElementById('auth-submit-btn');
  const signInForgotBtn = document.getElementById('auth-forgot-btn');
  const signInGoogleBtn = document.getElementById('auth-google-btn');
  const signInBackBtn = document.getElementById('auth-back-btn');

  const createOverlay = document.getElementById('auth-create-modal-overlay');
  const createModal = document.getElementById('auth-create-modal');
  const createEmailInput = document.getElementById('auth-create-email-input');
  const createPwInput = document.getElementById('auth-create-password-input');
  const createError = document.getElementById('auth-create-error');
  const createSubmitBtn = document.getElementById('auth-create-submit-btn');
  const createGoogleBtn = document.getElementById('auth-create-google-btn');
  const createBackBtn = document.getElementById('auth-create-back-btn');

  function showLandingScreen() {
    landingScreen.classList.remove('hidden');
    signInOverlay.classList.remove('open');
    createOverlay.classList.remove('open');
  }

  function hideLandingScreen() {
    landingScreen.classList.add('hidden');
  }

  function openSignInModal() {
    hideLandingScreen();
    signInError.textContent = '';
    signInEmailInput.value = '';
    signInPwInput.value = '';
    signInOverlay.classList.add('open');
    setTimeout(() => signInEmailInput.focus(), 80);
  }

  function closeSignInModal() {
    signInOverlay.classList.remove('open');
    showLandingScreen();
  }

  function openCreateAccountModal() {
    hideLandingScreen();
    createError.textContent = '';
    createEmailInput.value = '';
    createPwInput.value = '';
    createOverlay.classList.add('open');
    setTimeout(() => createEmailInput.focus(), 80);
  }

  function closeCreateAccountModal() {
    createOverlay.classList.remove('open');
    showLandingScreen();
  }

  function openResetModal() {
    closeSignInModal();
    signInTitle.textContent = 'Reset Password';
    signInSub.textContent = 'Enter your email to receive a reset link.';
    signInPwField.style.display = 'none';
    signInSubmitBtn.textContent = 'Send Reset Email';
    signInGoogleBtn.style.display = 'none';
    signInForgotBtn.style.display = 'none';
    signInBackBtn.style.display = '';
    signInError.textContent = '';
    signInEmailInput.value = '';
    signInPwInput.value = '';
    signInOverlay.classList.add('open');
    setTimeout(() => signInEmailInput.focus(), 80);
  }

  function showSignInForm() {
    signInTitle.textContent = 'Sign In';
    signInSub.textContent = 'Enter your email and password to sync cases across devices.';
    signInPwField.style.display = '';
    signInSubmitBtn.textContent = 'Sign In';
    signInGoogleBtn.style.display = '';
    signInForgotBtn.style.display = '';
    signInBackBtn.style.display = '';
    signInError.textContent = '';
  }

  // Landing page button handlers
  loginLandingBtn.onclick = openSignInModal;
  createLandingBtn.onclick = openCreateAccountModal;

  // Sign-in modal handlers
  signInBackBtn.onclick = () => {
    if (signInTitle.textContent === 'Reset Password') {
      showSignInForm();
    } else {
      closeSignInModal();
    }
  };
  signInOverlay.addEventListener('click', e => {
    if (e.target === signInOverlay && signInTitle.textContent !== 'Reset Password') closeSignInModal();
  });

  signInSubmitBtn.onclick = async () => {
    const email = signInEmailInput.value.trim();
    if (!email) { signInError.textContent = 'Please enter your email.'; return; }
    signInError.textContent = '';
    signInSubmitBtn.disabled = true;

    // Reset password mode
    if (signInTitle.textContent === 'Reset Password') {
      try {
        await auth.sendPasswordResetEmail(email);
        signInError.textContent = 'Reset email sent! Check your inbox.';
        signInSubmitBtn.disabled = false;
      } catch (e) {
        signInError.textContent = e.message || 'Could not send reset email.';
        signInSubmitBtn.disabled = false;
      }
      return;
    }

    // Sign-in mode
    const password = signInPwInput.value;
    if (!password) { signInError.textContent = 'Please enter your password.'; signInSubmitBtn.disabled = false; return; }
    try {
      await auth.signInWithEmailAndPassword(email, password);
      signInSubmitBtn.disabled = false;
      // Auth state change handler will hide the modal and show welcome/app
    } catch (e) {
      signInError.textContent = e.message || 'Sign-in failed. Check your email and password.';
      signInSubmitBtn.disabled = false;
    }
  };

  signInForgotBtn.onclick = () => openResetModal();
  signInGoogleBtn.onclick = signInWithGoogleFlow;

  document.getElementById('auth-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') signInSubmitBtn.click();
  });

  // Create account modal handlers
  createBackBtn.onclick = closeCreateAccountModal;
  createOverlay.addEventListener('click', e => {
    if (e.target === createOverlay) closeCreateAccountModal();
  });

  createSubmitBtn.onclick = async () => {
    const email = createEmailInput.value.trim();
    if (!email) { createError.textContent = 'Please enter your email.'; return; }
    const password = createPwInput.value;
    if (!password || password.length < 6) {
      createError.textContent = 'Password must be at least 6 characters.';
      return;
    }
    createError.textContent = '';
    createSubmitBtn.disabled = true;

    try {
      await auth.createUserWithEmailAndPassword(email, password);
      createSubmitBtn.disabled = false;
      // Auth state change handler will hide the modal and show welcome/app
    } catch (createErr) {
      createError.textContent = createErr.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Try signing in.'
        : (createErr.message || 'Could not create account.');
      createSubmitBtn.disabled = false;
    }
  };

  createGoogleBtn.onclick = signInWithGoogleFlow;

  document.getElementById('auth-create-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') createSubmitBtn.click();
  });

  function emitAuthChanged() {
    window.dispatchEvent(new Event('typhon-auth-changed'));
  }

  auth.onAuthStateChanged(async user => {
    syncLog('onAuthStateChanged fired: ' + (user ? 'user=' + (user.email || user.uid) : 'null (session loading or signed out)'), user ? '#7fff7f' : '#ffee77');
    if (user) {
      bar.classList.add('signed-in');
      landingScreen.classList.add('hidden');
      signInOverlay.classList.remove('open');
      createOverlay.classList.remove('open');
      const who = user.email || user.uid;
      label.textContent = isSyncMode ? '✅ Signed in — syncing...' : '✅ Syncing as ' + who;
      reset.style.display = 'none';
      btn.textContent = 'Sign out';
      if (googleBtn) googleBtn.style.display = 'none';
      reset.onclick = null;
      btn.onclick = () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove('typhon-auth');
        }
        auth.signOut();
      };

      // --- Write ID token to storage ---
      syncLog('Calling user.getIdToken()...', '#aaf');
      const chromeStorageOk = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
      syncLog('chrome.storage.local available: ' + chromeStorageOk, chromeStorageOk ? '#7fff7f' : '#f77');
      if (chromeStorageOk) {
        try {
          const idToken = await user.getIdToken(true);
          syncLog('Got ID token (' + idToken.length + ' chars)', '#7fff7f');
          await new Promise(resolve => {
            chrome.storage.local.set(
              { 'typhon-auth': { uid: user.uid, email: user.email || '', idToken, tokenTs: Date.now(), refreshToken: user.refreshToken, expiresAt: Date.now() + 3600000 } },
              () => {
                if (chrome.runtime.lastError) {
                  syncLog('❌ Storage write failed: ' + chrome.runtime.lastError.message, '#f77');
                } else {
                  syncLog('✅ typhon-auth written to chrome.storage.local', '#7fff7f');
                }
                resolve();
              }
            );
          });
          // Verify the write
          await new Promise(resolve => {
            chrome.storage.local.get('typhon-auth', data => {
              const saved = data['typhon-auth'];
              syncLog('Verify read back: ' + (saved ? 'uid=' + saved.uid + ' tokenLen=' + (saved.idToken || '').length : 'NOT FOUND'), saved ? '#7fff7f' : '#f77');
              resolve();
            });
          });
        } catch (e) {
          syncLog('❌ getIdToken/write error: ' + (e.message || e), '#f77');
        }
      }

      // --- Pull cloud cases ---
      syncLog('Pulling Firestore cases...', '#aaf');
      try {
        await pullCloudCasesToLocal(user);
        syncLog('✅ Cloud pull complete', '#7fff7f');
      } catch (e) {
        syncLog('⚠ Cloud pull error: ' + (e.message || e), '#ff9');
      }
      emitAuthChanged();

      // --- Close tab ---
      if (isSyncMode) {
        label.textContent = '✅ Synced!';
        syncLog('Attempting chrome.tabs.getCurrent to close tab...', '#aaf');
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
          chrome.tabs.getCurrent(tab => {
            syncLog('getCurrent result: ' + JSON.stringify(tab ? { id: tab.id, url: tab.url } : null), '#aaf');
            if (tab && tab.id) {
              syncLog('Calling chrome.tabs.remove(' + tab.id + ')...', '#aaf');
              chrome.tabs.remove(tab.id, () => {
                if (chrome.runtime.lastError) {
                  syncLog('❌ tabs.remove failed: ' + chrome.runtime.lastError.message + ' — showing manual close button', '#f77');
                  showSyncCloseBtn();
                } else {
                  syncLog('✅ Tab removed', '#7fff7f');
                }
              });
            } else {
              syncLog('No tab id — trying window.close()', '#ff9');
              showSyncCloseBtn();
              window.close();
            }
          });
        } else {
          syncLog('chrome.tabs.getCurrent not available — showing manual close button', '#f77');
          showSyncCloseBtn();
        }
      }
    } else {
      syncLog('null fire — NOT removing typhon-auth (may be transient while Firebase loads from IndexedDB)', '#ffee77');
      bar.classList.remove('signed-in');
      // Only show landing screen if no valid stored auth (otherwise the ext-auth check handles it)
      const chromeAuthOk = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
      if (!chromeAuthOk) {
        landingScreen.classList.remove('hidden');
      } else {
        chrome.storage.local.get('typhon-auth', function(d) {
          const s = d['typhon-auth'];
          if (!s || !s.uid || (!s.idToken && !s.refreshToken)) {
            landingScreen.classList.remove('hidden');
          }
        });
      }
      signInOverlay.classList.remove('open');
      createOverlay.classList.remove('open');
      label.textContent = '☁️ Sign in to sync with phone';
      reset.style.display = '';
      btn.textContent = 'Email';
      if (googleBtn) googleBtn.style.display = '';
      reset.onclick = () => openSignInModal();
      btn.onclick = () => openSignInModal();
      if (googleBtn) googleBtn.onclick = signInWithGoogleFlow;
      // Only remove on explicit sign-out (handled by signOut() call above)
      emitAuthChanged();
      if (isSyncMode) showSyncCloseBtn();
    }
  });
})();
