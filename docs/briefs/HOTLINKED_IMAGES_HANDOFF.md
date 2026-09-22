# Hotlinked Images — Replacement Handoff

> The 14 images served from hosts BVO does not control, where each one is edited, and the Bunny path to replace it with. Cutover blocker.

**Date:** 2026-09-16 · **Source:** `docs/00-start/OPEN_ITEMS.md` item 6 (list compiled 2026-09-13)

---

## Why these matter

Two different problems on one list.

**Eight are `encrypted-tbn0.gstatic.com` URLs.** Those are Google Images *cache keys*, not addresses. They rotate and expire on Google's schedule. When they go, the homepage's main category row shows blank images and nothing in any log explains it.

**Four are other retailers' bandwidth** — `lampsplus.com`, `bathvanityexperts.com`, `plumbtile.com`, `jamesmartinvanities.com`. Different exposure on a commercial storefront, and independently they can rename a file or block hotlinking whenever they like.

The product catalogue itself is clean: 56,811 `product_images` rows come from `images.salsify.com`, which ships with the JM feed, and 341 from Cloudinary. **Nothing below is feed data, so nothing below is repaired by a re-import.** Every one is hand-entered curation.

---

## A — Category cards (10) · `/admin/categories` → edit → image field

Table `categories`, column `image_url`.

Eight have a replacement already sitting in Bunny storage. Two do not.

| # | Category | Slug | Current host | Bunny object path (under `bvo-images/`) |
|---|---|---|---|---|
| 1 | Bathroom Vanities- All Products | `bathroom-vanities` | gstatic | `157-V60D-SBR-3VSL/bathroom-vanities-bristol-60-saddle-brown-157-v60d-sbr-3vsl-1.webp` |
| 2 | Bathroom Vanities With Tops | `bathroom-vanities-with-tops` | gstatic | `435-V48-HNO-3CAR/bathroom-vanities-hudson-48-honey-oak-435-v48-hno-3car-1.webp` |
| 3 | Bathroom Vanity Cabinets - Cabinet Only | `bathroom-vanity-cabinets` | gstatic | `D225-V48-SSO/bathroom-cabinet-solene-48-seaside-oak-d225-v48-sso-1.webp` |
| 4 | Bathroom Vanity Tops - Top Only | `bathroom-vanity-tops` | gstatic | `050-S60D-PHT-SNK/vanity-top-60-050-s60d-pht-snk-1.webp` |
| 5 | Bathroom Mirrors | `bathroom-mirrors` | gstatic | `105-M30-BNK/boston-30-in-rectangular-mirror-brushed-nickel-105-m30-bnk-1.webp` |
| 6 | **Faucets** | `faucets` | gstatic | **none — see "No owned image" below** |
| 7 | Storage | `storage` | gstatic | `E444-H12L-MCA/addison-12-in-d-petite-tower-hutch-left-mid-century-acacia-e444-h12l-mca-1.webp` |
| 8 | Vanity Models | `vanity-models` | gstatic | `157-V36-BW-1WZ/bathroom-vanities-bristol-36-bright-white-157-v36-bw-1wz-1.webp` |
| 9 | **Lighting** | `lighting` | image.lampsplus.com | **none — see below** |
| 10 | Samples | `samples` | www.bathvanityexperts.com | `WS-1-DRF/wood-sample-driftwood-ws-1-drf-1.webp` |

Each of those eight images was opened and looked at before being chosen. Two of the picks are deliberate rather than arbitrary:

- **#3 Cabinets** uses a shot with **no countertop** — bare carcass, open cut-outs. The category's whole claim is "cabinet only"; a cabinet photographed with a top would undermine it.
- **#7 Storage** uses the Addison hutch rather than the Milan white storage cabinet, which photographs as a plain white box and reads as nothing at card size.

---

## B — Model tile (1) · `/admin/models`

| Record | Host |
|---|---|
| Brittany / James Martin Vanities | `jamesmartinvanities.com/cdn/shop/…` |

Table `model_groups`, column `custom_image`. `og_image` on the same table returned nothing on 2026-09-13 but is a second image column and worth re-checking.

Any Brittany SKU folder in Bunny works as a replacement — e.g. `655-V72-PCN-3CAR/`.

---

## C — Product (1) · `/admin/products`

| Product | Slug | Host |
|---|---|---|
| Huntington Brass Sevaun Widespread | `huntington-brass-sevaun-widespread` | `plumbtile.com/cdn/shop/…` |

Table `products`, column `primary_image_url`.

**⚠ This one is the tip of something larger — see "Huntington Brass" below.**

---

## D — Hero (2) · Theme Editor

| Field | Host |
|---|---|
| `hero.mobile_image_url` | gstatic |
| `hero_mobile.image_url` | gstatic |

These live in `data/theme_settings.json`, **not in any table**, so the verification SQL below will never show them. Check them by eye in the Theme Editor.

Note: `data/theme_settings.json` is gitignored and restored from the DB on boot (`[theme] Settings restored from DB to disk`). Changes must be made through the Theme Editor, not by editing the file.

---

## No owned image exists — Faucets and Lighting

- **Faucets** — James Martin sells none, so there is nothing in the JM feed or in Bunny. The only faucet imagery BVO has is Huntington Brass, which is itself the hotlink problem.
- **Lighting** — no lighting products in the feed at all.

Sam's call, 2026-09-16: leave both hotlinked for now and keep them logged. They are the remaining cutover blocker after the other twelve are done.

---

## Two things needed before the eight can be written

**1. The pull-zone hostname.** `jmv_sync/bunny_upload_mac.sh` only carries the *storage* endpoint:

```
RCLONE_CONFIG_BUNNY_ACCESS_KEY_ID=bvo-images
RCLONE_CONFIG_BUNNY_ENDPOINT=https://ny-s3.storage.bunnycdn.com
RCLONE_CONFIG_BUNNY_REGION=ny
```

The public hostname (`something.b-cdn.net`, or a custom CNAME) is not recorded anywhere in the repo. It is not derivable from the storage zone name.

**2. Whether Bunny Optimizer is enabled on that zone.** These objects are full-resolution:

| card | size |
|---|---|
| Samples (WS-1-DRF) | 1,205 KB |
| Vanities With Tops (435-V48-HNO-3CAR) | 1,417 KB |
| Cabinets (D225-V48-SSO) | 1,139 KB |
| Vanities (157-V60D-SBR-3VSL) | 841 KB |
| Storage (E444-H12L-MCA) | 620 KB |
| Tops (050-S60D-PHT-SNK) | 346 KB |
| Vanity Models (157-V36-BW-1WZ) | 129 KB |
| Mirrors (105-M30-BNK) | 99 KB |

With Optimizer on, `?width=560&height=360` resizes at the edge. Without it, the Samples card ships 1.2 MB for a 280×180 box.

---

## The card is 280×180 and CROPS — this matters

`.cat-img` is `height:180px`; `.cat-img img` is `object-fit:cover`. The browser crops whatever it is given to roughly a 280×180 landscape band.

The source shots are square (3500×3500) or portrait — the Boston mirror is **3208×4808**. Dropped in at full size, that renders as a horizontal slice through the middle of the frame with the top and bottom of the mirror cut off.

So each URL needs a server-side resize to roughly 560×360 (2× for retina), padded rather than cropped.

**Reference, if Bunny turns out not to resize.** Salsify is Cloudinary-backed and these transforms are verified working as of 2026-09-16:

```
https://images.salsify.com/image/upload/s--SIGNATURE--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/ID.jpg
```

- `e_trim` strips surrounding white so the product fills the frame
- `c_pad,b_white` pads to the card aspect instead of cropping the product
- output lands at roughly 25–40 KB

**⚠ The transform MUST come after the `s--SIGNATURE--` segment.** Placed before it, Salsify returns 404. (Also recorded in OPEN_ITEMS item 3.)

A ready-to-run migration using this Salsify form already exists at
`migrations/2026-09-16_category_card_images.sql` — eight `UPDATE`s on
`categories.image_url`, same eight products as above. It can be used as-is, or
as the shape to copy when swapping the URLs for Bunny ones.

---

## ⚠ Huntington Brass — bigger than the one product on this list

`src/jobs/importHuntingtonBrass.js` pulls images from `huntingtonbrass.com/products.json` and writes them to `products.primary_image_url`. Line 32 of that file:

> *"It is deliberate here and temporary: the CDN project will fetch and re-host. `HB_IMAGE_HOST` below is the single seam for that swap."*

`HB_IMAGE_HOST = 'cdn.shopify.com'` at line 108 is that seam.

**The HB load happened after this list of 14 was compiled on 2026-09-13.** So every Huntington Brass faucet is very likely hotlinking right now and none of them is counted here. Scope that separately before assuming 14 is the number.

---

## Verify — re-run until it returns only Faucets and Lighting

Does not cover the two hero images; check those in the Theme Editor by eye.

```sql
SELECT 'category' AS what, name AS label, slug AS ref, image_url AS url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model', model_name, brand, custom_image
  FROM model_groups
 WHERE custom_image LIKE 'http%'
   AND custom_image NOT LIKE '%salsify.com%'
   AND custom_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model-og', model_name, brand, og_image
  FROM model_groups
 WHERE og_image LIKE 'http%'
   AND og_image NOT LIKE '%salsify.com%'
   AND og_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'product', name, slug, primary_image_url
  FROM products
 WHERE primary_image_url LIKE 'http%'
   AND primary_image_url NOT LIKE '%salsify.com%'
   AND primary_image_url NOT LIKE '%res.cloudinary.com%';
```

**Add a Bunny exclusion to that query once the hostname is known**, or every replacement will keep reporting itself as a problem.

---

## Where the Bunny objects come from

`jmv_sync/bunny_upload_mac.sh` rclone-copies `OnlineSmartPOS/Salsify_Masters_Native/` to `bunny:bvo-images/`, preserving structure. So local `<SKU>/<file>.webp` is object `bvo-images/<SKU>/<file>.webp`.

6,049 SKU folders on disk. Naming is `<slugified-product-name>-<lowercased-sku>-<n>.webp`, `-1` being the primary shot.

**Do not trust `Salsify_Masters_Native/_manifest_salsify.csv`** — it lists 469 SKUs against 6,049 folders on disk. It is stale and reading it will make images look absent that are present. Read the directory.

---

## Not chosen, raised once

Nothing prevents this recurring. A warning in the admin when an image URL points outside your own hosts would stop the next one at data entry rather than at cutover. Separate task, not approved.
