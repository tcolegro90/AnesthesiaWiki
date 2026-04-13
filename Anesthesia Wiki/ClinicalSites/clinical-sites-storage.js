function splitDataBySite(dataObj) {
    var buckets = {};
    SITES.forEach(function(site) {
        buckets[site.id] = {};
    });

    Object.keys(dataObj || {}).forEach(function(key) {
        for (var i = 0; i < SITES.length; i++) {
            var siteId = SITES[i].id;
            if (key.indexOf(siteId + '__') === 0) {
                buckets[siteId][key] = dataObj[key];
                return;
            }
        }
    });

    return buckets;
}

var clinicalSitesCloudUnsubscribe = null;
var clinicalSitesLastCloudSavedAt = '';
var clinicalSitesApplyingCloudUpdate = false;
var clinicalSitesStatusTimer = null;

function buildSyncPayload(savedAtIso) {
    return {
        version: 1,
        savedAt: savedAtIso || new Date().toISOString(),
        appData: appData || {}
    };
}

function rememberCloudSavedAt(payload) {
    clinicalSitesLastCloudSavedAt = String((payload && payload.savedAt) || '');
}

function isNewerCloudPayload(payload) {
    var incoming = String((payload && payload.savedAt) || '');
    if (!incoming) return true;
    if (!clinicalSitesLastCloudSavedAt) return true;
    return incoming > clinicalSitesLastCloudSavedAt;
}

function persistSiteData() {
    var buckets = splitDataBySite(appData);
    SITES.forEach(function(site) {
        var key = siteStoreKey(site.id);
        var bucket = buckets[site.id] || {};
        if (Object.keys(bucket).length) {
            localStorage.setItem(key, JSON.stringify(bucket));
        } else {
            localStorage.removeItem(key);
        }
    });

    // Ensure no stale legacy blob remains.
    try { localStorage.removeItem(STORE_KEY_LEGACY); } catch (e) {}
}

function loadData() {
    var merged = {};
    var foundPerSite = false;

    // Preferred: per-site records
    try {
        SITES.forEach(function(site) {
            var raw = localStorage.getItem(siteStoreKey(site.id));
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            Object.keys(parsed).forEach(function(k) {
                merged[k] = parsed[k];
            });
            foundPerSite = true;
        });
    } catch (e) {
    }

    if (foundPerSite) {
        return merged;
    }

    // Fallback + migrate: previous single-key storage
    try {
        var legacy = JSON.parse(localStorage.getItem(STORE_KEY_LEGACY)) || {};
        if (!legacy || typeof legacy !== 'object') return {};

        var buckets = splitDataBySite(legacy);
        SITES.forEach(function(site) {
            var bucket = buckets[site.id] || {};
            if (Object.keys(bucket).length) {
                localStorage.setItem(siteStoreKey(site.id), JSON.stringify(bucket));
            }
        });

        try { localStorage.removeItem(STORE_KEY_LEGACY); } catch (removeErr) {}
        return legacy;
    } catch (e) {
        return {};
    }
}

async function saveAll() {
    persistSiteData();

    var savedAt = new Date().toISOString();
    var localStamp = new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (clinicalSitesApplyingCloudUpdate) {
        setStatusMessage('Saved locally ' + localStamp);
        return;
    }

    if (!window.clinicalSitesCloud) {
        setStatusMessage('Saved locally ' + localStamp + ' (cloud sync script not loaded)', { sticky: true });
        return;
    }

    if (!window.clinicalSitesCloud.isEnabled()) {
        var disabledStatus = window.clinicalSitesCloud.getStatus();
        setStatusMessage('Saved locally ' + localStamp + ' (' + disabledStatus.message + ')', { sticky: true });
        return;
    }

    try {
        var ready = await window.clinicalSitesCloud.ensureReady();
        if (!ready) {
            setStatusMessage('Saved locally ' + localStamp + ' (cloud unavailable)');
            return;
        }

        var payload = buildSyncPayload(savedAt);
        await window.clinicalSitesCloud.saveSharedData(payload);
        rememberCloudSavedAt(payload);
        setStatusMessage('Saved locally + cloud ' + localStamp);
    } catch (e) {
        setStatusMessage('Saved locally ' + localStamp + ' (cloud sync failed)');
    }
}

function setStatusMessage(text, options) {
    var status = document.getElementById('save-status');
    if (!status) return;
    var sticky = !!(options && options.sticky);
    if (clinicalSitesStatusTimer) {
        clearTimeout(clinicalSitesStatusTimer);
        clinicalSitesStatusTimer = null;
    }
    status.textContent = text;
    if (sticky) return;
    clinicalSitesStatusTimer = setTimeout(function() {
        status.textContent = '';
        clinicalSitesStatusTimer = null;
    }, 3000);
}

function setPendingChangesMessage() {
    var status = document.getElementById('save-status');
    if (!status) return;
    if (clinicalSitesStatusTimer) {
        clearTimeout(clinicalSitesStatusTimer);
        clinicalSitesStatusTimer = null;
    }
    status.textContent = 'Unsaved changes';
}

function applyImportedPayload(parsed) {
    if (!parsed || typeof parsed !== 'object' || typeof parsed.appData !== 'object') {
        throw new Error('Invalid backup/sync data');
    }

    appData = parsed.appData || {};
    persistSiteData();
    expandedState = {};
    if (favoriteSiteId) expandedState[favoriteSiteId] = true;
    buildUI();
}

function applyCloudPayload(parsed) {
    if (!parsed || typeof parsed !== 'object' || typeof parsed.appData !== 'object') {
        return false;
    }

    if (!isNewerCloudPayload(parsed)) {
        return false;
    }

    clinicalSitesApplyingCloudUpdate = true;
    applyImportedPayload(parsed);
    clinicalSitesApplyingCloudUpdate = false;
    rememberCloudSavedAt(parsed);
    return true;
}

async function initClinicalSitesCloudSync(options) {
    var presetsChanged = !!(options && options.presetsChanged);

    if (!window.clinicalSitesCloud) {
        setStatusMessage('Cloud sync script not loaded; using local data only', { sticky: true });
        if (presetsChanged) saveAll();
        return;
    }

    if (!window.clinicalSitesCloud.isEnabled()) {
        setStatusMessage(window.clinicalSitesCloud.getStatus().message, { sticky: true });
        if (presetsChanged) saveAll();
        return;
    }

    try {
        var ready = await window.clinicalSitesCloud.ensureReady();
        var status = window.clinicalSitesCloud.getStatus();
        setStatusMessage(status.message, { sticky: !ready });

        if (!ready) {
            if (presetsChanged) saveAll();
            return;
        }

        var cloudPayload = await window.clinicalSitesCloud.loadSharedData();
        if (cloudPayload && applyCloudPayload(cloudPayload)) {
            setStatusMessage('Loaded shared Clinical Sites data from cloud');
        } else if (presetsChanged) {
            await saveAll();
        }

        if (typeof mergePresetContacts === 'function' && mergePresetContacts()) {
            await saveAll();
        }

        if (!clinicalSitesCloudUnsubscribe) {
            clinicalSitesCloudUnsubscribe = await window.clinicalSitesCloud.subscribeSharedData(function(payload) {
                if (applyCloudPayload(payload)) {
                    setStatusMessage('Cloud update received');
                }
            });
        }
    } catch (e) {
        var initDetails = (e && e.message) ? e.message : 'using local data only';
        setStatusMessage('Cloud sync unavailable; ' + initDetails, { sticky: true });
        if (presetsChanged) saveAll();
    }
}

function exportClinicalSites() {
    var payload = buildSyncPayload();
    payload.exportedAt = new Date().toISOString();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'clinical-sites-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function triggerImportClinicalSites() {
    var input = document.getElementById('import-file');
    input.value = '';
    input.click();
}

function importClinicalSites(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function() {
        try {
            var parsed = JSON.parse(String(reader.result || '{}'));
            applyImportedPayload(parsed);
            setStatusMessage('Import complete');
        } catch (e) {
            setStatusMessage('Import failed');
        }
    };
    reader.readAsText(file);
}
