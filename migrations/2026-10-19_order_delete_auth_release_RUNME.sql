-- ─────────────────────────────────────────────────────────────────────────
-- 2026-10-19  order deletion — record the payment state and the auth release
--
-- WHY. Deleting an order that holds an UNCAPTURED Stripe authorization left
-- the hold alive on the customer's card with the only local pointer to it
-- gone. From today the handler releases the hold first and refuses to delete
-- if Stripe declines — these columns are where that gets recorded.
--
-- HOW IT WAS FOUND. On 2026-10-14, eleven orders were deleted from the admin.
-- Ten were payment_status = 'auth_only'. All eleven recorded NULL in
-- order_deletions.stripe_payment_intent, because the snapshot line read
-- `order.stripe_payment_intent_id ?? order.stripe_payment_intent` and the
-- orders table has NEITHER column — the real one is payment_transaction_id.
--
-- No money was ever at risk: those were sandbox transactions, and Stripe
-- auto-cancels an uncaptured PaymentIntent 7 days after creation, which had
-- already happened around 2026-10-05. The code, however, cannot tell test
-- from live, and checkout has only worked since 2026-10-19.
--
-- ⚠️ THE EXISTING ELEVEN ROWS ARE DELIBERATELY NOT BACKFILLED. They are test
-- data, and their order_snapshot JSON already holds every payment_transaction_id
-- correctly — which is the whole reason the snapshot is a JSON blob of the
-- entire row rather than a set of chosen columns (see d6122ba). Repairing a
-- denormalised column on rows nobody will query is busywork; the snapshot is
-- the record of truth and it was never wrong.
-- ─────────────────────────────────────────────────────────────────────────

-- The payment state AT THE MOMENT OF DELETION, denormalised alongside
-- payment_captured_at. 'auth_only' here is the row that says "a live hold was
-- in play when this was removed" without anyone parsing JSON to find out.
ALTER TABLE `order_deletions`
  ADD COLUMN `payment_status` VARCHAR(20) NULL AFTER `payment_captured_at`;

-- Did we release the hold on the way out, and if not, why not?
--   NULL  — no authorization was in play (nothing to release)
--   1     — released successfully before the row was removed
--   0     — should not occur: the handler REFUSES to delete when the release
--           fails, so a 0 here means someone bypassed the guard. Worth
--           noticing, which is why it is recorded rather than assumed.
ALTER TABLE `order_deletions`
  ADD COLUMN `auth_released`     TINYINT(1)   NULL AFTER `payment_status`,
  ADD COLUMN `auth_release_note` VARCHAR(255) NULL AFTER `auth_released`;

-- ─────────────────────────────────────────────────────────────────────────
-- Verify:
--   SHOW COLUMNS FROM order_deletions LIKE 'payment_status';
--   SHOW COLUMNS FROM order_deletions LIKE 'auth_%';
--   -- expect three new columns, all NULL on the existing 11 rows.
--
--   -- the eleven keep their (correct) snapshots either way:
--   SELECT order_number,
--          JSON_UNQUOTE(JSON_EXTRACT(order_snapshot,'$.payment_transaction_id')) AS pi,
--          JSON_UNQUOTE(JSON_EXTRACT(order_snapshot,'$.payment_status'))         AS st
--     FROM order_deletions ORDER BY deleted_at DESC;
-- ─────────────────────────────────────────────────────────────────────────
