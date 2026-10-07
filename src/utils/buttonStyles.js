'use strict';

/* buttonStyles.js — ONE place that turns button templates into CSS.
 *
 * WHY A UTIL AND NOT A BLOCK IN main.ejs. The template already carries a
 * :root block, and the obvious thing was to add the button variables inline
 * beside the brand colours. Two reasons not to:
 *
 *   1. Every value here is interpolated into a stylesheet, so it is an
 *      injection surface. main.ejs already learned this the hard way -
 *      _safeColor exists because a raw settings value was being written
 *      into a style attribute (MED-3). Validation that matters belongs
 *      somewhere it can be executed by a gate, not inside an EJS tag.
 *   2. The admin panel has to render the same values the page renders.
 *      Two copies of "what colour is Button 3" is how a control ends up
 *      disagreeing with the page it claims to control.
 *
 * THE VALUE GRAMMAR, deliberately narrow:
 *   #abc  #aabbcc  #aabbccdd   a literal colour
 *   transparent                the keyword, used by outline's background
 *   var(--name)                a reference to a brand variable
 * Anything else is dropped and the slot falls back to its seed. There is no
 * rgb(), no hsl(), no colour names beyond transparent - not because they
 * would not work, but because every form allowed is a form the validator has
 * to get right, and this list covers what the editor can produce.
 *
 * WHY var() IS ALLOWED AT ALL: the five seeded templates point their
 * backgrounds at --navy, --sage and --amber, which main.ejs fills from the
 * brand palette. Freezing them to hex would mean editing Sage in the Theme
 * Editor no longer moved the sage buttons - a regression the button-token
 * commits were careful to avoid. A reference keeps that chain alive.
 */

/* Accepts a hex colour, the transparent keyword, or a var() reference. */
const SAFE_VALUE = /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent|var\(--[a-zA-Z0-9-]+\))$/;

/* A length for the radius: px, rem, em, %, or 0. No calc(), no var() -
 * nothing here needs them and each one is another thing to validate. */
const SAFE_LENGTH = /^(0|\d{1,3}(?:\.\d{1,2})?(?:px|rem|em|%))$/;

/* Template keys become part of a CSS class name and a custom property, so
 * they are restricted to what is safe in both. */
const SAFE_KEY = /^[a-z][a-z0-9_-]{0,31}$/;

const HOVER_EFFECTS = ['swap', 'brighten', 'darken', 'none'];

function safeValue(v, fallback) {
  v = (v === 0 || v) ? String(v).trim() : '';
  return SAFE_VALUE.test(v) ? v : fallback;
}
function safeLength(v, fallback) {
  v = (v === 0 || v) ? String(v).trim() : '';
  return SAFE_LENGTH.test(v) ? v : fallback;
}
function safeKey(v) {
  v = String(v || '').trim().toLowerCase();
  return SAFE_KEY.test(v) ? v : '';
}
function safeEffect(v) {
  v = String(v || '').trim();
  return HOVER_EFFECTS.indexOf(v) > -1 ? v : 'swap';
}

/* Normalise one template to a shape the emitter can rely on. Returns null
 * for anything without a usable key, so a malformed row cannot emit a rule
 * with an empty selector (`.btn--{...}` would silently style nothing, or
 * worse, something). */
function normalize(t) {
  if (!t || typeof t !== 'object') return null;
  const key = safeKey(t.key);
  if (!key) return null;
  return {
    key:          key,
    name:         String(t.name || key).slice(0, 48),
    bg:           safeValue(t.bg,        'transparent'),
    border:       safeValue(t.border,    'transparent'),
    fg:           safeValue(t.fg,        '#000'),
    hover_bg:     safeValue(t.hover_bg,  safeValue(t.bg, 'transparent')),
    hover_fg:     safeValue(t.hover_fg,  safeValue(t.fg, '#000')),
    hover_effect: safeEffect(t.hover_effect),
    /* '' means "use the shared radius", which is the sentinel convention
       used throughout this project's settings. */
    radius:       t.radius ? safeLength(t.radius, '') : '',
  };
}

function list(settings) {
  const raw = (settings && settings.buttons && Array.isArray(settings.buttons.templates))
    ? settings.buttons.templates : [];
  const out = [];
  const seen = new Set();
  for (const t of raw) {
    const n = normalize(t);
    if (!n || seen.has(n.key)) continue;   // first wins; a dupe key would
    seen.add(n.key);                        // emit two rules for one class
    out.push(n);
  }
  return out;
}

/* THE SEEDED FIVE own CSS classes that already exist in the views
 * (.btn-navy and friends, used in over a hundred places). Their variables
 * are the ones the stylesheet already reads, so the emitter writes to those
 * names and does NOT generate a class. Anything else is a new template and
 * gets a generated .btn--<key> class. */
const LEGACY = { navy: 'btn-navy', sage: 'btn-sage', primary: 'btn-primary',
                 amber: 'btn-amber', outline: 'btn-outline' };

function isLegacy(key) { return Object.prototype.hasOwnProperty.call(LEGACY, key); }

/* The custom-property block for :root. For the legacy five these are the
 * exact names site-bundle.css already reads, which is why editing a seeded
 * template moves the existing buttons without touching the stylesheet. */
function cssVars(settings) {
  const out = [];
  for (const t of list(settings)) {
    const p = '--btn-' + t.key;
    out.push(`${p}-bg:${t.bg}`);
    out.push(`${p}-fg:${t.fg}`);
    out.push(`${p}-hover-bg:${t.hover_bg}`);
    out.push(`${p}-hover-fg:${t.hover_fg}`);
    out.push(`${p}-border:${t.border}`);
    if (t.radius) out.push(`${p}-radius:${t.radius}`);
  }
  return out.join(';') + (out.length ? ';' : '');
}

/* Rules for templates that have no class in the stylesheet, plus the hover
 * treatment for every template. The hover EFFECT is why this cannot just be
 * variables: brighten and darken are filters, not colours, and amber uses
 * one today (filter:brightness(.88)). */
function cssRules(settings) {
  const out = [];
  for (const t of list(settings)) {
    const p   = '--btn-' + t.key;
    const sel = isLegacy(t.key) ? '.' + LEGACY[t.key] : '.btn--' + t.key;

    /* New templates need the whole rule; legacy ones already have theirs in
       the stylesheet and would only be duplicating it. */
    if (!isLegacy(t.key)) {
      out.push(`${sel}{background:var(${p}-bg);color:var(${p}-fg);` +
               `border-color:var(${p}-border)` +
               (t.radius ? `;border-radius:var(${p}-radius)` : '') + '}');
    } else {
      /* A legacy template already has its base rule in the stylesheet, so
         only the parts the stylesheet does NOT read need emitting.

         THE BORDER IS ONE OF THOSE. .btn-navy and friends read
         --btn-<key>-bg and -fg, but nothing reads --btn-<key>-border - only
         outline has a border declaration. So a border control for navy,
         sage, primary or amber would have been another placebo: the value
         would store, the variable would be written, and nothing would read
         it. Emitting the rule only when the border is NOT transparent keeps
         today byte-identical (all four are transparent) while making the
         control real the moment someone sets one. */
      const parts = [];
      if (t.border !== 'transparent') parts.push(`border-color:var(${p}-border)`);
      if (t.radius) parts.push(`border-radius:var(${p}-radius)`);
      if (parts.length) out.push(`${sel}{${parts.join(';')}}`);
    }

    /* ── TWO THINGS THE FIRST VERSION OF THIS GOT WRONG ──────────────────
       1. IT SET border-color ON HOVER UNCONDITIONALLY. The .btn base is
          `border:2px solid transparent`, so painting the hover background
          onto the border makes a 2px ring appear on hover where today there
          is none - a visible change on navy, sage, primary and amber. Only
          outline has a visible border today, and only outline should get
          one on hover. So border-color is emitted ONLY when the template
          actually has a border.

       2. IT HAD NO !important, SO IT WAS DEAD ON ARRIVAL for three of the
          five. site4.css carries `.btn-navy:active,.btn-navy:hover{...
          !important}` and the same for sage and outline. An important
          declaration beats a normal one whatever the source order, so a
          hover control here would have appeared to work and done nothing on
          exactly the buttons the hero uses. Matching !important is the
          smaller change: the alternative is stripping it from site4, and
          those rules presumably won something when they were written.

       The base rules above need no !important - nothing in the stylesheet
       declares a button background as important. */
    const imp = isLegacy(t.key) ? '!important' : '';
    const bord = t.border !== 'transparent'
      ? `;border-color:var(${p}-hover-bg)${imp}` : '';

    if (t.hover_effect === 'swap') {
      out.push(`${sel}:hover,${sel}:active{background:var(${p}-hover-bg)${imp};` +
               `color:var(${p}-hover-fg)${imp}${bord}}`);
    } else if (t.hover_effect === 'brighten') {
      out.push(`${sel}:hover,${sel}:active{filter:brightness(1.12)${imp}}`);
    } else if (t.hover_effect === 'darken') {
      out.push(`${sel}:hover,${sel}:active{filter:brightness(.88)${imp}}`);
    }
    /* 'none' emits nothing, which is the point of it. Note that for a
       legacy template 'none' still leaves the stylesheet's own hover rule
       in force - the emitter can override a declaration but cannot delete
       one. Worth knowing before anyone expects 'none' to mean inert. */
  }
  return out.join('');
}

module.exports = { list, normalize, cssVars, cssRules,
                   isLegacy, LEGACY, HOVER_EFFECTS,
                   SAFE_VALUE, SAFE_LENGTH, SAFE_KEY };
