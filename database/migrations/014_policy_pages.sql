-- ═══════════════════════════════════════════════════════════════════════
-- 014_policy_pages.sql — Terms, Privacy, Shipping, Returns & Refunds
--
-- Effective 8 September 2026.
--
-- Decisions of record: docs/POLICY_ANSWERS.md
-- Vendor limits these must stay inside: docs/VENDOR_POLICY_CONSTRAINTS.md
-- Human tasks these depend on: docs/PRE_LAUNCH_CHECKLIST.md
--
-- ── WHY UPDATE AND NOT INSERT ─────────────────────────────────────────
-- Migration 012 already seeded four placeholder policy pages, with these
-- slugs:
--     shipping-policy   returns-policy   privacy-policy   terms-and-conditions
--
-- The first draft of this file used INSERT IGNORE with invented slugs
-- (returns-refunds, terms, privacy). Run as written it would have:
--   * SKIPPED shipping-policy silently, leaving the placeholder in place
--     while appearing to succeed, and
--   * created THREE DUPLICATE pages under the wrong slugs.
--
-- Seven policy pages, four of them wrong, no error raised. These are
-- UPDATEs against the real slugs instead. A slug that does not match
-- updates zero rows, and the verification query at the bottom will show
-- it rather than hiding it.
--
-- Safe to re-run: each statement is a full overwrite of that page. It WILL
-- overwrite edits made in the admin page editor, so once these are live,
-- edit them in the admin and not here.
--
-- ── TITLES ARE STORED UNESCAPED ───────────────────────────────────────
-- `title` and `meta_title` hold a plain ampersand, not &amp;. The footer
-- renders them with EJS <%= %>, which escapes on output. Storing &amp;
-- here would double-escape and print a literal "&amp;" on the live site.
-- Migration 012 stored them plain for this reason. Page CONTENT is raw
-- HTML and does use &amp; correctly.
--
-- ⚠ BEFORE THESE GO LIVE:
--   1. support@ and legal@bathroomvanitiesoutlet.com must exist. Both are
--      named throughout. A bounced privacy request or arbitration opt-out
--      is worse than no page.
--   2. Checkout must carry the agreement line (F2 in POLICY_ANSWERS).
--      Footer links alone leave the arbitration clause, the liability cap
--      and the return terms decorative rather than binding.
--
-- NOT LEGAL ADVICE. Industry-standard drafts built from the vendor
-- documents and comparable retailers. The arbitration clause, the
-- liability cap and the warranty disclaimer want a Georgia attorney.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Shipping Policy → /pages/shipping-policy ──
UPDATE pages SET
  title      = 'Shipping Policy',
  content    = '<p class="policy-effective"><em>Effective September 8, 2026</em></p>

<h2>Free Shipping</h2>
<p>We offer free shipping on every order, with no minimum purchase, to addresses in the <strong>continental United States</strong>.</p>
<p>We do not currently ship to Alaska, Hawaii, Puerto Rico, US territories, or international addresses. We also cannot ship to PO boxes, freight forwarders, or storage facilities.</p>

<h2>How Your Vanity Ships</h2>
<p>Vanities and other large items ship by LTL freight carrier. Your delivery includes <strong>curbside delivery with liftgate service</strong> at a residential address, at no additional charge.</p>
<p>Curbside means the carrier brings your shipment to the curb or the end of your driveway and lowers it from the truck using a liftgate. Moving the item into your home is your responsibility. A vanity can weigh 200 to 400 pounds, so please plan for help.</p>
<p>If you would prefer white glove delivery into your home, call us at <strong>(877) 777-1948</strong> before ordering and we will quote it for you. White glove is not available as a checkout option.</p>

<h2>Delivery Appointments</h2>
<p>The freight carrier will contact you to schedule a delivery window. <strong>Someone must be present to inspect and sign for the shipment.</strong> This is important — see Inspecting Your Delivery below.</p>
<p>If a scheduled delivery is missed, carriers charge redelivery fees, and shipments left at a terminal accrue storage charges. Those charges are your responsibility.</p>

<h2>⚠ Inspecting Your Delivery — Please Read</h2>
<p>This is the most important part of this page. <strong>Inspect your shipment before you sign for it.</strong></p>
<ul>
<li>If the packaging is obviously damaged, <strong>refuse the shipment</strong>. Contact us the same day and we will arrange a replacement or refund.</li>
<li>If you accept the shipment but see any damage, <strong>write the damage on the delivery receipt before you sign it</strong>, and photograph it.</li>
<li>Writing <em>"subject to inspection"</em> on the delivery receipt is <strong>not sufficient</strong> and will not preserve a claim.</li>
<li>If you can, photograph the pallet while it is still on the truck. This helps protect you.</li>
<li>If any boxes are missing, note the number of missing boxes on the delivery receipt.</li>
</ul>
<p><strong>Once a clean delivery receipt is signed, the freight carrier and the manufacturer will deny any damage claim.</strong> We cannot recover a claim after that, and neither can you. Ninety seconds of inspection protects your whole order.</p>
<p>Please keep all packaging until you are certain you are keeping the item.</p>

<h2>Processing and Delivery Times</h2>
<p>Orders take <strong>2 to 5 business days</strong> to process and ship. Most orders arrive within <strong>5 to 12 business days</strong> of the date you order, depending on your distance from the manufacturer warehouse.</p>
<p>Once your order is with the freight carrier, delivery timing is in the carrier hands. We will provide tracking and will help chase anything that stalls, but carrier delays are outside our control.</p>

<h2>Payment Timing</h2>
<p>We place an authorization hold on your card when you order, and charge it when your order is confirmed. Card authorizations typically expire after about seven days, so if your order takes longer we will re-confirm payment before capture and before shipping is scheduled. If we cancel your order before payment is captured, no charge is ever made and the hold is released by your bank.</p>

<h2>Backordered Items</h2>
<p>If an item is unavailable after you order, we will contact you with the expected date and you can choose to wait, switch to a different finish or size, or cancel for a full release of your authorization.</p>

<h2>Address Changes and Errors</h2>
<p>Address changes are only possible before your order ships. Once a bill of lading is issued, changing the destination is a paid carrier transaction. If a shipment must be rerouted or redelivered because of an incorrect or incomplete address, the carrier reconsignment fee is your responsibility.</p>

<h2>Job Site Deliveries</h2>
<p>We can deliver to a job site. If you have someone else accept delivery on your behalf, you remain responsible for the inspection requirements above — including whoever signs the delivery receipt.</p>

<h2>Order Acceptance</h2>
<p>We reserve the right to decline or cancel any order for any lawful reason, including but not limited to prohibitive freight cost, suspected fraud, purchases for resale, or unusual quantities. If we decline your order, no charge is made.</p>

<h2>Questions</h2>
<p>Email <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a> or call <strong>(877) 777-1948</strong>.</p>',
  meta_title = 'Shipping Policy | BathroomVanitiesOutlet.com',
  meta_desc  = 'Free curbside freight shipping with liftgate on every order in the continental US. Processing, delivery times, and how to inspect your delivery.',
  is_visible = 1
WHERE slug = 'shipping-policy';

-- ── Returns & Refunds → /pages/returns-policy ──
UPDATE pages SET
  title      = 'Returns & Refunds',
  content    = '<p class="policy-effective"><em>Effective September 8, 2026</em></p>

<h2>Return Window</h2>
<p>Returns must be requested within <strong>30 days of your order date</strong>. If your delivery is delayed beyond our published timeframe, you will have at least <strong>10 days from the date you receive your order</strong> to request a return.</p>

<h2>Start With an RA</h2>
<p><strong>No return is accepted without a Return Authorization.</strong> Email <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a> with your order number and the reason for return.</p>
<p>We will issue an RA number and the return address. Return destinations vary by item, so please do not ship anything back until we give you one. <strong>Items shipped without an RA, or sent to our office address, will be refused.</strong></p>
<p>Once you have an RA, the item must be collected by the carrier within <strong>14 days</strong> or the authorization expires.</p>

<h2>Restocking Fees</h2>
<p>Return shipping is paid by you, and a restocking fee applies based on the condition of the item when we receive it.</p>
<table class="policy-table">
<tr><th>Condition</th><th>Restocking fee</th></tr>
<tr><td>Unopened, or opened but still fully packaged in the original box</td><td><strong>25%</strong></td></tr>
<tr><td>Removed from the box and not repacked in original factory condition</td><td><strong>40%</strong></td></tr>
<tr><td>Installed or modified</td><td><strong>Not returnable</strong></td></tr>
</table>
<p><strong>Please keep the crate and all original packaging until you are certain you are keeping your vanity.</strong> Items returned without original packaging fall into the 40% category, and installed items cannot be returned at all.</p>

<h2>Items That Cannot Be Returned</h2>
<ul>
<li>Special order and non-stock items — these are non-cancelable and non-returnable, and are marked as such on the product page</li>
<li>Clearance and final sale items</li>
<li>Faucets and plumbing fixtures once opened</li>
<li>Custom-cut or modified countertops</li>
<li>Installed or modified items</li>
</ul>

<h2>Damaged or Missing Items</h2>
<p>Please read the inspection instructions in our <a href="/pages/shipping-policy">Shipping Policy</a> before your delivery arrives. <strong>If the delivery receipt is not marked as damaged at the time of delivery, the manufacturer and the carrier will deny the claim.</strong></p>
<p>Report problems to <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a> within these windows:</p>
<ul>
<li><strong>Visible damage — within 48 hours of delivery.</strong> Include photos of the damage and the packaging, and the delivery receipt showing the damage noted.</li>
<li><strong>Missing boxes — within 48 hours of delivery</strong>, with the shortage noted on the delivery receipt.</li>
<li><strong>Concealed damage — within 21 days of delivery.</strong> Include photos of the item and its packaging. Note that if the outer packaging was visibly damaged at delivery and was not noted on the receipt, a concealed damage claim cannot be filed.</li>
</ul>
<p>Depending on the damage, resolution may be a replacement part, a touch-up or repair kit, professional in-home repair, a replacement item, or a refund. We will work with you and the manufacturer to reach the right outcome.</p>
<p>There is no restocking fee on damaged or defective items.</p>

<h2>Refused Deliveries</h2>
<p>If you refuse a delivery because of visible damage, contact us the same day and we will arrange a replacement or refund at no cost to you.</p>
<p>If you refuse a delivery for any other reason, it is treated as a standard return — the 25% restocking fee and return freight apply. <strong>Please tell us the same day.</strong> An unreported refusal sits at a freight terminal accruing storage charges, and those charges are your responsibility.</p>

<h2>Cancellations</h2>
<p>You may cancel at no charge any time before your order ships. Because we only place an authorization hold until shipment, a cancellation means no charge is ever made.</p>
<p>Orders ship within 2 to 5 business days, so please contact us as soon as possible. Once your order has shipped it cannot be cancelled — you can refuse delivery or request a return, and the terms above apply.</p>
<p><strong>Special order items cannot be cancelled once the order is placed.</strong></p>

<h2>Refunds</h2>
<p>Refunds are issued within <strong>5 to 7 business days</strong> of our receiving and inspecting your return, to the original payment method. Your bank may take a few additional days to post it.</p>

<h2>Warranty</h2>
<p>Products sold by BathroomVanitiesOutlet.com carry the <strong>manufacturer warranty</strong>. We do not provide a separate warranty of our own, and we will help you file a claim.</p>
<p>James Martin Vanities products carry a one year limited warranty against defects in material and workmanship, for <strong>residential use only</strong>. Coverage is repair or replacement at the manufacturer discretion and <strong>does not cover installation, labor, or removal costs</strong>. The warranty is void if the product is modified, installed improperly, used commercially, or cleaned with abrasive chemicals. <strong>Quartz and stone tops carry a separate manufacturer warranty.</strong></p>
<p>Manufacturer warranty terms can change without notice. Please refer to the manufacturer website for current terms.</p>

<h2>Questions</h2>
<p>Email <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a> or call <strong>(877) 777-1948</strong>.</p>',
  meta_title = 'Returns & Refunds | BathroomVanitiesOutlet.com',
  meta_desc  = 'Return within 30 days of your order date. RA required. Restocking fees, damage reporting deadlines, cancellations, refunds and warranty information.',
  is_visible = 1
WHERE slug = 'returns-policy';

-- ── Terms & Conditions → /pages/terms-and-conditions ──
UPDATE pages SET
  title      = 'Terms & Conditions',
  content    = '<p class="policy-effective"><em>Effective September 8, 2026</em></p>

<p>These Terms and Conditions govern your use of BathroomVanitiesOutlet.com and any purchase you make from us. Please read them carefully. By using this site or placing an order, you agree to these terms.</p>

<h2>Who We Are</h2>
<p>BathroomVanitiesOutlet.com (<strong>BVO</strong>) is operated by <strong>Smash Inventory Solutions, LLC</strong> (<strong>Smash</strong>), a Georgia limited liability company.</p>
<p>5120 Old Ellis Pt, Suite C, Roswell, GA 30076<br>
(877) 777-1948<br>
<a href="mailto:legal@bathroomvanitiesoutlet.com">legal@bathroomvanitiesoutlet.com</a></p>
<p><em>Our Roswell address is an office. Please do not ship returns there — see our <a href="/pages/returns-policy">Returns Policy</a>.</em></p>

<h2>Eligibility</h2>
<p>You must be at least 18 years old and able to enter into a binding contract to purchase from this site.</p>

<h2>Orders and Order Acceptance</h2>
<p>When you place an order you are making an <strong>offer</strong> to buy. Our order confirmation email acknowledges that we received your offer — it is not acceptance. <strong>A contract is formed when we ship your order.</strong></p>
<p>We may decline or cancel any order for any lawful reason, including prohibitive freight cost, suspected fraud, purchases for resale, unusual quantities, or product unavailability. If we decline your order, no charge is made.</p>

<h2>Pricing and Payment</h2>
<p>Prices are in US dollars. Sales tax is calculated at checkout based on your shipping address and applicable law.</p>
<p>We place an authorization hold on your payment method when you order and charge it when your order is confirmed. Authorizations typically expire after about seven days; if your order takes longer we will re-confirm payment before capture.</p>

<h2>Promotions and Discount Codes</h2>
<ul>
<li>One discount code per order. Codes cannot be combined.</li>
<li>Codes cannot be applied to an order after it has been placed.</li>
<li>We do not offer price adjustments if an item goes on sale after your purchase.</li>
<li>Promotions may be changed or ended at any time. Codes have no cash value.</li>
</ul>

<h2>Shipping, Returns and Warranty</h2>
<p>Our <a href="/pages/shipping-policy">Shipping Policy</a> and <a href="/pages/returns-policy">Returns &amp; Refunds Policy</a> form part of these Terms. Please read them — they contain important deadlines for inspecting deliveries and reporting damage, and your claim rights depend on meeting them.</p>

<h2>Product Information and Warranty Disclaimer</h2>
<p>We work to describe products accurately, but we do not warrant that descriptions, images, colors, dimensions or other content are error-free. Finishes and colors vary between screens and production runs.</p>
<p>Products carry the <strong>manufacturer warranty only</strong>. Except as expressly stated, and to the fullest extent permitted by law, products are provided <strong>as is</strong> and we disclaim all other warranties, express or implied, including implied warranties of merchantability and fitness for a particular purpose.</p>

<h2>Trade Accounts</h2>
<p>Trade and contractor accounts are subject to separate terms accepted at application. Approval is at our sole discretion and accounts may be revoked. Trade pricing is confidential and may not be republished. <strong>Commercial installations void the manufacturer warranty</strong>, which covers residential use only.</p>

<h2>Your Content</h2>
<p>If you submit reviews, photographs, or other content, you keep ownership of it. You grant us a non-exclusive, royalty-free, perpetual, worldwide license to use, display, reproduce and adapt it in connection with our business, including marketing.</p>
<p>You confirm the content is yours to share and does not infringe anyone else rights. Do not submit false claims, other people photographs, or abusive, obscene or unlawful material. We may remove any content at our discretion.</p>

<h2>Our Content</h2>
<p>All site content — text, images, logos, and design — is owned by us or our suppliers and protected by intellectual property laws. You may not copy, reproduce, or use it commercially without written permission. Product images and brand names are the property of their respective manufacturers.</p>

<h2>Acceptable Use</h2>
<p>You agree not to use this site unlawfully, attempt to gain unauthorized access to any system, scrape or harvest data, interfere with the site operation, or use it to transmit malicious code.</p>

<h2>Limitation of Liability</h2>
<p>To the fullest extent permitted by law, <strong>our total liability for any claim arising from a product or order is limited to the amount you paid for that product</strong>.</p>
<p>We are not liable for indirect, incidental, special, consequential or punitive damages, including property damage, water damage, loss of use, lost profits, or the cost of installation, removal or replacement labor, even if we were advised such damages were possible.</p>
<p>Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.</p>

<h2>Indemnification</h2>
<p>You agree to indemnify and hold harmless Smash Inventory Solutions, LLC and its officers, employees and agents from any claim arising out of your breach of these Terms, your misuse of the site, or content you submit.</p>

<h2>Dispute Resolution and Arbitration</h2>
<p><strong>Please read this section carefully. It affects how disputes between us are resolved and limits your right to bring a lawsuit or participate in a class action.</strong></p>
<p>Any dispute arising out of or relating to these Terms or your purchase will be resolved by <strong>binding individual arbitration</strong> administered by the American Arbitration Association under its Consumer Arbitration Rules, rather than in court. Judgment on the award may be entered in any court with jurisdiction.</p>
<p><strong>Class action waiver.</strong> Disputes will be arbitrated on an individual basis only. You and we waive any right to bring or participate in a class, collective, or representative action.</p>
<p><strong>Small claims exception.</strong> Either party may bring an individual claim in small claims court instead of arbitration, if it qualifies.</p>
<p><strong>Your right to opt out.</strong> You may opt out of this arbitration agreement by emailing <a href="mailto:legal@bathroomvanitiesoutlet.com">legal@bathroomvanitiesoutlet.com</a> within <strong>30 days of your first purchase</strong>, stating your name, order number and that you are opting out of arbitration. Opting out will not affect any other part of these Terms, and will not affect your account or orders in any way.</p>

<h2>Governing Law</h2>
<p>These Terms are governed by the laws of the State of Georgia, without regard to conflict of law principles. Subject to the arbitration section above, any dispute will be brought in the state or federal courts located in Fulton County, Georgia.</p>

<h2>Changes to These Terms</h2>
<p>We may update these Terms at any time. The effective date at the top shows when they last changed. The Terms in effect on the date of your order govern that order.</p>

<h2>Contact</h2>
<p>Questions about these Terms: <a href="mailto:legal@bathroomvanitiesoutlet.com">legal@bathroomvanitiesoutlet.com</a><br>
Questions about an order: <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a> or (877) 777-1948</p>',
  meta_title = 'Terms & Conditions | BathroomVanitiesOutlet.com',
  meta_desc  = 'Terms and conditions for purchases from BathroomVanitiesOutlet.com, operated by Smash Inventory Solutions, LLC.',
  is_visible = 1
WHERE slug = 'terms-and-conditions';

-- ── Privacy Policy → /pages/privacy-policy ──
UPDATE pages SET
  title      = 'Privacy Policy',
  content    = '<p class="policy-effective"><em>Effective September 8, 2026</em></p>

<p>This policy explains what information BathroomVanitiesOutlet.com collects, why, who we share it with, and the choices you have. BathroomVanitiesOutlet.com is operated by Smash Inventory Solutions, LLC, 5120 Old Ellis Pt, Suite C, Roswell, GA 30076.</p>

<h2>The Short Version</h2>
<ul>
<li><strong>We do not sell your personal information.</strong></li>
<li><strong>We do not share it for cross-context behavioral advertising.</strong></li>
<li>Marketing email is opt-in only, and every message has an unsubscribe link.</li>
<li>We never see or store your full card number.</li>
</ul>

<h2>Information We Collect</h2>
<p><strong>Information you give us:</strong> name, email address, phone number, billing and shipping addresses, order details, account password (stored encrypted), and anything you send us in an email or chat message.</p>
<p><strong>Payment information:</strong> card details are collected and processed by Authorize.Net. <strong>We do not receive or store your full card number.</strong></p>
<p><strong>Information collected automatically:</strong> IP address, browser and device type, pages viewed, referring site, approximate location derived from IP address, and cookie identifiers. We also use session replay, which records your interactions with our pages — see Analytics below.</p>
<p><strong>Trade account applications:</strong> business name, tax identification number, and business documents you upload for verification.</p>

<h2>How We Use It</h2>
<ul>
<li>To process, ship and support your orders</li>
<li>To communicate with you about an order, return or warranty claim</li>
<li>To screen orders for fraud</li>
<li>To send marketing email, where you have opted in</li>
<li>To understand how the site is used and improve it</li>
<li>To meet tax, accounting and legal obligations</li>
</ul>

<h2>Who We Share It With</h2>
<p>We share personal information with service providers who perform functions on our behalf, and only as needed for those functions.</p>
<table class="policy-table">
<tr><th>Who</th><th>What they receive</th><th>Why</th></tr>
<tr><td><strong>James Martin Vanities</strong> and other manufacturers</td><td>Your name, shipping address and phone number</td><td>Products ship directly from the manufacturer warehouse to you</td></tr>
<tr><td><strong>Authorize.Net</strong></td><td>Payment card details, billing name and address</td><td>Payment processing</td></tr>
<tr><td><strong>Worldwide Express / SpeedShip</strong> and freight carriers</td><td>Name, shipping address, phone number</td><td>Freight booking and delivery</td></tr>
<tr><td><strong>Brevo</strong></td><td>Email address, name, order details</td><td>Order emails and, with your consent, marketing email</td></tr>
<tr><td><strong>FraudLabs Pro</strong></td><td>Order details, IP address, email, billing information</td><td>Fraud screening</td></tr>
<tr><td><strong>Google</strong> (Analytics and Tag Manager)</td><td>Browsing behavior, device information, approximate location</td><td>Site analytics</td></tr>
<tr><td><strong>Microsoft Clarity</strong></td><td>Session recordings, click and scroll behavior</td><td>Understanding how visitors use the site</td></tr>
<tr><td><strong>Tidio</strong></td><td>Chat messages and anything you type into chat</td><td>Live chat support</td></tr>
<tr><td><strong>Hostinger</strong></td><td>All site data at rest</td><td>Hosting</td></tr>
</table>
<p>We may also disclose information where required by law, to enforce our Terms, or in connection with a sale or transfer of our business.</p>

<h2>Analytics, Cookies and Session Replay</h2>
<p>We use cookies and similar technologies to keep your cart and session working, remember your preferences, and understand site usage. You can control cookies through our cookie banner and your browser settings. Essential cookies cannot be disabled — the site will not function without them.</p>
<p><strong>Microsoft Clarity</strong> records how visitors interact with our pages, including mouse movement, scrolling and clicks. Clarity is configured to mask text input, so information you type into forms is not captured. Clarity retains recordings on its own schedule, which we do not control.</p>
<p>We use Google Tag Manager to manage these tags. Depending on what is active, this may include Google Analytics, Google Search Console and Merchant Center integrations, and in future, advertising and conversion measurement tags. If we begin using advertising tags that share information for cross-context behavioral advertising, we will update this policy and provide an opt-out before doing so.</p>

<h2>Marketing Email</h2>
<p>We only send marketing email to people who have opted in. Every marketing message includes an unsubscribe link. Unsubscribing is immediate for marketing, but we will still send transactional messages about your orders — confirmations, shipping notices and return updates — because you need them.</p>

<h2>Your Choices and Rights</h2>
<p>We extend the following rights to all our customers, regardless of where you live:</p>
<ul>
<li><strong>Access</strong> — request a copy of the personal information we hold about you</li>
<li><strong>Correction</strong> — ask us to fix inaccurate information</li>
<li><strong>Deletion</strong> — ask us to delete your information, subject to the limits below</li>
<li><strong>Opt out of marketing</strong> — unsubscribe at any time</li>
<li><strong>No discrimination</strong> — exercising these rights will never affect your pricing or service</li>
</ul>
<p>To make a request, email <a href="mailto:legal@bathroomvanitiesoutlet.com">legal@bathroomvanitiesoutlet.com</a>. We respond within 45 days and may need to verify your identity first.</p>
<p><strong>A limit on deletion worth knowing:</strong> we cannot delete records of completed transactions. Tax and accounting law requires us to keep them. If you ask us to delete your information, we remove your account details and marketing data and retain order records as required by law.</p>

<h2>How Long We Keep Things</h2>
<ul>
<li><strong>Order records — 7 years</strong>, for tax, accounting and warranty purposes</li>
<li><strong>Account information</strong> — while your account is open, and for a reasonable period afterward</li>
<li><strong>Marketing contacts</strong> — until you unsubscribe. We keep unsubscribed addresses on a suppression list specifically so we do not email you again</li>
<li><strong>Analytics and session recordings</strong> — on the retention schedules of the providers above</li>
</ul>

<h2>Security</h2>
<p>We use encryption in transit, restrict access to personal information, and never store full payment card numbers. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>

<h2>Children</h2>
<p>This site is not directed to children under 13, and we do not knowingly collect information from them. If you believe a child has provided us information, contact us and we will delete it.</p>

<h2>Changes</h2>
<p>We may update this policy. The effective date above shows when it last changed. If we make a material change to how we handle your information, we will make that clear.</p>

<h2>Contact</h2>
<p>Privacy questions and requests: <a href="mailto:legal@bathroomvanitiesoutlet.com">legal@bathroomvanitiesoutlet.com</a><br>
Smash Inventory Solutions, LLC, 5120 Old Ellis Pt, Suite C, Roswell, GA 30076<br>
(877) 777-1948</p>',
  meta_title = 'Privacy Policy | BathroomVanitiesOutlet.com',
  meta_desc  = 'What information we collect, how we use it, who we share it with, and your privacy rights. We do not sell your personal information.',
  is_visible = 1
WHERE slug = 'privacy-policy';

-- ── Verification — expect exactly 4 rows, all with substantial content ──
SELECT slug, title, is_visible, CHAR_LENGTH(content) AS chars
FROM pages
WHERE slug IN ('shipping-policy','returns-policy','privacy-policy','terms-and-conditions')
ORDER BY sort_order;
