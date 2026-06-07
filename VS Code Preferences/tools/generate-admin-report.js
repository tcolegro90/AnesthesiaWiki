#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_INPUT_DIR = path.join(ROOT, 'Backups', 'Reports', 'input');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'Backups', 'Reports');
const DEFAULT_MED_CATALOG = path.join(ROOT, 'Anesthesia Wiki', 'CarePlanGenerator WIP', 'med-catalog.js');
const DEFAULT_SOURCE = 'firestore';
const DEFAULT_FIRESTORE_PROJECT = 'anesthesia-wiki-saved-files';
const DEFAULT_FIRESTORE_API_KEY = 'AIzaSyACNII9-q3CoAipRpMTxwE6WLPOQVbbY-E';
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

const PMH_AUTO_TERMS = new Set(['smoker']);

function parseArgs(argv) {
  const out = {
    source: DEFAULT_SOURCE,
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    medCatalogPath: DEFAULT_MED_CATALOG,
    reportLabel: 'CPG Admin Combined Report',
    firestoreProject: DEFAULT_FIRESTORE_PROJECT,
    firestoreApiKey: DEFAULT_FIRESTORE_API_KEY
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--source' && next) {
      out.source = String(next).trim().toLowerCase();
      i += 1;
    } else if (arg === '--input' && next) {
      out.inputDir = path.resolve(next);
      i += 1;
    } else if (arg === '--output' && next) {
      out.outputDir = path.resolve(next);
      i += 1;
    } else if (arg === '--med-catalog' && next) {
      out.medCatalogPath = path.resolve(next);
      i += 1;
    } else if (arg === '--label' && next) {
      out.reportLabel = String(next).trim() || out.reportLabel;
      i += 1;
    } else if (arg === '--project' && next) {
      out.firestoreProject = String(next).trim() || out.firestoreProject;
      i += 1;
    } else if (arg === '--api-key' && next) {
      out.firestoreApiKey = String(next).trim() || out.firestoreApiKey;
      i += 1;
    }
  }

  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeTerm(value) {
  return normalizeString(value).replace(/\s+/g, ' ');
}

function normalizeCompare(value) {
  return normalizeTerm(value).toLowerCase();
}

function addCount(map, raw) {
  const term = normalizeTerm(raw);
  if (!term) return;
  map.set(term, (map.get(term) || 0) + 1);
}

function parseJsonishArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // Fallback below.
  }
  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map((x) => x.trim()).filter(Boolean);
  }
  return [trimmed];
}

function parseDateMaybe(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const n = value > 1e12 ? value : value * 1000;
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') {
      const d = new Date(value.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value._seconds === 'number') {
      const d = new Date(value._seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return parseDateMaybe(Number(trimmed));
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isWithinLast30(ts, now) {
  if (!ts) return false;
  return now.getTime() - ts.getTime() <= DAYS_30_MS;
}

function formatInt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function fireValueToJs(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return !!value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) return value.referenceValue;
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    const vals = (value.arrayValue && value.arrayValue.values) ? value.arrayValue.values : [];
    return vals.map(fireValueToJs);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    const fields = (value.mapValue && value.mapValue.fields) ? value.mapValue.fields : {};
    const out = {};
    Object.keys(fields).forEach((k) => { out[k] = fireValueToJs(fields[k]); });
    return out;
  }
  return null;
}

function firestoreDocToJs(doc) {
  const fields = doc && doc.fields ? doc.fields : {};
  const out = {};
  Object.keys(fields).forEach((k) => { out[k] = fireValueToJs(fields[k]); });
  out.__name = doc && doc.name ? doc.name : '';
  out.__createTime = doc && doc.createTime ? doc.createTime : '';
  out.__updateTime = doc && doc.updateTime ? doc.updateTime : '';
  return out;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('HTTP ' + res.statusCode + ' for ' + url + ': ' + body.slice(0, 240)));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error('Invalid JSON response from ' + url + ': ' + (error.message || String(error))));
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchFirestoreCollection(projectId, apiKey, collectionName) {
  const docs = [];
  let pageToken = '';

  while (true) {
    const tokenPart = pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '';
    const url =
      'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) +
      '/databases/(default)/documents/' + encodeURIComponent(collectionName) +
      '?pageSize=1000&key=' + encodeURIComponent(apiKey) + tokenPart;

    const payload = await fetchJson(url);
    const pageDocs = Array.isArray(payload.documents) ? payload.documents : [];
    for (const d of pageDocs) docs.push(firestoreDocToJs(d));

    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }

  return docs;
}

function walkJsonFiles(dir, acc) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(full, acc);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      acc.push(full);
    }
  }
}

function tryParseJson(text, filePath) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid JSON in ' + filePath + ': ' + (error.message || String(error)));
  }
}

function collectObjects(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
    return;
  }
  if (!isPlainObject(value)) return;
  out.push(value);
  for (const k of Object.keys(value)) collectObjects(value[k], out);
}

function loadKnownHomeMeds(medCatalogPath) {
  const text = fs.readFileSync(medCatalogPath, 'utf8');
  const match = text.match(/var\s+homeMeds\s*=\s*\[(.|\n|\r)*?\];/);
  if (!match) return new Set();

  const meds = new Set();
  const rx = /'([^']+)'/g;
  let m;
  while ((m = rx.exec(match[0])) !== null) {
    const med = normalizeCompare(m[1]);
    if (med) meds.add(med);
  }
  return meds;
}

function buildCurationRows(state) {
  const pmhRaw = parseJsonishArray(state['pmh-list']);
  const pshRaw = parseJsonishArray(state['pmh-surgical-history']);
  const medsRaw = parseJsonishArray(state['med-list']);

  const pmhTerms = pmhRaw
    .map((x) => normalizeTerm(typeof x === 'string' ? x : ''))
    .filter(Boolean)
    .filter((x) => !PMH_AUTO_TERMS.has(normalizeCompare(x)));

  const pshTerms = pshRaw
    .map((x) => normalizeTerm(typeof x === 'string' ? x : ''))
    .filter(Boolean);

  const medTerms = [];
  for (const row of medsRaw) {
    if (typeof row === 'string') {
      const t = normalizeTerm(row);
      if (t) medTerms.push(t);
      continue;
    }
    if (!isPlainObject(row)) continue;
    const med = normalizeTerm(row.med || '');
    const other = normalizeTerm(row.other || '');
    const picked = med === 'Other' ? other : med;
    if (picked) medTerms.push(picked);
  }

  return { pmhTerms, pshTerms, medTerms };
}

function renderTopList(counterMap, limit) {
  const items = Array.from(counterMap.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

  if (!items.length) return ['- None'];
  return items.slice(0, limit).map(([term, count]) => '- ' + term + ' (' + count + ')');
}

function buildReportMarkdown(data) {
  const lines = [];
  lines.push('# ' + data.label);
  lines.push('');
  lines.push('- Generated at: ' + data.generatedAtIso);
  lines.push('- Data source: ' + data.sourceSummary);
  if (data.unavailableCollections && data.unavailableCollections.length) {
    lines.push('- Unavailable collections: ' + data.unavailableCollections.join(', '));
  }
  lines.push('- Files processed: ' + formatInt(data.fileCount));
  lines.push('- Records scanned: ' + formatInt(data.objectCount));
  lines.push('- Scope: all users represented by source');
  lines.push('- Time windows included: All-time and last 30 days');
  lines.push('');

  lines.push('## Curation: Database Update Candidates');
  lines.push('');

  lines.push('### 1) PMH Typed Entries (Raw)');
  lines.push('- All-time unique: ' + formatInt(data.curation.pmhAll.size));
  lines.push('- Last 30 days unique: ' + formatInt(data.curation.pmh30.size));
  lines.push('- All-time frequency list:');
  lines.push(...renderTopList(data.curation.pmhAll, 500));
  lines.push('');
  lines.push('- Last 30 days frequency list:');
  lines.push(...renderTopList(data.curation.pmh30, 500));
  lines.push('');

  lines.push('### 2) Home Meds Not In Database (Strict Match, Raw)');
  lines.push('- All-time unique: ' + formatInt(data.curation.medUnknownAll.size));
  lines.push('- Last 30 days unique: ' + formatInt(data.curation.medUnknown30.size));
  lines.push('- All-time frequency list:');
  lines.push(...renderTopList(data.curation.medUnknownAll, 500));
  lines.push('');
  lines.push('- Last 30 days frequency list:');
  lines.push(...renderTopList(data.curation.medUnknown30, 500));
  lines.push('');

  lines.push('### 3) Past Surgeries (Raw)');
  lines.push('- All-time unique: ' + formatInt(data.curation.pshAll.size));
  lines.push('- Last 30 days unique: ' + formatInt(data.curation.psh30.size));
  lines.push('- All-time frequency list:');
  lines.push(...renderTopList(data.curation.pshAll, 500));
  lines.push('');
  lines.push('- Last 30 days frequency list:');
  lines.push(...renderTopList(data.curation.psh30, 500));
  lines.push('');

  lines.push('## Analytics');
  lines.push('');
  lines.push('### All-time');
  lines.push('- CPG unique users: ' + formatInt(data.analytics.allTime.cpgUsers));
  lines.push('- CPG plans generated: ' + formatInt(data.analytics.allTime.cpgPlans));
  lines.push('- Clinical Sites usage records: ' + formatInt(data.analytics.allTime.clinicalSitesRecords));
  lines.push('- Typhon Helper web app usage records: ' + formatInt(data.analytics.allTime.typhonWebRecords));
  lines.push('');

  lines.push('### Last 30 Days');
  lines.push('- CPG unique users: ' + formatInt(data.analytics.last30.cpgUsers));
  lines.push('- CPG plans generated: ' + formatInt(data.analytics.last30.cpgPlans));
  lines.push('- Clinical Sites usage records: ' + formatInt(data.analytics.last30.clinicalSitesRecords));
  lines.push('- Typhon Helper web app usage records: ' + formatInt(data.analytics.last30.typhonWebRecords));
  lines.push('');

  lines.push('## Action Queue');
  lines.push('- Review PMH all-time list for database additions, then apply decisions to PMH source data.');
  lines.push('- Review unknown meds list as raw typed entries; classify misspellings vs true new medications.');
  lines.push('- Review past surgeries list for new surgery aliases/entries to add.');
  lines.push('- Validate app analytics coverage if expected sources are missing from source data.');
  lines.push('');

  lines.push('## Notes');
  lines.push('- Unknown meds are evaluated with strict name matching against current med catalog home meds.');
  lines.push('- Raw terms are preserved; no auto-correction or synonym merging is applied in this report.');
  lines.push('- If source data is partial, totals reflect available records only.');
  lines.push('');

  return lines.join('\n');
}

function getTimestamp(obj) {
  const value = firstDefined(obj, ['savedAt', 'updatedAt', 'createdAt', 'timestamp', 'time', '__updateTime', '__createTime']);
  return parseDateMaybe(value);
}

function getUserId(obj) {
  const candidate = firstDefined(obj, ['userId', 'uid', 'ownerId', 'createdBy']);
  const clean = normalizeString(candidate);
  return clean || 'unknown-user';
}

function makeRowsFromFirestore(collectionMap) {
  const rows = [];
  for (const doc of collectionMap.carePlanSavedPlans || []) {
    rows.push({
      kind: 'cpgSavedPlan',
      appName: 'Care Plan Generator',
      userId: getUserId(doc),
      ts: getTimestamp(doc),
      state: isPlainObject(doc.state) ? doc.state : null
    });
  }

  for (const doc of collectionMap.carePlanDrafts || []) {
    rows.push({
      kind: 'cpgDraft',
      appName: 'Care Plan Generator',
      userId: getUserId(doc),
      ts: getTimestamp(doc),
      state: isPlainObject(doc.state) ? doc.state : null
    });
  }

  for (const doc of collectionMap.clinicalSites || []) {
    rows.push({
      kind: 'clinicalSitesRecord',
      appName: 'Clinical Sites',
      userId: getUserId(doc),
      ts: getTimestamp(doc),
      state: null
    });
  }

  for (const doc of collectionMap.typhonCases || []) {
    rows.push({
      kind: 'typhonWebRecord',
      appName: 'Typhon Helper web app',
      userId: getUserId(doc),
      ts: getTimestamp(doc),
      state: null
    });
  }

  return rows;
}

function makeRowsFromJsonFiles(inputDir) {
  const files = [];
  walkJsonFiles(inputDir, files);

  const rows = [];
  let objectCount = 0;

  function inferAppName(obj, filePath) {
    const explicit = firstDefined(obj, ['app', 'appName', 'sourceApp', 'application']);
    const explicitLower = normalizeCompare(explicit);
    if (explicitLower.includes('care plan') || explicitLower.includes('cpg')) return 'Care Plan Generator';
    if (explicitLower.includes('clinical')) return 'Clinical Sites';
    if (explicitLower.includes('typhon')) return 'Typhon Helper web app';

    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes('clinical')) return 'Clinical Sites';
    if (lowerPath.includes('typhon')) return 'Typhon Helper web app';
    if (lowerPath.includes('careplan') || lowerPath.includes('care-plan') || lowerPath.includes('cpg')) return 'Care Plan Generator';

    return 'Unknown App';
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = tryParseJson(raw, file);
    const objects = [];
    collectObjects(parsed, objects);
    objectCount += objects.length;

    for (const obj of objects) {
      const appName = inferAppName(obj, file);
      rows.push({
        kind: appName === 'Care Plan Generator' ? 'cpgSavedPlan' : (appName === 'Clinical Sites' ? 'clinicalSitesRecord' : (appName === 'Typhon Helper web app' ? 'typhonWebRecord' : 'unknown')),
        appName,
        userId: getUserId(obj),
        ts: getTimestamp(obj),
        state: isPlainObject(obj.state) ? obj.state : null
      });
    }
  }

  return { rows, files, objectCount };
}

function analyzeRows(rows, knownMeds) {
  const now = new Date();

  const pmhAll = new Map();
  const pmh30 = new Map();
  const medUnknownAll = new Map();
  const medUnknown30 = new Map();
  const pshAll = new Map();
  const psh30 = new Map();

  const allCpgUsers = new Set();
  const last30CpgUsers = new Set();
  let allCpgPlans = 0;
  let last30CpgPlans = 0;
  let allClinical = 0;
  let last30Clinical = 0;
  let allTyphon = 0;
  let last30Typhon = 0;

  for (const row of rows) {
    const in30 = isWithinLast30(row.ts, now);

    if (row.kind === 'cpgSavedPlan' || row.kind === 'cpgDraft') {
      allCpgUsers.add(row.userId || 'unknown-user');
      if (in30) last30CpgUsers.add(row.userId || 'unknown-user');
    }

    if (row.kind === 'cpgSavedPlan') {
      allCpgPlans += 1;
      if (in30) last30CpgPlans += 1;

      if (row.state && isPlainObject(row.state)) {
        const c = buildCurationRows(row.state);

        for (const term of c.pmhTerms) {
          addCount(pmhAll, term);
          if (in30) addCount(pmh30, term);
        }

        for (const term of c.pshTerms) {
          addCount(pshAll, term);
          if (in30) addCount(psh30, term);
        }

        for (const med of c.medTerms) {
          const isKnown = knownMeds.has(normalizeCompare(med));
          if (isKnown) continue;
          addCount(medUnknownAll, med);
          if (in30) addCount(medUnknown30, med);
        }
      }
    }

    if (row.kind === 'clinicalSitesRecord') {
      allClinical += 1;
      if (in30) last30Clinical += 1;
    }

    if (row.kind === 'typhonWebRecord') {
      allTyphon += 1;
      if (in30) last30Typhon += 1;
    }
  }

  return {
    generatedAtIso: now.toISOString(),
    curation: { pmhAll, pmh30, medUnknownAll, medUnknown30, pshAll, psh30 },
    analytics: {
      allTime: {
        cpgUsers: allCpgUsers.size,
        cpgPlans: allCpgPlans,
        clinicalSitesRecords: allClinical,
        typhonWebRecords: allTyphon
      },
      last30: {
        cpgUsers: last30CpgUsers.size,
        cpgPlans: last30CpgPlans,
        clinicalSitesRecords: last30Clinical,
        typhonWebRecords: last30Typhon
      }
    }
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.medCatalogPath)) {
    throw new Error('Medication catalog not found: ' + args.medCatalogPath);
  }

  ensureDir(args.outputDir);
  ensureDir(args.inputDir);

  const knownMeds = loadKnownHomeMeds(args.medCatalogPath);

  let rows = [];
  let fileCount = 0;
  let objectCount = 0;
  let sourceSummary = '';
  let unavailableCollections = [];

  if (args.source === 'json') {
    const json = makeRowsFromJsonFiles(args.inputDir);
    rows = json.rows;
    fileCount = json.files.length;
    objectCount = json.objectCount;
    sourceSummary = 'JSON exports from ' + args.inputDir;
  } else {
    const project = args.firestoreProject;
    const apiKey = args.firestoreApiKey;
    if (!project || !apiKey) {
      throw new Error('Firestore source requires project and api key.');
    }

    const collections = ['carePlanSavedPlans', 'carePlanDrafts', 'clinicalSites', 'typhonCases'];
    const map = {};
    for (const name of collections) {
      try {
        map[name] = await fetchFirestoreCollection(project, apiKey, name);
        objectCount += map[name].length;
      } catch (error) {
        map[name] = [];
        unavailableCollections.push(name);
      }
    }

    rows = makeRowsFromFirestore(map);
    fileCount = 0;
    sourceSummary = 'Firestore project ' + project + ' (collections: ' + collections.join(', ') + ')';
  }

  const analyzed = analyzeRows(rows, knownMeds);

  const reportData = {
    label: args.reportLabel,
    generatedAtIso: analyzed.generatedAtIso,
    sourceSummary,
    unavailableCollections,
    fileCount,
    objectCount,
    curation: analyzed.curation,
    analytics: analyzed.analytics
  };

  const markdown = buildReportMarkdown(reportData);
  const now = new Date();
  const stamp = now.toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
  const outName = 'admin-combined-report-' + stamp + '.md';
  const outPath = path.join(args.outputDir, outName);
  fs.writeFileSync(outPath, markdown, 'utf8');

  process.stdout.write('Report written: ' + outPath + '\n');
  process.stdout.write('Source: ' + sourceSummary + '\n');
  process.stdout.write('Rows analyzed: ' + rows.length + '\n');
  process.stdout.write('Records scanned: ' + objectCount + '\n');
}

main().catch((error) => {
  process.stderr.write((error && error.message) ? error.message + '\n' : String(error) + '\n');
  process.exit(1);
});
