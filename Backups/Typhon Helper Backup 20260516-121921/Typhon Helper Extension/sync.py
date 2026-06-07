#!/usr/bin/env python3
"""
Sync Anesthesia Wiki/Typhon Helper/ source files → Typhon Helper Extension/

Usage (from Typhon Helper Extension/):
    python3 sync.py

What it does:
  - Copies ../app.js  → app.js
  - Copies ../typhon-firebase.js → typhon-firebase.js
  - Copies ../TyphonCaseHelper.html → app.html
    with the hosted-only auth shell removed and the extension auth bar/script restored.
"""

import os, shutil, re

base      = os.path.dirname(os.path.abspath(__file__))
root      = os.path.dirname(base)
src_html  = os.path.join(root, 'TyphonCaseHelper.html')
src_js    = os.path.join(root, 'app.js')
src_cfg   = os.path.join(root, 'typhon-firebase.js')
dst_html  = os.path.join(base, 'app.html')
dst_js    = os.path.join(base, 'app.js')
dst_js_core = os.path.join(base, 'app.core.js')
dst_js_data = os.path.join(base, 'app.data.js')
dst_js_ui   = os.path.join(base, 'app.ui.js')
dst_cfg   = os.path.join(base, 'typhon-firebase.js')

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

EXT_AUTH_BAR = """<div id="ext-auth-bar">
  <span id="ext-auth-label">☁️ Sign in to sync with phone</span>
  <div class="ext-auth-actions">
    <button class="ext-auth-btn" id="ext-google-btn">Google</button>
    <button class="ext-auth-btn" id="ext-reset-btn">Reset Password</button>
    <button class="ext-auth-btn" id="ext-auth-btn">Email</button>
  </div>
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

      async function finishPendingRedirectResult() {
        if (!isExtensionBridge) return false;
        try {
          const result = await auth.getRedirectResult();
          const credential = result && result.credential ? result.credential : null;
          if (credential || result.user) {
            finishExtensionBridge(result, null);
            return true;
          }
        } catch (e) {
          finishExtensionBridge(null, e);
          return true;
        }
        return false;
      }

      async function signInWithGoogle() {
        errEl.textContent = '';
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          if (isExtensionBridge) {
            await auth.signInWithRedirect(provider);
            return;
          }
          const result = await auth.signInWithPopup(provider);
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
        finishPendingRedirectResult().then(done => {
          if (!done) {
            errEl.textContent = 'Opening Google sign-in...';
            setTimeout(signInWithGoogle, 80);
          }
        });
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

def _find_section_start(lines, section_title):
  for i in range(len(lines) - 2):
    if (
      lines[i].startswith('// ============================================================') and
      lines[i + 1].strip() == f'// {section_title}' and
      lines[i + 2].startswith('// ============================================================')
    ):
      return i
  raise RuntimeError(f'Could not find section header: {section_title}')


def _split_app_js(js_text):
  lines = js_text.splitlines(keepends=True)
  data_start = _find_section_start(lines, 'LOAD CASE DATA (reusable for both test cases and editing)')
  ui_start = _find_section_start(lines, 'TIMESTAMP')

  core = ''.join(lines[:data_start])
  data = ''.join(lines[data_start:ui_start])
  ui = ''.join(lines[ui_start:])
  return core, data, ui

# ── Build destination HTML ────────────────────────────────────────────────────
src = open(src_html, 'r', encoding='utf-8').read()

# Remove hosted-only auth screen HTML and inline auth script.
src = src.replace(AUTH_HTML + '\n', '', 1)
src = src.replace(AUTH_CSS, '', 1)
src = src.replace(AUTH_SCRIPT + '\n', '', 1)
src = re.sub(
  r'\s*<!-- hosted-auth-script:start -->\s*<script>[\s\S]*?</script>\s*<!-- hosted-auth-script:end -->\s*',
  '\n',
  src,
  count=1
)

# Replace hosted auth user bar with the extension auth bar.
src = src.replace(AUTH_USER_BAR, EXT_AUTH_BAR, 1)

# Extension build should always use split app modules.
if '<script src="app.core.js"></script>' not in src:
  src = src.replace(
    '<script src="app.js"></script>',
    '<script src="app.core.js"></script>\n<script src="app.data.js"></script>\n<script src="app.ui.js"></script>',
    1
  )

# Restore the extension auth script if it is not present.
if '<script src="auth.js"></script>' not in src:
  if '<script src="app.ui.js"></script>' in src:
    src = src.replace('<script src="app.ui.js"></script>', '<script src="app.ui.js"></script>\n<script src="auth.js"></script>', 1)
  else:
    src = src.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n<script src="auth.js"></script>', 1)

# ── Write outputs ─────────────────────────────────────────────────────────────
src_js_text = open(src_js, 'r', encoding='utf-8').read()
core_js, data_js, ui_js = _split_app_js(src_js_text)

shutil.copy(src_js, dst_js)
with open(dst_js_core, 'w', encoding='utf-8') as f:
  f.write(core_js)
with open(dst_js_data, 'w', encoding='utf-8') as f:
  f.write(data_js)
with open(dst_js_ui, 'w', encoding='utf-8') as f:
  f.write(ui_js)
shutil.copy(src_cfg, dst_cfg)
with open(dst_html, 'w', encoding='utf-8') as f:
    f.write(src)

# Copy vendor folder to extension destination
src_vendor = os.path.join(root, 'vendor')
dst_vendor = os.path.join(base, 'vendor')
if os.path.exists(src_vendor):
  if os.path.exists(dst_vendor):
    shutil.rmtree(dst_vendor)
  shutil.copytree(src_vendor, dst_vendor)

print('✓ Synced:')
print(f'  {src_js} → {dst_js}')
print(f'  {src_js} → {dst_js_core}')
print(f'  {src_js} → {dst_js_data}')
print(f'  {src_js} → {dst_js_ui}')
print(f'  {src_cfg} → {dst_cfg}')
print(f'  {src_html} → {dst_html}')
print(f'  {src_vendor} → {dst_vendor}')
