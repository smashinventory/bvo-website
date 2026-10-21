# Merchant Center + Google Ads: a national plan for BVO

> Merchant Center feed requirements and a Google Ads plan for a national launch. Research and proposal only — nothing here is implemented or approved.

*Written 2026-10-16. Sources are cited inline. Where the evidence is weak I say
so rather than rounding it up — most published guidance on this subject is
agency marketing material, and the numbers in it contradict each other.*

---

## 1. Where BVO actually stands tonight

Everything below is read from the live accounts today, not assumed.

| | |
|---|---|
| Merchant Center | 311582550, "Exceptional" store quality, Top Quality Store |
| Products | 5,609 via **Found by Google** — crawled, not fed |
| Status | 5.6K approved · 301 limited · 66 not approved · 6 under review |
| Catalogue history | **0 products until Oct 6**, then 0 → ~6K in ten days |
| Seller rating | **None.** No review source connected |
| Google Ads | Account 463-040-4539, **all campaigns paused, $0 spend** |
| Site traffic | ~360 sessions/week (GA4) |
| Orders | ~1 in the current window |
| Organic clicks | 499 in 28 days, **-23.3%** |

Two things in that table dominate everything else.

**The catalogue is ten days old.** It went to zero at cutover and only
repopulated when the structured-data work shipped on Oct 5. Merchant Center is
still converging.

**There is almost no conversion data.** This is the single most important fact
for planning, and it is the one most likely to be glossed over.

---

## 2. The sequencing argument: do not turn the ads on yet

Every credible source agrees that automated bidding needs conversion volume to
function. The thresholds they quote disagree — which is itself informative —
but all of them are far above where BVO sits.

| Source | Threshold quoted |
|---|---|
| Google (via Lionelz) | ~15 conversions / 30 days for Target ROAS |
| Google (via Dotidot) | ≥30 conversions / 30 days per PMax campaign |
| Groas | 30+ in 30 days, consistent |
| Finch | 30–50 |

BVO is at roughly **one order per week**. Switching on Performance Max against
that would mean paying Google to explore a space it cannot learn from. The
algorithm would spend the budget; it would not find the pattern.

**The order of operations matters more than the campaign type.** Spending on
ads before the foundation is right does not just waste the money — it trains
the bidding model on noise, and that cost persists after you fix the
underlying problem.

So the plan below is staged. Stage 1 is unglamorous and costs nothing.

---

## 3. Stage 1 — foundation (do before any spend)

### 3.1 Conversion tracking that reports real values

Value-based bidding cannot work without per-transaction values. Oxedent is
explicit that transaction-specific conversion values are what let the bidder
distinguish a $300 faucet from a $3,000 vanity — and for BVO that spread is
the entire business.

Concretely:
- Purchase conversion firing with the actual order total, not a flat value
- Enhanced conversions, which Groas recommends specifically during ramp-up
- The Stripe webhook as the source of truth, since it already knows the
  captured amount — the same discipline the admin dashboard follows, where
  revenue comes from the orders table and never from events

**This is the highest-value unglamorous work available.** Without it, every
later decision rests on numbers that are wrong.

### 3.2 Shipping — the one that will bite hardest

This is BVO-specific and it is a real blocker, not a formality.

Google's own documentation states that **carrier-calculated rates do not
support LTL pricing** for heavy or oversized products, because Google's
"common carrier" definition covers postal and parcel only. Vanities ship LTL
through WWEX. That means:

1. Oversized products need a **`shipping_label`** so they can be grouped
2. Rates must come from a **shipping table**, not carrier calculation
3. **The advertised shipping cost must be at least what the site charges.**
   If Google quotes less than checkout collects, items get disapproved.

That third point is the dangerous one, and it interacts with work already in
the codebase: liftgate is derived from the delivery-location type, and
checkout refuses AK/HI and freight forwarders. The shipping table has to
reflect those rules or the feed will promise something checkout won't honour.

### 3.3 Decide the feed question — and it is now a real decision

The feed at `/feeds/google-shopping.xml` is built, gated, live, and **not
registered**. Google is crawling instead.

Today the crawl is working well (5.6K approved, Exceptional). But the two
failure modes in the account — *missing local inventory data* and *mismatched
product availability* — are not things the feed would fix. I checked: both
surfaces compute availability from the same `qty > 0`.

**The argument for registering it anyway is control, not repair.** A feed
states `google_product_category` explicitly — which is what the 6,079-row
backfill on 2026-09-30 was for — rather than letting Google infer it. It also
lets you set `shipping_label` per product, which §3.2 requires. Crawling
cannot do that.

**The argument against doing it carelessly:** when both exist, the feed takes
precedence for items it contains. A feed error immediately overrides a
catalogue currently performing at Exceptional.

Recommendation: register it, but *after* the shipping table is right, and
watch the approved count daily for a week.

### 3.4 Titles

The furniture pattern across sources is consistent:

```
Brand + Product Type + Material/Finish + Dimensions
James Martin Bristol 60" Double Vanity, Bright White, Silestone Top
```

Front-load — sources disagree on the visible window (~26 to ~70 characters
against a 150-character field), so the safe reading is that the first few
words carry the weight. No ALL CAPS, no promotional text, no superlatives;
Google may reject titles containing them.

Keep attribute order **consistent across the catalogue**. Channable warns
specifically against the same attribute appearing in different positions.

---

## 4. Stage 2 — first spend, deliberately small

### Start with Standard Shopping, not Performance Max

Multiple sources put the floor for PMax at ~30 conversions/month. Below that,
Standard Shopping is recommended — and it has a property that matters far more
for BVO right now than reach:

**You can see every search term.** At this stage the search-term report is
worth more than the clicks. It tells you what people actually type when they
are looking for a vanity, which feeds the SEO work, the landing pages, and
eventually the PMax asset groups. PMax gives you none of that visibility.

### Bidding

Maximize Conversion Value, **no ROAS target**, for the first 2–3 weeks. Google's
guidance (via Oxedent) is that a tight target early prevents the algorithm from
learning at all. Groas advises leaving targets and structure alone entirely
during that window.

Set a target only once there is volume to set it from.

### The margin floor — the one number to know

```
break-even ROAS = 1 ÷ gross margin
```

At 30% margin you need 3.33x to break even. At 40%, 2.5x. **Work this out for
vanities specifically before spending anything**, because it is the line
between buying customers and buying nothing.

This matters doubly given the discount funnel in §6: a 15% first-order discount
moves the break-even ROAS up, and the plan only works if the second order
exists.

---

## 5. Budget and ramp

The sources are least trustworthy here — most have an interest in larger
budgets. What survives scrutiny:

- A budget too small never produces enough conversions to escape learning.
  Stub Group notes $20/day "can work" for one small Shopping campaign but means
  slow data collection.
- Accept **lower ROAS early**. Several sources warn that high targets starve
  campaigns of the volume they need.
- Give new products their own campaign and ~30 days before judging them.

For BVO I would frame it as a **learning budget with a defined end**: a fixed
amount over ~8 weeks, in one Standard Shopping campaign, on your best-margin
and best-converting SKUs only. Not the full 5,600. The question that budget
buys an answer to is *"what does it cost to acquire a vanity customer"* — and
that answer is worth paying for even if the campaign itself loses money.

Do not scale until that number exists.

---

## 6. The deals funnel, and where it fits

Owner-specified: **15% off first order (non-trade), 20% first / 15% ongoing
(trade)**, behind account creation. Explicitly trading margin for velocity.

Strategically this is sound and it fits the stage: you have traffic (~360
sessions/week) converting at near zero. Capturing an email is a far cheaper
win than buying more traffic.

Three cautions, in order of how much they could cost:

**Trade at 15% forever is a permanent margin commitment.** First-order
discounts are a promotion; a standing trade rate is pricing. How trade status
is granted matters enormously — if it is a self-service checkbox, expect
retail customers to tick it. This wants a verification step, even a light one.

**It changes the Ads maths.** Break-even ROAS is computed on margin *after*
discount. A 15% discount on a 30% margin does not reduce margin by 15% — it
reduces it to roughly 17.6%, which moves break-even ROAS from 3.33x to 5.7x.
That is a large move and it must be in the model before any spend.

**The funnel only pays back on repeat purchase.** A bathroom vanity is not a
consumable. Honest question worth answering before committing: what *is* the
second purchase? For trade (contractors, remodelers) repeat is plausible and
the 15% standing rate is defensible. For retail, one household may buy one
vanity in ten years — in which case the 15% is a pure acquisition cost on a
single transaction, and should be judged as such rather than as an investment
in lifetime value.

**My read:** the trade offer is the stronger half of this. Contractors buy
repeatedly, buy at higher volume, and are far less price-sensitive on
individual SKUs than retail. If you want one thing to lead with, lead with
trade.

Captured as task #342 with the technical questions that need settling.

---

## 7. What is genuinely missing, in priority order

1. **Conversion tracking with real values** — nothing else works without it
2. **Shipping table + shipping labels for LTL** — currently a disapproval risk
3. **Margin model per category** — the break-even ROAS you will bid against
4. **Google Customer Reviews** (task #343) — free, slow, start now
5. Feed registration, after 1–3
6. Then, and only then, spend

---

## 8. Caveats on the sources

Most of what is published on this topic is agency and vendor content with an
interest in the conclusion. Specific points of unreliability found while
researching:

- Conversion thresholds for PMax vary across sources: 20–30, 30, 30–50
- One vendor's ROAS comparison (5.17 vs 2.57) and a "60–80% of PMax spend goes
  to Shopping" claim are unsourced and should not be relied on
- Title character limits are quoted anywhere from 26 to 150
- No source found addressed high-AOV furniture specifically; the furniture
  guidance is generic

The Google Help pages are the only authoritative sources in the list.
**Verify thresholds and UI steps against Google's current documentation before
acting** — particularly the shipping rules, which are the ones that can get
products disapproved.

---

## Sources

- [Google Shopping vs Performance Max: How to choose in 2026](https://www.dotidot.io/post/google-shopping-vs-performance-max)
- [Performance Max for Ecommerce: What Actually Works in 2026 — Store Growers](https://www.storegrowers.com/performance-max-campaigns/)
- [Google Ads for Ecommerce: 2026 Scaling Guide — Jetfuel](https://jetfuel.agency/google-ads-ecommerce-guide-2026/)
- [Google Ads for Ecommerce (2026 Guide) — StubGroup](https://stubgroup.com/blog/google-ads-for-ecommerce-guide/)
- [Ecommerce Google Ads budget — Oxedent](https://oxedent.co.uk/google-ads-budget-ecommerce/)
- [Google Ads for Ecommerce: The Complete 2026 Strategy Guide — Groas](https://www.groas.com/post/google-ads-for-ecommerce-the-complete-2026-strategy-guide)
- [Google Ads for ecommerce: structure, feed and ROAS 2026 — Lionelz](https://lionelz.com/en/blog/google-ads-ecommerce/)
- [Google Shopping title optimization — Channable](https://www.channable.com/blog/google-shopping-title-optimization-best-practices)
- [Product Feed Optimization Guide — Optmyzr](https://www.optmyzr.com/blog/google-merchant-center-product-feed-optimization-guide/)
- [Shipping label [shipping_label] — Google Merchant Center Help](https://support.google.com/merchants/answer/6324504?hl=en)
- [Shipping weight [shipping_weight] — Google Merchant Center Help](https://support.google.com/merchants/answer/6324503?hl=en)
- [Shipping [shipping] — Google Merchant Center Help](https://support.google.com/merchants/answer/6324484?hl=en)
- [Google Merchant Center freight quotes — Eniture](https://support.eniture.com/freight-quotes-in-the-google-merchant-center)
- [Shipping Attributes in Google Merchant Center — Store Growers](https://www.storegrowers.com/shipping-attributes/)
- [Google store ratings: An overview for Merchants — Google Merchant Center Help](https://support.google.com/merchants/answer/190657)
