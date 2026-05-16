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
        '.spp-dialog{width:min(680px,100%);max-width:calc(100vw - 36px);max-height:min(84vh,760px);display:flex;flex-direction:column;background:#fff;border:1px solid #c9d3e0;border-radius:12px;box-shadow:0 20px 45px rgba(0,0,0,.25);overflow:hidden;}',
        '.spp-head{padding:14px 16px;border-bottom:1px solid #e5ebf4;background:#f7faff;}',
        '.spp-title{font-size:1rem;font-weight:700;color:#1b2a41;margin:0;}',
        '.spp-sub{font-size:.86rem;color:#516277;margin-top:3px;}',
        '.spp-count{font-weight:700;color:#0b5cab;}',
        '.spp-list{padding:10px 12px;overflow-y:auto;overflow-x:hidden;display:grid;grid-template-columns:1fr;gap:7px;flex:1;min-height:0;}',
        '.spp-option{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #d9e2ef;border-radius:9px;background:#fff;cursor:pointer;user-select:none;overflow:hidden;min-width:0;}',
        '.spp-option:hover{background:#f7fbff;border-color:#b9cde7;}',
        '.spp-check{position:absolute;opacity:0;pointer-events:none;}',
        '.spp-bubble{width:18px;height:18px;border-radius:999px;border:2px solid #87a4c7;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff;font-size:10px;font-weight:700;line-height:1;color:#fff;}',
        '.spp-check:checked + .spp-bubble{border-color:#0b5cab;background:#0b5cab;}',
        '.spp-label{display:flex;gap:8px;align-items:center;min-width:0;flex:1;}',
        '.spp-index{font-weight:700;color:#29466f;min-width:22px;text-align:right;}',
        '.spp-name{font-size:.92rem;color:#172638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}',
        '.spp-meta{font-size:.78rem;color:#7b8797;white-space:nowrap;margin-left:auto;}',
        '.spp-option[data-disabled="1"]{opacity:.55;cursor:not-allowed;background:#f7f8fa;}',
        '.spp-foot{display:flex;justify-content:flex-end;gap:9px;padding:12px 14px;border-top:1px solid #e5ebf4;background:#fbfdff;}',
        '.spp-btn{padding:8px 12px;border-radius:8px;border:1px solid #b9c8da;background:#fff;color:#1f3550;font-weight:600;cursor:pointer;}',
        '.spp-btn.spp-primary{border-color:#0b5cab;background:#0b5cab;color:#fff;}',
        '.spp-btn:disabled{opacity:.5;cursor:not-allowed;}',
        '.spp-folder-header{display:flex;align-items:center;gap:7px;padding:7px 10px;cursor:pointer;user-select:none;font-size:.8rem;font-weight:700;color:#29466f;border-radius:7px;background:#eef3fa;border:1px solid #d2ddef;margin-top:4px;}',
        '.spp-folder-header:hover{background:#e4edf8;}',
        '.spp-folder-chevron{font-style:normal;display:inline-block;transition:transform .15s;line-height:1;}',
        '.spp-folder-header.spp-collapsed .spp-folder-chevron{transform:rotate(-90deg);}',
        '.spp-folder-count{font-weight:400;color:#516277;margin-left:auto;font-size:.77rem;}',
        '.spp-archive-header{display:flex;align-items:center;gap:7px;padding:8px 10px;cursor:pointer;user-select:none;font-size:.82rem;font-weight:700;color:#1b2a41;border-radius:8px;background:#e2e9f4;border:1px solid #b8c8df;margin-top:6px;}',
        '.spp-archive-header:hover{background:#d5e0f0;}',
        '.spp-archive-chevron{font-style:normal;display:inline-block;transition:transform .15s;line-height:1;}',
        '.spp-archive-header.spp-collapsed .spp-archive-chevron{transform:rotate(-90deg);}',
        '.spp-archive-count{font-weight:400;color:#516277;margin-left:auto;font-size:.77rem;}',
        '.spp-folder-header{margin-left:14px;}'
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

        // Group names: today = flat, yesterday + older = date folders
        var _now = new Date();
        var _todayStr = _now.toDateString();
        var _yesterdayStr = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - 1).toDateString();
        var _todayNames = [], _folderGroups = {};
        names.forEach(function(name) {
          var sa = (opts.plans && opts.plans[name] && opts.plans[name].savedAt) ? String(opts.plans[name].savedAt) : '';
          var d = sa ? new Date(sa) : null;
          var dtStr = (d && !isNaN(d.getTime())) ? d.toDateString() : 'Unknown';
          if (dtStr === _todayStr) { _todayNames.push(name); }
          else { if (!_folderGroups[dtStr]) _folderGroups[dtStr] = []; _folderGroups[dtStr].push(name); }
        });

        var _groups = [];
        if (_todayNames.length) _groups.push({ label: null, key: 'today', names: _todayNames });
        Object.keys(_folderGroups).sort(function(a, b) { return new Date(b) - new Date(a); }).forEach(function(dtStr) {
          var dt = new Date(dtStr);
          var isYest = dtStr === _yesterdayStr;
          var label = isYest
            ? 'Yesterday \u2014 ' + dt.toLocaleDateString([], { month: 'short', day: 'numeric' })
            : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          _groups.push({ label: label, key: dtStr, names: _folderGroups[dtStr] });
        });

        // Count total archived plans for the Archive header badge
        var _archiveGroups = _groups.filter(function(g) { return g.label !== null; });
        var _archiveTotal = _archiveGroups.reduce(function(sum, g) { return sum + g.names.length; }, 0);

        // Render Archive header (only if there are any non-today plans)
        var _archiveHeader = null;
        if (_archiveGroups.length) {
          _archiveHeader = document.createElement('div');
          _archiveHeader.className = 'spp-archive-header';
          _archiveHeader.innerHTML =
            '<span class="spp-archive-chevron">&#9662;</span>' +
            '<span>&#128193; Archive</span>' +
            '<span class="spp-archive-count">' + _archiveTotal + ' plan' + (_archiveTotal !== 1 ? 's' : '') + '</span>';
          _archiveHeader.addEventListener('click', function() {
            var collapsed = _archiveHeader.classList.toggle('spp-collapsed');
            // Toggle all date sub-headers and plan rows inside the archive
            list.querySelectorAll('.spp-folder-header, .spp-option[data-archive="1"]').forEach(function(el) {
              el.style.display = collapsed ? 'none' : '';
            });
          });
        }

        var _globalIdx = 0;
        _groups.forEach(function(group) {
          if (group.label !== null) {
            // Insert Archive header before the very first date sub-folder
            if (_archiveHeader) { list.appendChild(_archiveHeader); _archiveHeader = null; }

            var header = document.createElement('div');
            header.className = 'spp-folder-header';
            header.setAttribute('data-folder-key', group.key);
            header.innerHTML =
              '<span class="spp-folder-chevron">&#9662;</span>' +
              '<span class="spp-folder-label">' + escapeHtml(group.label) + '</span>' +
              '<span class="spp-folder-count">(' + group.names.length + ')</span>';
            header.addEventListener('click', function() {
              var collapsed = header.classList.toggle('spp-collapsed');
              var fKey = header.getAttribute('data-folder-key');
              list.querySelectorAll('.spp-option[data-folder-key="' + CSS.escape(fKey) + '"]').forEach(function(row) {
                row.style.display = collapsed ? 'none' : '';
              });
            });
            list.appendChild(header);
          }

          group.names.forEach(function(name) {
            _globalIdx++;
            var row = document.createElement('label');
            row.className = 'spp-option';
            row.setAttribute('data-name', name);
            if (group.label !== null) {
              row.setAttribute('data-folder-key', group.key);
              row.setAttribute('data-archive', '1');
            }

            var savedAt = (opts.plans && opts.plans[name] && opts.plans[name].savedAt) ? String(opts.plans[name].savedAt) : '';
            var savedLabel = '';
            if (savedAt) {
              var dt = new Date(savedAt);
              if (!isNaN(dt.getTime())) {
                var timeStr = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                savedLabel = (group.label === null) ? 'Today ' + timeStr : timeStr;
              }
            }

            var checked = selectedOrder.indexOf(name) !== -1;
            row.innerHTML =
              '<input type="checkbox" class="spp-check" ' + (checked ? 'checked' : '') + '>' +
              '<span class="spp-bubble"></span>' +
              '<span class="spp-label"><span class="spp-index">' + _globalIdx + '.</span><span class="spp-name"></span><span class="spp-meta"></span></span>';
            row.querySelector('.spp-name').textContent = name;
            var meta = row.querySelector('.spp-meta');
            if (meta) meta.textContent = savedLabel;
            list.appendChild(row);
          });
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

