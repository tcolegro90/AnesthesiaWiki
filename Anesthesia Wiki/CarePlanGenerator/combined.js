    var mirroredState = {};
    var stateRevision = 0;
    var suspendIncomingStateUntil = 0;

    function fitIframe(frame) {
      // Cannot access iframe contentDocument due to CORS restrictions on local files
      // Use postMessage approach instead (see setup below)
      return false;
    }

    function fitAll() {
      // With CORS restrictions, we rely on iframes sending their heights via postMessage
      // No action needed here - iframes push their heights to us
    }

    // Listen for height updates from iframes via postMessage
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'iframeHeight') {
        var sectionPath = e.data.sectionPath || '';
        var frameId = e.data.frameId;
        var height = e.data.height;
        var frame = null;
        if (sectionPath) {
          frame = document.querySelector('iframe[src$="' + sectionPath + '"]');
        }
        if (!frame && frameId) {
          frame = document.getElementById(frameId);
        }
        if (frame && height) {
          frame.style.height = Math.max(120, parseInt(height, 10) || 0) + 'px';
        }
      } else if (e.data && e.data.type === 'carePlanState' && e.data.state) {
        // During load/reload, ignore stale state pushes from pre-reload iframes.
        if (Date.now() < suspendIncomingStateUntil) return;

        // Merge latest section-reported state into parent snapshot.
        var incoming = e.data.state || {};
        Object.keys(incoming).forEach(function(k) {
          mirroredState[k] = incoming[k];
        });
        stateRevision += 1;
        try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e2) {}
      } else if (e.data && (e.data.type === 'carePlanRequestState' || e.data.type === 'carePlanPoll')) {
        // Reply directly to requesting child without touching frame.contentWindow.
        try {
          var snap = getState();
          if (e.source && typeof e.source.postMessage === 'function') {
            e.source.postMessage({
              type: 'carePlanStateSnapshot',
              state: snap,
              revision: stateRevision
            }, '*');
          }
        } catch (e3) {}
      }
    });

    function getState() {
      var local = {};
      try {
        local = JSON.parse(localStorage.getItem('carePlanSplitState') || '{}') || {};
      } catch (e) {}

      // Merge persisted state with live child-reported state.
      // Child-reported values win because they reflect the currently edited sections.
      var merged = {};
      Object.keys(local || {}).forEach(function(k) { merged[k] = local[k]; });
      Object.keys(mirroredState || {}).forEach(function(k) { merged[k] = mirroredState[k]; });
      return merged;
    }

    function getDrugUnit(drugName, group) {
      var specs = {
        induction: {
          'Propofol':  'mg', 'Etomidate': 'mg', 'Ketamine':  'mg', 'Midazolam': 'mg'
        },
        blunt: {
          'Fentanyl': 'mcg', 'Esmolol': 'mg', 'Remifentanil': 'mcg', 'Dexmedetomidine': 'mcg'
        },
        paralytic: {
          'Succinylcholine': 'mg', 'Rocuronium': 'mg', 'Cisatracurium': 'mg', 'Vecuronium': 'mg'
        },
        anxiolytic: {
          'Midazolam': 'mg', 'Lorazepam': 'mg', 'Diazepam': 'mg', 'Hydroxyzine': 'mg', 'Alprazolam': 'mg'
        }
      };
      var groupSpecs = specs[group] || {};
      return groupSpecs[drugName] || '';
    }

    function yn(state, yesId, noId) {
      if (state[yesId]) return 'Yes';
      if (state[noId]) return 'No';
      return '_';
    }

    function radioVal(state, name, fallback) {
      var keys = Object.keys(state);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf(name + '::') === 0 && state[k]) return k.substring((name + '::').length);
      }
      return fallback || '_';
    }

    function setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value || '_';
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function setLines(id, items) {
      var el = document.getElementById(id);
      if (!el) return;
      var clean = (items || []).filter(function(x) { return !!x; });
      el.innerHTML = clean.length ? clean.map(escapeHtml).join('<br>') : 'None';
    }

    function setWarnStyle(id, isWarn) {
      var el = document.getElementById(id);
      if (!el) return;
      if (isWarn) {
        el.style.color = '#c41c3b';
        el.style.fontWeight = 'bold';
      } else {
        el.style.color = '';
        el.style.fontWeight = '';
      }
    }

    function buildPrintCard(overrideState) {
      var s = overrideState || getState();

      var initials = s['pat-initials'] || '_';
      var sched = s['pat-sched-surg-time'] || '_';
      var len = s['pat-surg-length'] || '_';
      var surgery = s['pat-surgery'] || '_';
      setText('pr-header-initials', initials);
      setText('pr-header-time', sched);
      setText('pr-header-surgery', surgery);
      setText('pr-name', initials + ' (Sched: ' + sched + ' | Len: ' + len + ')');
      setText('pr-age-gen', (s['pat-age'] || '_') + ' yrs / ' + (s['pat-gender'] || '_'));

      var h = '_';
      var cmVal = parseFloat(s['pat-cm']);
      var feetVal = parseFloat(s['pat-feet']);
      var inchVal = parseFloat(s['pat-inches']);
      var totalInches = NaN;
      if (!isNaN(cmVal) && cmVal > 0) {
        totalInches = cmVal / 2.54;
      } else if (!isNaN(feetVal) || !isNaN(inchVal)) {
        totalInches = (isNaN(feetVal) ? 0 : feetVal * 12) + (isNaN(inchVal) ? 0 : inchVal);
      }
      if (!isNaN(totalInches) && totalInches > 0) h = Math.round(totalInches) + ' in';
      setText('pr-height', h);
      setText('pr-weight', s['pat-weight-kg'] ? s['pat-weight-kg'] + ' kg' : '_');
      setText('pr-bmi', s['pat-bmi'] || '_');
      setText('pr-surgery', s['pat-surgery'] || '_');
      setText('pr-allergies', s['pat-allergies'] || 'NKDA');

      var pos = s['pat-position'] === 'Other' ? (s['pat-position-other'] || '_') : (s['pat-position'] || '_');
      setText('pr-position', pos);
      var fastedVal = yn(s, 'pat-fasted-yes', 'pat-fasted-no');
      setText('pr-fasted', fastedVal);
      var fastedEl = document.getElementById('pr-fasted');
      if (fastedEl && fastedVal === 'No') {
        fastedEl.style.color = '#c41c3b';
        fastedEl.style.fontWeight = 'bold';
      } else if (fastedEl) {
        fastedEl.style.color = '';
        fastedEl.style.fontWeight = '';
      }
      setText('pr-smoker', yn(s, 'pat-smoker-yes', 'pat-smoker-no'));

      var pacer = s['pacer-yes'];
      var pacerRow = document.getElementById('pr-pacer-row');
      if (pacer) {
        var pStr = 'Pacer';
        if (s['aicd-yes']) pStr += ' + AICD';
        if (s['pat-pacer-settings']) pStr += ' (' + s['pat-pacer-settings'] + ')';
        setText('pr-pacer', pStr);
        pacerRow.style.display = 'flex';
      } else {
        pacerRow.style.display = 'none';
      }

      setText('pr-lab-na',  s['pat-na']  || '\u2014');
      setText('pr-lab-k',   s['pat-k']   || '\u2014');
      setText('pr-lab-cl',  s['pat-cl']  || '\u2014');
      setText('pr-lab-mg',  s['pat-mg']  || '\u2014');
      setText('pr-lab-bun', s['pat-bun'] || '\u2014');
      setText('pr-lab-cr',  s['pat-cr']  || '\u2014');
      setText('pr-lab-glu', s['pat-glu'] || '\u2014');
      setText('pr-lab-wbc', s['pat-wbc'] || '\u2014');
      setText('pr-lab-hgb', s['pat-hgb'] || '\u2014');
      setText('pr-lab-plt', s['pat-plt'] || '\u2014');
      setText('pr-lab-hct', s['pat-hct'] || '\u2014');
      var pt = (s['pat-pt'] || '').trim();
      var inr = (s['pat-inr'] || '').trim();
      if (!pt || !inr) {
        // Backward compatibility for older saved state using a single PT/INR field.
        var ptInrRaw = (s['pat-pt-inr'] || '').trim();
        if (ptInrRaw) {
          var parts = ptInrRaw.split(/\s*\/\s*|\s*,\s*|\s+/).filter(Boolean);
          if (!pt && parts.length >= 1) pt = parts[0];
          if (!inr && parts.length >= 2) inr = parts[1];
        }
      }
      if (!pt) pt = '\u2014';
      if (!inr) inr = '\u2014';
      setText('pr-lab-pt', pt);
      setText('pr-lab-inr', inr);
      setText('pr-lab-ptt', s['pat-ptt'] || '\u2014');

      // Highlight abnormal labs in print preview.
      var labRanges = {
        'pr-lab-na': [parseFloat(s['pat-na']), 135, 145],
        'pr-lab-k': [parseFloat(s['pat-k']), 3.5, 5.0],
        'pr-lab-cl': [parseFloat(s['pat-cl']), 98, 106],
        'pr-lab-bun': [parseFloat(s['pat-bun']), 7, 20],
        'pr-lab-cr': [parseFloat(s['pat-cr']), 0.6, 1.3],
        'pr-lab-glu': [parseFloat(s['pat-glu']), 70, 140],
        'pr-lab-mg': [parseFloat(s['pat-mg']), 1.7, 2.2],
        'pr-lab-wbc': [parseFloat(s['pat-wbc']), 4.0, 11.0],
        'pr-lab-hgb': [parseFloat(s['pat-hgb']), 12.0, 17.5],
        'pr-lab-hct': [parseFloat(s['pat-hct']), 36, 52],
        'pr-lab-plt': [parseFloat(s['pat-plt']), 150, 400],
        'pr-lab-pt': [parseFloat(pt), 11, 14],
        'pr-lab-inr': [parseFloat(inr), 0.8, 1.2],
        'pr-lab-ptt': [parseFloat(s['pat-ptt']), 25, 35]
      };
      Object.keys(labRanges).forEach(function(id) {
        var spec = labRanges[id];
        var v = spec[0];
        var warn = !isNaN(v) && (v < spec[1] || v > spec[2]);
        setWarnStyle(id, warn);
      });

      var pmhItems = [];
      try { pmhItems = JSON.parse(s['pmh-list'] || '[]') || []; } catch (e) {}
      pmhItems = pmhItems.filter(function(x) { return x; });
      var pmhChecks = [
        ['pmh-htn','HTN'], ['pmh-hld','HLD'], ['pmh-gerd','GERD'], ['pmh-dm','DM'], ['pmh-afib','A-fib'],
        ['pmh-cad','CAD'], ['pmh-chf','CHF'], ['pmh-ckd','CKD'], ['pmh-copd','COPD'], ['pmh-asthma','Asthma'],
        ['pmh-osa','OSA'], ['pmh-obesity','Obesity'], ['pmh-hypothyroid','Hypothyroidism'], ['pmh-stroketia','Stroke/TIA'], ['pmh-seizure','Seizure Disorder'],
        ['pmh-anemia','Anemia'], ['pmh-liver','Liver Disease'], ['pmh-chronicpain','Chronic Pain'], ['pmh-depanx','Depression/Anxiety'], ['pmh-cancer','Cancer']
      ].filter(function(x) { return !!s[x[0]]; }).map(function(x) { return x[1]; });
      setText('pr-pmh', pmhChecks.concat(pmhItems).join(', ') || 'None');

      var meds = [];
      try { meds = JSON.parse(s['med-list'] || '[]') || []; } catch (e) {}
      var medsHtml = meds.filter(function(m) { return m && (m.med || m.other); }).map(function(m) {
        var name = m.med === 'Other' ? (m.other || 'Other') : (m.med || '');
        var when = m.time || '-';
        return '<div class="med-print-row"><span>' + name + '</span><span>' + when + '</span></div>';
      }).join('');
      document.getElementById('pr-meds-list').innerHTML = medsHtml || '<em>None</em>';

      ['awareness','famhx','mh','pseudo'].forEach(function(k) {
        var on = !!s['hx-' + k + '::Yes'];
        var row = document.getElementById('pr-row-' + k);
        if (row) row.style.display = on ? 'flex' : 'none';
      });
      setText('pr-mets', s['hx-mets::Yes'] ? 'Yes' : (s['hx-mets::No'] ? 'No' : '_'));

      setText('pr-mallampati', radioVal(s, 'exam-mallampati', '_'));
      var mpExam = parseFloat(radioVal(s, 'exam-mallampati', ''));
      var tmdExam = parseFloat(radioVal(s, 'exam-tmd', ''));
      var gapExam = parseFloat(radioVal(s, 'exam-interincisor', ''));
      var mandExam = radioVal(s, 'airway-mandibular', '');
      var atlExam = radioVal(s, 'exam-atlanto', '');

      var tmdRow = document.getElementById('pr-abn-tmd-row');
      var gapRow = document.getElementById('pr-abn-gap-row');
      var mandRow = document.getElementById('pr-abn-mand-row');
      var atlRow = document.getElementById('pr-abn-atl-row');

      if (!isNaN(tmdExam) && tmdExam < 4) {
        setText('pr-abn-tmd', String(tmdExam));
        if (tmdRow) { tmdRow.style.display = 'flex'; tmdRow.style.color = '#c41c3b'; tmdRow.style.fontWeight = 'bold'; }
      } else if (tmdRow) {
        tmdRow.style.display = 'none';
      }

      if (!isNaN(gapExam) && gapExam < 4) {
        setText('pr-abn-gap', String(gapExam));
        if (gapRow) { gapRow.style.display = 'flex'; gapRow.style.color = '#c41c3b'; gapRow.style.fontWeight = 'bold'; }
      } else if (gapRow) {
        gapRow.style.display = 'none';
      }

      if (mandExam === '2' || mandExam === '3') {
        setText('pr-abn-mand', mandExam);
        if (mandRow) { mandRow.style.display = 'flex'; mandRow.style.color = '#c41c3b'; mandRow.style.fontWeight = 'bold'; }
      } else if (mandRow) {
        mandRow.style.display = 'none';
      }

      if (atlExam === 'Limited Mobility') {
        setText('pr-abn-atl', atlExam);
        if (atlRow) { atlRow.style.display = 'flex'; atlRow.style.color = '#c41c3b'; atlRow.style.fontWeight = 'bold'; }
      } else if (atlRow) {
        atlRow.style.display = 'none';
      }

      var mpEl = document.getElementById('pr-mallampati');
      if (mpEl && !isNaN(mpExam) && mpExam > 2) {
        mpEl.style.color = '#c41c3b';
        mpEl.style.fontWeight = 'bold';
      } else if (mpEl) {
        mpEl.style.color = '';
        mpEl.style.fontWeight = '';
      }

      var anes = s['anes-type'] || '_';
      if (anes === 'General' && s['tiva-box']) anes = 'General (TIVA)';
      setText('pr-anes-type', anes);

      var tivaRow = document.getElementById('pr-tiva-row');
      if (s['tiva-box']) {
        tivaRow.style.display = 'flex';
        var tr = s['tiva-reason'] || '_';
        if (tr === 'Other') tr = s['tiva-other'] || 'Other';
        setText('pr-tiva-reason', tr);
      } else {
        tivaRow.style.display = 'none';
      }

      // Anesthetic plan airway line should show selected airway method and RSI choice.
      var airwayMethod = s['ind-airway-method'] || '_';
      var rsiChoice = yn(s, 'ind-rsi-yes', 'ind-rsi-no');
      setText('pr-airway', airwayMethod + ' / ' + (rsiChoice || '_'));
      var airwayEl = document.getElementById('pr-airway');
      if (airwayEl) {
        airwayEl.style.color = '';
        airwayEl.style.fontWeight = '';
      }
      
      if (s['ind-anxiolytic-yes']) {
        var anxUnit = getDrugUnit(s['ind-anxiolytic-select'], 'anxiolytic');
        setText('pr-anx', (s['ind-anxiolytic-select'] || 'Anxiolytic') + (s['ind-anxiolytic-dose'] ? ' (' + s['ind-anxiolytic-dose'] + ' ' + anxUnit + ')' : ''));
      } else {
        setText('pr-anx', 'None');
      }
      var indUnit = getDrugUnit(s['ind-agent-select'], 'induction');
      setText('pr-ind', (s['ind-agent-select'] || '_') + (s['ind-agent-dose'] ? ' (' + s['ind-agent-dose'] + ' ' + indUnit + ')' : ''));
      var vesicantRow = document.getElementById('pr-vesicant-row');
      if (s['ind-agent-select'] === 'Propofol' && s['vesicant-prop'] != null && s['vesicant-prop'] !== '') {
        var vMap = { '0': 'None', '50': 'Propofol + Lidocaine 50 mg', '100': 'Propofol + Lidocaine 100 mg' };
        setText('pr-vesicant', vMap[s['vesicant-prop']] || s['vesicant-prop']);
        vesicantRow.style.display = 'flex';
      } else {
        vesicantRow.style.display = 'none';
      }
      var bluntUnit = getDrugUnit(s['ind-blunt-select'], 'blunt');
      setText('pr-blunt', (s['ind-blunt-select'] || '_') + (s['ind-blunt-dose'] ? ' (' + s['ind-blunt-dose'] + ' ' + bluntUnit + ')' : ''));
      var nmbUnit = getDrugUnit(s['ind-paralytic'], 'paralytic');
      setText('pr-nmb', (s['ind-paralytic'] || '_') + (s['ind-paralytic-dose'] ? ' (' + s['ind-paralytic-dose'] + ' ' + nmbUnit + ')' : ''));

      // Contraindication highlighting from plan logic (mirror input-page warnings)
      var mhYes = !!s['hx-mh::Yes'];
      var pseudoYes = !!s['hx-pseudo::Yes'];
      var kVal = parseFloat(s['pat-k']);
      var highK = !isNaN(kVal) && kVal > 5.0;
      var suxContra = s['ind-paralytic'] === 'Succinylcholine' && (mhYes || highK || pseudoYes);
      setWarnStyle('pr-nmb', suxContra);

      var inhal = s['ind-inhalation'] || '_';
      if (s['ind-mac-plan']) inhal += ' (' + s['ind-mac-plan'] + ')';
      setText('pr-inhal', inhal);
      var volatileContra = mhYes && ['Sevoflurane', 'Desflurane', 'Isoflurane'].indexOf(s['ind-inhalation']) >= 0;
      setWarnStyle('pr-inhal', volatileContra);

      var painIntra = 'None';
      var painPostList = [];
      var painNonOpioidList = [];
      try {
        var intra = JSON.parse(s['plan-intraop-list'] || '[]') || [];
        var postop = JSON.parse(s['plan-postop-list'] || '[]') || [];
        var nonopioid = JSON.parse(s['plan-nonopioid-list'] || '[]') || [];
        if (intra[0] && intra[0].drug) painIntra = intra[0].drug;
        painPostList = postop.map(function(r) {
          if (!r) return '';
          if (typeof r === 'string') return r;
          return r.drug || '';
        }).filter(function(x) { return !!x; });
        painNonOpioidList = nonopioid.map(function(r) {
          if (!r) return '';
          if (typeof r === 'string') return r;
          return r.drug || '';
        }).filter(function(x) { return !!x; });
      } catch (e) {}
      setText('pr-pain-intra', painIntra);
      setLines('pr-pain-post', painPostList);
      setLines('pr-pain-nonopioid', painNonOpioidList);

      var anti = [];
      if (s['tiva-box']) anti.push('TIVA');
      try {
        var antiUnitMap = {
          'Ondansetron': 'mg', 'Dexamethasone': 'mg', 'Scopolamine': 'mg',
          'Aprepitant': 'mg', 'Propofol': 'mg', 'Droperidol': 'mg'
        };
        var antiRows = JSON.parse(s['plan-antiemetic-list'] || '[]') || [];
        antiRows.forEach(function(r) {
          if (!r) return;
          var drug = typeof r === 'string' ? r : (r.drug || '');
          var dose = typeof r === 'string' ? '' : (r.dose || '');
          if (!drug) return;
          var str = drug;
          if (dose) str += ' ' + dose + (antiUnitMap[drug] ? ' ' + antiUnitMap[drug] : '');
          anti.push(str);
        });
      } catch (e) {}
      setLines('pr-antiemetic', anti);

      // APFEL score (0-4) to display next to antiemetics in print.
      var apfel = 0;
      var isFemale = s['pat-gender'] === 'F';
      var smokerYes = !!s['pat-smoker-yes'];
      var smokerNo = !!s['pat-smoker-no'];
      var isNonSmoker = smokerNo && !smokerYes;
      var hasPonvHx = !!s['hx-ponv::Yes'];
      var postopData = [];
      try { postopData = JSON.parse(s['plan-postop-list'] || '[]') || []; } catch (e) {}
      var nonOpioidPostop = { 'Regional / nerve block': true, 'Non-opioid multimodal': true, '': true };
      var hasPostopOpioids = postopData.some(function(item) {
        var drug = typeof item === 'string' ? item : (item.drug || '');
        return drug && !nonOpioidPostop[drug];
      });
      if (isFemale) apfel++;
      if (isNonSmoker) apfel++;
      if (hasPonvHx) apfel++;
      if (hasPostopOpioids) apfel++;
      setText('pr-apfel-score', apfel + '/4');

      // Build Access & Equipment list
      var equipItems = [];
      var equipLabels = {
        'equip-2piv': '2nd PIV',
        'equip-central': 'Central Line',
        'equip-aline': 'Art Line',
        'equip-bilat-bp-cuff': 'Bilateral BP cuff',
        'equip-ogtube': 'OG Tube',
        'equip-bairhugger': 'Bair Hugger'
      };
      Object.keys(equipLabels).forEach(function(key) {
        if (s[key]) equipItems.push(equipLabels[key]);
        if (key === 'equip-bairhugger' && s['equip-bairhugger-type']) {
          equipItems[equipItems.length - 1] += ' (' + s['equip-bairhugger-type'] + ')';
        }
      });
      var equipDiv = document.getElementById('pr-equip-items');
      if (equipDiv) {
        equipDiv.innerHTML = equipItems.length > 0 ? equipItems.join('<br>') : 'None';
      }

      setText('pr-fluid-type', s['plan-fluid-type'] || 'None');
      setText('pr-fluid-hr1', '_');
      setText('pr-fluid-hr2', '_');
      setText('pr-fluid-hr3', '_');
      setText('pr-fluid-hr4', '_');
      var w = parseFloat(s['plan-fluid-weight']) || 0;
      var npo = parseFloat(s['plan-fluid-npo']) || 0;
      var trauma = parseFloat(s['plan-fluid-trauma']) || 0;
      if (w > 0) {
        var maint = w <= 10 ? w * 4 : w <= 20 ? 40 + (w - 10) * 2 : 60 + (w - 20);
        var deficit = maint * npo;
        var traumaLoss = w * trauma;
        var hr1 = Math.round(maint + deficit / 2 + traumaLoss);
        var hr2 = Math.round(maint + deficit / 4 + traumaLoss);
        var hr3 = Math.round(maint + deficit / 4 + traumaLoss);
        var hr4 = Math.round(maint + traumaLoss);
        setText('pr-fluid-hr1', hr1 + ' mL');
        setText('pr-fluid-hr2', hr2 + ' mL');
        setText('pr-fluid-hr3', hr3 + ' mL');
        setText('pr-fluid-hr4', hr4 + ' mL');
      }

      // Display calculated target TV
      var tvMin = s['pat-tv-min'] || '_';
      var tvMax = s['pat-tv-max'] || '_';
      setText('pr-target-tv-plan', tvMin + ' - ' + tvMax + ' mL');

      var factor = parseFloat(s['plan-ebl-type']) || 0;
      var start = parseFloat(s['plan-ebl-start']) || 0;
      var target = parseFloat(s['plan-ebl-target']) || 0;
      if (w > 0 && factor > 0 && start > 0 && target > 0 && target < start) {
        var ebv = w * factor;
        var abl = ebv * ((start - target) / start);
        setText('pr-ebv', Math.round(ebv) + ' mL');
        setText('pr-abl', Math.round(abl) + ' mL');
      } else {
        setText('pr-ebv', '_');
        setText('pr-abl', '_');
      }
    }

    function setPrintPageSize(sizeSpec) {
      var styleId = 'dynamic-print-page-style';
      var tag = document.getElementById(styleId);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = styleId;
        document.head.appendChild(tag);
      }
      tag.textContent = '@media print { @page { margin: 0.25in; size: ' + sizeSpec + '; } }';
    }

    function setPrintMode(mode) {
      var sheet = document.getElementById('print-sheet');
      var single = document.getElementById('print-container');
      if (!sheet || !single) return;
      if (mode === 'sheet') {
        document.body.classList.add('print-mode-sheet');
        sheet.style.display = 'block';
        single.style.display = 'none';
      } else {
        document.body.classList.remove('print-mode-sheet');
        sheet.style.display = 'none';
        single.style.display = 'block';
      }
      // Keep a stable, printer-friendly page size in all modes.
      setPrintPageSize('8.5in 11in');
    }

    function openPreview() {
      setPrintMode('single');
      buildPrintCard();
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('preview-screen').style.display = 'flex';
    }

    function closePreview() {
      document.getElementById('preview-screen').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';
      setPrintMode('single');
      fitAll();
    }

    function printIsolated(mode) {
      var source = (mode === 'sheet')
        ? document.getElementById('print-sheet')
        : document.getElementById('print-container');
      if (!source) {
        window.print();
        return;
      }

      var styles = Array.from(document.querySelectorAll('style')).map(function(tag) {
        return tag.outerHTML;
      }).join('\n');

      var iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      var doc = iframe.contentWindow && iframe.contentWindow.document;
      if (!doc) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        window.print();
        return;
      }

      doc.open();
      doc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        styles +
        '<style>@media print { @page { margin: 0.25in; size: 8.5in 11in; } body { margin: 0; padding: 0; background: #fff; } } body { margin: 0; padding: 0; background: #fff; }</style>' +
        '</head><body class="' + (mode === 'sheet' ? 'print-mode-sheet' : '') + '">' +
        source.outerHTML +
        '</body></html>'
      );
      doc.close();

      var frameWin = iframe.contentWindow;
      if (!frameWin) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        window.print();
        return;
      }

      frameWin.focus();
      setTimeout(function() {
        try {
          frameWin.print();
        } finally {
          setTimeout(function() {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 500);
        }
      }, 120);
    }

    function printNow() {
      var previewVisible = document.getElementById('preview-screen').style.display === 'flex';
      if (!previewVisible) openPreview();
      // Allow preview DOM/layout to settle before printing to avoid blank output.
      setTimeout(function() {
        var mode = document.body.classList.contains('print-mode-sheet') ? 'sheet' : 'single';
        printIsolated(mode);
      }, 320);
    }

    function ensureSavedPlanPickerStyles() {
      if (document.getElementById('saved-plan-picker-style')) return;
      var style = document.createElement('style');
      style.id = 'saved-plan-picker-style';
      style.textContent = [
        '.spp-overlay{position:fixed;inset:0;background:rgba(18,24,33,.45);z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;}',
        '.spp-dialog{width:min(680px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;background:#fff;border:1px solid #c9d3e0;border-radius:12px;box-shadow:0 20px 45px rgba(0,0,0,.25);overflow:hidden;}',
        '.spp-head{padding:14px 16px;border-bottom:1px solid #e5ebf4;background:#f7faff;}',
        '.spp-title{font-size:1rem;font-weight:700;color:#1b2a41;margin:0;}',
        '.spp-sub{font-size:.86rem;color:#516277;margin-top:3px;}',
        '.spp-count{font-weight:700;color:#0b5cab;}',
        '.spp-list{padding:10px 12px;overflow:auto;display:grid;grid-template-columns:1fr;gap:7px;}',
        '.spp-option{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #d9e2ef;border-radius:9px;background:#fff;cursor:pointer;user-select:none;}',
        '.spp-option:hover{background:#f7fbff;border-color:#b9cde7;}',
        '.spp-check{position:absolute;opacity:0;pointer-events:none;}',
        '.spp-bubble{width:18px;height:18px;border-radius:999px;border:2px solid #87a4c7;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff;font-size:10px;font-weight:700;line-height:1;color:#fff;}',
        '.spp-check:checked + .spp-bubble{border-color:#0b5cab;background:#0b5cab;}',
        '.spp-label{display:flex;gap:8px;align-items:center;min-width:0;}',
        '.spp-index{font-weight:700;color:#29466f;min-width:22px;text-align:right;}',
        '.spp-name{font-size:.92rem;color:#172638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.spp-option[data-disabled="1"]{opacity:.55;cursor:not-allowed;background:#f7f8fa;}',
        '.spp-foot{display:flex;justify-content:flex-end;gap:9px;padding:12px 14px;border-top:1px solid #e5ebf4;background:#fbfdff;}',
        '.spp-btn{padding:8px 12px;border-radius:8px;border:1px solid #b9c8da;background:#fff;color:#1f3550;font-weight:600;cursor:pointer;}',
        '.spp-btn.spp-primary{border-color:#0b5cab;background:#0b5cab;color:#fff;}',
        '.spp-btn:disabled{opacity:.5;cursor:not-allowed;}'
      ].join('');
      document.head.appendChild(style);
    }

    function showSavedPlanPicker(names, defaultPick) {
      ensureSavedPlanPickerStyles();
      return new Promise(function(resolve) {
        var prior = document.getElementById('saved-plan-picker-overlay');
        if (prior && prior.parentNode) prior.parentNode.removeChild(prior);

        var defaults = Array.isArray(defaultPick) ? defaultPick.slice(0, 4) : [];
        var selectedOrder = [];
        defaults.forEach(function(n) {
          if (names.indexOf(n) !== -1 && selectedOrder.indexOf(n) === -1) {
            selectedOrder.push(n);
          }
        });

        var overlay = document.createElement('div');
        overlay.id = 'saved-plan-picker-overlay';
        overlay.className = 'spp-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'spp-dialog';
        overlay.appendChild(dialog);

        var head = document.createElement('div');
        head.className = 'spp-head';
        head.innerHTML = '<div class="spp-title">Select up to 4 saved plans</div><div class="spp-sub">Click the bubbles to choose plans. <span class="spp-count" id="spp-count">0/4 selected</span></div>';
        dialog.appendChild(head);

        var list = document.createElement('div');
        list.className = 'spp-list';
        dialog.appendChild(list);

        names.forEach(function(name, i) {
          var row = document.createElement('label');
          row.className = 'spp-option';
          row.setAttribute('data-name', name);

          var checked = selectedOrder.indexOf(name) !== -1;
          row.innerHTML =
            '<input type="checkbox" class="spp-check" ' + (checked ? 'checked' : '') + '>' +
            '<span class="spp-bubble"></span>' +
            '<span class="spp-label"><span class="spp-index">' + (i + 1) + '.</span><span class="spp-name"></span></span>';
          row.querySelector('.spp-name').textContent = name;
          list.appendChild(row);
        });

        var foot = document.createElement('div');
        foot.className = 'spp-foot';
        foot.innerHTML = '<button type="button" class="spp-btn" id="spp-cancel">Cancel</button><button type="button" class="spp-btn spp-primary" id="spp-print">Print Selected</button>';
        dialog.appendChild(foot);

        function getSelectedNames() {
          // Preserve click order instead of list order.
          return selectedOrder.filter(function(name) {
            var row = list.querySelector('.spp-option[data-name="' + CSS.escape(name) + '"]');
            if (!row) return false;
            var input = row.querySelector('.spp-check');
            return !!(input && input.checked);
          });
        }

        function refreshState() {
          var picked = getSelectedNames();
          var count = picked.length;
          var maxed = count >= 4;

          var countEl = dialog.querySelector('#spp-count');
          if (countEl) countEl.textContent = count + '/4 selected';

          list.querySelectorAll('.spp-option').forEach(function(row) {
            var input = row.querySelector('.spp-check');
            var bubble = row.querySelector('.spp-bubble');
            var name = row.getAttribute('data-name');
            var orderIndex = selectedOrder.indexOf(name);
            if (bubble) {
              bubble.textContent = orderIndex >= 0 ? String(orderIndex + 1) : '';
            }
            var disabled = !!(maxed && input && !input.checked);
            row.setAttribute('data-disabled', disabled ? '1' : '0');
          });

          var printBtn = dialog.querySelector('#spp-print');
          if (printBtn) printBtn.disabled = count === 0;
        }

        function closeWith(value) {
          document.removeEventListener('keydown', onKeyDown, true);
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(value);
        }

        function onKeyDown(ev) {
          if (ev.key === 'Escape') closeWith(null);
        }

        list.addEventListener('change', function(ev) {
          var target = ev.target;
          if (!target || !target.classList || !target.classList.contains('spp-check')) return;
          var row = target.closest('.spp-option');
          var name = row ? row.getAttribute('data-name') : '';
          if (!name) {
            refreshState();
            return;
          }

          if (target.checked) {
            if (selectedOrder.indexOf(name) === -1) {
              if (selectedOrder.length >= 4) {
                target.checked = false;
              } else {
                selectedOrder.push(name);
              }
            }
          } else {
            selectedOrder = selectedOrder.filter(function(x) { return x !== name; });
          }

          refreshState();
        });

        overlay.addEventListener('click', function(ev) {
          if (ev.target === overlay) closeWith(null);
        });

        dialog.querySelector('#spp-cancel').addEventListener('click', function() {
          closeWith(null);
        });
        dialog.querySelector('#spp-print').addEventListener('click', function() {
          var picked = getSelectedNames();
          closeWith(picked.slice(0, 4));
        });

        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKeyDown, true);
        refreshState();
      });
    }

    function renderCardIntoSlot(slotId, state) {
      var slot = document.getElementById(slotId);
      var sourceCard = document.getElementById('print-container');
      if (!slot || !sourceCard) return;
      if (!state) {
        slot.innerHTML = '';
        return;
      }
      buildPrintCard(state || {});
      slot.innerHTML = '<div class="print-card">' + sourceCard.innerHTML + '</div>';
    }

    function printSavedPlansBatch() {
      var plans = getSavedPlans();
      var names = Object.keys(plans).sort();
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var defaults = names.slice(0, Math.min(2, names.length));
      showSavedPlanPicker(names, defaults).then(function(selected) {
        if (!selected || !selected.length) return;

        var states = selected.slice(0, 4).map(function(name) {
          var entry = plans[name] || {};
          return entry.state ? JSON.parse(JSON.stringify(entry.state)) : null;
        });

        // Fixed numbering map:
        // 1 top-left, 2 bottom-left (upside down), 3 top-right, 4 bottom-right (upside down)
        var slotOrder = ['sheet-slot-1', 'sheet-slot-2', 'sheet-slot-3', 'sheet-slot-4'];
        for (var i = 0; i < slotOrder.length; i++) {
          renderCardIntoSlot(slotOrder[i], states[i] || null);
        }

        setPrintMode('sheet');
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('preview-screen').style.display = 'flex';
        setTimeout(function() { printIsolated('sheet'); }, 320);
      });
    }

    // Iframes measure themselves and send heights via postMessage
    // No polling or parent-to-iframe communication needed
    // Parent only listens for messages from iframes

    function clearAllData() {
      if (!confirm('Clear all currently entered data on this page? (Saved plans are kept)')) return;
      try {
        // Clear only current in-progress state in Combined page context.
        localStorage.removeItem('carePlanSplitState');
      } catch (e) {}

      // Clear parent-side mirrored snapshot so children cannot rehydrate stale values.
      mirroredState = {};
      stateRevision += 1;

      // Reload each section iframe with a reset token so it clears its own in-progress state.
      var stamp = Date.now();
      document.querySelectorAll('iframe').forEach(function(frame) {
        var src = frame.getAttribute('src') || '';
        var base = src.split('?')[0];
        frame.removeAttribute('name');
        frame.setAttribute('src', base + '?reset=' + stamp);
      });

      // Keep main page URL stable and clear print preview data.
      setTimeout(function() {
        if (document.getElementById('preview-screen')) {
          document.getElementById('preview-screen').style.display = 'none';
        }
        if (document.getElementById('main-content')) {
          document.getElementById('main-content').style.display = 'block';
        }
      }, 50);
    }

    function getSavedPlans() {
      try { return JSON.parse(localStorage.getItem('carePlanSavedPlans') || '{}') || {}; }
      catch (e) { return {}; }
    }

    function setSavedPlans(plans) {
      localStorage.setItem('carePlanSavedPlans', JSON.stringify(plans || {}));
    }

    function syncFramesFromState() {
      // Reload each section iframe so it requests latest snapshot from parent.
      var stamp = Date.now();
      document.querySelectorAll('iframe').forEach(function(frame) {
        var src = frame.getAttribute('src') || '';
        var base = src.split('?')[0];
        frame.setAttribute('src', base + '?sync=' + stamp);
      });
    }

    function saveNamedPlan() {
      // Iframes auto-save via their own event listeners
      // No need to actively call saveState (causes CORS errors)

      var s = (mirroredState && Object.keys(mirroredState).length) ? mirroredState : getState();
      var defaultName = [
        s['pat-initials'] || 'Patient',
        s['pat-surg-date'] || 'NoDate',
        s['pat-sched-surg-time'] || 'NoTime',
        s['pat-surgery'] || 'NoSurgery'
      ].join(' | ');
      var name = prompt('Save plan as:', defaultName);
      if (!name) return;
      name = name.trim();
      if (!name) return;

      var plans = getSavedPlans();
      plans[name] = {
        savedAt: new Date().toISOString(),
        state: s
      };
      setSavedPlans(plans);
      alert('Saved plan: ' + name);
    }

    function loadNamedPlan() {
      var plans = getSavedPlans();
      var names = Object.keys(plans).sort();
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var list = names.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n');
      var pick = prompt('Load which plan? Enter number or exact name:\n\n' + list, '1');
      if (!pick) return;

      var selected = null;
      var idx = parseInt(pick, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= names.length) {
        selected = names[idx - 1];
      } else if (plans[pick]) {
        selected = pick;
      }
      if (!selected) {
        alert('Plan not found.');
        return;
      }

      var entry = plans[selected];
      var nextState = (entry && entry.state) ? JSON.parse(JSON.stringify(entry.state)) : {};
      suspendIncomingStateUntil = Date.now() + 2000;
      mirroredState = nextState;
      stateRevision += 1;
      try { localStorage.setItem('carePlanSplitState', JSON.stringify(nextState)); } catch (e) {}
      syncFramesFromState();
      fitAll();
      alert('Loaded plan: ' + selected);
    }

    function deleteNamedPlan() {
      var plans = getSavedPlans();
      var names = Object.keys(plans).sort();
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var list = names.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n');
      var pick = prompt('Delete which plan? Enter number or exact name:\n\n' + list, '1');
      if (!pick) return;

      var selected = null;
      var idx = parseInt(pick, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= names.length) {
        selected = names[idx - 1];
      } else if (plans[pick]) {
        selected = pick;
      }
      if (!selected) {
        alert('Plan not found.');
        return;
      }

      if (!confirm('Delete saved plan: ' + selected + '?')) return;
      delete plans[selected];
      setSavedPlans(plans);
      alert('Deleted plan: ' + selected);
    }
