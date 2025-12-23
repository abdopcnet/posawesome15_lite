# POS Awesome - File Structure

## Backend Structure

```
posawesome/
├── api/                          # API modules
│   ├── customer.py              # Customer operations
│   ├── item.py                  # Item operations
│   ├── payment_entry.py         # Payment entry operations
│   ├── pos_profile.py           # POS Profile operations
│   ├── sales_invoice.py         # Sales Invoice operations
│   └── ping.py                  # Health check
│
└── posawesome/doctype/          # DocType modules
    ├── pos_closing_shift/       # Closing shift logic
    ├── pos_opening_shift/       # Opening shift logic
    └── pos_offer/              # Offer logic
```

## Frontend Structure

```
posawesome/public/js/posapp/
├── api_mapper.js               # API endpoints mapping
├── bus.js                      # Event bus
├── format.js                   # Formatting utilities
└── components/
    ├── pos/
    │   ├── Pos.js/vue          # Main POS component
    │   ├── Invoice.js/vue      # Invoice component
    │   ├── Payments.js/vue     # Payments component
    │   ├── Customer.js/vue     # Customer component
    │   ├── ItemsSelector.js/vue # Items selector
    │   ├── OutstandingPayments.js/vue # Settlement
    │   ├── Drafts.js/vue       # Draft invoices
    │   ├── Returns.js/vue      # Returns
    │   ├── ClosingDialog.js/vue # Closing dialog
    │   └── OpeningDialog.js/vue # Opening dialog
    └── Navbar.js/vue           # Navigation bar
```
