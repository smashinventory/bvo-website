-- ============================================================
--  Migration 011 — JM Taxonomy Fix
--  BathroomVanitiesOutlet.com
--
--  Fixes confirmed JM-importer taxonomy corruptions documented
--  in PROJECT_BRIEF.md Section 18E.
--
--  CHANGES:
--  1. product_attribute_values — add surrogate AUTO_INCREMENT PK
--     (replaces compound PK on product_id+attr_key) to allow
--     multi-row EAV entries per product (required for style,
--     which maps to multiple BVO style buckets per JM product).
--     Query performance preserved via idx_pav_product_attr index.
--
--  2. Fix mount_type values — JM importer stored 'Wall-Mount'
--     and 'Freestanding'; BVO canonical = 'Wall Mounted' and
--     'Floor Standing'. Simple UPDATE; no re-import needed.
--
--  3. De-slugify products.product_type for JM products — importer
--     called slugify() before storing, producing 'freestanding',
--     'floating-console', etc. Fix to human-readable values so
--     the sidebar filter shows "Freestanding", "Floating Console".
--     RFL products are NOT affected (brand != 'James Martin').
--
--  4. Remove orphaned vanity_type EAV rows — ATTR_MAP wrote
--     attr_key='vanity_type' to EAV but no attribute_definition
--     exists for it; the data is already in products.product_type.
--     DELETE removes the orphan entirely.
--
--  IMPORTANT: Run fixJmStyleData.js on the server AFTER this
--  migration to re-process style multi-values (the style split
--  requires JM_STYLE_MAP logic not expressible in pure SQL).
--
--  Run: npm run migrate  (or apply via phpMyAdmin)
-- ============================================================


-- ── 1. Add surrogate PK to product_attribute_values ──────────
--  Step A: drop the existing compound PRIMARY KEY
--  Step B: add the surrogate AUTO_INCREMENT column
--  Step C: make it the new PRIMARY KEY
--  Step D: add a non-unique index on (product_id, attr_key) to
--          preserve query performance for all EAV filter JOINs.
--
--  NOTE: The FOREIGN KEY on product_id is preserved — it was
--  defined on the product_id column, not on the PK columns,
--  so dropping the PK does not invalidate the FK constraint.

ALTER TABLE product_attribute_values
  DROP PRIMARY KEY;

ALTER TABLE product_attribute_values
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (id);

ALTER TABLE product_attribute_values
  ADD INDEX idx_pav_product_attr (product_id, attr_key);


-- ── 2. Fix mount_type canonical values ───────────────────────
--  BVO canonical: 'Wall Mounted' | 'Floor Standing' | 'Pedestal'
--  JM importer was writing: 'Wall-Mount' | 'Freestanding'

UPDATE product_attribute_values
SET    value_text = 'Wall Mounted'
WHERE  attr_key   = 'mount_type'
  AND  value_text = 'Wall-Mount';

UPDATE product_attribute_values
SET    value_text = 'Floor Standing'
WHERE  attr_key   = 'mount_type'
  AND  value_text = 'Freestanding';


-- ── 3. De-slugify products.product_type for JM products ──────
--  The importer applied slugify() before storing, producing
--  lowercase hyphenated values. This CASE maps known slugs back
--  to human-readable BVO values.
--
--  Only updates rows where brand = 'James Martin' to avoid
--  touching RFL or manually-entered products.
--
--  RFL freestanding vanities already store 'Freestanding'
--  (set by enrich_bvo_v7.py attr_vanity_type → CSV import),
--  so 'Freestanding' will produce a unified filter group for
--  both brands after this fix.

UPDATE products
SET    product_type = CASE product_type
  WHEN 'freestanding'          THEN 'Freestanding'
  WHEN 'floating-console'      THEN 'Floating Console'
  WHEN 'vanity'                THEN 'Vanity'
  WHEN 'vanity-top'            THEN 'Vanity Top'
  WHEN 'corner-vanity'         THEN 'Corner Vanity'
  WHEN 'wall-hung'             THEN 'Wall Hung'
  WHEN 'wall-mount'            THEN 'Wall Mounted'
  WHEN 'wall-mounted'          THEN 'Wall Mounted'
  WHEN 'console'               THEN 'Console'
  WHEN 'linen-cabinet'         THEN 'Linen Cabinet'
  WHEN 'medicine-cabinet'      THEN 'Medicine Cabinet'
  WHEN 'mirror'                THEN 'Mirror'
  WHEN 'accessory'             THEN 'Accessory'
  ELSE product_type  -- leave unchanged if not a known slug
END
WHERE brand = 'James Martin'
  AND product_type IS NOT NULL;


-- ── 4. Remove orphaned vanity_type EAV rows ──────────────────
--  attr_key='vanity_type' has no attribute_definition and is
--  never queried by filters. Its content duplicates what is
--  already in products.product_type. Safe to delete entirely.

DELETE FROM product_attribute_values
WHERE attr_key = 'vanity_type';


-- ── DONE ─────────────────────────────────────────────────────
--  Next step: run fixJmStyleData.js on the server to fix style
--  multi-values (requires Node.js JM_STYLE_MAP logic).
--
--  Command on server:
--    node src/jobs/fixJmStyleData.js
