-- Phone extension captured at checkout.
--
-- RUN IN THE SQL TAB, NOT THE IMPORT TAB, AND CLICK THE DATABASE IN THE
-- LEFT SIDEBAR FIRST.
--
-- 2026-09-26: the previous migration was run through Import while
-- information_schema happened to be the active database. Every ALTER
-- resolved against that schema and was denied, the page reported
-- "successfully finished, 4 queries executed", and not one column was
-- added. The SQL tab reports each statement separately.
--
-- Pure ASCII, one statement per line, no em-dashes or box characters.
--
-- A separate column rather than appending to ship_phone: the extension is
-- a different fact from the number. ship_phone has to stay dialable E.164
-- for the carrier and for Stripe, and "+14045551234 x22" is neither.
-- (CLAUDE.md Rule 10 - one canonical field per fact.)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_phone_ext VARCHAR(12) NULL AFTER ship_phone;

-- Verify. SHOW COLUMNS, not INFORMATION_SCHEMA - the app user has no
-- rights there and that query returns #1044, which reads like failure.
SHOW COLUMNS FROM orders LIKE 'ship_phone%';
