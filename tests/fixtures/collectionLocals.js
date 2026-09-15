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
};
