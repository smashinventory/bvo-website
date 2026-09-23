# Hotlinked Images — Status

> Which images are still served from hosts BVO does not control. The original list of 14 is mostly closed; the problem has recurred with new entries. Cutover blocker.

**Last measured:** 2026-09-23, against the live homepage DOM
**Supersedes:** the 2026-09-13 list of 14 in `docs/00-start/OPEN_ITEMS.md` item 6

---

## The list of 14 is largely done

Between 2026-09-16 and 2026-09-23 the category cards, the hero and the
supporting imagery moved to the Bunny pull zone at
**`images.bathroomvanitiesoutlet.com`**. All eight `encrypted-tbn0.gstatic.com`
cache keys are gone, as are `image.lampsplus.com` and
`www.bathvanityexperts.com`.

Homepage image hosts as measured:

| host | count | owned? |
|---|---|---|
| `images.bathroomvanitiesoutlet.com` | 26 | ✅ Bunny pull zone |
| `res.cloudinary.com` | 4 | ✅ |
| `slategrey-falcon-350174.hostingersite.com` | 3 | ✅ own server — review photos |
| `i.ytimg.com` | 2 | ⚪ YouTube thumbnails, expected and fine |
| `ak1.ostkcdn.com` | 1 | ❌ Overstock |
| `bathgems.com` | 1 | ❌ competitor |
| `usbathstore.com` | 1 | ❌ competitor |
| `jamesmartinvanities.com` | 1 | ❌ supplier |

## ⚠ Three of those four are NEW

`ak1.ostkcdn.com`, `bathgems.com` and `usbathstore.com` were **not** on the
2026-09-13 list. They were entered while that list was being worked through.

`jamesmartinvanities.com` is the Brittany model tile — item B of the original
list, still open.

Three of the four are competitors' own product photography, served from their
bandwidth, on a commercial storefront. That is a different kind of exposure
from an expiring Google cache key, and it is the one that has been recurring.

**This is the case for the control that was raised and not approved** (OPEN_ITEMS
item 6, final paragraph): a warning in the admin when an image URL points
outside your own hosts, at the point of entry. Without it, this list regrows
faster than it can be cleared. Four fixed, three new, one never closed — while
the fix was actively in progress.

---

## What is still to do

| where | record | host |
|---|---|---|
| `/admin/models` | Brittany / James Martin Vanities — `model_groups.custom_image` | jamesmartinvanities.com |
| `/admin/products` | the Overstock, BathGems and USBathStore products — `products.primary_image_url` | 3 hosts |
| `/admin/categories` | **Faucets** — no owned image exists | gstatic *(verify — may be done)* |
| `/admin/categories` | **Lighting** — no owned image exists | lampsplus *(verify — may be done)* |
| Theme Editor | `hero.mobile_image_url`, `hero_mobile.image_url` | **now on Bunny — closed** |

Faucets and Lighting are listed as unverified on purpose: they were still
hotlinked on 2026-09-16 and the homepage measurement above does not show a
gstatic or lampsplus host, but the homepage may not render every category card.
Confirm with the query below before closing them.

## Faucets and Lighting — still no owned image

Unchanged from 2026-09-16, and Sam's call was to leave them logged:

- **Faucets** — James Martin sells none, so nothing exists in the feed or in
  Bunny. The only faucet imagery BVO holds is Huntington Brass, which is itself
  hotlinked (see below).
- **Lighting** — no lighting products in the feed at all.

## ⚠ Huntington Brass — separate and larger

`src/jobs/importHuntingtonBrass.js` pulls images from
`huntingtonbrass.com/products.json` into `products.primary_image_url`. Line 32
calls this *"deliberate here and temporary: the CDN project will fetch and
re-host"*, and `HB_IMAGE_HOST` at line 108 is the named seam for the swap.

Every HB faucet is therefore hotlinking. None of them is counted above, because
the measurement was the homepage and HB products do not appear there. Scope this
before assuming the remaining count is four.

---

## Verify

```sql
SELECT 'category' AS what, name AS label, slug AS ref, image_url AS url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%images.bathroomvanitiesoutlet.com%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model', model_name, brand, custom_image
  FROM model_groups
 WHERE custom_image LIKE 'http%'
   AND custom_image NOT LIKE '%images.bathroomvanitiesoutlet.com%'
   AND custom_image NOT LIKE '%salsify.com%'
   AND custom_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model-og', model_name, brand, og_image
  FROM model_groups
 WHERE og_image LIKE 'http%'
   AND og_image NOT LIKE '%images.bathroomvanitiesoutlet.com%'
   AND og_image NOT LIKE '%salsify.com%'
   AND og_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'product', name, slug, primary_image_url
  FROM products
 WHERE primary_image_url LIKE 'http%'
   AND primary_image_url NOT LIKE '%images.bathroomvanitiesoutlet.com%'
   AND primary_image_url NOT LIKE '%salsify.com%'
   AND primary_image_url NOT LIKE '%res.cloudinary.com%';
```

The Bunny exclusion is the line that was missing before — without it every
completed replacement keeps reporting itself as a problem.

Does **not** cover the two hero fields: they live in `data/theme_settings.json`,
not a table. Both now read from Bunny, confirmed in the DOM 2026-09-23.

---

## Reference — the Bunny pull zone

**Public host:** `images.bathroomvanitiesoutlet.com`
Preconnected in `views/layouts/main.ejs:86`.

**Optimizer is enabled** — `?width=NNN` resizes at the edge. Confirmed live: the
hero serves as `homepage-hero-vanity-with-towers.webp?width=768`.

**Upload path:** `jmv_sync/bunny_upload_mac.sh` rclone-copies
`OnlineSmartPOS/Salsify_Masters_Native/` to `bunny:bvo-images/`, preserving
structure. Local `<SKU>/<file>.webp` becomes object `bvo-images/<SKU>/<file>.webp`.
6,049 SKU folders. Naming is `<slugified-name>-<lowercase-sku>-<n>.webp`, `-1`
being the primary shot.

**Do not trust `Salsify_Masters_Native/_manifest_salsify.csv`** — it lists 469
SKUs against 6,049 folders on disk. It is stale; reading it makes present images
look absent. Read the directory.

**Category card geometry:** `.cat-img` is `height:180px` with
`object-fit:cover`, so the browser crops to roughly 280×180 landscape. Source
shots are square or portrait — serve them through `?width=` rather than raw, or
a portrait mirror renders as a horizontal slice through the middle of the frame.
