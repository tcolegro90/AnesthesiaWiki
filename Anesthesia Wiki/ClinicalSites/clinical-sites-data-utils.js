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
    { key: 'preferences', label: 'Preferences', type: 'person-list', section: 'Team' },
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
    { name: "Marilyn Alleman", cell: "256-483-9427", company: "RRH Locum CRNA" },
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

// Merge CRNA_LIST into existing appData for RGH and Unity without overwriting existing entries or notes
['rgh', 'unity'].forEach(function(siteId) {
    var countKey = countId(siteId, 'preceptor');
    var existingCount = parseInt(appData[countKey], 10) || 0;
    var existingNames = [];
    for (var i = 0; i < existingCount; i++) {
        var name = appData[fieldId(siteId, 'preceptor', 'name', i)];
        if (name) existingNames.push(name.trim().toLowerCase());
    }
    var toAdd = CRNA_LIST.filter(function(person) {
        return existingNames.indexOf(person.name.trim().toLowerCase()) === -1;
    });
    // Append new contacts
    toAdd.forEach(function(person, idx) {
        var i = existingCount + idx;
        appData[fieldId(siteId, 'preceptor', 'name', i)] = person.name;
        appData[fieldId(siteId, 'preceptor', 'phone', i)] = person.cell;
        appData[fieldId(siteId, 'preceptor', 'memo', i)] = person.company;
        appData[fieldId(siteId, 'preferences', 'memo', i)] = person.preferences || '';
    });
    if (toAdd.length) {
        appData[countKey] = existingCount + toAdd.length;
    }
});

// Pre-populate CRNAs for RGH and Unity
['rgh', 'unity'].forEach(function(siteId) {
    var base = siteId + '__preceptor__';
    appData[countId(siteId, 'preceptor')] = CRNA_LIST.length;
    CRNA_LIST.forEach(function(person, i) {
        appData[fieldId(siteId, 'preceptor', 'name', i)] = person.name;
        appData[fieldId(siteId, 'preceptor', 'phone', i)] = person.cell;
        appData[fieldId(siteId, 'preceptor', 'memo', i)] = person.company;
        appData[fieldId(siteId, 'preferences', 'memo', i)] = person.preferences || '';
    });
});
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
