// ============================================================
// RENDER SAVED
// ============================================================
function renderItemCard({ item, i }) {
  if (item.draft && item.type === 'timelog') {
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📝 Draft Time Log — ${dateStr}</div>
          <div class="saved-item-sub">${item.clockIn1 || '?'} → ${item.clockOut1 || '?'}${item.notes ? '  |  Notes saved' : ''}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }

  if (item.draft && item.type === 'eval') {
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Draft Eval — ${dateStr}</div>
          <div class="saved-item-sub">Preceptor: ${item.preceptorName || '—'}${item.facility?.[0] ? '  |  ' + item.facility[0] : ''}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }

  if (item.draft) {
    const anesLine = [item.general?'General':'', item.regional?'Regional':'', item.mac?'MAC':'', item.sedation?'Sedation':''].filter(Boolean).join(' · ') || '—';
    const dateStr = item.date ? fmtDate(item.date) : 'No date';
    return `<div class="saved-item draft-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📝 Draft Case — ${dateStr} · ASA ${item.asa||'?'} · ${item.biologicalSex||'?'} · Age ${item.age||'?'}</div>
          <div class="saved-item-sub">${anesLine} &nbsp;|&nbsp; ${item.anatomical?.join(', ')||'No category'}</div>
        </div>
        <span class="badge badge-draft">Draft</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="resume-draft" data-idx="${i}">▶ Resume</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
  if (item.type === 'timelog') {
    const isPending = !item.submitted;
    return `<div class="saved-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">⏰ Time Log — ${fmtDate(item.date)}</div>
          <div class="saved-item-sub">${item.clockIn1} → ${item.clockOut1}${item.clockIn2 ? ` &nbsp;|&nbsp; ${item.clockIn2} → ${item.clockOut2}` : ''}</div>
        </div>
        <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="edit-timelog" data-idx="${i}">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
  if (item.type === 'eval') {
    const isPending = !item.submitted;
    return `<div class="saved-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Daily Eval — ${fmtDate(item.date)}</div>
          <div class="saved-item-sub">Preceptor: ${item.preceptorName || '—'}</div>
        </div>
        <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="edit-eval" data-idx="${i}">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" data-action="text-eval" data-idx="${i}">📱 Text Preceptor</button>
        <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
  // Case log (default)
  {
    const isPending = !item.submitted;
    const anesLine = [item.general?'General':'', item.regional?'Regional':'', item.mac?'MAC':'', item.sedation?'Sedation':''].filter(Boolean).join(' · ') || '—';
    const anatomLine = item.anatomical?.join(', ') || 'No category';
    const timeLine = (item.anesStart || item.anesFinish)
      ? `${item.anesStart||'?'} → ${item.anesFinish||'?'}`
      : 'No times recorded';
    return `<div class="saved-item">
      <div class="saved-item-top">
        <div>
          <div class="saved-item-title">📋 Age ${item.age||'?'} · ${item.biologicalSex||'?'} · ASA ${item.asa||'?'}</div>
          <div class="saved-item-sub">${timeLine}</div>
          <div class="saved-item-sub">${anesLine} &nbsp;|&nbsp; ${anatomLine}</div>
        </div>
        <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${isPending ? 'Pending' : 'Submitted'}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-action="edit-case" data-idx="${i}">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" data-action="toggle-submit" data-idx="${i}">${isPending ? '✓ Mark Submitted' : 'Unmark'}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-item" data-idx="${i}">Delete</button>
      </div>
    </div>`;
  }
}

function captureSavedUiState(rootEl) {
  if (!rootEl) return null;
  const openKeys = [...rootEl.querySelectorAll('.submitted-folder.open, .date-folder.open')]
    .map((el) => el.dataset.folderKey)
    .filter(Boolean);
  return {
    scrollY: window.scrollY,
    openKeys
  };
}

function restoreSavedUiState(rootEl, state) {
  if (!rootEl || !state) return;
  (state.openKeys || []).forEach((key) => {
    const folder = rootEl.querySelector(`[data-folder-key="${key}"]`);
    if (folder) folder.classList.add('open');
  });
  window.scrollTo({ top: state.scrollY || 0, behavior: 'auto' });
}

async function renderSaved(options = {}) {
  const preserveUi = !!options.preserveUi;
  const items = (await store.get('typhon-items')) || [];
  updateBadge(items);  // keep badge in sync with real stored state
  const el = document.getElementById('saved-list');
  const savedUiState = preserveUi ? captureSavedUiState(el) : null;

  const indexed = [...items].map((item, i) => ({ item, i }));

  // Split into drafts, pending (non-draft), and submitted
  const drafts = indexed.filter(({ item }) => !!item.draft)
    .sort((a, b) => {
      const dateCmp = (b.item.date || '').localeCompare(a.item.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.item.anesStart || '').localeCompare(b.item.anesStart || '');
    });
  const pending = indexed.filter(({ item }) => !item.draft && !item.submitted)
    .sort((a, b) => {
      const dateCmp = (b.item.date || '').localeCompare(a.item.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.item.anesStart || '').localeCompare(b.item.anesStart || '');
    });
  const submitted = indexed.filter(({ item }) => !item.draft && item.submitted)
    .sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
  const submittedCases = submitted.filter(({ item }) => item.type === 'case');
  const submittedTimeLogs = submitted.filter(({ item }) => item.type === 'timelog');
  const submittedEvals = submitted.filter(({ item }) => item.type === 'eval');

  let html = '';

  // --- Drafts folder ---
  const draftCards = drafts.length
    ? drafts.map(entry => renderItemCard(entry)).join('')
    : '<div class="saved-item"><div class="saved-item-sub">No drafts here yet.</div></div>';
  html += `<div class="submitted-folder open" id="drafts-folder" data-folder-key="drafts-root">
    <div class="submitted-folder-header">
      <div class="submitted-folder-title">📝 Drafts <span class="submitted-folder-meta">${drafts.length} item${drafts.length !== 1 ? 's' : ''}</span></div>
      <span class="folder-chevron">▶</span>
    </div>
    <div class="submitted-folder-body">${draftCards}</div>
  </div>`;

  // --- Pending section ---
  if (pending.length) {
    html += `<div id="pending-list">${pending.map(entry => renderItemCard(entry)).join('')}</div>`;
  }

  // --- Submitted folder ---
  let submittedHtml = '';

  if (submittedCases.length) {
      const byDate = {};
      submittedCases.forEach(entry => {
        const key = entry.item.date || 'unknown';
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(entry);
      });
      const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

      const caseDateFolders = dateKeys.map(iso => {
        const entries = byDate[iso].sort((a, b) => (a.item.anesStart || '').localeCompare(b.item.anesStart || ''));
        const label = fmtDateLong(iso);
        const cards = entries.map(entry => renderItemCard(entry)).join('');
        return `<div class="date-folder" data-folder-key="case-date-${iso}">
          <div class="date-folder-header">
            <div class="date-folder-title">📅 ${label}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
              <span class="folder-chevron">▶</span>
            </div>
          </div>
          <div class="date-folder-body">${cards}</div>
        </div>`;
      }).join('');

    submittedHtml += `<div class="date-folder" data-folder-key="submitted-case-logs">
        <div class="date-folder-header">
          <div class="date-folder-title">📋 Case Logs</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${submittedCases.length} item${submittedCases.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${caseDateFolders}</div>
      </div>`;
  }

  if (submittedTimeLogs.length) {
      const byMonth = {};
      submittedTimeLogs.forEach(entry => {
        const key = monthKey(entry.item.date);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(entry);
      });
      const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

      const monthFolders = monthKeys.map(key => {
        const entries = byMonth[key].sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
        const cards = entries.map(entry => renderItemCard(entry)).join('');
        return `<div class="date-folder" data-folder-key="timelog-month-${key}">
          <div class="date-folder-header">
            <div class="date-folder-title">🗂 ${fmtMonthYear(key)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
              <span class="folder-chevron">▶</span>
            </div>
          </div>
          <div class="date-folder-body">${cards}</div>
        </div>`;
      }).join('');

    submittedHtml += `<div class="date-folder" data-folder-key="submitted-time-logs">
        <div class="date-folder-header">
          <div class="date-folder-title">⏱ Time Logs</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${submittedTimeLogs.length} item${submittedTimeLogs.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${monthFolders}</div>
      </div>`;
  }

  if (submittedEvals.length) {
    const byDate = {};
    submittedEvals.forEach(entry => {
      const key = entry.item.date || 'unknown';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(entry);
    });
    const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    const evalDateFolders = dateKeys.map(iso => {
      const entries = byDate[iso];
      const label = fmtDateLong(iso);
      const cards = entries.map(entry => renderItemCard(entry)).join('');
      return `<div class="date-folder" data-folder-key="eval-date-${iso}">
        <div class="date-folder-header">
          <div class="date-folder-title">📅 ${label}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="date-folder-count">${entries.length} item${entries.length !== 1 ? 's' : ''}</span>
            <span class="folder-chevron">▶</span>
          </div>
        </div>
        <div class="date-folder-body">${cards}</div>
      </div>`;
    }).join('');
    submittedHtml += `<div class="date-folder" data-folder-key="submitted-evals">
      <div class="date-folder-header">
        <div class="date-folder-title">📋 Daily Evaluations</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="date-folder-count">${submittedEvals.length} item${submittedEvals.length !== 1 ? 's' : ''}</span>
          <span class="folder-chevron">▶</span>
        </div>
      </div>
      <div class="date-folder-body">${evalDateFolders}</div>
    </div>`;
  }

  if (!submittedHtml) {
    submittedHtml = '<div class="saved-item"><div class="saved-item-sub">No submitted items yet.</div></div>';
  }

  html += `<div class="submitted-folder" id="submitted-folder" data-folder-key="submitted-root">
    <div class="submitted-folder-header">
      <div class="submitted-folder-title">📁 Submitted <span class="submitted-folder-meta">${submitted.length} item${submitted.length !== 1 ? 's' : ''}</span></div>
      <span class="folder-chevron">▶</span>
    </div>
    <div class="submitted-folder-body">${submittedHtml}</div>
  </div>`;

  el.innerHTML = html;
  if (savedUiState) restoreSavedUiState(el, savedUiState);

  // Silently check Firestore for any pending preceptor reviews
  syncPendingEvals().catch(() => {});
}

// Background auto-sync: check all pending evals against Firestore and merge if completed.
let _syncPendingRunning = false;
async function syncPendingEvals() {
  if (_syncPendingRunning) return;
  const db = getFirestore();
  if (!db) return;

  const items = (await store.get('typhon-items')) || [];
  const pendingIdx = items.reduce((acc, item, i) => {
    if (item.type === 'eval' && item.preceptorShareToken && item.preceptorReviewStatus !== 'completed') {
      acc.push(i);
    }
    return acc;
  }, []);
  if (!pendingIdx.length) return;

  _syncPendingRunning = true;
  let anyChanged = false;
  try {
    for (const i of pendingIdx) {
      const item = items[i];
      try {
        const snap = await db.collection(_evalShareCol).doc(item.preceptorShareToken).get();
        if (!snap.exists) continue;
        const d = snap.data() || {};
        if (d.status !== 'completed' || !d.preceptorSubmission) continue;

        items[i] = {
          ...item,
          ...d.preceptorSubmission,
          id: item.id,
          type: 'eval',
          submitted: item.submitted,
          preceptorShareToken: item.preceptorShareToken,
          preceptorReviewStatus: 'completed',
          preceptorReviewCompletedAt: d.completedAt || Date.now()
        };
        anyChanged = true;
      } catch {}
    }

    if (anyChanged) {
      await store.set('typhon-items', items);
      await renderSaved({ preserveUi: true });
      toast('Preceptor review synced ✓');
    }
  } finally {
    _syncPendingRunning = false;
  }
}

async function markAllSubmitted() {
  const items = (await store.get('typhon-items')) || [];
  const unsubmitted = items.filter(i => !i.submitted && !i.draft);
  if (!unsubmitted.length) { toast('Nothing to mark — all already submitted'); return; }
  unsubmitted.forEach(i => { i.submitted = true; });
  await store.set('typhon-items', items);
  updateBadge(items);
  await renderSaved({ preserveUi: true });
  toast(`Marked ${unsubmitted.length} item${unsubmitted.length !== 1 ? 's' : ''} as submitted`);
}

async function toggleSubmit(i) {
  const items = (await store.get('typhon-items')) || [];
  items[i].submitted = !items[i].submitted;
  await store.set('typhon-items', items);
  updateBadge(items);
  await renderSaved({ preserveUi: true });
}

async function deleteItem(i) {
  const items = (await store.get('typhon-items')) || [];
  items.splice(i, 1);
  await store.set('typhon-items', items);
  updateBadge(items);
  renderSaved();
}

function copyCase(i) {
  store.get('typhon-items').then(items => {
    const c = items[i];
    const gi = c.generalItems || {}, ri = c.regionalItems || {}, p = c.procedures || {}, m = c.medications || {}, ad = c.anatomicalDetails || {};
    const truthyKeys = obj => Object.entries(obj)
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v))
      .map(([k]) => k);
    const lines = [
      `CASE LOG — ${fmtDate(c.date)}`,
      `Site: ${c.clinicalSite}  |  Sex: ${c.biologicalSex}  |  Age: ${c.age}  |  ASA: ${c.asa}  |  Admit: ${c.admitType}`,
      c.traumaEmergency ? '⚠ TRAUMA/EMERGENCY' : null,
      `Positions: ${c.positions?.join(', ') || 'None'}`,
      `Anatomical: ${c.anatomical?.join(', ') || 'None'}`,
      truthyKeys(ad).length ? `  Anatomical sub: ${truthyKeys(ad).join(', ')}` : null,
      `Anesthesia: ${[c.general?'General':'', c.regional?'Regional':'', c.mac?'MAC':'', c.sedation?'Sedation':''].filter(Boolean).join(', ')}`,
      c.general ? `  General sub: ${truthyKeys(gi).join(', ')}` : null,
      c.regional ? `  Regional sub: ${truthyKeys(ri).join(', ')}` : null,
      `Meds: ${truthyKeys(m).join(', ') || 'None'}`,
      `Times: AS ${c.anesStart} → AF ${c.anesFinish}`,
      c.clinicalNotes ? `Notes: ${c.clinicalNotes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    toast('Copied!');
  });
}

function copyTimelog(i) {
  store.get('typhon-items').then(items => {
    const t = items[i];
    const lines = [
      `TIME LOG — ${fmtDate(t.date)}`,
      `1st: IN ${t.clockIn1}  OUT ${t.clockOut1}`,
      t.clockIn2 ? `2nd: IN ${t.clockIn2}  OUT ${t.clockOut2}` : null,
      t.notes ? `Notes: ${t.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    toast('Copied!');
  });
}

