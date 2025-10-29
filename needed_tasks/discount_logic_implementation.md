# Discount Logic Implementation

**💰 Budget**: TBD

**👨‍💻 Developer**: TBD

**💳 Payment**: TBD

**🎯 Priority**: 🔥 High

**📊 Status**: ⏳ In Progress

---

## Item Discount Logic

**validate_logic**:

```
IF:
  item has discount_percentage > 0
  AND price_list_rate > 0
THEN:
  discount_amount = (price_list_rate × discount_percentage) / 100
  rate = price_list_rate - discount_amount
  amount = rate × qty
```

**execute_logic**:

```
LOCATION: Invoice.js line 488-517
FUNCTION: calculateItemAmount(item)

1. Get item.qty and item.price_list_rate
2. Get item.discount_percentage
3. IF discount_percentage > 0:
   - Calculate item.discount_amount = (price_list_rate × discount_percentage) / 100
   - Calculate item.rate = price_list_rate - discount_amount
4. ELSE:
   - item.discount_amount = 0
   - item.rate = price_list_rate
5. Calculate item.amount = item.rate × item.qty
```

**Compatible Completion Percentage:** ✅ **100%**

---

## Invoice Discount Logic

**validate_logic**:

```
IF:
  invoice has additional_discount_percentage > 0
  AND apply_discount_on is NOT hardcoded (read from POS Profile)
THEN:
  IF apply_discount_on = 'Net Total':
    - discount_amount = (net_total × additional_discount_percentage) / 100
    - Apply discount BEFORE taxes
  IF apply_discount_on = 'Grand Total':
    - discount_amount = (grand_total × additional_discount_percentage) / 100
    - Apply discount AFTER taxes
```

**execute_logic**:

```
LOCATION: Invoice.js line 702-750 (get_invoice_doc) and 1494-1550 (setDiscountAmount)

STEP 1: Read apply_discount_on from POS Profile (NOT hardcoded)
  doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';

STEP 2: Calculate discount_amount
  IF applyDiscountOn === 'Grand Total':
    discountBase = grand_total
  IF applyDiscountOn === 'Net Total':
    discountBase = net_total

  discount_amount = (discountBase × additional_discount_percentage) / 100

STEP 3: Apply discount
  IF applyDiscountOn === 'Grand Total':
    grand_total = grand_total - discount_amount
  IF applyDiscountOn === 'Net Total':
    net_total = net_total - discount_amount
    grand_total = net_total + tax (if tax exists)
```

**Critical Issue:**

- Current code has hardcoded value at line 75
- Must read from pos_profile.apply_discount_on

**Compatible Completion Percentage:** ⚠️ **85%** (needs fix for apply_discount_on from POS Profile)

---

## Tax Calculation with Discount

**validate_logic**:

```
IF:
  apply_discount_on = 'Net Total'
  AND tax is applied (taxType = 'Exclusive')
  AND discount_amount > 0
THEN:
  - Tax must be recalculated AFTER discount is applied
  - Tax is calculated on discounted net_total (not original)
  - Formula: tax = discounted_net_total × tax_percent / 100
```

**execute_logic**:

```
LOCATION: Invoice.js line 1388-1491 (calculateTotalsLocally)

CURRENT FLOW:
  1. Calculate item totals
  2. Set net_total
  3. Calculate taxes
  4. Apply invoice discount

  ❌ ISSUE: Tax not recalculated after discount

REQUIRED FLOW:
  1. Calculate item totals
  2. Set net_total
  3. Calculate taxes on net_total
  4. Apply invoice discount
  5. IF apply_discount_on = 'Net Total' AND tax exists:
     - Recalculate tax on discounted net_total
     - tax = discounted_net_total × tax_percent / 100
     - grand_total = discounted_net_total + recalculated_tax
```

**Compatible Completion Percentage:** ⚠️ **80%** (needs tax recalculation after discount)

---

## Offer System (POS Awesome Enhancement)

### Transaction-Level Offers

**validate_logic**:

```
IF:
  offer_type IN ['grand_total', 'customer', 'customer_group']
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
  AND conditions match (min_qty, min_amt, customer, customer_group)
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
LOCATION: Invoice.js line 1897-2054 (calculateAndApplyOffers)

CURRENT BEHAVIOR (LIMITED):
  1. Fetch applicable offers
  2. IF transactionOffers exist:
     - Apply transaction offer ONLY
     - Set additional_discount_percentage
  3. ELSE IF itemOffers exist:
     - Apply item offers ONLY
     - Set item discount_percentage

  ❌ ISSUE: Cannot apply both types together

REQUIRED BEHAVIOR (COMPATIBLE):
  1. Fetch applicable offers
  2. IF transactionOffers exist:
     - Apply transaction offer
     - Set additional_discount_percentage
  3. ALWAYS check for itemOffers:
     - Apply item offers
     - Set item discount_percentage
  4. Allow BOTH to work together
```

**Compatible Completion Percentage:** ⚠️ **70%** (needs allow multiple offer types)

---

## Backend Integration

**validate_logic**:

```
IF:
  invoice_doc received from frontend
  AND invoice_doc contains all calculated fields
THEN:
  - Use ERPNext native methods ONLY
  - Do NOT override ERPNext calculations
  - Let ERPNext recalculate to ensure accuracy
```

**execute_logic**:

```
LOCATION: sales_invoice.py line 109-191 (create_and_submit_invoice)

CURRENT FLOW (✅ GOOD):
  1. Parse invoice_doc
  2. doc = frappe.get_doc(invoice_doc)
  3. Set flags: doc.is_pos = 1, doc.update_stock = 1
  4. doc.set_missing_values()  ← ERPNext native
  5. doc.validate()              ← ERPNext native
  6. doc.insert()                ← ERPNext native
  7. doc.submit()                ← ERPNext native

  ✅ All calculations use ERPNext standard
  ⚠️ Needs logging for verification
```

**Compatible Completion Percentage:** ✅ **95%** (needs logging for apply_discount_on verification)

---

## Summary

| Component                              | Compatible % | Status        | Priority    |
| -------------------------------------- | ------------ | ------------- | ----------- |
| Item Discount                          | ✅ 100%      | Perfect       | None        |
| Invoice Discount Basic                 | ✅ 100%      | Perfect       | None        |
| **apply_discount_on from POS Profile** | ⚠️ **85%**   | **Needs Fix** | **HIGHEST** |
| Tax Recalculation                      | ⚠️ 80%       | Needs Fix     | High        |
| Multiple Offers                        | ⚠️ 70%       | Needs Fix     | Medium      |
| Backend Integration                    | ✅ 95%       | Good          | Low         |

**Overall Compatible Completion Percentage:** ⚠️ **88%**

---

## Required Fixes (Priority Order)

### Step 1: Use apply_discount_on from POS Profile (1 hour)

**File:** `Invoice.js` line 75 and 702-750

**Changes:**

```
Line 75: Change from:
  apply_discount_on: 'Net Total',
To:
  apply_discount_on: null, // Read from POS Profile

Line 720-725: Add in get_invoice_doc():
  doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';
```

### Step 2: Fix tax recalculation (2-3 hours)

**File:** `Invoice.js` line 1388-1491

**Change:** Add Step 5 after Step 4 in calculateTotalsLocally()

```javascript
// Step 5: Recalculate tax if discount applied to net_total
const applyDiscountOn = doc.apply_discount_on || 'Net Total';
if (applyTax && doc.discount_amount > 0 && applyDiscountOn === 'Net Total') {
  if (taxType === 'Exclusive') {
    doc.total_taxes_and_charges = flt(
      doc.net_total * (taxPercent / 100),
      this.getPrecision('total_taxes_and_charges'),
    );
    doc.grand_total = flt(
      doc.net_total + doc.total_taxes_and_charges,
      this.getPrecision('grand_total'),
    );
  }
}
```

### Step 3: Allow multiple offers (4-5 hours)

**File:** `Invoice.js` line 1897-2054

**Change:** Remove limitation in calculateAndApplyOffers()

```javascript
// Allow both transaction AND item offers
const transactionOffer = sortedOffers.find(/* transaction */);
const itemOffers = sortedOffers.filter(/* item */);

// Apply BOTH types (remove if/else limitation)
if (transactionOffer) {
  // Apply transaction offer
}
itemOffers.forEach((offer) => {
  // Apply item offers (even if transaction offer exists)
});
```

### Step 4: Backend logging (1 hour)

**File:** `sales_invoice.py`

**Add:** Logging for verification

```python
# Log before processing
frappe.log_error(
    f"Input: apply_discount_on={invoice_doc.get('apply_discount_on')}, "
    f"additional_discount={invoice_doc.get('additional_discount_percentage')}",
    "POS Invoice Input"
)

# Log after validation
frappe.log_error(
    f"Validated: apply_discount_on={doc.apply_discount_on}, "
    f"discount_amount={doc.discount_amount}",
    "POS Invoice Validated"
)
```

**Total Estimated Time:** 8-10 hours

---

## Files to Modify

1. `posawesome/public/js/posapp/components/pos/Invoice.js`
   - Line 75: Remove hardcoded value
   - Line 720-750: Read from pos_profile
   - Line 1388-1491: Add tax recalculation
   - Line 1897-2054: Allow multiple offers

2. `posawesome/posawesome/api/sales_invoice.py`
   - Line 109-191: Add logging

**Total Changes:** 5 modifications in 2 files
