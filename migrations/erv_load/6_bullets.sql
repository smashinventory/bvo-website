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
-- STEP 6 — product_bullets  (8 per SKU)
-- ===========================================================================

DELETE pb FROM product_bullets pb
  JOIN products p ON p.id = pb.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you''d reach for it, with a built-in rod for toilet paper, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you''d reach for it, with a built-in rod for toilet paper, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '24″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '24″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage generous enough to keep the room calm, with a built-in rod for toilet paper — a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding and sized to stand beside the vanity rather than crowd it — vertical storage where the floor space is doing nothing.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully built — no assembly, no flat-pack evening, just carry it in and stand it up.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1021';

-- VERIFY step 6 — expect 624 rows, 8 per product.
SELECT COUNT(*) AS bullet_rows FROM product_bullets pb
  JOIN products p ON p.id = pb.product_id WHERE p.brand = 'ER Vanities';


