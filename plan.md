# POS Awesome - Code Refactoring Plan

## Completed Tasks

### 1. API Functions Migration
- ✅ Moved all functions from `api/pos_offer.py` to `doctype/pos_offer/pos_offer.py`
- ✅ Moved all functions from `api/pos_closing_shift.py` to `doctype/pos_closing_shift/pos_closing_shift.py`
- ✅ Moved all functions from `api/pos_opening_shift.py` to `doctype/pos_opening_shift/pos_opening_shift.py`
- ✅ Updated all API calls in `api_mapper.js` to use new DocType paths
- ✅ Deleted old API files after migration

### 2. Code Simplification
- ✅ Removed all temporary variables and abbreviations
- ✅ Using only real field names: `posa_allow_partial_payment`, `posa_use_customer_credit`, `posa_allow_credit_sale`, `paid_amount`, `loyalty_amount`, `redeemed_customer_credit`, `grand_total`, `return_against`
- ✅ Removed `is_credit_sale` temporary variable - now computed property in Payments.js
- ✅ Removed `CREDIT_SALE_TOLERANCE` constant - using `0.01` directly
- ✅ Removed `posa_use_customer_credit_switch` - using `pos_profile.posa_use_customer_credit` directly
- ✅ Removed `_original_invoice_payment_info` - using `return_against` to fetch original invoice data

### 3. Partial Payment Validation
- ✅ Frontend validation in `Invoice.js` `printInvoice()` method
- ✅ Single clear message: "غير مسموح الدفع الجزئي للفاتورة"
- ✅ Print button disabled when partial payment not allowed
- ✅ Backend validation removed (as per user request)

### 4. Code Comments
- ✅ Added English comments above each function/section
- ✅ Comments placed above code blocks, not beside code
- ✅ Comments explain what each section does

### 5. Time Format Updates
- ✅ Opening shift message: "الفتح مسموح من {0} الي {1}" with 12-hour format (ص/م)
- ✅ Closing shift message: "الإغلاق مسموح من {0} الي {1}" with 12-hour format (ص/م)
- ✅ Added `_format_time_12h()` helper function in both files

### 6. POS Profile Field Logic
- ✅ When `posa_allow_partial_payment = 0`, automatically set `posa_allow_credit_sale = 0`
- ✅ Logic implemented in `pos_profile.js`

## Current Code Structure

### Files Modified
1. `/posawesome/doctype/pos_offer/pos_offer.py` - All offer-related API functions
2. `/posawesome/doctype/pos_opening_shift/pos_opening_shift.py` - All opening shift API functions
3. `/posawesome/doctype/pos_closing_shift/pos_closing_shift.py` - All closing shift API functions
4. `/posawesome/public/js/posapp/components/pos/Invoice.js` - Invoice printing and validation
5. `/posawesome/public/js/posapp/components/pos/Payments.js` - Payment logic and validation
6. `/posawesome/public/js/posapp/components/pos/Payments.vue` - Payment UI
7. `/posawesome/public/js/pos_profile.js` - POS Profile field logic
8. `/posawesome/api/sales_invoice.py` - Backend invoice creation

### Key Field Names Used
- `pos_profile.posa_allow_partial_payment` - Controls partial payment allowance
- `pos_profile.posa_use_customer_credit` - Controls customer credit usage
- `pos_profile.posa_allow_credit_sale` - Controls credit sale toggle visibility
- `invoice_doc.paid_amount` - Computed from payments + loyalty_amount + redeemed_customer_credit
- `invoice_doc.grand_total` - Total invoice amount
- `invoice_doc.return_against` - Original invoice reference for returns

## Testing Checklist

### Partial Payment
- [ ] Test with `posa_allow_partial_payment = 1` - should allow partial payment
- [ ] Test with `posa_allow_partial_payment = 0` - should show error message and disable print button
- [ ] Test credit sale (paid_amount <= 0.01) - should allow printing

### Return Invoices
- [ ] Test return invoice with `return_against` - should fetch original invoice data
- [ ] Test return invoice with unpaid original - should set payments to 0
- [ ] Test return invoice with paid original - should calculate refundable amount

### POS Profile
- [ ] Test disabling `posa_allow_partial_payment` - should auto-disable `posa_allow_credit_sale`
- [ ] Test enabling `posa_allow_partial_payment` - should allow enabling `posa_allow_credit_sale`

## Database Commands

```bash
# Check POS Profile fields
bench --site all mariadb -e "DESCRIBE \`tabPOS Profile\`;"

# Check custom fields
bench --site all mariadb -e "SELECT fieldname FROM \`tabCustom Field\` WHERE dt='POS Profile';"

# Check invoice data
bench --site all mariadb -e "SELECT name, grand_total, paid_amount FROM \`tabSales Invoice\` WHERE posa_pos_opening_shift = 'POSA-OS-XX-XXXXXX';"

# Check error log
bench --site all mariadb -e "SELECT error, method FROM \`tabError Log\` ORDER BY creation DESC LIMIT 1000;"
```

## Notes
- All temporary variables removed
- Only real field names used
- Comments in English above each section
- Code syntax reviewed and validated
