# POS Awesome - File Structure

## Directory Structure

```
posawesome/
├── posawesome/                    # Main app package
│   ├── api/                       # API modules
│   │   ├── customer.py
│   │   ├── item.py
│   │   ├── ping.py
│   │   ├── pos_profile.py
│   │   └── sales_invoice.py
│   │
│   ├── posawesome/doctype/       # DocTypes
│   │   ├── pos_closing_shift/
│   │   ├── pos_opening_shift/
│   │   ├── pos_offer/
│   │   └── ...
│   │
│   └── public/js/posapp/         # Frontend
│       ├── api_mapper.js         # API endpoints
│       ├── bus.js                # Event bus
│       ├── format.js             # Formatting
│       └── components/           # Vue components
│           ├── Navbar.js/vue     # Navigation
│           └── pos/              # POS components
│               ├── Pos.js/vue    # Main POS
│               ├── Invoice.js/vue # Invoice
│               ├── Payments.js/vue # Payments
│               ├── ItemsSelector.js/vue # Items
│               ├── OutstandingPayments.js/vue # Settlement
│               └── ...
│
├── app_api_tree.md               # API documentation
├── app_file_structure.md         # This file
├── app_workflow.md               # Workflow
├── app_plan.md                   # Progress
└── README.md                     # Overview
```

## Key Files

### Backend

-   `api/*.py` - API endpoints
-   `posawesome/doctype/*/` - DocType logic

### Frontend

-   `public/js/posapp/posapp.js` - Main entry
-   `public/js/posapp/components/` - Vue components
-   `public/js/posapp/api_mapper.js` - API mapping
