# Rounded Total Calculation Issue - Root Cause Analysis

## Problem Statement

**Invoice Data:**

```
grand_total = 18.48
rounded_total = 18.48
outstanding_amount = 0.03
paid_amount = 18.45
```

**Symptoms:**

- Payment dialog shows **18.45** when clicking payment method button
- Invoice cart shows **18.48** (correct)
- `list_price_total` displays **18.45** (which is `invoice_doc.total` before tax)
- Outstanding amount = **0.03** (difference between rounded_total and paid_amount)

## Root Cause Analysis

### ERPNext Native Calculation Flow

**File:** `/home/frappe/frappe-bench/apps/erpnext/erpnext/controllers/taxes_and_totals.py`

```python
class calculate_taxes_and_totals:
    def calculate(self):
        self._calculate()
        if self.doc.meta.get_field("discount_amount"):
            self.set_discount_amount()
            self.apply_discount_amount()

        # ... other calculations

    def _calculate(self):
        self.calculate_item_values()      # Step 1: Calculate item amounts
        self.calculate_net_total()         # Step 2: Sum item amounts = net_total
        self.calculate_taxes()             # Step 3: Calculate taxes
        self.calculate_totals()            # Step 4: grand_total = net_total + taxes
        self._cleanup()

    def calculate_totals(self):
        # Calculate grand_total
        if self.doc.get("taxes"):
            self.doc.grand_total = flt(self.doc.get("taxes")[-1].total)
        else:
            self.doc.grand_total = flt(self.doc.net_total)

        # CRITICAL: Call set_rounded_total() AFTER grand_total is calculated
        self.set_rounded_total()

    def set_rounded_total(self):
        if self.doc.meta.get_field("rounded_total"):
            if self.doc.is_rounded_total_disabled():
                self.doc.rounded_total = 0
                return

            # Rounding is based on GRAND_TOTAL (after tax), not total (before tax)
            self.doc.rounded_total = round_based_on_smallest_currency_fraction(
                self.doc.grand_total,  # <-- Uses grand_total, not total!
                self.doc.currency,
                self.doc.precision("rounded_total")
            )

            # Calculate rounding adjustment
            self.doc.rounding_adjustment = flt(
                self.doc.rounded_total - self.doc.grand_total,
                self.doc.precision("rounding_adjustment")
            )
```

**ERPNext Calculation Order:**

1. `total` = sum of all item amounts (before tax) = **18.45**
2. `net_total` = total after item-level discounts = **18.45**
3. `grand_total` = net_total + taxes = **18.48**
4. `rounded_total` = round(grand_total) = **18.48**
5. `rounding_adjustment` = rounded_total - grand_total = **0.00**

### POSAwesome Current Implementation

**File:** `/home/frappe/frappe-bench/apps/posawesome/posawesome/public/js/posapp/components/pos/Invoice.js`

```javascript
calculateTotalsLocally(doc) {
    // Step 1: Calculate item totals
    let total = 0;
    doc.items.forEach((item) => {
        item.amount = flt(item.rate * qty);
        total += item.amount;
    });

    doc.total = flt(total);               // 18.45
    doc.net_total = doc.total;            // 18.45

    // Step 2: Calculate taxes
    if (applyTax && taxPercent > 0) {
        if (normalizedTaxType === "Exclusive") {
            doc.total_taxes_and_charges = flt(doc.net_total * (taxPercent / 100));
            doc.grand_total = flt(doc.net_total + doc.total_taxes_and_charges);  // 18.48
        }
    } else {
        doc.grand_total = doc.net_total;
    }

    // Step 3: Apply invoice-level discount
    this.setDiscountAmount(doc);
    this.applyDiscountAmount(doc);

    // Step 4: Recalculate tax if discount applied
    if (applyTax && doc.discount_amount > 0) {
        // Tax recalculation...
        doc.grand_total = flt(...);
    }

    // Step 5: Rounding - CORRECT!
    doc.rounded_total = round_based_on_smallest_currency_fraction(
        doc.grand_total,  // Uses grand_total ✅
        this.pos_profile?.currency || "USD",
        this.getPrecision("rounded_total")
    );

    doc.rounding_adjustment = flt(doc.rounded_total - doc.grand_total);
}
```

**POSAwesome calculation is CORRECT!** The `rounded_total` is properly calculated from `grand_total`.

## The Real Problem

The issue is **NOT** in the calculation logic. The problem is in **WHEN** the calculation happens and **WHAT VALUE** is being passed to the payment component.

### Timing Issue Analysis

**File:** `Invoice.js` - `show_payment()` function

```javascript
async show_payment() {
    // Force fresh calculation
    this.updateInvoiceDocLocally();  // ← Calculates rounded_total correctly

    const invoice_doc = await this.process_invoice();  // ← Also calculates it

    // Send to payment component
    evntBus.emit("send_invoice_doc_payment", invoice_doc);  // ← Should have rounded_total = 18.48
}
```

**File:** `Payments.js` - Event handler

```javascript
evntBus.on(EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT, (invoice_doc) => {
  this.invoice_doc = invoice_doc; // ← Receives invoice_doc

  // Set default payment amount
  if (default_payment && !invoice_doc.is_return) {
    const total = this.flt(invoice_doc.rounded_total) || this.flt(invoice_doc.grand_total);
    default_payment.amount = this.flt(total, this.currency_precision);
  }
});
```

**File:** `Payments.js` - `set_full_amount()` function

```javascript
set_full_amount(idx) {
    const total = flt(this.invoice_doc.rounded_total) || flt(this.invoice_doc.grand_total);
    //              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //              This should be 18.48, but appears to be 18.45!

    const payment = this.invoice_doc.payments.find((p) => p.idx == idx);
    if (payment) {
        const amount = this.flt(total, this.currency_precision);
        payment.amount = amount;  // Sets to 18.45 instead of 18.48
    }
}
```

## Hypothesis: The Bug Source

**Possible Issue #1: Vue Reactivity**

```javascript
// In Invoice.js
this.invoice_doc.rounded_total = doc.rounded_total; // Sets to 18.48

// But invoice_doc might be a Vue reactive object
// When emitted via evntBus, it might not preserve the updated value
evntBus.emit("send_invoice_doc_payment", invoice_doc);
```

**Possible Issue #2: Object Reference**

```javascript
// invoice_doc might be referencing an OLD version where:
invoice_doc.total = 18.45;
invoice_doc.rounded_total = 18.45; // OLD value from before tax was calculated

// Even though updateInvoiceDocLocally() updated it to 18.48,
// the payment component might be receiving a stale reference
```

**Possible Issue #3: Calculation Not Running**

```javascript
// calculateTotalsLocally() might not be running when expected
// OR it's running but rounded_total is being overwritten later
```

## Debug Strategy

The console logging we added will reveal:

```javascript
// In Invoice.js show_payment()
console.log("show_payment - invoice totals:", {
  total: invoice_doc.total, // Should be 18.45
  net_total: invoice_doc.net_total, // Should be 18.45
  grand_total: invoice_doc.grand_total, // Should be 18.48
  rounded_total: invoice_doc.rounded_total, // Should be 18.48 ← KEY VALUE
});

// In Payments.js event handler
console.log("SEND_INVOICE_DOC_PAYMENT received:", {
  rounded_total: invoice_doc.rounded_total, // Is this 18.48 or 18.45? ← CRITICAL
});

// In Payments.js set_full_amount()
console.log("set_full_amount called:", {
  rounded_total: this.invoice_doc.rounded_total, // What value is this? ← ANSWER
  total: total, // What gets used for payment amount?
});
```

## Expected Console Output

**If calculation is correct:**

```
show_payment - invoice totals: {total: 18.45, grand_total: 18.48, rounded_total: 18.48}
SEND_INVOICE_DOC_PAYMENT received: {rounded_total: 18.48}
set_full_amount called: {rounded_total: 18.48, total: 18.48}
Setting payment amount to: 18.48  ✅
```

**If there's a bug:**

```
show_payment - invoice totals: {total: 18.45, grand_total: 18.48, rounded_total: 18.45}  ❌
SEND_INVOICE_DOC_PAYMENT received: {rounded_total: 18.45}  ❌
set_full_amount called: {rounded_total: 18.45, total: 18.45}  ❌
Setting payment amount to: 18.45  ❌
```

## Potential Fixes

### Fix #1: Ensure Fresh Calculation

```javascript
async show_payment() {
    // Build fresh doc with all fields
    const doc = this.get_invoice_doc("payment");

    // Calculate totals (this sets rounded_total from grand_total)
    this.calculateTotalsLocally(doc);

    // CRITICAL: Use doc directly, not this.invoice_doc
    evntBus.emit("send_invoice_doc_payment", doc);  // ← Use fresh doc
}
```

### Fix #2: Clone Object to Break Reference

```javascript
async show_payment() {
    const invoice_doc = await this.process_invoice();

    // Deep clone to ensure no stale references
    const freshDoc = JSON.parse(JSON.stringify(invoice_doc));

    evntBus.emit("send_invoice_doc_payment", freshDoc);
}
```

### Fix #3: Force Recalculation in Payment Component

```javascript
evntBus.on(EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT, (invoice_doc) => {
  this.invoice_doc = invoice_doc;

  // FORCE recalculation of rounded_total if missing or wrong
  if (!invoice_doc.rounded_total || invoice_doc.rounded_total === invoice_doc.total) {
    // Recalculate rounded_total from grand_total
    invoice_doc.rounded_total = flt(invoice_doc.grand_total);
  }
});
```

## Next Steps

1. ✅ **Added debug logging** to trace exact values
2. ⏳ **User testing** to see console output
3. ⏳ **Identify** where rounded_total value gets lost/wrong
4. ⏳ **Apply fix** based on debug findings

---

**Status:** Awaiting user testing with debug console logs enabled  
**Expected Resolution:** Once we see the console logs, we'll know exactly where the value is wrong
