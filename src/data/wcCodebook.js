/* ═══════════════════════════════════════════════════════════════════════
 *  wcCodebook.js — Water Creation base-SKU decoder
 *
 *  WHAT THIS IS
 *  A WC base SKU is not an opaque identifier. It is a five-part structured
 *  code, and decoding it yields the product attributes for the WHOLE feed
 *  rather than only the models that appear in a supplier catalogue:
 *
 *      P A 6 0 Q Z 0 5 P W
 *      │   │   │   │   └── cabinet colour   PW = Pure White
 *      │   │   │   └────── hardware finish  05 = Polished Nickel
 *      │   │   └────────── top material     QZ = Quartz
 *      │   └────────────── nominal width    60 = 60 inches
 *      └────────────────── collection       PA = Palace
 *
 *  Verified against Lowe's: "Palace 60 In Double Sink Quartz Countertop
 *  Vanity In Pure White with Hardware in Polished Nickel Finish".
 *
 *  ⚠️ I PREVIOUSLY REJECTED THIS APPROACH AND WAS WRONG.
 *  WC_REPORTS_SPEC.md said SKU-grammar decoding was "tried and rejected as
 *  too thin to derive colour". That verdict was reached while checking the
 *  grammar against the 2021 catalogue alone, which describes 64 base models
 *  out of 244 in the feed. The grammar was never the problem — the codebook
 *  was. With the codebook below, coverage of observed drawdown goes from
 *  ~0% to 100% on collection, colour, top material and hardware.
 *
 *  WHY THIS IS A COMMITTED .js MODULE AND NOT A DATA FILE ON DISK
 *  Hostinger runs the app from hbuilds/versions/<uuid>/nodejs/, and the uuid
 *  changes every deploy, so anything reached by a __dirname-relative path to
 *  a sibling folder is broken permanently (OPEN_ITEMS #24 — it cost an hour
 *  the first time). A module is bundled with the code and cannot go missing.
 *
 *  PROVENANCE — every entry below was read off a primary source, never
 *  inferred from the letters:
 *    • "Water Creation Catalog -2020.xlsx" — explicit Collection, Color,
 *      Finish, Material and Number-of-Basins columns; 702 vanity rows,
 *      100% internally consistent on every code it covers.
 *    • "Water Creation product catalog 2021 NEW collections.xlsx" —
 *      Collection Name column + human-readable part numbers
 *      (PY30CW03GG -> PAISLEY-30GG-CW).
 *    • water-creation.com product copy (Shopify search/suggest.json).
 *    • Retailer listings — Home Depot, Lowe's, Kingston Brass, Yala, KBA —
 *      which are the ONLY source for discontinued SKUs that the vendor site
 *      no longer lists (e.g. SE24QZ00NJ, BD24CR06HW).
 *  Full table with a per-row source column: docs/briefs/wc_sku_codebook.csv
 *
 *  ⚠️ DO NOT ADD A CODE BY GUESSING FROM THE LETTERS.
 *  "BD" looks like it should be Baldwin or Bradley. It is Brandy. "EU" looks
 *  like Europa. It is Eureka. An unverified code must stay absent so the
 *  unclassified count remains a real alarm instead of a confident fiction.
 * ═══════════════════════════════════════════════════════════════════════ */

'use strict';

/* Collection prefix -> marketing collection name. */
const COLLECTION = {
  AB: 'Aberdeen',  BD: 'Brandy',    BE: 'Belmont',   BR: 'Bristol',
  CH: 'Chestnut',  CI: 'Cirilla',   DE: 'Derby',     EA: 'Elsa',
  EL: 'Elizabeth', ES: 'Elise',     EU: 'Eureka',    FE: 'Ferrero',
  HA: 'Hartford',  HU: 'Hugo',      MA: 'Madalyn',   MI: 'Mia',
  MQ: 'Marquis',   MS: 'Madison',   MY: 'Myra',      OA: 'Oakman',
  OX: 'Oxford',    PA: 'Palace',    PE: 'Perris',    PO: 'Potenza',
  PY: 'Paisley',   QU: 'Queen',     SE: 'Sequoia',   VE: 'Vera',
  VI: 'Viola',     WE: 'Westin',
};

/* Cabinet colour. Stored verbatim as WC names them (Sam, 2026-11-24:
   "just use the color names they use"), so no colour-family rollup. */
const CABINET_COLOUR = {
  BK: 'Brown Oak',      CG: 'Cashmere Grey',  CL: 'Casa Latte',
  CO: 'Charcoal Oak',   EG: 'Earl Grey',      ES: 'Espresso',
  GG: 'Grizzle Grey',   GK: 'Grey Oak',       GN: 'Glacial Green',
  HW: 'Honey Walnut',   LW: 'Lustrous Walnut',MB: 'Monarch Blue',
  MW: 'Mango Wood',     NJ: 'Noir Juglans',   PW: 'Pure White',
  RS: 'Rustic Sienna',  TL: 'Toffee Latte',   TO: 'Truffle Oak',
  WO: 'Weathered Oak',
};

/* Top MATERIAL only — deliberately not top FINISH.
 *
 * ⚠️ THE CODE DOES NOT DETERMINE THE STONE PATTERN. Measured on the vendor's
 * own copy: SE30QZ00MW is "Whitebrook" while PA60QZ05PW is "Carrara" — same
 * QZ code, different stone. So material is safe to derive from the code and
 * finish is NOT. top_finish is therefore left NULL by the decoder rather
 * than filled with a plausible-looking guess, and its dashboard card will
 * honestly read "no described rows" until a real per-SKU source exists. */
const TOP_MATERIAL = {
  CW: 'Carrara White Marble',
  QZ: 'Quartz',
  EM: 'Engineered Marble',
  CR: 'Ceramic',
  BL: 'Ceramic/Granite',   // legacy, 2020 catalogue only; ~0% of drawdown
};

/* Hardware finish. NOTE: wc_dimensions has no hardware column, so the
   decoder does not write this anywhere — it is kept here because it is
   verified and because the obvious next card ("which finish sells?") will
   want it. Do NOT write it into cabinet_finish: that column means the
   CABINET's finish, and filling it with hardware would quietly corrupt a
   different card. */
const HARDWARE_FINISH = {
  '00': 'None',            '01': 'Chrome',       '03': 'Oil-rubbed Bronze',
  '05': 'Polished Nickel', '06': 'Satin Gold',   '07': 'Matte Black',
  '08': 'Antique Gold',
};

/* Nominal width -> basin count, from vendor product titles
   ("... 48 In. Single Sink ...", "... 60 In. Double Sink ..."). 100%
   consistent across 702 catalogue rows: the break is between 48 and 60. */
const SINKS_BY_WIDTH = {
  18: 1, 20: 1, 24: 1, 30: 1, 36: 1, 48: 1, 60: 2, 72: 2,
};

/* The five-part grammar. Anchored, so a SKU that merely starts with two
   letters cannot slip through. */
const BASE_RE = /^([A-Z]{2})(\d{2})([A-Z]{2})(\d{2})([A-Z]{2})$/;

/**
 * decodeBaseSku(base)
 * Returns attributes for a base SKU, or null when the SKU does not use the
 * grammar at all (washstands, accessories and named one-offs like CIRILLA,
 * EMPIRE, EB30A, BA-0001 — 46 of 244 bases, and essentially no drawdown).
 *
 * A base that MATCHES the grammar but carries an unknown code returns the
 * fields it could resolve and leaves the rest null. It is never dropped
 * wholesale, because width and sink count are still valid even when the
 * collection letters are new.
 */
function decodeBaseSku(base) {
  const m = BASE_RE.exec(String(base || '').trim().toUpperCase());
  if (!m) return null;

  const [, coll, width, top, hw, colour] = m;
  const inches = parseInt(width, 10);

  return {
    collection:      COLLECTION[coll]       || null,
    size_nominal:    inches > 0 ? inches : null,
    top_material:    TOP_MATERIAL[top]      || null,
    cabinet_color:   CABINET_COLOUR[colour] || null,
    sinks:           SINKS_BY_WIDTH[inches] || null,
    /* Not written to the DB — no column — but returned so gates and any
       future report can assert on it. */
    hardware_finish: HARDWARE_FINISH[hw]    || null,
    /* Raw codes, so an unknown one can be surfaced and chased rather than
       silently becoming null. */
    codes: { collection: coll, width, top, hardware: hw, colour },
  };
}

/** Codes present in the grammar but absent from the codebook. Drives the
 *  "unresolved codes" diagnostic — a non-empty result means WC shipped
 *  something new and the codebook needs a verified addition. */
function unknownCodes(base) {
  const d = decodeBaseSku(base);
  if (!d) return null;
  const out = [];
  if (!d.collection)    out.push(`collection:${d.codes.collection}`);
  if (!d.top_material)  out.push(`top:${d.codes.top}`);
  if (!d.cabinet_color) out.push(`colour:${d.codes.colour}`);
  if (!HARDWARE_FINISH[d.codes.hardware]) out.push(`hardware:${d.codes.hardware}`);
  return out;
}

module.exports = {
  decodeBaseSku,
  unknownCodes,
  COLLECTION,
  CABINET_COLOUR,
  TOP_MATERIAL,
  HARDWARE_FINISH,
  SINKS_BY_WIDTH,
  BASE_RE,
};
