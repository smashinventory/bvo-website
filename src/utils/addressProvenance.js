/**
 * Where a delivery address came from — decided on the SERVER, never in the
 * browser.
 *
 * WHY THIS IS ITS OWN FILE
 * It is a pure function of the request body: no database, no session, no
 * network. Living in checkoutController meant a gate could not exercise it
 * without loading the whole controller, which loads the DB config, which
 * hard-exits when DB_PASS is unset. A test that needs a database password
 * to check string comparison is a test that will be skipped.
 *
 * WHAT THE PAGE SENDS AND WHY IT IS NOT TRUSTED
 * checkout-info.ejs posts three hidden fields: the Place ID it selected,
 * Google's formatted address, and a snapshot of the four values that
 * autocomplete actually wrote into the form. It deliberately does NOT post
 * a source string.
 *
 * A source string the page can set is a fraud signal the fraudster
 * controls. Anyone can post ship_address_source=autocomplete alongside a
 * hand-typed address, and a signal like that is worse than no signal at
 * all, because a human reading the order screen reads it as
 * corroboration. So the answer is computed here, by comparing the
 * snapshot against what was actually SUBMITTED.
 *
 * THE THREE OUTCOMES
 *   autocomplete - picked from the dropdown and left alone.
 *   edited       - picked from the dropdown, then changed by hand. The
 *                  interesting one: this is how a real street acquires a
 *                  house number that does not exist on it.
 *   typed        - never used the dropdown, or the script never loaded.
 *
 * 'typed' is the honest default for every ambiguous case - no Place ID, a
 * malformed one, a missing or unparseable snapshot, JavaScript switched
 * off. None of those are failures and none of them are suspicious; they
 * are simply an address nobody can vouch for beyond the buyer.
 */

/** Case and whitespace are not edits. Someone retyping their own address
 *  in capitals has not changed it. */
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The four fields autocomplete is allowed to fill. ship_address2 is
 *  absent on purpose: the buyer owns the unit number, the filler never
 *  writes it, so it can never be part of an edit comparison. */
const FILLED = ['ship_address1', 'ship_city', 'ship_state', 'ship_zip'];

const TYPED = Object.freeze({ placeId: null, formatted: null, source: 'typed' });

function addressProvenance(body) {
  const b = body || {};

  /* Place IDs are documented as opaque; Google's are URL-safe base64-ish.
     Anything else did not come from Google, so it is not stored. A
     rejected id degrades to 'typed' rather than being kept as junk or
     treated as an error - the address is still perfectly deliverable. */
  const placeId = String(b.ship_place_id || '').trim();
  if (!placeId || !/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) return { ...TYPED };

  let snap;
  try { snap = JSON.parse(String(b.ship_autofill_snapshot || '')); }
  catch { return { ...TYPED }; }
  /* typeof null === 'object', and an array passes that test too. Both would
     make every field comparison undefined === undefined, which is true,
     which would report a hand-typed address as 'autocomplete'. */
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return { ...TYPED };

  /* Field by field, not on one joined string: joining lets a value that
     moved from one field to another cancel itself out. */
  const same = FILLED.every(k => norm(snap[k]) === norm(b[k]));

  return {
    placeId,
    /* VARCHAR(255). Truncated deliberately rather than left for MariaDB to
       cut silently in non-strict mode. */
    formatted: String(b.ship_formatted_address || '').trim().slice(0, 255) || null,
    source: same ? 'autocomplete' : 'edited',
  };
}

module.exports = { addressProvenance, SOURCES: ['autocomplete', 'edited', 'typed'] };
