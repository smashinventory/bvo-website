'use strict';

/**
 * orderDeleteReasons.js — the canonical list of why an order gets deleted.
 *
 * ONE SOURCE, THREE CONSUMERS: the dropdown in views/pages/admin/orders/index.ejs,
 * the validation in ordersController, and the gate. The codebase has been bitten
 * twice by a list that lived in two places (orderStatuses.js exists for exactly
 * this reason, and the inline copy it replaced had drifted), so this is a module
 * from the start rather than an array typed into a template.
 *
 * WHY CODES AND NOT FREE TEXT. A typed note is unsearchable six months later:
 * "test", "test order", "testing", and "tst" are four different strings for one
 * thing. A code groups them, and the label can be reworded without rewriting
 * history. The free-text note rides alongside rather than replacing it.
 *
 * `requiresNote` marks the options that mean nothing on their own. "Other" with
 * no note is the same as no reason at all, which is what this whole field
 * exists to prevent.
 */

const ORDER_DELETE_REASONS = [
  { code: 'test_order',       label: 'Test or sample order',        requiresNote: false },
  { code: 'duplicate',        label: 'Duplicate order',             requiresNote: false },
  { code: 'customer_request', label: 'Customer asked to remove it', requiresNote: false },
  { code: 'fraud',            label: 'Fraudulent or suspicious',    requiresNote: false },
  { code: 'data_cleanup',     label: 'Data cleanup / migration',    requiresNote: false },
  { code: 'other',            label: 'Other (explain below)',       requiresNote: true  },
];

const VALID_DELETE_REASON_CODES = ORDER_DELETE_REASONS.map(r => r.code);

/* Notes are required for 'other' and optional elsewhere, but when one IS given
   it has to say something. Five characters excludes "x" and "asdf" without
   obstructing anyone with a real sentence. */
const MIN_DELETE_NOTE = 5;

/* Builds the string that goes into order_deletions.deleted_reason. The label is
   stored alongside the code deliberately: reading the audit table should not
   require joining it against a constant in a JS file that may have changed. */
function composeDeleteReason(code, note) {
  const entry = ORDER_DELETE_REASONS.find(r => r.code === code);
  if (!entry) return null;
  const clean = (note || '').toString().trim();
  if (entry.requiresNote && clean.length < MIN_DELETE_NOTE) return null;
  if (clean && clean.length < MIN_DELETE_NOTE) return null;
  return clean ? `${entry.label} — ${clean}` : entry.label;
}

module.exports = {
  ORDER_DELETE_REASONS,
  VALID_DELETE_REASON_CODES,
  MIN_DELETE_NOTE,
  composeDeleteReason,
};
