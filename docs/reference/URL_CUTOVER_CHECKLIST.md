# URL cutover checklist — Shopify → Node.js

Last updated: 2026-09-24

The technical sequence for pointing `www.bathroomvanitiesoutlet.com` at the
Node.js site without losing search traffic. Business, legal and marketing
items live in `PRE_LAUNCH_CHECKLIST.md`; this file is only the cutover.

**This is a SAME-DOMAIN migration.** The hostname does not change — only the
platform and the URL structure. That single fact decides several things
below, most importantly that the Search Console **Change of Address tool
does not apply and must not be used**. It is for moving to a different
domain. Using it here would be wrong.

---

## Before cutover

- [x] **`SITE_URL` set to `https://www.bathroomvanitiesoutlet.com`**
      Done 2026-09-24. Verified: all 6,076 sitemap `<loc>` entries read
      `www`. Without it every canonical, sitemap entry and JSON-LD URL
      publishes non-www against a www canonical.

- [x] **Redirect map built and loaded** — 659 indexed old URLs → 657 × 301,
      2 × 410, 0 unresolved. 501 rows in `url_redirects` (the other 158 are
      byte-identical on the new site and need no redirect).
      Regenerate with `node scripts/buildRedirectMap.js`.

- [x] **Redirect middleware deployed and verified** — spot-checked live:
      collections, tag paths, `?page=` and `?variant=` shedding, GVS
      cross-domain, 410s, and the negative case (a live product URL must
      return 200, not redirect). 61/61 sampled sitemap URLs returned 200,
      confirming nothing is shadowed.

- [ ] **#239 — re-host the five hotlinked images.** Cutover blocker.
      See `briefs/HOTLINKED_IMAGES_HANDOFF.md`.

- [ ] **#238 — checkout / Clover / FraudLabs audit.** Waiting on the
      Authorize.Net account and credentials.

- [ ] **Rate limiter retune.** See `00-start/OPEN_ITEMS.md` §4 — it is
      tuned for staging traffic, deliberately deferred to cutover.

---

## At cutover

- [ ] **Point DNS** at the Node.js host.

- [ ] **Verify a live product URL loads**, not redirects:
      `www.bathroomvanitiesoutlet.com/products/040-s72-car-snk` → **200**.
      This is the single most important check. If it 301s, a self-redirect
      got into `url_redirects` and that URL is in an infinite loop.

- [ ] **Spot-check four redirects**, each exactly one hop:
      | URL | Expect |
      |---|---|
      | `/collections/er-vanities` | → `globalvaluesupply.com/collections/bathroom-vanities-outlet` |
      | `/collections/bathroom-vanities-1/36-inch` | → `/collections/bathroom-vanities` |
      | `/products/the-gabi-48-inch-rustic-ash-vanity` | → `/collections/bathroom-vanities?size_in=48` |
      | `/pages/james-martin-policies` | → `/pages/returns-policy` |

- [ ] **🔴 CHECK `robots.txt`.** The single highest-consequence item here.

      `www.bathroomvanitiesoutlet.com/robots.txt` **must** show
      `Disallow: /admin/` and the `Sitemap:` line.

      If it instead shows:
      ```
      User-agent: Googlebot
      Disallow: /
      ```
      **stop and clear it before Google re-crawls.** That is Hostinger's
      edge-injected block for the `*.hostingersite.com` temporary domain.
      Established 2026-09-24: it is generated at their CDN edge, is not a
      file, has never existed in this repo, and survived a cache purge.
      It *should* be scoped to the temp domain and not follow the custom
      one — but that was never proven, only inferred, so it is checked
      rather than assumed.

      If it does follow: raise with Hostinger support. The app's own
      host-aware route is correct and working (provable via `/Robots.txt`,
      which bypasses the edge rule); only that exact lowercase path is
      intercepted.

- [ ] **Purge the CDN cache** after the domain switch, then re-verify
      `robots.txt` and `sitemap.xml` independently. A stale edge copy is
      invisible from the server side.

---

## After cutover

- [ ] **Submit the sitemap** in Search Console → Sitemaps:
      `https://www.bathroomvanitiesoutlet.com/sitemap.xml`
      Same path Shopify used, so it is a resubmit — do it explicitly to
      force a fetch rather than waiting for Google to notice the change.

- [ ] **DO NOT use the Change of Address tool.** Same-domain migration.
      See the note at the top.

- [ ] **Optional — temporary old-URL sitemap to accelerate the 301s.**
      On a same-domain restructure Google rediscovers redirects on its own
      recrawl schedule, which for 659 URLs can take weeks. Submitting a
      second, temporary sitemap containing the **old** URLs makes Google
      crawl them, hit the redirects and process them in days instead.

      Not yet built. Generate from `migrations/redirect_map.csv` — the 501
      that actually redirect, excluding the 2 × 410 and the 158 unchanged.
      Submit alongside the real sitemap; **remove it after 1–2 months**,
      once Coverage shows them processed. Leaving it indefinitely keeps
      asking Google to crawl URLs you want forgotten.

- [ ] **Watch Coverage for 2–4 weeks.** Expect indexed URLs to dip then
      recover. What matters is that 404s do not climb — a rising 404 count
      means a URL shape nobody mapped.

- [ ] **Check which old URLs are still being hit**, a few weeks in:
      ```sql
      SELECT old_path, hits, last_hit_at
        FROM url_redirects
       WHERE hits > 0
       ORDER BY hits DESC
       LIMIT 50;
      ```
      And the reverse — mapped URLs nobody ever requests:
      ```sql
      SELECT COUNT(*) FROM url_redirects WHERE hits = 0;
      ```

---

## Post-cutover, not blockers

- [ ] **Rebuild the two location pages**, then re-point their rows:
      `/pages/bathroom-vanities-atlanta-ga-norcross-roswell-marietta`
      `/pages/bathroom-vanities-near-norcross-location-info`

      Both already 404 on Shopify (verified 2026-09-24) — they sit in the
      GSC "Valid" export only because Google's last crawl predates their
      deletion. So the redirects inherit nothing and the value will come
      from the new pages themselves. Currently pointed at
      `/collections/bathroom-vanities`; re-pointing is one `UPDATE`.

- [ ] **Migrate the two Shopify blog posts.** Both are live with real
      content. Currently redirected to the closest `/inspiration` guide
      because `/blog` on the new site is empty.

---

## Rollback

DNS back to Shopify. Nothing in this migration is destructive: the Shopify
store is untouched, and `url_redirects` only ever affects requests the
Node.js app receives.

---

## Authority baseline — measured 2026-10-06

Logged so the next reading has something to compare against. Taken the same day
the faucet/accessory landing pages went live and the sitemap was resubmitted,
so this is the floor, not a steady state.

All figures are for `https://www.bathroomvanitiesoutlet.com/`.

| Source | Metric | Value |
|---|---|---|
| Ahrefs (free backlink checker) | Domain Rating | **13** |
| Ahrefs | Backlinks | 690 (56% dofollow) |
| Ahrefs | Linking websites | 583 (58% dofollow) |
| dapachecker (Ahrefs data) | DR / UR / ST | 13 / 8 / 1.2K |
| dapachecker (Moz data) | DA / PA / Spam Score | **55** / 41 / 2% |
| Seobility | Referring domains | 7 |
| Seobility | Backlinks | 25 |
| Seobility | Referring IPs | 7 |

### Reading these honestly

**The page-level spread (Seobility 25 vs Ahrefs 690) is expected and partly
cutover noise.** Two causes stacked: Seobility's link index is a small fraction
of Ahrefs', and page-level link data is exactly what a URL migration scrambles.
Links still point at old Shopify URLs; Ahrefs follows the 301 and credits the
target, smaller crawlers often do not, and every tool recrawls on its own
cadence. This gap should narrow on its own.

**The domain-level spread (Moz DA 55 vs Ahrefs DR 13) is NOT cutover noise, and
this was checked rather than assumed.** We migrated URLs, not the domain —
the domain-level link graph barely moved, so a platform change cannot explain a
42-point divergence. The first suspicion was that dapachecker was serving stale
or junk data; its DR tab then returned **13, identical to Ahrefs**, which rules
that out. Both numbers are faithfully reported. Moz and Ahrefs simply see
different link graphs and score them differently.

**None of these are Google metrics.** DA, DR, PA and UR are third-party
estimates Google neither uses nor sees. They are useful only as direction over
time, measured with ONE tool consistently. Search Console's Links report is the
only link data Google will ever show, and it is the one that reflects what they
actually counted.

### Re-measure

**Week of 2026-10-13** — one week on, by which point redirects, the resubmitted
sitemap and the 11 new filter-landing URLs should have been crawled. Re-take the
same table from the same sources so the comparison is like for like.

### The open piece of work this baseline is for

**Recover link equity already earned before chasing new links.** The cutover
redirect map covers 661 old URLs. Any inbound link pointing at a URL *not* in
that map hits a 404 and its equity is discarded — that is authority already paid
for and currently being thrown away.

Not started, deliberately deferred until the numbers settle. When picked up:

1. Crawl the old-URL inventory against the live site and list which 404 rather
   than redirect. Cross-reference against Ahrefs "Best by links" filtered to
   404, and Search Console → Pages → Not found.
2. Add any with referring domains to the redirect map, pointed at the closest
   live equivalent.
3. Confirm no redirect chains on link-receiving pages — a chain leaks a little
   on every hop. The canonical-host work is already done, so this should be
   clean, but it is worth proving rather than assuming.

Only after that is new link acquisition worth time: supplier and brand dealer
listings (James Martin, Huntington Brass), trade directories, and the
`/inspiration` guides, which are the site's only genuinely linkable assets.
