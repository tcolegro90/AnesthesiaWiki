// ============================================================
// UTILS
// ============================================================
function todayISO() { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso) { if (!iso) return '?'; const [y,m,d] = iso.split('-'); return `${m}/${d}/${y}`; }
function fmtDateLong(iso) {
  if (!iso) return 'Unknown Date';
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
  return `${dow}, ${m}/${d}/${y}`;
}

function monthKey(iso) {
  if (!iso) return 'unknown';
  const [y, m] = iso.split('-');
  return `${y}-${m}`;
}

function fmtMonthYear(key) {
  if (!key || key === 'unknown') return 'Unknown Month';
  const [y, m] = key.split('-');
  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m) - 1] || m;
  return `${monthName} ${y}`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

function updateBadge(items) {
  const n = items.filter(i => !i.submitted && !i.draft).length;
  const b = document.getElementById('badge-count');
  b.textContent = n; b.style.display = n ? 'inline' : 'none';
}

// ============================================================
// TEST PRESETS
// ============================================================
