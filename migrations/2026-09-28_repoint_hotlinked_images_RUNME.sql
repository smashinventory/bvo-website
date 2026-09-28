-- ════════════════════════════════════════════════════════════════════
-- Repoint the hotlinked curated images at our own catalogue.
-- Owner-approved 2026-09-28.
--
-- WHAT THIS FIXES
--
-- Eleven image URLs in the database pointed at hosts we do not control —
-- ten inspiration-guide cards (pages.og_image) and the Brittany model
-- tile. They break the day any of those sites reorganises, and vanish
-- entirely if one blocks hotlinking.
--
-- Owner, 2026-09-28: "These are all James Martin images that were on
-- other websites. They are not copyrighted by the competition. If we can
-- find the exact image from bunny - then swap."
--
-- So this does not download or re-host anything. Every URL below is
-- already on our Bunny pull zone, attached to a product we sell. Nine of
-- the ten are the SAME MODEL as the photo being replaced.
--
-- ────────────────────────────────────────────────────────────────────
-- WHY IT RESOLVES BY SKU RATHER THAN HARD-CODING THE IMAGE URL
--
-- A pasted Bunny URL is a snapshot. Product imports legitimately replace
-- images when James Martin ships new photography, and cdnUrl.js rewrites
-- the host on every import — so a hard-coded URL would silently rot back
-- into a stale link, which is the same class of problem this is fixing.
--
-- Joining on SKU means the guide always shows whatever the current
-- primary image for that product is.
--
-- The JOIN is also the safety mechanism: a SKU that does not exist
-- simply does not match, so that row is left alone rather than being set
-- to NULL. Nothing here can blank an image.
--
-- ────────────────────────────────────────────────────────────────────
-- ONE SUBSTITUTION, DELIBERATELY
--
-- small-bathroom-vanity-ideas pointed at ak1.ostkcdn "Boston 31 1/2
-- Rectangular", which resolves EXACTLY to our 055BK16BNK31.5WG2 — "Two
-- Boston 15.25" Wall Brackets w/ 31.5" glass shelf".
--
-- The match is perfect and the content is wrong: a shelf bracket is a
-- poor hero for a guide about small vanities. Replaced with Addison 30"
-- Glossy White, which is what that guide is actually about.
--
-- how-to-choose-a-bathroom-vanity is NOT in this file. Its image is a
-- James Martin 2026 collections BANNER, not a product, so there is
-- nothing in the catalogue to point at. Owner is uploading it to Bunny
-- separately. scripts/auditImageHosts.js will keep reporting that one
-- until the new URL is set, which is correct.
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- ⚠ SELECT ROW_COUNT() IS USELESS IN phpMyAdmin — IGNORE THOSE COLUMNS.
--
-- Run here on 2026-09-28 every ROW_COUNT() reported 0 while the
-- statements plainly worked. phpMyAdmin executes each statement in its
-- own context, so the counter has reset by the time the SELECT runs.
-- The same thing made the email-template migration's count unreadable
-- earlier the same day.
--
-- Read the "N rows affected" line phpMyAdmin prints above each
-- statement instead, and trust the END-STATE verification at the bottom
-- of this file over any count. Asserting the end state rather than the
-- effect of a statement is the rule that caught every real defect today.
--
-- Actual result: 8 / 1 / 0 / 1 — the batch, De Soto 82 (we DO stock it,
-- an earlier probe of mine wrongly said otherwise), the Addison
-- fallback correctly skipped, and the Brittany tile.
-- ════════════════════════════════════════════════════════════════════

-- ── The nine that map straight to a product ─────────────────────────
UPDATE pages p
  JOIN (
    SELECT 'farmhouse-bathroom-vanity-ideas'   AS slug, '330-V36-LNO-3EJP' AS sku UNION ALL
    SELECT 'floating-bathroom-vanity-ideas',        'D640-V48-SBL'      UNION ALL
    SELECT '60-inch-bathroom-vanity-ideas',         '545-V60D-LNO-1WZ'  UNION ALL
    SELECT 'bathroom-vanity-buying-guide',          'D225-V72-SSO'      UNION ALL
    SELECT 'modern-bathroom-vanity-ideas',          '983-V36-AGR-RG'    UNION ALL
    SELECT 'white-bathroom-vanity-ideas',           'E645-V60S-GW'      UNION ALL
    SELECT 'double-sink-bathroom-vanity-ideas',     '670-V60D-M-WLT'    UNION ALL
    SELECT 'small-bathroom-vanity-ideas',           'E444-V30-GW-3EJP'
  ) m ON m.slug = p.slug
  JOIN products pr ON pr.sku = m.sku AND pr.is_active = 1
  LEFT JOIN product_images pi ON pi.product_id = pr.id AND pi.is_primary = 1
   SET p.og_image = COALESCE(pr.primary_image_url, pi.url)
 WHERE COALESCE(pr.primary_image_url, pi.url) IS NOT NULL;

SELECT ROW_COUNT() AS guides_repointed;   -- expect 8

-- ── master-bathroom-vanity-ideas: De Soto 82 if we stock it ─────────
-- The original was a De Soto 82" Double with makeup table, Silver Gray.
-- Whether that is in the catalogue was never confirmed — an earlier
-- probe filtered on 72/84/94 and 82 is not in that list, so it was
-- never actually looked for. This asks properly.
UPDATE pages p
  JOIN products pr ON pr.id = (
        SELECT id FROM products
         WHERE is_active = 1
           AND name LIKE '%De Soto%' AND name LIKE '%82%'
           AND name LIKE '%Double Vanity%'
         ORDER BY id LIMIT 1)
  LEFT JOIN product_images pi ON pi.product_id = pr.id AND pi.is_primary = 1
   SET p.og_image = COALESCE(pr.primary_image_url, pi.url)
 WHERE p.slug = 'master-bathroom-vanity-ideas'
   AND COALESCE(pr.primary_image_url, pi.url) IS NOT NULL;

SELECT ROW_COUNT() AS desoto_82_used;     -- 1 = we stock it, 0 = fallback below

-- Fallback: Addison 72" Double. Runs ONLY if the statement above found
-- nothing, detected by the row still being on a foreign host. Self-
-- correcting, so the file is safe to run in either world without
-- anybody having to check first.
UPDATE pages p
  JOIN products pr ON pr.sku = 'E444-V72-GW-3EJP' AND pr.is_active = 1
  LEFT JOIN product_images pi ON pi.product_id = pr.id AND pi.is_primary = 1
   SET p.og_image = COALESCE(pr.primary_image_url, pi.url)
 WHERE p.slug = 'master-bathroom-vanity-ideas'
   AND p.og_image NOT LIKE '%bathroomvanitiesoutlet.com%'
   AND COALESCE(pr.primary_image_url, pi.url) IS NOT NULL;

SELECT ROW_COUNT() AS addison_72_fallback_used;

-- ── The Brittany model tile ─────────────────────────────────────────
-- Exact match: the original was brittany-36-single…smokey-celadon.
UPDATE model_groups mg
  JOIN products pr ON pr.sku = '650-V36-SC' AND pr.is_active = 1
  LEFT JOIN product_images pi ON pi.product_id = pr.id AND pi.is_primary = 1
   SET mg.custom_image = COALESCE(pr.primary_image_url, pi.url)
 WHERE mg.model_name = 'Brittany'
   AND COALESCE(pr.primary_image_url, pi.url) IS NOT NULL;

SELECT ROW_COUNT() AS model_tiles_repointed;   -- expect 1

-- ── VERIFY ──────────────────────────────────────────────────────────
-- Expect exactly ONE row: how-to-choose-a-bathroom-vanity, awaiting the
-- Bunny upload of the collections banner. Anything else did not take.
SELECT 'page' AS src, slug, og_image
  FROM pages
 WHERE og_image IS NOT NULL AND og_image <> ''
   AND og_image NOT LIKE '/%'
   AND og_image NOT LIKE '%bathroomvanitiesoutlet.com%'
   AND og_image NOT LIKE '%cloudinary.com%'
UNION ALL
SELECT 'model', CONCAT(model_name,' / ',brand), custom_image
  FROM model_groups
 WHERE custom_image IS NOT NULL AND custom_image <> ''
   AND custom_image NOT LIKE '/%'
   AND custom_image NOT LIKE '%bathroomvanitiesoutlet.com%'
   AND custom_image NOT LIKE '%cloudinary.com%';

-- And what the nine now point at, for eyeballing.
SELECT slug, og_image FROM pages
 WHERE slug IN ('farmhouse-bathroom-vanity-ideas','floating-bathroom-vanity-ideas',
                '60-inch-bathroom-vanity-ideas','bathroom-vanity-buying-guide',
                'modern-bathroom-vanity-ideas','white-bathroom-vanity-ideas',
                'double-sink-bathroom-vanity-ideas','small-bathroom-vanity-ideas',
                'master-bathroom-vanity-ideas')
 ORDER BY slug;
