// ============================================================
// DAY PILLS
// ============================================================
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function buildDayPills(containerId, dateStorageId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const today = new Date();
  for (let offset = 0; offset < 4; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dow = DAYS[d.getDay()];
    const label = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : dow;
    const shortDow = dow.substring(0, 3);
    const pill = document.createElement('div');
    pill.className = 'day-pill' + (offset === 0 ? ' today' : '') + (offset === 0 ? ' on' : '');
    pill.dataset.iso = iso;
    pill.dataset.container = containerId;
    pill.innerHTML = `<div class="dp-dow">${shortDow}</div><div class="dp-label">${label}</div>`;
    pill.addEventListener('click', () => {
      container.querySelectorAll('.day-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      if (dateStorageId) document.getElementById(dateStorageId).value = iso;
    });
    container.appendChild(pill);
  }
}

function getSelectedISO(containerId) {
  const on = document.querySelector(`#${containerId} .day-pill.on`);
  return on ? on.dataset.iso : todayISO();
}

// ============================================================
// TIMESTAMP
// ============================================================
function stampNow(inputId) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById(inputId);
  if (!el) return;
  el.value = hh + mm;
  el.classList.add('stamped');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  toast(`Stamped ${hh}:${mm}`);
}

function showStartScreen() {
  // Login must happen first. If auth landing is visible, don't show chooser yet.
  const landing = document.getElementById('auth-landing-screen');
  if (landing && !landing.classList.contains('hidden')) return;
  document.body.classList.add('show-start-screen');
  updateMobileEntryScrollLock();
  if (typeof window.updateContinueButton === 'function') window.updateContinueButton();
}

function hideStartScreen() {
  document.body.classList.remove('show-start-screen');
  updateMobileEntryScrollLock();
}

function initWelcomeScreen() {
  const welcome = document.getElementById('welcome-screen');
  const newCaseBtn = document.getElementById('welcome-new-case');
  const timeLogBtn = document.getElementById('welcome-time-log');
  const evalBtn = document.getElementById('welcome-eval');
  const draftsBtn = document.getElementById('welcome-drafts');
  if (!welcome || !newCaseBtn || !timeLogBtn || !draftsBtn) return;

  const timeContinueBtn = document.getElementById('welcome-time-continue');
  const timeClockInHint = document.getElementById('welcome-time-clockin');
  const caseContinueBtn = document.getElementById('welcome-case-continue');
  const caseHint = document.getElementById('welcome-case-hint');
  const evalContinueBtn = document.getElementById('welcome-eval-continue');

  function updateContinueButton() {
    const timeReady = hasTimeProgress();
    if (timeContinueBtn) timeContinueBtn.style.display = timeReady ? '' : 'none';
    if (timeClockInHint) {
      if (timeReady) {
        try {
          const t = JSON.parse(localStorage.getItem('typhon-time-progress') || '{}');
          const fmt = s => {
            if (!s) return null;
            const clean = s.replace(':', '');
            if (clean.length < 3) return s;
            const h = parseInt(clean.slice(0, -2), 10);
            const m = clean.slice(-2);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${m} ${ampm}`;
          };
          const inFmt = fmt(t.clockIn1);
          const outFmt = fmt(t.clockOut1);
          const parts = [inFmt ? 'Start: ' + inFmt : null, outFmt ? 'End: ' + outFmt : null].filter(Boolean);
          timeClockInHint.textContent = parts.length ? 'In Progress: ' + parts.join('  ·  ') : '';
          timeClockInHint.style.display = parts.length ? '' : 'none';
        } catch { timeClockInHint.style.display = 'none'; }
      } else {
        timeClockInHint.style.display = 'none';
      }
    }
    const caseReady = hasCaseProgress();
    if (caseContinueBtn) caseContinueBtn.style.display = caseReady ? '' : 'none';
    if (caseHint) {
      if (caseReady) {
        try {
          const c = JSON.parse(localStorage.getItem('typhon-draft') || '{}');
          const fmtT = s => {
            if (!s) return null;
            const clean = s.replace(':', '');
            if (clean.length < 3) return s;
            const h = parseInt(clean.slice(0, -2), 10);
            const m = clean.slice(-2);
            return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
          };
          const parts = [
            c.anesStart ? 'Start: ' + fmtT(c.anesStart) : null,
            c.anesFinish ? 'End: ' + fmtT(c.anesFinish) : null,
            c.age ? 'Age: ' + c.age : null,
            (c.anatomical && c.anatomical.length) ? c.anatomical.join(', ') : null
          ].filter(Boolean);
          caseHint.textContent = parts.length ? 'In Progress: ' + parts.join('  ·  ') : '';
          caseHint.style.display = parts.length ? '' : 'none';
        } catch { caseHint.style.display = 'none'; }
      } else {
        caseHint.style.display = 'none';
      }
    }
    if (evalContinueBtn) evalContinueBtn.style.display = (typeof hasEvalProgress === 'function' && hasEvalProgress()) ? '' : 'none';
  }

  window.updateContinueButton = updateContinueButton;

  const choose = (tabName, btn) => {
    hideStartScreen();
    goTab(tabName);
    btn.blur();
  };

  newCaseBtn.addEventListener('click', () => {
    hideStartScreen();
    goTab('case');
    if (hasCaseProgress()) restoreDraft();
    newCaseBtn.blur();
  });
  timeLogBtn.addEventListener('click', () => {
    hideStartScreen();
    goTab('time');
    if (hasTimeProgress()) restoreTimeProgress();
    timeLogBtn.blur();
  });
  if (evalBtn) evalBtn.addEventListener('click', () => choose('eval', evalBtn));
  draftsBtn.addEventListener('click', () => choose('saved', draftsBtn));

  if (timeContinueBtn) timeContinueBtn.addEventListener('click', () => {
    hideStartScreen(); goTab('time'); restoreTimeProgress(); timeContinueBtn.blur();
  });
  if (caseContinueBtn) caseContinueBtn.addEventListener('click', () => {
    hideStartScreen(); goTab('case'); restoreDraft(); caseContinueBtn.blur();
  });
  if (caseHint) caseHint.addEventListener('click', () => {
    hideStartScreen(); goTab('case'); restoreDraft();
  });
  if (evalContinueBtn) evalContinueBtn.addEventListener('click', () => {
    hideStartScreen(); goTab('eval');
    if (typeof restoreEvalProgress === 'function') restoreEvalProgress();
    evalContinueBtn.blur();
  });

  const wikiLink = document.getElementById('welcome-wiki-link');
  if (wikiLink) {
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    let base = '';
    for (let i = 1; i < depth; i++) { base += '../'; }
    wikiLink.href = base + 'AnesthesiaWiki.html';
  }

  let _authStateResolved = false;

  const syncStartScreenToAuth = () => {
    const user = window.AnesthesiaAuth?.getUser?.() ?? null;
    const gate       = document.getElementById('auth-gate-overlay');
    const gateLoad   = document.getElementById('auth-gate-loading');
    const gateSignin = document.getElementById('auth-gate-signin');

    if (!_authStateResolved) {
      // Firebase hasn't resolved yet — keep loading gate visible if it exists,
      // otherwise leave start screen showing so tabs don't flash
      if (gate) {
        gate.style.display = 'flex';
        hideStartScreen();
      }
      return;
    }

    if (!user) {
      // Auth resolved — not signed in: show sign-in gate if one exists.
      // If no gate overlay is present (e.g. TyphonCaseHelper.html), keep the
      // start screen visible — don't expose a blank case pane with no sign-in UI.
      if (gate) {
        hideStartScreen();
        gate.style.display = 'flex';
        if (gateLoad)   gateLoad.style.display   = 'none';
        if (gateSignin) gateSignin.style.display = '';
      }
      // else: leave start screen in place — AnesthesiaAuth will trigger sign-in
    } else {
      // Signed in — hide gate and show welcome
      if (gate) gate.style.display = 'none';
      showStartScreen();
    }
  };

  // Initial call — Firebase not yet resolved, shows loading gate
  syncStartScreenToAuth();

  // When Firebase resolves (or auth state changes), re-evaluate
  window.addEventListener('typhon-auth-changed', () => {
    _authStateResolved = true;
    syncStartScreenToAuth();
  });

  window.addEventListener('resize', updateMobileEntryScrollLock);
  installMobileScrollGuard();
}

function enhanceNumericInputs() {
  // Force numeric keyboard on mobile for every numeric count field.
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('pattern', '[0-9]*');
  });

  // Count boxes are button-driven: prevent manual typing/editing.
  document.querySelectorAll('.count-input').forEach((el) => {
    el.readOnly = true;
    el.setAttribute('inputmode', 'none');
    el.setAttribute('autocomplete', 'off');
  });

  // Time fields stay text for flexible formatting but should still show number keypad.
  ['c-as', 'c-af', 't-in1', 't-out1'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('pattern', '[0-9]*');
    el.setAttribute('autocomplete', 'off');
  });
}

function enforceExtensionScrolling() {
  if (window.location.protocol !== 'chrome-extension:') return;

  document.documentElement.classList.add('ext-runtime');
  document.body.classList.add('ext-runtime');
  document.documentElement.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';

  const setPaneOverflow = () => {
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.style.overflow = 'visible';
    });
  };

  setPaneOverflow();
  window.addEventListener('resize', setPaneOverflow);
}

function initCaseMobilePager() {
  const pane = document.getElementById('pane-case');
  if (!pane) return;

  const shouldUseMobilePager = () =>
    window.matchMedia('(max-width: 820px)').matches && window.location.protocol !== 'chrome-extension:';

  const cards = [...pane.querySelectorAll(':scope > .card')];
  const prevBtn = document.getElementById('case-step-prev');
  const nextBtn = document.getElementById('case-step-next');
  const countEl = document.getElementById('case-step-count');
  const titleEl = document.getElementById('case-step-title');
  if (!cards.length || !prevBtn || !nextBtn || !countEl || !titleEl) return;

  const getCardTitle = (card) => card.dataset.stepTitle || card.querySelector('.card-title')?.textContent?.replace(/\s+/g, ' ').trim() || 'Case Section';

  const render = () => {
    const mobile = shouldUseMobilePager();
    pane.classList.toggle('mobile-paged', mobile);

    if (!mobile) {
      pane.classList.remove('last-step');
      cards.forEach(card => card.classList.remove('active-step'));
      countEl.textContent = `Step 1 of ${cards.length}`;
      titleEl.textContent = getCardTitle(cards[0]);
      prevBtn.disabled = true;
      nextBtn.disabled = false;
      const planPillD = document.getElementById('case-plan-pill');
      if (planPillD) planPillD.style.display = _activePlanName ? '' : 'none';
      return;
    }

    casePager.index = Math.max(0, Math.min(casePager.index, cards.length - 1));
    cards.forEach((card, idx) => card.classList.toggle('active-step', idx === casePager.index));

    countEl.textContent = `Step ${casePager.index + 1} of ${cards.length}`;
    titleEl.textContent = getCardTitle(cards[casePager.index]);
    prevBtn.disabled = casePager.index === 0;
    nextBtn.disabled = casePager.index === cards.length - 1;
    pane.classList.toggle('last-step', casePager.index === cards.length - 1);

    // Lock vertical scroll on all steps except:
    //   step 8 (index 7 — Anesthesia Type) — always scrollable
    //   step 7 (index 6 — Anatomical Category) — scrollable when a cascading dropdown is open
    const SCROLL_STEP = 7; // 0-indexed (step 8 of 10)
    const ANAT_STEP = 6;   // 0-indexed (step 7 of 10)
    const anatDropdownOpen = casePager.index === ANAT_STEP && !!document.querySelector('.anat-dropdown.open');
    const lockScroll = casePager.index !== SCROLL_STEP && !anatDropdownOpen;
    document.documentElement.style.overflowY = lockScroll ? 'hidden' : '';
    document.body.style.overflowY = lockScroll ? 'hidden' : '';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const planPill = document.getElementById('case-plan-pill');
    if (planPill) planPill.style.display = (casePager.index === 0 && _activePlanName) ? '' : 'none';
  };

  const stepBy = (delta) => {
    casePager.index += delta;
    render();
  };

  casePager = { index: 0, cards, render };

  // Swipe left/right to move between case cards on mobile.
  let touchStartX = null;
  let touchStartY = null;
  pane.addEventListener('touchstart', (event) => {
    if (!shouldUseMobilePager()) return;
    if (!event.touches || event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  pane.addEventListener('touchend', (event) => {
    if (!shouldUseMobilePager()) return;
    if (touchStartX == null || touchStartY == null) return;
    if (!event.changedTouches || !event.changedTouches.length) return;

    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 30 || absDx < absDy) return;

    if (dx < 0) stepBy(1);
    else stepBy(-1);
  }, { passive: true });

  prevBtn.addEventListener('click', () => stepBy(-1));
  nextBtn.addEventListener('click', () => stepBy(1));
  window.addEventListener('resize', render);
  render();
}

function initEvalMobilePager() {
  const pane = document.getElementById('pane-eval');
  if (!pane) return;

  const shouldUseMobilePager = () =>
    window.matchMedia('(max-width: 820px)').matches && window.location.protocol !== 'chrome-extension:';

  const cards = [...pane.querySelectorAll(':scope > .card')];
  const stepItems = [];

  const pushStep = (el, fallbackTitle) => {
    if (!el) return;
    stepItems.push({
      el,
      card: el.classList.contains('card') ? el : el.closest('.card'),
      title: el.dataset.stepTitle || fallbackTitle || 'Evaluation Section'
    });
  };

  // Keep date and preceptor/facility as dedicated pages.
  pushStep(pane.querySelector(':scope > .card:nth-of-type(1)'), 'Date');
  pushStep(pane.querySelector(':scope > .card[data-step-title="Q3 - Preceptor & Facility"]'), 'Q3 - Preceptor & Facility');

  // Q4-Q17 each as their own page.
  pane.querySelectorAll('.eval-question-step').forEach((q) => {
    pushStep(q, q.querySelector('label')?.textContent?.replace(/\s+/g, ' ').trim());
  });

  // Signature should remain its own page after Q17.
  pushStep(document.getElementById('sig-canvas')?.closest('.card'), 'Preceptor Signature');
  const prevBtn = document.getElementById('eval-step-prev');
  const nextBtn = document.getElementById('eval-step-next');
  const countEl = document.getElementById('eval-step-count');
  const titleEl = document.getElementById('eval-step-title');
  if (!cards.length || !stepItems.length || !prevBtn || !nextBtn || !countEl || !titleEl) return;

  const render = () => {
    const mobile = shouldUseMobilePager();
    pane.classList.toggle('mobile-paged', mobile);

    if (!mobile) {
      pane.classList.remove('last-step');
      cards.forEach(card => card.classList.remove('active-step'));
      pane.querySelectorAll('.eval-question-step').forEach((q) => q.classList.remove('active-question'));
      countEl.textContent = `Step 1 of ${stepItems.length}`;
      titleEl.textContent = stepItems[0].title;
      prevBtn.disabled = true;
      nextBtn.disabled = false;
      return;
    }

    evalPager.index = Math.max(0, Math.min(evalPager.index, stepItems.length - 1));
    const activeStep = stepItems[evalPager.index];
    cards.forEach((card) => card.classList.toggle('active-step', card === activeStep.card));

    const questionsInActiveCard = activeStep.card
      ? [...activeStep.card.querySelectorAll('.eval-question-step')]
      : [];
    pane.querySelectorAll('.eval-question-step').forEach((q) => q.classList.remove('active-question'));
    if (questionsInActiveCard.length) {
      questionsInActiveCard.forEach((q) => q.classList.remove('active-question'));
      if (!activeStep.el.classList.contains('card')) activeStep.el.classList.add('active-question');
    }

    countEl.textContent = `Step ${evalPager.index + 1} of ${stepItems.length}`;
    titleEl.textContent = activeStep.title;
    prevBtn.disabled = evalPager.index === 0;
    nextBtn.disabled = evalPager.index === stepItems.length - 1;
    pane.classList.toggle('last-step', evalPager.index === stepItems.length - 1);
    if (evalPager.index === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepBy = (delta) => {
    evalPager.index += delta;
    render();
  };

  evalPager = { index: 0, cards: stepItems, render };

  let touchStartX = null;
  let touchStartY = null;
  pane.addEventListener('touchstart', (event) => {
    if (!shouldUseMobilePager()) return;
    if (!event.touches || event.touches.length !== 1) return;
    if (event.target.closest('#sig-canvas')) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  pane.addEventListener('touchend', (event) => {
    if (!shouldUseMobilePager()) return;
    if (touchStartX == null || touchStartY == null) return;
    if (!event.changedTouches || !event.changedTouches.length) return;
    if (event.target.closest('#sig-canvas')) { touchStartX = null; touchStartY = null; return; }

    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 30 || absDx < absDy) return;

    if (dx < 0) stepBy(1);
    else stepBy(-1);
  }, { passive: true });

  prevBtn.addEventListener('click', () => stepBy(-1));
  nextBtn.addEventListener('click', () => stepBy(1));
  window.addEventListener('resize', render);
  render();
}

function bindUiEvents() {
  const tabNames = ['case', 'time', 'saved'];
  document.querySelectorAll('.tab').forEach((tab, idx) => {
    tab.addEventListener('click', () => goTab(tab.dataset.tab || tabNames[idx]));
  });

  document.querySelectorAll('.btn-stamp').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.target || btn.closest('.ts-row')?.querySelector('input')?.id;
      if (inputId) stampNow(inputId);
    });
  });

  document.getElementById('btn-save-case')?.addEventListener('click', () => window.saveCase());
  document.getElementById('btn-draft-case')?.addEventListener('click', saveDraftCase);
  document.getElementById('btn-save-time')?.addEventListener('click', saveTimeLog);
  document.getElementById('btn-clear-time')?.addEventListener('click', () => {
    if (confirm('Clear the current time log form?')) resetTimeLog();
  });
  document.getElementById('btn-draft-time')?.addEventListener('click', saveDraftTimeLog);
  document.getElementById('btn-save-eval')?.addEventListener('click', saveEval);
  document.getElementById('btn-draft-eval')?.addEventListener('click', saveDraftEval);
  document.getElementById('btn-text-eval')?.addEventListener('click', textCurrentEval);
  document.getElementById('btn-submit-preceptor-review')?.addEventListener('click', submitPreceptorReview);
  document.getElementById('draft-banner-resume')?.addEventListener('click', async () => {
    const items = (await store.get('typhon-items')) || [];
    const idx = items.findIndex(i => i.draft && i.type === 'case');
    if (idx >= 0) resumeDraftItem(idx);
  });
  document.getElementById('draft-banner-dismiss')?.addEventListener('click', hideDraftBanner);

  document.addEventListener('click', (event) => {
    const asaBtn = event.target.closest('.asa-btn');
    if (asaBtn) {
      // Legacy markup still has inline onclick on ASA buttons.
      // Skip delegated handling in that case to avoid double-toggle.
      if (!asaBtn.hasAttribute('onclick')) pickASA(asaBtn);
      return;
    }

    const btnTog = event.target.closest('.btn-tog');
    if (btnTog) {
      // Legacy markup still has inline onclick on many .btn-tog elements.
      // Skip delegated handling for those so one tap = one toggle.
      if (btnTog.hasAttribute('onclick')) return;
      const groupId = btnTog.closest('.btn-group')?.id;
      if (!groupId) return;
      if (groupId === 'grp-sex' || groupId === 'grp-admit' || groupId === 'grp-preceptor' || groupId === 'grp-urgency' || groupId === 'grp-neonate' ||
          groupId === 'e-arrived' || groupId === 'e-q8' || groupId === 'e-q9' || groupId === 'e-q10' || groupId === 'e-q11' ||
          groupId === 'e-q12' || groupId === 'e-q13' || groupId === 'e-q14' || groupId === 'e-q16') pick(btnTog, groupId);
      else multi(btnTog, groupId);
      // Show/hide Q16 "Other" text field
      if (groupId === 'e-q16') {
        const otherInput = document.getElementById('e-q16-other');
        if (otherInput) {
          const isOther = !!document.querySelector('#e-q16 .btn-tog[data-v="other"].on');
          otherInput.style.display = isOther ? '' : 'none';
          if (!isOther) otherInput.value = '';
        }
      }
      return;
    }

    const secHeader = event.target.closest('.sec-header');
    if (secHeader) {
      const section = secHeader.closest('.sec-tog');
      const inAnesType = !!secHeader.closest('#card-anes-type');

      if (inAnesType) {
        const cb = secHeader.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (section && (section.id === 'sec-general' || section.id === 'sec-regional')) {
          const body = section.querySelector('.sec-body');
          if (body && cb) {
            body.classList.toggle('open', cb.checked);
            section.classList.toggle('expanded', cb.checked);
          }
        }

        // MAC and Sedation rows are simple sec-tog blocks without ids.
        // Ensure their visual selected state is refreshed immediately.
        syncSelectionRowStates();
        return;
      }

      if (section && section.id && !event.target.closest('input[type="checkbox"]')) toggleSec(section.id);
      return;
    }

    const actionBtn = event.target.closest('[data-action][data-idx]');
    if (actionBtn) {
      const i = Number(actionBtn.dataset.idx);
      const action = actionBtn.dataset.action;
      if (action === 'edit-case') editCase(i);
      if (action === 'edit-timelog') editTimelog(i);
      if (action === 'edit-eval') editEval(i);
      if (action === 'text-eval') textEval(i);
      if (action === 'toggle-submit') toggleSubmit(i);
      if (action === 'delete-item') { if (confirm('Delete this item? This cannot be undone.')) deleteItem(i); }
      if (action === 'resume-draft') resumeDraftItem(i);
      if (action === 'sync-preceptor') syncPendingEvals();
      return;
    }

    const countStepBtn = event.target.closest('[data-count-adjust][data-target]');
    if (countStepBtn) {
      const delta = Number(countStepBtn.dataset.countAdjust || 0);
      const target = countStepBtn.dataset.target;
      if (delta && target) adjustCountInput(target, delta);
      return;
    }

    const folderHeader = event.target.closest('.submitted-folder-header, .date-folder-header');
    if (folderHeader) {
      const folder = folderHeader.closest('.submitted-folder, .date-folder');
      if (folder) folder.classList.toggle('open');
    }
  });

  document.getElementById('c-general')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-regional')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-mac')?.addEventListener('click', (event) => event.stopPropagation());
  document.getElementById('c-sedation')?.addEventListener('click', (event) => event.stopPropagation());

  document.getElementById('c-general')?.addEventListener('change', function () {
    autoOpen('sec-general', this);
  });
  document.getElementById('c-regional')?.addEventListener('change', function () {
    autoOpen('sec-regional', this);
  });

  // iOS Safari doesn't fire 'change' reliably on display:none checkboxes.
  // Handle click on the label directly as a fallback (setTimeout lets the
  // browser toggle the checkbox state before we read it).
  document.addEventListener('click', (event) => {
    const label = event.target.closest('.chk-item');
    if (label) setTimeout(() => syncSelectionRowStates(), 0);
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('.chk-item input[type="checkbox"], .count-row label input[type="checkbox"]')) {
      syncSelectionRowStates();
    }
    if (event.target.matches('.count-input')) {
      syncSelectionRowStates();
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('.count-input')) {
      syncSelectionRowStates();
    }
  });

  syncSelectionRowStates();
  updateAnatomicalDetailsVisibility();
}

function bindProcedureDependencies() {
  const base = document.getElementById('c-cvl-actual');
  const picc = document.getElementById('c-cvl-picc');
  const nonPicc = document.getElementById('c-cvl-nonpicc');
  if (!base || !picc || !nonPicc) return;

  const syncCentralLineBase = () => {
    if (picc.checked || nonPicc.checked) {
      base.checked = true;
      base.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  picc.addEventListener('change', syncCentralLineBase);
  nonPicc.addEventListener('change', syncCentralLineBase);
}

// ============================================================
// PLANNED CASES — load from Care Plan Generator Firestore docs
// ============================================================

// Returns "YYYY-MM-DD" for today in local time.
function _todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Convert CPG's "M/D/YYYY" or "MM/DD/YYYY" to "YYYY-MM-DD".
function _cpgDateToIso(raw) {
  if (!raw) return '';
  const parts = String(raw).split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // Already ISO or unknown — return as-is
  return raw;
}

function _getPlannedCompletions() {
  try { return JSON.parse(localStorage.getItem('typhon-plan-completions') || '[]'); }
  catch { return []; }
}

function _markPlanCompleted(planName) {
  const comps = _getPlannedCompletions();
  const today = _todayIso();
  if (!comps.find(c => c.planName === planName && c.date === today)) {
    comps.push({ planName, date: today, completedAt: new Date().toISOString() });
    localStorage.setItem('typhon-plan-completions', JSON.stringify(comps));
  }
  // Always attempt cloud write — re-read localStorage so we get the full
  // current list even if the entry already existed from a prior null-auth call.
  _pushCompletionsToCloud();
}

function _unmarkPlanCompleted(planName) {
  const today = _todayIso();
  const updated = _getPlannedCompletions().filter(c => !(c.planName === planName && c.date === today));
  localStorage.setItem('typhon-plan-completions', JSON.stringify(updated));
  _pushCompletionsToCloud();
}

// Write the full localStorage completion list to Firestore.
// If auth isn't ready yet, queues one retry on the next typhon-auth-changed.
function _pushCompletionsToCloud() {
  const uid = _getAuthUid();
  if (!uid) {
    // Auth not ready — retry exactly once when it resolves.
    window.addEventListener('typhon-auth-changed', () => {
      const latestComps = _getPlannedCompletions();
      if (!latestComps.length) return;
      store.set('typhon-plan-completions', latestComps)
        .then(r => {
          console.log(`[sync] _pushCompletionsToCloud (deferred): cloud=${r && r.cloud}`, r);
          if (!r || !r.cloud) toast(`⚠️ Sync: completion NOT saved to cloud (deferred). UID: ${_getAuthUid() || 'none'}`);
        })
        .catch(e => {
          console.error('[sync] _pushCompletionsToCloud deferred write failed', e);
          toast(`⚠️ Sync error: ${e.message || e}`);
        });
    }, { once: true });
    console.log('[sync] _pushCompletionsToCloud: auth not ready, queued for next auth-changed');
    return;
  }
  const latestComps = _getPlannedCompletions();
  store.set('typhon-plan-completions', latestComps)
    .then(r => {
      const status = r && r.cloud ? `☁️ saved to cloud` : `⚠️ local only (no cloud)`;
      console.log(`[sync] _pushCompletionsToCloud: UID:${uid} — ${status}`, r);
      if (!r || !r.cloud) toast(`⚠️ Sync: completion NOT saved to cloud. UID: ${uid}`);
    })
    .catch(e => {
      console.error('[sync] _pushCompletionsToCloud write failed', e);
      toast(`⚠️ Sync error: ${e.message || e}`);
    });
}

// Track which CPG plan is currently pre-filling the form.
// Exposed on window so app.save.js can tag the saved case.
let _activePlanName = null;
Object.defineProperty(window, '_activePlanName', {
  get() { return _activePlanName; },
  set(v) { _activePlanName = v; },
  configurable: true
});
// Cache today's plans for re-rendering after completion.
let _todaysPlans = [];

async function loadAndRenderPlannedCases() {
  const db = getFirestore();
  if (!db) { console.warn('[plannedCases] Firestore not available'); renderPlannedCases([]); return; }

  // Collect all userId values to try: Firebase Auth UID + legacy CPG text-ID
  const uid      = _getAuthUid();
  let legacyId   = null;
  try { legacyId = localStorage.getItem('carePlanCloudUserId') || null; } catch {}
  const userIds  = [...new Set([uid, legacyId].filter(Boolean))];
  console.log('[plannedCases] userIds to query:', userIds, '| today:', _todayIso());
  if (userIds.length === 0) { console.warn('[plannedCases] No userId available'); renderPlannedCases([]); return; }

  const today = _todayIso();
  const plans = [];

  try {
    for (const userId of userIds) {
      const snap = await db.collection('carePlanSavedPlans').where('userId', '==', userId).get();
      console.log('[plannedCases] userId', userId, '→', snap.size, 'docs');
      snap.forEach(doc => {
        const data  = doc.data();
        const state = data.state || {};
        const iso   = _cpgDateToIso(state['pat-surg-date'] || '');
        console.log('[plannedCases] doc', doc.id, '| surgDate raw:', state['pat-surg-date'], '→ iso:', iso);
        if (iso === today && !plans.find(p => p.name === (data.name || doc.id))) {
          plans.push({ name: data.name || doc.id, state });
        }
      });
    }
    _todaysPlans = plans;

    // Seed completions from Firestore-synced saved items (so other devices see ✓ Logged)
    try {
      const savedItems = (await store.get('typhon-items')) || [];
      savedItems.forEach(item => {
        if (item.type === 'case' && item.cpgPlanName && item.date === today) {
          _markPlanCompleted(item.cpgPlanName);
        }
      });
    } catch(e) { console.warn('[plannedCases] cloud completions seed failed', e); }

    renderPlannedCases(plans);
  } catch(e) {
    console.warn('[loadAndRenderPlannedCases]', e);
    renderPlannedCases([]);
  }
}

// Pre-fill the Typhon case form from a CPG plan, then navigate to the case tab.

// Infer Typhon anatomical category data-v values from a free-text surgery name.
function _inferAnatCategories(surgeryName) {
  const n = (surgeryName || '').toLowerCase();
  const cats = [];

  if (/craniotomy|craniectomy|intracranial|\bbrain\b|cerebr|ventriculo|vp shunt|deep brain|dbs/.test(n))
    cats.push('Head - Intracranial');

  if (/tonsil|adenoid|uvulo|pharyn|laryngoscop|panendoscop|\bdental\b|palate|\bmouth\b|\btongue\b/.test(n))
    cats.push('Head - Oropharyngeal');

  if (/\beye\b|ocular|ophthalm|orbital|cataract|vitrectomy|retina|\bear\b|mastoid|tympan|myringotomy|cochlear|\bsinus\b|nasal|septoplasty|rhinoplasty|facial|parotid|\bscalp\b/.test(n))
    cats.push('Head - Extracranial');

  if (/thyroid|parathyroid|neck dissection|tracheostom|tracheotom|cervical(?!.*(spine|fusion|disc|vertebr|cord))/.test(n))
    cats.push('Neck');

  if (/cabg|coronary|cardiac|\bheart\b|\bvalve\b|valvuloplasty|aortic.*(valve|root)|mitral|tricuspid|tavr|lvad|sternotomy|pericardi/.test(n))
    cats.push('Intrathoracic - Heart');

  if (/lobectomy|pneumonectomy|pulmonary|thoracoscop|\bvats\b|\bpleur|wedge resection|bronchoscop/.test(n))
    cats.push('Intrathoracic - Lung');

  if (/esophag|mediastin|thymectomy|\bthymus\b|\bdiaphragm\b/.test(n))
    cats.push('Intrathoracic - Other');

  if (/spin(?:al|e)|laminectomy|discectomy|\bfusion\b|vertebr|\blumbar\b|\bacdf\b|kyphoplasty|vertebroplasty|scoliosis|cervical.*(spine|fusion|disc|vertebr)|anterior.*(spine|cervical|lumbar|thoracic)|posterior.*(spine|cervical|lumbar|thoracic)/.test(n))
    cats.push('Neuroskeletal');

  if (/vascular|endarterectomy|\bcarotid\b|aortofemoral|\baaa\b|aneurysm|endovascular|angioplasty|av fistula|dialysis access|vein stripping|femoropopliteal|femoral.popliteal|arterial.bypass/.test(n))
    cats.push('Vascular');

  if (/laparoscop|laparotomy|appendectomy|colectomy|\bcolon\b|\bbowel\b|cholecystectomy|gallbladder|\bliver\b|hepat|pancreat|whipple|splenectomy|\bspleen\b|gastric|gastrectomy|nissen|fundoplication|hysterectomy|oophorectomy|ovarian|\buterine\b|ileum|jejunum|duodenum|cecum|sigmoid|nephrectomy|\bkidney\b|\badrenal\b|retroperitoneal|peritoneal|inguinal hernia|umbilical hernia|ventral hernia|incisional hernia|\brectal\b/.test(n))
    cats.push('Intra-abdominal');

  if (/perineal|perianal|perirectal|hemorrhoid|anal fistula|rectovaginal|\banal\b|\banus\b|sphincter/.test(n))
    cats.push('Perineal');

  if (/cesarean|c.section|\bltcs\b/.test(n))
    cats.push('Cesarean delivery');

  if (/labor.*epidural|epidural.*labor/.test(n))
    cats.push('Analgesia for labor');

  if (/\bshoulder\b|rotator cuff|\belbow\b|\bwrist\b|\bhand\b|\bfinger\b|\bhip\b|\bknee\b|\bankle\b|\bfoot\b|\btoe\b|tibial|fibular|femoral(?!.*(artery|pop|bypass))|humeral|radial|ulnar|carpal|\bdigit\b|arthroplasty|joint replacement|orif|\bacl\b|meniscus|tendon|ligament/.test(n))
    cats.push('Extremities');

  if (/\bbreast\b|mastectomy|lumpectomy|chest wall|\brib\b|\bsternum\b/.test(n))
    cats.push('Extrathoracic');

  if (/\bect\b|electroconvulsive|\bebus\b|colonoscopy|\begd\b|esophagogastroduodenoscop/.test(n))
    cats.push('Other');

  return cats;
}

function prefillFromCPGPlan(planName, planState) {
  const s = planState || {};
  resetCase();

  // Date — select the matching day pill
  const isoDate = _cpgDateToIso(s['pat-surg-date'] || '');
  if (isoDate) {
    const pill = document.querySelector(`#day-pills .day-pill[data-iso="${isoDate}"]`);
    if (pill) {
      document.querySelectorAll('#day-pills .day-pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
    }
  }

  // Biological sex  (CPG stores 'M'/'F', Typhon uses 'Male'/'Female')
  const sexMap = { M: 'Male', F: 'Female' };
  const sex = sexMap[s['pat-gender']] || s['pat-gender'] || '';
  if (sex) {
    document.querySelectorAll('#grp-sex .btn-tog').forEach(b => b.classList.toggle('on', b.dataset.v === sex));
  }

  // Age
  const age = s['pat-age'];
  if (age) {
    const ageEl = document.getElementById('c-age');
    if (ageEl) ageEl.value = age;
  }

  // ASA class (CPG: "1"–"6", Typhon data-v: "1"–"6")
  const asa = s['pat-asa-class'] ? String(s['pat-asa-class']).trim() : '';
  if (asa) {
    document.querySelectorAll('#grp-asa .asa-btn').forEach(b => b.classList.toggle('on', b.dataset.v === asa));
  }

  // Anesthesia type
  const anesType = (s['anes-type'] || '').toLowerCase().trim();
  if (anesType === 'general') {
    const cb = document.getElementById('c-general');
    if (cb) { cb.checked = true; autoOpen('sec-general', cb); }
  } else if (anesType === 'mac') {
    const cb = document.getElementById('c-mac');
    if (cb) cb.checked = true;
  } else if (anesType === 'sedation') {
    const cb = document.getElementById('c-sedation');
    if (cb) cb.checked = true;
  } else if (anesType === 'spinal') {
    const regCb = document.getElementById('c-regional');
    if (regCb) { regCb.checked = true; autoOpen('sec-regional', regCb); }
    const spCb = document.getElementById('c-reg-spinal');
    if (spCb) spCb.checked = true;
  } else if (anesType === 'epidural') {
    const regCb = document.getElementById('c-regional');
    if (regCb) { regCb.checked = true; autoOpen('sec-regional', regCb); }
    const epCb = document.getElementById('c-reg-epidural');
    if (epCb) epCb.checked = true;
  }

  // Anesthesia Start / Finish times — CPG stores as "HH:MM", Typhon uses "HHMM"
  const toMil = t => (t || '').trim().replace(':', '');
  const startTime = toMil(s['pat-sched-surg-time']);
  const finishTime = toMil(s['pat-surg-end-time']);
  if (startTime) {
    const asEl = document.getElementById('c-as');
    if (asEl) asEl.value = startTime;
  }
  if (finishTime) {
    const afEl = document.getElementById('c-af');
    if (afEl) afEl.value = finishTime;
  }

  // A-Line — if CPG equipment includes an art line, check both procedure boxes
  if (s['equip-aline']) {
    const artActual = document.getElementById('c-art-actual');
    const artBp     = document.getElementById('c-art-bp');
    if (artActual) artActual.checked = true;
    if (artBp)     artBp.checked     = true;
  }

  // Surgical position — map CPG values to Typhon's 4 supported buttons
  const posMap = {
    'Prone':                 'Prone',
    'Lithotomy':             'Lithotomy',
    'Lateral Decubitus':     'Lateral',
    'Sitting / Beach Chair': 'Sitting'
  };
  const typhonPos = posMap[(s['pat-position'] || '').trim()];
  if (typhonPos) {
    const posBtn = document.querySelector(`#grp-pos .btn-tog[data-v="${typhonPos}"]`);
    if (posBtn) posBtn.click();
  }

  // Anatomical category — inferred from surgery name
  const surgeryName = (s['pat-surgery'] || '').trim();
  if (surgeryName) {
    const anatCats = _inferAnatCategories(surgeryName);
    anatCats.forEach(cat => {
      const btn = document.querySelector(`#grp-anat .btn-tog[data-v="${cat}"]`);
      if (btn) btn.classList.add('on');
    });
    updateAnatomicalDetailsVisibility();
    // Other — tick the matching detail checkbox
    const sn = surgeryName.toLowerCase();
    const otherDetails = [
      { pattern: /\bect\b|electroconvulsive/,          id: 'c-anat-other-ect'        },
      { pattern: /\bebus\b/,                           id: 'c-anat-other-ebus'       },
      { pattern: /colonoscopy/,                        id: 'c-anat-other-colonoscopy' },
      { pattern: /\begd\b|esophagogastroduodenoscop/,  id: 'c-anat-other-egd'        },
    ];
    otherDetails.forEach(({ pattern, id }) => {
      if (pattern.test(sn)) { const el = document.getElementById(id); if (el) el.checked = true; }
    });
  }

  // Initial Preanesthetic Assessment — always pre-select
  const assessBtn = document.querySelector('#grp-assess .btn-tog[data-v="initial"]');
  if (assessBtn) assessBtn.click();

  // Ambulatory / Outpatient — always pre-select
  const admitBtn = document.querySelector('#grp-admit .btn-tog[data-v="Outpatient"]');
  if (admitBtn) admitBtn.click();

  // General anesthesia detail checkboxes
  if (anesType === 'general') {
    const isLMA  = (s['ind-airway-method'] || '') === 'LMA';
    const _aw    = (s['ind-airway-method'] || '').toUpperCase();
    const isBMV  = _aw === 'BMV' || _aw === 'BVM';  // CPG may store either spelling
    const isTIVA = !!s['tiva-box'];
    const isRSI  = (s['ind-rsi'] || '') === 'Yes';

    const ids = ['c-gen-minimal', 'c-gen-iv'];         // Minimal + IV induction — always
    if (!isRSI)  ids.push('c-gen-mask-ind');           // mask vent induction — skip for RSI
    if (isLMA)        ids.push('c-gen-lma');           // LMA airway
    else if (isBMV)   ids.push('c-gen-mask-maint');    // BMV: mask maintenance, no ETT
    else              ids.push('c-gen-ett-oral');      // ETT oral — default
    if (isTIVA)  ids.push('c-gen-tiva');               // TIVA flag
    if (!isBMV)  ids.push('c-gen-emerge');             // emergence — skip for BMV (mask airway)

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
  }

  // Medications — map CPG drug selections to Typhon medication checkboxes
  const _parseDrugList = json => {
    try {
      return (JSON.parse(json || '[]') || [])
        .map(r => typeof r === 'string' ? r : (r.drug || r.name || r.med || ''))
        .filter(Boolean);
    } catch (e) { return []; }
  };
  const OPIOIDS = new Set([
    'Fentanyl','Remifentanil','Sufentanil','Alfentanil',
    'Morphine','Hydromorphone','Dilaudid','Oxycodone','Meperidine','Methadone'
  ]);
  const intraopDrugs = _parseDrugList(s['plan-intraop-list']);
  const postopDrugs  = _parseDrugList(s['plan-postop-list']);
  const bluntDrug    = (s['ind-blunt-select'] || '').trim();

  const medChecks = {
    'c-med-inhal':  !!(s['ind-inhalation'] || '').trim(),
    'c-med-iv-ind': !!(s['ind-agent-select'] || '').trim(),
    'c-med-nmb':    !!(s['ind-paralytic'] || '').trim(),
    'c-med-opioid': OPIOIDS.has(bluntDrug) ||
                    intraopDrugs.some(d => OPIOIDS.has(d)) ||
                    postopDrugs.some(d => OPIOIDS.has(d)),
    'c-med-other':  !!(s['ind-anxiolytic-select'] || '').trim() ||
                    !!(s['ind-sed-drip'] || '').trim() ||
                    !!s['tiva-box'] ||
                    (!!bluntDrug && !OPIOIDS.has(bluntDrug))  // e.g. Esmolol, Dexmedetomidine
  };
  Object.entries(medChecks).forEach(([id, shouldCheck]) => {
    if (shouldCheck) {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    }
  });

  // General anesthesia triggers Mechanical Ventilation — except BMV/BVM (mask airway, no intubation/device)
  const _awUp = (s['ind-airway-method'] || '').toUpperCase();
  if (anesType === 'general' && _awUp !== 'BMV' && _awUp !== 'BVM') {
    const mechVent = document.getElementById('c-mech-vent');
    if (mechVent) mechVent.checked = true;
  }

  // IV Starts — only count an IV start when CPG explicitly has a 2nd PIV selected.
  const ivStartEl = document.getElementById('c-iv-n');
  if (ivStartEl) ivStartEl.value = s['equip-2piv'] ? '1' : '';

  // Airway method — VL/FI trigger airway procedure checkboxes
  // Exception: ECT/EBUS/colonoscopy/EGD don't use intubation — skip c-tech-other even if plan data has stale VL
  const airwayMethod = (s['ind-airway-method'] || '').trim();
  const _isNoIntubProc = /\bect\b|electroconvulsive|\bebus\b|colonoscopy|\begd\b|esophagogastroduodenoscop/.test((s['pat-surgery'] || '').toLowerCase());
  if (airwayMethod === 'VL' && !_isNoIntubProc) {
    const el = document.getElementById('c-tech-other');
    if (el) el.checked = true;
  } else if (airwayMethod === 'FI' && !_isNoIntubProc) {
    ['c-endo-tt-placement', 'c-endo-airway-assess', 'c-tech-other'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
  }

  // Record the active plan so submission can mark it complete
  _activePlanName = planName;

  // Show plan pill on step 1
  const _pillLabel = [s['pat-sched-surg-time'], s['pat-initials'], s['pat-surgery']].filter(Boolean).join(' · ') || planName;
  const _planPill = document.getElementById('case-plan-pill');
  if (_planPill) { _planPill.textContent = '📋 ' + _pillLabel; _planPill.style.display = ''; }

  syncSelectionRowStates();
  updateAnatomicalDetailsVisibility();

  // Navigate to case tab and scroll to top of pager
  hideStartScreen();
  goTab('case');
  if (casePager) { casePager.index = 0; casePager.render(); }

  toast(`Pre-filled from: ${planName}`);
}

// Auto-fill eval form fields from the day's saved case logs.
async function prefillEvalFromDayCases() {
  const evalDate = getSelectedISO('e-day-pills');
  if (!evalDate) return;

  const items = (await store.get('typhon-items')) || [];
  const dayCases = items.filter(it => it.type === 'case' && !it.draft && it.date === evalDate);
  if (!dayCases.length) return;

  // Helper: check a checkbox in a grid by value (idempotent)
  const checkByValue = (gridId, value) => {
    document.querySelectorAll(`#${gridId} input[type="checkbox"]`).forEach(cb => {
      if (cb.value === value) cb.checked = true;
    });
  };

  // --- Facility ---
  const facilitySites = [...new Set(dayCases.map(c => c.clinicalSite).filter(Boolean))];
  if (facilitySites.length) {
    const fsel = document.getElementById('e-facility-select');
    if (fsel) fsel.value = facilitySites[0];
  }

  // --- Age Ranges ---
  const AGE_MAP = (c) => {
    if (c.isNeonate) return 'Neonate (0-1 month)';
    const age = parseFloat(c.age);
    if (isNaN(age)) return null;
    if (age < 2)  return 'Infant (1 month - 24 months)';
    if (age <= 11) return 'Child (2-12 years)';
    if (age <= 64) return 'Adult (12-64 years)';
    return 'Geriatric (65+)';
  };
  [...new Set(dayCases.map(AGE_MAP).filter(Boolean))]
    .forEach(cat => checkByValue('e-age-grid', cat));

  // --- ASA Classes ---
  dayCases.forEach(c => {
    const base = (c.asa || '').replace('E', '');
    if (base) checkByValue('e-asa-grid', `ASA ${base}`);
    if ((c.asa || '').endsWith('E') || c.traumaEmergency) checkByValue('e-asa-grid', 'Emergent or Trauma');
  });

  // --- Surgical Cases (anatomical → eval categories) ---
  const ANAT_MAP = {
    'Head - Intracranial':  'Intracranial',
    'Head - Oropharyngeal': 'Oropharyngeal',
    'Neck':                 'Neck',
    'Intrathoracic - Heart':'Intrathoracic - Heart',
    'Intrathoracic - Lung': 'Intrathoracic - Lung',
    'Neuroskeletal':        'Neuroskeletal',
    'Vascular':             'Vascular',
    'Intra-abdominal':      'Abdominal',
    'Cesarean delivery':    'Obstetric',
    'Analgesia for labor':  'Obstetric',
  };
  dayCases.forEach(c => {
    (c.anatomical || []).forEach(anat => {
      checkByValue('e-surg-grid', ANAT_MAP[anat] || 'Other');
    });
    const ad = c.anatomicalDetails || {};
    if (ad.otherECT || ad.otherEBUS || ad.otherColonoscopy || ad.otherEGD) {
      checkByValue('e-surg-grid', 'EBUS / TEE / EGD / Colonoscopy / ECT');
    }
  });

  // --- Q10 comments: skills performed (only if blank) ---
  const q10El = document.getElementById('e-q10-comments');
  if (q10El && !q10El.value.trim()) {
    const skills = new Set();
    dayCases.forEach(c => {
      const p  = c.procedures    || {};
      const gi = c.generalItems  || {};
      const ri = c.regionalItems || {};
      if (gi.ettOral || gi.ettNasal || p.endoTrachealTubePlacement) skills.add('Intubation');
      if (gi.lma || gi.sga)       skills.add('LMA/SGA placement');
      if (ri.spinal)              skills.add('Spinal');
      if (ri.epidural)            skills.add('Epidural');
      if (ri.peripheral)          skills.add('Peripheral nerve block');
      if (p.artActual)            skills.add('A-line placement');
      if (p.cvlActual)            skills.add('CVL placement');
      if (p.otherTechniques)      skills.add('VL / special airway technique');
    });
    if (skills.size) q10El.value = [...skills].join(', ');
  }

  saveEvalProgress();
}

// Call this whenever a case is successfully saved/submitted.
// Checks if a plan pre-fill is active and marks it done.
function maybeCompletePlan() {
  if (!_activePlanName) return;
  _markPlanCompleted(_activePlanName);
  _activePlanName = null;
  const _planPill = document.getElementById('case-plan-pill');
  if (_planPill) { _planPill.style.display = 'none'; _planPill.textContent = ''; }
  renderPlannedCases(_todaysPlans); // re-render to show ✅
}


(async () => {
  // Register BEFORE any awaits so the initial typhon-auth-changed event
  // (dispatched during DOMContentLoaded) is never missed.
  window.addEventListener('typhon-auth-changed', async () => {
    const refreshed = (await store.get('typhon-items')) || [];
    updateBadge(refreshed);
    if (refreshed.some(i => i.draft && i.type === 'case')) showDraftBanner();
    if (document.getElementById('pane-saved')?.classList.contains('active')) renderSaved();

    // Seed completions from Firestore BEFORE rendering planned cases
    // so ✓ Logged appears correctly on any device
    try {
      const uid = _getAuthUid();
      const cloudComps = await store.get('typhon-plan-completions').catch(() => null);
      console.log(`[sync] auth-changed: fetched typhon-plan-completions for UID:${uid}`, cloudComps);
      const localComps = _getPlannedCompletions();
      const today = _todayIso();
      // Merge cloud → local
      let addedFromCloud = 0;
      if (Array.isArray(cloudComps) && cloudComps.length) {
        cloudComps.forEach(c => {
          if (c.planName && c.date === today && !localComps.find(l => l.planName === c.planName && l.date === c.date)) {
            localComps.push(c);
            addedFromCloud++;
          }
        });
        if (addedFromCloud > 0) {
          localStorage.setItem('typhon-plan-completions', JSON.stringify(localComps));
          console.log(`[sync] seeded ${addedFromCloud} completion(s) from cloud into localStorage`);
        }
      }
      // Merge local → cloud: if local has entries cloud doesn't, push them up
      const cloudArr = Array.isArray(cloudComps) ? cloudComps : [];
      const localOnlyCount = localComps.filter(l =>
        !cloudArr.find(c => c.planName === l.planName && c.date === l.date)
      ).length;
      if (localOnlyCount > 0 && uid) {
        console.log(`[sync] auth-changed: ${localOnlyCount} local completion(s) not in cloud — pushing up`);
        store.set('typhon-plan-completions', localComps)
          .then(r => console.log('[sync] local→cloud push result:', r))
          .catch(e => console.warn('[sync] local→cloud push failed', e));
      }
      if (uid) toast('☁️ Cloud sync complete');
    } catch(e) { console.warn('[auth] completions cloud merge failed', e); }

    // Now render — completions are already in localStorage
    // Show syncing placeholder while Firestore fetch runs
    const _pcSection = document.getElementById('planned-cases-section');
    const _pcList = document.getElementById('planned-cases-list');
    if (_pcSection && _pcList) {
      _pcSection.style.display = 'block';
      _pcList.innerHTML = '<div style="color:#888;font-size:0.85em;padding:6px 2px;">&#9729;&#xFE0F; Syncing…</div>';
    }
    loadAndRenderPlannedCases();

    // Seed localStorage from Firestore for cross-device in-progress drafts
    // Always pull from Firestore — it is the authoritative source across devices.
    // Local data may be stale from a different browser/device session.
    const cloudDraft = await store.get('typhon-draft').catch(() => null);
    if (cloudDraft && typeof cloudDraft === 'object' &&
        (cloudDraft.biologicalSex || cloudDraft.anesStart || (cloudDraft.anatomical||[]).length || cloudDraft.age)) {
      localStorage.setItem('typhon-draft', JSON.stringify(cloudDraft));
      localStorage.setItem('typhon-case-progress-updated', String(Date.now()));
    }
    const cloudTime = await store.get('typhon-time-progress').catch(() => null);
    if (cloudTime && typeof cloudTime === 'object' && (cloudTime.clockIn1 || cloudTime.clockOut1 || cloudTime.notes)) {
      localStorage.setItem('typhon-time-progress', JSON.stringify(cloudTime));
      localStorage.setItem('typhon-time-progress-updated', String(Date.now()));
    }
    updateContinueButton();
  });

  enforceExtensionScrolling();
  initWelcomeScreen();

  // Show build version stamp
  const buildEl = document.getElementById('build-version');
  if (buildEl) buildEl.textContent = `v${(window.TYPHON_FIREBASE_CONFIG || {}).buildVersion || 'unknown'}`;

  bindUiEvents();
  bindProcedureDependencies();
  enhanceNumericInputs();
  initCaseMobilePager();
  initEvalMobilePager();
  initSignatureCanvas();
  await initPreceptorReviewMode();

  // Autosave draft on any input change in the case pane
  document.getElementById('pane-case')?.addEventListener('input', saveDraft);
  document.getElementById('pane-case')?.addEventListener('change', saveDraft);
  document.getElementById('pane-time')?.addEventListener('input', saveTimeProgress);
  document.getElementById('pane-time')?.addEventListener('change', saveTimeProgress);
  document.getElementById('pane-eval')?.addEventListener('input', saveEvalProgress);
  document.getElementById('pane-eval')?.addEventListener('change', saveEvalProgress);

  // One-time migration: if running as extension page and chrome.storage is empty,
  // import any items previously saved to localStorage (file:// fallback).
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const existing = await new Promise(r => chrome.storage.local.get('typhon-items', d => r(d['typhon-items'])));
      if (!existing || existing.length === 0) {
        const lsData = localStorage.getItem('typhon-items');
        if (lsData) {
          const parsed = JSON.parse(lsData);
          if (parsed && parsed.length > 0) {
            await new Promise(r => chrome.storage.local.set({ 'typhon-items': parsed }, r));
            localStorage.removeItem('typhon-items');
            toast(`Migrated ${parsed.length} saved item(s) from local storage ✓`);
          }
        }
      }
    } catch (e) { /* ignore migration errors */ }
  }

  buildDayPills('day-pills',   null);
  buildDayPills('t-day-pills', null);
  buildDayPills('e-day-pills', null);
  if (typeof window.updateContinueButton === 'function') window.updateContinueButton();
  const items = (await store.get('typhon-items')) || [];
  updateBadge(items);
  // Show draft banner if there is a saved draft case
  if (items.some(i => i.draft && i.type === 'case')) showDraftBanner();

  // Auto-fill eval from day's cases whenever the eval tab is shown
  const _origGoTab = window.goTab;
  window.goTab = function(name) {
    _origGoTab(name);
    if (name === 'eval') prefillEvalFromDayCases();
  };

  // Wrap saveCase to mark plan completion when a pre-filled case is saved
  if (typeof saveCase === 'function') {
    const _origSaveCase = saveCase;
    window.saveCase = async function() {
      await _origSaveCase();
      maybeCompletePlan();
    };
  }

  // When returning to this tab/browser, refresh Saved from cloud-backed storage
  // so updates made in another browser session appear promptly.
  let _savedRefreshInFlight = false;
  const refreshSavedOnForeground = async () => {
    if (_savedRefreshInFlight) return;
    if (!document.getElementById('pane-saved')?.classList.contains('active')) return;
    _savedRefreshInFlight = true;
    try {
      await renderSaved({ preserveUi: true });
    } finally {
      _savedRefreshInFlight = false;
    }
  };

  window.addEventListener('focus', refreshSavedOnForeground);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSavedOnForeground();
  });

  // Extension sync mode: ?sync=1&eid=EXTENSION_ID
  // Called by the extension popup — pushes items from Firestore to the extension's chrome.storage.
  const _syncParams = new URLSearchParams(window.location.search);
  const _syncExtId  = _syncParams.get('eid');
  if (_syncParams.get('sync') === '1' && _syncExtId) {
    // Wait for auth to resolve, then send items to the extension
    const _doExtSync = async () => {
      const user = window.AnesthesiaAuth?.getUser?.();
      if (!user) { window.close(); return; }
      try {
        const allItems = (await store.get('typhon-items')) || [];
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(_syncExtId, { action: 'syncItems', items: allItems }, resp => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(resp);
          });
        });
      } catch (e) {
        console.warn('[sync] Extension message failed:', e.message || e);
      }
      window.close();
    };
    // Auth may or may not be resolved by the time we get here
    if (window.AnesthesiaAuth?.getUser?.()) {
      _doExtSync();
    } else {
      window.addEventListener('typhon-auth-changed', _doExtSync, { once: true });
      setTimeout(() => window.close(), 8000); // fallback
    }
  }

})();
