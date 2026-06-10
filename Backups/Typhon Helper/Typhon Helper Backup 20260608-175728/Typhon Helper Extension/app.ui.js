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

let casePager = null;
let evalPager = null;

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
  const continueBtn = document.getElementById('welcome-continue');
  const newCaseBtn = document.getElementById('welcome-new-case');
  const timeLogBtn = document.getElementById('welcome-time-log');
  const evalBtn = document.getElementById('welcome-eval');
  const draftsBtn = document.getElementById('welcome-drafts');
  if (!welcome || !continueBtn || !newCaseBtn || !timeLogBtn || !draftsBtn) return;

  function updateContinueButton() {
    const caseReady = hasCaseProgress();
    const timeReady = hasTimeProgress();
    const visible = caseReady || timeReady;
    continueBtn.style.display = visible ? '' : 'none';
    if (!visible) return;
    if (caseReady && timeReady) {
      continueBtn.textContent = '▶ Continue';
      return;
    }
    continueBtn.textContent = caseReady ? '▶ Continue Case' : '▶ Continue Time Log';
  }

  function continueWhereLeftOff(btn) {
    const caseReady = hasCaseProgress();
    const timeReady = hasTimeProgress();
    if (!caseReady && !timeReady) return;
    hideStartScreen();

    const caseTs = caseReady ? progressUpdatedAt('case') : -1;
    const timeTs = timeReady ? progressUpdatedAt('time') : -1;
    if (timeTs > caseTs) {
      goTab('time');
      restoreTimeProgress();
    } else {
      goTab('case');
      restoreDraft();
    }
    btn.blur();
  }

  window.updateContinueButton = updateContinueButton;

  const choose = (tabName, btn) => {
    hideStartScreen();
    goTab(tabName);
    if (tabName === 'saved') {
      setTimeout(() => {
        const draftsFolder = document.getElementById('drafts-folder');
        if (draftsFolder) {
          draftsFolder.classList.add('open');
          draftsFolder.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }, 50);
    }
    btn.blur();
  };

  continueBtn.addEventListener('click', () => continueWhereLeftOff(continueBtn));
  newCaseBtn.addEventListener('click', () => choose('case', newCaseBtn));
  timeLogBtn.addEventListener('click', () => choose('time', timeLogBtn));
  if (evalBtn) evalBtn.addEventListener('click', () => choose('eval', evalBtn));
  draftsBtn.addEventListener('click', () => choose('saved', draftsBtn));
  const browseBtn = document.getElementById('welcome-browse');
  if (browseBtn) browseBtn.addEventListener('click', () => { hideStartScreen(); browseBtn.blur(); });

  const syncStartScreenToAuth = () => {
    const landing = document.getElementById('auth-landing-screen');
    const authRequired = !!(landing && !landing.classList.contains('hidden'));
    if (authRequired) hideStartScreen();
    else showStartScreen();
  };

  // Run once at startup and whenever auth state changes.
  syncStartScreenToAuth();
  window.addEventListener('typhon-auth-changed', syncStartScreenToAuth);
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
      return;
    }

    casePager.index = Math.max(0, Math.min(casePager.index, cards.length - 1));
    cards.forEach((card, idx) => card.classList.toggle('active-step', idx === casePager.index));

    countEl.textContent = `Step ${casePager.index + 1} of ${cards.length}`;
    titleEl.textContent = getCardTitle(cards[casePager.index]);
    prevBtn.disabled = casePager.index === 0;
    nextBtn.disabled = casePager.index === cards.length - 1;
    pane.classList.toggle('last-step', casePager.index === cards.length - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  document.getElementById('btn-save-case')?.addEventListener('click', saveCase);
  document.getElementById('btn-draft-case')?.addEventListener('click', saveDraftCase);
  document.getElementById('btn-save-time')?.addEventListener('click', saveTimeLog);
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
// INIT
// ============================================================
(async () => {
  enforceExtensionScrolling();
  initWelcomeScreen();
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

  // Refresh list/badge when auth changes (sign in/out) so cloud data appears immediately.
  window.addEventListener('typhon-auth-changed', async () => {
    const refreshed = (await store.get('typhon-items')) || [];
    updateBadge(refreshed);
    if (refreshed.some(i => i.draft && i.type === 'case')) showDraftBanner();
    if (document.getElementById('pane-saved')?.classList.contains('active')) renderSaved();
    // Pull in-progress drafts from cloud to local if local is empty
    if (!hasCaseProgress()) {
      const cloudDraft = await store.get('typhon-draft').catch(() => null);
      if (cloudDraft && typeof cloudDraft === 'object' &&
          (cloudDraft.biologicalSex || cloudDraft.anesStart || (cloudDraft.anatomical||[]).length || cloudDraft.age)) {
        localStorage.setItem('typhon-draft', JSON.stringify(cloudDraft));
        localStorage.setItem('typhon-case-progress-updated', String(Date.now()));
      }
    }
    if (!hasTimeProgress()) {
      const cloudTime = await store.get('typhon-time-progress').catch(() => null);
      if (cloudTime && typeof cloudTime === 'object' && (cloudTime.clockIn1 || cloudTime.clockOut1 || cloudTime.notes)) {
        localStorage.setItem('typhon-time-progress', JSON.stringify(cloudTime));
        localStorage.setItem('typhon-time-progress-updated', String(Date.now()));
      }
    }
    if (typeof window.updateContinueButton === 'function') window.updateContinueButton();
  });
})();
