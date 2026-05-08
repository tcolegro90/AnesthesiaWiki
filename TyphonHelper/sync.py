#!/usr/bin/env python3
"""
Sync TyphonHelper source files → Anesthesia Wiki/Typhon/

Usage (from project root or TyphonHelper/):
    python3 TyphonHelper/sync.py

What it does:
  - Copies TyphonHelper/app.js  → Anesthesia Wiki/Typhon/app.js
  - Copies TyphonHelper/typhon-firebase.js → Anesthesia Wiki/Typhon/typhon-firebase.js
  - Copies TyphonHelper/app.html → Anesthesia Wiki/Typhon/TyphonCaseHelper.html
    with the following injected for the hosted (web) version:
      • Firebase Auth CSS + sign-in screen HTML (replaces extension auth bar)
      • Hosted auth gate script (onAuthStateChanged)
      • Email/Password sign-in script (onAuthStateChanged gate)
"""

import os, shutil, re

base      = os.path.dirname(os.path.abspath(__file__))
root      = os.path.dirname(base)
src_html  = os.path.join(base, 'app.html')
src_js    = os.path.join(base, 'app.js')
src_cfg   = os.path.join(base, 'typhon-firebase.js')
dst_html  = os.path.join(root, 'Anesthesia Wiki', 'Typhon', 'TyphonCaseHelper.html')
dst_js    = os.path.join(root, 'Anesthesia Wiki', 'Typhon', 'app.js')
dst_cfg   = os.path.join(root, 'Anesthesia Wiki', 'Typhon', 'typhon-firebase.js')

# ── CSS to inject before </style> ─────────────────────────────────────────────
AUTH_CSS = """
  /* EMAIL/PASSWORD SIGN-IN SCREEN */
  #auth-screen {
    position: fixed; inset: 0; background: linear-gradient(135deg, #0d6e6e, #1e4a3e);
    z-index: 99999; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #auth-screen.hidden { display: none; }
  .auth-box {
    background: white; border-radius: 20px; padding: 36px 30px; width: 320px;
    max-width: 90vw; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }
  .auth-icon { font-size: 2.8em; margin-bottom: 10px; }
  .auth-title { font-size: 1.15em; font-weight: 700; color: #2c3e50; margin-bottom: 4px; }
  .auth-sub { font-size: 0.82em; color: #7f8c8d; margin-bottom: 12px; }
  .auth-input {
    width: 100%; padding: 12px 12px; border: 2px solid #dde3ec; border-radius: 10px;
    font-size: 0.92em; margin-bottom: 10px; box-sizing: border-box;
  }
  .auth-input:focus { border-color: #0d6e6e; outline: none; }
  .auth-btn {
    width: 100%; padding: 12px 16px; background: white; border: 2px solid #dde3ec;
    border-radius: 10px; font-size: 0.95em; font-weight: 600; color: #2c3e50;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s; box-sizing: border-box;
    margin-top: 8px;
  }
  .auth-btn:hover { border-color: #0d6e6e; box-shadow: 0 4px 14px rgba(13,110,110,0.25); }
  .auth-error { color: #e74c3c; font-size: 0.83em; margin-top: 12px; min-height: 18px; font-weight: 600; }
  #auth-user-bar {
    display: none; align-items: center; justify-content: space-between;
    gap: 8px; padding: 5px 14px; background: rgba(0,0,0,0.12); font-size: 0.75em;
    color: rgba(255,255,255,0.9); font-weight: 600;
  }
  .auth-signout-btn {
    padding: 3px 10px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px; color: white; font-size: 0.75em; font-weight: 600; cursor: pointer;
  }
"""

# ── HTML to inject after <body> ────────────────────────────────────────────────
AUTH_HTML = """
<div id="auth-screen">
  <div class="auth-box">
    <div class="auth-icon">📋</div>
    <div class="auth-title">Typhon Case Helper</div>
    <div class="auth-sub">Sign in with your email and password</div>
    <input id="auth-email" class="auth-input" type="email" placeholder="Email" autocomplete="username">
    <input id="auth-password" class="auth-input" type="password" placeholder="Password" autocomplete="current-password">
    <button id="auth-signin-btn" class="auth-btn">Sign In</button>
    <button id="auth-google-btn" class="auth-btn">Sign In with Google</button>
    <button id="auth-create-btn" class="auth-btn">Create Account</button>
    <button id="auth-reset-btn" class="auth-btn">Reset Password</button>
    <div id="auth-error" class="auth-error"></div>
  </div>
</div>
"""

# The extension source has an ext-auth-bar div after the header — replace it
# with a web-style user bar for the hosted version.
AUTH_USER_BAR = """<div id="auth-user-bar">
  <span id="auth-user-name"></span>
  <button class="auth-signout-btn" id="auth-signout-btn">Sign out</button>
</div>"""

AUTH_SCRIPT = """
  <script>
    (function() {
      const cfg = window.TYPHON_FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey) return;
      let app;
      if (firebase.apps && firebase.apps.length) {
        app = firebase.apps[0];
      } else {
        app = firebase.initializeApp({
          apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId,
          storageBucket: cfg.storageBucket, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId
        });
      }
      const authScreen = document.getElementById('auth-screen');
      const userBar    = document.getElementById('auth-user-bar');
      const userNameEl = document.getElementById('auth-user-name');
      const errEl      = document.getElementById('auth-error');
      const emailEl    = document.getElementById('auth-email');
      const passEl     = document.getElementById('auth-password');
      const googleBtn  = document.getElementById('auth-google-btn');
      const auth       = firebase.auth(app);
      const params     = new URLSearchParams(window.location.search);
      const isExtensionBridge = params.get('extGoogle') === '1';

      function finishExtensionBridge(result, error) {
        if (!isExtensionBridge) return;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('extGoogle');
        nextUrl.searchParams.delete('ts');
        const hash = new URLSearchParams();
        const credential = result && result.credential ? result.credential : null;
        if (credential && credential.accessToken) hash.set('googleAccessToken', credential.accessToken);
        if (credential && credential.idToken) hash.set('googleIdToken', credential.idToken);
        if (error) hash.set('googleAuthError', (error.code || error.message || 'google-auth-failed'));
        nextUrl.hash = hash.toString();
        window.location.replace(nextUrl.toString());
      }

      async function signInWithGoogle() {
        errEl.textContent = '';
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          const result = await auth.signInWithPopup(provider);
          if (isExtensionBridge) {
            finishExtensionBridge(result, null);
            return;
          }
        } catch (e) {
          if (isExtensionBridge) {
            finishExtensionBridge(null, e);
            return;
          }
          errEl.textContent = e.message || 'Google sign-in failed';
        }
      }

      const getCreds = () => {
        const email = (emailEl.value || '').trim();
        const password = passEl.value || '';
        if (!email || !password) {
          errEl.textContent = 'Enter both email and password';
          return null;
        }
        return { email, password };
      };

      auth.onAuthStateChanged(user => {
        if (user) {
          authScreen.classList.add('hidden');
          userBar.style.display = 'flex';
          const who = user.email || 'Signed in';
          const shortUid = user.uid ? ` [${user.uid.slice(0, 8)}]` : '';
          userNameEl.textContent = who + shortUid;
        } else {
          authScreen.classList.remove('hidden');
          userBar.style.display = 'none';
        }
      });

      if (googleBtn) {
        googleBtn.addEventListener('click', signInWithGoogle);
      }

      if (isExtensionBridge) {
        errEl.textContent = 'Opening Google sign-in...';
        setTimeout(signInWithGoogle, 80);
      }

      document.getElementById('auth-signin-btn').addEventListener('click', async () => {
        errEl.textContent = '';
        const creds = getCreds();
        if (!creds) return;
        try {
          await auth.signInWithEmailAndPassword(creds.email, creds.password);
        } catch (e) {
          errEl.textContent = e.message || 'Sign-in failed';
        }
      });

      document.getElementById('auth-create-btn').addEventListener('click', async () => {
        errEl.textContent = '';
        const creds = getCreds();
        if (!creds) return;
        try {
          await auth.createUserWithEmailAndPassword(creds.email, creds.password);
        } catch (e) {
          errEl.textContent = e.message || 'Create account failed';
        }
      });

      document.getElementById('auth-reset-btn').addEventListener('click', async () => {
        errEl.textContent = '';
        const email = (emailEl.value || '').trim();
        if (!email) {
          errEl.textContent = 'Enter your email to reset password';
          return;
        }
        try {
          await auth.sendPasswordResetEmail(email);
          errEl.textContent = 'Reset email sent. Check your inbox.';
        } catch (e) {
          errEl.textContent = e.message || 'Reset failed';
        }
      });

      document.getElementById('auth-signout-btn').addEventListener('click', () => {
        auth.signOut();
      });
    })();
  </script>
"""

# ── Build destination HTML ────────────────────────────────────────────────────
src = open(src_html, 'r', encoding='utf-8').read()

# Remove extension-only auth.js script from hosted output.
src = re.sub(r'<script src="auth\.js"></script>\s*', '', src)

# Keep exactly one Firebase script bundle in hosted output.
src = re.sub(r'<script src="vendor/firebase-app-compat\.js"></script>\s*', '', src)
src = re.sub(r'<script src="vendor/firebase-firestore-compat\.js"></script>\s*', '', src)
src = re.sub(r'<script src="vendor/firebase-auth-compat\.js"></script>\s*', '', src)
src = re.sub(r'<script src="typhon-firebase\.js"></script>\s*', '', src)

# Replace extension auth bar with hosted user bar.
src = re.sub(
  r'<div id="ext-auth-bar">[\s\S]*?</div>\s*(?=<div class="tabs">)',
  AUTH_USER_BAR,
  src,
  count=1
)

# Ensure </body> exists for hosted auth script injection.
if '</body>' not in src and '</html>' in src:
  src = src.replace('</html>', '</body>\n</html>', 1)

# 1. Inject auth CSS before </style> (first occurrence)
src = src.replace('  </style>', AUTH_CSS + '  </style>', 1)

# 2. Inject auth screen HTML after <body>
src = src.replace('<body>', '<body>\n' + AUTH_HTML, 1)

# 3. Inject Firebase vendor scripts before <script src="app.js">
src = src.replace(
  '<script src="app.js"></script>',
  '<script src="vendor/firebase-app-compat.js"></script>\n'
  '<script src="vendor/firebase-firestore-compat.js"></script>\n'
  '<script src="vendor/firebase-auth-compat.js"></script>\n'
  '<script src="typhon-firebase.js"></script>\n'
  '<script src="app.js"></script>',
  1
)

# 4. Inject auth script before </body>
src = src.replace('</body>', AUTH_SCRIPT + '\n</body>', 1)

# ── Write outputs ─────────────────────────────────────────────────────────────
shutil.copy(src_js, dst_js)
shutil.copy(src_cfg, dst_cfg)
with open(dst_html, 'w', encoding='utf-8') as f:
    f.write(src)

# Copy vendor folder to hosted destination
src_vendor = os.path.join(base, 'vendor')
dst_vendor = os.path.join(root, 'Anesthesia Wiki', 'Typhon', 'vendor')
if os.path.exists(src_vendor):
  if os.path.exists(dst_vendor):
    shutil.rmtree(dst_vendor)
  shutil.copytree(src_vendor, dst_vendor)

print('✓ Synced:')
print(f'  {src_js} → {dst_js}')
print(f'  {src_cfg} → {dst_cfg}')
print(f'  {src_html} → {dst_html}')
print(f'  {src_vendor} → {dst_vendor}')
