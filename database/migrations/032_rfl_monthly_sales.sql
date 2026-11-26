-- ─────────────────────────────────────────────────────────────────────────
-- 032_rfl_monthly_sales.sql
--
-- RFL showroom sales, monthly, for overlay on the WC drawdown trend chart.
--
-- WHY MONTHLY AND NOT DAILY
--   The WC series is daily (observed-day normalised). RFL's is not, and will
--   not be: the two sources are a GVS Shopify export (pre-2024) and an RFLPOS
--   export (2024-01 forward), and neither is being wired up as a live feed —
--   this is loaded by hand, every so often, by decision (same posture as the
--   WC snapshots; see WC_REPORTS_SPEC §9). Monthly is the finest grain that
--   survives both sources, so the overlay is drawn at M/Q/Y granularity only
--   and is absent at D/W. That is a deliberate silence, not a gap to fill
--   with interpolation.
--
-- WHY A UNITS PROXY AND NOT UNITS
--   RFL reports dollars, not WC vanity unit counts. Units are derived as
--   net_sales / avg_unit_price, with the divisor held in ONE place in
--   wcReportsController (RFL_UNIT_PRICE) so it can be retuned without
--   touching data. Non-vanity categories (tile, flooring, faucets) run under
--   10% of revenue and are left in; they shift the level slightly and do not
--   shift the shape, which is what the chart is read for.
--
-- WHY source IS NOT COSMETIC
--   The pre-2024 GVS Shopify figures are of materially lower quality than the
--   RFLPOS ones (see WC_MARKET_ANALYSIS §1: a 2.5x level shift across a pure
--   system change, 85% of revenue with blank title/vendor/type, one
--   undifferentiated POS location across two store openings). Recording which
--   system each month came from means the chart can mark the seam rather than
--   present one continuous line of two different things.
--
-- One row per (month, store, source). store is free text rather than an enum
-- because the showroom list has already changed once and will change again.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfl_monthly_sales (
  month       DATE          NOT NULL,              -- always the 1st of the month
  store       VARCHAR(64)   NOT NULL,              -- 'Roswell' | 'Kennesaw' | ...
  source      VARCHAR(24)   NOT NULL,              -- 'gvs_shopify' | 'rflpos'
  net_sales   DECIMAL(12,2) NOT NULL,
  units       INT               NULL,              -- real unit count when the
                                                   -- export carries one; the
                                                   -- proxy is only used when
                                                   -- this is NULL
  note        VARCHAR(255)      NULL,
  loaded_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, store, source),
  INDEX idx_rms_month (month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
