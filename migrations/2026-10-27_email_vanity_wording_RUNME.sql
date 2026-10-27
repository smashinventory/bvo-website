-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_email_vanity_wording_RUNME.sql
-- "your vanity" → "your dream vanity or related item"
--
-- Owner's wording, 2026-10-27: vanities are the main product and
-- everything we sell relates to one, so the phrase reads correctly
-- whether the box holds a vanity, a faucet, a mirror or a stone sample.
--
-- ── WHY THIS MATTERS ───────────────────────────────────────────────────
-- 'out_for_delivery' is ACTIVE and its subject is hardcoded:
--     "Today is the day — your vanity arrives today 🎉"
-- A customer who ordered faucets gets told their vanity arrives today.
--
-- ── WHAT THIS DOES *NOT* TOUCH ─────────────────────────────────────────
-- ⚠️ {{product_name}} IS LEFT ALONE WHEREVER IT APPEARS. That placeholder
-- is filled with the REAL item name, which is always better than a
-- generic phrase. The code-side FALLBACK for when no name can be read is
-- what changed (src/services/orderEmails.js, PRODUCT_FALLBACK) — it used
-- to be 'your vanity'. Replacing {{product_name}} with a fixed phrase
-- would make every email LESS specific, not more correct.
--
-- ⚠️ THE trigger_key 'vanity_in_preparation' IS NOT RENAMED. The key is
-- looked up by brevoService and by ordersController.sendVendorOrder;
-- renaming it in one place silently stops that email sending. Only
-- customer-visible TEXT changes here.
--
-- ── RUN STEP 1 FIRST AND READ IT ───────────────────────────────────────
-- MariaDB's REPLACE() is CASE SENSITIVE. 'Your vanity' and 'your vanity'
-- are different strings and Step 3 only handles the lowercase form, by
-- design — a capitalised one at the start of a sentence needs different
-- wording, not a blind swap. Step 1 shows you which you have.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: SURVEY — what actually says "vanity" today ─────────────────
-- Read every row this returns BEFORE running Step 2 or 3. Note which
-- hits are in a subject vs a body, and which are capitalised.
SELECT id, trigger_key, is_active,
       subject,
       CHAR_LENGTH(body_html)                              AS body_len,
       subject    LIKE BINARY '%your vanity%'              AS subj_lower,
       subject    LIKE BINARY '%Your vanity%'              AS subj_upper,
       body_html  LIKE BINARY '%your vanity%'              AS body_lower,
       body_html  LIKE BINARY '%Your vanity%'              AS body_upper
  FROM email_templates
 WHERE subject LIKE '%vanity%' OR body_html LIKE '%vanity%'
 ORDER BY id;


-- ── STEP 2: THE ONE SUBJECT WE KNOW EXACTLY ────────────────────────────
-- Set outright rather than REPLACE()d: the current value is known in
-- full, so an exact assignment cannot half-match or double-apply.
-- Guarded by the old value, so re-running this is a no-op rather than a
-- second substitution.
UPDATE email_templates
   SET subject = 'Today is the day — your dream vanity or related item arrives today 🎉'
 WHERE trigger_key = 'out_for_delivery'
   AND subject     = 'Today is the day — your vanity arrives today 🎉';
-- Expect: 1 row affected the first time, 0 every time after.


-- ── STEP 3: THE LOWERCASE PHRASE EVERYWHERE ELSE ───────────────────────
-- ⚠️ ORDER MATTERS. Run Step 2 BEFORE this one. If Step 3 ran first it
-- would already have rewritten the out_for_delivery subject, and Step 2's
-- guard would then match nothing — leaving you unsure whether it worked.
--
-- Idempotent, and that was CHECKED rather than assumed: the replacement
-- 'your dream vanity or related item' does NOT contain the substring
-- 'your vanity' ("dream" sits between the two words), so a second run
-- matches nothing and cannot nest the phrase inside itself.
UPDATE email_templates
   SET subject   = REPLACE(subject,   'your vanity', 'your dream vanity or related item'),
       body_html = REPLACE(body_html, 'your vanity', 'your dream vanity or related item')
 WHERE subject LIKE BINARY '%your vanity%'
    OR body_html LIKE BINARY '%your vanity%';


-- ── STEP 4: PROVE IT ───────────────────────────────────────────────────
-- Expect ZERO rows. Any row returned still says the bare phrase —
-- most likely capitalised, which Step 3 deliberately does not touch.
-- Reword those by hand in Admin → Email Templates.
SELECT id, trigger_key, subject
  FROM email_templates
 WHERE subject   LIKE BINARY '%your vanity%'
    OR body_html LIKE BINARY '%your vanity%';

-- And confirm the new phrase landed. Expect at least the
-- out_for_delivery row.
SELECT id, trigger_key, is_active, subject
  FROM email_templates
 WHERE subject   LIKE '%dream vanity or related item%'
    OR body_html LIKE '%dream vanity or related item%'
 ORDER BY id;
