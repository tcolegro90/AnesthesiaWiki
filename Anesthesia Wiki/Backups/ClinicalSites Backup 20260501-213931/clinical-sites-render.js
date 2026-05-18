function getCoordinatorEmail(siteId, rowIndex) {
    return String(appData[fieldId(siteId, 'clinicalCoordinator', 'email', rowIndex)] || '').trim();
}

// Renders the action cell for a contact row (call, text, add contact)
function renderActionCell(site, field, rowIndex, nameValue, phoneValue, emailValue) {
    if (editState[site.id]) {
        if (field.canRepeat) {
            if (rowIndex > 0) {
                return '<button type="button" class="row-action-btn add-row" style="border-color:#e0b0b0;color:#b32424" onclick="removeRepeatRow(\'' + site.id + '\',\'' + field.key + '\',' + rowIndex + ')">&#10005; Remove</button>';
            }
            return '<button type="button" class="row-action-btn add-row" onclick="addRepeatRow(\'' + site.id + '\',\'' + field.key + '\',' + rowIndex + ')">+ Add row below</button>';
        }
        return '';
    }
    var actions = [];
    var phone = (phoneValue || '').trim();
    var name = (nameValue || '').trim();
    var email = (emailValue || '').trim();
    var memo = String(appData[fieldId(site.id, field.key, 'memo', rowIndex)] || '').trim();

    if (field.key === 'clinicalCoordinator') {
        var coordinatorAction = parseContactAction(phone);
        if (coordinatorAction.kind === 'phone') {
            actions.push('<a class="row-action-btn small" href="tel:' + escAttr(coordinatorAction.value) + '">Call</a>');
            actions.push('<a class="row-action-btn small" href="sms:' + escAttr(coordinatorAction.value) + '">Text</a>');
        } else {
            actions.push('<span class="row-action-btn small disabled" aria-disabled="true">Call</span>');
            actions.push('<span class="row-action-btn small disabled" aria-disabled="true">Text</span>');
        }

        if (email) {
            actions.push('<a class="row-action-btn small" href="mailto:' + escAttr(email) + '">Email</a>');
        } else {
            actions.push('<span class="row-action-btn small disabled" aria-disabled="true">Email</span>');
        }

        if (name || phone || email) {
            actions.push('<a class="row-action-btn small" href="' + buildRowContactHref(site, field, rowIndex, name, phone, email, memo) + '" download="' + fileSafe(site.label + '-' + field.label + (rowIndex > 0 ? '-' + (rowIndex + 1) : '')) + '.vcf">Add contact</a>');
        } else {
            actions.push('<span class="row-action-btn small disabled" aria-disabled="true">Add contact</span>');
        }

        return actions.length ? '<div class="row-actions-compact">' + actions.join('') + '</div>' : '';
    }

    var action = parseContactAction(phone);
    if (action.kind === 'phone') {
        actions.push('<a class="row-action-btn small" href="tel:' + escAttr(action.value) + '">Call</a>');
        actions.push('<a class="row-action-btn small" href="sms:' + escAttr(action.value) + '">Text</a>');
    } else if (action.kind === 'email') {
        actions.push('<a class="row-action-btn small" href="mailto:' + escAttr(action.value) + '">Email</a>');
    } else if (action.kind === 'web') {
        actions.push('<a class="row-action-btn small" href="' + escAttr(action.value) + '" target="_blank" rel="noreferrer">Open</a>');
    }
    // Allow adding contact if name or phone is present, except for surgeons
    if ((name || phone) && field.key !== 'surgeon') {
        actions.push('<a class="row-action-btn small" href="' + buildRowContactHref(site, field, rowIndex, name, phone, '', memo) + '" download="' + fileSafe(site.label + '-' + field.label + (rowIndex > 0 ? '-' + (rowIndex + 1) : '')) + '.vcf">Add contact to phone</a>');
    }
    return actions.length ? '<div class="row-actions">' + actions.join('') + '</div>' : '';
}

function getSiteDisplayLabel(site) {
    var mobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
    if (!mobile) return site.label;
    if (site.id === 'rgh') return 'RGH';
    if (site.id === 'smh') return 'SMH';
    return site.label;
}

function renderSitePicker(container) {
    var picker = document.createElement('div');
    picker.className = 'site-picker';
    var wipIds = { smh: true, highland: true };

    var mainSites = SITES.filter(function(s) { return !wipIds[s.id]; });
    var wipSites = SITES.filter(function(s) { return wipIds[s.id]; });

    function favoriteFirst(list) {
        return list.slice().sort(function(a, b) {
            if (a.id === favoriteSiteId) return -1;
            if (b.id === favoriteSiteId) return 1;
            return 0;
        });
    }

    function makeCard(site) {
        var card = document.createElement('div');
        card.className = 'site-picker-card';
        card.setAttribute('onclick', 'selectSite(\'' + site.id + '\')');
        card.innerHTML =
            '<span class="picker-label">' + escHtml(getSiteDisplayLabel(site)) + '</span>' +
            (favoriteSiteId === site.id ? '<span class="picker-fav">★</span>' : '');
        return card;
    }

    favoriteFirst(mainSites).forEach(function(site) { picker.appendChild(makeCard(site)); });

    if (wipSites.length) {
        var wipSection = document.createElement('div');
        wipSection.className = 'site-picker-section';
        wipSection.innerHTML = '<div class="site-picker-section-title">WIP sites</div>';
        favoriteFirst(wipSites).forEach(function(site) {
            wipSection.appendChild(makeCard(site));
        });
        picker.appendChild(wipSection);
    }

    container.appendChild(picker);
}

function isSingleEditPersonField(fieldKey) {
    return fieldKey === 'preceptor' || fieldKey === 'anesthesiologist' || fieldKey === 'surgeon';
}

var personPreferencesEditState = {};
var personRowEditState = {};

function personPreferencesEditKey(siteId, fieldKey, rowIndex) {
    return siteId + '__' + fieldKey + '__prefedit__' + rowIndex;
}

function isEditingPersonPreferences(siteId, fieldKey, rowIndex) {
    return Boolean(personPreferencesEditState[personPreferencesEditKey(siteId, fieldKey, rowIndex)]);
}

function togglePersonPreferencesEdit(siteId, fieldKey, rowIndex) {
    personPreferencesEditState = {};
    personPreferencesEditState[personPreferencesEditKey(siteId, fieldKey, rowIndex)] = true;
    buildUI();
}

function closePersonPreferencesEdit() {
    personPreferencesEditState = {};
    buildUI();
}

function personRowEditKey(siteId, fieldKey) {
    return siteId + '__' + fieldKey + '__rowedit';
}

function isEditingPersonRow(siteId, fieldKey) {
    return Boolean(personRowEditState[personRowEditKey(siteId, fieldKey)]);
}

function startPersonRowEdit(siteId, fieldKey) {
    var count = parseInt(appData[countId(siteId, fieldKey)], 10);
    if (!(count > 0)) {
        count = 1;
        appData[countId(siteId, fieldKey)] = count;
    }

    var selIdx = parseInt(getSelectedContactValue(siteId, fieldKey), 10);
    if (isNaN(selIdx) || selIdx < 0 || selIdx >= count) {
        selIdx = 0;
        setSelectedContactValue(siteId, fieldKey, selIdx);
    }

    personRowEditState = {};
    personRowEditState[personRowEditKey(siteId, fieldKey)] = true;
    buildUI();
}

function cancelPersonRowEdit() {
    personRowEditState = {};
    buildUI();
}

function savePersonRowEdit() {
    if (activeSiteId && typeof syncLinkedPersonField === 'function') {
        syncLinkedPersonField(activeSiteId, 'surgeon');
    }
    personRowEditState = {};
    saveAll();
    buildUI();
}

function savePersonPreferencesEdit(siteId, fieldKey, rowIndex) {
    var textareaId = 'pref-edit-' + siteId + '-' + fieldKey + '-' + rowIndex;
    var input = document.getElementById(textareaId);
    if (!input) {
        closePersonPreferencesEdit();
        return;
    }
    if (typeof setPersonPreferencesValue === 'function') {
        setPersonPreferencesValue(siteId, fieldKey, rowIndex, input.value);
    } else {
        appData[fieldId(siteId, 'preferences', 'memo', rowIndex)] = input.value;
    }
    if (typeof syncLinkedPersonField === 'function') {
        syncLinkedPersonField(siteId, fieldKey);
    }
    personPreferencesEditState = {};
    saveAll();
    buildUI();
}

function getPersonSortLabel(person) {
    var name = String(person.name || '').trim();
    if (name) return name;
    var phone = String(person.phone || '').trim();
    if (phone) return phone;
    return 'Entry ' + (person.idx + 1);
}

function sortPeopleAlphabetical(people) {
    return people.slice().sort(function(a, b) {
        return getPersonSortLabel(a).toLowerCase().localeCompare(getPersonSortLabel(b).toLowerCase());
    });
}

function isLocalOnlySelectedField(fieldKey) {
    return fieldKey === 'preceptor' || fieldKey === 'anesthesiologist' || fieldKey === 'surgeon';
}

function localSelectedStorageKey(siteId, fieldKey) {
    return 'clinicalSitesLocalSelected__' + siteId + '__' + fieldKey;
}

function getSelectedContactValue(siteId, fieldKey) {
    if (isLocalOnlySelectedField(fieldKey)) {
        try {
            return localStorage.getItem(localSelectedStorageKey(siteId, fieldKey)) || '';
        } catch (e) {
            return '';
        }
    }
    return String(appData[selectedId(siteId, fieldKey)] || '');
}

function setSelectedContactValue(siteId, fieldKey, value) {
    var next = String(value == null ? '' : value);
    if (isLocalOnlySelectedField(fieldKey)) {
        try {
            localStorage.setItem(localSelectedStorageKey(siteId, fieldKey), next);
        } catch (e) {
        }
        return;
    }
    appData[selectedId(siteId, fieldKey)] = next;
}

var personListViewState = {};

function personListViewKey(siteId, fieldKey) {
    return siteId + '__' + fieldKey + '__listview';
}

function getPersonListViewState(siteId, fieldKey) {
    var key = personListViewKey(siteId, fieldKey);
    if (!personListViewState[key]) {
        personListViewState[key] = { searchQuery: '' };
    }
    return personListViewState[key];
}

function isSearchEnabledPersonField(fieldKey) {
    return fieldKey === 'preceptor' || fieldKey === 'anesthesiologist';
}

function normalizePersonNameParts(name) {
    var trimmed = String(name || '').trim();
    if (!trimmed) return { first: '', last: '' };

    var commaParts = trimmed.split(',');
    if (commaParts.length > 1) {
        var lastComma = String(commaParts[0] || '').trim();
        var firstComma = String(commaParts.slice(1).join(' ') || '').trim();
        return { first: firstComma.toLowerCase(), last: lastComma.toLowerCase() };
    }

    var tokens = trimmed.split(/\s+/).filter(function(tok) { return tok; });
    if (!tokens.length) return { first: '', last: '' };

    var suffixes = {
        'jr': true, 'jr.': true, 'sr': true, 'sr.': true,
        'ii': true, 'iii': true, 'iv': true
    };
    var lastIdx = tokens.length - 1;
    while (lastIdx > 0 && suffixes[String(tokens[lastIdx] || '').toLowerCase()]) {
        lastIdx -= 1;
    }

    return {
        first: String(tokens[0] || '').toLowerCase(),
        last: String(tokens[lastIdx] || tokens[0] || '').toLowerCase()
    };
}

function personSortKey(person) {
    var label = getPersonSortLabel(person).toLowerCase();
    var name = String(person.name || '').trim();
    if (!name) return label;
    var parts = normalizePersonNameParts(name);
    return (parts.first + ' ' + parts.last).trim();
}

function getVisiblePeople(siteId, fieldKey, people) {
    var state = getPersonListViewState(siteId, fieldKey);
    var q = isSearchEnabledPersonField(fieldKey)
        ? String(state.searchQuery || '').trim().toLowerCase()
        : '';

    var filtered = people.filter(function(person) {
        if (!q) return true;
        var name = String(person.name || '').toLowerCase();
        var phone = String(person.phone || '').toLowerCase();
        return name.indexOf(q) !== -1 || phone.indexOf(q) !== -1;
    });

    return filtered.slice().sort(function(a, b) {
        var aKey = personSortKey(a);
        var bKey = personSortKey(b);
        var cmp = aKey.localeCompare(bKey);
        if (cmp !== 0) return cmp;
        return getPersonSortLabel(a).toLowerCase().localeCompare(getPersonSortLabel(b).toLowerCase());
    });
}

function renderPersonListControls(siteId, fieldKey) {
    if (!isSearchEnabledPersonField(fieldKey)) return '';
    var state = getPersonListViewState(siteId, fieldKey);
    var searchId = 'pl-search-' + siteId + '-' + fieldKey;

    return '<div class="person-list-controls">'
        + '<input id="' + escAttr(searchId) + '" class="pl-search-input" type="text" placeholder="Search names" value="' + escAttr(state.searchQuery || '') + '" oninput="setPersonListSearch(\'' + siteId + '\',\'' + fieldKey + '\', this.value)">'
        + '</div>';
}

function getPersonSelectAttributes(siteId, fieldKey, optionCount) {
    if (!isSearchEnabledPersonField(fieldKey)) return '';
    var state = getPersonListViewState(siteId, fieldKey);
    var hasSearch = Boolean(String(state.searchQuery || '').trim());
    if (!hasSearch || optionCount <= 1) return '';
    var size = Math.min(8, optionCount);
    return ' size="' + size + '" class="compact-select compact-select-open"';
}

function setPersonListSearch(siteId, fieldKey, query) {
    if (!isSearchEnabledPersonField(fieldKey)) return;
    var state = getPersonListViewState(siteId, fieldKey);
    state.searchQuery = String(query || '');
    buildUI();

    var inputId = 'pl-search-' + siteId + '-' + fieldKey;
    var input = document.getElementById(inputId);
    if (input) {
        input.focus();
        var len = state.searchQuery.length;
        if (typeof input.setSelectionRange === 'function') input.setSelectionRange(len, len);
    }
}

function getPersonMemoPlaceholder(fieldKey) {
    return fieldKey === 'surgeon' ? 'Surgical Specialty...' : 'Notes about this person...';
}

function getPreferenceLines(value) {
    return String(value || '')
        .split('\n')
        .map(function(line) {
            return line.replace(/^\s*[\u2022\-*]+\s*/, '').trim();
        })
        .filter(function(line) { return line; });
}

function formatPreferencesForEditor(value) {
    var lines = getPreferenceLines(value);
    if (!lines.length) return '';
    return lines.map(function(line) { return '\u2022 ' + line; }).join('\n');
}

function renderPreferencesEmptyHint() {
    return '<span class="value-empty pref-empty-hint">Click the Edit button to add preferences here</span>';
}

function buildUI() {
    var container = document.getElementById('sites-container');
    container.innerHTML = '';

    if (!activeSiteId) {
        renderSitePicker(container);
        return;
    }

    var site = SITES.find(function(s) { return s.id === activeSiteId; });
    if (!site) { activeSiteId = null; renderSitePicker(container); return; }

    var card = document.createElement('div');
    card.className = 'site-card' + (editState[site.id] ? ' editing' : '');

    var header = document.createElement('div');
    header.className = 'site-card-header';
    header.innerHTML =
        '<div class="site-title"><span>' + escHtml(getSiteDisplayLabel(site)) + '</span>' + (favoriteSiteId === site.id ? '<span class="favorite-star">★</span>' : '') + '</div>' +
        '<div class="site-actions">' +
            '<button type="button" class="site-action-btn favorite-btn' + (favoriteSiteId === site.id ? ' active' : '') + '" onclick="toggleFavorite(\'' + site.id + '\')">' + (favoriteSiteId === site.id ? '&#9733;' : '&#9734;') + '</button>' +
            '<button type="button" class="site-action-btn edit-btn" onclick="toggleEdit(\'' + site.id + '\')">' + (editState[site.id] ? 'Save' : 'Edit') + '</button>' +
            '<button type="button" class="site-action-btn all-sites-btn" onclick="backToSites()">All Sites</button>' +
        '</div>';
    card.appendChild(header);

    var body = document.createElement('div');
    body.className = 'site-card-body';

    var plainFields = FIELDS.filter(function(f) { return f.type === 'plain'; });
    var otherFields = FIELDS.filter(function(f) { return f.type !== 'plain' && !f.showAsTile; });

    if (editState[site.id]) {
        var editTable = document.createElement('table');
        var editTbody = document.createElement('tbody');
        FIELDS.forEach(function(field) {
            if (field.type === 'person-list') { editTbody.appendChild(renderPersonListSection(site, field)); return; }
            if (field.canRepeat) {
                var rc = getRepeatCount(site.id, field.key);
                for (var i = 0; i < rc; i++) { editTbody.appendChild(renderRow(site, field, i)); }
            } else {
                editTbody.appendChild(renderRow(site, field, 0));
            }
        });
        editTable.appendChild(editTbody);
        body.appendChild(editTable);
    } else {
        var tilesGrid = document.createElement('div');
        tilesGrid.className = 'plain-tiles';
        var tileCount = 0;
        plainFields.forEach(function(field) {
            var value = String(appData[fieldId(site.id, field.key, 'name', 0)] || '').trim();
            if (!value) return;
            var action = parseContactAction(value);
            var href = action.kind === 'phone' ? 'tel:' + action.value
                     : action.kind === 'email' ? 'mailto:' + action.value : null;
            if (!href) return;
            var tile = document.createElement('a');
            tile.className = 'plain-tile';
            tile.href = href;
            tile.textContent = field.label;
            tilesGrid.appendChild(tile);
            tileCount++;
        });
        var tileShowFields = FIELDS.filter(function(f) { return f.showAsTile; });
        tileShowFields.forEach(function(field) {
            var rc = getRepeatCount(site.id, field.key);
            for (var ti = 0; ti < rc; ti++) {
                var tileName = String(appData[fieldId(site.id, field.key, 'name', ti)] || '').trim();
                var tilePhone = String(appData[fieldId(site.id, field.key, 'phone', ti)] || '').trim();
                if (!tilePhone) continue;
                var tAction = parseContactAction(tilePhone);
                var tHref = tAction.kind === 'phone' ? 'tel:' + tAction.value
                          : tAction.kind === 'email' ? 'mailto:' + tAction.value : null;
                if (!tHref) continue;
                var tile = document.createElement('a');
                tile.className = 'plain-tile';
                tile.href = tHref;
                tile.textContent = tileName || field.label;
                tilesGrid.appendChild(tile);
                tileCount++;
            }
        });
        if (tileCount) {
            body.appendChild(tilesGrid);
            var tilesGap = document.createElement('div');
            tilesGap.className = 'plain-tiles-gap';
            body.appendChild(tilesGap);
        }

        var viewTable = document.createElement('table');
        var viewTbody = document.createElement('tbody');
        otherFields.forEach(function(field) {
            if (field.type === 'person-list') { viewTbody.appendChild(renderPersonListSection(site, field)); return; }
            if (field.canRepeat) {
                var rc2 = getRepeatCount(site.id, field.key);
                for (var j = 0; j < rc2; j++) { viewTbody.appendChild(renderRow(site, field, j)); }
            } else {
                viewTbody.appendChild(renderRow(site, field, 0));
            }
        });
        viewTable.appendChild(viewTbody);
        body.appendChild(viewTable);
    }

    card.appendChild(body);
    container.appendChild(card);
}

function renderPersonListSection(site, field) {
    var tr = document.createElement('tr');
    tr.className = 'data-row row-person-list';

    var count = parseInt(appData[countId(site.id, field.key)], 10);
    if (!(count > 0)) count = 1;

    if (editState[site.id]) {
        if (isSingleEditPersonField(field.key)) {
            var allPeople = [];
            for (var e = 0; e < count; e++) {
                allPeople.push({
                    idx: e,
                    name: String(appData[fieldId(site.id, field.key, 'name', e)] || ''),
                    phone: String(appData[fieldId(site.id, field.key, 'phone', e)] || ''),
                    memo: String(appData[fieldId(site.id, field.key, 'memo', e)] || ''),
                    preferences: typeof getPersonPreferencesValue === 'function' ? getPersonPreferencesValue(site.id, field.key, e) : String(appData[fieldId(site.id, 'preferences', 'memo', e)] || '')
                });
            }

            var sortedEditPeople = getVisiblePeople(site.id, field.key, allPeople);
            var selectedEditIdx = parseInt(getSelectedContactValue(site.id, field.key), 10);
            var selectedExists = sortedEditPeople.some(function(person) { return person.idx === selectedEditIdx; });
            if (!selectedExists) {
                selectedEditIdx = sortedEditPeople.length ? sortedEditPeople[0].idx : 0;
            }
            var selectedEditPerson = sortedEditPeople.find(function(person) { return person.idx === selectedEditIdx; }) || allPeople[0];

            var editHtmlSingle = '<td class="label-cell">' + escHtml(field.label) + '</td><td colspan="3" style="padding:8px 10px 8px 0">';
            editHtmlSingle += renderPersonListControls(site.id, field.key);
            if (sortedEditPeople.length > 0) {
                editHtmlSingle += '<div class="pl-select-row">';
                var editSelectAttrs = getPersonSelectAttributes(site.id, field.key, sortedEditPeople.length);
                editHtmlSingle += '<select' + (editSelectAttrs || ' class="compact-select"') + ' onchange="setSelectedContact(\'' + site.id + '\',\'' + field.key + '\',this.value)">';
                sortedEditPeople.forEach(function(person) {
                    var personLabel = getPersonSortLabel(person);
                    editHtmlSingle += '<option value="' + person.idx + '"' + (person.idx === selectedEditIdx ? ' selected' : '') + '>' + escHtml(personLabel) + '</option>';
                });
                editHtmlSingle += '</select>';
                editHtmlSingle += '</div>';
            } else {
                editHtmlSingle += '<div class="person-subline">No matching names</div>';
            }

            if (selectedEditPerson) {
                editHtmlSingle += '<div class="person-edit-block">';
                editHtmlSingle += '<div class="pe-row">';
                editHtmlSingle += '<input class="contact-input pe-name" type="text" placeholder="Name" value="' + escAttr(selectedEditPerson.name) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + selectedEditPerson.idx + '">';
                editHtmlSingle += '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(selectedEditPerson.phone) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + selectedEditPerson.idx + '">';
                if (count > 1) {
                    editHtmlSingle += '<button type="button" class="pe-remove-btn" onclick="removePersonEntry(\'' + site.id + '\',\'' + field.key + '\',' + selectedEditPerson.idx + ')" title="Remove">&#10005;</button>';
                }
                editHtmlSingle += '</div>';
                editHtmlSingle += '<textarea class="pe-notes" placeholder="Notes about this person..." data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="memo" data-row-index="' + selectedEditPerson.idx + '">' + escHtml(selectedEditPerson.memo) + '</textarea>';
                editHtmlSingle += '<textarea class="pe-notes" placeholder="Preferences..." data-site-id="' + site.id + '" data-field-key="preferences" data-linked-field-key="' + field.key + '" data-part="memo" data-row-index="' + selectedEditPerson.idx + '">' + escHtml(selectedEditPerson.preferences) + '</textarea>';
                editHtmlSingle += '</div>';
            }

            editHtmlSingle += '<button type="button" class="pe-add-btn" onclick="addPersonEntry(\'' + site.id + '\',\'' + field.key + '\')">' + '+ Add ' + escHtml(field.label) + '</button>';
            editHtmlSingle += '</td>';
            tr.innerHTML = editHtmlSingle;
            return tr;
        }

        var editHtml = '<td class="label-cell">' + escHtml(field.label) + '</td><td colspan="3" style="padding:8px 10px 8px 0">';
        for (var i = 0; i < count; i++) {
            var nameVal = String(appData[fieldId(site.id, field.key, 'name', i)] || '');
            var phoneVal = String(appData[fieldId(site.id, field.key, 'phone', i)] || '');
            var memoVal = String(appData[fieldId(site.id, field.key, 'memo', i)] || '');
            var prefVal = typeof getPersonPreferencesValue === 'function' ? getPersonPreferencesValue(site.id, field.key, i) : String(appData[fieldId(site.id, 'preferences', 'memo', i)] || '');
            editHtml += '<div class="person-edit-block">';
            editHtml += '<div class="pe-row">';
            editHtml += '<input class="contact-input pe-name" type="text" placeholder="Name" value="' + escAttr(nameVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + i + '">';
            editHtml += '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(phoneVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + i + '">';
            if (i > 0) {
                editHtml += '<button type="button" class="pe-remove-btn" onclick="removePersonEntry(\'' + site.id + '\',\'' + field.key + '\',' + i + ')" title="Remove">&#10005;</button>';
            }
            editHtml += '</div>';
                editHtml += '<textarea class="pe-notes" placeholder="' + escAttr(getPersonMemoPlaceholder(field.key)) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="memo" data-row-index="' + i + '">' + escHtml(memoVal) + '</textarea>';
            editHtml += '<textarea class="pe-notes" placeholder="Preferences..." data-site-id="' + site.id + '" data-field-key="preferences" data-linked-field-key="' + field.key + '" data-part="memo" data-row-index="' + i + '">' + escHtml(prefVal) + '</textarea>';
            editHtml += '</div>';
        }
        editHtml += '<button type="button" class="pe-add-btn" onclick="addPersonEntry(\'' + site.id + '\',\'' + field.key + '\')">' + '+ Add ' + escHtml(field.label) + '</button>';
        editHtml += '</td>';
        tr.innerHTML = editHtml;
    } else {
        var people = [];
        for (var j = 0; j < count; j++) {
            var n = String(appData[fieldId(site.id, field.key, 'name', j)] || '').trim();
            var p = String(appData[fieldId(site.id, field.key, 'phone', j)] || '').trim();
            var m = String(appData[fieldId(site.id, field.key, 'memo', j)] || '').trim();
            var pref = (typeof getPersonPreferencesValue === 'function' ? getPersonPreferencesValue(site.id, field.key, j) : String(appData[fieldId(site.id, 'preferences', 'memo', j)] || '')).trim();
            if (!n && !p && !m && !pref) continue;
            people.push({ idx: j, name: n, phone: p, memo: m, preferences: pref });
        }
        if (isSingleEditPersonField(field.key)) {
            people = getVisiblePeople(site.id, field.key, people);
        }

        var selIdx = parseInt(getSelectedContactValue(site.id, field.key), 10);
        var hasSelected = people.some(function(person) { return person.idx === selIdx; });
        if (!hasSelected) selIdx = -1;
        var sel = people.find(function(person) { return person.idx === selIdx; }) || null;
        var isPrefEditOpen = sel && isSingleEditPersonField(field.key) && isEditingPersonPreferences(site.id, field.key, sel.idx);
        var isRowEditOpen = field.key === 'surgeon' && isEditingPersonRow(site.id, field.key);
        var rowEditIdx = parseInt(getSelectedContactValue(site.id, field.key), 10);
        if (isNaN(rowEditIdx) || rowEditIdx < 0) rowEditIdx = 0;
        var rowEditPerson = null;
        if (isRowEditOpen && field.key === 'surgeon') {
            rowEditPerson = {
                idx: rowEditIdx,
                name: String(appData[fieldId(site.id, field.key, 'name', rowEditIdx)] || ''),
                phone: String(appData[fieldId(site.id, field.key, 'phone', rowEditIdx)] || ''),
                memo: String(appData[fieldId(site.id, field.key, 'memo', rowEditIdx)] || ''),
                preferences: typeof getPersonPreferencesValue === 'function' ? getPersonPreferencesValue(site.id, field.key, rowEditIdx) : String(appData[fieldId(site.id, 'preferences', 'memo', rowEditIdx)] || '')
            };
        }

        var viewHtml = '<td class="label-cell">' + escHtml(field.label) + '</td>';
        if (!people.length) {
            if (isRowEditOpen) {
                viewHtml += '<td class="name-cell" colspan="2">';
                viewHtml += '<div class="person-edit-block">';
                viewHtml += '<div class="pe-row">';
                viewHtml += '<input class="contact-input pe-name" type="text" placeholder="Name" value="' + escAttr(String(appData[fieldId(site.id, field.key, 'name', 0)] || '')) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="0">';
                viewHtml += '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(String(appData[fieldId(site.id, field.key, 'phone', 0)] || '')) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="0">';
                viewHtml += '</div>';
                viewHtml += '<textarea class="pe-notes" placeholder="Surgical Specialty..." data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="memo" data-row-index="0">' + escHtml(String(appData[fieldId(site.id, field.key, 'memo', 0)] || '')) + '</textarea>';
                viewHtml += '<textarea class="pe-notes" placeholder="Preferences..." data-site-id="' + site.id + '" data-field-key="preferences" data-linked-field-key="' + field.key + '" data-part="memo" data-row-index="0">' + escHtml(typeof getPersonPreferencesValue === 'function' ? getPersonPreferencesValue(site.id, field.key, 0) : String(appData[fieldId(site.id, 'preferences', 'memo', 0)] || '')) + '</textarea>';
                viewHtml += '</div>';
                viewHtml += '</td>';
                viewHtml += '<td class="action-cell"><div class="row-actions"><button type="button" class="row-action-btn small" onclick="savePersonRowEdit()">Save</button><button type="button" class="row-action-btn small" onclick="cancelPersonRowEdit()">Cancel</button></div></td>';
            } else {
                var emptyMsg = 'None added yet';
                if (isSingleEditPersonField(field.key)) {
                    var stateEmpty = getPersonListViewState(site.id, field.key);
                    if (String(stateEmpty.searchQuery || '').trim()) emptyMsg = 'No matching names';
                }
                viewHtml += '<td class="name-cell" colspan="2">';
                if (isSingleEditPersonField(field.key)) {
                    viewHtml += renderPersonListControls(site.id, field.key);
                }
                viewHtml += '<span class="value-empty">' + escHtml(emptyMsg) + '</span></td><td class="action-cell">';
                if (field.key === 'surgeon') {
                    viewHtml += '<div class="row-actions"><button type="button" class="row-action-btn small" onclick="addPersonEntry(\'' + site.id + '\',\'' + field.key + '\')">Add Surgeon</button><button type="button" class="row-action-btn small" onclick="startPersonRowEdit(\'' + site.id + '\',\'' + field.key + '\')">Edit</button></div>';
                }
                viewHtml += '</td>';
            }
        } else {
            var inlinePrefLines = sel && (field.key === 'preceptor' || field.key === 'anesthesiologist') ? getPreferenceLines(sel.preferences || '') : [];
            var surgeonEditPerson = null;
            if (isRowEditOpen && field.key === 'surgeon') {
                surgeonEditPerson = rowEditPerson || sel || { idx: 0, name: '', phone: '', memo: '', preferences: '' };
            }
            viewHtml += '<td class="name-cell" style="padding:4px 0">';
            if (isSingleEditPersonField(field.key)) {
                viewHtml += renderPersonListControls(site.id, field.key);
            }
            var viewSelectAttrs = getPersonSelectAttributes(site.id, field.key, people.length + 1);
            var selectHtml = '<select' + (viewSelectAttrs || ' class="compact-select"') + ' onchange="setSelectedContact(\'' + site.id + '\',\'' + field.key + '\',this.value)">';
            selectHtml += '<option value="-1"' + (selIdx === -1 ? ' selected' : '') + '>— Select —</option>';
            people.forEach(function(person) {
                var label = getPersonSortLabel(person);
                selectHtml += '<option value="' + person.idx + '"' + (person.idx === selIdx ? ' selected' : '') + '>' + escHtml(label) + '</option>';
            });
            selectHtml += '</select>';
            if (field.key === 'surgeon' && !isRowEditOpen) {
                viewHtml += '<div class="surgeon-select-inline">' + selectHtml + '<button type="button" class="row-action-btn small mobile-inline-add" onclick="addPersonEntry(\'' + site.id + '\',\'' + field.key + '\')">Add Surgeon</button></div>';
            } else {
                viewHtml += selectHtml;
            }
            if (sel && (field.key === 'preceptor' || field.key === 'anesthesiologist')) {
                if (isPrefEditOpen) {
                    viewHtml += '<textarea class="pe-notes inline-pref-editor" id="pref-edit-' + site.id + '-' + field.key + '-' + sel.idx + '" placeholder="Preferences...">' + escHtml(sel.preferences || '') + '</textarea>';
                } else if (inlinePrefLines.length) {
                    viewHtml += '<ul class="pl-memo">' + inlinePrefLines.map(function(line) { return '<li>' + escHtml(line) + '</li>'; }).join('') + '</ul>';
                } else {
                    viewHtml += renderPreferencesEmptyHint();
                }
            }
            if (sel && field.key === 'surgeon' && !isRowEditOpen) {
                var surgeonPrefLines = getPreferenceLines(sel.preferences || '');
                if (sel.memo) {
                    viewHtml += '<div class="person-detail-line"><strong>Specialty:</strong> ' + escHtml(sel.memo) + '</div>';
                }
                if (surgeonPrefLines.length) {
                    viewHtml += '<ul class="pl-memo">' + surgeonPrefLines.map(function(line) { return '<li>' + escHtml(line) + '</li>'; }).join('') + '</ul>';
                }
            }
            if (surgeonEditPerson) {
                viewHtml += '<div class="person-edit-block">';
                viewHtml += '<div class="pe-row">';
                viewHtml += '<input class="contact-input pe-name" type="text" placeholder="Name" value="' + escAttr(surgeonEditPerson.name || '') + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + surgeonEditPerson.idx + '">';
                viewHtml += '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(surgeonEditPerson.phone || '') + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + surgeonEditPerson.idx + '">';
                viewHtml += '</div>';
                viewHtml += '<textarea class="pe-notes" placeholder="Surgical Specialty..." data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="memo" data-row-index="' + surgeonEditPerson.idx + '">' + escHtml(surgeonEditPerson.memo || '') + '</textarea>';
                viewHtml += '<textarea class="pe-notes" placeholder="Preferences..." data-site-id="' + site.id + '" data-field-key="preferences" data-linked-field-key="' + field.key + '" data-part="memo" data-row-index="' + surgeonEditPerson.idx + '">' + escHtml(surgeonEditPerson.preferences || '') + '</textarea>';
                viewHtml += '</div>';
            }
            viewHtml += '</td>';
            viewHtml += '<td class="notes-cell" style="padding:4px 0">';
            if (sel && (sel.memo || sel.preferences)) {
                var prefLines = getPreferenceLines(sel.preferences || '');
                if (field.key !== 'preceptor' && field.key !== 'anesthesiologist' && field.key !== 'surgeon') {
                    var notesLines = [];
                    if (sel.memo && !(field.key === 'anesthesiologist' && (sel.memo === 'MDA' || sel.memo === 'RRH MDA'))) {
                        notesLines.push(sel.memo);
                    }
                    if (prefLines.length) {
                        notesLines = notesLines.concat(prefLines);
                    }
                    if (notesLines.length) {
                        viewHtml += '<ul class="pl-memo">' + notesLines.map(function(l) { return '<li>' + escHtml(l.trim()) + '</li>'; }).join('') + '</ul>';
                    }
                }
            }
            viewHtml += '</td>';
            var actionHtmlPl = '';
            if (sel && (sel.name || sel.phone)) {
                var action = parseContactAction(sel.phone);
                actionHtmlPl += '<div class="row-actions-compact">';
                if (!isPrefEditOpen) {
                    if (action.kind === 'phone') {
                        actionHtmlPl += '<a class="row-action-btn small" href="tel:' + escAttr(action.value) + '">Call</a>';
                        actionHtmlPl += '<a class="row-action-btn small" href="sms:' + escAttr(action.value) + '">Text</a>';
                    } else if (action.kind === 'email') {
                        actionHtmlPl += '<a class="row-action-btn small" href="mailto:' + escAttr(action.value) + '">Email</a>';
                    } else if (action.kind === 'web') {
                        actionHtmlPl += '<a class="row-action-btn small" href="' + escAttr(action.value) + '" target="_blank" rel="noreferrer">Open</a>';
                    }
                    if (field.key !== 'surgeon') {
                        actionHtmlPl += '<a class="row-action-btn small" href="' + buildRowContactHref(site, field, sel.idx, sel.name, sel.phone) + '" download="' + fileSafe(site.label + '-' + field.label + (sel.idx > 0 ? '-' + (sel.idx + 1) : '')) + '.vcf">Add contact</a>';
                    }
                }
                if (field.key === 'preceptor' || field.key === 'anesthesiologist') {
                    if (isPrefEditOpen) {
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="savePersonPreferencesEdit(\'' + site.id + '\',\'' + field.key + '\',' + sel.idx + ')">Save Pref</button>';
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="closePersonPreferencesEdit()">Cancel</button>';
                    } else {
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="togglePersonPreferencesEdit(\'' + site.id + '\',\'' + field.key + '\',' + sel.idx + ')">Edit Pref</button>';
                    }
                } else if (field.key === 'surgeon') {
                    if (isRowEditOpen) {
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="savePersonRowEdit()">Save</button>';
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="cancelPersonRowEdit()">Cancel</button>';
                    } else {
                        actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="startPersonRowEdit(\'' + site.id + '\',\'' + field.key + '\')">Edit</button>';
                    }
                }
                actionHtmlPl += '</div>';
            } else if (field.key === 'surgeon' && isRowEditOpen) {
                actionHtmlPl += '<div class="row-actions-compact">';
                actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="savePersonRowEdit()">Save</button>';
                actionHtmlPl += '<button type="button" class="row-action-btn small" onclick="cancelPersonRowEdit()">Cancel</button>';
                actionHtmlPl += '</div>';
            } else if (field.key === 'surgeon' && !isRowEditOpen) {
                actionHtmlPl += '';
            }
            viewHtml += '<td class="action-cell">' + actionHtmlPl + '</td>';
        }
        tr.innerHTML = viewHtml;
    }
    return tr;
}

function addPersonEntry(siteId, fieldKey) {
    var count = parseInt(appData[countId(siteId, fieldKey)], 10);
    if (!(count > 0)) count = 1;
    appData[countId(siteId, fieldKey)] = count + 1;
    setSelectedContactValue(siteId, fieldKey, count);
    if (fieldKey === 'surgeon') {
        personRowEditState = {};
        personRowEditState[personRowEditKey(siteId, fieldKey)] = true;
    }
    if (typeof syncLinkedPersonField === 'function') {
        syncLinkedPersonField(siteId, fieldKey);
    }
    saveAll();
    buildUI();
}

function removePersonEntry(siteId, fieldKey, removeIndex) {
    var count = parseInt(appData[countId(siteId, fieldKey)], 10);
    if (!(count > 0)) count = 1;
    for (var i = removeIndex; i < count - 1; i++) {
        appData[fieldId(siteId, fieldKey, 'name', i)] = appData[fieldId(siteId, fieldKey, 'name', i + 1)] || '';
        appData[fieldId(siteId, fieldKey, 'phone', i)] = appData[fieldId(siteId, fieldKey, 'phone', i + 1)] || '';
        appData[fieldId(siteId, fieldKey, 'memo', i)] = appData[fieldId(siteId, fieldKey, 'memo', i + 1)] || '';
        if (typeof setPersonPreferencesValue === 'function' && typeof getPersonPreferencesValue === 'function') {
            setPersonPreferencesValue(siteId, fieldKey, i, getPersonPreferencesValue(siteId, fieldKey, i + 1) || '');
        } else {
            appData[fieldId(siteId, 'preferences', 'memo', i)] = appData[fieldId(siteId, 'preferences', 'memo', i + 1)] || '';
        }
    }
    delete appData[fieldId(siteId, fieldKey, 'name', count - 1)];
    delete appData[fieldId(siteId, fieldKey, 'phone', count - 1)];
    delete appData[fieldId(siteId, fieldKey, 'memo', count - 1)];
    if (typeof deletePersonPreferencesValue === 'function') {
        deletePersonPreferencesValue(siteId, fieldKey, count - 1);
    }
    delete appData[fieldId(siteId, 'preferences', 'memo', count - 1)];
    var newCount = count - 1 > 0 ? count - 1 : 1;
    appData[countId(siteId, fieldKey)] = newCount;

    var selIdx = parseInt(getSelectedContactValue(siteId, fieldKey), 10);
    if (isNaN(selIdx) || selIdx < 0) selIdx = 0;
    if (selIdx > removeIndex) selIdx -= 1;
    if (selIdx >= newCount) selIdx = newCount - 1;
    if (selIdx < 0) selIdx = 0;
    setSelectedContactValue(siteId, fieldKey, selIdx);

    if (typeof syncLinkedPersonField === 'function') {
        syncLinkedPersonField(siteId, fieldKey);
    }
    saveAll();
    buildUI();
}

function renderCompactContactRow(site, field) {
    var tr = document.createElement('tr');
    tr.className = 'data-row';

    var count = getRepeatCount(site.id, field.key);
    var rows = [];
    for (var i = 0; i < count; i++) {
        var name = String(appData[fieldId(site.id, field.key, 'name', i)] || '').trim();
        var phone = String(appData[fieldId(site.id, field.key, 'phone', i)] || '').trim();
        if (!name && !phone) continue;
        rows.push({ index: i, name: name, phone: phone });
    }

    var selected = parseInt(getSelectedContactValue(site.id, field.key), 10);
    if (isNaN(selected) || selected < 0 || selected >= rows.length) {
        selected = 0;
    }
    var selectedRow = rows[selected] || { index: 0, name: '', phone: '' };

    var nameCellHtml = '';
    if (rows.length) {
        nameCellHtml = '<select class="compact-select" onchange="setSelectedContact(\'' + site.id + '\',\'' + field.key + '\',this.value)">' + rows.map(function(row, idx) {
            var label = row.name || row.phone || ('Entry ' + (row.index + 1));
            var selectedAttr = idx === selected ? ' selected' : '';
            return '<option value="' + idx + '"' + selectedAttr + '>' + escHtml(label) + '</option>';
        }).join('') + '</select>';
    } else {
        nameCellHtml = '<span class="value-empty">No preceptors added</span>';
    }

    tr.innerHTML =
        '<td class="label-cell">' + escHtml(field.label + ' List') + '</td>' +
        '<td class="name-cell">' + nameCellHtml + '</td>' +
        '<td class="phone-cell">' + renderPhoneCell(site.id, field, selectedRow.index, selectedRow.phone) + '</td>' +
        '<td class="action-cell">' + renderActionCell(site, field, selectedRow.index, selectedRow.name, selectedRow.phone) + '</td>';

    return tr;
}

function renderRow(site, field, rowIndex) {
    if (field.type === 'plain') return renderPlainRow(site, field, rowIndex);
    if (field.type === 'locker') return renderLockerRow(site, field, rowIndex);
    var tr = document.createElement('tr');
    tr.className = 'data-row';
    var label = field.label + (field.canRepeat && rowIndex > 0 ? ' ' + (rowIndex + 1) : '');

    if (field.type === 'notes') {
        tr.className = 'data-row row-notes';
        var notesValue = String(appData[fieldId(site.id, field.key, 'name', rowIndex)] || '');
        if (!editState[site.id] && !notesValue.trim()) {
            tr.style.display = 'none';
            return tr;
        }
        tr.innerHTML =
            '<td class="label-cell">' + escHtml(label) + '</td>' +
            '<td class="notes-cell" colspan="2">' + renderNotesCell(site.id, field, rowIndex, notesValue) + '</td>' +
            '<td class="action-cell"></td>';
        return tr;
    }

    var nameValue = String(appData[fieldId(site.id, field.key, 'name', rowIndex)] || '');
    var phoneValue = String(appData[fieldId(site.id, field.key, 'phone', rowIndex)] || '');
    var emailValue = field.key === 'clinicalCoordinator' ? getCoordinatorEmail(site.id, rowIndex) : '';
    var hidePhoneInView = !editState[site.id] && field.type === 'contact';

    tr.innerHTML =
        '<td class="label-cell">' + escHtml(label) + '</td>' +
        '<td class="name-cell">' + renderNameCell(site.id, field, rowIndex, nameValue) + '</td>' +
        '<td class="phone-cell">' + (hidePhoneInView ? '' : renderPhoneCell(site.id, field, rowIndex, phoneValue)) + '</td>' +
        '<td class="action-cell">' + renderActionCell(site, field, rowIndex, nameValue, phoneValue, emailValue) + '</td>';
    return tr;
}

function renderLockerRow(site, field, rowIndex) {
    var tr = document.createElement('tr');
    tr.className = 'data-row row-locker';
    var locationVal = String(appData[fieldId(site.id, field.key, 'location', rowIndex)] || '').trim();
    var numVal = String(appData[fieldId(site.id, field.key, 'name', rowIndex)] || '').trim();
    var comboVal = String(appData[fieldId(site.id, field.key, 'phone', rowIndex)] || '').trim();

    var cellHtml;
    if (editState[site.id]) {
        cellHtml =
            '<div class="locker-pair">' +
                '<div class="locker-field"><span class="locker-sublabel">Location</span>' +
                '<input class="contact-input" type="text" placeholder="Location" value="' + escAttr(locationVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="location" data-row-index="' + rowIndex + '"></div>' +
                '<div class="locker-field"><span class="locker-sublabel">Locker #</span>' +
                '<input class="contact-input" type="text" placeholder="Number" value="' + escAttr(numVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + rowIndex + '"></div>' +
                '<div class="locker-field"><span class="locker-sublabel">Combo</span>' +
                '<input class="contact-input" type="text" placeholder="Combination" value="' + escAttr(comboVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + rowIndex + '"></div>' +
            '</div>';
    } else {
        cellHtml =
            '<div class="locker-pair">' +
                '<div class="locker-field"><span class="locker-sublabel">Location</span><span class="locker-val' + (locationVal ? '' : ' empty') + '">' + (locationVal ? escHtml(locationVal) : 'Not set') + '</span></div>' +
                '<div class="locker-field"><span class="locker-sublabel">Locker #</span><span class="locker-val' + (numVal ? '' : ' empty') + '">' + (numVal ? escHtml(numVal) : 'Not set') + '</span></div>' +
                '<div class="locker-field"><span class="locker-sublabel">Combo</span><span class="locker-val' + (comboVal ? '' : ' empty') + '">' + (comboVal ? escHtml(comboVal) : 'Not set') + '</span></div>' +
            '</div>';
    }

    tr.innerHTML =
        '<td class="label-cell">' + escHtml(field.label) + '</td>' +
        '<td colspan="2" style="padding:8px 10px 8px 0">' + cellHtml + '</td>' +
        '<td class="action-cell"></td>';
    return tr;
}

function renderPlainRow(site, field, rowIndex) {
    var tr = document.createElement('tr');
    tr.className = 'data-row';
    var value = String(appData[fieldId(site.id, field.key, 'name', rowIndex)] || '').trim();

    if (editState[site.id]) {
        tr.innerHTML =
            '<td class="label-cell">' + escHtml(field.label) + '</td>' +
            '<td class="name-cell" colspan="2"><input class="contact-input" type="text" placeholder="' + escAttr(field.placeholder || field.label) + '" value="' + escAttr(value) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + rowIndex + '"></td>' +
            '<td class="action-cell"></td>';
        return tr;
    }

    if (!value) {
        tr.style.display = 'none';
        return tr;
    }

    var action = parseContactAction(value);
    var href = action.kind === 'phone' ? 'tel:' + action.value
             : action.kind === 'email' ? 'mailto:' + action.value
             : null;

    if (href) {
        tr.innerHTML = '<td colspan="4" class="plain-tap-cell"><a class="plain-tap-link" href="' + escAttr(href) + '">' + escHtml(field.label) + '</a></td>';
    } else {
        tr.innerHTML = '<td class="label-cell">' + escHtml(field.label) + '</td><td class="name-cell" colspan="3"><span class="value-display">' + escHtml(value) + '</span></td>';
    }
    return tr;
}

function renderNameCell(siteId, field, rowIndex, value) {
    if (editState[siteId]) {
        var placeholder = field.type === 'contact' ? 'Name / Primary info' : 'Primary info';
        return '<input class="contact-input" type="text" placeholder="' + escAttr(placeholder) + '" value="' + escAttr(value) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + rowIndex + '">';
    }
    if (field.key === 'clinicalCoordinator' && value.trim()) {
        return '<span class="value-display coordinator-name">' + escHtml(value.trim()) + '</span>';
    }
    return value.trim() ? '<span class="value-display">' + escHtml(value.trim()) + '</span>' : '<span class="value-empty">No name added</span>';
}

function renderPhoneCell(siteId, field, rowIndex, value) {
    if (editState[siteId]) {
        if (field.key === 'clinicalCoordinator') {
            var emailValue = String(appData[fieldId(siteId, field.key, 'email', rowIndex)] || '').trim();
            return '<div class="coordinator-inputs">'
                + '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(value) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + rowIndex + '">'
                + '<input class="contact-input" type="email" placeholder="Email" value="' + escAttr(emailValue) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="email" data-row-index="' + rowIndex + '">'
                + '</div>';
        }
        return '<input class="contact-input" type="text" placeholder="Phone number" value="' + escAttr(value) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + rowIndex + '">';
    }

    var trimmed = value.trim();
    if (field.key === 'clinicalCoordinator') {
        var emailOnly = getCoordinatorEmail(siteId, rowIndex);
        var phoneText = trimmed ? '<span class="value-display">' + escHtml(trimmed) + '</span>' : '<span class="value-empty">No phone added</span>';
        var emailText = emailOnly ? '<a class="value-display" href="mailto:' + escAttr(emailOnly) + '">' + escHtml(emailOnly) + '</a>' : '<span class="value-empty">No email added</span>';
        return '<div class="coordinator-view">' + phoneText + emailText + '</div>';
    }
    if (!trimmed) {
        return '<span class="value-empty">No phone or link added</span>';
    }

    var href = clickableHref(trimmed);
    if (href) {
        return '<a class="value-display" href="' + escAttr(href) + '" target="_blank" rel="noreferrer">' + escHtml(trimmed) + '</a>';
    }

    return '<span class="value-display">' + escHtml(trimmed) + '</span>';
}

function renderNotesCell(siteId, field, rowIndex, value) {
    if (editState[siteId]) {
        return '<input class="contact-input" type="text" placeholder="Notes" value="' + escAttr(value) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + rowIndex + '">';
    }
    return value.trim() ? '<span class="value-display">' + escHtml(value.trim()) + '</span>' : '<span class="value-empty">No notes added</span>';
}

function getRepeatCount(siteId, fieldKey) {
    var count = parseInt(appData[countId(siteId, fieldKey)], 10);
    return count > 0 ? count : 1;
}

function removeRepeatRow(siteId, fieldKey, removeIndex) {
    var currentCount = getRepeatCount(siteId, fieldKey);
    for (var index = removeIndex; index < currentCount - 1; index++) {
        appData[fieldId(siteId, fieldKey, 'name', index)] = appData[fieldId(siteId, fieldKey, 'name', index + 1)] || '';
        appData[fieldId(siteId, fieldKey, 'phone', index)] = appData[fieldId(siteId, fieldKey, 'phone', index + 1)] || '';
    }
    delete appData[fieldId(siteId, fieldKey, 'name', currentCount - 1)];
    delete appData[fieldId(siteId, fieldKey, 'phone', currentCount - 1)];
    appData[countId(siteId, fieldKey)] = currentCount - 1;
    saveAll();
    buildUI();
}

function addRepeatRow(siteId, fieldKey, afterIndex) {
    var currentCount = getRepeatCount(siteId, fieldKey);

    for (var index = currentCount; index > afterIndex + 1; index--) {
        appData[fieldId(siteId, fieldKey, 'name', index)] = appData[fieldId(siteId, fieldKey, 'name', index - 1)] || '';
        appData[fieldId(siteId, fieldKey, 'phone', index)] = appData[fieldId(siteId, fieldKey, 'phone', index - 1)] || '';
    }

    appData[fieldId(siteId, fieldKey, 'name', afterIndex + 1)] = '';
    appData[fieldId(siteId, fieldKey, 'phone', afterIndex + 1)] = '';
    appData[countId(siteId, fieldKey)] = currentCount + 1;
    saveAll();
    buildUI();
}

function setSelectedContact(siteId, fieldKey, selectedIndex) {
    var localOnly = isLocalOnlySelectedField(fieldKey);
    setSelectedContactValue(siteId, fieldKey, selectedIndex);

    if (isSearchEnabledPersonField(fieldKey)) {
        var state = getPersonListViewState(siteId, fieldKey);
        if (String(state.searchQuery || '').trim()) {
            state.searchQuery = '';
        }
    }

    if (!localOnly && typeof syncLinkedPersonField === 'function') {
        syncLinkedPersonField(siteId, fieldKey);
    }
    if (!localOnly) saveAll();
    buildUI();
}
