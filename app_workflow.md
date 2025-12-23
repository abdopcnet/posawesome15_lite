# POS Awesome - Workflow

## Main POS Flow

```
1. Open Shift
   ↓
2. POS Interface
   ├─ Select Items
   ├─ Select Customer
   └─ Process Payment
   ↓
3. Create Invoice
   ├─ Save Draft
   └─ Submit & Print
   ↓
4. Close Shift
```

## Settlement Flow

```
1. Select Settlement
   ↓
2. Load Outstanding Invoices
   ↓
3. Select Invoice
   ↓
4. Load Invoice (Pay_Mode)
   ├─ Items: Read-only
   ├─ Customer: Read-only
   └─ Payments: Outstanding amount
   ↓
5. Enter Payment
   ↓
6. Create Payment Entry
```

## Invoice Modes

-   **Sales**: Normal sales invoice
-   **Return**: Return from invoice
-   **Quick Return**: Return items only
-   **Payment**: Settlement payment receipt
