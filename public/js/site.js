'use strict';
/* BathroomVanitiesOutlet.com — Site JS */

// ── Before/After Slider ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var wrap   = document.querySelector('.ba-slider-wrap');
  var before = document.getElementById('baBefore');
  var handle = document.getElementById('baHandle');
  if (!wrap || !before || !handle) return;

  // Keep CSS var in sync so before-image always matches full slider width
  function syncWidth() {
    wrap.style.setProperty('--slider-w', wrap.offsetWidth + 'px');
  }
  syncWidth();
  window.addEventListener('resize', syncWidth);

  function setPos(pct) {
    pct = Math.min(100, Math.max(0, pct));
    before.style.width = pct + '%';
    handle.style.left  = pct + '%';
    handle.setAttribute('aria-valuenow', Math.round(pct));
  }
  var _baSlider   = document.getElementById('baSlider');
  var _baInitial  = _baSlider ? parseFloat(_baSlider.dataset.initial) : NaN;
  setPos(isNaN(_baInitial) ? 50 : _baInitial);

  function getPct(clientX) {
    var r = wrap.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  }

  // Click anywhere to jump, then drag
  wrap.addEventListener('mousedown', function (e) {
    e.preventDefault();
    setPos(getPct(e.clientX));
    function onMove(e) { setPos(getPct(e.clientX)); }
    function onUp()   { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  // Touch
  wrap.addEventListener('touchstart', function (e) {
    setPos(getPct(e.touches[0].clientX));
    function onMove(e) { e.preventDefault(); setPos(getPct(e.touches[0].clientX)); }
    function onEnd()   { wrap.removeEventListener('touchmove', onMove); wrap.removeEventListener('touchend', onEnd); }
    wrap.addEventListener('touchmove', onMove, { passive: false });
    wrap.addEventListener('touchend',  onEnd);
  }, { passive: true });

  // Keyboard on handle
  handle.addEventListener('keydown', function (e) {
    var cur = parseFloat(handle.getAttribute('aria-valuenow') || 50);
    if (e.key === 'ArrowLeft')  { setPos(cur - 2); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos(cur + 2); e.preventDefault(); }
  });
});

// ── Newsletter form ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var nForm = document.getElementById('newsletterForm');
  if (!nForm) return;
  nForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = nForm.querySelector('[name="email"]').value.trim();
    if (!email) return;
    fetch('/account/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).catch(function () {});
    var wrap = nForm.querySelector('.newsletter-input-wrap');
    if (wrap) wrap.style.display = 'none';
    var s = document.getElementById('newsletterSuccess');
    if (s) s.hidden = false;
  });
});

// ── Filter sidebar collapse/expand ────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.filter-group-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      var body = btn.nextElementSibling;
      if (body) body.classList.toggle('is-collapsed', expanded);
    });
  });
});

// ── Scroll-position preservation across filter/sort changes ───────
(function () {
  var SCROLL_KEY = 'bvo_filter_scroll';

  // Restore scroll position immediately on load (before DOMContentLoaded)
  // so the page doesn't flash at the top. rAF ensures layout is ready first.
  var savedY = sessionStorage.getItem(SCROLL_KEY);
  if (savedY !== null) {
    sessionStorage.removeItem(SCROLL_KEY);
    requestAnimationFrame(function () {
      window.scrollTo(0, parseInt(savedY, 10));
    });
  }

  function saveScroll() {
    sessionStorage.setItem(SCROLL_KEY, window.scrollY);
  }

  // Export so the color-filter block (below) can call it before navigating
  window._bvoSaveScroll = saveScroll;

  document.addEventListener('DOMContentLoaded', function () {
    // Save scroll before any filter or sort form submission
    var filterForm = document.getElementById('filter-form');
    if (filterForm) filterForm.addEventListener('submit', saveScroll);

    var sortForm = document.getElementById('sort-form');
    if (sortForm) sortForm.addEventListener('submit', saveScroll);

    // Auto-select price input text on focus so typing immediately replaces
    // the old value instead of appending to it.
    document.querySelectorAll('input[name="min_price"], input[name="max_price"]').forEach(function (el) {
      el.addEventListener('focus', function () { this.select(); });
    });

    // ── Checkbox filter navigation ─────────────────────────────────
    // Delegated listener on the whole filter panel so it works for
    // every checkbox regardless of inline-script restrictions.
    // Cabinet-color uses its own JS (color swatches + sub-chips);
    // price range uses a submit button — both are intentionally excluded.
    var filterPanel = document.querySelector('.filter-panel');
    if (filterPanel) {
      filterPanel.addEventListener('change', function (e) {
        var el = e.target;
        if (el.type !== 'checkbox') return;
        // Skip checkboxes inside the cabinet-color group (handled separately)
        if (el.closest && el.closest('#color-filter-group')) return;

        saveScroll();
        var sp  = new URLSearchParams(window.location.search);
        sp.delete('page');
        var key      = el.name;
        var value    = el.value;
        var existing = sp.getAll(key);

        if (el.checked) {
          if (!existing.includes(value)) sp.append(key, value);
        } else {
          sp.delete(key);
          existing.filter(function (v) { return v !== value; })
                  .forEach(function (v) { sp.append(key, v); });
        }
        window.location.search = sp.toString();
      });
    }
  });
})();

// ── Product page: gallery lightbox + carousel dots + qty stepper ──
(function () {

  // ── Qty stepper (changeQty called by onclick in HTML) ────────────
  var qtyVal = document.getElementById('qty-val');
  var atcQty = document.getElementById('atc-qty');
  var _qty   = 1;
  window.changeQty = function (delta) {
    _qty = Math.max(1, _qty + delta);
    if (qtyVal) qtyVal.textContent = _qty;
    if (atcQty) atcQty.value = _qty;
  };

  // ── Lightbox ──────────────────────────────────────────────────────
  var _lb      = document.getElementById('pdp-lightbox');
  if (!_lb) return;

  var _lbImg   = document.getElementById('lb-img');
  var _lbCtr   = document.getElementById('lb-counter');
  var _lbThmbs = document.querySelectorAll('.lb-thumb');
  var _total   = _lbThmbs.length;
  var _cur     = 0;

  var pdpLightbox = {
    open: function (idx) {
      _lb.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      this.goTo(idx || 0);
    },
    close: function () {
      _lb.setAttribute('hidden', '');
      document.body.style.overflow = '';
    },
    prev: function () { this.goTo((_cur - 1 + _total) % _total); },
    next: function () { this.goTo((_cur + 1) % _total); },
    goTo: function (idx) {
      _cur = idx;
      var btn = _lbThmbs[idx];
      if (!btn) return;
      var img = btn.querySelector('img');
      _lbImg.src = img ? img.src : '';
      _lbImg.alt = img ? img.alt : '';
      if (_lbCtr) _lbCtr.textContent = (idx + 1) + ' / ' + _total;
      _lbThmbs.forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      // scroll thumbnail into view
      btn.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
    }
  };
  window.pdpLightbox = pdpLightbox;

  // Close on overlay click (but not on controls)
  _lb.addEventListener('click', function (e) {
    if (e.target === _lb) pdpLightbox.close();
  });

  // Keyboard nav
  document.addEventListener('keydown', function (e) {
    if (_lb.hasAttribute('hidden')) return;
    if (e.key === 'ArrowLeft')  pdpLightbox.prev();
    if (e.key === 'ArrowRight') pdpLightbox.next();
    if (e.key === 'Escape')     pdpLightbox.close();
  });

  // Touch swipe on lb-stage
  (function () {
    var stage = _lb.querySelector('.lb-stage');
    if (!stage) return;
    var startX = 0;
    stage.addEventListener('touchstart', function (e) { startX = e.changedTouches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend',   function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) pdpLightbox.next(); else pdpLightbox.prev();
    });
  })();

  // ── Carousel dot sync (tablet / mobile) ──────────────────────────
  (function () {
    var grid = document.getElementById('gallery-grid');
    var dots = document.querySelectorAll('.gallery-dot');
    if (!grid || !dots.length) return;

    function updateDots () {
      var items = grid.querySelectorAll('.gallery-item');
      if (!items.length) return;
      var W   = grid.offsetWidth;
      var idx = Math.round(grid.scrollLeft / W);
      dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    grid.addEventListener('scroll', updateDots, { passive: true });
    // Dot click → scroll to that slide
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        grid.scrollTo({ left: i * grid.offsetWidth, behavior: 'smooth' });
      });
    });
    updateDots();
  })();

})();

// ── Predictive search overlay ─────────────────────────────────────
(function () {
  var input   = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var timer;

  function renderHit(h) {
    var price = h.price ? '$' + parseFloat(h.price).toFixed(2) : '';
    var img   = h.image
      ? '<img src="' + h.image + '" alt="' + h.name + '" loading="lazy">'
      : '<span class="search-hit-img-placeholder"></span>';
    var badge = h.badge
      ? '<span class="product-badge badge-' + h.badge + '" style="font-size:.6rem;padding:2px 6px">' + h.badge.toUpperCase() + '</span>'
      : '';
    return '<a href="' + h.url + '" class="search-hit">'
      + '<div class="search-hit-img">' + img + '</div>'
      + '<div class="search-hit-body">'
      +   '<span class="search-hit-name">' + h.name + '</span>'
      +   (h.brand ? '<span class="search-hit-brand">' + h.brand + '</span>' : '')
      +   '<span class="search-hit-price">' + price + ' ' + badge + '</span>'
      + '</div>'
      + '</a>';
  }

  function search(q) {
    if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
    fetch('/api/search/predict?q=' + encodeURIComponent(q) + '&limit=8')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.hits || !data.hits.length) {
          results.innerHTML = '<p class="search-no-results">No results for "' + q + '"</p>';
        } else {
          results.innerHTML = data.hits.map(renderHit).join('');
        }
        results.hidden = false;
      })
      .catch(function () { results.hidden = true; });
  }

  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { search(input.value.trim()); }, 220);
  });

  // Hide on click outside
  document.addEventListener('click', function (e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.hidden = true;
    }
  });

  // Keyboard: Escape closes, Enter goes to /search
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { results.hidden = true; input.blur(); }
    if (e.key === 'Enter') {
      var q = input.value.trim();
      if (q) window.location = '/search?q=' + encodeURIComponent(q);
    }
  });
})();

// ── Color family filter ────────────────────────────────────────────
(function () {
  var familyRow = document.getElementById('color-family-row');
  if (!familyRow) return;

  // ── URL param helpers ──────────────────────────────────────────
  function getColorState() {
    var sp = new URLSearchParams(window.location.search);
    return {
      families: sp.getAll('color_family'),
      exact:    sp.getAll('color_exact'),
    };
  }

  function navigate(families, exact) {
    if (window._bvoSaveScroll) window._bvoSaveScroll();
    var sp = new URLSearchParams(window.location.search);
    sp.delete('color_family');
    sp.delete('color_exact');
    sp.delete('page');  // reset pagination on filter change
    families.forEach(function (f) { sp.append('color_family', f); });
    exact.forEach(function (e)    { sp.append('color_exact',   e); });
    window.location.search = sp.toString();
  }

  // ── Family swatch click ────────────────────────────────────────
  familyRow.querySelectorAll('[data-color-key]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var key    = sw.dataset.colorKey;
      var state  = getColorState();
      var subRow = document.getElementById('color-sub-' + key);

      // Collect all exact values that belong to this family
      var familyMembers = [];
      if (subRow) {
        subRow.querySelectorAll('[data-color-exact]').forEach(function (chip) {
          familyMembers.push(chip.dataset.colorExact);
        });
      }

      var isActive = state.families.includes(key) ||
        state.exact.some(function (e) { return familyMembers.includes(e); });

      if (isActive) {
        // Deselect: remove this family + all its exact values
        navigate(
          state.families.filter(function (f) { return f !== key; }),
          state.exact.filter(function (e)    { return !familyMembers.includes(e); })
        );
      } else {
        // Select at family level (clear any stale exact values for this family first)
        var newFamilies = state.families.concat([key]);
        var newExact    = state.exact.filter(function (e) { return !familyMembers.includes(e); });
        navigate(newFamilies, newExact);
      }
    });

    // Keyboard accessibility
    sw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
    });
  });

  // ── Sub-chip click (multi-select within family) ────────────────
  document.querySelectorAll('.color-sub-chip[data-color-exact]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var value     = chip.dataset.colorExact;
      var familyKey = chip.dataset.colorFamily;
      var state     = getColorState();

      // All exact values for this family (from the sub-chip row)
      var subRow = document.getElementById('color-sub-' + familyKey);
      var familyMembers = [];
      if (subRow) {
        subRow.querySelectorAll('[data-color-exact]').forEach(function (c) {
          familyMembers.push(c.dataset.colorExact);
        });
      }

      var newFamilies = state.families.slice();
      var newExact    = state.exact.slice();

      if (newExact.includes(value)) {
        // Deselect this chip
        newExact = newExact.filter(function (e) { return e !== value; });
        // If no more exact values remain for this family, also clear the family
        var remaining = newExact.filter(function (e) { return familyMembers.includes(e); });
        if (!remaining.length) {
          newFamilies = newFamilies.filter(function (f) { return f !== familyKey; });
        }
      } else {
        // Select this chip
        // Ensure the family key is present (so family swatch stays highlighted)
        if (!newFamilies.includes(familyKey)) newFamilies.push(familyKey);
        // Remove family-level-only entry if switching to sub-chip mode
        // (family swatch stays active but filter is driven by exact values)
        newExact.push(value);
      }

      navigate(newFamilies, newExact);
    });
  });

  // ── On page load: open sub-chip rows for families with active state ──
  // (The server renders is-open via EJS, but JS handles edge cases)
  document.querySelectorAll('.color-sub-row.is-open').forEach(function (row) {
    row.style.display = 'block';
  });
})();

// ── Search toggle (magnifying glass icon) ─────────────────────────
(function () {
  var searchBtn  = document.getElementById('nav-search-btn');
  var searchBar  = document.getElementById('site-search-bar');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  if (!searchBtn || !searchBar) return;

  var _expandTimer;

  function openSearch() {
    searchBar.classList.add('is-open');
    searchBtn.setAttribute('aria-expanded', 'true');
    searchBtn.setAttribute('aria-label', 'Close search');
    // After the 280ms slide animation, switch overflow to visible so the
    // results dropdown can render below the search bar (otherwise clipped).
    _expandTimer = setTimeout(function () {
      searchBar.classList.add('is-expanded');
      if (searchInput) searchInput.focus();
    }, 300);
  }

  function closeSearch() {
    clearTimeout(_expandTimer);
    // Remove is-expanded first so overflow:hidden snaps back before collapsing
    searchBar.classList.remove('is-expanded');
    searchBar.classList.remove('is-open');
    searchBtn.setAttribute('aria-expanded', 'false');
    searchBtn.setAttribute('aria-label', 'Open search');
    if (searchResults) { searchResults.hidden = true; searchResults.innerHTML = ''; }
  }

  searchBtn.addEventListener('click', function () {
    var isOpen = searchBar.classList.contains('is-open');
    isOpen ? closeSearch() : openSearch();
  });

  // Escape key closes search
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && searchBar.classList.contains('is-open')) {
      closeSearch();
      searchBtn.focus();
    }
  });

  // Click outside header closes search
  document.addEventListener('click', function (e) {
    var header = document.querySelector('.site-header');
    if (header && !header.contains(e.target) && searchBar.classList.contains('is-open')) {
      closeSearch();
    }
  });
})();

// ── Model card: finish swatch swap + carousel arrows ─────────────────
(function () {

  // ── Shared helper: parse data-size-images JSON safely ───────────
  function parseSizeImages(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (ex) { return {}; }
  }

  // ── Shared helper: set exactly one active size chip on a card ────
  // Returns the size key that was activated (or null).
  function activateSizeChip(card, targetSz) {
    if (!card) return null;
    var chips = card.querySelectorAll('.model-card-size-btn');
    var activated = null;
    chips.forEach(function (c) {
      if (Number(c.dataset.size) === targetSz) {
        c.classList.add('is-active');
        activated = targetSz;
      } else {
        c.classList.remove('is-active');
      }
    });
    return activated;
  }

  // ── Finish swatch swap ───────────────────────────────────────────
  // Priority: intersection (this color × active size).
  // If that image is missing, find the nearest size this color DOES
  // have an image for, show it, and update the active size chip so
  // all three signals stay in sync: swatch, size chip, card image.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.model-card-swatch');
    if (!btn) return;

    var wasActive = btn.classList.contains('is-active');
    var card      = btn.closest('.model-card');
    var si        = parseSizeImages(btn.dataset.sizeImages);
    var siKeys    = Object.keys(si).map(Number).filter(function (n) { return n > 0; })
                          .sort(function (a, b) { return a - b; });

    var activeSzBtn = card ? card.querySelector('.model-card-size-btn.is-active') : null;
    var activeSz    = activeSzBtn ? Number(activeSzBtn.dataset.size) : NaN;

    var imgId = btn.dataset.targetImg;
    var img   = imgId ? document.getElementById(imgId) : null;
    if (img) {
      var newSrc  = null;

      if (siKeys.length > 0) {
        // Try exact intersection first
        if (!isNaN(activeSz) && si[activeSz]) {
          newSrc = si[activeSz];
        } else {
          // Find nearest available size in this color, update the chip to match
          var nearest = siKeys.reduce(function (prev, curr) {
            return (Math.abs(curr - activeSz) < Math.abs(prev - activeSz)) ? curr : prev;
          }, siKeys[0]);
          newSrc = si[nearest];
          activateSizeChip(card, nearest);   // keep chip in sync with the image shown
        }
      }

      // Final fallback: color-level default image
      if (!newSrc && btn.dataset.image) newSrc = btn.dataset.image;
      if (newSrc) img.src = newSrc;
    }

    // Update price display
    var priceId = btn.dataset.targetPrice;
    var priceEl = priceId ? document.getElementById(priceId) : null;
    if (priceEl) {
      var sp       = parseSizeImages(btn.dataset.sizePrices);
      var priceVal = (!isNaN(activeSz) && sp[activeSz] != null) ? sp[activeSz] : null;
      if (priceVal != null) {
        priceEl.textContent = '$' + Number(priceVal).toLocaleString('en-US');
      } else {
        priceEl.textContent = priceEl.dataset['default'] || '';
      }
    }

    // Toggle swatch is-active (always keep one active; toggle off only if already on)
    var group = btn.closest('.model-card-swatches');
    if (group) {
      group.querySelectorAll('.model-card-swatch').forEach(function (s) {
        s.classList.remove('is-active');
      });
      if (!wasActive) btn.classList.add('is-active');
    }
  });

  // ── Size chip image swap ─────────────────────────────────────────
  // Priority: intersection (active color × this size).
  // Falls back to size-level fallback image.
  // Size chips never toggle off — clicking the active chip re-selects
  // it so there is always a valid size context for the next swatch click.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.model-card-size-btn');
    if (!btn) return;

    e.stopPropagation();
    e.preventDefault();

    var sz   = btn.dataset.size;
    var card = btn.closest('.model-card, .product-card');

    var imgId = btn.dataset.targetImg;
    var img   = imgId ? document.getElementById(imgId) : null;
    if (img) {
      var newSrc = null;
      if (card && sz) {
        var activeSw = card.querySelector('.model-card-swatch.is-active');
        if (activeSw && activeSw.dataset.sizeImages) {
          var si = parseSizeImages(activeSw.dataset.sizeImages);
          newSrc = si[sz] || si[Number(sz)] || null;
        }
      }
      // Fallback: size-level image (any color for this width)
      if (!newSrc && btn.dataset.image) newSrc = btn.dataset.image;
      if (newSrc) img.src = newSrc;
    }

    // Update price display
    var priceId2 = btn.dataset.targetPrice;
    var priceEl2 = priceId2 ? document.getElementById(priceId2) : null;
    if (priceEl2) {
      // Priority 1: exact color × size price from active swatch
      var activeSwatch = card ? card.querySelector('.model-card-swatch.is-active') : null;
      var exactPrice   = null;
      if (activeSwatch && activeSwatch.dataset.sizePrices && sz) {
        var spMap = parseSizeImages(activeSwatch.dataset.sizePrices);
        exactPrice = spMap[sz] != null ? spMap[sz] : (spMap[Number(sz)] != null ? spMap[Number(sz)] : null);
      }
      if (exactPrice != null) {
        priceEl2.textContent = '$' + Number(exactPrice).toLocaleString('en-US');
      } else {
        // Priority 2: size-level min price (priceFrom)
        var pf = btn.dataset.priceFrom;
        if (pf && pf !== '') {
          priceEl2.textContent = 'From $' + Number(pf).toLocaleString('en-US');
        } else {
          // Priority 3: full range default
          priceEl2.textContent = priceEl2.dataset['default'] || '';
        }
      }
    }

    // Always make exactly one size chip active (no toggle-off)
    var row = btn.closest('.model-card-size-chips');
    if (row) {
      row.querySelectorAll('.model-card-size-btn').forEach(function (s) {
        s.classList.remove('is-active');
      });
      btn.classList.add('is-active');
    }
  });

  // ── Homepage carousel arrow buttons ──────────────────────────────
  var track = document.getElementById('fmCarouselTrack');
  var btnL  = document.getElementById('fmArrowLeft');
  var btnR  = document.getElementById('fmArrowRight');
  if (!track || !btnL || !btnR) return;

  var GAP = 20;  // px — matches 1.25rem gap in CSS

  // Set card widths — responsive: 4 desktop, 2 tablet, 1.2 phone (peek effect)
  function sizeCards() {
    var trackW = track.offsetWidth;
    if (!trackW) return;
    var vw      = window.innerWidth;
    var VISIBLE = vw < 520 ? 1.2 : vw < 768 ? 2 : 4;
    var cardW = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);
    track.querySelectorAll('.model-card').forEach(function (card) {
      card.style.width    = cardW + 'px';
      card.style.minWidth = cardW + 'px';
    });
    syncArrows();
  }

  // Show/hide arrows based on scroll position
  function syncArrows() {
    var atStart = track.scrollLeft <= 2;
    var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    if (atStart) { btnL.setAttribute('hidden', ''); } else { btnL.removeAttribute('hidden'); }
    if (atEnd)   { btnR.setAttribute('hidden', ''); } else { btnR.removeAttribute('hidden'); }
  }

  // Scroll by one card width (plus gap) per arrow click
  function scrollAmt() {
    var card = track.querySelector('.model-card');
    return card ? card.offsetWidth + GAP : 280;
  }

  btnL.addEventListener('click', function () {
    track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' });
  });
  btnR.addEventListener('click', function () {
    track.scrollBy({ left: scrollAmt(), behavior: 'smooth' });
  });
  track.addEventListener('scroll', syncArrows, { passive: true });

  // Init — wait for layout to settle
  sizeCards();
  window.addEventListener('resize', sizeCards);
  // Re-run after fonts/images may have shifted layout
  window.addEventListener('load', sizeCards);
})();

// ── Homepage: category carousel ───────────────────────────────────
(function () {
  var track = document.getElementById('catCarouselTrack');
  var btnL  = document.getElementById('catArrowLeft');
  var btnR  = document.getElementById('catArrowRight');
  if (!track || !btnL || !btnR) return;

  var GAP = 20;

  function sizeCards() {
    var trackW = track.offsetWidth;
    if (!trackW) return;
    var vw      = window.innerWidth;
    var VISIBLE = vw < 520 ? 1.5 : vw < 768 ? 2 : 4;
    var cardW   = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);
    track.querySelectorAll('.cat-card').forEach(function (card) {
      card.style.width    = cardW + 'px';
      card.style.minWidth = cardW + 'px';
    });
    syncArrows();
  }

  function syncArrows() {
    var atStart = track.scrollLeft <= 2;
    var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    if (atStart) { btnL.setAttribute('hidden', ''); } else { btnL.removeAttribute('hidden'); }
    if (atEnd)   { btnR.setAttribute('hidden', ''); } else { btnR.removeAttribute('hidden'); }
  }

  function scrollAmt() {
    var card = track.querySelector('.cat-card');
    return card ? card.offsetWidth + GAP : 260;
  }

  btnL.addEventListener('click', function () { track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }); });
  btnR.addEventListener('click', function () { track.scrollBy({ left:  scrollAmt(), behavior: 'smooth' }); });
  track.addEventListener('scroll', syncArrows, { passive: true });

  sizeCards();
  window.addEventListener('resize', sizeCards);
  window.addEventListener('load',   sizeCards);
})();

// ── Mobile nav toggle ──────────────────────────────────────────────
(function () {
  var hamburger  = document.querySelector('.nav-hamburger');
  var mobileMenu = document.getElementById('mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', String(open));
      mobileMenu.setAttribute('aria-hidden', String(!open));
    });
  }

  // Close mobile menu on outside click
  document.addEventListener('click', function (e) {
    if (mobileMenu && mobileMenu.classList.contains('is-open')) {
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        mobileMenu.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      }
    }
  });
})();

// ── Mega menu: Escape key + aria-expanded sync (19G.3) ────────────
(function () {
  var hasMega = document.querySelector('.has-mega');
  if (!hasMega) return;
  var trigger = hasMega.querySelector('.nav-mega-trigger');

  // Sync aria-expanded on the trigger as menu becomes visible/hidden
  function onMegaToggle(visible) {
    if (trigger) trigger.setAttribute('aria-expanded', String(visible));
  }

  // Use MutationObserver on the mega-menu's computed visibility isn't reliable
  // across browsers, so track hover via pointerenter/pointerleave instead.
  hasMega.addEventListener('pointerenter', function () { onMegaToggle(true); });
  hasMega.addEventListener('pointerleave', function () { onMegaToggle(false); });

  // Escape key collapses menu and returns focus to trigger
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hasMega.matches(':hover, :focus-within')) {
      if (trigger) { trigger.focus(); }
      onMegaToggle(false);
    }
  });
})();

// ── Favorites / Heart toggle (19G.5) ──────────────────────────────
(function () {
  function handleHeartClick(e) {
    var btn = e.target.closest('.heart-btn');
    if (!btn) return;

    // If not logged in, send to register with return context
    if (!window.__bvoIsLoggedIn) {
      var slug = btn.dataset.productSlug || '';
      window.location.href = '/account/register?message=save'
        + (slug ? '&next=' + encodeURIComponent('/products/' + slug) : '');
      return;
    }

    var productId = parseInt(btn.dataset.productId, 10);
    if (!productId) return;

    // Optimistic UI update
    var wasSaved = btn.classList.contains('is-saved');
    btn.classList.toggle('is-saved', !wasSaved);
    var label = btn.querySelector('.heart-btn-label');
    if (label) label.textContent = wasSaved ? 'Save to Wishlist' : 'Saved';
    btn.setAttribute('aria-label', wasSaved ? 'Save to favorites' : 'Remove from saved items');

    fetch('/account/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      // Reconcile with server response
      btn.classList.toggle('is-saved', data.saved);
      if (label) label.textContent = data.saved ? 'Saved' : 'Save to Wishlist';
      btn.setAttribute('aria-label', data.saved ? 'Remove from saved items' : 'Save to favorites');
    })
    .catch(function () {
      // Revert optimistic update on network error
      btn.classList.toggle('is-saved', wasSaved);
      if (label) label.textContent = wasSaved ? 'Saved' : 'Save to Wishlist';
      btn.setAttribute('aria-label', wasSaved ? 'Remove from saved items' : 'Save to favorites');
    });
  }

  document.addEventListener('click', handleHeartClick);
})();

// ── Hardware finish color filter (vanities — secondary colour layer) ──
// Mirrors the primary colour filter block above, using separate URL params:
//   hw_color_family  — metallic family key (e.g. 'nickel', 'gold')
//   hw_color_exact   — exact vendor finish string (e.g. 'Brushed Nickel')
// HTML hooks: data-hw-color-key (family swatch), data-hw-color-exact +
//             data-hw-color-family (sub-chips), id="hw-color-sub-{key}"
(function () {
  var hwFamilyRow = document.getElementById('hw-color-family-row');
  if (!hwFamilyRow) return;

  // ── URL param helpers ──────────────────────────────────────────
  function getHwState() {
    var sp = new URLSearchParams(window.location.search);
    return {
      families: sp.getAll('hw_color_family'),
      exact:    sp.getAll('hw_color_exact'),
    };
  }

  function navigateHw(families, exact) {
    if (window._bvoSaveScroll) window._bvoSaveScroll();
    var sp = new URLSearchParams(window.location.search);
    sp.delete('hw_color_family');
    sp.delete('hw_color_exact');
    sp.delete('page');
    families.forEach(function (f) { sp.append('hw_color_family', f); });
    exact.forEach(function (e)    { sp.append('hw_color_exact',   e); });
    window.location.search = sp.toString();
  }

  // ── Family swatch click ────────────────────────────────────────
  hwFamilyRow.querySelectorAll('[data-hw-color-key]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var key    = sw.dataset.hwColorKey;
      var state  = getHwState();
      var subRow = document.getElementById('hw-color-sub-' + key);

      // Collect all exact values that belong to this hw family
      var familyMembers = [];
      if (subRow) {
        subRow.querySelectorAll('[data-hw-color-exact]').forEach(function (chip) {
          familyMembers.push(chip.dataset.hwColorExact);
        });
      }

      var isActive = state.families.includes(key) ||
        state.exact.some(function (e) { return familyMembers.includes(e); });

      if (isActive) {
        // Deselect: remove this family + all its exact values
        navigateHw(
          state.families.filter(function (f) { return f !== key; }),
          state.exact.filter(function (e)    { return !familyMembers.includes(e); })
        );
      } else {
        // Select at family level; clear any stale exact values for this family first
        var newFamilies = state.families.concat([key]);
        var newExact    = state.exact.filter(function (e) { return !familyMembers.includes(e); });
        navigateHw(newFamilies, newExact);
      }
    });

    // Keyboard accessibility
    sw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
    });
  });

  // ── Sub-chip click (multi-select within hw family) ─────────────
  document.querySelectorAll('[data-hw-color-exact]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var value     = chip.dataset.hwColorExact;
      var familyKey = chip.dataset.hwColorFamily;
      var state     = getHwState();

      // All exact values for this family (for deselect-all-remaining check)
      var subRow = document.getElementById('hw-color-sub-' + familyKey);
      var familyMembers = [];
      if (subRow) {
        subRow.querySelectorAll('[data-hw-color-exact]').forEach(function (c) {
          familyMembers.push(c.dataset.hwColorExact);
        });
      }

      var newFamilies = state.families.slice();
      var newExact    = state.exact.slice();

      if (newExact.includes(value)) {
        // Deselect this chip
        newExact = newExact.filter(function (e) { return e !== value; });
        // If no remaining exact values for this family, also remove the family key
        var remaining = newExact.filter(function (e) { return familyMembers.includes(e); });
        if (!remaining.length) {
          newFamilies = newFamilies.filter(function (f) { return f !== familyKey; });
        }
      } else {
        // Select: ensure family key is present, then add exact value
        if (!newFamilies.includes(familyKey)) newFamilies.push(familyKey);
        newExact.push(value);
      }

      navigateHw(newFamilies, newExact);
    });
  });
})();

// ── Mobile filter drawer ──────────────────────────────────────────────
(function () {
  var panel    = document.querySelector('.filter-panel');
  var openBtn  = document.getElementById('mobileFilterBtn');
  var closeBtn = document.getElementById('filterCloseBtn');
  var overlay  = document.getElementById('filterOverlay');
  if (!panel || !openBtn) return;

  function openDrawer() {
    panel.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    panel.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay)  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
})();
