// print-preview.js — preview UI, plan picker, multi-plan print/email
// Extracted from combined.js. Depends on: print-card.js, email-plan.js.
/* global mirroredState, getState, getSavedPlans, fitAll, previewMode, multiPreviewSelectedNames, multiPreviewPlans */
/* global buildPrintCard, buildPrintCardHtml, escapeHtml */
/* global downloadBlob, buildCurrentPlanPdfBlob, buildEmailPlanText, safeFilePart, safeNamePart, formatDateShort */

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
      document.body.classList.add('preview-open');
      var nav = document.getElementById('cp-side-nav');
      if (nav) nav.style.display = 'none';
    }

    function closePreview() {
      document.getElementById('preview-screen').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';
      document.body.classList.remove('preview-open');
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
        '.spp-dialog{width:min(760px,100%);max-width:calc(100vw - 36px);max-height:min(84vh,760px);display:flex;flex-direction:column;background:#fffdf8;border:1px solid #e8dece;border-radius:14px;box-shadow:0 20px 45px rgba(0,0,0,.25);overflow:hidden;}',
        '.spp-head{padding:14px 16px 12px;background:linear-gradient(135deg,#c06030 0%,#d97840 100%);}',
        '.spp-title{font-size:.97rem;font-weight:700;color:#fff;margin:0;}',
        '.spp-sub{font-size:.78rem;color:#fdd9bc;margin-top:3px;}',
        '.spp-count{font-weight:700;color:#fff;}',
        '.spp-search-wrap{position:relative;margin:10px 8px 4px;}',
        '.spp-search-wrap input{width:100%;border:1.5px solid #e8d8c5;border-radius:9px;padding:8px 12px 8px 30px;font-size:.83rem;color:#3d2a18;background:#fff8f0;outline:none;box-sizing:border-box;}',
        '.spp-search-wrap input:focus{border-color:#c06030;}',
        '.spp-search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#c8926a;font-size:.82rem;pointer-events:none;}',
        '.spp-list{padding:2px 6px 10px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:3px;flex:1;min-height:0;}',
        '.spp-date-hdr{display:flex;align-items:center;gap:7px;padding:2px 4px 4px;cursor:pointer;user-select:none;}',
        '.spp-date-hdr-label{font-size:.72rem;font-weight:700;color:#b06040;text-transform:uppercase;letter-spacing:.05em;}',
        '.spp-date-hdr-line{flex:1;height:1px;background:#ecd8c5;}',
        '.spp-date-hdr-count{font-size:.68rem;color:#c8a080;}',
        '.spp-date-hdr-chev{font-size:.65rem;color:#c8906a;transition:transform .15s;display:inline-block;}',
        '.spp-date-hdr.spp-collapsed .spp-date-hdr-chev{transform:rotate(-90deg);}',
        '.spp-option{display:flex;align-items:center;gap:6px;padding:9px 8px;border:1.5px solid #eeddd0;border-radius:10px;background:#fff;cursor:pointer;user-select:none;overflow:hidden;min-width:0;}',
        '.spp-option:hover{background:#fff4ea;border-color:#d09060;}',
        '.spp-option[data-disabled="1"]{opacity:.55;cursor:not-allowed;background:#f7f8fa;}',
        '.spp-check{position:absolute;opacity:0;pointer-events:none;}',
        '.spp-bubble{width:16px;height:16px;border-radius:50%;border:2px solid #d09060;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff;font-size:9px;font-weight:700;line-height:1;color:#fff;}',
        '.spp-check:checked + .spp-bubble{border-color:#c06030;background:#c06030;}',
        '.spp-inittime{display:flex;align-items:center;gap:3px;flex-shrink:0;}',
        '.spp-initials{font-size:.82rem;font-weight:700;color:#3d1a08;}',
        '.spp-timepill{font-size:.78rem;color:#a06840;background:#fdeedd;border-radius:5px;padding:1px 5px;white-space:nowrap;}',
        '.spp-surgname{font-size:.82rem;color:#3d1a08;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.spp-archive-header{display:flex;align-items:center;gap:6px;padding:7px 8px;background:#fff0e0;border:1px solid #e8d0b8;border-radius:9px;cursor:pointer;user-select:none;font-size:.77rem;font-weight:700;color:#7a3a10;margin-top:6px;}',
        '.spp-archive-header:hover{background:#ffe8d0;}',
        '.spp-archive-chevron{display:inline-block;transition:transform .15s;}',
        '.spp-archive-header.spp-collapsed .spp-archive-chevron{transform:rotate(-90deg);}',
        '.spp-archive-count{color:#c8906a;font-weight:400;margin-left:auto;font-size:.72rem;}',
        '.spp-month-header{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fff0e2;border:1px solid #e4c8a8;border-radius:9px;cursor:pointer;user-select:none;margin-top:5px;}',
        '.spp-month-header:hover{background:#ffe4c8;}',
        '.spp-month-chevron{display:inline-block;transition:transform .15s;font-size:.68rem;color:#c8906a;}',
        '.spp-month-header.spp-collapsed .spp-month-chevron{transform:rotate(-90deg);}',
        '.spp-month-label{font-size:.78rem;font-weight:700;color:#6a2a08;}',
        '.spp-month-count{color:#c8906a;font-weight:400;margin-left:auto;font-size:.72rem;}',
        '.spp-folder-header{display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;user-select:none;margin-top:3px;margin-left:12px;}',
        '.spp-folder-chevron{font-size:.65rem;color:#c8906a;transition:transform .15s;display:inline-block;}',
        '.spp-folder-header.spp-collapsed .spp-folder-chevron{transform:rotate(-90deg);}',
        '.spp-folder-header-line{flex:1;height:1px;background:#ecd8c5;}',
        '.spp-folder-label{font-size:.7rem;font-weight:700;color:#b06040;text-transform:uppercase;letter-spacing:.04em;}',
        '.spp-folder-count{font-size:.68rem;color:#c8a080;}',
        '.spp-foot{display:flex;justify-content:flex-end;gap:9px;padding:11px 12px;border-top:1px solid #ede0d0;background:#fffaf4;}',
        '.spp-btn{padding:7px 14px;border-radius:9px;border:1.5px solid #e0c8a8;background:#fff;color:#5a3010;font-weight:600;cursor:pointer;font-size:.83rem;}',
        '.spp-btn.spp-primary{border-color:#c06030;background:#c06030;color:#fff;}',
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

        // Search bar
        var _searchWrap = document.createElement('div');
        _searchWrap.className = 'spp-search-wrap';
        _searchWrap.innerHTML = '<span class="spp-search-icon">\uD83D\uDD0D</span><input type="text" class="spp-search-input" placeholder="Search surgery, initials\u2026" autocomplete="off">';
        dialog.appendChild(_searchWrap);

        var list = document.createElement('div');
        list.className = 'spp-list';
        dialog.appendChild(list);

        // Parse plan name format: "Initials | Date | StartTime [| EndTime] | Surgery"
        function _parsePlanName(n) {
          var p = n.split(' | ');
          var hasFive = p.length >= 5;
          var startTime = p[2] ? p[2].trim() : '';
          var endTime   = hasFive && p[3] ? p[3].trim() : '';
          return {
            initials: p[0] ? p[0].trim() : n,
            time:     startTime + (endTime ? '\u2013' + endTime : ''),
            surgery:  hasFive ? (p[4] ? p[4].trim() : '') : (p[3] ? p[3].trim() : (p[1] || n))
          };
        }

        // Build a plan row element
        function _makeRow(name, isArchive, folderKey) {
          var parsed = _parsePlanName(name);
          var checked = selectedOrder.indexOf(name) !== -1;
          var row = document.createElement('label');
          row.className = 'spp-option';
          row.setAttribute('data-name', name);
          if (isArchive) {
            row.setAttribute('data-archive', '1');
            if (folderKey) row.setAttribute('data-folder-key', folderKey);
          }
          row.innerHTML =
            '<input type="checkbox" class="spp-check"' + (checked ? ' checked' : '') + '>' +
            '<span class="spp-bubble"></span>' +
            '<span class="spp-inittime">' +
              '<span class="spp-initials"></span>' +
              (parsed.time ? '<span class="spp-timepill"></span>' : '') +
            '</span>' +
            '<span class="spp-surgname"></span>';
          row.querySelector('.spp-initials').textContent = parsed.initials;
          var tp = row.querySelector('.spp-timepill');
          if (tp) tp.textContent = parsed.time;
          row.querySelector('.spp-surgname').textContent = parsed.surgery || name;
          return row;
        }

        // Group plans: today flat, archive by month then by day
        var _now = new Date();
        var _todayStr = _now.toDateString();
        var _yesterdayStr = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - 1).toDateString();
        var _todayNames = [], _monthGroups = {};
        names.forEach(function(name) {
          var sa = (opts.plans && opts.plans[name] && opts.plans[name].savedAt) ? String(opts.plans[name].savedAt) : '';
          var d = sa ? new Date(sa) : null;
          var dtStr = (d && !isNaN(d.getTime())) ? d.toDateString() : 'Unknown';
          if (dtStr === _todayStr) { _todayNames.push(name); return; }
          var monthKey = (d && !isNaN(d.getTime()))
            ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
            : '0000-00';
          if (!_monthGroups[monthKey]) _monthGroups[monthKey] = { dates: {} };
          if (!_monthGroups[monthKey].dates[dtStr]) _monthGroups[monthKey].dates[dtStr] = [];
          _monthGroups[monthKey].dates[dtStr].push(name);
        });

        var _archiveMonthKeys = Object.keys(_monthGroups).sort(function(a, b) { return b.localeCompare(a); });
        var _archiveTotal = _archiveMonthKeys.reduce(function(sum, mk) {
          return sum + Object.keys(_monthGroups[mk].dates).reduce(function(s, dk) { return s + _monthGroups[mk].dates[dk].length; }, 0);
        }, 0);

        // Render today group
        var _todayHdr = null, _todayRows = [];
        if (_todayNames.length) {
          var _todayLabel = 'Today \u2014 ' + _now.toLocaleDateString([], { month: 'short', day: 'numeric' });
          _todayHdr = document.createElement('div');
          _todayHdr.className = 'spp-date-hdr';
          _todayHdr.innerHTML =
            '<span class="spp-date-hdr-chev">\u25BC</span>' +
            '<span class="spp-date-hdr-label">' + escapeHtml(_todayLabel) + '</span>' +
            '<span class="spp-date-hdr-line"></span>' +
            '<span class="spp-date-hdr-count">' + _todayNames.length + ' plan' + (_todayNames.length !== 1 ? 's' : '') + '</span>';
          _todayHdr.addEventListener('click', function() {
            var coll = _todayHdr.classList.toggle('spp-collapsed');
            _todayRows.forEach(function(r) { r.style.display = coll ? 'none' : ''; });
          });
          list.appendChild(_todayHdr);
          _todayNames.forEach(function(name) {
            var row = _makeRow(name, false, null);
            _todayRows.push(row);
            list.appendChild(row);
          });
        }

        // Render archive: month → date → rows (all collapsed by default)
        var _archiveHdr = null, _archiveRows = [], _archiveFolderHdrs = [], _archiveMonthHdrs = [];
        if (_archiveMonthKeys.length) {
          _archiveHdr = document.createElement('div');
          _archiveHdr.className = 'spp-archive-header spp-collapsed';
          _archiveHdr.innerHTML =
            '<span class="spp-archive-chevron">\u25BC</span>' +
            '<span>\uD83D\uDCC1 Archive</span>' +
            '<span class="spp-archive-count">' + _archiveTotal + ' plan' + (_archiveTotal !== 1 ? 's' : '') + '</span>';
          list.appendChild(_archiveHdr);

          _archiveMonthKeys.forEach(function(mk) {
            var mDate = new Date(mk + '-02');
            var mLabel = mDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
            var mTotal = Object.keys(_monthGroups[mk].dates).reduce(function(s, dk) { return s + _monthGroups[mk].dates[dk].length; }, 0);
            var mhdr = document.createElement('div');
            mhdr.className = 'spp-month-header spp-collapsed';
            mhdr.setAttribute('data-month-key', mk);
            mhdr.style.display = 'none';
            mhdr.innerHTML =
              '<span class="spp-month-chevron">\u25BC</span>' +
              '<span class="spp-month-label">\uD83D\uDCC5 ' + escapeHtml(mLabel) + '</span>' +
              '<span class="spp-month-count">' + mTotal + ' plan' + (mTotal !== 1 ? 's' : '') + '</span>';
            _archiveMonthHdrs.push(mhdr);
            list.appendChild(mhdr);

            var dateKeys = Object.keys(_monthGroups[mk].dates).sort(function(a, b) { return new Date(b) - new Date(a); });
            dateKeys.forEach(function(dtStr) {
              var dt = new Date(dtStr);
              var isYest = dtStr === _yesterdayStr;
              var lbl = isYest
                ? 'Yesterday \u2014 ' + dt.toLocaleDateString([], { month: 'short', day: 'numeric' })
                : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              var fhdr = document.createElement('div');
              fhdr.className = 'spp-folder-header spp-collapsed';
              fhdr.setAttribute('data-folder-key', dtStr);
              fhdr.setAttribute('data-month-key', mk);
              fhdr.style.display = 'none';
              fhdr.innerHTML =
                '<span class="spp-folder-chevron">\u25BC</span>' +
                '<span class="spp-folder-label">' + escapeHtml(lbl) + '</span>' +
                '<span class="spp-folder-header-line"></span>' +
                '<span class="spp-folder-count">' + _monthGroups[mk].dates[dtStr].length + '</span>';
              fhdr.addEventListener('click', function(e) {
                e.stopPropagation();
                var coll = fhdr.classList.toggle('spp-collapsed');
                list.querySelectorAll('.spp-option[data-folder-key="' + CSS.escape(dtStr) + '"]').forEach(function(r) {
                  r.style.display = coll ? 'none' : '';
                });
              });
              list.appendChild(fhdr);
              _archiveFolderHdrs.push(fhdr);
              _monthGroups[mk].dates[dtStr].forEach(function(name) {
                var row = _makeRow(name, true, dtStr);
                row.style.display = 'none';
                _archiveRows.push(row);
                list.appendChild(row);
              });
            });

            mhdr.addEventListener('click', function(e) {
              e.stopPropagation();
              var coll = mhdr.classList.toggle('spp-collapsed');
              list.querySelectorAll('.spp-folder-header[data-month-key="' + CSS.escape(mk) + '"]').forEach(function(h) {
                h.style.display = coll ? 'none' : '';
                if (coll) { h.classList.add('spp-collapsed'); }
              });
              if (coll) {
                Object.keys(_monthGroups[mk].dates).forEach(function(dtStr) {
                  list.querySelectorAll('.spp-option[data-folder-key="' + CSS.escape(dtStr) + '"]').forEach(function(r) { r.style.display = 'none'; });
                });
              }
            });
          });

          _archiveHdr.addEventListener('click', function() {
            var coll = _archiveHdr.classList.toggle('spp-collapsed');
            _archiveMonthHdrs.forEach(function(h) { h.style.display = coll ? 'none' : ''; });
            if (coll) {
              _archiveMonthHdrs.forEach(function(h) { h.classList.add('spp-collapsed'); });
              _archiveFolderHdrs.forEach(function(h) { h.style.display = 'none'; h.classList.add('spp-collapsed'); });
              _archiveRows.forEach(function(r) { r.style.display = 'none'; });
            }
          });
        }

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
          if (ev.key === 'Enter') {
            ev.preventDefault();
            var confirmBtn = dialog.querySelector('#spp-confirm');
            if (confirmBtn && !confirmBtn.disabled) confirmBtn.click();
          }
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

        // Search filter
        var _searchInput = dialog.querySelector('.spp-search-input');
        if (_searchInput) {
          _searchInput.addEventListener('input', function() {
            var q = _searchInput.value.trim().toLowerCase();
            if (!q) {
              // Restore grouped view
              if (_todayHdr) _todayHdr.style.display = '';
              _todayRows.forEach(function(r) {
                r.style.display = (_todayHdr && _todayHdr.classList.contains('spp-collapsed')) ? 'none' : '';
              });
              if (_archiveHdr) {
                _archiveHdr.style.display = '';
                var archColl = _archiveHdr.classList.contains('spp-collapsed');
                _archiveMonthHdrs.forEach(function(h) { h.style.display = archColl ? 'none' : ''; });
                _archiveFolderHdrs.forEach(function(h) { h.style.display = 'none'; });
                _archiveRows.forEach(function(r) { r.style.display = 'none'; });
              }
            } else {
              // Search mode: hide group headers, show/hide rows by match
              if (_todayHdr) _todayHdr.style.display = 'none';
              if (_archiveHdr) _archiveHdr.style.display = 'none';
              _archiveMonthHdrs.forEach(function(h) { h.style.display = 'none'; });
              _archiveFolderHdrs.forEach(function(h) { h.style.display = 'none'; });
              list.querySelectorAll('.spp-option').forEach(function(row) {
                var nm = (row.getAttribute('data-name') || '').toLowerCase();
                row.style.display = nm.indexOf(q) !== -1 ? '' : 'none';
              });
            }
          });
        }

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
      multiPreviewPlans = plans || {};
      buildMultiPreviewPages(multiPreviewSelectedNames, plans || {});
      setPreviewActionMode('multi');
      setPrintMode('multi');
      document.getElementById('main-content').style.display = 'none';
      document.getElementById('preview-screen').style.display = 'flex';
      document.body.classList.add('preview-open');
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

      // Build filename from dates + OR numbers across selected plans
      var dateOrParts = [];
      var dateOrMap = {}; // date -> [or numbers]
      selectedNames.forEach(function(name) {
        var state = (plans[name] && plans[name].state) ? plans[name].state : {};
        var d = formatDateShort(state['pat-surg-date'] || '') || '';
        var or = String(state['pat-or-number'] || '').trim();
        if (!d) return;
        if (!dateOrMap[d]) { dateOrMap[d] = []; dateOrParts.push(d); }
        if (or && dateOrMap[d].indexOf('OR' + or) === -1) dateOrMap[d].push('OR' + or);
      });
      var filenameStem;
      if (dateOrParts.length) {
        filenameStem = dateOrParts.map(function(d) {
          var ors = dateOrMap[d];
          return ors.length ? d + ' ' + ors.join(' ') : d;
        }).join(' · ');
      } else {
        filenameStem = 'Anesthetic_Care_Plans_' + String(selectedNames.length) + '_plans';
      }
      var filename = filenameStem + '.pdf';
      var subject = filenameStem.replace(/_/g, ' ');

      var blob;
      try {
        blob = await buildMultiPreviewPdfBlob(filename);
      } catch (err) {
        showTopbarFlash('Could not generate combined PDF for selected plans.');
        return;
      }

      var file = null;
      try { file = new File([blob], filename, { type: 'application/pdf' }); } catch (e) {}

      var canShareFile = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
      if (canShareFile) {
        try {
          await navigator.share({
            title: subject,
            files: [file]
          });
          return;
        } catch (shareErr) {
          // Continue to fallback.
        }
      }

      downloadBlob(blob, filename);
      var body = [
        'Selected plans:',
        selectedNames.map(function(n, idx) { return String(idx + 1) + '. ' + n; }).join('\n'),
        '',
        'If attachment is missing, please attach: ' + filename
      ].join('\n');
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      showTopbarFlash('Combined PDF downloaded. An email draft opened — please attach the downloaded PDF.');
    }

    async function printOrEmailSavedPlans() {
      var plans = await getSavedPlans();
      var names = getSavedPlanNamesSorted(plans);
      if (!names.length) {
        showTopbarFlash('No saved plans found.');
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
        showTopbarFlash('No selected plans in preview.');
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
          showTopbarFlash('PDF downloaded — open it and print from your PDF viewer.');
        }
        setTimeout(function() { URL.revokeObjectURL(url); }, 120000);
      } catch (err) {
        showTopbarFlash('Could not generate PDF. Try again or use Email.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Print Selected Plans'; }
      }
    }

    async function emailSelectedPlansFromPreview() {
      if (!multiPreviewSelectedNames.length) {
        showTopbarFlash('No selected plans in preview.');
        return;
      }

      var filename = 'Anesthetic_Care_Plans_' + String(multiPreviewSelectedNames.length) + '_plans.pdf';
      // Build smart filename from dates + OR numbers
      var dateOrMap = {};
      var dateOrParts = [];
      multiPreviewSelectedNames.forEach(function(name) {
        var state = (multiPreviewPlans[name] && multiPreviewPlans[name].state) ? multiPreviewPlans[name].state : {};
        var d = formatDateShort(state['pat-surg-date'] || '') || '';
        var or = String(state['pat-or-number'] || '').trim();
        if (!d) return;
        if (!dateOrMap[d]) { dateOrMap[d] = []; dateOrParts.push(d); }
        if (or && dateOrMap[d].indexOf('OR' + or) === -1) dateOrMap[d].push('OR' + or);
      });
      if (dateOrParts.length) {
        var stem = dateOrParts.map(function(d) {
          var ors = dateOrMap[d];
          return ors.length ? d + ' ' + ors.join(' ') : d;
        }).join(' - ');
        filename = stem + '.pdf';
      }
      var subject = filename.replace(/\.pdf$/i, '');
      var blob;
      try {
        blob = await buildMultiPreviewPdfBlob(filename);
      } catch (err) {
        showTopbarFlash('Could not generate combined PDF from preview.');
        return;
      }

      var file = null;
      try { file = new File([blob], filename, { type: 'application/pdf' }); } catch (e) {}

      var canShareFile = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
      if (canShareFile) {
        try {
          await navigator.share({
            title: subject,
            files: [file]
          });
          return;
        } catch (shareErr) {
          // Continue to fallback.
        }
      }

      downloadBlob(blob, filename);
      var body = [
        'Selected plans:',
        multiPreviewSelectedNames.map(function(n, idx) { return String(idx + 1) + '. ' + n; }).join('\n'),
        '',
        'If attachment is missing, please attach: ' + filename
      ].join('\n');
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      showTopbarFlash('Combined PDF downloaded. An email draft opened — please attach the downloaded PDF.');
    }

    // Backward-compatible wrapper for older button hooks.
    async function printSavedPlansBatch() {
      await printOrEmailSavedPlans();
    }

    // Backward-compatible wrapper for older button hooks.
    async function emailSavedPlans() {
      await printOrEmailSavedPlans();
    }

