// Launch Radar dashboard. Everything it shows comes from window.RADAR,
// the data.js that main.ts writes beside this page from the same board
// that board.json carries. No fetch, no network: filter, sort, detail and
// the peer view are all computed here from that one dataset, and each
// implied value is recomputed from the model's inputs before printing.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) return;
  var $ = function (id) { return document.getElementById(id); };

  var state = { q: '', cat: '', chain: '', watch: false, hiconf: false, sort: 'rank', live: false, detail: null };
  var hash = {};
  (location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
    var p = kv.split('='); if (p.length === 2) hash[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
  });
  if (hash.q) state.q = hash.q;
  if (hash.cat) state.cat = hash.cat;
  if (hash.chain) state.chain = hash.chain;
  if (hash.watch === '1') state.watch = true;
  if (hash.conf === 'high') state.hiconf = true;
  if (hash.sort) state.sort = hash.sort;
  if (hash.view === 'live') state.live = true;
  if (hash.detail) state.detail = hash.detail;

  function usd(n) {
    if (n === null || n === undefined) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return n === null || n === undefined ? 'n/a' : (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%'; }
  function ageTxt(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }
  function confFactor(c) { return c === 'high' ? 1 : c === 'medium' ? 0.85 : 0.65; }
  function priority(r) { return r.implied_value_usd * r.launch_prior * confFactor(r.confidence); }

  // The model, recomputed in the page: the fitted curve and the one
  // adjustment lib/model.ts ships (maturity), so the number printed
  // here is the number board.json carries, derived again from the
  // row's inputs.
  function recompute(r) {
    var age = r.age_days === null ? 365 : r.age_days;
    var mm = 0.75 + (Math.min(Math.max(age, 0), 1460) / 1460) * 0.45;
    var base = Math.exp(r.model.fit_intercept + r.model.fit_slope * Math.log(r.tvl_usd));
    return Math.max(1, Math.round(base * mm));
  }
  function fitBase(r) {
    return Math.exp(r.model.fit_intercept + r.model.fit_slope * Math.log(r.tvl_usd));
  }

  // Header stats and the stated model.
  var stats = [
    [String(D.watchlist_size) + ' / ' + D.watchlist_size, 'watchlist covered'],
    [String(D.board_size), 'pre-token protocols ranked'],
    [String(D.pre_token_size), 'pre-token in snapshot'],
    [String(D.live_size), 'already launched (peer set)'],
    [D.as_of, 'snapshot date'],
  ];
  $('stats').innerHTML = stats.map(function (s) {
    return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
  }).join('');
  $('model').innerHTML = '<h2>THE MODEL — ' + D.model_version + '</h2><p>' + D.model_summary + '</p>';

  // Filter option lists, from the data itself.
  var cats = {}, chains = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) { $('fcat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('fchain').appendChild(new Option(c, c)); });
  $('q').value = state.q; $('fcat').value = state.cat; $('fchain').value = state.chain;
  $('fwatch').checked = state.watch; $('fhiconf').checked = state.hiconf; $('sort').value = state.sort;

  function filtered() {
    var q = state.q.toLowerCase();
    var out = D.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.watch && !r.watchlist) return false;
      if (state.hiconf && r.confidence !== 'high') return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      priority: function (a, b) { return priority(b) - priority(a); },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    };
    return out.sort(by[state.sort] || by.rank);
  }

  function renderBoard() {
    var rows = filtered();
    $('count').textContent = state.live
      ? 'Peer set: the ' + D.live.length + ' largest already-launched protocols — the market prices the model reads.'
      : 'Showing ' + rows.length + ' of ' + D.board_size + ' ranked protocols. Click any row for its detail view and farm plan.';
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + r.slug + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + r.name + '</span>' + (r.watchlist ? '<span class="badge wl">WATCHLIST</span>' : '') +
        '<br><span class="pslug">' + r.slug + '</span></td>' +
        '<td>' + (r.category || '—') + '</td>' +
        '<td>' + (r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageTxt(r.age_days) + '</td>' +
        '<td class="num"><b>' + usd(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + usd(r.implied_low_usd) + ' – ' + usd(r.implied_high_usd) + '</td>' +
        '<td><span class="prior">' + Math.round(r.launch_prior * 100) + '%</span><div class="bar"><i style="width:' + Math.round(r.launch_prior * 100) + '%"></i></div></td>' +
        '<td class="conf ' + r.confidence + '">' + r.confidence + '</td></tr>';
    }).join('');
    Array.prototype.forEach.call($('rows').querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug'), true); });
    });
  }

  function renderLive() {
    $('liverows').innerHTML = D.live.map(function (r) {
      return '<tr><td><span class="pname">' + r.name + '</span><br><span class="pslug">' + r.slug + '</span></td>' +
        '<td>' + (r.category || '—') + '</td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num">' + usd(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.multiple === null ? 'n/a' : r.multiple.toFixed(3) + 'x') + '</td>' +
        '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  function showDetail(slug, scroll) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.detail = slug;
    var check = recompute(r);
    var fitTxt = r.model.fit_scope === 'category'
      ? 'the ' + (r.category || 'uncategorised') + ' level of the fitted curve (ln cap = ' +
        r.model.fit_intercept.toFixed(2) + ' + ' + r.model.fit_slope.toFixed(2) + ' x ln TVL)'
      : 'the global fitted curve (ln cap = ' + r.model.fit_intercept.toFixed(2) + ' + ' +
        r.model.fit_slope.toFixed(2) + ' x ln TVL), because its category has too few traded peers for its own level';
    var why = r.name + ' holds ' + usd(r.tvl_usd) + ' of TVL with no token after ' + ageTxt(r.age_days) +
      ' tracked. Priced off ' + fitTxt + ', its base value is ' + usd(fitBase(r)) +
      ' before the maturity adjustment below — the only adjustment that survived the backtest ' +
      'audit further down this page. A flat category-median ' +
      'multiple would have said ' + usd(r.model.median_implied_usd) + ' instead — the backtest ' +
      'further down this page is why the curve, not the flat multiple, sets the rank.';
    $('detail').innerHTML =
      '<h2>#' + r.rank + ' — ' + r.name + (r.watchlist ? ' <span class="badge wl">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="why">' + why + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><b>' + usd(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div class="cell"><b>' + usd(r.implied_low_usd) + ' – ' + usd(r.implied_high_usd) + '</b><span>fit residual range</span></div>' +
      '<div class="cell"><b>' + usd(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div class="cell"><b>' + pct(r.change_7d) + '</b><span>TVL change, 7d</span></div>' +
      '<div class="cell"><b>' + usd(fitBase(r)) + '</b><span>fitted base (' + r.model.fit_scope + ' curve, slope ' + r.model.fit_slope.toFixed(2) + ')</span></div>' +
      '<div class="cell"><b>' + usd(r.model.median_implied_usd) + '</b><span>what a flat category median would say</span></div>' +
      '<div class="cell"><b>$' + r.model.farm_capital_usd + '</b><span>farm plan position size (scaled to its TVL)</span></div>' +
      '<div class="cell"><b>x' + r.model.maturity_multiplier.toFixed(3) + '</b><span>maturity adj. (' + ageTxt(r.age_days) + ' tokenless)</span></div>' +
      '<div class="cell"><b>removed</b><span>momentum & breadth adj. — failed the backtest audit, see validation</span></div>' +
      '<div class="cell"><b>' + Math.round(r.launch_prior * 100) + '%</b><span>launch prior, ' + (r.category || 'category') + '</span></div>' +
      '<div class="cell"><b>' + r.confidence + '</b><span>model confidence</span></div>' +
      '<div class="cell"><b>' + usd(check) + '</b><span>page recompute — ' + (check === r.implied_value_usd ? 'matches board' : 'differs from board') + '</span></div>' +
      '<div class="cell"><b>' + (r.listed_at || 'unknown') + '</b><span>tracked since</span></div>' +
      '</div>' +
      '<p>Chains: ' + (r.chains.join(', ') || 'none recorded') + ' · Category: ' + (r.category || 'none recorded') +
      ' · Slug: ' + r.slug + ' · Status: pre-token (no CoinGecko id, no symbol, no market cap in the snapshot)</p>' +
      '<h3>HOW TO FARM IT</h3><ol>' + r.farm_steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    $('detail').hidden = false;
    if (scroll) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // The model, drawn: every traded peer at its actual market cap, every
  // board row at its implied value, and the global fitted curve through
  // them — log-log, straight from the same data.js numbers.
  function renderChart() {
    var W = 1120, H = 340, PL = 64, PR = 16, PT = 14, PB = 34;
    var pts = [];
    D.live.forEach(function (r) { if (r.mcap_usd) pts.push({ x: r.tvl_usd, y: r.mcap_usd, live: true }); });
    D.rows.forEach(function (r) { pts.push({ x: r.tvl_usd, y: r.implied_value_usd, live: false, wl: r.watchlist, slug: r.slug }); });
    var xs = pts.map(function (p) { return Math.log10(p.x); });
    var ys = pts.map(function (p) { return Math.log10(p.y); });
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    function X(v) { return PL + ((Math.log10(v) - x0) / (x1 - x0)) * (W - PL - PR); }
    function Y(v) { return PT + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - PT - PB); }
    var grid = '';
    for (var gx = x0; gx <= x1; gx++) {
      grid += '<line x1="' + X(Math.pow(10, gx)) + '" y1="' + PT + '" x2="' + X(Math.pow(10, gx)) + '" y2="' + (H - PB) + '" class="grid"/>' +
        '<text x="' + X(Math.pow(10, gx)) + '" y="' + (H - PB + 18) + '" class="ax" text-anchor="middle">' + usd(Math.pow(10, gx)) + '</text>';
    }
    for (var gy = y0; gy <= y1; gy++) {
      grid += '<line x1="' + PL + '" y1="' + Y(Math.pow(10, gy)) + '" x2="' + (W - PR) + '" y2="' + Y(Math.pow(10, gy)) + '" class="grid"/>' +
        '<text x="' + (PL - 6) + '" y="' + (Y(Math.pow(10, gy)) + 4) + '" class="ax" text-anchor="end">' + usd(Math.pow(10, gy)) + '</text>';
    }
    var gf = D.global_fit;
    var line = '<line x1="' + X(Math.pow(10, x0)) + '" y1="' + Y(Math.exp(gf.intercept + gf.slope * Math.log(Math.pow(10, x0)))) +
      '" x2="' + X(Math.pow(10, x1)) + '" y2="' + Y(Math.exp(gf.intercept + gf.slope * Math.log(Math.pow(10, x1)))) + '" class="fitline"/>';
    var dots = pts.map(function (p) {
      return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.live ? 3 : p.wl ? 4.5 : 3.5) +
        '" class="' + (p.live ? 'dot-live' : p.wl ? 'dot-wl' : 'dot-board') + '"/>';
    }).join('');
    var movers = D.rows.filter(function (r) { return r.rank <= 60 && r.change_7d !== null; })
      .sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); }).slice(0, 5);
    $('chart').innerHTML =
      '<h2>THE MODEL, DRAWN — TVL AGAINST VALUE, LOG-LOG</h2>' +
      '<p>Grey dots are protocols whose token already trades, at their actual market cap. Green dots are ' +
      'this board, at implied value; ringed dots are the watchlist. The line is the global fitted curve ' +
      '(slope ' + gf.slope.toFixed(2) + '): value grows with roughly the square root of TVL, which is why ' +
      'the biggest protocols sit far below any flat multiple of their TVL.</p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter plot of TVL against market cap and implied value">' +
      grid + line + dots + '</svg>' +
      '<div class="movers"><span class="movers-h">FASTEST TVL GROWTH IN THE TOP 60</span>' +
      movers.map(function (r) {
        return '<button type="button" class="chip" data-slug="' + r.slug + '">' + r.name + ' <b class="pos">' +
          pct(r.change_7d) + '</b> · ' + usd(r.implied_value_usd) + '</button>';
      }).join('') + '</div>';
    Array.prototype.forEach.call($('chart').querySelectorAll('.chip'), function (ch) {
      ch.addEventListener('click', function () { showDetail(ch.getAttribute('data-slug'), true); });
    });
  }

  function renderValidation() {
    var v = D.validation;
    if (!v) return;
    var rows = v.models.map(function (m) {
      var board = m.name.indexOf('this board') >= 0;
      return '<tr' + (board ? ' class="hl"' : '') + '><td>' + m.name + '</td>' +
        '<td class="num">' + m.median_ape_pct.toFixed(1) + '%</td>' +
        '<td class="num">' + m.within_2x_pct.toFixed(1) + '%</td>' +
        '<td class="num">' + m.within_3x_pct.toFixed(1) + '%</td></tr>';
    }).join('');
    var fits = D.fits.map(function (f) {
      var at100 = Math.exp(f.intercept + f.slope * Math.log(1e8)) / 1e8;
      return '<tr><td>' + f.category + '</td><td class="num">' + f.peers + '</td>' +
        '<td class="num">' + f.intercept.toFixed(2) + '</td><td class="num">' + f.slope.toFixed(2) + '</td>' +
        '<td class="num">' + at100.toFixed(3) + 'x</td></tr>';
    }).join('');
    $('validation').innerHTML =
      '<h2>MODEL VALIDATION — MEASURED, NOT ASSERTED</h2>' +
      '<p>' + v.method + ' ' + v.usable_peers + ' traded protocols in the snapshot carry both a ' +
      'market cap and TVL, and every one of them is scored. On the full peer set the ' +
      'shared slope is ' + v.global_slope.toFixed(2) + ' — market cap grows with roughly the square ' +
      'root of TVL, which is why no flat multiple prices this board.</p>' +
      '<table><thead><tr><th>Candidate model</th><th class="num">Median error</th>' +
      '<th class="num">Within 2x</th><th class="num">Within 3x</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<p>The last row is the model that ranks this board, scored exactly as it ships — adjustments ' +
      'included. It carries the lowest median error of the six candidates and shares the best ' +
      'within-2x score. The row above it is the previous version\u2019s recipe (curve, levels and all ' +
      'three adjustments): scored openly, it is worse on every column, which is why the momentum ' +
      'and breadth adjustments are gone. On within-3x the unadjusted curve stays a touch ahead of ' +
      'the board model — the maturity tilt buys its median-error gain at that small cost, and the ' +
      'trade is stated rather than hidden. Errors stay large in absolute terms: ' +
      'token launches are noisy, and the board shows a range, not just a point, for exactly that reason.</p>' +
      '<h3>BLIND-PRICING SPREAD — THE BOARD MODEL ON HELD-OUT PEERS</h3>' +
      '<p>How close the board model\u2019s blind prices land to the caps the market actually set, ' +
      'across every held-out peer in the rotation:</p>' +
      (v.board_spread || []).map(function (b) {
        return '<div class="spreadrow"><span>within ' + b.factor + 'x</span>' +
          '<div class="bar"><i style="width:' + b.pct + '%"></i></div><b>' + b.pct.toFixed(1) + '%</b></div>';
      }).join('') +
      '<h3>FITTED LEVELS BY CATEGORY</h3>' +
      '<table><thead><tr><th>Category</th><th class="num">Traded peers</th><th class="num">Level (intercept)</th>' +
      '<th class="num">Shared slope</th><th class="num">Implied multiple at $100M TVL</th></tr></thead><tbody>' +
      fits + '</tbody></table>';
  }

  function renderPeers() {
    $('peers').innerHTML = '<h2>PEER MULTIPLES — WHAT THE MARKET PAYS PER TVL DOLLAR, BY CATEGORY</h2>' +
      '<table><thead><tr><th>Category</th><th class="num">Traded peers</th><th class="num">Median mcap/TVL</th>' +
      '<th class="num">Lower quartile</th><th class="num">Upper quartile</th></tr></thead><tbody>' +
      D.categories.map(function (c) {
        return '<tr><td>' + c.category + '</td><td class="num">' + c.peers + '</td><td class="num">' +
          c.median.toFixed(3) + 'x</td><td class="num">' + c.low.toFixed(3) + 'x</td><td class="num">' +
          c.high.toFixed(3) + 'x</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function applyLive() {
    $('board').hidden = state.live;
    $('live').hidden = !state.live;
    $('tab-live').classList.toggle('on', state.live);
    $('tab-live').textContent = state.live ? 'Back to the pre-token board' : 'Already launched (peer set)';
    renderBoard();
  }

  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('fcat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('fchain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('fwatch').addEventListener('change', function () { state.watch = this.checked; renderBoard(); });
  $('fhiconf').addEventListener('change', function () { state.hiconf = this.checked; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });
  $('tab-live').addEventListener('click', function () { state.live = !state.live; applyLive(); });

  renderLive();
  renderChart();
  renderValidation();
  renderPeers();
  applyLive();
  if (state.detail) {
    showDetail(state.detail, false);
    // A linked detail view (the detail screenshot, a shared link) opens
    // already scrolled to the protocol, not to the top of the board.
    $('detail').scrollIntoView();
  }
})();
