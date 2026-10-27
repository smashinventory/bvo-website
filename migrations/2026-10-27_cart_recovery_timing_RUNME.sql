-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_cart_recovery_timing_RUNME.sql
-- The recovery email claimed a timeframe it cannot know.
--
-- THE DEFECT, FOUND BY SENDING ONE. The body opened with "You were
-- setting this up a couple of days ago". The first real send went out to
-- a cart that was MINUTES old — and with MIN_AGE_HOURS = 4 in
-- src/jobs/cartRecovery.js, the common case is hours, not days. Every
-- early recovery email therefore opens with something the recipient knows
-- to be false, in the first sentence, before the part that is true.
--
-- ⚠️ NO GATE COULD HAVE CAUGHT THIS. The phrase is valid HTML, renders
-- correctly, substitutes nothing, and is internally consistent. It is
-- wrong only against a fact that lives in a different file — the age
-- window in the job. The only thing that found it was sending one and
-- reading it. Recorded here because the lesson generalises: a template
-- gate proves a template is well-formed, never that it is true.
--
-- ── WHY NOT A VARIABLE ─────────────────────────────────────────────────
-- The obvious alternative is passing the real age as {{cart_age}}. It was
-- rejected: substituteVars has no conditionals, so "4 hours" / "1 day" /
-- "9 days" would need pluralisation and rounding in the job, and the
-- reader gains nothing from being told when they shopped. Removing the
-- claim is strictly better than computing it correctly.
--
-- Owner's wording, 2026-10-27.
--
-- ── WHAT IS DELIBERATELY NOT CHANGED ───────────────────────────────────
-- The specialist block still says "Choosing a vanity is easier...". The
-- first send was a FAUCET, so that line was category-wrong in exactly the
-- way review_request's subject is. Owner's call the same day: leave it.
-- Noted so the next person sees it was considered, not missed.
--
-- ⚠️ SURVEY FIRST, THEN TARGET. On 2026-10-27 a blanket REPLACE across
-- email_templates rewrote 'cross_sell', whose "the mirror that was made
-- for your vanity" was correct and deliberate. This file scopes every
-- write to trigger_key = 'cart_recovery' and changes ONE sentence.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: LOOK FIRST ─────────────────────────────────────────────────
-- Expect exactly 1 row with has_old_phrase = 1. If it is already 0 this
-- migration has run; stop, nothing to do.
SELECT id, trigger_key, is_active,
       body_html LIKE '%a couple of days ago%' AS has_old_phrase,
       body_html LIKE '%shopping session was interrupted%' AS has_new_phrase
  FROM email_templates
 WHERE trigger_key = 'cart_recovery';


-- ── STEP 2: PROVE THE SCOPE BEFORE WRITING ─────────────────────────────
-- Which OTHER templates contain the phrase? Expect zero rows. If any come
-- back, they are NOT touched by Step 3 — the WHERE pins it to one
-- trigger_key — but you should know they exist before deciding.
SELECT id, trigger_key, subject
  FROM email_templates
 WHERE body_html LIKE '%a couple of days ago%'
   AND trigger_key <> 'cart_recovery';


-- ── STEP 3: THE ONE SENTENCE ───────────────────────────────────────────
-- REPLACE, not a rewrite of body_html: everything else in the template —
-- the specialist block, the offer, the footer — is untouched and stays
-- exactly as reviewed.
UPDATE email_templates
   SET body_html = REPLACE(
         body_html,
         'You were setting this up a couple of days ago, and we have kept it ready for you:',
         'We see that your shopping session was interrupted, and we have kept your cart ready for you:'
       )
 WHERE trigger_key = 'cart_recovery';


-- ── STEP 4: PROVE IT ───────────────────────────────────────────────────
-- Expect: old_phrase_should_be_0 = 0, has_new_phrase = 1, and the three
-- unrelated blocks all still 1. That last part is the check that matters:
-- it proves the REPLACE changed one sentence and nothing else.
SELECT id, trigger_key, is_active,
       body_html LIKE '%a couple of days ago%'             AS old_phrase_should_be_0,
       body_html LIKE '%shopping session was interrupted%' AS has_new_phrase,
       body_html LIKE '%bathroom specialist%'              AS specialist_intact,
       body_html LIKE '%{{offer_url}}%'                    AS offer_intact,
       body_html LIKE '%{{unsubscribe_url}}%'              AS unsub_intact
  FROM email_templates
 WHERE trigger_key = 'cart_recovery';
