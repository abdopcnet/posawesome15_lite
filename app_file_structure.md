# POS Awesome - File Structure

## Directory Structure

```
posawesome/
├── posawesome/                    # Main app package
│   ├── __init__.py
│   ├── hooks.py                   # Frappe hooks configuration
│   ├── modules.txt                # App modules list
│   ├── patches.txt                # Database patches
│   │
│   ├── api/                       # API modules
│   │   ├── __init__.py
│   │   ├── before_cancel.py       # Before cancel hooks
│   │   ├── customer.py            # Customer API
│   │   ├── item.py                # Item API
│   │   ├── ping.py                # Ping API
│   │   ├── pos_profile.py         # POS Profile API
│   │   └── sales_invoice.py       # Sales Invoice API
│   │
│   ├── config/                    # Configuration files
│   │
│   ├── fixtures/                  # Fixtures data
│   │
│   ├── posawesome/                # DocTypes and customizations
│   │   ├── custom/                # Custom scripts
│   │   ├── doctype/               # Custom DocTypes
│   │   │   ├── pos_closing_shift/
│   │   │   ├── pos_closing_shift_detail/
│   │   │   ├── pos_closing_shift_taxes/
│   │   │   ├── pos_coupon/
│   │   │   ├── pos_coupon_detail/
│   │   │   ├── pos_offer/
│   │   │   ├── pos_offer_detail/
│   │   │   ├── pos_opening_shift/
│   │   │   ├── pos_opening_shift_detail/
│   │   │   ├── pos_payment_entry_reference/
│   │   │   ├── referral_code/
│   │   │   └── sales_invoice_reference/
│   │   ├── page/                  # Custom pages
│   │   ├── print_format/          # Print formats
│   │   ├── report/                # Custom reports
│   │   └── workspace/             # Workspace configurations
│   │
│   └── public/                    # Frontend assets
│       ├── css/                   # Stylesheets
│       ├── dist/                  # Compiled bundles
│       ├── images/                # Image assets
│       ├── js/                    # JavaScript files
│       │   ├── posapp/            # POS application
│       │   │   ├── api_mapper.js  # API endpoint mapper
│       │   │   ├── bus.js         # Event bus
│       │   │   ├── format.js      # Formatting utilities
│       │   │   ├── Home.js        # Home component
│       │   │   ├── Home.vue       # Home Vue component
│       │   │   ├── posapp.js      # Main POS app entry
│       │   │   └── components/    # Vue components
│       │   │       ├── Navbar.js  # Navbar component
│       │   │       ├── Navbar.vue
│       │   │       └── pos/       # POS-specific components
│       │   ├── pos_profile.js    # POS Profile form script
│       │   ├── invoice.js        # Invoice form script
│       │   ├── sales_invoice.js   # Sales Invoice form script
│       │   └── company.js         # Company form script
│       └── node_modules/          # Node dependencies
│
├── AGENTS.md                      # Agent rules and guidelines
├── README.md                      # App overview and features
├── app_api_tree.md               # API structure documentation
├── app_file_structure.md         # This file
├── app_workflow.md               # Workflow documentation
├── app_plan.md                  # Progress tracking
├── plan.md                      # Development plan
├── package.json                 # Node.js dependencies
├── pyproject.toml              # Python project config
└── yarn.lock                    # Yarn lock file
```

## Key Files

### Backend (Python)

-   `hooks.py` - Frappe hooks and app configuration
-   `api/*.py` - API endpoint modules
-   `posawesome/doctype/*/` - DocType definitions and logic

### Frontend (JavaScript/Vue)

-   `public/js/posapp/posapp.js` - Main POS app entry point
-   `public/js/posapp/api_mapper.js` - API endpoint mapping
-   `public/js/posapp/components/` - Vue.js components
-   `public/js/posapp/components/pos/` - POS-specific components

### Configuration

-   `hooks.py` - App hooks, doctype_js, doc_events
-   `package.json` - Frontend dependencies
-   `pyproject.toml` - Python project configuration
