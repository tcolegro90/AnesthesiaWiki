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

function saveAll() {
    persistSiteData();
    var status = document.getElementById('save-status');
    status.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimeout(function() {
        status.textContent = '';
    }, 3000);
}

function setStatusMessage(text) {
    var status = document.getElementById('save-status');
    status.textContent = text;
    setTimeout(function() {
        status.textContent = '';
    }, 3000);
}

function applyImportedPayload(parsed) {
    if (!parsed || typeof parsed !== 'object' || typeof parsed.appData !== 'object') {
        throw new Error('Invalid backup/sync data');
    }

    appData = parsed.appData || {};
    favoriteSiteId = parsed.favoriteSiteId || '';
    persistSiteData();
    localStorage.setItem(FAVORITE_KEY, favoriteSiteId);
    expandedState = {};
    if (favoriteSiteId) expandedState[favoriteSiteId] = true;
    buildUI();
}

function exportClinicalSites() {
    var payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appData: appData,
        favoriteSiteId: favoriteSiteId
    };
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
