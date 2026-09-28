# The 45-point scope — master list

> The owner's 45-point scope, verbatim and numbered. THE canonical numbering: an item number quoted anywhere — commit, gate, conversation — means the number in this file. Check status here before starting anything in the payment-risk, address or checkout-stage work.

**This is the canonical numbering. Use it.**

Created 2026-09-27 because it was not created when it should have been.
The owner pasted this list days earlier and asked for it to be recorded;
it was instead folded into the section structure of
`docs/briefs/BVO_PAYMENT_RISK_AND_CHECKOUT_SCOPE.md` and the numbering was
lost. Item numbers were then quoted back at the owner from memory for two
days — **incorrectly**. "Item 16" was used throughout to mean Address
Validation. Item 16 is the API key. Address Validation is not on this list
at all.

If a number is referenced anywhere — a commit message, a gate, a
conversation — it means the number **in this file**. Nowhere else.

The wording below is the owner's, verbatim. Do not rewrite it to match
whatever the code ended up doing; the point of a scope list is that it
says what was asked for, not what was built.

**Status: 23 of 45 done.**

✅ done · ⬜ open · ⛔ **deferred by the owner — do not start**

---

## Payment risk — build

1. ✅ `radar.early_fraud_warning.created` webhook — flag the order, banner
   on order detail, email alert
   *Email alert NOT built — there is no admin alert channel. Owner's call.*
2. ✅ `charge.dispute.created/updated/closed` webhooks — store reason code
   and due date on the order
3. ✅ Capture 3DS outcome — `three_d_secure.result`,
   `authentication_flow`, `electronic_commerce_indicator`
4. ⬜ Capture checklist — block the Capture click on elevated risk, failed
   AVS/CVC, or ship-to ≠ bill-to; require a logged override
   *Blocked: needs the owner's thresholds.*
5. ✅ Ship-to vs bill-to comparison, flagged in admin
6. ⬜ Velocity checks in your own DB — same email/multiple cards, multiple
   orders to one address, repeated failures then a success
   *Blocked: needs the owner's limits.*
7. ⬜ Record 0.4% premium per order for the six-month review
   *Blocked on 13.*
8. ⬜ Show Chargeback Protection coverage status on the order detail page
   *Blocked on 13.*

## Payment risk — operational

9. ⬜ Phone first-time orders over a threshold before capture
   *Blocked: needs the threshold.*
10. ⛔ Order confirmation email stating clearly what was ordered and where
    it's going
    **DEFERRED TO CUTOVER BY THE OWNER, 2026-09-26. Do not start this
    inside another task.** See the red section in
    `docs/reference/PRE_LAUNCH_CHECKLIST.md`. Email-template work is a
    session of its own: the live DB copy is not the disk copy, and the
    voice has to be agreed before nine templates are written, not after.
    This was re-proposed in error on 2026-09-27 as part of a batch; the
    owner had to say no twice.
11. ✅ Documented capture window, with authorisation expiry shown on the
    order
12. ✅ Keep terms-acceptance evidence — timestamp, IP, version of the copy
    agreed to

## Before enabling Chargeback Protection

13. ⬜ Written confirmation from Stripe that coverage persists on
    transactions placed while active
    *Blocked on Stripe. Nothing downstream should be built on a guess.*
14. ⬜ Minimum term and re-enrolment restrictions
    *Blocked on Stripe.*

## Address and delivery data

15. ✅ Google Places Autocomplete on the page 1 delivery address
    *Verified live 2026-09-27. Three separate faults before it worked —
    see VERIFY_QUEUE.md.*
16. ✅ Google API key on your Cloud account, restricted by referrer, with
    a billing alert
    *Plus 21 Places API (New) quotas capped and 3 unrestricted legacy keys
    deleted. See scope §5A.6.*
17. ✅ Store the Place ID and the formatted address alongside the typed
    fields
    ⚠️ **Not fully witnessed.** Selecting a suggestion populates the hidden
    fields — confirmed in the browser. A real selection followed by a
    submit, writing `ship_address_source = 'autocomplete'` to the database,
    has never been observed. Every test row says `typed`.
18. ✅ US Census geocoder — free, no key — to get lat/lng for each
    delivery address
19. ✅ Store lat/lng on the order
    *Now upgraded to Google's rooftop point when Address Validation
    returns one at PREMISE or finer; Census remains the fallback.*
20. ✅ Street View embed on the admin delivery page — Maps Embed API,
    free, unlimited
    ⚠️ **Deployed but never looked at.** Order 58 is the only order with
    coordinates. Gates cover the markup and CSP; nobody has seen it render.
21. ✅ Fallback copy when Street View imagery doesn't exist for an address
    ⚠️ **Partial.** The caveat copy shipped. The Street View Metadata API
    check — free and unlimited — that would let the panel hide the tab
    entirely rather than explain an empty box, is NOT built. Scope §5.7.

## Checkout — stage 2

22. ✅ Sign in / register / guest on page 1  *(`e613af5`)*
    **Built as `/checkout/identify`, a step BEFORE page 1** — not on page 1
    itself. `requireIdentity` guards the whole checkout router.
    ⛔ `/return`, `/success`, `/cancel` are registered ABOVE the guard:
    Stripe returns there AFTER the card is charged.
    ⚠️ **AMENDED 2026-09-27: NO GUEST.** Account required, Wayfair-style.
    See `docs/briefs/BVO_CHECKOUT_SPEC.md` §7.1. The owner's list wording
    is left as he wrote it; the decision supersedes it.
23. ✅ Passwordless login — six-digit email code, no passwords stored
    *(`83e81b4` `e613af5`)* `password_hash` DROPPED from `customers`
    2026-09-27. bcryptjs stays in package.json — adminController still
    uses it for the ADMIN login, a separate system.
    ⚠️ **This REPLACES a password system that already exists** —
    `/account/login`, bcrypt hashes, and no reset route at all. Spec §7.2.
24. ✅ Code limits — 10-minute expiry, 5 attempts, 60-second resend,
    3 resends, 5 codes per email per hour, 10 per IP
25. ✅ Identical response whether or not an email has an account
    Not by matching response bodies — `issueCode` sends a code either
    way and the account is created on VERIFICATION, so the endpoint has
    no 'does this exist' answer to leak.
26. ⬜ "Remember this device" cookie, 90 days
    **NEXT UP.** Pairs with the new-device email captured in spec §8.2
    (the Wayfair 'Review Device Sign-In' structure, incl. the
    anti-phishing box).

## Checkout — stage 3

27. ⬜ Saved addresses, one default per customer
    ⚠️ **AMENDED 2026-09-28.** `customer_addresses` **ALREADY EXISTS** in
    `001_initial_schema.sql` — empty, and no code touches it. **ALTER it,
    do NOT CREATE it.** This is the `email_templates` near-miss repeating;
    grep the initial schema before any CREATE TABLE.
    ⛔ NOT `Billing/Shipping Address 1/2/3` columns — considered and
    rejected (~84 columns, rotation logic destroys the history, and the
    fraud query becomes a six-way pairwise compare).
    Rows keyed on the Google `place_id`: three spellings of one street
    are ONE place_id, and string dedup would false-flag honest customers.
    Full reasoning: `BVO_PAYMENT_RISK_AND_CHECKOUT_SCOPE.md` §7 Stage 3.
28. ⬜ Prefill page 1 for returning buyers
    Prefill **VISIBLY** — "Shipping to your last address, change it
    below". Silent prefill sends a trade buyer's vanity to last month's
    jobsite.
29. ⛔ "Set as default delivery address" checkbox
    **DROPPED 2026-09-28.** Meaningless with one address. `is_default`
    already exists in the table, so this reverses for free.

## Outstanding from earlier

30. ✅ Link on or off — dashboard toggle
31. ✅ `billing_address_collection` — `'auto'`  *(superseded by 41)*
32. ⬜ Tax sourced from the delivery address rather than billing
    *Spec says this must be tested against a live session first.*
33. ⬜ Policy language — right to decline an order, right to pass a
    shipping upcharge before consummation
    *Site policy copy, NOT an email template — not covered by the cutover
    deferral. Still owner-voice copy and still needs his decisions on what
    the policy actually is.*
34. ⬜ Strip the `?debug=1` panel and SDK enumeration
    *The only remaining item doable unsupervised. MUST wait until after
    the owner's full review: the debug panel is what diagnosed the
    checkout outage, and removing it before the review removes the tool
    that would diagnose the next one.*
35. ✅ Success page copy — was inaccurate under authorise-then-capture
36. ⛔ `order_confirmed` email rewrite — authorised, not charged
    **DEFERRED TO CUTOVER BY THE OWNER, 2026-09-26.** Same session as 10.
    Do not start it inside another task.
37. ✅ WWEX booking payload — send the phone and residential flag

## Deferred

38. ✅ Radar Plus — decision reversed and taken, enabled during live
    activation
39. ⬜ Chargeback Protection exit at matured data + cash reserve, not a
    calendar date
40. ⬜ Rewards / trade programme

## Checkout — reduce duplicate data entry

41. ✅ `billing_address_collection` → `'auto'`
42. ✅ Link off
43. ✅ `contacts` on the Billing Address Element
44. ✅ Audit every field on pages 1–3 against "asked once"
    *Page 3 has zero input fields of its own.*
45. ✅ Read-only recaps carry the data forward; no field is editable on
    two pages

---

## Built but NOT on this list

Recorded separately so the 45 stays the owner's list rather than drifting
into a log of everything that happened.

- **Address Validation**, server-side with its own key, warn-never-block,
  one call per distinct address. Verified live. This is what was being
  called "item 16" in conversation and in several commit messages — it is
  not item 16, and it is not on the list.
- **Rooftop geocode upgrade** — Google's PREMISE-or-finer point replacing
  the Census street interpolation. Improves 19.
- **Stale checkout banner fix** — an error message survived for up to
  seven days and greeted returning buyers with a failure notice about an
  order they had already completed.
- **Address field hint copy** — the field read as broken below four
  characters.
- **Quota caps on two Google APIs** — 21 on Places (New), 8 on Address
  Validation. Both arrived at their defaults of unlimited or 150,000+.
- **The checkout outage fix** — Place Order did nothing; the three-page
  rewrite had dropped the Contact Details Element and `updatePhoneNumber`,
  so `canConfirm` was permanently false.
- **The shipping form's delivery email** — same NULL-on-guest-orders
  defect as the phone field, one line below it.

---

## What blocks cutover, regardless of this list

*Revised 2026-09-28. Email templates were item 1 and are no longer on this
list — owner: "These are good enough for now… We can tweak after cutover."
They send, they carry the right variables, and they say true things; what
they lack is brand voice. Moved to POST-CUTOVER in OPEN_ITEMS.md.*

1. **Stripe live-key swap** — three env vars, plus deleting the two inert
   `_LIVE` variables. Unblocked since the account reached Verified.
2. **Webhook endpoint** — still pointed at the temporary host.
3. **Re-test the confirm-email link after DNS moves.** `SITE_URL` builds
   `/orders/confirm?t=…` in order emails, so it 404s until the domain
   points at this app — confirmed live on BVO-2026-09-28-00110. Nothing
   on our side reports it: the email sends, the token is valid, and the
   failure happens only in the customer's browser. Steps are in
   PRE_LAUNCH_CHECKLIST.md.
