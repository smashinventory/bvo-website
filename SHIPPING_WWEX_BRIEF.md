# WWEX SpeedShip Shipping Integration — Complete Reference
*Last updated: 2026-08-31*

> **READ THIS before touching any file in `src/services/wwexService.js`, `src/controllers/shippingController.js`, or `views/pages/admin/shipping/`.**

---

## ⛔ SECURITY RULES — ABSOLUTE

- **WWEX API keys never go into chat.** They live in the `.env` file on the Hostinger server only.
- Required `.env` vars: `WWEX_CLIENT_ID`, `WWEX_CLIENT_SECRET`, `WWEX_ENV` (`production` | `staging`)
- Optional separate SMALLPACK creds: `WWEX_SP_CLIENT_ID`, `WWEX_SP_CLIENT_SECRET` (falls back to LTL creds if absent)
- **Deployment SOP: git push scripts only.** Never manual SSH to push code. Hostinger auto-deploys on push to `main`. Scripts are in project root: `git_push_*.sh`

---

## What This Integration Does

Admin users (internal staff) can rate-shop LTL freight + UPS Small Package shipments directly from the admin panel, select a carrier, and book the shipment — generating a BOL (Bill of Lading) number from WWEX SpeedShip.

Entry point: `/admin/shipping/create` (or `/admin/shipping/create?orderId=123` to pre-link to an order).

---

## WWEX SpeedShip V4 API — Key Facts

| Item | Value |
|------|-------|
| Auth URL (prod) | `https://auth.wwex.com/oauth/token` |
| Auth URL (staging) | `https://auth.staging-wwex.com/oauth/token` |
| API base (prod) | `https://speedship.wwex.com/svc` |
| API base (staging) | `https://speedship.staging-wwex.com/svc` |
| Auth type | `client_credentials` (Auth0) |
| Audience (prod) | `wwex-apig` |
| Audience (staging) | `staging-wwex-apig` |
| Request envelope | Every flow call wraps payload as `{ request: payload }` |
| Response envelope | API returns `{ response: ... }` — unwrap with `data.response || data` |

### Flows Used

| Flow | Endpoint | Purpose |
|------|----------|---------|
| `shopFlow` | `POST /svc/shopFlow` | Rate shop — get carrier quotes |
| `quoteOrderFlow` | `POST /svc/quoteOrderFlow` | Book shipment — returns BOL |
| `schedulePickupFlow` | `POST /svc/schedulePickupFlow` | Schedule UPS pickup (SMALLPACK only) |
| `searchShipmentsFlow` | `POST /svc/searchShipmentsFlow` | Track by BOL or PRO number |
| `integratedCancelFlow` | `POST /svc/integratedCancelFlow` | Void/cancel a booked shipment |
| `documentDownloadFlow` | `POST /svc/documentDownloadFlow` | Download BOL PDF, POD, etc. |
| `addressValidationFlow` | `POST /svc/addressValidationFlow` | Validate/normalize address |

---

## shopFlow Response Structure — CRITICAL

**The `productTransactionId` lives at the RESPONSE ROOT, not per-offer.**

```
resp.productTransactionId          ← USE THIS (root level)
resp.offerList[0].offerId          ← carrier-level offer ID → maps to shipmentOfferId in booking
resp.offerList[0].offeredProductList[0].offeredProductId  ← product-level → maps to shipmentOfferedProductId
```

**History of the root-cause bug (fixed 2026-08-31, commit `8010806`):**
- `wwexService.js` was reading `rawOffers[0]?.productTransactionId` (undefined — doesn't exist per-offer)
- This made `_txnId` = `undefined` in the frontend
- Every `quoteOrderFlow` call sent `shipmentProductTransactionId: undefined`
- WWEX could not look up the rate session → rejected with **"shipmentOfferId Expired or Not Valid"**
- Fix: `const txnId = resp.productTransactionId || rawOffers[0]?.productTransactionId || null;`

### Diagnostic Logs (already in wwexService.js shopFlow)

When a rate shop runs, the server log shows:
```
[wwex] shopFlow resp keys: [...]
[wwex] shopFlow resp.productTransactionId: <value>   ← should be non-null
[wwex] shopFlow offer[0] keys: [...]
[wwex] shopFlow offer[0].productTransactionId: <usually undefined>
[wwex] shopFlow using productTransactionId: <value>  ← final value sent to frontend
[wwex] shopFlow offer[0] offerId: <value>  offeredProductList[0].offeredProductId: <value>
```

If `productTransactionId` in the log is `null`, the rate shop API call failed or the response structure changed.

---

## quoteOrderFlow Payload Structure

```javascript
{
  request: {
    mode:                         'SAVE',
    shipmentProductTransactionId: productTransactionId,  // from shopFlow resp root
    shipmentOfferId:              offerId,                // offer-level ID from rate
    shipmentOfferedProductId:     offeredProductId,      // product-level ID (optional)
    isSelfScheduled:              false,
    pickupDate:                   'YYYY-MM-DD 00:00:00',
    readyTime:                    'HH:MM:SS',
    closeTime:                    'HH:MM:SS',
    shipment:                     { ... },               // FULL shipment echoed from shopFlow
  }
}
```

The `shipment` object MUST be the full object from `shopPayload.shipment` (built in `shippingController.getRates()`). It includes all freight flags, handling units, addresses, and commodity details. This is why `shopShipment` is returned from the rates endpoint and stored as `_shopShipment` in the frontend state.

---

## Frontend State Variables (create.ejs)

```javascript
var _rates        = [];          // rate rows from getRates response
var _selected     = null;        // { offerId, offeredProductId, carrier, serviceLevel, totalCharge, transitDays }
var _txnId        = null;        // productTransactionId from shopFlow (root level of response)
var _shopShipment = null;        // full LTL shipment object — echoed back in quoteOrderFlow
var _orderId      = '';          // pre-linked order ID (from URL param ?orderId=)
```

**Critical stale-selection rule:** `_selected` is cleared to `null` every time new rates arrive. This prevents sending a `productTransactionId` from session A paired with `offerId`/`offeredProductId` from a prior expired session B.

---

## Rates → Booking Data Flow

```
1. User fills Step 1 (origin/dest/HUs) → clicks "Get Rates"
   → POST /admin/shipping/rates
   → shippingController.getRates() builds shopPayload, calls wwex.shopFlow()
   → returns { ok, productTransactionId, rates[], shopShipment }

2. Frontend stores:
   _txnId        = d.productTransactionId
   _shopShipment = d.shopShipment
   _selected     = null  (cleared — user must pick from new list)

3. User selects a rate row → _selected = { offerId, offeredProductId, carrier, ... }

4. User reviews Step 3 and clicks "Confirm & Book"
   → POST /admin/shipping/book
   → shippingController.bookShipment() constructs quoteOrderFlow payload:
       shipmentProductTransactionId: productTransactionId  (from body = _txnId)
       shipmentOfferId:              offerId               (from body = _selected.offerId)
       shipmentOfferedProductId:     offeredProductId      (optional)
       shipment:                     _shopShipment (echo-back)
   → calls wwex.quoteOrderFlow()
   → saves BOL to shipments table
   → returns { ok, bolNumber, proNumber, bolUrl }
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/wwexService.js` | WWEX API client. All flows. Token cache (separate LTL/SMALLPACK). Stub mode when credentials absent. |
| `src/controllers/shippingController.js` | Express controller: createForm, getRates, bookShipment, track, cancel, downloadBOL, listShipments |
| `views/pages/admin/shipping/create.ejs` | 3-step booking wizard (Step 1: shipment details, Step 2: rate selection, Step 3: confirm & book) |
| `views/pages/admin/shipping/list.ejs` | Shipments list/tracker |
| `src/routes/admin/shipping.js` (or wired in `admin.js`) | Admin routes for shipping endpoints |

### Route Endpoints

| Method | Path | Handler |
|--------|------|---------|
| GET | `/admin/shipping/create` | `createForm` |
| POST | `/admin/shipping/rates` | `getRates` (AJAX) |
| POST | `/admin/shipping/book` | `bookShipment` (AJAX) |
| GET | `/admin/shipping` | `listShipments` |
| POST | `/admin/shipping/:id/cancel` | `cancelShipment` |
| GET | `/admin/shipping/:id/bol` | `downloadBOL` |

---

## LTL Handling Unit (HU) Model

Each HU has:
- `huType`: PLT (Pallet), BOX, BAG, DRM (Drum), RLL (Roll), SKD (Skid), OTH
- `count`, `grossWeight`, `length`, `width`, `height`, `stackable`
- `commodities[]`: each has `freightClass`, `description`, `weight`, `pieces`, `nmfcCode`

In `shopFlow` payload these become `handlingUnitList[].shippedItemList[]`.

In `create.ejs`, HUs are built by `getHandlingUnits()` which reads the dynamic HU rows in the UI.

---

## LTL Pickup Fields — IMPORTANT

Step 3 (Confirm) dynamically creates `#ltlPickupDate`, `#ltlPickupReady`, `#ltlPickupClose` via `buildConfirmStep()`.

Step 2 has static SMALLPACK-only fields: `#pickupDate`, `#pickupReady`, `#pickupClose` (inside `#pickupFields`, shown only when "Schedule UPS Pickup" checkbox is checked).

`bookShipment()` in `create.ejs` MUST read from the correct set based on `productType`:
```javascript
var isLtl    = (pt === 'LTL');
var _pdId    = isLtl ? 'ltlPickupDate'  : 'pickupDate';
var _prId    = isLtl ? 'ltlPickupReady' : 'pickupReady';
var _pcId    = isLtl ? 'ltlPickupClose' : 'pickupClose';
```
This was a bug (fixed 2026-08-31, commit `8010806`) — previously always read from `#pickupDate` (SMALLPACK field), so LTL pickup date was ignored.

---

## Accessorials Supported

### Pickup
Inside Pickup, Liftgate Pickup, Residential Pickup, Tradeshow Pickup, Construction Pickup, Drop at Terminal, Grocery Pickup

### Delivery
Inside Delivery, Liftgate Delivery, Residential Delivery, Tradeshow Delivery, Appointment, Notify Before Delivery, Hold at Terminal, Grocery Delivery, Construction Delivery

### Shipment
Sort & Segregate, Protect from Freeze, Insurance (with declared value)

### Residential Sync Rule
Checking "Residential Delivery" destination auto-sets `acc_residentialDelivery` + `acc_liftgateDelivery` + `dest_locationType = RESIDENTIAL`. This is wired via `onResidentialChange()`.

### Location Type
Destination has a Location Type dropdown: Business, Business with Dock, Business without Dock, Residential, Construction Site. Passed to WWEX as `destinationAddress.locationType`.

---

## Step 1 Validation (`validateStep1()`)

Before rate fetch, validates:
- Destination ZIP, state, city are filled
- At least one commodity has freight class + weight

Without this, WWEX would return unhelpful validation errors server-side.

---

## Shipments DB Table

```sql
shipments (
  id, order_id, product_transaction_id, offer_id, product_type,
  bol_number, pro_number, bol_url, carrier, service_level, total_charge,
  status,  -- BOOKED | PICKED_UP | IN_TRANSIT | DELIVERED | CANCELLED | EXCEPTION
  origin_company, origin_city, origin_state, origin_zip,
  dest_company, dest_city, dest_state, dest_zip,
  pickup_date, pickup_confirmation, notes,
  created_at, updated_at
)
```

---

## Known Pending Issues (Shipping)

### 1. Carrier-Specific Rules / Review Page (NOT YET IMPLEMENTED)

**Status: Outstanding — screenshot was shared in a prior session but lost to session compaction.**

When the user selects RL Carriers (R+L Carriers) in the SpeedShip portal, a popup/overlay appears showing carrier-specific rules, requirements, or acknowledgments that the user must accept before booking proceeds. Other carriers may have similar carrier-specific terms.

**What needs to be built:**
- `buildConfirmStep()` in `create.ejs` currently shows a generic confirm page for ALL carriers
- It needs a carrier-aware section that shows carrier-specific notes/warnings/acknowledgments
- The user must re-share the RL carrier screenshot so the exact requirements can be implemented

**When the user re-shares the screenshot, implement:**
- A `CARRIER_NOTES` map keyed by carrier name/SCAC with required acknowledgment text
- An acknowledgment checkbox or modal in Step 3 when the selected carrier is in the map
- Block the "Confirm & Book" button until the user checks the acknowledgment

**Do not implement this without seeing the actual screenshot — do not guess what RL requires.**

### 2. WWEX `offerList` Key Variations

The `rawOffers` extraction tries multiple keys:
```javascript
resp.offerList || resp.rateList || resp.quoteList || resp.offers || []
```
If WWEX returns offers under a different key, rates will show as empty. The diagnostic logs (`shopFlow resp keys:`) will reveal this. If blank rates appear, check the server log first.

### 3. BOL URL Field Names Unknown

`quoteOrderFlow` response field names for BOL URL are guessed:
```javascript
resp.bolUrl || resp.bolDocumentUrl
```
Once a real booking succeeds, check `[wwex] quoteOrderFlow raw response:` in the server log to confirm the actual field name.

### 4. Stub Mode

When `WWEX_CLIENT_ID` / `WWEX_CLIENT_SECRET` are absent from `.env`, all flows return realistic stub data. Stub mode is detected via `HAS_CREDS` flag in `wwexService.js`. This allows UI development without live credentials.

---

## Bugs Fixed (History)

| Date | Commit | Bug | Fix |
|------|--------|-----|-----|
| 2026-08-31 | `8010806` | `productTransactionId` was `undefined` → every booking failed with "shipmentOfferId Expired or Not Valid" | Read `resp.productTransactionId` (root) not `rawOffers[0]?.productTransactionId` |
| 2026-08-31 | `8010806` | LTL pickup date/time ignored — always sent today's date | `bookShipment()` now reads `#ltlPickupDate` etc. (LTL Step 3 fields) not `#pickupDate` (SMALLPACK static fields) |
| 2026-08-31 | `8010806` | Stale offerId on re-rate → "Expired" error | `_selected = null` on every new rate response |
| Earlier | Prior commits | `locationType` hardcoded to `null` | Controller passes `destination.locationType` |
| Earlier | Prior commits | Residential checkbox didn't set freight flags | `onResidentialChange()` auto-syncs accessorials + locationType |
| Earlier | Prior commits | Step 1 had no validation → opaque WWEX errors | `validateStep1()` added |

---

---

## ⚠️ CORRECTIONS LOGGED 2026-08-31 — earlier entries in this brief were WRONG

The Postman collection is in the repo at
`/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/SpeedshipAPI V4 Staging.postman_collection.json`
(also `SpeedshipAPI Folder/` and a ` 2.json` duplicate). **Read it directly. Do not work from memory.**

Extract a request body with:
```bash
python3 -c "
import json; d=json.load(open('SpeedshipAPI V4 Staging.postman_collection.json'))
def f(i,p=''):
    for x in i:
        q=p+'/'+x.get('name','')
        if 'item' in x: yield from f(x['item'],q)
        else: yield q,x
for p,it in f(d['item']):
    if p=='/LTL/DOMESTIC/shopFlow': print(it['request']['body']['raw'])
"
```

Five things this brief previously stated that are **false**:

1. **`locationType` enum was wrong.** It is NOT `BUSINESS` / `BUSINESS_WITH_DOCK` / `BUSINESS_WITHOUT_DOCK` / `CONSTRUCTION_SITE`. The actual accepted values are:
   `COMMERCIAL, AIRPORT, CONTAINER_FREIGHT_STATION, CONSTRUCTION, DISTRIBUTION_CENTER, PIER_PORT_WARF, LIMITED_ACCESS, GOVERNMENT_FACILITY, SECURED_LOCATION, RESIDENTIAL, TRADESHOW`
   (`PIER_PORT_WARF` is spelled that way in the docs — sic.) Every value in BVO's current dropdown except `RESIDENTIAL` is invalid.

2. **There is no `residentialDeliveryFlag`.** The API has `residentialPickupFlag` only. Residential *delivery* is expressed as `destinationAddress.locationType: "RESIDENTIAL"`. Do not add a delivery flag — it does not exist.

3. **`quoteOrderFlow.shipment` is MINIMAL, not a full echo of the shopFlow shipment.** It contains only `originAddress`, `destinationAddress`, `shipmentReferenceList`, `pickupSpecialInstructions`, `deliverySpecialInstructions`, `handlingSpecialInstructions`. It does **not** contain `handlingUnitList`, freight flags, weights, or `shipmentDate`. BVO currently echoes the entire shopFlow shipment (`_shopShipment`) into the booking — sending far more than the API expects.

4. **`shipmentOfferedProductId` does not appear in the quoteOrderFlow sample at all.** Only `shipmentProductTransactionId` and `shipmentOfferId` are documented. BVO sends `shipmentOfferedProductId`. Treat it as unverified, not confirmed.

5. **`packagingType` has no `OTH` value.** Valid: `BAG, BALE, BOX, BUNDLE, CARTON, CASE, CRATE, CYLINDER, DRUM, PAIL, PLT, PIECES, REEL, ROLL, SKID, TANK, TOTE, TRAILER, TUBE`. BVO's `OTH` option is invalid.

### Newly confirmed fields BVO does not currently use

| Field | Location | Notes |
|---|---|---|
| `insuranceRequestFlag` | shipment | boolean |
| `insuredCommodityCategory` | shipment | Required when insuring. `400` General Merchandise, `406` Furniture & Large Items, `407` Stonework, `408` Fragile — likely candidates for vanities/tops |
| `insuredItemConditions` | shipment | Required when insuring. `NEW` or `USED` |
| `totalDeclaredValue` | shipment | `{ unit: 'USD', value: '1500' }` — value is a **string** |
| `insuredMarksNumbers` | shipment | string |
| `handlingCharge` | shipment | `{ value: '10', unit: 'PERCENT' }` — unit is `AMOUNT` or `PERCENT` |
| `marksNumbers` | shipment | string |
| `carrierTerminalPickupFlag` | shipment | boolean |
| `isMixedClass` | handlingUnit | BVO hardcodes `false` |
| `commodityType` | shippedItem | **This is the Piece Type field.** Same 19 values as `packagingType` but uses `PIECES`→`PIECE` in the UI |
| `dimensions` | shippedItem | per-commodity L/W/H, same shape as `billedDimension` |
| `hazMatItemInfo` | shippedItem | null when not hazmat; see `/LTL/DOMESTIC/shopFlow (Hazmat)` for shape |
| `returnSelectedServiceOnly` + `preferredVendorList` | request root | Carrier filtering by SCAC — return only chosen carriers |
| `customerBolNum` | quoteOrderFlow root | Supply our own BOL# |
| `notificationGroups` | quoteOrderFlow root | Email alerts: booked / in_transit / out_for_delivery / delivered / exception / pickup_scheduled / voided |
| `pickupSpecialInstructions` | quoteOrderFlow shipment | max 60 chars |
| `deliverySpecialInstructions` | quoteOrderFlow shipment | max 60 chars |
| `handlingSpecialInstructions` | quoteOrderFlow shipment | max 82 chars |
| `contactList[].email` / `.extension` | quoteOrderFlow addresses | Supported here (not shown in shopFlow sample) |
| `address.phone` | quoteOrderFlow addresses | Required, separate from `contactList[].phone` |

### Documented constraints

- `addressLineList` — up to **3** lines (BVO sends 1)
- `shipmentReferenceList` — up to **5** references (BVO has 2); `type` and `value` each max 35 chars, no required codes
- `postalCode` — 5-digit only
- `phone` — max 15 chars
- `firstName` + `lastName` — combined max 35 chars
- `NMFCNbr` — max 10 chars
- `commodityClass` — **Required**. Valid: 50, 55, 60, 65, 70, 77.5, 85, 92.5, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500
- `commodityDescription` — **Required** ("carriers require it for reliable scheduling")
- `shippedItemList[].weight` — **Required**, per commodity
- `tradeshowDeliveryName` / `tradeshowPickupName` — required when the matching flag is true; format `"Booth Name; Booth #"`
- `mode: 'SAVE'` — per the docs, only needed when using `notificationGroups`

---

## Postman Collection Findings (Official WWEX SpeedShip V4 Docs)

> ⚠️ The payload sketches below predate the 2026-08-31 corrections above. Where they disagree, **the corrections section wins.** Verify against the collection file itself.

### shopFlow — LTL Shipment Payload (confirmed field names)

```javascript
{
  productType: 'LTL',
  shipment: {
    shipmentDate: 'YYYY-MM-DD HH:MM:SS',

    // Freight flags (boolean) — all confirmed from Postman
    appointmentDeliveryFlag:      false,
    holdAtTerminalFlag:           false,
    insideDeliveryFlag:           false,
    insidePickupFlag:             false,
    liftgateDeliveryFlag:         false,
    liftgatePickupFlag:           false,
    residentialPickupFlag:        false,
    constructionSiteDeliveryFlag: false,
    constructionSitePickupFlag:   false,
    notifyBeforeDeliveryFlag:     false,
    protectionFromColdFlag:       false,
    sortAndSegregateFlag:         false,
    tradeshowDeliveryFlag:        false,
    tradeshowDeliveryName:        '',
    tradeshowPickupFlag:          false,
    tradeshowPickupName:          '',

    // Totals
    totalHandlingUnitCount: N,
    totalWeight: { value: N, unit: 'LB' },   // NOTE: 'LB' not 'LBS' for LTL

    // Addresses
    originAddress: {
      address: {
        addressLineList: ['123 Main St'],   // array, not a string
        locality:    'Atlanta',             // city
        region:      'GA',                  // state code
        postalCode:  '30301',
        countryCode: 'US',
        companyName: 'Company Name',
        contactList: [{
          firstName:   '',
          lastName:    'Contact Name',
          phone:       '4045551234',
          contactType: 'SENDER',
        }],
      },
      locationType: null,                   // null = unspecified
    },
    destinationAddress: {
      address: { /* same shape, contactType: 'RECEIVER' */ },
      locationType: null,   // ⚠️ SEE ENUM BELOW — earlier BUSINESS_WITH_DOCK values were WRONG
    },

    handlingUnitList: [{
      packagingType: 'PLT',                 // PLT, BOX, BAG, DRM, RLL, SKD, OTH
      quantity:      1,
      isStackable:   false,
      isMixedClass:  false,
      weight: { value: 500, unit: 'LB' },
      billedDimension: {                    // optional — only when dims are provided
        length: { value: '48', unit: 'in' },
        width:  { value: '40', unit: 'in' },
        height: { value: '48', unit: 'in' },
        dimensionType: 'NET',
      },
      shippedItemList: [{
        commodityClass:       '70',
        commodityDescription: 'Bathroom Vanity',
        NMFCNbr:              '12345',      // null if none; use only the base number (strip suffix after '-')
        quantity:             '1',          // STRING, not number
        isHazMat:             false,
        weight: { value: 500, unit: 'LB' },
      }],
    }],
  }
}
```

**Critical unit notes:**
- LTL weight unit is `'LB'` (not `'LBS'` which SMALLPACK uses)
- Dimensions unit is `'in'` (lowercase)
- `NMFCNbr` takes only the base number — strip the `-XX` suffix (e.g. `'87680-01'` → `'87680'`)
- `quantity` in `shippedItemList` is a **string**, not a number

### quoteOrderFlow — Booking Payload (confirmed field names from Postman)

```javascript
{
  request: {
    mode:                         'SAVE',   // confirmed — always 'SAVE' to actually book
    shipmentProductTransactionId: '<txnId>',
    shipmentOfferId:              '<offerId>',
    shipmentOfferedProductId:     '<offeredProductId>',  // omit if null
    isSelfScheduled:              false,
    pickupDate:                   'YYYY-MM-DD 00:00:00',
    readyTime:                    'HH:MM:SS',  // NOTE: 'readyTime' not 'pickupReadyTime'
    closeTime:                    'HH:MM:SS',  // NOTE: 'closeTime' not 'pickupCloseTime'
    shipment:                     { /* full shipment echo from shopFlow */ },
  }
}
```

**Important:** `readyTime` / `closeTime` are the field names in the WWEX payload. Our controller uses `pickupReadyTime` / `pickupCloseTime` as the internal names for these values in the DB and frontend, but renames them to `readyTime`/`closeTime` in the actual API payload.

### shopFlow — Response Structure (confirmed from Postman; root-level fields)

```
resp.productTransactionId     ← the session/transaction ID (ROOT LEVEL — confirmed)
resp.offerList[]              ← array of carrier offers (primary key to try)
  offer.offerId               ← carrier-level ID → maps to shipmentOfferId
  offer.offeredProductList[]  ← service variants per carrier
    product.offeredProductId  ← product-level ID → maps to shipmentOfferedProductId
    product.shopRQShipment.timeInTransit.serviceLevel   ← 'standard' | 'guaranteed'
    product.shopRQShipment.timeInTransit.transitDays
    product.shopRQShipment.timeInTransit.estimatedDeliveryDate
    product.offerPrice        ← { value: N, unit: 'USD' }
  offer.primaryVendor.preferredName   ← carrier display name
  offer.primaryVendor.scac            ← carrier SCAC code
  offer.totalOfferPrice               ← fallback price if no per-product price
```

**Note on response key fallbacks in wwexService.js:**
```javascript
const rawOffers = resp.offerList || resp.rateList || resp.quoteList || resp.offers || [];
```
`offerList` is the Postman-confirmed key. The others are defensive fallbacks in case WWEX changes the structure. If rates return empty, check the `[wwex] shopFlow resp keys:` server log line first.

---

## SpeedShip Portal — What Was Learned (and What Was NOT)

**Portal URL:** `https://speedship.wwex.com/ship/freight/ltl`

**Technology:** Angular 15+ with Angular Material (`mat-select`, `mat-option`). Root element: `<wwex-ui-root>`.

**Auth:** Auth0 SPA SDK — tokens stored in memory (not localStorage/sessionStorage/IndexedDB). Cannot be extracted from the browser.

### What We Successfully Did in the Portal

- Navigated to the LTL form
- Observed the 3-step form structure (matches our create.ejs design)
- Identified that Angular Material `mat-select` is used for Class, HU Type, and State fields
- Installed a `window.fetch` interceptor to capture API traffic

### Why We Could NOT Capture Live Network Traffic

Angular Material `mat-select` components completely resist programmatic interaction:
- `form_input` tool refuses: "MAT-SELECT not supported"
- `.click()` on the element visually opens the dropdown but does NOT update the Angular reactive form model — `mat-select.value` stays `null`
- Dispatching native `change`/`input` events also does not trigger Angular's form binding
- Without Class + State fields set, the form stays invalid → "GET QUOTE" button stays disabled
- The fetch interceptor was installed and confirmed ready, but zero API calls were captured because the form never submitted

**Consequence:** We never got a real quoteOrderFlow network capture from the portal. All our quoteOrderFlow field knowledge comes from the Postman collection, not from live traffic observation.

### The RL Carrier Popup — What We Know

The user shared a screenshot of the SpeedShip portal showing a popup/modal that appears when **RL Carriers (R+L Carriers)** is selected as the booking carrier. This popup contains carrier-specific rules, terms, or acknowledgments.

**That screenshot was shared in a prior session and was lost to session compaction.**

We do NOT know:
- The exact text of the popup
- Whether it's a modal or an inline notice
- Whether the user must check a box, click a button, or simply dismiss it
- Whether other carriers (e.g. Estes, XPO, SEFL) have similar popups
- Whether WWEX returns these notices in the shopFlow/quoteOrderFlow response or whether SpeedShip generates them client-side

**The WWEX API MAY return carrier-specific notes** — possible fields to check once a real booking goes through:
- Look for `carrierNotes`, `vendorNotes`, `terms`, `acknowledgements`, or similar fields in the raw `[wwex] quoteOrderFlow raw response:` server log
- Also check per-offer fields in the shopFlow response for any notice/terms fields

---

## Confirmed vs Guessed/Unverified Fields

| Field | Source | Status |
|-------|--------|--------|
| `productTransactionId` at response root | Code analysis + Postman | ✅ Confirmed |
| `offerList` as offers array key | Postman | ✅ Confirmed |
| `offerId` per offer | Postman | ✅ Confirmed |
| `offeredProductId` per product | Postman | ✅ Confirmed |
| `primaryVendor.preferredName` for carrier name | Postman | ✅ Confirmed |
| `shopRQShipment.timeInTransit.serviceLevel` | Postman | ✅ Confirmed |
| `mode: 'SAVE'` in quoteOrderFlow | Postman | ✅ Confirmed |
| `readyTime` / `closeTime` (not pickupReadyTime) | Postman | ✅ Confirmed |
| `shipmentProductTransactionId` field name | Postman | ✅ Confirmed |
| `shipmentOfferId` field name | Postman | ✅ Confirmed |
| `shipmentOfferedProductId` field name | ~~Postman~~ | ❌ **NOT in the collection** — corrected 2026-08-31. BVO sends it anyway. Unverified. |
| `locationType` enum values | ~~Postman~~ | ❌ **Was recorded wrong** — see corrections section. Real enum: COMMERCIAL / AIRPORT / CONTAINER_FREIGHT_STATION / CONSTRUCTION / DISTRIBUTION_CENTER / PIER_PORT_WARF / LIMITED_ACCESS / GOVERNMENT_FACILITY / SECURED_LOCATION / RESIDENTIAL / TRADESHOW |
| `residentialDeliveryFlag` | — | ❌ **Does not exist.** Use `destinationAddress.locationType: 'RESIDENTIAL'` |
| `quoteOrderFlow.shipment` = full shopFlow echo | ~~inferred~~ | ❌ **Wrong** — it is addresses + references + instructions only |
| `isSelfScheduled: false` | Postman | ✅ Confirmed |
| `addressLineList` (array, not string) | Postman | ✅ Confirmed |
| `locality` / `region` / `postalCode` / `countryCode` | Postman | ✅ Confirmed |
| `packagingType` for HU type | Postman | ✅ Confirmed |
| `commodityClass` for freight class | Postman | ✅ Confirmed |
| `NMFCNbr` (base number only, no suffix) | Postman | ✅ Confirmed |
| `bolNumber` in quoteOrderFlow response | Postman / guessed | ⚠️ Partially confirmed — also try `bol`, `billOfLadingNumber` |
| `proNumber` in quoteOrderFlow response | Postman / guessed | ⚠️ Partially confirmed — also try `pro`, `proNbr` |
| `bolUrl` / `bolDocumentUrl` | Guessed | ❌ Not confirmed — check `_raw` field in first successful booking |
| Carrier-specific terms/notes fields | Unknown | ❌ Never captured — need RL screenshot + live booking |

---

## How to Test After a Push

1. SSH into Hostinger (or wait for auto-deploy), `pm2 restart all`
2. Go to `/admin/shipping/create`
3. Fill origin (e.g. your warehouse address, GA), destination (a real US address), add 1 pallet at 500 lbs, Class 70
4. Click "Get Rates"
5. Check server log for `[wwex] shopFlow using productTransactionId:` — must be non-null
6. Select a carrier from the rate list
7. On Step 3, set a pickup date and click "Confirm & Book"
8. Check server log for `[wwex] quoteOrderFlow raw response:` — should contain a BOL number
9. Confirm BOL appears on screen

If it fails, the server log line `[wwex] quoteOrderFlow error:` has the WWEX error body. That error body is the ground truth — do not guess at the fix without reading it.
