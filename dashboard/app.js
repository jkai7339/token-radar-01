/* Token Radar — board rendering, filters, sorting and the detail view.
   Reads window.RADAR (written by main.ts from the sealed snapshot); no
   fetch, no network. State lives in the URL so a view can be linked:
   ?q= &cat= &chain= &wl=1 &gainers=1 &sort= &dir= &slug= */

(function () {
  'use strict';

  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.body.insertAdjacentHTML('beforeend', '<p style="padding:20px">No radar data was loaded.</p>');
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var state = {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    wl: params.get('wl') === '1',
    gainers: params.get('gainers') === '1',
    sort: params.get('sort') || 'rank',
    dir: params.get('dir') === 'desc' ? 'desc' : 'asc',
    slug: params.get('slug') || '',
  };

  // The watchlist is the snapshot's own list; the rows carry it as a flag.
  var watchSlugs = new Set(D.watchlist_slugs || []);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function moneyFull(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function pct(n) {
    if (n == null) return '—';
    var cls = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
    var sign = n > 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + n.toFixed(1) + '%</span>';
  }

  function ageText(days) {
    if (days == null) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }

  function chainsText(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length <= 2) return esc(chains.join(', '));
    return esc(chains[0]) + ', ' + esc(chains[1]) + ' +' + (chains.length - 2);
  }

  function $(id) { return document.getElementById(id); }

  /* ---- header, stats, footer ---- */

  $('meta').innerHTML =
    'Snapshot <b>' + esc(D.as_of) + '</b><br>' +
    'Model <b>' + esc(D.model_version) + '</b> · ' + D.board_size + ' protocols ranked';

  var total = D.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
  var top = D.rows[0];
  $('stats').innerHTML =
    '<div class="stat"><div class="num">' + D.board_size + '</div><div class="lbl">Protocols ranked</div></div>' +
    '<div class="stat"><div class="num">' + D.watchlist_size + '</div><div class="lbl">Watchlist covered</div></div>' +
    '<div class="stat"><div class="num">' + D.early_size + '</div><div class="lbl">Early finds below the floor</div></div>' +
    '<div class="stat"><div class="num">' + money(total) + '</div><div class="lbl">Total implied value</div></div>';
  $('board-sub').textContent = '· top: ' + (top ? top.name + ' at ' + money(top.implied_value_usd) : '—');
  $('src').textContent = D.source;

  /* ---- filter controls ---- */

  var cats = {};
  var chains = {};
  D.rows.forEach(function (r) {
    cats[r.category || 'Uncategorised'] = true;
    (r.chains || []).forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    $('cat').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });
  Object.keys(chains).sort().forEach(function (c) {
    $('chain').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });

  $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('watchlist').checked = state.wl;
  $('gainers').checked = state.gainers;

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.chain) p.set('chain', state.chain);
    if (state.wl) p.set('wl', '1');
    if (state.gainers) p.set('gainers', '1');
    if (state.sort !== 'rank' || state.dir !== 'asc') { p.set('sort', state.sort); p.set('dir', state.dir); }
    if (state.slug) p.set('slug', state.slug);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
  }

  /* ---- board ---- */

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.wl && !watchSlugs.has(r.slug)) return false;
      if (state.gainers && !(r.change_7d != null && r.change_7d > 0)) return false;
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    var dir = state.dir === 'desc' ? -1 : 1;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return dir * (av < bv ? -1 : av > bv ? 1 : 0);
      return dir * (av - bv);
    });
    return rows;
  }

  function renderBoard() {
    var rows = filtered();
    var html = '';
    rows.forEach(function (r) {
      html += '<tr data-slug="' + esc(r.slug) + '"' + (state.slug === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        (watchSlugs.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : '') +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chainsText(r.chains) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num imp">' + money(r.implied_value_usd) + '</td></tr>';
    });
    $('rows').innerHTML = html || '<tr><td colspan="8" class="empty">No protocols match these filters.</td></tr>';
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols shown' +
      (state.wl ? ' · watchlist only' : '') + (state.gainers ? ' · growing only' : '');
    document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
      th.classList.toggle('desc', th.getAttribute('data-sort') === state.sort && state.dir === 'desc');
    });
  }

  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = key;
        state.dir = key === 'name' || key === 'category' ? 'asc' : 'desc';
      }
      syncUrl();
      renderBoard();
    });
  });

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  var debounce = null;
  $('q').addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () { state.q = $('q').value; syncUrl(); renderBoard(); }, 150);
  });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; syncUrl(); renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; syncUrl(); renderBoard(); });
  $('watchlist').addEventListener('change', function () { state.wl = $('watchlist').checked; syncUrl(); renderBoard(); });
  $('gainers').addEventListener('change', function () { state.gainers = $('gainers').checked; syncUrl(); renderBoard(); });

  /* ---- detail view ---- */

  function showDetail(slug) {
    var r = D.rows.find(function (x) { return x.slug === slug; });
    var panel = $('detail');
    if (!r) { panel.hidden = true; state.slug = ''; syncUrl(); renderBoard(); return; }
    state.slug = slug;
    syncUrl();
    var product = r.size_value_usd * r.category_multiple * r.growth_multiplier * r.maturity_multiplier * r.breadth_multiplier;
    panel.innerHTML =
      '<button class="back" id="back">← Back to the board</button>' +
      '<h2>#' + r.rank + ' · ' + esc(r.name) + (watchSlugs.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="fine">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ') || 'no chains listed') +
      ' · tracked since ' + esc(r.listed_at || 'unknown') + ' · records no token.</p>' +
      '<div class="facts">' +
      '<div class="fact"><div class="k">Implied value</div><div class="v">' + moneyFull(r.implied_value_usd) + '</div></div>' +
      '<div class="fact"><div class="k">TVL</div><div class="v">' + moneyFull(r.tvl_usd) + '</div></div>' +
      '<div class="fact"><div class="k">7-day change</div><div class="v">' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</div></div>' +
      '<div class="fact"><div class="k">Age with no token</div><div class="v">' + ageText(r.age_days) + '</div></div>' +
      '</div>' +
      '<h3>How the value is worked out</h3>' +
      '<table class="factors"><thead><tr><th>Factor</th><th class="num">Value</th><th>What it means</th></tr></thead><tbody>' +
      '<tr><td>Size value</td><td class="num">' + moneyFull(r.size_value_usd) + '</td><td>TVL run through the concave size curve, (TVL / $1M)<sup>0.92</sup> × $1M</td></tr>' +
      '<tr><td>Category multiple</td><td class="num">× ' + r.category_multiple.toFixed(2) + '</td><td>FDV/TVL benchmark for ' + esc(r.category || 'uncategorised') + ' protocols</td></tr>' +
      '<tr><td>Growth</td><td class="num">× ' + r.growth_multiplier.toFixed(4) + '</td><td>Seven-day TVL change of ' + (r.change_7d == null ? 'unreported (taken as 0%)' : r.change_7d.toFixed(1) + '%') + '</td></tr>' +
      '<tr><td>Maturity</td><td class="num">× ' + r.maturity_multiplier.toFixed(4) + '</td><td>' + (r.age_days == null ? 'Age unreported (365 days assumed)' : r.age_days + ' days tracked with no token') + '</td></tr>' +
      '<tr><td>Breadth</td><td class="num">× ' + r.breadth_multiplier.toFixed(4) + '</td><td>Live on ' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + '</td></tr>' +
      '<tr><td><b>Implied value</b></td><td class="num"><b>' + moneyFull(r.implied_value_usd) + '</b></td><td>Product of the five factors as shown, each rounded to 4 decimals (' + moneyFull(product) + ')</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — what to do about ' + esc(r.name) + '</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="fine">Each step states what it costs and how long it takes. This plan is a suggestion for farming a protocol that records no token; it is not a promise of an airdrop.</p>';
    panel.hidden = false;
    $('back').addEventListener('click', function () {
      state.slug = '';
      syncUrl();
      panel.hidden = true;
      renderBoard();
      panel.scrollIntoView({ block: 'nearest' });
    });
    panel.scrollIntoView({ block: 'start' });
    renderBoard();
  }

  /* ---- already trading ---- */

  $('live-rows').innerHTML = D.live.map(function (p) {
    return '<tr><td><span class="name">' + esc(p.name) + '</span><br><span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  renderBoard();
  if (state.slug) showDetail(state.slug);
})();
