'use strict';

/**
 * James Martin Etail Feed — core importer
 * ────────────────────────────────────────
 * Exports importFromWorkbook() for use by the admin route
 * (POST /admin/products/import-jm) and by the CLI shim at
 * the project root.
 *
 * CONNECTION NOTE: Always runs server-side using the Express
 * app's bvoPool — do NOT run this as a standalone local script.
 * Local .env has DB_HOST=127.0.0.1 which has no MySQL.
 * The admin UI route at /admin/products/import-jm is the correct
 * way to trigger imports; it uses the server's existing bvoPool.
 *
 * CLI usage (on the server only):
 *   node src/jobs/importJamesMartinFeed.js <path-to-xlsx> [--dry] [--sku=ITEM#]
 */

const XLSX                               = require('xlsx');
const { bvoPool }                        = require('../config/database');
const { normalize: normalizeColor }      = require('../config/colorFamilies');

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

// ── DB helpers ────────────────────────────────────────────────────────
async function upsertCollection(conn, name, brand, description) {
  if (!name) return null;
  const slug = slugify(name);
  await conn.query(`
    INSERT INTO collections (slug, name, brand, description)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name=VALUES(name), brand=VALUES(brand),
      description=COALESCE(VALUES(description), description)
  `, [slug, name, brand || 'James Martin', description || null]);
  const [[row]] = await conn.query('SELECT id FROM collections WHERE slug = ?', [slug]);
  return row ? row.id : null;
}

async function upsertProduct(conn, data) {
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
      vendor_sku            = VALUES(vendor_sku),
      name                  = VALUES(name),
      brand                 = VALUES(brand),
      price                 = VALUES(price),
      compare_price         = VALUES(compare_price),
      description           = VALUES(description),
      product_type          = VALUES(product_type),
      component_role        = VALUES(component_role),
      vendor_group_id       = VALUES(vendor_group_id),
      category_id           = VALUES(category_id),
      collection_id         = VALUES(collection_id),
      upc                   = VALUES(upc),
      country_origin        = VALUES(country_origin),
      warranty              = VALUES(warranty),
      lead_time_days        = VALUES(lead_time_days),
      ships_ltl             = VALUES(ships_ltl),
      freight_class         = VALUES(freight_class),
      harmonized_code       = VALUES(harmonized_code),
      total_ship_weight_lbs = VALUES(total_ship_weight_lbs),
      prop65                = VALUES(prop65),
      release_date          = VALUES(release_date),
      status                = VALUES(status),
      model                 = VALUES(model),
      color                 = VALUES(color),
      color_family          = VALUES(color_family),
      is_active             = VALUES(is_active),
      updated_at            = CURRENT_TIMESTAMP
  `, data);
  const [[row]] = await conn.query('SELECT id FROM products WHERE sku = ?', [data.sku]);
  return row ? row.id : null;
}

async function replaceAttr(conn, productId, attrKey, valueText, valueNum) {
  if (valueText === null && valueNum === null) return;
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
      await conn.query(
        'INSERT IGNORE INTO product_accessories (product_sku, accessory_sku) VALUES (?, ?)',
        [sku, a]
      );
    }
  }
}

// ── Category routing ──────────────────────────────────────────────────
// Routes on Product Type column (2026 feed). Category IDs:
//   migration 001 → 1=Vanities, 2=Mirrors, 3=Faucets,
//                   4=Accessories, 5=Lighting, 6=Storage
//   migration 010 → 7=Vanity Tops
const PRODUCT_TYPE_MAP = {
  'vanity':            1,
  'floating console':  1,
  'console':           1,
  'console base':      1,
  'mirror':            2,
  'top':               7,
  'countertop unit':   7,
  'cabinet':           6,
  'side cabinet':      6,
  'storage cabinet':   6,
  'linen cabinet':     6,
  'hutch':             6,
  'shelf':             6,
  'backsplash':        4,
  'drawer unit':       4,
  'metal base':        4,
  'knobs and legs':    4,
  'pull':              4,
  'bench':             4,
};

function resolveCategoryId(productTypeStr) {
  const s = String(productTypeStr || '').toLowerCase().trim();
  if (PRODUCT_TYPE_MAP[s] !== undefined) return PRODUCT_TYPE_MAP[s];
  for (const [key, id] of Object.entries(PRODUCT_TYPE_MAP)) {
    if (s.includes(key)) return id;
  }
  return 1;
}

// ── EAV attribute map ─────────────────────────────────────────────────
const ATTR_MAP = {
  'Vanity Base Color/Finish':    ['cabinet_finish',               'text'],
  'Finish/Color of Product':     ['finish',                       'text'],
  'Distressed Finish? (Y/N)':   ['distressed_finish',            'bool'],
  'Hardware Finish':             ['hardware_finish',              'text'],
  'Vanity Countertop Material ': ['countertop_material',          'text'],
  'Countertop Finish':           ['countertop_finish',            'text'],
  'Countertop Thickness':        ['countertop_thickness',         'num'],
  'Primary Construction Material': ['primary_material',           'text'],
  'Construction Material':       ['construction_material',        'text'],
  'Product Height':              ['height_in',                    'num'],
  'Product Width':               ['size_in',                      'num'],
  'Product Depth':               ['depth_in',                     'num'],
  'Product Weight':              ['weight_lbs',                   'num'],
  'Assembly Required? (Y/N)':   ['assembly_required',            'bool'],
  'Number of Shelves':           ['num_shelves',                  'num'],
  'Adjustable Shelves (Y/N)':   ['adjustable_shelves',           'bool'],
  'Number of Doors':             ['num_doors',                    'num'],
  'Soft Close Hinges? (Y/N)':   ['soft_close_hinges',            'bool'],
  'Number of Drawers':           ['drawer_count',                 'num'],
  'Number of Tip Out Style Drawers': ['tip_out_drawers',          'num'],
  'Soft Close Slides? (Y/N)':   ['soft_close_slides',            'bool'],
  'Backsplash Included? (Y/N)': ['backsplash_included',          'bool'],
  'Backsplash Material':         ['backsplash_material',          'text'],
  'Drawer Organizer':            ['drawer_organizer',             'text'],
  'Number of Sinks Included (0, 1, or 2)': ['sink_count',        'num'],
  'Bowl Shape':                  ['bowl_shape',                   'text'],
  'Sink has Overflow Drain?':   ['sink_overflow',                'bool'],
  'Drain Included?':             ['drain_included',               'bool'],
  'Sink Installation Type ':     ['sink_installation',            'text'],
  'Sink Material ':              ['sink_material',                'text'],
  'Sink Back to Front':          ['sink_depth_in',                'num'],
  'Sink Width':                  ['sink_width_in',                'num'],
  'Sink Depth':                  ['sink_basin_depth_in',          'num'],
  'Center to Center Hole Spacing (Spacing from furthest left Faucet Handle to Furthest Right Faucet Handle)':
                                 ['faucet_spread_in',             'num'],
  'ADA Compliant?':              ['ada_compliant',                'bool'],
  ' Electrical component (Y/N)': ['has_electrical',               'bool'],
  'FreePower Compatible?':        ['freepower_compatible',        'bool'],
  'Wireless Charging Unit (Y/N)':['wireless_charging',           'bool'],
  'Wireless Charging Unit FC Certified?': ['wireless_charging_fc_certified', 'bool'],
  'Wireless Charging Unit UL Certification': ['wireless_charging_ul',        'text'],
  'Theme (Contemporary/Modern, Transitional, Traditional, or Commercial)':
                                 ['style',                        'text'],
  'Vanity Type':                 ['vanity_type',                  'text'],
  'Substitute SKU (If Applicable)': ['substitute_sku',            'text'],
  'Includes Makeup Counter and Top (Y/N)': ['has_makeup_counter', 'bool'],
};

// ── Core import function (used by admin route AND CLI) ────────────────
/**
 * Process a parsed XLSX workbook and import to DB via bvoPool.
 *
 * @param {object} wb          - SheetJS workbook object
 * @param {object} [opts]
 * @param {boolean} [opts.dry] - dry run: log rows, skip DB writes
 * @param {string}  [opts.skuFilter] - import only this SKU
 * @param {Function} [opts.onProgress] - callback(imported, total) for progress
 * @returns {{ imported, skipped, errors, errorList }}
 */
async function importFromWorkbook(wb, opts = {}) {
  const { dry = false, skuFilter = null, onProgress = null } = opts;

  const ws = wb.Sheets['Etail Products'];
  if (!ws) throw new Error('Sheet "Etail Products" not found in workbook');

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  const total = rows.length;

  const conn      = dry ? null : await bvoPool.getConnection();
  let imported    = 0;
  let skipped     = 0;
  let errors      = 0;
  const errorList = [];

  try {
    for (const rawRow of rows) {
      const row = Object.fromEntries(
        Object.entries(rawRow).map(([k, v]) => [k.trim(), v])
      );

      const itemNumber = clean(row['Item Number']);
      if (!itemNumber) { skipped++; continue; }
      if (skuFilter && itemNumber !== skuFilter) continue;

      const rowStatus = statusMap(row['Item Status']);

      try {
        // ── Collection ──────────────────────────────────────────────
        let collectionId = null;
        if (!dry) {
          collectionId = await upsertCollection(
            conn,
            clean(row['Collection Name']),
            clean(row['Mfg Name']) || 'James Martin',
            clean(row['One Paragraph Collection Description'])
          );
        }

        // ── Product type + category routing ─────────────────────────
        const vanityType    = clean(row['Vanity Type']);
        const productTypRaw = clean(row['Product Type']);
        const productType   = slugify(vanityType || productTypRaw || '');
        const categoryId    = resolveCategoryId(productTypRaw);
        const isSample      = /sample/i.test(productTypRaw || '');

        const sku       = itemNumber;
        const vendorSku = itemNumber;

        // ── Product core data ────────────────────────────────────────
        const rawColor = clean(row['Vanity Base Color/Finish']);
        const productData = {
          sku,
          vendor_sku:            vendorSku,
          name:                  clean(row['Product Name']),
          brand:                 clean(row['Mfg Name']) || 'James Martin',
          price:                 cleanNum(row['MAP Price']),
          compare_price:         cleanNum(row['MSRP']),
          description:           clean(row['One Paragraph Product Description']),
          product_type:          productType,
          component_role:        clean(row['Group/Component']),
          vendor_group_id:       clean(row['Group Number']),
          category_id:           categoryId,
          collection_id:         collectionId,
          upc:                   clean(row['UPC Code']),
          country_origin:        clean(row['Country of Origin']),
          warranty:              clean(row['Product Warranty']),
          lead_time_days:        cleanNum(row['In Stock Lead Time']),
          ships_ltl:             ltlMap(row['Ships LTL or Ground?']),
          freight_class:         clean(row['Freight Class']),
          harmonized_code:       clean(row['Harmonized Code']),
          total_ship_weight_lbs: cleanNum(row['Total Shipping Weight']),
          prop65:                yesNo(row['Prop 65 Warning? (Y/N)']),
          release_date:          cleanDate(row['Release Date']),
          status:                rowStatus,
          model:                 clean(row['Collection Name']),
          color:                 rawColor,
          color_family:          rawColor ? (normalizeColor(rawColor) || null) : null,
          is_active:             (isSample || rowStatus !== 'active') ? 0 : 1,
          is_new:                0,
          is_featured:           0,
          qty_on_hand:           0,
        };

        if (dry) {
          imported++;
          if (onProgress) onProgress(imported, total);
          continue;
        }

        const productId = await upsertProduct(conn, productData);
        if (!productId) throw new Error(`Could not get product ID for SKU ${sku}`);

        // ── EAV attributes ───────────────────────────────────────────
        for (const [jmCol, [attrKey, type]] of Object.entries(ATTR_MAP)) {
          const raw = row[jmCol];
          if (raw === null || raw === undefined || raw === '') continue;
          let textVal = null, numVal = null;
          if (type === 'bool') {
            numVal  = yesNo(raw);
            textVal = numVal ? 'Yes' : 'No';
          } else if (type === 'num') {
            numVal  = cleanNum(raw);
            textVal = numVal !== null ? String(numVal) : null;
          } else {
            textVal = clean(raw);
          }
          await replaceAttr(conn, productId, attrKey, textVal, numVal);
        }

        // ── Derived: mount_type (vanities only) ──────────────────────
        if (categoryId === 1 && productType) {
          const mountType = /wall/i.test(productType) ? 'Wall-Mount' : 'Freestanding';
          await replaceAttr(conn, productId, 'mount_type', mountType, null);
        }

        // ── Derived: sink_included (vanities + tops) ─────────────────
        if (categoryId === 1 || categoryId === 7) {
          const rawSinkCount = cleanNum(row['Number of Sinks Included (0, 1, or 2)']);
          if (rawSinkCount !== null) {
            await replaceAttr(conn, productId, 'sink_included', rawSinkCount > 0 ? 'Yes' : 'No', null);
          }
        }

        // ── Bullets ──────────────────────────────────────────────────
        const bullets = [];
        for (let i = 1; i <= 12; i++) {
          const text = clean(row[`Bullet Feature ${i}`]);
          if (text) bullets.push({ order: i, text });
        }
        await replaceBullets(conn, productId, bullets);

        // ── Images ───────────────────────────────────────────────────
        const images = [];
        if (row['Images']) images.push({ url: clean(row['Images']), sort_order: 0 });
        for (let i = 1; i <= 29; i++) {
          const url = clean(row[`Images.${i}`]);
          if (url) images.push({ url, sort_order: i });
        }
        await replaceImages(conn, productId, images);

        // ── Shipping boxes ────────────────────────────────────────────
        const boxMap = {};
        for (const colName of Object.keys(row)) {
          const parsed = parseBoxColumn(colName);
          if (!parsed) continue;
          const key = `${parsed.component_type}|${parsed.box_number}`;
          if (!boxMap[key]) boxMap[key] = { component_type: parsed.component_type, box_number: parsed.box_number };
          boxMap[key][parsed.field] = cleanNum(row[colName]);
        }
        await replaceShippingBoxes(conn, productId, Object.values(boxMap));

        // ── Certifications ────────────────────────────────────────────
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
        await replaceCerts(conn, productId, certDefs.filter(c => c.has || c.cert_number || c.expires_at));

        // ── Documents ─────────────────────────────────────────────────
        await replaceDocs(conn, productId, [
          { doc_type: 'spec_sheet',              url: clean(row['SPEC Sheet']) },
          { doc_type: 'top_spec_sheet',          url: clean(row['Top SPEC Sheet']) },
          { doc_type: 'component_spec_sheet',    url: clean(row['Component SPEC Sheet']) },
          { doc_type: 'assembly_instructions',   url: clean(row['Assembly Instructions']) },
          { doc_type: 'assembly_instructions_2', url: clean(row['Assembly Instructions.1']) },
        ]);

        // ── Component cross-references ────────────────────────────────
        const components = [
          { component_sku: clean(row['Top Reference SKU 1']),       component_role: 'top',       seq: 1 },
          { component_sku: clean(row['Top Reference SKU 2']),       component_role: 'top',       seq: 2 },
          { component_sku: clean(row['Sink Reference SKU']),        component_role: 'sink',      seq: 1 },
          { component_sku: clean(row['Component 1 Reference SKU']), component_role: 'component', seq: 1 },
          { component_sku: clean(row['Component 2 Reference SKU']), component_role: 'component', seq: 2 },
        ].filter(c => c.component_sku);
        await replaceComponents(conn, sku, components);

        // ── Accessories ───────────────────────────────────────────────
        const accRaw     = clean(row['Optional Accessories (Part numbers that would be good accessories for this product)']);
        const accessories = accRaw ? accRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        await replaceAccessories(conn, sku, accessories);

        imported++;
        if (onProgress) onProgress(imported, total);

      } catch (err) {
        const msg = `SKU ${itemNumber}: ${err.message}`;
        errorList.push(msg);
        errors++;
      }
    }
  } finally {
    if (conn) conn.release();
  }

  return { imported, skipped, errors, errorList, total };
}

module.exports = { importFromWorkbook };

// ── CLI entrypoint (server-only) ──────────────────────────────────────
if (require.main === module) {
  const path = require('path');
  const fs   = require('fs');

  const args      = process.argv.slice(2);
  const xlsxPath  = args.find(a => !a.startsWith('--'));
  const dry       = args.includes('--dry');
  const skuFilter = (args.find(a => a.startsWith('--sku=')) || '').replace('--sku=', '') || null;

  if (!xlsxPath) {
    console.error('Usage: node src/jobs/importJamesMartinFeed.js <path-to-xlsx> [--dry] [--sku=ITEM#]');
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`\n[JM Importer] Reading: ${path.basename(xlsxPath)}`);
  if (dry) console.log('[JM Importer] *** DRY RUN — no DB writes ***\n');

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });

  importFromWorkbook(wb, {
    dry,
    skuFilter,
    onProgress: (n, total) => { if (n % 50 === 0) console.log(`  ${n} / ${total} processed...`); },
  })
    .then(({ imported, skipped, errors }) => {
      console.log('\n[JM Importer] Done.');
      console.log(`  Imported : ${imported}`);
      console.log(`  Skipped  : ${skipped}`);
      console.log(`  Errors   : ${errors}`);
      process.exit(errors > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('[FATAL]', err);
      process.exit(1);
    });
}
