/**
 * The arena page, served by server.ts. Vanilla on purpose — no build step, no deps.
 * In the A/B section the sides are shuffled per glyph (seeded by name) and labelled only
 * A/B until you decide (or toggle "reveal"), so preferences stay honest.
 */

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Ember glyph arena</title>
<style>
  :root {
    --bg: #101214; --panel: #16191d; --elev: #1f2329; --border: #262c34;
    --text: #e6e9ed; --dim: #8d96a1; --background: #101214;
    --accent: #4cc2ff; --warn: #f0a35e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  header {
    position: sticky; top: 0; z-index: 20; background: var(--panel);
    border-bottom: 1px solid var(--border); padding: 10px 16px;
    display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center;
  }
  h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: .2px; }
  h1 .mark { color: var(--accent); }
  .controls { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button {
    background: transparent; color: var(--dim); border: 0; padding: 5px 12px; cursor: pointer; font: inherit;
  }
  .seg button.on { background: var(--elev); color: var(--text); }
  .swatches { display: inline-flex; gap: 5px; align-items: center; }
  .sw { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; padding: 0; }
  .sw.on { border-color: var(--text); }
  label.chk { display: inline-flex; gap: 6px; align-items: center; color: var(--dim); cursor: pointer; user-select: none; }
  .progress { color: var(--dim); font-variant-numeric: tabular-nums; }
  .progress b { color: var(--text); }
  main { max-width: 1180px; margin: 0 auto; padding: 18px 16px 120px; }
  .intro { color: var(--dim); margin: 4px 0 14px; max-width: 860px; }
  h2 { font-size: 14px; margin: 26px 0 4px; color: var(--text); }
  .h2sub { color: var(--dim); margin: 0 0 12px; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
  .grid.slim { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px 12px;
  }
  .chead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .cname { font-weight: 600; font-size: 13.5px; }
  .cstate { font-size: 12px; color: var(--dim); }
  .twin { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .tile {
    position: relative; background: var(--elev); border: 2px solid transparent; border-radius: 10px;
    padding: 12px 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .tile.win { border-color: var(--accent); }
  .icons { display: flex; align-items: flex-end; gap: 14px; }
  .icons .rail { display: flex; align-items: center; justify-content: center; height: 30px; }
  .tlabel { font-size: 11.5px; color: var(--dim); letter-spacing: .4px; }
  .heart {
    position: absolute; top: 5px; right: 6px; background: none; border: 0; cursor: pointer;
    font-size: 15px; color: var(--dim); padding: 2px 4px; line-height: 1;
  }
  .heart.on { color: #ff5d8f; }
  .cbtns { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
  .cbtns button {
    flex: 1; min-width: 70px; background: var(--elev); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 8px; cursor: pointer; font: inherit; font-size: 12.5px;
  }
  .cbtns button:hover { border-color: var(--dim); }
  .cbtns button.on { background: var(--accent); border-color: var(--accent); color: #06121c; font-weight: 600; }
  .cbtns button.on.warn { background: var(--warn); border-color: var(--warn); }
  .cnote {
    margin-top: 9px; font-size: 12.5px; color: var(--dim); border-top: 1px dashed var(--border); padding-top: 7px;
  }
  .cnote b { color: var(--text); font-weight: 600; }
  .reason { margin-top: 8px; font-size: 12.5px; color: var(--dim); }
  .fstrip {
    background: var(--elev); border: 1px solid var(--border); border-radius: 12px;
    padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center;
  }
  .fslot { display: inline-flex; }
  .fcard .ficons { display: flex; align-items: flex-end; gap: 12px; }
  /* Glyph accents are painted with var(--background); on surfaces that are not the page bg
     the var is re-pointed at the real surface colour so accents read as negative space. */
  .tile, .fstrip { --background: var(--elev); }
  .fcard { --background: var(--panel); }
  .finishbar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 19; background: var(--panel);
    border-top: 1px solid var(--border); padding: 10px 16px; display: flex; gap: 12px; align-items: center;
    justify-content: center; flex-wrap: wrap;
  }
  .btn {
    background: var(--accent); color: #06121c; border: 0; border-radius: 9px; padding: 8px 16px;
    font: inherit; font-weight: 650; cursor: pointer;
  }
  .btn.ghost { background: var(--elev); color: var(--text); border: 1px solid var(--border); font-weight: 500; }
  #toast {
    position: fixed; bottom: 64px; right: 16px; background: var(--elev); color: var(--text);
    border: 1px solid var(--border); border-radius: 9px; padding: 7px 12px; font-size: 12.5px;
    opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 40;
  }
  #toast.show { opacity: 1; }
  #overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 50; display: none;
    align-items: flex-start; justify-content: center; padding: 40px 16px; overflow: auto;
  }
  #overlay.show { display: flex; }
  .sheet {
    background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 20px 22px;
    max-width: 680px; width: 100%;
  }
  .sheet h3 { margin: 0 0 6px; font-size: 16px; }
  .sheet pre {
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
    overflow: auto; font-size: 12px; max-height: 300px;
  }
  .sheet .row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .klist { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
  .klist span {
    background: var(--elev); border: 1px solid var(--border); border-radius: 7px; padding: 2px 8px; font-size: 12px;
  }
</style>
</head>
<body>
<header>
  <h1><span class="mark">Ember</span> glyph arena</h1>
  <div class="controls">
    <div class="seg" id="themeSeg">
      <button data-theme="light">Light (Stone)</button>
      <button data-theme="dark" class="on">Dark (Graphite)</button>
    </div>
    <div class="seg" id="paletteSeg">
      <button data-palette="classic">Classic</button>
      <button data-palette="fresh">Fresh</button>
      <button data-palette="punch">Punchy</button>
    </div>
    <div class="swatches" id="swatches"></div>
    <label class="chk"><input type="checkbox" id="mixed"/> mixed colours (like the app)</label>
    <label class="chk"><input type="checkbox" id="blind" checked/> blind labels</label>
  </div>
  <div class="progress" id="progress"></div>
</header>

<main>
  <p class="intro">
    Left/right in each A/B pair is shuffled per glyph and labelled only A/B while "blind labels" is on —
    pick the one you like, then the reveal shows which was which and what changed. Everything you click is
    logged to <b>glyph-arena/ratings.log</b> and saved to <b>glyph-arena/ratings.json</b> as you go.
  </p>

  <h2>Final lineup — your rated set</h2>
  <div id="final"></div>

  <h2>A/B — original vs improved</h2>
  <p class="h2sub">Every glyph in the set, redrawn for legibility at 30px (shown at 30px and 72px).</p>
  <div class="grid" id="pairs"></div>

  <h2>New glyph candidates</h2>
  <p class="h2sub">Round 2 is the quirky batch (cactus, snail, ghost…). Snowflake and mug are already kept from round 1 — change them if you want. Keep / Drop + ♥.</p>
  <div class="grid slim" id="cands"></div>

  <h2>Suggested removals</h2>
  <p class="h2sub">The weakest slots, and why. The improved A/B version still exists — agreeing here means "cut it".</p>
  <div class="grid slim" id="removals"></div>
</main>

<div class="finishbar">
  <span class="progress" id="progress2"></span>
  <button class="btn" id="finishBtn">Finish &amp; review JSON</button>
  <button class="btn ghost" id="resetBtn">Reset all picks</button>
</div>

<div id="toast"></div>
<div id="overlay"><div class="sheet" id="sheet"></div></div>

<script>
(function () {
  'use strict';
  var S = {
    data: null,
    ratings: { ab: {}, candidates: {}, removals: {}, likes: {} },
    theme: 'dark',
    paletteId: 'classic',
    colorIdx: 3,
    mixed: false,
    blind: true,
    uid: 0
  };
  var SWATCH_IDX = [0, 3, 8, 14, 20, 27, 33, 40, 47, 53, 58, 63];

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function el(id) { return document.getElementById(id); }
  function palette() {
    var ps = S.data.themes[S.theme].palettes;
    return ps[S.paletteId] || ps.classic;
  }
  function hexFor(name, variant) {
    if (S.mixed) return palette()[hash(name + ':' + variant) % 64];
    return palette()[S.colorIdx];
  }
  function svg(body, size) {
    var uid = 'g' + (S.uid++);
    var markup = body.replaceAll('{c}', 'currentColor').replaceAll('{id}', uid);
    return '<svg viewBox="3 3 42 42" width="' + size + '" height="' + size + '" style="overflow:visible">' +
      '<g fill="currentColor">' + markup + '</g></svg>';
  }
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 1300);
  }
  function post(section, name, value) {
    fetch('/api/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: section, name: name, value: value })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) { setProgress(d.summary); toast('saved to ratings.json'); }
    });
  }
  function applyTheme() {
    var t = S.data.themes[S.theme];
    var r = document.documentElement.style;
    r.setProperty('--bg', t.bg); r.setProperty('--panel', t.panel); r.setProperty('--elev', t.elev);
    r.setProperty('--border', t.border); r.setProperty('--text', t.text); r.setProperty('--dim', t.dim);
    r.setProperty('--background', t.bg);
    var seg = el('themeSeg');
    Array.prototype.forEach.call(seg.children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme') === S.theme);
    });
    var sw = el('swatches');
    sw.innerHTML = '';
    SWATCH_IDX.forEach(function (idx) {
      var b = document.createElement('button');
      b.className = 'sw' + (idx === S.colorIdx && !S.mixed ? ' on' : '');
      b.style.background = palette()[idx];
      b.title = 'glyph colour ' + idx;
      b.onclick = function () { S.colorIdx = idx; S.mixed = false; el('mixed').checked = false; renderAll(); };
      sw.appendChild(b);
    });
    var palSeg = el('paletteSeg');
    Array.prototype.forEach.call(palSeg.children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-palette') === S.paletteId);
    });
  }
  function setProgress(summary) {
    var p = summary.pairs;
    var c = summary.candidates;
    var r = summary.removals;
    var done = p.preferredImproved + p.preferredOriginal + p.skipped;
    var txt = 'pairs <b>' + done + '/' + p.total + '</b>' +
      ' (improved ' + p.preferredImproved + ' · original ' + p.preferredOriginal + ' · skip ' + p.skipped + ')' +
      ' · candidates ' + (c.kept.length + c.dropped.length) + '/' + c.total +
      ' · removals ' + (r.agreed.length + r.disagreed.length) + '/' + r.total +
      ' · likes ' + summary.liked.length;
    el('progress').innerHTML = txt;
    el('progress2').innerHTML = txt;
  }
  function heart(key, on) {
    return '<button class="heart' + (on ? ' on' : '') + '" data-like="' + key + '" title="like this one">' +
      (on ? '♥' : '♡') + '</button>';
  }
  function tile(name, variant, body, label, win, likeKey) {
    return '<div class="tile' + (win ? ' win' : '') + '">' + heart(likeKey, !!S.ratings.likes[likeKey]) +
      '<div class="icons" style="color:' + hexFor(name, variant) + '">' +
      '<span class="rail">' + svg(body, 30) + '</span>' + svg(body, 72) + '</div>' +
      '<div class="tlabel">' + label + '</div></div>';
  }
  function decided(name) {
    var v = S.ratings.ab[name];
    return v === 'improved' || v === 'original';
  }
  function renderPairs() {
    var host = el('pairs');
    host.innerHTML = S.data.pairs.map(function (p) {
      var improvedLeft = hash(p.name) % 2 === 0;
      var left = improvedLeft ? 'improved' : 'original';
      var right = improvedLeft ? 'original' : 'improved';
      var choice = S.ratings.ab[p.name];
      var reveal = !S.blind || decided(p.name);
      var llabel = reveal ? left : 'A';
      var rlabel = reveal ? right : 'B';
      var lwin = (choice === left), rwin = (choice === right);
      var state = '';
      if (choice === 'skip') state = 'skipped';
      else if (choice) state = 'picked ' + (reveal ? choice : (choice === left ? 'A' : 'B'));
      var note = (reveal && p.note) ? '<div class="cnote"><b>improved:</b> ' + p.note + '</div>' : '';
      return '<div class="card" data-pair="' + p.name + '">' +
        '<div class="chead"><span class="cname">' + p.name + '</span><span class="cstate">' + state + '</span></div>' +
        '<div class="twin">' +
        tile(p.name, left, p[left], llabel, lwin, p.name + ':' + left) +
        tile(p.name, right, p[right], rlabel, rwin, p.name + ':' + right) +
        '</div>' +
        '<div class="cbtns">' +
        '<button data-act="pick" data-val="' + left + '">A is better</button>' +
        '<button data-act="pick" data-val="' + right + '">B is better</button>' +
        '<button data-act="pick" data-val="skip">Skip</button>' +
        '</div>' + note + '</div>';
    }).join('');
  }
  function renderCands() {
    el('cands').innerHTML = S.data.candidates.map(function (c) {
      var v = S.ratings.candidates[c.name];
      var state = v === 'keep' ? 'keep' : (v === 'drop' ? 'drop' : '');
      return '<div class="card" data-cand="' + c.name + '">' +
        '<div class="chead"><span class="cname">' + c.name + '</span><span class="cstate">' + state + '</span></div>' +
        '<div class="twin">' + tile(c.name, 'cand', c.body, '', false, c.name) + '</div>' +
        '<div class="cbtns">' +
        '<button data-act="keep"' + (v === 'keep' ? ' class="on"' : '') + '>Keep it</button>' +
        '<button data-act="drop"' + (v === 'drop' ? ' class="on warn"' : '') + '>Drop it</button>' +
        '</div><div class="cnote">' + c.note + '</div></div>';
    }).join('');
  }
  function renderRemovals() {
    el('removals').innerHTML = S.data.removals.map(function (r) {
      var v = S.ratings.removals[r.name];
      return '<div class="card" data-removal="' + r.name + '">' +
        '<div class="chead"><span class="cname">' + r.name + '</span></div>' +
        '<div class="twin">' + tile(r.name, 'cur', r.body, '', false, r.name + ':original') + '</div>' +
        '<div class="cbtns">' +
        '<button data-act="agree"' + (v === 'agree' ? ' class="on warn"' : '') + '>Agree — remove</button>' +
        '<button data-act="disagree"' + (v === 'disagree' ? ' class="on"' : '') + '>Keep it</button>' +
        '</div><div class="reason">' + r.reason + '</div></div>';
    }).join('');
  }
  function renderFinal() {
    var host = el('final');
    if (!S.data.final || !S.data.final.length) {
      host.innerHTML = '<p class="h2sub">Nothing kept yet — rate the A/B pairs and candidates first.</p>';
      return;
    }
    var strip = S.data.final.map(function (f) {
      var idx = hash(f.name) % 64;
      return '<span class="fslot" style="color:' + palette()[idx] + '" title="' + f.name + '">' + svg(f.body, 30) + '</span>';
    }).join('');
    var cards = S.data.final.map(function (f) {
      var tag = f.source === 'improved' ? 'redrawn' : (f.source === 'new' ? 'new' : 'kept');
      return '<div class="card fcard"><div class="ficons" style="color:' + hexFor(f.name, 'f' + f.name) + '">' +
        svg(f.body, 30) + svg(f.body, 48) + '</div>' +
        '<div class="chead" style="margin-top:8px"><span class="cname">' + f.name + '</span><span class="cstate">' + tag + '</span></div></div>';
    }).join('');
    host.innerHTML =
      '<div class="fstrip">' + strip + '</div>' +
      '<p class="h2sub" style="margin-top:10px">' + S.data.final.length + ' glyphs in the rated set — strip above shows them at 30px in app-style mixed colours.</p>' +
      '<div class="grid slim">' + cards + '</div>';
  }
  function renderAll() {
    applyTheme();
    renderFinal();
    renderPairs();
    renderCands();
    renderRemovals();
  }
  document.addEventListener('click', function (ev) {
    var likeBtn = ev.target.closest ? ev.target.closest('[data-like]') : null;
    if (likeBtn) {
      var key = likeBtn.getAttribute('data-like');
      var on = !S.ratings.likes[key];
      if (on) S.ratings.likes[key] = true; else delete S.ratings.likes[key];
      post('likes', key, on ? 'like' : 'unlike');
      renderAll();
      return;
    }
    var btn = ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if (!btn) return;
    var card = btn.closest('.card');
    var act = btn.getAttribute('data-act');
    if (card.hasAttribute('data-pair')) {
      var name = card.getAttribute('data-pair');
      S.ratings.ab[name] = act === 'pick' ? btn.getAttribute('data-val') : act;
      post('ab', name, S.ratings.ab[name]);
      renderAll();
    } else if (card.hasAttribute('data-cand')) {
      var cname = card.getAttribute('data-cand');
      S.ratings.candidates[cname] = act;
      post('candidates', cname, act);
      renderAll();
    } else if (card.hasAttribute('data-removal')) {
      var rname = card.getAttribute('data-removal');
      S.ratings.removals[rname] = act;
      post('removals', rname, act);
      renderAll();
    }
  });
  el('themeSeg').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    S.theme = b.getAttribute('data-theme');
    renderAll();
  });
  el('paletteSeg').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    S.paletteId = b.getAttribute('data-palette');
    renderAll();
  });
  el('mixed').addEventListener('change', function () { S.mixed = this.checked; renderAll(); });
  el('blind').addEventListener('change', function () { S.blind = this.checked; renderAll(); });
  el('resetBtn').addEventListener('click', function () {
    if (!confirm('Clear all picks, likes and ratings?')) return;
    S.ratings = { ab: {}, candidates: {}, removals: {}, likes: {} };
    fetch('/api/reset', { method: 'POST' }).then(function () { renderAll(); toast('cleared'); });
  });
  el('finishBtn').addEventListener('click', function () {
    fetch('/api/ratings').then(function (r) { return r.json(); }).then(function (doc) {
      var s = doc.summary;
      var chips = function (list) {
        return '<div class="klist">' + list.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
      };
      el('sheet').innerHTML =
        '<h3>Results</h3>' +
        '<p><b>' + s.pairs.decided + '/' + s.pairs.total + '</b> pairs decided — improved ' + s.pairs.preferredImproved +
        ', original ' + s.pairs.preferredOriginal + ', skipped ' + s.pairs.skipped + ', undecided ' + s.pairs.undecided + '.</p>' +
        '<p><b>Candidates:</b> kept ' + s.candidates.kept.length + ', dropped ' + s.candidates.dropped.length + ', undecided ' + s.candidates.undecided.length + '</p>' + chips(s.candidates.kept) +
        '<p><b>Removals:</b> agreed ' + s.removals.agreed.length + ', kept ' + s.removals.disagreed.length + ', undecided ' + s.removals.undecided.length + '</p>' + chips(s.removals.agreed) +
        '<p><b>Liked:</b> ' + s.liked.length + '</p>' + chips(s.liked) +
        '<pre>' + JSON.stringify(doc, null, 2).replace(/</g, '&lt;') + '</pre>' +
        '<div class="row">' +
        '<button class="btn" id="dlBtn">Download ratings.json</button>' +
        '<button class="btn ghost" id="closeBtn">Close</button>' +
        '</div>';
      el('overlay').classList.add('show');
      el('dlBtn').onclick = function () {
        var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'glyph-ratings.json';
        a.click();
      };
      el('closeBtn').onclick = function () { el('overlay').classList.remove('show'); };
    });
  });

  fetch('/api/data').then(function (r) { return r.json(); }).then(function (data) {
    S.data = data;
    fetch('/api/ratings').then(function (r) { return r.json(); }).then(function (doc) {
      S.ratings.ab = doc.ab || {};
      S.ratings.candidates = doc.candidates || {};
      S.ratings.removals = doc.removals || {};
      S.ratings.likes = doc.likes || {};
      setProgress(doc.summary);
      renderAll();
      toast('arena ready — ' + data.pairs.length + ' pairs');
    });
  });
})();
</script>
</body>
</html>`;
