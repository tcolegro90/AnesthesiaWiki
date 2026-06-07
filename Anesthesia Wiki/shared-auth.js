/**
 * shared-auth.js
 * Google-only Firebase Auth for the Anesthesia Clinical Tools wiki.
 * Drop this after firebase-app-compat.js + firebase-auth-compat.js.
 *
 * Exposes window.AnesthesiaAuth:
 *   requireAuth(onAuthed)   - ensure user is signed in; triggers Google popup if not.
 *   getUser()               - current Firebase user or null.
 *   signOut()               - sign the user out.
 *   onAuthChange(callback)  - subscribe to auth state changes.
 *   showLogin()             - trigger Google sign-in popup directly.
 */
window.__sharedAuthStart = true;
(function (global) {
  'use strict';

  // ── Firebase config (same project used by Care Plan, Typhon, Clinical Sites)
  var FIREBASE_CONFIG = {
    apiKey:            'AIzaSyACNII9-q3CoAipRpMTxwE6WLPOQVbbY-E',
    authDomain:        'anesthesia-wiki-saved-files.firebaseapp.com',
    projectId:         'anesthesia-wiki-saved-files',
    storageBucket:     'anesthesia-wiki-saved-files.firebasestorage.app',
    messagingSenderId: '493278937716',
    appId:             '1:493278937716:web:6d4055acbb6f5745810721'
  };

  // ── Internal state
  var _auth             = null;
  var _user             = null;
  var _authReady        = false;
  var _pendingCallbacks = [];
  var _changeListeners  = [];

  // ───────────────────────────────────────────────────────────────
  // Firebase init
  // ───────────────────────────────────────────────────────────────
  function getOrCreateApp() {
    if (!global.firebase) return null;
    if (global.firebase.apps && global.firebase.apps.length) return global.firebase.apps[0];
    try { return global.firebase.initializeApp(FIREBASE_CONFIG); } catch (e) { return null; }
  }

  function tryInitAuth() {
    if (_auth) return true;
    var app = getOrCreateApp();
    if (!app || !global.firebase.auth) return false;
    _auth = global.firebase.auth(app);
    _auth.onAuthStateChanged(handleAuthChange);
    return true;
  }

  function ensureInit() {
    if (!tryInitAuth()) {
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        if (tryInitAuth() || attempts > 80) clearInterval(poll);
      }, 100);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Auth state handler
  // ───────────────────────────────────────────────────────────────
  function handleAuthChange(user) {
    _user      = user;
    _authReady = true;

    // Auto-register new users in userRoles so they appear in the admin panel
    if (user && user.email && global.firebase && global.firebase.firestore) {
      try {
        var _rdb = global.firebase.firestore();
        _rdb.collection('userRoles').doc(user.email).get().then(function (doc) {
          if (!doc.exists) {
            _rdb.collection('userRoles').doc(user.email).set({
              role: 'non-student',
              displayName: user.displayName || '',
              registeredAt: new Date().toISOString()
            }).catch(function () {});
          }
        }).catch(function () {});
      } catch (e) {}
    }

    if (user) {
      var cbs = _pendingCallbacks.slice();
      _pendingCallbacks = [];
      cbs.forEach(function (cb) { try { cb(user); } catch (e) {} });
    } else {
      if (_pendingCallbacks.length > 0) doGoogleSignIn();
    }

    _changeListeners.forEach(function (cb) { try { cb(user); } catch (e) {} });
  }

  // ───────────────────────────────────────────────────────────────
  // Google sign-in
  // ───────────────────────────────────────────────────────────────
  function doGoogleSignIn() {
    if (!_auth) { ensureInit(); return; }
    var provider = new global.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    _auth.signInWithPopup(provider).catch(function (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert(e.message || 'Google sign-in failed. Ensure pop-ups are allowed for this site.');
      }
    });
  }

  // ───────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────
  global.AnesthesiaAuth = {
    requireAuth: function (onAuthed) {
      ensureInit();
      if (_authReady && _user) {
        try { onAuthed(_user); } catch (e) {}
        return;
      }
      _pendingCallbacks.push(onAuthed);
      if (_authReady && !_user) doGoogleSignIn();
    },

    getUser: function () { return _user; },

    signOut: function () {
      return _auth ? _auth.signOut() : Promise.resolve();
    },

    onAuthChange: function (callback) {
      _changeListeners.push(callback);
      if (_authReady) { try { callback(_user); } catch (e) {} }
    },

    showLogin: function () {
      ensureInit();
      doGoogleSignIn();
    }
  };

  // Auto-initialise once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInit);
  } else {
    ensureInit();
  }
})(window);
