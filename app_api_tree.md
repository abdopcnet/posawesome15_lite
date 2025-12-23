# POS Awesome - API Structure

## API Modules

### Sales Invoice

-   `create_invoice` - Create new invoice
-   `update_invoice` - Update existing invoice
-   `submit_invoice` - Submit invoice
-   `delete_invoice` - Delete invoice
-   `get_invoices_for_return` - Get invoices for return
-   `save_draft_invoice` - Save draft invoice
-   `get_draft_invoices` - Get draft invoices
-   `get_print_invoices` - Get invoices for printing
-   `get_settlement_invoices` - Get outstanding invoices for payment
-   `create_payment_entry_for_invoice` - Create payment entry for settlement

### Customer

-   `get_customer` - Get single customer
-   `get_many_customers` - Get multiple customers
-   `get_customers_count` - Get customers count
-   `create_customer` - Create new customer
-   `update_customer` - Update customer
-   `create_customer_address` - Create customer address
-   `get_customer_credit` - Get customer credit
-   `get_many_customer_addresses` - Get customer addresses
-   `get_customer_outstanding_balance` - Get outstanding balance

### Item

-   `get_items` - Get items list
-   `get_items_groups` - Get item groups
-   `get_barcode_item` - Get item by barcode
-   `process_batch_selection` - Process batch selection

### POS Profile

-   `get_default_payment_from_pos_profile` - Get default payment method
-   `get_opening_dialog_data` - Get opening dialog data
-   `get_payment_methods` - Get payment methods

### POS Opening Shift

-   `create_opening_voucher` - Create opening shift
-   `get_current_shift_name` - Get current shift
-   `get_all_open_shifts` - Get all open shifts
-   `get_user_shift_invoice_count` - Get invoice count
-   `get_profile_users` - Get profile users
-   `check_opening_time_allowed` - Check opening time
-   `check_shift_is_open` - Check shift status

### POS Closing Shift

-   `check_closing_time_allowed` - Check closing time
-   `get_cashiers` - Get cashiers list
-   `get_pos_invoices` - Get POS invoices
-   `get_payments_entries` - Get payment entries
-   `make_closing_shift_from_opening` - Create closing shift
-   `submit_closing_shift` - Submit closing shift
-   `get_payment_totals` - Get payment totals
-   `get_current_cash_total` - Get cash total
-   `get_current_non_cash_total` - Get non-cash total

### POS Offer

-   `get_applicable_offers` - Get applicable offers
-   `get_offers_for_profile` - Get offers for profile
-   `get_offers` - Apply offers to invoice

### System

-   `ping` - Health check endpoint

## API Location

```
posawesome/
├── api/                          # API modules
│   ├── customer.py
│   ├── item.py
│   ├── ping.py
│   ├── pos_profile.py
│   └── sales_invoice.py
└── posawesome/doctype/           # DocType APIs
    ├── pos_closing_shift/
    ├── pos_opening_shift/
    └── pos_offer/
```
