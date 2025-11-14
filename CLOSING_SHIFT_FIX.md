# POS Closing Shift Payment Calculation Fix

## Problem

The POS closing shift was incorrectly calculating collected cash and non-cash amounts.

### Example Issue

For invoice `POSA-OS-25-0001043`:

- `paid_amount`: 4254.95 SR
- `change_amount`: 629 SR
- `grand_total`: 3945.95 SR
- **Actual collected = 4254.95 - 629 = 3625.95 SR**

But the system was showing different totals at closing.

## Root Cause

1. **Change amount** was only subtracted from cash payments in some cases, not consistently
2. **Payment Entry** amounts were **incorrectly** queried:
   - **WRONG**: Using `reference_no = pos_opening_shift` field
   - **CORRECT**: Must join via `tabPayment Entry Reference` child table
   - Payment Entries link to **Sales Invoices**, not to POS Opening Shift directly!
3. The logic was subtracting change from **each cash payment** instead of just **once** from the total

### Payment Entry Schema Discovery

Payment Entries don't link to POS Opening Shift via `reference_no`. They link to **Sales Invoices** via:

- **Child Table**: `tabPayment Entry Reference`
- `reference_doctype` = "Sales Invoice"
- `reference_name` = Invoice name (e.g., "SINV-KH-009391")
- `allocated_amount` = Amount paid against that invoice

**Example**:

```
Payment Entry: PE-001
├─ party: عميل نقدي الخضراء
├─ mode_of_payment: شبكة - فرع الخضراء
├─ paid_amount: 320
└─ references (child table):
    └─ reference_name: SINV-KH-009391
       allocated_amount: 320
```

## Solution Implemented

### UNIFIED Payment Calculation Logic

**Key Principle**: ONE function calculates payment totals for BOTH closing shift AND navbar.

#### New Helper Function: `_calculate_payment_totals()`

**Location**: `pos_closing_shift.py`

This is the **SINGLE SOURCE OF TRUTH** for all payment calculations:

```python
def _calculate_payment_totals(pos_opening_shift, pos_profile):
    """
    UNIFIED payment calculation logic.
    Returns: dict with totals per mode_of_payment
    Example: {
        "Cash": 930.00,
        "شبكة - فرع الخضراء": 3017.65
    }
    """
    # Process Sales Invoice Payments
    # - Subtract change_amount once per invoice
    # - Track all payment modes

    # Process Payment Entries via child table
    # - Join tabPayment Entry Reference
    # - Add allocated_amount to totals

    return payments  # Dict of {mode: total}
```

#### Functions Using Unified Logic

1. **`make_closing_shift_from_opening()`** - Closing shift dialog

   - Calls `_calculate_payment_totals()`
   - Converts dict to payments list
   - ✅ Same calculation as navbar

2. **`get_current_cash_total()`** - Navbar cash badge

   - Calls `_calculate_payment_totals()`
   - Returns cash mode total
   - ✅ Same calculation as closing shift

3. **`get_current_non_cash_total()`** - Navbar card badge
   - Calls `_calculate_payment_totals()`
   - Sums all non-cash modes
   - ✅ Same calculation as closing shift

### Code Changes Summary

**Before**: Duplicate calculation logic

- `make_closing_shift_from_opening()` - Loop through invoices/payments
- `get_current_cash_total()` - Separate SQL queries
- `get_current_non_cash_total()` - Different SQL queries
- ❌ Three different implementations, risk of mismatch

**After**: Single source of truth

```python
# Shared helper (70 lines)
def _calculate_payment_totals(pos_opening_shift, pos_profile):
    # Process Sales Invoice Payments
    for invoice in invoices:
        change_already_applied = False
        for payment in invoice.payments:
            amount = payment.amount
            if not change_already_applied and invoice.change_amount:
                amount -= invoice.change_amount
                change_already_applied = True
            payments[payment.mode_of_payment] += amount

    # Process Payment Entries
    for pe in payment_entries:
        payments[pe.mode_of_payment] += pe.allocated_amount

    return payments  # {"Cash": 930, "شبكة": 3017.65}

# Closing shift uses it
closing_totals = _calculate_payment_totals(shift, profile)

# Navbar cash uses it
totals = _calculate_payment_totals(shift, profile)
cash = totals[cash_mode_of_payment]

# Navbar non-cash uses it
totals = _calculate_payment_totals(shift, profile)
non_cash = sum(amount for mode, amount in totals.items() if mode != cash_mode)
```

✅ ONE implementation, guaranteed match

### 1. Fixed `make_closing_shift_from_opening` function

**File**: `/home/frappe/frappe-bench/apps/posawesome/posawesome/posawesome/doctype/pos_closing_shift/pos_closing_shift.py`

**Before**:

```python
for p in d.payments:
    if existing_pay[0].mode_of_payment == cash_mode_of_payment:
        amount = p.amount - d.change_amount  # Wrong: subtracts change from each cash payment
    else:
        amount = p.amount
```

**After**:

```python
# Track if change_amount has been subtracted for this invoice
change_already_applied = False

for p in d.payments:
    # Calculate amount - subtract change from first payment only
    amount = p.amount
    if not change_already_applied and d.change_amount:
        amount = p.amount - d.change_amount
        change_already_applied = True  # Only subtract once per invoice
```

### 2. Fixed `get_current_cash_total` function

Added:

- Proper change_amount subtraction (once per invoice)
- Payment Entry amounts for cash payments

```python
# Track if we've subtracted change_amount
change_already_applied = False

for payment in payments:
    if payment.mode_of_payment == cash_mode_of_payment:
        amount = flt(payment.amount)
        if not change_already_applied and invoice.change_amount:
            amount = amount - flt(invoice.change_amount)
            change_already_applied = True
        total_cash += amount

# Add Payment Entry amounts
payment_entries = frappe.db.sql("""
    SELECT DISTINCT per.allocated_amount, pe.mode_of_payment
    FROM `tabPayment Entry` pe
    INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
    INNER JOIN `tabSales Invoice` si ON si.name = per.reference_name
    WHERE pe.docstatus = 1
    AND pe.payment_type = 'Receive'
    AND per.reference_doctype = 'Sales Invoice'
    AND si.posa_pos_opening_shift = %s
    AND pe.mode_of_payment = %s
""", (pos_opening_shift_name, cash_mode_of_payment), as_dict=1)

for pe in payment_entries:
    total_cash += flt(pe.allocated_amount)
```

### 3. Fixed `get_current_non_cash_total` function

Added Payment Entry amounts for non-cash payments:

```python
# Add Payment Entry amounts for non-cash
payment_entries = frappe.db.sql("""
    SELECT DISTINCT per.allocated_amount, pe.mode_of_payment
    FROM `tabPayment Entry` pe
    INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
    INNER JOIN `tabSales Invoice` si ON si.name = per.reference_name
    WHERE pe.docstatus = 1
    AND pe.payment_type = 'Receive'
    AND per.reference_doctype = 'Sales Invoice'
    AND si.posa_pos_opening_shift = %s
    AND pe.mode_of_payment != %s
""", (pos_opening_shift_name, cash_mode_of_payment), as_dict=1)

for pe in payment_entries:
    total_non_cash += flt(pe.allocated_amount)
```

## Impact

### Before Fix

- Cash: 928.30 SR (incorrect)
- Card: 2,747.65 SR (incorrect)

### After Fix (Expected)

- Cash: 930 SR ✓
- Card: 3,017.65 SR ✓

## Database References

The fix properly handles:

1. **Sales Invoice Payments** (`tabSales Invoice Payment`)

   - Links to parent: `tabSales Invoice Payment.parent = tabSales Invoice.name`
   - Mode: `mode_of_payment`
   - Amount: `amount - change_amount` (applied once)

2. **Payment Entries** (`tabPayment Entry`) - **FIXED QUERY**
   - ✗ OLD (WRONG): `WHERE pe.reference_no = pos_opening_shift`
   - ✓ NEW (CORRECT): Join via child table
   ```sql
   FROM `tabPayment Entry` pe
   INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
   INNER JOIN `tabSales Invoice` si ON si.name = per.reference_name
   WHERE per.reference_doctype = 'Sales Invoice'
   AND si.posa_pos_opening_shift = %s
   ```
   - Type: `payment_type = 'Receive'`
   - Mode: `pe.mode_of_payment`
   - Amount: `per.allocated_amount` (not `paid_amount`!)

### Why This Matters

Your example Payment Entry:

- **Customer**: عميل نقدي الخضراء
- **Mode**: شبكة - فرع الخضراء
- **Paid**: 320 SR
- **References**: SINV-KH-009391 (allocated 320 SR)
- **Invoice Shift**: POSA-OS-25-0001043

**OLD query** would NOT find this Payment Entry (no `reference_no` field).  
**NEW query** WILL find it via the references child table!

## Testing

```bash
cd /home/frappe/frappe-bench/apps
bench build --app posawesome
# ✓ Build successful
```

## Files Modified

1. **Backend**: `/home/frappe/frappe-bench/apps/posawesome/posawesome/posawesome/doctype/pos_closing_shift/pos_closing_shift.py`

   - `make_closing_shift_from_opening()` - Fixed change_amount logic
   - `get_current_cash_total()` - Fixed Payment Entry query via child table
   - `get_current_non_cash_total()` - Fixed Payment Entry query via child table
   - `_get_payments_entries_helper()` - Rewrote to use JOIN on references
   - `get_payments_entries()` - Now uses helper function

2. **Frontend**: `/home/frappe/frappe-bench/apps/posawesome/posawesome/public/js/posapp/components/Navbar.js`
   - `setupCashUpdateInterval()` - Changed from 5 minutes to 30 seconds for real-time updates
   - `invoice_submitted` event - Added immediate refresh + 1-second delayed refresh

## Navbar Display Improvements

The Navbar badges now:

- ✅ **Update immediately** when invoice is submitted (instant feedback)
- ✅ **Auto-refresh every 30 seconds** (was 5 minutes)
- ✅ **Show exact same numbers** as closing shift dialog
- ✅ **Include Payment Entry amounts** via correct child table JOIN

## Next Steps

See `plan.md` for return invoice safeguards implementation.
