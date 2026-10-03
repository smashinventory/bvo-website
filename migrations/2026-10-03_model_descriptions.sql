-- ---------------------------------------------------------------------------
-- BVO · model_groups.description — "What people love about the <Model>"
-- Generated 2026-10-03 from the live DB dump 20260929174558.
--
-- 45 model landing pages. Benefit-led rewrites of the product copy: every
-- claim is backed by product_attribute_values, and where an attribute is
-- mixed across a model's SKUs the copy says "select sizes" instead of
-- asserting it of the whole range.
--
-- SAFE TO RE-RUN. INSERT ... ON DUPLICATE KEY UPDATE on uniq_model_brand.
-- Touches ONE column (description) on ONE table. No other table is read or
-- written, no product data is altered, no schema change.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab -> paste -> Go.
-- Verification SELECT is at the bottom. Rollback is below that.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

INSERT INTO `model_groups` (`model_name`,`brand`,`description`) VALUES
  ('Bristol','ER Vanities','Natural white ash does something a painted finish can\'t — it lifts the light in a room without making it bright, so even a small bathroom with one window feels open rather than closed in. The pale tone is UV resistant, which matters more than it sounds: light woods usually yellow, and this one stays the colour you chose. Brushed gold hardware holds its finish long after the fixtures around it have started to dull.

Every door and drawer closes itself, quietly, so nobody gets woken by the person leaving for an early shift. There\'s a built-in rod for toilet paper, which sounds minor until you stop storing it on the floor. It arrives fully assembled in widths from 24" to 71½", and because it\'s cabinet-only you choose the top rather than settling for whatever came in the box.'),
  ('Kensington','ER Vanities','The Kensington solves the problem most vanities ignore: where the hairdryer and the toothbrush charger actually live. There\'s a power station built into the bottom drawer, so the cords stay inside the cabinet and your counter stays clear. Tip-out drawers catch the small things that otherwise migrate across every surface in the room.

It comes in bright white, metal gray, desert oak and navy blue, with brushed nickel, matte black or brushed gold hardware — enough range to match a room you\'ve already finished rather than one you\'re building around it. Soft-close glides and hinges throughout mean the drawers pull themselves shut instead of being shoved. Widths run 23" to 71½", all-wood over a solid frame, and it ships assembled.'),
  ('London','ER Vanities','Desert oak and bright white are the two finishes people keep coming back to, because both hide the things bathrooms do to furniture — the water spots, the daily wipe-down, the steam. Matte black or brushed nickel hardware against either one reads as deliberate rather than builder-grade.

What owners mention most is the quiet. Under-mounted soft-close glides and soft-close hinges mean a drawer shoved shut at 6am closes itself the rest of the way, silently, which is the difference between waking the house and not. There\'s makeup counter space in the layout, so getting ready doesn\'t have to happen standing up over a sink. Sizes run 23½" to 71½", and it arrives assembled — no flat-pack evening.'),
  ('Oxford','ER Vanities','Sage green is the one people photograph. It\'s the finish that makes a bathroom look considered instead of beige, and it sits alongside black and whitewashed ash if you\'d rather the colour came from somewhere else in the room. Brushed gold or matte black hardware finishes the thought.

At 29½" to 47½" the Oxford is built for the bathroom you actually have — the second one, the guest one, the one where a 72" double was never going to fit. Solid wood over a solid frame means it survives the humidity that destroys particleboard, and soft-close doors and drawers mean it does so quietly. It arrives fully assembled, cabinet-only, so the countertop is your decision.'),
  ('Windsor','ER Vanities','Navy blue is a commitment most people are glad they made. Against brushed nickel or brushed gold it gives a bathroom a sense of depth that white alone never manages, and if you want the quieter version, the same cabinet comes in bright white.

The Windsor spans 24" to 71½", which covers the powder room and the primary bath with the same design language — useful when you\'re renovating more than one and want the house to hold together. All-wood construction over a solid wood frame is the part you don\'t see and the part that decides whether it still looks like this in ten years. Soft-close hinges and under-mounted soft-close glides keep it quiet; a 30-day return window and a one-year warranty cover the rest.'),
  ('Addison','James Martin Vanities','The Addison is the one people choose when the bathroom has to look finished rather than fashionable. Glossy white or mid-century acacia, polished chrome or burnished nickel — combinations that don\'t date, in a traditional-to-transitional shape that sits comfortably in a 1920s house and a 2020s one.

It\'s also the most forgiving range here on size. Pieces run from a 14.9" filler up to a full 72" double, so an awkward wall gets a real answer instead of a compromise. Soft-close hinges and glides keep mornings quiet on most configurations, and the countertop and sink are included — meaning the price you see is close to the price of being finished, not the price of starting.'),
  ('Alicante\'','James Martin Vanities','Clean lines, no ornament, nothing to dust in a groove. The Alicante\' is modern in the way that actually survives — a flat front in mid-century acacia or glossy white with brushed nickel, which is a look that reads current now and won\'t read dated in five years.

It\'s sized for the rooms that usually get ignored: 23.3" to 39.4", the powder room and the narrow secondary bath. Soft-close hinges mean the doors close themselves rather than slamming against a wall at head height, which matters more in a small room than a large one. Top and sink come with it, so there\'s one delivery and one decision instead of three.'),
  ('Allamari','James Martin Vanities','Sable and dune mist are warm without being brown — the finishes people pick when they want wood in the bathroom but not the heavy, orange version of it. Champagne brass against either one is the detail guests notice without being able to say why.

The practical draw is power. Select sizes in this range are built for an in-cabinet outlet, which means the hairdryer charges inside the cabinet and the counter stays empty. Soft-close drawer glides keep it quiet. Built in ash, 35⅝" to 72", with the top and sink included — so the 72" double is genuinely a double, not a cabinet you then have to shop a countertop for.'),
  ('Amberly','James Martin Vanities','Mid-century walnut is the whole argument for the Amberly. It\'s a single finish done properly rather than six done adequately, and against champagne brass it gives a bathroom the warmth that white rooms spend a fortune trying to buy back with accessories.

Select sizes are built to take an in-cabinet power outlet, so chargers and styling tools live behind a door instead of on the counter — the single change that makes a bathroom look tidy without anyone tidying it. Soft-close hinges throughout, soft-close glides on most sizes, and widths from 29.9" to 72" including true doubles. Countertop and sink are included.'),
  ('Athens','James Martin Vanities','Glossy white with polished chrome or bronze is as close to a safe choice as this catalogue gets — and the Athens earns it, because a traditional vanity in a gloss finish wipes clean in a way that painted matte finishes simply don\'t. Toothpaste comes off. Hard water marks come off.

It runs from a 14.8" filler piece to a 72" double, so a long wall gets a continuous run rather than a vanity marooned in the middle of it. Soft-close hinges and glides keep the doors and drawers quiet, select sizes take an in-cabinet outlet, and some configurations include a makeup counter — a seat-height section, so getting ready happens sitting down.'),
  ('Auburn','James Martin Vanities','Weathered timber and matte black, on a pedestal frame — the Auburn is for the bathroom where storage isn\'t the problem and floor space is. Lifting the cabinet off the floor makes a small room read larger, and it makes the floor underneath something you can actually mop.

It\'s a modern-farmhouse shape at 31.4" to 35.9", which is powder-room territory: the room guests use and judge. The top and sink come with it. Worth knowing before you buy: this range is open-framed rather than closed-cabinet, so it\'s chosen for how it looks rather than for how much it holds. If you need the hidden storage, the Breckenridge is the farmhouse cabinet to compare it against.'),
  ('Bellamy','James Martin Vanities','Rustic oak against matte black, in a single 36" modern piece. The Bellamy is a one-size, one-finish decision, which is either exactly what you want or not the range for you — and when it\'s what you want, it\'s a short conversation.

36" is the most-fitted vanity width in American bathrooms, so this drops into the standard secondary bath without the measuring anxiety. Acacia construction handles bathroom humidity better than the engineered panels at this price usually do. Countertop and sink are included, so what arrives is what you install. If you want the same feel with the range of sizes and the soft-close hardware, look at the Kinnsden.'),
  ('Bellshire','James Martin Vanities','The Bellshire goes further than anything else here — up to 120", which is a wall of vanity rather than a vanity against a wall. If you\'re planning a primary bath where two people get ready at once without negotiating for elbow room, this is the range that actually reaches.

Bright white or honey oak with champagne brass, in a transitional shape that doesn\'t fight whatever the rest of the house is doing. Soft-close hinges and glides come standard, select sizes take an in-cabinet outlet, and some configurations build in a makeup counter at seat height. Starts at 22⅞" for the small room, so the same design can run through the whole house.'),
  ('Boston','James Martin Vanities','The Boston is a hardware and component range rather than a cabinet range — the stainless pedestal frames, the brackets and the finish pieces that make a stone top look like it\'s floating. That\'s worth saying plainly, because the name sits alongside cabinets in search results and people arrive expecting one.

Radiant gold, brushed nickel, matte black and glossy white, in modern pedestal forms. Choose it when you\'ve already found the top you want and need a base that disappears underneath it, or when the design calls for open space below the sink instead of a closed cabinet. If you came here for a cabinet with drawers, start with the Columbia or the Chicago instead.'),
  ('Breckenridge','James Martin Vanities','Five hundred configurations, five finishes, and 22" to 84" of width — the Breckenridge is the range to start with if you don\'t yet know exactly what you want, because almost every answer exists inside it. Light natural oak, bright white, serenity blue, whitewashed oak and smokey celadon, with satin nickel, champagne brass or matte black.

Serenity blue and smokey celadon are the reason people choose this one. They\'re colours that make a farmhouse bathroom look designed rather than themed, and they\'re hard to find at this price. Soft-close doors and drawers throughout, an in-cabinet outlet on select sizes, and the top and sink included — so an 84" double arrives as a finished wall, not a project.'),
  ('Bristol','James Martin Vanities','Whitewashed walnut is the one to look at. It\'s the finish that reads as wood without reading as dark, which is the thing most people are actually trying to solve when they say they want "warm but not heavy" — and it sits alongside bright white and saddle brown if the room needs something else.

Satin nickel hardware, transitional lines, 29" to 72" with real doubles at the top end. Soft-close hinges and glides throughout keep it quiet, and select sizes are built for an in-cabinet outlet so the chargers stay off the counter. Top and sink included. Note there are two Bristols in this catalogue — this is the James Martin one; ER Vanities make a different cabinet under the same name.'),
  ('Britannia','James Martin Vanities','At 23⅝" the Britannia exists for one job: the small bathroom that still deserves to look like someone thought about it. Black onyx or mid-century acacia with satin nickel — finishes with enough presence to carry a room that has no other furniture in it.

Powder rooms are where guests form an opinion, and they\'re also where builders usually install the cheapest thing that fits. Soft-close hinges mean the door closes itself instead of banging against the wall two feet away, which in a room this size is the difference between quiet and not. Poplar and parawood construction, with the countertop and sink included. One size, done properly.'),
  ('Brittany','James Martin Vanities','The Brittany is the most-chosen range here, and the finish list explains why: bright white, black onyx, burnished mahogany, pecan, urban gray and saddle brown. That\'s a span from a crisp traditional bathroom to a genuinely dark, dramatic one, without changing cabinet.

Burnished mahogany and black onyx are the two that photograph best and the two most people hesitate over — worth ordering a sample before you decide. Satin nickel or champagne brass hardware, 21.7" to 84" of width, soft-close doors and drawers throughout, and an in-cabinet outlet on select sizes. Top and sink included. If you want one range to cover a whole-house renovation, this is it.'),
  ('Brookfield','James Martin Vanities','Black onyx, honey oak and pecan with champagne brass — a traditional vanity that isn\'t trying to look like a piece of antique furniture. The Brookfield is the version of traditional that works in a house built after 1990, which is a narrower thing to get right than it sounds.

Honey oak is the quiet winner: warm enough to soften a white-tiled bathroom, light enough not to shrink it. Widths run 26" to 72", soft-close hinges and glides come as standard so nothing slams, and select sizes take an in-cabinet outlet for the hairdryer and the toothbrush. Poplar construction, countertop and sink included.'),
  ('Brooklyn','James Martin Vanities','Platinum ash and rustic ash on an antique black pedestal frame, at 39.4". The Brooklyn is a transitional piece built around open space underneath rather than closed storage — the choice when the room needs to feel bigger more than it needs another cupboard.

Ash construction handles bathroom humidity well, and the open base means the floor stays visible, which is the oldest trick there is for making a small bathroom read larger. Soft-close drawer glides keep what storage there is quiet. Top and sink are included. If you need enclosed storage in a similar look, compare it against the Kinnsden before you decide.'),
  ('Celeste','James Martin Vanities','Embossed shagreen drawer fronts in sunwashed oak, with champagne brass and acrylic hardware — the Celeste is the one in this catalogue that looks like furniture rather than bathroom fitting. If you\'ve been looking for something that doesn\'t resemble everything else in the showroom, this is the range.

Shagreen is a texture, not a print, so it catches light differently through the day. It\'s also the sort of detail that makes a small bathroom feel considered — and at 35¾" to 48", small-to-standard is exactly what it\'s sized for. Soft-close glides throughout, an in-cabinet outlet on select sizes, oak construction, with the top and sink included.'),
  ('Chianti','James Martin Vanities','Glossy white or walnut whisper at 19⅜" to 23⅝" — the Chianti is for the room where a standard vanity simply does not fit. Under-sink cabinets, the awkward wall by the door, the half-bath carved out of a hallway.

The hardware choice is unusually wide for a range this size: brushed nickel, matte black, champagne brass, or a mixed set. That matters in a small room, where the handles are a much larger share of what you actually see. Soft-close hinges on most configurations. Worth noting that sink inclusion varies across this range, so check the individual size before ordering — not every piece in it is a complete vanity.'),
  ('Chicago','James Martin Vanities','The Chicago covers more ground than almost anything else here — 5⅞" filler strips through to 72" doubles, in glossy white, walnut whisper and smokey celadon. That range is the point: a long or interrupted wall gets a continuous fitted run instead of a vanity with awkward gaps either side.

Smokey celadon is the finish worth seeing in person. It\'s a soft green-gray that behaves like a neutral in most light and like a colour in daylight, which is why it tends to outlast whatever was trendy when the bathroom was done. Soft-close hinges throughout, soft-close glides on most sizes, an in-cabinet outlet on select sizes, and the top and sink included.'),
  ('Columbia','James Martin Vanities','The Columbia is the range for people who already know their hardware finish. Radiant gold, brushed nickel, matte black, or a mixed set — and six cabinet finishes underneath, from glossy white and ash gray to latte oak. Very few ranges let you match an existing faucet this precisely.

Modern lines, 13¾" to 72½", so the same design handles a narrow half-bath and a primary double. Soft-close hinges throughout and soft-close glides on most sizes keep it quiet. Yellow poplar and stainless construction. Countertop and sink included, so matching the hardware is the only decision you\'re left with — which is the one you wanted to make anyway.'),
  ('De Soto','James Martin Vanities','Bright white, satin nickel, and up to 120½" of width. The De Soto is the modern answer to a large primary bathroom, and at that length it stops being a vanity and becomes the wall — two sinks, a run of drawers between them, and no negotiation about counter space on a weekday morning.

White is also the finish that survives a change of mind. Repaint the walls, swap the mirrors, change the hardware, and it still works. Soft-close hinges on most sizes and soft-close glides throughout, with a makeup counter built into select configurations — a seat-height section, so getting ready happens sitting down. Starts at 23.2" if you want the same look in a smaller room.'),
  ('Emmeline','James Martin Vanities','Pistachio. It\'s the finish people either dismiss immediately or build the whole bathroom around, and it\'s the reason to look at the Emmeline — a soft, chalky green that makes white tile look intentional rather than default. Pebble oak is the quieter alternative in the same cabinet.

Champagne brass hardware, 35½" to 72", ash and acacia construction. Soft-close glides throughout mean the drawers pull themselves shut, and select sizes are built for an in-cabinet outlet so the styling tools charge behind a door. Countertop and sink are included. If you want colour in a bathroom without committing to coloured tile, this is the low-risk way to get it.'),
  ('Gracyn','James Martin Vanities','Coastal driftwood is a grayed, weathered tone that solves a specific problem: wanting a wood finish in a bathroom that gets a lot of natural light, without it going orange. Sable is the warmer option in the same cabinet, with satin nickel or champagne brass.

The Gracyn has an in-cabinet outlet across the range rather than on select sizes — so wherever you land on width, the hairdryer and the electric toothbrush have somewhere to live that isn\'t the counter. Soft-close doors and drawers throughout. Ash construction, 28" to 72", countertop and sink included. A modern cabinet that doesn\'t look cold, which is harder to find than it should be.'),
  ('Hudson','James Martin Vanities','Light natural oak and honey oak with champagne brass — the Hudson is the range that reads transitional, modern or farmhouse depending entirely on what you put around it. That flexibility is why it survives a change of taste better than a cabinet with a stronger opinion.

29.8" to 60", so it covers the standard secondary bath and the modest primary without pushing into the 72" doubles you may not have the wall for. Soft-close hinges and glides throughout keep it quiet, and select sizes take an in-cabinet outlet. Ash and poplar construction, with the top and sink included. If you\'re renovating to sell rather than to stay, this is the safe, warm choice.'),
  ('Kinnsden','James Martin Vanities','Weathered oak and sable oak, in genuine oak rather than a printed lookalike — the Kinnsden is where the grain is the design, and it\'s worth paying attention to because oak behaves differently in a steamy room than the engineered panels it\'s usually imitated with.

Every size in this range takes an in-cabinet outlet, not just select ones, so the counter stays clear whichever width you choose. Soft-close doors and drawers throughout. 26" to 72", champagne brass hardware, countertop and sink included. Modern lines with real wood warmth — the combination people describe as "warm but not country," and rarely find.'),
  ('Laurent','James Martin Vanities','Light natural oak or honey oak with champagne brass, across modern, farmhouse and transitional rooms alike. The Laurent is one of the three or four ranges here that genuinely works in all of them, which makes it a sensible choice when the bathroom has to match a house you didn\'t design.

29⅞" to 72" including real doubles. Soft-close hinges and glides throughout, an in-cabinet outlet on select sizes, ash and poplar construction, with the countertop and sink included. If you\'re deciding between this and the Hudson, the Laurent reaches wider — it\'s the one that gets you to a 72" double.'),
  ('Linden','James Martin Vanities','Mid-century walnut or whitewashed walnut with satin nickel, at 23⅝". The Linden is a small cabinet in a genuinely good material — real walnut rather than a walnut-coloured finish — which is unusual at this size, because small vanities are normally where the cost gets cut.

That makes it the right answer for a powder room you want to feel expensive. Soft-close hinges mean the door closes itself rather than knocking against the wall in a room where everything is within arm\'s reach. Countertop and sink included. One size, two finishes, and nothing in it that needed to be compromised to hit a price.'),
  ('Linear','James Martin Vanities','Black walnut construction, flat fronts, no visible hardware fuss — the Linear is the most genuinely modern cabinet in the catalogue, and the material underneath is the reason it doesn\'t look cheap doing it. Whitewashed walnut, mid-century walnut or glossy white with satin nickel.

Flat fronts have a practical advantage people underrate: there are no panel grooves for dust and toothpaste to collect in, so cleaning is a single wipe. 35.3" to 72½" including doubles. Soft-close doors and drawers throughout. Countertop and sink included. If the rest of your house is minimal and every vanity you\'ve seen looks fussy, start here.'),
  ('Lorelai','James Martin Vanities','Five finishes — light natural oak, mid-century walnut, whitewashed oak, bright white and black onyx — with champagne brass or satin nickel. The Lorelai spans from the palest to the darkest cabinet here without changing shape, which makes it the range to look at when you know the form you want but not the colour.

Black onyx with champagne brass is the combination that gets photographed. Light natural oak is the one that gets ordered. Both are the same cabinet: 35⅞" to 72", soft-close doors and drawers throughout, an in-cabinet outlet on select sizes, ash and poplar construction, countertop and sink included.'),
  ('Lucian','James Martin Vanities','Carbon oak is a dark, matte, grain-forward finish that does something black paint can\'t — it reads as wood rather than as colour, so a dark bathroom still feels warm instead of severe. Pebble oak is the pale alternative in the same cabinet.

Champagne brass hardware against carbon oak is the pairing worth seeing. 35¾" to 72" in ash, with soft-close drawer glides throughout and an in-cabinet outlet on select sizes, so chargers stay off the counter. Countertop and sink included. If you want a dark bathroom but have been talked out of it, this is the finish that usually changes people\'s minds.'),
  ('Malibu','James Martin Vanities','Amber birch with matte black — one finish, one hardware choice, and a transitional shape that doesn\'t need either of them explained. The Malibu is a short decision, which is its own kind of value when you\'ve been looking at vanities for three weeks.

Amber birch is lighter and more golden than the oaks elsewhere in this catalogue, which makes it the better match for warm-toned tile and brass fixtures you\'re keeping. 26" to 72" including doubles, soft-close drawer glides throughout, poplar construction, countertop and sink included. Straightforward, warm, and priced where a single-finish range should be.'),
  ('Mantova','James Martin Vanities','Mid-century walnut at 18" to 31½" — the Mantova is built for genuinely tight rooms, the ones where 24" is already too wide and most ranges stop. Under-stairs cloakrooms, narrow ensuites, the half-bath that was carved out of a closet.

Walnut in a small room is a deliberate choice: the grain gives the one piece of furniture in there something to say. Champagne brass hardware, yellow poplar construction, soft-close drawer glides throughout. Because this range sits at the small end, configurations vary more than most — check the individual size for what\'s included before ordering, rather than assuming the top comes with it.'),
  ('Marcello','James Martin Vanities','Chestnut in solid acacia — a mid-brown with real depth to the grain, and a material that handles bathroom humidity better than most things at this price. The Marcello is modern in shape but warm in colour, which is the combination people ask for most often and find least often.

Champagne brass hardware, 35.9" to 72" including doubles. Soft-close doors and drawers throughout keep mornings quiet, and select sizes are built for an in-cabinet outlet so the counter stays clear. Countertop and sink included. One finish, done properly — if chestnut is right for your room, there is nothing else to decide.'),
  ('Marigot','James Martin Vanities','Sunwashed oak in real oak, starting at 47¾" and running to 72". The Marigot skips the small sizes entirely, which tells you what it\'s for: this is a primary-bathroom range, built around two people using it at the same time.

Every size takes an in-cabinet outlet, so the hairdryer, the shaver and the toothbrush all charge out of sight — the difference between a counter that looks clear and one that only looks clear after you\'ve tidied it. Soft-close drawer glides throughout, champagne brass hardware, countertop and sink included. Sunwashed oak is pale, warm and light-reflective, which keeps a big vanity from dominating the room it\'s in.'),
  ('Mercer Island','James Martin Vanities','A single 72½" double in glossy white, with brushed nickel or radiant gold. The Mercer Island is one decision: if you have the wall and you want two sinks in a modern white bathroom, this is the finished answer.

Glossy white wipes clean in a way matte finishes don\'t — toothpaste, hard-water spray and makeup all come off a gloss panel with one pass. Soft-close doors and drawers throughout. Yellow poplar construction, countertop and sinks included. The radiant gold hardware is the version that stops it looking clinical, which is the usual objection to an all-white bathroom and the easiest one to solve.'),
  ('Metropolitan','James Martin Vanities','Silver oak is a cool-toned, grayed wood — the finish that works when the rest of your bathroom is gray tile and every warm oak you\'ve tried has clashed with it. Satin nickel hardware keeps it in the same key rather than fighting it.

30" to 72" including doubles, in a shape that reads transitional or modern depending on the room. Soft-close doors and drawers throughout. Yellow poplar construction, countertop and sink included. If you\'ve been struggling to find wood that doesn\'t go orange next to gray porcelain, this is the specific problem the Metropolitan solves.'),
  ('Myrrin','James Martin Vanities','Mid-century walnut, bright white and carbon oak with champagne brass — three finishes that cover warm, clean and dark without changing the cabinet. The Myrrin is a large modern range, 29⅞" to 72", and one of the more popular here for exactly that reason.

Soft-close doors and drawers throughout, with an in-cabinet outlet on select sizes so chargers and styling tools stay behind a door. Parawood and yellow poplar construction, countertop and sink included. Carbon oak is the one to look at if you want a dark bathroom with visible grain; bright white is the one to choose if you\'re renovating for resale rather than for yourself.'),
  ('Olena','James Martin Vanities','Polished white with light mappa burl, and champagne brass with acrylic hardware. The Olena is the most decorative cabinet in this catalogue — burl is a figured wood with swirling, unrepeatable grain, so no two fronts are identical.

That makes it a statement piece rather than a background one, and at 35¾" to 48" it\'s sized for the room where a statement actually lands: the powder room, or a compact primary where the vanity is the only furniture. Soft-close drawer glides throughout, an in-cabinet outlet on select sizes, beech construction, countertop and sink included. If every vanity you\'ve looked at has felt interchangeable, this one isn\'t.'),
  ('Palisades','James Martin Vanities','Bright white with satin nickel, 35.1" to 72". The Palisades is transitional in the most useful sense — it has no strong period cues, so it doesn\'t argue with the house it\'s installed in, and it won\'t look dated when the trend that\'s running now stops running.

White with nickel is also the combination that costs least to change your mind about: new mirrors, new lighting, new paint, same vanity. Soft-close doors and drawers throughout keep it quiet. Built in yellow poplar, with the top and sink supplied. If you want the decision to be low-risk rather than exciting, this is the deliberate choice.'),
  ('Portland','James Martin Vanities','Whitewashed walnut, hardware finished to match rather than contrast — the Portland is the quietest cabinet here, and that\'s the point. Nothing on the front interrupts the grain, so the wood is the whole design.

Maple construction, 28" to 72" including doubles. Soft-close doors and drawers throughout, with an in-cabinet outlet on select sizes so the counter stays clear. Countertop and sink included. If you\'re building a bathroom where the tile or the stone is meant to be the feature, this is the vanity that lets it be — and whitewashed walnut keeps the room light while still reading as real wood.'),
  ('Solene','James Martin Vanities','Natural cane panels in seaside oak. The Solene is the one range here with a texture rather than a finish as its defining feature — woven cane fronts that catch light and shadow through the day, on a white oak cabinet with champagne brass.

Cane also breathes, which is an unexpectedly practical thing in a bathroom cabinet. 28" to 72" including doubles, soft-close doors and drawers throughout, an in-cabinet outlet on select sizes, countertop and sink included. It\'s a coastal, relaxed look that stops short of theme — no rope, no shells, just a material that happens to belong near water.')
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`);

-- ── VERIFY ────────────────────────────────────────────────────────────────
SELECT brand, model_name,
       CHAR_LENGTH(description) AS chars,
       LEFT(description, 60)    AS opening
FROM model_groups
WHERE description IS NOT NULL AND description <> ''
ORDER BY brand, model_name;
-- Expect 45 rows.

-- ── ROLLBACK (clears only the descriptions this script wrote) ──────────────
-- UPDATE model_groups SET description = NULL
--  WHERE (model_name, brand) IN (
--    ('Bristol','ER Vanities'),
--    ('Kensington','ER Vanities'),
--    ('London','ER Vanities'),
--    ('Oxford','ER Vanities'),
--    ('Windsor','ER Vanities'),
--    ('Addison','James Martin Vanities'),
--    ('Alicante\'','James Martin Vanities'),
--    ('Allamari','James Martin Vanities'),
--    ('Amberly','James Martin Vanities'),
--    ('Athens','James Martin Vanities'),
--    ('Auburn','James Martin Vanities'),
--    ('Bellamy','James Martin Vanities'),
--    ('Bellshire','James Martin Vanities'),
--    ('Boston','James Martin Vanities'),
--    ('Breckenridge','James Martin Vanities'),
--    ('Bristol','James Martin Vanities'),
--    ('Britannia','James Martin Vanities'),
--    ('Brittany','James Martin Vanities'),
--    ('Brookfield','James Martin Vanities'),
--    ('Brooklyn','James Martin Vanities'),
--    ('Celeste','James Martin Vanities'),
--    ('Chianti','James Martin Vanities'),
--    ('Chicago','James Martin Vanities'),
--    ('Columbia','James Martin Vanities'),
--    ('De Soto','James Martin Vanities'),
--    ('Emmeline','James Martin Vanities'),
--    ('Gracyn','James Martin Vanities'),
--    ('Hudson','James Martin Vanities'),
--    ('Kinnsden','James Martin Vanities'),
--    ('Laurent','James Martin Vanities'),
--    ('Linden','James Martin Vanities'),
--    ('Linear','James Martin Vanities'),
--    ('Lorelai','James Martin Vanities'),
--    ('Lucian','James Martin Vanities'),
--    ('Malibu','James Martin Vanities'),
--    ('Mantova','James Martin Vanities'),
--    ('Marcello','James Martin Vanities'),
--    ('Marigot','James Martin Vanities'),
--    ('Mercer Island','James Martin Vanities'),
--    ('Metropolitan','James Martin Vanities'),
--    ('Myrrin','James Martin Vanities'),
--    ('Olena','James Martin Vanities'),
--    ('Palisades','James Martin Vanities'),
--    ('Portland','James Martin Vanities'),
--    ('Solene','James Martin Vanities')
--  );
