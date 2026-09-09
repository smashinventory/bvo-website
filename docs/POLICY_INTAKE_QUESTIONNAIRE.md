# Policy intake — Terms, Privacy, Shipping, Returns & Refunds

Answer inline. Where I've written **[RECOMMENDED]** you can reply "default"
and I'll use it. Anything you skip, I'll flag rather than invent.

> **I am not a lawyer and this is not legal advice.** These will be solid,
> industry-standard drafts built from what comparable retailers publish.
> The three clauses with real money attached — limitation of liability,
> warranty disclaimer, and the arbitration/class-action waiver in the Terms
> — should be reviewed by a Georgia attorney before you publish. That review
> is cheap relative to what those clauses decide if you're ever sued.

---

## Already known — confirm or correct

| Field | Value |
|---|---|
| Legal entity | Smash Inventory Solutions, LLC ("Smash") |
| DBA | BathroomVanitiesOutlet.com ("BVO") |
| Address | 5120 Old Ellis Pt, Suite C, Roswell, GA 30076 |
| Email | bathroomvanitiesoutlet@gmail.com |
| Phone | (877) 777-1948 |
| Governing law | Georgia (assumed — confirm) |

**A1.** Is the Roswell address a business office, a warehouse, or a mail
drop? It matters — returns policies usually name a returns address, and it
should not be an address you don't control.

**A2.** Do you want a support email distinct from the general one, e.g.
`returns@` or `support@`? A Gmail address on legal pages reads less
established, and it means every legal notice lands in the same inbox as
order questions. **[RECOMMENDED: set up support@bathroomvanitiesoutlet.com
before publishing]**

---

## Third parties your site already shares data with

Read from your codebase, not assumed. All of these must be disclosed in the
Privacy Policy. **Confirm each is actually live, and tell me any I missed:**

| Service | What it receives | Live? |
|---|---|---|
| Authorize.Net | Card data, billing name/address (they process it; you don't store cards) | wired in checkout |
| Google Analytics / Tag Manager | Browsing behaviour, device, approximate location | ? |
| Brevo | Email address, name, order details for transactional + marketing email | wired |
| FraudLabs Pro | Order details, IP address, email, billing info for fraud screening | wired |
| Tidio | Live chat transcripts, whatever a visitor types | conditional on a key |
| Hostinger | Hosting — all site data at rest | yes |
| Cloudinary | Product images only (no customer data) | ? |
| WWEX / SpeedShip | Shipping name, address, phone for freight booking | wired |
| James Martin (vendor) | Customer shipping name, address, phone for drop-ship | via vendor PO |

**B1.** Is Google Analytics actually running in production? (A GA4 ID is
supported but I can't see whether one is set.)

**B2.** Is Tidio live chat currently enabled?

**B3.** Any others not in the code — Meta/Facebook Pixel, Google Ads
remarketing, Klaviyo, a review platform, TikTok? These are the ones that
most often get missed and they're exactly what privacy regulators look for.

**B4.** That last row matters more than it looks: on a drop-ship order you
hand the customer's name, address and phone to James Martin. That is a
disclosure of personal information to a third party and has to be stated.
Confirm that's how it works.

---

## 1. Shipping Policy

*What comparable retailers cover: processing time, transit time, delivery
method by item size, what "curbside" means, inspection at delivery,
refusal, address changes, PO boxes, Alaska/Hawaii/international.*

**S1. Free shipping.** Your header says "Free Shipping on Every Order — No
Minimum Required." Is that unconditional? Specifically:
- Continental US only, or does it include AK/HI/PR?
- Does it apply to accessories and small parts as well as vanities?

**S2. Delivery method.** Vanities ship LTL freight. What does the customer
actually get?
- **Curbside only** (driver drops at the end of the driveway; customer moves it) **[RECOMMENDED — it's what most vanity retailers offer and it's what LTL base rates cover]**
- Threshold (inside the first doorway)
- White glove / room of choice (costs materially more)

**S3. Is a delivery appointment scheduled?** LTL carriers normally call to
schedule. Does the customer need to be present and sign?

**S4. Processing time** before an order ships — 1–2 business days? And do
you ship on weekends?

**S5. Transit time** range you're willing to state, e.g. "5–10 business
days to most US addresses." Be conservative; this becomes a promise.

**S6. Backorders.** If James Martin is out of stock after you've taken the
order, what happens — you notify and hold, or notify and offer to cancel?
How long before it's automatically cancelled?

**S7. Address changes / wrong address.** If the customer gives a bad
address and the freight gets re-routed, who pays the carrier's reconsignment
fee? **[RECOMMENDED: customer pays, stated plainly]**

**S8. PO boxes and freight limitations** — I assume no PO boxes for LTL.
Any residential vs commercial distinction you want to make?

---

## 2. Returns & Refunds

*This is the one where retailers differ most, and where the money is.
Comparable vanity retailers range from no restocking fee to 25%.*

**R1. Return window** — how many days from delivery may a customer request
a return? **[RECOMMENDED: 30 days]**

**R2. Restocking fee.** Comparables: TheBathOutlet 0%, Willow Bath 15%,
The Bath Vanities and Bath Vanities Plus 25%. What's yours?
**[RECOMMENDED: 20%, given you drop-ship and can't restock into your own
inventory]**

**R3. Return shipping — the expensive question.** Outbound freight on a
vanity is commonly $150–400 and you advertise it as free. On a
change-of-mind return:
- Does the customer pay return freight?
- **Do you also deduct the outbound freight you originally absorbed?** Many
  "free shipping" retailers do, and it must be disclosed or it looks like a
  bait and switch. **[RECOMMENDED: customer pays return freight AND the
  actual outbound freight is deducted, stated explicitly with an example
  dollar figure]**

**R4. Condition required** — unopened and in original packaging? Or opened
but uninstalled and undamaged? What about a vanity that's been installed?
**[RECOMMENDED: unused, uninstalled, original packaging; installed items
are not returnable]**

**R5. Non-returnable items.** Typically: custom/special order, clearance,
final sale, opened faucets, cut countertops. Which apply to you?

**R6. Damaged in transit — the freight inspection rule.** This is the single
most important clause you'll write, because once a customer signs a clean
delivery receipt, the freight claim is usually dead.
- How long to report visible damage? **[RECOMMENDED: note it on the
  delivery receipt before signing, and report within 48 hours]**
- How long for concealed damage discovered after unboxing?
  **[RECOMMENDED: 5 business days]**
- Do you require photos? **[RECOMMENDED: yes, of the packaging AND the
  product AND the damage]**

**R7. Damaged / defective resolution** — replacement, repair part, or
refund? Who chooses, you or the customer?

**R8. Refused deliveries.** If a customer simply refuses the shipment
without a damage reason, do they eat both freight legs plus restocking?
**[RECOMMENDED: yes, and say so — refusal is otherwise used as a free
return]**

**R9. Order cancellation.** Free to cancel until when — before it ships,
before the vendor PO goes out, or before the carrier picks up? Your system
sends a vendor PO to James Martin, so the practical cutoff is probably PO
confirmation.

**R10. Refund timing** — how many business days after you receive and
inspect the return? **[RECOMMENDED: 5–7 business days to the original
payment method]**

**R11. Warranty.** Is it purely the manufacturer's (James Martin, ER
Vanities), or do you offer anything of your own? **[RECOMMENDED:
manufacturer's warranty only, with a link, and BVO helps facilitate claims]**

---

## 3. Terms & Conditions

*Standard sections: eligibility, account terms, pricing and errors, order
acceptance, payment, intellectual property, acceptable use, disclaimers,
limitation of liability, indemnification, dispute resolution, governing
law, changes to terms.*

**T1. Pricing errors.** If a vanity lists at $149 instead of $1,490, do you
reserve the right to cancel? **[RECOMMENDED: yes — this clause exists
precisely for feed-import mistakes, and you import from a vendor feed]**

**T2. Order acceptance.** Confirm that placing an order is an *offer*, and
your confirmation email is not acceptance — acceptance happens on shipment.
**[RECOMMENDED: yes; it's what lets you cancel a mispriced or fraudulent
order cleanly]**

**T3. Arbitration and class-action waiver.** Do you want one? It keeps
disputes out of court and blocks class actions, but it's the clause most
likely to be challenged and it must be conspicuous. **[RECOMMENDED: yes,
with a small-claims carve-out and a 30-day opt-out — but this is the
clause I'd most want your attorney to see]**

**T4. Limitation of liability cap.** Standard is "the amount you paid for
the product." Agreed?

**T5. Age requirement** — 18+ to purchase? **[RECOMMENDED: yes]**

**T6. Sales tax.** Which states do you collect in? Georgia only, or do you
have economic nexus elsewhere? I won't guess at this.

**T7. Promotions and coupons** — any rules to state (one per order, no
stacking, no price adjustments after purchase)?

**T8. Reviews / user content.** Do you plan to accept customer reviews or
photos? If so the Terms need a licence grant for that content.

**T9. Trade / contractor accounts** — any different terms for those?

---

## 4. Privacy Policy

*Binding law for you is primarily California's CCPA/CPRA, which applies
based on thresholds rather than where you're located. Georgia has no
comprehensive consumer privacy statute in force. Several new state laws
take effect during 2026, so this page should be dated and revisited.*

**P1. Do you meet any CCPA threshold?** It applies if you have over $25M
annual revenue, OR buy/sell/share the personal information of 100,000+
California consumers, OR derive 50%+ of revenue from selling personal
information. **[If none apply, you're likely not a "business" under CCPA —
but I'd still recommend writing the policy to CCPA standard, because it
costs nothing extra, it's what customers expect, and it means you don't
rewrite it when you grow.]**

**P2. Do you sell or share personal information?** Under CCPA, running
Google/Meta advertising cookies can legally count as "sharing" even with no
money involved. If you run remarketing ads, you likely need a "Do Not Sell
or Share My Personal Information" link. Do you run remarketing?

**P3. Email marketing consent.** Your signup has an `accepts_marketing`
flag. Is it opt-in (unchecked by default) or pre-checked?
**[RECOMMENDED: unchecked — pre-checked boxes are a problem in several
jurisdictions and hurt deliverability]**

**P4. Do you want a cookie banner?** You currently have none. Not strictly
required for a US-only business under current law, but it's expected and it
supports a CCPA opt-out. **[RECOMMENDED: yes, a simple one]**

**P5. Do you sell to, or market to, anyone outside the US?** If EU/UK
customers are in scope, GDPR changes this document materially.

**P6. Data retention** — how long do you keep order records? **[RECOMMENDED:
7 years for tax and warranty purposes, stated as such]**

**P7. Children.** Confirm the site is not directed to under-13s.
**[RECOMMENDED: standard COPPA disclaimer]**

**P8. Who handles privacy requests** (access, deletion) and at what address?
Same email, or a dedicated one?

---

## Format and delivery

**F1.** How do you want these published? Your CMS has a `pages` table with
an admin editor, and the footer renders pages dynamically — so the natural
route is four CMS pages at `/pages/terms`, `/pages/privacy`,
`/pages/shipping-policy`, `/pages/returns-refunds`, editable by you later
without a deploy. **[RECOMMENDED]**

**F2.** Do you want them linked in the footer, at checkout, or both?
**[RECOMMENDED: both — an enforceable Terms usually requires the customer
to have been shown it at purchase, so a checkout link with a "by placing
your order you agree to..." line matters legally]**

**F3.** Effective date to print on them — today, or a specific date?
