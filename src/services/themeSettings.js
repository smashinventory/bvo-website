'use strict';

/**
 * Theme Settings Service
 * Loads theme_settings.json into memory on first access.
 * Saves changes back to disk. Falls back to hardcoded defaults
 * if the file is missing (same DB-absent pattern used elsewhere).
 */

const fs   = require('fs');
const path = require('path');
const { bvoPool } = require('../config/database');

const SETTINGS_PATH = path.join(__dirname, '../../data/theme_settings.json');

/* ── Hardcoded defaults (fallback when file is missing) ──────── */
const DEFAULTS = {
  design: {
    /* BVO typography, decided 2026-09-24: Georgia + system-ui, both already
       present on every device, so the storefront downloads NO webfonts.

       Rationale lives in docs/briefs/BVO_TYPOGRAPHY_DECISION.md — read it
       before changing these. Short version: the reason to reach for Google
       Fonts was that visitors would already hold the files in cache from
       other sites, and browsers ended that in 2020 by partitioning the HTTP
       cache per origin. Every first-time visitor now pays the full DNS +
       TLS + download. Sam compared both rendered side by side and chose
       these.

       Still Theme Editor settings — a Google font can be selected again at
       any time, and main.ejs brings the whole preconnect + preload + swap
       apparatus back automatically when one is. */
    heading_font:   'Georgia',
    body_font:      'system-ui',
    base_size_px:   16,
    heading_weight: '600',
    colors: { navy:'#182840', amber:'#926A21', sage:'#5A7A5A', whisper:'#F8F6F2', white:'#FFFFFF' },
    button_radius: '6px',
    card_radius:   '12px',
  },
  seo: {
    home_title:          'BathroomVanitiesOutlet.com | Premium Vanities at Outlet Prices',
    home_description:    'Shop premium bathroom vanities, mirrors, faucets and accessories at outlet prices. Free shipping on every order.',
    og_image:            '/images/og-default.jpg',
    og_image_alt:        'BathroomVanitiesOutlet.com — Premium Bathroom Vanities at Outlet Prices',
    og_title:            '',
    og_description:      '',
    google_analytics_id: '',
  },
  global: {
    site_name:              'BathroomVanitiesOutlet.com',
    site_tagline:           'Premium Vanities. Outlet Prices.',
    contact_email:          'info@bathroomvanitiesoutlet.com',
    contact_phone:          '',
    free_shipping_threshold: 0,
    free_shipping_label:    'Free Shipping on Every Order',
    // Google Reviews — update these from your Google Business Profile for
    // "Bathroom Vanities Outlet" once you look up the current rating + count.
    // These appear on product pages and the cart page as social proof.
    google_reviews_rating:  '4.9',   // e.g. '4.9'
    google_reviews_count:   '150',   // e.g. '312'
  },
  promo_strip: {
    enabled: true,
    message: 'Free Shipping on Every Order — No Minimum Required',
    link_text: 'Shop Now',
    link_url: '/collections/bathroom-vanities',
    bg_color: '#182840',    // navy — high contrast for accessibility
    text_color: '#ffffff',  // white on navy
  },
  /* ── SCREEN-SIZE BANDS ────────────────────────────────────────────
     Two numbers that every responsive decision derives from:
       mobile   0 .. mobile_max
       tablet   mobile_max+1 .. tablet_max
       desktop  tablet_max+1 .. up

     Added 2026-09-29. Before this, 860px was hardcoded in four places
     and the Theme Editor's Tablet preview button showed the mobile
     layout because no tablet band existed. See src/utils/breakpoints.js
     — that file resolves and clamps these, and nothing else may read
     them raw. */
  /* NOT literals. src/utils/breakpoints.js owns these numbers; writing
     them again here created two copies of the same value that a mutation
     test immediately showed could drift apart silently. The resolver is
     the single source — this just seeds the settings file from it. */
  breakpoints: { ...require('../utils/breakpoints').DEFAULTS },
  _breakpoints_note: {
    /* tablet_max is 1251 — the last width BELOW what the desktop menu
       needs. Desktop therefore starts at 1252, where it fits.

       THIS NUMBER HAS BEEN WRONG TWICE. Both times because it was typed
       instead of derived:

         1024  a DEVICE width (iPad landscape). Fixed one device, left
               1025-1231 rendering a menu that did not fit.
         1231  from a real measurement of 1,222px - but taken with a 90px
               logo, while the desktop band renders the owner's 120px
               logo. Measured live at 1232: cart still 4px off screen.

       breakpoints.desktopMenuNeeds(settings) now COMPUTES the
       requirement from pad_desktop, gap_desktop and logo_width plus
       three measured content widths. Change the logo size in the Theme
       Editor and the requirement moves with it; the editor shows the
       new number next to the field. gate_breakpoints asserts this
       default agrees with the computed value, so a third wrong number
       cannot ship quietly.

       Owner's rule, 2026-09-29: "as the screen gets large enough for the
       wordmark the hamburger is no longer needed as it is most likely a
       computer or laptop." One line, placed where the menu fits. */
  },

  nav: {
    brand_line1: 'BathroomVanities',
    brand_line2: 'Outlet',
    brand_line3: '.com',

    /* ── HEADER SIZING, PER BAND ───────────────────────────────────
       Empty string means "inherit the band above", so the owner only
       fills in what they want to differ. A zero is a real value (no
       padding); only '' is absent — hence the String() checks in
       header.ejs rather than a truthiness test.

       logo_width / logo_height stay as the DESKTOP values because they
       already exist and are already saved; renaming them would silently
       drop the 120px currently live. The tablet and mobile pairs are
       new and default to empty = inherit. */
    logo_width:         90,
    logo_height:        90,
    /* 90, not '' (inherit), ON PURPOSE. site.css pinned .nav-logo to 90x90
       below 861px, so 90 is what every phone and tablet renders TODAY.
       Leaving these empty would make them inherit the desktop value — the
       live setting is 120 — and the owner's phone header would grow the
       moment this deploys, which nobody asked for. Clear a field to
       inherit; these ship pre-filled with the status quo. */
    logo_width_tablet:  90,
    logo_height_tablet: 90,
    logo_width_mobile:  90,
    logo_height_mobile: 90,

    /* Space between the bar's edge and its contents, and between the
       items. Desktop keeps what site.css has always had (40 / 28) so
       nothing moves on a big screen. Mobile defaults are DELIBERATELY
       different from desktop: 40px of side padding on a 375px phone is
       what pushes the hamburger off the right edge. */
    pad_desktop:   40,  gap_desktop:   28,  height_desktop: 106,
    pad_tablet:    '',  gap_tablet:    '',  height_tablet:  '',
    pad_mobile:    14,  gap_mobile:    12,  height_mobile:  '',

    links: [
      { label: 'Vanities',    url: '/collections/bathroom-vanities', megaMenu: true },
      { label: 'Mirrors',     url: '/collections/bathroom-mirrors' },
      // ?product_type= preselects the Faucet Type facet so the nav lands on
      // bathroom faucets rather than all 669 rows (shower, kitchen, tub,
      // bar). Bare /collections/faucets stays the full catalogue on purpose
      // — it is the canonical URL and should surface every product.
      //
      // product_type, NOT type. Both narrow the grid to the same 149 rows of
      // 669, but only product_type ticks the matching box in the Faucet Type
      // panel: it is an attribute-definition key, filtered by the generic
      // attrFilters loop (collectionsController ~line 960) that also renders
      // checkbox state. ?type= is the products.product_type column filter and
      // leaves every box unticked, so the shopper gets a narrowed grid with
      // no visible reason. Re-verified live 2026-09-22; a commit that day
      // switched this to ?type= on a bad test and was reverted.
      { label: 'Faucets',     url: '/collections/faucets?product_type=Bathroom+Faucets' },
      { label: 'Accessories', url: '/collections/accessories' },
      { label: 'Sale',        url: '/collections/sale', highlight: true },
    ],
    /** Mega-menu content for the Vanities top-level link.
     *  Kept separate from nav.links so array reindex never corrupts nested keys. */
    vanities_mega: {
      /* ── THE "ALL" ROW — ADDED 2026-10-02 ──────────────────────────
         First row of the panel, and the ONLY link in the mega menu to the
         main collection. It carries the destination the top-level
         "Vanities" trigger used to have, before that trigger became a
         <summary> and stopped being a link.

         WAS hardcoded as 'Shop All ' + the menu item's label, which
         rendered "Shop All Vanities" - character-for-character identical
         to the parallax band's CTA on the homepage, and seobility flagged
         the pair as the last remaining duplicate anchor text on the page.

         "All Bathroom Vanities" instead: it is not the CTA's wording, and
         it carries the exact collection keyword rather than the generic
         verb "Shop", which is better anchor text on its own merits.

         A BLANK VALUE FALLS BACK TO THIS DEFAULT RATHER THAN HIDING THE
         ROW. Hiding it would leave the mega menu with no link at all to
         /collections/bathroom-vanities - the trigger is not a link any
         more - so an admin clearing the field would silently orphan the
         main collection from the navigation. The field help text in the
         Theme Editor says so. */
      all_label: 'All Bathroom Vanities',
      section_heading: 'Shop By Type',
      // Taxonomy overhaul 2026-07-31: links updated to new SEO display category slugs.
      // Note: Admin → Theme Editor → Navigation may have DB-stored overrides that take
      // precedence over these defaults. User must update those manually after code deploy.
      links: [
        { label: 'Single Sink Vanity With Top', url: '/collections/bathroom-vanities-with-tops?type=Single+Sink+Vanity+With+Top' },
        { label: 'Double Sink Vanity With Top', url: '/collections/bathroom-vanities-with-tops?type=Double+Sink+Vanity+With+Top' },
        { label: 'Cabinet Only',               url: '/collections/bathroom-vanity-cabinets' },
      ],
      /* ── STYLE LINKS — ONE SOURCE, ADDED 2026-10-02 ─────────────────
         These nine were hardcoded TWICE in header.ejs: once in the
         desktop mega-menu Style column, once in the mobile drawer, with
         the mobile copy carrying the comment "mirrors desktop mega menu
         Style column". Eighteen <a> tags for nine destinations.

         Nothing failed when they disagreed. Add a style, rename one,
         change a URL — you had to remember to do it twice, and the two
         menus would quietly differ by device.

         They live here now because the nav rewrite renders one list for
         both layouts, so there is one place to read them from. Unlike
         vanities_mega.links these are the canonical BVO style buckets
         rather than merchandising choices, so they are not expected to
         change often — but when they do, this is the only edit. */
      style_heading: 'Shop By Style',
      style_links: [
        { label: 'Traditional',          url: '/collections/bathroom-vanities?style=Traditional' },
        { label: 'Transitional',         url: '/collections/bathroom-vanities?style=Transitional' },
        { label: 'Modern',               url: '/collections/bathroom-vanities?style=Modern' },
        { label: 'Farmhouse',            url: '/collections/bathroom-vanities?style=Farmhouse' },
        { label: 'Mid-Century Modern',   url: '/collections/bathroom-vanities?style=Mid-Century+Modern' },
        { label: 'Industrial',           url: '/collections/bathroom-vanities?style=Industrial' },
        { label: 'Coastal',              url: '/collections/bathroom-vanities?style=Coastal' },
        { label: 'Scandinavian',         url: '/collections/bathroom-vanities?style=Scandinavian' },
        { label: 'European / Old World', url: '/collections/bathroom-vanities?style=European+%2F+Old+World' },
      ],
      promo: {
        url:    '/collections/vanity-models',
        eyebrow: 'Our Collection',
        /* No <br>. It was escaped by <%= %> at render time and shipped as
           visible raw markup on the promo card. header.ejs now strips tags
           defensively too, because the settings file wins over this default. */
        title:  'Every Model, Every Finish',
        sub:    'Browse all vanity collections, sizes, and styles at a glance.',
        cta:    'Browse All Collections',
      },
    },
  },
  scrolling_ticker: {
    enabled: true,
    show_on: 'all',
    speed_seconds: 40,
    bg_color: '',    // '' = CSS default (#182840 navy)
    text_color: '',  // '' = CSS default (white)
    font_size: 0,    // 0 = CSS default (12px)
    items: [
      '🚚  Free Shipping on Every Order — No Minimum',
      '⭐  Rated 4.9/5 by Our Happy Customers',
      '🔄  30-Day Hassle-Free Returns',
      '🏷️  Top Brands: James Martin · Kohler · Moen · Delta',
      '📞  Expert Support 7 Days a Week',
    ],
  },
  hero: {
    show_on: 'all',
    eyebrow: 'Curated for Your Bathroom Renovation',
    heading_line1: 'Premium Vanities.',
    heading_line2: 'Outlet Prices.',
    subtext: 'Top brands, delivered free to your door.',
    sub2_text: 'James Martin · Kohler · Moen · Delta and more',
    cta1_text: 'Shop Vanities', cta1_url: '/collections/bathroom-vanities',
    cta2_text: 'View Sale',    cta2_url: '/collections/sale',
    badge_text: 'Free Shipping',
    image_url: '',
    image_alt: 'Premium bathroom vanity',
    video_url: '',        // YouTube URL or direct .mp4 URL — autoplay muted loop background
    video_on_mobile: true, // false = hide video on ≤860px; poster image shows instead
    mobile_image_url: '',  // separate image shown on ≤860px instead of desktop image
    mobile_image_alt: '',
    /* Shape of mobile_image_url, as 'W:H' or 'W/H'. ONLY read when
       mobile_image_url is set, because it describes THAT file — not the
       ≤480 phone crop, which is hero_mobile.image_aspect.

       Why this exists: 481-860px is the stacked band. The image sits in
       flow there with nothing holding its height, so an unreserved box
       measures 1px and everything below it drops when the bytes land.
       MEASURED 2026-09-23, cold, hero image stripped:

           412px   aspect-ratio 1160/927   box 329px   .hero-content y=474  ok
           650px   aspect-ratio auto       box   1px   .hero-content y=146  SHIFT
           820px   aspect-ratio auto       box   1px   .hero-content y=146  SHIFT
          1000px   fixed 620px height                                       ok

       A ?crop=W,H,x,y on the URL states the shape and wins over this. Blank
       emits no rule at all — a box from the WRONG file shifts twice, which
       is worse than not reserving. */
    mobile_image_aspect: '',
    // Text & Colors — CSS custom props emitted on section element
    eyebrow_color:      '',   // '' = CSS default (sage)
    heading_color:      '',   // '' = CSS default (white on mobile, navy on desktop)
    h2_color:           '',   // '' = CSS default (amber)
    subtext_color:      '',   // '' = CSS default
    /* DESKTOP alignment (>860px). Added 2026-09-23 — it had no default at
       all before, which meant the value lived only in
       data/theme_settings.json and the DB. Lose or reset that file and the
       hero silently fell back to a literal 'left' written in TWO places
       (index.ejs and theme.ejs's teAlignment), with nothing to explain why
       the homepage had changed.

       'center' is the deliberate value, not a guess: Sam set it while
       testing whether a desktop/mobile alignment mismatch was causing the
       PageSpeed CLS (it was not — two runs, both still 0.321), looked at
       the result and kept it. This default now matches what production
       actually renders, so a fresh install and a saved install agree.

       KNOWN WIDER GAP, not fixed here: of 29 setting blocks only
       hero_mobile and now hero carry a text_align key. The other 27 still
       take their alignment default from a literal in theme.ejs or
       index.ejs, usually written twice per section. Logged in
       OPEN_ITEMS.md rather than refactored in this commit. */
    text_align:         'center',
    /* Mobile alignment lives on hero_mobile.text_align — the single
       canonical control. It governs the copy, the .hero-rule divider and
       the CTA row together. The old hero.text_align_mobile was retired
       2026-09-23: it emitted --hero-mobile-align onto .hero, which could
       not move the flex CTA row and could not beat the inline
       text-align on .hero-content, so on phones the text sat left while
       the buttons sat centred. See CHANGE_LOG_BRIEF.md. */
    // Layout & sizing
    layout: 'split',       // 'split' (text|image side-by-side) | 'bg' (image behind text)
    text_col_pct: 45,      // split layout: text column width %; image gets the remainder
    height_vh: 0,          // 0 = CSS default (calc 100vh - navbar); 40-100 = custom vh
    min_height_px: 520,    // 0 = no override
    max_height_px: 900,    // 0 = no cap
    // Per-element font sizes (0 = CSS default)
    eyebrow_size: 11,
    h2_size: 0,
    sub2_size: 14,
    badge_size: 10,
    // Content box (bg-video layout) — semi-transparent panel behind text
    content_box_color:   '#0f1f35', // box background color (hex)
    content_box_opacity: 60,         // box opacity 0–100%
    content_box_padding: 36,         // px padding inside box
    content_box_radius:  6,          // px border radius
    content_max_width:   520,        // px max-width of text box
    content_v_offset:    0,          // % vertical offset from center (negative = raise, positive = lower)
    content_h_offset:    5,          // % left padding / horizontal position of text box
    text_shadow:         true,       // drop shadow behind heading text
  },
  hero_mobile: {
    enabled:             true,
    // Background image — blank falls back to desktop hero image
    image_url:           '',
    image_alt:           '',
    /* Shape of the phone hero image, e.g. '4:3'. Blank is correct whenever
       image_url carries ?crop=W,H,x,y — index.ejs derives the box from
       those params and this is not consulted. It exists only for an image
       URL that states no shape: without a reserved box the stacked layout
       renders a 1px-tall image and then jumps, which measured CLS 0.321 on
       2026-09-23. Ignored by the bg and split layouts, which reserve space
       via the section height. */
    image_aspect:        '',
    // Background video (optional)
    video_url:           '',
    // Layout
    /* 'bg'      image behind the copy, scrim between them
       'split'   copy beside the image
       'stacked' image on top, copy in its own row below it — nothing
                 overlaps, so the overlay and its gradient are switched
                 off. The image keeps its natural shape; crop it in
                 image_url (Bunny: ?crop=W,H,X,Y), not with a ratio here.
                 Added 2026-09-23. */
    layout:              'bg',
    text_col_pct:        50,
    text_align:          'center',
    // Height
    height_vh:           0,
    min_height_px:       500,
    max_height_px:       0,
    // Overlay
    overlay_color:       '#0f1f35',
    overlay_opacity:     55,
    // Content box
    content_box_color:   '#0f1f35',
    content_box_opacity: 60,
    content_box_padding: 28,
    content_box_radius:  0,
    content_max_width:   600,
    content_v_offset:    0,
    content_h_offset:    0,
    // Text
    text_shadow:         true,
    eyebrow:             '',
    eyebrow_size:        11,
    heading_level:       'h1',
    heading_size:        32,
    heading_line1:       '',
    heading_line2:       '',
    h2_size:             28,
    subtext:             '',
    subtext_size:        16,
    sub2_text:           '',
    sub2_size:           14,
    badge_text:          '',
    badge_size:          10,
    // Text colors — blank = brand defaults
    eyebrow_color:       '',
    heading_color:       '',
    h2_color:            '',
    subtext_color:       '',
    sub2_color:          '',
    // CTAs — blank = inherit from desktop hero
    cta1_text:           '',
    cta1_url:            '',
    cta2_text:           '',
    cta2_url:            '',
  },
  brand_logos: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Trusted Brands We Carry',
    logos: [
      { name:'James Martin',     image_url:'',     url:'/collections/bathroom-vanities?brand=james-martin' },
      { name:'Kohler',           image_url:'',           url:'/collections/bathroom-vanities?brand=kohler' },
      { name:'Moen',             image_url:'',             url:'/collections/faucets?brand=moen' },
      { name:'Delta',            image_url:'',            url:'/collections/faucets?brand=delta' },
      { name:'American Standard',image_url:'',url:'/collections/bathroom-vanities?brand=american-standard' },
    ],
  },
  categories_section: {
      /* 'p' = looks identical, left out of the page outline. A heading should
         name a topic the page can rank for; a section label does not. Sam,
         2026-10-03. Override per-section in the Theme Editor (Heading Level ->
         "Label (not a heading)"), which wins over this default.
         NOTE: data/theme_settings.json had no *_level key for any of these, so
         this default is what renders. If one is ever saved, it wins.*/
    title_level: 'p',
    enabled: true,
    show_on: 'all',
    eyebrow: 'Browse by Category',
    title: 'Everything Your Bathroom Needs',
    subtitle: 'Curated collections from the top brands in bath design',
    /* Categories themselves have no brand — Vanities and Mirrors are shared
       across James Martin and ER Vanities. So brand here scopes the card
       LINKS, not which cards appear: set it and every card points at that
       category already filtered to the brand. That is what makes a
       duplicated copy of this section useful (one JM band, one ER band).
       '' means unscoped links, which is the original behaviour. */
    brand: '',
  },
  bundle_teaser: {
      /* 'p' = looks identical, left out of the page outline. A heading should
         name a topic the page can rank for; a section label does not. Sam,
         2026-10-03. Override per-section in the Theme Editor (Heading Level ->
         "Label (not a heading)"), which wins over this default.
         NOTE: data/theme_settings.json had no *_level key for any of these, so
         this default is what renders. If one is ever saved, it wins.*/
    heading_level: 'p',
    enabled: true,
    show_on: 'all',
    eyebrow: 'James Martin Vanities',
    heading: 'Build Your Dream Bathroom',
    subtitle: 'Mix and match cabinets, tops, and mirrors from the James Martin collection — and save up to 15% when you bundle.',
    cta_text: 'Build Your Bundle',
    // Step card text — editable in Theme Editor > Bundle Builder Teaser
    step1_name: 'Cabinet',
    step1_desc: 'Choose your base',
    step2_name: 'Top',
    step2_desc: 'Match your countertop',
    step3_name: 'Mirror',
    step3_desc: '1 or 2 for double vanities',
    step4_name: 'Faucet',
    step4_desc: '1 or 2 for double vanities',
    // Discount badge text
    badge1: 'Vanity + Top = 5% Off',
    badge2: '+ Mirror (or pair) = 10% Off',
    badge3: '+ Faucet (or pair) = 15% Off',
    pair_note: 'Mirrors & faucets can be added as a matched pair for double vanities — a pair still counts as one bundle step.',
  },
  /* ── Filters on featured_section / featured_models ──────────────────
     Three narrowing filters, each '' meaning "no filter" so existing saved
     settings keep their current behaviour:

       brand     products.brand         e.g. 'James Martin Vanities'
       category  categories.slug        e.g. 'bathroom-vanities', 'faucets'
       ptype     products.product_type  e.g. 'Single Sink Vanity With Top'

     category is a real filter rather than an assumption on purpose. Both
     of these used to hardcode the bathroom-vanities category, which meant
     a "Featured Faucet Models" band could not exist. Model cards are not
     inherently a vanity concept — when plumbing fixtures gain models, this
     section should be able to point at them without a code change.

     These are also what make a duplicated copy worth having: two Featured
     Models bands, one scoped to James Martin, one to ER Vanities.

     NOTE THE TWO DIFFERENT category DEFAULTS BELOW — they are not a
     copy/paste slip. get() deep-merges saved settings over these defaults
     key by key, so a section saved before this change inherits whatever
     is written here. Each default is set to reproduce that section's
     CURRENT behaviour exactly:

       featured_models   'bathroom-vanities'  it hardcoded that category join
       featured_section  ''                   it had no category filter at all

     Defaulting both to '' would have quietly let non-vanity models onto
     the homepage the moment this deployed. */
  featured_section: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Staff Picks',
    title: 'Featured Products',
    subtitle: 'Handpicked vanities and accessories our customers love',
    cta_text: 'View All Products',
    cta_url: '/collections/bathroom-vanities',
    limit: 4,
    // 4 matches the CSS fallback, so behaviour on deploy is unchanged.
    // The Theme Editor has always offered this control; nothing read it
    // until now, and it had no default here either.
    columns: 4,
    brand: '',
    category: '',
    ptype: '',
  },
  featured_models: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Shop by Collection',
    title: 'Featured Models',
    subtitle: 'Explore our most popular vanity collections — click a finish to see it in action.',
    cta_text: 'See All Our Models',
    cta_url: '/collections/vanity-models',
    limit: 8,
    brand: '',
    category: 'bathroom-vanities',   // was a hardcoded join — see note above
    ptype: '',
  },
  image_with_text: {
    enabled: true,
    show_on: 'all',
    image_url: '',
    image_alt: 'Our showroom floor',
    /* Shape of image_url, e.g. '4:3', '1:1', '16:9'. Blank means "use the
       4:3 the template has always assumed".

       WHY THIS EXISTS. index.ejs hardcoded width="380" height="285" on this
       image — a 4:3 ratio asserted for whatever picture the owner happens to
       choose. On 2026-09-23 the chosen image was the 512x512 BVO logo, so
       the browser reserved 4:3, a 1:1 file arrived, the image column grew
       98px and the before/after section below it dropped by exactly that.

       MEASURED at 1366x768, three ways agreeing:
           img stripped   219x164  (ratio 1.335 — the 380:285 attributes)
           img loaded     380x380  (natural 512x512)
           iwt section    432 -> 530          growth  98px
           before/after   pushed down          98px
           SpeedVitals    reported shift       98px   CLS 0.2515

       Blank keeps the old 380x285 so nothing changes for a 4:3 image; the
       fix is opt-in per section. Same idea and same format as
       hero_mobile.image_aspect. */
    image_aspect: '',
    /* The Theme Editor has always posted this (teAlignment, theme.ejs), and
       deepMerge keeps posted keys whether or not they have a default — so
       the control worked. It had no DEFAULT though, which meant the
       shipped-state alignment lived only in a `|| 'left'` literal in
       index.ejs. Recording it here makes the default a fact in one place
       instead of two. Same gap as hero.text_align, OPEN_ITEMS 12. */
    text_align: 'left',
    image_position: 'left',
    eyebrow: 'Why Choose Us',
    heading: 'The Bathroom Renovation Experts',
    body: "We've spent years building direct relationships with the brands homeowners trust most — James Martin, Kohler, Moen, Delta, and more. That means you get authentic, warranty-backed products at prices that don't make sense anywhere else. Free shipping included on every single order.",
    cta_text: 'Our Story',
    /* /pages/about is a 404; the page is /pages/about-us. The live site was
       fixed in the Theme Editor on 2026-10-02 and the settings file now wins
       over this default, so changing it here alters nothing on bathroom-
       vanitiesoutlet.com. It is corrected so a FRESH environment, which
       starts from these defaults, does not ship the same dead button. */
    cta_url: '/pages/about-us',
  },
  before_after: {
      /* 'p' = looks identical, left out of the page outline. A heading should
         name a topic the page can rank for; a section label does not. Sam,
         2026-10-03. Override per-section in the Theme Editor (Heading Level ->
         "Label (not a heading)"), which wins over this default.
         NOTE: data/theme_settings.json had no *_level key for any of these, so
         this default is what renders. If one is ever saved, it wins.*/
    heading_level: 'p',
    enabled: true,
    show_on: 'all',
    eyebrow: 'The BVO Difference',
    heading: 'See the Transformation',
    subtitle: 'Real bathrooms renovated with products from BathroomVanitiesOutlet.com',
    before_image: '',
    before_label: 'Before',
    after_image: '',
    after_label: 'After',
  },
  /* ── VALUE BAR ────────────────────────────────────────────────────
     Free Shipping / Secure Checkout / Easy Returns / Expert Support.
     The strip directly under the hero.

     ⚠️ UNTIL 2026-10-04 THIS WAS HARDCODED INSIDE THE HERO'S if BLOCK.
     Not styled to look attached — actually inside it: the EJS tag that
     closes the hero's if block sits AFTER this markup, not before it.
     That is why it
     had no controls of any kind, why all eight strings and four icons
     were baked into the template, and why it disappeared entirely if
     the hero was switched off. It also sets `background: var(--hero-bg)`
     in CSS, so it shares the hero's colour and the only thing between
     them is a 1px border — which is what makes it read as part of the
     hero rather than as its own band.

     Now its own section: orderable, toggleable, editable, and able to
     have its own background.

     DEFAULTS ARE THE EXACT CURRENT COPY, so nothing on the live page
     changes when this ships. To stop it bleeding into the hero, set
     Background colour in the Theme Editor (#FFFFFF or the cream
     #F7F4EF both separate it cleanly); the default is left alone rather
     than changed for you, because an unannounced visual change to the
     homepage is worse than one you make deliberately.

     ICONS ARE A FIXED NAMED SET, not free SVG input. A field accepting
     markup is a stored-XSS hole on the homepage, and the editor is
     reachable by anyone with admin access. See VALUE_BAR_ICONS in
     index.ejs for the available keys. */
  value_bar: {
    enabled: true,
    show_on: 'all',
    bg_color: '',    // '' = CSS default, which is var(--hero-bg)
    text_color: '',
    item1_enabled: true, item1_icon: 'truck',
    item1_title: 'Free Shipping',
    item1_text:  'On every order, every time — no minimums',
    item2_enabled: true, item2_icon: 'shield',
    item2_title: 'Secure Checkout',
    item2_text:  '256-bit SSL encryption on every transaction',
    item3_enabled: true, item3_icon: 'returns',
    item3_title: 'Easy Returns',
    item3_text:  '30-day hassle-free returns on all items',
    item4_enabled: true, item4_icon: 'phone',
    item4_title: 'Expert Support',
    item4_text:  'Live chat & phone help from bath specialists',
  },

  trust_band: {
    enabled: true,
    show_on: 'all',
    bg_color: '',   // '' = CSS default (whisper)
    text_color: '', // '' = CSS default (navy)
    stat1_value: '', stat1_label: 'Happy customers nationwide', stat1_icon: '🏠',
    stat2_value: '', stat2_label: 'Premium products in stock',  stat2_icon: '⭐',
    stat3_value: 'Free', stat3_label: 'Shipping on every single order', stat3_icon: '🚚',
  },
  parallax: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Design Inspiration',
    title_line1: 'Your Dream Bathroom',
    title_line2: 'Starts Here',
    subtitle: 'From contemporary minimalism to classic elegance — we carry the brands and styles to bring your vision to life.',
    cta1_text: 'Shop All Vanities', cta1_url: '/collections/bathroom-vanities',
    cta2_text: 'View Lookbook',     cta2_url: '/lookbook',
    image_url: '/images/parallax-bg.jpg',
    image_alt: 'Luxury bathroom inspiration',
  },
  /* ── STYLE GUIDES PREVIEW ───────────────────────────────────────
     A sub-block of the Style Guides (inspiration) section on the homepage:
     a scrollable box showing the opening of one guide, so the homepage
     carries real prose rather than only card titles.

     THE TEXT LIVES HERE AND NOWHERE ELSE. index.ejs renders these values
     with no hardcoded copy of its own, so this is the single source. That
     works because load() deep-merges DEFAULTS with the settings file on
     every read — a NEW key added here does reach the live site. (The trap
     recorded in CLAUDE.md is about CHANGING a default that already exists
     in the settings file: there the file's value wins and the edit here
     does nothing. Adding is safe; editing an existing key is not.)

     WHY THE SUBHEAD IS ITS OWN FIELD RATHER THAN MARKUP IN THE BODY
     In the guide it is an <h2>. Carried across as a heading it would add
     one back to the homepage immediately after eight were deliberately
     removed, so it renders as styled bold text instead. Keeping it as a
     separate plain-text field means no HTML in a textarea and no way for
     an editor to reintroduce a heading by accident.

     DUPLICATE CONTENT, ACKNOWLEDGED
     This is 228 of the guide's 558 words, also live at
     /inspiration/farmhouse-bathroom-vanity-ideas. Not a penalty, but Google
     must choose which page ranks for these phrases and the homepage is the
     stronger one. Sam was shown the figure and accepted it. If the guide
     ever underperforms on "farmhouse vanity" terms, shorten this first. */
  inspiration: {
    preview_enabled:  true,
    preview_eyebrow:  'From the guide',
    preview_heading:  'Farmhouse Bathroom Vanity Ideas',
    preview_body1:    'Farmhouse bathrooms have a way of feeling like they have always been there — warm, textured, and quietly beautiful. The vanity is the heart of this aesthetic, and getting it right means balancing rustic character with everyday practicality. Shaker-style cabinet doors, natural wood tones, and hardware in matte black or oil-rubbed bronze are the building blocks of the look. Whether you are designing a sprawling primary bathroom or refreshing a compact powder room, farmhouse vanity ideas give you a timeless foundation that holds its value and charm for decades.',
    preview_subhead:  'The Essential Elements of Farmhouse Style',
    preview_body2:    'The Shaker cabinet door is farmhouse design at its most enduring. Its recessed flat panel and clean rail construction are simple enough to blend into almost any space, yet distinctive enough to anchor a clear aesthetic. Pair Shaker doors with matte black hardware for a contemporary farmhouse feel — this combination has become the defining look of modern farmhouse interiors. For a warmer, more vintage interpretation, oil-rubbed bronze or unlacquered brass hardware evokes the patina of a well-loved country kitchen. Wood plays an equally central role: white oak and walnut bring a refined warmth, while painted finishes in soft white, warm cream, or sage green suit a more cottage-inspired direction. The countertop choice matters too — honed Carrara marble, white quartz, or a butcher-block top each reinforce the farmhouse character in different ways.',
    preview_lines:    6,   // visible lines before the box scrolls
    preview_cta_text: 'Read the full guide',
    preview_cta_url:  '/inspiration/farmhouse-bathroom-vanity-ideas',
  },
  testimonials: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Customer Reviews',
    heading: 'What Our Customers Say',
    subtitle: 'Join thousands of happy homeowners who transformed their bathrooms',
    items: [
      { text: '', author: '', location: '', rating: 5 },
      { text: '', author: '', location: '', rating: 5 },
      { text: '', author: '', location: '', rating: 5 },
    ],
  },
  newsletter: {
    enabled: true,
    show_on: 'all',
    eyebrow: 'Join the Community',
    heading: 'Get Exclusive Deals & Design Ideas',
    subtitle: '',
    placeholder: 'Your email address',
    button_text: 'Get Early Access',
    success_message: "You're in! Check your inbox for a welcome gift.",
    disclaimer: 'No spam. Unsubscribe anytime.',
  },
  video_text: {
    enabled: false,
    show_on: 'all',
    video_url: '',          // YouTube URL or direct .mp4 URL
    video_side: 'left',     // 'left' | 'right'
    split: '50',            // '40' | '50' | '60' — video column width %
    eyebrow: '',
    heading: 'See Our Products in Action',
      /* 'p' = looks identical, left out of the page outline. A heading should
         name a topic the page can rank for; a section label does not. Sam,
         2026-10-03. Override per-section in the Theme Editor (Heading Level ->
         "Label (not a heading)"), which wins over this default.
         NOTE: data/theme_settings.json had no *_level key for any of these, so
         this default is what renders. If one is ever saved, it wins.*/
      /* 'p' = looks identical, left out of the page outline. A heading should
         name a topic the page can rank for; a section label does not. Sam,
         2026-10-03. Override per-section in the Theme Editor (Heading Level ->
         "Label (not a heading)"), which wins over this default.
         NOTE: data/theme_settings.json had no *_level key for any of these, so
         this default is what renders. If one is ever saved, it wins.*/
    heading_level: 'p',
    body: '',
    cta_text: '',
    cta_url: '',
  },
  image_with_text_2: {
    enabled: false,
    show_on: 'all',
    image_url: '', image_alt: '',
    image_position: 'right',
    eyebrow: '',
    heading: '',
    body: '',
    cta_text: '',
    cta_url: '',
  },
  before_after_2: {
    enabled: false,
    show_on: 'all',
    eyebrow: '',
    heading: '',
    subtitle: '',
    before_image: '', before_label: 'Before',
    after_image: '', after_label: 'After',
    initial_pos: 50,
  },
  video_text_2: {
    enabled: false,
    show_on: 'all',
    video_url: '',
    video_side: 'left',
    split: '50',
    eyebrow: '',
    heading: '',
    heading_level: 'h2',
    body: '',
    cta_text: '',
    cta_url: '',
  },
  trust_band_2: {
    enabled: false,
    show_on: 'all',
    bg_color: '', text_color: '',
    stat1_value: '', stat1_label: '', stat1_icon: '',
    stat2_value: '', stat2_label: '', stat2_icon: '',
    stat3_value: '', stat3_label: '', stat3_icon: '',
  },
  parallax_2: {
    enabled: false,
    show_on: 'all',
    eyebrow: '',
    title_line1: '',
    title_line2: '',
    subtitle: '',
    cta1_text: '', cta1_url: '',
    cta2_text: '', cta2_url: '',
    image_url: '', image_alt: '',
    overlay_color: '#0f1f35',
    overlay_opacity: 65,
  },
  testimonials_2: {
    enabled: false,
    show_on: 'all',
    eyebrow: '',
    heading: '',
    subtitle: '',
    items: [],
  },
  /* featured_models was missing from this list. The live site renders it
     anyway because the saved order in the database contains it and
     index.ejs splices in any known key that is absent — but a fresh
     install would have shipped without it. Added so the default matches
     what the site actually shows. */
  /* sample_banner sits DIRECTLY AFTER the hero, which is where the owner
     asked for it. It is the cheapest thing on the site to say yes to, so
     it earns the position above the vanity merchandising — someone who
     is not ready to spend $2,000 can still take a step here. */
  homepage_section_order: [
    'scrolling_ticker','hero','hero_mobile','value_bar','sample_banner','brand_logos',
    'categories_section','bundle_teaser',
    'featured_section','featured_models','image_with_text','video_text','before_after',
    'trust_band','parallax','testimonials','newsletter',
  ],

  /* ── FREE SAMPLES BANNER ──────────────────────────────────────────
     The acquisition driver for the sample offer. A section rather than
     hardcoded markup so it can be turned off, reworded or reordered from
     the Theme Editor without a deploy — an offer is the kind of thing an
     owner wants to change on a Tuesday afternoon.

     ⚠️ THE NUMBERS ARE NOT EDITABLE HERE, DELIBERATELY. "2" and the
     $9.99 extras price come from src/config/sampleOffer.js, which is
     also what the cart and checkout price against. A Theme Editor field
     saying "3 free samples" while the cart gives 2 would be a promise
     the site does not keep, and the customer would be right to be
     annoyed. Wording is editable; arithmetic is not.

     No image by default. The samples category image can be set here, but
     the banner reads fine as text and an empty image box is worse than
     no image box — see the CLS note on iwt above. */
  sample_banner: {
    enabled: true,
    show_on: 'all',
    /* 'p', matching bundle_teaser: a section label is not a heading the
       page should rank for. Overridable per-section in the editor. */
    heading_level: 'p',
    eyebrow:  'See it in your own light',
    heading:  'Your first 2 samples are free',
    subtitle: 'Screens lie about colour. Wood grain and stone veining look '
            + 'different under your own bathroom light, and a vanity is not '
            + 'something you want to guess at. Pick any two — free, with free '
            + 'shipping.',
    /* left | center | right. Governs the text AND which side the
       capped-width block sits on, because centred text in a block
       pinned left reads as a mistake rather than a choice. Validated
       against the three values in index.ejs - anything else falls back
       to center. */
    text_align: 'center',
    /* '' = the section's stylesheet default. Validated by _cssColor in
       index.ejs, which rejects anything that is not a real colour -
       the attribute is written with the raw tag, so an unvalidated
       value here would be attribute injection. */
    bg_color: '',
    text_color: '',
    cta_text: 'Browse samples',
    /* The samples CATEGORY page, which already exists and already renders
       sample images correctly (collectionsController COALESCEs
       primary_image_url with product_images.url — all 69 sample rows have
       the image in the join table and NULL in the column). No bespoke
       picker was built because this page already is one. */
    cta_url:  '/collections/samples',
    image:    '',
    image_alt: 'Wood, stone and metal finish samples',
  },

  cart_drawer: {
    enabled: true,
    free_shipping_threshold: 0,
    free_shipping_message: '🎉 You qualify for FREE shipping!',
    progress_message: 'Add <strong>${{remaining}}</strong> more for free shipping',
    empty_message: 'Your cart is empty',
    empty_cta_text: 'Start Shopping',
    empty_cta_url: '/collections/bathroom-vanities',
  },
  /* ── SEO ────────────────────────────────────────────────────────────
     filter_landing_min_products — how many products a filtered collection
     page must have before it is promoted to a real, indexable landing page
     with its own title, meta description, H1 and intro, canonicalising to
     ITSELF rather than to the parent collection.

     Below the threshold the page behaves exactly as it always has: parent
     canonical, parent title and meta, no intro. That is deliberate. A page
     with seven products and a paragraph of copy is the thin-content case
     that makes indexing faceted navigation backfire — Google sees a
     near-duplicate of the parent with little unique value, and a shopper
     arriving from "coastal bathroom vanity" finds seven results where the
     search promised a category.

     A THRESHOLD RATHER THAN A HAND-PICKED LIST, because the catalogue
     moves: the James Martin feed adds products nightly, so Coastal at 7
     today may be 60 next quarter, and a list of "the good ones" would be
     wrong in both directions within weeks. Content is written for all 27
     filter values (src/config/filterLandingPages.js); this number decides
     which of them are live at any moment, and the set self-corrects.

     25 because the grid serves 24 per page, so a promoted page always has
     at least one full grid and a second page. That makes the line
     defensible rather than arbitrary. Raise it to be more conservative;
     set it to 0 to promote every value that has content written. */
  seo: {
    filter_landing_min_products: 25,
  },

  social: {
    facebook_url:  '',   // e.g. https://facebook.com/YourPage
    instagram_url: '',   // e.g. https://instagram.com/yourhandle
    twitter_url:   '',   // e.g. https://x.com/yourhandle
    pinterest_url: '',   // e.g. https://pinterest.com/yourprofile
    linkedin_url:  '',   // e.g. https://linkedin.com/company/yourcompany
    /* Yelp is FOLLOW-ONLY and appears in the footer alone. The bars on
       product.ejs and inspiration-guide.ejs are SHARE bars — they push the
       current page to a platform — and Yelp has no share intent: you review
       a business there, you do not post a link to a vanity. Adding it to
       those bars would render a button that cannot do anything. */
    yelp_url:      '',   // e.g. https://www.yelp.com/biz/your-business
  },
  footer: {
    brand_desc: 'Premium vanities, mirrors, faucets & accessories — at prices that make sense. Free shipping on every order.',
    copyright_name: 'BathroomVanitiesOutlet.com',
    /* ── Footer LINKS are not here ────────────────────────────────
       col_shop_links / col_help_links / col_company_links were removed
       2026-09-13. Footer links come from the Menu Manager (nav_menus
       handles footer-shop, footer-help, footer-company) and from nowhere
       else. views/partials/footer.ejs reads only `footerMenus`.

       Two lists for one footer is what caused the bug. This copy held the
       pre-migration-012 short slugs — /pages/shipping, /pages/returns,
       /pages/contact, /pages/about, /pages/privacy — and every one of them
       404'd, verified live 8 Sept 2026. It had been broken since the footer
       was built and nobody noticed, because a 404 on a footer link is
       invisible until somebody clicks it, and because the template preferred
       the menus whenever they existed. Emptying a menu would have silently
       swapped working links for broken ones.

       Slug history, kept because it is the trap: migration 012 seeded the
       LONG forms — shipping-policy, returns-policy, privacy-policy,
       terms-and-conditions, about-us, contact-us. Any footer or CTA URL
       using the short form is a 404.

       Terms & Conditions was added to the footer 8 Sept 2026; it had not
       been linked anywhere on the site, and an unlinked Terms page is close
       to unenforceable. It now lives in the footer-company menu — if it
       disappears from the footer, that menu is where to look.

       HEADINGS stay in theme settings (above), so "Help" can be renamed
       without touching menus. Links do not. ───────────────────────── */
    col_shop_heading: 'Shop',
    col_help_heading: 'Help',
    col_company_heading: 'Company',
  },
};

/* ── In-memory cache ─────────────────────────────────────────── */
let _cache = null;

/* ── DB helpers ──────────────────────────────────────────────── */

/**
 * Fire-and-forget: write complete settings JSON to app_settings table.
 * Called from _persistSettings in adminController after arrays are merged in.
 * Non-fatal — if the table doesn't exist yet, logs nothing (expected before migration).
 */
function persistToDb(settings) {
  bvoPool.query(
    'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ' +
    'ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
    ['theme_settings', JSON.stringify(settings)]
  ).catch(e => {
    if (!e.message.includes("doesn't exist")) {
      console.error('[theme] DB save failed:', e.message);
    }
  });
}

/**
 * Called once at server startup (before app.listen).
 * — If the settings file EXISTS: sync it to DB so DB is always current.
 * — If the settings file is MISSING (fresh Hostinger deploy): restore from DB.
 * Either way, gracefully no-ops if app_settings table doesn't exist yet.
 */
async function initFromDb() {
  if (fs.existsSync(SETTINGS_PATH)) {
    // File exists — push a copy to DB so the next deploy can restore from it
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      await bvoPool.query(
        'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ' +
        'ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
        ['theme_settings', raw]
      );
      console.log('[theme] Settings synced to DB on startup');
    } catch (e) {
      if (!e.message.includes("doesn't exist")) {
        console.error('[theme] Startup DB sync failed:', e.message);
      }
    }
    return;
  }

  // File missing — attempt to restore from DB (handles fresh Hostinger deploys)
  console.log('[theme] Settings file missing — attempting DB restore...');
  try {
    const [rows] = await bvoPool.query(
      'SELECT value FROM app_settings WHERE `key` = ?',
      ['theme_settings']
    );
    if (rows.length && rows[0].value) {
      const settings = deepMerge(DEFAULTS, JSON.parse(rows[0].value));
      const dir = path.dirname(SETTINGS_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
      _cache = settings;
      console.log('[theme] Settings restored from DB to disk ✓');
    } else {
      console.log('[theme] No saved settings in DB — starting from defaults');
    }
  } catch (e) {
    if (!e.message.includes("doesn't exist")) {
      console.error('[theme] DB restore failed:', e.message);
    }
    console.log('[theme] DB restore unavailable — starting from defaults');
  }
}

function load() {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    _cache = deepMerge(DEFAULTS, JSON.parse(raw));
  } catch {
    _cache = deepMerge({}, DEFAULTS);
  }
  return _cache;
}

function get() {
  return load();
}

function reload() {
  _cache = null;
  return load();
}

/**
 * Save a flat key=value map from the admin form back to JSON.
 * Keys use dot notation: "hero.heading_line1", "footer.col_shop_links[0].label"
 * Array fields (nav.links, footer.*_links) are handled separately.
 */
function save(flat) {
  const settings = deepMerge({}, load()); // clone

  for (const [dotKey, value] of Object.entries(flat)) {
    setDotPath(settings, dotKey, value);
  }

  // Ensure data dir exists
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  _cache = settings;
  return settings;
}

/* ── Helpers ─────────────────────────────────────────────────── */
function setDotPath(obj, dotKey, value) {
  const parts = dotKey.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === undefined || cur[k] === null) {
      cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  // Handle checkbox+hidden pattern: body sends ['false','true'] when checked
  if (Array.isArray(value)) value = value[value.length - 1];
  // Coerce booleans
  if (value === 'true')  cur[last] = true;
  else if (value === 'false') cur[last] = false;
  else cur[last] = value;
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

module.exports = { get, save, reload, persistToDb, initFromDb };
