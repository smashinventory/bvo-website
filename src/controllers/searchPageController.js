'use strict';

/**
 * searchPageController.js — GET /search
 *
 * site.js sends the shopper here when they press Enter in the header
 * search bar instead of clicking a suggestion. Until now that route did
 * not exist and every one of those shoppers got a 404 — which is the
 * commoner behaviour of the two, since pressing Enter is how most people
 * expect a search box to work.
 *
 * Results come from services/searchService.js, the same function that
 * answers /api/search. The dropdown and this page must never disagree.
 */

const { bvoPool } = require('../config/database');
const {
  runProductSearch, fetchPopular, SORT_LABELS, DEFAULT_PER_PAGE,
} = require('../services/searchService');

exports.index = async (req, res, next) => {
  try {
    const q    = String(req.query.q || '').trim().slice(0, 120);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const sort = String(req.query.sort || '').trim();

    const result = await runProductSearch(bvoPool, {
      q, page, sort, perPage: DEFAULT_PER_PAGE,
      brands: req.query.brand,
      types:  req.query.type,
    });

    /* Suggestions when there is nothing to show. LIKE has no typo
       tolerance, so a mistyped model name lands here — an empty page with
       no way forward would lose that shopper outright. Also shown for an
       empty q, where the shopper reached /search with no term at all. */
    const popular = result.total === 0 ? await fetchPopular(bvoPool, 8) : [];

    const siteUrl = `${req.protocol}://${req.get('host')}`;

    res.render('pages/search', {
      layout:    'layouts/main',
      pageTitle: q
        ? `Search results for "${q}" | BathroomVanitiesOutlet.com`
        : 'Search | BathroomVanitiesOutlet.com',
      metaDesc: q
        ? `Bathroom vanities and accessories matching "${q}".`
        : 'Search bathroom vanities, faucets, mirrors and accessories.',
      /* noindex on purpose. Search result pages are near-infinite thin
         duplicates of the collection pages; letting Google index them
         competes with the collections that are meant to rank and burns
         crawl budget. Canonical points at the bare /search for the same
         reason. */
      noindex:      true,
      canonicalUrl: `${siteUrl}/search`,

      q,
      products:   result.hits,
      total:      result.total,
      page:       result.page,
      pages:      result.pages,
      sort:       result.sort,
      sortLabels: SORT_LABELS,
      popular,
    });
  } catch (err) { next(err); }
};
