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
