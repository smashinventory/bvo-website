'use strict';

/* ─────────────────────────────────────────────────────────────────────
 * FILTER LANDING PAGES — title, meta, H1 and intro per filter value
 *
 * WHAT THIS IS FOR
 * /collections/bathroom-vanities?style=Farmhouse serves the same title and
 * meta description as the unfiltered collection, and canonicals to it. That
 * is correct handling for faceted navigation — it stops 43 near-duplicate
 * URLs competing with the parent — but it also means a filtered page can
 * never rank for its own intent. "farmhouse bathroom vanity" is a real
 * search with real volume, and the page that should answer it currently
 * tells Google it is not a distinct page worth having.
 *
 * This file is the content that makes those pages distinct. The controller
 * uses it to self-canonicalise and re-title a filtered page, but ONLY when
 * the filter has enough products behind it to deserve indexing — see the
 * threshold note below.
 *
 * ── THE THRESHOLD, AND WHY IT IS A RULE NOT A LIST ──────────────────
 * Promoting a filter with seven products behind it is the thin-content
 * failure that makes indexing facets backfire: Google sees a near-duplicate
 * of the parent with almost no unique value, and the shopper who lands
 * there sees seven results for a search that promised a category.
 *
 * Measured 2026-10-02 against the live catalogue (4,604 vanities):
 *
 *   SUBSTANTIAL            THIN
 *   Transitional  2808     European/Old World  40
 *   Med Wood      1501     Cream               46
 *   Modern        1331     84+"                90
 *   60"           1277     25"                 27
 *   48"           1031     Scandinavian        19
 *   72"            964     Industrial          12
 *   White          956     20-"                10
 *   Farmhouse      951     42"                  8
 *   Light Wood     810     Coastal              7
 *   36"            742
 *   Traditional    686
 *   30"            449
 *   Dark Wood      415
 *   Green          313
 *   Black          270
 *   Blue           202
 *   Mid-Century    153
 *   Gray           121
 *
 * A hardcoded list of "the good ones" would be wrong within weeks: the
 * James Martin feed adds products nightly, and Coastal at 7 today could be
 * 60 next quarter. So EVERY value below has content written for it, and the
 * controller decides at request time whether that value currently clears
 * seo.filter_landing_min_products (default 10). The set corrects itself.
 *
 * THE NUMBER WAS 25, AND IS NOW 10 (changed 2026-10-06 at Sam's direction).
 *
 * 25 was chosen because the grid serves 24 per page, so a promoted page
 * always had at least one full grid plus a second page. That is a tidy
 * argument but it was costing real pages: Knobs & Legs at 21 and Metal
 * Base at 13 are legitimate, searched-for categories that a 25 line keeps
 * out of the index for no benefit to anyone.
 *
 * 10 keeps the mechanism — thin values still do not self-canonicalize, and
 * still promote themselves automatically the moment they cross the line —
 * while letting a half-page of genuine products rank. Values at 2 and 3
 * (Bench, Laundry Faucets, Bar Faucets) remain excluded, which is the
 * point: those would be a bad landing for the shopper, not just a thin
 * page for the crawler.
 *
 * It is a SETTING, not a constant. If 10 proves wrong in either direction,
 * change seo.filter_landing_min_products in the Theme Editor — no deploy.
 * Nothing in this file or the gate pins the number; the gate asserts only
 * that the themeSettings default and the controller fallback AGREE.
 *
 * ── WRITING RULES, so these do not drift into filler ────────────────
 * - Every title and meta must be UNIQUE. Two pages sharing a meta is the
 *   problem this file exists to solve, reintroduced. The gate asserts it.
 * - The intro says something TRUE AND USEFUL about the category — what
 *   defines it, who it suits, what to look for. "Browse our wide selection
 *   of quality vanities" is filler and fails the point of the exercise.
 * - No price or stock claims. Those go stale and nobody updates this file.
 * - No superlatives that cannot be substantiated ("the best", "unbeatable").
 * ───────────────────────────────────────────────────────────────────── */

/* Keys are the raw query-parameter values, exactly as the megamenu links
   emit them and the controller parses them. A mismatch here is silent —
   the page simply is not promoted — so the gate cross-checks these keys
   against the live filter definitions. */

const STYLE = {
  'Traditional': {
    crumb: 'Traditional',
    h1:    'Traditional Bathroom Vanities',
    title: 'Traditional Bathroom Vanities | Classic Styles | BVO',
    meta:  'Traditional bathroom vanities with raised-panel doors, turned legs and furniture detailing. Single and double widths in painted and wood finishes.',
    intro: 'Traditional vanities take their cues from classic furniture — raised-panel doors, decorative moulding, turned or carved legs, and often a stone top with an ogee edge. They suit homes with existing millwork or trim you want the bathroom to echo, and they wear well in houses where a starkly modern piece would feel out of place.',
  },
  'Transitional': {
    crumb: 'Transitional',
    h1:    'Transitional Bathroom Vanities',
    title: 'Transitional Bathroom Vanities | Classic Meets Modern | BVO',
    meta:  'Transitional bathroom vanities blend clean modern lines with classic detailing. Our largest style range, in single and double configurations.',
    intro: 'Transitional is the middle ground: the clean lines and simple hardware of modern design, softened by shaker doors and warmer finishes. It is the most forgiving style to buy, because it reads as current without dating the way a strongly themed bathroom can, and it sits comfortably alongside both older and newer fittings.',
  },
  'Modern': {
    crumb: 'Modern',
    h1:    'Modern Bathroom Vanities',
    title: 'Modern Bathroom Vanities | Clean-Lined Designs | BVO',
    meta:  'Modern bathroom vanities with flat-panel doors, minimal hardware and floating or slab designs. Single and double widths in matte and wood finishes.',
    intro: 'Modern vanities strip the cabinet back to its geometry — flat slab doors, concealed or integrated pulls, and often a wall-mounted base that leaves floor visible underneath. That floating detail makes a small bathroom read larger and makes the floor easier to clean, which is why it suits compact and heavily used rooms.',
  },
  'Farmhouse': {
    crumb: 'Farmhouse',
    h1:    'Farmhouse Bathroom Vanities',
    title: 'Farmhouse Bathroom Vanities | Rustic & Shaker | BVO',
    meta:  'Farmhouse bathroom vanities with shaker doors, apron detailing and distressed or painted wood finishes. Single and double widths.',
    intro: 'Farmhouse vanities lean on honest materials and visible construction — plank or shaker doors, exposed hinges, apron-front detailing, and finishes that show the grain rather than hide it. The look tolerates wear in a way that polished finishes do not, which makes it a practical choice for family and guest bathrooms.',
  },
  'Mid-Century Modern': {
    crumb: 'Mid-Century Modern',
    h1:    'Mid-Century Modern Bathroom Vanities',
    title: 'Mid-Century Modern Bathroom Vanities | Tapered Legs | BVO',
    meta:  'Mid-century modern bathroom vanities with tapered legs, warm walnut tones and clean horizontal lines. Single and double widths.',
    intro: 'Mid-century vanities are defined by their stance: tapered legs lifting the cabinet clear of the floor, a low horizontal body, and warm wood tones rather than paint. The raised base keeps the room feeling open and gives you genuine floor space back, which matters more in a bathroom than in most rooms.',
  },
  'Industrial': {
    crumb: 'Industrial',
    h1:    'Industrial Bathroom Vanities',
    title: 'Industrial Bathroom Vanities | Metal & Wood | BVO',
    meta:  'Industrial bathroom vanities combining metal frames with reclaimed-look wood and open shelving. Single and double widths.',
    intro: 'Industrial vanities pair a visible metal frame with timber that looks reclaimed, often with open shelving instead of closed drawers. The open base is the trade-off to weigh: it suits a room with good storage elsewhere and looks best when what sits on those shelves is tidy — folded towels rather than cleaning bottles.',
  },
  'Coastal': {
    crumb: 'Coastal',
    h1:    'Coastal Bathroom Vanities',
    title: 'Coastal Bathroom Vanities | Light & Airy Designs | BVO',
    meta:  'Coastal bathroom vanities in pale painted finishes, weathered woods and soft blues and greens. Single and double widths.',
    intro: 'Coastal vanities work in pale, light-reflecting finishes — chalky whites, weathered greys, soft blues and sea greens — usually over shaker or beadboard doors. The palette does real work in a bathroom with one small window, where darker cabinetry can make the room feel closed in.',
  },
  'Scandinavian': {
    crumb: 'Scandinavian',
    h1:    'Scandinavian Bathroom Vanities',
    title: 'Scandinavian Bathroom Vanities | Pale Wood & White | BVO',
    meta:  'Scandinavian bathroom vanities in pale woods and soft whites, with simple lines and uncluttered storage. Single and double widths.',
    intro: 'Scandinavian design keeps the palette pale and the lines quiet — light oak and ash, soft whites, minimal hardware and no applied ornament. The emphasis is on storage that hides clutter rather than displaying it, which suits bathrooms where everything has to live in the vanity.',
  },
  'European / Old World': {
    crumb: 'European & Old World',
    h1:    'European & Old World Bathroom Vanities',
    title: 'European & Old World Bathroom Vanities | Ornate Styles | BVO',
    meta:  'European and Old World bathroom vanities with carved detailing, antiqued finishes and furniture-style construction. Single and double widths.',
    intro: 'Old World vanities are the most decorative pieces we carry — carved aprons and corbels, antiqued or glazed finishes, and proportions borrowed from period furniture rather than modern cabinetry. They are statement pieces, and they ask for a room with the ceiling height and floor area to let them breathe.',
  },
};

const COLOR = {
  'white': {
    crumb: 'White',
    h1:    'White Bathroom Vanities',
    title: 'White Bathroom Vanities | Bright, Classic Finishes | BVO',
    meta:  'White bathroom vanities in matte, satin and glossy finishes, across shaker, flat-panel and traditional door styles. Single and double widths.',
    intro: 'White is the most adaptable vanity finish: it reflects light into dim rooms, works with any tile or counter you later change your mind about, and reads as clean. The trade-off is that it shows marks around the handles and the base, so a satin or semi-gloss finish is easier to live with than a flat matte.',
  },
  'gray': {
    crumb: 'Gray',
    h1:    'Gray Bathroom Vanities',
    title: 'Gray Bathroom Vanities | Warm & Cool Greys | BVO',
    meta:  'Gray bathroom vanities from pale dove to deep charcoal, in shaker and flat-panel doors. Single and double widths, in both warm and cool-toned greys.',
    intro: 'Grey gives you the neutrality of white with far more forgiveness about water spots and daily marks. The thing to check before ordering is whether the grey is warm or cool — a cool grey against warm cream tile reads as a mismatch rather than a neutral, and the difference is hard to judge from a small on-screen swatch.',
  },
  'black': {
    crumb: 'Black',
    h1:    'Black Bathroom Vanities',
    title: 'Black Bathroom Vanities | Bold Modern Finishes | BVO',
    meta:  'Black bathroom vanities in matte and satin finishes, paired with light stone tops for contrast. Single and double widths.',
    intro: 'Black cabinetry anchors a bathroom and makes a pale counter and fittings look deliberate rather than accidental. It needs light to work — in a room with one small window it can close the space down — so it tends to succeed best in larger bathrooms, or paired with a white top and a well-lit mirror.',
  },
  'blue': {
    crumb: 'Blue',
    h1:    'Blue Bathroom Vanities',
    title: 'Blue Bathroom Vanities | Navy to Soft Blue | BVO',
    meta:  'Blue bathroom vanities from deep navy to pale sky, in shaker and traditional door styles. Single and double widths, with stone and cultured marble tops.',
    intro: 'Blue is the colour people choose when white feels too plain and black too severe. Deep navy behaves like a neutral and pairs with brass or chrome equally well; paler blues lift a north-facing room that never gets direct sun. Both hide the marks that show on white around the handles.',
  },
  'green': {
    crumb: 'Green',
    h1:    'Green Bathroom Vanities',
    title: 'Green Bathroom Vanities | Sage to Forest | BVO',
    meta:  'Green bathroom vanities from soft sage to deep forest, in shaker and flat-panel doors. Single and double widths, with brass or chrome-friendly finishes.',
    intro: 'Green has become the alternative to navy for people who want colour without the expected choice. Sage and eucalyptus tones read almost as neutrals and sit well against both warm wood and cool stone; deeper forest greens behave like black, anchoring the room and needing good light to avoid feeling heavy.',
  },
  'cream': {
    crumb: 'Cream',
    h1:    'Cream Bathroom Vanities',
    title: 'Cream Bathroom Vanities | Warm Off-White Finishes | BVO',
    meta:  'Cream and off-white bathroom vanities in warm painted finishes, across shaker and traditional door styles. Single and double widths.',
    intro: 'Cream is the warmer answer to white, and it is usually the better one in a room with wood floors, brass fittings or warm-toned tile, where a pure white cabinet can look cold and slightly blue by comparison. It also disguises the yellowing that pure white paint shows as it ages.',
  },
  'wood_l': {
    crumb: 'Light Wood',
    h1:    'Light Wood Bathroom Vanities',
    title: 'Light Wood Bathroom Vanities | Oak & Ash Tones | BVO',
    meta:  'Light wood bathroom vanities in oak, ash and pale natural finishes that show the grain. Single and double widths, suited to modern and Scandinavian rooms.',
    intro: 'Light woods — oak, ash, pale maple — bring warmth without darkening the room, which is why they appear so often in Scandinavian and modern bathrooms. Because the grain is visible rather than painted over, each piece varies slightly, and scratches tend to blend in rather than standing out as they do on paint.',
  },
  'wood_m': {
    crumb: 'Medium Wood',
    h1:    'Medium Wood Bathroom Vanities',
    title: 'Medium Wood Bathroom Vanities | Natural Tones | BVO',
    meta:  'Medium wood bathroom vanities in warm natural tones with visible grain. Our largest finish range, in single and double widths.',
    intro: 'Mid-tone woods are the most widely chosen finish we carry, and for a practical reason: they are dark enough to hide daily marks and light enough not to shrink the room. They also sit comfortably with most flooring, which matters when the bathroom floor is already fixed and not changing.',
  },
  'wood_d': {
    crumb: 'Dark Wood',
    h1:    'Dark Wood Bathroom Vanities',
    title: 'Dark Wood Bathroom Vanities | Walnut & Espresso | BVO',
    meta:  'Dark wood bathroom vanities in walnut, espresso and deep natural finishes. Single and double widths, pairing well with pale stone tops and bright lighting.',
    intro: 'Dark woods give a bathroom weight and a more furnished, less fitted feeling — closer to a piece you placed than cabinetry you installed. They work best against a pale counter and good lighting; in a small windowless room a dark vanity and dark floor together will make the space feel smaller than it is.',
  },
};

const SIZE = {
  '20-': {
    crumb: 'Under 24"',
    h1:    'Small Bathroom Vanities Under 24 Inches',
    title: 'Small Bathroom Vanities Under 24" | Compact | BVO',
    meta:  'Compact bathroom vanities under 24 inches wide for powder rooms, cloakrooms and tight corners. Single sink configurations.',
    intro: 'Under 24 inches is powder-room and cloakroom territory, where the vanity has to fit beside a door swing or into a corner. Storage is necessarily limited, so check the drawer layout rather than the external width — a cabinet with a U-shaped drawer that clears the plumbing holds far more than one with a single fixed shelf.',
  },
  '25': {
    crumb: '25-29"',
    h1:    '25 to 29 Inch Bathroom Vanities',
    title: '25-29 Inch Bathroom Vanities | Compact Single Sink | BVO',
    meta:  'Bathroom vanities 25 to 29 inches wide. Compact single-sink units for small bathrooms and guest cloakrooms, with usable counter space either side of the tap.',
    intro: 'This band suits a small full bathroom where a 24-inch unit leaves the basin feeling cramped but a 30 will not clear the door. The extra few inches usually go into usable counter space either side of the tap, which is the difference between somewhere to set a soap dish and nowhere at all.',
  },
  '30': {
    crumb: '30"',
    h1:    '30 Inch Bathroom Vanities',
    title: '30 Inch Bathroom Vanities | Single Sink | BVO',
    meta:  '30 inch bathroom vanities with single sinks, in painted and wood finishes across every style. A common size for guest and family bathrooms.',
    intro: 'Thirty inches is the smallest width most people find genuinely comfortable for a daily bathroom: enough counter to put things down, and usually a full drawer bank rather than a single door. It is also a standard replacement size, so it often drops into the footprint of an older vanity without moving plumbing.',
  },
  '36': {
    crumb: '36"',
    h1:    '36 Inch Bathroom Vanities',
    title: '36 Inch Bathroom Vanities | Single Sink | BVO',
    meta:  '36 inch bathroom vanities with single sinks and generous storage, in every style and finish we carry. The most popular single-sink width for family bathrooms.',
    intro: 'Thirty-six inches is the most popular single-sink width, and the point where storage stops being a compromise — typically a full drawer stack on one side plus a cabinet, with real counter space either side of the basin. For most family bathrooms it is the size that fits without having to plan around it.',
  },
  '42': {
    crumb: '42"',
    h1:    '42 Inch Bathroom Vanities',
    title: '42 Inch Bathroom Vanities | Wide Single Sink | BVO',
    meta:  '42 inch bathroom vanities. Wide single-sink units offering extra counter and drawer space without stepping up to a double basin. A less common, roomier width.',
    intro: 'Forty-two inches is the width to look at when you want more counter and storage than a 36 but the room cannot take a double sink, or you would rather have the surface than the second basin. It is a less common size, so the choice is narrower than at 36 or 48.',
  },
  '48': {
    crumb: '48"',
    h1:    '48 Inch Bathroom Vanities',
    title: '48 Inch Bathroom Vanities | Single & Double Sink | BVO',
    meta:  '48 inch bathroom vanities in single and double sink configurations, across every style and finish. The crossover width between one basin and two.',
    intro: 'Forty-eight inches is the crossover width: wide enough for a double sink, but often better used as a single with a large uninterrupted counter. Two basins at 48 leaves each one fairly tight, so if the bathroom is shared by adults rather than children, the single-sink layout is usually the more comfortable choice.',
  },
  '60': {
    crumb: '60"',
    h1:    '60 Inch Bathroom Vanities',
    title: '60 Inch Bathroom Vanities | Double Sink | BVO',
    meta:  '60 inch bathroom vanities in double and single sink layouts, with full drawer storage. The standard double width for main and primary bathrooms.',
    intro: 'Sixty inches is the standard double-vanity width and the most common choice for a main or primary bathroom. It gives each basin genuine elbow room with a usable run of counter between them, and there is normally space for a central drawer stack rather than splitting storage to the outer edges.',
  },
  '72': {
    crumb: '72"',
    h1:    '72 Inch Bathroom Vanities',
    title: '72 Inch Bathroom Vanities | Wide Double Sink | BVO',
    meta:  '72 inch bathroom vanities with double sinks and extensive drawer storage. Room for two people at once, with a central drawer bank between the basins.',
    intro: 'Seventy-two inches gives two people a basin each with enough separation that neither feels crowded, plus a central bank of drawers deep enough for everything that would otherwise sit on the counter. It needs a wall clear of door swings and radiators, so measure the obstruction-free run rather than the room.',
  },
  '84+': {
    crumb: '84" & Over',
    h1:    'Bathroom Vanities 84 Inches and Wider',
    title: '84 Inch+ Bathroom Vanities | Extra Wide Double | BVO',
    meta:  'Extra-wide bathroom vanities 84 inches and over, with double sinks and full-height storage towers for large primary bathrooms.',
    intro: 'At 84 inches and above you are furnishing a wall rather than fitting a vanity, and the layout question becomes what to do with the middle — a seated makeup section, a full-height storage tower, or an unbroken counter run. Check ceiling height and the delivery path, as pieces this wide often ship in multiple sections.',
  },
};

/* ── FAUCET TYPES — /collections/faucets ──────────────────────────────
   The parent collection is "Plumbing Fixtures", which is accurate for the
   mixed set but matches no search anyone performs. These five words —
   bathroom faucets, kitchen faucets, shower fixtures, tub fillers — are
   what people actually type, and until this file existed the pages that
   should answer them all served the title "Plumbing Fixtures". */
const FAUCET_TYPE = {
  'Bathroom Faucets': {
    crumb: 'Bathroom Faucets',
    h1:    'Bathroom Sink Faucets',
    title: 'Bathroom Sink Faucets | Centerset & Widespread | BVO',
    meta:  'Bathroom sink faucets in single-hole, 4-inch centerset and 8-inch widespread configurations, finished in chrome, satin nickel, brass and matte black.',
    intro: 'Configuration matters more than style here, because a faucet has to match the holes already drilled in your sink or countertop. Single hole takes one, a 4-inch centerset takes three on 4-inch centers, and an 8-inch widespread takes three spread 8 to 16 inches apart. Measure the existing drilling first and choose the finish second — changing configuration usually means replacing the sink or the vanity top as well.',
  },
  'Kitchen Faucets': {
    crumb: 'Kitchen Faucets',
    h1:    'Kitchen Faucets',
    title: 'Kitchen Faucets | Pull-Down Sprayer & Single Handle | BVO',
    meta:  'Kitchen faucets with pull-down and pull-out sprayers, single and dual handle, in chrome, PVD satin nickel, PVD satin brass and matte black.',
    intro: 'Spout height and reach decide whether a kitchen faucet works day to day. A tall arc clears a stock pot but splashes in a shallow sink, and the spray head needs to land near the drain rather than against the back wall. PVD finishes are worth the difference in a kitchen, where the handle gets touched with wet and oily hands several times a day and a plated finish wears through at exactly that spot.',
  },
  'Shower Fixtures': {
    crumb: 'Shower Fixtures',
    h1:    'Shower Fixtures, Trim & Shower Heads',
    title: 'Shower Fixtures & Trim Kits | Heads, Arms & Valves | BVO',
    meta:  'Shower trim kits, shower heads, arms and flanges, wall bars and replacement handles in chrome, satin nickel, brass and matte black.',
    intro: 'This covers both ends of a shower job: complete trim kits with the handle, escutcheon and head matched as a set, and the individual pieces — arms, flanges, supply elbows, replacement handles — you need when repairing rather than starting over. Trim is only half of a shower: the valve body behind the wall has to match the trim brand and series, so confirm what is already installed before ordering a kit.',
  },
  'Tub Fillers': {
    crumb: 'Tub Fillers',
    h1:    'Roman Tub Fillers & Tub Faucets',
    title: 'Roman Tub Fillers & Deck Mount Tub Faucets | BVO',
    meta:  'Roman tub fillers and deck-mount tub faucets with matching handles and hand showers, in chrome, satin nickel, satin brass and matte black.',
    intro: 'A Roman tub filler mounts on the tub deck or platform rather than the wall, and moves far more water than a sink faucet so a large tub fills in a reasonable time. Most are sold as a trim set over a separate rough-in valve, and many take an optional hand shower on an additional hole. Decide on the hand shower before the deck is drilled, because adding one afterwards means drilling finished stone.',
  },
  'Bar Faucets': {
    crumb: 'Bar Faucets',
    h1:    'Bar & Prep Sink Faucets',
    title: 'Bar & Prep Sink Faucets | Compact Single Hole | BVO',
    meta:  'Compact bar and prep sink faucets with high-clearance spouts, sized for the smaller basins in an island or wet bar.',
    intro: 'A bar faucet is a scaled-down kitchen faucet built for a shallow prep or wet-bar basin rather than the main sink. The spout sits high enough to fill a pitcher, but the footprint stays narrow, which matters on an island where deck space is shared between the sink rim and the counter edge. Most bar sinks are drilled single-hole, so check the drilling before ordering.',
  },
  'Laundry Faucets': {
    crumb: 'Laundry Faucets',
    h1:    'Laundry & Utility Sink Faucets',
    title: 'Laundry & Utility Sink Faucets | High Spout | BVO',
    meta:  'Laundry and utility sink faucets built for deep basins, with a high spout and hose-thread outlet for filling buckets.',
    intro: 'A utility faucet is chosen for clearance and durability rather than looks. The spout has to sit high above a deep laundry basin so a bucket fits underneath, and a hose-thread outlet lets you attach a fill hose directly. These mount either on the sink deck or on the wall depending on how the basin is plumbed, so confirm which you have before ordering.',
  },
};

/* ── ACCESSORY TYPES — /collections/accessories ───────────────────────
   Two brands with genuinely different products behind one label: the
   Huntington Brass hardware and drain lines, and the James Martin vanity
   parts. Contents verified against the live catalog 2026-10-06 rather
   than inferred from the type name — "Plumbing Accessories" is drains and
   pop-up assemblies, which is a far better search term than the label. */
const ACCESSORY_TYPE = {
  'Bathroom Accessories': {
    /* THIS PAGE OWNS THE TERM, NOT ITS PARENT. The parent category was
       renamed from "Bathroom Accessories" to "Accessories" on 2026-10-06
       precisely so this page could take the phrase without the two
       competing — see db/rename_accessories_category.sql. The parent is a
       genuinely mixed set (hardware, drains, vanity parts), so "Accessories"
       describes it honestly and the specific term lands on the specific
       page. If the parent is ever renamed back, this entry has to change
       with it or they will fight each other again. */
    crumb: 'Bathroom Accessories',
    h1:    'Bathroom Accessories — Towel Bars, Hooks & Rings',
    title: 'Bathroom Accessories | Towel Bars, Robe Hooks & Rings | BVO',
    meta:  'Bathroom accessories from Huntington Brass — towel bars, towel rings, robe hooks and paper holders in chrome, satin nickel, satin brass and matte black.',
    intro: 'Hardware either matches the faucet or quietly does not, so it is worth buying the whole finish in one order rather than a piece at a time over several years. Mounting is the other thing to settle early: most of these fix to a wall anchor rather than a stud, and the anchor has to go in before the tile if the wall is being redone. Matched packages cover a full bathroom in one line.',
  },
  'Plumbing Accessories': {
    crumb: 'Drains & Pop-Ups',
    h1:    'Sink Drains & Pop-Up Assemblies',
    title: 'Sink Drains & Pop-Up Assemblies | Matched Finishes | BVO',
    meta:  'Pop-up drain assemblies and grid-style sink drains in chrome, satin nickel, satin brass and matte black, to match a faucet finish.',
    intro: 'The drain is the piece people forget until the new faucet arrives and the old chrome pop-up is the only mismatched metal left at the sink. Pop-ups come in overflow and non-overflow versions: a vessel basin usually has no overflow and takes a grid-style drain, while a standard undermount does have one and takes the pop-up. Check which your basin is before ordering, since the two are not interchangeable.',
  },
  'Knobs & Legs': {
    crumb: 'Knobs & Legs',
    h1:    'Vanity Knobs & Leg Sets',
    title: 'Vanity Knobs & Leg Sets | James Martin Parts | BVO',
    meta:  'Replacement knob and leg sets for James Martin vanities, sold per model and cabinet width, in brushed nickel and matte black.',
    intro: 'These are factory parts sold per model and per cabinet width, not universal hardware — a set listed for a 30 and 36 inch cabinet will not fit a 60. They are how you change the metal finish on a vanity you already own without replacing the cabinet, and how you replace a leg damaged in shipping or installation. Match the model name and the cabinet width from your original order.',
  },
  'Metal Base': {
    crumb: 'Metal Bases',
    h1:    'Stainless Steel Vanity Bases',
    title: 'Stainless Steel Console Vanity Bases | James Martin | BVO',
    meta:  'Stainless steel console bases from James Martin Vanities, sized by top width, in brushed nickel and matte black.',
    intro: 'A metal base turns a vanity top into an open console — no cabinet, no doors, with the plumbing visible underneath. It suits a powder room where an uninterrupted floor matters more than storage, and a small bathroom that would feel closed in by a full cabinet. Each base is sized to a specific top width, so order the two together rather than trying to match one to the other later.',
  },
  'Bench': {
    crumb: 'Benches',
    h1:    'Upholstered Vanity Benches',
    title: 'Upholstered Vanity Benches & Stools | James Martin | BVO',
    meta:  'Upholstered vanity benches from James Martin Vanities, sized for a seated makeup section in a double or extra-wide vanity run.',
    intro: 'A vanity bench belongs with a seated section — a lower run of counter, usually around 30 inches high rather than 36, set between two basins or at one end of a long vanity. Measure the knee space under that section before choosing a width, because the bench has to tuck fully underneath when it is not in use or it sits in the walkway.',
  },
};

/* ── THE MAP, KEYED BY COLLECTION ────────────────────────────────────
 * WHY COLLECTION IS PART OF THE KEY, 2026-10-06
 *
 * This used to be keyed by (param, value) alone, with the controller
 * gating on `isVanityCategory` to stop the content escaping. That gate
 * was doing real work, not being cautious: style, color_family and
 * size_in are facets on THREE collections —
 *
 *   bathroom-vanities, bathroom-vanities-with-tops, bathroom-vanity-cabinets
 *
 * — so a (param, value) lookup with the gate removed would serve the
 * identical H1, title and meta on all three. 27 pages would become 81,
 * of which 54 would be exact duplicates of each other, every one of them
 * self-canonical. That is precisely the failure this file exists to
 * prevent, which is why the uniqueness rule above is asserted by a gate.
 *
 * Keying by collection removes the need for the gate without the
 * duplication. A collection with no entry here returns null and behaves
 * exactly as it does today — which is the current state of
 * bathroom-vanities-with-tops and bathroom-vanity-cabinets. They are a
 * KNOWN GAP, not an oversight: writing a distinct 27 for each is a
 * content job, and borrowing the vanity copy is the bug above.
 */
const COLLECTIONS = {
  'bathroom-vanities': {
    style:        STYLE,
    color_family: COLOR,
    size_in:      SIZE,
  },
  'faucets': {
    product_type: FAUCET_TYPE,
  },
  'accessories': {
    product_type: ACCESSORY_TYPE,
  },
};

/**
 * Look up landing content for a single active filter on a given collection.
 * Returns null when the collection, the group or the value is not one we
 * have written for — which is the correct outcome, not an error: the page
 * then behaves exactly as it does today.
 */
function lookup(collection, param, value) {
  const groups = COLLECTIONS[String(collection || '').toLowerCase()];
  if (!groups) return null;
  const values = groups[param];
  if (!values) return null;
  return values[String(value)] || null;
}

/** Every (collection, param, value) we have content for — used by the gate. */
function allEntries() {
  const out = [];
  for (const [collection, groups] of Object.entries(COLLECTIONS)) {
    for (const [param, values] of Object.entries(groups)) {
      for (const [value, content] of Object.entries(values)) {
        out.push({ collection, param, value, ...content });
      }
    }
  }
  return out;
}

module.exports = {
  COLLECTIONS, STYLE, COLOR, SIZE, FAUCET_TYPE, ACCESSORY_TYPE,
  lookup, allEntries,
};
