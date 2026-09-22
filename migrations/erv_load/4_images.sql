-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  CATALOGUE LOAD
-- Generated 2026-09-05 from the reviewed source files.
--
-- 78 SKUs. BVO has no product import route, so this is the load.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab. Run ONE STEP AT A TIME and
-- read the verification SELECT at the end of each before moving on. Every step
-- is idempotent: re-running it will not duplicate rows.
--
-- WHAT THE PRE-LOAD DIAGNOSTIC ESTABLISHED (run 2026-09-05):
--   * 0 of these 78 exist in BVO — clean insert, no slug collisions
--   * no 'Ethan Roth' rows exist, so no rebrand migration is needed
--   * the 4-value product_type taxonomy is LIVE, so we load into it
--   * mount_type canonical string is 'Floor Standing', not 'Freestanding'
--   * collections.slug 'bristol' is taken by James Martin (id 28)
--
-- ROLLBACK is at the bottom of this file. Read it before you start.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_ALL_TABLES';


-- ===========================================================================
-- STEP 4 — product_images
-- ---------------------------------------------------------------------------
-- Delivered from Cloudinary with f_auto,q_auto so the browser gets AVIF/WebP
-- where supported. sort_order 0 is the hero (is_primary = 1).
-- DELETE-then-INSERT scoped to ER products only, so re-running replaces rather
-- than duplicates.
-- ===========================================================================

DELETE pi FROM product_images pi
  JOIN products p ON p.id = pi.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-1.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-2.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-3.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-4.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-1.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-2.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-3.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-4.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-1.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-2.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-3.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-4.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-5.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-6.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-7.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-1.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-2.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-3.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-4.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-5.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-6.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-7.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-1.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-2.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-3.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-4.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-1.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-2.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-3.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-4.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-1.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-2.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-3.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-1.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-2.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-3.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, bridge configuration', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-4.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, bridge configuration', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-1.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-2.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-3.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, bridge configuration', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-4.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, bridge configuration', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-4.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-4.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-4.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, catalogue photo', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, showroom photograph', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, showroom photograph', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-1.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-2.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-3.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-4.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-5.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-6.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-1.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-2.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-3.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-4.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-5.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-6.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-7.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, showroom photograph', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-1.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-2.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-3.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-4.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-5.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-6.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-1.jpg', 'Kensington 42 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-2.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-3.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-4.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-5.jpg', 'Kensington 42 inch bathroom vanity in Bright White, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-6.jpg', 'Kensington 42 inch bathroom vanity in Bright White, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-7.jpg', 'Kensington 42 inch bathroom vanity in Bright White, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 42 inch bathroom vanity in Bright White, showroom photograph', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-1.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-2.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-3.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-4.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-5.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-6.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-7.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-8.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-1.jpg', 'Kensington 48 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-2.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-3.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-4.jpg', 'Kensington 48 inch bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-5.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-6.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-7.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-8.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 48 inch bathroom vanity in Bright White, showroom photograph', 8, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-1.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-2.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-3.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-4.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-1.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-2.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-3.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-4.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-1.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-2.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-3.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-4.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-1.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-2.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-3.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, showroom photograph', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-1.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-2.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-3.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-4.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-1.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-2.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-3.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-4.jpg', 'Kensington 72 inch bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 72 inch bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-1.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-2.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-3.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-4.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-1.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-2.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-3.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-1.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-2.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-3.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-1.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-2.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-3.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-4.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-5.jpg', 'London 30 inch bathroom vanity in Desert Oak, composite view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-1.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-2.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-3.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-4.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, composite view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-1.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-2.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-3.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-1.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-2.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-3.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-4.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-1.jpg', 'London 48 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-2.jpg', 'London 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-3.jpg', 'London 48 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-1.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-2.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-3.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-1.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-2.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-3.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-1.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-2.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-3.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-4.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, composite view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-1.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-2.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-3.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-1.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-2.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-3.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-4.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-5.jpg', 'London 72 inch bathroom vanity in Desert Oak, composite view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-1.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-2.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-3.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-1.jpg', 'Oxford 30 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-2.jpg', 'Oxford 30 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-3.jpg', 'Oxford 30 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-4.jpg', 'Oxford 30 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-1.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-2.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-3.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-4.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-1.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-2.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-3.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-4.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-5.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-1.jpg', 'Oxford 36 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-2.jpg', 'Oxford 36 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-3.jpg', 'Oxford 36 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-1.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-2.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-3.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-4.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-1.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-2.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-3.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-4.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-5.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-1.jpg', 'Oxford 42 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-2.jpg', 'Oxford 42 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-3.jpg', 'Oxford 42 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-4.jpg', 'Oxford 42 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-1.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-2.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-3.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-4.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-1.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-2.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-3.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-4.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-5.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-6.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-7.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-1.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-2.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-3.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-4.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-1.jpg', 'Oxford 48 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-2.jpg', 'Oxford 48 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-3.jpg', 'Oxford 48 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-4.jpg', 'Oxford 48 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-1.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-2.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-3.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-4.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-5.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-6.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-7.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-1.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-2.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-3.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-1.jpg', 'Windsor 30 inch bathroom vanity in Bright White, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-2.jpg', 'Windsor 30 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-3.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-4.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-5.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-8.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-9.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-10.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-11.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-navy-blue-6.jpg', 'Windsor 36 inch right drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-navy-blue-7.jpg', 'Windsor 36 inch right drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-8.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-9.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-10.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-11.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-1.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-2.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-3.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-4.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-5.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-6.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-1.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-2.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-3.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-4.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-5.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-6.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-1.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-2.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-3.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-4.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-1.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-2.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-3.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-1.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-2.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-3.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-4.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-1.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-2.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-3.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-4.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-1.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-2.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-3.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-4.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-1.jpg', 'Windsor 72 inch bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-2.jpg', 'Windsor 72 inch bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-3.jpg', 'Windsor 72 inch bathroom vanity in Bright White, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-4.jpg', 'Windsor 72 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-1.jpg', 'Windsor lc inch bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-2.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-3.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-4.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-metal-gray-1.jpg', 'Kensington 23 inch bridge drawer in Metal Gray, shown between two vanities', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-metal-gray-2.jpg', 'Kensington 23 inch bridge drawer in Metal Gray, shown between two vanities', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-bright-white-1.jpg', 'Kensington 23 inch bridge drawer in Bright White, shown between two vanities', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-bright-white-2.jpg', 'Kensington 23 inch bridge drawer in Bright White, shown between two vanities', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-4.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-5.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, styled room photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0972';

-- VERIFY step 4 — expect 341 rows and exactly one primary per product.
SELECT COUNT(*) AS image_rows FROM product_images pi
  JOIN products p ON p.id = pi.product_id WHERE p.brand = 'ER Vanities';

SELECT p.sku, COUNT(*) AS imgs, SUM(pi.is_primary) AS primaries
  FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
 WHERE p.brand = 'ER Vanities'
 GROUP BY p.id HAVING primaries <> 1 OR imgs = 0;
-- ^ expect ONE row: Windsor-35.5L-NVBLU-BG, which has no imagery yet.


