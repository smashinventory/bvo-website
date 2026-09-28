'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   carousels.js — generic horizontal carousel binding

   WHY THIS EXISTS
   site.js bound the two homepage carousels with getElementById on the
   fixed ids "fmCarouselTrack" and "catCarouselTrack". That works for
   exactly one instance. Once Featured Models / Featured Products /
   Category Grid became duplicatable, a second copy emitted the same id,
   getElementById returned only the first, and the copy's arrows were dead
   while its cards never received a width from the ResizeObserver — a
   section that renders but does not work, with nothing logged.

   site.js has no unminified source in the repo (the minify step overwrote
   it in place), so rather than edit minified code this file rebinds the
   same behaviour by data attribute across every instance. index.ejs no
   longer emits those two ids, so the original site.js blocks fail their
   own `if (track && prev && next)` guard and no-op. Removing the ids is
   what prevents double-binding — if they were left in place both this
   file and site.js would attach scroll handlers to the first carousel.

   MARKUP CONTRACT
     <div data-carousel data-carousel-card=".model-card" data-carousel-per="1.2,2,4">
       <button data-carousel-prev>  <div data-carousel-track>  <button data-carousel-next>

   data-carousel-per is "cards visible under 520px, under 768px, above" —
   it reproduces the two different sets of breakpoint values the original
   code used (models 1.2/2/4, categories 1.5/2/4).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var GAP = 20; // matches the CSS gap on both tracks

  function initCarousel(root) {
    var track = root.querySelector('[data-carousel-track]');
    var prev  = root.querySelector('[data-carousel-prev]');
    var next  = root.querySelector('[data-carousel-next]');
    if (!track || !prev || !next) return;

    var cardSel = root.getAttribute('data-carousel-card') || '.model-card';
    var perRaw  = (root.getAttribute('data-carousel-per') || '1.2,2,4').split(',');
    var perSm   = parseFloat(perRaw[0]) || 1.2;
    var perMd   = parseFloat(perRaw[1]) || 2;
    var perLg   = parseFloat(perRaw[2]) || 4;

    function step() {
      var card = track.querySelector(cardSel);
      return card ? card.offsetWidth + GAP : 280;
    }

    function syncArrows() {
      var atStart = track.scrollLeft <= 2;
      var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      if (atStart) prev.setAttribute('hidden', ''); else prev.removeAttribute('hidden');
      if (atEnd)   next.setAttribute('hidden', ''); else next.removeAttribute('hidden');
    }

    prev.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    next.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });
    track.addEventListener('scroll', syncArrows, { passive: true });

    /* ResizeObserver rather than a window resize listener — same as the
       original, which was changed to avoid forced reflows. */
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function (entries) {
        var w = entries[0] && entries[0].contentRect.width;
        if (!w) return;
        var vw  = window.innerWidth;
        var per = vw < 520 ? perSm : (vw < 768 ? perMd : perLg);
        var cardW = Math.floor((w - GAP * (per - 1)) / per);
        requestAnimationFrame(function () {
          track.querySelectorAll(cardSel).forEach(function (c) {
            c.style.width    = cardW + 'px';
            c.style.minWidth = cardW + 'px';
          });
          syncArrows();
        });
      }).observe(track);
    } else {
      syncArrows();
    }
  }

  function initAll() {
    document.querySelectorAll('[data-carousel]').forEach(function (root) {
      // Guard against double-init if this ever runs twice.
      if (root.getAttribute('data-carousel-ready') === '1') return;
      root.setAttribute('data-carousel-ready', '1');
      initCarousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();

/* ═══════════════════════════════════════════════════════════════════════
   Variant navigation on PRODUCT cards

   A model card can switch variants in place — it links to a filtered
   collection, so changing the pictured size is honest. A product card is
   one SKU: swapping only the photo left the price and the "View Details"
   link on the original product, so clicking 72" showed a 72" picture over
   a 24" price and led to the 24" page.

   Chips on product cards now carry data-variant-href and navigate.

   ── WHY CAPTURE PHASE ──────────────────────────────────────────────────
   site.js binds .model-card-size-btn and .model-card-swatch on the
   BUBBLE phase and calls preventDefault()/stopPropagation() to do its
   in-place image swap. A plain link or a bubble-phase listener here would
   be swallowed by it. Capture runs first, so this wins — without editing
   site.js, which has no unminified source in the repo.

   Model-card chips have no data-variant-href, so they fall through
   untouched and keep the in-place swap. That behaviour is deliberate and
   is what makes model cards feel good; nothing here changes it.

   ── 2026-09-28: COLOUR SWATCHES NO LONGER NAVIGATE ────────────────────
   SIZE chips still do, and everything above still describes them.
   Colour swatches on product cards now carry data-variant instead and
   are handled by the block BELOW this one, which repaints the whole card
   rather than just the photo. Read that block before changing this one.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest
      ? e.target.closest('[data-variant-href]')
      : null;
    if (!el) return;

    var href = el.getAttribute('data-variant-href');
    if (!href) return;

    // Let modified clicks behave normally (new tab, download, etc).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    window.location.href = href;
  }, true); // ← capture
})();

/* ═══════════════════════════════════════════════════════════════════════
   In-place COLOUR swap on PRODUCT cards          (owner request 2026-09-28)

   "On the product cards for huntington brass ... when you click on a
   color swatch instead of showing you the image of the item in the
   selected color, you are taken to the product page."

   ── WHY IT USED TO NAVIGATE ────────────────────────────────────────────
   A product card is one SKU. site.js swaps only the PHOTO, which left a
   Matte Black picture sitting over a Polished Chrome price, above a
   "View Details" link to the chrome page. Navigating was the honest fix
   available at the time, not a preference.

   This removes the cause instead. data-variant carries the other
   colour's id, slug, price, compare_price, photo, stock and saved-state,
   so every part of the card that names a SKU moves together:

       photo · price · was-price · Save badge · QTY · image link ·
       title link · View Details link · heart (id, slug, filled state)

   If any of that is ever extended, extend it HERE too. A field left
   behind is the original defect coming back in a smaller form.

   ── THE PARTS THAT ARE REMOVED, NOT UPDATED ────────────────────────────
   The corner badge, the hover photo and the video badge belong to the
   product the page was rendered for and are not carried per colour. They
   are deleted on the first swap rather than left in place: a BEST badge
   or a video that belongs to a different SKU is worse than no badge.

   ── CAPTURE PHASE, AND WHY stopPropagation MATTERS ─────────────────────
   Same reason as the block above: site.js binds .model-card-swatch on
   the bubble phase. If it ran after this it would do its own partial
   photo swap on top, re-introducing exactly the mismatch this removes.
   Capture + stopPropagation means this is the only handler that runs.

   Swatches WITHOUT a complete variant record keep data-variant-href and
   navigate, per swatch. See views/pages/collection.ejs.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var BUNNY = 'images.bathroomvanitiesoutlet.com';

  /* The listing's srcset ladder, mirrored. Setting src alone does
     nothing visible while a srcset is present — the browser keeps
     serving the candidate it already chose, so the photo would not
     change at all. Same guards as the template: Bunny only, and never
     touch a URL that already carries a query. */
  function ladder(url) {
    if (url.indexOf(BUNNY) === -1 || url.indexOf('?') !== -1) return '';
    return [320, 400, 480, 640, 800]
      .map(function (w) { return url + '?width=' + w + ' ' + w + 'w'; })
      .join(', ');
  }

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  /* The QTY ladder from collection.ejs. Deliberately duplicated rather
     than sent down per swatch: it is display banding, not data, and the
     two copies are asserted equal by gates/gate_color_swap.js. */
  function qtyBand(q) {
    return q <= 3 ? q : q <= 6 ? 4 : q <= 9 ? 5 : q <= 12 ? 6
         : q <= 15 ? 7 : q <= 20 ? 8 : 9;
  }

  function parseVariant(el) {
    try { return JSON.parse(el.getAttribute('data-variant')); }
    catch (err) { return null; }   /* Malformed: fall through to normal click. */
  }

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-variant]');
    if (!el) return;

    /* Scoped to product cards. A model card has no per-SKU price to be
       wrong about and keeps site.js's photo-only swap. */
    var card = el.closest('.product-card');
    if (!card) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    var v = parseVariant(el);
    if (!v || !v.slug) return;

    e.preventDefault();
    e.stopPropagation();

    /* ── photo ── */
    var img = card.querySelector('.product-img-pri');
    if (img && v.image) {
      var ls = ladder(v.image);
      if (ls) { img.setAttribute('srcset', ls); }
      else    { img.removeAttribute('srcset'); img.removeAttribute('sizes'); }
      img.src = v.image + (v.image.indexOf('?') === -1 ? '?width=800' : '');
    }

    /* ── things that belonged to the original SKU ── */
    var hov = card.querySelector('.product-img-hov');
    if (hov) { hov.parentNode.removeChild(hov); }
    card.classList.remove('has-hover-img');
    ['.product-badge', '.product-video-badge'].forEach(function (sel) {
      var n = card.querySelector(sel);
      if (n) n.parentNode.removeChild(n);
    });

    /* ── price block, rebuilt whole ── */
    var price = card.querySelector('[data-card-price]');
    if (price && v.price != null) {
      if (v.was != null && v.was > v.price) {
        price.innerHTML =
          '<span class="card-price__sale">' + money(v.price) + '</span>' +
          '<span class="card-price__was">'  + money(v.was)   + '</span>' +
          '<span class="card-save-badge">Save ' + money(v.was - v.price) + '</span>';
      } else {
        price.innerHTML =
          '<span class="card-price__regular">' + money(v.price) + '</span>';
      }
    }

    /* ── stock ── */
    var qty = card.querySelector('[data-card-qty]');
    if (qty && v.qty != null) {
      var q = Number(v.qty) || 0;
      qty.textContent = 'QTY: ' + qtyBand(q);
      qty.classList.toggle('card-qty--zero', q === 0);
    }
    card.classList.toggle('product-card--no-stock', Number(v.qty || 0) === 0);

    /* ── the heading, which NAMES the colour ──
       "Supply Elbow & Holder — PVD Satin Brass". Caught on the live
       page: photo and price had moved to Matte Black while the heading
       still read PVD Satin Brass. textContent, never innerHTML — the
       name is database text and must not be parsed as markup. */
    var titleLink = card.querySelector('.product-title a');
    if (titleLink && v.name) titleLink.textContent = v.name;
    if (img && v.name) img.setAttribute('alt', v.name);

    /* ── every link that points at a SKU ── */
    ['.product-img-link', '.product-title a', '.btn-sage'].forEach(function (sel) {
      var a = card.querySelector(sel);
      if (a) a.setAttribute('href', v.slug);
    });

    /* Screen-reader labels name the product too, so they move with it. */
    var imgLink = card.querySelector('.product-img-link');
    if (imgLink && v.name) imgLink.setAttribute('aria-label', v.name);
    var srOnly = card.querySelector('.btn-sage .sr-only');
    if (srOnly && v.name) srOnly.textContent = ' — ' + v.name;

    /* ── favourites ── */
    var heart = card.querySelector('.heart-btn');
    if (heart && v.id) {
      heart.setAttribute('data-product-id', v.id);
      heart.setAttribute('data-product-slug', v.slug.replace('/products/', ''));
      heart.classList.toggle('is-saved', !!Number(v.saved));
    }

    /* ── which swatch reads as selected ── */
    var group = el.closest('.model-card-swatches');
    if (group) {
      group.querySelectorAll('.model-card-swatch').forEach(function (b) {
        b.classList.remove('is-active');
      });
    }
    el.classList.add('is-active');
  }, true); /* ← capture, so site.js's bubble handler never runs */
})();
