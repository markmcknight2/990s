
(function () {
  var box = document.getElementById('org-search');
  var list = document.getElementById('org-list');
  var count = document.getElementById('org-count');
  var orgs = window.__ORGS || [];
  var base = list ? (list.getAttribute('data-base') || '') : '';
  var limit = list ? +(list.getAttribute('data-limit') || 0) : 0;
  if (!box || !list) return;
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  var keyed = orgs.map(function (o) { return [norm(o[0]), o]; });
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  function render() {
    var q = norm(box.value), words = q ? q.split(' ') : [];
    var hits = keyed.filter(function (k) {
      return words.every(function (w) { return k[0].indexOf(w) !== -1; });
    });
    var shown = limit && !q ? [] : (limit ? hits.slice(0, limit) : hits);
    list.innerHTML = shown.map(function (k) {
      return '<li><a href="' + base + k[1][1] + '.html">' + esc(k[1][0]) + '</a></li>';
    }).join('');
    if (count) {
      count.textContent = q
        ? hits.length.toLocaleString() + ' of ' + orgs.length.toLocaleString() + ' match'
          + (limit && hits.length > limit ? ' - showing the first ' + limit : '')
        : orgs.length.toLocaleString() + ' organizations';
    }
  }
  box.addEventListener('input', render);
  var q = new URLSearchParams(location.search).get('q') || window.__PREFILL;
  if (q) box.value = q;
  render();
})();
