# BVO full-site QA checklist — everything short of checkout

Written 2026-10-24. Scope: every customer-facing and admin function except
completing a payment. Checkout **page behaviour** is in scope; pressing Pay
is not.

This is not a generic "test your website" list. Every item below is either
a thing this codebase has broken before, or a thing whose failure is
**silent** — no error page, no log line, just a quietly wrong outcome. The
generic items (does the page load, is there a 404) are at the end because
they are the least likely to be wrong and the easiest to spot.

---

## 0. What I need from you before a run

**Identity for test records** — supplied: Test Test ·
sam.elnazer@gmail.com · 404.655.5079.

| Need | Why | Notes |
| --- | --- | --- |
| A junk image for the trade business card | The trade application will not submit without one | Any JPG/PNG. A photo of anything. It gets stored outside `public/`. |
| A second junk image, named like a tax certificate | Tests the second upload slot and the inline viewer | PDF ideally, to exercise the inline-vs-download branch |
| A real deliverable email you can check | Several flows only prove out by an email arriving | sam.elnazer@ is fine if it is real and not blocked |
| A real US street address you are happy to use | Freight quoting and the three delivery types need a geocodable address | Does not have to be yours. Commercial vs residential changes liftgate. |
| Confirmation I may create and delete test records | Trade applications, accounts, carts, draft orders | I will not touch any record that is not mine |
| Whether I may run the admin myself | Admin login is username + password | **I will not type credentials.** Either you sign in and I drive the signed-in session, or you drive and I tell you what to click. |
| Brevo dashboard access, or you watching it | To confirm a send actually left, not just that we called the API | Sends can "succeed" and never arrive |
| Google Search Console access, or you reading it | Sitemap and indexing items cannot be verified from outside | Optional — those items can be skipped |

**Flag every account and order created during a run with `is_test = 1`**
(the column exists, from #311) or the customer analytics get polluted.

**One standing hazard:** the two existing test customers were hard-bounced
at Brevo and only unblocked on 2026-10-24. If email stops arriving mid-run,
check `customers.email_blocked` before assuming the code is broken.

---

## A. Accounts and sign-in

The auth system is passwordless — six-digit codes, 20-minute TTL, plus a
90-day "remember this device" grant. It has had two real defects, both
silent.

- [ ] Request a code for a **new** email → code arrives, page says where it went
- [ ] Code is **6 digits** and expires after 20 minutes (try a stale one)
- [ ] Wrong code → clear error, does **not** sign you in, does not consume the real code
- [ ] Correct code → signed in, lands somewhere sensible
- [ ] Signing in with a code marks the email **verified** (check the admin customer record)
- [ ] Request a second code before the first expires → the newer one works
- [ ] Rate limiting: request codes repeatedly → throttled, with a human-readable message, not a 500

### Remember this device (90 days)

- [ ] The "keep me signed in" box is **unticked by default** on both the login page and checkout-identify
- [ ] Tick it, sign in, close the tab, come back → recognised, **no code requested**
- [ ] ⚠️ **Log out, then enter the same email again → you must be asked for a code.** This is the bug reported and fixed on 2026-10-23 (`5644c6a`). Before the fix, logout destroyed the session but left the device grant live, so the next person on a shared machine typed the address and was in.
- [ ] Log out on one browser → a *different* browser you had remembered stays signed in (logout is this-device-only, by design)
- [ ] "Secure my account" → signs out **everywhere**, kills outstanding codes
- [ ] The new-device email arrives, names the device coarsely ("Mac (Web)"), shows Eastern time, and contains **no IP address or city**

### The silent one

- [ ] Sign in on a device that is already remembered → the page must **not** show a code box. The server answers `skipped:true` and the page is supposed to redirect. If you see "enter your code" while already signed in, `login.ejs` has stopped honouring that flag.

---

## B. Trade programme

Owner-facing money. Several pieces are new as of 2026-10-23/24.

### Application

- [ ] `/trade/apply` loads logged-out and does not leak trade pricing anywhere on it
- [ ] Submit with **no business card** → refused, with a reason
- [ ] Submit without scrolling the terms → the acknowledgement box stays disabled
- [ ] Scroll the terms to the end → box enables
- [ ] ⚠️ **Clause 8 is inside the scrollable box**, and the acknowledgement label names email explicitly. If either is missing, `accepts_marketing` is being derived from a tick the applicant never knowingly gave.
- [ ] Submit a complete application → success page, no 500
- [ ] The applicant gets an acknowledgement email
- [ ] `support@` (or `TRADE_NOTIFY_EMAIL`) gets a notification
- [ ] ⚠️ The uploaded documents are **not attached** to either email
- [ ] The application appears in `/admin/trade`
- [ ] The customer account was **created by the application** — they did not have to sign up first (this was a design failure fixed earlier; applying is the signup)
- [ ] `accepts_marketing`, `marketing_consent_at`, `_source`, `_ip` and `terms_version` are all recorded on the customer row
- [ ] `terms_version` reads `trade-terms-2026-10-23`

### Duplicate guard

- [ ] Submit again with the same email while **pending** → refused, and the form is hidden
- [ ] ⚠️ A refused duplicate must **discard the uploaded files**. Check the storage directory did not gain a second copy. Orphaned tax certificates are the risk.
- [ ] A **declined** applicant may apply again
- [ ] A **fraud**-flagged applicant may not
- [ ] A **closed** account may

### Documents

- [ ] Admin can **view** a document inline in the browser — no forced download
- [ ] PDF and images render inline; **HEIC falls back to download** rather than a blank tab
- [ ] ⚠️ An SVG is **never** served inline (XSS vector)
- [ ] Response carries `nosniff`, a CSP sandbox and `private, no-store` on **both** the view and download paths
- [ ] ⚠️ The document URL is **not** publicly reachable logged-out. Business licences can carry SSNs. Copy the URL into a private window — it must refuse.
- [ ] Documents can be **added** to an existing trade account
- [ ] **Fraud** keeps the documents as evidence; **closed** purges them. Verify on disk, not just in the UI.

### Tiers and MAP

- [ ] Approve the application → tier becomes Platinum Trade (15%)
- [ ] ⚠️ **Logged out, trade pricing never renders.** Check a product page, a collection page, the bundle builder and the cart drawer in a private window. MAP compliance — this is a manufacturer-agreement problem, not a cosmetic one.
- [ ] Logged in as trade → 15% shows on product, collection, bundle builder and cart, and the numbers agree across all four
- [ ] The spend meter shows a figure and the Elite threshold ($20,000 rolling 12 months)
- [ ] ⚠️ The meter's rendered bar width equals the computed percentage — it must not be re-derived in the template
- [ ] Trade customer can sign in from the **main site menu**, not only from the trade banner

---

## C. Email and deliverability

Brevo. The failure mode here is always silence.

- [ ] ⚠️ **Brevo attaches `List-Unsubscribe` to every message and it cannot be disabled on this plan.** Unsubscribing from a promo therefore kills order confirmations and sign-in codes too. Verify the admin shows this: `/admin/orders/:id` must show the "we cannot email this customer" banner when `email_blocked = 1`.
- [ ] Orders list shows a **"cannot email"** badge that *replaces* the green verified tick, not sits beside it
- [ ] `/admin/diagnostics/email` lists blocked contacts and can unblock one
- [ ] ⚠️ Unblocking restores **delivery** but must **not** restore `accepts_marketing`
- [ ] Every template in `/admin/email-templates` renders with variables substituted — no raw `{{tokens}}` in the output
- [ ] Each template has a plain-text fallback
- [ ] Send a test of each live template to the test address and **read them on a phone**
- [ ] The daily consent reconcile ran: check `jmv_sync/logs/brevo-consent.log` for a same-day entry and `exit=0`

---

## D. Catalogue, collections and filtering

The largest surface and the one with the most silent-wrong-answer risk.

- [ ] Every top-level collection loads and returns products
- [ ] Sidebar filters: size, finish, style, sink count, product type — each narrows correctly and the **count matches the grid**
- [ ] Combining two filters narrows further rather than resetting
- [ ] Clearing a filter restores the previous set
- [ ] ⚠️ Size chips show **S/D** correctly for single vs double
- [ ] ⚠️ Countertop thickness displays in **cm, not inches** (this was wrong once)
- [ ] ⚠️ Backsplashes do **not** appear as vanity tops
- [ ] Stone material swatches render on tops collections
- [ ] Pagination works, and page 2 is not page 1 again
- [ ] Sorting (price, name) actually reorders
- [ ] A collection with zero matches shows an empty state, not a broken grid
- [ ] Clean filter paths resolve — e.g. `/collections/bathroom-vanities/finish/white`
- [ ] ⚠️ **Filter landing pages**: a filter with ≥10 products self-canonicals and has intro copy; one below 10 canonicals to the parent. Check both sides of the threshold.
- [ ] Product cards: MSRP strikethrough, sale price, and "Save $X" all agree arithmetically
- [ ] ⚠️ The callout badge ("HOT SELLER") is **outside** the image anchor
- [ ] Product page: variant selector switches finish and size and lands on the right SKU
- [ ] "Complete the Look" shows same-model mirrors
- [ ] Product video renders where one exists, with VideoObject JSON-LD
- [ ] Stock/quantity reflects `inventory.qty_on_hand`
- [ ] ⚠️ Compare a handful of prices and quantities against RFLPOS/the feed. **An unselected column reads `undefined`, which becomes `NaN` or `0` silently** — this project's signature defect.

---

## E. Bundle builder

- [ ] All four steps work: cabinet → top → mirror → faucet
- [ ] Discounts apply at the stated tiers: **5% top, 10% mirror, 15% faucet**
- [ ] A matched pair (two mirrors, two faucets) counts as **one** bundle step
- [ ] Depth filtering excludes tops that cannot fit the chosen cabinet
- [ ] Same-model mirror floats to the front after a cabinet is chosen
- [ ] Summary panel shows MSRP → sale → bundle, and they are internally consistent
- [ ] Add to cart → the cart total **matches the summary panel exactly**
- [ ] Trade pricing and bundle discount stack the way you intend (confirm the intended behaviour before testing it — this is a business rule, not a bug)

---

## F. Cart and samples (not checkout)

- [ ] Add, update quantity, remove — each updates the total immediately
- [ ] Cart drawer and cart page agree
- [ ] ⚠️ No `NaN`, `$0.00` or blank prices anywhere, at any quantity
- [ ] Cart survives a page reload, and survives sign-in (the cart is carried across session regeneration)
- [ ] **Free samples**: first 2 are free
- [ ] A third sample is charged
- [ ] ⚠️ The limit is enforced **per email AND per address** — try the same address with a different email
- [ ] Samples banner and `/collections/samples` both work
- [ ] Proceeding to checkout reaches the first checkout page without error — then **stop**

---

## G. Checkout pages, up to but not including payment

- [ ] `/checkout/identify` accepts an email and moves on
- [ ] Page 1 shows the email read-only and the consent checkboxes
- [ ] Google Places autocomplete suggests and fills an address
- [ ] ⚠️ The three delivery types — residential, commercial, **terminal/pickup** — each give different acknowledgement copy
- [ ] Liftgate is **derived from the address type**, not asked separately
- [ ] Shipping quote returns a real number for a real address
- [ ] The payment page renders the Stripe Payment Element — **do not submit**
- [ ] Refreshing mid-flow does not lose the cart

---

## H. Search

- [ ] A product name returns that product first
- [ ] A SKU returns the right item
- [ ] A multi-word query behaves (relevance scoring, not FULLTEXT, since the rewrite)
- [ ] A misspelling degrades gracefully rather than returning nothing
- [ ] No results → an empty state with a route onward

---

## I. Content pages

- [ ] Every footer link resolves: Shipping Policy, Returns, Contact, About, Privacy, Terms
- [ ] All **ten** inspiration guides load (NOT fifty — the first draft of this
      checklist said 50, taken from a September task title. The 2026-10-05
      rewrite consolidated them to ten image-led listicles; see
      `migrations/2026-10-05_article_rewrite_RUNME.sql`, "ALL TEN".)
- [ ] Inspiration guide shows reading time and the product showcase
- [ ] Lookbook renders
- [ ] Blog list and a blog post render
- [ ] Contact form submits and the message arrives
- [ ] Newsletter signup writes a row to `newsletter_signups` ⚠️ (this table was missing once and signups were silently discarded)
- [ ] ⚠️ Grep the live pages for **"every order"** — the absolute shipping claim. Homepage is clean as of 2026-10-24; `/pages/shipping-policy`, About Us and five inspiration guides are **unverified** (task #371).

---

## J. Admin

- [ ] Every sidebar item either loads or is clearly marked SOON/OFF — no link leads to a 404 or a blank page
- [ ] Orders list: filters, search, pagination, RAG status colours
- [ ] Order detail: items, totals, customer, address, payment status, risk panel, auth-expiry warning
- [ ] ⚠️ Capture and Cancel buttons are present on an authorised order (**do not press them**)
- [ ] Returns queue: request → approve → receive → resolve
- [ ] WWEX: rate quote returns rates; booking screen renders (**do not book**)
- [ ] Pickup addresses CRUD
- [ ] Theme Editor: change a value, save, confirm it shows on the live site, undo it
- [ ] Pages / Menus / Authors / Inspiration admin all CRUD
- [ ] JMV demand reports render with data, no "No data" panels
- [ ] Customer analytics loads and excludes `is_test` records
- [ ] ⚠️ **Every destructive button shows a confirmation.** CSP sets `scriptSrcAttr: 'none'`, so an inline `onclick` is silently refused and the first click would delete with no prompt. Test the actual click, not the markup.

---

## K. Crons and background jobs

Check `jmv_sync/logs/` for a recent, `exit=0` entry for each.

- [ ] `jm_feed_guard.sh` — every 5 min. ⚠️ **Event-only log**: it writes nothing on a quiet run, so `feed_guard.log` is normally hours old and that is health, not failure. Verified 2026-10-24: unbroken daily `RESCUED` lines through 10-23. Judge it by whether the *daily* rescue is present, never by file mtime.
- [ ] `jmsync.sh` — 04:30 and 16:30 UTC
- [ ] `gvssync.sh` — 04:59 and 17:00
- [ ] `jmv_rollup.sh` — 05:45
- [ ] `erv_inventory_sync.sh` — 06:15
- [ ] `bundle_catalogue.sh` — 06:30
- [ ] `brevo_consent_reconcile.sh` — 07:00 ⚠️ confirm `BREVO_RECONCILE_NOTIFY` is **not** set on the cron line; if it is, notifications are off
- [ ] `shipment_status_poll.sh` — 13:00 and 23:00
- [ ] ⚠️ Any log that **stops** rather than erroring is the dangerous case — a wrapper that dies before logging its exit code looks identical to one that never ran
- [ ] ⚠️ **Separate the two log shapes before judging freshness.** A *per-run* log (every wrapper with a `── started ──` / `exit=` pair) should be as fresh as its schedule. An *event-only* log (`feed_guard.log`) is silent when nothing happened. Applying the per-run standard to an event-only log manufactures a failure; applying the event-only standard to a per-run log hides one. Same reasoning as `SESSION_HANDOFF.md` §4c — blank is not evidence of health, and neither is old.

---

## L. SEO and redirects

- [ ] `robots.txt` resolves and does not block anything live
- [ ] `sitemap.xml` resolves, is valid, and contains products, collections, pages, blog and inspiration
- [ ] ⚠️ `/collections/sale` is **missing** from the sitemap (task #365)
- [ ] Spot-check 10 old Shopify URLs from the 301 map → each lands on a 200, with **no chains and no loops**
- [ ] Canonical tag correct on product, collection, filter landing and inspiration pages
- [ ] `og:title`, `og:description`, `og:image` present — paste a link into Slack or iMessage and look at the card
- [ ] No `noindex` on anything that should rank (trade pages are deliberately `noindex,follow`)
- [ ] Structured data validates (Product, VideoObject, BreadcrumbList)

---

## M. Performance, responsive, accessibility

- [ ] Lighthouse on homepage, a collection and a product page — record the numbers, do not chase them
- [ ] ⚠️ **CLS specifically**: the hero has caused layout shift before
- [ ] Images have width/height and lazy-load below the fold
- [ ] Mobile: hamburger opens, megamenu accordions expand and collapse
- [ ] ⚠️ Desktop nav fits without wrapping at the configured breakpoint (1252px) — and the Theme Editor warns if the logo makes it too wide
- [ ] Tablet renders — it is the size that gets forgotten
- [ ] Keyboard: tab through the nav, a filter and a form; focus is always visible
- [ ] Every image has meaningful alt text
- [ ] No console errors on any page — especially **CSP violations**, which mean something silently did not run

---

## N. Security (non-destructive checks only)

- [ ] Security headers present: CSP, `nosniff`, frame options, HSTS
- [ ] Admin routes refuse a logged-out request — try `/admin/orders` in a private window
- [ ] ⚠️ Trade document URLs refuse logged-out (repeated from §B because it is the highest-consequence one)
- [ ] CSRF: a form submits normally; **multipart forms too** (this broke once — `express.urlencoded` ignores `multipart/form-data`, so `req.body` is empty until multer runs)
- [ ] Rate limiting on auth and the storefront returns a friendly message, not a 500
- [ ] No stack traces or raw `err.message` in any user-facing response

---

## Known-fragile list — check these first if time is short

1. **An unselected column is `undefined`, never `null`.** The most common defect in this codebase. Symptom: a figure that is silently `0` or `NaN`, or a banner that never renders.
2. **MAP gating** — trade pricing leaking to a logged-out visitor is a manufacturer-agreement breach, not a bug report.
3. **Trade documents reachable without auth** — they can contain SSNs.
4. **CSP refusing inline handlers** — destructive buttons losing their confirmation.
5. **Brevo's List-Unsubscribe** killing transactional mail.
6. **The device-remember grant surviving logout** — fixed 2026-10-23, re-test after any auth change.
7. **Hostinger's deploy directory moves.** Anything written to a path inside the deploy dir is orphaned on the next deploy. Uploads under `/images/uploads/` have never been checked for this.

---

## ⚠️ How this checklist gets you a WRONG answer

Six false alarms in the 2026-10-24 run, every one caused by the probe rather
than the site. Read these before trusting a red result.

| What looked broken | Why the probe lied |
| --- | --- |
| Trade pricing "missing" on product pages | It is **cart-only by design** — `tierService` is called by cartController and checkoutController, never by productsController. The admin screen says so: "15% off, applied in the cart." Check the design before the code, and the code before the report. |
| Three collections "empty" | They render **model-group cards**, not product cards. Counting `/products/` links returns zero on a perfectly healthy page. |
| Every filter returning "24" | 24 is the page size. Card counts cannot detect filtering — read the stated **"N products"** total instead (4,604 → 956 white → 742 at 36"). |
| Product IDs all identical | The **cart drawer** renders on every page with its own hidden `product_id`. Scope selectors to `<main>` or you scrape the drawer. |
| Three admin pages 404 | **I had guessed the URLs.** The real ones are `/admin/marketing/jmv` and `/admin/marketing/site`. Extract the hrefs out of the rendered sidebar; never type an admin path from memory. |
| `feed_guard.log` "stale" — last line 12 days old | The File Browser's editor is **Ace, which virtualises**: `.ace_line` returns only the lines currently rendered in the viewport, so a long file silently reads as its first screenful. Use `ace.edit(el).getValue()`. The real last line was that same day and matched the file's mtime to the minute. Exactly the "24 is the page size" error in a different costume. |

Two more traps worth knowing:

- **"No code arrived" is usually the click, not the mail.** Confirm the page
  actually says "Check your email" before blaming delivery. A click landing
  before the page settles leaves the form at step one, silently.
- **httpOnly cookies are invisible to `document.cookie`.** Their absence there
  proves nothing about whether the browser holds them. Test behaviour instead.

## After a run

- Delete or `is_test`-flag every record created.
- Note anything found in the task list rather than here — this file is the checklist, not the findings.
- If something failed, write the gate before writing the fix, and **plant the defect to prove the gate catches it**. Green on correct code proves nothing. See `docs/SESSION_HANDOFF.md` §6.
