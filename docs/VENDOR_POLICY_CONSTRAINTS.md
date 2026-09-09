# Vendor policy constraints — what BVO's policies may promise

Sources reviewed 8 Sept 2026:

- `James_Martin_MAP_Policy_12-05-25.pdf` (revised 5 Dec 2025) — **CONFIDENTIAL**
- `JMV Delivery Policies Form_2024 (effective 2019).pdf` (effective 15 Aug 2019)
- James Martin One-Year Limited Product Warranty (public, via Home Depot and
  JMV's own CDN)
- BVO's existing Shopify page `/pages/james-martin-policies`, which already
  republishes the delivery policy verbatim

**The governing principle:** BVO is the customer's counterparty, so whatever
BVO promises, BVO owes — regardless of what James Martin allows. Every place
BVO's policy is more generous than JMV's, BVO pays the difference out of
margin. That is a legitimate choice, but it must be a deliberate one.

---

## The constraint table

| Topic | James Martin allows BVO | Safe BVO customer policy | Why the gap |
|---|---|---|---|
| Return window | RMA only for goods purchased within **30 days** of the JMV **purchase order** | **14 days from delivery** | See "the window trap" below — this is the expensive one |
| Restocking | **25%** of original invoice | **25%** | Anything lower is BVO absorbing the difference |
| Return freight | Customer pays; credit issued **less shipping fees** | Customer pays return freight | Already agreed |
| Condition | Clean, resalable, **original packaging** | Same | Mirror exactly |
| RMA pickup | Carrier must collect within **30 days** of RMA or it voids | **14 days** for customer to release goods | BVO needs slack to arrange pickup inside JMV's 30 |
| Special order | Non-cancelable, **non-returnable** | Same, flagged at product level | Needs a SKU-level flag — see open item |
| Visible damage | Note on BOL at delivery; report within **72 hours** | Note on BOL; report within **48 hours** | BVO must file with JMV inside 72; a 72-hour customer window leaves zero time |
| Shortage | Note missing box count on BOL, report within 72 hours | Same, 48 hours | Same reasoning |
| Concealed damage | **30 days** from receipt | **21 days** from delivery | Room to be generous here; buffer still needed |
| Warranty | 1 year limited, residential only | Pass through, no BVO warranty | See warranty section |

---

## The window trap — read this before setting the return window

JMV's 30 days runs from **the date BVO's purchase order was issued**, not
from the date the customer received the vanity.

On a drop-ship order the sequence is roughly:

```
day 0    customer orders, BVO issues PO to JMV
day 2-5  JMV ships
day 7-14 customer takes delivery
```

So a customer returning on "day 30 from delivery" is at day **37–44** from
the PO. JMV refuses the RMA, and **BVO absorbs the entire cost of that
return** — product, both freight legs, everything.

A 30-day-from-delivery policy, which is the e-commerce default and what I
recommended before reading this document, would have been an uncapped
liability on every return that came in late.

**Recommended: 14 days from delivery.** That puts the worst case around day
28 from PO, leaving a small margin to actually get the RMA issued. If a
longer window is wanted for competitive reasons, 21 days is the outside
limit, and BVO should expect to eat the occasional late one.

---

## The delivery receipt clause — the single most important paragraph

JMV's position is absolute and quoted here because the wording matters:

> "If the bill of lading/delivery receipt is not marked as damaged at the
> time of delivery, the damage claim **WILL BE DENIED**. Noting 'subject to
> inspection' on the bill of lading/delivery receipt is not acceptable."

And for concealed damage:

> "if there is outer packaging damage, concealed damage claim **WILL BE
> DENIED**."

Consequences for BVO:

- Once a customer signs a clean delivery receipt, the freight claim is dead.
  JMV will not honour it, the carrier will not honour it, and the loss lands
  on BVO or on the customer.
- Therefore this instruction cannot live only on a policy page nobody reads.
  It belongs **at checkout, in the order confirmation email, and in the
  shipping notification email** — the last of which is the one that actually
  gets read, because it arrives with a tracking number.
- The instruction is short: *inspect before you sign; if anything is
  damaged, write it on the delivery receipt before signing and photograph
  it; refuse the shipment outright if the packaging is obviously damaged.*

JMV also notes the carrier driver may require refusal of the entire
shipment rather than part of it — worth saying, so a customer is not
surprised.

---

## Warranty — pass through, do not create one

James Martin's warranty, per their published form:

- **One year**, limited, from date of purchase
- Defects in **material or workmanship** only
- **Residential use only** — commercial installation voids it
- Covers **repair or replacement at James Martin's discretion**
- Explicitly **excludes installation, labour and removal charges**
- Voided by modification, improper installation, abuse, or abrasive cleaners
- **Quartz tops are excluded** and carry a separate manufacturer warranty

BVO should state plainly that products carry the manufacturer's warranty,
that BVO offers no warranty of its own, and that BVO will facilitate claims.
Offering anything beyond this creates an obligation BVO funds alone — and
"we stand behind our products" style language in a policy can be read as
exactly that.

Warranty terms are set by the manufacturer and change without notice, so the
page should link to JMV's warranty rather than restate it in full. BVO's
existing Shopify page already takes this approach and it is the right one.

---

## ⚠ MAP policy — confidential, and a live risk on the new site

**The MAP document is marked confidential and states it "may not be
disclosed to other parties."** It must not be published, quoted, or
paraphrased on the website. It is referenced here only as an internal
constraint.

What it means operationally:

- Resellers may not **advertise** James Martin covered products below the
  minimum advertised price. Actual selling price remains BVO's own choice —
  the restriction is on advertising only.
- Enforcement is fast: written warning, **24 hours** to comply, and James
  Martin may **withhold shipment of new orders**.
- Interpretation is at James Martin's sole discretion, with no prior notice.

**The risk on the new site.** BVO's new storefront displays a struck-through
MSRP, a sale price, and a "Save $X" badge on every card, plus a "Sale"
navigation category. If any advertised price on any of those surfaces falls
below MAP for a covered product, that is a violation — and the remedy is
James Martin withholding shipments, which stops the business.

Note that BVO's existing Shopify site advertises its discount as **"10% Off
All Vanities — Local Pick Up Orders Only."** That qualifier looks
deliberate, and is the sort of structure used to stay inside a MAP policy.
The new site carries no equivalent qualifier.

**This needs checking against the MAP price list before launch, and it is
not a policy-page question.** Added to the pre-launch checklist.

---

## Open items this raised

1. **Special-order SKUs are non-cancelable and non-returnable.** BVO needs
   to know which products those are and flag them at product level, so the
   product page and checkout can say so. A blanket policy sentence is not
   enough if the customer cannot tell which items it applies to.
2. **ER Vanities — Sam confirmed 8 Sept that ER's terms mirror James
   Martin's.** The policies are therefore written once and apply to both
   brands, with no brand-specific carve-outs.
   *Assumption on file, not a document.* If ER's actual restocking
   percentage, return window or damage-reporting deadline differs even
   slightly, BVO's published policy will be wrong for ER products and BVO
   absorbs the difference. Worth obtaining ER's written terms when
   convenient and filing them alongside the JMV PDFs.
3. **Other brands.** BVO's existing site publishes separate Kube Bath and
   Delta Faucet policies. If those brands are coming to the new site, they
   need the same treatment.
4. **Damage-instruction placement** — checkout, order confirmation email,
   and shipping notification email. This is a build task, not a policy task.
