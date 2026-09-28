'use strict';

/**
 * deviceLabel — a user-agent reduced to something a human recognises.
 *
 * Pure function, own file, same reasoning as addressKey and
 * addressProvenance: a gate can exercise it without DB_PASS.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DELIBERATELY COARSE. Spec §8.2.
 *
 * The label goes in a security email and in the customer's device list.
 * Its only job is: "can you recognise yourself?" It must NOT be a
 * fingerprint.
 *
 * So: operating system family, and nothing else. No version numbers, no
 * browser build, no screen size, no IP, no city. A raw user-agent in an
 * email is both unreadable and a privacy smell — and a precise one
 * invites the reader to panic about a detail they cannot interpret
 * ("Chrome 141.0.7390.55? I use Chrome 140!").
 *
 * The vocabulary is CLOSED. Anything unrecognised becomes
 * "Unknown device", never a passthrough of the raw string — a
 * passthrough would leak the whole user-agent into an email the moment
 * a new browser shipped.
 */

/* Order matters: iPadOS reports "Macintosh" in desktop mode, and
   Android reports "Linux". The more specific test has to run first. */
const RULES = [
  [/\biPhone\b/i,                 'iPhone'],
  [/\biPad\b/i,                   'iPad'],
  [/\bAndroid\b/i,                'Android device'],
  [/\b(Macintosh|Mac OS X)\b/i,   'Mac'],
  [/\bWindows\b/i,                'Windows PC'],
  [/\bCrOS\b/i,                   'Chromebook'],
  [/\bLinux\b/i,                  'Linux computer'],
];

const UNKNOWN = 'Unknown device';

/**
 * @param {string} userAgent  raw UA header
 * @returns {string} e.g. "Mac (Web)". Never longer than the 40-char
 *   device_label column, and never the raw string.
 */
function deviceLabel(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return UNKNOWN;

  for (const [re, name] of RULES) {
    if (re.test(ua)) return `${name} (Web)`;
  }
  return UNKNOWN;
}

module.exports = deviceLabel;
module.exports._UNKNOWN = UNKNOWN;
module.exports._RULES = RULES;
