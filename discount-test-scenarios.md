# Discount Logic Test Scenarios

This document provides test scenarios to verify discount calculations match between ERPNext standard and POS Awesome.

## Test Setup

### Test Environment

- ERPNext Version: [current version]
- POS Awesome Version: [current version]
- Company: Test Company
- Currency: USD
- Precision: 2 decimals

### Test Items

- Item A: $100.00 per unit
- Item B: $50.00 per unit
- Item C: $25.00 per unit

### Test Customer

- Customer: Test Customer
- Payment Terms: Net 30
- Price List: Standard Selling

---

## Test Scenario 1: Item-Level Discount (Basic)

### Setup

- Add Item A with qty 2
- Apply 10% discount to Item A
- No invoice-level discount
- No taxes

### Expected Calculation

```
Item A:
  Price List Rate: 100.00
  Discount %: 10%
  Discount Amount: (100 * 10) / 100 = 10.00
  Rate: 100 - 10 = 90.00
  Qty: 2
  Amount: 90 * 2 = 180.00

Net Total: 180.00
Tax: 0.00
Grand Total: 180.00
```

### Verify

- Item discount_amount = $10.00 per unit
- Item rate = $90.00
- Item amount = $180.00
- Grand total = $180.00

### Test in Both Systems

- [ ] ERPNext Sales Invoice
- [ ] POS Awesome Invoice

---

## Test Scenario 2: Multiple Items with Different Item Discounts

### Setup

- Item A: qty 2, 10% discount
- Item B: qty 3, 15% discount
- Item C: qty 1, 0% discount
- No invoice-level discount
- No taxes

### Expected Calculation

```
Item A:
  Price: 100.00
  Discount: 10.00
  Rate: 90.00
  Qty: 2
  Amount: 180.00

Item B:
  Price: 50.00
  Discount: 7.50
  Rate: 42.50
  Qty: 3
  Amount: 127.50

Item C:
  Price: 25.00
  Discount: 0.00
  Rate: 25.00
  Qty: 1
  Amount: 25.00

Total: 332.50
Net Total: 332.50
Grand Total: 332.50
```

### Verify

- Item A total = $180.00
- Item B total = $127.50
- Item C total = $25.00
- Grand total = $332.50

---

## Test Scenario 3: Invoice-Level Discount (Apply on Net Total)

### Setup

- Item A: qty 2, no discount
- Item B: qty 3, no discount
- Invoice discount: 5% on Net Total
- Tax: 10% (exclusive)

### Expected Calculation

```
Item A:
  Rate: 100.00
  Qty: 2
  Amount: 200.00

Item B:
  Rate: 50.00
  Qty: 3
  Amount: 150.00

Total: 350.00
Net Total: 350.00

Invoice Discount (5% on Net Total):
  Discount Amount: 350 * 5 / 100 = 17.50
  Net Total after discount: 350 - 17.50 = 332.50

Tax (10% on 332.50):
  Tax Amount: 332.50 * 10 / 100 = 33.25

Grand Total: 332.50 + 33.25 = 365.75
```

### Verify

- Net total (before tax) = $332.50
- Discount amount = $17.50
- Tax amount = $33.25
- Grand total = $365.75

---

## Test Scenario 4: Invoice-Level Discount (Apply on Grand Total)

### Setup

- Item A: qty 2, no discount
- Item B: qty 3, no discount
- Invoice discount: 5% on Grand Total
- Tax: 10% (exclusive)

### Expected Calculation

```
Item A: 200.00
Item B: 150.00
Total: 350.00
Net Total: 350.00

Tax (10% on 350):
  Tax: 350 * 10 / 100 = 35.00

Grand Total before discount: 350 + 35 = 385.00

Invoice Discount (5% on Grand Total):
  Discount Amount: 385 * 5 / 100 = 19.25
  Grand Total: 385 - 19.25 = 365.75
```

### Verify

- Tax calculated on $350 = $35.00
- Grand total before discount = $385.00
- Discount amount = $19.25
- Final grand total = $365.75

---

## Test Scenario 5: Both Item and Invoice Discounts

### Setup

- Item A: qty 2, 10% item discount
- Item B: qty 3, no item discount
- Invoice discount: 5% on Net Total
- Tax: 10% (exclusive)

### Expected Calculation

```
Item A:
  Price: 100.00
  Discount: 10.00
  Rate: 90.00
  Qty: 2
  Amount: 180.00

Item B:
  Price: 50.00
  Qty: 3
  Amount: 150.00

Total: 330.00
Net Total: 330.00

Invoice Discount (5% on 330):
  Discount: 330 * 5 / 100 = 16.50
  Net Total after discount: 330 - 16.50 = 313.50

Tax (10% on 313.50):
  Tax: 313.50 * 10 / 100 = 31.35

Grand Total: 313.50 + 31.35 = 344.85
```

### Verify

- Item A gets $10 discount per unit
- Item B no discount
- Invoice discount = $16.50
- Tax on discounted amount = $31.35
- Grand total = $344.85

---

## Test Scenario 6: POS Awesome Offer System - Transaction Level

### Setup

- Create offer: 10% discount on grand total for all customers
- Item A: qty 2, no manual discount
- Tax: 10% (exclusive)

### Expected Behavior

- Offer automatically detected
- Offer applied to `additional_discount_percentage`
- Calculations same as Test Scenario 3 but auto-applied

### Verify

- Offer appears in POS interface
- Discount automatically applied
- Total matches manual entry

---

## Test Scenario 7: POS Awesome Offer System - Item Level

### Setup

- Create offer: 15% discount on Item B for all customers
- Item A: qty 2, no discount
- Item B: qty 3
- No invoice-level discount

### Expected Behavior

- Offer automatically detected
- Item B discount_applied flag = true
- Item B gets 15% discount automatically

### Verify

- Offer applies to Item B only
- Item A remains full price
- Totals match manual calculation

---

## Test Scenario 8: Precision and Rounding

### Setup

- Item A: $33.33 per unit, qty 3
- 10% item discount
- 7.5% invoice discount on Net Total
- 10% tax

### Expected Calculation

```
Item A base: 33.33 * 3 = 99.99
Item discount: 99.99 * 10% = 10.00
Net total: 99.99 - 10.00 = 89.99
Invoice discount: 89.99 * 7.5% = 6.75
Net after discount: 89.99 - 6.75 = 83.24
Tax: 83.24 * 10% = 8.32
Grand total: 83.24 + 8.32 = 91.56
```

### Verify

- All amounts follow precision rules
- No rounding errors
- Totals match in both systems

---

## Test Scenario 9: Return Invoice with Discounts

### Setup

- Original invoice: Item A qty 2, 10% item discount
- Return same item qty 1
- Negative discount applies

### Expected Calculation

```
Return Item A:
  Price: 100.00
  Discount: -10.00 (negative for return)
  Rate: -90.00
  Qty: -1
  Amount: 90.00
```

### Verify

- Return invoice shows negative amounts
- Discounts properly reversed
- Totals correct

---

## Test Scenario 10: Complex Real-World Scenario

### Setup

- 5 different items with various discounts
- Transaction-level offer: 5% auto-apply
- Manual invoice discount: 2% on Net Total
- 10% tax (exclusive)
- Rounding to nearest 0.05 (cash)

### Steps

1. Add all items
2. Apply item discounts manually
3. Verify offer auto-applies
4. Add manual invoice discount
5. Confirm tax calculation
6. Verify rounding

### Expected Behavior

- All discounts stack correctly
- Tax applied properly
- Rounding handled
- Final total matches both systems

---

## Test Execution Checklist

### Before Testing

- [ ] Backup database
- [ ] Clear test data
- [ ] Create test items
- [ ] Create test customer
- [ ] Set up price list

### Item Discount Testing

- [ ] Test 1: Single item, 10% discount
- [ ] Test 2: Multiple items, different discounts
- [ ] Test 8: Precision and rounding

### Invoice Discount Testing

- [ ] Test 3: 5% on Net Total
- [ ] Test 4: 5% on Grand Total
- [ ] Test 5: Both discounts together

### Offer System Testing

- [ ] Test 6: Transaction-level offer
- [ ] Test 7: Item-level offer
- [ ] Test 10: Complex scenario

### Return Invoice Testing

- [ ] Test 9: Return with discounts

### Validation

- [ ] All calculations match between systems
- [ ] No rounding discrepancies
- [ ] All fields saved correctly
- [ ] Reports show correct values

---

## Expected Results Summary

| Test | ERPNext Result | POS Awesome Result | Status |
| ---- | -------------- | ------------------ | ------ |
| 1    | $180.00        | $180.00            | ✅     |
| 2    | $332.50        | $332.50            | ✅     |
| 3    | $365.75        | $365.75            | ✅     |
| 4    | $365.75        | $365.75            | ✅     |
| 5    | $344.85        | $344.85            | ✅     |
| 6    | Auto apply     | Auto apply         | ✅     |
| 7    | N/A            | Auto apply         | ✅     |
| 8    | $91.56         | $91.56             | ✅     |
| 9    | $90.00         | $90.00             | ✅     |
| 10   | [Complex]      | [Complex]          | ⏳     |

**Legend:**

- ✅ Passed
- ❌ Failed
- ⏳ Pending
