// email-plan.js — email + PDF generation for current plan
// Extracted from combined.js. Depends on: print-card.js (buildPrintCard, escapeHtml).
/* global mirroredState, getState, buildPrintCard */

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
