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

        var linkedFieldKey = e.target.getAttribute('data-linked-field-key');
        if (fieldKey === 'preferences' && linkedFieldKey && typeof setPersonPreferencesValue === 'function') {
            setPersonPreferencesValue(siteId, linkedFieldKey, rowIndex, e.target.value);
        } else {
            appData[fieldId(siteId, fieldKey, part, rowIndex)] = e.target.value;
        }

        var syncFieldKey = fieldKey;
        if (fieldKey === 'preferences' && linkedFieldKey) {
            syncFieldKey = linkedFieldKey;
        }
        if (typeof syncLinkedPersonField === 'function') {
            syncLinkedPersonField(siteId, syncFieldKey);
        }

        if (typeof setPendingChangesMessage === 'function') {
            setPendingChangesMessage();
        }
    }
});

favoriteSiteId = loadFavorite();
appData = loadData();
var presetsChangedAtBoot = false;
if (typeof mergePresetContacts === 'function') {
    presetsChangedAtBoot = mergePresetContacts();
}
var lockersInitializedAtBoot = false;
if (typeof initializeDefaultLockers === 'function') {
    lockersInitializedAtBoot = initializeDefaultLockers();
}
var coordinatorInitializedAtBoot = false;
if (typeof initializeDefaultClinicalCoordinator === 'function') {
    coordinatorInitializedAtBoot = initializeDefaultClinicalCoordinator();
}
var rrhSharedContactsInitializedAtBoot = false;
if (typeof initializeDefaultRrhSharedContacts === 'function') {
    rrhSharedContactsInitializedAtBoot = initializeDefaultRrhSharedContacts();
}
buildUI();
if (typeof initClinicalSitesCloudSync === 'function') {
    initClinicalSitesCloudSync({ presetsChanged: presetsChangedAtBoot || lockersInitializedAtBoot || coordinatorInitializedAtBoot || rrhSharedContactsInitializedAtBoot });
} else if (presetsChangedAtBoot || lockersInitializedAtBoot || coordinatorInitializedAtBoot || rrhSharedContactsInitializedAtBoot) {
    saveAll();
}
