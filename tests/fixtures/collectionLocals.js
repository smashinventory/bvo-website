/* Shared fixtures for the render-based gates (G5, G8).
   Kept out of the shell heredocs so both gates test the SAME locals —
   two near-copies would drift and the gates would stop agreeing. */
const base = {
  pageTitle:'x', metaDesc:'', canonicalUrl:'', noindex:false,
  models:[], total:0, page:1, pages:1, perPage:24, pageWindow:[], hasActiveFilters:false,
  activeSizes:[], allBrands:['James Martin','ER Vanities'], activeBrands:[],
  colorFamiliesConfig:[{key:'white',label:'White',hex:'#fff',border:'#ddd',members:['Bright White']}],
  colorFamilyActive:[], colorExactActive:[], availFinishes:['Bright White'], availColorFamilies:['white'],
  minPrice:null, maxPrice:null, priceRange:{min:100,max:5000},
  products:[], sort:'featured', brands:[], productTypes:[], model:null,
  modelColorMap:{}, modelSizeMap:{}, attrFilters:{}, rangeFilters:{},
  availableBrands:['James Martin','ER Vanities'], availableProductTypes:[],
  attributeDefs:[], availableAttrValues:{}, familyHex:{},
  hwColorFamiliesConfig:[], hwColorFamilyActive:[], hwColorExactActive:[],
  availHwFinishes:[], availHwColorFamilies:[], stoneMaterials:[], activeStoneMaterials:[],
  settings:{}, csrfToken:'t', query:{}, currentUrl:'/x',
  /* Every real render has this — server.js:176 sets res.locals.cspNonce on
     every request. It is in `base` rather than one case because any template
     that ever injects a <style nonce> needs it on every path, and a fixture
     that omits it would fail for a reason the live site cannot have. */
  cspNonce:'test-nonce',
};

module.exports.cases = {
  'VANITY (model-group)': Object.assign({}, base, {
    category:{slug:'vanity-models',name:'Vanities'},
    displayMode:'model-group',
    isVanityCategory:true,
    availableSizes:['24','30','36','48','60S','60D','72'],
    mgAvailTypes:['Single Sink Vanity With Top','Double Sink Vanity With Top','Single Sink Cabinet Only'],
    mgActiveTypes:[],
  }),
  'FAUCETS (grid)': Object.assign({}, base, {
    category:{slug:'faucets',name:'Faucets'},
    displayMode:'grid',
    isVanityCategory:false,
    availableSizes:[],
    mgAvailTypes:[], mgActiveTypes:[],
    availableProductTypes:[{value:'Bathroom Faucets',count:120},{value:'Kitchen Faucets',count:40}],
    attributeDefs:[{attr_key:'finish',display_name:'Finish',filter_type:'color_swatch',sort_order:2}],
    availableAttrValues:{finish:['Polished Chrome','Matte Black']},
  }),

  /* THE CASE THAT WAS MISSING.
     /collections/bathroom-vanities is a vanity category on the GRID path.
     The first fixture set had vanity+model-group and non-vanity+grid, so
     vanity+grid — the page Sam actually looks at — was never rendered by
     any gate. Brand vanished from it and Cabinet Color sat in slot 4, and
     every gate passed. */
  'VANITY (grid)': Object.assign({}, base, {
    category:{slug:'bathroom-vanities',name:'Bathroom Vanities'},
    displayMode:'grid',
    isVanityCategory:true,
    availableSizes:['20-','25','30','36','42','48','60','72','84+'],
    mgAvailTypes:[], mgActiveTypes:[],
    availableProductTypes:[],
    attributeDefs:[{attr_key:'cabinet_finish',display_name:'Cabinet Color',filter_type:'color_swatch',sort_order:4}],
    availableAttrValues:{cabinet_finish:['Bright White','Chestnut']},
  }),

  /* THE FOURTH RENDER PATH, added 2026-10-21 with the Deals banners.
     §9 of VANITY_SIDEBAR_FILTERS.md says to add a case per path, and §6
     says to cover every combination or name the ones you did not.

     /collections/sale is a VIRTUAL collection — collectionsController.js:177
     short-circuits before any category lookup and renders with a synthetic
     `category` object (id: null). So it is the only path where
     `category.id` is null and `isVanityCategory` is false while the slug is
     not a real `categories` row. That is also why it is absent from the
     sitemap (OPEN_ITEMS #365): sitemapController's `SELECT slug FROM
     categories` cannot return a row that does not exist.

     ⚠️ These locals are COPIED FROM THE CONTROLLER, not invented. Fields
     the controller does not pass are deliberately absent here too —
     notably `displayMode` (so the grid path runs) and `tradeMeter` (the
     spend meter is Phase 2 and the template guards it with `typeof`). A
     fixture that supplies more than the controller does would hide exactly
     the ReferenceError that an undefined EJS local throws. */
  'SALE (virtual)': Object.assign({}, base, {
    category:{ id:null, slug:'sale', name:'Sale',
               description:'Discounted products — limited time offers',
               meta_title:'Sale', meta_desc:'' },
    isVanityCategory:false,
    availableSizes:[],
    mgAvailTypes:[], mgActiveTypes:[],
    availableProductTypes:[],
    attributeDefs:[],
    availableAttrValues:{},
    availFinishes:[], availColorFamilies:[], colorFamiliesConfig:[],

    /* ⚠️ THE FACETS ARE PRODUCED BY THE REAL buildSaleView, NOT TYPED OUT.
       Rule 18 says a fixture may only contain what a real request carries.
       The strongest form of that is not to hand-write the values at all:
       this runs the same function the controller runs, over a pool shaped
       like real rows, so the fixture cannot drift from the controller even
       if the facet logic changes. Hand-written values would be a second,
       silently diverging implementation — which is the trap Rule 18 was
       written after.

       The pool deliberately mixes a vanity brand with a faucet brand and
       includes a row with NO width_in, because that row is what exposed
       Number(null) === 0 matching the `20-` bucket. */
    ...require('../../src/utils/saleFacets.js').buildSaleView([
      { id:1, slug:'a', name:'Kinnsden 30',  brand:'ER Vanities',      product_type:'Single Sink Vanity With Top', width_in:30,   price:'899.00',  compare_price:'1499.00' },
      { id:2, slug:'b', name:'Kinnsden 36',  brand:'ER Vanities',      product_type:'Single Sink Cabinet Only',    width_in:36,   price:'699.00',  compare_price:'1199.00' },
      { id:3, slug:'c', name:'Addison 36',   brand:'James Martin',     product_type:'Single Sink Vanity With Top', width_in:36,   price:'1799.00', compare_price:'2999.00' },
      { id:4, slug:'d', name:'HB Faucet',    brand:'Huntington Brass', product_type:'Bathroom Faucets',            width_in:null, price:'149.00',  compare_price:'299.00'  },
    ], {}),
  }),
};
