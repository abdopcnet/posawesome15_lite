## POSAwesome Return Safeguard Plan

### 1. Objective & Guardrails

- Prevent POS returns from refunding more than the remaining refundable amount per invoice/item while keeping the UX unchanged for compliant cases.
- Prefer minimal, additive changes that reuse current endpoints and Vue components (`Invoice.js`, `Returns.vue/.js`, `Payments.js`).
- Enforce limits in BOTH frontend (for guidance) and backend (authoritative block); backend must stay source of truth.

### 2. Current Flow Recap (from code inspection)

1. **Return search dialog** (`Returns.vue/.js`)
   - Calls `posawesome.posawesome.api.sales_invoice.get_invoices_for_return`.
   - Receives submitted POS invoices with full items list but without remaining qty/amount metadata.
   - Loads whole invoice JSON into POS state when user selects a row.
2. **Invoice editor** (`Invoice.js`)
   - Sets `invoice_doc.is_return = 1`, negates qty/amounts, and lets cashier adjust line qty manually.
   - No awareness of earlier returns; only respects `max_qty` if previously set (rare) and never enforces outstanding limits.
3. **Payments pane** (`Payments.js`)
   - Accepts any payment mix; only checks that the algebraic total matches the (negative) invoice total.
4. **Submission** (`sales_invoice.create_and_submit_invoice`)
   - Trusts client payload; Frappe core will stop qty > original, but not sum of multiple partial returns, so over-refunds sneak through.

### 3. Root Causes of Over-Refunds

- `get_invoices_for_return` does not compute how much of each invoice/item has already been returned; dialog lists invoices even when nothing remains to refund.
- `Invoice.js` lacks per-item `max_returnable_qty` or invoice-level `remaining_amount` constraints, allowing users to increase qty beyond what is outstanding.
- Backend submission endpoints do not revalidate the new return against prior returns of the same source invoice.

### 4. Proposed Enhancements (minimal surface change)

#### 4.1 Backend: enrich return metadata & enforce final gate

1. **Extend `get_invoices_for_return`**
   - For each candidate invoice, aggregate already-returned quantities/amounts (`Sales Invoice` children referencing `return_against`).
   - Compute and append:
     - `remaining_returnable_amount` (rounded value).
     - Per-item `remaining_returnable_qty` and `already_returned_qty` on each child row.
   - Exclude invoices where `remaining_returnable_amount <= 0`.
2. **Add lightweight endpoint** (optional) `get_invoice_return_limits(name)` to fetch only limits when invoice already cached; helps refreshing caps without reloading full doc.
3. **Server validation on submit**
   - Inside `create_and_submit_invoice`, before saving the new return, call helper that compares proposed negative qty/amounts against outstanding values derived above.
   - Throw a validation error if any line or total exceeds remaining allowance.
   - Ensure validation runs even if payload was hand-crafted (covers mobile/offline clients later).

#### 4.2 Frontend: guide users and block obvious violations

1. **Return dialog**
   - Display new `remaining_returnable_amount` column/badge so cashiers know how much is left.
   - Grey-out or hide invoices with zero remaining balance (backend already filters but defensively handle older caches).
2. **Invoice item controls (`Invoice.js`)**
   - When loading a return invoice, map backend-provided per-item limits onto line objects (e.g., `item.max_returnable_qty`).
   - Clamp quantity editor so it cannot exceed allowed returnable qty (respecting negative direction).
   - Surface inline error/toast if user hits the cap.
3. **Totals & payments**
   - Track invoice-level `remaining_returnable_amount`; prevent `apply_discount`, `quick_return`, and payment auto-fill from exceeding that value.
   - If cashier tries to tender more than allowed (manual amount edit), show error and revert.

#### 4.3 UX/Edge-Case Considerations

- Allow legitimate multi-payment returns (cash + card) as long as sum stays within remaining total.
- Keep quick-return flow (auto negative qty) but seed it with the per-item max to avoid overshooting.
- Handle invoices with mixed tax/discount so that remaining amount calculation uses base amounts consistent with ERPNext precision.

### 5. Implementation Steps & Order

1. **Data layer first**
   - Add helper in `sales_invoice.py` to compute per-invoice return stats (reusable by both fetch and submit paths).
   - Update `get_invoices_for_return` to include new fields + filtering.
   - Write backend unit test (Python) covering invoices with partial returns to confirm calculations.
2. **Server validation**
   - Hook helper into `create_and_submit_invoice` before saving doc; raise descriptive error when exceeding caps.
   - Test via backend API call simulating double return to ensure block triggers.
3. **Frontend wiring**
   - Update API mapper and dialog to consume new metadata.
   - Enhance `Invoice.js` item quantity setters (`update_item_qty`, `change_qty`, etc.) to respect `max_returnable_qty`.
   - Update totals/payment guards to cap at `remaining_returnable_amount`.
4. **UX polish**
   - Add explanatory tooltip/message when user reaches cap.
   - Ensure quick-return shortcut selects a payment row automatically and respects limit.
5. **Validation pass**
   - Manual: recreate incident scenario (invoice partially returned twice) and verify second return is capped.
   - Automated: run frontend unit tests (if any) and existing Cypress smoke; at minimum re-run POSAwesome lint/build.

### 6. Assumptions & Risks

- Assumes ERPNext already stores prior returns with `return_against`; helper depends on that linkage.
- Need to confirm performance of new aggregate query on large datasets; mitigate with indexed filters and limiting result set (e.g., last N invoices or search pagination already present).
- Offline mode is out-of-scope; plan targets online kiosk usage where server validation is reachable.

### 7. Follow-Up / Stretch

- Persist per-item `returned_qty` as ERPNext custom field to avoid runtime aggregation if performance becomes an issue.
- Add reporting widget showing outstanding return liabilities per cashier/store.
- Evaluate auto-restocking toggles once base safeguard is stable.
