# POS Awesome - Workflow

## Main Flow

```
Start
  ↓
Check Open Shift
  ↓
[No Shift] → Opening Dialog → Create Opening Shift
  ↓
POS Main Interface
  ├─ Item Selection
  ├─ Customer Selection
  └─ Payment Processing
  ↓
Create Invoice
  ├─ Save Draft
  └─ Submit & Print
  ↓
[Continue] or [Close Shift]
  ↓
Closing Dialog → Create Closing Shift
  ↓
Auto-Print → Page Reload
```

## Settlement Flow (Outstanding Payments)

```
Select Settlement
  ↓
Load Outstanding Invoices
  ↓
Select Invoice
  ↓
Load Invoice (Pay_Mode)
  ├─ Items: Read-only
  ├─ Customer: Read-only
  └─ Payments: Outstanding amount only
  ↓
Enter Payment
  ↓
Create Payment Entry
  ↓
Update Invoice Outstanding
```

## Shift Status

```
Draft → Submit → Open → Close → Closed
```

## Invoice Status

```
Draft → Submit → Submitted
```

## Key Events

-   `register_pos_profile` - POS Profile loaded
-   `set_pos_opening_shift` - Shift set
-   `load_settlement_invoice` - Settlement invoice loaded
-   `send_invoice_doc_payment` - Invoice sent to payment
-   `show_payment` - Show payment panel
-   `submit_closing_pos` - Closing shift submitted
