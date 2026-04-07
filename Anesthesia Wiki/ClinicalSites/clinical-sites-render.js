function renderSitePicker(container) {
    var picker = document.createElement('div');
    picker.className = 'site-picker';

    var favSites = SITES.filter(function(s) { return s.id === favoriteSiteId; });
    var otherSites = SITES.filter(function(s) { return s.id !== favoriteSiteId; });

    function makeCard(site) {
        var card = document.createElement('div');
        card.className = 'site-picker-card';
        card.setAttribute('onclick', 'selectSite(\'' + site.id + '\')');
        card.innerHTML =
            '<span class="picker-icon">🏥</span>' +
            '<span class="picker-label">' + escHtml(site.label) + '</span>' +
            (favoriteSiteId === site.id ? '<span class="picker-fav">★</span>' : '');
        return card;
    }

    favSites.forEach(function(site) { picker.appendChild(makeCard(site)); });

    if (favSites.length && otherSites.length) {
        var gap = document.createElement('div');
        gap.style.marginTop = '14px';
        picker.appendChild(gap);
    }

    otherSites.forEach(function(site) { picker.appendChild(makeCard(site)); });

    container.appendChild(picker);
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

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'detail-back-btn';
    backBtn.innerHTML = '&#8592; All Sites';
    backBtn.setAttribute('onclick', 'backToSites()');
    container.appendChild(backBtn);

    var card = document.createElement('div');
    card.className = 'site-card' + (editState[site.id] ? ' editing' : '');

    var header = document.createElement('div');
    header.className = 'site-card-header';
    header.innerHTML =
        '<div class="site-title"><span>🏥</span><span>' + escHtml(site.label) + '</span>' + (favoriteSiteId === site.id ? '<span class="favorite-star">★</span>' : '') + '</div>' +
        '<div class="site-actions">' +
            '<button type="button" class="site-action-btn favorite-btn' + (favoriteSiteId === site.id ? ' active' : '') + '" onclick="toggleFavorite(\'' + site.id + '\')">' + (favoriteSiteId === site.id ? '&#9733;' : '&#9734;') + '</button>' +
            '<button type="button" class="site-action-btn edit-btn" onclick="toggleEdit(\'' + site.id + '\')">' + (editState[site.id] ? 'Done' : 'Edit') + '</button>' +
        '</div>';
    card.appendChild(header);

    var body = document.createElement('div');
    body.className = 'site-card-body';

    var plainFields = FIELDS.filter(function(f) { return f.type === 'plain'; });
    var otherFields = FIELDS.filter(function(f) { return f.type !== 'plain'; });

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
        var editHtml = '<td class="label-cell">' + escHtml(field.label) + '</td><td colspan="3" style="padding:8px 10px 8px 0">';
        for (var i = 0; i < count; i++) {
            var nameVal = String(appData[fieldId(site.id, field.key, 'name', i)] || '');
            var phoneVal = String(appData[fieldId(site.id, field.key, 'phone', i)] || '');
            var memoVal = String(appData[fieldId(site.id, field.key, 'memo', i)] || '');
            var prefVal = String(appData[fieldId(site.id, 'preferences', 'memo', i)] || '');
            editHtml += '<div class="person-edit-block">';
            editHtml += '<div class="pe-row">';
            editHtml += '<input class="contact-input pe-name" type="text" placeholder="Name" value="' + escAttr(nameVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="name" data-row-index="' + i + '">';
            editHtml += '<input class="contact-input" type="text" placeholder="Phone" value="' + escAttr(phoneVal) + '" data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + i + '">';
            if (i > 0) {
                editHtml += '<button type="button" class="pe-remove-btn" onclick="removePersonEntry(\'' + site.id + '\',\'' + field.key + '\',' + i + ')" title="Remove">&#10005;</button>';
            }
            editHtml += '</div>';
            editHtml += '<textarea class="pe-notes" placeholder="Notes about this person..." data-site-id="' + site.id + '" data-field-key="' + field.key + '" data-part="memo" data-row-index="' + i + '">' + escHtml(memoVal) + '</textarea>';
            editHtml += '<textarea class="pe-notes" placeholder="Preferences..." data-site-id="' + site.id + '" data-field-key="preferences" data-part="memo" data-row-index="' + i + '">' + escHtml(prefVal) + '</textarea>';
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
            var pref = String(appData[fieldId(site.id, 'preferences', 'memo', j)] || '').trim();
            if (!n && !p && !m && !pref) continue;
            people.push({ idx: j, name: n, phone: p, memo: m, preferences: pref });
        }

        var selKey = selectedId(site.id, field.key);
        var selIdx = parseInt(appData[selKey], 10);
        if (isNaN(selIdx) || selIdx < -1 || selIdx >= people.length) selIdx = -1;
        var sel = (selIdx >= 0 && selIdx < people.length) ? people[selIdx] : null;

        var viewHtml = '<td class="label-cell">' + escHtml(field.label) + '</td>';
        if (!people.length) {
            viewHtml += '<td class="name-cell" colspan="2"><span class="value-empty">None added yet</span></td><td class="action-cell"></td>';
        } else {
            viewHtml += '<td class="name-cell" style="padding:4px 0">';
            viewHtml += '<select class="compact-select" onchange="setSelectedContact(\'' + site.id + '\',\'' + field.key + '\',this.value)">';
            viewHtml += '<option value="-1"' + (selIdx === -1 ? ' selected' : '') + '>— Select —</option>';
            people.forEach(function(person, i) {
                var label = person.name || person.phone || ('Entry ' + (person.idx + 1));
                viewHtml += '<option value="' + i + '"' + (i === selIdx ? ' selected' : '') + '>' + escHtml(label) + '</option>';
            });
            viewHtml += '</select>';
            viewHtml += '</td>';
            viewHtml += '<td class="notes-cell" style="padding:4px 0">';
            if (sel && (sel.memo || sel.preferences)) {
                var memoLines = (sel.memo + '\n' + sel.preferences).split('\n').filter(function(l) { return l.trim(); });
                viewHtml += '<ul class="pl-memo">' + memoLines.map(function(l) { return '<li>' + escHtml(l.trim()) + '</li>'; }).join('') + '</ul>';
            }
            viewHtml += '</td>';
            var actionHtmlPl = '';
            if (sel && sel.phone) {
                var action = parseContactAction(sel.phone);
                if (action.kind === 'phone') {
                    actionHtmlPl += '<div class="row-actions">';
                    actionHtmlPl += '<a class="row-action-btn small" href="tel:' + escAttr(action.value) + '">Call</a>';
                    actionHtmlPl += '<a class="row-action-btn small" href="sms:' + escAttr(action.value) + '">Text</a>';
                    actionHtmlPl += '<a class="row-action-btn small" href="' + buildRowContactHref(site, field, selIdx, sel.name, sel.phone) + '" download="' + fileSafe(site.label + '-' + field.label + (selIdx > 0 ? '-' + (selIdx + 1) : '')) + '.vcf">Add</a>';
                    actionHtmlPl += '</div>';
                }
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
    }
    delete appData[fieldId(siteId, fieldKey, 'name', count - 1)];
    delete appData[fieldId(siteId, fieldKey, 'phone', count - 1)];
    delete appData[fieldId(siteId, fieldKey, 'memo', count - 1)];
    appData[countId(siteId, fieldKey)] = count - 1 > 0 ? count - 1 : 1;
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

    var selected = parseInt(appData[selectedId(site.id, field.key)], 10);
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
        tr.innerHTML =
            '<td class="label-cell">' + escHtml(label) + '</td>' +
            '<td class="notes-cell" colspan="2">' + renderNotesCell(site.id, field, rowIndex, notesValue) + '</td>' +
            '<td class="action-cell"></td>';
        return tr;
    }

    var nameValue = String(appData[fieldId(site.id, field.key, 'name', rowIndex)] || '');
    var phoneValue = String(appData[fieldId(site.id, field.key, 'phone', rowIndex)] || '');

    tr.innerHTML =
        '<td class="label-cell">' + escHtml(label) + '</td>' +
        '<td class="name-cell">' + renderNameCell(site.id, field, rowIndex, nameValue) + '</td>' +
        '<td class="phone-cell">' + renderPhoneCell(site.id, field, rowIndex, phoneValue) + '</td>' +
        '<td class="action-cell">' + renderActionCell(site, field, rowIndex, nameValue, phoneValue) + '</td>';
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
    return value.trim() ? '<span class="value-display">' + escHtml(value.trim()) + '</span>' : '<span class="value-empty">No name added</span>';
}

function renderPhoneCell(siteId, field, rowIndex, value) {
    if (editState[siteId]) {
        return '<input class="contact-input" type="text" placeholder="Phone / Pager / Email / Link" value="' + escAttr(value) + '" data-site-id="' + siteId + '" data-field-key="' + field.key + '" data-part="phone" data-row-index="' + rowIndex + '">';
    }

    var trimmed = value.trim();
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

function renderActionCell(site, field, rowIndex, nameValue, phoneValue) {
    if (field.canRepeat && editState[site.id]) {
        if (rowIndex > 0) {
            return '<button type="button" class="row-action-btn add-row" style="border-color:#e0b0b0;color:#b32424" onclick="removeRepeatRow(\'' + site.id + '\',\'' + field.key + '\',' + rowIndex + ')">✕ Remove</button>';
        }
        return '<button type="button" class="row-action-btn add-row" onclick="addRepeatRow(\'' + site.id + '\',\'' + field.key + '\',' + rowIndex + ')">+ Add row below</button>';
    }

    if (field.type !== 'contact') {
        return '<span class="row-action-btn disabled">No action</span>';
    }

    if (!nameValue.trim() && !phoneValue.trim()) {
        return '<span class="row-action-btn disabled">No contact</span>';
    }

    var action = parseContactAction(phoneValue.trim());
    var actions = [];

    if (action.kind === 'phone') {
        actions.push('<a class="row-action-btn small" href="tel:' + escAttr(action.value) + '">Call</a>');
        actions.push('<a class="row-action-btn small" href="sms:' + escAttr(action.value) + '">Text</a>');
    } else if (action.kind === 'email') {
        actions.push('<a class="row-action-btn small" href="mailto:' + escAttr(action.value) + '">Email</a>');
    } else if (action.kind === 'web') {
        actions.push('<a class="row-action-btn small" href="' + escAttr(action.value) + '" target="_blank" rel="noreferrer">Open</a>');
    }

    actions.push('<a class="row-action-btn small" href="' + buildRowContactHref(site, field, rowIndex, nameValue.trim(), phoneValue.trim()) + '" download="' + fileSafe(site.label + '-' + field.label + (rowIndex > 0 ? '-' + (rowIndex + 1) : '')) + '.vcf">Add</a>');

    return '<div class="row-actions">' + actions.join('') + '</div>';
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
    appData[selectedId(siteId, fieldKey)] = String(selectedIndex);
    saveAll();
    buildUI();
}
