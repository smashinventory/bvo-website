-- ======================================================================
--  2026-09-26_email_template_diagnose_READONLY.sql
--
--  READ ONLY. Every statement is a SELECT. Nothing is written.
--
--  WHY
--  016_email_templates.sql wrote bodies of 1,500-5,000 characters with
--  full inline styling. Today CHAR_LENGTH reports:
--
--      order_confirmed        3842   (016 wrote 4969  -> -1127)
--      vanity_in_preparation   487
--      order_shipped           520
--      out_for_delivery        347
--      order_delivered         403
--      review_request          553
--      cross_sell              440
--      return_approved         475
--      return_resolved         471
--
--  016's own verification expected "every body well over 1,000
--  characters". Eight of nine are a third of that. Yet 016's TEXT is
--  present (the stale-claim probe matched), so 016 did apply and
--  something has removed roughly a quarter of order_confirmed and most
--  of the other eight since.
--
--  HYPOTHESIS ALREADY RULED OUT
--  "The admin editor strips inline styles on save." It does not.
--  emailTemplatesController.save() is trim() then a plain parameterised
--  UPDATE - no sanitiser, no strip_tags, no DOMPurify anywhere in src/.
--  So whatever shortened these did not come through that route.
--
--  REMAINING CANDIDATES, in the order this file tests them
--    a) body_html is a smaller column type than 016 assumed. 016 has
--       CREATE TABLE IF NOT EXISTS, so if the table already existed with
--       a TEXT or even TINYTEXT body_html, the CREATE was skipped and
--       every long body was TRUNCATED on write. In non-strict mode MySQL
--       truncates with a warning, not an error - 016 would have reported
--       success. Tested first because it is cheap and it is the only
--       candidate that would make the fix an ALTER rather than copy.
--       WEAK on the evidence: truncation at a fixed cap would pile
--       several rows at exactly that cap, and these nine lengths are all
--       different and all well under any text type. Query 0.
--
--    b) STRONGEST. 016 only ever partly applied. Its own header records
--       that v2 replaced order_confirmed ALONE before v3 did all nine.
--       phpMyAdmin stops the whole paste at the first error, so if
--       statement 2 (vanity_in_preparation) failed, order_confirmed
--       would have landed and the other eight would still be their
--       original August copy - which is exactly the shape of the data:
--       one long body carrying 016 text, eight short ones that never
--       received it. order_confirmed being 3842 rather than 4969 is then
--       either a later hand edit or a revision to 016 on disk after it
--       was run. Queries 1, 2 and 5, plus updated_at.
--
--    c) Whitespace was normalised somewhere in the round trip, which
--       alone defeats a REPLACE() whose search string spans lines, and
--       would explain the failed match WITHOUT any content loss.
--       Query 4.
--
--  WHAT TURNS ON THE ANSWER
--  Under (b) the eight short templates never got their delivery-receipt
--  clause, their inspection instructions or their claim windows. That
--  copy is not decoration: it decides who absorbs a damaged $2,500
--  vanity. order_shipped and out_for_delivery are the two that carry it
--  closest to the moment a customer signs. Query 5 checks whether any of
--  it is present in order_confirmed; if the answer is broadly NO across
--  the short eight as well, the real task is reapplying 016 properly,
--  and the authorization wording is a footnote to that.
-- ======================================================================

-- 0. Column type. SHOW COLUMNS, not information_schema: selecting from
--    information_schema switches phpMyAdmin's active database, and every
--    query after it then runs there and fails with
--    "#1109 Unknown table 'email_templates' in information_schema".
--    Read the Type column for body_html. longtext or text is fine.
SHOW COLUMNS FROM email_templates;

-- 1. How much styling survives per template.
--    016 gave every body 15-40 style="" attributes and a wrapping
--    <div style="font-family:Helvetica...">. Zero style attributes on a
--    400-character body is the strip hypothesis confirmed.
SELECT
  trigger_key,
  CHAR_LENGTH(body_html)                                          AS body_len,
  (CHAR_LENGTH(body_html) - CHAR_LENGTH(REPLACE(body_html,'style=','')))  / 6 AS style_attrs,
  (CHAR_LENGTH(body_html) - CHAR_LENGTH(REPLACE(body_html,'<p','')))      / 2 AS p_tags,
  CASE WHEN body_html LIKE '%font-family:Helvetica%' THEN 'yes' ELSE 'NO' END AS has_wrapper,
  CASE WHEN body_html LIKE '%bathroomvanitiesoutlet.com/pages/%' THEN 'yes' ELSE 'NO' END AS has_footer_links,
  CASE WHEN body_html LIKE '%The BVO Team%'         THEN 'yes' ELSE 'NO' END AS has_signoff,
  updated_at
FROM email_templates
ORDER BY id;

-- 2. The exact markup around the order total, which is what change 1
--    failed to match. Shows whether the style attribute is gone, altered,
--    or the line was reworded.
SELECT
  SUBSTRING(body_html,
            GREATEST(1, LOCATE('Order total', body_html) - 160),
            420) AS markup_around_order_total
FROM email_templates
WHERE trigger_key = 'order_confirmed';

-- 3. The exact item-6 paragraph, which change 2 failed to match even
--    though the stale-claim probe found its text. So the paragraph is
--    present but its surrounding markup or whitespace differs.
SELECT
  SUBSTRING(body_html,
            GREATEST(1, LOCATE('charge it when your order is confirmed', body_html) - 220),
            600) AS markup_around_item_6
FROM email_templates
WHERE trigger_key = 'order_confirmed';

-- 4. Whitespace normalisation check. A saved-through-an-editor body often
--    has its newlines collapsed, which alone would defeat a REPLACE()
--    whose search string spans lines.
SELECT
  trigger_key,
  (CHAR_LENGTH(body_html) - CHAR_LENGTH(REPLACE(body_html,'\n','')))   AS newlines,
  (CHAR_LENGTH(body_html) - CHAR_LENGTH(REPLACE(body_html,'\r','')))   AS carriage_returns,
  CASE WHEN body_html LIKE '%  %' THEN 'yes' ELSE 'NO' END             AS has_double_spaces
FROM email_templates
ORDER BY id;

-- 5. Which of 016's six numbered warnings still exist in order_confirmed.
--    The delivery-receipt clause decides who absorbs a damaged $2,500
--    vanity. If it is gone, that is the most expensive thing on this page.
SELECT
  CASE WHEN body_html LIKE '%Nobody home when the truck arrives%'   THEN 'yes' ELSE 'NO' END AS w1_nobody_home,
  CASE WHEN body_html LIKE '%Signing before you look%'              THEN 'yes' ELSE 'NO' END AS w2_signing,
  CASE WHEN body_html LIKE '%deny the claim%'                       THEN 'yes' ELSE 'NO' END AS w2_deny_claim,
  CASE WHEN body_html LIKE '%Breaking down the crate too soon%'     THEN 'yes' ELSE 'NO' END AS w3_crate,
  CASE WHEN body_html LIKE '%Telling us too late%'                  THEN 'yes' ELSE 'NO' END AS w4_windows,
  CASE WHEN body_html LIKE '%Losing track of the return window%'    THEN 'yes' ELSE 'NO' END AS w5_returns,
  CASE WHEN body_html LIKE '%A charge that looks wrong%'            THEN 'yes' ELSE 'NO' END AS w6_charge
FROM email_templates
WHERE trigger_key = 'order_confirmed';

-- 6. Every template's variables, so a later fix does not reintroduce one
--    no caller supplies. substituteVars() renders an unknown {{var}} as
--    an empty string with no error.
SELECT trigger_key,
       CASE WHEN body_html LIKE '%{{customer_first_name}}%'    THEN 'y' ELSE '-' END AS first_name,
       CASE WHEN body_html LIKE '%{{order_number}}%'           THEN 'y' ELSE '-' END AS order_number,
       CASE WHEN body_html LIKE '%{{order_items_html}}%'       THEN 'y' ELSE '-' END AS items_html,
       CASE WHEN body_html LIKE '%{{order_total}}%'            THEN 'y' ELSE '-' END AS order_total,
       CASE WHEN body_html LIKE '%{{estimated_ship_window}}%'  THEN 'y' ELSE '-' END AS ship_window,
       CASE WHEN body_html LIKE '%{{product_name}}%'           THEN 'y' ELSE '-' END AS product_name,
       CASE WHEN body_html LIKE '%{{tracking_url}}%'           THEN 'y' ELSE '-' END AS tracking_url,
       CASE WHEN body_html LIKE '%{{ra_number}}%'              THEN 'y' ELSE '-' END AS ra_number
FROM email_templates
ORDER BY id;
