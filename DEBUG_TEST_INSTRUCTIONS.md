# Test Instructions - Rounded Total Debug

## Objective

Identify where `invoice_doc.rounded_total` is getting the wrong value (18.45 instead of 18.48)

## Test Steps

### 1. Create Test Invoice

1. Open POS (navigate to POSApp page)
2. Add items that will create a total with tax:
   - Example: Items totaling **18.45 SAR** before tax
   - With 15% tax → Grand Total = **18.48 SAR** (approximately, depending on rounding)

### 2. Open Payment Dialog

1. Click the **"PAY"** button
2. **IMMEDIATELY** open Browser Console (F12 → Console tab)
3. Look for console logs

### 3. Expected Console Logs

You should see 3 sets of logs:

#### Log 1: When show_payment() is called

```
show_payment - invoice totals: {
  total: 18.45,           ← Item subtotal before tax
  net_total: 18.45,       ← After item discounts (if any)
  grand_total: 18.48,     ← After adding tax
  rounded_total: ???      ← THIS IS THE KEY VALUE
}
```

**Question:** Is `rounded_total` = **18.48** or **18.45**?

#### Log 2: When payment component receives the invoice

```
SEND_INVOICE_DOC_PAYMENT received: {
  total: 18.45,
  net_total: 18.45,
  grand_total: 18.48,
  rounded_total: ???      ← DOES THIS MATCH LOG 1?
}
```

**Question:** Did `rounded_total` stay **18.48** or change to **18.45**?

#### Log 3: When you click a payment method button

1. In the payment dialog, click on **"Cash"** or **"Card"** button
2. Check console for:

```
set_full_amount called: {
  idx: 1,
  rounded_total: ???,     ← WHAT IS THIS VALUE?
  grand_total: 18.48,
  total: ???,             ← WHAT IS USED FOR PAYMENT AMOUNT?
  precision: 2
}
Setting payment amount to: ???  ← FINAL PAYMENT AMOUNT
```

**Question:** What payment amount is set? **18.48** or **18.45**?

### 4. Check Payment Amount Field

After clicking the payment method button, look at the **payment amount input field** in the dialog.

**Question:** What value is displayed?

- [ ] **18.48** (correct - matches rounded_total)
- [ ] **18.45** (wrong - matches total before tax)

### 5. Submit Invoice (Optional)

If you submit the invoice:

1. Check the submitted invoice in backend
2. Run SQL query:

```sql
SELECT
    name,
    total,
    net_total,
    grand_total,
    rounded_total,
    paid_amount,
    outstanding_amount
FROM `tabSales Invoice`
WHERE name = 'SAL-INV-XXXX'  -- Replace with your invoice number
ORDER BY creation DESC
LIMIT 1;
```

## Report Format

Please provide:

### Console Logs

```
[Paste all 3 console log outputs here]
```

### Payment Amount Observed

- In payment dialog: **\_\_** SAR
- In submitted invoice paid_amount: **\_\_** SAR
- Outstanding amount: **\_\_** SAR

### SQL Query Result (if submitted)

```
[Paste SQL output here]
```

## Analysis

Based on the console logs, we will determine:

1. **If Log 1 shows `rounded_total: 18.45`**
   → Problem is in `calculateTotalsLocally()` - it's calculating rounded_total from `total` instead of `grand_total`

2. **If Log 1 shows `rounded_total: 18.48` but Log 2 shows `18.45`**
   → Problem is in event emission - value is getting lost in transit

3. **If Log 2 shows `rounded_total: 18.48` but Log 3 shows `18.45`**
   → Problem is in payment component - `this.invoice_doc` has wrong value

4. **If all logs show `rounded_total: 18.48` but payment amount is `18.45`**
   → Problem is in `set_full_amount()` logic - using wrong fallback value

## Quick Fix Test

If you want to test a potential fix immediately, try this in browser console:

```javascript
// After opening payment dialog, run this in console:
const paymentComponent = document.querySelector('[data-component="payments"]')?.__vue__;
if (paymentComponent) {
  console.log("Current invoice_doc.rounded_total:", paymentComponent.invoice_doc.rounded_total);
  console.log("Current invoice_doc.grand_total:", paymentComponent.invoice_doc.grand_total);
  console.log("Current invoice_doc.total:", paymentComponent.invoice_doc.total);
}
```

This will show the exact state of the payment component's invoice data.

---

**Please test and share all console outputs!** This will pinpoint the exact location of the bug.
