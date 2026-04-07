function selectSite(id) {
    activeSiteId = id;
    FIELDS.forEach(function(field) {
        if (field.type === 'person-list') {
            delete appData[selectedId(id, field.key)];
        }
    });
    buildUI();
    window.scrollTo(0, 0);
}

function backToSites() {
    activeSiteId = null;
    buildUI();
    window.scrollTo(0, 0);
}

function loadFavorite() {
    try {
        return localStorage.getItem(FAVORITE_KEY) || '';
    } catch (e) {
        return '';
    }
}

function toggleEdit(siteId) {
    if (editState[siteId]) {
        saveAll();
        editState[siteId] = false;
    } else {
        editState[siteId] = true;
        expandedState[siteId] = true;
    }
    buildUI();
}

function isExpanded(siteId) {
    if (editState[siteId]) {
        return true;
    }
    return Boolean(expandedState[siteId]);
}

function toggleExpanded(siteId) {
    var openNow = isExpanded(siteId);
    expandedState = {};
    if (!openNow) {
        expandedState[siteId] = true;
    }
    buildUI();
}

function toggleFavorite(siteId) {
    favoriteSiteId = favoriteSiteId === siteId ? '' : siteId;
    try {
        localStorage.setItem(FAVORITE_KEY, favoriteSiteId);
    } catch (e) {
    }
    buildUI();
}

document.addEventListener('input', function(e) {
    if (e.target && e.target.closest('#sites-container') && e.target.matches('input[data-site-id], textarea[data-site-id]')) {
        var siteId = e.target.getAttribute('data-site-id');
        var fieldKey = e.target.getAttribute('data-field-key');
        var part = e.target.getAttribute('data-part');
        var rowIndex = parseInt(e.target.getAttribute('data-row-index'), 10) || 0;

        var isLockerCombo = (fieldKey === 'mensLocker' || fieldKey === 'womensLocker') && part === 'phone';
        var isPhoneInput = (part === 'phone' || PHONE_FIELD_KEYS[fieldKey]) && !isLockerCombo;
        if (isPhoneInput && e.target.tagName === 'INPUT') {
            var rawDigits = e.target.value.replace(/\D/g, '').length;
            var formatted = formatPhone(e.target.value);
            e.target.value = formatted;
            var newDigits = formatted.replace(/\D/g, '').length;
            if (newDigits >= rawDigits) e.target.setSelectionRange(formatted.length, formatted.length);
        }

        appData[fieldId(siteId, fieldKey, part, rowIndex)] = e.target.value;

        clearTimeout(window._autoSaveTimer);
        window._autoSaveTimer = setTimeout(function() {
            saveAll();
        }, 1200);
    }
});

window.addEventListener('pagehide', function() {
    saveAll();
});

favoriteSiteId = loadFavorite();
appData = loadData();
buildUI();
