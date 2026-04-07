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
    { key: 'preceptor', label: 'CRNAs', type: 'person-list', section: 'Team' },
    { key: 'anesthesiologist', label: 'Anesthesiologist', type: 'person-list', section: 'Team' },
    { key: 'mensLocker', label: "Men's Locker", type: 'locker', section: 'General' },
    { key: 'womensLocker', label: "Women's Locker", type: 'locker', section: 'General' },
    { key: 'clinicalCoordinator', label: 'Clinical Coordinator', type: 'contact', canRepeat: true, section: 'General' },
    { key: 'notes', label: 'Site Notes', type: 'notes', section: 'General' }
];

var STORE_KEY_LEGACY = 'clinicalSitesData';
var STORE_KEY_SITE_PREFIX = 'clinicalSitesData__';
var FAVORITE_KEY = 'clinicalSitesFavorite';

var appData = {};
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

function siteStoreKey(siteId) {
    return STORE_KEY_SITE_PREFIX + siteId;
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

function buildRowContactHref(site, field, rowIndex, nameValue, phoneValue) {
    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];

    if (nameValue) {
        lines.push('FN:' + sanitizeVcf(nameValue));
    }

    if (phoneValue) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneValue)) {
            lines.push('EMAIL;TYPE=INTERNET:' + sanitizeVcf(phoneValue));
        } else if (/^https?:\/\//i.test(phoneValue) || (/^[^\s]+\.[^\s]+/.test(phoneValue) && !/\s/.test(phoneValue))) {
            var url = /^https?:\/\//i.test(phoneValue) ? phoneValue : 'https://' + phoneValue;
            lines.push('URL:' + sanitizeVcf(url));
        } else {
            lines.push('TEL;TYPE=WORK:' + sanitizeVcf(phoneValue));
        }
    }

    lines.push('ORG:' + sanitizeVcf(field.label + ' - ' + site.label));
    lines.push('TITLE:' + sanitizeVcf(field.label + (rowIndex > 0 ? ' ' + (rowIndex + 1) : '')));
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
