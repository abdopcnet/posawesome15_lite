# POS Awesome - API Structure

## API Endpoints Overview

### Sales Invoice APIs

-   `posawesome.api.sales_invoice.create_invoice` - Create new invoice
-   `posawesome.api.sales_invoice.update_invoice` - Update existing invoice
-   `posawesome.api.sales_invoice.submit_invoice` - Submit invoice
-   `posawesome.api.sales_invoice.delete_invoice` - Delete invoice
-   `posawesome.api.sales_invoice.get_invoices_for_return` - Get invoices for return
-   `posawesome.api.sales_invoice.save_draft_invoice` - Save draft invoice
-   `posawesome.api.sales_invoice.get_draft_invoices` - Get draft invoices
-   `posawesome.api.sales_invoice.get_print_invoices` - Get invoices for printing

### Customer APIs

-   `posawesome.api.customer.get_customer` - Get single customer
-   `posawesome.api.customer.get_many_customers` - Get multiple customers
-   `posawesome.api.customer.get_customers_count` - Get customers count
-   `posawesome.api.customer.create_customer` - Create new customer
-   `posawesome.api.customer.update_customer` - Update customer
-   `posawesome.api.customer.create_customer_address` - Create customer address
-   `posawesome.api.customer.get_customer_credit` - Get customer credit
-   `posawesome.api.customer.get_many_customer_addresses` - Get customer addresses
-   `posawesome.api.customer.get_customer_outstanding_balance` - Get outstanding balance

### Item APIs

-   `posawesome.api.item.get_items` - Get items list
-   `posawesome.api.item.get_items_groups` - Get item groups
-   `posawesome.api.item.get_barcode_item` - Get item by barcode
-   `posawesome.api.item.process_batch_selection` - Process batch selection

### POS Profile APIs

-   `posawesome.api.pos_profile.get_default_payment_from_pos_profile` - Get default payment method
-   `posawesome.api.pos_profile.get_opening_dialog_data` - Get opening dialog data
-   `posawesome.api.pos_profile.get_payment_methods` - Get payment methods

### POS Opening Shift APIs

-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.create_opening_voucher` - Create opening shift
-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_current_shift_name` - Get current shift
-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_all_open_shifts` - Get all open shifts
-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_user_shift_invoice_count` - Get invoice count
-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_profile_users` - Get profile users
-   `posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.check_opening_time_allowed` - Check opening time

### POS Closing Shift APIs

-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.check_closing_time_allowed` - Check closing time
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_cashiers` - Get cashiers list
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_invoices` - Get POS invoices
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_payments_entries` - Get payment entries
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.make_closing_shift_from_opening` - Create closing shift
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.submit_closing_shift` - Submit closing shift
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_payment_totals` - Get payment totals
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_current_cash_total` - Get cash total
-   `posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_current_non_cash_total` - Get non-cash total

### POS Offer APIs

-   `posawesome.posawesome.doctype.pos_offer.pos_offer.get_applicable_offers` - Get applicable offers
-   `posawesome.posawesome.doctype.pos_offer.pos_offer.get_offers_for_profile` - Get offers for profile
-   `posawesome.posawesome.doctype.pos_offer.pos_offer.get_offers` - Apply offers to invoice

### System APIs

-   `posawesome.api.ping.ping` - Ping endpoint (health check)
-   `frappe.client.get` - Frappe standard get
-   `frappe.client.delete` - Frappe standard delete
-   `frappe.ping` - Frappe ping

## API Location Structure

```
posawesome/
├── api/                          # API modules
│   ├── customer.py               # Customer operations
│   ├── item.py                   # Item operations
│   ├── ping.py                   # Health check
│   ├── pos_profile.py            # POS Profile operations
│   └── sales_invoice.py          # Sales Invoice operations
└── posawesome/doctype/           # DocType-specific APIs
    ├── pos_closing_shift/
    │   └── pos_closing_shift.py   # Closing shift APIs
    ├── pos_opening_shift/
    │   └── pos_opening_shift.py   # Opening shift APIs
    └── pos_offer/
        └── pos_offer.py           # Offer APIs
```
