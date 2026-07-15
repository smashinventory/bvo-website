'use strict';

/**
 * James Martin Etail Feed Importer
 * ─────────────────────────────────
 * Reads the James Martin XLSX and upserts every row into the BVO schema.
 * JM's taxonomy is treated as canonical — no mapping layer required.
 *
 * Usage:
 *   node src/jobs/importJamesMartinFeed.js <path-to-xlsx>          # full import
 *   node src/jobs/importJamesMartinFeed.js <path-to-xlsx> --dry    # dry run (no DB writes)
 *   node src/jobs/importJamesMartinFeed.js <path-to-xlsx> --sku=123-456  # single SKU
 *
 * Prerequisites:
 *   npm install xlsx            (SheetJS — reads .xlsx)
 *   Migration 003 applied to DB
 */

require('dotenv').config();
const path    = require('path');
const fs      = require('fs');
const XLSX    = require('xlsx');
const { bvoPool }                  = require('../config/database');
const { normalize: normalizeColor } = require('../config/colorFamilies');

// ── CLI args ──────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const xlsxPath = args.find(a => !a.startsWith('--'));
const DRY     = args.includes('--dry');
const SKU_FILTER = (args.find(a => a.startsWith('--sku=')) || '').replace('--sku=', '') || null;

if (!xlsxPath) {
  console.error('Usage: node importJamesMartinFeed.js <path-to-xlsx> [--dry] [--sku=ITEM_NUMBER]');
  process.exit(1);
}
if (!fs.existsSync(xlsxPath)) {
  console.error(`File not found: ${xlsxPath}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────
const slugify = s => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const yesNo = v => {
  const s = String(v || '').trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === '1' || s === 'true' ? 1 : 0;
};

const ltlMap = v => {
  const s = String(v || '').trim().toLowerCase();
  return s === 'ltl' || s.includes('ltl') ? 1 : 0;
};

const statusMap = v => {
  const s = String(v || '').trim().toLowerCase();
  if (s.includes('discontinu'))   return 'discontinued';
  if (s.includes('coming'))       return 'coming_soon';
  if (s.includes('special'))      return 'special_order';
  return 'active';
};

const cleanNum = v => {
  const n = parseFloat(String(v || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
};

const cleanDate = v => {
  if (!v) return null;
  try {
    // Excel serial number or string date
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  } catch { return null; }
};

const clean = v => (v === undefined || v === null) ? null : String(v).trim() || null;

// ── Shipping box column parser ────────────────────────────────────────
// Pattern: "{ComponentType} Box {N} Shipping {Height|Width|Depth|Gross Weight|Cubes}"
//          (some cols have different order, e.g. "Backsplash Box 1 Cubes")
const COMPONENT_TYPES = [
  'Vanity Cabinet', 'Vanity Top', 'Sink', 'Mirror', 'Vanity Base',
  'Backsplash', 'Bench', 'Storage Cabinet', 'Shelf', 'Drawer Unit',
  'Pulls', 'Linen Cabinet', 'Hutch', 'Knobs and Legs',
];

function parseBoxColumn(colName) {
  for (const ct of COMPONENT_TYPES) {
    const re = new RegExp(`^${ct} Box (\\d)\\s+(.+)$`, 'i');
    const m  = colName.match(re);
    if (m) {
      const boxNum = parseInt(m[1], 10);
      const dim    = m[2].trim().toLowerCase();
      let field;
      if (dim.includes('height'))       field = 'ship_height_in';
      else if (dim.includes('width'))   field = 'ship_width_in';
      else if (dim.includes('depth'))   field = 'ship_depth_in';
      else if (dim.includes('weight'))  field = 'gross_weight_lbs';
      else if (dim.includes('cube'))    field = 'cubes';
      else return null;
      return { component_type: ct, box_number: boxNum, field };
    }
  }
  return null;
}

// ── Image columns ─────────────────────────────────────────────────────
// First "Images" col = sort_order 0 (primary). "Images.N" = sort_order N+1.
function getImageSortOrder(colName) {
  if (colName === 'Images') return 0;
  const m = colName.match(/^Images\.(\d+)$/);
  return m ? parseInt(m[1], 10) + 1 : null;
}

// ── DB helpers ────────────────────────────────────────────────────────
async function query(sql, params = []) {
  if (DRY) { return [[], []]; }
  return bvoPool.query(sql, params);
}

async function upsertCollection(conn, name, brand, description) {
  if (!name) return null;
  const slug = slugify(name);
  await conn.query(`
    INSERT INTO collections (slug, name, brand, description)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name=VALUES(name), brand=VALUES(brand), description=COALESCE(VALUES(description), description)
  `, [slug, name, brand || 'James Martin', description || null]);
  const [[row]] = await conn.query('SELECT id FROM collections WHERE slug = ?', [slug]);
  return row ? row.id : null;
}

async function upsertProduct(conn, data) {
  // data.sku is required
  await conn.query(`
    INSERT INTO products (
      sku, vendor_sku, name, brand, price, compare_price,
      description, product_type, component_role, vendor_group_id,
      category_id, collection_id,
      upc, country_origin, warranty, lead_time_days,
      ships_ltl, freight_class, harmonized_code, total_ship_weight_lbs,
      prop65, release_date, status,
      model, color, color_family,
      is_active, is_new, is_featured, qty_on_hand
    ) VALUES (
      :sku, :vendor_sku, :name, :brand, :price, :compare_price,
      :description, :product_type, :component_role, :vendor_group_id,
      :category_id, :collection_id,
      :upc, :country_origin, :warranty, :lead_time_days,
      :ships_ltl, :freight_class, :harmonized_code, :total_ship_weight_lbs,
      :prop65, :release_date, :status,
      :model, :color, :color_family,
      :is_active, :is_new, :is_featured, :qty_on_hand
    )
    ON DUPLICATE KEY UPDATE
      vendor_sku         = VALUES(vendor_sku),
      name               = VALUES(name),
      brand              = VALUES(brand),
      price              = VALUES(price),
      compare_price      = VALUES(compare_price),
      description        = VALUES(description),
      product_type       = VALUES(product_type),
      component_role     = VALUES(component_role),
      vendor_group_id    = VALUES(vendor_group_id),
      category_id        = VALUES(category_id),
      collection_id      = VALUES(collection_id),
      upc                = VALUES(upc),
      country_origin     = VALUES(country_origin),
      warranty           = VALUES(warranty),
      lead_time_days     = VALUES(lead_time_days),
      ships_ltl          = VALUES(ships_ltl),
      freight_class      = VALUES(freight_class),
      harmonized_code    = VALUES(harmonized_code),
      total_ship_weight_lbs = VALUES(total_ship_weight_lbs),
      prop65             = VALUES(prop65),
      release_date       = VALUES(release_date),
      status             = VALUES(status),
      model              = VALUES(model),
      color              = VALUES(color),
      color_family       = VALUES(color_family),
      is_active          = VALUES(is_active),
      updated_at         = CURRENT_TIMESTAMP
  `, data);

  const [[row]] = await conn.query('SELECT id FROM products WHERE sku = ?', [data.sku]);
  return row ? row.id : null;
}

async function replaceAttr(conn, productId, attrKey, valueText, valueNum) {
  if (valueText === null && valueNum === null) return;
  // color_family was dropped from product_attribute_values in migration 009;
  // it now lives as products.color_family (set at upsert time via normalizeColor).
  await conn.query(`
    INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      value_text = VALUES(value_text),
      value_num  = VALUES(value_num)
  `, [productId, attrKey, valueText, valueNum]);
}

async function replaceBullets(conn, productId, bullets) {
  await conn.query('DELETE FROM product_bullets WHERE product_id = ?', [productId]);
  for (const b of bullets) {
    if (b.text) {
      await conn.query(
        'INSERT INTO product_bullets (product_id, sort_order, bullet_text) VALUES (?, ?, ?)',
        [productId, b.order, b.text]
      );
    }
  }
}

async function replaceImages(conn, productId, images) {
  // Only replace if there are images in the feed row; don't wipe manually-added images
  const validImages = images.filter(i => i.url && i.url.startsWith('http'));
  if (!validImages.length) return;
  await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  for (const img of validImages) {
    await conn.query(
      'INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES (?, ?, ?, ?)',
      [productId, img.url, img.sort_order, img.sort_order === 0 ? 1 : 0]
    );
  }
}

async function replaceShippingBoxes(conn, productId, boxes) {
  await conn.query('DELETE FROM product_shipping_boxes WHERE product_id = ?', [productId]);
  for (const box of boxes) {
    if (Object.values(box).some(v => v !== null && v !== undefined && v !== box.component_type && v !== box.box_number)) {
      await conn.query(`
        INSERT INTO product_shipping_boxes
          (product_id, component_type, box_number, ship_height_in, ship_width_in, ship_depth_in, gross_weight_lbs, cubes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [productId, box.component_type, box.box_number,
          box.ship_height_in || null, box.ship_width_in || null, box.ship_depth_in || null,
          box.gross_weight_lbs || null, box.cubes || null]);
    }
  }
}

async function replaceCerts(conn, productId, certs) {
  await conn.query('DELETE FROM product_certifications WHERE product_id = ?', [productId]);
  for (const cert of certs) {
    if (cert.cert_number || cert.expires_at) {
      await conn.query(`
        INSERT INTO product_certifications (product_id, cert_type, cert_number, factory_ref, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `, [productId, cert.cert_type, cert.cert_number || null, cert.factory_ref || null, cert.expires_at || null]);
    }
  }
}

async function replaceDocs(conn, productId, docs) {
  await conn.query('DELETE FROM product_documents WHERE product_id = ?', [productId]);
  for (const doc of docs) {
    if (doc.url && doc.url.startsWith('http')) {
      await conn.query(
        'INSERT INTO product_documents (product_id, doc_type, url) VALUES (?, ?, ?)',
        [productId, doc.doc_type, doc.url]
      );
    }
  }
}

async function replaceComponents(conn, sku, components) {
  await conn.query('DELETE FROM product_components WHERE parent_sku = ?', [sku]);
  for (const c of components) {
    if (c.component_sku) {
      await conn.query(`
        INSERT IGNORE INTO product_components (parent_sku, component_sku, component_role, seq)
        VALUES (?, ?, ?, ?)
      `, [sku, c.component_sku, c.component_role, c.seq || 1]);
    }
  }
}

async function replaceAccessories(conn, sku, accessories) {
  await conn.query('DELETE FROM product_accessories WHERE product_sku = ?', [sku]);
  for (const a of accessories) {
    if (a) {
      await conn.query(`
        INSERT IGNORE INTO product_accessories (product_sku, accessory_sku) VALUES (?, ?)
      `, [sku, a]);
    }
  }
}

// ── Resolve category_id from JM Product Type string ──────────────────
// Routes on Product Type column (2026 feed) — far more granular than
// the old Product Category column ("General Products" contained
// everything: vanities, mirrors, tops, hutches).
//
// Category IDs match the seeded categories table:
//   migration 001 → 1=Vanities, 2=Mirrors, 3=Faucets,
//                   4=Accessories, 5=Lighting, 6=Storage
//   migration 010 → 7=Vanity Tops
const PRODUCT_TYPE_MAP = {
  // Vanities (1)
  'vanity':            1,
  'floating console':  1,
  'console':           1,
  'console base':      1,
  // Mirrors (2)
  'mirror':            2,
  // Vanity Tops (7 — added migration 010)
  'top':               7,
  'countertop unit':   7,
  // Storage (6)
  'cabinet':           6,
  'side cabinet':      6,
  'storage cabinet':   6,
  'linen cabinet':     6,
  'hutch':             6,
  'shelf':             6,
  // Accessories (4)
  'backsplash':        4,
  'drawer unit':       4,
  'metal base':        4,
  'knobs and legs':    4,
  'pull':              4,
  'bench':             4,
};

function resolveCategoryId(productTypeStr) {
  const s = String(productTypeStr || '').toLowerCase().trim();
  // Exact match first — prevents "cabinet" from swallowing "linen cabinet" etc.
  if (PRODUCT_TYPE_MAP[s] !== undefined) return PRODUCT_TYPE_MAP[s];
  // Substring fallback for future Product Type variants
  for (const [key, id] of Object.entries(PRODUCT_TYPE_MAP)) {
    if (s.includes(key)) return id;
  }
  return 1; // default: vanities
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[JM Importer] Reading: ${path.basename(xlsxPath)}`);
  if (DRY) console.log('[JM Importer] *** DRY RUN — no DB writes ***\n');

  const wb   = XLSX.readFile(xlsxPath, { cellDates: false });
  const ws   = wb.Sheets['Etail Products'];
  if (!ws) { console.error('Sheet "Etail Products" not found'); process.exit(1); }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  console.log(`[JM Importer] ${rows.length} rows found`);

  const conn = DRY ? null : await bvoPool.getConnection();
  let imported = 0, skipped = 0, errors = 0;

  for (const rawRow of rows) {
    // Normalize row keys — trim leading/trailing whitespace so column
    // name discrepancies between feed versions don't cause silent misses.
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([k, v]) => [k.trim(), v])
    );

    const itemNumber = clean(row['Item Number']);
    if (!itemNumber) { skipped++; continue; }
    if (SKU_FILTER && itemNumber !== SKU_FILTER) continue;

    // Skip discontinued (unless it's a known active SKU we want to mark discontinued)
    const rowStatus = statusMap(row['Item Status']);

    try {
      // ── Collection ─────────────────────────────────────────────
      let collectionId = null;
      if (!DRY) {
        collectionId = await upsertCollection(
          conn,
          clean(row['Collection Name']),
          clean(row['Mfg Name']) || 'James Martin',
          clean(row['One Paragraph Collection Description'])
        );
      }

      // ── Resolve product type ────────────────────────────────────
      // Vanity Type is more specific; use it when present
      const vanityType    = clean(row['Vanity Type']);
      const productTypRaw = clean(row['Product Type']);
      const productType   = slugify(vanityType || productTypRaw || '');

      // Routing: resolve BVO category from JM Product Type (2026 feed)
      const categoryId = resolveCategoryId(productTypRaw);
      // Samples (Wood/Stone/Metal) are catalogue reference items — import inactive
      const isSample   = /sample/i.test(productTypRaw || '');

      // ── SKU: use Item Number as the canonical SKU ───────────────
      const sku       = itemNumber;
      const vendorSku = itemNumber;  // same for JM; future vendors may differ

      // ── Product core data ───────────────────────────────────────
      const rawColor = clean(row['Vanity Base Color/Finish']);
      const productData = {
        sku,
        vendor_sku:       vendorSku,
        name:             clean(row['Product Name']),
        brand:            clean(row['Mfg Name']) || 'James Martin',
        price:            cleanNum(row['MAP Price']),
        compare_price:    cleanNum(row['MSRP']),
        description:      clean(row['One Paragraph Product Description']),
        product_type:     productType,
        component_role:   clean(row['Group/Component']),
        vendor_group_id:  clean(row['Group Number']),
        category_id:      categoryId,
        collection_id:    collectionId,
        upc:              clean(row['UPC Code']),
        country_origin:   clean(row['Country of Origin']),
        warranty:         clean(row['Product Warranty']),
        lead_time_days:   cleanNum(row['In Stock Lead Time']),
        ships_ltl:        ltlMap(row['Ships LTL or Ground?']),
        freight_class:    clean(row['Freight Class']),
        harmonized_code:  clean(row['Harmonized Code']),
        total_ship_weight_lbs: cleanNum(row['Total Shipping Weight']),
        prop65:           yesNo(row['Prop 65 Warning? (Y/N)']),
        release_date:     cleanDate(row['Release Date']),
        status:           rowStatus,
        // Denormalized color columns (migration 009 — live on products table)
        model:            clean(row['Collection Name']),
        color:            rawColor,
        color_family:     rawColor ? (normalizeColor(rawColor) || null) : null,
        is_active:        (isSample || rowStatus !== 'active') ? 0 : 1,
        is_new:           0,
        is_featured:      0,
        qty_on_hand:      0,   // stock comes from RFLPOS sync, not JM feed
      };

      let productId = null;
      if (!DRY) {
        productId = await upsertProduct(conn, productData);
        if (!productId) throw new Error(`Could not get product ID for SKU ${sku}`);
      }

      if (DRY) {
        console.log(`  [DRY] Would import: ${sku} — ${productData.name}`);
        imported++;
        continue;
      }

      // ── EAV Attributes ─────────────────────────────────────────
      const attrMap = {
        'Vanity Base Color/Finish':    ['cabinet_finish',      'text'],
        'Finish/Color of Product':     ['finish',              'text'],
        'Distressed Finish? (Y/N)':   ['distressed_finish',   'bool'],
        'Hardware Finish':             ['hardware_finish',     'text'],
        'Vanity Countertop Material ': ['countertop_material', 'text'],
        'Countertop Finish':           ['countertop_finish',   'text'],
        'Countertop Thickness':        ['countertop_thickness','num'],
        'Primary Construction Material': ['primary_material',  'text'],
        'Construction Material':       ['construction_material','text'],
        'Product Height':              ['height_in',           'num'],
        'Product Width':               ['size_in',             'num'],
        'Product Depth':               ['depth_in',            'num'],
        'Product Weight':              ['weight_lbs',          'num'],
        'Assembly Required? (Y/N)':   ['assembly_required',   'bool'],
        'Number of Shelves':           ['num_shelves',         'num'],
        'Adjustable Shelves (Y/N)':   ['adjustable_shelves',  'bool'],
        'Number of Doors':             ['num_doors',           'num'],
        'Soft Close Hinges? (Y/N)':   ['soft_close_hinges',   'bool'],
        'Number of Drawers':           ['drawer_count',        'num'],
        'Number of Tip Out Style Drawers': ['tip_out_drawers', 'num'],
        'Soft Close Slides? (Y/N)':   ['soft_close_slides',   'bool'],
        'Backsplash Included? (Y/N)': ['backsplash_included', 'bool'],
        'Backsplash Material':         ['backsplash_material', 'text'],
        'Drawer Organizer':            ['drawer_organizer',    'text'],
        'Number of Sinks Included (0, 1, or 2)': ['sink_count', 'num'],
        'Bowl Shape':                  ['bowl_shape',          'text'],
        'Sink has Overflow Drain?':   ['sink_overflow',       'bool'],
        'Drain Included?':             ['drain_included',      'bool'],
        'Sink Installation Type ':     ['sink_installation',   'text'],
        'Sink Material ':              ['sink_material',       'text'],
        'Sink Back to Front':          ['sink_depth_in',       'num'],
        'Sink Width':                  ['sink_width_in',       'num'],
        'Sink Depth':                  ['sink_basin_depth_in', 'num'],
        'Center to Center Hole Spacing (Spacing from furthest left Faucet Handle to Furthest Right Faucet Handle)':
                                       ['faucet_spread_in',   'num'],
        'ADA Compliant?':              ['ada_compliant',       'bool'],
        ' Electrical component (Y/N)': ['has_electrical',      'bool'],
        'FreePower Compatible?':        ['freepower_compatible',         'bool'],
        'Wireless Charging Unit (Y/N)':['wireless_charging',            'bool'],
        'Wireless Charging Unit FC Certified?': ['wireless_charging_fc_certified', 'bool'],
        'Wireless Charging Unit UL Certification': ['wireless_charging_ul',        'text'],
        'Theme (Contemporary/Modern, Transitional, Traditional, or Commercial)':
                                       ['style',               'text'],
        'Vanity Type':                 ['vanity_type',         'text'],
        'Substitute SKU (If Applicable)': ['substitute_sku',  'text'],
        'Includes Makeup Counter and Top (Y/N)': ['has_makeup_counter', 'bool'],
      };

      for (const [jmCol, [attrKey, type]] of Object.entries(attrMap)) {
        const raw = row[jmCol];
        if (raw === null || raw === undefined || raw === '') continue;
        let textVal = null, numVal = null;
        if (type === 'bool') {
          numVal = yesNo(raw);
          textVal = numVal ? 'Yes' : 'No';
        } else if (type === 'num') {
          numVal = cleanNum(raw);
          textVal = numVal !== null ? String(numVal) : null;
        } else {
          textVal = clean(raw);
        }
        await replaceAttr(conn, productId, attrKey, textVal, numVal);
      }

      // ── Derived attributes not directly in attrMap ────────────────

      // mount_type is cabinet-specific (wall-mount vs freestanding);
      // sink_included also applies to tops (integrated sink vs slab only).
      if (categoryId === 1) {
        // mount_type: derive from product_type slug
        //   wall-mount-vanity → 'Wall-Mount'
        //   everything else   → 'Freestanding'
        if (productType) {
          const mountType = /wall/i.test(productType) ? 'Wall-Mount' : 'Freestanding';
          await replaceAttr(conn, productId, 'mount_type', mountType, null);
        }

      }

      // sink_included: applies to vanities (combos vs cabinet-only)
      // AND tops (integrated sink slab vs countertop-only).
      if (categoryId === 1 || categoryId === 7) {
        const rawSinkCount = cleanNum(row['Number of Sinks Included (0, 1, or 2)']);
        if (rawSinkCount !== null) {
          await replaceAttr(conn, productId, 'sink_included', rawSinkCount > 0 ? 'Yes' : 'No', null);
        }
      }

      // ── Bullet features ─────────────────────────────────────────
      const bullets = [];
      for (let i = 1; i <= 12; i++) {
        const text = clean(row[`Bullet Feature ${i}`]);
        if (text) bullets.push({ order: i, text });
      }
      await replaceBullets(conn, productId, bullets);

      // ── Images ──────────────────────────────────────────────────
      const images = [];
      // First image column
      if (row['Images']) images.push({ url: clean(row['Images']), sort_order: 0 });
      // Images.1 through Images.29
      for (let i = 1; i <= 29; i++) {
        const url = clean(row[`Images.${i}`]);
        if (url) images.push({ url, sort_order: i });
      }
      await replaceImages(conn, productId, images);

      // ── Shipping boxes ───────────────────────────────────────────
      // Collect all box data into a map keyed by "componentType|boxNumber"
      const boxMap = {};
      for (const colName of Object.keys(row)) {
        const parsed = parseBoxColumn(colName);
        if (!parsed) continue;
        const key = `${parsed.component_type}|${parsed.box_number}`;
        if (!boxMap[key]) boxMap[key] = { component_type: parsed.component_type, box_number: parsed.box_number };
        boxMap[key][parsed.field] = cleanNum(row[colName]);
      }
      await replaceShippingBoxes(conn, productId, Object.values(boxMap));

      // ── Certifications ───────────────────────────────────────────
      const certDefs = [
        {
          cert_type:   'UL',
          cert_number: clean(row['James Martin UL Part Number']) || clean(row['UL Part Number']),
          factory_ref: null,
          expires_at:  cleanDate(row['UL Factory/Expiration Date']),
          has:         yesNo(row['UL Certification?']),
        },
        {
          cert_type:   'UPC',
          cert_number: clean(row['UPC Part Number']),
          factory_ref: null,
          expires_at:  cleanDate(row['UPC Factory/Expiration Date']),
          has:         yesNo(row['UPC Certification?']),
        },
        {
          cert_type:   'CUPC',
          cert_number: clean(row['CUPC Part Number']),
          factory_ref: null,
          expires_at:  cleanDate(row['CUPC Factory/Expiration Date']),
          has:         yesNo(row['CUPC Certification?']),
        },
      ];
      const certs = certDefs.filter(c => c.has || c.cert_number || c.expires_at);
      await replaceCerts(conn, productId, certs);

      // ── Documents ────────────────────────────────────────────────
      const docDefs = [
        { doc_type: 'spec_sheet',              url: clean(row['SPEC Sheet']) },
        { doc_type: 'top_spec_sheet',          url: clean(row['Top SPEC Sheet']) },
        { doc_type: 'component_spec_sheet',    url: clean(row['Component SPEC Sheet']) },
        { doc_type: 'assembly_instructions',   url: clean(row['Assembly Instructions']) },
        { doc_type: 'assembly_instructions_2', url: clean(row['Assembly Instructions.1']) },
      ];
      await replaceDocs(conn, productId, docDefs);

      // ── Component cross-references ───────────────────────────────
      const components = [
        { component_sku: clean(row['Top Reference SKU 1']),       component_role: 'top',       seq: 1 },
        { component_sku: clean(row['Top Reference SKU 2']),       component_role: 'top',       seq: 2 },
        { component_sku: clean(row['Sink Reference SKU']),        component_role: 'sink',      seq: 1 },
        { component_sku: clean(row['Component 1 Reference SKU']), component_role: 'component', seq: 1 },
        { component_sku: clean(row['Component 2 Reference SKU']), component_role: 'component', seq: 2 },
      ].filter(c => c.component_sku);
      await replaceComponents(conn, sku, components);

      // ── Accessories ──────────────────────────────────────────────
      const accRaw = clean(row['Optional Accessories (Part numbers that would be good accessories for this product)']);
      const accessories = accRaw ? accRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      await replaceAccessories(conn, sku, accessories);

      imported++;
      if (imported % 50 === 0) console.log(`  [JM Importer] ${imported} records processed...`);

    } catch (err) {
      console.error(`  [ERROR] SKU ${itemNumber}: ${err.message}`);
      errors++;
    }
  }

  if (conn) conn.release();
  await bvoPool.end();

  console.log(`\n[JM Importer] Done.`);
  console.log(`  Imported : ${imported}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Errors   : ${errors}`);
  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
