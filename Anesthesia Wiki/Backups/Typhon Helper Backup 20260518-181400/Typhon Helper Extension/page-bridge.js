// Runs in the MAIN world — has access to the page's own jQuery instance.
// Listens for bridge events dispatched by content.js (isolated world) and
// calls jQuery's trigger so chosen.js cosmetically updates its widget.
document.addEventListener('__typhon_chosen_update', function(e) {
  var selId = e && e.detail && e.detail.selId;
  var selName = e && e.detail && e.detail.selName;
  if (!selId && !selName) return;
  try {
    var el = selId ? document.getElementById(selId)
                   : document.querySelector('select[name="' + selName + '"]');
    if (!el) return;
    if (window.jQuery) {
      window.jQuery(el).trigger('chosen:updated');
    }
    if (el.tomselect) {
      el.tomselect.setValue(el.value, true);
    }
  } catch(e2) {}
});
