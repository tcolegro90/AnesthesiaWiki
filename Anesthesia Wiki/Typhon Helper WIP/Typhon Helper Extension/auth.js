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
    'auth-landing-screen',
    'auth-landing-login',
    'auth-landing-create',
    'auth-modal-overlay',
    'auth-modal',
    'auth-email-input',
    'auth-password-input',
    'auth-submit-btn',
    'auth-forgot-btn',
    'auth-google-btn',
    'auth-back-btn',
    'auth-create-modal-overlay',
    'auth-create-modal',
    'auth-create-email-input',
    'auth-create-password-input',
    'auth-create-submit-btn',
    'auth-create-google-btn',
    'auth-create-back-btn',
    'auth-error',
    'auth-create-error'
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
    await auth.signInWithCredential(credential);
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

  auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? 'signed in' : 'signed out');
    if (user) {
      bar.classList.add('signed-in');
      landingScreen.classList.add('hidden');
      signInOverlay.classList.remove('open');
      createOverlay.classList.remove('open');
      const who = user.email || user.uid;
      label.textContent = '✅ Syncing as ' + who;
      reset.style.display = 'none';
      btn.textContent = 'Sign out';
      if (googleBtn) googleBtn.style.display = 'none';
      reset.onclick = null;
      btn.onclick = () => auth.signOut();
      pullCloudCasesToLocal(user).finally(emitAuthChanged);
    } else {
      bar.classList.remove('signed-in');
      landingScreen.classList.remove('hidden');
      signInOverlay.classList.remove('open');
      createOverlay.classList.remove('open');
      label.textContent = '☁️ Sign in to sync with phone';
      reset.style.display = '';
      btn.textContent = 'Email';
      if (googleBtn) googleBtn.style.display = '';
      reset.onclick = () => openSignInModal();
      btn.onclick = () => openSignInModal();
      if (googleBtn) googleBtn.onclick = signInWithGoogleFlow;
      emitAuthChanged();
    }
  });
})();
