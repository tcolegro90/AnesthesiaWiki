    var mirroredState = {};
    var stateRevision = 0;
    var suspendIncomingStateUntil = 0;
    var previewMode = 'single';
    var multiPreviewSelectedNames = [];
    var draftSyncTimer = null;
    var lastDraftSyncWarningAt = 0;

    function getDeviceId() {
      var key = 'carePlanDeviceId';
      try {
        var id = localStorage.getItem(key);
        if (id) return id;
        id = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
        localStorage.setItem(key, id);
        return id;
      } catch (e) { return 'dev-unknown'; }
    }

    function scheduleDraftSync() {
      if (draftSyncTimer) clearTimeout(draftSyncTimer);
      draftSyncTimer = setTimeout(function() {
        draftSyncTimer = null;
        var cs = window.carePlanCloudStorage;
        if (!cs || !cs.isEnabled || !cs.isEnabled()) return;
        var userId = cs.getUserId ? cs.getUserId() : '';
        if (!userId) return;
        var now = new Date().toISOString();
        mirroredState.__draftSavedAt = now;
        try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e) {}
        var stateToSync = getState();
        cs.saveDraft(stateToSync, userId, getDeviceId()).catch(function(error) {
          var nowMs = Date.now();
          if (nowMs - lastDraftSyncWarningAt < 20000) return;
          lastDraftSyncWarningAt = nowMs;
          setStorageStatus(
            'Cloud sync issue: draft changes are currently saving only on this device. ' +
              ((error && error.message) ? error.message : String(error || 'Unknown error')),
            'warn'
          );
        });
      }, 3000);
    }

    function fitIframe(frame) {
      // Cannot access iframe contentDocument due to CORS restrictions on local files
      // Use postMessage approach instead (see setup below)
      return false;
    }

    function fitAll() {
      // Ask each iframe to send its latest measured height immediately.
      document.querySelectorAll('iframe').forEach(function(frame) {
        try {
          if (frame.contentWindow && typeof frame.contentWindow.postMessage === 'function') {
            frame.contentWindow.postMessage({ type: 'requestIframeHeight' }, '*');
          }
        } catch (e) {}
      });
    }

    function findFrameBySectionPath(sectionPath) {
      if (!sectionPath) return null;
      var frames = document.querySelectorAll('iframe');
      for (var i = 0; i < frames.length; i++) {
        var src = String(frames[i].getAttribute('src') || '');
        var base = src.split('?')[0].split('#')[0].split('/').pop();
        if (base === sectionPath) return frames[i];
      }
      return null;
    }

    function enforceIframeNoScrollDefaults() {
      document.querySelectorAll('iframe').forEach(function(frame) {
        frame.setAttribute('scrolling', 'no');
        frame.style.overflow = 'hidden';
      });
    }

    // Listen for height updates from iframes via postMessage
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'iframeHeight') {
        var sectionPath = e.data.sectionPath || '';
        var frameId = e.data.frameId;
        var height = e.data.height;
        var frame = null;
        if (sectionPath) {
          frame = findFrameBySectionPath(sectionPath);
        }
        if (!frame && frameId) {
          frame = document.getElementById(frameId);
        }
        if (frame && height) {
          frame.style.height = Math.max(120, (parseInt(height, 10) || 0)) + 'px';
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
        updateDeskTopbarPatient();
        scheduleDraftSync();
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
          'Midazolam': 'mg', 'Lorazepam': 'mg', 'Diazepam': 'mg', 'Hydroxyzine': 'mg', 'Alprazolam': 'mg',
          'Dexmedetomidine': 'mcg'
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

    function parseTSDateTime(ds, ts) {
      var dm = String(ds || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!dm) return null;
      var h = 0, m = 0;
      if (ts) {
        var tt = String(ts).trim();
        if (/^\d{3,4}$/.test(tt)) {
          tt = tt.length === 3 ? ('0' + tt) : tt;
          tt = tt.slice(0, 2) + ':' + tt.slice(2);
        }
        var tm = tt.match(/^(\d{1,2}):(\d{2})$/);
        if (tm) { h = parseInt(tm[1], 10); m = parseInt(tm[2], 10); }
      }
      var d = new Date(parseInt(dm[3], 10), parseInt(dm[1], 10) - 1, parseInt(dm[2], 10), h, m, 0);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    function formatTSDateTime(ms) {
      var dt = new Date(ms);
      if (isNaN(dt.getTime())) return '';
      return (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear() + ' ' +
        String(dt.getHours()).padStart(2, '0') + String(dt.getMinutes()).padStart(2, '0');
    }

    function buildPrintCard(overrideState) {
      var s = overrideState || getState();

      function setOptionalRow(rowId, valueId, value) {
        var row = document.getElementById(rowId);
        if (!row) return;
        var txt = String(value || '').trim();
        if (!txt) {
          row.style.display = 'none';
          return;
        }
        setText(valueId, txt);
        row.style.display = 'flex';
      }

      var initials = s['pat-initials'] || '_';
      var surgDate = (s['pat-surg-date'] || '').trim() || '_';
      var sched = s['pat-sched-surg-time'] || '_';
      var len = s['pat-surg-length'] || '_';
      var surgery = s['pat-surgery'] || '_';
      setText('pr-header-initials', initials);
      setText('pr-header-date', surgDate);
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
      setText('pr-bmi', s['pat-bmi'] ? (s['pat-bmi'] + ' kg/m²') : '_');
      setText('pr-surgery', s['pat-surgery'] || '_');
      var allergyVal = s['pat-allergies'] || 'NKDA';
      setText('pr-allergies', allergyVal);
      var allergyEl = document.getElementById('pr-allergies');
      if (allergyEl) {
        var isNkda = !s['pat-allergies'] || s['pat-allergies'].trim().toUpperCase() === 'NKDA';
        allergyEl.style.background = isNkda ? '' : '#fff176';
        allergyEl.style.padding = isNkda ? '' : '0 4px';
        allergyEl.style.borderRadius = isNkda ? '' : '3px';
      }

      var pregRow = document.getElementById('pr-pregnant-row');
      var pregValEl = document.getElementById('pr-pregnant');
      var ageNum = parseFloat(s['pat-age']);
      var pregApplicable = s['pat-gender'] === 'F' && !isNaN(ageNum) && ageNum >= 12 && ageNum <= 55;
      if (pregRow && pregValEl) {
        if (pregApplicable) {
          var pregVal = yn(s, 'pat-pregnant-yes', 'pat-pregnant-no');
          setText('pr-pregnant', pregVal);
          pregRow.style.display = 'flex';
          if (pregVal === 'Yes') {
            pregRow.style.color = '#c41c3b';
            pregRow.style.fontWeight = 'bold';
          } else {
            pregRow.style.color = '';
            pregRow.style.fontWeight = '';
          }
        } else {
          pregRow.style.display = 'none';
          pregRow.style.color = '';
          pregRow.style.fontWeight = '';
        }
      }

      var pos = s['pat-position'] === 'Other' ? (s['pat-position-other'] || '_') : (s['pat-position'] || '_');
      setText('pr-position', pos);
      var pressureLabels = [
        ['pat-pressure-axillary-roll', 'Axillary roll'],
        ['pat-pressure-occiput', 'Occiput'],
        ['pat-pressure-eyes', 'Eyes'],
        ['pat-pressure-ears', 'Ears'],
        ['pat-pressure-elbows', 'Elbows / ulnar groove'],
        ['pat-pressure-shoulders', 'Shoulders / scapulae'],
        ['pat-pressure-sacrum', 'Sacrum / coccyx'],
        ['pat-pressure-trochanter', 'Greater trochanter'],
        ['pat-pressure-knees', 'Knees'],
        ['pat-pressure-fibular-head', 'Fibular head / peroneal nerve'],
        ['pat-pressure-heels', 'Heels'],
        ['pat-pressure-toes', 'Toes / feet']
      ];
      var pressureVals = pressureLabels.filter(function(x) { return !!s[x[0]]; }).map(function(x) { return x[1]; });
      setOptionalRow('pr-pressure-points-row', 'pr-pressure-points', pressureVals.join(', '));
      setText('pr-nerve-stim', s['pat-nerve-stim-location'] || 'None');
      var abxName = (s['pat-anticipated-antibiotic'] || '').trim();
      var abxDose = (s['pat-anticipated-antibiotic-dose'] || '').trim();
      var abxRedoseHrs = (s['pat-anticipated-antibiotic-redose-hours'] || '').trim();
      var abxParts = [];
      if (abxName) abxParts.push(abxName);
      if (abxDose) abxParts.push(abxDose);
      if (abxRedoseHrs) abxParts.push('Redose ' + abxRedoseHrs + ' hr');
      setOptionalRow('pr-antibiotic-plan-row', 'pr-antibiotic-plan', abxParts.join(' | '));
      setText('pr-asa-class', s['pat-asa-class'] || '_');
      setText('pr-insufflation', yn(s, 'pat-insufflation-yes', 'pat-insufflation-no'));
      var anticipatedEbl = String(s['pat-anticipated-ebl'] || '').trim();
      var needsTS = anticipatedEbl === 'Medium' || anticipatedEbl === 'High';
      var needsBloodRoom = anticipatedEbl === 'High';
      var tsDateEntered = String(s['pat-ts-date'] || '').trim();
      setOptionalRow('pr-anticipated-ebl-row', 'pr-anticipated-ebl', anticipatedEbl);
      var anticipatedRow = document.getElementById('pr-anticipated-ebl-row');
      if (anticipatedRow) {
        if (anticipatedEbl === 'High') {
          anticipatedRow.style.color = '#c41c3b';
          anticipatedRow.style.fontWeight = 'bold';
        } else {
          anticipatedRow.style.color = '';
          anticipatedRow.style.fontWeight = '';
        }
      }
      var obtainTsRow = document.getElementById('pr-obtain-ts-row');
      if (obtainTsRow) {
        if (needsTS) {
          var obtainTsVal = yn(s, 'pat-obtain-ts-yes', 'pat-obtain-ts-no');
          setText('pr-obtain-ts', obtainTsVal);
          obtainTsRow.style.display = 'flex';
          if (obtainTsVal === 'Yes' && !tsDateEntered) {
            obtainTsRow.style.color = '#c41c3b';
            obtainTsRow.style.fontWeight = 'bold';
          } else {
            obtainTsRow.style.color = '';
            obtainTsRow.style.fontWeight = '';
          }
        } else {
          obtainTsRow.style.display = 'none';
          obtainTsRow.style.color = '';
          obtainTsRow.style.fontWeight = '';
        }
      }
      var bloodRoomRow = document.getElementById('pr-blood-room-row');
      if (bloodRoomRow) {
        if (needsBloodRoom) {
          setText('pr-blood-room', yn(s, 'pat-blood-room-yes', 'pat-blood-room-no'));
          bloodRoomRow.style.display = 'flex';
        } else {
          bloodRoomRow.style.display = 'none';
        }
      }

      var interpreterYes = !!s['pat-interpreter-yes'];
      var interpreterRow = document.getElementById('pr-interpreter-row');
      if (interpreterRow) {
        if (interpreterYes) {
          var lang = (s['pat-interpreter-language'] || '').trim();
          setText('pr-interpreter', lang ? ('Yes - ' + lang) : 'Yes');
          interpreterRow.style.display = 'flex';
        } else {
          interpreterRow.style.display = 'none';
        }
      }

      var hearingYes = !!s['pat-hearing-loss-yes'];
      var hearingRow = document.getElementById('pr-hearing-row');
      if (hearingRow) {
        if (hearingYes) {
          var aids = yn(s, 'pat-hearing-aids-yes', 'pat-hearing-aids-no');
          setText('pr-hearing', 'Yes' + (aids !== '_' ? (' (Aids: ' + aids + ')') : ''));
          hearingRow.style.display = 'flex';
        } else {
          hearingRow.style.display = 'none';
        }
      }

      var priorAnestheticRow = document.getElementById('pr-prior-anesthetic-row');
      if (priorAnestheticRow) {
        if (s['pat-prior-anesthetic-yes']) {
          var priorNotes = (s['pat-prior-anesthetic-notes'] || '').trim();
          setText('pr-prior-anesthetic', priorNotes ? ('Yes - ' + priorNotes) : 'Yes');
          priorAnestheticRow.style.display = 'flex';
        } else {
          priorAnestheticRow.style.display = 'none';
        }
      }

      var dentition = (s['hx-dentition'] || '').trim();
      var dentitionNotes = (s['hx-dentition-notes'] || '').trim();
      var dentitionVal = '';
      if (dentition) {
        dentitionVal = dentition === 'Other' ? (dentitionNotes || 'Other') : dentition;
      }
      setOptionalRow('pr-dentition-row', 'pr-dentition', dentitionVal);

      var pastSurgRaw = s['pmh-surgical-history'] || '';
      var pastSurg = '';
      try {
        var pshArr = JSON.parse(pastSurgRaw);
        if (Array.isArray(pshArr)) pastSurg = pshArr.filter(Boolean).join(', ');
        else pastSurg = pastSurgRaw.trim();
      } catch (e) { pastSurg = pastSurgRaw.trim(); }
      setOptionalRow('pr-past-surg-row', 'pr-past-surg', pastSurg);
      var fastedVal = yn(s, 'pat-fasted-yes', 'pat-fasted-no');
      setText('pr-fasted', fastedVal);
      var fastedRow = document.getElementById('pr-fasted-row');
      var fastedEl = document.getElementById('pr-fasted');
      if (fastedVal === 'No') {
        if (fastedRow) fastedRow.style.display = '';
        if (fastedEl) { fastedEl.style.color = '#c41c3b'; fastedEl.style.fontWeight = 'bold'; }
      } else {
        if (fastedRow) fastedRow.style.display = 'none';
        if (fastedEl) { fastedEl.style.color = ''; fastedEl.style.fontWeight = ''; }
      }

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

      // Hide fishbone diagrams if all their values are blank
      var bmpKeys = ['pat-na','pat-k','pat-cl','pat-mg','pat-bun','pat-cr','pat-glu'];
      var bmpBlank = bmpKeys.every(function(k){ return !(s[k] || '').trim(); });
      var bmpWrap = document.getElementById('pr-lab-bmp-wrap');
      if (bmpWrap) bmpWrap.style.display = bmpBlank ? 'none' : 'flex';

      var cbcKeys = ['pat-wbc','pat-hgb','pat-plt','pat-hct'];
      var coagKeys = ['pat-pt','pat-inr','pat-ptt','pat-pt-inr'];
      var cbcBlank  = cbcKeys.every(function(k){ return !(s[k] || '').trim(); });
      var coagBlank = coagKeys.every(function(k){ return !(s[k] || '').trim(); });
      var cbcCoagWrap = document.getElementById('pr-lab-cbccoag-wrap');
      if (cbcCoagWrap) cbcCoagWrap.style.display = (cbcBlank && coagBlank) ? 'none' : 'flex';

      // Populate phone-friendly lab grid (mirrors fishbone values)
      var phMap = {
        'pr-lab-ph-na': s['pat-na'], 'pr-lab-ph-k':   s['pat-k'],
        'pr-lab-ph-cl': s['pat-cl'], 'pr-lab-ph-mg':  s['pat-mg'],
        'pr-lab-ph-bun':s['pat-bun'],'pr-lab-ph-cr':  s['pat-cr'],
        'pr-lab-ph-glu':s['pat-glu'],'pr-lab-ph-hgb': s['pat-hgb'],
        'pr-lab-ph-hct':s['pat-hct'],'pr-lab-ph-wbc': s['pat-wbc'],
        'pr-lab-ph-plt':s['pat-plt'],'pr-lab-ph-pt':  pt,
        'pr-lab-ph-inr':inr,         'pr-lab-ph-ptt': s['pat-ptt'],
      };
      Object.keys(phMap).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = (phMap[id] || '').trim() || '—';
      });
      // Hide phone groups that are entirely blank
      var phBmpBlank = bmpKeys.every(function(k){ return !(s[k]||'').trim(); });
      var phCbcBlank = cbcKeys.every(function(k){ return !(s[k]||'').trim(); });
      var phCoagBlank= coagKeys.every(function(k){ return !(s[k]||'').trim(); });
      var phBmp  = document.getElementById('pr-lab-ph-bmp');
      var phCbc  = document.getElementById('pr-lab-ph-cbc');
      var phCoag = document.getElementById('pr-lab-ph-coag');
      if (phBmp)  phBmp.style.display  = phBmpBlank  ? 'none' : '';
      if (phCbc)  phCbc.style.display  = phCbcBlank  ? 'none' : '';
      if (phCoag) phCoag.style.display = phCoagBlank ? 'none' : '';

      setOptionalRow('pr-lab-a1c-row', 'pr-lab-a1c', s['pat-a1c']);
      setOptionalRow('pr-lab-alb-row', 'pr-lab-alb', s['pat-alb']);
      setOptionalRow('pr-lab-ast-row', 'pr-lab-ast', s['pat-ast']);
      setOptionalRow('pr-lab-alt-row', 'pr-lab-alt', s['pat-alt']);
      setOptionalRow('pr-lab-ica-row', 'pr-lab-ica', s['pat-ica']);
      setOptionalRow('pr-lab-ca-row', 'pr-lab-ca', s['pat-ca']);
      var tsDateVal = (s['pat-ts-date'] || '').trim();
      var tsTimeVal = (s['pat-ts-time'] || '').trim();
      var tsDisplay = tsDateVal ? (tsTimeVal ? tsDateVal + ' @ ' + tsTimeVal : tsDateVal) : '';
      var tsMsPr = parseTSDateTime(tsDateVal, tsTimeVal);
      var tsGoodUntil = tsMsPr === null ? '' : formatTSDateTime(tsMsPr + (72 * 60 * 60 * 1000));
      setOptionalRow('pr-lab-ts-date-row', 'pr-lab-ts-date', tsDisplay ? (tsDisplay + (tsGoodUntil ? ' | Good until: ' + tsGoodUntil : '')) : '');

      var gasType = (s['pat-gas-type'] || 'none');
      var gasRow = document.getElementById('pr-gas-row');
      var gasLabel = document.getElementById('pr-gas-label');
      var gasValues = [
        ['pH', s['gas-ph']],
        ['pCO2', s['gas-pco2']],
        ['pO2', s['gas-po2']],
        ['HCO3', s['gas-hco3']],
        ['BE', s['gas-be']],
        ['SpO2', s['gas-spo2']]
      ].filter(function(pair) { return String(pair[1] || '').trim() !== ''; })
       .map(function(pair) { return pair[0] + ': ' + String(pair[1]).trim(); })
       .join(', ');
      if (gasRow) {
        if (gasType !== 'none' && gasValues) {
          if (gasLabel) gasLabel.textContent = gasType.toUpperCase() + ':';
          setText('pr-gas-values', gasValues);
          gasRow.style.display = 'flex';
        } else {
          gasRow.style.display = 'none';
        }
      }

      // Highlight abnormal labs in print preview.
      var labRanges = {
        'pr-lab-na': [parseFloat(s['pat-na']), 135, 145],
        'pr-lab-k': [parseFloat(s['pat-k']), 3.5, 5.0],
        'pr-lab-cl': [parseFloat(s['pat-cl']), 98, 106],
        'pr-lab-bun': [parseFloat(s['pat-bun']), 7, 20],
        'pr-lab-cr': [parseFloat(s['pat-cr']), 0.6, 1.3],
        'pr-lab-glu': [parseFloat(s['pat-glu']), 70, 249],
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
        ['pmh-anemia','Anemia'], ['pmh-liver','Liver Disease'], ['pmh-chronicpain','Chronic Pain'], ['pmh-depression','Depression'], ['pmh-anxiety','Anxiety'], ['pmh-cancer','Cancer']
      ].filter(function(x) { return !!s[x[0]]; }).map(function(x) { return x[1]; });
      if (s['pat-smoker-yes'] && pmhChecks.indexOf('Smoker') === -1 && pmhItems.indexOf('Smoker') === -1) {
        pmhChecks.push('Smoker');
      }
      setText('pr-pmh', pmhChecks.concat(pmhItems).join(', ') || 'None');

      var extraSurgRow = document.getElementById('pr-extra-surg-row');
      var extraSurgItems = [];
      try {
        var extraSurg = JSON.parse(s['extra-surg-list'] || '[]') || [];
        extraSurgItems = extraSurg.map(function(r) {
          var surgName = String((r && r.surg) || '').trim();
          var posName = String((r && r.pos) || '').trim();
          if (!surgName && !posName) return '';
          if (surgName && posName) return surgName + ' (' + posName + ')';
          return surgName || posName;
        }).filter(function(x) { return !!x; });
      } catch (e) {}
      if (extraSurgRow) {
        if (extraSurgItems.length) {
          setText('pr-extra-surg', extraSurgItems.join('; '));
          extraSurgRow.style.display = 'flex';
        } else {
          extraSurgRow.style.display = 'none';
        }
      }

      var meds = [];
      try { meds = JSON.parse(s['med-list'] || '[]') || []; } catch (e) {}
      var medsHtml = meds.filter(function(m) { return m && (m.med || m.other); }).map(function(m) {
        var name = m.med === 'Other' ? (m.other || 'Other') : (m.med || '');
        return '<div class="med-print-row"><span>' + name + '</span></div>';
      }).join('');
      document.getElementById('pr-meds-list').innerHTML = medsHtml || '<em>None</em>';

      ['awareness','famhx','mh','pseudo'].forEach(function(k) {
        var on = !!s['hx-' + k + '::Yes'];
        var row = document.getElementById('pr-row-' + k);
        if (row) row.style.display = on ? 'flex' : 'none';
      });
      var metsRow = document.getElementById('pr-mets-row');
      if (metsRow) {
        if (s['hx-mets::Yes']) {
          setText('pr-mets', 'Yes');
          metsRow.style.display = 'flex';
        } else {
          metsRow.style.display = 'none';
        }
      }

      setText('pr-mallampati', radioVal(s, 'exam-mallampati', '_'));
      var mpExam = parseFloat(radioVal(s, 'exam-mallampati', ''));
      var tmdExam = parseFloat(radioVal(s, 'exam-tmd', ''));
      var gapExam = parseFloat(radioVal(s, 'exam-interincisor', ''));
      var atlExam = radioVal(s, 'exam-atlanto', '');

      var tmdRow = document.getElementById('pr-abn-tmd-row');
      var gapRow = document.getElementById('pr-abn-gap-row');
      var atlRow = document.getElementById('pr-abn-atl-row');

      if (!isNaN(tmdExam) && tmdExam < 3) {
        setText('pr-abn-tmd', String(tmdExam));
        if (tmdRow) { tmdRow.style.display = 'flex'; tmdRow.style.color = '#c41c3b'; tmdRow.style.fontWeight = 'bold'; }
      } else if (tmdRow) {
        tmdRow.style.display = 'none';
      }

      if (!isNaN(gapExam) && gapExam < 3) {
        setText('pr-abn-gap', String(gapExam));
        if (gapRow) { gapRow.style.display = 'flex'; gapRow.style.color = '#c41c3b'; gapRow.style.fontWeight = 'bold'; }
      } else if (gapRow) {
        gapRow.style.display = 'none';
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
      var extubPlan = s['ind-extubation-plan'] || 'Awake';
      setText('pr-extubation', extubPlan);
      var extubEl = document.getElementById('pr-extubation');
      if (extubEl) {
        extubEl.style.color = extubPlan === 'Deep' ? '#c41c3b' : '';
        extubEl.style.fontWeight = extubPlan === 'Deep' ? 'bold' : '';
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
      if (s['vesicant-prop'] === 'lidocaine' && s['vesicant-dose'] && s['vesicant-dose'] !== '') {
        setText('pr-vesicant', 'Lidocaine ' + s['vesicant-dose'] + ' mg IV');
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
      var highK = !isNaN(kVal) && kVal >= 5.5;
      var suxContra = s['ind-paralytic'] === 'Succinylcholine' && (mhYes || highK || pseudoYes);
      setWarnStyle('pr-nmb', suxContra);

      var inhal = s['ind-inhalation'] || '_';
      if (s['ind-mac-plan']) inhal += ' (' + s['ind-mac-plan'] + ' MAC)';
      setText('pr-inhal', inhal);
      var volatileContra = mhYes && ['Sevoflurane', 'Desflurane', 'Isoflurane'].indexOf(s['ind-inhalation']) >= 0;
      setWarnStyle('pr-inhal', volatileContra);

      var painUnitMap = {
        'Fentanyl': 'mcg', 'Morphine': 'mg', 'Hydromorphone': 'mg',
        'Remifentanil infusion': 'mcg/kg/min', 'Sufentanil': 'mcg', 'Alfentanil': 'mcg',
        'Ketamine (sub-dissociative)': 'mg', 'Ketamine (low-dose)': 'mg',
        'Fentanyl PCA': 'mcg/dose', 'Hydromorphone PCA': 'mg/dose', 'Morphine PCA': 'mg/dose',
        'Oxycodone (oral)': 'mg', 'Tramadol': 'mg',
        'Acetaminophen IV': 'mg', 'Ketorolac': 'mg', 'Celecoxib': 'mg',
        'Dexmedetomidine': 'mcg/kg/hr', 'Lidocaine infusion': 'mg/kg/hr',
        'Magnesium sulfate': 'mg', 'Pregabalin': 'mg', 'Gabapentin': 'mg',
        'Dexamethasone': 'mg'
      };
      function formatPainEntry(r, includeDose) {
        includeDose = includeDose !== false;
        if (!r) return '';
        var drug = '';
        var dose = '';
        var sub = '';
        if (typeof r === 'string') {
          drug = r;
        } else {
          drug = r.drug || r.name || r.med || '';
          dose = r.dose || r.dosage || r.amount || r.amt || '';
          sub = r.sub || '';
        }
        if (!drug) return '';
        if (dose && includeDose) {
          var unit = painUnitMap[drug] || '';
          return drug + ' (' + dose + (unit ? ' ' + unit : '') + ')';
        }
        if (sub) return drug + ' \u2014 ' + sub;
        return drug;
      }
      var painIntraList = [];
      var painPostList = [];
      var painNonOpioidList = [];
      try {
        var intra = JSON.parse(s['plan-intraop-list'] || '[]') || [];
        var postop = JSON.parse(s['plan-postop-list'] || '[]') || [];
        var nonopioid = JSON.parse(s['plan-nonopioid-list'] || '[]') || [];
        painIntraList = intra.map(function(x) { return formatPainEntry(x, true); }).filter(function(x) { return !!x; });
        painPostList = postop.map(function(x) { return formatPainEntry(x, false); }).filter(function(x) { return !!x; });
        painNonOpioidList = nonopioid.map(function(x) { return formatPainEntry(x, true); }).filter(function(x) { return !!x; });
      } catch (e) {}
      setLines('pr-pain-intra', painIntraList);
      setLines('pr-pain-post', painPostList);
      setLines('pr-pain-nonopioid', painNonOpioidList);
      setOptionalRow('pr-anticipated-pain-row', 'pr-anticipated-pain', s['pat-anticipated-pain']);

      var compLabels = [
        ['pat-comp-aspiration', 'Aspiration risk'],
        ['pat-comp-difficult-airway', 'Difficult airway'],
        ['pat-comp-laryngospasm', 'Laryngospasm'],
        ['pat-comp-bronchospasm', 'Bronchospasm'],
        ['pat-comp-hypoxemia', 'Hypoxemia / desaturation'],
        ['pat-comp-hypotension', 'Hypotension'],
        ['pat-comp-hypertension', 'Hypertension'],
        ['pat-comp-arrhythmia', 'Arrhythmia'],
        ['pat-comp-myocardial-ischemia', 'Myocardial ischemia'],
        ['pat-comp-major-blood-loss', 'Major blood loss'],
        ['pat-comp-transfusion', 'Transfusion requirement'],
        ['pat-comp-pneumothorax', 'Pneumothorax'],
        ['pat-comp-ponv', 'PONV'],
        ['pat-comp-emergence-delirium', 'Emergence delirium/agitation'],
        ['pat-comp-delayed-emergence', 'Delayed emergence'],
        ['pat-comp-awareness', 'Awareness risk'],
        ['pat-comp-postop-vent', 'Post-op ventilation need'],
        ['pat-comp-pain-control', 'Difficult pain control'],
        ['pat-comp-position-injury', 'Positioning/nerve injury'],
        ['pat-comp-thromboembolism', 'DVT/PE risk'],
        ['pat-comp-anaphylaxis', 'Anaphylaxis/allergic reaction']
      ];
      var compVals = compLabels.filter(function(x) { return !!s[x[0]]; }).map(function(x) { return x[1]; });
      if (s['pat-comp-other']) {
        var otherComp = String(s['pat-comp-other-text'] || '').trim();
        compVals.push(otherComp ? ('Other: ' + otherComp) : 'Other');
      }
      var compRow = document.getElementById('pr-anticipated-complications-row');
      var compEl = document.getElementById('pr-anticipated-complications');
      if (compRow && compEl) {
        if (compVals.length) {
          compEl.textContent = compVals.join(', ');
          compRow.style.display = 'block';
        } else {
          compRow.style.display = 'none';
          compEl.textContent = '';
        }
      }

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
        'equip-foley': 'Foley',
        'equip-lead': 'Lead',
        'equip-face-foam': 'Face foam',
        'equip-patient-goggles': 'Patient goggles',
        'equip-ett-accordion': 'ETT accordion',
        'equip-circuit-extender': 'Circuit extender',
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
      setOptionalRow('pr-warm-fluids-row', 'pr-warm-fluids', String(s['plan-fluid-warm-enabled'] || '').toLowerCase() === 'yes' ? 'Yes' : '');
      setOptionalRow('pr-albumin-row', 'pr-albumin', String(s['plan-fluid-albumin'] || '').toLowerCase() === 'yes' ? 'Yes' : '');
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

      var tvMin = s['pat-tv-min'] ? String(s['pat-tv-min']) : '';
      var tvMax = s['pat-tv-max'] ? String(s['pat-tv-max']) : '';
      // Fallback: if stored TV values are missing, compute from entered height + gender.
      // This only runs when source fields are present, so no "random" values are shown.
      if ((!tvMin || !tvMax) && !isNaN(totalInches) && totalInches > 0 && (s['pat-gender'] === 'M' || s['pat-gender'] === 'F')) {
        var refIn = totalInches < 60 ? 60 : totalInches;
        var ibw = s['pat-gender'] === 'M' ? 50 + 2.3 * (refIn - 60) : 45.5 + 2.3 * (refIn - 60);
        tvMin = String(Math.round(ibw * 6));
        tvMax = String(Math.round(ibw * 8));
      }
      var tvHasValue = !!(tvMin && tvMax);
      setText('pr-target-tv-plan', tvHasValue ? tvMin + ' – ' + tvMax + ' mL' : 'Not entered');
      setWarnStyle('pr-target-tv-plan', !tvHasValue);

      var factor = parseFloat(s['plan-ebl-type']) || 0;
      var start = parseFloat(s['plan-ebl-start']) || 0;
      var target = parseFloat(s['plan-ebl-target']) || 0;
      var ebvWeight = w > 0 ? w : (parseFloat(s['pat-weight-kg']) || 0);
      if (ebvWeight > 0 && factor > 0 && start > 0 && target > 0 && target < start) {
        var ebv = ebvWeight * factor;
        var abl = ebv * ((start - target) / start);
        setText('pr-ebv-abl', Math.round(ebv) + ' / ' + Math.round(abl) + ' mL');
      } else {
        setText('pr-ebv-abl', '_');
      }

      // Notes
      var notesText = String(s['notes-freetext'] || '').trim();
      var notesSection = document.getElementById('pr-notes-section');
      var notesEl = document.getElementById('pr-notes');
      if (notesSection) notesSection.style.display = notesText ? 'block' : 'none';
      if (notesEl) notesEl.textContent = notesText;
    }

    function setPrintPageSize(sizeSpec, pageMargin) {
      var styleId = 'dynamic-print-page-style';
      var tag = document.getElementById(styleId);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = styleId;
        document.head.appendChild(tag);
      }
      var margin = pageMargin || '0.1in 0.25in';
      tag.textContent = '@media print { @page { margin: ' + margin + '; size: ' + sizeSpec + '; } }';
    }

    function setPrintMode(mode) {
      var sheet = document.getElementById('print-sheet');
      var single = document.getElementById('print-container');
      var multi = document.getElementById('multi-preview-container');
      if (!sheet || !single || !multi) return;
      if (mode === 'sheet') {
        document.body.classList.add('print-mode-sheet');
        sheet.style.display = 'block';
        single.style.display = 'none';
        multi.style.display = 'none';
      } else if (mode === 'multi') {
        document.body.classList.remove('print-mode-sheet');
        sheet.style.display = 'none';
        single.style.display = 'none';
        multi.style.display = 'flex';
        multi.style.flexDirection = 'column';
        multi.style.alignItems = 'center';
      } else {
        document.body.classList.remove('print-mode-sheet');
        sheet.style.display = 'none';
        single.style.display = 'block';
        multi.style.display = 'none';
      }
      // Keep a stable page size; use zero margin in multi mode so 2 x 5.5in cards fit one sheet.
      setPrintPageSize('8.5in 11in', mode === 'multi' ? '0in' : '0.1in 0.25in');
    }

    function setPreviewActionMode(mode) {
      previewMode = mode === 'multi' ? 'multi' : 'single';
      var singlePrintBtn = document.getElementById('btn-preview-print-single');
      var singleEmailBtn = document.getElementById('btn-preview-email-single');
      var multiPrintBtn = document.getElementById('btn-preview-print-multi');
      var multiEmailBtn = document.getElementById('btn-preview-email-multi');
      var isMulti = previewMode === 'multi';

      if (singlePrintBtn) singlePrintBtn.style.display = isMulti ? 'none' : 'inline-block';
      if (singleEmailBtn) singleEmailBtn.style.display = isMulti ? 'none' : 'inline-block';
      if (multiPrintBtn) multiPrintBtn.style.display = isMulti ? 'inline-block' : 'none';
      if (multiEmailBtn) multiEmailBtn.style.display = isMulti ? 'inline-block' : 'none';
    }

    function openPreview() {
      setPreviewActionMode('single');
      setPrintMode('single');
      buildPrintCard();
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('preview-screen').style.display = 'flex';
      var nav = document.getElementById('cp-side-nav');
      if (nav) nav.style.display = 'none';
    }

    function closePreview() {
      document.getElementById('preview-screen').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';
      var nav = document.getElementById('cp-side-nav');
      if (nav) nav.style.display = '';
      setPreviewActionMode('single');
      setPrintMode('single');
      fitAll();
    }

    function printIsolated(mode) {
      var source = null;
      if (mode === 'sheet') source = document.getElementById('print-sheet');
      else if (mode === 'multi') source = document.getElementById('multi-preview-container');
      else source = document.getElementById('print-container');
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
      var printPageMargin = mode === 'multi' ? '0in' : '0.1in 0.25in';
      doc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        styles +
        '<style>' +
        '@media print {' +
        '  @page { margin: ' + printPageMargin + '; size: 8.5in 11in; }' +
        '  body { margin: 0; padding: 0; background: #fff; }' +
        '  #multi-preview-container { display: block !important; width: 8.5in !important; margin: 0 !important; padding: 0 !important; }' +
        '  .multi-sheet-page { width: 8.5in !important; height: 11in !important; margin: 0 !important; box-shadow: none !important; overflow: hidden !important; page-break-after: always; break-after: page; }' +
        '  .multi-sheet-page:last-child { page-break-after: auto; break-after: auto; }' +
        '}' +
        'body { margin: 0; padding: 0; background: #fff; }' +
        '#multi-preview-container { margin: 0 auto; }' +
        '</style>' +
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
      // Force print dimensions directly on iframe DOM before printing
      if (mode === 'multi') {
        var iDoc = iframe.contentDocument || iframe.contentWindow.document;
        var sheets = iDoc.querySelectorAll('.multi-sheet-page');
        for (var si = 0; si < sheets.length; si++) {
          sheets[si].style.cssText += ';width:8.0in!important;height:11in!important;overflow:hidden!important;box-shadow:none!important;margin:0!important;page-break-after:always;break-after:page;';
        }
        if (sheets.length) { sheets[sheets.length - 1].style.pageBreakAfter = 'auto'; sheets[sheets.length - 1].style.breakAfter = 'auto'; }
        var mc = iDoc.getElementById('multi-preview-container');
        if (mc) mc.style.cssText += ';display:block!important;gap:0!important;margin:0!important;padding:0!important;';
      }
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
        var mode = previewMode === 'multi'
          ? 'multi'
          : (document.body.classList.contains('print-mode-sheet') ? 'sheet' : 'single');
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
        '.spp-list{padding:10px 12px;overflow-y:auto;display:grid;grid-template-columns:1fr;gap:7px;flex:1;min-height:0;}',
        '.spp-option{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #d9e2ef;border-radius:9px;background:#fff;cursor:pointer;user-select:none;}',
        '.spp-option:hover{background:#f7fbff;border-color:#b9cde7;}',
        '.spp-check{position:absolute;opacity:0;pointer-events:none;}',
        '.spp-bubble{width:18px;height:18px;border-radius:999px;border:2px solid #87a4c7;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff;font-size:10px;font-weight:700;line-height:1;color:#fff;}',
        '.spp-check:checked + .spp-bubble{border-color:#0b5cab;background:#0b5cab;}',
        '.spp-label{display:flex;gap:8px;align-items:center;min-width:0;flex:1;}',
        '.spp-index{font-weight:700;color:#29466f;min-width:22px;text-align:right;}',
        '.spp-name{font-size:.92rem;color:#172638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.spp-meta{font-size:.78rem;color:#7b8797;white-space:nowrap;margin-left:auto;}',
        '.spp-option[data-disabled="1"]{opacity:.55;cursor:not-allowed;background:#f7f8fa;}',
        '.spp-foot{display:flex;justify-content:flex-end;gap:9px;padding:12px 14px;border-top:1px solid #e5ebf4;background:#fbfdff;}',
        '.spp-btn{padding:8px 12px;border-radius:8px;border:1px solid #b9c8da;background:#fff;color:#1f3550;font-weight:600;cursor:pointer;}',
        '.spp-btn.spp-primary{border-color:#0b5cab;background:#0b5cab;color:#fff;}',
        '.spp-btn:disabled{opacity:.5;cursor:not-allowed;}'
      ].join('');
      document.head.appendChild(style);
    }

    function showSavedPlanPicker(names, defaultPick, options) {
      ensureSavedPlanPickerStyles();
      return new Promise(function(resolve) {
        var opts = options || {};
        var maxSelection = parseInt(opts.maxSelection, 10);
        if (!(maxSelection > 0)) maxSelection = 4;
        var isSingleSelect = maxSelection === 1;
        var titleText = String(opts.title || ('Select up to ' + maxSelection + ' saved plans'));
        var subtitleText = String(opts.subtitle || 'Click the bubbles to choose plans.');
        var confirmLabel = String(opts.confirmLabel || 'Print Selected');

        var prior = document.getElementById('saved-plan-picker-overlay');
        if (prior && prior.parentNode) prior.parentNode.removeChild(prior);

        var defaults = Array.isArray(defaultPick) ? defaultPick.slice(0, maxSelection) : [];
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
        head.innerHTML = '<div class="spp-title"></div><div class="spp-sub"></div>';
        var titleEl = head.querySelector('.spp-title');
        var subtitleEl = head.querySelector('.spp-sub');
        if (titleEl) titleEl.textContent = titleText;
        if (subtitleEl) {
          subtitleEl.innerHTML = isSingleSelect
            ? escapeHtml(subtitleText)
            : (escapeHtml(subtitleText) + ' <span class="spp-count" id="spp-count">0/' + maxSelection + ' selected</span>');
        }
        dialog.appendChild(head);

        var list = document.createElement('div');
        list.className = 'spp-list';
        dialog.appendChild(list);

        names.forEach(function(name, i) {
          var row = document.createElement('label');
          row.className = 'spp-option';
          row.setAttribute('data-name', name);

          var savedAt = (opts.plans && opts.plans[name] && opts.plans[name].savedAt) ? String(opts.plans[name].savedAt) : '';
          var savedLabel = '';
          if (savedAt) {
            var dt = new Date(savedAt);
            if (!isNaN(dt.getTime())) {
              var now = new Date();
              var isToday = dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
              var dateStr = isToday ? 'Today' : dt.toLocaleDateString();
              var timeStr = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              savedLabel = dateStr + ' ' + timeStr;
            }
          }

          var checked = selectedOrder.indexOf(name) !== -1;
          row.innerHTML =
            '<input type="checkbox" class="spp-check" ' + (checked ? 'checked' : '') + '>' +
            '<span class="spp-bubble"></span>' +
            '<span class="spp-label"><span class="spp-index">' + (i + 1) + '.</span><span class="spp-name"></span><span class="spp-meta"></span></span>';
          row.querySelector('.spp-name').textContent = name;
          var meta = row.querySelector('.spp-meta');
          if (meta) meta.textContent = savedLabel;
          list.appendChild(row);
        });

        var foot = document.createElement('div');
        foot.className = 'spp-foot';
        foot.innerHTML = '<button type="button" class="spp-btn" id="spp-cancel">Cancel</button><button type="button" class="spp-btn spp-primary" id="spp-confirm"></button>';
        var confirmBtn = foot.querySelector('#spp-confirm');
        if (confirmBtn) confirmBtn.textContent = confirmLabel;
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
          var maxed = count >= maxSelection;

          var countEl = dialog.querySelector('#spp-count');
          if (countEl) countEl.textContent = count + '/' + maxSelection + ' selected';

          list.querySelectorAll('.spp-option').forEach(function(row) {
            var input = row.querySelector('.spp-check');
            var bubble = row.querySelector('.spp-bubble');
            var name = row.getAttribute('data-name');
            var orderIndex = selectedOrder.indexOf(name);
            if (bubble) {
              bubble.textContent = (!isSingleSelect && orderIndex >= 0) ? String(orderIndex + 1) : '';
            }
            var disabled = !!(!isSingleSelect && maxed && input && !input.checked);
            row.setAttribute('data-disabled', disabled ? '1' : '0');
          });

          var pickedBtn = dialog.querySelector('#spp-confirm');
          if (pickedBtn) pickedBtn.disabled = count === 0;
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
            if (isSingleSelect) {
              list.querySelectorAll('.spp-check').forEach(function(input) {
                if (input !== target) input.checked = false;
              });
              selectedOrder = [name];
              refreshState();
              return;
            }
            if (selectedOrder.indexOf(name) === -1) {
              if (selectedOrder.length >= maxSelection) {
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
        dialog.querySelector('#spp-confirm').addEventListener('click', function() {
          var picked = getSelectedNames();
          closeWith(picked.slice(0, maxSelection));
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

    // Iframes measure themselves and send heights via postMessage
    // No polling or parent-to-iframe communication needed
    // Parent only listens for messages from iframes

    function clearAllData() {
      if (!confirm('Clear all currently entered data on this page? (Saved plans are kept)')) return;
      try {
        // Clear only current in-progress state in Combined page context.
        localStorage.removeItem('carePlanSplitState');
      } catch (e) {}

      // Ignore late state pushes from old iframe instances while reset reloads occur.
      suspendIncomingStateUntil = Date.now() + 3000;

      // Clear parent-side mirrored snapshot so children cannot rehydrate stale values.
      mirroredState = {};
      stateRevision += 1;

      // Clear the notes textarea on the parent page
      var notesEl = document.getElementById('notes-freetext');
      if (notesEl) notesEl.value = '';

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

    function setStorageStatus(message, tone) {
      var el = document.getElementById('storage-status');
      if (!el) return;
      if (!message) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.textContent = message;
      el.setAttribute('data-tone', tone || 'warn');
      if (tone === 'ok') {
        if (setStorageStatus._timer) clearTimeout(setStorageStatus._timer);
        setStorageStatus._timer = setTimeout(function() { el.style.display = 'none'; }, 5000);
      }
    }

    function showTopbarFlash(msg) {
      var el = document.getElementById('topbar-flash');
      if (!el) return;
      if (showTopbarFlash._timer) clearTimeout(showTopbarFlash._timer);
      el.textContent = msg;
      el.style.display = '';
      el.style.opacity = '1';
      showTopbarFlash._timer = setTimeout(function() {
        el.style.opacity = '0';
        setTimeout(function() { el.style.display = 'none'; el.style.opacity = '1'; }, 420);
      }, 5000);
    }

    function getCloudUserId() {
      // Use real Firebase Auth UID when available
      try {
        if (window.firebase && window.firebase.auth) {
          var fbUser = window.firebase.auth().currentUser;
          if (fbUser && fbUser.uid) return fbUser.uid;
        }
      } catch (e) {}
      return '';
    }

    function updateCloudLoginUi() {
      var fbUser = null;
      try {
        if (window.firebase && window.firebase.auth) fbUser = window.firebase.auth().currentUser;
      } catch (e) {}
      var isLoggedIn = !!(fbUser && fbUser.uid);
      var displayName = isLoggedIn
        ? (fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : ''))
        : '';

      // Desktop header
      var loginBtn  = document.getElementById('cloud-login-btn');
      var logoutBtn = document.getElementById('cloud-logout-btn');
      var nameEl    = document.getElementById('header-auth-name');
      if (loginBtn)  loginBtn.style.display  = isLoggedIn ? 'none' : 'inline-block';
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
      if (nameEl)    nameEl.textContent = displayName;

      // Mobile drawer
      var mobLoginBtn  = document.getElementById('mob-cloud-login-btn');
      var mobLogoutBtn = document.getElementById('mob-cloud-logout-btn');
      var mobAuthName  = document.getElementById('mob-drawer-auth-name');
      var mobTopName   = document.getElementById('mob-topbar-name');
      if (mobLoginBtn)  mobLoginBtn.style.display  = isLoggedIn ? 'none' : 'inline-block';
      if (mobLogoutBtn) mobLogoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
      if (mobAuthName)  mobAuthName.textContent    = isLoggedIn ? ('👤 ' + displayName) : '';
      if (mobTopName)   mobTopName.textContent     = displayName;
    }

    function updateDeskTopbarPatient() {
      var el = document.getElementById('desk-topbar-patient');
      if (!el) return;
      var s = getState();
      var initials = String(s['pat-initials'] || '').trim();
      var surgery  = String(s['pat-surgery']  || '').trim();
      var parts = [];
      if (initials) parts.push(initials);
      if (surgery)  parts.push(surgery);
      el.textContent = parts.length ? '— ' + parts.join(' • ') : '';
    }

    async function applyCloudLogin() {
      // Sign-in is handled globally by AnesthesiaAuth overlay
      if (window.AnesthesiaAuth) window.AnesthesiaAuth.showLogin();
    }

    async function clearCloudLogin() {
      if (window.AnesthesiaAuth) await window.AnesthesiaAuth.signOut();
      updateCloudLoginUi();
      await shouldUseCloudPlans();
    }

    function getLocalSavedPlans() {
      try { return JSON.parse(localStorage.getItem('carePlanSavedPlans') || '{}') || {}; }
      catch (e) { return {}; }
    }

    var MAX_SAVED_PLANS = 20;

    function getSavedPlanNamesSorted(plans) {
      plans = plans || {};
      return Object.keys(plans).sort(function(a, b) {
        var ta = (plans[a] && plans[a].savedAt) ? new Date(plans[a].savedAt).getTime() : 0;
        var tb = (plans[b] && plans[b].savedAt) ? new Date(plans[b].savedAt).getTime() : 0;
        return tb - ta;
      });
    }

    function setLocalSavedPlans(plans) {
      localStorage.setItem('carePlanSavedPlans', JSON.stringify(plans || {}));
    }

    async function shouldUseCloudPlans() {
      var userId = getCloudUserId();

      if (!window.carePlanCloudStorage || !window.carePlanCloudStorage.isEnabled()) {
        setStorageStatus('Plans you create and save will ONLY be available on this specific device UNLESS you log in', 'warn');
        return false;
      }

      try {
        var ready = await window.carePlanCloudStorage.ensureReady();
        var status = window.carePlanCloudStorage.getStatus(userId);
        setStorageStatus(status.message, status.tone);
        if (ready && userId) {
          checkAndRestoreCloudDraft(userId);
        }
        return !!(ready && userId);
      } catch (error) {
        setStorageStatus('Cloud sync is unavailable right now. ' + (error.message || String(error)), 'warn');
        return false;
      }
    }

    async function checkAndRestoreCloudDraft(userId) {
      try {
        var draft = await window.carePlanCloudStorage.loadDraft(userId);
        if (!draft || !draft.savedAt) return;

        var cloudTime = new Date(draft.savedAt).getTime();
        if (isNaN(cloudTime)) return;

        // Compare to local state timestamp if available, else use 0.
        var localRaw = '';
        try { localRaw = localStorage.getItem('carePlanSplitState') || ''; } catch (e) {}
        var localState = {};
        try { localState = JSON.parse(localRaw) || {}; } catch (e) {}
        var localTime = 0;
        if (localState.__draftSavedAt) {
          localTime = new Date(localState.__draftSavedAt).getTime() || 0;
        }

        if (cloudTime > localTime + 10000) {
          // Cloud draft is meaningfully newer — restore it.
          var nextState = draft.state || {};
          suspendIncomingStateUntil = Date.now() + 2000;
          mirroredState = Object.assign({}, nextState);
          stateRevision += 1;
          try { localStorage.setItem('carePlanSplitState', JSON.stringify(mirroredState)); } catch (e) {}
          var notesEl = document.getElementById('notes-freetext');
          if (notesEl) notesEl.value = nextState['notes-freetext'] || '';
          syncFramesFromState();
          fitAll();
          var fromOtherDevice = draft.deviceId && draft.deviceId !== getDeviceId();
          var timeStr = new Date(cloudTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          if (fromOtherDevice) {
            setStorageStatus('Restored your work from another device (' + timeStr + ').', 'ok');
          } else {
            setStorageStatus('Restored your recent work (' + timeStr + ').', 'ok');
          }
        }
      } catch (e) {}
    }

    async function getSavedPlans() {
      if (!(await shouldUseCloudPlans())) {
        return getLocalSavedPlans();
      }

      try {
        var plans = await window.carePlanCloudStorage.listPlans(getCloudUserId());
        setLocalSavedPlans(plans);
        return plans;
      } catch (error) {
        setStorageStatus('Cloud sync is unavailable right now. Showing this device\'s cached plans (may be stale). ' + (error.message || String(error)), 'warn');
        return getLocalSavedPlans();
      }
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

    async function saveNamedPlan() {
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

      var cloudEnabled = await shouldUseCloudPlans();
      var savedToCloud = false;
      var plans = getLocalSavedPlans();
      if (cloudEnabled) {
        try {
          plans = await window.carePlanCloudStorage.listPlans(getCloudUserId());
        } catch (error) {
          setStorageStatus('Cloud sync is unavailable right now. Saving in this browser only. ' + (error.message || String(error)), 'warn');
          cloudEnabled = false;
        }
      }
      var isOverwrite = !!plans[name];
      if (!isOverwrite && Object.keys(plans).length >= MAX_SAVED_PLANS) {
        alert('You can save up to ' + MAX_SAVED_PLANS + ' plans. Delete one or overwrite an existing name.');
        return;
      }
      var entry = {
        savedAt: new Date().toISOString(),
        state: s
      };

      plans[name] = entry;

      if (cloudEnabled) {
        try {
          await window.carePlanCloudStorage.savePlan(name, s, getCloudUserId());
          savedToCloud = true;
          setStorageStatus('Firebase cloud sync is on.', 'ok');
        } catch (error) {
          setStorageStatus('Cloud save failed. Saving in this browser only. ' + (error.message || String(error)), 'warn');
          cloudEnabled = false;
        }
      }

      setLocalSavedPlans(plans);
      if (savedToCloud) {
        showTopbarFlash('Saved to cloud: ' + name);
      } else if (cloudEnabled) {
        showTopbarFlash('Saved locally: ' + name + ' (cloud not confirmed)');
      } else {
        showTopbarFlash('Saved locally: ' + name + ' (log in to sync)');
      }
    }

    async function loadNamedPlan() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var picked = await showSavedPlanPicker(names, names.slice(0, 1), {
        maxSelection: 1,
        title: 'Select a saved plan to load',
        subtitle: 'Click one bubble, then load it.',
        confirmLabel: 'Load Selected',
        plans: plans
      });
      if (!picked || !picked.length) return;
      var selected = picked[0];

      var entry = plans[selected];
      var nextState = (entry && entry.state) ? JSON.parse(JSON.stringify(entry.state)) : {};
      suspendIncomingStateUntil = Date.now() + 2000;
      mirroredState = nextState;
      stateRevision += 1;
      try { localStorage.setItem('carePlanSplitState', JSON.stringify(nextState)); } catch (e) {}
      // Restore notes textarea on the parent page when loading a plan
      var notesEl = document.getElementById('notes-freetext');
      if (notesEl) notesEl.value = nextState['notes-freetext'] || '';
      syncFramesFromState();
      fitAll();
      showTopbarFlash('Loaded: ' + selected);
    }

    async function deleteNamedPlan() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var picked = await showSavedPlanPicker(names, [], {
        maxSelection: names.length,
        title: 'Select plans to delete',
        subtitle: 'Select one or more plans to delete.',
        confirmLabel: 'Delete Selected',
        plans: plans
      });
      if (!picked || !picked.length) return;

      var confirmMsg = picked.length === 1
        ? 'Delete saved plan: ' + picked[0] + '?'
        : 'Delete ' + picked.length + ' saved plans?\n\n' + picked.join('\n');
      if (!confirm(confirmMsg)) return;

      var cloudEnabled = await shouldUseCloudPlans();
      for (var i = 0; i < picked.length; i++) {
        var selected = picked[i];
        if (cloudEnabled) {
          try {
            await window.carePlanCloudStorage.deletePlan(selected, getCloudUserId());
          } catch (error) {
            setStorageStatus('Cloud delete failed for "' + selected + '". Removing local copy only. ' + (error.message || String(error)), 'warn');
          }
        }
        delete plans[selected];
      }

      setLocalSavedPlans(plans);
      if (cloudEnabled) {
        setStorageStatus('Firebase cloud sync is on.', 'ok');
      }
      alert('Deleted ' + picked.length + ' plan' + (picked.length > 1 ? 's' : '') + '.');
    }

    function buildPrintCardHtml(state) {
      buildPrintCard(state || {});
      var source = document.getElementById('print-container');
      return source ? source.innerHTML : '';
    }

    function ensureMultiPreviewStyles() {
      if (document.getElementById('multi-preview-style')) return;
      var style = document.createElement('style');
      style.id = 'multi-preview-style';
      style.textContent = [
        '#multi-preview-container{display:flex;flex-direction:column;gap:18px;align-items:center;width:100%;}',
        '.multi-sheet-page{position:relative;width:8.0in;height:11in;background:#fff;box-shadow:0 0 20px rgba(0,0,0,0.5);overflow:hidden;}',
        '.multi-sheet-page .sheet-slot{position:absolute;width:3.95in;height:5.5in;overflow:hidden;}',
        '.multi-sheet-page .slot-1{left:0;top:0;}',
        '.multi-sheet-page .slot-2{left:0;top:5.5in;}',
        '.multi-sheet-page .slot-3{left:4.05in;top:0;}',
        '.multi-sheet-page .slot-4{left:4.05in;top:5.5in;}',
        '.multi-sheet-page .sheet-slot .print-card{width:3.95in !important;height:5.5in !important;margin:0;box-shadow:none;border:1px solid #000;}',
        '.multi-sheet-page .sheet-slot.upside-down .print-card{transform:rotate(180deg);transform-origin:center center;}',
        '@media print{#multi-preview-container{gap:0;margin:0;padding:0;} .multi-sheet-page{box-shadow:none;overflow:hidden;page-break-after:always;break-after:page;} .multi-sheet-page:last-child{page-break-after:auto;break-after:auto;}}'
      ].join('');
      document.head.appendChild(style);
    }

    function buildMultiPreviewPages(selectedNames, plans) {
      var container = document.getElementById('multi-preview-container');
      if (!container) return;
      ensureMultiPreviewStyles();
      container.innerHTML = '';

      for (var i = 0; i < selectedNames.length; i += 4) {
        var chunk = selectedNames.slice(i, i + 4);
        var page = document.createElement('div');
        page.className = 'multi-sheet-page';
        page.innerHTML = '<div class="sheet-slot slot-1"></div><div class="sheet-slot slot-2"></div><div class="sheet-slot slot-3"></div><div class="sheet-slot slot-4"></div>';

        chunk.forEach(function(name, idx) {
          var entry = plans[name] || {};
          var state = entry.state ? JSON.parse(JSON.stringify(entry.state)) : {};
          var html = buildPrintCardHtml(state);
          var slotClass = ['slot-1', 'slot-2', 'slot-3', 'slot-4'][idx];
          var slot = page.querySelector('.' + slotClass);
          if (slot) slot.innerHTML = '<div class="print-card">' + html + '</div>';
        });

        container.appendChild(page);
      }
    }

    function openMultiPlansPreview(selectedNames, plans) {
      multiPreviewSelectedNames = (selectedNames || []).slice();
      buildMultiPreviewPages(multiPreviewSelectedNames, plans || {});
      setPreviewActionMode('multi');
      setPrintMode('multi');
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('preview-screen').style.display = 'flex';
      var nav = document.getElementById('cp-side-nav');
      if (nav) nav.style.display = 'none';
    }

    async function buildMultiPreviewPdfBlob(filename) {
      var hasDirectPdf = !!(window.html2canvas && window.jspdf && window.jspdf.jsPDF);
      var hasHtml2Pdf = typeof window.html2pdf === 'function';
      if (!hasDirectPdf && !hasHtml2Pdf) throw new Error('PDF library unavailable');
      var source = document.getElementById('multi-preview-container');
      if (!source || !source.children.length) throw new Error('No multi-plan preview content');

      var host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '0';
      host.style.top = '0';
      host.style.width = '8.5in';
      host.style.minHeight = '11in';
      host.style.visibility = 'visible';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      host.style.overflow = 'visible';
      host.style.zIndex = '-1';
      host.style.background = '#fff';

      var pageClones = Array.from(source.querySelectorAll('.multi-sheet-page')).map(function(page) {
        var pageClone = page.cloneNode(true);
        pageClone.style.width = '8.5in';
        pageClone.style.height = '11in';
        pageClone.style.margin = '0';
        pageClone.style.boxShadow = 'none';
        pageClone.style.background = '#fff';
        pageClone.querySelectorAll('.sheet-slot').forEach(function(slot) {
          slot.style.setProperty('width', '4.235in', 'important');
          var card = slot.querySelector('.print-card');
          if (card) card.style.setProperty('width', '4.235in', 'important');
        });
        var s1 = pageClone.querySelector('.slot-1'); if (s1) s1.style.left = '0';
        var s2 = pageClone.querySelector('.slot-2'); if (s2) s2.style.left = '0';
        var s3 = pageClone.querySelector('.slot-3'); if (s3) s3.style.left = '4.265in';
        var s4 = pageClone.querySelector('.slot-4'); if (s4) s4.style.left = '4.265in';
        return pageClone;
      });
      document.body.appendChild(host);

      try {
        if (hasDirectPdf) {
          var pdf = new window.jspdf.jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true });
          for (var i = 0; i < pageClones.length; i++) {
            host.innerHTML = '';
            host.appendChild(pageClones[i]);

            var canvas = await window.html2canvas(pageClones[i], {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              scrollX: 0,
              scrollY: 0,
              windowWidth: 816,
              windowHeight: 1056
            });

            var imgData = canvas.toDataURL('image/jpeg', 0.98);
            if (i > 0) pdf.addPage('letter', 'portrait');
            pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11, undefined, 'FAST');
          }

          var blob = pdf.output('blob');
          if (!blob) throw new Error('Failed to create PDF blob');
          return blob;
        }

        // Fallback: use html2pdf worker when jspdf isn't exposed on window.
        host.innerHTML = '';
        var exportRoot = document.createElement('div');
        exportRoot.style.width = '8.5in';
        exportRoot.style.margin = '0';
        exportRoot.style.padding = '0';
        exportRoot.style.background = '#fff';
        pageClones.forEach(function(pageClone, idx) {
          pageClone.style.pageBreakAfter = idx < pageClones.length - 1 ? 'always' : 'auto';
          pageClone.style.breakAfter = idx < pageClones.length - 1 ? 'page' : 'auto';
          exportRoot.appendChild(pageClone);
        });
        host.appendChild(exportRoot);

        var worker = window.html2pdf()
          .set({
            filename: filename,
            margin: [0, 0, 0, 0],
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              scrollX: 0,
              scrollY: 0,
              windowWidth: 816,
              windowHeight: 1056
            },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
          })
          .from(exportRoot)
          .toPdf();
        var workerPdf = await worker.get('pdf');
        var workerBlob = workerPdf.output('blob');
        if (!workerBlob) throw new Error('Failed to create PDF blob');
        return workerBlob;
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    }

    function printSavedPlansSelection(selectedNames, plans) {
      if (!selectedNames || !selectedNames.length) return;
      openMultiPlansPreview(selectedNames, plans);
      setTimeout(function() { printIsolated('multi'); }, 320);
    }

    async function emailSavedPlansSelection(selectedNames, plans) {
      if (!selectedNames || !selectedNames.length) return;
      openMultiPlansPreview(selectedNames, plans);

      var filename = 'Anesthetic_Care_Plans_' + String(selectedNames.length) + '_plans.pdf';
      var blob;
      try {
        blob = await buildMultiPreviewPdfBlob(filename);
      } catch (err) {
        alert('Could not generate combined PDF for selected plans.');
        return;
      }

      var file = null;
      try { file = new File([blob], filename, { type: 'application/pdf' }); } catch (e) {}

      var subject = 'Anesthetic Care Plans - ' + String(selectedNames.length) + ' plan' + (selectedNames.length === 1 ? '' : 's');
      var canShareFile = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
      if (canShareFile) {
        try {
          await navigator.share({
            title: subject,
            text: 'Attached anesthetic care plans PDF (4 cards per page).',
            files: [file]
          });
          return;
        } catch (shareErr) {
          // Continue to fallback.
        }
      }

      downloadBlob(blob, filename);
      var body = [
        'Attached is the anesthetic care plans PDF (4 cards per page).',
        '',
        'Selected plans:',
        selectedNames.map(function(n, idx) { return String(idx + 1) + '. ' + n; }).join('\n'),
        '',
        'If attachment is missing, please attach: ' + filename
      ].join('\n');
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      alert('Combined PDF downloaded. An email draft opened; please attach the downloaded PDF.');
    }

    async function printOrEmailSavedPlans() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        alert('No saved plans found.');
        return;
      }

      var maxSelectable = Math.min(12, names.length);
      var tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      var tmrStr = (tmr.getMonth() + 1) + '/' + tmr.getDate() + '/' + tmr.getFullYear();
      var tmrDefaults = names.filter(function(n) {
        var surgDate = (plans[n] && plans[n].state && plans[n].state['pat-surg-date']) ? String(plans[n].state['pat-surg-date']).trim() : '';
        // Normalize both sides: strip leading zeros for comparison
        var normalize = function(d) { return d.replace(/\b0(\d)/g, '$1'); };
        return normalize(surgDate) === normalize(tmrStr);
      });
      var defaults = tmrDefaults.length ? tmrDefaults.slice(0, 1) : names.slice(0, 1);
      var selected = await showSavedPlanPicker(names, defaults, {
        maxSelection: maxSelectable,
        title: 'Select up to ' + maxSelectable + ' saved plans',
        subtitle: 'Click the bubbles to choose plans.',
        confirmLabel: 'Preview Selected',
        plans: plans
      });
      if (!selected || !selected.length) return;

      openMultiPlansPreview(selected, plans);
    }

    async function printSelectedPlansFromPreview() {
      if (!multiPreviewSelectedNames.length) {
        alert('No selected plans in preview.');
        return;
      }
      var btn = document.getElementById('btn-preview-print-multi');
      if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF…'; }
      try {
        var filename = 'Care_Plans_' + String(multiPreviewSelectedNames.length) + '_plans.pdf';
        var blob = await buildMultiPreviewPdfBlob(filename);
        var url = URL.createObjectURL(blob);
        var w = window.open(url, '_blank');
        if (!w) {
          // Pop-up blocked — fall back to download
          downloadBlob(blob, filename);
          alert('Pop-up blocked. PDF downloaded — open it and print from your PDF viewer.');
        }
        setTimeout(function() { URL.revokeObjectURL(url); }, 120000);
      } catch (err) {
        alert('Could not generate PDF. Try again or use Email.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Print Selected Plans'; }
      }
    }

    async function emailSelectedPlansFromPreview() {
      if (!multiPreviewSelectedNames.length) {
        alert('No selected plans in preview.');
        return;
      }

      var filename = 'Anesthetic_Care_Plans_' + String(multiPreviewSelectedNames.length) + '_plans.pdf';
      var blob;
      try {
        blob = await buildMultiPreviewPdfBlob(filename);
      } catch (err) {
        alert('Could not generate combined PDF from preview.');
        return;
      }

      var file = null;
      try { file = new File([blob], filename, { type: 'application/pdf' }); } catch (e) {}

      var subject = 'Anesthetic Care Plans - ' + String(multiPreviewSelectedNames.length) + ' plan' + (multiPreviewSelectedNames.length === 1 ? '' : 's');
      var canShareFile = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
      if (canShareFile) {
        try {
          await navigator.share({
            title: subject,
            text: 'Attached anesthetic care plans PDF (4 cards per page).',
            files: [file]
          });
          return;
        } catch (shareErr) {
          // Continue to fallback.
        }
      }

      downloadBlob(blob, filename);
      var body = [
        'Attached is the anesthetic care plans PDF (4 cards per page).',
        '',
        'Selected plans:',
        multiPreviewSelectedNames.map(function(n, idx) { return String(idx + 1) + '. ' + n; }).join('\n'),
        '',
        'If attachment is missing, please attach: ' + filename
      ].join('\n');
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      alert('Combined PDF downloaded. An email draft opened; please attach the downloaded PDF.');
    }

    // Backward-compatible wrapper for older button hooks.
    async function printSavedPlansBatch() {
      await printOrEmailSavedPlans();
    }

    // Backward-compatible wrapper for older button hooks.
    async function emailSavedPlans() {
      await printOrEmailSavedPlans();
    }

    function formatTextForEmail(rawText) {
      return String(rawText || '')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(function(line) { return line.trim(); })
        .join('\n')
        .trim();
    }

    function buildEmailPlanText(state) {
      // Always derive email content from the rendered print card so print/email stay in sync.
      buildPrintCard(state || {});
      var printCard = document.getElementById('print-container');
      if (!printCard) return 'Anesthetic Care Plan';
      return formatTextForEmail(printCard.innerText || printCard.textContent || 'Anesthetic Care Plan');
    }

    function safeFilePart(value, fallback) {
      var out = String(value || '').trim();
      if (!out) out = fallback || 'Plan';
      return out.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || (fallback || 'Plan');
    }

    function safeNamePart(value, fallback) {
      var out = String(value || '').trim()
        .replace(/\//g, '-')
        .replace(/:/g, '');
      if (!out) out = fallback || '';
      return out.replace(/[\\*?"<>|]+/g, '').trim() || (fallback || '');
    }

    function formatDateShort(dateStr) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var m = String(dateStr || '').match(/^(\d{1,2})\/(\d{1,2})/);
      if (!m) return safeNamePart(dateStr, '');
      return (months[parseInt(m[1], 10) - 1] || m[1]) + ' ' + parseInt(m[2], 10);
    }

    async function buildCurrentPlanPdfBlob(state, filename) {
      if (typeof window.html2pdf !== 'function') {
        throw new Error('PDF library unavailable');
      }

      buildPrintCard(state || {});
      var printCard = document.getElementById('print-container');
      if (!printCard) throw new Error('Print card not found');

      var host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.background = '#fff';
      host.style.zIndex = '-1';
      host.style.padding = '0';

      var clone = printCard.cloneNode(true);
      clone.id = '';
      clone.className = 'print-card';
      clone.style.display = 'block';
      clone.style.margin = '0';
      clone.style.boxShadow = 'none';

      host.appendChild(clone);
      document.body.appendChild(host);

      try {
        var worker = window.html2pdf()
          .set({
            filename: filename,
            margin: [0, 0, 0, 0],
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
            jsPDF: { unit: 'in', format: [3.95, 5.5], orientation: 'portrait' }
          })
          .from(clone)
          .toPdf();

        var pdf = await worker.get('pdf');
        var blob = pdf.output('blob');
        if (!blob) throw new Error('Failed to create PDF blob');
        return blob;
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    }

    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1200);
    }

    async function emailCurrentPlan() {
      var state = (mirroredState && Object.keys(mirroredState).length) ? mirroredState : getState();
      var initials = String(state['pat-initials'] || 'Patient').trim();
      var surgery = String(state['pat-surgery'] || 'Procedure').trim();
      var date = formatDateShort(state['pat-surg-date'] || '');
      var time = safeNamePart(state['pat-sched-surg-time'] || '', '');
      var filenameParts = [date, time, safeNamePart(initials, 'Patient'), safeNamePart(surgery, 'Procedure')].filter(Boolean);
      var filename = filenameParts.join(' ') + '.pdf';
      var subject = filename.replace(/\.pdf$/i, '');

      var blob;
      try {
        blob = await buildCurrentPlanPdfBlob(state, filename);
      } catch (pdfErr) {
        var fallbackBody = buildEmailPlanText(state);
        var fallbackHref = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(fallbackBody);
        window.location.href = fallbackHref;
        alert('PDF generation was unavailable, so a text email draft was opened.');
        return;
      }

      var file = null;
      try {
        file = new File([blob], filename, { type: 'application/pdf' });
      } catch (e) {}

      var canNativeShareFile = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
      if (canNativeShareFile) {
        try {
          await navigator.share({
            title: subject,
            text: filename,
            files: [file]
          });
          return;
        } catch (shareErr) {
          // If user cancels share, silently continue to fallback.
        }
      }

      downloadBlob(blob, filename);

      var attachBody = [
        'Attached is the SRNA care plan PDF.',
        '',
        'If attachment is missing, please attach: ' + filename
      ].join('\n');
      var mailtoHref = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(attachBody);
      window.location.href = mailtoHref;
      alert('PDF downloaded. An email draft opened; please attach the downloaded PDF.');
    }

    (function initStorageMode() {
      enforceIframeNoScrollDefaults();
      // Remove legacy text-based user ID — only Firebase Auth is used now.
      try { localStorage.removeItem('carePlanCloudUserId'); } catch (e) {}

      var logoutBtn = document.getElementById('cloud-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
          clearCloudLogin();
        });
      }

      // Keep global fallback for existing inline onclick attributes.
      window.applyCloudLogin = applyCloudLogin;
      window.clearCloudLogin = clearCloudLogin;

      updateCloudLoginUi();
      // Always listen to Firebase auth state — fires on load with persisted user AND on sign-in/out
      var _authFired = false;
      try {
        if (window.firebase && window.firebase.auth) {
          window.firebase.auth().onAuthStateChanged(function(user) {
            _authFired = true;
            updateCloudLoginUi();
            if (user) {
              shouldUseCloudPlans().then(function(ready) {
                if (ready) { try { getSavedPlans(); } catch (e) {} }
              });
            } else {
              shouldUseCloudPlans();
            }
          });
        }
      } catch (e) {}
      // Fallback: if Firebase never fires onAuthStateChanged, clear Checking... after 4s
      setTimeout(function() {
        if (_authFired) return;
        updateCloudLoginUi();
        shouldUseCloudPlans();
      }, 4000);
      // Also listen via AnesthesiaAuth overlay for sign-ins triggered on this page
      if (window.AnesthesiaAuth) {
        window.AnesthesiaAuth.onAuthChange(function(user) {
          updateCloudLoginUi();
        });
      } else {
        if (!window.carePlanCloudStorage) {
          setStorageStatus('Plans you create and save will ONLY be available on this specific device UNLESS you log in', 'warn');
        }
      }
    })();

    // Expose internals needed by the phone-share feature
    Object.defineProperty(window, 'mirroredState', {
      get: function() { return mirroredState; },
      set: function(v) { mirroredState = v; },
      configurable: true
    });
    window.openPreview = function() { openPreview(); };
    window.buildPrintCard = function(state) { buildPrintCard(state || {}); };
