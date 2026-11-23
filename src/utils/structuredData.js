'use strict';

/**
 * structuredData.js
 * ONE source for every JSON-LD node the storefront emits.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * Before this, the codebase contained SEVEN separate hand-written
 * Organization objects, in product.ejs, inspirationController and
 * authorsController. Each one re-declared the company name and logo. Google
 * had no way to know they described the same entity, and changing the logo
 * meant finding all seven.
 *
 * That is the same one-off duplication pattern catalogued in
 * docs/briefs/ONE_OFF_PATTERNS.md: a shared concept with no shared helper,
 * copied from whichever file was nearest.
 *
 * ─── THE @graph PATTERN, AND WHY IT IS NOT DECORATION ────────────────────
 * Each page emits ONE script tag containing an @graph array. Every node has
 * a stable @id, and nodes reference each other by @id rather than nesting
 * copies:
 *
 *   Organization   <site>/#organization      declared once, site-wide
 *   WebSite        <site>/#website           publisher -> {@id organization}
 *   WebPage        <pageUrl>#webpage         isPartOf  -> {@id website}
 *                                            breadcrumb-> {@id breadcrumb}
 *   BreadcrumbList <pageUrl>#breadcrumb
 *   Product/Article                          mainEntityOfPage -> {@id webpage}
 *
 * The payoff is entity resolution. Google reconciles one Organization node
 * instead of guessing whether seven objects are the same company, which is
 * the whole mechanism behind a Knowledge Graph entity. For a low-authority
 * domain establishing identity, that consolidation is the highest-value
 * structured data available - and AI answer surfaces read the same graph.
 *
 * ─── RULES THIS FILE ENFORCES ────────────────────────────────────────────
 * 1. The company name, logo and site URL appear HERE and nowhere else.
 * 2. Nothing is emitted that is not visibly on the page. Google requires
 *    markup to match visible content, and a breadcrumb trail in JSON-LD that
 *    does not exist on screen is a violation, not a shortcut.
 * 3. NO aggregateRating on Product. See the warning on productGraph() below.
 *    This is the single most tempting mistake available here.
 */

const SITE_URL = require('./siteUrl').base()
  .replace(/\/+$/, '');

/* The company, declared once. Everything else references these. */
const ORG_NAME  = 'BathroomVanitiesOutlet.com';
const ORG_LOGO  = `${SITE_URL}/images/logos/BVOLOGOSQ_512.png`;

/* ─── PUBLISHED COMMERCIAL TERMS ──────────────────────────────────────────
 * ⚠️ THESE MUST MATCH THE POLICY PAGES. They are not marketing copy; they are
 * the terms the customer is shown immediately above the Place Order button
 * (checkout-payment.ejs) and they are what makes those pages binding.
 *
 * Source of truth, in this order:
 *   /pages/returns-policy    the 30-day window and the 25% restocking fee
 *   /pages/shipping-policy   free shipping, 5-10 business days
 *
 * The 25% restocking fee is quoted in checkout-payment.ejs. If either policy
 * page changes, THIS BLOCK CHANGES TOO - structured data that contradicts a
 * published policy is both a Google problem and a consumer-law one.
 *
 * Declaring these on the ORGANISATION rather than on 5,283 Product nodes is
 * deliberate: the policy is uniform across the catalogue, Google's
 * OnlineStore subtype supports it at that level, and one declaration cannot
 * drift from another.
 */
const RETURN_POLICY_DAYS   = 30;
const RESTOCKING_FEE_PCT   = 25;
const SHIP_COUNTRY         = 'US';
const SHIP_DAYS_MIN        = 5;
const SHIP_DAYS_MAX        = 10;

const ID = {
  organization: `${SITE_URL}/#organization`,
  website:      `${SITE_URL}/#website`,
  webPage:      url => `${url}#webpage`,
  breadcrumb:   url => `${url}#breadcrumb`,
};

/* A reference to a node, rather than a second copy of it. This one helper is
   the difference between a connected graph and seven islands. */
const ref = id => ({ '@id': id });

/** Absolute URL from a site-relative path. Idempotent on absolute input. */
function abs(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : '/' + path);
}

/**
 * Social profile URLs for Organization.sameAs.
 *
 * Read from the owner's theme settings rather than hardcoded, so adding a
 * TikTok later is a Theme Editor edit and not a deploy. Empty values are
 * dropped: an empty string in sameAs is an invalid URL, and Google treats a
 * malformed value as an error on the entity rather than ignoring it.
 */
function sameAs(settings) {
  const s = (settings && settings.social) || {};
  return [
    s.facebook_url, s.instagram_url, s.twitter_url,
    s.pinterest_url, s.linkedin_url, s.yelp_url,
  ].filter(u => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
   .map(u => u.trim());
}

/* ═══════════════ NODES ═══════════════════════════════════════════════════ */

/**
 * The site-wide return policy, as a reusable node.
 *
 * Attached to the OnlineStore rather than to each Product. Google reads an
 * organisation-level policy as applying to the whole catalogue, which is what
 * is true here.
 */
function merchantReturnPolicy() {
  return {
    '@type':               'MerchantReturnPolicy',
    '@id':                 `${SITE_URL}/#returnpolicy`,
    applicableCountry:     SHIP_COUNTRY,
    returnPolicyCategory:  'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays:    RETURN_POLICY_DAYS,
    returnMethod:          'https://schema.org/ReturnByMail',
    /* RestockingFees is the correct category when a percentage is withheld.
       restockingFee as a percentage is expressed as a bare number, not a
       MonetaryAmount - that form is for flat fees. */
    returnFees:            'https://schema.org/RestockingFees',
    restockingFee:         RESTOCKING_FEE_PCT,
    merchantReturnLink:    `${SITE_URL}/pages/returns-policy`,
  };
}

/**
 * The shipping offer. Free, domestic, 5-10 business days.
 *
 * ⚠️ handlingTime and transitTime are SEPARATE in schema.org, and the sum is
 * what the customer experiences. The site promises "arrives in 5-10 business
 * days" as a single figure, so it is declared as transit time with zero
 * handling rather than invented as a split. Claiming a faster handling time
 * than is real is the usual way this field becomes a liability.
 */
function shippingService() {
  return {
    '@type': 'OfferShippingDetails',
    '@id':   `${SITE_URL}/#shipping`,
    shippingRate: {
      '@type':   'MonetaryAmount',
      value:     0,
      currency:  'USD',
    },
    shippingDestination: {
      '@type':        'DefinedRegion',
      addressCountry: SHIP_COUNTRY,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0, maxValue: 0, unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: SHIP_DAYS_MIN, maxValue: SHIP_DAYS_MAX, unitCode: 'DAY',
      },
    },
  };
}

/**
 * The store. One per site, referenced everywhere by @id.
 *
 * ⚠️ OnlineStore, NOT the generic Organization. Google asks for the most
 * specific subtype, and OnlineStore (Thing > Organization > OnlineBusiness >
 * OnlineStore) is what unlocks the Merchant Knowledge Panel: the panel that
 * surfaces return policy, shipping and contact details on a branded search.
 * A generic Organization node gets none of that.
 */
/**
 * The business address, as a PostalAddress — or null when settings are
 * incomplete.
 *
 * ⚠️ ALL-OR-NOTHING ON PURPOSE. A half-filled address (street but no
 * postcode, say) is worse than none: Google treats an incomplete address
 * node as a quality signal against the entity, and a partial address is
 * exactly what you get the first time someone adds these settings through
 * the Theme Editor and saves halfway. Returning null means the node simply
 * carries no address until every part is present, which is the honest
 * output rather than a broken claim.
 */
function postalAddress(settings) {
  const g = (settings && settings.global) || {};
  const street  = String(g.contact_street  || '').trim();
  const city    = String(g.contact_city    || '').trim();
  const region  = String(g.contact_region  || '').trim();
  const postal  = String(g.contact_postal  || '').trim();
  const country = String(g.contact_country || '').trim();
  if (!street || !city || !region || !postal || !country) return null;
  return {
    '@type':          'PostalAddress',
    streetAddress:    street,
    addressLocality:  city,
    addressRegion:    region,
    postalCode:       postal,
    addressCountry:   country,
  };
}

/**
 * Customer-service contact point, with the hours the phone is answered.
 *
 * ⚠️ hoursAvailable, NOT openingHours. The distinction is the whole reason
 * this function exists rather than a LocalBusiness node. `openingHours` is
 * a property of a place the public can enter; 5120 Old Ellis Pt is an
 * office and warehouse and customers do not visit it. `hoursAvailable` on
 * a ContactPoint says only "this is when someone answers", which is true.
 * Publishing openingHours on a non-visitable address invites people to
 * turn up at a closed loading dock, and misrepresents the business to
 * Google. See the note in themeSettings.js global.
 */
function contactPoint(settings) {
  const g = (settings && settings.global) || {};
  const phone = String(g.contact_phone || '').trim();
  const email = String(g.contact_email || '').trim();
  if (!phone && !email) return null;

  const days   = Array.isArray(g.contact_hours_days) ? g.contact_hours_days : [];
  const opens  = String(g.contact_hours_opens  || '').trim();
  const closes = String(g.contact_hours_closes || '').trim();

  return {
    '@type':       'ContactPoint',
    contactType:   'customer service',
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email }            : {}),
    areaServed:    'US',
    availableLanguage: 'English',
    ...(days.length && opens && closes ? {
      hoursAvailable: {
        '@type':     'OpeningHoursSpecification',
        dayOfWeek:   days.map(d => `https://schema.org/${d}`),
        opens,
        closes,
      },
    } : {}),
  };
}

function organization(settings) {
  const profiles = sameAs(settings);
  const g        = (settings && settings.global) || {};
  const address  = postalAddress(settings);
  const contact  = contactPoint(settings);
  const legal    = String(g.contact_legal_name || '').trim();
  const phone    = String(g.contact_phone      || '').trim();
  const email    = String(g.contact_email      || '').trim();
  return {
    /* ⚠️ BOTH TYPES, AND THE ORDER IS COSMETIC ONLY.
       OnlineStore IS an Organization — Thing > Organization >
       OnlineBusiness > OnlineStore — so naming the supertype alongside
       the subtype is redundant but TRUE, and multi-typed nodes are
       ordinary JSON-LD. Nothing is weakened: OnlineStore is still
       declared, so the Merchant Knowledge Panel behaviour that made it
       the right choice is intact.

       WHY IT IS SPELLED OUT. Consumers that string-match for the literal
       word "Organization" miss a valid subtype entirely. Hostinger's
       AI-visibility scan is one: after the address shipped on 2026-11-23
       it still scored "Organization or LocalBusiness schema is complete"
       at 0/4, because the node said only OnlineStore. The address was
       there and correct — verified in the live page — so the check was
       reading the type name, not the content. Any other naive parser
       would have had the same blind spot.

       ⚠️ THIS IS NOT LICENCE TO ADD LocalBusiness. That is a different
       claim, not a supertype: it asserts a place the public can enter,
       and 5120 Old Ellis Pt is office and warehouse only. Owner
       confirmed 2026-11-23. gate_structured_data.js fails if it appears. */
    '@type': ['Organization', 'OnlineStore'],
    '@id':   ID.organization,
    name:    ORG_NAME,
    /* Trading name stays ORG_NAME; legalName carries the LLC. Both are
       true and schema.org expects them in exactly these two fields. */
    ...(legal ? { legalName: legal } : {}),
    url:     SITE_URL + '/',
    ...(address ? { address } : {}),
    ...(phone   ? { telephone: phone } : {}),
    ...(email   ? { email }            : {}),
    ...(contact ? { contactPoint: contact } : {}),
    logo: {
      '@type': 'ImageObject',
      '@id':   `${SITE_URL}/#logo`,
      url:     ORG_LOGO,
      contentUrl: ORG_LOGO,
      caption: ORG_NAME,
    },
    image: ref(`${SITE_URL}/#logo`),
    ...(profiles.length ? { sameAs: profiles } : {}),
    hasMerchantReturnPolicy: merchantReturnPolicy(),
    hasShippingService: {
      '@type':         'ShippingService',
      name:            'Free Shipping',
      shippingConditions: ref(`${SITE_URL}/#shipping`),
    },
  };
}

/** The WebSite. Carries the sitelinks search box declaration. */
function webSite() {
  return {
    '@type':    'WebSite',
    '@id':      ID.website,
    url:        SITE_URL + '/',
    name:       ORG_NAME,
    publisher:  ref(ID.organization),
    inLanguage: 'en-US',
    /* Declares the on-site search endpoint. Only valid because /search
       genuinely exists and takes ?q= - see src/routes/search.js. */
    potentialAction: {
      '@type':      'SearchAction',
      target: {
        '@type':       'EntryPoint',
        urlTemplate:   `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** The page itself. Links the content node to the site. */
function webPage(url, name, opts = {}) {
  const u = abs(url);
  return {
    '@type':    'WebPage',
    '@id':      ID.webPage(u),
    url:        u,
    name:       name || ORG_NAME,
    isPartOf:   ref(ID.website),
    inLanguage: 'en-US',
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.primaryImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: abs(opts.primaryImage) } } : {}),
    ...(opts.hasBreadcrumb ? { breadcrumb: ref(ID.breadcrumb(u)) } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified  ? { dateModified:  opts.dateModified  } : {}),
  };
}

/**
 * BreadcrumbList from the trail that is ALREADY VISIBLE on the page.
 *
 * ⚠️ trail must mirror the rendered breadcrumb exactly. Google requires the
 * markup to match what the user sees; inventing a deeper trail to look more
 * organised is a guidelines violation. Every public template this is wired
 * into already renders its trail in HTML - this only describes it.
 *
 * @param {string} pageUrl  the current page, site-relative or absolute
 * @param {Array}  trail    [{ name, url }] - url omitted on the last item,
 *                          which is the current page and is not a link
 */
function breadcrumbList(pageUrl, trail) {
  const u = abs(pageUrl);
  const items = (trail || []).filter(t => t && t.name);
  if (items.length < 2) return null;   // a one-item trail is not a breadcrumb
  return {
    '@type': 'BreadcrumbList',
    '@id':   ID.breadcrumb(u),
    itemListElement: items.map((t, i) => ({
      '@type':   'ListItem',
      position:  i + 1,
      name:      String(t.name),
      /* The final crumb carries no `item`: it is the current page. Google's
         own guidance omits it rather than self-linking. */
      ...(t.url && i < items.length - 1 ? { item: abs(t.url) } : {}),
    })),
  };
}

/** CollectionPage for a category listing, with its products as an ItemList. */
function collectionPage(url, name, products, opts = {}) {
  const u = abs(url);
  const list = (products || []).filter(p => p && p.slug).slice(0, 30);
  return {
    '@type':    'CollectionPage',
    '@id':      ID.webPage(u),
    url:        u,
    name:       name || ORG_NAME,
    isPartOf:   ref(ID.website),
    inLanguage: 'en-US',
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.hasBreadcrumb ? { breadcrumb: ref(ID.breadcrumb(u)) } : {}),
    ...(list.length ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((p, i) => ({
          '@type':   'ListItem',
          position:  i + 1,
          url:       `${SITE_URL}/products/${p.slug}`,
          name:      p.name || undefined,
        })),
      },
    } : {}),
  };
}

/**
 * An ItemList of the products a listing page actually displays, each with a
 * real Offer. Returns null when there is nothing priced to describe.
 *
 * WHY THIS EXISTS. Hostinger's AI-visibility scan reported "Prices are
 * reachable without JavaScript or login: 0/4 — the site sells something, but
 * no prices are linked or marked up on the homepage." Half of that is wrong:
 * prices ARE in the server-rendered HTML as text, verified by fetching the
 * raw page. The half that is right is that the homepage displayed four
 * priced products and carried no Product or Offer markup for any of them.
 * This marks up what is genuinely on the page; it is not a trick to satisfy
 * a scanner, and it would be worth doing with no scanner involved.
 *
 * ⚠️ THE SAME @id AS THE PRODUCT PAGE'S OWN NODE.
 * product.ejs declares `${SITE_URL}/products/${slug}#product`. Reusing it
 * here means the homepage DESCRIBES the same entity rather than minting a
 * second one. Invent a different @id and the catalogue acquires two
 * Products per SKU that happen to share a name, which is exactly the
 * duplicate-entity mess that makes listing markup a liability.
 *
 * ⚠️ NO aggregateRating. The site-wide Google seller rating is not a
 * per-product rating; see the long note below and gate_structured_data.js.
 *
 * ⚠️ Number() FIRST, then > 0. A MySQL DECIMAL arrives as a STRING, so a
 * bare truthiness test passes on "0.00" and would publish a free vanity.
 * The product page learned this the hard way; the rule is the same here.
 * An unpriced item is SKIPPED rather than listed without an Offer: a
 * listing entry that makes no price claim is noise in a list whose whole
 * purpose is the price claim.
 */
function itemListWithOffers(products, opts = {}) {
  const rows = (products || []).filter((p) => {
    if (!p || !p.slug || !p.name) return false;
    const n = Number(p.price);
    return Number.isFinite(n) && n > 0;
  });
  if (!rows.length) return null;

  return {
    '@type': 'ItemList',
    '@id':   `${SITE_URL}${opts.id || '/#featured-products'}`,
    name:    opts.name || 'Featured products',
    numberOfItems: rows.length,
    itemListElement: rows.map((p, i) => {
      const url   = `${SITE_URL}/products/${p.slug}`;
      const price = Number(p.price);
      /* qty_on_hand is the only stock signal the listing query carries. A
         missing value means "not selected", not "out of stock", so the
         claim is only made when the number is actually there. */
      const qty   = Number(p.qty_on_hand);
      const avail = Number.isFinite(qty)
        ? (qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock')
        : undefined;
      return {
        '@type':  'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          '@id':   `${url}#product`,
          name:    p.name,
          url,
          ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
          ...(p.primary_image ? { image: abs(p.primary_image) } : {}),
          offers: {
            '@type':       'Offer',
            url,
            priceCurrency: 'USD',
            price:         price.toFixed(2),
            ...(avail ? { availability: avail } : {}),
            itemCondition: 'https://schema.org/NewCondition',
            /* Resolve by @id to the one OnlineStore and its policy nodes,
               which pageGraph already emits at top level. Copying the
               policies onto every Offer is how they drift. */
            seller:                  ref(ID.organization),
            shippingDetails:         ref(`${SITE_URL}/#shipping`),
            hasMerchantReturnPolicy: ref(`${SITE_URL}/#returnpolicy`),
          },
        },
      };
    }),
  };
}

/* ═══════════════ ASSEMBLY ════════════════════════════════════════════════ */

/** Wrap nodes in a single @graph. Nulls are dropped, so callers can pass
    conditional nodes without guarding every one. */
function graph(nodes) {
  return {
    '@context': 'https://schema.org',
    '@graph':   (nodes || []).filter(Boolean),
  };
}

/**
 * Serialise to a <script> tag.
 *
 * ⚠️ The `<` escape is not cosmetic. A product name or page title containing
 * the literal text "</script>" would otherwise terminate the tag early and
 * inject the rest as markup. Escaping to < is still valid JSON, parses
 * identically, and closes that hole. The existing hand-written blocks in
 * product.ejs do not do this.
 */
function scriptTag(graphObj) {
  const json = JSON.stringify(graphObj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * The common case: Organization + WebSite + WebPage + optional breadcrumb,
 * plus whatever content node the page is about.
 *
 * @param {object} o
 * @param {string} o.url          current page
 * @param {string} o.name         page title
 * @param {Array}  o.trail        visible breadcrumb trail, or omitted
 * @param {object} o.settings     theme settings (for sameAs)
 * @param {Array}  o.nodes        extra nodes (Product, Article, ...)
 * @param {object} o.pageOverride use instead of the default WebPage node
 */
function pageGraph(o = {}) {
  const crumbs = breadcrumbList(o.url, o.trail);
  const page = o.pageOverride || webPage(o.url, o.name, {
    description:   o.description,
    primaryImage:  o.primaryImage,
    hasBreadcrumb: !!crumbs,
    datePublished: o.datePublished,
    dateModified:  o.dateModified,
  });
  return graph([
    organization(o.settings),
    /* The shipping node is emitted once at top level and referenced by @id
       from the store and from any Offer, rather than copied into each. */
    shippingService(),
    webSite(),
    page,
    crumbs,
    ...(o.nodes || []),
  ]);
}

/* ─── A NOTE ON Product.aggregateRating ───────────────────────────────────
 *
 * ⚠️ DO NOT ADD IT FROM THE SITE-WIDE GOOGLE RATING.
 *
 * The product page displays "4.9 (150 Google Reviews)". Those two numbers are
 * hardcoded theme settings (themeSettings.js google_reviews_rating /
 * google_reviews_count) and they are SELLER reviews of the business, not
 * reviews of any product.
 *
 * Google requires Product.aggregateRating to describe reviews OF THAT
 * PRODUCT. Publishing an identical 4.9/150 across thousands of products is
 * the textbook pattern for a structured-data manual action, and review
 * snippets being one of the few surviving rich result types makes it an
 * especially tempting mistake.
 *
 * When real per-product reviews exist, add it from those. Until then the
 * rating stays on the page as a trust signal and out of the markup.
 * gates/gate_structured_data.js asserts its absence.
 */

module.exports = {
  SITE_URL, ORG_NAME, ORG_LOGO, ID,
  RETURN_POLICY_DAYS, RESTOCKING_FEE_PCT, SHIP_DAYS_MIN, SHIP_DAYS_MAX,
  abs, ref, sameAs,
  organization, merchantReturnPolicy, shippingService,
  webSite, webPage, breadcrumbList, collectionPage, itemListWithOffers,
  graph, scriptTag, pageGraph,
};
