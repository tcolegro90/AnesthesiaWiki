// ── Phone Share ───────────────────────────────────────────────
async function sharePhoneView() {
  var btn = document.getElementById('btn-share-phone');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  try {
    var state = (window.mirroredState && Object.keys(window.mirroredState).length)
      ? window.mirroredState
      : (function(){ try { return JSON.parse(localStorage.getItem('carePlanSplitState') || '{}') || {}; } catch(e){ return {}; } })();

    var initials = (state['pat-initials'] || 'Patient').trim();
    var surgery  = (state['pat-surgery']  || 'Procedure').trim();
    var date = (function(d) {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var m = d.match(/^(\d{1,2})\/(\d{1,2})/);
      return m ? (months[parseInt(m[1],10)-1] || m[1]) + ' ' + parseInt(m[2],10) : d.replace(/\//g,'-');
    })(String(state['pat-surg-date'] || '').trim());
    var time     = (state['pat-sched-surg-time'] || '').trim().replace(/:/g, '');
    var fParts   = [date, time, initials, surgery].filter(Boolean);
    var filename = fParts.join(' ') + '.pdf';
    var shareTitle = filename.replace(/\.pdf$/i, '');

    if (typeof window.html2pdf !== 'function') { alert('PDF library unavailable.'); return; }

    var pc = document.getElementById('print-container');
    if (!pc) { alert('Print card not found.'); return; }

    // Record current size classes so we can restore after
    var prevClasses = ['lps-half','lps-full','lps-phone','layout-landscape'].filter(function(c){ return pc.classList.contains(c); });

    // Switch to phone layout and rebuild card
    pc.classList.remove('lps-half','lps-full','layout-landscape');
    pc.classList.add('lps-phone');
    if (typeof window.buildPrintCard === 'function') window.buildPrintCard(state);

    // Wait a tick for paint
    await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });

    // Measure the fully-rendered phone card
    var cardW = pc.scrollWidth  || 390;
    var cardH = pc.scrollHeight || 800;
    var inW = (cardW / 96) + 0.3;
    var inH = (cardH / 96) + 0.3;

    // Off-screen clone for html2pdf — keep id so #print-container.lps-phone CSS applies
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
    var clone = pc.cloneNode(true);
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';

    // Phone layout: move Notes section to the top of the card
    var cloneGrid = clone.querySelector('#print-grid-inner');
    var cloneNotes = clone.querySelector('#pr-notes-section');
    if (cloneGrid && cloneNotes && cloneNotes.style.display !== 'none') {
      var notesPhoneWrap = document.createElement('div');
      notesPhoneWrap.className = 'print-section';
      cloneGrid.insertBefore(notesPhoneWrap, cloneGrid.firstChild);
      notesPhoneWrap.appendChild(cloneNotes);
    }

    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      var worker = window.html2pdf()
        .set({
          filename: filename,
          margin: [0.15, 0.15, 0.15, 0.15],
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: { scale: 3, backgroundColor: '#f2f4f8', useCORS: true, scrollY: 0 },
          jsPDF: { unit: 'in', format: [inW, inH], orientation: 'portrait' }
        })
        .from(clone)
        .toPdf();

      var pdf = await worker.get('pdf');
      var blob = pdf.output('blob');
      var file = null;
      try { file = new File([blob], filename, { type: 'application/pdf' }); } catch(e) {}

      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text: shareTitle });
      } else {
        // Fallback: mailto with PDF download
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 5000);
        var subject = encodeURIComponent(shareTitle);
        var body    = encodeURIComponent('Care plan PDF attached (just downloaded).');
        window.open('mailto:?subject=' + subject + '&body=' + body);
      }
    } finally {
      if (host.parentNode) host.parentNode.removeChild(host);
      // Restore original layout
      pc.classList.remove('lps-phone');
      prevClasses.forEach(function(c){ pc.classList.add(c); });
      if (typeof window.buildPrintCard === 'function') window.buildPrintCard(state);
    }
  } catch(e) {
    if (e && e.name !== 'AbortError') { console.error('sharePhoneView', e); alert('Could not generate PDF: ' + e.message); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📱 Share Phone View'; }
  }
}

// Mobile side-drawer helpers
function openMobDrawer() {
  document.getElementById('mob-drawer').classList.add('open');
  document.getElementById('mob-drawer-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobDrawer() {
  document.getElementById('mob-drawer').classList.remove('open');
  document.getElementById('mob-drawer-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}
// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeMobDrawer();
});

// Desktop top bar collapse toggle
function toggleDeskTopbar() {
  var body = document.getElementById('desk-topbar-body');
  var btn  = document.getElementById('desk-topbar-toggle');
  if (!body) return;
  var collapsed = body.classList.toggle('dtb-collapsed');
  try { localStorage.setItem('deskTopbarCollapsed', collapsed ? '1' : '0'); } catch(e) {}
}
// Restore desk topbar collapsed state on load
(function() {
  if (localStorage.getItem('deskTopbarCollapsed') !== '1') return;
  var body = document.getElementById('desk-topbar-body');
  var btn  = document.getElementById('desk-topbar-toggle');
  if (body) body.classList.add('dtb-collapsed');
})();

// On load: if ?phoneview=1 is present, restore state from hash and open phone preview
(function() {
  if (!/[?&]phoneview=1/.test(location.search)) return;
  var hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  var state;
  try {
    state = JSON.parse(decodeURIComponent(escape(atob(hash))));
  } catch(e) { console.warn('phoneview: could not decode state', e); return; }

  // Wait for combined.js to finish initialising, then restore + open preview
  var attempts = 0;
  var timer = setInterval(function() {
    attempts++;
    if (attempts > 60) { clearInterval(timer); return; } // give up after 6s
    // mirroredState and openPreview are set up by combined.js
    if (typeof window.openPreview !== 'function') return;
    clearInterval(timer);

    // Push state into mirroredState so buildPrintCard picks it up
    window.mirroredState = state;
    // Force phone layout via public API
    if (typeof window.layoutSetPageSize === 'function') window.layoutSetPageSize('phone');
    // Brief delay for DOM to settle, then open preview
    setTimeout(function() {
      window.openPreview();
    }, 200);
  }, 100);
})();
