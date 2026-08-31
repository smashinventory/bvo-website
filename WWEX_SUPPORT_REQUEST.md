# WWEX SpeedShip V4 API — Integration Questions

**From:** Bathroom Vanities Outlet (customer number W0002746112)
**Re:** SpeedShip V4 REST API — building a direct integration into our order system
**Reference collection:** `SpeedshipAPI V4 Staging.postman_collection.json`

---

We have a working LTL integration against the V4 API — `shopFlow` and
`quoteOrderFlow` are both returning successfully and we are generating BOLs.
Five things are not covered by the Postman collection, and rather than guess
at them we would rather ask.

Where a question refers to a real transaction, here is one we booked and then
voided in **staging** on 2026-08-31:

```
BOL                  ATE34769194
PRO                  139796118
quoteNumber          Q14293357
productTransactionId a175747d-d064-4053-acf5-8f09d6049255
pickupTxnId          26c3f457-06a7-47b1-8c64-e786145d2dee
carrier              SEFL
```

---

## 1. `setAlertFlow` — not in the Postman collection

On the SpeedShip web UI's review page there is an **Additional Services**
panel with three checkboxes, all enabled by default:

- Shipment Alerts
- Email BOL
- Pallet Label

When a shipment is booked with these enabled, the browser issues a
`POST https://www.speedship.com/svc/setAlertFlow` which returns 200. That
endpoint does not appear anywhere in the Postman collection.

**Please provide:**

- The full request schema for `setAlertFlow` — required and optional fields,
  and a working sample body
- When it should be called relative to `quoteOrderFlow` (before, after, or
  either)
- Which identifier it keys on — `productTransactionId`, `pickupTxnId`,
  BOL number, or something else
- Whether it is the supported way to configure alerts for API customers, or
  an internal endpoint we should not be calling

## 2. `notificationGroups` vs `setAlertFlow`

The `quoteOrderFlow` sample in the collection contains a `notificationGroups`
array with `shipmentNotificationPreference.emailList` and `alertTypeList`,
and a comment that `mode: "SAVE"` exists specifically to enable email
notifications.

**Please confirm:**

- Is `notificationGroups` on `quoteOrderFlow` still supported and functionally
  equivalent to what the web UI's "Shipment Alerts" checkbox does via
  `setAlertFlow`?
- If both work, which is preferred for a direct API integration?
- The sample uses `notificationGroupId` with a comment saying it is the
  `productTransactionId` from the shopFlow response. Is that correct — the
  same value we send as `shipmentProductTransactionId`?
- Is the alert recipient taken from `emailList` only, or does it also fall
  back to `destinationAddress.contactList[].email`? The web UI has no separate
  email input on that panel, which suggests it uses the receiver address.

## 3. "Email BOL" and "Pallet Label" checkboxes

Neither maps to anything obvious in the collection. `PALLET_LABEL` is a valid
`docType` on `documentDownloadFlow`, so we assume that checkbox controls
document generation rather than delivery.

**Please clarify for each:**

- Does the API expose an equivalent, and if so on which flow and field?
- Does "Email BOL" send the BOL to the receiver, the shipper, or both — and
  is the recipient configurable?
- Is any of this driven by account-level settings rather than per-shipment
  request fields?

## 4. `documentDownloadFlow` — response schema

Our request matches the collection sample exactly:

```json
{ "request": {
    "downloadMode": "SINGLE",
    "docTypes": ["BILL_OF_LADING"],
    "transactionType": "LTL",
    "referenceMap": { "PRODUCT_TRANSACTION_ID": "a175747d-d064-4053-acf5-8f09d6049255" }
}}
```

The call returns without error, but we cannot locate the document in the
response. The collection documents the request only.

**Please provide:** the response schema, and specifically the field carrying
the document. Is it base64 in the body, a pre-signed URL, or an S3 object
name that must be fetched separately? The `quoteOrderFlow` response returns
`s3fileName` values such as
`ATE34769194-a175747d-...-BILL_OF_LADING.pdf` — if those are meant to be
retrieved directly, what is the base URL and how is the request authenticated?

A sample successful response body would resolve this immediately.

## 5. Fields present in the web UI but absent from the API

These appear on the SpeedShip LTL form but we can find no corresponding
request field:

- **Grocery Consolidation Pickup** and **Grocery Consolidation Delivery** —
  both are checkboxes on the form
- **Billing Details** (Bill My Account / Bill Recipient / Bill Third Party) —
  a dropdown on the form

**Please confirm** whether these are configurable per shipment through the
API, or are account-level settings that cannot be varied per request. If
per-shipment, we need the field names and valid values.

---

## Also worth confirming

- **`shipmentOfferedProductId`** — we send this on `quoteOrderFlow` but it
  does not appear in the collection's sample. Is it valid, ignored, or should
  it be omitted?
- **`productTransactionId` scope** — in our `shopFlow` responses every offer
  in `offerList` carries its own `productTransactionId`, and they appear to be
  identical across offers within one rate session. Can we rely on that, or
  must we always use the id belonging to the specific offer being booked?
- **LTL cancellation** — we learned by trial that cancelling an LTL shipment
  requires both the shipment `productTransactionId` **and** the `pickupTxnId`
  in `cancelRQList`; sending only the shipment id returns *"LTL does not
  support shipment only cancel"*. The collection's `/LTL/integratedCancelFlow`
  sample does show two ids, but the requirement is not stated. Worth calling
  out in the docs.
- **`address.phone` on `quoteOrderFlow`** — this is required on both origin
  and destination, and omitting it returns *"Destination Phone is required;
  exception: AppException"*. The `shopFlow` sample does not mark it required,
  which made this easy to miss. Also worth documenting.

---

## What would help most

If there is a **response-schema reference** for the V4 flows — the collection
covers requests thoroughly but documents no responses — that single document
would answer items 1, 3 and 4 outright and save us a good deal of trial and
error against live bookings.

Thank you.
