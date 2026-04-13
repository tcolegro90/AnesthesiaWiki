

function normalizeAnesthesiologistName(name) {
    return String(name || '').replace(/,\s*(MD|DO)\s*$/i, '').trim();
}

function normalizeCrnaName(name) {
    var normalized = String(name || '').trim();
    var key = normalized.toLowerCase();
    if (key === 'marilyn alleman' || key === 'marlyin alleman' || key === 'marlyn "nikki" alleman' || key === 'nikki alleman') {
        return 'Marilyn "Nikki" Alleman';
    }
    return normalized;
}

function isRrhSite(siteId) {
    return siteId === 'rgh' || siteId === 'unity';
}

function getRoleLabelForField(fieldKey) {
    if (fieldKey === 'preceptor') return 'CRNA';
    if (fieldKey === 'anesthesiologist') return 'MDA';
    if (fieldKey === 'surgeon') return 'Surgeon';
    return '';
}

function getSiteCompanyPrefix(siteId) {
    var site = (typeof SITES !== 'undefined' && Array.isArray(SITES))
        ? SITES.find(function(s) { return s.id === siteId; })
        : null;
    var label = String((site && site.label) || siteId || '').trim();
    if (!label) return '';
    return label.split(' - ')[0].trim();
}

function getExpectedCompanyLabel(siteId, fieldKey) {
    var role = getRoleLabelForField(fieldKey);
    if (!role) return '';
    if (isRrhSite(siteId)) {
        if (fieldKey === 'anesthesiologist') return 'RRH MDA';
        return '';
    }
    var prefix = getSiteCompanyPrefix(siteId);
    return prefix ? (prefix + ' ' + role) : role;
}

function normalizePresetPerson(siteId, fieldKey, person) {
    var normalized = {
        name: person && person.name ? String(person.name) : '',
        cell: person && person.cell ? String(person.cell) : '',
        company: person && person.company ? String(person.company) : '',
        preferences: person && person.preferences ? String(person.preferences) : ''
    };

    if (fieldKey === 'anesthesiologist') {
        normalized.name = normalizeAnesthesiologistName(normalized.name);
    } else if (fieldKey === 'preceptor') {
        normalized.name = normalizeCrnaName(normalized.name);
    }

    var expectedCompany = getExpectedCompanyLabel(siteId, fieldKey);
    if (!isRrhSite(siteId) && expectedCompany) {
        normalized.company = expectedCompany;
    } else if (!normalized.company && expectedCompany) {
        normalized.company = expectedCompany;
    }

    return normalized;
}

function normalizeExistingAnesthesiologists() {
    var changed = false;
    SITES.forEach(function(site) {
        var siteId = site.id;
        var count = parseInt(appData[countId(siteId, 'anesthesiologist')], 10) || 0;
        for (var i = 0; i < count; i++) {
            var nameKey = fieldId(siteId, 'anesthesiologist', 'name', i);
            var memoKey = fieldId(siteId, 'anesthesiologist', 'memo', i);
            var nextName = normalizeAnesthesiologistName(appData[nameKey]);
            if (appData[nameKey] !== nextName) {
                appData[nameKey] = nextName;
                changed = true;
            }
            if (appData[memoKey] === 'MDA') {
                appData[memoKey] = 'RRH MDA';
                changed = true;
            }
        }
    });
    return changed;
}

function normalizeExistingCrnaAliases() {
    var changed = false;
    ['rgh', 'unity'].forEach(function(siteId) {
        var count = parseInt(appData[countId(siteId, 'preceptor')], 10) || 0;
        for (var i = 0; i < count; i++) {
            var nameKey = fieldId(siteId, 'preceptor', 'name', i);
            var nextName = normalizeCrnaName(appData[nameKey]);
            if (appData[nameKey] !== nextName) {
                appData[nameKey] = nextName;
                changed = true;
            }
        }
    });
    return changed;
}

function migrateNikkiAllemanPreferences() {
    var changed = false;
    ['rgh', 'unity'].forEach(function(siteId) {
        var count = parseInt(appData[countId(siteId, 'preceptor')], 10) || 0;
        var preferredIndex = -1;
        var legacyIndex = -1;

        for (var i = 0; i < count; i++) {
            var nameKey = fieldId(siteId, 'preceptor', 'name', i);
            var rawName = String(appData[nameKey] || '').trim().toLowerCase();
            if (rawName === 'marilyn "nikki" alleman') preferredIndex = i;
            if (rawName === 'marlyn "nikki" alleman' || rawName === 'nikki alleman') legacyIndex = i;
        }

        if (legacyIndex === -1) return;

        var legacyPref = typeof getPersonPreferencesValue === 'function'
            ? String(getPersonPreferencesValue(siteId, 'preceptor', legacyIndex) || '')
            : String(appData[fieldId(siteId, 'preferences', 'memo', legacyIndex)] || '');

        if (preferredIndex !== -1 && legacyPref) {
            var existingPref = typeof getPersonPreferencesValue === 'function'
                ? String(getPersonPreferencesValue(siteId, 'preceptor', preferredIndex) || '')
                : String(appData[fieldId(siteId, 'preferences', 'memo', preferredIndex)] || '');
            if (!existingPref) {
                if (typeof setPersonPreferencesValue === 'function') {
                    setPersonPreferencesValue(siteId, 'preceptor', preferredIndex, legacyPref);
                } else {
                    appData[fieldId(siteId, 'preferences', 'memo', preferredIndex)] = legacyPref;
                }
                changed = true;
            }
        }

        for (var j = legacyIndex; j < count - 1; j++) {
            appData[fieldId(siteId, 'preceptor', 'name', j)] = appData[fieldId(siteId, 'preceptor', 'name', j + 1)] || '';
            appData[fieldId(siteId, 'preceptor', 'phone', j)] = appData[fieldId(siteId, 'preceptor', 'phone', j + 1)] || '';
            appData[fieldId(siteId, 'preceptor', 'memo', j)] = appData[fieldId(siteId, 'preceptor', 'memo', j + 1)] || '';
            if (typeof setPersonPreferencesValue === 'function' && typeof getPersonPreferencesValue === 'function') {
                setPersonPreferencesValue(siteId, 'preceptor', j, getPersonPreferencesValue(siteId, 'preceptor', j + 1) || '');
            } else {
                appData[fieldId(siteId, 'preferences', 'memo', j)] = appData[fieldId(siteId, 'preferences', 'memo', j + 1)] || '';
            }
        }

        if (count > 0) {
            delete appData[fieldId(siteId, 'preceptor', 'name', count - 1)];
            delete appData[fieldId(siteId, 'preceptor', 'phone', count - 1)];
            delete appData[fieldId(siteId, 'preceptor', 'memo', count - 1)];
            if (typeof deletePersonPreferencesValue === 'function') {
                deletePersonPreferencesValue(siteId, 'preceptor', count - 1);
            }
            delete appData[fieldId(siteId, 'preferences', 'memo', count - 1)];
            appData[countId(siteId, 'preceptor')] = count - 1 > 0 ? count - 1 : 1;
            changed = true;
        }
    });
    return changed;
}

function mergePresetPeopleIntoField(siteIds, fieldKey, people) {
    var changed = false;
    siteIds.forEach(function(siteId) {
        var countKey = countId(siteId, fieldKey);
        var existingCount = parseInt(appData[countKey], 10) || 0;
        var existingNames = [];
        for (var i = 0; i < existingCount; i++) {
            var existingName = appData[fieldId(siteId, fieldKey, 'name', i)];
            if (fieldKey === 'anesthesiologist') {
                existingName = normalizeAnesthesiologistName(existingName);
            }
            if (existingName) existingNames.push(existingName.trim().toLowerCase());
        }

        var toAdd = people.filter(function(person) {
            var normalizedPerson = normalizePresetPerson(siteId, fieldKey, person);
            return existingNames.indexOf(String(normalizedPerson.name || '').trim().toLowerCase()) === -1;
        });

        toAdd.forEach(function(person, idx) {
            var normalizedPerson = normalizePresetPerson(siteId, fieldKey, person);
            var insertAt = existingCount + idx;
            appData[fieldId(siteId, fieldKey, 'name', insertAt)] = normalizedPerson.name || '';
            appData[fieldId(siteId, fieldKey, 'phone', insertAt)] = normalizedPerson.cell || '';
            appData[fieldId(siteId, fieldKey, 'memo', insertAt)] = normalizedPerson.company || '';
            setPersonPreferencesValue(siteId, fieldKey, insertAt, normalizedPerson.preferences || '');
            changed = true;
        });

        if (toAdd.length) {
            appData[countKey] = existingCount + toAdd.length;
        }
    });
    return changed;
}

function normalizeNonRrhTeamCompanyLabels() {
    var changed = false;
    SITES.forEach(function(site) {
        if (isRrhSite(site.id)) return;

        ['preceptor', 'anesthesiologist', 'surgeon'].forEach(function(fieldKey) {
            var expectedCompany = getExpectedCompanyLabel(site.id, fieldKey);
            if (!expectedCompany) return;

            var count = parseInt(appData[countId(site.id, fieldKey)], 10) || 0;
            for (var i = 0; i < count; i++) {
                var name = String(appData[fieldId(site.id, fieldKey, 'name', i)] || '').trim();
                var phone = String(appData[fieldId(site.id, fieldKey, 'phone', i)] || '').trim();
                if (!name && !phone) continue;

                var memoKey = fieldId(site.id, fieldKey, 'memo', i);
                if (String(appData[memoKey] || '').trim() !== expectedCompany) {
                    appData[memoKey] = expectedCompany;
                    changed = true;
                }
            }
        });
    });
    return changed;
}

// Site preset registry
// - rgh: RRH shared CRNA + RRH MDA presets
// - unity: RRH shared CRNA + RRH MDA presets
// - stjoes: St. Joes CRNA + St. Joes MDA presets
// - crause: Crause CRNA presets
// To add a new hospital-specific phone list, define a <SITE>_..._LIST array
// and map it below under that site's field key.
function getSiteTeamPresetMap() {
    return {
        rgh: {
            preceptor: (typeof CRNA_LIST !== 'undefined' ? CRNA_LIST : []),
            anesthesiologist: (typeof MDA_LIST !== 'undefined' ? MDA_LIST : [])
        },
        unity: {
            preceptor: (typeof CRNA_LIST !== 'undefined' ? CRNA_LIST : []),
            anesthesiologist: (typeof MDA_LIST !== 'undefined' ? MDA_LIST : [])
        },
        stjoes: {
            preceptor: (typeof STJOES_CRNA_LIST !== 'undefined' ? STJOES_CRNA_LIST : []),
            anesthesiologist: (typeof STJOES_MDA_LIST !== 'undefined' ? STJOES_MDA_LIST : [])
        },
        crause: {
            preceptor: (typeof CRAUSE_CRNA_LIST !== 'undefined' ? CRAUSE_CRNA_LIST : [])
        }
    };
}

function mergePresetContacts() {
    var changed = normalizeExistingAnesthesiologists();
    changed = normalizeExistingCrnaAliases() || changed;
    changed = migrateNikkiAllemanPreferences() || changed;
    changed = clearLegacyRrhMdaFromIndependentSites() || changed;
    changed = normalizeNonRrhTeamCompanyLabels() || changed;

    var presetMap = getSiteTeamPresetMap();
    Object.keys(presetMap).forEach(function(siteId) {
        var fieldMap = presetMap[siteId] || {};
        Object.keys(fieldMap).forEach(function(fieldKey) {
            var people = fieldMap[fieldKey];
            if (Array.isArray(people) && people.length) {
                changed = mergePresetPeopleIntoField([siteId], fieldKey, people) || changed;
            }
        });
    });

    return changed;
}

function initializeDefaultLockers() {
    var changed = false;
    var defaultLockers = [
        { key: 'mensLocker', location: 'by OR', number: '19', combo: '34-43-5' },
        { key: 'womensLocker', location: 'by OR', number: '8', combo: '37-40-0' }
    ];
    
    SITES.forEach(function(site) {
        defaultLockers.forEach(function(locker) {
            var locationKey = fieldId(site.id, locker.key, 'location', 0);
            var nameKey = fieldId(site.id, locker.key, 'name', 0);
            var phoneKey = fieldId(site.id, locker.key, 'phone', 0);

            if (site.id === 'rgh') {
                // Only seed defaults for RGH.
                if (!appData[locationKey]) {
                    appData[locationKey] = locker.location;
                    changed = true;
                }
                if (!appData[nameKey]) {
                    appData[nameKey] = locker.number;
                    changed = true;
                }
                if (!appData[phoneKey]) {
                    appData[phoneKey] = locker.combo;
                    changed = true;
                }
            } else {
                // Remove previously auto-seeded defaults from non-RGH sites.
                if (String(appData[locationKey] || '').trim() === locker.location) {
                    delete appData[locationKey];
                    changed = true;
                }
                if (String(appData[nameKey] || '').trim() === locker.number) {
                    delete appData[nameKey];
                    changed = true;
                }
                if (String(appData[phoneKey] || '').trim() === locker.combo) {
                    delete appData[phoneKey];
                    changed = true;
                }
            }
        });
    });
    
    return changed;
}

function clearLegacyRrhMdaFromIndependentSites() {
    var changed = false;
    var rrhMdaNames = {};
    if (typeof MDA_LIST !== 'undefined' && Array.isArray(MDA_LIST)) {
        MDA_LIST.forEach(function(person) {
            var normalized = normalizeAnesthesiologistName(person && person.name);
            if (normalized) rrhMdaNames[normalized.toLowerCase()] = true;
        });
    }

    SITES.forEach(function(site) {
        if (site.id === 'rgh' || site.id === 'unity') return;

        var fieldKey = 'anesthesiologist';
        var count = parseInt(appData[countId(site.id, fieldKey)], 10) || 0;
        if (!count) return;

        var siteChanged = false;

        var kept = [];
        for (var i = 0; i < count; i++) {
            var name = String(appData[fieldId(site.id, fieldKey, 'name', i)] || '').trim();
            var phone = String(appData[fieldId(site.id, fieldKey, 'phone', i)] || '').trim();
            var memo = String(appData[fieldId(site.id, fieldKey, 'memo', i)] || '').trim();
            var pref = String(getPersonPreferencesValue(site.id, fieldKey, i) || '');

            var lowerName = normalizeAnesthesiologistName(name).toLowerCase();
            var looksRrhSeed = (memo === 'RRH MDA' || memo === 'MDA') && rrhMdaNames[lowerName];
            if (!looksRrhSeed) {
                kept.push({ name: name, phone: phone, memo: memo, pref: pref });
            } else {
                siteChanged = true;
            }
        }

        if (!siteChanged) return;
        changed = true;

        for (var j = 0; j < kept.length; j++) {
            appData[fieldId(site.id, fieldKey, 'name', j)] = kept[j].name;
            appData[fieldId(site.id, fieldKey, 'phone', j)] = kept[j].phone;
            appData[fieldId(site.id, fieldKey, 'memo', j)] = kept[j].memo;
            setPersonPreferencesValue(site.id, fieldKey, j, kept[j].pref);
        }

        for (var k = kept.length; k < count; k++) {
            delete appData[fieldId(site.id, fieldKey, 'name', k)];
            delete appData[fieldId(site.id, fieldKey, 'phone', k)];
            delete appData[fieldId(site.id, fieldKey, 'memo', k)];
            deletePersonPreferencesValue(site.id, fieldKey, k);
            delete appData[fieldId(site.id, 'preferences', 'memo', k)];
        }

        if (kept.length > 0) {
            appData[countId(site.id, fieldKey)] = kept.length;
        } else {
            delete appData[countId(site.id, fieldKey)];
        }

        var selKey = selectedId(site.id, fieldKey);
        var sel = parseInt(appData[selKey], 10);
        if (isNaN(sel) || sel < 0) sel = 0;
        if (kept.length === 0) {
            delete appData[selKey];
        } else if (sel >= kept.length) {
            appData[selKey] = String(kept.length - 1);
        }
    });

    return changed;
}

function initializeDefaultClinicalCoordinator() {
    var changed = false;
    var defaultCoordinatorBySite = {
        rgh: {
            name: 'Tamara Kiernan',
            phone: '(585) 261-7818',
            email: 'tamara.kieran@rochesterregional.org'
        },
        crause: {
            name: 'Adam Wojdyla',
            phone: '716-604-7326',
            email: ''
        }
    };

    SITES.forEach(function(site) {
        var nameKey = fieldId(site.id, 'clinicalCoordinator', 'name', 0);
        var phoneKey = fieldId(site.id, 'clinicalCoordinator', 'phone', 0);
        var emailKey = fieldId(site.id, 'clinicalCoordinator', 'email', 0);
        var siteDefault = defaultCoordinatorBySite[site.id] || null;

        if (siteDefault) {
            // Migrate old Crause seed from Tamara to Adam.
            if (
                site.id === 'crause' &&
                String(appData[nameKey] || '').trim() === 'Tamara Kiernan'
            ) {
                appData[nameKey] = siteDefault.name;
                appData[phoneKey] = siteDefault.phone;
                if (siteDefault.email) appData[emailKey] = siteDefault.email;
                changed = true;
            }

            if (!String(appData[nameKey] || '').trim()) {
                appData[nameKey] = siteDefault.name;
                changed = true;
            }
            if (!String(appData[phoneKey] || '').trim()) {
                appData[phoneKey] = siteDefault.phone;
                changed = true;
            }
            if (siteDefault.email && !String(appData[emailKey] || '').trim()) {
                appData[emailKey] = siteDefault.email;
                changed = true;
            }
        } else {
            if (String(appData[nameKey] || '').trim() === 'Tamara Kiernan' || String(appData[nameKey] || '').trim() === 'Adam Wojdyla') {
                delete appData[nameKey];
                changed = true;
            }
            if (String(appData[phoneKey] || '').trim() === '(585) 261-7818' || String(appData[phoneKey] || '').trim() === '716-604-7326') {
                delete appData[phoneKey];
                changed = true;
            }
        }
    });

    return changed;
}

function initializeDefaultRrhSharedContacts() {
    var changed = false;
    var rrhSiteIds = ['rgh', 'unity'];
    var rrhItHelpNumber = '585-922-4357';

    rrhSiteIds.forEach(function(siteId) {
        var key = fieldId(siteId, 'itHelp', 'name', 0);
        if (String(appData[key] || '').trim() !== rrhItHelpNumber) {
            appData[key] = rrhItHelpNumber;
            changed = true;
        }
    });

    return changed;
}
// --- BEGIN: Pre-populated MDA (Physician) data for all sites ---
var MDA_LIST = [
    { name: "Alan Lanni, MD", cell: "585-733-8008", company: "MDA", preferences: "" },
    { name: "Alex Rebelo, MD", cell: "954-609-1813", company: "MDA", preferences: "" },
    { name: "Alexis Leanza, MD", cell: "518-364-4996", company: "MDA", preferences: "" },
    { name: "Alexis Vangellow, MD", cell: "585-406-7647", company: "MDA", preferences: "" },
    { name: "Allison Fegley, MD", cell: "585-755-1361", company: "MDA", preferences: "" },
    { name: "Andy Vierhile, MD", cell: "585-721-1168", company: "MDA", preferences: "" },
    { name: "Arun Alagappan, MD", cell: "443-845-2454", company: "MDA", preferences: "" },
    { name: "Brad Davis, MD", cell: "804-338-8299", company: "MDA", preferences: "" },
    { name: "Brian Thomas, DO", cell: "585-330-0810", company: "MDA", preferences: "" },
    { name: "Carmen Cellura, MD", cell: "585-727-2899", company: "MDA", preferences: "" },
    { name: "Charlie Lu, MD", cell: "917-327-5612", company: "MDA", preferences: "" },
    { name: "Christie Perez-Johnson, MD", cell: "585-261-8898", company: "MDA", preferences: "" },
    { name: "Cody Lewis, DO", cell: "814-505-5127", company: "MDA", preferences: "" },
    { name: "Dieder Becks, MD", cell: "585-474-6194", company: "MDA", preferences: "" },
    { name: "Dino Salkic, DO", cell: "585-402-4704", company: "MDA", preferences: "" },
    { name: "Dino Korten, MD", cell: "585-749-2148", company: "MDA", preferences: "" },
    { name: "Deepthi Serra, DO", cell: "908-344-2196", company: "MDA", preferences: "" },
    { name: "David Taylor, MD", cell: "585-750-7778", company: "MDA", preferences: "" },
    { name: "Daniel Jedrysiak, MD", cell: "315-804-2550", company: "MDA", preferences: "" },
    { name: "Dominick Cortese, MD", cell: "585-703-4555", company: "MDA", preferences: "" },
    { name: "Dru Turk, MD", cell: "315-882-2888", company: "MDA", preferences: "" },
    { name: "Emily Fanciullo, MD", cell: "708-404-3995", company: "MDA", preferences: "" },
    { name: "Ernesto Marin, MD", cell: "585-298-5402", company: "MDA", preferences: "" },
    { name: "Frank Catanzaro, MD", cell: "585-329-9982", company: "MDA", preferences: "" },
    { name: "Gary Ritzel, MD", cell: "585-415-4482", company: "MDA", preferences: "" },
    { name: "Greg Previte, MD", cell: "585-278-8034", company: "MDA", preferences: "" },
    { name: "Hugh Brodie, MD", cell: "585-259-4379", company: "MDA", preferences: "" },
    { name: "James Deuel, MD", cell: "585-755-5618", company: "MDA", preferences: "" },
    { name: "Jeff Rosenberg, MD", cell: "585-739-7747", company: "MDA", preferences: "" },
    { name: "Jennifer Fichter, MD", cell: "585-752-5134", company: "MDA", preferences: "" },
    { name: "Jennifer Kendall, MD", cell: "585-330-4497", company: "MDA", preferences: "" },
    { name: "Jennifer Mogan, MD", cell: "585-750-4930", company: "MDA", preferences: "" },
    { name: "John Barbaccia, MD", cell: "585-507-1143", company: "MDA", preferences: "" },
    { name: "Jonathan Miller, MD", cell: "315-558-2011", company: "MDA", preferences: "" },
    { name: "Kenneth Fickling, MD", cell: "585-750-9101", company: "MDA", preferences: "" },
    { name: "Kurt Weissand, MD", cell: "585-738-8858", company: "MDA", preferences: "" },
    { name: "Lisa Rhodes, MD", cell: "585-737-2137", company: "MDA", preferences: "" },
    { name: "Matthew Sabo, MD", cell: "609-923-7986", company: "MDA", preferences: "" },
    { name: "Marvette West-Williams, MD", cell: "201-341-8639", company: "MDA", preferences: "" },
    { name: "Michael Carafos, MD", cell: "585-305-5143", company: "MDA", preferences: "" },
    { name: "Michael Davenport, MD", cell: "585-313-2571", company: "MDA", preferences: "" },
    { name: "Michael Detraglia, MD", cell: "585-734-5247", company: "MDA", preferences: "" },
    { name: "Michael Mulbury, MD", cell: "585-203-7779", company: "MDA", preferences: "" },
    { name: "Nancy Nguyen, MD", cell: "716-445-9519", company: "MDA", preferences: "" },
    { name: "Nicholas DaPrano, DO", cell: "315-857-3329", company: "MDA", preferences: "" },
    { name: "Pamela Becks, MD", cell: "585-474-6436", company: "MDA", preferences: "" },
    { name: "Paul Cross, DO", cell: "585-709-6655", company: "MDA", preferences: "" },
    { name: "Paul Guadagnino, MD", cell: "585-739-6545", company: "MDA", preferences: "" },
    { name: "Peter Gajdek, MD", cell: "585-784-0514", company: "MDA", preferences: "" },
    { name: "Robert Cafarell, MD", cell: "585-733-9122", company: "MDA", preferences: "" },
    { name: "Salvatore Mauro, MD", cell: "585-233-3056", company: "MDA", preferences: "" },
    { name: "Stephen Comella, MD", cell: "585-746-4723", company: "MDA", preferences: "" },
    { name: "Steve Giriyappa, MD", cell: "585-259-3987", company: "MDA", preferences: "" },
    { name: "Tegan Palma, MD", cell: "585-313-5350", company: "MDA", preferences: "" },
    { name: "Terry Baronos, MD", cell: "585-957-2484", company: "MDA", preferences: "" },
    { name: "Timothy Fung, MD", cell: "917-915-6368", company: "MDA", preferences: "" },
    { name: "Vito Potenza, MD", cell: "585-329-5603", company: "MDA", preferences: "" },
    { name: "Zaid Jumaily, MD", cell: "716-475-3191", company: "MDA", preferences: "" }
];
// --- END: Pre-populated MDA (Physician) data for all sites ---
var SITES = [
    { id: 'rgh', label: 'RGH - Rochester General Hospital' },
    { id: 'unity', label: 'Unity Hospital' },
    { id: 'stjoes', label: 'St. Joes' },
    { id: 'crause', label: 'Crause' },
    { id: 'smh', label: 'SMH - Strong Memorial Hospital' },
    { id: 'highland', label: 'Highland Hospital' }
];

var FIELDS = [
    { key: 'chargeCrna', label: 'Charge CRNA', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'anesthesiaTech', label: 'Anesthesia Tech', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'bloodBank', label: 'Blood Bank', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'lab', label: 'Lab', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'orPharmacyTech', label: 'OR Pharmacy Tech', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'orPharmacist', label: 'OR Pharmacist', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'mainPharmacy', label: 'Main Pharmacy', type: 'plain', placeholder: 'Phone number', section: 'Clinical Operations' },
    { key: 'itHelp', label: 'IT Help', type: 'plain', placeholder: 'Phone number', section: 'Facilities' },
    { key: 'parking', label: 'Parking', type: 'plain', placeholder: 'Phone number', section: 'Facilities' },
    { key: 'security', label: 'Security', type: 'plain', placeholder: 'Phone number', section: 'Facilities' },
    { key: 'additionalImportantNumber', label: 'Additional Number', type: 'contact', canRepeat: true, showAsTile: true, section: 'Facilities' },
    { key: 'preceptor', label: 'CRNAs', type: 'person-list', section: 'Team' },
    { key: 'anesthesiologist', label: 'MDA', type: 'person-list', section: 'Team' },
    { key: 'surgeon', label: 'Surgeons', type: 'person-list', section: 'Team' },
    { key: 'mensLocker', label: "Men's Locker", type: 'locker', section: 'General' },
    { key: 'womensLocker', label: "Women's Locker", type: 'locker', section: 'General' },
    { key: 'clinicalCoordinator', label: 'Clinical Coordinator', type: 'contact', canRepeat: true, section: 'General' },
    { key: 'notes', label: 'Site Notes', type: 'notes', section: 'General' }
];

var STORE_KEY_LEGACY = 'clinicalSitesData';
var STORE_KEY_SITE_PREFIX = 'clinicalSitesData__';
var FAVORITE_KEY = 'clinicalSitesFavorite';

var appData = {};
// --- BEGIN: Pre-populated CRNA and Locum CRNA data for RGH and Unity ---
var CRNA_LIST = [
    { name: "Olu Akinboboye", cell: "914-282-2101", company: "RRH CRNA", preferences: "" },
    { name: "Richard Allen", cell: "585-747-7947", company: "RRH CRNA", preferences: "" },
    { name: "Shanavia Barr", cell: "404-438-2350", company: "RRH CRNA", preferences: "" },
    { name: "Mark Blazey", cell: "585-734-0204", company: "RRH CRNA", preferences: "" },
    { name: "Ben Conley", cell: "585-738-9313", company: "RRH CRNA", preferences: "" },
    { name: "Ben Coria", cell: "410-708-5765", company: "RRH CRNA", preferences: "" },
    { name: "Jeff Cowden", cell: "423-664-3337", company: "RRH CRNA", preferences: "" },
    { name: "Ashley Davis", cell: "716-807-9540", company: "RRH CRNA", preferences: "" },
    { name: "Andrea Egbuna", cell: "718-300-9124", company: "RRH CRNA", preferences: "" },
    { name: "Kyara Francis", cell: "412-608-8321", company: "RRH CRNA", preferences: "" },
    { name: "Kurtis Goltermann", cell: "585-739-0758", company: "RRH CRNA", preferences: "" },
    { name: "Marissa Grammar", cell: "585-490-0323", company: "RRH CRNA", preferences: "" },
    { name: "Charles Heilman", cell: "631-252-2833", company: "RRH CRNA", preferences: "" },
    { name: "Nikki Keenan", cell: "585-472-4087", company: "RRH CRNA", preferences: "Miller > Mac" },
    { name: "Kendra Kraham", cell: "315-525-9256", company: "RRH CRNA", preferences: "" },
    { name: "Anna Kwaizer", cell: "716-308-3060", company: "RRH CRNA", preferences: "" },
    { name: "Eric Ramdas", cell: "631-885-5724", company: "RRH CRNA", preferences: "" },
    { name: "Jennifer Spilberg", cell: "585-820-9733", company: "RRH CRNA", preferences: "" },
    { name: "Tamara Kieran", cell: "585-261-7818", company: "RRH CRNA", preferences: "" },
    { name: "Greg Standish", cell: "585-315-7787", company: "RRH CRNA", preferences: "" },
    // Locum CRNAs
    { name: "Richard L. Allen", cell: "985-986-5719", company: "RRH Locum CRNA" },
    { name: "Marilyn \"Nikki\" Alleman", cell: "256-483-9427", company: "RRH Locum CRNA", preferences: "" },
    { name: "Denis Eta Awu", cell: "678-665-1056", company: "RRH Locum CRNA" },
    { name: "Charles Bartha", cell: "917-748-1987", company: "RRH Locum CRNA" },
    { name: "Keesha Bellamy", cell: "770-402-9927", company: "RRH Locum CRNA" },
    { name: "Francisco Betancourt", cell: "305-832-9176", company: "RRH Locum CRNA" },
    { name: "Jason Billings", cell: "404-791-1871", company: "RRH Locum CRNA" },
    { name: "McKenzie Boone", cell: "585-747-4621", company: "RRH Locum CRNA" },
    { name: "Erica Bryant", cell: "215-936-0170", company: "RRH Locum CRNA" },
    { name: "Nyvra Cadet", cell: "516-510-7619", company: "RRH Locum CRNA" },
    { name: "Danielle Cammarano", cell: "540-446-7229", company: "RRH Locum CRNA" },
    { name: "Laura Crespo", cell: "305-733-0378", company: "RRH Locum CRNA" },
    { name: "Naa Darko", cell: "917-228-4961", company: "RRH Locum CRNA" },
    { name: "Nick Donofrio", cell: "585-880-5641", company: "RRH Locum CRNA" },
    { name: "Nicole Elieze", cell: "912-313-3013", company: "RRH Locum CRNA" },
    { name: "Keri-Ann Elliott", cell: "954-557-9904", company: "RRH Locum CRNA" },
    { name: "Michelle Floyd", cell: "561-312-4490", company: "RRH Locum CRNA" },
    { name: "Loren Gaitan", cell: "305-877-5212", company: "RRH Locum CRNA" },
    { name: "Edwin Gavarrete", cell: "786-342-4124", company: "RRH Locum CRNA" },
    { name: "Cory George", cell: "504-388-6216", company: "RRH Locum CRNA" },
    { name: "Michelle Harmon", cell: "256-777-9158", company: "RRH Locum CRNA" },
    { name: "Monica Hartman", cell: "347-886-8013", company: "RRH Locum CRNA" },
    { name: "Jessica Hartwell", cell: "813-434-6684", company: "RRH Locum CRNA" },
    { name: "Misty Hastings", cell: "813-434-6684", company: "RRH Locum CRNA" },
    { name: "Christy Huerstel", cell: "985-969-4232", company: "RRH Locum CRNA" },
    { name: "Cynthia Joseph", cell: "347-216-4450", company: "RRH Locum CRNA" },
    { name: "Leah Karhan", cell: "601-954-7501", company: "RRH Locum CRNA" },
    { name: "Rajwinder Kaur", cell: "516-884-4900", company: "RRH Locum CRNA" },
    { name: "Joseph Knapich", cell: "718-926-7954", company: "RRH Locum CRNA" },
    { name: "Samuel Knight", cell: "619-961-8034", company: "RRH Locum CRNA" },
    { name: "Mary Knoles", cell: "313-530-6687", company: "RRH Locum CRNA" },
    { name: "Hal Lamb", cell: "985-320-5414", company: "RRH Locum CRNA" },
    { name: "Koudahin Lawson", cell: "540-486-1562", company: "RRH Locum CRNA" },
    { name: "Sabrenda Littles", cell: "832-607-0123", company: "RRH Locum CRNA" },
    { name: "Sherri Logan", cell: "256-504-5757", company: "RRH Locum CRNA" },
    { name: "Lillian Lukowski", cell: "727-644-3289", company: "RRH Locum CRNA" },
    { name: "Chaireline Lundi", cell: "954-612-5822", company: "RRH Locum CRNA" },
    { name: "Enrique Matta", cell: "407-580-7751", company: "RRH Locum CRNA" },
    { name: "Tiara McCaskill", cell: "305-340-7401", company: "RRH Locum CRNA" },
    { name: "Annette Mills", cell: "918-640-1652", company: "RRH Locum CRNA" },
    { name: "Jean-Marc Ndame", cell: "720-937-1705", company: "RRH Locum CRNA" },
    { name: "Charles Neering", cell: "804-247-4839", company: "RRH Locum CRNA" },
    { name: "Michael Nyinku", cell: "571-435-6980", company: "RRH Locum CRNA" },
    { name: "Michael Otte", cell: "786-514-8904", company: "RRH Locum CRNA" },
    { name: "Ana Pashchuk", cell: "585-899-9886", company: "RRH Locum CRNA" },
    { name: "Gisella Puga", cell: "901-483-1334", company: "RRH Locum CRNA" },
    { name: "Christy Putman", cell: "256-509-0997", company: "RRH Locum CRNA" },
    { name: "Priscilla Ramos", cell: "786-897-5797", company: "RRH Locum CRNA" },
    { name: "Richon Saunders", cell: "504-430-1493", company: "RRH Locum CRNA" },
    { name: "Shelbie Sosnowchick", cell: "205-907-1773", company: "RRH Locum CRNA" },
    { name: "Adam Taylor", cell: "443-743-6432", company: "RRH Locum CRNA" },
    { name: "Jason Tranquill", cell: "585-690-1210", company: "RRH Locum CRNA" },
    { name: "Jason Trudell", cell: "315-380-2405", company: "RRH Locum CRNA" },
    { name: "Anthony Viselli", cell: "484-941-4814", company: "RRH Locum CRNA" },
    { name: "Natassia Watson", cell: "813-435-8146", company: "RRH Locum CRNA" },
    { name: "Michael Wendel", cell: "201-341-8638", company: "RRH Locum CRNA" },
    { name: "Marvette West-Williams", cell: "201-341-8639", company: "RRH Locum CRNA" },
    { name: "Foaad Zaid", cell: "716-986-5142", company: "RRH Locum CRNA" },
    { name: "Jande Weeks", cell: "305-496-2968", company: "RRH Locum CRNA" }
];

// --- BEGIN: Pre-populated CRNA data for Crause ---
var CRAUSE_CRNA_LIST = [
    { name: "Adam Wojdyla", cell: "716-604-7326", company: "Crause CRNA", preferences: "" },
    { name: "Maria Borczuk", cell: "315-254-6263", company: "Crause CRNA", preferences: "" },
    { name: "Ken Cuda", cell: "315-256-8038", company: "Crause CRNA", preferences: "" },
    { name: "Joe Perkowski", cell: "315-317-4899", company: "Crause CRNA", preferences: "" },
    { name: "Joe Sciarrino", cell: "315-569-5456", company: "Crause CRNA", preferences: "" },
    { name: "Beth TenEyck", cell: "315-396-6258", company: "Crause CRNA", preferences: "" },
    { name: "Bryan Houck", cell: "607-423-4116", company: "Crause CRNA", preferences: "" },
    { name: "Charlie Au", cell: "512-296-8709", company: "Crause CRNA", preferences: "" },
    { name: "Julie Greenberg", cell: "917-750-1225", company: "Crause CRNA", preferences: "" },
    { name: "Stacie Tittamin", cell: "973-960-8417", company: "Crause CRNA", preferences: "" },
    { name: "Clyde Casimiro", cell: "917-650-6728", company: "Crause CRNA", preferences: "" },
    { name: "Alexander Igoe", cell: "518-859-8643", company: "Crause CRNA", preferences: "" },
    { name: "Kat Pinzon", cell: "954-274-1746", company: "Crause CRNA", preferences: "" },
    { name: "Marc Zabate", cell: "305-336-7455", company: "Crause CRNA", preferences: "" },
    { name: "Kristen Ryder", cell: "315-256-5276", company: "Crause CRNA", preferences: "" },
    { name: "Anthony Escano", cell: "631-569-1235", company: "Crause CRNA", preferences: "" },
    { name: "Jaspa K", cell: "678-431-9570", company: "Crause CRNA", preferences: "" },
    { name: "Shannon Meyers", cell: "315-409-6957", company: "Crause CRNA", preferences: "" },
    { name: "Luke", cell: "518-332-6118", company: "Crause CRNA", preferences: "" }
];
// --- END: Pre-populated CRNA data for Crause ---

// --- BEGIN: Pre-populated CRNA data for St. Joes ---
var STJOES_CRNA_LIST = [
    { name: "Aliu", cell: "315-657-7156", company: "St. Joes CRNA", preferences: "" },
    { name: "Alletzhauser", cell: "315-256-7309", company: "St. Joes CRNA", preferences: "" },
    { name: "Bauer", cell: "315-382-5130", company: "St. Joes CRNA", preferences: "" },
    { name: "Bell", cell: "315-247-8632", company: "St. Joes CRNA", preferences: "" },
    { name: "Bippus", cell: "315-439-4221", company: "St. Joes CRNA", preferences: "" },
    { name: "Bristow", cell: "315-559-0055", company: "St. Joes CRNA", preferences: "" },
    { name: "Crandall", cell: "315-744-2759", company: "St. Joes CRNA", preferences: "" },
    { name: "DeGennaro", cell: "518-605-2645", company: "St. Joes CRNA", preferences: "" },
    { name: "Diana", cell: "315-491-4927", company: "St. Joes CRNA", preferences: "" },
    { name: "Dodge", cell: "315-430-0024", company: "St. Joes CRNA", preferences: "" },
    { name: "Enders", cell: "315-430-2331", company: "St. Joes CRNA", preferences: "" },
    { name: "Fabian", cell: "315-391-2727", company: "St. Joes CRNA", preferences: "" },
    { name: "Fisher", cell: "315-256-8568", company: "St. Joes CRNA", preferences: "" },
    { name: "Fruces", cell: "315-532-4831", company: "St. Joes CRNA", preferences: "" },
    { name: "Gordon", cell: "315-657-0497", company: "St. Joes CRNA", preferences: "" },
    { name: "Graham", cell: "607-643-6957", company: "St. Joes CRNA", preferences: "" },
    { name: "Grant", cell: "518-569-1154", company: "St. Joes CRNA", preferences: "" },
    { name: "Hooko", cell: "607-821-8800", company: "St. Joes CRNA", preferences: "" },
    { name: "Locastro", cell: "315-283-4042", company: "St. Joes CRNA", preferences: "" },
    { name: "McCarthy", cell: "315-806-2553", company: "St. Joes CRNA", preferences: "" },
    { name: "Mosier", cell: "315-486-0228", company: "St. Joes CRNA", preferences: "" },
    { name: "O'Loughlin", cell: "315-481-3579", company: "St. Joes CRNA", preferences: "" },
    { name: "O'Shea", cell: "315-569-3369", company: "St. Joes CRNA", preferences: "" },
    { name: "Robinson", cell: "315-937-7462", company: "St. Joes CRNA", preferences: "" },
    { name: "Sellers", cell: "607-227-1912", company: "St. Joes CRNA", preferences: "" },
    { name: "Shanturov", cell: "315-481-9503", company: "St. Joes CRNA", preferences: "" },
    { name: "Sierra", cell: "757-642-0593", company: "St. Joes CRNA", preferences: "" },
    { name: "Smith", cell: "315-247-5939", company: "St. Joes CRNA", preferences: "" },
    { name: "Straigis", cell: "609-364-3063", company: "St. Joes CRNA", preferences: "" },
    { name: "Vanetti", cell: "315-877-1110", company: "St. Joes CRNA", preferences: "" },
    { name: "Walker", cell: "315-663-5147", company: "St. Joes CRNA", preferences: "" },
    { name: "Wisniewski", cell: "315-744-7034", company: "St. Joes CRNA", preferences: "" },
    { name: "Zauski", cell: "585-683-5473", company: "St. Joes CRNA", preferences: "" },
    { name: "Redfield", cell: "585-267-9814", company: "St. Joes CRNA", preferences: "" },
    { name: "Androshchuk", cell: "607-423-0555", company: "St. Joes CRNA", preferences: "" },
    { name: "Keoka Hunter", cell: "206-399-5452", company: "St. Joes CRNA", preferences: "" },
    { name: "Ed Milosz", cell: "423-794-7380", company: "St. Joes CRNA", preferences: "" },
    { name: "Adnan Huric", cell: "315-327-8530", company: "St. Joes CRNA", preferences: "" },
    { name: "Jason Miller", cell: "585-694-9956", company: "St. Joes CRNA", preferences: "" },
    { name: "Mark Kucharski", cell: "585-413-6412", company: "St. Joes CRNA", preferences: "" },
    { name: "Whitney Booth", cell: "585-233-3459", company: "St. Joes CRNA", preferences: "" }
];
// --- END: Pre-populated CRNA data for St. Joes ---

// --- BEGIN: Pre-populated MDA data for St. Joes ---
var STJOES_MDA_LIST = [
    { name: "Ascioti", cell: "315-491-7766", company: "St. Joes MDA", preferences: "" },
    { name: "Badran", cell: "315-350-4748", company: "St. Joes MDA", preferences: "" },
    { name: "Bryz-Gornia", cell: "315-506-5680", company: "St. Joes MDA", preferences: "" },
    { name: "Cady", cell: "315-436-0824", company: "St. Joes MDA", preferences: "" },
    { name: "Chanatry", cell: "315-256-2172", company: "St. Joes MDA", preferences: "" },
    { name: "Constantine", cell: "315-382-3156", company: "St. Joes MDA", preferences: "" },
    { name: "Corso", cell: "315-200-0798", company: "St. Joes MDA", preferences: "" },
    { name: "Dalton", cell: "315-278-6270", company: "St. Joes MDA", preferences: "" },
    { name: "Enany", cell: "315-420-8418", company: "St. Joes MDA", preferences: "" },
    { name: "Fetterman", cell: "315-877-2730", company: "St. Joes MDA", preferences: "" },
    { name: "Franckowiak", cell: "716-864-8978", company: "St. Joes MDA", preferences: "" },
    { name: "Leighton", cell: "914-482-2597", company: "St. Joes MDA", preferences: "" },
    { name: "Lubinga", cell: "315-529-1902", company: "St. Joes MDA", preferences: "" },
    { name: "Marino", cell: "607-239-1289", company: "St. Joes MDA", preferences: "" },
    { name: "McConn", cell: "315-427-5006", company: "St. Joes MDA", preferences: "" },
    { name: "Mcniff", cell: "315-383-9070", company: "St. Joes MDA", preferences: "" },
    { name: "Nelson", cell: "315-559-0375", company: "St. Joes MDA", preferences: "" },
    { name: "Puc", cell: "315-378-5787", company: "St. Joes MDA", preferences: "" },
    { name: "Rahaman", cell: "315-256-8383", company: "St. Joes MDA", preferences: "" },
    { name: "Santos", cell: "315-439-1018", company: "St. Joes MDA", preferences: "" },
    { name: "Thandla", cell: "716-353-3465", company: "St. Joes MDA", preferences: "" },
    { name: "Velez", cell: "315-200-2905", company: "St. Joes MDA", preferences: "" },
    { name: "Yulaman", cell: "832-598-6797", company: "St. Joes MDA", preferences: "" }
];
// --- END: Pre-populated MDA data for St. Joes ---

// --- END: Pre-populated CRNA and Locum CRNA data ---
var editState = {};
var expandedState = {};
var favoriteSiteId = '';
var activeSiteId = null; // null = site picker list, string = show that site only

function fieldId(siteId, fieldKey, part, rowIndex) {
    var suffix = rowIndex > 0 ? '__' + rowIndex : '';
    return siteId + '__' + fieldKey + '__' + part + suffix;
}

function countId(siteId, fieldKey) {
    return siteId + '__' + fieldKey + '__count';
}

function selectedId(siteId, fieldKey) {
    return siteId + '__' + fieldKey + '__selected';
}

function preferenceFieldId(siteId, fieldKey, rowIndex) {
    var suffix = rowIndex > 0 ? '__' + rowIndex : '';
    return siteId + '__' + fieldKey + '__preferences' + suffix;
}

function getPersonPreferencesValue(siteId, fieldKey, rowIndex) {
    var scopedKey = preferenceFieldId(siteId, fieldKey, rowIndex);
    if (Object.prototype.hasOwnProperty.call(appData, scopedKey)) {
        return String(appData[scopedKey] || '');
    }

    // Legacy fallback from the previously shared preferences key.
    var legacyKey = fieldId(siteId, 'preferences', 'memo', rowIndex);
    return String(appData[legacyKey] || '');
}

function setPersonPreferencesValue(siteId, fieldKey, rowIndex, value) {
    appData[preferenceFieldId(siteId, fieldKey, rowIndex)] = String(value || '');
}

function deletePersonPreferencesValue(siteId, fieldKey, rowIndex) {
    delete appData[preferenceFieldId(siteId, fieldKey, rowIndex)];
}

function siteStoreKey(siteId) {
    return STORE_KEY_SITE_PREFIX + siteId;
}

function getLinkedSiteId(siteId) {
    if (siteId === 'rgh') return 'unity';
    if (siteId === 'unity') return 'rgh';
    return '';
}

function isLinkedPersonField(siteId, fieldKey) {
    if (!getLinkedSiteId(siteId)) return false;
    return fieldKey === 'preceptor' || fieldKey === 'anesthesiologist' || fieldKey === 'surgeon';
}

function syncLinkedPersonField(siteId, fieldKey) {
    if (!isLinkedPersonField(siteId, fieldKey)) return false;

    var linkedSiteId = getLinkedSiteId(siteId);
    var sourceCount = parseInt(appData[countId(siteId, fieldKey)], 10);
    if (!(sourceCount > 0)) sourceCount = 1;

    var targetCount = parseInt(appData[countId(linkedSiteId, fieldKey)], 10);
    if (!(targetCount > 0)) targetCount = 1;

    var maxCount = Math.max(sourceCount, targetCount);
    var changed = false;

    for (var i = 0; i < maxCount; i++) {
        ['name', 'phone', 'memo'].forEach(function(part) {
            var sourceKey = fieldId(siteId, fieldKey, part, i);
            var targetKey = fieldId(linkedSiteId, fieldKey, part, i);

            if (i < sourceCount) {
                var nextValue = appData[sourceKey] || '';
                if (appData[targetKey] !== nextValue) {
                    appData[targetKey] = nextValue;
                    changed = true;
                }
            } else if (Object.prototype.hasOwnProperty.call(appData, targetKey)) {
                delete appData[targetKey];
                changed = true;
            }
        });

        if (i < sourceCount) {
            var nextPref = getPersonPreferencesValue(siteId, fieldKey, i);
            var currentTargetPref = getPersonPreferencesValue(linkedSiteId, fieldKey, i);
            if (currentTargetPref !== nextPref) {
                setPersonPreferencesValue(linkedSiteId, fieldKey, i, nextPref);
                changed = true;
            }
        } else if (Object.prototype.hasOwnProperty.call(appData, preferenceFieldId(linkedSiteId, fieldKey, i))) {
            deletePersonPreferencesValue(linkedSiteId, fieldKey, i);
            changed = true;
        }
    }

    if (appData[countId(linkedSiteId, fieldKey)] !== sourceCount) {
        appData[countId(linkedSiteId, fieldKey)] = sourceCount;
        changed = true;
    }

    var sourceSelected = parseInt(appData[selectedId(siteId, fieldKey)], 10);
    if (isNaN(sourceSelected) || sourceSelected < 0) sourceSelected = 0;
    if (sourceSelected >= sourceCount) sourceSelected = sourceCount - 1;
    var selectedValue = String(sourceSelected);
    if (appData[selectedId(linkedSiteId, fieldKey)] !== selectedValue) {
        appData[selectedId(linkedSiteId, fieldKey)] = selectedValue;
        changed = true;
    }

    return changed;
}

function clickableHref(value) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'mailto:' + value;
    }

    var compact = value.replace(/[()\-.\s]/g, '');
    if (/^\+?\d{7,}$/.test(compact)) {
        return 'tel:' + compact;
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (/^[^\s]+\.[^\s]+/.test(value) && !/\s/.test(value)) {
        return 'https://' + value;
    }

    return '';
}

function parseContactAction(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) return { kind: 'none', value: '' };

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { kind: 'email', value: trimmed };
    }

    var compact = trimmed.replace(/[()\-.\s]/g, '');
    if (/^\+?\d{7,}$/.test(compact)) {
        return { kind: 'phone', value: compact };
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return { kind: 'web', value: trimmed };
    }

    if (/^[^\s]+\.[^\s]+/.test(trimmed) && !/\s/.test(trimmed)) {
        return { kind: 'web', value: 'https://' + trimmed };
    }

    return { kind: 'none', value: '' };
}

function buildRowContactHref(site, field, rowIndex, nameValue, phoneValue, emailValue, memoValue) {
    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];

    var titleLabel = field.label + (rowIndex > 0 ? ' ' + (rowIndex + 1) : '');
    var displayName = (nameValue || '').trim();

    if (displayName) {
        lines.push('FN:' + sanitizeVcf(displayName));

        // N: field required by iOS/Android for proper first/last name import
        var parts = displayName.split(/\s+/);
        var nFirst = parts[0].replace(/[;\n]/g, '');
        var nLast  = (parts.length >= 2 ? parts.slice(1).join(' ') : '').replace(/[;\n]/g, '');
        lines.push('N:' + nLast + ';' + nFirst + ';;;');
    }

    if (phoneValue) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneValue)) {
            lines.push('EMAIL;TYPE=INTERNET:' + sanitizeVcf(phoneValue));
        } else if (/^https?:\/\//i.test(phoneValue) || (/^[^\s]+\.[^\s]+/.test(phoneValue) && !/\s/.test(phoneValue))) {
            var url = /^https?:\/\//i.test(phoneValue) ? phoneValue : 'https://' + phoneValue;
            lines.push('URL:' + sanitizeVcf(url));
        } else {
            // Use digits-only in vCard TEL line; TYPE=CELL shows as "mobile" on iOS/Android
            var digits = phoneValue.replace(/\D/g, '');
            lines.push('TEL;TYPE=CELL:' + digits);
        }
    }

    var explicitEmail = String(emailValue || '').trim();
    if (explicitEmail) {
        lines.push('EMAIL;TYPE=INTERNET:' + sanitizeVcf(explicitEmail));
    }

    var explicitOrg = String(memoValue || '').trim();
    var expectedOrg = getExpectedCompanyLabel(site.id, field.key);
    var fallbackOrg = expectedOrg || (field.label + ' - ' + site.label);
    // Non-RRH exports are always normalized to "<Hospital> <Role>".
    var orgLabel = (!isRrhSite(site.id) && expectedOrg) ? expectedOrg : (explicitOrg || fallbackOrg);
    lines.push('ORG:' + sanitizeVcf(orgLabel));
    lines.push('END:VCARD');
    return 'data:text/vcard;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
}

function sanitizeVcf(value) {
    return String(value).replace(/\n/g, ' ').replace(/;/g, ',').replace(/,/g, '\\,');
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escAttr(str) {
    return escHtml(str).replace(/'/g, '&#39;');
}

function fileSafe(label) {
    return String(label).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

function formatPhone(value) {
    var digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return '(' + digits;
    if (digits.length <= 6) return '(' + digits.slice(0,3) + ') ' + digits.slice(3);
    return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6);
}

var PHONE_FIELD_KEYS = (function() {
    var keys = {};
    FIELDS.forEach(function(f) {
        if (f.placeholder === 'Phone number') keys[f.key] = true;
    });
    return keys;
}());
