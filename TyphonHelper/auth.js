// Extension auth: Email/Password sign-in for Firestore sync
(function() {
  console.log('Auth init: checking for Firebase config...');
  
  const cfg = window.TYPHON_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) {
    console.warn('No TYPHON_FIREBASE_CONFIG found');
    return;
  }
  
  const bar   = document.getElementById('ext-auth-bar');
  const label = document.getElementById('ext-auth-label');
  const reset = document.getElementById('ext-reset-btn');
  const btn   = document.getElementById('ext-auth-btn');
  const googleBtn = document.getElementById('ext-google-btn');
  const expectedAuthIds = [
    'ext-auth-bar',
    'ext-auth-label',
    'ext-reset-btn',
    'ext-auth-btn',
    'ext-google-btn',
    'auth-modal-overlay',
    'auth-modal',
    'auth-email-input',
    'auth-password-input',
    'auth-submit-btn',
    'auth-cancel-btn',
    'auth-forgot-btn',
    'auth-google-btn'
  ];
  const missingAuthIds = expectedAuthIds.filter(id => !document.getElementById(id));
  if (missingAuthIds.length) {
    console.warn('[auth] Missing expected auth control id(s):', missingAuthIds.join(', '));
  }
  
  if (!bar || !label || !reset || !btn) {
    console.error('Auth bar elements not found');
    return;
  }
  
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
  const extApi = (typeof browser !== 'undefined' && browser.tabs)
    ? browser
    : ((typeof chrome !== 'undefined' && chrome.tabs) ? chrome : null);
  let googlePollTimer = null;

  function setInlineStatus(message) {
    if (errDiv) errDiv.textContent = message || '';
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
    await auth.signInWithCredential(credential);
  }

  function getGoogleBridgeUrl() {
    return cfg.googleAuthBridgeUrl || 'https://courtstatus.gear.host/Typhon/TyphonCaseHelper.html?v=20260413b';
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
      await signInWithGoogleToken(idToken, accessToken);
      setInlineStatus('');
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

  // --- Modal helpers ---
  const overlay   = document.getElementById('auth-modal-overlay');
  const modalTitle = document.getElementById('auth-modal-title');
  const modalSub   = document.getElementById('auth-modal-sub');
  const emailField = document.getElementById('auth-email-field');
  const pwField    = document.getElementById('auth-password-field');
  const emailInput = document.getElementById('auth-email-input');
  const pwInput    = document.getElementById('auth-password-input');
  const errDiv     = document.getElementById('auth-error');
  const submitBtn  = document.getElementById('auth-submit-btn');
  const cancelBtn  = document.getElementById('auth-cancel-btn');
  const forgotBtn  = document.getElementById('auth-forgot-btn');
  const authGoogleBtn = document.getElementById('auth-google-btn');

  function openModal(mode) {
    // mode: 'signin' | 'reset'
    errDiv.textContent = '';
    emailInput.value = '';
    pwInput.value = '';
    if (mode === 'reset') {
      modalTitle.textContent = 'Reset Password';
      modalSub.textContent = 'Enter your email to receive a reset link.';
      pwField.style.display = 'none';
      submitBtn.textContent = 'Send Reset Email';
      forgotBtn.style.display = 'none';
    } else {
      modalTitle.textContent = 'Sign In';
      modalSub.textContent = 'Sign in to sync cases across devices.';
      pwField.style.display = '';
      submitBtn.textContent = 'Sign In';
      forgotBtn.style.display = '';
    }
    overlay.classList.add('open');
    setTimeout(() => emailInput.focus(), 80);

    // Return a promise that resolves when modal closes
    return new Promise(resolve => {
      overlay._resolve = resolve;
      overlay._mode = mode;
    });
  }

  function closeModal(result) {
    overlay.classList.remove('open');
    if (typeof overlay._resolve === 'function') {
      overlay._resolve(result);
      overlay._resolve = null;
    }
  }

  cancelBtn.onclick = () => closeModal(null);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(null); });

  submitBtn.onclick = async () => {
    const email = emailInput.value.trim();
    if (!email) { errDiv.textContent = 'Please enter your email.'; return; }
    errDiv.textContent = '';
    submitBtn.disabled = true;

    if (overlay._mode === 'reset') {
      try {
        await auth.sendPasswordResetEmail(email);
        closeModal('reset-sent');
      } catch (e) {
        errDiv.textContent = e.message || 'Could not send reset email.';
      } finally { submitBtn.disabled = false; }
      return;
    }

    // Sign-in mode
    const password = pwInput.value;
    if (!password) { errDiv.textContent = 'Please enter your password.'; submitBtn.disabled = false; return; }
    try {
      await auth.signInWithEmailAndPassword(email, password);
      closeModal('signed-in');
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        errDiv.textContent = 'No account found. Creating one…';
        try {
          await auth.createUserWithEmailAndPassword(email, password);
          closeModal('created');
        } catch (createErr) {
          errDiv.textContent = createErr.message || 'Create account failed.';
        }
      } else {
        errDiv.textContent = e.message || 'Sign-in failed.';
      }
      submitBtn.disabled = false;
    }
  };

  // Allow Enter key to submit
  document.getElementById('auth-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitBtn.click();
  });

  forgotBtn.onclick = () => { closeModal(null); openModal('reset'); };

  async function resetPasswordFlow() {
    await openModal('reset');
  }

  async function signInWithEmailFlow() {
    await openModal('signin');
  }

  function emitAuthChanged() {
    window.dispatchEvent(new Event('typhon-auth-changed'));
  }

  auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? 'signed in' : 'signed out');
    if (user) {
      bar.classList.add('signed-in');
      const who = user.email || user.uid;
      const shortUid = user.uid ? ` [${user.uid.slice(0, 8)}]` : '';
      label.textContent = '✅ Syncing as ' + who + shortUid;
      reset.style.display = 'none';
      btn.textContent = 'Sign out';
      if (googleBtn) googleBtn.style.display = 'none';
      if (authGoogleBtn) authGoogleBtn.style.display = 'none';
      reset.onclick = null;
      btn.onclick = () => auth.signOut();
      pullCloudCasesToLocal(user).finally(emitAuthChanged);
    } else {
      bar.classList.remove('signed-in');
      label.textContent = '☁️ Sign in to sync with phone';
      reset.style.display = '';
      btn.textContent = 'Email';
      if (googleBtn) googleBtn.style.display = '';
      if (authGoogleBtn) authGoogleBtn.style.display = '';
      reset.onclick = resetPasswordFlow;
      btn.onclick = signInWithEmailFlow;
      if (googleBtn) googleBtn.onclick = signInWithGoogleFlow;
      if (authGoogleBtn) authGoogleBtn.onclick = signInWithGoogleFlow;
      emitAuthChanged();
    }
  });
})();
