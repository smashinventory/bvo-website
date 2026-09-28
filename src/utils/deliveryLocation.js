'use strict';

/**
 * deliveryLocation.js — what kind of place is this, and what does the
 * carrier have to send?
 *
 * ══════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO FIX (owner-reported 2026-09-28)
 *
 * There were two choices: residential, or "Commercial — a business with
 * a loading dock or forklift". A small office, studio or retail unit —
 * commercial, but with no dock — had nowhere to go, and picking
 * "Commercial" told us something untrue.
 *
 * That was not a wording problem. shippingController derived the WWEX
 * booking from it:
 *
 *     residential: order.ship_address_type === 'residential'
 *
 * and residential is what puts a LIFTGATE on the truck. So a dockless
 * office booked a shipment with no liftgate: the driver arrives with a
 * 200–400 lb crate and no way to get it off the trailer. Redelivery,
 * storage, and a customer who did nothing wrong.
 *
 * ══════════════════════════════════════════════════════════════════════
 * ONE FIELD WAS CARRYING TWO FACTS
 *
 *   WHO IS THERE       decides the residential delivery surcharge and
 *                      the WWEX locationType.
 *   CAN THEY UNLOAD IT decides whether a liftgate is needed.
 *
 * They are not the same question, and conflating them is what produced
 * the bug. Three buyer-facing choices cover every real combination —
 * a residential address with a forklift is not a thing:
 *
 *   residential         house or apartment   → liftgate, residential
 *   commercial_no_dock  office, studio, shop → liftgate, NOT residential
 *   commercial_dock     dock or forklift     → NO liftgate, NOT residential
 *
 * ══════════════════════════════════════════════════════════════════════
 * EVERY DERIVED FACT LIVES HERE
 *
 * Labels, acknowledgement copy, liftgate and residential all come from
 * this one table. The previous arrangement had the label written out in
 * four templates and the residential rule inline in the controller,
 * which is exactly how a fifth place comes to disagree with the other
 * four. Adding a fourth location type should mean editing this file and
 * nothing else.
 */

/* Legacy rows hold plain 'commercial'. Those orders were placed when
   "Commercial" MEANT "has a dock or forklift" — that was the label on
   the button they clicked — so mapping them to commercial_dock
   preserves what the buyer actually told us. Mapping them to
   commercial_no_dock would retroactively add a liftgate to historical
   shipments and change what those orders mean. */
const LEGACY = { commercial: 'commercial_dock' };

const TYPES = {
  residential: {
    value:       'residential',
    /* Page 1 radio. */
    label:       'Residential',
    detail:      'a house or apartment',
    /* Page 2 / 3 / admin summaries, where there is no room to explain. */
    short:       'Residential',
    /* Page 2 acknowledgement. The buyer is agreeing to a physical fact
       about their delivery, so it has to match what will actually
       happen at their address. */
    ack:         'I understand delivery is to my driveway or curb, and that I need '
               + 'to arrange help to move it from there.',
    residential: true,
    liftgate:    true,
  },

  commercial_no_dock: {
    value:       'commercial_no_dock',
    label:       'Commercial, no dock',
    detail:      'an office, studio or shop — we send a liftgate',
    short:       'Commercial (no dock)',
    ack:         'I understand delivery is to my drive or yard, and that I need '
               + 'to arrange help to move it from there.',
    /* NOT residential — no residential surcharge, and the WWEX
       locationType is commercial. But it still needs a liftgate, which
       is the entire reason this option exists. */
    residential: false,
    liftgate:    true,
  },

  commercial_dock: {
    value:       'commercial_dock',
    label:       'Commercial with a loading dock or forklift',
    detail:      'your staff unload it',
    short:       'Commercial (dock)',
    /* NO "arrange help" clause. They have just told us they have a
       forklift; asking them to line up a second pair of hands reads as
       a form that is not listening. */
    ack:         'I understand delivery is to my yard or dock, and that my staff '
               + 'will unload it.',
    residential: false,
    liftgate:    false,
  },
};

const DEFAULT = 'residential';

/**
 * Raw column value -> a key of TYPES. Never throws, never returns null.
 *
 * A NULL or unrecognised value resolves to residential, which is the
 * CONSERVATIVE choice in both directions: it books a liftgate (so the
 * crate can always come off the truck) and it applies the residential
 * surcharge (so the quote is not short). Being wrong in the other
 * direction strands a delivery.
 */
function normalise(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (TYPES[v]) return v;
  if (LEGACY[v]) return LEGACY[v];
  return DEFAULT;
}

/** The full record. Always an object. */
const info = raw => TYPES[normalise(raw)];

/** Does this address need a liftgate on the truck? */
const needsLiftgate = raw => info(raw).liftgate;

/** Does WWEX treat this as a residential delivery? */
const isResidential = raw => info(raw).residential;

/** The sentence the buyer ticks on page 2. */
const acknowledgement = raw => info(raw).ack;

/** Short label for summaries and the admin screens. */
const shortLabel = raw => info(raw).short;

/** In the order the radios are rendered. */
const ORDER = ['residential', 'commercial_no_dock', 'commercial_dock'];
const all = () => ORDER.map(k => TYPES[k]);

/** Rejects anything not one of the three. Used by validateInfo, which
 *  must NOT accept a legacy value from a live form post — legacy
 *  mapping is for reading old rows, not for accepting new input. */
const isValid = v => Object.prototype.hasOwnProperty.call(TYPES, String(v || ''));

module.exports = {
  TYPES, ORDER, DEFAULT,
  normalise, info, all, isValid,
  needsLiftgate, isResidential, acknowledgement, shortLabel,
};
