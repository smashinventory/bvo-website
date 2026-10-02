# BVO — Open Items

> Outstanding work, numbered. Check here before starting anything — it may already be logged.

Things noticed but deliberately **not** acted on. Each one is parked with enough
context to pick up cold, so a later session doesn't have to rediscover it.

**Rules for this file**

- An item lands here instead of being bundled into unrelated work.
- Nothing here is approved. Nothing here gets built without Sam saying so.
- Delete an item when it ships or when it's decided against — record which.

---

## Open

### 1. Rule 2 ceiling has only 0.5" of headroom
*Logged 2026-09-12 · from the Kinnsden → Lucian correction*

`PAIRING_OK` now derives the RC collections from cabinet depth `21" ≤ d < 22"`
instead of a hardcoded list. The floor has 1.37" of clearance (nearest non-RC
cabinet 19.63"); the **ceiling has 0.5"** — the nearest standard cabinet is
22.5".

If JM ships a cabinet around 21.75" it lands in the band and is offered Radius
Cut tops it cannot take. Nothing would fail loudly.

**Possible responses, none chosen:** widen the gap by keying on the `060` token
from `product_components` instead of depth; add a boot-time assertion that the
band returns exactly the collections that have `060` combos, and warn when it
doesn't; or leave it and re-check whenever JM adds a collection.

---

### 2. §2 of the combo demand definition could use the exact combo→top edge
*Logged 2026-09-12 · raised and parked during the Lucian correction*

§2 resolves combo → top on `top_finish + top_material + size_nominal + sinks`,
which covers **4,085 of 4,199 (97%)** and collides on 41 of 127 keys — which is
why Rules 2 and 4 exist at all. `product_components` carries the exact edge and
resolves **4,198 of 4,198**.

If it replaced §2, Rules 2 and 4 and the RC family fold in §3 would all become
unnecessary — they exist only to disambiguate a key the real edge doesn't have.

**Why it's parked:** it amends an artifact of record that is signed off, and
buys 3% of coverage on a figure the document itself insists is labelled
"modelled". Reopening it costs re-verification and re-approval.

---

### 3. Site audit — outstanding items
*Logged 2026-09-12 · full detail in `AUDIT_2026-09-11.md`*

Ranked by what they're worth:

- **Image weight.** Collection pages ship 3.41 MB of imagery for twelve cards;
  one image is 3,455 KB into a 152×210 card. Fix is tested: inserting
  `w_400,f_auto,q_auto` **after** the Salsify signature gives 29 KB. Before the
  signature returns 404.
- ~~**`/pages/about` 404**~~ — **done 2026-09-13**, Sam corrected the CTA URLs in
  the Theme Editor. The short-vs-long slug trap is still live for any new URL:
  migration 012 seeded the LONG forms (`about-us`, `contact-us`,
  `privacy-policy`, `shipping-policy`, `returns-policy`,
  `terms-and-conditions`).
- ~~**No `<h1>`**~~ — **the finding was wrong**, closed 2026-09-13. The audit
  grepped templates for the literal `<h1`, which `index.ejs` never contains
  because the tag is interpolated via `_safeTag(hero.heading_level,'h1')`. The
  homepage had **two**, not zero: `hero` and `hero_mobile` were separate
  `<section>`s each carrying the heading, with CSS hiding one. `cms-page.ejs`
  had exactly one all along, and `page.ejs` — which the audit named — does not
  exist. Fixed to a single hero, commit `7fdbfe8`.
- ~~**Sitemap `lastmod`**~~ — **done 2026-09-13**, commit `3333a56`. The stated
  cause was wrong: only 4 hardcoded lines used `today`, which cannot produce
  5,139. The real cause was `importJamesMartinFeed.js` setting
  `updated_at = CURRENT_TIMESTAMP` explicitly, overriding the column's own
  `ON UPDATE` and bumping every product daily.
- **Tap targets** — size chips 20×22px, swatches 18×18px, badges at 9px.
- **CSP stripped at Hostinger's edge** — the app builds a nonce policy, the
  browser receives `upgrade-insecure-requests` only. Support ticket, not code.
- **`SITE_URL`** must be set explicitly (with `www`) before cutover.

---

### 4. Rate limiter — ✅ DONE 2026-09-28

> **Applied: `windowMs 5 min, max 150`, and `/sitemap.xml` exempted.**
>
> Done ahead of cutover rather than on the day, because the change is
> **not a relaxation**:
>
> ```
> before   67 req/min sustained, up to 15 minutes locked out
> after    30 req/min sustained, at most  5 minutes locked out
> ```
>
> Tighter on throughput, three times gentler on the lockout. There was no
> exposure in applying it early.
>
> Auth limiters untouched — customer 10/15min, admin login 5/15min.
> Gated by `gates/gate_rate_limiter.js`, 9/9 mutations caught, including
> "sitemap route path changed", which would have made the exemption
> silently never match.
>
> **NOT done, deliberately:** verified-Googlebot bypass by reverse DNS.
> Only worth it if Search Console shows real crawl errors after launch.
>
> The original reasoning is kept below.

*Logged 2026-09-12 · deliberate pre-launch posture, do not "fix" early*

Currently `windowMs 15 min, max 1000`, with `/css`, `/js`, `/images`,
`/docs/uploads`, `favicon.ico` and `/robots.txt` exempt (commit `2ea972c`).
The tight setting was chosen deliberately out of caution while the site is
not live. **Leave it alone until www.BathroomVanitiesOutlet.com moves off
Shopify to the Hostinger instance.**

At cutover, the reasoning to apply:

**This is a scraping control, not DDoS protection.** A request reaching
`express-rate-limit` has already cost a TCP connection, a TLS handshake and
event-loop time. Volumetric defence belongs at the edge. Against scraping the
number buys little either way — 5,311 URLs takes 6.6 hours at 200/15min and
80 minutes at 1,000, and anyone serious rotates IPs past both.

**The lockout shape matters more than the ceiling.** The penalty is the
remainder of the window, measured at `Retry-After: 641` — eleven minutes on
every route including the homepage. Sustained 429s are read by Google as a
failing server and crawl rate drops, which is the real risk to a site whose
rankings are being migrated.

Suggested at cutover:

```
windowMs  5 min,  max 150     same order of protection, 5-min worst case
```

Plus **exempt `/sitemap.xml`** — currently counted, and a 429 there breaks
URL discovery for the whole site. One cheap file.

Optional, only if Search Console shows crawl errors after launch: bypass
*verified* Googlebot via reverse DNS, which cannot be spoofed the way a
user-agent can. Real work; not worth it speculatively.

**Do not touch the auth limiters** — customer 10/15min, admin login 5/15min.
Those guard credentials and are the ones doing real security work.

---

### 5. Checkout and payment — audit findings, RE-CHECKED 2026-09-28
*Logged 2026-09-12 · audited 2026-09-23 · **re-checked against live code
2026-09-28***

> ## ⚠️ THE REASON THIS WAS DEFERRED NO LONGER EXISTS
>
> The deferral was: *"hold the fixes until the Authorize.net work is picked
> up, so they land together rather than as drive-by edits to the
> highest-risk file in the app."*
>
> **That work has since happened — as a rewrite to STRIPE, not
> Authorize.net.** checkoutController and the webhook handler were
> rewritten, checkout.ejs moved to the Payment Element, capture was
> repointed, and the old payment services were deleted.
>
> So the bundling argument is gone, and the rewrite closed several
> findings outright. Re-checked below against the code as it stands, not
> against the September audit. **Do not act on the 2026-09-23 list
> without reading this.**

Original audit was a static code read only — no test transactions, no probing
of the live flow, no card data touched.

#### Status after the Stripe rewrite

| # | Finding | Status 2026-09-28 |
|---|---------|-------------------|
| F1 | No authorization-expiry handling | **CLOSED** — `payment_auth_expired` event in ordersController, expiry countdown on the order detail screen |
| F2 | Cart merge drops bundle context | **STILL LIVE** |
| F3 | `existing.qty += qty` has no clamp | **STILL LIVE** |
| F4 | FraudLabs fails open | **MOOT** — `fraudLabsService.js` deleted; screening is Stripe Radar plus the EFW and dispute webhooks |
| F5 | No idempotency on `POST /checkout` | **CHANGED SHAPE — needs re-checking.** The webhook handler is explicitly idempotent (a redelivery affects 0 rows and returns early). Whether a double-submit can create two Checkout Sessions was NOT re-verified. |
| F6 | `status: 'confirmed'` hardcoded | **PARTLY** — now `authorized ? 'confirmed' : 'pending'` with a comment defining "confirmed" as authorised-and-validated. The naming question (staff may read it as *paid*) stands. |
| F7 | Stale Clover comments | **CLOSED** — zero occurrences in `routes/checkout.js` or `checkoutController.js` |

#### What actually remains

**F2 and F3 are NOT in the payment file.** Both live in
`src/controllers/cartController.js`, which the deferral was never protecting.
They are ordinary cart-merge bugs and can be fixed on their own, with a gate,
without touching anything that moves money.

F5 needs ten minutes of reading to confirm or re-open. F6 is a naming
decision, not a defect.

#### Sound — no action needed

- Card data never reaches the server. AcceptUI is a hosted iframe; we receive
  only an opaque nonce. That is PCI SAQ A, and the reasoning is documented at
  `checkoutController.js:43-53`.
- Prices are read from the DB and explicitly NOT from `req.body`
  (`cartController.js:62`, with a comment saying why).
- `bundle_discount_pct` is allowlisted to exactly `[0, 5, 10, 15]`
  (`cartController.js:98-102`) — the obvious "POST 99" attack is already
  guarded, and the comment names it.
- Totals recalculated server-side; CSRF token on the form and verified;
  order + items in one transaction with rollback; FraudLabs REJECT does not
  leak its reason; confirmation email fire-and-forget AFTER commit.

#### Findings, in priority order

**F1 — no authorization-expiry handling (highest).** Capture is a deliberate
manual admin step (`POST /admin/orders/:id/capture`), which is right for
freight goods captured at ship time. But Authorize.net auths lapse — typically
~30 days — and nothing tracks it:

```
RAG logic exists for   shipments (tracking scans, ETA slippage)
RAG for aging auth_only orders   NONE
any mention of auth expiry       NONE
```

With 2-5 days processing plus vendor backorders, an order can sit in
`auth_only` past the window. `captureTransaction` then fails and the money is
never collected, possibly after the goods shipped. No alert would fire.
Needs a decision on mechanism (admin alert, scheduled job, or both) and on the
threshold.

**F2 — cart merge drops bundle context.** `cartController.js:104`:

```js
const existing = cart.items.find(i => i.product_id === product_id);
if (existing) { existing.qty += qty; existing.price = pricef; /* … */ }
```

`bundle_discount_pct` and `bundle_id` are not reconciled, and the lookup keys
on `product_id` alone. Both directions are reachable through normal UI use:

- bundle first, then the same item standalone → extra units inherit the
  discount (revenue leak)
- standalone first, then via bundle → the customer silently loses their
  bundle discount

**F3 — `existing.qty += qty` has no clamp**, while the first add clamps to 99
(`cartController.js:96`). Repeated adds walk past the cap.

**F4 — FraudLabs fails open.** The reject fires only on
`fraudResult.ok && status === 'REJECT'`, so an API outage lets orders through
unscreened. Probably the right call — blocking revenue on a third-party
outage is usually worse — but it is not stated anywhere. `REVIEW` also passes
straight to `confirmed`, relying on someone reading the admin panel.

**F5 — no idempotency on `POST /checkout`.** A double-submit before the first
response could produce two authorizations. Cart-clearing mitigates, does not
prevent.

**F6 — `status: 'confirmed'` is hardcoded** at insert while payment is only
authorized. "Confirmed" means authorized, not paid. Confirm staff read it
that way.

**F7 — stale Clover comments** throughout `routes/checkout.js`. Cosmetic, but
misleading in the highest-risk file in the app.

#### Open question, NOT a finding

`calcTotal` sums line items only — no shipping (free shipping is advertised,
so likely intentional) and **no sales tax**. Whether that is correct depends
on nexus and registrations, which is a question for whoever handles tax
compliance, not something to infer from the code.

---

### 6. Hotlinked images — OWNER-OWNED, NOT A BLOCKER, DO NOT ACT ON THIS
*Reclassified 2026-09-28 at the owner's instruction: "Take it off the
list completely. I will handle it when time permits."*

> **Do not attempt to fix this.** It is off the cutover list and off the
> work list entirely.
>
> An attempt on 2026-09-28 repointed nine inspiration-guide images at
> catalogue product photography, matched by SKU. It was reverted the same
> day, by hand, and the migration deleted from the repo.
>
> **Why it failed, so nobody repeats it.** The guides sit under *Ideas &
> Inspiration* and carried LIFESTYLE ROOM SHOTS. The catalogue only holds
> product photography on white. Cropped to a wide hero, one of the
> replacements rendered as a close-up of a drawer front. The section
> exists to inspire; product cutouts defeat it.
>
> The instruction had been "find the exact image on Bunny, else upload
> it". Matching by SKU returns a DIFFERENT IMAGE OF THE SAME PRODUCT,
> which is not the same thing — there was never a match to find, and the
> upload path was the only correct one.
>
> **The lesson is general: look at what an image is DOING on the page
> before proposing to replace it.** Hosting correctness does not justify
> degrading the page.
>
> Only surviving change: the Brittany model tile now uses `650-V36-SC`
> from our own CDN. That one sits in *Featured Models*, where a product
> shot is correct. Owner left it in place.
>
> `scripts/auditImageHosts.js` still reports these ten and that is fine —
> it is a report, not a queue.
>
> The original analysis is kept below for whenever the owner picks it up.

### 6a. Original analysis — reference only
*Logged 2026-09-13 · **re-measured 2026-09-23** · full detail in `docs/briefs/HOTLINKED_IMAGES_HANDOFF.md`*

> **STATUS 2026-09-23 — the original 14 are largely closed, and the problem
> has recurred.** Category cards, hero and supporting imagery are now on the
> Bunny pull zone `images.bathroomvanitiesoutlet.com`. All eight gstatic cache
> keys are gone, as are lampsplus and bathvanityexperts.
>
> ### RE-MEASURED FROM THE DATABASE, 2026-09-28 — it is ELEVEN, not four
>
> The homepage DOM shows only what the homepage renders. Querying the
> curated fields directly:
>
> | where | count | detail |
> |---|---|---|
> | `pages.og_image` | **10** | inspiration-guide cards + their JSON-LD `image` |
> | `model_groups.custom_image` | 1 | Brittany tile |
> | `categories.image_url` | **0** | the ten gstatic ones are genuinely closed |
> | `product_images.url` | **0** | all ~57k rows clean — `cdnUrl.js` is working |
>
> Hosts: usbathstore ×2, jamesmartinvanities ×3, bathgems, ak1.ostkcdn,
> cdn.shopify, keetchen, i5.walmartimages.
>
> **Owner, 2026-09-28: these are all James Martin product images that
> happen to be hosted on other retailers' sites — not third-party
> photography.** So it is a fragility and dependency problem, not a
> rights problem. Fix by matching to the same image in our own catalogue
> where the filename identifies it (Brittany 36 Smokey Celadon,
> Breckenridge 36 Light Natural Oak, Allamari 48 Sable are all
> identifiable), and uploading the rest to Bunny.
>
> ### WHY THE EXISTING CONTROLS DID NOT CATCH THESE
>
> Both controls work. Neither can see this case:
>
> - `views/partials/admin/hotlink-warn.ejs` (global, via
>   `layouts/admin.ejs:418`) fires when someone TYPES a foreign URL into
>   an admin form. These were never typed.
> - `cdnUrl.js` rewrites vendor hosts on product import. These are not
>   product images.
>
> The ten arrived with the inspiration-page content build, straight into
> the database. **A gate cannot catch it either** — gates run with no
> database credentials, and the URLs are in no committed `.sql` file.
>
> So the gap is filled by `scripts/auditImageHosts.js` (2026-09-28):
> reads the database, classifies every image URL against the ONE owned-host
> list in `cdnUrl.js`, exits non-zero if any are foreign. **Run it before
> cutover and after any bulk content import.**
>
> ### RESOLVED 2026-09-28 — `migrations/2026-09-28_repoint_hotlinked_images_RUNME.sql`
>
> Ten of the eleven repointed at products in our own catalogue, resolved
> **by SKU rather than by pasting a Bunny URL** — imports legitimately
> replace product photography, so a hard-coded URL would rot back into a
> stale link, which is the same failure being fixed.
>
> | target | product | same model as the original? |
> |---|---|---|
> | farmhouse | `330-V36-LNO-3EJP` Breckenridge 36″ LNO w/ Eternal Jasmine Pearl | exact, including the top |
> | floating | `D640-V48-SBL` Allamari 48″ Sable | yes |
> | 60-inch | `545-V60D-LNO-1WZ` Laurent 60″ Double LNO | yes |
> | buying-guide | `D225-V72-SSO` Solene 72″ Double Seaside Oak | yes |
> | modern | `983-V36-AGR-RG` Columbia 36″ Ash Gray, Radiant Gold | yes |
> | white | `E645-V60S-GW` Athens 60″ Glossy White | yes |
> | double-sink | `670-V60D-M-WLT` Amberly 60″ Double, Mid-Century Walnut | same model, different finish |
> | master | De Soto 82″ if stocked, else `E444-V72-GW-3EJP` Addison 72″ | self-resolving |
> | small | `E444-V30-GW-3EJP` Addison 30″ Glossy White | **SUBSTITUTED — see below** |
> | Brittany tile | `650-V36-SC` Brittany 36″ Smokey Celadon | exact |
>
> **The one substitution.** `small-bathroom-vanity-ideas` pointed at
> ak1.ostkcdn "Boston 31 1/2 Rectangular", which resolves EXACTLY to our
> `055BK16BNK31.5WG2` — *"Two Boston 15.25″ Wall Brackets w/ 31.5″ glass
> shelf"*. Perfect match, wrong content: a shelf bracket is a poor hero
> for a guide about small vanities.
>
> **One left.** `how-to-choose-a-bathroom-vanity` uses a James Martin
> 2026 **collections banner**, not a product, so there is nothing to
> point at. Owner uploading it to Bunny. `scripts/auditImageHosts.js`
> reports exactly that one until the URL is set — which is the check
> working, not a failure.
>
> **Two probe errors of mine on the way, both self-inflicted:** a
> `LIMIT 8` hid the Amberly 60″ rows so I reported it unstocked when it
> is stocked, and a size filter of 72/84/94 never looked for De Soto 82
> at all. The migration resolves De Soto dynamically rather than relying
> on either answer.
>
> The 2026-09-23 homepage measurement is kept below for history.

> Measured on the live homepage DOM — four hosts still not ours:
>
> | host | what | on the original list? |
> |---|---|---|
> | `jamesmartinvanities.com` | Brittany model tile | yes, never closed |
> | `ak1.ostkcdn.com` | Overstock product shot | **no — new** |
> | `bathgems.com` | Allamari vanity | **no — new** |
> | `usbathstore.com` | Breckenridge vanity | **no — new** |
>
> Three appeared *while the list was being worked through*. That is the
> argument for the control raised at the bottom of this item and never
> approved — an admin warning when an image URL points outside our own hosts,
> at the point of entry. Four fixed, three new, one never closed, in ten days.
>
> Separately and larger: every Huntington Brass faucet hotlinks
> `huntingtonbrass.com` by design (`importHuntingtonBrass.js:32`, marked
> "temporary"). Not counted above — HB products do not appear on the homepage.
>
> **The detail below is the 2026-09-13 snapshot, kept for reference.**


Fourteen images on the site are served from hosts we do not control. **All of
them are hand-entered curation. The product catalogue itself is clean** — 56,811
`product_images` rows come from `images.salsify.com`, which ships with the JM
feed, and 341 from your own Cloudinary account. Nothing below is feed data, so
nothing below gets repaired by a re-import.

**Replace all fourteen before the domain moves.** Every one is editable through
the admin UI. No code, no migration.

**Category cards — 10** · `/admin/categories` → edit → image field

| Category | Slug | Host |
|---|---|---|
| Bathroom Vanities- All Products | `bathroom-vanities` | gstatic |
| Bathroom Vanities With Tops | `bathroom-vanities-with-tops` | gstatic |
| Bathroom Vanity Cabinets - Cabinet Only | `bathroom-vanity-cabinets` | gstatic |
| Bathroom Vanity Tops - Top Only | `bathroom-vanity-tops` | gstatic |
| Bathroom Mirrors | `bathroom-mirrors` | gstatic |
| Faucets | `faucets` | gstatic |
| Storage | `storage` | gstatic |
| Vanity Models | `vanity-models` | gstatic |
| Lighting | `lighting` | image.lampsplus.com |
| Samples | `samples` | www.bathvanityexperts.com |

**Model tile — 1** · `/admin/models` · Brittany / James Martin Vanities ·
`jamesmartinvanities.com/cdn/shop/...`

**Product — 1** · `/admin/products` · Huntington Brass Sevaun Widespread
(`huntington-brass-sevaun-widespread`) · `plumbtile.com/cdn/shop/...`

**Hero — 2** · Theme Editor · `hero.mobile_image_url` and
`hero_mobile.image_url`, both gstatic. These live in `theme_settings.json`, not
a table, so the SQL below will not show them.

**Two different problems, same list.**

The eight `encrypted-tbn0.gstatic.com` URLs are Google Images *cache keys*, not
addresses. They rotate and expire on Google's schedule. When they go you get
blank images on the homepage's main category row with nothing in a log to
explain it.

The other four are someone else's product photography served from their
bandwidth — `lampsplus.com`, `bathvanityexperts.com`, `plumbtile.com`,
`jamesmartinvanities.com`. That is a different kind of exposure on a commercial
storefront, and independently they can rename a file or block hotlinking at any
time.

**Practical shortcut:** you already own 56,811 Salsify images. Eight of the ten
categories can take a product shot from inside that category — nothing to
source, no licensing question, and a better-matched image than a Google
thumbnail. Samples and Lighting have thin inventory to draw from.

**Re-run before cutover to confirm the list is empty** (excludes the two hero
images — check those in the Theme Editor by eye):

```sql
SELECT 'category' AS what, name AS label, slug AS ref, image_url AS url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model', model_name, brand, custom_image
  FROM model_groups
 WHERE custom_image LIKE 'http%'
   AND custom_image NOT LIKE '%salsify.com%'
   AND custom_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model-og', model_name, brand, og_image
  FROM model_groups
 WHERE og_image LIKE 'http%'
   AND og_image NOT LIKE '%salsify.com%'
   AND og_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'product', name, slug, primary_image_url
  FROM products
 WHERE primary_image_url LIKE 'http%'
   AND primary_image_url NOT LIKE '%salsify.com%'
   AND primary_image_url NOT LIKE '%res.cloudinary.com%';
```

`model_groups.og_image` returned nothing on 2026-09-13 — kept in the query
because it is a second image column on that table and would otherwise be a
blind spot.

**Not chosen, raised once:** nothing prevents this recurring. A warning in the
admin when an image URL points outside your own hosts would stop the next one
at entry rather than at cutover. Separate task, not approved.

### 7. `Finish/Color of Product` has two homes
*Logged 2026-09-16 · Rule 8 violation, deliberately not bundled into the colour work*

`importJamesMartinFeed.js` writes that feed column to EAV `finish` via
`ATTR_MAP` (line ~623) **and**, since `3a302ab`, to `products.color` as the
fallback source for the colour family. Two homes for one fact.

Rule 10 names `products.color` as canonical and lists EAV as a prohibited
alternative. But `docs/briefs/james-martin-feed-analysis.md` §1D says that
column maps to EAV `finish` with `filter_type: color_swatch`. **Both documents
are in writing and they disagree** — which under CLAUDE.md §4 is a question for
Sam, not a judgement call.

Nothing is broken today: the colour filter reads the column, and the EAV row is
simply unread. The cost is a reader having to work out which one is live.

**Not chosen:** removing `'Finish/Color of Product'` from `ATTR_MAP`. One line,
but it needs the document conflict settled first and a check that no view reads
`attr_key = 'finish'`.

---

### 8. 57 vanity products still carry the pre-fix Ash/Shagreen families
*Logged 2026-09-16*

`Sunwashed Oak` (41) and `Sunwashed Oak with Embossed Shagreen Drawer Fronts`
(16) sit in `gray` and `green` in the database. The code that produced those
values is fixed — `Ash` moved to `wood_l` and the substring fallback now
requires a word boundary — but only the **mirrors** were backfilled by SQL.

They correct themselves on the next full JM import. If that is not soon enough,
`scripts/gen_mirror_colour_sql.js` takes a category argument's worth of change
to emit the same shape for vanities.

Visible symptom until then: a Sunwashed Oak vanity appears under the Gray
swatch and not under Light Wood.

---

### 9. `loadColorMappings()` ignores the context column
*Logged 2026-09-16*

`color_mappings` has `PRIMARY KEY (vendor_color, context)`, so one colour can
legitimately hold both a `cabinet` row and a `metal` row.
`loadColorMappings()` selects only `vendor_color, family_key` and keys its Map
on the colour alone — so when both exist, whichever MySQL returns last silently
wins.

Same arbitrariness as the `MIN(color_family)` tie-break that was rejected on
2026-09-16, already sitting in the code. It only bites if a colour is mapped in
both contexts; nothing does today.

**Fix if wanted:** select `context` too and key the Map on
`vendor_color + '|' + context`, with the caller passing the context it wants.

---

### 10. A dry-run import silently skips admin colour mappings
*Logged 2026-09-16*

`importFromWorkbook(wb, { dry: true })` does
`const colorMappings = dry ? new Map() : await loadColorMappings(conn)`.

So a dry run reports colours resolved **without** any Color Report overrides —
the one thing a dry run is meant to preview. Anyone checking a mapping by
dry-running the import gets a confidently wrong answer.

Loading the map is a single read and harmless in a dry run.

---

### 11. The `site-bundle.css` rebuild recipe does not reproduce the file
*Logged 2026-09-23 · measured, not fixed*

`views/layouts/main.ejs` documents how to rebuild the public stylesheet:

```
cat brand.css site.css site2.css > site-bundle.css
head -c N site4.css >> site-bundle.css
```

**It does not produce the file that is on disk.** Measured 2026-09-23:

| | |
|---|---|
| `site-bundle.css` | 127,404 bytes |
| `site4.css` head embedded in it | 7,984 bytes, starting at offset 114,503 |
| bytes following that, unexplained | **4,917** |

Run the recipe as written and those 4,917 bytes are lost from every public
page. Nobody knows what they are — they are not accounted for by any of the
four named source files.

This predates the 2026-09-23 alignment change (it was 8,043 / 4,917 before;
that commit removed 59 bytes from inside the embedded prefix). The stale
byte count in `main.ejs` has been replaced with these measured figures and
a warning not to run the recipe.

**Consequence today:** the two sheets must be patched by hand, in lockstep,
with the identical edit — which is what `git_push_hero_align_consolidate.sh`
did, and what its G4 gate enforces. That works but it is a manual invariant
with no build step behind it.

**Needs a decision, not a guess:** identify the 4,917-byte tail, then either
correct the recipe or replace it with a real build script. Whoever last
built the bundle knows what went in after the `site4.css` slice; the file
history may not.

---

### 12. 26 setting blocks have no `text_align` default
*Logged 2026-09-23 · narrowed 2026-09-24*

Scanned all 29 top-level blocks in `themeSettings.js`, comments stripped so
prose inside a block cannot produce a false match:

```
real text_align key:  hero_mobile, hero        (hero added 2026-09-23)
                      image_with_text          (added 2026-09-24)
no key:               newsletter, before_after, testimonials, parallax,
                      featured_section, featured_models,
                      video_text, categories_section, trust_band,
                      brand_logos, scrolling_ticker, bundle_teaser,
                      cart_drawer, social, footer, promo_strip, nav,
                      + the _2 duplicates
```

Each of those takes its alignment default from a **literal written into a
template instead** — and usually twice, once where the section renders in
`index.ejs` and once where the Theme Editor draws the control in
`theme.ejs`. The two can disagree, and there is no single source to check.

Most default to `'center'`, but `theme.ejs:1323` defaults to `'left'`, and
the shared `teAlignment()` helper at `theme.ejs:327` falls back to
`'left'` for any caller that passes no value.

**It has now bitten twice.** On 2026-09-24 `image_with_text` was reported as
"the alignment control does not work". The control, the setting and
`deepMerge` were all fine — the value simply had no default and lived only as
a `|| 'left'` literal in `index.ejs`, while `theme.ejs` carried its own copy.
Fixed for that block the same way. The remaining 26 are still exposed.

**Why it matters, concretely.** The hero hit exactly this on 2026-09-23.
Sam set the desktop hero to centre and kept it, but the value existed only
in `data/theme_settings.json` — losing that file would have snapped the
homepage back to left-aligned with nothing to explain it. Fixed for the
hero by giving it a real default; the other 27 are still exposed.

**The fix is mechanical but wide:** add `text_align` to each block in
`themeSettings.js` with the value that block's template currently
hardcodes, then delete the literals. Wide enough to want its own commit
and its own render test per section, which is why it was not folded into
the hero fix.

---

### 13. The three dirty `scripts/*RedirectMap.js` files are FINE — leave them
*Logged 2026-09-26 · read this before investigating them again*

`git status` shows three files permanently modified and uncommitted:

```
modified:   scripts/buildRedirectMap.js
modified:   scripts/gateRedirectMap.js
modified:   scripts/loadRedirectMap.js
```

**Do not spend time on these.** The whole diff is three path strings and
one explanatory comment. It has now cost two investigations.

**What the diff is.** The URL-migration scripts originally wrote to a
`migration/` folder created as a SIBLING of the repo — outside it. Sam
instructed that everything move into the existing `BVO Node.js/migrations/`
folder, to stop the multi-folder confusion. The files were moved; the three
scripts that point at them were edited to match and never committed. So:

- Committed code still says `../../migration/` — a path that **no longer
  exists**. Re-running any of the three from a clean clone crashes.
- The working copy says `../migrations/` — which resolves, and where
  `redirect_map.csv` actually lives.

The fourth change, in `loadRedirectMap.js`, renames its output to
`url_redirects_DATA_501rows.sql` because the old name was one character
from the schema file `2026-09-24_url_redirects.sql`, and the schema got
imported by mistake — "1 query executed", an empty table, no error.

**Why they cannot break anything running.** Verified 2026-09-26:

- Not `require()`d anywhere in `src/`. The two hits in
  `src/middleware/legacyRedirects.js` (lines 23, 114) are **comments**
  naming the script in prose.
- Not in `package.json` scripts — only `start`, `dev`, `migrate`, `seed`,
  `test`.
- No cron or workflow invokes them.
- At runtime the middleware reads the **`url_redirects` table**, already
  populated with 501 rows. These scripts only *generated* the CSV and the
  SQL that was imported. They never run in production.

**Status: Sam has seen the diff and chosen to leave them uncommitted.**
That is a deliberate decision, not an oversight. Respect it.

Committing them would also be safe, and would fix the broken path for
anyone cloning fresh — but it needs Sam's word, and it is not worth
raising a third time unless he brings it up or someone actually needs to
re-run the redirect build.

---

### 14. Every cron wrapper hardcodes the OLD domain directory
*Logged 2026-09-30, ~03:00, during DNS cutover night · START HERE tomorrow*

> **SUPERSEDED IN DETAIL by `docs/architecture/SERVER_CRON_TOPOLOGY.md`**
> (written 2026-09-30). The rename is now CONFIRMED, not suspected — the
> Hostinger activity log records it at 00:37:54 and the live directory
> string was read untruncated off the FTP Accounts page. That document has
> the full chain map, the exact line to change in each of the 14 scripts,
> and three open unknowns that must be resolved before any edit. Read it
> first; this entry is kept for the original reasoning trail.

**This is the root item. 15, 16 and 17 are all downstream of it, and the
first hour tomorrow should be spent establishing the one fact below before
touching anything else.**

All 14 shell wrappers at the account root begin with the same line:

```
BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com
```

`bundle_catalogue.sh` · `bvosync_cloudinary.sh` · `bvosync_manuals.sh` ·
`gvssync.sh` · `gvssync_append.sh` · `gvssync_cloudinary.sh` ·
`gvssync_envcheck.sh` · `gvssync_images.sh` · `gvssync_purge.sh` ·
`gvssync_resize.sh` · `jm_feed_guard.sh` · `jmsync.sh` · `jmv_rollup.sh` ·
`shipment_status_poll.sh`

**Why it is suddenly a question.** On cutover night the domain
`bathroomvanitiesoutlet.com` was attached to the Hostinger site. Two
things on the hPanel FTP Accounts page changed with it:

- FTP username is now `u222311468.bathroomvanitiesoutlet.com` — previously
  it would have been `u222311468.slategrey-falcon-350174.hostingersite.com`
- The "create FTP account" Directory prefix reads
  `/home/u222311468/domains/bathroomvanitiesoutlet.co…`

Both suggest the account's primary-domain identity moved. **Not proven.**
File Manager still shows everything where it was, but that proves nothing
either way — it is chrooted to the domain directory and presents it as
root, and `public_html` is a symlink that would follow a rename.

**THE ONE FACT TO ESTABLISH FIRST.** Does
`/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/`
still exist? File Manager cannot answer this. Use hPanel → Advanced →
**Cron Jobs**, which lists the registered command lines verbatim, or SSH
if the plan has it.

- **Path intact** → nothing here is cutover damage. Items 15 and 16 stand
  on their own and are older than tonight.
- **Path moved** → all 14 wrappers are dead right now, silently, and
  every nightly job (01:00, 04:30, 05:30, 06:30, 13:00) fails tonight
  with nothing in any inbox.

**The fix, once known.** Do not hand-edit 14 files with a new literal —
that is the same bug again, one rename later. Derive BASE from the
script's own location, e.g. `BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")"
&& pwd)"`, so a future rename cannot break them. Needs Sam's approval;
also needs a decision on whether the JM/Salsify FTP path and the
`jmv_sync/` PHP side reference the literal anywhere.

---

### 15. The four half-hourly crons appear not to be running
*Logged 2026-09-30, ~03:00 · evidence is circumstantial*

> **THE "PREDATES CUTOVER" CLAIM IS RETRACTED.** The original heading read
> "and this PREDATES cutover". That was written before the domain rename
> was confirmed. Two other explanations now fit the same evidence at least
> as well: the wrappers may be running and failing, with their errors
> written to a ghost `jmv_sync/logs/` on the dead path; or the crontab
> entries themselves may still point at the dead path, in which case the
> scripts never execute and log nowhere at all. See
> `docs/architecture/SERVER_CRON_TOPOLOGY.md` §6 and §7a. Do not act on
> the timing claim below.

| job | log file | schedule |
|---|---|---|
| `bvosync_cloudinary.sh` | `jmv_sync/logs/bvo_cloudinary.log` | `0,30 * * * *` |
| `bvosync_manuals.sh` | `jmv_sync/logs/bvo_manuals.log` | `0,30 * * * *` |
| `gvssync_append.sh` | `jmv_sync/logs/append_cron.log` | `0,30 * * * *` |
| `gvssync_cloudinary.sh` | `jmv_sync/logs/cloudinary_cron.log` | `0,30 * * * *` |

These write **unconditionally** on every run, before doing any work —
`bvosync_cloudinary.sh:37` and `gvssync_append.sh:91` both
`echo "=== $(date) ===" >> $LOG`. So a live job leaves a fresh log every
30 minutes, whether or not it had anything to do.

**Observed 2026-09-30 ~03:00:** a File Manager listing of
`jmv_sync/logs/`, sorted newest-first, showed the most recent file at
**7 hours old** (`shipment-status-poll.log`), then `cron.log` and
`sync_2026-09-29.log` at 13 hours, then everything else a day or older.
None of the four log files above appeared at the top of the listing.
Fourteen scheduled runs should have landed in that window.

**Not yet confirmed**, and this is the honest limit of the evidence: the
listing was not scrolled to the bottom, so the files may exist further
down — but if they were being written every 30 minutes they could not
sort below a 7-hour-old file. Confirm by searching the directory for
those four names and reading their last line.

**Why it matters that this is old.** If these have been dead for days or
weeks, then ER Vanities Cloudinary pushes, JMV image appends and manuals
have all been silently stale, and nobody would have seen an error. Check
how far back the last entries go before assuming the data is current.

---

### 16. `jm_feed_guard.sh` cannot prove it is alive
*Logged 2026-09-30, ~03:00 · design flaw, not a bug*

The guard runs every 5 minutes and, by deliberate design, logs **only
when it acts**. Its own header explains why: "At 288 firings a day, a line
per run would bury the two lines that matter under 100,000 a year. An
empty log means nothing has gone wrong."

The flaw: an empty log is also what "not running at all" looks like. The
two states are indistinguishable.

**Tonight it mattered.** A deploy demonstrably touched `public_html`
around 02:00 (`public_html` and `hbuilds` both showed mtime ~1 hour), and
`JM_Feed` was left empty with a fresh mtime — exactly the deploy-wipe
scenario the guard exists to catch. `feed_guard.log` was **a day old**.
That is either "it had nothing to do" or "it never fired," and the log
cannot say which.

**Suggested fix, not approved:** a heartbeat that does not bury the
signal — touch a `state/guard_heartbeat` file (mtime only, no content) on
every run, and keep the log action-only. Then "last heartbeat" answers
liveness and the log still answers what happened.

---

### 17. JM feed did not arrive on 2026-09-30 — deploy wipe is the leading explanation
*Logged 2026-09-30, ~03:00 · Sam: "resolve tomorrow, let it go"*

Feed was due and did not arrive. Established that night:

- **Not a DNS problem.** Salsify's FTP destination is configured with
  **Host `82.25.87.178`** — a raw IP, not a hostname. Port 21, path
  `/JM_Feed`, user `JMTeam`. DNS could not have affected it.
- `JM_Feed/` exists, is **empty**, mtime ~1 hour before 03:00.
- `JM_Feed/archive` empty. `JM_Feed_Repo` had no new file.
- `public_html` and `hbuilds` both mtime ~1 hour → **an hbuilds deploy
  fired**, almost certainly triggered by attaching the domain.
- The "Service unavailable." banner in the Salsify dialog is **stale** —
  that issue was resolved two months ago; transfers have run nightly since.

**Leading explanation, from `jm_feed_guard.sh`'s own header:** Hostinger's
hbuilds deploy system rebuilds `public_html` on every push, and `JM_Feed`
lives inside it because that is the only place JM's FTP account can write.
"If JM's FTP connects while the folder is missing, the transfer fails at
THEIR end. Nothing arrives, nothing is logged here, and the morning import
reports 'No .xlsx file found'." This exact failure happened on 31 Aug and
is why the guard was written.

**Still unchecked when work stopped:**

1. `jmv_sync/logs/feed_guard.log` — a `RECREATED … (deploy wipe)` line
   timestamped ~02:00 would confirm it. (It was a day old in the
   directory listing, which points the other way — see item 16.)
2. `JM_Feed_Repo/inbox` — the guard's rescue location, dated
   `YYYY-MM-DD_<filename>`. Only `archive` was checked. Tonight's feed may
   be sitting there intact.
3. Whether `JMTeam` still exists as an FTP sub-account. It was **not**
   visible in the hPanel FTP Accounts list, but it is unclear whether that
   page renders sub-accounts at all. Settle it by connecting with
   FileZilla to `82.25.87.178:21` as `JMTeam`.

**Note for the standing fix:** the Salsify config has **"Use .filepart"
unchecked**, so a failed transfer leaves a truncated real file rather than
a temp file, and nothing downstream can tell it is incomplete. Worth
turning on.

**Also noted:** this is plain FTP on port 21 — credentials and feed cross
the wire unencrypted. Hostinger account has no SFTP. **FTPS** (Salsify's
FTP Type dropdown) would fix it with the same IP, port, account and path.

---

### 19. TABLED — move the JM drop zone out of `public_html`
*Logged 2026-09-30 · Sam: "Lets table this. It is back to where it was
before." · design work is DONE, nothing built*

**Current state is the original working one**, restored 2026-09-30:

- FTP account `u222311468.JMTeam` **was wiped by the domain rename** and has
  been **recreated** — Directory `/public_html`, same username, same
  password. Write access confirmed by FileZilla upload test.
- Salsify needs no change: host `82.25.87.178`, port 21, path `/JM_Feed`.
- The only instruction-sheet edit for the JM team is the alternate
  hostname, `ftp.slategrey-falcon-350174.hostingersite.com` →
  **`ftp.bathroomvanitiesoutlet.com`**. The IP form never needed changing.
- Sam is asking JM to resend the missed drop.

**The idea, for when it comes back up.** `public_html` is Hostinger's
document root and hbuilds rebuilds it on every deploy, taking `JM_Feed`
with it — the cause of the 31 Aug and 30 Sept incidents. Moving the drop
zone to `/JM_Drop/JM_Feed`, outside `public_html`, makes the wipe
impossible and lets `jm_feed_guard.sh` retire.

**READ `docs/architecture/SERVER_CRON_TOPOLOGY.md` §2b FIRST.** It has the
pipeline traced from source, and it overturns the two things that seem
obviously true:

- the archive step in `syncJMFeed.js` is **not** a redundant hop, it is the
  input to `jmv_shopify_sync.php`
- the `.csv.gz` is in `jmv_sync/snapshots/`, **not** in `JM_Feed_Repo` —
  the Repo holds XLSX, and its filename is regex-parsed by the rollup

Both of those were assumed wrong in this session, from memory, by both of
us. The §2b trace is the corrective.

**Sam's chosen shape:** run the new path in parallel — new folder, new FTP
account, a second cron reading from it — and retire the old crons only
after cutover. No flag day. The clean hook is `FEED_DROP_DIR`, an env
override already present at `jmv_shopify_sync.php:366`, which needs one
added export in `gvssync.sh` and no edit to third-party `jmv_sync/`.

**Also decided and NOT done:** tightening the FTP chroot to
`/public_html/JM_Feed` so the vendor account cannot see or delete
`.htaccess` (FileZilla reported `adfrw` on it — read, write, rename,
delete). Sam: *"I trust them. No need to overcomplicate this. We will just
be extra tight on step 2."* The chroot change needs Salsify's Path to
become `/`, which is Sam's field to change, not the JM team's.

---

### 18. Apex → www 301 is written and gated but NOT COMMITTED
*Logged 2026-09-30, ~03:00 · approved by Sam, held for the JM cron*

Sitting uncommitted in the working tree:

- `src/utils/canonicalRedirect.js` (new) — `redirectTarget()`, pure function
- `src/server.js` — 4-line middleware calling it, placed after
  `CANONICAL_HOST` and above the robots route
- `gates/gate_canonical_redirect.js` (new) — 34 assertions, all pass;
  mutation swept with 10 mutations, 10 caught

**Why a module and not inline:** a gate cannot reach inline middleware
without booting the app, so it would have had to reimplement the rule and
assert its own copy. Sam approved inline; the deviation was flagged and
accepted.

**Decision made without an explicit answer, flag if wrong:**
`*.hostingersite.com` is **exempt** from the redirect, so the temp URL
stays usable as an escape hatch. Costs nothing in search terms — the
robots route already returns `Disallow: /` for every non-canonical host.

**Not urgent.** The apex was never going to be indexed: its robots.txt
already returns `Disallow: /`, and canonical + `og:url` on www pages both
emit www. The 301 is the better instrument (a disallowed host cannot pass
signals; a 301 does), not a live bug.

**Also still stashed:** `stash@{0}` — siteUrl consolidation + cutover
config gate, parked 2026-09-29.

---

### 20. GMC feed shipped with a DUPLICATE category map — Rule 8 and Rule 10 violated
*Logged 2026-09-30 · commit `4f03b4a` · raised by Sam, not found by the session that caused it*

**READ THIS BEFORE TOUCHING `google_product_category` OR THE FEED.**

> **STATUS 2026-09-30, end of session**
>
> | | |
> |---|---|
> | Two maps collapsed into one | **DONE** — commit `2feced3` |
> | Gate against a third map | **DONE** — 5 mutations, 5 caught |
> | **Database backfilled** | **DONE — ran by Sam in phpMyAdmin, verified** |
> | Write semantics (`COALESCE`) | **UNCHANGED — still open, see 20d** |
> | Huntington Brass importer | **UNCHANGED — see 20h** |
> | Anything in Merchant Center | **UNCHANGED — no data source registered** |
>
> **The backfill ran and matched the prediction exactly.** Dry run returned
> 6,079 / 5,890 / 189 as forecast from the dump; the UPDATE affected 5,890
> rows; the verification returned all twelve category counts exactly as
> predicted and `invalid_paths_remaining = 0`.
>
> Backup table **`_bk_gmc_category_20260930`** holds every pre-change value
> and is still in the database. **Do not drop it until Merchant Center has
> accepted the feed.** The old values cannot be recomputed — the map that
> produced them was deleted in `2feced3`.
>
> Scripts: `migrations/gmc_backfill_2026-09-30/` (1_backup, 2_dryrun,
> 3_update, 4_verify, 5_rollback). Idempotent — safe to re-run — **but see
> the warning in 3_update: it overwrites hand-typed values, which was safe
> only because none were legitimate at the time it first ran.**

#### 20a. What is wrong

There are now **two maps deriving one fact** — `product_type` → Google
product category:

| file | form | written by | reaches |
|---|---|---|---|
| `src/utils/seoDefaults.js` → `GMC_CATEGORY_MAP` | path strings | the original work | **the database**, via `importJamesMartinFeed.js` and `adminController.js` |
| `src/utils/googleProductCategory.js` | numeric ids | this session, `4f03b4a` | **the feed only** |

That is a direct breach of **Rule 8** (one internal taxonomy) and **Rule 10**
(one canonical source per fact), both in `BVO_AUDIT_BRIEF.md`.

The content of the new file is correct and is the genuinely valuable part —
all 27 live `product_type` values are covered where the old map covered 14,
and every id was read out of Google's published taxonomy file rather than
recalled. **The duplication is the defect, not the data.**

#### 20b. How it happened — the process failure, recorded so it is not repeated

The correct fix was always "correct `GMC_CATEGORY_MAP`". **That path had
already been taken twice:**

```
8bb7729  fix: add 4 vanity product_type variants to GMC category map
db077a3  fix: alt text + GMC category map expansion
7fcf537  feat: SEO + GMC auto-fill — browser UI + server-side defaults
```

`git log -S'GMC_CATEGORY_MAP'` takes ten seconds and shows all three. It was
not run. CLAUDE.md calls that search *"a precondition, not a step"* and says
defects have shipped three and four times on this project because sessions
reasoned from the code in front of them instead of from the record. This is
another one.

Also skipped, all of them signposted:

- **`INDEX.md` was never opened.** It is the literal first line of CLAUDE.md.
- **`BVO_AUDIT_BRIEF.md` rules were never read** — so Rule 8 and Rule 10 were
  broken without knowing they existed.
- **`BVO_MODEL_BRAND_KEY_BRIEF.md` §5.9** and **`BVO_BRAND_ONBOARDING_PLAYBOOK.md`
  Trap 13** both govern this exact column and both warn about this exact map.
  Neither was opened.
- The session searched for the *column name* early and `seoDefaults.js`
  **appeared in its own results**. It was never opened. The conclusion drawn
  was "the stored values are untrustworthy, so derive instead" — without ever
  asking the prior question, *who writes this, and does a map already exist?*

#### 20c. What does NOT need reversing — verified, do not redo this check

Nothing in production. The feed is inert:

- **No storefront coupling.** `google_product_category` is read by zero
  controllers, models, views, filters or sorts. Checked explicitly:
  `collectionsController`, `homeController`, `bundleController`,
  `productsController`, `inspirationController`, `lookbookController`,
  `Product.js`, `Category.js`, `search.js`, `searchQuery.js` — all zero. The
  storefront filters on `brand`, `model`, `width_in`, `color_family`,
  `category_id`, `product_type`, `is_featured`, `sort_order`.
- **It writes nothing.** The feed is read-only.
- **Merchant Center is untouched** — no data source registered, so Google is
  not fetching it. Live exposure is zero.
- `feedController.js` deliberately ignores the DB column, which is what
  insulated the feed from the bad stored data in the first place.
- **Rule 14 satisfied** — the query ran against the real database; the live
  feed returned 5,873 items.
- Rule 9 satisfied (file headers, commented decisions). No new top-level
  document was created.

#### 20d. The surgical unwind — scope only, NOT APPROVED, nothing built

One change: **collapse two maps into one.** Not a revert of `4f03b4a`.

The verified ids and 27-type coverage move into whichever file is chosen as
the single home; the other is deleted and its consumer re-pointed. The map
has always lived in `seoDefaults.js` and has been corrected there twice, so
that is the more faithful home — **but it is Sam's call, and he has not made
it.**

Still open and NOT decided, do not assume:

1. **Which file holds the one map.**
2. **Whether `google_product_category` becomes a derived cache** (admin field
   read-only, recomputed every sync) **or stays hand-editable with a gate that
   fails on drift.** Asked; not answered.
3. **The backfill.** 6,059 rows hold invalid values. Separately: both writers
   are first-write-wins — `seoDefaults.js:88` only fills when empty, and
   `importJamesMartinFeed.js:288` is
   `COALESCE(google_product_category, VALUES(...))`, which **keeps the existing
   value forever**. So correcting the map alone fixes nothing already stored.
4. **A gate that fails when a second map appears**, so this cannot recur
   silently. Proposed, not approved.

#### 20e. Data facts measured 2026-09-30, reuse rather than re-derive

From dump `u222311468_BVO_website.20260929174558.sql`:

- 6,059 active products. Feed includes **5,873**; skips 172 (no
  `product_type`, all James Martin), 11 (no https image), 3 (`Sample`).
- `google_product_category` populated on 5,035 rows — **every value invalid**,
  i.e. absent from Google's taxonomy, not merely a poor choice. Stored
  `Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities`; the real
  path is `Furniture > Cabinets & Storage > Vanities > Bathroom Vanities` (2081).
  Stored `Home & Garden > Kitchen & Dining > Kitchen Fixtures > Countertops`;
  real is `Hardware > Building Materials > Countertops` (2729).
- Incoherent as well as invalid: **2,958 vanities carry the Countertops value,
  1,241 identical products carry the Vanities one.** All created 2026-07, all
  `source_flag = manual`. The current map sends vanities to Vanities, so the
  Countertops value cannot have come from it — the reading that fits is that
  these were typed differently at first import, the category was written once,
  and when `product_type` was corrected later the frozen category never moved.
  **Inference from the write semantics, not proven from the dump.**
- **900 active products have a `product_type` absent from `GMC_CATEGORY_MAP`**
  and therefore load NULL: Shower Fixtures 376, Bathroom Faucets 149, Kitchen
  Faucets 84, Bathroom Accessories 72, Tub Fillers 55, Storage Cabinet 37,
  Countertop Unit 32, Plumbing Accessories 27, Knobs & Legs 21, Hutch 15,
  Metal Base 13, Drawer Unit 5, Side Cabinet 4, Sample 3, Bar Faucets 3,
  Bench 2, Laundry Faucets 2. The map also holds four dead keys matching no
  live type: `vanity cabinet`, `medicine cabinet`, `light`, `accessory`.
- Identifier coverage is excellent and is **not** a problem: 5,959 twelve-digit
  UPCs, **all** passing the GS1 check digit; six 11-digit values that are all
  valid once a leading zero is restored; one row with the literal text
  `Stone Sample - Grey Expo Quart` in the `upc` column (sku `SS-GEX2`).
  Only 6 products have neither a usable gtin nor an mpn.

#### 20f. STALE DOCUMENT — a question for Sam, not a fix (CLAUDE.md rule 4)

`docs/architecture/BVO_MODEL_BRAND_KEY_BRIEF.md` §5.9 states ER Vanities'
three `product_type` values are **Vanity, Bridge Unit, Linen Tower**, and that
`google_product_category` was set explicitly on all 78 rows because none were
in the map.

The live database says those 78 rows are now **Single Sink Cabinet Only (59),
Double Sink Cabinet Only (14), Side Cabinet (4), Linen Cabinet (1)** — ER was
retyped to canonical values after that brief was written. The brief's *warning*
still stands; its *facts* are overtaken.

Consequence, confirmed: all 78 ER products have a mapped type and **are** in
the feed. The failure the brief feared did not occur.

Surfaced, not corrected, per CLAUDE.md §"ARTIFACTS OF RECORD" rule 4.

#### 20h. Huntington Brass — safe today, but new SKUs will load NULL

Checked 2026-09-30, after the backfill, because the earlier finding that
`importHuntingtonBrass.js` never writes `google_product_category` needed to be
turned into a precise answer rather than a worry.

**Existing HB rows are safe.** The importer uses
`INSERT ... ON DUPLICATE KEY UPDATE` with an explicit column list —
`category_id, product_type, sku, slug, name, model, brand, short_desc,
long_desc, price, compare_price, color, color_family, upc, weight_lbs,
width_in, depth_in, height_in, primary_image_url, source_flag, is_active` —
and `google_product_category` is in neither the insert list nor the update
list. A re-import therefore leaves the backfilled value alone. All 768 HB
products now hold a correct id and will keep it.

**New HB SKUs are not safe.** A first insert supplies no value, so the column
defaults to NULL and nothing ever fills it — `applyGmcDefaults()` is never
called by this importer. Every genuinely new Huntington Brass product will be
absent a category until someone opens it in the admin or re-runs the backfill.

**RESOLVED OPERATIONALLY 2026-09-30 — no code change.** Huntington Brass has
no automated uploader. Every HB load is a deliberate manual act, so the answer
is to re-run `migrations/gmc_backfill_2026-09-30/3_update.sql` afterwards. It
is idempotent, takes under a second, and carries no code risk. Fixing the
importer was the alternative and was rejected as disproportionate for a job
that runs by hand a few times a year.

**Which load routes fill the category and which do not** — checked, because
"the importer doesn't do it" turned out to understate the problem:

| route | fills `google_product_category`? |
|---|---|
| Single product via the admin form | **yes** — `adminController:544/593` → `_extractProductFields` → `applyGmcDefaults` |
| Admin **CSV import** | **no** — reads a `google_product_category` column straight off the CSV (`adminController:1131`); blank if the column is absent |
| `importHuntingtonBrass.js --sql` → phpMyAdmin | **no** — the column is in neither the INSERT list nor the ON DUPLICATE list |
| `importJamesMartinFeed.js` nightly | yes, but only when the field is empty |

So the CSV bulk import bypasses `applyGmcDefaults` as well. Only the
single-product form actually derives it. **Anyone adding a brand should assume
the category will be NULL and re-run the backfill**, which is Playbook Trap 13
restated — that trap was written before either of these two routes existed and
is still correct.

**NOT closed, for whoever revisits this:** making the CSV import and the brand
importers share `applyGmcDefaults` would remove the manual step entirely. It
pulls in the other seven fields that function sets (`google_condition`, `mpn`
from `vendor_sku`, `identifier_exists`, `shipping_label`, `custom_label_0–4`),
which is probably desirable and definitely larger than it looks. Not assessed,
not proposed.

#### 20g. Housekeeping still owed on `4f03b4a`

- `docs/history/CHANGE_LOG_BRIEF.md` — no entry for the feed. Owed.
- `node docs/00-start/reindex.js` — not run after adding
  `feedController.js`, `googleProductCategory.js`, `gate_gmc_feed.js`.
- `docs/00-start/VERIFY_QUEUE.md` — the feed is pushed and live but not yet
  seen working by Sam beyond the counts; belongs there.

---

## Cutover — completed 2026-09-30 ~02:00, verified

Recorded so nobody re-checks these. All confirmed live on the day.

| item | result |
|---|---|
| DNS | A `@` → 82.25.87.178, CNAME `www` → apex, both TTL 600, propagated |
| DNS method | **Connect via DNS records**, NOT nameservers — mail, Brevo, and the `images` → `bvo-zone.b-cdn.net` CNAME all live in the GoDaddy zone and would have been lost |
| TLS | Hostinger Lifetime SSL, Active, covers apex + www. No CAA record, so issuance was unblocked |
| robots.txt | `Allow: /` on www with sitemap; `Disallow: /` on apex |
| Sitemap | submitted to the **Domain property** `sc-domain:bathroomvanitiesoutlet.com` (the URL-prefix property is apex-only and would not cover www) |
| Stripe webhook | endpoint **edited** to `https://www.bathroomvanitiesoutlet.com/checkout/webhook` — editing preserves the signing secret, so no env change and no restart. 7 events intact |
| Bunny | origin type is **Storage Zone `bvo-images`**, not a pull zone over a URL — cutover could not affect it. 50/50 images verified loading on the live domain |
| CDN purge | **deliberately skipped.** Bunny serves only `/images` from its own storage; nothing changed. Purging would cost a re-fetch and zero the 57% cache HIT for no benefit |
| Old Shopify URLs | spot-checked, one hop, 200 at destination |

**Correction worth carrying forward:** the working assumption that
`images.bathroomvanitiesoutlet.com` is a pull zone over vendor masters,
with nothing writable, was **wrong** — it is a Bunny Storage Zone. That
assumption drove the decision to do card framing in CSS rather than
regenerating images. The CSS framing shipped, is gated and measured well,
and is not being reopened — but the constraint as stated was false and
should not be relied on for future decisions.

**Do not cancel or downgrade the Shopify store yet.** Its Google &
YouTube app is the only thing currently feeding Google Merchant Center.
Order must be: build a replacement feed → verify in GMC → disconnect the
Shopify app → cancel Shopify. No ad spend is running, so there is no
clock, but doing it out of order loses the listings.

---

## Resolved

### Homepage CLS — hero, tablet band, and image-with-text
*Logged 2026-09-23 · resolved 2026-09-24 · commits `45ff9c9` `bfde140`
`248e048` `126b638d` `50b9325` `e112e55` `56ab5fb`*

CLS 0.321 → **0** on PageSpeed mobile; performance 89-90 → **99**.

Three separate defects, one shape: a box nothing was holding.

- **Hero ≤480 and 481-860.** The stacked layout sets
  `grid-template-rows:auto auto`, and `auto` is zero until the image resolves.
  Reserving space on `.hero-image` could never hold `.hero-content` down —
  the ROW had to be sized. Each band now takes an explicit height from the
  shape of the file it actually shows (`927/1160` phone, `927/1604` tablet),
  the second verified against measurements at five widths.
- **Image with Text.** A hardcoded `380x285` asserted 4:3 for a 1:1 logo, and
  the alignment control reached the text column only — `.iwt-img` is a block
  box, which ignores `text-align` and answers only to auto margins.

Full arithmetic and the wrong turns: `CHANGE_LOG_BRIEF.md`, 2026-09-23→24.

**Standing lesson.** Warm-cache verification is worthless for a reserved-box
bug: with the image loaded the box is correct whether or not the rule works.
Two fixes shipped on that false check before it was caught.

### Typography served Lora + Lato while the owner believed it was system fonts
*Resolved 2026-09-24 · commits `4f7da63` `d7d5f5c` `117afb9`*

Sam had made this decision before; it came undone because **it was never
written down**, and a search of the whole docs tree confirmed no typography
decision existed anywhere.

Now Georgia + System UI, no webfonts, and no option that could reintroduce
one: `src/utils/fontStacks.js` holds the entire allow-list, and `resolve()`
enforces it at render time rather than at the dropdown, because settings also
arrive from `theme_settings.json` and the DB without passing through the form.

Rationale, the 2020 cache-partitioning reason, the measured side-by-side and
the procedure for adding a face: **`docs/briefs/BVO_TYPOGRAPHY_DECISION.md`**,
linked from `INDEX.md`.


### Mobile hero alignment had two settings and neither worked
*Logged and resolved 2026-09-23 · commit `cb8c24c`*

Two Theme Editor controls governed one fact, and the pair produced a visible
split. Measured on the live page at 375px before the fix:

```
.hero-content   text-align:      left
.hero-ctas      justify-content: center
```

Copy left, buttons centred, on every phone. Each control was half-broken:

- **`hero.text_align_mobile`** wrote `--hero-mobile-align` onto `.hero`, read
  by `.hero{text-align:…!important}` at ≤860. `.hero-ctas` is flex, and
  `text-align` does not move flex items — so it could never move the buttons.
- **`hero_mobile.text_align`** wrote `#hero-main .hero-content{text-align:…}`
  at ≤480 with no `!important`. `.hero-content` carries an **inline**
  `style="text-align:left"` from the desktop value, and inline beats any
  stylesheet rule that is not `!important` — so its text rule never applied.
  Its sibling CTA rule *did* apply, because `.hero-ctas` has no inline style.
  That asymmetry is the whole bug.

Kept `hero_mobile.text_align`: it moves the CTA row as well as the copy, its
control is the three-button `teAlignment()` group rather than a bare select,
and it sits in the Mobile Hero panel with the other mobile settings. Carried
over the only advantages the retired one had — the band is now ≤860 rather
than ≤480, and the rule sits outside the `_hmEna` gate so it still applies
with the mobile hero disabled.

Verified live at four widths after deploy; headline, `.hero-rule` divider and
CTA row share a centre to the pixel at 375/500/800, and desktop at 1280 is
unchanged.

`.hero-rule` needed no code: already `display:inline-block` inside
`.hero-content`, already `var(--hero-eyebrow, var(--color-sage,#5a7a5a))`, so
it follows both the alignment and the colour setting for free.

### Footer rendered every link twice
*Found and fixed 2026-09-13 · migration 027*

All three footer columns showed each link doubled — Bathroom Vanities,
Bathroom Vanities, Mirrors, Mirrors. Spotted by Sam looking at a live
collections page.

**Cause.** Migration 015 seeds the footer items with `INSERT IGNORE`, which
only suppresses a UNIQUE KEY violation. `nav_menu_items` had no unique key —
`PRIMARY KEY (id)` and a non-unique `idx_menu_items_sort` — so there was
nothing to violate and the insert ran unconditionally. 015 ran twice, ids
15-24 then 25-34. `nav_menus` escaped because it has `UNIQUE KEY handle`;
the difference between the two tables is the entire bug.

**Fix.** Deleted the copies keeping the lowest id per (menu_id, label, url),
then added `UNIQUE KEY uniq_menu_item`. The order is the verification: with
the constraint added second, a failed dedupe errors with #1062 rather than
succeeding on bad data. 015 is now genuinely idempotent.

`main-menu` was checked in the same pass and is clean.

**Why the audit missed it.** `AUDIT_2026-09-11.md` collected links into a
`Set` before status-checking them, so two identical links collapsed to one
entry and the report said "one broken link in 192" — true, and blind to
duplication by construction. The 375px pass measured tap targets, font sizes
and overflow, all numeric properties, and never compared content for
repetition.

**The gap to close in any future audit:** check the page for sense, not only
for validity. Duplicate links, repeated blocks and wrong-but-working content
are invisible to a crawler that deduplicates and to a DOM pass that only
measures. Look at the rendered page.

**Fourth instance of the same anti-pattern** — a guard that cannot fail is
not a guard. Migration 021, the information_schema verify in 023, a gate
written on 2026-09-12, and now `INSERT IGNORE` without a unique key.

### §8 — `demand_score` now carries Estimated Combo Demand
*Logged and resolved 2026-09-12 · commit `a16d40b` + migration 026*

Storefront popularity ranked 4,212 vanities on `min(base, top)` clamp
artifacts. Verified on production after the rollup ran:

| | before | after |
|---|---|---|
| combos scored | 3,552 | 3,560 |
| min score | 1.00 | **0.01** |
| max score | 125.00 | **11.01** |
| vanity total | 33,288.00 | **1,156.64** |
| vanity : cabinet | 38 : 1 | **0.95 : 1** |

`min 0.01` proves the DECIMAL migration took — those are the 92% that would
have truncated to zero on the old int column. `max 11.01` is the Marcello 36
Chestnut figure the admin report shows, so the storefront and the leaderboard
are reading the same number, which is what extracting the estimator bought.
The 62-unit shortfall against Cabinet is bases whose demand never reached a
combo — expected residual, not a leak.

Three parts shipped: `src/services/comboDemandEstimator.js` (extracted
byte-identically, proven against `test/fixtures/`), the controller importing
it, and the rollup zeroing vanities before applying estimates.

**Two things learned the hard way, recorded so they are not relearned:**

- The rollup is **not** called from `server.js` startup. Restarting does
  nothing; node-cron fires it at 05:30 UTC, and `jmv_rollup.sh` is the
  duplicate belt-and-braces path.
- The app DB user has **no grant on `information_schema`** — `#1044`. Use
  `SHOW COLUMNS` / `SHOW INDEX`. phpMyAdmin reports the denial against the
  *next* statement, which makes an `ALTER` look refused when the verify
  `SELECT` above it was the failure. Second time this database has punished
  `information_schema`; migration 023 hit a different version of it.

### Two `ORDER BY` clauses lacked a unique final key — §6
*Logged and resolved 2026-09-12 · commit `10a48f7`*

`homeController:124` ended in `p.created_at DESC` and `:375` in `COUNT(*) DESC`
— neither unique, so equal-scored rows could come back in any order and
paginated pages duplicate or skip. Added `p.sku ASC` and `p.model, p.brand`
respectively. `collectionsController:400` already complied.

Exact ties are the expected output here, not an edge case: combos differing
only by faucet drilling score identically on purpose.

### Rule 2 named the wrong collection, and named one at all
*Logged and resolved 2026-09-12 · commits `36a9edd`, `88725dc`*

§4 Rule 2 read `IN ('Gracyn','Kinnsden','Allamari')`. Kinnsden's cabinets are
23.13" and it has never used a Radius Cut top; the RC collection is **Lucian**.
The error pruned Lucian's 53 RC combos out of the estimator.

Replaced the list with the rule behind it — cabinets at `21" ≤ depth < 22"` —
which returns the same three and picks up a fourth automatically. Remaining
risk is logged as open item 1.

### Warranty haircut — checked, no change needed
*Checked 2026-09-12 · no commit*

§3a's 50% per-size backout is **share-neutral by construction**: every top in a
base's offer set is the same size and takes the same factor, which cancels out
of the share calculation. Measured largest per-combo difference with vs without:
**0.0000000000**. It does its work on revenue and reported top units
(2,714 → 1,773 units, −21.6% MAP revenue), not on combo ranking. Nothing to fix.

### Brittany ranking anomaly — not a bug
*Checked 2026-09-12 · no commit*

Brittany leads Collection Demand but its best SKU sits at #11, while low-demand
De Soto places at #2. Cause is the denominator: Brittany spreads 155 units
across **53 cabinet SKUs** (3.3 each); Marcello concentrates 44 units into
**3** (14.7 each). The collection chart and the SKU table answer different
questions, and a collection with deep finish choice is structurally penalised
in the second. Both figures are correct.

*(Flagged, not actioned: the two panels sit adjacent and invite the comparison.
A variant-count or per-SKU column on the SKU table would make it
self-explanatory.)*

---

## Added 2026-09-28 — from the verification rework

### Small copy/design fixes to the new-device email (owner-raised, deferred)
Owner, 2026-09-28, on seeing the live "New sign-in to your BVO account"
message:

1. **Add the BVO logo** to the new-device email so the reader is
   reminded who it is from. Every other BVO email carries branding; this
   one is plain text on white and looks least like us at the exact
   moment the reader is being asked to judge whether it is genuine.
2. **"That link works for 24 hours." → "This link works for 24 hours."**

Both live in `newDeviceEmail()` in `src/controllers/accountController.js`
— in code, not in `email_templates`, deliberately: a SECURITY
notification that silently fails to send because a database row is
missing is worse than one that is slightly out of date. Editing it means
a deploy, which is the accepted cost.

Explicitly deferred by the owner: *"Log this for future scope not now."*

### Change-email flow — not built, and now the main gap in identity
Orders hang off `customer_id`, not the email string, so history survives
an address change **provided the change is made on the existing row**.
Nothing today can do that. The risk is therefore not losing history but
**splitting** it: a buyer who moves to a new address and simply checks
out with it gets a second customer row via `findOrCreateByEmail`, and
their history is orphaned under an id nobody looks at.

Needs, roughly in order:
- Self-service change from inside the account — code to the OLD address,
  then a code to the NEW one. Both proven, one row updated.
- An **admin** path for the common case of having lost the old mailbox,
  verified the way the order-verification call already verifies people
  (order number, ship-to, last four).
- **Merge**, not rename, when the new address already exists as its own
  customer: orders, addresses and devices move to one surviving id.
- On any change: `emailVerificationService.clearVerification()` (already
  written and waiting), revoke device cookies, kill live sessions, and
  write an audit row. An attacker who gets one address changed inherits a
  full order history, so this is a fraud-relevant action and needs a
  trail.

Optional early-warning, if the full flow stays unbuilt for long: flag
when a BRAND-NEW customer's shipping address matches an existing
customer's. `customer_addresses` and the velocity query already exist, so
it is small. Owner has not asked for it.

### Brevo deliverability — CLOSED 2026-09-28, no follow-up
> **Owner, same day: "all the other emails we received today were within
> 2 minutes."** Measured, not assumed — and it matches the Gmail
> greylisting explanation exactly. A sender Gmail does not recognise gets
> deferred; once it has seen a few messages accepted, delivery is normal.
> The eleven-minute case was first-contact, not a broken channel.
>
> **No action.** Checkout no longer depends on delivery either way, which
> was the point of the rework. Re-open only if delivery times regress
> after cutover, when the sending domain changes and reputation resets.
>
> The detail below is kept because that reset is a real possibility.

#### Original note — why it looked like a standing problem
The 2026-09-28 work removed checkout's dependence on email delivery. It
did **not** fix delivery. Measured that day: a code accepted at 11:59 and
delivered at 12:10 — eleven minutes — and a second still unsent after
thirteen. DKIM and DMARC both pass, so there is nothing to fix in DNS;
this is sender reputation plus Brevo's free-tier **shared IP**, where
transactional mail sits alongside other senders' marketing.

Order confirmations, delivery notices and carrier appointments all ride
the same channel, so this still matters — it is just no longer able to
cost a sale at checkout. Options: let volume build reputation, or move
transactional mail to a transactional-only provider (Postmark or SES).
Not a decision to take under time pressure.

### Brevo event log on the diagnostics page — proposed, not approved
`GET /v3/smtp/statistics/events?email=…` returns per-message `requests`,
`delivered`, `softBounce`, `hardBounce`, `blocked`, `spam`, `deferred`.
Its absence is why 2026-09-28 cost four rounds of wrong theories — API
key, blocklist, credits — before the Brevo UI showed the answer in one
screen. A read-only section 6 on `/admin/diagnostics/email` would answer
this whole class of question in one click. Offered; owner did not take it
up.

### email_templates in the repo no longer match production — 2026-09-28
`database/migrations/016_email_templates.sql` is **stale**. The live
`order_confirmed` body is 3,842 characters; the copy in `016_` is roughly
three times that. The templates were rewritten in the BVO-voice pass and
that rewrite was never captured back into a migration file.

This is not cosmetic. It cost a real defect on 2026-09-28: the migration
adding the Confirm-your-email button anchored its `REPLACE` on markup
copied from `016_`, matched nothing, and reported "0 rows affected". Had
the verification `SELECT` not been there, the button would have shipped
looking built and done nothing in every order confirmation.

Two things follow:
- **Do not read `016_` to find out what an email says.** Read the
  `email_templates` table, or the admin editor at
  `/admin/email-templates`.
- **Anchor template edits on the smallest unambiguous fragment** — a
  `{{variable}}` and its immediately enclosing tag — never on `style`
  attributes, which are the first thing a copy rewrite changes.

Fix, when someone has an hour: dump the nine live bodies into a dated
migration so the repo has a truthful record again, and add a note at the
top of `016_` saying it is history, not current state.

### INFORMATION_SCHEMA — phpMyAdmin only. CLOSED, no action.
The `#1044 Access denied … to database 'information_schema'` seen on
2026-09-28 applies to the **phpMyAdmin user** (`u222311468_Admin1`), not
to the application's database user.

Verified by loading `/admin/models`, which calls
`INFORMATION_SCHEMA.COLUMNS` and `INFORMATION_SCHEMA.STATISTICS` on
every request inside `_ensureModelGroupsTable()`. The page renders
correctly — 45 models, 10 managed, brand column populated — so the
self-heal has been working throughout.

**No code change needed.** The rule is narrower than it first looked:
avoid `INFORMATION_SCHEMA` in **migrations**, because those run through
phpMyAdmin and a denial there aborts the rest of the file silently. Use
`SHOW COLUMNS` / `SHOW INDEX` / `SHOW TABLE STATUS` in `.sql` files.
Application code may continue to use it.

### The schema is split across two collations — 2026-09-28
**MEASURED, not guessed** — `SHOW TABLE STATUS`, 2026-09-28:

| table                | collation               |
|----------------------|-------------------------|
| customers            | `utf8mb4_unicode_ci`    |
| orders               | `utf8mb4_unicode_ci`    |
| customer_addresses   | `utf8mb4_unicode_ci`    |
| customer_devices     | `utf8mb4_unicode_ci`    |
| **customer_auth_codes** | **`utf8mb4_uca1400_ai_ci`** |

**Exactly one table is out of step.** An earlier version of this note
claimed `customer_addresses` and `customer_devices` were "likely"
affected too. That was an assumption and it was wrong: both name their
collation explicitly in their `CREATE TABLE`, so they inherited nothing.
`customer_auth_codes` (2026-09-27) did not, and so took the MariaDB 11
server default.

The lesson for any new table here: **name the collation explicitly**.
The server default is not what the rest of this schema uses.

Comparing a text column across that line raises:

    #1267 - Illegal mix of collations
            (utf8mb4_uca1400_ai_ci,IMPLICIT) and
            (utf8mb4_unicode_ci,IMPLICIT) for operation '='

**Why nothing has broken yet, and why that is not reassuring.** Every
cross-table link in the app today is on `customer_id`, an integer. Every
single-table filter compares a column to a bound parameter, and a
parameter adopts the column's collation. So the clash is invisible until
someone writes the first text join across the two eras — which the
verification backfill was, and it failed on the spot.

The next one will fail the same way, at runtime, in a place nobody
expects, with an error that does not obviously name its cause.

Two ways out:
- **Workaround, in place now:** name the collation explicitly on one
  side of the comparison (`a.email = c.email COLLATE utf8mb4_unicode_ci`).
  EXPLICIT beats IMPLICIT, so one side settles it. Has to be remembered
  every single time.
- **Real fix, not yet approved:** ONE statement, because only one table
  is wrong —

      ALTER TABLE customer_auth_codes
        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

  Nine rows, sub-second, and the whole class of `#1267` leaves the
  schema. The `COLLATE` already written into the verification backfill
  stays regardless: it is harmless once both sides agree, and it records
  why it was ever needed.

Check current state with `SHOW TABLE STATUS` and read the `Collation`
column. Do NOT use `information_schema.TABLES`: this host denies that
database outright (#1044).

---

# POST-CUTOVER
*Owner-scoped 2026-09-28. Everything below is deliberately NOT blocking the
launch. It is here so it is not lost, not so it is done first.*

## Email templates — polish, not repair
**Owner: "These are good enough for now. They are basic and lack the warmness
and cheeriness of our brand, but functional. We can tweak after cutover."**

This was previously listed as THE cutover blocker. It is not. The templates
send, carry the right variables, and say true things. What they lack is voice.

When it is picked up, three things belong in one pass:

1. **Rewrite the nine bodies in BVO voice.** Warm and cheery, matching the
   brand rather than the neutral functional register they sit in now.
2. **The new-device email gets the BVO logo** (owner-raised 2026-09-28).
   Every other BVO email carries branding; that one is plain text on white,
   and it looks least like us at the exact moment the reader is deciding
   whether it is genuine. It lives in `newDeviceEmail()` in
   `accountController.js` — in code, not `email_templates`, deliberately: a
   SECURITY notification that silently fails because a database row is
   missing is worse than one slightly out of date. Editing it means a
   deploy; that is the accepted cost.
3. **"That link works for 24 hours." → "This link works for 24 hours."**
   Same file, same pass.

**Read the LIVE TABLE, not `016_email_templates.sql`.** The repo's copy is
stale — the live `order_confirmed` body is 3,842 characters against roughly
three times that in `016_`. Trusting the file cost a silent defect on
2026-09-28 (see the email_templates entry above). Dump the nine live bodies
into a dated migration as part of this work so the repo tells the truth again.

## Change-email flow
Moved here 2026-09-28 — **owner: "Email flow is a trivial issue."**

Full detail in the entry above. In short: orders hang off `customer_id`, so
history survives an address change *provided the change is made on the
existing row* — and nothing today can do that. The risk is a SPLIT, not a
loss: a buyer who moves and simply checks out gets a second customer record,
and their history is orphaned under an id nobody looks at.

Trivial while the customer base is small, which is the case now. It gets
harder to unpick the longer it runs, so it is worth doing early post-cutover
rather than late.

## Cart merge — F2 and F3 from the checkout audit
Not payment code. `src/controllers/cartController.js` only.

> ### MEASURED 2026-09-28, not inferred
> Owner asked whether this had already been fixed. It has not. The real
> `cartController.add` was driven with a stubbed price lookup — the
> exported handler, not a re-implementation:
>
> ```
> A. bundle first, then the SAME item standalone
>    product 5  qty=2  disc=10%  bundle_id=b1    subtotal $1800
>    correct: 1 @10% off + 1 @full             = $1900
>
> B. standalone first, then via the bundle
>    product 5  qty=2  disc=0%   bundle_id=null  subtotal $2000
>    correct: 1 @full + 1 @10% off             = $1900
>
> three consecutive adds of qty 99 -> qty 297   (cap is 99)
> ```
>
> ### SCALE — corrected by the owner, and it is much smaller than first written
> `bundle-builder.ejs:390` — `ITEM_DISC = { cabinet: 0, top: 5,
> mirror: 10, faucet: 15 }`. **The cabinet is always added at 0%.**
>
> So the VANITY — the item a buyer is most likely to also add from its own
> product page — cannot leak in either direction: merging 0% with 0% is
> 0%. Exposure exists only on a top, mirror or faucet added both inside a
> bundle and separately, i.e. 5–15% of a $200–600 accessory. Single-digit
> to low-double-digit dollars, not the ~$100 an earlier draft of this note
> claimed by wrongly assuming a discounted vanity.
>
> Still a real defect, still worth fixing, but firmly post-cutover.
>
> **Why it looked solved.** Bundle-discount work WAS done, just not here:
> `stripBundleGroup()` reverts a whole group to sale price when any
> bundle item is removed, and the September round fixed FormData →
> URLSearchParams, the NaN/poisoned-entry guards and the
> `productId`/`product_id` mismatch. The REMOVAL path and the
> data-integrity path are both sound. The MERGE path was never touched.

- **F2** — the merge branch reconciles neither `bundle_discount_pct` nor
  `bundle_id`, and matches on `product_id` alone. Bundle first then the same
  item standalone → extra units inherit the discount (revenue leak). Standalone
  first then via bundle → the customer silently loses their bundle discount.
- **F3** — the first add clamps qty to 99; the merge branch is a bare
  `existing.qty += qty`, so repeated adds walk past the cap.

Small, self-contained, gateable. No longer blocked by anything.

## Analytics and measurement — set up AFTER the URL migration
Raised by the owner 2026-09-28, and deliberately deferred by them:
**"most of this is needing to be set up after url migration as we do not need
it set up for the temp url we are working with anyways."**

That is the right call and it is not merely a scheduling preference. GA4
property and data-stream configuration, Search Console verification, ad
platform tags and any consent tooling are all keyed to a HOSTNAME. Anything
configured against `slategrey-falcon-350174.hostingersite.com` has to be
redone against `www.bathroomvanitiesoutlet.com`, and the test traffic
recorded in the meantime pollutes the first weeks of real data — which is
exactly the baseline the launch will be judged on.

### What is capturing data today (audited 2026-09-28)

| | Status |
|---|---|
| GA4 | Live — property `G-PLBNP2YD9K`, via `gtag.js` in `views/layouts/main.ejs` |
| GTM | Supported but NOT configured — `GTM_ID` env var is empty, no container |
| Enhanced measurement | Default only: page_view, scroll, outbound click, site search, file download |
| Ecommerce events | **NONE.** The only `dataLayer.push` in the codebase is the gtag shim |
| First-party analytics tables | **NONE.** No page_views, no product-view log, no search-term log |
| Sessions | `sessions` table (MySQL store), 7-day expiry, httpOnly + sameSite=lax + secure in prod |
| Session contents | Functional only — cart, checkoutDraft, customerId, flash, isAdmin. No visit trail |
| Cookies set | `_ga`, `_ga_PLBNP2YD9K`, `__stripe_mid` |
| Consent banner | **NONE.** Cookies drop on first load, unconditionally |

Orders are the ONLY behavioural record the business owns. Everything else
lives in Google's property and can be lost with the account.

### The work, when it is picked up

1. **GA4 ecommerce events** — `view_item`, `add_to_cart`, `begin_checkout`,
   `purchase`. Without `purchase` there is no conversion rate, no revenue
   attribution, and no way to tell which channel produced a sale. On this
   AOV that is the item with real money attached. Cannot be backfilled:
   every day without it is a day of unattributable traffic.
2. **Point GA4 and Search Console at the live hostname**, and re-verify.
3. **Consider a first-party event table.** GA4 is sampled, aggregated and
   not yours. A narrow own-table (product views, searches with zero results,
   cart adds) is cheap and survives losing the Google account. Zero-result
   searches in particular are a direct catalogue-gap signal.
4. **Cookie consent.** GA4 and Stripe cookies drop before any consent today.
   Defensible for US-only traffic under most readings; not for EU/UK, and
   California has its own rules. Decide deliberately rather than by default.
5. **~~Know the GA4 loading trade.~~ RESOLVED 2026-09-30 — the loader is
   gone and the under-reporting with it.** It read: *"`gtag.js` is fetched
   on first interaction or 3 seconds, whichever comes first — a deliberate
   choice made 2026-09-22 worth ~250ms of LCP on throttled mobile. The
   cost: a visitor who leaves inside 3s without touching anything is never
   counted. Sessions will under-report and bounce rate will read better
   than reality."*

   **gtag now loads with the page (commit `9eeebef`), so sessions no longer
   under-report and the bounce-rate caveat is void.** Clarity went eager
   first, on `f89af87`, for an unrelated reason.

   **The 250ms was re-measured and is gone.** PageSpeed Insights, mobile,
   same URL, ~10 minutes apart either side of the deploy:

   | | deferred (5:12pm) | eager (5:23pm) | Δ |
   |---|---|---|---|
   | Performance | 99 | 99 | — |
   | **LCP** | **2.1 s** | **2.0 s** | **none** |
   | FCP | 1.2 s | 1.2 s | — |
   | **TBT** | **20 ms** | **60 ms** | **+40 ms** |
   | CLS | 0 | 0 | — |
   | Speed Index | 1.3 s | 1.2 s | — |

   LCP did not move. The bandwidth contention the loader was built to avoid
   was removed by other work since 2026-09-22 — site-bundle.css, the capped
   hero srcset, the dropped 1x1 placeholders, Google Fonts removed, the
   ResizeObserver rewrite. TBT tripling 20→60ms is the one genuine cost and
   is where gtag's parse/execute now lands; in absolute terms it is 40ms
   against a 200ms "good" threshold.

   **Read this table with two caveats.** Single runs, not medians — treat
   the ±0.1s movements as noise, not as improvements. And Lighthouse keeps
   the page alive past 3 seconds, so the 3s fallback almost certainly fired
   inside the *deferred* run too: the baseline was never a gtag-free page,
   which is part of why the delta is this small.

   If the cost ever needs paying again, the full loader is intact at
   `f89af87` and `gate_analytics_tags.js` will fail until sections 2 and 4
   are updated to match — deliberately, so the decision has to be explicit
   and re-recorded here rather than drifting back in unmeasured.

## Captured 2026-10-02 — sitechecker.pro findings, for a later SEO/perf scope

Parked deliberately: Sam asked to capture, not act, so the current
anchor-text scope kept its focus. Nothing below has been changed.

**READ THE VERIFICATION COLUMN BEFORE PLANNING WORK FROM THIS.** Three of
the four site-wide claims did not reproduce when checked against the live
site. Taking the report at face value would mean a scope spent "fixing"
things that are not broken.

| Claim | Verified 2026-10-02 | Status |
|---|---|---|
| HTML size 4.87 MB | Homepage HTML is **210,612 bytes (0.20 MB)** | **Does not reproduce** — 24x out |
| Error page returns 200 (soft 404) | A missing path returns **404** | **Does not reproduce** |
| /index.html and /index.php accessible as separate pages | Both return **404** | **Does not reproduce** |
| www and non-www work as separate sites | Navigated to `https://bathroomvanitiesoutlet.com/collections/bathroom-mirrors` and landed on `https://www.bathroomvanitiesoutlet.com/collections/bathroom-mirrors` — path preserved, one hop, canonical agrees | **Does not reproduce** |

SETTLED 2026-10-02. The apex redirect works and `gate_canonical_redirect`
is asserting real behaviour, not just source code.

A caution for whoever checks this next: Chrome hides `https://` and `www.`
in the address bar until you click into it, so "I typed the apex and the
page loaded" proves nothing on its own — it looks identical whether the
redirect fired or the apex served its own copy. Navigate and read
`location.host`, or watch the address bar after focusing it.

ALL FOUR of this tool's site-wide claims failed to reproduce. It found one
real defect (the /pages/about dead button, fixed 2026-10-02) and four false
alarms. Weight its output accordingly: verify before scoping work from it.

On the HTML-size figure: their wording is "all HTML code on the page,
except external JavaScript or external CSS". Measured directly, that is
0.20 MB, of which 7.4 KB inline CSS, 6.9 KB inline JS, 10.1 KB inline SVG
and 0 bytes of data: URIs. 4.87 MB is plausible only if they are measuring
total page weight including images, or a rendered DOM snapshot rather than
the served HTML. Worth re-measuring with a known-good tool before anyone
sets a page-weight target from it.

### Findings that DID reproduce and are worth doing

- **`/pages/about` returns 404.** The "Our Story" button in the Image with
  Text section links to it. The real page is `/pages/about-us` (200). This
  is a dead button on the homepage. It is a Theme Editor field (Image with
  Text -> CTA URL), so it needs no deploy. **Highest value item here.**

- **Desktop PageSpeed 72.** Not investigated. A real number worth a scope
  of its own; see the GA4 table earlier in this file for how measurement
  on this site has to be read (single runs are noise).

- **3xx on `/account` and `/account/favorites`.** Expected — both redirect
  to the login page for a signed-out crawler. Not a defect, listed so a
  future reader does not re-investigate it.

### Anchor-text scope — CONCLUSION SUPERSEDED 2026-10-02

**The recommendation below was acted against, and the work succeeded. Read
the correction before the original.**

This section used to conclude: *"The homepage duplicate-anchor-text warning
is structural and I recommend leaving it … the only ways to remove it are to
build the mobile menu in JavaScript (so the nav does not exist for a crawler
that does not run scripts) or a substantial shared-markup rewrite. Both trade
something real for a report number."*

The shared-markup rewrite was done on 2026-10-02 (commit f683f51) and traded
nothing. It REMOVED JavaScript rather than adding it: <details>/<summary>
gives the mobile accordion natively, so the inline accordion script was
deleted and the header now carries no scripts at all. The nav is one markup
set, present for every crawler, working on touch where the hover-only
desktop trigger never did.

| | Before | After |
|---|---|---|
| Homepage anchors | 164 | 119 |
| Duplicate anchor-text groups | 27 | **0** |
| Same text, different pages | 0 | **0** |
| Links with no anchor text | 3 | **0** |

Confirmed independently by seobility's own re-crawl: the mirrored block at
their items #45-#75 is gone, and one "Text duplicate" marker remained, which
was then also removed.

**What the original got right, and is worth keeping:** the diagnosis. It
correctly identified the duplicated mobile menu as the cause of 25 of the 27
groups, from sitechecker's own link list, and it correctly identified
same-text-different-target as the only part of the guidance describing real
harm. Both held up. Only the cost estimate was wrong.

**The lesson:** "structural, leave it" is a conclusion with a shelf life, and
this one was written before anyone had checked how other storefronts solve
it. Shopify's Dawn theme uses <details>/<summary> for exactly this. Fifteen
minutes of looking at prior art changed the answer.

The three "small, cheap, not yet done" items it listed are all done: the
footer logo alt (cc748a9), the capitalisation mismatch (the drawer that
disagreed no longer exists), and the footer social links (14f82a4). The
remaining "Shop Now ->" vs "Shop Now" pair points at the same page, which is
the harmless case, and Sam has accepted it.

---

### Elsewhere, worse than anything on the homepage

- **`/lookbook`: "Learn More" x41 — ✅ FIXED 2026-10-02.** The link moved onto
  the model name, which is unique per card (verified live: 41 cards, 41
  distinct names, 41 distinct targets). "Learn More" is a span now. One
  wrinkle this entry did not anticipate: each card holds three interactive
  controls — two carousel arrows and two colour swatches — which sit under
  the .card-stretch overlay and had to be lifted with position+z-index, or
  they stop responding silently. gates/gate_lookbook_anchors.js asserts it.
- **`/collections/*`: "View Details — <product name>" x26.** Distinct, so no
  competition, but the keyword sits after "View Details".
- **Model card image alts** read "Brittany vanity", "Hudson vanity". For an
  image link the alt IS the anchor text, so that is the entire signal for
  those collection pages. Thin.

---

## Theme Editor — found 2026-10-02 while making the mega menu editable

### A. The Theme Editor publishes every keystroke to the LIVE site — SEVERE

**Reported by Sam:** "I noticed that it displays without me selecting save."

`views/pages/admin/theme.ejs`:

```js
form.addEventListener('input',  function () { markDirty(); schedulePreview(); });
form.addEventListener('change', function () { markDirty(); schedulePreview(); });
```

`schedulePreview()` debounces 650ms, then POSTs the whole form to
`/admin/theme/preview`. That route is not a preview:

```js
exports.themeSavePreview = (req, res) => {
  const settings = _buildSettingsFromBody(req.body);
  _persistSettings(settings);     // writes data/theme_settings.json AND the DB
  themeSettings.reload();         // clears the cache, so the PUBLIC site serves it
  req.session.tePreviewSettings = settings;
  res.json({ ok: true });
};
```

So 650ms after the admin stops typing, the half-finished value is live to
every visitor, and persisted to the database so a redeploy will not undo it.

**Confirmed in the wild, not theorised.** Sam re-added a deleted style link,
and `Coasta` — the word mid-typing — was served on the live homepage. The URL
beside it was complete, which is what ruled out a truncation bug in the
renderer and pointed here.

**Consequences**
- Shoppers see mid-word drafts in the navigation.
- The Save button does not control persistence. It is decorative for that.
- `markDirty()` shows an unsaved-changes state that is not true.
- Opening the editor to "look at options" mutates the live site.

**The correct mechanism ALREADY EXISTS and is defeated by one line.**
`src/server.js:510`:

```js
const isPreview = req.query.te_preview === '1' && req.session.isAdmin
                  && req.session.tePreviewSettings;
res.locals.settings = isPreview ? req.session.tePreviewSettings : themeSettings.get();
```

A session-scoped draft, visible only to the signed-in admin, in the preview
iframe. Exactly right. `_persistSettings()` on the line above makes it
redundant by writing globally first.

**Fix:** drop `_persistSettings(settings)` and `themeSettings.reload()` from
`themeSavePreview`, keeping only the session assignment.

**Why it needs gating both ways before anyone touches it.** The failure mode
of a careless fix is the mirror image and worse: if anything else depends on
the preview route persisting, Save silently stops working and edits are lost
on navigate-away. Assert BOTH directions:
1. typing into the form does NOT change `data/theme_settings.json`;
2. pressing Save DOES.
Mutation-test each. Check whether any other admin screen posts to
`/theme/preview` expecting it to persist before removing the call.

**Interim guidance for Sam:** treat the Theme Editor as live editing. Do not
browse it speculatively on the production site.

---

### B. The drag handles do nothing — Sam's request, 2026-10-02

Every array row in the Theme Editor renders `<span class="te4-array-drag">⠿</span>`.
It is decorative. There is no `draggable` attribute and no drag JS behind it.
Only the homepage section-order list (`te4-sec-draggable`, `draggable="true"`)
reorders for real.

Affects SIX lists, not just the mega menu:

| List | Panel |
|---|---|
| `nav.links` | Navigation (now points at Menu Manager) |
| `nav.vanities_mega.links` | Mega Menu — Shop By Type |
| `nav.vanities_mega.style_links` | Mega Menu — Shop By Style (added 2026-10-02) |
| `brand_logos.logos` | Brand Logos |
| `scrolling_ticker.items` | Announcement bar |
| `testimonials.items` | Testimonials |

Sam hit it on the mega menu: re-adding a deleted style link appends to the
end, and the obvious way to move it back does nothing.

Two of those six instances are mine — I copied the established row pattern
when building the Style Links panel rather than noticing the handle was inert.

**Two options, and the choice matters more than the work:**
1. **Wire it up.** One sortable implementation applied to `.te4-array-list`,
   renumbering the `[n]` field names on drop. The renumbering is the whole
   job — the field names carry the order, so a drop that moves DOM rows
   without rewriting indices changes nothing on save, which would look
   identical to the current bug.
2. **Remove the handle.** Honest immediately, costs nothing, and ordering
   stays a retype. Reasonable given order is cosmetic in all six lists —
   none of them carries SEO weight.

Do NOT do it for one list only. Six identical-looking grips where one works
is worse than six that all do nothing.

**Gate:** whichever way it goes, assert the handle and the behaviour agree —
either every `.te4-array-list` row is draggable with index renumbering on
drop, or no `te4-array-drag` span is rendered anywhere. The current state,
affordance without behaviour, is what the gate exists to forbid.

---

### C. Footer Facebook icon has no anchor text — small

`views/partials/footer.ejs`: inline SVG, `aria-label="Facebook"`, no text.
aria-label wins for the accessible name, so assistive tech is fine, but a
crawler reading anchor text sees an empty link.

Same shape as the three nav icons fixed in `cc748a9`, and the same fix: an
`.sr-only` span, dropping the aria-label (both cannot win — aria-label
overrides element contents).

NOT in seobility's "links without anchor text" count, because that list is
internal links only and this is external. Different warning class, which is
why it was left out of the 2026-10-02 commits rather than bundled in.

Also noted: Facebook is the only social link rendering. If Instagram or
Pinterest URLs are set in settings and not appearing, that is separate and
unverified.
