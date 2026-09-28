
(function () {
  var D = window.__PAGE, P = window.__PEERS;
  if (!D || D.peers) return;
  if (!P || !P.o) {
    D.peers = [];
    D.peersMissing = true;
    return;
  }
  var bit = {};
  (D.tags || []).forEach(function (t, i) { bit[t.name] = Math.pow(2, i); });
  function span(ys) { return ys && ys.length ? [ys[0], ys[ys.length - 1]] : null; }
  var fin = span(D.years), bd = span(D.boardYears), en = span(D.endowYears);
  function clip(first, values, r) {
    if (first === null || first === undefined || !r) return [null, []];
    var start = Math.max(first, r[0]);
    var end = Math.min(first + values.length - 1, r[1]);
    if (start > end) return [null, []];
    var out = values.slice(start - first, end - first + 1);
    while (out.length && out[out.length - 1] === null) out.pop();
    var lead = 0;
    while (lead < out.length && out[lead] === null) lead++;
    return lead === out.length ? [null, []] : [start + lead, out.slice(lead)];
  }
  var rows = [];
  for (var i = 0; i < P.o.length; i++) {
    if (i === D.peerSelf) continue;
    var p = P.o[i], mask = 0, seen = {};
    for (var k = 0; k < p[0].length; k++) {
      var v = bit[P.tags[p[0][k]]];
      if (v && !seen[v]) { seen[v] = 1; mask += v; }
    }
    var r = clip(p[1], p[2], fin), b = clip(p[3], p[4], bd),
        a = clip(p[5], p[6], fin), l = clip(p[7], p[8], fin),
        e = clip(p[9], p[10], en);
    if (r[0] === null && b[0] === null && a[0] === null &&
        l[0] === null && e[0] === null) continue;
    rows.push([mask, r[0], r[1], b[0], b[1], a[0], a[1], l[0], l[1], e[0], e[1]]);
  }
  D.peers = rows;
})();
