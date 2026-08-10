/* ─────────────────────────────────────────────────────────────────
   BVO Admin SEO Utility  v1.0
   Provides:
     • BvoSeo.autoFill()   – auto-populate meta fields from source text
     • BvoSeo.counter()    – live char counter with green/amber/red
     • BvoSeo.serpPreview()– live Google SERP snippet preview
   Loaded by product-edit, model-edit, category-edit, blog-edit pages.
   ───────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var SITE_DOMAIN = 'bathroomvanitiesoutlet.com';

  /* ── Helpers ──────────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function trunc(str, n, suffix) {
    var s = (str || '').replace(/<[^>]*>/g, '').trim(); // strip HTML
    suffix = suffix || '…';
    return s.length > n ? s.slice(0, n).trimEnd() + suffix : s;
  }

  /* ── Char counter with color coding ──────────────────────────────
     warnAt = yellow threshold (e.g. 60 for titles, 160 for desc)
     errAt  = red threshold    (e.g. 70 for titles, 200 for desc)  */
  function counter(inputId, counterId, warnAt, errAt) {
    var inp = document.getElementById(inputId);
    var ctr = document.getElementById(counterId);
    if (!inp || !ctr) return;
    function upd() {
      var n = inp.value.length;
      ctr.textContent = n;
      ctr.className = (ctr.className || '').replace(/\bseo-\w+/g, '').trim();
      if      (n > errAt)  ctr.classList.add('seo-err');
      else if (n > warnAt) ctr.classList.add('seo-warn');
      else if (n > 0)      ctr.classList.add('seo-ok');
    }
    upd();
    inp.addEventListener('input', upd);
  }

  /* ── Auto-fill ────────────────────────────────────────────────────
     Rules:
       1. If target already has a saved value → lock it (do not overwrite).
       2. If target is empty on page load → fill immediately from source.
       3. While target is unlocked, keep it in sync as source changes.
       4. User typing in target → lock it (stops auto-fill).
       5. ↺ Reset button → unlock and re-fill from source.           */
  function autoFill(srcId, tgtId, transform) {
    var src = document.getElementById(srcId);
    var tgt = document.getElementById(tgtId);
    if (!src || !tgt) return;

    // Rule 1: existing saved value → treat as manual (do not overwrite)
    if (tgt.value.trim()) {
      tgt.dataset.manual = '1';

    // Rule 2: empty on page load → fill immediately from current source value
    } else {
      var initial = transform(src.value.trim());
      if (initial) {
        tgt.value = initial;
        tgt.dispatchEvent(new Event('input')); // trigger counters + SERP
      }
    }

    // Rule 3: keep in sync while unlocked
    src.addEventListener('input', function () {
      if (tgt.dataset.manual) return;
      var v = transform(src.value.trim());
      if (tgt.value !== v) {
        tgt.value = v;
        tgt.dispatchEvent(new Event('input'));
      }
    });

    // Rule 4: user typing in target → lock
    tgt.addEventListener('keydown', function () {
      tgt.dataset.manual = '1';
    });

    // Rule 5: ↺ Reset button (id = tgtId + '_reset')
    var resetBtn = document.getElementById(tgtId + '_reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function (e) {
        e.preventDefault();
        delete tgt.dataset.manual;
        tgt.value = transform(src.value.trim());
        tgt.dispatchEvent(new Event('input'));
        tgt.focus();
      });
    }
  }

  /* ── Live SERP preview ────────────────────────────────────────────
     cfg = {
       containerId : 'serpPreview',
       titleId     : 'meta_title',
       descId      : 'meta_desc',
       urlPath     : '/products/my-slug',
       defaultTitle: 'Product Name',
       defaultDesc : 'Short description…',
     }                                                               */
  function serpPreview(cfg) {
    var box = document.getElementById(cfg.containerId);
    if (!box) return;
    var titleEl = document.getElementById(cfg.titleId);
    var descEl  = document.getElementById(cfg.descId);

    function render() {
      var t = (titleEl ? titleEl.value.trim() : '') || cfg.defaultTitle || '';
      var d = (descEl  ? descEl.value.trim()  : '') || cfg.defaultDesc  || '';
      var tShort = t.slice(0, 60);
      var dShort = d.slice(0, 160);
      var tOver  = t.length > 60;
      var dOver  = d.length > 160;

      box.innerHTML =
        '<div class="serp-label">Google Preview</div>' +
        '<div class="serp-inner">' +
          '<div class="serp-url">' + esc(SITE_DOMAIN + (cfg.urlPath || '')) + '</div>' +
          '<div class="serp-title' + (tOver ? ' serp-over' : '') + '">' +
            esc(tShort || '(Title will appear here)') +
            (tOver ? '<span class="serp-clip">…</span>' : '') +
          '</div>' +
          '<div class="serp-desc' + (dOver ? ' serp-over' : '') + '">' +
            esc(dShort || '(Meta description will appear here)') +
            (dOver ? '<span class="serp-clip">…</span>' : '') +
          '</div>' +
        '</div>';
    }

    if (titleEl) titleEl.addEventListener('input', render);
    if (descEl)  descEl.addEventListener('input',  render);
    render();
  }

  /* ── Public API ───────────────────────────────────────────────── */
  w.BvoSeo = {
    counter:     counter,
    autoFill:    autoFill,
    serpPreview: serpPreview,
    trunc:       trunc,
  };

})(window);
