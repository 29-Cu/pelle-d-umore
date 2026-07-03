/* Pelle d'Umore — Emotional Skin for AI Chat | CC BY 4.0 — Attribution required | Created by Cu & Lunedì (cunedi.uk)
 *
 * mood.js — emotional mood-skin controller. Plain script (not an ES module).
 *
 * Exposes window.Pelle:
 *   set(mode, opts) : mode ∈ 'rage' | 'rage2' | 'desire' | 'vuoto' | 'moonlight' | 'off';
 *                     adds/removes data-mood on <body>.
 *                     opts.flash (rage / rage2 only) → plays one "invasion flash".
 *                     desire / vuoto / moonlight are pure color skins: no invasion
 *                     flash, no glitch layers (the gate is isRage()).
 *   get()           : returns the current mode string.
 *   decodeMessage(node) : runs a one-shot "arrival decode" over a message node that
 *                     just finalized (corrupt chars → real chars, swept left→right
 *                     once). Only fires in steady-state rage / rage2.
 *                     Call it the moment a message finalizes; do NOT call it while a
 *                     message is still streaming, or when loading history.
 *
 * Skin colors / masks / scanlines / wallpaper takeover all live in mood.css under
 * the body[data-mood] overrides. This file only drives: ① add/remove the attribute
 * ② the invasion-flash overlay ③ the rage steady-state glitch trio (arrival decode
 * + ambient corruption + big glitch), all in JS.
 *
 * Rules: any corruption must be legible again within ~1 second; a single timer;
 * pause while the page is hidden; under prefers-reduced-motion run NO JS animation
 * (colors still come through from CSS).
 *
 * This file does not touch the network — a server integration calls set() /
 * decodeMessage() (see PROTOCOL.md); the demo wires them to buttons.
 */
(function () {
  'use strict';

  // ── Integration points — change these two selectors to match your app. ──
  // Your AI message body node (the element whose text gets corrupted / decoded).
  var SELECTOR_AI_MSG = '.msg--assistant .assistant-msg';
  // Your chat background layer (moonlight injects the star/meteor children here).
  var SELECTOR_WALLPAPER = '.chat-wallpaper';

  var MAX_DECODE_CHARS = 600;   // arrival-decode perf ceiling: skip the animation on very long messages
  var BODY_GLITCH_CLASS = 'mood-glitch-flash';

  // Corruption glyph pool: block shades + half-width katakana + hex digits.
  var CORRUPT = ('▓▒░'
    + 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ'
    + '0123456789ABCDEF').split('');

  var _mode = 'off';
  var _ambientTimer = null;
  var _decodeGen = 0;

  // rage and rage2 share all corruption behavior (glitch trio / invasion flash / scanline timing).
  function isRage() { return _mode === 'rage' || _mode === 'rage2'; }

  function prefersReduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function corruptChar() {
    return CORRUPT[(Math.random() * CORRUPT.length) | 0];
  }

  // Read a frequency-class knob from mood.css (number / milliseconds). Skins tune
  // these by editing CSS only; this reader follows whatever the CSS says.
  function cssNum(name, fallback) {
    try {
      var raw = getComputedStyle(document.body).getPropertyValue(name).trim();
      if (!raw) return fallback;
      var n = parseFloat(raw);   // parseFloat eats a trailing 'ms' / unit
      return isNaN(n) ? fallback : n;
    } catch (_) { return fallback; }
  }

  /* ── Arrival decode: corrupt chars → real chars, swept left→right once ── */
  function decodeMessage(node) {
    if (!isRage() || !node || prefersReduced()) return;

    var items = [];   // { node, text }
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var tn, total = 0;
    while ((tn = walker.nextNode())) {
      var t = tn.nodeValue;
      if (t && /\S/.test(t)) { items.push({ node: tn, text: t }); total += t.length; }
    }
    if (!items.length || total > MAX_DECODE_CHARS) return;

    _decodeGen++;
    var myGen = _decodeGen;
    var start = 0;
    var DURATION = Math.min(900, 260 + total * 7);   // ≤ 900ms — legible-within-1s rule

    function restore() {
      for (var i = 0; i < items.length; i++) items[i].node.nodeValue = items[i].text;
    }
    function frame(now) {
      if (myGen !== _decodeGen || !isRage()) { restore(); return; }
      if (!start) start = now;
      var prog = Math.min(1, (now - start) / DURATION);
      var cut = Math.floor(prog * total);
      var idx = 0;
      for (var i = 0; i < items.length; i++) {
        var src = items[i].text, s = '';
        for (var j = 0; j < src.length; j++, idx++) {
          var ch = src[j];
          if (idx < cut || ch === ' ' || ch === '\n' || ch === '\t') s += ch;
          else s += corruptChar();
        }
        items[i].node.nodeValue = s;
      }
      if (prog < 1) requestAnimationFrame(frame);
      else restore();
    }
    requestAnimationFrame(frame);
  }

  /* ── Ambient corruption + big glitch: share a single timer ── */
  function aiNodesInView() {
    var out = [], list = document.querySelectorAll(SELECTOR_AI_MSG);
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.height > 0) out.push(list[i]);
    }
    return out;
  }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // Big glitch: whole text area gets RGB-split + a one-frame offset (~120ms), CSS-class driven.
  function bigGlitch() {
    document.body.classList.add(BODY_GLITCH_CLASS);
    setTimeout(function () { document.body.classList.remove(BODY_GLITCH_CLASS); }, 120);
  }

  // Ambient corruption: flash one random word into garbage for 100-200ms, then restore
  // (mutates a single text node's nodeValue).
  function corruptOneWord() {
    var nodes = aiNodesInView();
    if (!nodes.length) return;
    var host = pick(nodes);
    var texts = [];
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    var tn;
    while ((tn = walker.nextNode())) { if (tn.nodeValue && /\S{2}/.test(tn.nodeValue)) texts.push(tn); }
    if (!texts.length) return;
    var target = pick(texts);
    var orig = target.nodeValue;
    // Find a "word" = a run of 2+ non-whitespace chars.
    var words = [];
    var re = /\S{2,}/g, m;
    while ((m = re.exec(orig))) words.push({ i: m.index, len: m[0].length });
    if (!words.length) return;
    var w = pick(words);
    // Corrupt only a small 2-5 char window (scripts without spaces, e.g. CJK, make the
    // whole line one "word" — don't smear the entire message).
    var span = Math.min(w.len, 2 + (Math.random() * 4 | 0));
    var off = w.i + (Math.random() * (w.len - span + 1) | 0);
    var corrupted = orig.slice(0, off);
    for (var k = 0; k < span; k++) corrupted += corruptChar();
    corrupted += orig.slice(off + span);
    target.nodeValue = corrupted;
    setTimeout(function () {
      // Restore only if nothing else re-rendered over it (nodeValue is still our garbage).
      if (target.nodeValue === corrupted) target.nodeValue = orig;
    }, 100 + (Math.random() * 100 | 0));
  }

  function ambientTick() {
    if (!isRage() || document.hidden || prefersReduced()) return;
    var glitchChance = cssNum('--mood-rage-glitch-chance', 0.16);
    if (Math.random() < glitchChance) bigGlitch();
    else corruptOneWord();
  }

  function startRageTimers() {
    stopTimers();
    if (prefersReduced()) return;
    var interval = cssNum('--mood-rage-corrupt-interval', 2600);
    _ambientTimer = setInterval(ambientTick, Math.max(600, interval));
  }

  function stopTimers() {
    if (_ambientTimer) { clearInterval(_ambientTimer); _ambientTimer = null; }
    document.body.classList.remove(BODY_GLITCH_CLASS);
  }

  /* ── Invasion flash: full-screen overlay, horizontal slice offset + red/cyan
   *    chromatic split + white flash, ~300ms; the overlay fades out over ~1s and
   *    reveals the already-swapped red/black skin underneath. ── */
  function invasionFlash() {
    if (prefersReduced()) return;
    var ov = document.createElement('div');
    ov.className = 'mood-invade';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML =
      '<div class="mood-invade__slice"></div>' +
      '<div class="mood-invade__slice"></div>' +
      '<div class="mood-invade__slice"></div>' +
      '<div class="mood-invade__flash"></div>';
    document.body.appendChild(ov);
    var done = false;
    function kill() { if (done) return; done = true; if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('animationend', kill);
    setTimeout(kill, 1150);   // fallback: remove even if the animation event never lands
  }

  // ── Moonlight night sky / meteors — the stars and meteors are CHILD elements of
  //    the wallpaper, NOT pseudo-elements. A CSS filter (used to dim the wallpaper)
  //    ALSO applies to that element's pseudo-elements, which once dragged the stars
  //    down to half brightness. So dimming is done with a static scrim (::before),
  //    and the star layer (.mood-star-layer) plus three meteors
  //    (.mood-meteor--1/2/3, paired + occasional triple) are injected as children.
  //    All their styling lives in mood.css. ──
  function ensureMoonSky() {
    var walls = document.querySelectorAll(SELECTOR_WALLPAPER);
    for (var i = 0; i < walls.length; i++) {
      if (walls[i].querySelector('.mood-star-layer')) continue;
      var frag = document.createDocumentFragment();
      var stars = document.createElement('i');
      stars.className = 'mood-star-layer';
      frag.appendChild(stars);
      for (var k = 1; k <= 3; k++) {
        var m = document.createElement('i');
        m.className = 'mood-meteor mood-meteor--' + k;
        frag.appendChild(m);
      }
      walls[i].appendChild(frag);
    }
  }
  function removeMoonSky() {
    var els = document.querySelectorAll('.mood-star-layer, .mood-meteor');
    for (var i = 0; i < els.length; i++) {
      if (els[i].parentNode) els[i].parentNode.removeChild(els[i]);
    }
  }

  /* ── Public: set / get ── */
  function set(mode, opts) {
    opts = opts || {};
    mode = (mode === 'rage' || mode === 'rage2' || mode === 'desire'
            || mode === 'vuoto' || mode === 'moonlight') ? mode : 'off';
    var prev = _mode;
    _mode = mode;
    var body = document.body;

    if (mode === 'off') {
      body.removeAttribute('data-mood');
      stopTimers();
      removeMoonSky();
      return _mode;
    }
    body.setAttribute('data-mood', mode);
    if (mode === 'moonlight') { ensureMoonSky(); } else { removeMoonSky(); }
    if (mode === 'rage' || mode === 'rage2') {
      if (opts.flash && prev !== mode) invasionFlash();
      startRageTimers();
    } else {
      // desire / vuoto / moonlight: pure color skins, no jitter/noise — stop every corruption timer.
      stopTimers();
    }
    return _mode;
  }

  function get() { return _mode; }

  // When the page becomes visible again, if we're in rage and the timer got shut
  // off, restart it (prefersReduced is re-checked inside).
  document.addEventListener('visibilitychange', function () {
    if (isRage() && !document.hidden && !_ambientTimer) startRageTimers();
  });

  window.Pelle = { set: set, get: get, decodeMessage: decodeMessage };
})();
