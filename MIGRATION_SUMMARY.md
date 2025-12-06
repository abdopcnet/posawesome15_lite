# POS Closing Shift Migration Summary

## التغييرات الرئيسية

### 1. دمج الجداول الفرعية
- ✅ تم دمج `POS Payment Entry Reference` في `Sales Invoice Reference`
- ✅ تم نقل `taxes` من جدول منفصل إلى `Sales Invoice Reference`
- ✅ الآن جدول واحد فقط: `pos_transactions` (يستخدم `Sales Invoice Reference`)

### 2. الجداول الفرعية المتبقية
- ✅ `pos_transactions` → `Sales Invoice Reference` (الفواتير + Payment Entries)
- ✅ `payment_reconciliation` → `POS Closing Shift Detail` (الإجماليات)

### 3. الحقول المضافة إلى Sales Invoice Reference
- `sales_invoice` (reqd)
- `posting_date` (reqd)
- `customer` (reqd)
- `mode_of_payment` (reqd)
- `grand_total` (reqd, Data field)
- `net_total` (Data field)
- `total_qty` (Data field)
- `discount_amount` (Data field)
- `posa_item_discount_total` (Data field)
- `paid_amount` (Data field)
- `change_amount` (Data field)
- `total` (Data field)
- `taxes` (Data field) - تم نقله من جدول منفصل
- `payment_entry` (Link) - لربط Payment Entry

### 4. الملفات المعدلة

#### Backend (Python)
- `/api/pos_closing_shift.py`
  - حذف `pos_payments` من closing_data
  - حذف `taxes` من closing_data
  - نقل Payment Entries إلى `pos_transactions`
  - نقل taxes إلى `Sales Invoice Reference`
  - إضافة جميع الحقول المطلوبة
  - إضافة logging موحد: `frappe.log_error(f"[[pos_closing_shift.py]] message")`

#### Frontend (JavaScript)
- `/posawesome/doctype/pos_closing_shift/pos_closing_shift.js`
  - حذف `add_to_taxes` function
  - حذف `taxes` من reset_values و refresh_fields
  - تحديث `add_to_pos_transaction` لإضافة جميع الحقول
  - تحديث `get_pos_payments` لإضافة جميع الحقول
  - إضافة logging موحد: `console.log(\`[pos_closing_shift.js] message\`)`

#### Doctype JSON
- `/posawesome/doctype/pos_closing_shift/pos_closing_shift.json`
  - حذف `pos_payments` من field_order
  - حذف حقل `pos_payments`

- `/posawesome/doctype/sales_invoice_reference/sales_invoice_reference.json`
  - إضافة جميع الحقول المطلوبة
  - إضافة `taxes` field

### 5. الجداول المحذوفة (يمكن حذفها الآن)
- ❌ `POS Payment Entry Reference` - تم دمجه في `Sales Invoice Reference`
- ❌ `POS Closing Shift Taxes` - تم دمجه في `Sales Invoice Reference`

## أوامر التطبيق

### بعد تعديل JSON files:
```bash
bench --site all reload-doc POSAwesome doctype "Sales Invoice Reference"
bench --site all reload-doc POSAwesome doctype "POS Closing Shift"
```

### بعد تعديل Python/JS files:
```bash
bench --site all clear-cache
bench --site all clear-website-cache
bench build --app posawesome --force
find . -name "*.pyc" -print -delete
bench restart
```

## Logging الموحد

### Backend (Python)
```python
frappe.log_error(f"[[pos_closing_shift.py]] message")
```

### Frontend (JavaScript)
```javascript
console.log(`[pos_closing_shift.js] message`)
```

## ملاحظات
- جميع الحقول من نوع `Data` في `Sales Invoice Reference` يجب أن تكون strings
- `payment_reconciliation` يحتوي على الإجماليات فقط (opening_amount, expected_amount, closing_amount, difference)
- `pos_transactions` يحتوي على جميع التفاصيل (الفواتير + Payment Entries)

