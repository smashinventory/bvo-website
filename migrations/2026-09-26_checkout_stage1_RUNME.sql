-- Multi-page checkout, stage 1.
--
-- RUN IN THE SQL TAB, NOT THE IMPORT TAB, AND CLICK THE DATABASE IN THE
-- LEFT SIDEBAR FIRST. Run through Import with information_schema active
-- and every ALTER is denied while the page reports success.
--
-- Pure ASCII, one statement per line.

-- Delivery notes from the buyer: gate code, steep driveway, call ahead.
-- Free text, shown to whoever books the freight.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_instructions VARCHAR(500) NULL AFTER ship_address_confirmed;

-- Set when the buyer ticks the curbside acknowledgement on the delivery
-- page. Evidence they were told the driver stops at the driveway, which
-- is the whole defence against a refused delivery.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_terms_ack_at DATETIME NULL AFTER ship_instructions;

-- A draft is a checkout in progress: the buyer has given contact details
-- and an address but has not reached payment. Distinct from 'pending',
-- which means a Stripe session exists and the card may yet be charged.
--
-- Drafts are the abandoned-checkout population. They carry a real email,
-- so unlike the old pending-on-page-load rows they can be followed up.
--
-- Index because the admin lists and the KPI queries all filter on status
-- and would otherwise scan the table once drafts accumulate.
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_status_created (status, created_at);

-- Verify.
SHOW COLUMNS FROM orders LIKE 'ship_instructions';
SHOW COLUMNS FROM orders LIKE 'delivery_terms_ack_at';
SHOW INDEX FROM orders WHERE Key_name = 'idx_status_created';
