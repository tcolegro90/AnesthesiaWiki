// ============================================================
// SIGNATURE CANVAS
// ============================================================
let _sigCtx = null;
let _sigDrawing = false;
let _sigHasSig = false;

function initSignatureCanvas() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  canvas.style.touchAction = 'none';
  _sigCtx = canvas.getContext('2d');
  _sigCtx.strokeStyle = '#1a1a1a';
  _sigCtx.lineWidth = 2;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('mousedown', (e) => {
    _sigDrawing = true;
    _sigCtx.beginPath();
    const p = getPos(e);
    _sigCtx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!_sigDrawing) return;
    const p = getPos(e);
    _sigCtx.lineTo(p.x, p.y);
    _sigCtx.stroke();
    _sigHasSig = true;
  });
  canvas.addEventListener('mouseup', () => { _sigDrawing = false; });
  canvas.addEventListener('mouseleave', () => { _sigDrawing = false; });
  canvas.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    _sigDrawing = true;
    _sigCtx.beginPath();
    const p = getPos(e);
    _sigCtx.moveTo(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!_sigDrawing) return;
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    _sigCtx.lineTo(p.x, p.y);
    _sigCtx.stroke();
    _sigHasSig = true;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (e.cancelable) e.preventDefault();
    _sigDrawing = false;
  }, { passive: false });
  canvas.addEventListener('touchcancel', () => { _sigDrawing = false; }, { passive: true });
  document.getElementById('e-sig-clear')?.addEventListener('click', clearSignature);
}

function clearSignature() {
  if (!_sigCtx) return;
  const canvas = document.getElementById('sig-canvas');
  if (canvas) _sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  _sigHasSig = false;
}

function getSignatureDataUrl() {
  if (!_sigHasSig) return '';
  const canvas = document.getElementById('sig-canvas');
  return canvas ? canvas.toDataURL('image/png') : '';
}

