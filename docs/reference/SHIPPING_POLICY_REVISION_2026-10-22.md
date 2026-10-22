# Shipping Policy — proposed revision

**For the owner to review, then paste into the admin Pages editor
(`/pages/shipping-policy`, page id 3).**

## The verdict first: this policy is good. Do not rewrite it.

I came to this page expecting to correct it and found the opposite — the
Shipping Policy was right and the trade terms I had just drafted were
wrong. The inspection section in particular is better than what I wrote:
"refuse the shipment," and the warning that *"subject to inspection"*
preserves nothing, are the two things that actually save a freight claim,
and neither was in my draft.

So this is **not a rewrite**. It is four changes. Everything else stays
exactly as it is.

---

## Change 1 — "every order" → "most orders" (the compliance fix)

**Section:** Free Shipping, first line.
**Why:** the trade terms carve out high-cost destinations, and thirteen
code surfaces were changed from "every order" to "most orders" in
`46a52d2`/`7c425b2`. This page is the document those terms incorporate by
reference, so if it still says "every order" the contradiction is between
two binding documents rather than between marketing and a contract.

**Current:**

> We offer free shipping on every order, with no minimum purchase, to
> addresses in the **continental United States**.

**Replace with:**

> We offer free shipping on most orders, with no minimum purchase, to
> addresses in the **continental United States**.

## Change 2 — the high-cost destination carve-out (new)

**Section:** Free Shipping, immediately after the "we do not ship to"
paragraph.
**Why:** this is the substance you asked for, and the policy currently has
no equivalent. Today the only tool for an expensive destination is the
Order Acceptance clause — which lets you *decline*, but never lets the
customer *choose to pay the difference*. That is a worse outcome for both
sides: a sale you wanted refused instead of completed.

**Add this paragraph:**

> A small number of serviceable addresses cost substantially more to reach
> — remote and rural locations, and areas where carriers apply surcharges
> or operate limited service. If your order is going to one of these, we
> will contact you before shipping with the additional cost, and you can
> choose to pay the difference or cancel for a full release of your
> authorization. **We will never add a shipping charge to your order
> without telling you first.**

## Change 3 — the meta description

**Field:** `meta_desc` on page 3.
**Why:** it carries both defects at once — "every order," and it is the
only place that states liftgate as a blanket promise with no "residential"
qualifier.

**Current:**

> Free curbside freight shipping with liftgate on every order in the
> continental US. Processing, delivery times, and how to inspect your
> delivery.

**Replace with:**

> Free curbside freight delivery with liftgate on most orders in the
> continental US. Processing times, delivery windows, and how to inspect
> your shipment before you sign.

## Change 4 — the effective date

**Section:** the italic line under the H1.
**Current:** *Effective September 8, 2026*
**Replace with:** *Effective October 22, 2026*

Substantive terms are changing, so the date has to move. Leaving a stale
effective date on an amended policy is the thing that makes the amendment
hard to rely on later.

---

## Two conflicts this page has with the Trade Program

Not edits — decisions. Both are real, and I do not know which way you want
them resolved.

### A. The Order Acceptance clause cancels the trade program

**Current text:**

> We reserve the right to decline or cancel any order for any lawful
> reason, including but not limited to prohibitive freight cost, suspected
> fraud, **purchases for resale**, or unusual quantities.

The Trade Program exists to sell to people who resell. Clause 7 of the
trade terms is about resale certificates and sales-tax exemption. As
written, this page authorises cancelling exactly the orders the trade
program is built to take — and "unusual quantities" would catch a
contractor ordering eight vanities for one job, which is a normal trade
order and a good day for you.

**If you want it narrowed, suggested replacement:**

> We reserve the right to decline or cancel any order for any lawful
> reason, including but not limited to prohibitive freight cost, suspected
> fraud, unauthorised resale, or quantities inconsistent with the account.
> Approved Trade Program accounts may purchase for resale, and quantities
> consistent with trade use are expected on those accounts.

### B. When the card is actually captured — RESOLVED FROM THE CODE

I checked rather than guessed, and **both documents were wrong.**

The facts: `stripeService.js:343` creates every PaymentIntent with
`capture_method: 'manual'`. The only capture call in the codebase is
`stripeService.capturePayment` (line 637), reached from exactly one place
— `POST /admin/orders/:id/capture`, an admin pressing a button on the
order detail page. **Nothing captures automatically.** Not on
confirmation, not on shipment, not on a schedule.

So:

- This page's *"charge it when your order is confirmed"* is **wrong**.
  Confirmation does not charge anything.
- Trade terms clause 3's *"normally happens at or near shipment"* is a
  description of intent, not of code. It is closer, but it still implies
  an automatic trigger that does not exist.

**Suggested replacement for the Payment Timing section:**

> We place an authorization hold on your card when you order. **We do not
> charge the card until we are ready to fulfil your order** — normally
> when your order is confirmed with the manufacturer and shipping is being
> arranged. Card authorizations typically expire after about seven days,
> so if your order takes longer we will re-confirm payment before
> charging. If we cancel your order before the charge is taken, no charge
> is ever made and the hold is released by your bank.

This is worth getting right beyond the wording: an uncaptured
authorization expires in about seven days and the money is simply gone
from your side of the ledger. Order 00125's $2,694.60 authorization from
21 October is exactly this, and it needs capturing or cancelling before
roughly 28 October. A policy that says "we charge on confirmation" makes
it easy to assume that already happened.

---

## What I deliberately did not touch

- **The entire inspection section.** It is the best-written part of the
  site and the trade terms were changed to match it, not the reverse.
- The processing and delivery time ranges — those are operational facts I
  have no basis to change.
- The destination exclusions, white-glove-by-phone, backorder, address
  change and job site sections. All sound.
