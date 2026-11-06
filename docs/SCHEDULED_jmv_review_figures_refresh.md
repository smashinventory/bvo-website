# Scheduled task — quarterly JMV review-figure refresh

Create this from the **Scheduled** section in the Claude sidebar. It could not be
created from a chat session: new scheduled tasks run in the cloud.

| Field | Value |
|---|---|
| **Title** | Quarterly — refresh the James Martin review figures |
| **Schedule** | `0 14 1 2,5,8,11 *` — 2pm on the 1st of Feb, May, Aug, Nov |
| **Description** | Re-check retailer review ratings for BVO's top James Martin collections so the cited figures on the site stay accurate. |

Monthly instead of quarterly: change the cron to `0 14 1 * *`. Quarterly was chosen
because the counts move slowly — Brittany 36" has 47 reviews and gains a handful a
year, so twelve checks would be eleven no-ops.

---

## Prompt — paste everything below this line

Quarterly refresh of the James Martin review figures cited on bathroomvanitiesoutlet.com.

### Why this exists

BVO cites aggregate review ratings for James Martin vanities as plain text on its own
pages — no outbound links, no logos, and NO structured-data markup. That is legal on
one condition: the numbers must be accurate and carry a date a human actually
verified. This task exists so that date never becomes a lie.

⚠️ THIS IS A LOW-VOLUME MANUAL CHECK, NOT A SCRAPER, AND THE DIFFERENCE IS THE POINT.
Open a handful of pages, four times a year, and hand the result to a human who decides
what to publish. Do NOT build, suggest, or run any automated or recurring harvester
against these retailers — their terms prohibit automated collection, and a daily job
would get the IP blocked and then silently publish stale numbers under a fresh date.
The owner and I considered a daily cron on 2026-11-06 and rejected it for exactly that
reason.

### What to check

Five collections, two sizes each — BVO's top sellers by demand (JMV Demand Reports,
Nov 2026):

  Brittany, Breckenridge, Lorelai, Bristol, Myrrin   ×   36" and 48"

Two retailers:
- Home Depot — `https://www.homedepot.com/s/james+martin+<collection>+<size>`
- Ferguson Home — `https://www.fergusonhome.com/search?term=james%20martin%20<collection>%20<size>`

Use the browser (Claude in Chrome). For Home Depot the search HTML carries the data as
escaped JSON — unescape `\"` first, then read `"averageRating"` and `"totalReviews"`
near each product.

⚠️ FERGUSON RATINGS ARE IN `aria-label`, NOT IN THE HTML AS JSON. A same-origin
`fetch()` of a Ferguson search URL returns a ~2.4 KB shell — the page is
client-rendered, so there is nothing to parse in the response body. The first
version of this document said to read `"reviewCount"` from the search HTML and
that is wrong; it produced a rating of `null` for every SKU, which was then
recorded as "Ferguson has counts but no ratings". Navigate to the page and read
the **rendered DOM** instead:

```js
document.querySelectorAll('[aria-label*="out of 5 stars"]')   // -> "4.875 out of 5 stars"
```

Walk up from each star node to the tile containing "James Martin", take the SKU
from the `/s<digits>` href, and the per-SKU count from the `(n)` in the tile text.

⚠️ FERGUSON COUNTS PER SKU; HOME DEPOT POOLS ACROSS FINISHES. One Ferguson
collection+size spreads over 5–8 SKUs, so a single SKU's count is NOT the
collection's review pool. Weight each SKU's rating by its own count and sum the
counts. The 2026-11-06 baseline below was first recorded using the highest
single-SKU count, which understated Brittany 36" as 16 reviews when the pool is
45 — and would have made the published figure wrong by more than the rounding.

Put ~1 second between requests. If a retailer blocks or returns an empty shell, STOP
for that retailer and report it as unchecked — do not retry hard, and never report
"could not check" as if it were "no change".

### Baseline — 2026-11-06, full pools both retailers

Ferguson figures are count-weighted across every SKU in that collection+size.

| Collection + size | Home Depot      | Ferguson        |
|---|---|---|
| Brittany 36"     | 4.62 — 47 rev   | 4.62 — 45 rev   |
| Brittany 48"     | 4.47 — 37       | 4.14 — 14       |
| Bristol 48"      | 4.36 — 123      | 4.18 — 17       |
| Bristol 36"      | 4.09 — 27       | 4.29 — 17       |
| Myrrin 36"       | 5.00 — 7        | 5.00 — 18       |
| Myrrin 48"       | 5.00 — 2        | 4.33 — 6        |
| Breckenridge 36" | 3.40 — 5        | 4.77 — 13       |
| Breckenridge 48" | 3.45 — 6        | 4.25 — 8        |
| Lorelai 36"      | 4.92 — 2        | 4.83 — 6        |
| Lorelai 48"      | 4.88 — 2        | 5.00 — 2        |

Rolled up to the collection level, both sizes and both retailers combined:

| Collection | HD    | Ferguson | Published | Reviews | Status |
|---|---|---|---|---|---|
| Brittany     | 4.55 | 4.51 | **4.5** | 143 | live |
| Bristol      | 4.31 | 4.24 | **4.3** | 184 | live |
| Myrrin       | 5.00 | 4.83 | **4.9** | 33  | live |
| Lorelai      | 4.90 | 4.88 | —       | 12  | below the 30-review floor |
| Breckenridge | 3.43 | 4.57 | —       | 32  | 1.14 spread, over the 0.5 limit |

The two publish rules, enforced in `themeSettings.jmvReviewFor()` and asserted by
`gates/gate_structured_data.js`: **at least 30 reviews**, and **the two retailers
within 0.5 of each other**. Breckenridge fails the second. Its combined 4.2 is
arithmetically true and misleading in both directions, and it is BVO's #2 seller —
the worst place on the site to publish a number nobody can stand behind.

The two retailers are NOT a shared syndicated pool. That was tested: where volume is
real the counts and ratings diverge sharply (Bristol 48" is 123 reviews at Home Depot
against 17 at Ferguson; Breckenridge differs by over a full point). If syndication
later becomes available through James Martin, this whole cited-figure approach should
be replaced by real on-page reviews and this task retired.

### What to report

A short message to the owner, not a document:

1. A table of the new figures beside the baseline, with the deltas.
2. Any rating that moved by 0.3 or more, called out — especially **Breckenridge**,
   which is BVO's #2 seller and already the weakest at ~3.4. If it drops further, say
   so plainly and first.
3. Whether any figure currently published on the BVO site is now wrong, and what it
   should say. The figures live in **Admin → Theme Editor → James Martin Review
   Figures**, and render on the model landing pages
   (`/collections/vanity-models/james-martin-vanities/<model>`). Check the live page
   before claiming anything about it.
4. The exact values to type into that panel — rating, review count, Home Depot
   average, Ferguson average, and the "Verified" month. No deploy is needed.
   Re-check both rules before proposing any change: a collection that drops under
   30 reviews, or whose retailers drift more than 0.5 apart, must be switched OFF
   rather than updated. The site enforces this itself — a figure that breaks either
   rule stops rendering — but say so plainly instead of letting it vanish silently.
5. If a retailer could not be checked, say which and why, in its own line. Never let a
   partial check read as a complete one.

Finish by asking whether to make the edit, and remind the owner that the James Martin
review-syndication question is still open — if syndication has since become available,
this whole cited-number approach should be replaced by real reviews on the page, and
this task retired.
