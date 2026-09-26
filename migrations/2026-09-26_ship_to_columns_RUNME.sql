-- Ship-to details captured at checkout.
--
-- RUN IN THE SQL TAB, NOT THE IMPORT TAB, AND CLICK THE DATABASE IN THE
-- LEFT SIDEBAR FIRST.
--
-- 2026-09-26: run through Import while information_schema happened to be
-- the active database. Every ALTER resolved against that schema and was
-- denied, phpMyAdmin reported "Import has been successfully finished, 4
-- queries executed", and not one column was added. A statement that fails
-- while the page says success is the worst failure mode there is - the SQL
-- tab reports each statement separately.
--
-- Applied successfully 2026-09-26 with the correct database selected.
--
-- Pure ASCII, one statement per line, no em-dashes or box characters - a
-- previous migration was silently truncated on paste because of them.
--
-- IF NOT EXISTS makes every line idempotent: re-running is a no-op, not an
-- error, so a partial paste can simply be run again.
--
-- ship_address1/2, ship_city, ship_state, ship_zip ALREADY EXIST. They are
-- read by shippingController when booking WWEX and have never been written
-- by the checkout - that is the bug this closes. Nothing is added for them.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_phone VARCHAR(32) NULL AFTER ship_last_name;

-- residential | commercial. NULL means the customer was never asked, which
-- is every order placed before this ships - distinct from an explicit answer.
-- Carriers surcharge residential delivery and guess wrong when nobody says.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address_type VARCHAR(16) NULL AFTER ship_zip;

-- 1 when the customer typed a separate ship-to, 0 when it was copied from
-- billing by the default checkbox. Without this the two are indistinguishable
-- later, and a copied address would look like a confirmed one.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER ship_address_type;

-- Verify.
--
-- SHOW COLUMNS, not a SELECT against INFORMATION_SCHEMA.COLUMNS. The
-- Hostinger app user has no rights on information_schema and that query
-- returns #1044 Access denied - which looks like the migration failed
-- when in fact the ALTERs above have already succeeded. SHOW COLUMNS
-- needs only rights on the table itself.
SHOW COLUMNS FROM orders LIKE 'ship%';
