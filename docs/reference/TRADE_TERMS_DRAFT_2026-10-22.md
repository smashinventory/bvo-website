# Trade Program Terms — DRAFT for review

**Status: DRAFT. Not published, not wired in. For the owner to review and
for a lawyer to check before it replaces `trade-terms-2026-10-21`.**

Proposed version string: `trade-terms-2026-10-22`

---

## How to read this document

Clauses **1–16** are the trade program itself: eligibility, pricing,
shipping, returns, consent. These are business decisions — read them as
policy and tell me where the policy is wrong.

Clauses **17–26** are the legal infrastructure that mature retail terms
carry and this site currently has none of: order acceptance, pricing
errors, liability, indemnity, governing law, force majeure. These are
**not** business decisions in the same way. Two of them are flagged
🔴 below because they are real legal choices with real consequences and
should not go live on my judgement.

Everything here is original drafting that covers the same ground mature
retailers cover. It is not their text.

## 🔴 Three things that need a decision before this publishes

1. **Clause 24 — arbitration and class-action waiver.** Large retailers
   almost all have one. It is also the single most consequential clause
   here, it is unenforceable or restricted in some states, and it changes
   what a customer can do to you and what you can do to them. I have
   drafted it as a **placeholder marked for a lawyer** rather than written
   binding arbitration language myself. Do not publish it as-is.

2. **Clause 10 — document retention.** It promises declined applications
   have their uploads deleted within 90 days. **Nothing enforces that
   today.** Uploads sit in `storage/` indefinitely. Either build the
   deletion job or soften the clause — publishing a promise the system
   does not keep is worse than having no clause.

3. **Clause 19 — limitation of liability.** The cap I drafted is "what you
   paid for the product." That is the conventional position and it is also
   the kind of number a lawyer should set deliberately rather than inherit
   from a draft.

## 🔴 Two conflicts with the existing Shipping Policy

Found by reading the live Shipping Policy after drafting these terms. Both
are substantive, and in both cases the question is which document should
change — not which one I think is right.

1. **The Shipping Policy reserves the right to cancel orders for
   "purchases for resale." The Trade Program is explicitly for resale** —
   clause 7 here is about resale certificates. As written, the shipping
   policy authorises cancelling the very orders this program exists to
   take. One of the two has to move. The likely fix is narrowing the
   shipping-policy wording to unapproved resale, or exempting approved
   trade accounts by name.

2. **Capture timing — resolved from the code; both documents were
   wrong.** Every PaymentIntent is created `capture_method: 'manual'`, and
   the only capture path is an admin pressing the button on the order
   detail page. Nothing charges automatically — not on confirmation, not
   on shipment. The Shipping Policy's "charged when your order is
   confirmed" is simply untrue, and clause 3's original "at or near
   shipment" implied a trigger that does not exist. Clause 3 now says "when
   we are ready to fulfil the order," which is what actually happens. The
   Shipping Policy still needs its correction — drafted in
   `SHIPPING_POLICY_REVISION_2026-10-22.md`.

## ✅ Corrected after reading the live Shipping Policy

My first draft of clause 5 was wrong in three ways, and the policy was
right. Recording it so the error is not reintroduced:

- **Liftgate is INCLUDED free.** The draft had it as a chargeable extra.
- **Alaska and Hawaii are not served at all** — the draft implied they
  were merely expensive and could be covered by paying a difference.
- **PO boxes, APO/FPO, freight forwarders and storage facilities** are not
  served either; the draft did not mention them.

Clause 6 was also weaker than the policy: it said note damage and report
within 48 hours, where the policy says **refuse an obviously damaged
shipment** and warns that "subject to inspection" preserves nothing.
Clause 6 now follows the policy.

The lesson for the next person: the Shipping Policy is the authority on
shipping. Summarise it; do not re-derive it.

## Why this is a separate document from the site T&Cs

These bind trade accounts only, and they change when rates and thresholds
change. Keeping them separate means a rate change does not re-version the
terms every retail customer agreed to, and an applicant's acceptance
points at one specific document. Clause 26 incorporates the general T&Cs
by reference so the two cannot contradict each other by omission.

## Copy consistency — done

Thirteen live surfaces said "free shipping on every order" or "all
orders," including the **site-wide default meta description** in
`server.js` and the footer that renders on every page. All thirteen now
say "most orders," and `gates/gate_shipping_claim.js` fails the build if
an absolute claim comes back — or if the claim is deleted instead of
qualified.

⚠️ **The database is not covered.** `themeSettings.js` holds *defaults*;
the live announcement bar and value-bar text may be overridden through the
Theme Editor, and the gate cannot see those. Check the Theme Editor by
hand for any remaining "every order."

---

# BathroomVanitiesOutlet.com — Trade Program Terms

*Version `trade-terms-2026-10-22`. Last updated 22 October 2026.*

*These terms govern the BVO Trade Program. By applying, you accept them.*

## Part I — The program

### 1. Who the program is for

The Trade Program is for businesses that buy bathroom fixtures in the
course of their work — builders, remodelers, designers, property managers,
contractors and similar trades. It is not for personal purchases, and it
is not open to anyone who resells our products through an online
marketplace without our written agreement.

To apply you must supply a business card, and we may ask for further
evidence that the business is real and active. You must be at least 18 and
able to enter a contract on the business's behalf.

### 2. Approval, and what happens before it

Trade accounts are approved at our sole discretion. **Applying is not
approval:** until we approve you, your account is charged retail pricing
and no trade benefit applies.

We may decline an application without giving a reason, and we may revoke
an approved account at any time — see clause 15.

### 3. Trade pricing

Approved trade accounts receive **15% off** our listed prices (Platinum
Trade). Accounts reaching **$20,000 of captured spend in a rolling
12-month window** receive **20%** (Elite Trade).

"Captured" means payment has actually been taken. An order placed and
authorised but not yet charged does not count toward the threshold until
we charge it, which we do when we are ready to fulfil the order. Cancelled
and refunded orders do not count, and a refund removes that amount from
your running total.

Trade pricing does not combine with other discounts, coupons or
promotional offers. Where more than one would apply, the larger single
discount applies — they are not added together.

### 4. Your rate can move in both directions

The 12-month window is **rolling**. It moves forward continuously, so past
spend ages out of it.

If your trailing 12-month captured spend falls below $20,000, your rate
returns to 15%. **We will not warn you before this happens.** Your current
figure is shown on your account at all times, and it is your
responsibility to check it. We are saying this plainly because finding out
at checkout would be worse.

### 5. Shipping

*This clause summarises the [Shipping Policy](/pages/shipping-policy),
which governs in full. Where this summary and that policy differ, the
Shipping Policy is correct.*

**Free shipping on most orders, with no minimum**, to addresses in the
**continental United States**.

**Where we do not ship at all.** Alaska, Hawaii, Puerto Rico, US
territories and international addresses are not served. Nor are PO boxes,
military addresses (APO/FPO/DPO), freight forwarders, or storage
facilities. These are not "costs extra" — we cannot deliver there.

**Where free shipping may not apply.** A small number of serviceable
destinations cost substantially more to reach — remote and rural areas,
and locations where carriers apply surcharges or operate limited service.
Where an order is going to such an address, we will contact you before
shipping with the additional cost, and you may choose to pay the
difference or not proceed. **We will not add a shipping charge to your
order without telling you first.**

**What the delivery includes.** Curbside delivery **with liftgate
service** at a residential address, at no additional charge. Curbside
means the carrier brings the shipment to the curb or the end of the
driveway and lowers it from the truck. **Moving it inside is yours.** A
vanity can weigh 200–400 lb; plan for help.

White glove delivery into the home is available — call before ordering for
a quote. It is not a checkout option.

**Appointments.** The carrier contacts you to schedule a window, and
someone must be present to inspect and sign. Missed deliveries incur
carrier redelivery fees, and shipments held at a terminal accrue storage
charges; both are yours. So is a carrier reconsignment fee caused by an
incorrect or incomplete address.

Freight carriers deliver on their own schedules. Delivery estimates are
estimates, not commitments, and we are not liable for losses arising from
late delivery, including labour you have scheduled around it.

### 6. Inspect your delivery before you sign

**This is the clause most likely to cost you money if you ignore it.**

- If the packaging is **obviously damaged, refuse the shipment** and
  contact us the same day. We will arrange a replacement or refund.
- If you accept it but see any damage, **write the damage on the delivery
  receipt before signing**, and photograph it.
- Writing *"subject to inspection"* is **not sufficient** and will not
  preserve a claim.
- Note any missing boxes, by count, on the delivery receipt.

**Once a clean delivery receipt is signed, the carrier and the
manufacturer will deny the claim.** Neither we nor you can recover it
afterwards.

This applies to whoever signs on your behalf. On a job site, the person
accepting delivery is doing it as your agent, and their clean signature
binds you exactly as your own would. Brief them.

Keep all packaging until you are certain you are keeping the item.

### 7. Sales tax and resale certificates

If you buy for resale and want sales tax removed, a valid resale or
exemption certificate for the delivery state must be on file **before the
order is placed.** Without one we are required to charge sales tax, and we
cannot refund tax after the fact.

Keeping your certificate current is your responsibility. You are
responsible for any tax, interest or penalty arising from an invalid,
expired or improperly claimed exemption, and you agree to reimburse us for
any such amount assessed against us.

### 8. Returns, cancellations and restocking

Returns follow our standard returns policy, with these additions for trade
accounts:

- Manufacturer restocking fees of **up to 25%** apply to trade orders
  exactly as they do to retail orders.
- Return freight is yours unless the return is due to our error or a
  manufacturing defect.
- Goods must be unused, uninstalled and in original packaging.
- Special-order, made-to-order and clearance items may not be returnable.
  Where that applies, it is stated before you buy.
- A return authorisation is required before shipping anything back.
  Unauthorised returns may be refused.

Orders already in production or released to a carrier may not be
cancellable, or may incur the carrier's and manufacturer's charges.

### 9. Commercial installation and warranty

Manufacturer warranties on these products are **residential only.**

Product installed in a commercial setting — apartment buildings, hotels,
offices, rental units, short-term lets — carries **no manufacturer
warranty.** If you are buying for a commercial project you are buying
without warranty cover, and you should price that risk into your job. We
pass through manufacturer warranties; we do not add our own.

### 10. Your documents

Documents you upload — business cards, resale certificates and anything
else — are stored privately, are not reachable over the public internet,
and are used only to verify your business and administer your account.

We keep them only as long as needed for that purpose and to meet our
record-keeping obligations. Applications that are declined have their
uploaded documents deleted within 90 days. *[🔴 see the decision note at
the top — nothing enforces this yet.]*

### 11. Trade pricing is confidential

Trade pricing is for your business. It must not be republished,
advertised, posted publicly, or shared outside your business. You may of
course quote your own customers your own prices.

This is not a formality. Our agreements with manufacturers set minimum
advertised prices, and publishing below them puts our ability to supply
you at risk. Doing so is a breach of these terms and may end your account.

### 12. Your account

A trade account is for one business and the people who work in it. Do not
share your sign-in outside the business, and do not use the account to buy
on behalf of people who are not your customers.

You are responsible for activity under your account. Keep your contact
details current — notices we send to the email on your account are treated
as delivered.

### 13. Communications

**By joining the Trade Program you agree to receive notifications about
the program, trade opportunities, deals and news.** You can remove
yourself from these at any time by emailing
**support@BathroomVanitiesOutlet.com**, or by using the unsubscribe link
in any message.

Removing yourself from program communications does not close your trade
account, and does not stop transactional messages about your own orders —
confirmations, shipping notices, and anything we need to tell you about a
purchase you have made.

### 14. Changes to the program and these terms

We may change the program — including discount rates, the Elite threshold
and the rolling window — and may change these terms. Material changes will
be posted here with a new version date, and where we have your address we
will tell you.

Changes are not retroactive: an order already accepted is governed by the
terms in force when we accepted it. Continuing to buy under the program
after a change means you accept it for future orders. If you do not, stop
using the program and tell us.

### 15. Ending the program or your account

You may leave at any time. We may suspend or end a trade account at any
time, including for breach of clause 11, for misuse of the account, or at
our discretion.

Orders already accepted will be honoured, or cancelled and refunded, at
our discretion. Clauses 11, 19, 20, 23, 24 and 25 survive the end of your
account.

### 16. Not an exclusive or agency relationship

Nothing here creates a partnership, franchise, joint venture, agency or
exclusive relationship. You are not authorised to make representations,
warranties or commitments on our behalf, or to present yourself as our
agent, dealer or authorised representative.

## Part II — Orders, liability and disputes

*These clauses apply to every trade order. They are the standard
machinery; they are here because the alternative is silence, and silence
is what causes arguments.*

### 17. An order is an offer, not a contract

Placing an order is **your offer to buy.** An order confirmation
acknowledges receipt; it does not accept the order. The contract forms
only when we ship, or when we tell you in writing that we accept it.

Until then we may decline or cancel any order, in whole or in part, for
any reason — including unavailable stock, a pricing or description error,
suspected fraud, a quantity inconsistent with trade use, or an address we
cannot serve. Where we do, we release or refund any amount taken.

### 18. Pricing and description errors

Our catalogue is large and fed partly by supplier data, and errors happen.
Prices, availability, specifications, finishes, dimensions and images may
be inaccurate or out of date.

**A listed price is not an offer we are bound by if it is wrong.** Where an
order is affected by an error, we will contact you with the correct
information and you may confirm at the corrected price or cancel without
charge. We are not obliged to supply at the incorrect price.

Finishes and colours vary between production runs and between screens.
Images are representative. Where exact match matters — matching an earlier
order, matching across a project — order a sample first, and tell us
before you buy.

### 19. Limitation of liability

To the fullest extent the law allows, our total liability arising out of
or relating to any product or order is limited to **the amount you paid
for the product concerned.** *[🔴 see the decision note at the top.]*

We are not liable for indirect, incidental, special, consequential,
exemplary or punitive damages, or for loss of profit, revenue, business,
goodwill or data — including, specifically, **the cost of labour,
installation, re-installation, removal, site delay, or liquidated damages
you owe a third party**, whether or not we were told they were possible.

This matters most for trade: if a vanity arrives damaged and your
installer is standing in the room, we owe you the vanity. We do not owe
you the installer's day.

Nothing here excludes liability that cannot lawfully be excluded,
including for fraud, death or personal injury caused by negligence.

### 20. You are responsible for your installation

You are responsible for measuring, for confirming a product suits its
intended location and use, for compliance with building, plumbing,
electrical and accessibility codes, and for permits and inspections.

We do not provide design, engineering or code-compliance advice. Anything
we say about suitability is general information, not professional advice,
and is not a substitute for your own judgement or a licensed
professional's.

Installation by anyone other than a licensed professional, and any
modification of a product, may void the manufacturer's warranty.

### 21. Indemnity

You agree to indemnify and hold us harmless from claims, losses and costs
(including reasonable legal fees) arising from your breach of these terms,
your installation or use of the products, your representations to your own
customers about the products, your misuse of trade pricing under clause
11, or your improper claim of a tax exemption under clause 7.

### 22. Intellectual property

Product images, descriptions, catalogue data, the site and its content are
owned by us or our suppliers. Being a trade account does not license you
to use them.

You may use product images and descriptions we supply to present products
to your own clients in the course of a project. You may not use them in
paid advertising, in a public catalogue, on a marketplace listing, or in
any way that shows prices below MAP, without our written permission. We
may withdraw that permission.

### 23. Force majeure

We are not liable for delay or failure to perform caused by events outside
our reasonable control — including supplier or manufacturer failure,
discontinuation, carrier disruption, labour action, severe weather,
natural disaster, fire, epidemic, war, civil unrest, government action, or
failure of utilities or communications networks.

Where such an event affects your order we will tell you, and either of us
may cancel the affected part of it.

### 24. Governing law and disputes

These terms are governed by the laws of the State of **[STATE — to be
confirmed]**, without regard to conflict-of-laws rules.

🔴 **PLACEHOLDER — FOR A LAWYER TO COMPLETE.** This is where mature
retailers put a binding arbitration clause with a class-action waiver and
a venue selection. That clause materially changes both parties' rights,
its enforceability varies by state, and it should be written by counsel
and not inherited from a draft. Until it is, disputes fall to the courts
of the governing state named above.

Nothing in this clause prevents either of us from seeking an injunction to
protect confidential information or intellectual property.

### 25. The rest of the machinery

**Severability.** If a provision is held unenforceable, the rest stands
and the unenforceable part is limited to the minimum extent necessary.

**No waiver.** Not enforcing a provision on one occasion does not waive it.

**Assignment.** You may not assign these terms or your account without our
written consent. We may assign them in connection with a sale or
reorganisation of the business.

**Entire agreement.** These terms, together with the documents in clause
26, are the entire agreement on their subject and supersede earlier
discussions, quotes and representations. Nothing said by email, phone or
chat varies them unless we confirm it in writing and refer to this clause.

**Notices.** Notices to you go to the email on your account. Notices to us
go to support@BathroomVanitiesOutlet.com.

**Headings.** Headings are for convenience and do not affect meaning.

### 26. Relationship to our general terms

Except where these Trade Program Terms say otherwise, the
BathroomVanitiesOutlet.com Terms & Conditions, Privacy Policy, Shipping
Policy and Returns Policy apply to your use of the site and to every order
you place. Where the two genuinely conflict, these terms govern for trade
accounts.

---

*Questions about the program: support@BathroomVanitiesOutlet.com*
