# POS Return Invoice Safeguards Implementation

## Overview

Implemented backend safeguards to prevent over-refunds when creating return invoices in POSAwesome. The system now tracks what has been returned and enforces limits at both the invoice and item level.

## Problem Addressed

Previously, the POS system would allow:

- Multiple full returns against the same invoice
- Returning more quantity than originally purchased
- Refunding more money than was collected

This led to over-refunds and inventory/accounting discrepancies.

## Solution: Multi-Layer Protection

### 1. Return Stats Calculation Helper

**Function**: `calculate_return_stats(invoice_name)`  
**Location**: `/home/frappe/frappe-bench/apps/posawesome/posawesome/posawesome/api/sales_invoice.py`

Calculates what remains returnable for an invoice:

```python
def calculate_return_stats(invoice_name):
    """
    Returns:
    - remaining_returnable_amount: Total $ still available for return
    - total_returned_amount: Total $ already returned
    - items: Per-item stats with:
      - original_qty
      - already_returned_qty
      - remaining_returnable_qty
      - max_returnable_qty
    """
```

**How it works**:

1. Queries all submitted return invoices linked via `return_against` field
2. Sums up returned amounts (note: return amounts are negative in ERPNext)
3. Calculates: `remaining = original_amount + total_returned` (since returned is negative)
4. Per item: queries returned quantities and calculates remaining

### 2. Enhanced Return Invoice Search

**Function**: `get_invoices_for_return()`  
**Location**: Same file

**Before**:

- Returned all paid/partially paid invoices
- No indication of what was already returned
- Could list invoices with nothing left to return

**After**:

- Enriches each invoice with return stats
- Filters out invoices where `remaining_returnable_amount <= 0`
- Adds per-item `max_returnable_qty` to guide frontend
- Returns structured data:
  ```json
  {
    "name": "POSA-SINV-2024-00001",
    "grand_total": 3945.95,
    "remaining_returnable_amount": 2000.0,
    "total_returned_amount": 1945.95,
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 5,
        "max_returnable_qty": 3,
        "already_returned_qty": 2
      }
    ]
  }
  ```

### 3. Server-Side Validation Gate

**Function**: `validate_return_limits(return_doc)`  
**Location**: Same file

**Called from**: `create_and_submit_invoice()` before insert/submit

**Validation checks**:

1. **Total amount check**:

   - Gets current return stats
   - Compares `abs(return.grand_total)` vs `remaining_returnable_amount`
   - Throws error if exceeded (with 0.01 rounding tolerance)

2. **Per-item quantity check**:
   - For each return item, compares `abs(return_qty)` vs `max_returnable_qty`
   - Throws error if any item exceeds (with 0.001 rounding tolerance)

**Error messages**:

```
"Return amount 5000.00 SR exceeds remaining returnable amount 3945.95 SR"
"Return quantity 10 for item ITEM-001 exceeds remaining returnable quantity 5"
```

## Database Schema Used

### Sales Invoice

- `is_return`: Flag indicating return invoice
- `return_against`: Link to original invoice name
- `docstatus`: 1 = submitted (only count submitted returns)
- `grand_total`: Total amount (negative for returns)

### Sales Invoice Item

- `parent`: Links to Sales Invoice
- `item_code`: Item identifier
- `qty`: Quantity (negative for returns)

## Integration Points

### Backend

✅ `calculate_return_stats()` - Reusable helper  
✅ `get_invoices_for_return()` - Enhanced with return metadata  
✅ `validate_return_limits()` - Server-side enforcement  
✅ `create_and_submit_invoice()` - Calls validation before submit

### Frontend (TODO)

⏳ Returns.vue - Display remaining amounts in dialog  
⏳ Invoice.js - Enforce qty limits in UI  
⏳ Payments.js - Cap refund amount

## Testing Scenarios

### Scenario 1: Full Return Twice

1. Original invoice: 1000 SR
2. First return: 1000 SR ✓ (allowed)
3. Second return attempt: 500 SR ✗ (blocked by validation)
   - Error: "Return amount 500.00 SR exceeds remaining returnable amount 0.00 SR"

### Scenario 2: Partial Returns

1. Original invoice: 1000 SR
2. First return: 400 SR ✓ (allowed, remaining: 600)
3. Second return: 400 SR ✓ (allowed, remaining: 200)
4. Third return: 300 SR ✗ (blocked)
   - Error: "Return amount 300.00 SR exceeds remaining returnable amount 200.00 SR"

### Scenario 3: Item Quantity

1. Original: Item A × 10 qty
2. First return: Item A × 6 qty ✓ (remaining: 4)
3. Second return: Item A × 5 qty ✗ (blocked)
   - Error: "Return quantity 5 for item Item A exceeds remaining returnable quantity 4"

## Files Modified

### Backend

- `/home/frappe/frappe-bench/apps/posawesome/posawesome/posawesome/api/sales_invoice.py`
  - Added `calculate_return_stats()` helper (70 lines)
  - Enhanced `get_invoices_for_return()` with return metadata
  - Added `validate_return_limits()` validation function
  - Integrated validation into `create_and_submit_invoice()`

### Build Status

```bash
bench build --app posawesome
✓ Build successful - no errors
```

## Benefits

1. **Data Integrity**: Prevents accounting/inventory corruption from over-refunds
2. **User Guidance**: Shows remaining returnable amounts before return creation
3. **Audit Trail**: All return attempts logged, failures recorded
4. **Backward Compatible**: Doesn't affect normal sales flow, only returns
5. **Performance**: Uses indexed queries (return_against, docstatus, item_code)

## Next Steps (Frontend)

1. **Returns Dialog** (`Returns.vue`)

   - Add "Remaining" column showing returnable amount
   - Grey out fully returned invoices
   - Show tooltip with return history

2. **Invoice Editor** (`Invoice.js`)

   - Read `max_returnable_qty` from item data
   - Clamp quantity input to max allowed
   - Show inline warning when hitting limit

3. **Payments** (`Payments.js`)
   - Display `remaining_returnable_amount` badge
   - Prevent manual payment amount > remaining
   - Auto-adjust on quick return

## Monitoring

Check for validation errors:

```sql
SELECT * FROM `tabError Log`
WHERE method = 'posawesome.posawesome.api.sales_invoice.create_and_submit_invoice'
AND creation > DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY creation DESC;
```

Check return patterns:

```sql
SELECT
    return_against,
    COUNT(*) as return_count,
    SUM(grand_total) as total_returned
FROM `tabSales Invoice`
WHERE is_return = 1
AND docstatus = 1
GROUP BY return_against
HAVING return_count > 1;
```

## References

- Implementation follows ERPNext native patterns
- Compatible with ERPNext v13/v14/v15
- Respects POS Profile settings
- No custom DocTypes required
