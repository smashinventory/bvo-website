-- ============================================================================
-- 2026-10-05_mount_type_proof_READONLY.sql
--
-- READ ONLY. Three SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
-- No fix is proposed. The importer is product-data code and out of scope.
--
-- ─── WHAT THE OWNER CORRECTED ───────────────────────────────────────────────
-- I had been treating mount_type as a single property of a vanity. It is not.
-- Owner, 2026-10-05:
--
--   "Some vanities have both a wall hung and floor standing option. So they
--    can be in both. Whereas some like the marecello and the allamari are
--    only wall mounted/floating."
--
-- Also: floating = wall hung = wall mounted. One product, three names.
--
-- ─── WHY THAT BREAKS THE CURRENT DERIVATION ─────────────────────────────────
-- importJamesMartinFeed.js:1216-1228:
--
--     if (/wall/i.test(vtLower) || /wall/i.test(ptLower))      mountType = 'Wall Mounted';
--     else if (/pedestal|console/i.test(...))                  mountType = 'Pedestal';
--     else                                                     mountType = 'Floor Standing';
--     await replaceAttr(conn, productId, 'mount_type', mountType, null);
--
--   DEFECT 1 - SINGLE VALUE, MULTI-VALUE REALITY. replaceAttr writes ONE row.
--     An if/else can only pick one branch. A vanity offered both ways keeps
--     whichever branch fires first and silently loses the other option.
--     Confirmed in the data: mount_type has 4,784 rows across 4,784 products
--     - exactly one each, no product carrying two. By contrast `style`, which
--     IS multi-value, has 6,312 rows across 4,854 products.
--
--     The correct pattern already exists in this same file: insertStyleAttrs()
--     inserts one EAV row per bucket. mount_type does not use it.
--
--   DEFECT 2 - THE REGEX ONLY TESTS /wall/. "Floating" is the same product and
--     matches nothing. A wall-only model described as "Floating" fails every
--     branch and lands in the else, written as 'Floor Standing'. That is not
--     an incomplete record, it is a false one.
--
--   DEFECT 3 - 'Wall Mounted' is in the canonical set and has ZERO rows in the
--     catalogue. That is the symptom of 1 and 2 rather than a separate fault.
--
-- ─── THE TEST ───────────────────────────────────────────────────────────────
-- Marcello and Allamari are named by the owner as wall-mount-only. If they
-- come back tagged 'Floor Standing', defect 2 is proven against products whose
-- correct answer is already known - which is stronger evidence than anything I
-- could infer from a description.
-- ============================================================================


-- ─── 1. THE TWO MODELS THE OWNER NAMED ─────────────────────────────────────
-- Spelling-tolerant: marcello / marecello / marchello, allamari / alamari /
-- allemari. One row per model + mount_type combination rather than per
-- finish-and-top permutation, so the answer is short.

SELECT
  SUBSTRING_INDEX(p.name, ' ', 1)                AS model,
  COALESCE(mt.value_text, '(NO mount_type ROW)') AS mount_type_tagged,
  COUNT(*)                                       AS sku_count,
  MIN(p.width_in)                                AS min_width,
  MAX(p.width_in)                                AS max_width,
  MIN(p.slug)                                    AS example_slug
FROM products p
LEFT JOIN product_attribute_values mt
       ON mt.product_id = p.id AND mt.attr_key = 'mount_type'
WHERE p.is_active = 1
  AND (
       LOWER(p.name) LIKE '%marcello%'  OR LOWER(p.name) LIKE '%marecello%'
    OR LOWER(p.name) LIKE '%marchello%' OR LOWER(p.name) LIKE '%allamari%'
    OR LOWER(p.name) LIKE '%alamari%'   OR LOWER(p.name) LIKE '%allemari%'
  )
GROUP BY model, mount_type_tagged
ORDER BY model, mount_type_tagged;


-- ─── 2. DOES ANY VANITY CARRY TWO mount_type ROWS? ─────────────────────────
-- The structural question, independent of the two models above. If the answer
-- is "none", the attribute is single-value in practice and every dual-option
-- vanity in the catalogue is currently misrepresented.
--
-- Expected from the row counts: zero. Worth proving rather than assuming.

SELECT
  rows_per_product,
  COUNT(*) AS products
FROM (
  SELECT pav.product_id, COUNT(*) AS rows_per_product
  FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id AND p.is_active = 1
  WHERE pav.attr_key = 'mount_type'
  GROUP BY pav.product_id
) t
GROUP BY rows_per_product
ORDER BY rows_per_product;


-- ─── 3. HOW MANY VANITIES MENTION FLOATING / WALL HUNG BUT ARE NOT TAGGED ──
-- The blast radius. Vanities only (excluding the accessory product types that
-- polluted the earlier result), counted by what they are currently tagged.
--
-- Any count sitting under 'Floor Standing' or 'Pedestal' here is a vanity the
-- description says is wall-hung while the attribute says otherwise - which is
-- what the collection filters and the guide showcase both read.

SELECT
  COALESCE(mt.value_text, '(none)') AS mount_type_tagged,
  COUNT(DISTINCT SUBSTRING_INDEX(p.name, ' ', 1)) AS distinct_models,
  COUNT(*)                                        AS skus
FROM products p
LEFT JOIN product_attribute_values mt
       ON mt.product_id = p.id AND mt.attr_key = 'mount_type'
WHERE p.is_active = 1
  AND p.product_type NOT IN (
        'Knobs & Legs', 'Bathroom Accessories', 'Plumbing Accessories',
        'Mirror', 'Backsplash', 'Stone Top', 'Composite Top',
        'Bathroom Faucets', 'Kitchen Faucets', 'Bar Faucets',
        'Laundry Faucets', 'Shower Fixtures', 'Tub Fillers')
  AND (
       LOWER(COALESCE(p.long_desc, ''))  LIKE '%floating%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%floating%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall mount%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-mount%'
  )
GROUP BY mount_type_tagged
ORDER BY skus DESC;
