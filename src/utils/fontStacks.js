'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   THE FONT LIST. One canonical place, per CLAUDE.md Rule 10.

   Sam's rule, 2026-09-24:

       "I do not want to leave the ability for a future admin to unknowingly
        add fonts that negatively impact loading speed and LCP/FCP. I want
        only fast loading ubiquitous font options to be presented as font
        options in the theme editor. We should have good options available,
        but not have access to heavy destructive ones."

   So this is not a default that can be overridden — it is the whole set of
   choices. Every entry here is already installed on the devices that matter
   and downloads NOTHING. There is no webfont option, and adding one means
   editing this file deliberately, having read
   docs/briefs/BVO_TYPOGRAPHY_DECISION.md.

   WHY A RESOLVER AND NOT JUST A DROPDOWN. Restricting the <select> alone
   would be theatre: theme settings also arrive from data/theme_settings.json
   and from the app_settings row in the DB, neither of which goes through the
   form. resolve() is what actually enforces the rule — anything not on this
   list becomes the default. A stale 'Lora' sitting in the saved settings
   therefore renders as Georgia and cannot produce a Google request, which is
   exactly the state the site was found in.

   EVERY STACK IS COMPLETE. The value stored in settings is a key, not a
   family name, and the stack is looked up here. That matters because the
   good cross-platform choices are not single families: "Palatino" has three
   different names across macOS, Windows and Linux, and naming only one of
   them silently falls back to Times on the other two.
   ───────────────────────────────────────────────────────────────────────── */

/* kind is only used to group the dropdown; it does not restrict where a
   choice may be used. A sans heading is a legitimate design choice. */
const CHOICES = [
  // ── Serif ────────────────────────────────────────────────────────────
  { value: 'Georgia', kind: 'serif', label: 'Georgia',
    stack: 'Georgia, Cambria, "Times New Roman", serif',
    note: 'BVO default. Designed for screens, wide and readable at small sizes.' },

  { value: 'Palatino', kind: 'serif', label: 'Palatino',
    stack: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    note: 'Softer and more calligraphic than Georgia. Three names across platforms — all listed.' },

  { value: 'Times New Roman', kind: 'serif', label: 'Times New Roman',
    stack: '"Times New Roman", Times, Georgia, serif',
    note: 'Narrow. Fits more words per line; reads traditional, newsprint-like.' },

  { value: 'ui-serif', kind: 'serif', label: 'System serif',
    stack: 'ui-serif, Georgia, serif',
    note: 'Whatever serif the OS considers native. New York on Apple, Georgia elsewhere.' },

  // ── Sans-serif ───────────────────────────────────────────────────────
  { value: 'system-ui', kind: 'sans', label: 'System UI',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    note: 'BVO default. The OS interface font — San Francisco, Segoe UI, Roboto. Always present, always instant.' },

  { value: 'Helvetica', kind: 'sans', label: 'Helvetica / Arial',
    stack: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
    note: 'The neutral grotesque. Tighter than system-ui.' },

  { value: 'Verdana', kind: 'sans', label: 'Verdana',
    stack: 'Verdana, Geneva, "DejaVu Sans", sans-serif',
    note: 'Very wide, very legible small. Costs horizontal space.' },

  { value: 'Tahoma', kind: 'sans', label: 'Tahoma',
    stack: 'Tahoma, Verdana, Geneva, sans-serif',
    note: 'Verdana condensed. Good where space is tight.' },

  { value: 'Trebuchet MS', kind: 'sans', label: 'Trebuchet MS',
    stack: '"Trebuchet MS", Tahoma, "Lucida Grande", sans-serif',
    note: 'Humanist, slightly informal. More character than Arial.' },
];

const BY_VALUE = new Map(CHOICES.map(c => [c.value.toLowerCase(), c]));

const DEFAULT_HEADING = 'Georgia';
const DEFAULT_BODY    = 'system-ui';

/**
 * Turn a stored setting into a CSS font-family stack.
 *
 * Anything unrecognised — a legacy 'Lora', a hand-edited JSON value, a
 * hostile POST — resolves to the default rather than being passed through.
 * Nothing from settings ever reaches the stylesheet verbatim.
 *
 * @param {string} value     the stored setting
 * @param {string} fallback  DEFAULT_HEADING or DEFAULT_BODY
 * @returns {string} a complete, CSS-valid font-family value
 */
function resolve(value, fallback) {
  const key = String(value || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const hit = BY_VALUE.get(key);
  if (hit) return hit.stack;
  return BY_VALUE.get(String(fallback).toLowerCase()).stack;
}

/** True when the stored value is one we actually offer. */
function isAllowed(value) {
  return BY_VALUE.has(String(value || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}

module.exports = { CHOICES, resolve, isAllowed, DEFAULT_HEADING, DEFAULT_BODY };
