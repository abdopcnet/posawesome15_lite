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

POS PROFILE TAX FIELDS (already used in code):
  - posa_apply_tax: Checkbox to enable/disable tax
  - posa_tax_type: 'Tax Inclusive' or 'Tax Exclusive'
  - posa_tax_percent: Tax percentage (e.g., 15)

CURRENT FLOW:
  1. Calculate item totals
  2. Set net_total
  3. Calculate taxes (using pos_profile posa_apply_tax, posa_tax_type, posa_tax_percent)
  4. Apply invoice discount

  ❌ ISSUE: Tax not recalculated after discount

REQUIRED FLOW:
  1. Calculate item totals
  2. Set net_total
  3. Calculate taxes on net_total (using POS Profile fields)
  4. Apply invoice discount
  5. IF apply_discount_on = 'Net Total' AND posa_apply_tax AND tax exists:
     - Recalculate tax on discounted net_total
     - tax = discounted_net_total × posa_tax_percent / 100
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

## Implementation Tasks

### Task 1: Read apply_discount_on from POS Profile 🔥 CRITICAL

**Priority:** HIGHEST
**Estimated Time:** 1 hour
**File:** `Invoice.js`
**Status:** ⏳ Pending

**Objective:** Remove hardcoded value and read from POS Profile

**Changes Required:**

1. **Line 75:** Remove hardcoded value

   ```javascript
   // FROM:
   apply_discount_on: 'Net Total',

   // TO:
   apply_discount_on: null, // Read from POS Profile
   ```

2. **Lines 720-725 (in get_invoice_doc function):** Read from POS Profile
   ```javascript
   // ADD THIS LINE:
   doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';
   ```

**Acceptance Criteria:**

- ✅ No hardcoded value in data()
- ✅ Value read from pos_profile in get_invoice_doc()
- ✅ Default to 'Net Total' if not set in profile

---

### Task 2: Fix Tax Recalculation After Discount

**Priority:** HIGH
**Estimated Time:** 2-3 hours
**File:** `Invoice.js` (calculateTotalsLocally function)
**Status:** ⏳ Pending

**Objective:** Recalculate tax after applying discount to net_total

**Changes Required:**

**Location:** Line 1388-1491, after Step 4

**Add Step 5:**

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

**Note:** The following variables are already loaded from POS Profile in this function:

- `applyTax` = `this.pos_profile?.posa_apply_tax`
- `taxType` = `this.pos_profile?.posa_tax_type`
- `taxPercent` = `flt(this.pos_profile?.posa_tax_percent) || 0`

**Acceptance Criteria:**

- ✅ Tax recalculated when discount applied to net_total
- ✅ Works with posa_apply_tax, posa_tax_type, posa_tax_percent
- ✅ Grand total updated correctly after tax recalculation

---

### Task 3: Allow Multiple Offer Types Simultaneously

**Priority:** MEDIUM
**Estimated Time:** 4-5 hours
**File:** `Invoice.js` (calculateAndApplyOffers function)
**Status:** ⏳ Pending

**Objective:** Allow Transaction-level AND Item-level offers at the same time

**Changes Required:**

**Location:** Line 1897-2054

**Current Issue:** Only one type (Transaction OR Item) can be applied

**Required Change:** Remove if/else limitation, allow both types

```javascript
// BEFORE:
if (transactionOffers.length > 0) {
  // Apply transaction offers
} else if (itemOffers.length > 0) {
  // Apply item offers
}

// AFTER: Allow both
const transactionOffer = sortedOffers.find(/* transaction-level */);
const itemOffers = sortedOffers.filter(/* item-level */);

// Apply transaction offer (if exists)
if (transactionOffer) {
  this.additional_discount_percentage = transactionOffer.discount_percentage;
  // ... save to posa_offers
}

// Apply item offers (work alongside transaction offer)
itemOffers.forEach((offer) => {
  this.items.forEach((item) => {
    if (matchesOffer(item, offer)) {
      item.discount_percentage = offer.discount_percentage;
      // ... update item
    }
  });
});
```

**Acceptance Criteria:**

- ✅ Transaction-level offers can be applied
- ✅ Item-level offers can be applied
- ✅ Both types work together simultaneously
- ✅ No conflicts between offer types

---

### Task 4: Add Logging for Debugging

**Priority:** LOW
**Estimated Time:** 1 hour
**Files:** `sales_invoice.py` + `Invoice.js`
**Status:** ⏳ Pending

**Objective:** Add logging in backend and frontend to debug discount logic

---

#### 4A: Backend Logging (sales_invoice.py)

**Location:** Line 109-191 (create_and_submit_invoice function)

**Add logging with function name:**

```python
@frappe.whitelist()
def create_and_submit_invoice(invoice_doc):
    """Create and submit Sales Invoice using ERPNext native workflow"""

    # Log input - show function name and important values
    frappe.log_error(
        f"[create_and_submit_invoice] INPUT: "
        f"apply_discount_on={invoice_doc.get('apply_discount_on')}, "
        f"additional_discount={invoice_doc.get('additional_discount_percentage')}, "
        f"net_total={invoice_doc.get('net_total')}, "
        f"grand_total={invoice_doc.get('grand_total')}, "
        f"items_count={len(invoice_doc.get('items', []))}",
        "POS Invoice Input"
    )

    # ... existing code ...

    doc.validate()

    # Log after validation - show function name and important results
    frappe.log_error(
        f"[create_and_submit_invoice] VALIDATED: "
        f"apply_discount_on={doc.apply_discount_on}, "
        f"additional_discount_percentage={doc.additional_discount_percentage}, "
        f"discount_amount={doc.discount_amount}, "
        f"net_total={doc.net_total}, "
        f"grand_total={doc.grand_total}, "
        f"base_discount_amount={doc.base_discount_amount}",
        "POS Invoice Validated"
    )

    doc.insert()

    # Log after insert - show function name and invoice name
    frappe.log_error(
        f"[create_and_submit_invoice] INSERTED: "
        f"invoice_name={doc.name}, "
        f"grand_total={doc.grand_total}",
        "POS Invoice Inserted"
    )

    doc.submit()

    # Log after submit - show function name and final result
    frappe.log_error(
        f"[create_and_submit_invoice] SUBMITTED: "
        f"invoice_name={doc.name}, "
        f"status={doc.docstatus}, "
        f"grand_total={doc.grand_total}",
        "POS Invoice Submitted"
    )

    return doc.as_dict()
```

---

#### 4B: Frontend Logging (Invoice.js)

**Add console.log in key functions**

**4B.1: In calculateTotalsLocally function (line ~1400):**

```javascript
calculateTotalsLocally(doc) {
  console.log('[Invoice.calculateTotalsLocally] START:', {
    apply_discount_on: doc.apply_discount_on,
    additional_discount_percentage: doc.additional_discount_percentage,
    net_total: doc.net_total,
    total_taxes_and_charges: doc.total_taxes_and_charges,
    grand_total: doc.grand_total,
  });

  // ... existing calculation code ...

  // After applying discount
  this.applyDiscountAmount(doc);

  console.log('[Invoice.calculateTotalsLocally] AFTER DISCOUNT:', {
    discount_amount: doc.discount_amount,
    net_total: doc.net_total,
    total_taxes_and_charges: doc.total_taxes_and_charges,
    grand_total: doc.grand_total,
  });

  // After tax recalculation (Task 2)
  // ... tax recalculation code ...

  console.log('[Invoice.calculateTotalsLocally] FINAL:', {
    net_total: doc.net_total,
    total_taxes_and_charges: doc.total_taxes_and_charges,
    grand_total: doc.grand_total,
  });
}
```

**4B.2: In setDiscountAmount function (line ~1494):**

```javascript
setDiscountAmount(doc) {
  console.log('[Invoice.setDiscountAmount] INPUT:', {
    apply_discount_on: doc.apply_discount_on,
    additional_discount_percentage: doc.additional_discount_percentage,
    net_total: doc.net_total,
    grand_total: doc.grand_total,
  });

  // ... existing code ...

  console.log('[Invoice.setDiscountAmount] OUTPUT:', {
    discount_amount: doc.discount_amount,
    base_discount_amount: doc.base_discount_amount,
  });
}
```

**4B.3: In get_invoice_doc function (line ~720):**

```javascript
get_invoice_doc(reason = 'auto') {
  // ... existing code ...

  // After setting apply_discount_on
  doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';

  console.log('[Invoice.get_invoice_doc] apply_discount_on SET:', {
    from_pos_profile: this.pos_profile?.apply_discount_on,
    final_value: doc.apply_discount_on,
    pos_profile_name: this.pos_profile?.name,
  });

  // ... existing code ...
}
```

---

**Acceptance Criteria:**

- ✅ Backend logs show function name in frappe.log_error
- ✅ Backend logs show important discount values only
- ✅ Frontend logs show function/file name in console.log
- ✅ Frontend logs show important calculation results
- ✅ Logs help debug discount calculation flow

---

## Task Summary

| #   | Task                                    | Priority   | Time | Status |
| --- | --------------------------------------- | ---------- | ---- | ------ |
| 1   | Read apply_discount_on from POS Profile | 🔥 HIGHEST | 1h   | ⏳     |
| 2   | Fix Tax Recalculation                   | ⚠️ HIGH    | 2-3h | ⏳     |
| 3   | Allow Multiple Offers                   | ✓ MEDIUM   | 4-5h | ⏳     |
| 4   | Add Logging for Debugging               | ○ LOW      | 1h   | ⏳     |

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
