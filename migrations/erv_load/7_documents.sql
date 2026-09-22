-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  CATALOGUE LOAD
-- Generated 2026-09-05 from the reviewed source files.
--
-- 78 SKUs. BVO has no product import route, so this is the load.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab. Run ONE STEP AT A TIME and
-- read the verification SELECT at the end of each before moving on. Every step
-- is idempotent: re-running it will not duplicate rows.
--
-- WHAT THE PRE-LOAD DIAGNOSTIC ESTABLISHED (run 2026-09-05):
--   * 0 of these 78 exist in BVO — clean insert, no slug collisions
--   * no 'Ethan Roth' rows exist, so no rebrand migration is needed
--   * the 4-value product_type taxonomy is LIVE, so we load into it
--   * mount_type canonical string is 'Floor Standing', not 'Freestanding'
--   * collections.slug 'bristol' is taken by James Martin (id 28)
--
-- ROLLBACK is at the bottom of this file. Read it before you start.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_ALL_TABLES';


-- ===========================================================================
-- STEP 7 — product_documents  (use manuals, 54 SKUs)
-- ---------------------------------------------------------------------------
-- Oxford and Bristol have no manufacturer manual yet, and neither do the
-- components — 24 SKUs with no row here is correct, not a gap.
-- ===========================================================================

DELETE pd FROM product_documents pd
  JOIN products p ON p.id = pd.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-48-use-manual.pdf', 'Kensington 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-48-use-manual.pdf', 'Kensington 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60d-use-manual.pdf', 'Kensington 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60d-use-manual.pdf', 'Kensington 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60s-use-manual.pdf', 'Kensington 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60s-use-manual.pdf', 'Kensington 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-72-use-manual.pdf', 'Kensington 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-72-use-manual.pdf', 'Kensington 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-24-use-manual.pdf', 'London 23.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-24-use-manual.pdf', 'London 23.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-30-use-manual.pdf', 'London 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-30-use-manual.pdf', 'London 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-36r-use-manual.pdf', 'London 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-36r-use-manual.pdf', 'London 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-48-use-manual.pdf', 'London 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-48-use-manual.pdf', 'London 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60d-use-manual.pdf', 'London 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60d-use-manual.pdf', 'London 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60s-use-manual.pdf', 'London 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60s-use-manual.pdf', 'London 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-72-use-manual.pdf', 'London 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-72-use-manual.pdf', 'London 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-30-use-manual.pdf', 'Windsor 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-30-use-manual.pdf', 'Windsor 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36l-use-manual.pdf', 'Windsor 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36l-use-manual.pdf', 'Windsor 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36r-use-manual.pdf', 'Windsor 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36r-use-manual.pdf', 'Windsor 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-48-use-manual.pdf', 'Windsor 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-48-use-manual.pdf', 'Windsor 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60d-use-manual.pdf', 'Windsor 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60s-use-manual.pdf', 'Windsor 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60s-use-manual.pdf', 'Windsor 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60d-use-manual.pdf', 'Windsor 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-72-use-manual.pdf', 'Windsor 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-72-use-manual.pdf', 'Windsor 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1019';

-- VERIFY step 7 — expect 54 rows.
SELECT COUNT(*) AS document_rows FROM product_documents pd
  JOIN products p ON p.id = pd.product_id WHERE p.brand = 'ER Vanities';


