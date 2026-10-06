-- ============================================================================
-- 2026-10-05_article_rewrite_RUNME.sql
--
-- Rewrites the body of ALL TEN inspiration guides. CONTENT ONLY.
--
-- WHAT THIS TOUCHES:  pages.content, ten rows, matched by slug.
-- WHAT IT DOES NOT:   no CREATE/ALTER on any existing table, no schema change,
--                     no code, no product data, no filter logic, and no other
--                     column on `pages` - title, meta_title, meta_desc,
--                     og_image, author_id, published_at and sort_order are all
--                     left exactly as they are.
--
-- ONE TABLE IS ADDED: pages_content_backup_20261005, holding the CURRENT body
-- of every inspiration guide before anything is overwritten. Added, never
-- altering or removing anything, and it is what makes this reversible. The
-- revert statement is at the bottom.
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
-- The ten guides ran 605-834 words with ZERO images between them. Research
-- into what actually ranks for these queries showed the winners are numbered,
-- image-led lists for the "ideas" topics, and long-form prose for the two
-- buying guides. Neither was what we had.
--
-- The eight "ideas" guides are now numbered galleries: 172 vanities in total,
-- each with its own image, its own caption and a link to the product. The two
-- buying guides stay prose and were deliberately split by intent rather than
-- merged, so they stop competing for the same query:
--   bathroom-vanity-buying-guide      the reference - every option and cost
--   how-to-choose-a-bathroom-vanity   the process - decisions in order
--
-- 43 internal links now run between the ten guides in both directions. For a
-- ten-article library that web is one of the few structural advantages
-- available, and it did not exist before.
--
-- ─── VERIFICATION ALREADY DONE ──────────────────────────────────────────────
--   * Every one of the 172 product links and 172 image URLs was checked
--     against the catalogue. An earlier draft had three fabricated image
--     paths, typed from a pattern instead of read from the data; the
--     galleries are now generated from the data file so that cannot recur.
--   * Every internal /inspiration/ link points at one of these ten slugs.
--   * ASCII only. No em-dashes, curly quotes or ellipses, so nothing can
--     mojibake if a charset is mis-declared anywhere between here and the
--     page. gates/gate_article_ascii.js asserts it and is mutation-tested.
--   * American English throughout, asserted by the same gate.
--   * Every string literal below was round-tripped: decoded back from the
--     escaped SQL and compared to its source file. All ten matched exactly.
--
-- HOW TO RUN: paste the whole file into phpMyAdmin and run. Safe to run twice:
-- the backup uses CREATE TABLE IF NOT EXISTS and INSERT IGNORE, so a second
-- run will not overwrite the original bodies it captured the first time.
-- ============================================================================


-- ─── 1. BACK UP THE CURRENT BODIES FIRST ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pages_content_backup_20261005 (
  id         INT          NOT NULL,
  slug       VARCHAR(255) NOT NULL,
  content    LONGTEXT,
  backed_up  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO pages_content_backup_20261005 (id, slug, content)
SELECT id, slug, content FROM pages WHERE page_type = 'inspiration';

SELECT COUNT(*) AS guides_backed_up FROM pages_content_backup_20261005;


-- ─── floating-bathroom-vanity-ideas ───
-- 28 numbered vanities, 2343 words. Source: docs/briefs/article_floating_DRAFT.html
UPDATE pages
   SET content = '<p>A floating vanity hangs off the wall with nothing underneath it. You will also see them sold as wall-hung or wall-mounted, which are the same thing, and the reason people want one is almost always the same: showing the floor makes a small bathroom look bigger than it is.</p>

<p>That effect is real, and so are the trade-offs. What most guides miss is that the choice is not always made for you at the factory. Some vanities are built to float and nothing else. Many more can be installed either way, and the decision happens on site, with your installer, on the day. We have split the twenty-eight cabinets below along exactly that line.</p>

<h2>Before you fall in love with one</h2>

<p>A floating vanity transfers its entire weight, plus the weight of a stone top, plus a sink full of water, into your wall. That load has to land on blocking or studs. If your bathroom wall is standard drywall over 16-inch centers and the vanity\'s mounting cleat does not line up with them, someone has to open the wall and add backing before anything gets hung. Budget for that conversation before you order, not after.</p>

<p>The second thing to settle early is plumbing height. On a floor-standing vanity the supply lines and drain hide inside the cabinet and nobody sees where they enter the wall. On a floating vanity the wall below the cabinet is fully visible, so the rough-in has to come through behind the cabinet body. If your existing plumbing enters low, it will be exposed, and that is the most common way a floating install ends up looking unfinished.</p>

<h2>Built to float: two collections</h2>

<p>These two are wall-mount only. There are no legs, no base, and no floor-standing version. If you want this particular look, these are the cabinets designed around it.</p>

<h2>1. Allamari 36" Single Vanity Cabinet, Dune Mist</h2>
<p><a href="/products/d640-v36-dms"><img src="https://images.bathroomvanitiesoutlet.com/D640-V36-DMS/bathroom-cabinet-allamari-36-dune-mist-d640-v36-dms-1.webp" alt="Allamari 36" Single Vanity Cabinet, Dune Mist shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Thirty-six inches is where the floating effect pays off hardest. In a powder room, the strip of visible tile under the cabinet does more for the sense of space than any paint color would. Dune Mist is the pale option and recedes into a light wall, so the cabinet reads as part of the room rather than an object in it.</p>

<h2>2. Allamari 36" Single Vanity Cabinet, Sable</h2>
<p><a href="/products/d640-v36-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D640-V36-SBL/bathroom-cabinet-allamari-36-sable-d640-v36-sbl-1.webp" alt="Allamari 36" Single Vanity Cabinet, Sable shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same 36-inch body in the dark finish, and the comparison is instructive. Sable sits forward and reads as a deliberate object, where Dune Mist disappears. Neither is better. They solve different rooms.</p>

<h2>3. Allamari 48" Single Vanity Cabinet, Dune Mist</h2>
<p><a href="/products/d640-v48-dms"><img src="https://images.bathroomvanitiesoutlet.com/D640-V48-DMS/bathroom-cabinet-allamari-48-dune-mist-d640-v48-dms-1.webp" alt="Allamari 48" Single Vanity Cabinet, Dune Mist shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches with a single sink is the most practical floating layout we sell. Full basin, roughly two feet of clear counter, and light enough that standard blocking handles it without an argument. Pale finishes also show less dust on the underside, which you can actually see on a floating cabinet.</p>

<h2>4. Allamari 48" Single Vanity Cabinet, Sable</h2>
<p><a href="/products/d640-v48-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D640-V48-SBL/bathroom-cabinet-allamari-48-sable-d640-v48-sbl-1.webp" alt="Allamari 48" Single Vanity Cabinet, Sable shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sable at 48 inches is the configuration most people picture when they search for a floating vanity: dark, horizontal, floor running underneath. Check your lighting first, because a dark cabinet in a dim room reads heavy rather than dramatic.</p>

<h2>5. Allamari 72" Double Vanity Cabinet, Dune Mist</h2>
<p><a href="/products/d640-v72-dms"><img src="https://images.bathroomvanitiesoutlet.com/D640-V72-DMS/bathroom-cabinet-allamari-72-dune-mist-d640-v72-dms-1.webp" alt="Allamari 72" Double Vanity Cabinet, Dune Mist shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of cabinet with daylight underneath is the full expression of the look. At this width the pale finish is the easier one to live with, because a six-foot dark slab floating off a wall can dominate a room that is not large enough to absorb it.</p>

<h2>6. Allamari 72" Double Vanity Cabinet, Sable</h2>
<p><a href="/products/d640-v72-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D640-V72-SBL/bathroom-cabinet-allamari-72-sable-d640-v72-sbl-1.webp" alt="Allamari 72" Double Vanity Cabinet, Sable shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>The most demanding install in this list and the most striking result. Before ordering a 72-inch floating double, have your installer confirm there is blocking where the mounting cleat lands. This is not a cabinet to hang on hope.</p>

<h2>7. Marcello 36" Single Vanity Cabinet, Chestnut</h2>
<p><a href="/products/d200-v36-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V36-CSN/bathroom-cabinet-marcello-36-chestnut-d200-v36-csn-1.webp" alt="Marcello 36" Single Vanity Cabinet, Chestnut shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Marcello is the warm-wood alternative to Allamari\'s cooler finishes. Chestnut is a mid-brown with visible grain, which softens a piece that is otherwise strictly geometric. In a bathroom with white tile and brass fixtures, this is what stops the room feeling clinical.</p>

<h2>8. Marcello 48" Single Vanity, Chestnut</h2>
<p><a href="/products/d200-v48-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V48-CSN/bathroom-cabinet-marcello-48-chestnut-d200-v48-csn-1.webp" alt="Marcello 48" Single Vanity, Chestnut shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches of chestnut is the sweet spot in this collection. Wide enough to be generous, warm enough not to read as a showroom piece, and at a width where the mounting is straightforward.</p>

<h2>9. Marcello 72" Double Vanity Cabinet, Chestnut</h2>
<p><a href="/products/d200-v72-m-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V72-M-CSN/bathroom-cabinet-marcello-72-chestnut-d200-v72-m-csn-1.webp" alt="Marcello 72" Double Vanity Cabinet, Chestnut shown as a wall-mounted floating vanity" width="800" height="800" loading="lazy"></a></p>
<p>The largest floating cabinet we carry, in the warmest finish. Wood grain across six feet gives the eye something to follow, which is why this reads as less severe than a flat dark cabinet at the same width.</p>

<h2>Your choice at install: seven more collections</h2>

<p>This is the part worth knowing before you shop anywhere else. The seven collections below can be hung on the wall or stood on the floor, and the cabinet is the same either way. You are not choosing a product; you are choosing an installation.</p>

<p>That matters for three reasons. It doubles the number of cabinets available to you if floating is what you are after. It lets you change your mind late, because the decision is not locked in at the point of purchase. And in a few cases, noted below, the two installations genuinely produce different-looking rooms from identical parts.</p>

<p>Tell your installer which you want before they start. Floating requires the blocking and the plumbing height described above; floor-mounting requires neither.</p>

<h2>10. Columbia 31.5" Single Vanity Cabinet, Ash Gray</h2>
<p><a href="/products/883-v31.5-agr"><img src="https://images.bathroomvanitiesoutlet.com/883-V31.5-AGR/bathroom-cabinet-columbia-31-ash-gray-883-v31-5-agr-1.webp" alt="Columbia 31.5" Single Vanity Cabinet, Ash Gray which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>The 31.5-inch width is deliberate. It clears a 32-inch opening with tolerance to spare, which matters because bathroom walls are rarely plumb. Ash Gray is a cool neutral, so check it against your tile first. Warm cream tile against a cool gray cabinet reads as a mismatch rather than a neutral.</p>

<h2>11. Columbia 48" Single Vanity Cabinet, Glossy White, No Hardware</h2>
<p><a href="/products/983-v48-gw"><img src="https://images.bathroomvanitiesoutlet.com/983-V48-GW/bathroom-cabinet-columbia-48-glossy-white-983-v48-gw-1.webp" alt="Columbia 48" Single Vanity Cabinet, Glossy White, No Hardware which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Columbia\'s doors are push-to-open, so no hardware interrupts the front. Hung on the wall, that uninterrupted face is the whole point. The caveat is children, because push latches get sticky faster than pulls do.</p>

<h2>12. Columbia 72" Single Vanity, Glossy White</h2>
<p><a href="/products/388-v72s-gw-bn-dgg"><img src="https://images.bathroomvanitiesoutlet.com/388-V72S-GW-BN-DGG/bathroom-vanities-columbia-72-glossy-white-388-v72s-gw-bn-dgg-1.webp" alt="Columbia 72" Single Vanity, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>A 72-inch single is an underrated layout, and floating it makes the run of counter look longer still. One basin plus five feet of uninterrupted surface beats two sinks and two narrow margins for most people.</p>

<h2>13. Chicago 30" Single Vanity, Glossy White</h2>
<p><a href="/products/503-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V30-GW/bathroom-cabinet-chicago-30-glossy-white-503-v30-gw-1.webp" alt="Chicago 30" Single Vanity, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Flat slab doors and high-gloss lacquer, the most contemporary cabinet in this list and the one that most obviously wants to be floated. Gloss bounces light, useful in a windowless bathroom, and flat doors mean no grooves to collect toothpaste.</p>

<h2>14. Chicago 48" Single Vanity, Smokey Celadon</h2>
<p><a href="/products/503-v48-m-sc"><img src="https://images.bathroomvanitiesoutlet.com/503-V48-M-SC/bathroom-cabinet-chicago-48-smokey-celadon-503-v48-m-sc-1.webp" alt="Chicago 48" Single Vanity, Smokey Celadon which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Smokey Celadon is a muted green-gray that behaves almost like a neutral. At 48 inches, floated, it is the piece here most likely to still look considered rather than trend-chasing in five years.</p>

<h2>15. Chicago 72" Double Vanity, Walnut Whisper</h2>
<p><a href="/products/503-v72-wlw"><img src="https://images.bathroomvanitiesoutlet.com/503-V72-WLW/bathroom-cabinet-chicago-72-walnut-whisper-503-v72-wlw-1.webp" alt="Chicago 72" Double Vanity, Walnut Whisper which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Walnut Whisper across six feet of flat slab is a lot of continuous wood tone. Floated, with floor showing underneath, it reads as one horizontal gesture. Floor-mounted it reads as a sideboard. Same cabinet, genuinely different room.</p>

<h2>16. Amberly 30" Single Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v30-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V30-WLT/bathroom-cabinet-amberly-30-mid-century-walnut-670-v30-wlt-1.webp" alt="Amberly 30" Single Vanity Cabinet, Mid-Century Walnut which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Amberly ships with tapered legs, and this is the clearest case in the list where the mount choice changes the design language. On its legs it is unmistakably mid-century. On the wall it becomes minimalist. Pick whichever matches the rest of your house.</p>

<h2>17. Amberly 48" Single Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v48-m-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V48-M-WLT/bathroom-cabinet-amberly-48-mid-century-walnut-670-v48-m-wlt-1.webp" alt="Amberly 48" Single Vanity Cabinet, Mid-Century Walnut which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Mid-Century Walnut at 48 inches is the most forgiving size in this collection. It wants brass or matte black pulls and will look wrong with chrome, whichever way you mount it.</p>

<h2>18. Amberly 72" Double Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v72-m-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V72-M-WLT/bathroom-cabinet-amberly-72-mid-century-walnut-670-v72-m-wlt-1.webp" alt="Amberly 72" Double Vanity Cabinet, Mid-Century Walnut which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>At 72 inches the walnut grain becomes the feature. Floating this one costs you the tapered legs that give the collection its character, so this is the width where we would stand it on the floor and keep them.</p>

<h2>19. Laurent 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V30-HNO/bathroom-cabinet-laurent-30-honey-oak-545-v30-hno-1.webp" alt="Laurent 30" Single Vanity Cabinet, Honey Oak which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Laurent also comes on visible legs, which do the same space-opening job as floating it. Either way you see floor continue under the cabinet. Honey Oak is the warmest wood tone we stock, and at 30 inches it is the least intimidating way to use it.</p>

<h2>20. Laurent 48" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v48-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V48-HNO/bathroom-cabinet-laurent-48-honey-oak-545-v48-hno-1.webp" alt="Laurent 48" Single Vanity Cabinet, Honey Oak which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches of honey oak. Floated, the warmth reads lighter. On legs, it reads like furniture. This is the collection where we would let the rest of the bathroom decide rather than the trend.</p>

<h2>21. Laurent 72" Double Vanity Cabinet, Light Natural Oak</h2>
<p><a href="/products/545-v72-m-lno"><img src="https://images.bathroomvanitiesoutlet.com/545-V72-M-LNO/bathroom-cabinet-laurent-72-light-natural-oak-545-v72-m-lno-1.webp" alt="Laurent 72" Double Vanity Cabinet, Light Natural Oak which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Light Natural Oak is the paler of Laurent\'s two finishes and the better choice at six feet, because a large expanse of warm oak can tip a room from warm into orange. Floated at this width it is one of the calmer pieces here.</p>

<h2>22. Chianti 20" Single Vanity, Glossy White</h2>
<p><a href="/products/533v20gwwg"><img src="https://images.bathroomvanitiesoutlet.com/533V20GWWG/bathroom-vanities-chianti-20-glossy-white-533v20gwwg-1.webp" alt="Chianti 20" Single Vanity, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Twenty inches is powder-room territory, and floating it is the single best thing you can do in a bathroom that tight. The cabinet gives you a working sink and somewhere to set one thing down. The visible floor gives you the illusion of a room. Plan on a single-hole faucet.</p>

<h2>23. Chianti 24" Single Vanity, Glossy White</h2>
<p><a href="/products/533v24gwwg"><img src="https://images.bathroomvanitiesoutlet.com/533V24GWWG/bathroom-vanities-chianti-24-glossy-white-533v24gwwg-1.webp" alt="Chianti 24" Single Vanity, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Four inches more than the 20, and in a small powder room those four inches are all usable counter. Still small enough that floating it is clearly the right call.</p>

<h2>24. Chianti 24" Single Vanity, Walnut Whisper</h2>
<p><a href="/products/533v24wlwlwg"><img src="https://images.bathroomvanitiesoutlet.com/533V24WLWLWG/bathroom-vanities-chianti-24-walnut-whisper-533v24wlwlwg-1.webp" alt="Chianti 24" Single Vanity, Walnut Whisper which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>The same 24-inch body in wood rather than white. In a windowless powder room the white version will feel larger, but the walnut will feel finished, and a powder room is the one bathroom you can decorate rather than optimize.</p>

<h2>25. Athens 30" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V30-GW/bathroom-cabinet-athens-30-glossy-white-e645-v30-gw-1.webp" alt="Athens 30" Single Vanity Cabinet, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Athens is the plainest glossy white we carry, with the least door detail, so it disappears most completely into a white room. Floated in a small bathroom, that near-invisibility is the goal.</p>

<h2>26. Athens 48" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v48-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V48-GW/bathroom-cabinet-athens-48-glossy-white-e645-v48-gw-1.webp" alt="Athens 48" Single Vanity Cabinet, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white at 48 inches, floated, is the most reliably space-enlarging combination in this entire list. Nothing here is more likely to make a small bathroom read as a larger one.</p>

<h2>27. Athens 72" Double Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v72-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V72-GW/bathroom-cabinet-athens-72-glossy-white-e645-v72-gw-1.webp" alt="Athens 72" Double Vanity Cabinet, Glossy White which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of unbroken gloss is the most light-reflective option we sell and the most fingerprint-prone. Choose hardware you do not mind touching, because there is a lot of surface around the pulls.</p>

<h2>28. Mantova 31.5" Single Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/805-v31.5-wlt"><img src="https://images.bathroomvanitiesoutlet.com/805-V31.5-WLT/bathroom-cabinet-mantova-31-mid-century-walnut-805-v31-5-wlt-1.webp" alt="Mantova 31.5" Single Vanity Cabinet, Mid-Century Walnut which can be installed floating or floor-mounted" width="800" height="800" loading="lazy"></a></p>
<p>Mantova is the smallest collection we carry, and the 31.5-inch walnut is the whole of it. It also comes with a champagne brass base, which only makes sense floor-mounted. Float it and you get a clean walnut box. Stand it on the brass and you get the piece the designer drew.</p>

<h2>What you give up</h2>

<p>Honest accounting, because the usual advice skips this part.</p>

<p><strong>Storage.</strong> Hung on the wall, a cabinet has no toe-kick cavity and no full-height base, so it holds meaningfully less than the same cabinet standing on the floor. If your bathroom has no linen closet, that gap has to go somewhere.</p>

<p><strong>Install cost.</strong> Hanging a loaded cabinet off a wall is not a job for a confident amateur, and if the wall needs blocking added, the labor can approach the cost of the cabinet in a small bathroom. A floor-standing install sits on the floor and forgives a lot.</p>

<p><strong>Cleaning, both ways.</strong> You gain an open floor that a mop crosses in one pass, which is the thing people genuinely love. You lose the ability to ignore the underside of your vanity, which collects dust in plain sight.</p>

<p><strong>Flexibility.</strong> Once the cleat is mounted and the plumbing is set behind the cabinet, the height is fixed. That is an advantage if you are tall and want the counter at 36 inches instead of the standard 32, and a liability if you ever want to swap in a different piece.</p>

<h2>Common questions about floating vanities</h2>

<h3>Is a floating vanity the same as a wall-mounted or wall-hung vanity?</h3>
<p>Yes. All three terms describe a cabinet fixed to the wall with no legs or base touching the floor. "Floating" is the marketing word, "wall-hung" is what most installers say, and "wall-mounted" is what appears on spec sheets. If a listing uses one of them, it means the other two.</p>

<h3>Can any vanity be installed floating?</h3>
<p>No, and this is the question worth asking before you buy. A cabinet designed only to stand on the floor may have no mounting cleat, an unfinished underside, or a base that is structural rather than decorative. The twenty-eight above are the ones we can confirm either float by design or install both ways. If you are considering something else, ask us first.</p>

<h3>How much weight can a floating vanity hold?</h3>
<p>The cabinet is rarely the limit; the wall is. Properly blocked into studs, a floating vanity comfortably carries its own weight plus a stone top plus a full basin. Mounted into drywall anchors alone it will eventually fail, and it will fail with water running. This is not a corner to cut.</p>

<h3>Does floating cost more to install than floor-mounting?</h3>
<p>Usually yes, and occasionally by a lot. If the wall already has blocking where the cleat lands and the plumbing enters at the right height, the difference is modest. If either needs work, you are opening a wall. Since many of the cabinets above install both ways, it is worth getting your installer to look before you commit.</p>

<h3>Do floating vanities work in small bathrooms?</h3>
<p>That is their best use. Visible floor is what makes a small room read as larger, and the effect is strongest between 20 and 48 inches. The one thing to weigh is the storage you lose, which is felt most acutely in exactly the small bathrooms that benefit most from the look.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/small-bathroom-vanity-ideas">small bathroom vanity ideas</a> and <a href="/inspiration/modern-bathroom-vanity-ideas">modern vanity ideas</a>.</p>'
 WHERE slug = 'floating-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── farmhouse-bathroom-vanity-ideas ───
-- 24 numbered vanities, 1845 words. Source: docs/briefs/article_farmhouse_DRAFT.html
UPDATE pages
   SET content = '<p>Farmhouse is the most requested bathroom style we sell and the most loosely defined. It covers everything from a painted shaker cabinet to a reclaimed-timber washstand, and most of what gets sold under the label is really transitional with a barn door bolted on.</p>

<p>The twenty-four vanities below are the ones in our catalog that genuinely read farmhouse, across six collections. After the gallery there is a section on the four details that actually make a vanity farmhouse, which is useful whether you buy from us or not.</p>

<h2>What actually makes a vanity farmhouse</h2>

<p><strong>It looks like furniture, not cabinetry.</strong> This is the one that matters most. A farmhouse vanity reads as a piece that was carried into the room, not built into the wall. Visible legs are the clearest expression of it, which is why the Laurent collection below is the most unambiguously farmhouse thing we carry.</p>

<p><strong>The door is flat or shallow.</strong> Shaker and flat-panel doors are farmhouse. Deeply carved or raised-panel doors are traditional, which is a different style that often gets filed under the same heading. If the door has more than one plane of relief, it has probably left farmhouse behind.</p>

<p><strong>The finish is either honest wood or honest paint.</strong> Visible grain or a matte painted color. What breaks the look is anything glossy, because a lacquered surface is the one thing a nineteenth-century joiner could not have produced.</p>

<p><strong>The hardware is dark or aged.</strong> Matte black, oil-rubbed bronze or antique brass. Polished chrome on a farmhouse vanity is the single most common mistake, and it undoes the rest of the room on its own. Hardware is also the cheapest thing to change, so if you inherit the wrong finish it is a thirty-dollar fix rather than a regret.</p>

<h2>1. Breckenridge 30" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/330-v30-bw"><img src="https://images.bathroomvanitiesoutlet.com/330-V30-BW/bathroom-cabinet-breckenridge-30-bright-white-330-v30-bw-1.webp" alt="Breckenridge 30" Single Vanity Cabinet, Bright White, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Breckenridge is the broadest farmhouse collection we carry, and Bright White on a shallow shaker door is the most literal reading of the style. The shallow profile matters practically too: fewer deep grooves means fewer places for toothpaste to collect.</p>

<h2>2. Breckenridge 36" Single Vanity Cabinet, Light Natural Oak</h2>
<p><a href="/products/330-v36-lno"><img src="https://images.bathroomvanitiesoutlet.com/330-V36-LNO/bathroom-cabinet-breckenridge-36-light-natural-oak-330-v36-lno-1.webp" alt="Breckenridge 36" Single Vanity Cabinet, Light Natural Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Light Natural Oak is the finish that does the most farmhouse work in this collection. Visible grain, low contrast, nothing glossy. In a bathroom with white subway tile this is the combination most people are picturing when they search for the style.</p>

<h2>3. Breckenridge 48" Single Vanity, Serenity Blue</h2>
<p><a href="/products/330-v48-m-srb"><img src="https://images.bathroomvanitiesoutlet.com/330-V48-M-SRB/bathroom-cabinet-breckenridge-48-serenity-blue-330-v48-m-srb-1.webp" alt="Breckenridge 48" Single Vanity, Serenity Blue, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Serenity Blue is the farmhouse color that has aged best. Painted cabinetry in a muted blue is genuinely period-appropriate rather than a recent trend, and at 48 inches there is enough of it to register without taking over the room.</p>

<h2>4. Breckenridge 60" Double Vanity, Smokey Celadon</h2>
<p><a href="/products/330-v60d-sc"><img src="https://images.bathroomvanitiesoutlet.com/330-V60D-SC/bathroom-cabinet-breckenridge-60-smokey-celadon-330-v60d-sc-1.webp" alt="Breckenridge 60" Double Vanity, Smokey Celadon, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Smokey Celadon is a muted green-gray, and it is the quietest color here. Farmhouse interiors historically used soft greens as often as blues, so this reads as traditional rather than adventurous despite being the least common choice.</p>

<h2>5. Laurent 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V30-HNO/bathroom-cabinet-laurent-30-honey-oak-545-v30-hno-1.webp" alt="Laurent 30" Single Vanity Cabinet, Honey Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Laurent sits on visible legs, which is the single most farmhouse detail available on a vanity. A cabinet standing on legs reads as furniture that was brought into the room rather than built into it, and that distinction is most of what separates farmhouse from transitional.</p>

<h2>6. Laurent 36" Single Vanity Cabinet, Light Natural Oak</h2>
<p><a href="/products/545-v36-lno"><img src="https://images.bathroomvanitiesoutlet.com/545-V36-LNO/bathroom-cabinet-laurent-36-light-natural-oak-545-v36-lno-1.webp" alt="Laurent 36" Single Vanity Cabinet, Light Natural Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same legs in Light Natural Oak, which is paler and cooler than the honey. If your floor is already a warm wood, this is the finish that will not fight it.</p>

<h2>7. Laurent 48" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v48-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V48-HNO/bathroom-cabinet-laurent-48-honey-oak-545-v48-hno-1.webp" alt="Laurent 48" Single Vanity Cabinet, Honey Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches of honey oak on legs. This is the width where the farmhouse look is easiest to pull off, because the piece is substantial enough to be a feature but not so large that the legs start to look spindly.</p>

<h2>8. Laurent 60" Single Vanity, Light Natural Oak</h2>
<p><a href="/products/545-v60s-lno"><img src="https://images.bathroomvanitiesoutlet.com/545-V60S-LNO/bathroom-cabinet-laurent-60-light-natural-oak-545-v60s-lno-1.webp" alt="Laurent 60" Single Vanity, Light Natural Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A 60-inch single is an underrated farmhouse layout. One basin, four feet of clear counter, and the open space under the legs showing floor. Visually much lighter than a 60-inch double at the same width.</p>

<h2>9. Hudson 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/435-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/435-V30-HNO/bathroom-cabinet-hudson-30-honey-oak-435-v30-hno-1.webp" alt="Hudson 30" Single Vanity Cabinet, Honey Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Hudson\'s proportions are squarer than Laurent\'s, which suits a bathroom with a lower ceiling and gives a more grounded, utilitarian feel. Honey Oak is the warmest wood tone we stock.</p>

<h2>10. Hudson 36" Single Vanity Cabinet, Light Natural Oak</h2>
<p><a href="/products/435-v36-lno"><img src="https://images.bathroomvanitiesoutlet.com/435-V36-LNO/bathroom-cabinet-hudson-36-light-natural-oak-435-v36-lno-1.webp" alt="Hudson 36" Single Vanity Cabinet, Light Natural Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Light Natural Oak on Hudson\'s heavier frame. The combination reads as workshop rather than parlor, which is the more honest end of farmhouse and the harder one to buy ready-made.</p>

<h2>11. Hudson 48" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/435-v48-hno"><img src="https://images.bathroomvanitiesoutlet.com/435-V48-HNO/bathroom-cabinet-hudson-48-honey-oak-435-v48-hno-1.webp" alt="Hudson 48" Single Vanity Cabinet, Honey Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>At 48 inches Hudson is the most straightforwardly practical cabinet in this list. Full base, no legs, maximum enclosed storage, and a wood tone warm enough to carry the style without any applied detail.</p>

<h2>12. Hudson 60" Single Vanity Cabinet, Light Natural Oak</h2>
<p><a href="/products/435-v60s-lno"><img src="https://images.bathroomvanitiesoutlet.com/435-V60S-LNO/bathroom-cabinet-hudson-60-light-natural-oak-435-v60s-lno-1.webp" alt="Hudson 60" Single Vanity Cabinet, Light Natural Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sixty inches with one sink and a pale oak finish. If your bathroom has no linen closet, Hudson\'s full base holds considerably more than the equivalent Laurent on legs, and that trade is worth making more often than people think.</p>

<h2>13. Brookfield 36" Single Vanity, Black Onyx</h2>
<p><a href="/products/547-v36-bko"><img src="https://images.bathroomvanitiesoutlet.com/547-V36-BKO/bathroom-cabinet-brookfield-36-black-onyx-547-v36-bko-1.webp" alt="Brookfield 36" Single Vanity, Black Onyx, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Black Onyx is the farmhouse finish nobody expects and it is historically sound. Painted black cabinetry against white walls is a genuine period combination, and it hides the water marks around the handles that show on white within a week.</p>

<h2>14. Brookfield 48" Single Vanity, Honey Oak</h2>
<p><a href="/products/547-v48-hno"><img src="https://images.bathroomvanitiesoutlet.com/547-V48-HNO/bathroom-cabinet-brookfield-48-honey-oak-547-v48-hno-1.webp" alt="Brookfield 48" Single Vanity, Honey Oak, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield carries the heaviest door framing in this list, which is what pushes it toward traditional farmhouse rather than modern. In Honey Oak at 48 inches it is the piece most likely to look like it has always been in the house.</p>

<h2>15. Brookfield 60" Double Vanity, Pecan</h2>
<p><a href="/products/547-v60d-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V60D-PCN/bathroom-cabinet-brookfield-60-pecan-547-v60d-pcn-1.webp" alt="Brookfield 60" Double Vanity, Pecan, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Pecan is a mid-warmth brown that reads as wood rather than as a stain color. On Brookfield\'s framed doors it is the most conservative choice here, and conservative is frequently correct in a farmhouse bathroom.</p>

<h2>16. Brookfield 72" Double Vanity, Black Onyx</h2>
<p><a href="/products/547-v72-bko"><img src="https://images.bathroomvanitiesoutlet.com/547-V72-BKO/bathroom-cabinet-brookfield-72-black-onyx-547-v72-bko-1.webp" alt="Brookfield 72" Double Vanity, Black Onyx, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of black onyx with traditional framing. At this width the door detail becomes a feature rather than visual noise, and black gives it the contrast to actually read. Needs good lighting; black absorbs it.</p>

<h2>17. Portland 36" Single Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v36-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V36-WW/bathroom-cabinet-portland-36-whitewashed-walnut-620-v36-ww-1.webp" alt="Portland 36" Single Vanity Cabinet, Whitewashed Walnut, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed Walnut is the answer if you want farmhouse brightness without a painted finish. The grain stays visible through a pale wash, so it reads as light rather than as white, and it is the one wood tone here that does not commit the room to a temperature.</p>

<h2>18. Portland 48" Single Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v48-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V48-M-WW/bathroom-cabinet-portland-48-whitewashed-walnut-620-v48-m-ww-1.webp" alt="Portland 48" Single Vanity Cabinet, Whitewashed Walnut, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same whitewash at 48 inches. Portland\'s frame is squarer and more utilitarian than Brookfield\'s, so this is farmhouse without any period reference attached to it.</p>

<h2>19. Portland 60" Double Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v60d-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V60D-M-WW/bathroom-cabinet-portland-60-whitewashed-walnut-620-v60d-m-ww-1.webp" alt="Portland 60" Double Vanity Cabinet, Whitewashed Walnut, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A 60-inch double in whitewashed walnut. Pale wood at double width is the safest large farmhouse choice, because a dark finish across five feet starts to read as a piece of furniture rather than a bathroom.</p>

<h2>20. Portland 72" Double Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v72-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V72-M-WW/bathroom-cabinet-portland-72-whitewashed-walnut-620-v72-m-ww-1.webp" alt="Portland 72" Double Vanity Cabinet, Whitewashed Walnut, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Portland at full width. Six feet of whitewashed walnut is considerably calmer than six feet of any painted color, which is why this is the one we would recommend first for a large farmhouse primary bathroom.</p>

<h2>21. Malibu 36" Single Vanity Cabinet, Amber Birch</h2>
<p><a href="/products/505-v36-amb"><img src="https://images.bathroomvanitiesoutlet.com/505-V36-AMB/bathroom-cabinet-malibu-36-amber-birch-505-v36-amb-1.webp" alt="Malibu 36" Single Vanity Cabinet, Amber Birch, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Amber Birch is lighter and yellower than the oaks above, which makes it the most coastal-reading finish in this list. Farmhouse and coastal overlap heavily, and this is where the two meet.</p>

<h2>22. Malibu 48" Single Vanity, Amber Birch</h2>
<p><a href="/products/505-v48-amb"><img src="https://images.bathroomvanitiesoutlet.com/505-V48-AMB/bathroom-cabinet-malibu-48-amber-birch-505-v48-amb-1.webp" alt="Malibu 48" Single Vanity, Amber Birch, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches of amber birch. If your bathroom gets real daylight this finish comes alive; under artificial light alone it can flatten toward beige, so it is worth seeing a sample in the actual room.</p>

<h2>23. Malibu 60" Single Vanity Cabinet, Amber Birch</h2>
<p><a href="/products/505-v60s-amb"><img src="https://images.bathroomvanitiesoutlet.com/505-V60S-AMB/bathroom-cabinet-malibu-60-amber-birch-505-v60s-amb-1.webp" alt="Malibu 60" Single Vanity Cabinet, Amber Birch, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A 60-inch single in amber birch gives you a long run of clear counter in the lightest wood tone we carry. Good for a guest bathroom that doubles as the one people actually get ready in.</p>

<h2>24. Malibu 72" Double Vanity Cabinet, Amber Birch</h2>
<p><a href="/products/505-v72-amb"><img src="https://images.bathroomvanitiesoutlet.com/505-V72-AMB/bathroom-cabinet-malibu-72-amber-birch-505-v72-amb-1.webp" alt="Malibu 72" Double Vanity Cabinet, Amber Birch, a farmhouse style bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Malibu at 72 inches is the brightest large farmhouse option here. Where the Brookfield in black anchors a room, this one lifts it, and in a bathroom without much natural light that difference matters more than style does.</p>

<h2>Where farmhouse goes wrong</h2>

<p>Three failure modes, all of them avoidable.</p>

<p><strong>Too many signals at once.</strong> A shiplap wall, a barn door, a farmhouse apron sink, a reclaimed-wood mirror and a live-edge shelf in one small bathroom stops reading as a style and starts reading as a theme. Pick two. The vanity is the piece doing the most work, so let it carry the look and keep everything else quiet.</p>

<p><strong>Mixing warm and cool without meaning to.</strong> The oaks and birches above are warm. Bright White and Serenity Blue are cool. Either is fine; a warm honey oak vanity against cool gray tile is the mismatch people notice without being able to name. At any width above 48 inches, order a sample rather than judging from a screen.</p>

<p><strong>Buying the sink before the vanity.</strong> A farmhouse apron sink is a kitchen fixture and almost never fits a bathroom vanity cabinet as designed. If that is the look you want, settle it with your installer before you order anything, not after.</p>

<h2>Common questions about farmhouse bathroom vanities</h2>

<h3>What is the difference between farmhouse and rustic?</h3>
<p>Farmhouse is finished; rustic is not. A farmhouse vanity is painted or cleanly stained with square edges and visible joinery. A rustic one keeps the saw marks, the live edges and the distressing. Farmhouse is a style of furniture; rustic is a condition of material. All six collections above are the former.</p>

<h3>Should a farmhouse vanity be painted or wood?</h3>
<p>Both are correct and the room should decide. Painted reads lighter and more formal; it suits a bathroom with little natural light. Wood reads warmer and more utilitarian; it suits a room that already has daylight. If your floor is wood, a painted vanity avoids two competing grains.</p>

<h3>What hardware goes on a farmhouse vanity?</h3>
<p>Matte black, oil-rubbed bronze or antique brass, in that order of popularity. Avoid polished chrome, which fights the style more than any other single choice. Cup pulls on drawers and simple knobs on doors is the most period-correct combination, and it is also the most comfortable to use.</p>

<h3>Does farmhouse work in a small bathroom?</h3>
<p>Well, and better than most styles. A vanity on visible legs shows floor underneath, which makes a tight room read larger, and the light painted and pale wood finishes above do the same. The thing to avoid in a small farmhouse bathroom is dark paint plus a full base, which gives you a solid block in a room that cannot absorb it.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/white-bathroom-vanity-ideas">white vanity ideas</a> and <a href="/inspiration/small-bathroom-vanity-ideas">small bathroom vanity ideas</a>.</p>'
 WHERE slug = 'farmhouse-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── modern-bathroom-vanity-ideas ───
-- 21 numbered vanities, 1796 words. Source: docs/briefs/article_modern_DRAFT.html
UPDATE pages
   SET content = '<p>Modern is the style most often claimed and least often earned. A white cabinet with square doors is not modern; it is plain. What makes a bathroom vanity modern is the absence of applied decoration combined with a deliberate structural idea, and that is a much harder thing to buy by accident.</p>

<p>The twenty-one vanities below are the ones in our catalog that genuinely qualify, across six collections. After the gallery there is a section on the four things that separate modern from merely undecorated.</p>

<h2>What makes a vanity modern</h2>

<p><strong>The door has one plane.</strong> A flat slab front, no framing, no relief. The moment a door has a raised panel or an applied moulding, it has left modern for transitional. This is the single most reliable test and it takes two seconds to apply to any product photo.</p>

<p><strong>The structure is either hidden or shown, never disguised.</strong> Modern design is comfortable with a cabinet that floats off a wall with no visible support, and equally comfortable with an open metal frame that shows you exactly how it stands up. What it does not do is add decorative legs to imply furniture. Marcello and the Boston consoles below are the two ends of this.</p>

<p><strong>Color is used as a material, not as decoration.</strong> A modern vanity in sage green or smokey celadon reads as a considered surface. The same cabinet with a painted accent or a contrasting trim reads as a decorated one. Pick a color and let it be the whole piece.</p>

<p><strong>Hardware is minimal or absent.</strong> Push-to-open doors, integrated pulls or a single slim bar. Columbia\'s push-latch doors below are the cleanest expression; a traditional knob on a flat slab door undoes the look faster than anything else.</p>

<h2>1. Metropolitan 48" Single Vanity Cabinet, Silver Oak</h2>
<p><a href="/products/850-v48-sok"><img src="https://images.bathroomvanitiesoutlet.com/850-V48-SOK/bathroom-cabinet-metropolitan-48-silver-oak-850-v48-sok-1.webp" alt="Metropolitan 48" Single Vanity Cabinet, Silver Oak, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Silver Oak is a cool, grayed wood tone rather than a warm one, and that is what makes Metropolitan read modern rather than Scandinavian. Grain without warmth. At 48 inches it is the most restrained piece in this list.</p>

<h2>2. Metropolitan 72" Double Vanity Cabinet, Silver Oak</h2>
<p><a href="/products/850-v72-sok"><img src="https://images.bathroomvanitiesoutlet.com/850-V72-SOK/bathroom-cabinet-metropolitan-72-silver-oak-850-v72-sok-1.webp" alt="Metropolitan 72" Double Vanity Cabinet, Silver Oak, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same silver oak at six feet. Cool wood at this width is the hardest finish to get right and the most rewarding: it gives you grain and texture without the warmth that would push the room toward farmhouse.</p>

<h2>3. Oxford 29.5" Bathroom Vanity in Black</h2>
<p><a href="/products/oxford-29.5-blk-bg"><img src="https://images.bathroomvanitiesoutlet.com/Oxford-29.5-BLK-BG/bathroom-vanity-oxford-30-black-pr1024-1.webp" alt="Oxford 29.5" Bathroom Vanity in Black, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Oxford in black is modern at its most direct. No framing, no relief, no applied detail. Black also hides the water marks around the handles that show on white within a week, which matters on a cabinet this plain because there is nothing else to look at.</p>

<h2>4. Oxford 35.5" Bathroom Vanity in Sage Green</h2>
<p><a href="/products/oxford-35.5-camgrn-bg"><img src="https://images.bathroomvanitiesoutlet.com/Oxford-35.5-CAMGRN-BG/bathroom-vanity-oxford-36-sage-green-pr1025-1.webp" alt="Oxford 35.5" Bathroom Vanity in Sage Green, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sage Green is the color most likely to still look considered in five years. Muted greens behave almost as neutrals, sitting well against both warm wood and cool stone, and they have become the alternative to navy for people who want color without the obvious choice.</p>

<h2>5. Oxford 41.5" Bathroom Vanity in Whitewashed Ash</h2>
<p><a href="/products/oxford-41.5-wa-mb"><img src="https://images.bathroomvanitiesoutlet.com/Oxford-41.5-WA-MB/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-1.webp" alt="Oxford 41.5" Bathroom Vanity in Whitewashed Ash, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed Ash with matte black hardware is the most copied combination in modern bathrooms right now, and for good reason: the pale grain keeps the room light while the black gives it a line. The 41.5-inch width also fills an opening that 36 leaves short and 48 will not clear.</p>

<h2>6. Oxford 47.5" Bathroom Vanity in Black</h2>
<p><a href="/products/oxford-47.5-blk-bg"><img src="https://images.bathroomvanitiesoutlet.com/Oxford-47.5-BLK-BG/bathroom-vanity-oxford-48-black-pr1030-1.webp" alt="Oxford 47.5" Bathroom Vanity in Black, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Black at 47.5 inches is the largest Oxford, and the width where a flat slab front starts to read as architecture rather than furniture. Needs good lighting; black absorbs it, and a plain black cabinet in a dim room reads heavy rather than deliberate.</p>

<h2>7. Columbia 31.5" Single Vanity Cabinet, Ash Gray</h2>
<p><a href="/products/883-v31.5-agr"><img src="https://images.bathroomvanitiesoutlet.com/883-V31.5-AGR/bathroom-cabinet-columbia-31-ash-gray-883-v31-5-agr-1.webp" alt="Columbia 31.5" Single Vanity Cabinet, Ash Gray, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Columbia\'s doors are push-to-open, so nothing interrupts the front. On a modern cabinet that uninterrupted face is the entire design. Ash Gray is a cool neutral, so check it against your tile first, because warm cream tile against a cool gray cabinet reads as a mismatch.</p>

<h2>8. Columbia 36" Single Vanity Cabinet, Glossy White, Brushed Nickel</h2>
<p><a href="/products/983-v36-gw-bn"><img src="https://images.bathroomvanitiesoutlet.com/983-V36-GW-BN/bathroom-cabinet-columbia-36-glossy-white-983-v36-gw-bn-1.webp" alt="Columbia 36" Single Vanity Cabinet, Glossy White, Brushed Nickel, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white with brushed nickel. Gloss is the most modern surface we sell and the most practical in a windowless room, because it reflects whatever light you have. The cost is fingerprints, concentrated exactly where you touch it.</p>

<h2>9. Columbia 48" Single Vanity Cabinet, Glossy White, Radiant Gold</h2>
<p><a href="/products/983-v48-gw-rg"><img src="https://images.bathroomvanitiesoutlet.com/983-V48-GW-RG/bathroom-cabinet-columbia-48-glossy-white-983-v48-gw-rg-1.webp" alt="Columbia 48" Single Vanity Cabinet, Glossy White, Radiant Gold, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same glossy white with Radiant Gold instead of nickel, and the hardware is doing all the work. Warm metals against a cold white cabinet is the combination that keeps modern from tipping into clinical. Worth comparing against the nickel version above.</p>

<h2>10. Columbia 59" Double Vanity Cabinet, Glossy White, Radiant Gold</h2>
<p><a href="/products/983-v59d-gw-rg"><img src="https://images.bathroomvanitiesoutlet.com/983-V59D-GW-RG/bathroom-cabinet-columbia-60-glossy-white-983-v59d-gw-rg-1.webp" alt="Columbia 59" Double Vanity Cabinet, Glossy White, Radiant Gold, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A 59-inch double in glossy white and gold. The odd width is deliberate: it clears a 60-inch opening with tolerance to spare, which matters because bathroom walls are rarely plumb.</p>

<h2>11. Marcello 36" Single Vanity Cabinet, Chestnut</h2>
<p><a href="/products/d200-v36-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V36-CSN/bathroom-cabinet-marcello-36-chestnut-d200-v36-csn-1.webp" alt="Marcello 36" Single Vanity Cabinet, Chestnut, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Marcello is wall-mount only, which is as modern as a vanity gets. Chestnut is a mid-brown with visible grain that softens a piece otherwise made entirely of straight lines. In a white-tiled bathroom this is what stops the room feeling like a laboratory.</p>

<h2>12. Marcello 48" Single Vanity, Chestnut</h2>
<p><a href="/products/d200-v48-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V48-CSN/bathroom-cabinet-marcello-48-chestnut-d200-v48-csn-1.webp" alt="Marcello 48" Single Vanity, Chestnut, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Forty-eight inches of chestnut, floating. This is the sweet spot in the collection: wide enough to be generous, warm enough not to read as a showroom piece, and at a width where the wall mounting is straightforward.</p>

<h2>13. Marcello 72" Double Vanity Cabinet, Chestnut</h2>
<p><a href="/products/d200-v72-m-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V72-M-CSN/bathroom-cabinet-marcello-72-chestnut-d200-v72-m-csn-1.webp" alt="Marcello 72" Double Vanity Cabinet, Chestnut, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of wood grain running horizontally with floor visible underneath. The single most modern thing in our catalog, and the most demanding to install. Confirm your wall blocking before ordering.</p>

<h2>14. Boston 20" Single Console Vanity, Brushed Nickel</h2>
<p><a href="/products/c105v20bnkwg"><img src="https://images.bathroomvanitiesoutlet.com/C105V20BNKWG/boston-20-in-single-console-vanity-brushed-nickel-w-white-glossy-composite-stone-top-c105v20bnkwg-1.webp" alt="Boston 20" Single Console Vanity, Brushed Nickel, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Boston is a console vanity: an open metal frame with a stone top and nothing enclosed. That openness is the point, and at 20 inches it turns a powder room that could only take a pedestal sink into one with a real counter.</p>

<h2>15. Boston 31.5" Single Console Vanity, Matte Black</h2>
<p><a href="/products/c105v31.5mbkwg"><img src="https://images.bathroomvanitiesoutlet.com/C105V31.5MBKWG/boston-31-5-in-single-console-vanity-matte-black-w-white-glossy-composite-stone-top-c105v31-5mbkwg-1.webp" alt="Boston 31.5" Single Console Vanity, Matte Black, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The same console frame at 31.5 inches in matte black. An open frame shows the whole floor, which does more for a small modern bathroom than any cabinet can. You give up all enclosed storage in exchange, so this suits a powder room rather than a main bath.</p>

<h2>16. Boston 20" Single Console Vanity, Radiant Gold</h2>
<p><a href="/products/c105v20rgdwg"><img src="https://images.bathroomvanitiesoutlet.com/C105V20RGDWG/boston-20-in-single-console-vanity-radiant-gold-w-white-glossy-composite-stone-top-c105v20rgdwg-1.webp" alt="Boston 20" Single Console Vanity, Radiant Gold, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Radiant Gold on an open console frame is the most decorative piece in this list, and still unmistakably modern because the structure is exposed rather than hidden. Gold warms a white stone top that would otherwise read cold.</p>

<h2>17. Boston 31.5" Single Console Vanity, Brushed Nickel</h2>
<p><a href="/products/c105v31.5bnkwg"><img src="https://images.bathroomvanitiesoutlet.com/C105V31.5BNKWG/boston-31-5-in-single-console-vanity-brushed-nickel-w-white-glossy-composite-stone-top-c105v31-5bnkwg-1.webp" alt="Boston 31.5" Single Console Vanity, Brushed Nickel, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Brushed nickel at 31.5 inches is the quietest of the Boston consoles. If the open-frame look appeals but gold or black feels like too much of a statement, this is the version that recedes.</p>

<h2>18. Chicago 30" Single Vanity, Glossy White</h2>
<p><a href="/products/503-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V30-GW/bathroom-cabinet-chicago-30-glossy-white-503-v30-gw-1.webp" alt="Chicago 30" Single Vanity, Glossy White, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Flat slab doors and high-gloss lacquer, the most straightforwardly modern cabinet we carry. Flat doors also mean no grooves to collect toothpaste, which matters on a piece you stand close to. Chicago installs floating or floor-mounted, which is worth knowing before you choose.</p>

<h2>19. Chicago 36" Single Vanity, Smokey Celadon</h2>
<p><a href="/products/503-v36-sc"><img src="https://images.bathroomvanitiesoutlet.com/503-V36-SC/bathroom-cabinet-chicago-36-smokey-celadon-503-v36-sc-1.webp" alt="Chicago 36" Single Vanity, Smokey Celadon, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Smokey Celadon is a muted green-gray on a flat slab front. The combination of a soft color with hard geometry is what makes this read as designed rather than merely plain, and it is the piece here most likely to age well.</p>

<h2>20. Chicago 48" Single Vanity, Walnut Whisper</h2>
<p><a href="/products/503-v48-wlw"><img src="https://images.bathroomvanitiesoutlet.com/503-V48-WLW/bathroom-cabinet-chicago-48-walnut-whisper-503-v48-wlw-1.webp" alt="Chicago 48" Single Vanity, Walnut Whisper, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Walnut Whisper on a flat slab is modern using wood as a surface rather than as furniture: no framing, no legs, just grain. At 48 inches it is the easiest way to warm a modern bathroom without compromising the lines.</p>

<h2>21. Chicago 60" Double Vanity, Glossy White</h2>
<p><a href="/products/503-v60d-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V60D-GW/bathroom-cabinet-chicago-60-glossy-white-503-v60d-gw-1.webp" alt="Chicago 60" Double Vanity, Glossy White, a modern bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Five feet of glossy white with two basins. At this width gloss is doing real work in a windowless bathroom, bouncing light that a matte finish would absorb. Plan on hardware you do not mind touching.</p>

<h2>The mistake that makes modern feel cold</h2>

<p>The common failure is not getting modern wrong; it is getting it completely right. A flat white cabinet, white stone, white tile, chrome hardware and no texture anywhere produces a bathroom that is technically correct and genuinely unpleasant to stand in.</p>

<p>Three fixes, in order of how much they do.</p>

<p><strong>Put wood somewhere.</strong> The Walnut Whisper, Chestnut and Silver Oak cabinets above are modern and warm at the same time, because grain is texture without ornament. One wood surface in an otherwise hard room changes it entirely.</p>

<p><strong>Use a warm metal.</strong> Radiant gold or brushed brass against a cold white cabinet is the cheapest correction available, and hardware is the easiest thing to change later if you get it wrong.</p>

<p><strong>Choose a color instead of white.</strong> Sage green and smokey celadon are modern finishes that carry warmth on their own. They also age better than white, because white in a bathroom is a default rather than a decision and reads that way.</p>

<h2>Common questions about modern bathroom vanities</h2>

<h3>What is the difference between modern and contemporary?</h3>
<p>Modern refers to a specific design tradition built on flat surfaces, exposed or hidden structure, and no applied ornament. Contemporary just means whatever is current, which today largely means modern. In practice the terms are used interchangeably by retailers, including in search, so a search for either will return much the same thing.</p>

<h3>Should a modern vanity be floating?</h3>
<p>It does not have to be, but floating is the most clearly modern installation because it removes the base entirely. Marcello above is wall-mount only. Chicago and Columbia install either way, so you can have the cabinet and decide the look at install. A floating cabinet needs blocking in the wall, so settle it with your installer before ordering.</p>

<h3>What countertop works with a modern vanity?</h3>
<p>A thin profile matters more than the material. A 2cm top reads more modern than a 3cm one on the same cabinet, and an integrated sink reads more modern than a vessel. Heavy veining fights a flat slab front, so if you want marble, choose a quieter pattern than you would for a traditional vanity.</p>

<h3>Is modern a bad choice for an older house?</h3>
<p>Not in a bathroom. Bathrooms are the room where period consistency matters least, because almost nothing in them is original anyway. The thing to match is the trim and door profile in the immediately adjoining hallway. If that is heavily moulded, a wood-finished modern vanity will bridge the two better than a flat white one.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/floating-bathroom-vanity-ideas">floating vanity ideas</a> and <a href="/inspiration/white-bathroom-vanity-ideas">white vanity ideas</a>.</p>'
 WHERE slug = 'modern-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── double-sink-bathroom-vanity-ideas ───
-- 20 numbered vanities, 1619 words. Source: docs/briefs/article_double_DRAFT.html
UPDATE pages
   SET content = '<p>A double sink vanity solves exactly one problem: two people at the sink at the same time. It is worth being honest about that, because it is also the decision people most often regret, and the reason is always counter space.</p>

<p>Below are twenty double vanities across 60, 72 and 84 inches, one per collection and width, so you can see how much the layout changes with each foot you add. After the gallery there is a section on the width where double sinks stop being a compromise, which is the number worth knowing before you shop.</p>

<h2>The width that actually matters</h2>

<p>Two basins need roughly 30 inches each to feel like separate stations. Below 60 inches you are fitting two sinks into a space designed for one, and the result is two cramped basins with almost no counter between them.</p>

<p>At <strong>60 inches</strong> you get two sinks with about 14 to 16 inches of clear counter at each end and very little in the middle. It works, but it is tight: enough for a soap dish and a toothbrush cup, not enough to lay out a hair dryer and a makeup bag at once.</p>

<p>At <strong>72 inches</strong> the layout finally relaxes. Each sink gets its own usable margin and there is real counter between them. If your wall allows it, this is the width where a double sink stops being a trade-off and starts being an upgrade.</p>

<p>At <strong>84 inches</strong> you are into generous territory, usually with a bank of drawers or a full cabinet between the basins. This is the configuration people picture when they imagine a double vanity.</p>

<p>One cost that applies at every width: two basins need two drains and two sets of supply lines. If your bathroom was plumbed for one sink, budget for a plumber. The vanity price is not the project price.</p>

<h2>1. Brittany 84" Double Vanity, Bright White</h2>
<p><a href="/products/655-v84-bw"><img src="https://images.bathroomvanitiesoutlet.com/655-V84-BW/bathroom-cabinet-brittany-84-bright-white-655-v84-bw-1.webp" alt="Brittany 84-inch double vanity in bright white with a center bank of drawers" width="800" height="800" loading="lazy"></a></p>
<p>Seven feet is the widest double we carry, and at this size the center section becomes genuinely useful rather than decorative. Bright white keeps a piece this large from dominating the room, which a dark finish at 84 inches absolutely would.</p>

<h2>2. Brittany 60" Double Vanity Cabinet, Pecan</h2>
<p><a href="/products/655-v60d-pcn"><img src="https://images.bathroomvanitiesoutlet.com/655-V60D-PCN/bathroom-cabinet-brittany-60-pecan-655-v60d-pcn-1.webp" alt="Brittany 60-inch double vanity cabinet in pecan" width="800" height="800" loading="lazy"></a></p>
<p>The same collection at the tight end of the range, in a mid-warmth brown that reads as wood rather than as a stain color. Worth comparing against the 84 above to see what the extra two feet buys: it is almost entirely counter you will use.</p>

<h2>3. Lorelai 72" Double Vanity, Black Onyx</h2>
<p><a href="/products/424-v72-m-bko"><img src="https://images.bathroomvanitiesoutlet.com/424-V72-M-BKO/bathroom-cabinet-lorelai-72-black-onyx-424-v72-m-bko-1.webp" alt="Lorelai 72-inch double vanity in black onyx" width="800" height="800" loading="lazy"></a></p>
<p>Black at 72 inches needs a room that can absorb it and lighting that can reach it. When both are true, nothing else anchors a bathroom the same way, and it hides the water marks around the handles that show on white within a week.</p>

<h2>4. Breckenridge 72" Double Vanity, Serenity Blue</h2>
<p><a href="/products/330-v72-m-srb"><img src="https://images.bathroomvanitiesoutlet.com/330-V72-M-SRB/bathroom-cabinet-breckenridge-72-serenity-blue-330-v72-m-srb-1.webp" alt="Breckenridge 72-inch double vanity in soft serenity blue" width="800" height="800" loading="lazy"></a></p>
<p>Pale blue across six feet is softer than it sounds. At this width a saturated color would take over the room, but serenity blue stays close enough to neutral to read as a considered choice rather than a bold one.</p>

<h2>5. Lorelai 60" Double Vanity, Black Onyx</h2>
<p><a href="/products/424-v60d-m-bko"><img src="https://images.bathroomvanitiesoutlet.com/424-V60D-M-BKO/bathroom-cabinet-lorelai-60-black-onyx-424-v60d-m-bko-1.webp" alt="Lorelai 60-inch double vanity in black onyx" width="800" height="800" loading="lazy"></a></p>
<p>The same black onyx at 60 inches. The compression is visible here in a way it is not at 72: two basins and very little between them. If you want this finish and have the wall, go wider.</p>

<h2>6. Breckenridge 60" Double Vanity, Bright White</h2>
<p><a href="/products/330-v60d-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/330-V60D-M-BW/bathroom-cabinet-breckenridge-60-bright-white-330-v60d-m-bw-1.webp" alt="Breckenridge 60-inch double vanity in bright white with shaker doors" width="800" height="800" loading="lazy"></a></p>
<p>The most-ordered configuration in this list, and the default for a reason. White at 60 inches does not read as crowded even when the counter is tight, because there is no color boundary telling your eye where the vanity ends.</p>

<h2>7. Brookfield 60" Double Vanity, Pecan</h2>
<p><a href="/products/547-v60d-m-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V60D-M-PCN/bathroom-cabinet-brookfield-60-pecan-547-v60d-m-pcn-1.webp" alt="Brookfield 60-inch double vanity in pecan with traditional framing" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield\'s door framing is heavier than Brittany\'s in the same pecan, which pushes it toward traditional. If your house has crown molding or paneled doors, this is the one that will look native rather than added.</p>

<h2>8. Myrrin 60" Double Vanity, Carbon Oak</h2>
<p><a href="/products/485-v60d-cbo"><img src="https://images.bathroomvanitiesoutlet.com/485-V60D-CBO/bathroom-cabinet-myrrin-60-carbon-oak-485-v60d-cbo-1.webp" alt="Myrrin 60-inch double vanity in carbon oak" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak is the dark finish that works best at the tight end of this range, because the visible grain keeps it from reading as a solid dark mass the way flat black does at 60 inches.</p>

<h2>9. Bristol 72" Double Vanity Cabinet, Bright White</h2>
<p><a href="/products/157-v72-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/157-V72-M-BW/bathroom-cabinet-bristol-72-bright-white-157-v72-m-bw-1.webp" alt="Bristol 72-inch double vanity cabinet in bright white" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of bright white is the safest large double you can order. Note this ships as a cabinet, without a top, so the listed price is not the finished price.</p>

<h2>10. Chicago 60" Double Vanity, Glossy White</h2>
<p><a href="/products/503-v60d-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V60D-GW/bathroom-cabinet-chicago-60-glossy-white-503-v60d-gw-1.webp" alt="Chicago 60-inch double vanity in glossy white with flat slab doors" width="800" height="800" loading="lazy"></a></p>
<p>Flat slab doors and high-gloss lacquer make this the most contemporary double at 60 inches. Gloss bounces light, which matters in an interior bathroom, and flat doors mean no grooves to collect toothpaste.</p>

<h2>11. Bristol 60" Double Vanity Cabinet, Bright White</h2>
<p><a href="/products/157-v60d-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/157-V60D-M-BW/bathroom-cabinet-bristol-60-bright-white-157-v60d-m-bw-1.webp" alt="Bristol 60-inch double vanity cabinet in bright white" width="800" height="800" loading="lazy"></a></p>
<p>The same Bristol at 60. Directly comparable to the 72 at number nine, and the clearest illustration in this list of why the extra foot is the better buy when the wall allows it.</p>

<h2>12. Brookfield 72" Double Vanity, Pecan</h2>
<p><a href="/products/547-v72-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V72-PCN/bathroom-cabinet-brookfield-72-pecan-547-v72-pcn-1.webp" alt="Brookfield 72-inch double vanity in pecan" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield at the width it was really drawn for. Traditional framing needs room to read properly, and at six feet the door detail becomes a feature rather than visual noise.</p>

<h2>13. Chicago 72" Double Vanity, Glossy White</h2>
<p><a href="/products/503-v72-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V72-GW/bathroom-cabinet-chicago-72-glossy-white-503-v72-gw-1.webp" alt="Chicago 72-inch double vanity in glossy white" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of unbroken gloss is the most light-reflective option here, and the most fingerprint-prone. Plan on hardware you do not mind touching, because at this width there is a lot of surface near the pulls.</p>

<h2>14. Laurent 72" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v72-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V72-HNO/bathroom-cabinet-laurent-72-honey-oak-545-v72-hno-1.webp" alt="Laurent 72-inch double vanity cabinet in honey oak on slim legs" width="800" height="800" loading="lazy"></a></p>
<p>Laurent sits on visible legs, and at 72 inches that lifted stance does a lot of work. Six feet of cabinet sitting flat on the floor can feel like a wall; raising it and showing tile underneath keeps the room breathing.</p>

<h2>15. Laurent 60" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v60d-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V60D-HNO/bathroom-cabinet-laurent-60-honey-oak-545-v60d-hno-1.webp" alt="Laurent 60-inch double vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>The same legs and the same honey oak at the tighter width. In a 60-inch double the visible floor matters more, not less, because the counter above it is already compressed.</p>

<h2>16. Myrrin 72" Double Vanity, Carbon Oak</h2>
<p><a href="/products/485-v72-cbo-3car"><img src="https://images.bathroomvanitiesoutlet.com/485-V72-CBO-3CAR/bathroom-vanities-myrrin-72-carbon-oak-485-v72-cbo-3car-1.webp" alt="Myrrin 72-inch double vanity in carbon oak with a Carrara marble top" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak paired with a Carrara white marble top, which is the contrast most people are after with a dark cabinet: grain and depth below, bright stone above. This one arrives with the top included.</p>

<h2>17. Hudson 60" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/435-v60d-hno"><img src="https://images.bathroomvanitiesoutlet.com/435-V60D-HNO/bathroom-cabinet-hudson-60-honey-oak-435-v60d-hno-1.webp" alt="Hudson 60-inch double vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>Honey oak on a full base rather than legs. Squarer proportions than the Laurent, which suits a bathroom with a lower ceiling, and more enclosed storage in exchange for the visible floor.</p>

<h2>18. Kinnsden 72" Double Vanity Cabinet, Sable Oak</h2>
<p><a href="/products/d680-v72-sbk"><img src="https://images.bathroomvanitiesoutlet.com/D680-V72-SBK/bathroom-cabinet-kinnsden-72-sable-oak-d680-v72-sbk-1.webp" alt="Kinnsden 72-inch double vanity cabinet in sable oak" width="800" height="800" loading="lazy"></a></p>
<p>Sable oak is darker than carbon and browner than black, which makes it the dark finish least likely to fight a warm tile floor. At 72 inches it reads as substantial without reading as heavy.</p>

<h2>19. Bellshire 72" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/660-v72-hno"><img src="https://images.bathroomvanitiesoutlet.com/660-V72-HNO/bathroom-cabinet-bellshire-72-honey-oak-660-v72-hno-1.webp" alt="Bellshire 72-inch double vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>Third honey oak in this list, which tells you how well that tone sells at double widths. Bellshire is the plainest of the three, with the least door detail.</p>

<h2>20. Addison 72" Double Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e444-v72-gw"><img src="https://images.bathroomvanitiesoutlet.com/E444-V72-GW/bathroom-cabinet-addison-72-glossy-white-e444-v72-gw-1.webp" alt="Addison 72-inch double vanity cabinet in glossy white with framed doors" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white on a framed door rather than a flat slab, so you get the brightness of gloss in a room that is otherwise traditional. The bridge between the Chicago at number thirteen and the Brookfield at number twelve.</p>

<h2>Should you buy a double sink at all?</h2>

<p>The case against is simple and rarely made: a single sink at the same width gives you a continuous run of counter instead of two narrow margins. At 60 inches that is around 40 usable inches versus two strips of 15.</p>

<p>Buy two sinks if two people are genuinely at the vanity at the same time on a weekday morning. That is the scenario where it wins, and it wins decisively. If you are staggered by even fifteen minutes, or if the second basin is really about resale, a single will serve you better every day you live there. Resale value tracks the quality of the room far more than the number of basins in it.</p>

<p>If you do want two sinks and your wall is only 60 inches, the honest recommendation is to take the single and spend the difference on the countertop. You will notice good stone every morning. You will notice a cramped second basin every morning too, for the opposite reason.</p>

<h2>Common questions about double sink vanities</h2>

<h3>What is the minimum width for a double sink vanity?</h3>
<p>Sixty inches is the practical floor, and it is tight. Each basin needs about 30 inches to feel like its own station, so at 60 you get two sinks with minimal counter. Below 60 inches, fit a single sink instead.</p>

<h3>Do I need two drains and two faucets?</h3>
<p>Yes to both. Two basins require two drains, two sets of supply lines and two faucets. If your bathroom was plumbed for a single sink, moving the rough-in is a plumber\'s job and should be priced before you order.</p>

<h3>Is 60 or 72 inches better for a double vanity?</h3>
<p>Seventy-two, clearly, if the wall allows it. Sixty works but leaves each sink with 14 to 16 inches of counter and nothing in the middle. At 72 both basins get real margins and there is usable space between them.</p>

<h3>Can a double vanity have a single sink?</h3>
<p>Yes, and several of the cabinets above ship without a top precisely so you can choose. A 72-inch cabinet with one basin gives you an enormous clear counter, which some people prefer to two sinks even when they have room for both.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/60-inch-bathroom-vanity-ideas">60-inch vanity ideas</a> and <a href="/inspiration/master-bathroom-vanity-ideas">primary bathroom vanity ideas</a>.</p>'
 WHERE slug = 'double-sink-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── master-bathroom-vanity-ideas ───
-- 20 numbered vanities, 1636 words. Source: docs/briefs/article_master_DRAFT.html
UPDATE pages
   SET content = '<p>A primary bathroom vanity is usually the largest piece of furniture in the room, and at 72 inches and up the decisions change. Finish matters more because there is more of it. Layout matters more because you finally have room to choose. And the countertop stops being a detail and becomes a real line in the budget.</p>

<p>Below are twenty vanities at 70 inches and wider, one from each collection we carry. After the gallery there is a section on the three things that separate a primary bathroom vanity from a larger version of a hall-bath one.</p>

<h2>What changes above 70 inches</h2>

<p><strong>The countertop becomes a major cost.</strong> At 30 inches a stone top is a line item. At 72 it is often a significant share of the total. Several of the cabinets below ship without a top for exactly this reason, so you can choose your own stone and control that number. Know which you are looking at before you compare two prices.</p>

<p><strong>Delivery gets serious.</strong> A 72-inch vanity is a freight shipment, not a parcel. Measure your stairwell, your doorways and the turn at the top of the stairs before you order. A cabinet that fits the bathroom perfectly is still a problem if it does not fit the route to the bathroom.</p>

<p><strong>Finish choices get louder.</strong> A dark cabinet at 30 inches is an accent. The same finish at 72 inches is the room. This is the width where it is worth ordering a sample rather than judging from a screen, because the difference between warm and cool wood tones is the thing most likely to go wrong and the hardest to see online.</p>

<h2>1. Brittany 84" Double Vanity, Bright White</h2>
<p><a href="/products/655-v84-bw"><img src="https://images.bathroomvanitiesoutlet.com/655-V84-BW/bathroom-cabinet-brittany-84-bright-white-655-v84-bw-1.webp" alt="Brittany 84" Double Vanity, Bright White, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Seven feet is the widest vanity we carry, and at this scale the center section stops being decorative and becomes the most useful storage in the room. Bright white keeps a piece this large from dominating; a dark finish at 84 inches would swallow a bathroom.</p>

<h2>2. Bellshire 72" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/660-v72-hno"><img src="https://images.bathroomvanitiesoutlet.com/660-V72-HNO/bathroom-cabinet-bellshire-72-honey-oak-660-v72-hno-1.webp" alt="Bellshire 72" Double Vanity Cabinet, Honey Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Honey Oak is the warmest wood tone we stock, and six feet of it is a commitment. In a primary bathroom with good natural light it is the finish that makes the room feel residential rather than hotel-like.</p>

<h2>3. Lorelai 72" Double Vanity, Black Onyx</h2>
<p><a href="/products/424-v72-m-bko"><img src="https://images.bathroomvanitiesoutlet.com/424-V72-M-BKO/bathroom-cabinet-lorelai-72-black-onyx-424-v72-m-bko-1.webp" alt="Lorelai 72" Double Vanity, Black Onyx, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Black onyx at six feet anchors a room the way nothing else does, and it hides the water marks around the handles that show on white within a week. It needs real lighting; black absorbs it, and in a dim primary bath this reads heavy instead of dramatic.</p>

<h2>4. Breckenridge 72" Double Vanity, Serenity Blue</h2>
<p><a href="/products/330-v72-m-srb"><img src="https://images.bathroomvanitiesoutlet.com/330-V72-M-SRB/bathroom-cabinet-breckenridge-72-serenity-blue-330-v72-m-srb-1.webp" alt="Breckenridge 72" Double Vanity, Serenity Blue, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Serenity Blue across six feet is softer than it sounds. A saturated color at this width would take over the room, but this stays close enough to neutral to read as considered rather than bold.</p>

<h2>5. Myrrin 72" Vanity, Carbon Oak</h2>
<p><a href="/products/485-v72-m-cbo"><img src="https://images.bathroomvanitiesoutlet.com/485-V72-M-CBO/bathroom-cabinet-myrrin-72-carbon-oak-485-v72-m-cbo-1.webp" alt="Myrrin 72" Vanity, Carbon Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak gives you the depth of a dark cabinet with visible grain, so six feet of it never reads as a solid dark block. The easiest dark finish to live with if black feels like too much.</p>

<h2>6. Bristol 72" Double Vanity Cabinet, Bright White</h2>
<p><a href="/products/157-v72-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/157-V72-M-BW/bathroom-cabinet-bristol-72-bright-white-157-v72-m-bw-1.webp" alt="Bristol 72" Double Vanity Cabinet, Bright White, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>The safest large vanity you can order. Note this ships as a cabinet, without a top, so the listed price is not the finished price. That is an advantage if you want to choose your own stone, which at this width is a meaningful part of the budget.</p>

<h2>7. Brookfield 72" Double Vanity, Pecan</h2>
<p><a href="/products/547-v72-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V72-PCN/bathroom-cabinet-brookfield-72-pecan-547-v72-pcn-1.webp" alt="Brookfield 72" Double Vanity, Pecan, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield\'s heavier door framing needs room to read properly, and six feet is the width it was really drawn for. If your house has crown molding or paneled doors, this will look native rather than added.</p>

<h2>8. Chicago 72" Double Vanity, Glossy White</h2>
<p><a href="/products/503-v72-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V72-GW/bathroom-cabinet-chicago-72-glossy-white-503-v72-gw-1.webp" alt="Chicago 72" Double Vanity, Glossy White, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Six feet of unbroken high-gloss lacquer is the most light-reflective surface in this list and the most fingerprint-prone. Choose hardware you do not mind touching, because there is a lot of surface around the pulls.</p>

<h2>9. Laurent 72" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v72-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V72-HNO/bathroom-cabinet-laurent-72-honey-oak-545-v72-hno-1.webp" alt="Laurent 72" Double Vanity Cabinet, Honey Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Laurent sits on visible legs, and at 72 inches that lifted stance does real work. Six feet of cabinet sitting flat on the floor can feel like a wall; raising it and showing tile underneath keeps the room breathing.</p>

<h2>10. Kinnsden 72" Double Vanity Cabinet, Sable Oak</h2>
<p><a href="/products/d680-v72-sbk"><img src="https://images.bathroomvanitiesoutlet.com/D680-V72-SBK/bathroom-cabinet-kinnsden-72-sable-oak-d680-v72-sbk-1.webp" alt="Kinnsden 72" Double Vanity Cabinet, Sable Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sable oak is darker than carbon and browner than black, which makes it the dark finish least likely to fight a warm tile floor. At 72 inches it reads as substantial without reading as heavy.</p>

<h2>11. Addison 72" Double Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e444-v72-gw"><img src="https://images.bathroomvanitiesoutlet.com/E444-V72-GW/bathroom-cabinet-addison-72-glossy-white-e444-v72-gw-1.webp" alt="Addison 72" Double Vanity Cabinet, Glossy White, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white on a framed door rather than a flat slab, so you get the brightness of gloss in a room that is otherwise traditional. The bridge between the Chicago above and the Brookfield.</p>

<h2>12. Allamari 72" Double Vanity Cabinet, Sable</h2>
<p><a href="/products/d640-v72-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D640-V72-SBL/bathroom-cabinet-allamari-72-sable-d640-v72-sbl-1.webp" alt="Allamari 72" Double Vanity Cabinet, Sable, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Allamari is wall-mount only, which at 72 inches is the most dramatic thing you can do in a primary bathroom and the most demanding to install. Six feet of cabinet with floor running underneath it. Confirm your wall blocking before ordering.</p>

<h2>13. Lucian 72" Double Vanity, Carbon Oak</h2>
<p><a href="/products/d704-v72-cbo"><img src="https://images.bathroomvanitiesoutlet.com/D704-V72-CBO/bathroom-cabinet-lucian-72-carbon-oak-d704-v72-cbo-1.webp" alt="Lucian 72" Double Vanity, Carbon Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak on a plainer body than the Myrrin above. If you liked that finish but wanted less detail on the doors, this is the same color with the ornament removed.</p>

<h2>14. Gracyn 72" Double Vanity, Sable</h2>
<p><a href="/products/d125-v72-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D125-V72-SBL/bathroom-cabinet-gracyn-72-sable-d125-v72-sbl-1.webp" alt="Gracyn 72" Double Vanity, Sable, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sable without oak grain, so this is the flatter, more modern reading of a dark cabinet at full width. Pairs best with a pale stone top that gives the eye somewhere to rest.</p>

<h2>15. Amberly 72" Double Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v72-m-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V72-M-WLT/bathroom-cabinet-amberly-72-mid-century-walnut-670-v72-m-wlt-1.webp" alt="Amberly 72" Double Vanity Cabinet, Mid-Century Walnut, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Tapered legs and warm walnut, the clearest mid-century piece at this scale. It wants brass or matte black pulls and will look wrong with chrome. The legs are also what keep 72 inches of dark wood from feeling like furniture that arrived in the wrong room.</p>

<h2>16. Marcello 72" Double Vanity Cabinet, Chestnut</h2>
<p><a href="/products/d200-v72-m-csn"><img src="https://images.bathroomvanitiesoutlet.com/D200-V72-M-CSN/bathroom-cabinet-marcello-72-chestnut-d200-v72-m-csn-1.webp" alt="Marcello 72" Double Vanity Cabinet, Chestnut, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Marcello is wall-mount only. Chestnut grain across six feet gives the eye something to follow, which is why this reads as less severe than a flat dark cabinet at the same width.</p>

<h2>17. Emmeline 72" Double Vanity Cabinet, Pebble Oak</h2>
<p><a href="/products/d100-v72-m-pbo"><img src="https://images.bathroomvanitiesoutlet.com/D100-V72-M-PBO/bathroom-cabinet-emmeline-72-pebble-oak-d100-v72-m-pbo-1.webp" alt="Emmeline 72" Double Vanity Cabinet, Pebble Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Pebble Oak is a cool, grayed wood tone rather than a warm one, which makes it the oak to choose if your tile is cool. Warm oak against cool gray tile is the most common finish mismatch in a primary bathroom.</p>

<h2>18. Solene 72" Double Vanity, Seaside Oak</h2>
<p><a href="/products/d225-v72-sso"><img src="https://images.bathroomvanitiesoutlet.com/D225-V72-SSO/bathroom-cabinet-solene-72-seaside-oak-d225-v72-sso-1.webp" alt="Solene 72" Double Vanity, Seaside Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Seaside Oak is the lightest wood finish in this list and the most coastal-reading. In a primary bathroom with a window it keeps six feet of cabinet feeling airy rather than substantial.</p>

<h2>19. Marigot 72" Double Vanity, Sunwashed Oak</h2>
<p><a href="/products/d404-v72-swo"><img src="https://images.bathroomvanitiesoutlet.com/D404-V72-SWO/bathroom-cabinet-marigot-72-sunwashed-oak-d404-v72-swo-1.webp" alt="Marigot 72" Double Vanity, Sunwashed Oak, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Sunwashed Oak sits between the Seaside above and the Honey Oak at the top: warm, but bleached rather than golden. The safest wood tone here if you are unsure how warm you want the room.</p>

<h2>20. Portland 72" Double Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v72-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V72-M-WW/bathroom-cabinet-portland-72-whitewashed-walnut-620-v72-m-ww-1.webp" alt="Portland 72" Double Vanity Cabinet, Whitewashed Walnut, a large primary bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed Walnut keeps the grain visible while reading almost as a neutral, so it works in a primary bathroom that is otherwise all white. The one wood tone here that does not commit the room to a temperature.</p>

<h2>One sink or two at this width?</h2>

<p>Above 70 inches this stops being the trade-off it is at 60. At 72 inches two basins each get a genuinely usable margin plus real counter between them, so if two people use the bathroom at the same time, take the double.</p>

<p>The case for a single at 72 inches is narrower but real: you get roughly five feet of continuous counter instead of two three-foot runs, and continuous counter is what you want if you get ready at the vanity rather than just wash at it. If only one person uses the room, a 72-inch single is a better bathroom than a 72-inch double.</p>

<p>Either way, remember that two basins mean two drains and two sets of supply lines. If your bathroom was plumbed for one sink, that is a plumber\'s job and belongs in the budget before the cabinet does.</p>

<h2>Common questions about primary bathroom vanities</h2>

<h3>What is a good size for a primary bathroom vanity?</h3>
<p>Seventy-two inches is the most common and the most forgiving. It takes two sinks comfortably or one sink with an enormous counter, and it fits most primary bathroom walls without custom work. Eighty-four inches is better if you have the wall, mainly because the center section becomes real storage.</p>

<h3>Should I buy the cabinet and the countertop separately?</h3>
<p>At this width, often yes. A 72-inch top is a significant cost, and buying the cabinet alone lets you choose the stone rather than accept what was paired with it. Any listing above with "Cabinet" in the name ships without a top. Confirm the top you choose matches the cabinet\'s depth as well as its width.</p>

<h3>Will a 72-inch vanity fit through my door?</h3>
<p>Check before you order. The cabinet arrives assembled and is both wide and heavy. Measure your narrowest doorway, your stairwell and any turn on the way. This is the most common delivery problem at this size and it is entirely avoidable.</p>

<h3>Is a dark finish a mistake in a large bathroom?</h3>
<p>Not if the room has light. Large bathrooms usually have a window, which is exactly what a dark cabinet needs. The actual risk at this width is temperature mismatch: a warm walnut against cool gray tile, or a cool gray cabinet against warm cream tile. Order a sample before committing to six feet of anything.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/double-sink-bathroom-vanity-ideas">double sink vanity ideas</a> and <a href="/inspiration/60-inch-bathroom-vanity-ideas">60-inch vanity ideas</a>.</p>'
 WHERE slug = 'master-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── small-bathroom-vanity-ideas ───
-- 20 numbered vanities, 1687 words. Source: docs/briefs/article_small_DRAFT.html
UPDATE pages
   SET content = '<p>A small bathroom vanity is anything up to about 36 inches wide, and that range covers two very different problems. At 30 to 36 inches you are furnishing a real bathroom that happens to be tight. At 20 to 24 inches you are solving a powder room where the door and the toilet are already arguing over the floor.</p>

<p>Below are twenty vanities at 36 inches and under, one from each collection, so you can see the full range of what that width can look like. After the gallery there is a section on the two measurements that actually decide whether a vanity fits, both of which people skip.</p>

<h2>Measure the depth and the door swing, not just the width</h2>

<p>Width is the number everyone checks and the one least likely to cause a problem. Two others cause most of the returns.</p>

<p><strong>Depth.</strong> A standard vanity is 21 to 22 inches deep. In a bathroom under 40 square feet that depth is what makes the room feel like a corridor. Several of the vanities below are built shallower, and losing two inches of counter depth you were never going to use buys back walking space you feel every day.</p>

<p><strong>Door swing.</strong> Measure from the hinge side of your bathroom door to the nearest edge of where the vanity will sit. A 30-inch vanity that fits the wall perfectly is still wrong if the door hits the corner of the counter. This is the single most common small-bathroom mistake, and nothing about the product listing will warn you.</p>

<h2>1. Brittany 30" Single Vanity Cabinet, Pecan</h2>
<p><a href="/products/655-v30-pcn"><img src="https://images.bathroomvanitiesoutlet.com/655-V30-PCN/bathroom-cabinet-brittany-30-pecan-655-v30-pcn-1.webp" alt="Brittany 30-inch single vanity cabinet in a warm pecan finish" width="800" height="800" loading="lazy"></a></p>
<p>Pecan is a mid-warmth brown that reads as wood rather than as a stain color, which is useful in a small room where a strong color has nowhere to go. Brittany is the widest-ranging collection we carry, so if you later add a matching mirror or linen tower, this is the one most likely to still be available.</p>

<h2>2. Breckenridge 30" Single Vanity, Serenity Blue</h2>
<p><a href="/products/330-v30-srb"><img src="https://images.bathroomvanitiesoutlet.com/330-V30-SRB/bathroom-cabinet-breckenridge-30-serenity-blue-330-v30-srb-1.webp" alt="Breckenridge 30-inch single vanity in a soft serenity blue" width="800" height="800" loading="lazy"></a></p>
<p>A small bathroom is the best place to take a color risk, because there is less of it to live with and the room is usually one you are in briefly. Serenity blue is pale enough to keep the space feeling open while giving it an actual identity instead of defaulting to white.</p>

<h2>3. Bristol 30" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/157-v30-bw"><img src="https://images.bathroomvanitiesoutlet.com/157-V30-BW/bathroom-cabinet-bristol-30-bright-white-157-v30-bw-1.webp" alt="Bristol 30-inch single vanity cabinet in bright white" width="800" height="800" loading="lazy"></a></p>
<p>The safe answer, and safe is often right at this size. White against white tile removes a visual boundary, which is most of why small bathrooms get painted white in the first place. Expect to wipe the area around the pulls more often than you would on a darker finish.</p>

<h2>4. Myrrin 36" Vanity, Carbon Oak</h2>
<p><a href="/products/485-v36-cbo"><img src="https://images.bathroomvanitiesoutlet.com/485-V36-CBO/bathroom-cabinet-myrrin-36-carbon-oak-485-v36-cbo-1.webp" alt="Myrrin 36-inch vanity in carbon oak, a dark gray wood finish" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak gives you a dark cabinet without committing to black. In a small bathroom that distinction matters: the grain catches light and keeps the piece from reading as a solid dark block the way flat black does.</p>

<h2>5. Chicago 30" Single Vanity, Glossy White</h2>
<p><a href="/products/503-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V30-GW/bathroom-cabinet-chicago-30-glossy-white-503-v30-gw-1.webp" alt="Chicago 30-inch single vanity in glossy white with flat slab doors" width="800" height="800" loading="lazy"></a></p>
<p>Gloss is genuinely useful in a windowless bathroom because it bounces whatever light you do have. Flat slab doors also mean no grooves to collect toothpaste, which is a real consideration on a cabinet you stand close to.</p>

<h2>6. Lorelai 36" Single Vanity, Black Onyx</h2>
<p><a href="/products/424-v36-bko"><img src="https://images.bathroomvanitiesoutlet.com/424-V36-BKO/bathroom-cabinet-lorelai-36-black-onyx-424-v36-bko-1.webp" alt="Lorelai 36-inch single vanity in black onyx" width="800" height="800" loading="lazy"></a></p>
<p>Black in a small bathroom works if the room has good light and fails if it does not. What it does better than any white: hide the water marks that appear around the handles within a week of installation.</p>

<h2>7. Addison 30" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e444-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/E444-V30-GW/bathroom-cabinet-addison-30-glossy-white-e444-v30-gw-1.webp" alt="Addison 30-inch single vanity cabinet in glossy white with a framed door" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white on a framed door rather than a flat slab. If your house has paneled interior doors or any trim detail, Addison will look like it belongs where the Chicago above would look imported from somewhere else.</p>

<h2>8. Laurent 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V30-HNO/bathroom-cabinet-laurent-30-honey-oak-545-v30-hno-1.webp" alt="Laurent 30-inch single vanity cabinet in honey oak with slim legs" width="800" height="800" loading="lazy"></a></p>
<p>Laurent sits on visible legs, and in a small bathroom that gap under the cabinet is worth more than the storage it costs you. Seeing floor continue under the vanity is the cheapest way to make a tight room read larger.</p>

<h2>9. Bellshire 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/660-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/660-V30-HNO/bathroom-cabinet-bellshire-30-honey-oak-660-v30-hno-1.webp" alt="Bellshire 30-inch single vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>The same honey oak as the Laurent, on a full base instead of legs. Straight trade: more enclosed storage, less visible floor. In a bathroom with no linen closet, take the storage.</p>

<h2>10. Hudson 30" Single Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/435-v30-hno"><img src="https://images.bathroomvanitiesoutlet.com/435-V30-HNO/bathroom-cabinet-hudson-30-honey-oak-435-v30-hno-1.webp" alt="Hudson 30-inch single vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>Hudson\'s proportions are squarer than either of the two above, which suits a bathroom with a lower ceiling. Honey oak for the third time here, because it is the warmest wood tone we stock and it is popular for a reason.</p>

<h2>11. Brookfield 36" Single Vanity, Pecan</h2>
<p><a href="/products/547-v36-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V36-PCN/bathroom-cabinet-brookfield-36-pecan-547-v36-pcn-1.webp" alt="Brookfield 36-inch single vanity in pecan with traditional door framing" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield carries heavier door framing than the Brittany at number one in the same pecan finish, which pushes it toward traditional. Worth comparing the two directly if you like the color and are unsure how formal you want the room.</p>

<h2>12. Kinnsden 36" Single Vanity Cabinet, Sable Oak</h2>
<p><a href="/products/d680-v36-sbk"><img src="https://images.bathroomvanitiesoutlet.com/D680-V36-SBK/bathroom-cabinet-kinnsden-36-sable-oak-d680-v36-sbk-1.webp" alt="Kinnsden 36-inch single vanity cabinet in sable oak" width="800" height="800" loading="lazy"></a></p>
<p>Sable oak is darker than carbon and browner than black, which makes it the easiest dark finish to pair with warm tile. If your floor is a beige or terracotta tone, this is the dark cabinet that will not fight it.</p>

<h2>13. De Soto 30" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/825-v30-bw"><img src="https://images.bathroomvanitiesoutlet.com/825-V30-BW/bathroom-cabinet-de-soto-30-bright-white-825-v30-bw-1.webp" alt="De Soto 30-inch single vanity cabinet in bright white" width="800" height="800" loading="lazy"></a></p>
<p>A cleaner, less decorated white than the Bristol at number three. De Soto is the one to pick if you want white without any period reference attached to it.</p>

<h2>14. Amberly 30" Single Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v30-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V30-WLT/bathroom-cabinet-amberly-30-mid-century-walnut-670-v30-wlt-1.webp" alt="Amberly 30-inch single vanity cabinet in mid-century walnut with tapered legs" width="800" height="800" loading="lazy"></a></p>
<p>Tapered legs, warm walnut, minimal hardware. The clearest mid-century piece at this size, and the legs do the same space-opening job as the Laurent while carrying a lot more personality. It wants brass or matte black pulls and will look wrong with chrome.</p>

<h2>15. Emmeline 36" Single Vanity Cabinet, Pistachio</h2>
<p><a href="/products/d100-v36-pst"><img src="https://images.bathroomvanitiesoutlet.com/D100-V36-PST/bathroom-cabinet-emmeline-36-pistachio-d100-v36-pst-1.webp" alt="Emmeline 36-inch single vanity cabinet in a soft pistachio green" width="800" height="800" loading="lazy"></a></p>
<p>Pistachio is the most adventurous finish in this list and reads almost as a neutral in practice. Soft greens sit well against both warm wood and cool stone, which is why they have become the alternative to navy for people who want color without the obvious choice.</p>

<h2>16. Columbia 31.5" Single Vanity Cabinet, Ash Gray</h2>
<p><a href="/products/883-v31.5-agr"><img src="https://images.bathroomvanitiesoutlet.com/883-V31.5-AGR/bathroom-cabinet-columbia-31-ash-gray-883-v31-5-agr-1.webp" alt="Columbia 31.5-inch single vanity cabinet in ash gray" width="800" height="800" loading="lazy"></a></p>
<p>The odd width is the point: 31.5 inches fits an opening where a true 32 would not, and that half inch of tolerance is worth having when bathroom walls are rarely plumb. Ash gray is a cool neutral, so check it against your tile before committing.</p>

<h2>17. Athens 30" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V30-GW/bathroom-cabinet-athens-30-glossy-white-e645-v30-gw-1.webp" alt="Athens 30-inch single vanity cabinet in glossy white" width="800" height="800" loading="lazy"></a></p>
<p>Third glossy white at 30 inches in this list, which tells you something about what sells. Athens is the plainest of the three, with the least door detail, and it is the one that disappears most completely into a white room.</p>

<h2>18. Gracyn 36" Single Vanity, Sable</h2>
<p><a href="/products/d125-v36-sbl"><img src="https://images.bathroomvanitiesoutlet.com/D125-V36-SBL/bathroom-cabinet-gracyn-36-sable-d125-v36-sbl-1.webp" alt="Gracyn 36-inch single vanity in a dark sable finish" width="800" height="800" loading="lazy"></a></p>
<p>Sable without the oak grain of the Kinnsden, so this is the flatter, more modern reading of a dark cabinet. At 36 inches it is the largest size most people can get away with in a genuinely small bathroom.</p>

<h2>19. Lucian 36" Single Vanity, Carbon Oak</h2>
<p><a href="/products/d704-v36-cbo"><img src="https://images.bathroomvanitiesoutlet.com/D704-V36-CBO/bathroom-cabinet-lucian-36-carbon-oak-d704-v36-cbo-1.webp" alt="Lucian 36-inch single vanity in carbon oak" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak again, on a plainer body than the Myrrin at number four. If you liked that finish but wanted less detail on the doors, this is the same color with the ornament removed.</p>

<h2>20. Chianti 20" Single Vanity, Glossy White</h2>
<p><a href="/products/533v20gwwg"><img src="https://images.bathroomvanitiesoutlet.com/533V20GWWG/bathroom-vanities-chianti-20-glossy-white-533v20gwwg-1.webp" alt="Chianti 20-inch single vanity in glossy white, sized for a powder room" width="800" height="800" loading="lazy"></a></p>
<p>Twenty inches is powder-room territory, and this is the piece for the bathroom where a 30-inch vanity simply will not go. You get a working sink and a place to set one thing down. That is the honest expectation, and in a room where the alternative is a pedestal sink with no storage at all, it is a clear win.</p>

<h2>Getting more out of a small vanity</h2>

<p>Three things that change how much a small vanity holds, none of which are about the vanity.</p>

<p><strong>Drawers beat doors.</strong> Behind a door, the back third of the cabinet is effectively lost, because you cannot see or reach it without emptying the front. A drawer presents its whole contents at once. If two vanities are the same width and one has drawers, it holds more of what you will actually use.</p>

<p><strong>Go up, not out.</strong> The wall above a small vanity is usually doing nothing but holding a mirror. A mirrored cabinet instead of a flat mirror adds the storage a narrow vanity cannot, at zero cost in floor space.</p>

<p><strong>Pick the faucet with the vanity.</strong> On a 20 to 24 inch vanity, a widespread faucet eats the counter you were counting on. A single-hole faucet leaves the usable space intact. This is easy to get wrong by ordering the two separately.</p>

<h2>Common questions about small bathroom vanities</h2>

<h3>What is the smallest practical bathroom vanity?</h3>
<p>Around 20 inches, which is where this list ends. Below that you are into wall-hung basins with no cabinet at all. At 20 to 24 inches you get real storage, but plan on a single-hole faucet and accept that the counter holds one item.</p>

<h3>Is 30 or 36 inches better for a small bathroom?</h3>
<p>Take 36 if the wall and the door swing allow it. The extra six inches is almost entirely usable counter, and it is the difference between a bathroom that works and one you tolerate. Measure the door swing before you decide, not after.</p>

<h3>Should a small bathroom vanity be light or dark?</h3>
<p>Light if the room has little natural light, because a dark cabinet in a dim small bathroom reads as heavy rather than dramatic. If you have a window or good overhead lighting, dark is fine and hides daily marks far better than white does.</p>

<h3>Can I use a shallower vanity to free up floor space?</h3>
<p>Yes, and in a bathroom under 40 square feet it is usually the better trade. Standard depth is 21 to 22 inches. Dropping to 18 costs you counter area you were unlikely to use and returns walking room you notice every day.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/floating-bathroom-vanity-ideas">floating vanity ideas</a> and <a href="/inspiration/white-bathroom-vanity-ideas">white vanity ideas</a>.</p>'
 WHERE slug = 'small-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── white-bathroom-vanity-ideas ───
-- 20 numbered vanities, 1602 words. Source: docs/briefs/article_white_DRAFT.html
UPDATE pages
   SET content = '<p>White is the most-ordered bathroom vanity finish by a wide margin, and the reason is not that people lack imagination. White removes a visual boundary. Against white tile and white walls, the vanity stops being an object in the room and becomes part of it, which is why small bathrooms read larger in white than in anything else.</p>

<p>The complication is that white is not one color. The twenty vanities below cover bright white, glossy white and whitewashed wood, and those three behave completely differently in a real bathroom. After the gallery there is a section on choosing between them, plus the honest downside nobody mentions.</p>

<h2>Three kinds of white, and they are not interchangeable</h2>

<p><strong>Bright white</strong> is a flat, opaque paint finish. It is the most neutral and the most forgiving against other colors in the room, and it is what most people picture. It is also the one that shows marks most clearly around the handles.</p>

<p><strong>Glossy white</strong> is lacquered. It reflects light rather than absorbing it, which is genuinely useful in a windowless bathroom, and its flat slab doors usually have no grooves to collect toothpaste. The cost is fingerprints: gloss shows every one, concentrated exactly where you touch the cabinet.</p>

<p><strong>Whitewashed wood</strong> is not really white at all. The grain stays visible through a pale finish, so it reads as light rather than as white. If flat white feels cold to you, this is the answer, and it is the only one of the three that brings any warmth to the room.</p>

<p>The mistake to avoid is mixing warm and cool whites without meaning to. A cool bright white cabinet against warm cream tile reads as a mismatch rather than as a neutral, and it is almost impossible to judge from a screen. At any width above 48 inches, order a sample.</p>

<h2>1. Bristol 60" Single Vanity Whitewashed Walnut</h2>
<p><a href="/products/157-v60s-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/157-V60S-M-WW/bathroom-cabinet-bristol-60-whitewashed-walnut-157-v60s-m-ww-1.webp" alt="Bristol 60" Single Vanity Whitewashed Walnut, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed walnut is white without being a white cabinet. The grain stays visible while the tone reads almost as a neutral, which is the answer if you want brightness but find flat white cold. As a 60-inch single it leaves four feet of clear counter.</p>

<h2>2. Breckenridge 60" Double Vanity, Bright White</h2>
<p><a href="/products/330-v60d-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/330-V60D-M-BW/bathroom-cabinet-breckenridge-60-bright-white-330-v60d-m-bw-1.webp" alt="Breckenridge 60" Double Vanity, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Bright white on a shallow shaker door, which is the detail that matters: fewer deep grooves means fewer places for toothpaste to collect. White is the hardest finish to keep looking clean and this is one of the easier whites to keep.</p>

<h2>3. Lorelai 36" Single Vanity, Bright White</h2>
<p><a href="/products/424-v36-bw"><img src="https://images.bathroomvanitiesoutlet.com/424-V36-BW/bathroom-cabinet-lorelai-36-bright-white-424-v36-bw-1.webp" alt="Lorelai 36" Single Vanity, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Bright white at 36 inches, on a cleaner body than most. In a hall bath this is the configuration that sells more than any other, because white at a small width makes the room read larger without any other change.</p>

<h2>4. Brittany 84" Double Vanity, Bright White</h2>
<p><a href="/products/655-v84-bw"><img src="https://images.bathroomvanitiesoutlet.com/655-V84-BW/bathroom-cabinet-brittany-84-bright-white-655-v84-bw-1.webp" alt="Brittany 84" Double Vanity, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Seven feet of bright white, and at this scale white is doing structural work: a dark cabinet at 84 inches would swallow the room. The center bank of drawers becomes the most useful storage in the bathroom.</p>

<h2>5. Chicago 30" Single Vanity, Glossy White</h2>
<p><a href="/products/503-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V30-GW/bathroom-cabinet-chicago-30-glossy-white-503-v30-gw-1.webp" alt="Chicago 30" Single Vanity, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Glossy rather than matte, and the difference is practical. Gloss bounces light, which matters in a windowless bathroom, and the flat slab doors give toothpaste nowhere to collect. The trade-off is fingerprints near the pulls.</p>

<h2>6. Bellshire 30" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/660-v30-bw"><img src="https://images.bathroomvanitiesoutlet.com/660-V30-BW/bathroom-cabinet-bellshire-30-bright-white-660-v30-bw-1.webp" alt="Bellshire 30" Single Vanity Cabinet, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A plain bright white with minimal door detail. Bellshire is the one to choose if you want white to disappear entirely rather than contribute a style of its own.</p>

<h2>7. Portland 36" Single Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v36-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V36-WW/bathroom-cabinet-portland-36-whitewashed-walnut-620-v36-ww-1.webp" alt="Portland 36" Single Vanity Cabinet, Whitewashed Walnut, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed walnut again at a smaller width. Worth comparing directly against the Bellshire above: same brightness, completely different warmth. This is the choice between a white room and a light room.</p>

<h2>8. Myrrin 36" Vanity, Bright White</h2>
<p><a href="/products/485-v36-bw"><img src="https://images.bathroomvanitiesoutlet.com/485-V36-BW/bathroom-cabinet-myrrin-36-bright-white-485-v36-bw-1.webp" alt="Myrrin 36" Vanity, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Myrrin in bright white is the most contemporary small white here, with a flatter front than the traditional options. Pairs naturally with a frameless mirror and large-format tile.</p>

<h2>9. Addison 30" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e444-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/E444-V30-GW/bathroom-cabinet-addison-30-glossy-white-e444-v30-gw-1.webp" alt="Addison 30" Single Vanity Cabinet, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white on a framed door rather than a flat slab. If your house has paneled interior doors or any trim detail, this will look like it belongs where the Chicago would look imported.</p>

<h2>10. De Soto 30" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/825-v30-bw"><img src="https://images.bathroomvanitiesoutlet.com/825-V30-BW/bathroom-cabinet-de-soto-30-bright-white-825-v30-bw-1.webp" alt="De Soto 30" Single Vanity Cabinet, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>De Soto is the cleanest, least decorated white in this list. The one to pick if you want white with no period reference attached to it at all.</p>

<h2>11. Athens 30" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v30-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V30-GW/bathroom-cabinet-athens-30-glossy-white-e645-v30-gw-1.webp" alt="Athens 30" Single Vanity Cabinet, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Athens has the least door detail of the three glossy whites here, which means it disappears most completely into a white room. It also installs floating or floor-mounted, which is worth knowing before you choose.</p>

<h2>12. Columbia 36" Single Vanity Cabinet, Glossy White, No Hardware</h2>
<p><a href="/products/983-v36-gw"><img src="https://images.bathroomvanitiesoutlet.com/983-V36-GW/bathroom-cabinet-columbia-36-glossy-white-983-v36-gw-1.webp" alt="Columbia 36" Single Vanity Cabinet, Glossy White, No Hardware, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>This one ships with no hardware by design, because the doors are push-to-open. An entirely uninterrupted white front is the appeal. The caveat is children, since push latches get sticky faster than pulls do.</p>

<h2>13. Palisades 36" Single Vanity Cabinet, Bright White</h2>
<p><a href="/products/527-v36-bw"><img src="https://images.bathroomvanitiesoutlet.com/527-V36-BW/bathroom-cabinet-palisades-36-bright-white-527-v36-bw-1.webp" alt="Palisades 36" Single Vanity Cabinet, Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Palisades is a quieter bright white with a soft door profile, sitting between the plain De Soto and the framed Addison. A safe middle choice if you cannot decide how much detail you want.</p>

<h2>14. Olena 36" Single Vanity, Light Mappa Burl and Polished White</h2>
<p><a href="/products/d804-v36-lmb"><img src="https://images.bathroomvanitiesoutlet.com/D804-V36-LMB/bathroom-cabinet-olena-36-polished-white-and-light-d804-v36-lmb-1.webp" alt="Olena 36" Single Vanity, Light Mappa Burl and Polished White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Light Mappa Burl paired with polished white, which is the most decorative white in this list. Burl has real figure to it, so this is white as a backdrop for pattern rather than white as a neutral.</p>

<h2>15. Kensington 41.5" Bathroom Vanity in Bright White</h2>
<p><a href="/products/kensington-41.5-wh-bn"><img src="https://images.bathroomvanitiesoutlet.com/Kensington-41.5-WH-BN/bathroom-vanity-kensington-42-bright-white-pr0981-1.webp" alt="Kensington 41.5" Bathroom Vanity in Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Bright white with brushed nickel, and the 41.5-inch width is the useful part: it fills an opening where 36 leaves a gap and 48 will not fit. That size gap is common in older homes and badly served.</p>

<h2>16. Linear 59" Double Vanity, Glossy White</h2>
<p><a href="/products/210-v59d-gw"><img src="https://images.bathroomvanitiesoutlet.com/210-V59D-GW/bathroom-cabinet-linear-60-glossy-white-210-v59d-gw-1.webp" alt="Linear 59" Double Vanity, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Linear is all horizontal lines and no ornament, the most minimal white here. At 59 inches it clears a 60-inch opening with tolerance, which matters because bathroom walls are rarely plumb.</p>

<h2>17. Chianti 20" Single Vanity, Glossy White</h2>
<p><a href="/products/533v20gwwg"><img src="https://images.bathroomvanitiesoutlet.com/533V20GWWG/bathroom-vanities-chianti-20-glossy-white-533v20gwwg-1.webp" alt="Chianti 20" Single Vanity, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Twenty inches is powder-room territory. Glossy white at this size is the best combination available for a bathroom where a 30-inch vanity simply will not go. Plan on a single-hole faucet; a widespread one eats the counter you were counting on.</p>

<h2>18. London 23.5" Bathroom Vanity in Bright White</h2>
<p><a href="/products/london-23.5-wh-bn"><img src="https://images.bathroomvanitiesoutlet.com/London-23.5-WH-BN/bathroom-vanity-london-24-bright-white-pr0993-2.webp" alt="London 23.5" Bathroom Vanity in Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>A 23.5-inch bright white with brushed nickel, sized for a powder room that can take a little more than the Chianti. Arrives as a complete vanity rather than a cabinet, so the top and sink are included.</p>

<h2>19. Windsor 29.5" Bathroom Vanity in Bright White</h2>
<p><a href="/products/windsor-29.5-wh-bn"><img src="https://images.bathroomvanitiesoutlet.com/Windsor-29.5-WH-BN/bathroom-vanity-windsor-30-bright-white-pr1007-1.webp" alt="Windsor 29.5" Bathroom Vanity in Bright White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Bright white at just under 30 inches, again complete with its top. Windsor\'s detailing is the most traditional of the small whites here, which suits an older house better than a flat slab would.</p>

<h2>20. Alicante 24" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e110-v24-gw"><img src="https://images.bathroomvanitiesoutlet.com/E110-V24-GW/bathroom-cabinet-alicante-24-glossy-white-e110-v24-gw-1.webp" alt="Alicante 24" Single Vanity Cabinet, Glossy White, a white bathroom vanity" width="800" height="800" loading="lazy"></a></p>
<p>Glossy white at 24 inches, and the smallest cabinet-style vanity we carry after the Chianti. In a powder room, gloss plus a small footprint is the combination that buys back the most apparent space.</p>

<h2>The honest downside</h2>

<p>White shows everything, and it shows it fastest exactly where you touch the cabinet. Water marks appear around the handles within a week of installation. Toothpaste collects in door grooves. None of this is a reason not to buy white, but it is a reason to make two choices deliberately.</p>

<p><strong>Pick doors with shallow profiles.</strong> A flat slab or a shallow shaker has far fewer places for residue to sit than a deeply framed traditional door. This matters more on white than on any other finish.</p>

<p><strong>Pick hardware you are happy to touch.</strong> On a glossy white cabinet the area around the pulls is where fingerprints concentrate. Larger pulls spread the contact; small knobs concentrate it.</p>

<p>If daily upkeep is a real concern, a whitewashed wood finish is the compromise. It gives you most of the brightness and hides marks the way a flat white cannot.</p>

<h2>Common questions about white bathroom vanities</h2>

<h3>Does a white vanity make a bathroom look bigger?</h3>
<p>Yes, and it is the cheapest way to do it. Against white walls and tile, a white vanity removes the boundary that tells your eye where the room ends. The effect is strongest in small bathrooms and at narrower widths, and glossy white adds to it by reflecting light.</p>

<h3>Is glossy or matte white better?</h3>
<p>Glossy if the bathroom has no window, because it bounces the light you have. Matte if the room is already bright and you would rather not wipe fingerprints. Glossy also tends to come on flat slab doors, which are easier to keep clean in every respect except fingerprints.</p>

<h3>What countertop goes with a white vanity?</h3>
<p>Almost anything, which is the point of buying white. Carrara and other white marbles keep the room uniformly bright; a darker stone gives the eye a line to rest on and stops a white-on-white bathroom feeling washed out. If you want contrast without drama, a warm-veined white stone does both.</p>

<h3>Will a white vanity look dated?</h3>
<p>Less than anything else here. White has been the default bathroom finish for decades and has not cycled out in that time. The elements that date a bathroom are hardware finishes, faucet shapes and tile patterns, all of which are cheaper to change than the vanity.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/modern-bathroom-vanity-ideas">modern vanity ideas</a> and <a href="/inspiration/farmhouse-bathroom-vanity-ideas">farmhouse vanity ideas</a>.</p>'
 WHERE slug = 'white-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── 60-inch-bathroom-vanity-ideas ───
-- 19 numbered vanities, 1744 words. Source: docs/briefs/article_60inch_DRAFT.html
UPDATE pages
   SET content = '<p>Sixty inches is the width where a bathroom vanity stops being a compromise. It is wide enough for two sinks without crowding them, wide enough for a single sink with genuinely usable counter on both sides, and it still fits the standard alcove in most mid-century and later American homes. It is the most-requested size we ship, and it is also the size with the most decisions attached to it.</p>

<p>Below are nineteen 60-inch vanities currently in stock, one from each collection we carry, so you can see how differently the same width reads depending on finish, door style, and whether you put one sink on it or two. After the gallery there is a short section on the single-versus-double decision, which is the one most people get wrong.</p>

<h2>One thing to check before you shop</h2>

<p>Several of the vanities below are listed as a <strong>Vanity Cabinet</strong> rather than a <strong>Vanity</strong>. That is not a naming quirk. A cabinet ships without a countertop, which lets you choose your own stone and sink configuration later, and it means the price you see is not the finished price. A vanity listed without "Cabinet" includes its top. Both are legitimate ways to buy; just know which one you are looking at before you compare two numbers.</p>

<p>The second thing worth measuring twice is your plumbing. A 60-inch cabinet gives you room to move a drain a few inches, but a double-sink layout fixes both drains near the ends, and if your existing rough-in sits dead center you may be paying a plumber to move it.</p>

<h2>1. Brittany 60" Double Vanity Cabinet, Pecan</h2>
<p><a href="/products/655-v60d-pcn"><img src="https://images.bathroomvanitiesoutlet.com/655-V60D-PCN/bathroom-cabinet-brittany-60-pecan-655-v60d-pcn-1.webp" alt="Brittany 60-inch double vanity cabinet in a pecan finish with paneled doors and drawers" width="800" height="800" loading="lazy"></a></p>
<p>Brittany is the broadest collection we stock, and the pecan finish is why. It is a mid-warmth brown that reads as wood rather than as a stain color, which makes it forgiving against both cream and gray tile. The double configuration puts a bank of drawers dead center, so the storage you actually reach for daily is between the two sinks rather than behind a door.</p>

<h2>2. Breckenridge 60" Double Vanity, Bright White</h2>
<p><a href="/products/330-v60d-m-bw"><img src="https://images.bathroomvanitiesoutlet.com/330-V60D-M-BW/bathroom-cabinet-breckenridge-60-bright-white-330-v60d-m-bw-1.webp" alt="Breckenridge 60-inch double vanity in bright white with shaker-style doors" width="800" height="800" loading="lazy"></a></p>
<p>Bright white is the safest color in a bathroom and the hardest to keep looking clean, and Breckenridge handles the second part better than most because the door profile is shallow. Fewer deep grooves means fewer places for toothpaste to collect. This one ships with its top, so the listed price is the price.</p>

<h2>3. Brookfield 60" Double Vanity, Pecan</h2>
<p><a href="/products/547-v60d-m-pcn"><img src="https://images.bathroomvanitiesoutlet.com/547-V60D-M-PCN/bathroom-cabinet-brookfield-60-pecan-547-v60d-m-pcn-1.webp" alt="Brookfield 60-inch double vanity in pecan with traditional detailing" width="800" height="800" loading="lazy"></a></p>
<p>Brookfield in the same pecan as the Brittany above, and worth comparing side by side, the finish is shared but the door framing is heavier, which pushes it toward traditional where Brittany sits closer to transitional. If you have crown molding elsewhere in the house, this is the one that will look like it belongs.</p>

<h2>4. Bristol 60" Single Vanity, Whitewashed Walnut</h2>
<p><a href="/products/157-v60s-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/157-V60S-M-WW/bathroom-cabinet-bristol-60-whitewashed-walnut-157-v60s-m-ww-1.webp" alt="Bristol 60-inch single vanity in whitewashed walnut with open lower shelf" width="800" height="800" loading="lazy"></a></p>
<p>A 60-inch single is an underrated layout. You get one sink and roughly four feet of uninterrupted counter, which is more usable space for getting ready than two sinks and two small margins. Whitewashed walnut keeps the grain visible while reading almost as a neutral, so it works in a room that is otherwise all white.</p>

<h2>5. Chicago 60" Double Vanity, Glossy White</h2>
<p><a href="/products/503-v60d-gw"><img src="https://images.bathroomvanitiesoutlet.com/503-V60D-GW/bathroom-cabinet-chicago-60-glossy-white-503-v60d-gw-1.webp" alt="Chicago 60-inch double vanity in glossy white with flat slab doors" width="800" height="800" loading="lazy"></a></p>
<p>Flat slab doors and a high-gloss lacquer make this the most contemporary 60-inch in the lineup. Gloss bounces light, which matters in an interior bathroom with no window. The trade-off is that gloss shows fingerprints near the pulls, so plan on hardware you are happy to touch.</p>

<h2>6. Lorelai 60" Double Vanity, Black Onyx</h2>
<p><a href="/products/424-v60d-m-bko"><img src="https://images.bathroomvanitiesoutlet.com/424-V60D-M-BKO/bathroom-cabinet-lorelai-60-black-onyx-424-v60d-m-bko-1.webp" alt="Lorelai 60-inch double vanity in black onyx" width="800" height="800" loading="lazy"></a></p>
<p>Black anchors a room the way nothing else does, and it hides water marks around the handles that would show on white within a week. The thing to check is light: black absorbs it, so in a small or north-facing bathroom this needs good overhead lighting or it will feel heavy rather than dramatic.</p>

<h2>7. Hudson 60" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/435-v60d-hno"><img src="https://images.bathroomvanitiesoutlet.com/435-V60D-HNO/bathroom-cabinet-hudson-60-honey-oak-435-v60d-hno-1.webp" alt="Hudson 60-inch double vanity cabinet in honey oak" width="800" height="800" loading="lazy"></a></p>
<p>Honey oak is the warmest wood tone we carry and the one that most clearly reads as wood rather than as a finish. Hudson\'s proportions are squarer than Laurent\'s below, which suits a room with a lower ceiling.</p>

<h2>8. Laurent 60" Double Vanity Cabinet, Honey Oak</h2>
<p><a href="/products/545-v60d-hno"><img src="https://images.bathroomvanitiesoutlet.com/545-V60D-HNO/bathroom-cabinet-laurent-60-honey-oak-545-v60d-hno-1.webp" alt="Laurent 60-inch double vanity cabinet in honey oak with slim legs" width="800" height="800" loading="lazy"></a></p>
<p>Same honey oak as the Hudson, different stance. Laurent sits on visible legs, which lifts the whole piece off the floor and shows more tile. In a small bathroom that visual gap is worth more than the storage you give up underneath.</p>

<h2>9. Myrrin 60" Double Vanity, Carbon Oak</h2>
<p><a href="/products/485-v60d-cbo"><img src="https://images.bathroomvanitiesoutlet.com/485-V60D-CBO/bathroom-cabinet-myrrin-60-carbon-oak-485-v60d-cbo-1.webp" alt="Myrrin 60-inch double vanity in carbon oak, a dark gray wood finish" width="800" height="800" loading="lazy"></a></p>
<p>Carbon oak splits the difference between black and wood: you get the grain and the depth without the weight of a true black. It is the easiest dark finish to live with if you are nervous about committing to black onyx.</p>

<h2>10. Addison 60" Double Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e444-v60d-gw"><img src="https://images.bathroomvanitiesoutlet.com/E444-V60D-GW/bathroom-cabinet-addison-60-glossy-white-e444-v60d-gw-1.webp" alt="Addison 60-inch double vanity cabinet in glossy white" width="800" height="800" loading="lazy"></a></p>
<p>Addison is the more decorated take on glossy white. Where Chicago is a flat slab, this carries a framed door. If you want the brightness of gloss in a room that is otherwise traditional, this is the bridge.</p>

<h2>11. Amberly 60" Double Vanity Cabinet, Mid-Century Walnut</h2>
<p><a href="/products/670-v60d-m-wlt"><img src="https://images.bathroomvanitiesoutlet.com/670-V60D-M-WLT/bathroom-cabinet-amberly-60-mid-century-walnut-670-v60d-m-wlt-1.webp" alt="Amberly 60-inch double vanity cabinet in mid-century walnut with tapered legs" width="800" height="800" loading="lazy"></a></p>
<p>The clearest mid-century piece at this width: tapered legs, warm walnut, minimal hardware. It wants brass or matte black pulls and will look wrong with chrome.</p>

<h2>12. Portland 60" Double Vanity Cabinet, Whitewashed Walnut</h2>
<p><a href="/products/620-v60d-m-ww"><img src="https://images.bathroomvanitiesoutlet.com/620-V60D-M-WW/bathroom-cabinet-portland-60-whitewashed-walnut-620-v60d-m-ww-1.webp" alt="Portland 60-inch double vanity cabinet in whitewashed walnut" width="800" height="800" loading="lazy"></a></p>
<p>Whitewashed walnut again, this time on a squarer, more utilitarian frame. Portland is the one to pick if you want wood tone without any period reference at all.</p>

<h2>13. Malibu 60" Single Vanity Cabinet, Amber Birch</h2>
<p><a href="/products/505-v60s-amb"><img src="https://images.bathroomvanitiesoutlet.com/505-V60S-AMB/bathroom-cabinet-malibu-60-amber-birch-505-v60s-amb-1.webp" alt="Malibu 60-inch single vanity cabinet in amber birch" width="800" height="800" loading="lazy"></a></p>
<p>Amber birch is lighter and yellower than the oaks above, which makes it the most coastal-reading finish we stock. As a 60-inch single it leaves a long clear run of counter, good for a guest bathroom that doubles as the one people actually get ready in.</p>

<h2>14. Columbia 59" Double Vanity Cabinet, Latte Oak</h2>
<p><a href="/products/983-v59d-lto"><img src="https://images.bathroomvanitiesoutlet.com/983-V59D-LTO/bathroom-cabinet-columbia-60-latte-oak-983-v59d-lto-1.webp" alt="Columbia 59-inch double vanity cabinet in latte oak with no hardware" width="800" height="800" loading="lazy"></a></p>
<p>This one ships with no hardware, by design, because the doors are push-to-open. If you like a completely uninterrupted front, that is the appeal; if you have children, push latches get sticky faster than pulls do. At 59 inches it fits a 60-inch opening with a little breathing room.</p>

<h2>15. Athens 60" Single Vanity Cabinet, Glossy White</h2>
<p><a href="/products/e645-v60s-gw"><img src="https://images.bathroomvanitiesoutlet.com/E645-V60S-GW/bathroom-cabinet-athens-60-glossy-white-e645-v60s-gw-1.webp" alt="Athens 60-inch single vanity cabinet in glossy white" width="800" height="800" loading="lazy"></a></p>
<p>A glossy white single at 60 inches is a specific choice and a good one for a primary bathroom where only one person is ever at the sink. All that counter on one side becomes real working space instead of a second basin nobody uses.</p>

<h2>16. Kensington 59.5" Double Sink Vanity, Metal Gray</h2>
<p><a href="/products/kensington-59.5d-mgr-bn"><img src="https://images.bathroomvanitiesoutlet.com/Kensington-59.5D-MGR-BN/bathroom-vanity-kensington-60d-metal-gray-pr0988-1.webp" alt="Kensington 59.5-inch double sink vanity in metal gray with brushed nickel hardware" width="800" height="800" loading="lazy"></a></p>
<p>Metal gray is cooler than the carbon oak at number nine: less wood, more pigment. It pairs naturally with the brushed nickel it ships with, and it is the gray to choose if your tile is also cool-toned. Warm cream tile against a cool gray vanity reads as a mismatch rather than a neutral.</p>

<h2>17. London 59.5" Double Sink Vanity, Desert Oak</h2>
<p><a href="/products/london-59.5d-doak-mb"><img src="https://images.bathroomvanitiesoutlet.com/London-59.5D-DOAK-MB/bathroom-vanity-london-60d-desert-oak-pr1002-1.webp" alt="London 59.5-inch double sink vanity in desert oak with matte black hardware" width="800" height="800" loading="lazy"></a></p>
<p>Desert oak with matte black hardware is about as current as a bathroom gets without dating itself in three years. This arrives as a complete vanity rather than a cabinet, so sinks and top are included.</p>

<h2>18. Windsor 59.5" Double Sink Vanity, Navy Blue</h2>
<p><a href="/products/windsor-59.5d-nvblu-bg"><img src="https://images.bathroomvanitiesoutlet.com/Windsor-59D-NVBLU-BG/bathroom-vanity-windsor-59d-navy-blue-pr1016-1.webp" alt="Windsor 59.5-inch double sink vanity in navy blue with brushed gold hardware" width="800" height="800" loading="lazy"></a></p>
<p>Navy behaves like a neutral in a bathroom. It takes brass and chrome equally well and hides marks the way white cannot. The brushed gold on this one is the warmer of the two options and is what makes it read as considered rather than merely blue.</p>

<h2>19. Linear 59" Double Vanity, Glossy White</h2>
<p><a href="/products/210-v59d-gw"><img src="https://images.bathroomvanitiesoutlet.com/210-V59D-GW/bathroom-cabinet-linear-60-glossy-white-210-v59d-gw-1.webp" alt="Linear 59-inch double vanity in glossy white with a minimal horizontal profile" width="800" height="800" loading="lazy"></a></p>
<p>The most minimal piece here. Linear is all horizontal lines and no ornament, which makes it the natural partner for a large-format tile and a frameless mirror.</p>

<h2>Single or double at 60 inches?</h2>

<p>This is the decision people most often regret, and the honest answer is that two sinks are worth less than they sound and more than they cost you in counter.</p>

<p>Two basins at 60 inches leaves roughly 14 to 16 inches of clear counter at each end and almost nothing between them. That is enough for a soap dish and a toothbrush cup. It is not enough to lay out a hair dryer, a makeup bag, and a shaving kit at the same time. A single sink at the same width gives you a continuous run of around 40 inches, which is genuinely usable.</p>

<p>Pick two sinks if two people are at the vanity at the same time on a weekday morning. That is the only scenario where it wins. If you are staggered by even fifteen minutes, or if the second sink is really about resale, a single at 60 inches will serve you better every day you live there. Resale value tracks the quality of the room far more than the number of basins in it.</p>

<h2>Common questions about 60-inch vanities</h2>

<h3>Will a 60-inch vanity fit a 60-inch opening?</h3>
<p>Usually, but not always, and you should not assume it. Several vanities at this size are built at 59 or 59.5 inches precisely so they clear a 60-inch alcove. A true 60-inch unit in a 60-inch opening leaves zero tolerance for walls that are not plumb, and bathroom walls rarely are. Measure at the floor, at counter height, and at the back. If those three numbers differ, use the smallest.</p>

<h3>What countertop overhang should I expect?</h3>
<p>A top is typically an inch or so wider and deeper than the cabinet beneath it, so a 60-inch cabinet usually carries a 61-inch top. If your opening is exactly 60 inches, that overhang is the thing that will stop the piece going in. This is the single most common measuring mistake at this size.</p>

<h3>Do I need two drains for a double vanity?</h3>
<p>Yes, and that is the real cost of going double. Two basins need two drains and two sets of supply lines. If your bathroom was plumbed for one sink, budget for a plumber, the vanity price is not the project price.</p>

<h3>Can I buy the cabinet now and the top later?</h3>
<p>Yes. Any listing above with "Cabinet" in the name ships without a top, which is how most people pair a cabinet with a specific stone. Just confirm the top you choose matches the cabinet\'s depth as well as its width.</p>

<h2>Still deciding?</h2>
<p>If you are early in the process, <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> runs the decisions in the order that avoids the expensive mistakes, starting with the three measurements people skip. For the full detail on sizes, materials, countertops and installation, see <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>
<p>Related: <a href="/inspiration/double-sink-bathroom-vanity-ideas">double sink vanity ideas</a> and <a href="/inspiration/master-bathroom-vanity-ideas">primary bathroom vanity ideas</a>.</p>'
 WHERE slug = '60-inch-bathroom-vanity-ideas' AND page_type = 'inspiration';


-- ─── bathroom-vanity-buying-guide ───
-- prose reference, no gallery, 2175 words. Source: docs/briefs/article_buyingguide_DRAFT.html
UPDATE pages
   SET content = '<p>This is the reference guide: every decision a bathroom vanity involves, what the options actually are, and what each one costs you in money or in daily use. It is written to be scanned and returned to rather than read once.</p>

<p>If you would rather be walked through the decisions in the order they need to be made, read <a href="/inspiration/how-to-choose-a-bathroom-vanity">how to choose a bathroom vanity</a> instead. That one is a process. This one is the spec sheet behind it.</p>

<h2>Cabinet or vanity: the distinction that changes the price</h2>

<p>The single most common source of confusion, and it is a naming convention rather than a trick.</p>

<p>A listing described as a <strong>Vanity</strong> arrives complete: cabinet, countertop and sink. The price you see is the price of the finished thing.</p>

<p>A listing described as a <strong>Vanity Cabinet</strong> arrives as the cabinet only. No top, no basin. You choose and buy those separately, which is why the number looks lower.</p>

<p>Neither is better. Buying the cabinet alone is how most people pair a cabinet they like with a specific stone, and at widths above 60 inches the top is a large enough line item that controlling it matters. But comparing a cabinet price against a complete vanity price is comparing two different purchases, and it is the mistake that makes a budget fall apart late.</p>

<h2>Sizes, and what each one is actually for</h2>

<p>Widths run from 20 inches to 84. What changes is not just capacity but the kind of bathroom the piece suits.</p>

<p><strong>20 to 24 inches.</strong> Powder rooms where a full vanity will not fit. You get a working sink and room to set down one object. Compared with a pedestal sink, which is the usual alternative, you gain real storage. Plan on a single-hole faucet; a widespread one consumes the counter you were counting on. See <a href="/inspiration/small-bathroom-vanity-ideas">small bathroom vanity ideas</a>.</p>

<p><strong>30 to 36 inches.</strong> The standard hall or guest bathroom. Thirty-six is meaningfully better than thirty if the wall and the door swing allow it, because the extra six inches is almost entirely usable counter.</p>

<p><strong>48 inches.</strong> The most under-ordered useful size. One sink with generous counter on both sides, in a footprint most bathrooms can take. If you are torn between a cramped double and a small single, this is usually the answer.</p>

<p><strong>60 inches.</strong> The most-requested size and the one with the most decisions attached. It takes two sinks, but tightly. See <a href="/inspiration/60-inch-bathroom-vanity-ideas">60-inch bathroom vanity ideas</a>.</p>

<p><strong>72 inches and up.</strong> Primary bathrooms. This is where a double sink stops being a compromise and where the countertop becomes a major cost rather than a line item. See <a href="/inspiration/master-bathroom-vanity-ideas">master bathroom vanity ideas</a>.</p>

<h3>Depth, which nobody checks</h3>

<p>Standard depth is 21 to 22 inches. In a bathroom under 40 square feet that depth is what makes the room feel like a corridor. Shallower cabinets exist at 18 inches, and losing counter depth you were never going to use buys back walking space you notice every day. Also remember the countertop usually overhangs the cabinet by an inch, in both width and depth.</p>

<h2>One sink or two</h2>

<p>Two basins need roughly 30 inches each to feel like separate stations.</p>

<p>At 60 inches you get two sinks with 14 to 16 inches of clear counter at each end and almost nothing between them. Enough for a soap dish. Not enough to lay out a hair dryer and a makeup bag at once. A single sink at the same width gives you a continuous run of around 40 inches.</p>

<p>At 72 inches the layout relaxes and both basins get real margins. Above that you usually gain a bank of drawers or a cabinet in the middle.</p>

<p>The honest rule: take two sinks if two people are genuinely at the vanity at the same time on a weekday morning. That is the only scenario where it wins, and there it wins decisively. If you are staggered by fifteen minutes, or the second basin is really about resale, a single will serve you better every day. Resale tracks the quality of the room far more than the number of basins in it. See <a href="/inspiration/double-sink-bathroom-vanity-ideas">double sink bathroom vanity ideas</a>.</p>

<p>The cost that applies either way: two basins need two drains and two sets of supply lines. If the bathroom was plumbed for one sink, that is a plumber\'s job and belongs in the budget before the cabinet does.</p>

<h2>Mounting: floor-standing, floating or console</h2>

<p><strong>Floor-standing</strong> sits on a base or on legs. It holds the most, forgives an uneven floor, and is the cheapest to install. A base holds more; legs show floor underneath and make a small room read larger.</p>

<p><strong>Floating</strong> hangs off the wall with nothing underneath. Also sold as wall-hung or wall-mounted, which are the same thing. It makes a small bathroom look larger than anything else you can do, and it costs you storage, install simplicity and some flexibility. The weight lands in your wall, so it needs blocking or studs, and the plumbing has to enter behind the cabinet body or it will be visible.</p>

<p>Worth knowing: many cabinets install either way, so this is often a decision made with your installer rather than at the point of purchase. See <a href="/inspiration/floating-bathroom-vanity-ideas">floating bathroom vanity ideas</a>, which lists which of ours are wall-mount only and which give you the choice.</p>

<p><strong>Console</strong> is an open metal frame with a stone top and nothing enclosed. Maximum visible floor, zero hidden storage. Suits a powder room; rarely suits a main bathroom.</p>

<h2>Cabinet materials</h2>

<p><strong>Solid wood</strong> handles humidity cycling better than anything else over decades and costs the most. In a bathroom with a working extractor fan, the difference in lifespan over good plywood is smaller than the price gap suggests.</p>

<p><strong>Plywood</strong> is the practical choice for most bathrooms: dimensionally stable, resistant to the swelling that destroys cheaper panels, and considerably cheaper than solid wood.</p>

<p><strong>MDF</strong> takes paint better than anything else, which is why most high-gloss and painted finishes are built on it. Its weakness is water at the edges. A well-sealed MDF cabinet is fine; one with a chipped edge under a dripping basin is not.</p>

<p>Most quality vanities, including most of ours, combine these: solid wood frames with plywood panels, or MDF doors on a plywood carcass. That is sound construction rather than a compromise.</p>

<h2>Countertops</h2>

<p>At narrow widths the top is a line item. At 72 inches it can be a significant share of the total, which is the main argument for buying a cabinet without one.</p>

<p><strong>Quartz</strong> is engineered, non-porous and needs no sealing. It is the lowest-maintenance stone and the one to choose if you do not want to think about it again.</p>

<p><strong>Marble</strong> is porous and will etch where something acidic sits on it. People buy it anyway because nothing else looks like it. If you want marble in a bathroom used by children, know that in advance.</p>

<p><strong>Granite</strong> sits between the two: harder than marble, more varied than quartz, and it wants periodic sealing.</p>

<p><strong>Composite and solid surface</strong> are the budget options and are genuinely fine. They scratch more easily than stone and can usually be buffed back out, which stone cannot.</p>

<p>Two practical notes. Thickness changes the look more than people expect: a 2cm top reads lighter and more modern than a 3cm one on the same cabinet. And heavy veining fights a flat slab door, so if you want dramatic stone, pair it with a plainer cabinet.</p>

<h2>Sinks</h2>

<p><strong>Undermount</strong> sits below the counter, so you can sweep water straight into it. The most practical choice and the most common.</p>

<p><strong>Integrated</strong> is formed from the same piece as the counter. No seam at all, which means nothing to collect grime. The cleanest option and the hardest to replace if damaged.</p>

<p><strong>Vessel</strong> sits on top of the counter. A strong design statement that costs you usable counter height and leaves a rim to clean around. It also needs a taller faucet, which must be bought to match.</p>

<p><strong>Drop-in</strong> has a visible rim resting on the counter. Cheapest to fit and easiest to replace; the rim is a dirt trap.</p>

<h2>Hardware and faucets</h2>

<p>Hardware is the cheapest thing in the bathroom to change and the fastest way to date it. Matte black and brushed brass currently read as current; polished chrome reads as neutral and always has; oil-rubbed bronze reads traditional.</p>

<p>Mixing metals is fine if deliberate and consistent: pick one finish for the cabinet pulls and faucet, and allow a second for lighting. Three finishes in one bathroom reads as accident.</p>

<p>On faucets, the practical point is holes. A widespread faucet needs three holes spread 8 inches apart; a centerset needs 4-inch spacing; a single-hole needs one. The vanity top determines what fits, so buy them together or confirm the drilling before you order. On a vanity under 30 inches, a single-hole faucet preserves counter that a widespread one takes away.</p>

<h2>Storage: drawers beat doors</h2>

<p>Two cabinets of identical width hold very different amounts depending on how they open.</p>

<p>Behind a door, the back third is effectively lost. You cannot see or reach it without emptying the front, so it fills with things you forget you own. A drawer presents its whole contents at once.</p>

<p>Soft-close slides and hinges are worth having and are standard on most quality vanities now. A drawer organizer matters more than it sounds in a bathroom, where the contents are small and numerous.</p>

<p>One free upgrade: the wall above the vanity is usually holding a flat mirror. A mirrored cabinet instead adds the storage a narrow vanity cannot, at no cost in floor space.</p>

<h2>Plumbing, delivery and installation</h2>

<p>The parts of the project that are not the vanity, and where budgets break.</p>

<p><strong>Rough-in position.</strong> If your existing drain is centered and you are fitting a double vanity, both drains move. If you are fitting a floating vanity, the rough-in may need to move up. Either is a plumber\'s visit.</p>

<p><strong>Delivery.</strong> Anything 60 inches or wider is a freight shipment, not a parcel, and it arrives assembled. Measure the narrowest doorway, the stairwell and any turn on the route before you order. A cabinet that fits the bathroom perfectly is still a problem if it cannot reach the bathroom.</p>

<p><strong>Walls are not plumb.</strong> Measure your opening at the floor, at counter height and at the back wall. If the three numbers differ, use the smallest. This is why several vanities are built at 59 or 59.5 inches rather than a true 60.</p>

<p><strong>Blocking, for floating only.</strong> The cabinet plus a stone top plus a basin full of water all land in the wall. That load needs studs or added backing. Confirm before ordering, not after.</p>

<h2>Budget: where the money actually goes</h2>

<p>A useful way to think about the total rather than the sticker.</p>

<p>The cabinet is usually the largest single number but rarely more than half the project. The countertop scales sharply with width. The faucet is a surprisingly wide range and the easiest place to overspend without benefit. Plumbing labor is the line most often forgotten and the one most likely to surprise.</p>

<p>If the budget is tight, the highest-value trades are: a cabinet-only purchase paired with a composite top rather than stone, a single sink instead of a double at the same width, and keeping the existing plumbing position. The lowest-value saving is cheap hardware, because it is what you touch every day and what dates the room fastest.</p>

<h2>Common questions</h2>

<h3>What is a standard bathroom vanity height?</h3>
<p>Thirty-two inches is the traditional height; 36 inches, matching kitchen counters, has become common and is often called comfort height. Taller is more comfortable for most adults and less so for children. If you are fitting a floating vanity you can set any height you like, which is one of its real advantages.</p>

<h3>How much space should be left around a vanity?</h3>
<p>Aim for at least 30 inches of clear floor in front, and check the door swing against the nearest corner of the counter. A vanity that fits the wall perfectly is still wrong if the bathroom door hits it.</p>

<h3>Can I replace just the countertop?</h3>
<p>Usually yes, provided the new top matches the cabinet\'s depth as well as its width, and the faucet hole drilling matches your faucet. It is one of the better value upgrades in a bathroom if the cabinet is sound.</p>

<h3>How long does a bathroom vanity last?</h3>
<p>A well-built vanity in a ventilated bathroom lasts decades. What ends their life is water damage at the base and around the sink cutout, not wear. A working extractor fan does more for the lifespan of your vanity than the choice between plywood and solid wood.</p>

<h3>Should I buy the vanity or the countertop first?</h3>
<p>Together, or the cabinet first. The top has to match the cabinet\'s dimensions and the faucet has to match the top\'s drilling, so the order of decisions runs cabinet, then top, then faucet. Buying a faucet you love first is the most common way to end up constrained later.</p>'
 WHERE slug = 'bathroom-vanity-buying-guide' AND page_type = 'inspiration';


-- ─── how-to-choose-a-bathroom-vanity ───
-- prose reference, no gallery, 1568 words. Source: docs/briefs/article_howtochoose_DRAFT.html
UPDATE pages
   SET content = '<p>Most bad vanity purchases are not bad taste. They are good decisions made in the wrong order.</p>

<p>People start with the finish, because that is the enjoyable part, and work backward to the measurements. By the time the tape measure comes out they are attached to something that does not fit, and they either return it or live with a bathroom door that hits the counter. This guide runs the decisions in the order that avoids that.</p>

<p>Seven steps. The first three are constraints you do not get to choose, and settling them first means everything after is a free choice. If you want the full reference on any option rather than the sequence, read <a href="/inspiration/bathroom-vanity-buying-guide">the bathroom vanity buying guide</a>.</p>

<h2>Step 1: Measure three widths, not one</h2>

<p>Measure your opening at the floor, at counter height, and at the back wall. Write down all three.</p>

<p>If they differ, bathroom walls are not plumb, which is normal in almost every house. <strong>Use the smallest number.</strong> This is why several vanities are built at 59 or 59.5 inches rather than a true 60: a full-size cabinet in a same-size opening leaves zero tolerance for a wall that leans.</p>

<p>Then add the overhang. The countertop is typically an inch wider and deeper than the cabinet under it, so a 60-inch cabinet usually carries a 61-inch top. If your opening is exactly 60 inches, the overhang is the thing that stops the piece going in. This is the most common measuring mistake there is.</p>

<h2>Step 2: Check the door swing and the walking space</h2>

<p>Open your bathroom door and look at where it lands relative to the wall the vanity will sit against.</p>

<p>A vanity can fit the wall perfectly and still be wrong because the door hits the corner of the counter. Nothing in any product listing will warn you, and it is discovered at installation.</p>

<p>Then check depth. Standard is 21 to 22 inches, and you want at least 30 inches of clear floor in front of the vanity. In a bathroom under 40 square feet, standard depth is often what makes the room feel like a corridor, and an 18-inch cabinet buys back walking space you notice every day at the cost of counter you were never going to use.</p>

<h2>Step 3: Find out where the plumbing is</h2>

<p>Look under your existing vanity and note where the drain and supply lines come through the wall, and at what height.</p>

<p>This decides two things. If the rough-in is centered and you want a double vanity, both drains have to move. If you want a floating vanity, the plumbing may need to move up so it enters behind the cabinet rather than below it, where it would be visible.</p>

<p>Either is a plumber\'s visit. Knowing now means it is a budget line rather than a surprise, and in some cases it will sensibly change your mind about the configuration.</p>

<h2>Step 4: Decide single or double, honestly</h2>

<p>Now the constraints are known, this is the first real choice, and it is the one most often regretted.</p>

<p>Two basins need about 30 inches each to feel like separate stations. At 60 inches you get two sinks with 14 to 16 inches of counter at each end and almost nothing between. At 72 inches the layout relaxes properly.</p>

<p>Ask one question: <strong>are two people at this vanity at the same time on a weekday morning?</strong> If yes, take the double; it wins decisively. If you are staggered by even fifteen minutes, a single sink at the same width gives you a continuous run of counter instead of two narrow margins, and you will prefer it every day you live there.</p>

<p>If the honest answer is "for resale," take the single. Resale tracks the quality of the room far more than the number of basins in it, and the money is better spent on the countertop.</p>

<h2>Step 5: Decide how it stands up</h2>

<p>Floor-standing, floating or console. This is a decision about the room, not about taste.</p>

<p><strong>Choose floor-standing</strong> if storage matters, if the bathroom has no linen closet, or if you want the simplest and cheapest installation. A full base holds the most. Visible legs hold less but show floor underneath, which makes a small room read larger.</p>

<p><strong>Choose floating</strong> if the bathroom is small and the visible floor is worth more to you than the storage. It is the single most effective thing you can do to make a tight bathroom feel bigger. It requires blocking in the wall and the plumbing height from step 3, so confirm both before ordering. Many cabinets install either way, so this may be a conversation with your installer rather than a product decision. See <a href="/inspiration/floating-bathroom-vanity-ideas">floating bathroom vanity ideas</a>.</p>

<p><strong>Choose a console</strong> only for a powder room. An open frame shows the whole floor and holds nothing.</p>

<h2>Step 6: Now choose the style and finish</h2>

<p>This is the part everyone wants to start with, and it is sixth for a reason: by now you know the width, the configuration and the mounting, so you are choosing from things that will actually work.</p>

<p>Two rules worth more than any style guide.</p>

<p><strong>Match temperature, not color.</strong> The mistake people notice but cannot name is a warm cabinet against cool tile, or the reverse. A honey oak vanity against cool gray tile reads as a mismatch. A cool ash gray cabinet against warm cream tile does the same. Decide whether your bathroom is warm or cool, then stay on that side.</p>

<p><strong>Order a sample above 48 inches.</strong> Screens misrepresent wood tone badly, and the larger the cabinet the less forgiving the error. Below 48 inches you can usually recover from a near miss. At 72 inches you cannot.</p>

<p>For the style itself: <a href="/inspiration/farmhouse-bathroom-vanity-ideas">farmhouse</a> means it looks like furniture, with flat or shallow doors and dark hardware. <a href="/inspiration/modern-bathroom-vanity-ideas">Modern</a> means a single-plane door and no applied decoration. <a href="/inspiration/white-bathroom-vanity-ideas">White</a> is the default for a reason and comes in three different behaviors.</p>

<h2>Step 7: Countertop, sink and faucet, in that order</h2>

<p>These three are a chain, and doing them out of order is how people end up with a faucet that will not fit.</p>

<p>First check whether your chosen piece is a <strong>Vanity</strong> or a <strong>Vanity Cabinet</strong>. A Vanity includes its top and sink. A Vanity Cabinet does not, which is why it looks cheaper. If it is a cabinet, the top is your next purchase and at larger widths it is a significant one.</p>

<p>Then the <strong>countertop</strong>, which must match the cabinet\'s depth as well as its width. Quartz if you never want to think about it; marble if you accept that it etches; composite if the budget is tight, which is a perfectly good answer.</p>

<p>Then the <strong>sink</strong>, if the top does not include one. Undermount is the most practical. Vessel is a statement that costs counter height and needs a taller faucet.</p>

<p>Then the <strong>faucet</strong>, last, because the countertop\'s drilling determines what fits. A widespread faucet needs three holes at 8-inch spacing; a centerset needs 4-inch; a single-hole needs one. On any vanity under 30 inches, a single-hole faucet preserves counter space a widespread one takes away.</p>

<p>Buying a faucet you love before the top is the most common way to end up constrained.</p>

<h2>A shortcut, if you want one</h2>

<p>If you only do three things from this list, do these.</p>

<p><strong>Measure the opening at three heights and use the smallest.</strong> It takes two minutes and prevents the most expensive mistake available.</p>

<p><strong>Open the bathroom door and watch where it lands.</strong> Thirty seconds, and it catches the failure no listing will warn you about.</p>

<p><strong>Look under the existing vanity before you decide single or double.</strong> One glance tells you whether your configuration choice is free or carries a plumber\'s bill.</p>

<h2>Common questions</h2>

<h3>What should I decide first when buying a bathroom vanity?</h3>
<p>The measurements, every time. Width at three heights, door swing, and plumbing position. These are constraints rather than choices, and settling them first means every later decision is made from options that will actually fit.</p>

<h3>How do I know what size vanity I need?</h3>
<p>Measure the opening at the floor, at counter height and at the back wall, and use the smallest figure. Then subtract an inch for the countertop overhang. That number is your maximum cabinet width, not a target to hit exactly.</p>

<h3>Is it better to buy a vanity with the top included?</h3>
<p>Below 48 inches, usually yes, because it is simpler and the top is a modest part of the cost. Above 60 inches, buying the cabinet alone is often better, because the countertop is a large enough number that choosing it yourself gives you real control over the budget.</p>

<h3>How do I avoid the vanity looking wrong against my tile?</h3>
<p>Match temperature. Warm cabinet with warm tile, cool with cool. This single rule prevents the mismatch people sense but cannot identify. Above 48 inches, order a sample rather than judging from a screen.</p>

<h3>Can I install a bathroom vanity myself?</h3>
<p>A floor-standing vanity with the plumbing already in the right place is within reach of a competent DIYer. Anything that moves plumbing, and any floating installation, is not: a wall-hung cabinet carries its own weight plus a stone top plus a basin of water, and it has to land on blocking or studs. That one is worth paying for.</p>'
 WHERE slug = 'how-to-choose-a-bathroom-vanity' AND page_type = 'inspiration';


-- ─── 2. VERIFY ─────────────────────────────────────────────────────────────
-- img_count was ZERO on every row before this ran. The two buying guides are
-- prose and correctly stay at zero images; the other eight should match the
-- item counts noted above each UPDATE.
SELECT
  slug,
  ROUND(CHAR_LENGTH(content) / 6)                                                   AS rough_words,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<img', '')))      / 4 AS img_count,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<h2',  '')))      / 3 AS h2_count,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<h3',  '')))      / 3 AS h3_count,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(content, '/products/', '')))       / 10 AS product_links,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(content, '/inspiration/', '')))    / 13 AS guide_links
FROM pages
WHERE page_type = 'inspiration'
ORDER BY sort_order, id;


-- ─── 3. REVERT, IF NEEDED ──────────────────────────────────────────────────
-- Commented out deliberately. Uncomment and run ONLY to undo this migration.
--
-- UPDATE pages p
--   JOIN pages_content_backup_20261005 b ON b.id = p.id
--    SET p.content = b.content;
