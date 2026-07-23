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
    heading_font:   'Lora',
    body_font:      'Lato',
    base_size_px:   16,
    heading_weight: '600',
    colors: { navy:'#182840', amber:'#B8862A', sage:'#5A7A5A', whisper:'#F8F6F2', white:'#FFFFFF' },
    button_radius: '6px',
    card_radius:   '12px',
  },
  seo: {
    home_title:          'BathroomVanitiesOutlet.com | Premium Vanities at Outlet Prices',
    home_description:    'Shop premium bathroom vanities, mirrors, faucets and accessories at outlet prices. Free shipping on every order.',
    og_image:            '/images/og-default.jpg',
    google_analytics_id: '',
  },
  global: {
    site_name:              'BathroomVanitiesOutlet.com',
    site_tagline:           'Premium Vanities. Outlet Prices.',
    contact_email:          'info@bathroomvanitiesoutlet.com',
    contact_phone:          '',
    free_shipping_threshold: 0,
    free_shipping_label:    'Free Shipping on Every Order',
  },
  promo_strip: {
    enabled: true,
    message: 'Free Shipping on Every Order — No Minimum Required',
    link_text: 'Shop Now',
    link_url: '/collections/bathroom-vanities',
    bg_color: '',    // '' = CSS default (sage green)
    text_color: '',  // '' = CSS default (white)
  },
  nav: {
    brand_line1: 'BathroomVanities',
    brand_line2: 'Outlet',
    brand_line3: '.com',
    links: [
      { label: 'Vanities',    url: '/collections/bathroom-vanities', megaMenu: true },
      { label: 'Mirrors',     url: '/collections/mirrors' },
      { label: 'Faucets',     url: '/collections/faucets' },
      { label: 'Accessories', url: '/collections/accessories' },
      { label: 'Sale',        url: '/collections/sale', highlight: true },
    ],
    /** Mega-menu content for the Vanities top-level link.
     *  Kept separate from nav.links so array reindex never corrupts nested keys. */
    vanities_mega: {
      section_heading: 'Shop By Type',
      links: [
        { label: 'Single Sink Vanity', url: '/collections/bathroom-vanities?sink_count=1' },
        { label: 'Double Sink Vanity', url: '/collections/bathroom-vanities?sink_count=2' },
        { label: 'Cabinet Only',       url: '/collections/bathroom-vanities?type=Cabinet+Only' },
      ],
      promo: {
        url:    '/collections/vanity-models',
        eyebrow: 'Our Collection',
        title:  'Every Model,<br>Every Finish',
        sub:    'Browse all vanity collections, sizes, and styles at a glance.',
        cta:    'Browse All Collections',
      },
    },
  },
  scrolling_ticker: {
    enabled: true,
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
  },
  brand_logos: {
    enabled: true,
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
    enabled: true,
    eyebrow: 'Browse by Category',
    title: 'Everything Your Bathroom Needs',
    subtitle: 'Curated collections from the top brands in bath design',
  },
  featured_section: {
    enabled: true,
    eyebrow: 'Staff Picks',
    title: 'Featured Products',
    subtitle: 'Handpicked vanities and accessories our customers love',
    cta_text: 'View All Products',
    cta_url: '/collections/bathroom-vanities',
    limit: 4,
  },
  image_with_text: {
    enabled: true,
    image_url: '',
    image_alt: 'Our showroom floor',
    image_position: 'left',
    eyebrow: 'Why Choose Us',
    heading: 'The Bathroom Renovation Experts',
    body: "We've spent years building direct relationships with the brands homeowners trust most — James Martin, Kohler, Moen, Delta, and more. That means you get authentic, warranty-backed products at prices that don't make sense anywhere else. Free shipping included on every single order.",
    cta_text: 'Our Story',
    cta_url: '/pages/about',
  },
  before_after: {
    enabled: true,
    eyebrow: 'The BVO Difference',
    heading: 'See the Transformation',
    subtitle: 'Real bathrooms renovated with products from BathroomVanitiesOutlet.com',
    before_image: '',
    before_label: 'Before',
    after_image: '',
    after_label: 'After',
  },
  trust_band: {
    enabled: true,
    bg_color: '',   // '' = CSS default (whisper)
    text_color: '', // '' = CSS default (navy)
    stat1_value: '', stat1_label: 'Happy customers nationwide', stat1_icon: '🏠',
    stat2_value: '', stat2_label: 'Premium products in stock',  stat2_icon: '⭐',
    stat3_value: 'Free', stat3_label: 'Shipping on every single order', stat3_icon: '🚚',
  },
  parallax: {
    enabled: true,
    eyebrow: 'Design Inspiration',
    title_line1: 'Your Dream Bathroom',
    title_line2: 'Starts Here',
    subtitle: 'From contemporary minimalism to classic elegance — we carry the brands and styles to bring your vision to life.',
    cta1_text: 'Shop All Vanities', cta1_url: '/collections/bathroom-vanities',
    cta2_text: 'View Lookbook',     cta2_url: '/pages/inspiration',
    image_url: '/images/parallax-bg.jpg',
    image_alt: 'Luxury bathroom inspiration',
  },
  testimonials: {
    enabled: true,
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
    eyebrow: 'Join the Community',
    heading: 'Get Exclusive Deals & Design Ideas',
    subtitle: '',
    placeholder: 'Your email address',
    button_text: 'Get Early Access',
    success_message: "You're in! Check your inbox for a welcome gift.",
    disclaimer: 'No spam. Unsubscribe anytime.',
  },
  image_with_text_2: {
    enabled: false,
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
    eyebrow: '',
    heading: '',
    subtitle: '',
    before_image: '', before_label: 'Before',
    after_image: '', after_label: 'After',
    initial_pos: 50,
  },
  homepage_section_order: [
    'scrolling_ticker','hero','brand_logos','categories_section',
    'featured_section','image_with_text','before_after',
    'trust_band','parallax','testimonials','newsletter',
  ],

  cart_drawer: {
    enabled: true,
    free_shipping_threshold: 0,
    free_shipping_message: '🎉 You qualify for FREE shipping!',
    progress_message: 'Add <strong>${{remaining}}</strong> more for free shipping',
    empty_message: 'Your cart is empty',
    empty_cta_text: 'Start Shopping',
    empty_cta_url: '/collections/bathroom-vanities',
  },
  footer: {
    brand_desc: 'Premium vanities, mirrors, faucets & accessories — at prices that make sense. Free shipping on every order.',
    copyright_name: 'BathroomVanitiesOutlet.com',
    col_shop_heading: 'Shop',
    col_shop_links: [
      { label: 'Bathroom Vanities', url: '/collections/bathroom-vanities' },
      { label: 'Mirrors',           url: '/collections/mirrors' },
      { label: 'Faucets',           url: '/collections/faucets' },
      { label: 'Sale',              url: '/collections/sale' },
    ],
    col_help_heading: 'Help',
    col_help_links: [
      { label: 'Shipping Policy', url: '/pages/shipping' },
      { label: 'Returns',         url: '/pages/returns' },
      { label: 'Contact Us',      url: '/pages/contact' },
    ],
    col_company_heading: 'Company',
    col_company_links: [
      { label: 'About Us',       url: '/pages/about' },
      { label: 'Privacy Policy', url: '/pages/privacy' },
    ],
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
