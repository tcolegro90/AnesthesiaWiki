(function(global) {
    var config = global.CLINICAL_SITES_FIREBASE_CONFIG || {};
    var state = {
        db: null,
        initPromise: null,
        ready: false,
        lastError: ''
    };

    function hasConfig() {
        return !!(config.enabled && config.apiKey && config.projectId && config.appId);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function statusMessage() {
        if (!hasConfig()) {
            return {
                tone: 'warn',
                message: 'Cloud sync is off. Clinical Sites stays local until clinical-sites-firebase-config.js is filled in.'
            };
        }
        if (global.location && global.location.protocol === 'file:') {
            return {
                tone: 'warn',
                message: 'Cloud sync is configured but blocked on file://. Serve over http:// or https:// to use Firebase.'
            };
        }
        if (state.ready) {
            return {
                tone: 'ok',
                message: 'Cloud sync is on. Clinical Sites changes are shared across devices.'
            };
        }
        return {
            tone: 'warn',
            message: state.lastError ? ('Cloud sync unavailable. ' + state.lastError) : 'Connecting cloud sync...'
        };
    }

    async function ensureReady() {
        if (state.initPromise) return state.initPromise;

        state.initPromise = Promise.resolve().then(function() {
            if (!hasConfig()) {
                state.ready = false;
                state.lastError = 'Firebase is not configured.';
                return false;
            }
            if (global.location && global.location.protocol === 'file:') {
                state.ready = false;
                state.lastError = 'Cloud sync requires http(s), not file://.';
                return false;
            }
            if (!global.firebase || !global.firebase.apps || !global.firebase.firestore) {
                state.ready = false;
                state.lastError = 'Firebase SDK did not load.';
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
            state.ready = true;
            state.lastError = '';
            return true;
        }).catch(function(error) {
            state.ready = false;
            state.lastError = (error && error.message) ? error.message : String(error);
            return false;
        });

        return state.initPromise;
    }

    function getDocRef() {
        return state.db.collection(config.collectionName || 'clinicalSites').doc(config.documentId || 'shared');
    }

    async function loadSharedData() {
        var ready = await ensureReady();
        if (!ready || !state.db) throw new Error(state.lastError || 'Cloud sync unavailable.');

        var snap = await getDocRef().get();
        if (!snap.exists) return null;
        var data = snap.data() || {};
        if (!data || typeof data !== 'object' || typeof data.appData !== 'object') return null;
        return clone(data);
    }

    async function saveSharedData(payload) {
        var ready = await ensureReady();
        if (!ready || !state.db) throw new Error(state.lastError || 'Cloud sync unavailable.');
        if (!payload || typeof payload !== 'object' || typeof payload.appData !== 'object') {
            throw new Error('Invalid Clinical Sites payload.');
        }

        await getDocRef().set(clone(payload), { merge: false });
        return true;
    }

    async function subscribeSharedData(onPayload) {
        var ready = await ensureReady();
        if (!ready || !state.db) throw new Error(state.lastError || 'Cloud sync unavailable.');

        return getDocRef().onSnapshot(function(snap) {
            if (!snap.exists) return;
            var data = snap.data() || {};
            if (!data || typeof data !== 'object' || typeof data.appData !== 'object') return;
            onPayload(clone(data));
        }, function(error) {
            state.lastError = (error && error.message) ? error.message : String(error);
        });
    }

    async function logSaveHistory(entry) {
        var ready = await ensureReady();
        if (!ready || !state.db) return;
        try {
            await state.db.collection('clinicalSitesSaveHistory').add(clone(entry));
        } catch (e) {
            // non-critical, ignore
        }
    }

    global.clinicalSitesCloud = {
        isEnabled: hasConfig,
        getStatus: statusMessage,
        ensureReady: ensureReady,
        loadSharedData: loadSharedData,
        saveSharedData: saveSharedData,
        subscribeSharedData: subscribeSharedData,
        logSaveHistory: logSaveHistory
    };
})(window);