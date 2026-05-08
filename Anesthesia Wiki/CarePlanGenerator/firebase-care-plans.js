(function(global) {
  var config = global.CARE_PLAN_FIREBASE_CONFIG || {};
  var USER_ID_KEY = 'carePlanCloudUserId';
  var state = {
    db: null,
    initPromise: null,
    isReady: false,
    lastError: ''
  };

  function hasConfig() {
    return !!(config.enabled && config.apiKey && config.projectId && config.appId);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function collectionName() {
    return config.collectionName || 'carePlanSavedPlans';
  }

  function sanitizeUserId(userId) {
    return String(userId || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function getUserId() {
    try { return sanitizeUserId(localStorage.getItem(USER_ID_KEY) || ''); }
    catch (e) { return ''; }
  }

  function setUserId(userId) {
    var clean = sanitizeUserId(userId);
    try {
      if (clean) localStorage.setItem(USER_ID_KEY, clean);
      else localStorage.removeItem(USER_ID_KEY);
    } catch (e) {}
    return clean;
  }

  function requireUserId(userId) {
    var clean = sanitizeUserId(userId || getUserId());
    if (!clean) throw new Error('Please log in with your first initial + last name (e.g., jsmith).');
    return clean;
  }

  function planDocId(userId, name) {
    return encodeURIComponent(String(userId || '').trim()) + '__' + encodeURIComponent(String(name || '').trim());
  }

  function errorText(error) {
    if (!error) return 'Unknown Firebase error.';
    return error.message || String(error);
  }

  async function ensureReady() {
    if (state.initPromise) return state.initPromise;

    state.initPromise = Promise.resolve().then(function() {
      if (!hasConfig()) {
        state.lastError = 'Firebase is not configured yet.';
        state.isReady = false;
        return false;
      }

      if (global.location && global.location.protocol === 'file:') {
        state.lastError = 'Cloud sync needs the app to be served over http:// or https://.';
        state.isReady = false;
        return false;
      }

      if (!global.firebase || !global.firebase.apps || !global.firebase.firestore) {
        state.lastError = 'Firebase SDK failed to load.';
        state.isReady = false;
        return false;
      }

      if (!global.firebase.apps.length) {
        global.firebase.initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId
        });
      }

      state.db = global.firebase.firestore();
      state.isReady = true;
      state.lastError = '';
      return true;
    }).catch(function(error) {
      state.lastError = errorText(error);
      state.isReady = false;
      return false;
    });

    return state.initPromise;
  }

  async function listPlans(userId) {
    var ready = await ensureReady();
    var cleanUserId = requireUserId(userId);
    if (!ready || !state.db) throw new Error(state.lastError || 'Firebase is unavailable.');

    var snapshot = await state.db.collection(collectionName()).where('userId', '==', cleanUserId).get();
    var plans = {};

    snapshot.forEach(function(doc) {
      var data = doc.data() || {};
      var name = data.name || decodeURIComponent(doc.id);
      plans[name] = {
        savedAt: data.savedAt || '',
        state: clone(data.state || {})
      };
    });

    return plans;
  }

  async function savePlan(name, planState, userId) {
    var ready = await ensureReady();
    var cleanUserId = requireUserId(userId);
    var cleanName = String(name || '').trim();
    if (!ready || !state.db) throw new Error(state.lastError || 'Firebase is unavailable.');
    if (!cleanName) throw new Error('Plan name is required.');

    var payload = {
      userId: cleanUserId,
      name: cleanName,
      savedAt: new Date().toISOString(),
      state: clone(planState)
    };

    await state.db.collection(collectionName()).doc(planDocId(cleanUserId, cleanName)).set(payload, { merge: true });
    return payload;
  }

  async function loadPlan(name, userId) {
    var ready = await ensureReady();
    var cleanUserId = requireUserId(userId);
    var cleanName = String(name || '').trim();
    if (!ready || !state.db) throw new Error(state.lastError || 'Firebase is unavailable.');
    if (!cleanName) throw new Error('Plan name is required.');

    var doc = await state.db.collection(collectionName()).doc(planDocId(cleanUserId, cleanName)).get();
    if (!doc.exists) return null;

    var data = doc.data() || {};
    return {
      name: data.name || cleanName,
      savedAt: data.savedAt || '',
      state: clone(data.state || {})
    };
  }

  async function deletePlan(name, userId) {
    var ready = await ensureReady();
    var cleanUserId = requireUserId(userId);
    var cleanName = String(name || '').trim();
    if (!ready || !state.db) throw new Error(state.lastError || 'Firebase is unavailable.');
    if (!cleanName) throw new Error('Plan name is required.');

    await state.db.collection(collectionName()).doc(planDocId(cleanUserId, cleanName)).delete();
    return true;
  }

  function getStatus(userId) {
    var cleanUserId = sanitizeUserId(userId || getUserId());
    if (!hasConfig()) {
      return {
        tone: 'warn',
        message: 'Plans you create and save will ONLY be available on this specific device'
      };
    }

    if (global.location && global.location.protocol === 'file:') {
      return {
        tone: 'warn',
        message: 'Cloud sync is configured but blocked on file://. Serve the app over http:// or https:// to use Firebase.'
      };
    }

    if (!cleanUserId) {
      return {
        tone: 'warn',
        message: 'Enter your first initial and last name to login. This will allow you to access your care plans from any device you are logging in to. If you do not login, any plans you make will ONLY be available on this device.'
      };
    }

    if (state.isReady) {
      return {
        tone: 'ok',
        message: 'Logged in as ' + cleanUserId + '. Save Plan stores named plans online; unsaved typing still stays local.'
      };
    }

    return {
      tone: 'warn',
      message: state.lastError
        ? 'Cloud sync is unavailable right now. ' + state.lastError
        : 'Connecting to Firebase cloud sync...'
    };
  }

  global.carePlanCloudStorage = {
    ensureReady: ensureReady,
    sanitizeUserId: sanitizeUserId,
    getUserId: getUserId,
    setUserId: setUserId,
    listPlans: listPlans,
    savePlan: savePlan,
    loadPlan: loadPlan,
    deletePlan: deletePlan,
    getStatus: getStatus,
    isEnabled: hasConfig
  };
})(window);