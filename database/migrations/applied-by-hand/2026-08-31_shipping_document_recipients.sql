-- ═══════════════════════════════════════════════════════════════════
-- 2026-08-31 — shipping document email recipients
--
-- Internal distribution list for shipping paperwork (BOL, pallet label,
-- packing list) emailed from BVO to our own stores via Brevo.
--
-- This is NOT customer-facing and has nothing to do with WWEX. WWEX has
-- no API to email a BOL (confirmed by their support), and their carrier
-- tracking alerts are a separate mechanism configured at booking time.
--
-- Separate addresses with commas, semicolons or newlines.
-- Leaving this empty is fine — staff can type recipients per send.
-- ═══════════════════════════════════════════════════════════════════

-- ── Set the store distribution list ────────────────────────────────
-- EDIT THE ADDRESSES BELOW before running.
INSERT INTO app_settings (`key`, value)
VALUES ('shipping_document_recipients', 'store1@bathroomvanitiesoutlet.com, store2@bathroomvanitiesoutlet.com')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- ── Verify ─────────────────────────────────────────────────────────
SELECT `key`, value
FROM app_settings
WHERE `key` = 'shipping_document_recipients';

-- ── To change the list later ───────────────────────────────────────
-- UPDATE app_settings
--    SET value = 'a@example.com, b@example.com, c@example.com'
--  WHERE `key` = 'shipping_document_recipients';

-- ── To disable the default list entirely ───────────────────────────
-- (the Email button still works; staff just type recipients each time)
-- UPDATE app_settings SET value = '' WHERE `key` = 'shipping_document_recipients';
