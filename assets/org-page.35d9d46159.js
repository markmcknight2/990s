
(function () {
  var money = function (v) {
    if (v == null) return '—';
    var s = v < 0 ? '-' : '', a = Math.abs(v);
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return s + '$' + Math.round(a / 1e3).toLocaleString() + 'k';
    return s + '$' + Math.round(a).toLocaleString();
  };
  var exact = function (v) {
    if (v == null) return '—';
    return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString();
  };
  var count = function (v) { return v == null ? '—' : Math.round(v).toLocaleString(); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };

  function median(vals) {
    var s = vals.filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* ---- tooltip ---------------------------------------------------------- */
  /* One element for the whole page. Hover shows it, click pins it so a figure
     can be read without holding the mouse still, and on a touch screen a tap is
     the only gesture available. */
  var tip = document.createElement('div');
  tip.className = 'ttip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip);
  var pinned = false;

  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    var top = y - h - 14;
    if (top < 8) top = y + 18;
    tip.style.left = (left + window.scrollX) + 'px';
    tip.style.top = (top + window.scrollY) + 'px';
  }
  function hideTip(force) { if (force || !pinned) { tip.style.display = 'none'; pinned = false; } }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-tip]')) hideTip(true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(true); });

  function wire(node, html) {
    node.setAttribute('data-tip', '1');
    node.addEventListener('mouseenter', function (e) { if (!pinned) showTip(html, e.clientX, e.clientY); });
    node.addEventListener('mousemove', function (e) { if (!pinned) showTip(html, e.clientX, e.clientY); });
    node.addEventListener('mouseleave', function () { hideTip(false); });
    node.addEventListener('click', function (e) {
      e.stopPropagation(); pinned = false; showTip(html, e.clientX, e.clientY); pinned = true;
    });
  }


  /* ---- declared, unfiled figures ---------------------------------------- */
  /* Drawn as their own dotted series, never appended to the 990 line. The two
     are not on the same basis - an audit puts unrealized investment gain in
     revenue and a 990 does not - so a continuous line would assert a trend
     that is partly an artefact of the basis changing. Hollow dots and an
     explicit "Draft, not a 990" legend entry, so the distinction survives
     someone screenshotting the chart. */
  function hasDraft() {
    return (D.draftYears || []).length > 0;
  }
  function draftSeries(name, values, color, filed, notes) {
    if (!values || !values.some(function (v) { return v != null; })) return [];
    /* Bridge the gap: copy the last filed value into the draft array so the run
       has two points and a dotted segment appears, instead of one lone dot
       floating past the end of the line with nothing to read it against. The
       copied index is reported as `from` so it draws no marker. */
    var bridged = values.slice();
    var first = values.findIndex(function (v) { return v != null; });
    var from = -1;
    if (filed && first > 0) {
      for (var j = first - 1; j >= 0; j--) {
        if (filed[j] != null) { bridged[j] = filed[j]; from = j; break; }
      }
    }
    return [{ label: name + ' (not a 990)', values: bridged,
              color: color, dot: 2.6, hollow: true, dash: true, weight: 1.5,
              from: from, notes: winVals(D.years, notes) }];
  }

  function draftBars(name, values, color, slotAs, notes) {
    if (!values || !values.some(function (v) { return v != null; })) return [];
    return [{ label: name + ' (not a 990)', values: values, kind: 'bar',
              color: color, hatch: true, slotAs: slotAs,
              notes: winVals(D.years, notes) }];
  }


  /* ---- year window ------------------------------------------------------ */
  /* Which slice of the axis is on screen. Applied to every time-series chart,
     each clamped to the years it actually has, so a chart with a shorter
     history is narrowed rather than padded with blanks.

     Medians survive this untouched: medianLine keys off absolute years, and the
     median for a year is computed from the cohort reporting THAT year, not from
     the years on either side of it. So narrowing the window hides years, it
     never silently changes a figure - which is the property that makes this
     safe to ship on a page an audit committee reads. */
  var yrFrom = null, yrTo = null;

  function inWin(y) {
    return (yrFrom == null || y >= yrFrom) && (yrTo == null || y <= yrTo);
  }
  function winYears(all) { return (all || []).filter(inWin); }
  function winVals(all, vals) {
    var out = [];
    (all || []).forEach(function (y, i) { if (inWin(y)) out.push(vals ? vals[i] : null); });
    return out;
  }
  /* A chart built server-side carries its own 'FYnnnn' labels rather than a year
     array, so the years are read back off them. A chart whose labels are not
     years is left exactly as it is. */
  function winSpec(c) {
    var ys = (c.labels || []).map(function (l) {
      var m = /FY(\d{4})/.exec(l); return m ? +m[1] : null; });
    if (!ys.length || ys.some(function (y) { return y == null; })) return c;
    var keep = [];
    ys.forEach(function (y, i) { if (inWin(y)) keep.push(i); });
    if (keep.length === ys.length) return c;
    var pick = function (a) {
      return Array.isArray(a) ? keep.map(function (i) { return a[i]; }) : a; };
    var out = {}, k;
    for (k in c) out[k] = c[k];
    out.labels = pick(c.labels);
    out.series = (c.series || []).map(function (s) {
      var o = {}, kk;
      for (kk in s) o[kk] = s[kk];
      o.values = pick(s.values);
      o.colors = pick(s.colors);
      if (s.notes && !Array.isArray(s.notes)) {
        // notes arrive as an object keyed by index; the indices move, so remap
        // rather than slice, or a note ends up attached to the wrong year.
        var nn = {};
        keep.forEach(function (old, now) {
          if (s.notes[old] != null) nn[now] = s.notes[old]; });
        o.notes = nn;
      } else { o.notes = pick(s.notes); }
      return o;
    });
    return out;
  }

  function wireYearControl() {
    var box = document.querySelector('.yrctl');
    /* No control is normal: it is only emitted for an axis worth narrowing.
       The charts still have to be drawn. This function owns the first draw
       because it has to set the window before drawing, and forgetting the
       no-control path left every organization with fewer than three years
       showing empty panels - the charts never ran at all. */
    if (!box) { fixed(); render(); return; }
    var from = document.getElementById('yr-from');
    var to = document.getElementById('yr-to');
    var now = document.getElementById('yr-now');
    var all = D.years || [];
    if (!all.length) return;
    from.value = all[0]; to.value = all[all.length - 1];

    function say() {
      var lo = yrFrom == null ? all[0] : yrFrom;
      var hi = yrTo == null ? all[all.length - 1] : yrTo;
      var n = all.filter(inWin).length;
      var txt = n + (n === 1 ? ' year' : ' years') + ' · FY' + lo + '–FY' + hi;
      /* If a declared year is out of view while its caveat panel is still on
         the page, say so. The panel quotes figures the chart is not showing,
         and a reader scrolling between the two would otherwise just see them
         disagree. */
      var hidden = (D.draftYears || []).filter(function (y) { return !inWin(y); });
      if (hidden.length)
        txt += ' · FY' + hidden.join(', FY') +
               (hidden.length === 1 ? ' is' : ' are') +
               ' outside this range, so the figures noted above are not plotted';
      now.innerHTML = hidden.length
        ? '<span class="warn">' + esc(txt) + '</span>' : esc(txt);
    }

    function apply(lo, hi) {
      yrFrom = lo; yrTo = hi;
      from.value = lo == null ? all[0] : lo;
      to.value = hi == null ? all[all.length - 1] : hi;
      box.querySelectorAll('button').forEach(function (b) {
        var span = b.getAttribute('data-span');
        var on = span === 'all'
          ? (yrFrom == null && yrTo == null)
          : (yrTo === all[all.length - 1] &&
             yrFrom === all[Math.max(0, all.length - (+span))]);
        b.classList.toggle('on', !!on);
      });
      say();
      // fixed() too, not just render(): the server-built charts (endowment
      // spending) are drawn by fixed(), which otherwise runs once at boot and
      // would keep showing the full history while every other chart narrowed.
      fixed(); render();
    }

    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var span = b.getAttribute('data-span');
        if (span === 'all') return apply(null, null);
        apply(all[Math.max(0, all.length - (+span))], all[all.length - 1]);
      });
    });
    function fromSelects() {
      var lo = +from.value, hi = +to.value;
      // Reversing the two is a slip, not a request for an empty chart.
      if (lo > hi) { var t = lo; lo = hi; hi = t; }
      apply(lo, hi);
    }
    from.addEventListener('change', fromSelects);
    to.addEventListener('change', fromSelects);
    apply(null, null);
  }

  /* ---- chart ------------------------------------------------------------ */
  /* Gridlines and axis labels come from CSS rather than being baked in, so the
     one renderer serves both themes. Read at draw time, not once at load, or a
     theme switch would leave the charts in the old palette. */
  function tok(name, fallback) {
    var v = getComputedStyle(document.documentElement)
              .getPropertyValue('--' + name).trim();
    return v || fallback;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  var patternSeq = 0;   // ids must be unique across every chart on the page
  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }

  function draw(host, spec) {
    host.innerHTML = '';
    var labels = spec.labels, series = spec.series;
    var fmt = spec.fmt === 'count' ? count : money;
    var exactFmt = spec.fmt === 'count' ? count : exact;
    var right = series.filter(function (s) { return s.right; });
    /* A wide chart gets a wider viewBox rather than just being stretched by
       CSS. Stretching scales the type with it, so a full-width panel would
       render 10px axis labels at 20px; widening the canvas instead keeps the
       type at its intended size and spends the extra width on the plot, which
       is the whole reason for going full width. */
    /* 70% of the page rather than the full width: the same vertical range
       drawn across less horizontal distance makes a trend read more steeply,
       which is the point of the narrower canvas. Sized so one viewBox unit is
       about one rendered pixel, so stroke weights and type come out exactly as
       specified rather than being scaled up by CSS. */
    var W = spec.wide ? 770 : 540, H = spec.wide ? 250 : 210;
    var padL = spec.wide ? 60 : 52, padR = right.length ? 46 : 8;
    var padT = 10, padB = spec.wide ? 30 : 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    function scaleOf(members) {
      var vals = [];
      members.forEach(function (s) {
        s.values.forEach(function (v) { if (v != null) vals.push(v); });
      });
      if (!vals.length) return null;
      var hi = Math.max.apply(null, vals.concat([0]));
      var lo = Math.min.apply(null, vals.concat([0]));
      return [lo, hi === lo ? lo + 1 : hi];
    }
    var leftScale = scaleOf(series.filter(function (s) { return !s.right; }));
    var rightScale = scaleOf(right);
    if (!leftScale && !rightScale) {
      host.innerHTML = '<p class="opf-empty">Nothing to plot.</p>'; return;
    }
    if (!leftScale) leftScale = rightScale;
    var lo = leftScale[0], hi = leftScale[1], span = hi - lo;

    function yOn(v, b) { return padT + plotH - (v - b[0]) / ((b[1] - b[0]) || 1) * plotH; }
    var n = labels.length, step = plotW / Math.max(n, 1);
    function xAt(i) { return padL + step * (i + 0.5); }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ochart',
                          preserveAspectRatio: 'xMidYMid meet', role: 'img' });

    for (var k = 0; k < 5; k++) {
      var v = lo + span * k / 4, y = yOn(v, leftScale);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y,
                                   stroke: tok('grid', '#eef2f6'), 'stroke-width': 1 }));
      var t = el('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', class: 'ax' });
      t.textContent = fmt(v); svg.appendChild(t);
    }
    if (lo < 0 && hi > 0) svg.appendChild(el('line', {
      x1: padL, y1: yOn(0, leftScale), x2: W - padR, y2: yOn(0, leftScale),
      stroke: tok('line', '#cbd5e1'), 'stroke-width': 1 }));
    if (rightScale) {
      for (var k2 = 0; k2 < 5; k2++) {
        var rv = rightScale[0] + (rightScale[1] - rightScale[0]) * k2 / 4;
        var rt = el('text', { x: W - padR + 6, y: yOn(rv, rightScale) + 3,
                              fill: right[0].color, class: 'ax' });
        rt.textContent = (spec.rightFmt === 'pct') ? rv.toFixed(1) + '%' : fmt(rv);
        svg.appendChild(rt);
      }
    }

    var bars = series.filter(function (s) { return s.kind === 'bar'; });
    /* Slot positions are explicit, not just the series index. A draft bar sits
       in the SAME slot as the filed bar for the same measure - the two never
       occupy the same year, so they cannot collide - and without this, adding
       two draft series would divide the slot four ways and make every bar in
       every year thinner than before. */
    var slotOf = bars.map(function (s, i) {
      return s.slotAs != null ? s.slotAs : i; });
    var slotCount = bars.length ? Math.max.apply(null, slotOf) + 1 : 1;
    var defs = null;
    bars.forEach(function (s, bi) {
      var slot = step * 0.72 / Math.max(slotCount, 1);
      /* Hatching rather than a tint for a bar that is not from a 990: a tint
         reads as "same thing, less of it", and unlike opacity a rule survives
         being printed in black and white.

         The stripes lighten the bar's own colour rather than cutting through it
         to the page. Bar-coloured ground, white at low opacity for the rule, so
         the mark reads as the same measure in a provisional state instead of a
         different measure - and because it lightens whatever colour it is given,
         one pattern serves assets and liabilities and both themes. */
      var fillRef = null;
      if (s.hatch) {
        if (!defs) { defs = el('defs', {}); svg.appendChild(defs); }
        var pid = 'hx' + (patternSeq++);
        var pat = el('pattern', { id: pid, patternUnits: 'userSpaceOnUse',
                                  width: 5, height: 5,
                                  patternTransform: 'rotate(45)' });
        pat.appendChild(el('rect', { width: 5, height: 5, fill: s.color + 'cc' }));
        pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 5,
                                     stroke: '#ffffff', 'stroke-opacity': 0.42,
                                     'stroke-width': 1.8 }));
        defs.appendChild(pat);
        fillRef = 'url(#' + pid + ')';
      }
      s.values.forEach(function (v, i) {
        if (v == null) return;
        var x = xAt(i) - step * 0.36 + slot * slotOf[bi];
        var top = Math.min(yOn(v, leftScale), yOn(0, leftScale));
        var base = Math.max(yOn(v, leftScale), yOn(0, leftScale));
        var colour = s.colors ? s.colors[i] : s.color;
        var r = el('rect', { x: x, y: top, width: slot * 0.92,
                             height: Math.max(base - top, 0.5),
                             fill: fillRef || (colour + 'cc'),
                             stroke: colour,
                             'stroke-width': 0.5, class: 'hit' });
        wire(r, '<b>' + esc(labels[i]) + '</b><span>' + esc(s.label) + ': ' +
                exactFmt(v) + '</span>' + (((s.notes && s.notes[i]) || s.tipNote) ?
                '<span class="n">' + esc((s.notes && s.notes[i]) || s.tipNote) +
                '</span>' : ''));
        svg.appendChild(r);
      });
    });

    series.filter(function (s) { return s.kind !== 'bar'; }).forEach(function (s) {
      var b = (s.right && rightScale) ? rightScale : leftScale;
      var runs = [], cur = null;
      s.values.forEach(function (v, i) {
        if (v == null) { cur = null; return; }
        if (!cur) { cur = []; runs.push(cur); }
        cur.push([xAt(i), yOn(v, b)]);
      });
      runs.forEach(function (run) {
        if (run.length === 1) {
          svg.appendChild(el('path', {
            d: 'M ' + (run[0][0] - 4) + ' ' + run[0][1] + ' L ' + (run[0][0] + 4) + ' ' + run[0][1],
            fill: 'none', stroke: s.color, 'stroke-width': s.weight || 2 }));
          return;
        }
        svg.appendChild(el('path', {
          d: 'M ' + run.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L '),
          fill: 'none', stroke: s.color, 'stroke-width': s.weight || 2,
          'stroke-linejoin': 'round',
          'stroke-dasharray': s.dash ? '5 4' : null }));
      });
      // Every point gets a hit target, including on the dashed cohort line,
      // which under the old static pages had no marker and so could not be
      // interrogated at all.
      s.values.forEach(function (v, i) {
        if (v == null) return;
        /* The draft series carries the previous filed year as well, purely so
           there are two points to draw a dotted connector between. That year
           is already drawn and labelled by the filed series, so it gets no
           second marker and no second tooltip here - two tooltips on one point,
           one of them calling a filed figure a draft, would be worse than no
           connector at all. */
        if (i === s.from) return;
        var cx = xAt(i), cy = yOn(v, b);
        var hit = el('circle', { cx: cx, cy: cy, r: 10, fill: 'transparent', class: 'hit' });
        var shown = s.right && spec.rightFmt === 'pct'
          ? v.toFixed(2) + '%' : exactFmt(v);
        var extra = (s.notes && s.notes[i]) || s.tipNote || '';
        wire(hit, '<b>' + esc(labels[i]) + '</b><span>' + esc(s.label) + ': ' + shown +
             '</span>' + (extra ? '<span class="n">' + esc(extra) + '</span>' : ''));
        svg.appendChild(hit);
        // Hollow marks the declared-but-unfiled points: a ring rather than a
        // filled dot, so it reads as provisional even in print or a screenshot.
        // Sized to match the filled dots exactly, not to stand out - the stroke
        // straddles the path, so the radius is pulled in by half the stroke
        // width to keep the OUTER edge on the same circle a filled dot fills.
        // An oversized ring drew the eye to the one point on the chart that
        // deserves the least confidence.
        var rr = s.dot || (s.dash ? 0 : 2.6);
        // A series that asked for no marker keeps none. Clamping to a floor
        // here put a 0.4px dot on every cohort median line, which had always
        // been a bare dashed line.
        if (!rr) return;
        var sw = s.hollow ? 1.2 : 0;
        svg.appendChild(el('circle', { cx: cx, cy: cy, r: Math.max(rr - sw / 2, 0.4),
                                       fill: s.hollow ? tok('card', '#fff') : s.color,
                                       stroke: s.hollow ? s.color : 'none',
                                       'stroke-width': sw,
                                       'pointer-events': 'none' }));
      });
    });

    /* Spacing comes from how wide a label actually is against how much room a
       year gets, not from a fixed fraction of the series length. `n / 8` put
       FY2025 and FY2026 on top of each other as soon as the axis reached 16
       years: it chose every-2nd, and the final label is always force-drawn, so
       index 14 and index 15 both appeared 30px apart.

       Hence the second condition. A regular label inside one interval of the
       end is dropped, because the last one is coming and would collide with
       it. */
    var LABEL_W = 34;          // 'FY26' at 13px, plus breathing room
    var every = Math.max(1, Math.ceil(LABEL_W / step));
    labels.forEach(function (label, i) {
      var last = i === n - 1;
      if (!last && (i % every !== 0 || (n - 1 - i) < every)) return;
      var t = el('text', { x: xAt(i), y: H - 8, 'text-anchor': 'middle', class: 'ax' });
      /* Abbreviated on the axis only. `labels` stays 'FY2018' everywhere else,
         because the tooltips read from it and so does the year-window filter -
         shortening at the source would have put 'FY18' in both. */
      t.textContent = label.replace(/^FY\d{2}(\d{2})$/, 'FY$1');
      svg.appendChild(t);
    });
    host.appendChild(svg);
  }

  function legend(host, entries) {
    host.innerHTML = entries.map(function (e) {
      /* The draft swatches have to look like the marks they stand for, or the
         key stops being a key: a ring for the hollow dots, diagonal rule for
         the hatched bars. */
      var style = 'background:' + e[0];
      if (e[2] === 'dot') style = 'border-radius:50%;background:' + e[0];
      else if (e[2] === 'ring')
        style = 'border-radius:50%;background:' + tok('card', '#fff') +
                ';box-shadow:inset 0 0 0 2px ' + e[0];
      else if (e[2] === 'hatch')
        style = 'background:repeating-linear-gradient(45deg,' + e[0] +
                ' 0 2px,rgba(255,255,255,.55) 2px 4px);outline:1px solid ' + e[0];
      return '<span><i style="' + style + '"></i>' + esc(e[1]) + '</span>';
    }).join('');
  }

  /* ---- cohort ----------------------------------------------------------- */
  /* Peers are stored once as [tagMask, firstRevYear, [revenue...],
     firstBoardYear, [boardSize...]] with revenue in thousands. A selection is a
     bitmask; a peer qualifies when it carries every selected bit. */
  var D = window.__PAGE;
  // The region is a DEFAULT, not a selection. The dashboard works the same way:
  // it groups by whatever is selected, falling back to region when nothing is.
  //
  // Treating it as a selection made the first click almost useless. Clicking
  // "Nature Centers" meant "East South Central AND Nature Centers" - five
  // organizations for Reflection Riding, below any sensible floor, so the line
  // vanished and it looked broken. Nobody clicking a tag means "intersect this
  // with my region"; they mean "compare me against this".
  //
  // So the first explicit click REPLACES the default. Clicks after that
  // intersect, which is where AND belongs.
  var selected = D.defaultMask || 0;
  var touched = false;

  function qualifying() {
    return D.peers.filter(function (p) { return (p[0] & selected) === selected; });
  }

  function seriesFor(peers, idx, yearIdx, scale) {
    var out = {};
    peers.forEach(function (p) {
      var first = p[idx], arr = p[idx + 1];
      if (first == null) return;
      for (var i = 0; i < arr.length; i++) {
        var v = arr[i];
        if (v == null) continue;
        (out[first + i] = out[first + i] || []).push(v * scale);
      }
    });
    return out;
  }

  // The same floor the dashboard uses: at least eight organizations, and at
  // least 60% of however many report in the best-covered year. A median drawn
  // from a handful is a different group rather than a different year.
  function medianLine(byYear, years) {
    var best = 0;
    for (var y in byYear) best = Math.max(best, byYear[y].length);
    var need = Math.max(8, Math.ceil(best * 0.6));
    var thin = [];
    var values = years.map(function (y) {
      var v = byYear[y] || [];
      if (v.length < need) { if (v.length) thin.push(y); return null; }
      return median(v);
    });
    return { values: values, thin: thin, need: need, best: best };
  }

  function cohortLabel() {
    if (!selected) return 'all organizations tracked';
    var names = D.tags.filter(function (t, i) { return selected & (1 << i); })
                      .map(function (t) { return t.name; });
    return names.join(' + ');
  }

  function render() {
    var peers = qualifying();
    /* Everything below works on the windowed axis. Each chart keeps its own
       year list, clamped to the window, so a shorter history narrows rather
       than gains blank columns. */
    var years = winYears(D.years);
    var bYears = winYears(D.boardYears);
    var eYears = winYears(D.endowYears || []);
    var W = function (v) { return winVals(D.years, v); };

    var rev = medianLine(seriesFor(peers, 1, 0, 1000), years);
    var board = medianLine(seriesFor(peers, 3, 0, 1), bYears);
    var ast = medianLine(seriesFor(peers, 5, 0, 1000), years);
    var lia = medianLine(seriesFor(peers, 7, 0, 1000), years);
    var end = medianLine(seriesFor(peers, 9, 0, 1000), eYears);
    var label = cohortLabel();

    draw(document.getElementById('c-rev'), {
      wide: true,
      labels: years.map(function (y) { return 'FY' + y; }),
      series: [
        { label: 'Revenue', values: W(D.revenue), color: '#059669' },
        { label: 'Expenses', values: W(D.expenses), color: '#d97706' },
        { label: 'Median revenue, ' + label, values: rev.values,
          color: tok('axis', '#94a3b8'), dash: true, weight: 1.5 }
      ].concat(draftSeries('Revenue', W(D.draftRevenue), '#059669', W(D.revenue),
                           (D.draftNotes || {}).rev))
       .concat(draftSeries('Expenses', W(D.draftExpenses), '#d97706', W(D.expenses),
                           (D.draftNotes || {}).exp))
    });
    legend(document.getElementById('k-rev'), [
      ['#059669', 'Revenue'], ['#d97706', 'Expenses'],
      [tok('axis', '#94a3b8'), 'Median revenue · ' + label]
    ].concat(hasDraft() ? [['#059669', 'Not a 990 — see the note above', 'ring']] : []));
    note('n-rev', rev, peers.length, 'revenue');

    var bhost = document.getElementById('c-board');
    if (bhost) {
      draw(bhost, {
        wide: true,
        labels: bYears.map(function (y) { return 'FY' + y; }), fmt: 'count',
        series: [
          { label: 'Board size', values: winVals(D.boardYears, D.board),
            color: '#2563eb', dot: 3 },
          { label: 'Median board size, ' + label, values: board.values,
            color: tok('axis', '#94a3b8'), dash: true, weight: 1.5 }
        ]
      });
      legend(document.getElementById('k-board'), [
        ['#2563eb', 'Board size', 'dot'],
        [tok('axis', '#94a3b8'), 'Median · ' + label]
      ]);
      note('n-board', board, peers.length, 'board size');
    }

    if (D.hasBalance) {
      draw(document.getElementById('c-assets'), {
        wide: true,
        labels: years.map(function (y) { return 'FY' + y; }),
        series: [
          { label: 'Assets', values: W(D.assets), kind: 'bar', color: '#059669' },
          { label: 'Liabilities', values: W(D.liabilities), kind: 'bar',
            color: '#dc2626' },
          { label: 'Median assets, ' + label, values: ast.values,
            color: '#0f766e', dash: true, weight: 1.5 },
          { label: 'Median liabilities, ' + label, values: lia.values,
            color: '#b91c1c', dash: true, weight: 1.5 }
        ].concat(draftBars('Assets', W(D.draftAssets), '#059669', 0,
                          (D.draftNotes || {}).assets))
         .concat(draftBars('Liabilities', W(D.draftLiabilities), '#dc2626', 1,
                          (D.draftNotes || {}).liab))
      });
      legend(document.getElementById('k-assets'), [
        ['#059669', 'Assets'], ['#dc2626', 'Liabilities'],
        ['#0f766e', 'Median assets · ' + label],
        ['#b91c1c', 'Median liabilities · ' + label]
      ].concat(hasDraft() ? [['#059669', 'Not a 990 — see the note above', 'hatch']] : []));
      note('n-assets', ast, peers.length, 'assets');
    }

    var ehost = document.getElementById('c-endow');
    if (ehost) {
      draw(ehost, {
        wide: true,
        labels: eYears.map(function (y) { return 'FY' + y; }),
        series: [
          { label: 'Endowment', values: winVals(D.endowYears, D.endowment),
            kind: 'bar', color: '#cbd5e1',
            colors: winVals(D.endowYears, D.endowColors) },
          { label: 'Median endowment, ' + label, values: end.values,
            color: '#534ab7', dash: true, weight: 1.5 }
        ]
      });
      // Said explicitly: the median is over peers that report an endowment at
      // all. 198 of 445 organizations have none, so a median across everybody
      // would be zero for most selections and would compare this fund against
      // a majority that do not have one.
      legend(document.getElementById('k-endow'),
        (D.endowKey || []).concat([['#534ab7',
          'Median · ' + label + ' (of those reporting one)']]));
      note('n-endow', end, peers.length, 'endowment');
    }

    document.querySelectorAll('.tagchip').forEach(function (c, i) {
      var on = !!(selected & (1 << i));
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var reset = document.getElementById('tag-reset');
    if (reset) reset.style.display = touched ? 'inline-flex' : 'none';
    var cur = document.getElementById('cohort-now');
    if (cur) cur.textContent = label + ' · ' + peers.length +
      (peers.length === 1 ? ' organization' : ' organizations');
  }

  function note(id, line, peerCount, what) {
    var host = document.getElementById(id);
    if (!host) return;
    // "fewer than 8 of the 5 organizations" is nonsense, and listing every year
    // when the whole cohort is too small buries the one thing worth saying.
    if (line.best > 0 && line.best < 8) {
      host.innerHTML = 'Only ' + line.best + ' organization' +
        (line.best === 1 ? '' : 's') + ' in this combination reported ' + what +
        ', too few for a median. Pick a broader tag, or clear the selection.';
      return;
    }
    if (!line.thin.length) { host.innerHTML = ''; return; }
    var list = line.thin.length > 6
      ? line.thin.slice(0, 6).join(', ') + ' and ' + (line.thin.length - 6) + ' more'
      : line.thin.join(', ');
    host.innerHTML = 'No cohort ' + what + ' shown for FY' + esc(list) +
      ': fewer than ' + line.need + ' of the ' + line.best +
      ' organizations that report in the best-covered year filed those years, ' +
      'so a median would describe a different group rather than a different year.';
  }

  /* ---- fixed charts ------------------------------------------------------ */
  function fixed() {
    (D.charts || []).forEach(function (c) {
      var host = document.getElementById(c.id);
      if (host) draw(host, Object.assign({ wide: true }, winSpec(c)));
      if (c.legend) {
        var lh = document.getElementById(c.id.replace('c-', 'k-'));
        if (lh) legend(lh, c.legend);
      }
    });
  }

  /* The tenure grid is baked server-side rather than drawn here - it is a table,
     not a chart, and it prints and reflows better as markup. It still gets the
     page's real tooltip rather than a native title: hover to peek, click to pin,
     escape to drop, the same gesture as every data point on the page. */
  document.querySelectorAll('[data-tip-html]').forEach(function (node) {
    wire(node, node.getAttribute('data-tip-html'));
  });

  document.querySelectorAll('.tagchip').forEach(function (chip, i) {
    chip.addEventListener('click', function () {
      if (!touched) { selected = (1 << i); touched = true; }
      else { selected ^= (1 << i); }
      render();
    });
  });
  var reset = document.getElementById('tag-reset');
  if (reset) reset.addEventListener('click', function () {
    selected = D.defaultMask || 0; touched = false; render();
  });

  wireYearControl();   // draws both chart sets once the window is set
  // Everything is drawn from CSS-derived colours, so a theme switch is just a
  // redraw. Cheap enough to do unconditionally.
  window.addEventListener('themechange', function () { fixed(); render(); });
})();
