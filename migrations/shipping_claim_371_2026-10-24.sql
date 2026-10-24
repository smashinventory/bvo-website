-- ═══════════════════════════════════════════════════════════════════════
-- shipping_claim_371_2026-10-24.sql — task #371
--
-- "Free shipping on EVERY order" is a promise the shipping policy itself
-- contradicts: freight, remote addresses and oversized items are all
-- exceptions. The templates were corrected in code; these three strings
-- live in the `pages` table and need SQL.
--
-- RUN STEP 1 FIRST AND READ IT. Step 2 is deliberately not combined with
-- it: these are customer-facing commercial statements, and a REPLACE()
-- across a content column should never be run unseen.
--
-- ⚠️ THE BODY CHANGE MATTERS MORE THAN THE META TAG. The meta description
-- is a snippet Google shows; the body line is the actual promise a
-- customer would quote back during a dispute.
-- ═══════════════════════════════════════════════════════════════════════

-- ── STEP 1 — LOOK FIRST. Shows every row that will be touched. ─────────
SELECT id,
       slug,
       CASE WHEN meta_desc LIKE '%every order%' THEN 'META'    ELSE '' END AS in_meta,
       CASE WHEN content   LIKE '%every order%' THEN 'CONTENT' ELSE '' END AS in_body,
       meta_desc
  FROM pages
 WHERE meta_desc LIKE '%every order%'
    OR content   LIKE '%every order%';

-- Expect exactly two rows: shipping-policy (META + CONTENT) and
-- about-us (CONTENT). If you see a third, STOP and read it — a page added
-- since 2026-10-24 is making the same claim and needs its own wording,
-- not a blind find-and-replace.


-- ── STEP 2 — THE CHANGE. Run only after Step 1 looks right. ───────────
-- REPLACE() is case-SENSITIVE in MariaDB, which is why both casings are
-- handled explicitly rather than assumed. The live strings are:
--   shipping-policy meta : "liftgate on every order in the continental US"
--   shipping-policy body : "free shipping on every order, with no minimum"
--   about-us        body : "Free shipping on every order"

UPDATE pages
   SET meta_desc = REPLACE(REPLACE(meta_desc,
                     'every order', 'most orders'),
                     'Every Order', 'Most Orders')
 WHERE meta_desc LIKE '%every order%';

UPDATE pages
   SET content   = REPLACE(REPLACE(content,
                     'every order', 'most orders'),
                     'Every Order', 'Most Orders')
 WHERE content   LIKE '%every order%';


-- ── STEP 3 — PROVE IT. Must return ZERO rows. ─────────────────────────
SELECT id, slug, 'STILL CLAIMS EVERY ORDER' AS problem
  FROM pages
 WHERE meta_desc LIKE '%every order%'
    OR content   LIKE '%every order%';

-- ⚠️ "no minimum purchase" IS LEFT ALONE ON PURPOSE. It is a separate and
-- still-true claim: there is no minimum spend. Only the universality of
-- the free-shipping promise was wrong. Changing both in one pass would
-- have quietly retracted a commitment nobody asked to retract.
