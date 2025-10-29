# Discount Logic Implementation

**💰 Budget**: 30$

**👨‍💻 Developer**: 🔄 In Pending

**📊 Status**: 🔄 In Pending

**🔧 Feature**: Discount Logic Compatibility with ERPNext

---

## Overview

Analysis of discount logic compatibility between ERPNext standard and POS Awesome implementation.

---

## Item Discount Logic

### validate_logic:

- Formula: `discount_amount = (price_list_rate × discount_percentage) / 100`
- Formula: `rate = price_list_rate - discount_amount`
- Formula: `amount = rate × qty`

### execute_logic:

**ERPNext:** Handled in SellingController base class during validation
**POS Awesome:** Handled in `Invoice.js` - `calculateItemAmount()` (line 488-517)

```488:517:posawesome/public/js/posapp/components/pos/Invoice.js
calculateItemAmount(item) {
  const qty = flt(item.qty) || 0;
  const priceListRate = flt(item.price_list_rate) || 0;

  // ERPNext standard: discount_percentage → discount_amount → rate
  if (priceListRate > 0) {
    const discountPercent = flt(item.discount_percentage) || 0;

    if (discountPercent > 0) {
      // Calculate discount_amount from percentage
      item.discount_amount = flt(
        (priceListRate * discountPercent) / 100,
        this.getPrecision('discount_amount', item),
      );

      // Calculate rate from price_list_rate - discount_amount
      item.rate = flt(priceListRate - item.discount_amount, this.getPrecision('rate', item));
    } else {
      // No discount
      item.discount_amount = 0;
      item.rate = priceListRate;
    }
  } else {
    item.rate = priceListRate;
    item.discount_amount = 0;
  }

  // Calculate final amount
  return flt(item.rate * qty, this.getPrecision('amount', item));
}
```

**Compatible Completion Percentage:** ✅ **100%**

---

## Invoice Discount Logic

### validate_logic:

- Read `apply_discount_on` from **POS Profile** (NOT hardcoded)
- If `apply_discount_on = 'Net Total'`: Apply discount before taxes
- If `apply_discount_on = 'Grand Total'`: Apply discount after taxes
- Recalculate taxes if discount applied to net_total

### execute_logic:

**ERPNext:** Server-side calculation in `set_missing_values()` and `validate()`
**POS Awesome:** Client-side calculation in `calculateTotalsLocally()` (line 1388-1491)

```1494:1550:posawesome/public/js/posapp/components/pos/Invoice.js
setDiscountAmount(doc) {
  // Only calculate if additional_discount_percentage is set
  if (!doc.additional_discount_percentage || doc.additional_discount_percentage <= 0) {
    doc.discount_amount = 0;
    doc.base_discount_amount = 0;
    return;
  }

  const applyDiscountOn = doc.apply_discount_on || 'Net Total';
  let discountBase = 0;

  // Determine base for discount calculation
  if (applyDiscountOn === 'Grand Total') {
    discountBase = flt(doc.grand_total) || 0;
  } else if (applyDiscountOn === 'Net Total') {
    discountBase = flt(doc.net_total) || 0;
  } else {
    discountBase = flt(doc.total) || 0; // Items Total
  }

  doc.discount_amount = flt(
    (discountBase * doc.additional_discount_percentage) / 100,
    this.getPrecision('discount_amount'),
  );

  doc.base_discount_amount = flt(
    doc.discount_amount * (doc.conversion_rate || 1),
    this.getPrecision('base_discount_amount'),
  );
}

applyDiscountAmount(doc) {
  if (!doc.discount_amount || doc.discount_amount <= 0) return;

  const applyDiscountOn = doc.apply_discount_on || 'Net Total';

  // For POS: Simple subtraction from grand_total
  // (ERPNext distributes across items, but for POS we keep it simple)
  if (applyDiscountOn === 'Grand Total') {
    doc.grand_total = flt(
      doc.grand_total - doc.discount_amount,
      this.getPrecision('grand_total'),
    );
  } else if (applyDiscountOn === 'Net Total') {
    // Apply before final grand_total calculation
    doc.net_total = flt(doc.net_total - doc.discount_amount, this.getPrecision('net_total'));
    // Recalculate grand_total with tax
    if (doc.total_taxes_and_charges > 0) {
      doc.grand_total = flt(
        doc.net_total + doc.total_taxes_and_charges,
        this.getPrecision('grand_total'),
      );
    } else {
      doc.grand_total = doc.net_total;
    }
  }
}
```

**Critical Issue Found:**

- In `Invoice.js` line 75: `apply_discount_on: 'Net Total'` is hardcoded
- Should read from `pos_profile.apply_discount_on`

**Required Fix:**

```javascript
// In get_invoice_doc() (around line 720-725)
doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';
```

**Compatible Completion Percentage:** ⚠️ **85%** (needs fix for apply_discount_on from POS Profile)

---

## Offer System (POS Awesome Enhancement)

### validate_logic:

**Transaction-Level Offers:**

- Offer type: `grand_total`, `customer`, `customer_group`
- Set `additional_discount_percentage` on invoice
- Can have ONE transaction-level offer active

**Item-Level Offers:**

- Offer type: `item_code`, `item_group`, `brand`
- Set `discount_percentage` on matching items
- Can have multiple item-level offers

### execute_logic:

**Backend:** `pos_offer.py` - Functions: `apply_offer_by_type()`, `apply_discount_percentage_on_grand_total()`, etc.

**Frontend:** `Invoice.js` - Functions: `calculateAndApplyOffers()` (line 1897-2054)

```1897:2054:posawesome/public/js/posapp/components/pos/Invoice.js
calculateAndApplyOffers() {
  // Exit early if offers disabled
  if (!this.pos_profile?.posa_auto_fetch_offers) {
    return;
  }

  // Exit if no offers cached
  if (!this._sessionOffers || this._sessionOffers.length === 0) {
    return;
  }

  // Exit if no items
  if (!this.items || this.items.length === 0) {
    this.clearOfferDiscounts();
    return;
  }

  // Calculate totals
  const totalQty = this.items.reduce((sum, item) => sum + flt(item.qty || 0), 0);
  const totalAmount = this.items.reduce(
    (sum, item) => sum + flt(item.qty || 0) * flt(item.rate || 0),
    0,
  );

  // Filter applicable offers
  const applicableOffers = this._sessionOffers.filter((offer) => {
    // Check date validity
    const today = frappe.datetime.nowdate();
    if (offer.valid_from && today < offer.valid_from) return false;
    if (offer.valid_upto && today > offer.valid_upto) return false;

    // Check qty thresholds
    if (offer.min_qty && totalQty < flt(offer.min_qty)) return false;
    if (offer.max_qty && totalQty > flt(offer.max_qty)) return false;

    // Check amount thresholds
    if (offer.min_amt && totalAmount < flt(offer.min_amt)) return false;
    if (offer.max_amt && totalAmount > flt(offer.max_amt)) return false;

    // Check customer match
    if (offer.offer_type === 'customer' && offer.customer !== this.customer) {
      return false;
    }

    // Check customer group match
    if (offer.offer_type === 'customer_group') {
      if (
        !this.customer_info?.customer_group ||
        this.customer_info.customer_group !== offer.customer_group
      ) {
        return false;
      }
    }

    // Check item-specific applicability
    if (offer.offer_type === 'item_code') {
      return this.items.some((item) => item.item_code === offer.item_code);
    }

    if (offer.offer_type === 'item_group') {
      return this.items.some((item) => item.item_group === offer.item_group);
    }

    if (offer.offer_type === 'brand') {
      return this.items.some((item) => item.brand === offer.brand);
    }

    return true; // General offer or grand_total offer
  });

  // Apply offers
  this.applyOffersToInvoice(applicableOffers);
}
```

**Current Issue:**
ERPNext allows item discount + invoice discount together
POS Awesome currently enforces: Transaction-level OR Item-level (not both)

**Required Fix:** Allow both types simultaneously

**Compatible Completion Percentage:** ⚠️ **70%** (needs allow multiple offer types)

---

## Tax Calculation with Discount

### validate_logic:

- If `apply_discount_on = 'Net Total'`: Tax must be recalculated after discount
- Tax percentage applies to discounted net_total (not original net_total)

### execute_logic:

**ERPNext:** Handles automatically in sales_invoice.py validation
**POS Awesome:** Partially handled in `calculateTotalsLocally()`

```1388:1491:posawesome/public/js/posapp/components/pos/Invoice.js
calculateTotalsLocally(doc) {
  if (!doc || !doc.items) return;

  // Step 1: Calculate item totals with item-level discounts
  let total = 0;
  let total_qty = 0;
  let item_discount_total = 0;

  doc.items.forEach((item) => {
    const qty = flt(item.qty) || 0;
    const priceListRate = flt(item.price_list_rate) || 0;
    const discountPercent = flt(item.discount_percentage) || 0;

    // Calculate item discount (ERPNext logic)
    if (discountPercent > 0 && priceListRate > 0) {
      item.discount_amount = flt(
        (priceListRate * discountPercent) / 100,
        this.getPrecision('discount_amount', item),
      );
      item.rate = flt(priceListRate - item.discount_amount, this.getPrecision('rate', item));
    } else {
      item.rate = priceListRate;
      item.discount_amount = 0;
    }

    // Calculate amount
    item.amount = flt(item.rate * qty, this.getPrecision('amount', item));

    total += item.amount;
    total_qty += qty;
    item_discount_total += item.discount_amount * Math.abs(qty);
  });

  doc.total = flt(total, this.getPrecision('total'));
  doc.total_qty = total_qty;
  doc.posa_item_discount_total = flt(
    item_discount_total,
    this.getPrecision('posa_item_discount_total'),
  );

  // Step 2: Set net_total (before tax, after item discounts)
  doc.net_total = doc.total;

  // Step 3: Calculate taxes (ERPNext approach)
  const applyTax = this.pos_profile?.posa_apply_tax;
  const taxType = this.pos_profile?.posa_tax_type;
  const taxPercent = flt(this.pos_profile?.posa_tax_percent) || 0;
  const normalizedTaxType = taxType?.replace(/^Tax\s*/i, '').trim();

  if (applyTax && normalizedTaxType && taxPercent > 0) {
    if (normalizedTaxType === 'Inclusive') {
      // Tax included: extract tax from net_total
      doc.grand_total = doc.net_total;
      doc.net_total = flt(
        doc.net_total / (1 + taxPercent / 100),
        this.getPrecision('net_total'),
      );
      doc.total_taxes_and_charges = flt(
        doc.grand_total - doc.net_total,
        this.getPrecision('total_taxes_and_charges'),
      );
    } else if (normalizedTaxType === 'Exclusive') {
      // Tax added: add tax to net_total
      doc.total_taxes_and_charges = flt(
        doc.net_total * (taxPercent / 100),
        this.getPrecision('total_taxes_and_charges'),
      );
      doc.grand_total = flt(
        doc.net_total + doc.total_taxes_and_charges,
        this.getPrecision('grand_total'),
      );
    }
  } else {
    doc.total_taxes_and_charges = 0;
    doc.grand_total = doc.net_total;
  }

  // Step 4: Apply invoice-level discount (if set)
  // NOTE: In POSAwesome, this is typically from offers, not manual entry
  this.setDiscountAmount(doc);
  this.applyDiscountAmount(doc);

  // Step 5: Rounding - Use ERPNext standard rounding logic
  if (typeof round_based_on_smallest_currency_fraction === 'function') {
    doc.rounded_total = round_based_on_smallest_currency_fraction(
      doc.grand_total,
      this.pos_profile?.currency || 'USD',
      this.getPrecision('rounded_total'),
    );
  } else {
    // Fallback to simple rounding
    doc.rounded_total = Math.round(doc.grand_total * 2) / 2;
  }

  // Calculate rounding adjustment
  doc.rounding_adjustment = flt(
    doc.rounded_total - doc.grand_total,
    this.getPrecision('rounding_adjustment'),
  );

  // Final precision formatting
  doc.grand_total = flt(doc.grand_total, this.getPrecision('grand_total'));
  doc.net_total = flt(doc.net_total, this.getPrecision('net_total'));
}
```

**ISSUE:** Tax calculated before discount, missing recalculation after discount

**Required Fix:**
Add Step 6 to recalculate tax if discount applied to net_total

**Compatible Completion Percentage:** ⚠️ **80%** (needs tax recalculation after discount)

---

## Backend Integration

### validate_logic:

- Backend receives complete invoice document with all calculations
- Must use ERPNext native methods: `set_missing_values()`, `validate()`, `insert()`, `submit()`
- Should not override ERPNext discount calculations

### execute_logic:

**Current implementation in `sales_invoice.py` (line 109-191):**

```109:191:posawesome/posawesome/api/sales_invoice.py
@frappe.whitelist()
def create_and_submit_invoice(invoice_doc):
    """
    Create and submit Sales Invoice using ERPNext native workflow 100%.

    This follows the exact same flow as ERPNext's sales_invoice.py:
    1. frappe.get_doc() - Create document from dict
    2. doc.set_missing_values() - Fill missing values (native)
    3. doc.validate() - Full validation (native)
    4. doc.insert() - Save draft (native)
    5. doc.submit() - Submit document (native)

    No custom logic - only ERPNext native methods!
    """
    try:
        # Parse invoice_doc if it's a string
        if isinstance(invoice_doc, str):
            invoice_doc = json.loads(invoice_doc)

        # Create new document from dict - using ERPNext native method
        doc = frappe.get_doc(invoice_doc)

        # Set POS flags
        doc.is_pos = 1
        doc.update_stock = 1
        doc.flags.from_pos_page = True

        # Step 1: Use ERPNext native set_missing_values()
        doc.set_missing_values()

        # Step 2: Use ERPNext native validate()
        doc.validate()

        # Step 3: Use ERPNext native insert()
        doc.insert()
        invoice_name = doc.name

        # Step 4: Use ERPNext native submit()
        doc.submit()

        # Return the submitted document
        return doc.as_dict()

    except Exception as e:
        frappe.log_error(str(e), "POS Invoice Error")
        frappe.throw(_("Error creating invoice: {0}").format(str(e)))
```

**Status:** ✅ **95%** (needs logging for apply_discount_on verification)

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

### 1. CRITICAL: Use apply_discount_on from POS Profile (1 hour)

**File:** `Invoice.js` line 75 and 702-750
**Change:** Read from `pos_profile.apply_discount_on` instead of hardcoded value

```javascript
// Remove hardcoded value at line 75
// Change from: apply_discount_on: 'Net Total'
// Change to: apply_discount_on: null

// In get_invoice_doc() around line 720-725
doc.apply_discount_on = this.pos_profile?.apply_discount_on || 'Net Total';
```

### 2. HIGH: Fix tax recalculation (2-3 hours)

**File:** `Invoice.js` line 1388-1491
**Function:** `calculateTotalsLocally()`
**Add:** Step 6 to recalculate tax after discount if apply_discount_on = 'Net Total'

### 3. MEDIUM: Allow multiple offers (4-5 hours)

**File:** `Invoice.js` line 1897-2054
**Function:** `calculateAndApplyOffers()`
**Change:** Remove limitation, allow Transaction-level + Item-level offers together

### 4. LOW: Backend logging (1 hour)

**File:** `sales_invoice.py`
**Add:** Logging for apply_discount_on verification

**Total Estimated Time:** 8-10 hours

---

## Files to Modify

1. **Invoice.js** (5 locations):
   - Line 75: Remove hardcoded apply_discount_on
   - Line 720-750: Read from pos_profile in get_invoice_doc()
   - Line 1388-1491: Add tax recalculation in calculateTotalsLocally()
   - Line 1897-2054: Allow multiple offers in calculateAndApplyOffers()

2. **sales_invoice.py**:
   - Line 109-191: Add logging for verification

**Total Changes:** 5 modifications in 2 files
