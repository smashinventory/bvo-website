# BVO Admin Shipping vs. SpeedShip LTL — Field-by-Field Gap Analysis
*Captured 2026-08-31 from the live SpeedShip form at `https://www.speedship.com/ship/freight/ltl`*
*Account: Bathroom Vanities Outlet · Sender Marietta GA 30066 · Receiver Beverly Hills CA 90210*

> **Status: findings only. No code changed. Awaiting approval per CLAUDE.md Rule 1.**

---

## Note on the portal URL

The live portal is **`www.speedship.com`** (auth at `auth.speedship.com`), not `speedship.wwex.com` as recorded in SHIPPING_WWEX_BRIEF.md. The API base (`speedship.wwex.com/svc`) is separate from the customer UI host and is unaffected.

Re-confirmed this session: Angular Material `mat-select` will not open via programmatic click. Location Type option values could not be read from the UI and must be resolved from the API/Postman side.

---

## CATEGORY A — Data collected in BVO but silently dropped before it reaches WWEX

**These are live defects, not missing features. The admin checks a box, sees no error, and the rate comes back without the charge — then the actual invoice differs.**

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| A1 | **`buildAccessorials()` is never called** | `shippingController.js:369` (defined), zero call sites | Every accessorial it maps is dropped. Dead code. |
| A2 | **`residentialDeliveryFlag` absent from LTL payload entirely** | `shippingController.js` LTL `shopPayload` (~line 274-289) | `residentialPickupFlag` exists; delivery counterpart does not. **Highest-impact item** — residential delivery is the most common accessorial for vanity shipments to homes. Rates quote without the residential surcharge. |
| A3 | **`sortAndSegregateFlag: false` hardcoded** | `shippingController.js:285` | `acc_sortAndSegregate` checkbox collected and ignored. |
| A4 | **Two checkboxes → one field, wired to the wrong one** | `shippingController.js:275` — `holdAtTerminalFlag: !!b.dropAtTerminal` | UI has both `acc_dropAtTerminal` and `acc_holdAtTerminal`. "Hold Shipment at Terminal" does nothing; "Drop at Terminal" sets hold-at-terminal. These are different accessorials (DAT vs HAT). |
| A5 | Grocery Consolidation Pickup / Delivery collected, never sent | `create.ejs` `acc_groceryPickup`, `acc_groceryDelivery` | No payload field. |
| A6 | Insurance + declared value collected, never sent | `create.ejs` `ltl_insure`, `acc_declaredValue` | No payload field. |
| A7 | Handling charge collected, never sent | `create.ejs` `ltl_handling` | No payload field. |
| A8 | Billing terms collected, never sent | `create.ejs` `ltl_billing` | No payload field. Shipments always bill default account. |
| A9 | Commodity `pieceType` collected, never sent | `create.ejs` `.comm-ptype` → `getHandlingUnits()` | Present in SpeedShip's `shippedItemList`. |
| A10 | Destination email collected, never sent | `create.ejs` `dest_email` | LTL `contactList` omits email. |

---

## CATEGORY B — Fields SpeedShip has that BVO lacks

### B1. Two Limited Access Location Type dropdowns (structural)

SpeedShip has **separate** dropdowns:
- **Pickup/Limited Access Location Type** (above Pickup Services checkboxes)
- **Delivery/Limited Access Location Type** (above Delivery Services checkboxes)

BVO has **one** generic `dest_locationType` select, in the Destination card. There is no origin/pickup location type at all — origin `locationType` is hardcoded `null` at `shippingController.js:307`.

**Also unresolved:** BVO's option values are `BUSINESS_WITH_DOCKS` / `BUSINESS_WITHOUT_DOCKS` (plural). The Postman-confirmed values in SHIPPING_WWEX_BRIEF.md are singular — `BUSINESS_WITH_DOCK` / `BUSINESS_WITHOUT_DOCK`. Could not read the live enum (mat-select). **Must be resolved against the API before changing.**

### B2. Per-commodity Total Weight

SpeedShip: each Commodity row has its own **Total weight (lbs.)** field.
BVO: commodity weight is inherited from the parent HU's gross weight —
```javascript
weight: parseFloat((hu.querySelector('.hu-weight') || {}).value) || null
```
With multiple commodities on one HU, every commodity gets the **full HU weight**, so `shippedItemList` weights sum to N× the true weight. Mixed-class pallets will mis-rate.

### B3. Hazmat toggle

SpeedShip: per-commodity **Hazmat** switch.
BVO: `isHazMat: false` hardcoded in `shippingController.js:349`. No UI.

### B4. Commodity Description separate from Commodity Name

SpeedShip has **both** "Commodity Name" (searchable, maps to the saved commodity) **and** a separate optional "Description" field.
BVO has one `comm-desc` field serving both roles.

### B5. Handling Unit Type option set

| | Count | Values |
|---|---|---|
| SpeedShip | 19 | Bag, Bale, Box, Bundle, Carton, Case, Crate, Cylinder, Drum, Pail, Pallet, Pieces, Reel, Roll, Skid, Tank, Tote, Trailer, Tube |
| BVO | 7 | PLT, BOX, BAG, DRM, RLL, SKD, OTH |

**12 missing:** Bale, Bundle, Carton, Case, Crate, Cylinder, Pail, Pieces, Reel, Tank, Tote, Trailer, Tube. BVO's `OTH` has no SpeedShip equivalent.

### B6. Piece Type option set

SpeedShip: 19 values (same list as HU Type, but with **Piece** instead of **Pieces**).
BVO: `PIECE_TYPES` constant — needs verification against this list.

### B7. Smaller missing items

| Item | SpeedShip | BVO |
|---|---|---|
| Skip Address Verification toggle | ✓ | ✗ |
| Swap sender/receiver button | ✓ (`compare_arrows`) | ✗ |
| Address Notes field | ✓ | ✗ |
| Address book (save/update, searchable Company or Name) | ✓ | ✗ — plain text inputs |
| Handling Unit save/copy as reusable template | ✓ (SAVE / COPY) | ✗ |
| Calculate Density helper | ✓ | ✗ |
| UPS Capital Terms & Conditions link by insurance | ✓ | ✗ |
| Live Shipment Summary side panel | ✓ | ✗ |

---

## CATEGORY C — Defaults that differ

| Field | SpeedShip | BVO | Note |
|---|---|---|---|
| Freight Class | **85** | `""` (Auto) | BVO sends `commodityClass: ''` when untouched |
| Stackable | **Yes** | **No** | BVO default is more conservative — costs more |
| Liftgate Delivery | unchecked | **checked** | BVO pre-checks it; adds cost to every quote by default |

---

## CATEGORY D — Where BVO is ahead

Worth preserving; do not regress these:

- Two-layer Handling Unit → Commodity UI is clearer than SpeedShip's flat layout
- Saved commodity picker with NMFC + class presets (Top/Sink/Vanity, Bathtub, Toilet) pre-fills correctly
- Pallet Size → auto-fills L/W dimensions
- Order linking (`?orderId=`) pre-fills destination and handling units from order line items
- Residential checkbox auto-syncs accessorials + location type (`onResidentialChange()`)

---

## Accessorial checkbox parity — full match ✓

All 7 pickup, 9 delivery, and 2 shipment-service checkboxes match SpeedShip exactly, in the same groupings. Pallet Size options match exactly (10 + Other). The **UI** is right; the **payload wiring** (Category A) is where it breaks.

---

## Recommended fix order

**Phase 1 — Payload wiring (Category A).** No UI change. Fixes real money bugs. `shippingController.js` only.
Priority within phase: A2 (residential delivery) → A4 (hold/drop mixup) → A3 (sort & segregate) → A1 (wire up or delete `buildAccessorials`) → A5–A10.

**Phase 2 — Structural correctness.** B2 (per-commodity weight), B1 (dual location type + enum verification).

**Phase 3 — Field coverage.** B5/B6 (option sets), B3 (hazmat), B4 (description).

**Phase 4 — Convenience/UX.** B7 items.

Phase 1 requires no new WWEX field names beyond what is already Postman-confirmed. Phase 2's B1 is blocked on resolving the `_DOCK` vs `_DOCKS` enum.
