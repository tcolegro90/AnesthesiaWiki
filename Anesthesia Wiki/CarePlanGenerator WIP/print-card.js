// print-card.js — buildPrintCard and helpers
// Extracted from combined.js. Depends on: nothing.
// Load order: print-card.js → email-plan.js → print-preview.js → combined.js
/* global mirroredState, getState */

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
      var dmFull = String(ds || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      var dmShort = String(ds || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
      var month, day, year;
      if (dmFull) {
        month = parseInt(dmFull[1], 10);
        day   = parseInt(dmFull[2], 10);
        year  = parseInt(dmFull[3], 10);
      } else if (dmShort) {
        month = parseInt(dmShort[1], 10);
        day   = parseInt(dmShort[2], 10);
        var now = new Date();
        year = now.getFullYear();
        // If the date appears to be in the past (>60 days ago), roll to next year
        var candidate = new Date(year, month - 1, day);
        if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) year++;
      } else {
        return null;
      }
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
      var d = new Date(year, month - 1, day, h, m, 0);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    function formatTSDateTime(ms) {
      var dt = new Date(ms);
      if (isNaN(dt.getTime())) return '';
      return (dt.getMonth() + 1) + '/' + dt.getDate() + ' @ ' +
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

      var abxName2 = (s['pat-anticipated-antibiotic-2'] || '').trim();
      var abxDose2 = (s['pat-anticipated-antibiotic-dose-2'] || '').trim();
      var abxRedoseHrs2 = (s['pat-anticipated-antibiotic-redose-hours-2'] || '').trim();
      if (abxName2) {
        var abxParts2 = [abxName2];
        if (abxDose2) abxParts2.push(abxDose2);
        if (abxRedoseHrs2) abxParts2.push('Redose ' + abxRedoseHrs2 + ' hr');
        abxParts.push('/ ' + abxParts2.join(' | '));
      }

      setOptionalRow('pr-antibiotic-plan-row', 'pr-antibiotic-plan', abxParts.join(' | '));
      setText('pr-asa-class', s['pat-asa-class'] || '_');
      setText('pr-insufflation', yn(s, 'pat-insufflation-yes', 'pat-insufflation-no'));
      var anticipatedEbl = String(s['pat-anticipated-ebl'] || '').trim();
      var needsTS = anticipatedEbl === 'Medium' || anticipatedEbl === 'High';
      var needsBloodRoom = anticipatedEbl === 'High';
      var tsDateEntered = String(s['pat-ts-date'] || '').trim();
      var eblVolumeMap = { 'Low': '<500 mL', 'Medium': '500–1500 mL', 'High': '>1500 mL' };
      var eblDisplay = anticipatedEbl ? (anticipatedEbl + (eblVolumeMap[anticipatedEbl] ? ' ' + eblVolumeMap[anticipatedEbl] : '')) : '';
      setOptionalRow('pr-anticipated-ebl-row', 'pr-anticipated-ebl', eblDisplay);
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
          setText('pr-prior-anesthetic', priorNotes || 'Yes');
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
      var tsDateStripped = tsDateVal ? tsDateVal.split('/').map(function(p){return parseInt(p,10)||p;}).join('/') : '';
      var tsDisplay = tsDateStripped ? (tsTimeVal ? tsDateStripped + ' @ ' + tsTimeVal : tsDateStripped) : '';
      var tsMsPr = parseTSDateTime(tsDateVal, tsTimeVal);
      var tsGoodUntil = tsMsPr === null ? '' : formatTSDateTime(tsMsPr + (72 * 60 * 60 * 1000));
      setOptionalRow('pr-lab-ts-date-row', 'pr-lab-ts-date', tsDisplay);
      var tsGoodUntilEl = document.getElementById('pr-lab-ts-good-until');
      var tsGoodUntilRow = document.getElementById('pr-lab-ts-good-until-row');
      if (tsGoodUntilEl) tsGoodUntilEl.textContent = tsGoodUntil || '_';
      var tsExpiryMs = tsMsPr !== null ? (tsMsPr + 72 * 60 * 60 * 1000) : null;
      var surgMs = parseTSDateTime(s['pat-surg-date'], s['pat-sched-surg-time']);
      var refMs = surgMs !== null ? surgMs : Date.now();
      if (tsGoodUntilRow) {
        tsGoodUntilRow.style.display = tsGoodUntil ? 'flex' : 'none';
        var tsColor = '';
        var tsWeight = '';
        if (tsExpiryMs !== null) {
          if (tsExpiryMs < refMs + 6 * 60 * 60 * 1000) {
            // Expires within 6 hrs of surgery (or already past): red
            tsColor = '#c41c3b'; tsWeight = 'bold';
          } else if (tsExpiryMs < refMs + 24 * 60 * 60 * 1000) {
            // Expires within 24 hrs of surgery: yellow background
            tsColor = '#7a5c00'; tsWeight = 'bold';
            tsGoodUntilRow.style.background = '#fff9c4';
          }
        }
        if (tsColor !== '#7a5c00') tsGoodUntilRow.style.background = '';
        tsGoodUntilRow.style.color = tsColor;
        tsGoodUntilRow.style.fontWeight = tsWeight;
      }

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

      // Obtain T+S: show only if user wants T+S and none on file, or existing T+S expiring within 6hrs of surgery
      var obtainTsRow = document.getElementById('pr-obtain-ts-row');
      if (obtainTsRow) {
        var wantsTS = !!s['pat-obtain-ts-yes'];
        var hasTSOnFile = !!tsDateVal;
        var tsExpiringUrgent = tsExpiryMs !== null && tsExpiryMs < refMs + 6 * 60 * 60 * 1000;
        var showObtainTS = (wantsTS && !hasTSOnFile) || tsExpiringUrgent;
        obtainTsRow.style.display = showObtainTS ? 'flex' : 'none';
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

      var meds = [];
      try { meds = JSON.parse(s['med-list'] || '[]') || []; } catch (e) {}
      var medsHtml = meds.filter(function(m) { return m && (m.med || m.other); }).map(function(m) {
        var name = m.med === 'Other' ? (m.other || 'Other') : (m.med || '');
        return name;
      }).join(', ');
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

      var neuroRow = document.getElementById('pr-neuro-monitor-row');
      if (neuroRow) neuroRow.style.display = (s['pat-neuro-monitoring'] === 'Yes') ? 'block' : 'none';

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
      var inhal2 = (s['ind-inhalation-2'] || '').trim();
      if (inhal2) {
        var inhal2str = inhal2;
        if (s['ind-mac-plan-2']) inhal2str += ' (' + s['ind-mac-plan-2'] + ' MAC)';
        inhal += '\n' + inhal2str;
      }
      setText('pr-inhal', inhal);
      var volatileContra = mhYes && (['Sevoflurane', 'Desflurane', 'Isoflurane'].indexOf(s['ind-inhalation']) >= 0 || ['Sevoflurane', 'Desflurane', 'Isoflurane'].indexOf(inhal2) >= 0);
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
      var painVal = String(s['pat-anticipated-pain'] || '').trim();
      setOptionalRow('pr-anticipated-pain-row', 'pr-anticipated-pain', painVal ? painVal + '/10' : '');

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
        var equipMiscExclude = new Set(['2nd PIV', 'Art Line', 'OG Tube', 'Foley', 'Face foam', 'Patient goggles']);
        var filteredEquip = equipItems.filter(function(item) {
          if (equipMiscExclude.has(item)) return false;
          if (item === 'Bair Hugger' || item.indexOf('Bair Hugger') === 0) return false;
          return true;
        });
        equipDiv.innerHTML = filteredEquip.length > 0 ? filteredEquip.join('<br>') : 'None';
      }

      // Extras section in print card (after vent settings)
      var extrasSection = document.getElementById('pr-extras-section');
      var extrasList = document.getElementById('pr-extras-list');
      if (extrasSection && extrasList) {
        if (equipItems.length > 0) {
          extrasList.textContent = equipItems.join('\n');
          extrasSection.style.display = 'block';
        } else {
          extrasSection.style.display = 'none';
        }
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

      // Vent Settings
      var ventMode = (s['vent-mode'] || '').trim();
      var ventTv = (s['vent-tv'] || '').trim();
      var ventPeep = (s['vent-peep'] || '').trim();
      var ventIe = (s['vent-ie'] || '').trim();
      var ventFio2 = (s['vent-fio2'] || '').trim();
      var ventAny = ventMode || ventTv || ventPeep || ventIe || ventFio2;
      var ventSection = document.getElementById('pr-vent-section');
      if (ventSection) ventSection.style.display = ventAny ? 'block' : 'none';
      setOptionalRow('pr-vent-mode-row', 'pr-vent-mode', ventMode);
      // Row 2: FiO₂ / PEEP / TV combined as "50% / 5 / 500"
      var ventMainParts = [];
      if (ventFio2) ventMainParts.push(ventFio2 + '%');
      if (ventPeep) ventMainParts.push(ventPeep + '+');
      if (ventTv) ventMainParts.push(ventTv + 'mL');
      setOptionalRow('pr-vent-main-row', 'pr-vent-main', ventMainParts.join(' / '));
      // Row 3: I:E
      var ventRestParts = [];
      if (ventIe) ventRestParts.push('I:E ' + ventIe);
      setOptionalRow('pr-vent-rest-row', 'pr-vent-rest', ventRestParts.join(' / '));

      // Notes
      var notesText = String(s['notes-freetext'] || '').trim();
      var notesSection = document.getElementById('pr-notes-section');
      var notesEl = document.getElementById('pr-notes');
      if (notesSection) notesSection.style.display = notesText ? 'block' : 'none';
      if (notesEl) notesEl.textContent = notesText;
    }

    function buildPrintCardHtml(state) {
      buildPrintCard(state || {});
      var source = document.getElementById('print-container');
      return source ? source.innerHTML : '';
    }

