-- ════════════════════════════════════════════════════════════════════
-- Delivery location: a third option for commercial addresses with no
-- dock. Owner-approved 2026-09-28.
--
-- WHY THIS IS NOT A COPY CHANGE
--
-- Page 1 offered two choices: residential, or "Commercial — a business
-- with a loading dock or forklift". An office, studio or retail unit is
-- commercial and has neither, so there was no true answer available.
--
-- And shippingController derived the carrier booking from that field:
--
--     residential: order.ship_address_type === 'residential'
--
-- Residential is what puts a LIFTGATE on the truck. So a dockless
-- commercial address booked a shipment with no liftgate — the driver
-- arrives with a 200-400 lb crate and nothing to unload it with. That
-- is a redelivery, a storage fee, and a customer who answered the
-- question as honestly as the form allowed.
--
-- The field was carrying two independent facts: who is at the address
-- (residential surcharge) and whether they can get it off the truck
-- (liftgate). Three values separate them:
--
--     residential          liftgate,  residential
--     commercial_no_dock   liftgate,  NOT residential
--     commercial_dock      no liftgate, NOT residential
--
-- ────────────────────────────────────────────────────────────────────
-- WHY A COLUMN WIDTH CHANGE IS NEEDED AT ALL
--
-- ship_address_type is VARCHAR(16), from
-- 2026-09-26_ship_to_columns_RUNME.sql. 'commercial_no_dock' is 18
-- characters. Without this, MySQL would either truncate it to
-- 'commercial_no_do' or reject the insert depending on strict mode —
-- and a silent truncation is the worse of the two, because
-- deliveryLocation.normalise() would then fall back to 'residential'
-- and quietly book a residential surcharge on a commercial address.
--
-- ────────────────────────────────────────────────────────────────────
-- EXISTING ROWS ARE DELIBERATELY NOT MIGRATED
--
-- Rows holding plain 'commercial' stay as they are.
-- deliveryLocation.js maps that value to commercial_dock at READ time,
-- which preserves what those buyers were actually told: the button they
-- clicked said "with a loading dock or forklift".
--
-- Rewriting them would be worse in both directions. Mapping them to
-- commercial_no_dock would retroactively add liftgates to historical
-- shipments and change what those orders mean; mapping them to
-- commercial_dock in the data would lose the fact that they predate the
-- distinction. Read-time normalisation keeps the history honest.
--
-- MariaDB 11.8.9. No IF NOT EXISTS on MODIFY, but MODIFY is idempotent:
-- setting a column to the type it already has is a no-op.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  MODIFY COLUMN ship_address_type VARCHAR(32) NULL;

-- Same field, saved-address side. CustomerAddress.record() writes the
-- buyer's choice here for prefill, so it needs the same room or a
-- returning customer's commercial_no_dock comes back truncated.
ALTER TABLE customer_addresses
  MODIFY COLUMN address_type VARCHAR(32) NULL;

-- ── VERIFY ──────────────────────────────────────────────────────────
-- Expect varchar(32) for both. SHOW COLUMNS, not INFORMATION_SCHEMA:
-- this host denies that database (#1044) and the denial aborts the rest
-- of the file.
SHOW COLUMNS FROM orders LIKE 'ship_address_type';
SHOW COLUMNS FROM customer_addresses LIKE 'address_type';

-- What is actually stored today. Expect 'residential' and 'commercial',
-- plus NULLs from drafts that never reached page 1's submit. The two
-- new values appear only from the next order onwards.
SELECT ship_address_type, COUNT(*) AS n
  FROM orders GROUP BY ship_address_type ORDER BY n DESC;
