// ═══════════════════════════════════════════════
//  PRINT LAYOUT EDITOR
// ═══════════════════════════════════════════════
(function(){
'use strict';
// ── Config: sections and their draggable/toggleable row blocks ──
var LC = [
  { id:'ps-patient', label:'👤 Patient Details', rows:[
    { id:'pr-row-age-gen',          label:'Age / Gender'      },
    { id:'pr-row-ht-wt',            label:'Ht / Wt / BMI'    },
    { id:'pr-row-allergies',        label:'Allergies'         },
    { id:'pr-row-pmh',              label:'PMH'               },
    { id:'pr-past-surg-row',        label:'PSH'               },
    { id:'pr-prior-anesthetic-row', label:'Prior Anes'        },
    { id:'pr-row-meds',             label:'Home Meds'         },
    { id:'pr-pregnant-row',         label:'Pregnant'          },
    { id:'pr-fasted-row',           label:'Fasted'            },
    { id:'pr-interpreter-row',      label:'Interpreter'       },
    { id:'pr-hearing-row',          label:'Hearing Loss'      },
    { id:'pr-pacer-row',            label:'Device'            },
    { id:'pr-row-labs',            label:'Labs (BMP/CBC/Coags)' },
    { id:'pr-lab-a1c-row',         label:'A1C'                  },
    { id:'pr-lab-alb-row',         label:'Albumin'              },
    { id:'pr-lab-ast-row',         label:'AST'                  },
    { id:'pr-lab-alt-row',         label:'ALT'                  },
    { id:'pr-lab-ca-row',          label:'Ca'                   },
    { id:'pr-lab-ica-row',         label:'iCa'                  },
    { id:'pr-lab-ts-date-row',     label:'T+S Date'             },
    { id:'pr-gas-row',             label:'Gas'                  },
  ]},
  { id:'ps-preop', label:'🫁 Preop & Airway', rows:[
    { id:'pr-row-procedure',       label:'Procedure'            },
    { id:'pr-extra-surg-row',      label:'Additional Surg'      },
    { id:'pr-row-position',        label:'Positioning'          },
    { id:'pr-row-insufflation',    label:'Insufflation'         },
    { id:'pr-obtain-ts-row',       label:'Obtain T+S'           },
    { id:'pr-blood-room-row',      label:'Blood in Room'        },
    { id:'pr-row-asa',             label:'ASA Class'            },
    { id:'pr-row-nerve-stim',      label:'Nerve Stim'           },
    { id:'pr-antibiotic-plan-row', label:'Antibiotic'           },
    { id:'pr-mets-row',            label:'METs'                 },
    { id:'pr-row-awareness',       label:'Alert: Awareness Hx'  },
    { id:'pr-row-famhx',           label:'Alert: Fam Hx'        },
    { id:'pr-row-mh',              label:'Alert: Mal. Hyperthermia' },
    { id:'pr-row-pseudo',          label:'Alert: PChE Def'      },
    { id:'pr-row-airway-exam',     label:'Airway Exam'          },
  ]},
  { id:'ps-plan', label:'💉 Anesthetic Plan', rows:[
    { id:'pr-row-anes-type',  label:'Anes Type'        },
    { id:'pr-tiva-row',       label:'TIVA Reason'       },
    { id:'pr-row-ga-details', label:'GA Details & Meds' },
  ]},
  { id:'ps-misc', label:'📋 Miscellaneous', rows:[
    { id:'pr-row-equipment',                 label:'Equipment'                 },
    { id:'pr-row-fluids',                    label:'Fluids'                    },
    { id:'pr-notes-section',                 label:'Notes'                     },
  ]},
];

// ── State ──────────────────────────────────────────────────────
// Default column widths matching the existing print card exactly
var LS_DEFAULTS = {
  sectionOrder: LC.map(function(s){ return s.id; }),
  rowOrders: (function(){
    var o = {};
    LC.forEach(function(s){ o[s.id] = s.rows.map(function(r){ return r.id; }); });
    return o;
  })(),
  hiddenRows: {},
  hiddenSections: {},
  orientation: 'portrait',
  pageSize: 'card',
  // top row: 50/50. bottom row: 56/44 (matching 1.12fr / 0.88fr)
  colWidths: { top: 50, bottom: 56 },
};

var LS = JSON.parse(JSON.stringify(LS_DEFAULTS));
var lepOpen = false;
var _sort = {};

// ── Apply layout to actual print DOM ──────────────────────────
function applyLayout() {
  LC.forEach(function(sec) {
    var secEl = document.getElementById(sec.id);
    if (!secEl) return;
    if (LS.hiddenSections[sec.id]) {
      secEl.classList.add('layout-hidden');
    } else {
      secEl.classList.remove('layout-hidden');
      // Reorder direct-child rows in the section
      var order = LS.rowOrders[sec.id] || sec.rows.map(function(r){ return r.id; });
      order.forEach(function(rowId) {
        var rowEl = document.getElementById(rowId);
        if (rowEl && rowEl.parentElement === secEl) secEl.appendChild(rowEl);
      });
      // Show/hide each row
      sec.rows.forEach(function(row) {
        var rowEl = document.getElementById(row.id);
        if (!rowEl) return;
        if (LS.hiddenRows[row.id]) rowEl.classList.add('layout-hidden');
        else rowEl.classList.remove('layout-hidden');
      });
    }
  });
  // Section reordering in the print grid
  var grid = document.getElementById('print-grid-inner');
  if (grid) {
    var bottomRow = grid.querySelector('.print-bottom-row');
    var topOrder = LS.sectionOrder.filter(function(id){ return id==='ps-patient'||id==='ps-preop'; });
    topOrder.forEach(function(secId) {
      var el = document.getElementById(secId);
      if (el && el.parentElement === grid) {
        if (bottomRow) grid.insertBefore(el, bottomRow); else grid.appendChild(el);
      }
    });
    if (bottomRow) {
      var botOrder = LS.sectionOrder.filter(function(id){ return id==='ps-plan'||id==='ps-misc'; });
      botOrder.forEach(function(secId) {
        var el = document.getElementById(secId);
        if (el && el.parentElement === bottomRow) bottomRow.appendChild(el);
      });
    }
  }
  // Orientation
  var pc = document.getElementById('print-container');
  if (pc) {
    pc.classList.toggle('layout-landscape', LS.orientation === 'landscape');
    pc.classList.toggle('layout-portrait',  LS.orientation === 'portrait');
    // Page size
    ['lps-card','lps-half','lps-full','lps-phone'].forEach(function(c){ pc.classList.remove(c); });
    if (LS.pageSize !== 'card') pc.classList.add('lps-' + LS.pageSize);
  }
  // Column widths — skip inline grid styles in phone mode (CSS handles single-col layout)
  var grid = document.getElementById('print-grid-inner');
  if (grid) {
    var br = grid.querySelector('.print-bottom-row');
    if (LS.pageSize === 'phone') {
      grid.style.gridTemplateColumns = '';
      if (br) br.style.gridTemplateColumns = '';
    } else {
      var topPct = LS.colWidths.top;
      grid.style.gridTemplateColumns = topPct + 'fr ' + (100 - topPct) + 'fr';
      if (br) {
        var botPct = LS.colWidths.bottom;
        br.style.gridTemplateColumns = botPct + 'fr ' + (100 - botPct) + 'fr';
      }
    }
  }
}

// ── Build split-screen editor panel ──────────────────────────
function buildPanel() {
  var body = document.getElementById('layout-panel-body');
  if (!body) return;
  var topW = LS.colWidths.top;
  var botW = LS.colWidths.bottom;
  var sizes = [
    { id:'card',  label:'Card',       desc:'3.95" × 5.5"'  },
    { id:'half',  label:'½ Sheet',    desc:'5.5" × 8.5"'   },
    { id:'full',  label:'Full Sheet', desc:'7.5" × 10"'    },
    { id:'phone', label:'Phone',      desc:'Narrow col'    },
  ];
  var html = '<div class="lep-group-title">Page Size</div>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">' +
    sizes.map(function(sz){
      return '<button class="lep-orient-btn' + (LS.pageSize===sz.id?' active':'') + '" ' +
        'title="' + sz.desc + '" onclick="layoutSetPageSize(\'' + sz.id + '\')">' + sz.label + '</button>';
    }).join('') + '</div>' +
    '<div class="lep-group-title">Orientation</div>' +
    '<div class="lep-orientation-row">' +
    '<button class="lep-orient-btn' + (LS.orientation==='portrait'?' active':'') + '" onclick="layoutSetOrientation(\'portrait\')">&#9723; Portrait</button>' +
    '<button class="lep-orient-btn' + (LS.orientation==='landscape'?' active':'') + '" onclick="layoutSetOrientation(\'landscape\')">&#11035; Landscape</button>' +
    '</div>' +
    '<div class="lep-group-title" style="margin-top:12px;">Column Widths</div>' +
    '<div style="font-size:0.73rem;color:#445;margin-bottom:3px;">Top row — left ' + topW + '% / right ' + (100-topW) + '%</div>' +
    '<input type="range" min="25" max="75" value="' + topW + '" id="lep-slider-top" oninput="layoutSetColWidth(\'top\',+this.value)" style="width:100%;margin-bottom:10px;accent-color:#0d6e6e;">' +
    '<div style="font-size:0.73rem;color:#445;margin-bottom:3px;">Bottom row — left ' + botW + '% / right ' + (100-botW) + '%</div>' +
    '<input type="range" min="25" max="75" value="' + botW + '" id="lep-slider-bot" oninput="layoutSetColWidth(\'bottom\',+this.value)" style="width:100%;margin-bottom:4px;accent-color:#0d6e6e;">' +
    '<div class="lep-group-title" style="margin-top:12px;">Sections &amp; Rows</div>' +
    '<div id="lep-sec-list">';

  LS.sectionOrder.forEach(function(secId) {
    var sec = LC.find(function(s){ return s.id===secId; });
    if (!sec) return;
    var secHidden = !!LS.hiddenSections[secId];
    var rowOrder  = LS.rowOrders[secId] || sec.rows.map(function(r){ return r.id; });
    html += '<div class="lep-sec-item" data-sec-id="' + secId + '">' +
      '<div class="lep-sec-head" onclick="this.closest(\'.lep-sec-item\').classList.toggle(\'expanded\')">' +
      '<span class="lep-drag" title="Drag to reorder section">⠿</span>' +
      '<label class="lep-tgl" onclick="event.stopPropagation()">' +
      '<input type="checkbox"' + (secHidden?'':' checked') + ' onchange="layoutToggleSection(\'' + secId + '\',this.checked)">' +
      '<span class="lep-tgl-track"></span></label>' +
      '<span class="lep-sec-label">' + sec.label + '</span>' +
      '<span class="lep-arrow">▶</span></div>' +
      '<div class="lep-sec-body"><div class="lep-row-list" data-sec-id="' + secId + '">';

    rowOrder.forEach(function(rowId) {
      var row = sec.rows.find(function(r){ return r.id===rowId; });
      if (!row) return;
      var hidden = !!LS.hiddenRows[rowId];
      html += '<div class="lep-row-item" data-row-id="' + rowId + '">' +
        '<span class="lep-row-drag" title="Drag to reorder">⠿</span>' +
        '<span class="lep-row-label">' + row.label + '</span>' +
        '<label class="lep-tgl"><input type="checkbox"' + (hidden?'':' checked') + ' onchange="layoutToggleRow(\'' + rowId + '\',this.checked)"><span class="lep-tgl-track"></span></label>' +
        '</div>';
    });
    html += '</div></div></div>';
  });
  html += '</div>';
  body.innerHTML = html;

  // SortableJS: sections
  if (_sort.secs) { _sort.secs.destroy(); _sort.secs = null; }
  var secList = document.getElementById('lep-sec-list');
  if (secList && window.Sortable) {
    _sort.secs = Sortable.create(secList, {
      handle: '.lep-drag', animation: 150,
      onEnd: function() {
        LS.sectionOrder = Array.from(secList.querySelectorAll('[data-sec-id]')).map(function(e){ return e.dataset.secId; });
        _lsDirty = true;
        applyLayout();
      }
    });
  }
  // SortableJS: rows within each section
  document.querySelectorAll('.lep-row-list').forEach(function(list) {
    var sid = list.dataset.secId;
    var key = 'r_' + sid;
    if (_sort[key]) { _sort[key].destroy(); _sort[key] = null; }
    if (window.Sortable) {
      _sort[key] = Sortable.create(list, {
        handle: '.lep-row-drag', animation: 150,
        onEnd: function() {
          LS.rowOrders[sid] = Array.from(list.querySelectorAll('[data-row-id]')).map(function(e){ return e.dataset.rowId; });
          _lsDirty = true;
          applyLayout();
        }
      });
    }
  });
}

// ── Public API ────────────────────────────────────────────────
window.toggleLayoutEditor = function() {
  lepOpen = !lepOpen;
  var panel = document.getElementById('layout-editor-panel');
  var wrap  = document.getElementById('layout-split-wrap');
  var btn   = document.getElementById('btn-layout-edit');
  if (!panel || !wrap) return;
  if (lepOpen) {
    wrap.classList.add('le-open');
    if (btn) btn.textContent = '✕ Close Layout';
    // Auto-load default template
    var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
    if (db) {
      db.collection('printLayoutTemplates').doc('__default__').get().then(function(doc) {
        if (doc.exists) {
          var d = doc.data();
          LS.sectionOrder = d.sectionOrder || LS_DEFAULTS.sectionOrder.slice();
          LS.rowOrders = d.rowOrders || JSON.parse(JSON.stringify(LS_DEFAULTS.rowOrders));
          LS.hiddenRows = {};
          (d.hiddenRows || []).forEach(function(id){ LS.hiddenRows[id] = true; });
          LS.hiddenSections = {};
          (d.hiddenSections || []).forEach(function(id){ LS.hiddenSections[id] = true; });
          LS.orientation = d.orientation || 'portrait';
          LS.pageSize = d.pageSize || 'card';
          LS.colWidths = d.colWidths || JSON.parse(JSON.stringify(LS_DEFAULTS.colWidths));
          applyLayout();
        }
        buildPanel();
      }).catch(function(){ buildPanel(); });
    } else {
      buildPanel();
    }
  } else {
    if (_lsDirty && !confirm('You have unsaved layout changes. Close without saving?')) return;
    wrap.classList.remove('le-open');
    if (btn) btn.textContent = 'Edit Layout';
  }
};

var _lsDirty = false;

window.addEventListener('beforeunload', function(e) {
  if (_lsDirty) {
    e.preventDefault();
    e.returnValue = 'You have unsaved layout changes. Leave without saving?';
  }
});

window.layoutToggleSection = function(secId, visible) {
  LS.hiddenSections[secId] = !visible;
  _lsDirty = true;
  applyLayout();
};

window.layoutToggleRow = function(rowId, visible) {
  LS.hiddenRows[rowId] = !visible;
  _lsDirty = true;
  applyLayout();
};

window.layoutSetOrientation = function(orientation) {
  LS.orientation = orientation;
  _lsDirty = true;
  applyLayout();
  buildPanel();
};

window.layoutSetPageSize = function(size) {
  LS.pageSize = size;
  _lsDirty = true;
  applyLayout();
  buildPanel();
};

window.layoutSetColWidth = function(which, val) {
  LS.colWidths[which] = val;
  // Update the sibling label without full rebuild
  var key = which === 'top' ? 'lep-slider-top' : 'lep-slider-bot';
  var slider = document.getElementById(key);
  if (slider) {
    var lbl = slider.previousElementSibling;
    if (lbl) {
      var side = which === 'top' ? 'Top row' : 'Bottom row';
      lbl.textContent = side + ' — left ' + val + '% / right ' + (100-val) + '%';
    }
  }
  _lsDirty = true;
  applyLayout();
};

window.layoutResetAll = function() {
  LS = JSON.parse(JSON.stringify(LS_DEFAULTS));
  _lsDirty = false;
  applyLayout();
  buildPanel();
};

window.layoutSaveTemplate = function() {
  var name = prompt('Template name:');
  if (!name) return;
  var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
  if (!db) { alert('Firebase not available'); return; }
  var rowOrdersPlain = {};
  Object.keys(LS.rowOrders).forEach(function(k){ rowOrdersPlain[k] = LS.rowOrders[k]; });
  var payload = {
    sectionOrder: LS.sectionOrder,
    rowOrders: rowOrdersPlain,
    hiddenRows: Object.keys(LS.hiddenRows).filter(function(k){ return LS.hiddenRows[k]; }),
    hiddenSections: Object.keys(LS.hiddenSections).filter(function(k){ return LS.hiddenSections[k]; }),
    orientation: LS.orientation,
    pageSize: LS.pageSize,
    colWidths: LS.colWidths,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  db.collection('printLayoutTemplates').doc(name).set(payload).then(function() {
    _lsDirty = false;
    var st = document.getElementById('layout-save-status');
    if (st) { st.textContent = '✔ Saved "' + name + '"'; setTimeout(function(){ st.textContent = ''; }, 2500); }
  }).catch(function(err) { alert('Save failed: ' + err.message); });
};

window.layoutSetDefault = function() {
  var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
  if (!db) { alert('Firebase not available'); return; }
  var rowOrdersPlain = {};
  Object.keys(LS.rowOrders).forEach(function(k){ rowOrdersPlain[k] = LS.rowOrders[k]; });
  db.collection('printLayoutTemplates').doc('__default__').set({
    sectionOrder: LS.sectionOrder,
    rowOrders: rowOrdersPlain,
    hiddenRows: Object.keys(LS.hiddenRows).filter(function(k){ return LS.hiddenRows[k]; }),
    hiddenSections: Object.keys(LS.hiddenSections).filter(function(k){ return LS.hiddenSections[k]; }),
    orientation: LS.orientation,
    pageSize: LS.pageSize,
    colWidths: LS.colWidths,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(function() {
    _lsDirty = false;
    var st = document.getElementById('layout-save-status');
    if (st) { st.textContent = '⭐ Default saved!'; setTimeout(function(){ st.textContent = ''; }, 2500); }
  }).catch(function(err) { alert('Save failed: ' + err.message); });
};

window.layoutLoadTemplates = function() {
  var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
  if (!db) return;
  var sel = document.getElementById('layout-template-select');
  if (!sel) return;
  db.collection('printLayoutTemplates').get().then(function(snap) {
    sel.innerHTML = '<option value="">— Template —</option>';
    snap.forEach(function(doc) {
      var opt = document.createElement('option');
      opt.value = doc.id; opt.textContent = doc.id;
      sel.appendChild(opt);
    });
  });
};

window.layoutApplyTemplate = function() {
  var sel = document.getElementById('layout-template-select');
  var name = sel && sel.value;
  if (!name) return;
  var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
  if (!db) return;
  db.collection('printLayoutTemplates').doc(name).get().then(function(doc) {
    if (!doc.exists) { alert('Template not found'); return; }
    var d = doc.data();
    LS.sectionOrder = d.sectionOrder || LC.map(function(s){ return s.id; });
    LS.rowOrders = d.rowOrders || (function(){
      var o = {}; LC.forEach(function(s){ o[s.id] = s.rows.map(function(r){ return r.id; }); }); return o;
    })();
    LS.hiddenRows = {};
    (d.hiddenRows || []).forEach(function(id){ LS.hiddenRows[id] = true; });
    LS.hiddenSections = {};
    (d.hiddenSections || []).forEach(function(id){ LS.hiddenSections[id] = true; });
    LS.orientation = d.orientation || 'portrait';
    LS.pageSize = d.pageSize || 'card';
    LS.colWidths = d.colWidths || JSON.parse(JSON.stringify(LS_DEFAULTS.colWidths));
    _lsDirty = false;
    applyLayout();
    buildPanel();
  });
};

})();
