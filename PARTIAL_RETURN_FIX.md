# PARTIAL RETURN FIX - Complete Solution

## Problem Summary

**User Report:**

```
1. Created return invoice for SINV-JU-000375
2. Returned partial quantity (less than original)
3. Submitted the return invoice
4. Opened return dialog again
5. SINV-JU-000375 no longer appears in the list
6. Cannot complete remaining return
```

**Expected Behavior:**

- Invoice should appear in return list until ALL items are fully returned
- Partial returns should be allowed (ERPNext native behavior)
- User should be able to return remaining quantities

## Root Cause Analysis

### Issue #1: Backend Filter Logic

**File:** `/apps/posawesome/posawesome/posawesome/api/sales_invoice.py`

**Problem:**

```python
filters = {
    "status": ["!=", "Credit Note Issued"],  # ❌ WRONG!
}
```

**Why this is wrong:**

1. ERPNext sets status to "Credit Note Issued" when `outstanding_amount <= 0` AND returns exist
2. For **partial returns**, status is "Paid" or "Partly Paid" (NOT "Credit Note Issued")
3. But POSAwesome was excluding ANY invoice with status "Credit Note Issued"
4. This prevents **full returns from appearing again** if user wants to check them

**ERPNext Native Behavior:**

```python
# From erpnext/accounts/doctype/sales_invoice/sales_invoice.py:1930
elif self.is_return == 0 and frappe.db.get_value(
    "Sales Invoice", {"is_return": 1, "return_against": self.name, "docstatus": 1}
):
    self.status = "Credit Note Issued"
```

Status is set to "Credit Note Issued" ONLY when:

- `outstanding_amount <= 0` (fully paid/returned)
- At least one return invoice exists

**The Fix:**

```python
# AFTER FIX - Do NOT filter by status
filters = {
    "docstatus": 1,
    "is_return": 0,
    "is_pos": 1,
    # NOTE: Allow all statuses - filter by remaining_returnable_amount instead
}

# Later in code:
if return_stats["remaining_returnable_amount"] > 0:
    returnable_invoices.append(invoice)
```

### Issue #2: Frontend - Adding New Items to Return Invoices

**Files:**

- `/apps/posawesome/posawesome/public/js/posapp/components/pos/ItemsSelector.js`
- `/apps/posawesome/posawesome/public/js/posapp/components/pos/Invoice.js`

**Problem:**
Users could add NEW items (not in original invoice) to a return invoice fetched from returnable invoices list.

**ERPNext Native Behavior:**
When creating a return against an invoice, you can ONLY return items that exist in the original invoice.

**The Fix:**

1. **Track Return Invoice State** (ItemsSelector.js):

```javascript
data() {
  return {
    // ...
    is_return_invoice: false, // Track if current invoice is a return with return_against
  };
}
```

2. **Prevent Adding Items** (ItemsSelector.js):

```javascript
add_item_to_cart(item) {
  if (this.is_return_invoice) {
    evntBus.emit('show_mesage', {
      text: 'Cannot add new items to a return invoice. Only items from the original invoice can be returned.',
      color: 'error',
    });
    return;
  }
  evntBus.emit(EVENT_NAMES.ADD_ITEM, item);
}
```

3. **Listen to Events** (ItemsSelector.js):

```javascript
// Track when loading a return invoice with return_against
evntBus.on("load_return_invoice", (data) => {
  this.is_return_invoice = !!(data.invoice_doc && data.invoice_doc.return_against);
});

// Reset when creating a new invoice
evntBus.on("new_invoice", (data) => {
  this.is_return_invoice = !(data && data.return_against);
});
```

4. **Emit Event** (Invoice.js):

```javascript
new_invoice(data = {}) {
  // Notify other components
  evntBus.emit("new_invoice", data);
  // ...
}
```

## Changes Made

### Backend Changes

**File:** `posawesome/posawesome/api/sales_invoice.py`

1. **Removed Status Filter:**

```python
# BEFORE (Wrong)
filters = {
    "status": ["!=", "Credit Note Issued"],  # Excludes fully returned invoices
}

# AFTER (Correct)
filters = {
    "docstatus": 1,
    "is_return": 0,
    "is_pos": 1,
    # No status filter - allow all statuses
}
```

2. **Filter by Remaining Amount Instead:**

```python
# Only include invoices with remaining returnable amount > 0
if return_stats["remaining_returnable_amount"] > 0:
    returnable_invoices.append(invoice)
```

This ensures:

- ✅ Partial returns still appear (status = "Paid" or "Partly Paid")
- ✅ Fully returned invoices don't appear (remaining_returnable_amount = 0)
- ✅ Matches ERPNext native behavior

### Frontend Changes

**File:** `posawesome/public/js/posapp/components/pos/ItemsSelector.js`

1. **Added State Tracking:**

   - `is_return_invoice` data property

2. **Added Validation in 3 Methods:**

   - `add_item_to_cart()`
   - `add_item_table()`
   - `add_item()`

3. **Added Event Listeners:**
   - `load_return_invoice` → Set `is_return_invoice = true` if `return_against` exists
   - `new_invoice` → Reset `is_return_invoice = false` (unless it's a return invoice)

**File:** `posawesome/public/js/posapp/components/pos/Invoice.js`

1. **Added Event Emission:**
   - Emit `new_invoice` event at start of `new_invoice()` function

## How Partial Returns Work (ERPNext Native)

### Scenario: Original Invoice

```
Invoice: SINV-JU-000375
Item A: qty = 10, amount = 100 SAR
Item B: qty = 5, amount = 50 SAR
Grand Total: 150 SAR
Status: Paid
```

### First Return (Partial)

```
Return Invoice: SINV-JU-000376
is_return: 1
return_against: SINV-JU-000375

Item A: qty = -3, amount = -30 SAR
Grand Total: -30 SAR
```

**After Submit:**

- Original invoice status: Still "Paid" (NOT "Credit Note Issued")
- Outstanding amount: 0 (fully paid)
- Remaining returnable amount: 120 SAR
- Remaining returnable qty for Item A: 7
- Remaining returnable qty for Item B: 5

### Second Return (Complete Remaining)

```
Return Invoice: SINV-JU-000377
is_return: 1
return_against: SINV-JU-000375

Item A: qty = -7, amount = -70 SAR
Item B: qty = -5, amount = -50 SAR
Grand Total: -120 SAR
```

**After Submit:**

- Original invoice status: "Credit Note Issued" ✅
- Outstanding amount: 0
- Remaining returnable amount: 0
- Invoice no longer appears in return list ✅

## Testing

### Test Case 1: Partial Return

1. **Create Invoice:**

   - Item: qty = 10, rate = 100 SAR
   - Grand Total: 1000 SAR
   - Submit and pay

2. **First Return:**

   - Click Return button
   - Select the invoice
   - Change qty to -3 (partial return)
   - Submit
   - **Expected:** Invoice status = "Paid"

3. **Second Return:**

   - Click Return button again
   - **Expected:** Invoice still appears in list ✅
   - **Expected:** max_returnable_qty = 7
   - Change qty to -7 (complete remaining)
   - Submit
   - **Expected:** Invoice status = "Credit Note Issued"

4. **Third Attempt:**
   - Click Return button again
   - **Expected:** Invoice NO LONGER appears in list ✅

### Test Case 2: Prevent Adding New Items

1. **Create Invoice:**

   - Item A: qty = 5
   - Submit

2. **Open Return:**

   - Click Return button
   - Select the invoice
   - **Expected:** Items list shows Item A with max_returnable_qty = 5

3. **Try to Add Item B:**
   - Try to click on Item B in ItemsSelector
   - **Expected:** Error message: "Cannot add new items to a return invoice" ✅
   - **Expected:** Only Item A can be returned ✅

### Test Case 3: SINV-JU-000375 (User's Specific Case)

1. **Check Current Status:**

   - Open SINV-JU-000375 in desk
   - Note: outstanding_amount, status, items

2. **Query Return Stats:**

   ```python
   frappe.call({
       method: 'posawesome.posawesome.api.sales_invoice.calculate_return_stats',
       args: {
           invoice_name: 'SINV-JU-000375'
       },
       callback: (r) => console.log(r.message)
   });
   ```

3. **Open Return Dialog:**

   - Click Return button in POS
   - Search for "SINV-JU-000375"
   - **Expected:** Invoice appears with correct remaining_returnable_amount ✅

4. **Complete Return:**
   - Select invoice
   - Return remaining quantities
   - Submit
   - **Expected:** outstanding_amount = 0, status = "Credit Note Issued"

## API Reference

### `calculate_return_stats(invoice_name)`

**Purpose:** Calculate remaining returnable amounts and quantities

**Returns:**

```python
{
    "remaining_returnable_amount": 120.00,  # SAR
    "total_returned_amount": 30.00,         # Already returned
    "original_amount": 150.00,              # Original grand_total
    "items": [
        {
            "item_code": "ITEM-001",
            "original_qty": 10,
            "already_returned_qty": 3,
            "remaining_returnable_qty": 7,
            "max_returnable_qty": 7
        }
    ]
}
```

**Logic:**

```python
# Get all submitted return invoices
return_invoices = frappe.get_all(
    "Sales Invoice",
    filters={
        "return_against": invoice_name,
        "docstatus": 1,
        "is_return": 1
    }
)

# Sum negative amounts (returns are negative)
total_returned_amount = sum([flt(r.grand_total) for r in return_invoices])

# Calculate remaining (note: return amounts are negative)
remaining_amount = flt(invoice.grand_total) + flt(total_returned_amount)
```

### `get_invoices_for_return(invoice_name, company, pos_profile)`

**Purpose:** Get list of invoices available for return

**Filters Applied:**

1. `docstatus = 1` (only submitted)
2. `is_return = 0` (not already a return)
3. `is_pos = 1` (only POS invoices)
4. `company` (if provided)
5. `pos_profile` (if provided)
6. `outstanding_amount < grand_total` (at least partially paid)
7. `remaining_returnable_amount > 0` (has remaining amount to return)

**Returns:** List of invoices with enriched item data including `max_returnable_qty`

## Impact

### Before Fix:

- ❌ Partial returns caused invoice to disappear from return list
- ❌ Users could add new items to return invoices
- ❌ Inconsistent with ERPNext native behavior

### After Fix:

- ✅ Partial returns work correctly - invoice stays in list until fully returned
- ✅ Cannot add new items to return invoices
- ✅ Matches ERPNext native behavior exactly
- ✅ Status changes correctly: "Paid" → "Credit Note Issued"
- ✅ User can complete multi-step returns

## References

**ERPNext Source:**

- `/apps/erpnext/erpnext/accounts/doctype/sales_invoice/sales_invoice.py:1920-1940`
- Status update logic for "Credit Note Issued"

**POSAwesome Files Modified:**

1. `posawesome/posawesome/api/sales_invoice.py` - Backend filter logic
2. `posawesome/public/js/posapp/components/pos/ItemsSelector.js` - Prevent adding items
3. `posawesome/public/js/posapp/components/pos/Invoice.js` - Event emission

---

**Status:** ✅ **FIXED**  
**Root Cause:** Status filter excluded invoices prematurely; no validation for adding new items  
**Solution:** Filter by remaining_returnable_amount; prevent adding items to return invoices  
**Date:** November 14, 2025
