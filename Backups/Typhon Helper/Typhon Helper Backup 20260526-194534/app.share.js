function normalizePhoneForSms(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/[^\d+]/g, '');
}

function createRandomToken() {
  const bytes = new Uint8Array(24);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getReviewBaseUrl() {
  const cfg = window.TYPHON_FIREBASE_CONFIG || {};
  if (cfg.preceptorReviewBaseUrl) return cfg.preceptorReviewBaseUrl;
  if (window.location.protocol === 'chrome-extension:') {
    if (cfg.projectId) {
      return `https://${cfg.projectId}.web.app/Typhon%20Helper/TyphonCaseHelper.html`;
    }
    return '';
  }
  const u = new URL(window.location.href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

async function ensureFirebaseAuthForShare() {
  // No-op: anonymous sign-in removed. The preceptor read path uses
  // allow read: if true, so auth is not required. The student create/update
  // path requires a real signed-in account; callers already check ownerUid.
}

async function createOrUpdateEvalShare(evalData, existingToken) {
  const db = getFirestore();
  if (!db) throw new Error('Cloud database unavailable.');

  const baseUrl = getReviewBaseUrl();
  if (!baseUrl) throw new Error('Set preceptorReviewBaseUrl in firebase config for extension use.');

  await ensureFirebaseAuthForShare();
  const ownerUid = _getAuthUid();
  if (!ownerUid) {
    throw new Error('Please sign in before sending a preceptor review link.');
  }

  const incomingRecipientPhone = normalizePhoneForSms(evalData.preceptorPhone || '');
  const incomingRecipientName = String(evalData.preceptorName || '').trim().toLowerCase();

  let token = existingToken || createRandomToken();
  if (existingToken) {
    try {
      const existingSnap = await db.collection(_evalShareCol).doc(existingToken).get();
      if (existingSnap.exists) {
        const existingData = existingSnap.data() || {};
        const existingRecipientPhone = normalizePhoneForSms(existingData.recipientPhone || '');
        const existingRecipientName = String(existingData.recipientName || '').trim().toLowerCase();
        const phoneChanged = !!(incomingRecipientPhone && existingRecipientPhone && incomingRecipientPhone !== existingRecipientPhone);
        const nameChanged = !!(incomingRecipientName && existingRecipientName && incomingRecipientName !== existingRecipientName);
        if (phoneChanged || nameChanged) token = createRandomToken();
      }
    } catch (e) {
      console.warn('Could not validate existing eval share recipient, rotating token', e);
      token = createRandomToken();
    }
  }

  const ref = db.collection(_evalShareCol).doc(token);
  await ref.set({
    token,
    status: 'pending',
    ownerUid,
    recipientName: evalData.preceptorName || null,
    recipientPhone: evalData.preceptorPhone || null,
    studentPhone: evalData.studentPhone || null,
    eval: evalData,
    updatedAt: Date.now(),
    createdAt: firebase?.firestore?.FieldValue?.serverTimestamp
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  }, { merge: true });

  const reviewUrl = new URL(baseUrl);
  reviewUrl.searchParams.set('preceptorToken', token);
  return { token, reviewUrl: reviewUrl.toString() };
}

function buildEvalTextMessage(e) {
  const facilityText = (e.facility || []).join(', ') || 'N/A';
  const ratings = [e.q8, e.q9, e.q10, e.q11].filter(Boolean).join(' | ') || 'N/A';
  return [
    `Daily Eval - ${fmtDate(e.date)}`,
    `Preceptor: ${e.preceptorName || 'N/A'}`,
    `Facility: ${facilityText}`,
    `Ratings (Q8-Q11): ${ratings}`,
    e.daySummary ? `Student Summary: ${e.daySummary}` : null,
    e.preceptorComments ? `Preceptor Comments: ${e.preceptorComments}` : null,
    e.sigName ? `Signature Name: ${e.sigName}` : null,
    '',
    'Please review, edit if needed, and sign in Typhon.'
  ].filter(Boolean).join('\n');
}

function buildEvalShareTextMessage(e, reviewUrl) {
  return [
    `Hi ${e.preceptorName || 'Preceptor'}, please review/sign my Daily Eval from ${fmtDate(e.date)}.`,
    '',
    `Open secure review link: ${reviewUrl}`,
    '',
    'You can edit comments, sign, and submit from that page.'
  ].join('\n');
}

function buildStudentReturnTextMessage(e) {
  return [
    `Daily Eval from ${fmtDate(e.date)} has been completed and sent back.`,
    `Preceptor: ${e.preceptorName || 'N/A'}`,
    '',
    'Open Typhon Helper — your eval will sync automatically.'
  ].join('\n');
}

async function ensureStudentPhoneForAutoConfirm(evalData) {
  const hiddenEl = document.getElementById('e-student-phone');
  let phone = (evalData.studentPhone || hiddenEl?.value || '').trim();

  if (!phone) {
    try {
      phone = (localStorage.getItem('typhon-student-phone') || '').trim();
    } catch {}
  }

  if (!phone) {
    const entered = await promptPhone('Your Phone (Optional)', 'Enter YOUR mobile number so the preceptor can send the eval back to you automatically.');
    if (entered) phone = entered.trim();
  }

  const normalized = normalizePhoneForSms(phone);
  if (phone && !normalized) {
    toast('Student phone skipped: invalid format');
  }

  const finalPhone = normalized ? phone : '';
  if (hiddenEl) hiddenEl.value = finalPhone;
  evalData.studentPhone = finalPhone;

  if (finalPhone) {
    try { localStorage.setItem('typhon-student-phone', finalPhone); } catch {}
  }

  return normalizePhoneForSms(finalPhone);
}

async function openStudentAutoConfirmText(evalData) {
  const normalized = normalizePhoneForSms(evalData.studentPhone || '');
  if (!normalized) return false;

  const body = buildStudentReturnTextMessage(evalData);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied student confirmation text. Paste into your message app.');
      return true;
    } catch {
      return false;
    }
  }
}

function promptPhone(title, subtitle, defaultVal = '') {
  return new Promise((resolve) => {
    const overlay  = document.getElementById('phone-prompt-overlay');
    const titleEl  = document.getElementById('phone-prompt-title');
    const subEl    = document.getElementById('phone-prompt-subtitle');
    const input    = document.getElementById('phone-prompt-input');
    const btnOk    = document.getElementById('phone-prompt-confirm');
    const btnCancel = document.getElementById('phone-prompt-cancel');

    // Fallback for extension environment where modal may not exist
    if (!overlay || !input) {
      const entered = window.prompt(title + (subtitle ? '\n' + subtitle : ''), defaultVal);
      resolve(entered ? entered.trim() : null);
      return;
    }

    titleEl.textContent = title;
    subEl.textContent   = subtitle || '';
    input.value         = defaultVal ? formatPhoneDisplay(defaultVal) : '';

    function formatPhoneDisplay(raw) {
      const digits = raw.replace(/\D/g, '').slice(0, 10);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return digits.slice(0,3) + '-' + digits.slice(3);
      return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
    }

    function onInput() {
      const raw   = input.value.replace(/\D/g, '').slice(0, 10);
      const caret = input.selectionStart;
      const oldLen = input.value.length;
      input.value = formatPhoneDisplay(raw);
      // Restore caret roughly
      const diff = input.value.length - oldLen;
      try { input.setSelectionRange(caret + diff, caret + diff); } catch {}
    }

    function cleanup() {
      input.removeEventListener('input', onInput);
      btnOk.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      overlay.classList.remove('open');
    }

    function onConfirm() {
      cleanup();
      const val = input.value.trim();
      resolve(val || null);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    input.addEventListener('input', onInput);
    btnOk.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);

    overlay.classList.add('open');
    // Small delay so the overlay transition finishes before focusing
    setTimeout(() => { try { input.focus(); } catch {} }, 80);
  });
}

async function textEval(i) {
  const items = (await store.get('typhon-items')) || [];
  const e = items[i];
  if (!e || e.type !== 'eval') return;

  let phone = (e.preceptorPhone || '').trim();
  if (!phone) {
    const entered = await promptPhone('Preceptor Phone', 'Enter the preceptor\'s mobile number to send the eval link.');
    if (!entered) return;
    phone = entered.trim();
    e.preceptorPhone = phone;
    items[i] = e;
    await store.set('typhon-items', items);
    updateBadge(items);
    renderSaved({ preserveUi: true });
  }

  const normalized = normalizePhoneForSms(phone);
  if (!normalized) {
    toast('Enter a valid preceptor phone number');
    return;
  }

  await ensureStudentPhoneForAutoConfirm(e);

  let share;
  try {
    share = await createOrUpdateEvalShare(e, e.preceptorShareToken);
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Could not create preceptor review link');
    return;
  }

  e.preceptorShareToken = share.token;
  e.preceptorReviewStatus = 'pending';
  items[i] = e;
  await store.set('typhon-items', items);
  renderSaved({ preserveUi: true });

  const body = buildEvalShareTextMessage(e, share.reviewUrl);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    toast('Opened text draft');
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied eval text. Paste into your message app.');
    } catch {
      toast('Could not open texting app on this device');
    }
  }
}

async function textCurrentEval() {
  const e = readEval();
  if (!e.preceptorName) {
    toast('Enter preceptor name first');
    return;
  }

  let phone = (e.preceptorPhone || '').trim();
  if (!phone) {
    const entered = await promptPhone('Preceptor Phone', 'Enter the preceptor\'s mobile number to send the eval link.');
    if (!entered) return;
    phone = entered.trim();
    const phoneEl = document.getElementById('e-preceptor-phone');
    if (phoneEl) phoneEl.value = phone;
  }

  const normalized = normalizePhoneForSms(phone);
  if (!normalized) {
    toast('Enter a valid preceptor phone number');
    return;
  }

  e.preceptorPhone = phone;
  await ensureStudentPhoneForAutoConfirm(e);
  let share;
  try {
    share = await createOrUpdateEvalShare(e, e.preceptorShareToken);
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Could not create preceptor review link');
    return;
  }
  e.preceptorShareToken = share.token;
  const tokenEl = document.getElementById('e-preceptor-share-token');
  if (tokenEl) tokenEl.value = share.token;

  const body = buildEvalShareTextMessage(e, share.reviewUrl);
  const smsUrl = `sms:${normalized}?body=${encodeURIComponent(body)}`;
  try {
    const win = window.open(smsUrl, '_blank');
    if (!win) window.location.href = smsUrl;
    toast('Opened text draft');
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      toast('Copied eval text. Paste into your message app.');
    } catch {
      toast('Could not open texting app on this device');
    }
  }
}

async function pullPreceptorUpdate(i) {
  const items = (await store.get('typhon-items')) || [];
  const item = items[i];
  if (!item || item.type !== 'eval' || !item.preceptorShareToken) {
    toast('No linked preceptor review found for this eval');
    return;
  }

  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable');
    return;
  }

  try {
    const snap = await db.collection(_evalShareCol).doc(item.preceptorShareToken).get();
    if (!snap.exists) {
      toast('Preceptor link not found');
      return;
    }
    const d = snap.data() || {};
    if (d.status !== 'completed' || !d.preceptorSubmission) {
      toast('Preceptor review is still pending');
      return;
    }

    const merged = {
      ...item,
      ...d.preceptorSubmission,
      id: item.id,
      type: 'eval',
      submitted: item.submitted,
      preceptorShareToken: item.preceptorShareToken,
      preceptorReviewStatus: 'completed',
      preceptorReviewCompletedAt: d.completedAt || Date.now()
    };

    items[i] = merged;
    await store.set('typhon-items', items);
    renderSaved({ preserveUi: true });
    toast('Pulled preceptor edits and signature');
  } catch (e) {
    console.error(e);
    toast('Could not pull preceptor update');
  }
}

async function initPreceptorReviewMode() {
  const params = new URLSearchParams(window.location.search);
  const token = (params.get('preceptorToken') || '').trim();
  if (!token) return;

  _activePreceptorToken = token;
  const tokenEl = document.getElementById('e-preceptor-share-token');
  if (tokenEl) tokenEl.value = token;
  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable for review link');
    return;
  }

  await ensureFirebaseAuthForShare();

  try {
    const snap = await db.collection(_evalShareCol).doc(token).get();
    if (!snap.exists) {
      toast('This review link is invalid or expired');
      return;
    }

    const d = snap.data() || {};
    const evalData = d.preceptorSubmission || d.eval;
    if (!evalData) {
      toast('No evaluation found for this link');
      return;
    }
    if (!evalData.studentPhone && d.studentPhone) evalData.studentPhone = d.studentPhone;

    hideStartScreen();
    goTab('eval');
    resetEval();
    setSelectedDayPill('e-day-pills', evalData.date || todayISO());
    loadEvalData(evalData);

    const banner = document.getElementById('preceptor-review-banner');
    const submitBtn = document.getElementById('btn-submit-preceptor-review');
    const saveBtn = document.getElementById('btn-save-eval');
    const draftBtn = document.getElementById('btn-draft-eval');
    const textBtn = document.getElementById('btn-text-eval');

    if (banner) {
      banner.style.display = 'block';
      banner.textContent = d.status === 'completed'
        ? 'This review was already submitted. You can update and submit again if needed.'
        : 'Preceptor Review Mode: review, edit, sign, then tap Send Back.';
    }
    if (submitBtn) submitBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';
    if (draftBtn) draftBtn.style.display = 'none';
    if (textBtn) textBtn.style.display = 'none';
  } catch (e) {
    console.error(e);
    toast('Could not load preceptor review link');
  }
}

async function submitPreceptorReview() {
  const tokenFromUrl = (() => {
    try { return new URLSearchParams(window.location.search).get('preceptorToken') || ''; } catch { return ''; }
  })();
  const tokenFromField = (document.getElementById('e-preceptor-share-token')?.value || '').trim();
  const submitToken = (_activePreceptorToken || tokenFromUrl || tokenFromField || '').trim();

  if (!submitToken) {
    toast('No active preceptor review token');
    return;
  }
  _activePreceptorToken = submitToken;

  const db = getFirestore();
  if (!db) {
    toast('Cloud database unavailable');
    return;
  }

  const evalData = readEval();

  try {
    await db.collection(_evalShareCol).doc(_activePreceptorToken).set({
      status: 'completed',
      preceptorSubmission: evalData,
      completedAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });

    await openStudentAutoConfirmText(evalData);

    const banner = document.getElementById('preceptor-review-banner');
    if (banner) banner.textContent = 'Submitted back successfully. You can close this page.';
    toast('Sent back to student');
  } catch (e) {
    console.error(e);
    toast(e?.message ? `Could not submit: ${e.message}` : 'Could not submit preceptor review');
  }
}

