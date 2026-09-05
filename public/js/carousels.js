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
