-- ═══════════════════════════════════════════════════════════════════
-- Shipments table — WWEX SpeedShip V4 integration
-- Run once against the BVO production database.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shipments (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Link to internal order (nullable — some shipments are standalone)
  order_id                INT UNSIGNED NULL,

  -- WWEX identifiers
  product_transaction_id  VARCHAR(100) NOT NULL,
  -- pickup_txn_id: the pickup transaction id returned by quoteOrderFlow.
  -- REQUIRED to void an LTL shipment — WWEX rejects a cancel that sends only
  -- the shipment id with "LTL does not support shipment only cancel".
  pickup_txn_id           VARCHAR(100) NULL,
  offer_id                VARCHAR(100) NULL,
  product_type            ENUM('LTL','SMALLPACK') NOT NULL DEFAULT 'LTL',

  -- Shipping documents
  bol_number              VARCHAR(60)  NULL,
  pro_number              VARCHAR(60)  NULL,
  bol_url                 VARCHAR(500) NULL,
  pickup_confirmation     VARCHAR(100) NULL,

  -- Carrier / service
  carrier                 VARCHAR(100) NULL,
  service_level           VARCHAR(100) NULL,
  total_charge            DECIMAL(10,2) NULL,

  -- ⚠️ THIS IS AN ENUM IN PRODUCTION, NOT A VARCHAR.
  -- This file previously declared VARCHAR(30), which does not match the live
  -- table. The distinction matters: writing a value outside an ENUM does NOT
  -- error — MySQL in non-strict mode stores an EMPTY STRING. That row then
  -- falls outside every status filter and silently disappears from the UI and
  -- the status poll. It happened: an 'out_for_delivery' value was introduced,
  -- the column rejected it, and a shipment ended up with status ''.
  --
  -- If you add a value here you MUST also ALTER the live table, and update
  -- SHIPMENT_STATUSES in both src/controllers/shippingController.js and
  -- src/jobs/shipmentStatusPoll.js.
  status                  ENUM('booked','in_transit','delivered','exception','voided')
                          NOT NULL DEFAULT 'booked',

  -- Origin (our warehouse — usually pre-filled from config)
  origin_company          VARCHAR(150) NULL,
  origin_city             VARCHAR(80)  NULL,
  origin_state            VARCHAR(10)  NULL,
  origin_zip              VARCHAR(20)  NULL,

  -- Destination (customer)
  dest_company            VARCHAR(150) NULL,
  dest_name               VARCHAR(150) NULL,
  dest_address1           VARCHAR(200) NULL,
  dest_city               VARCHAR(80)  NULL,
  dest_state              VARCHAR(10)  NULL,
  dest_zip                VARCHAR(20)  NULL,
  dest_phone              VARCHAR(30)  NULL,
  dest_email              VARCHAR(150) NULL,

  -- Timestamps
  ship_date               DATE         NULL,
  est_delivery            DATE         NULL,
  delivered_at            DATE         NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_order_id           (order_id),
  INDEX idx_bol_number         (bol_number),
  INDEX idx_pro_number         (pro_number),
  INDEX idx_product_txn        (product_transaction_id),
  INDEX idx_status             (status),
  INDEX idx_created            (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
