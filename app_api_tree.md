# POS Awesome - API Structure

## Sales Invoice API

-   `save_draft_invoice` - Save invoice as draft
-   `get_draft_invoices` - Get draft invoices
-   `delete_invoice` - Delete invoice
-   `get_invoices_for_return` - Get invoices for return
-   `get_settlement_invoices` - Get outstanding invoices for settlement
-   `get_print_invoices` - Get invoices for printing
-   `create_and_submit_invoice` - Create and submit invoice
-   `create_payment_entry_for_invoice` - Create payment entry for invoice

## Payment Entry API

-   `create_payment_entry_for_invoice` - Create payment entry for single payment
-   `create_payment_entry_for_multiple_payments` - Create payment entries for multiple payments

## Customer API

-   `create_customer` - Create new customer
-   `get_customer` - Get single customer
-   `get_many_customers` - Search customers
-   `get_customers_count` - Get customers count
-   `update_customer` - Update customer
-   `create_customer_address` - Create customer address
-   `get_many_customer_addresses` - Get customer addresses
-   `get_customer_credit` - Get customer credit
-   `get_customer_credit_summary` - Get customer credit summary
-   `get_customer_outstanding_balance` - Get customer outstanding balance

## Item API

-   `get_items` - Get items list
-   `get_items_groups` - Get item groups
-   `get_barcode_item` - Get item by barcode
-   `process_batch_selection` - Process batch selection

## POS Profile API

-   `get_default_payment_from_pos_profile` - Get default payment method
-   `get_opening_dialog_data` - Get opening dialog data
-   `get_payment_methods` - Get payment methods
-   `get_profile_users` - Get profile users
-   `get_profile_warehouses` - Get profile warehouses

## POS Opening Shift API

-   `check_opening_time_allowed` - Check opening time allowed
-   `create_opening_voucher` - Create opening shift
-   `get_current_shift_name` - Get current shift
-   `check_shift_is_open` - Check shift status
-   `get_all_open_shifts` - Get all open shifts
-   `get_user_shift_invoice_count` - Get invoice count

## POS Closing Shift API

-   `submit_closing_shift` - Submit closing shift
-   `check_closing_time_allowed` - Check closing time allowed
-   `get_cashiers` - Get cashiers list
-   `get_pos_invoices` - Get POS invoices
-   `get_payments_entries` - Get payment entries
-   `get_payment_totals` - Get payment totals
-   `get_current_cash_total` - Get cash total
-   `get_current_non_cash_total` - Get non-cash total
-   `make_closing_shift_from_opening` - Create closing shift from opening

## POS Offer API

-   `get_offers` - Apply offers to invoice
-   `get_applicable_offers` - Get applied offers from invoice
-   `get_offers_for_profile` - Get offers for profile

## System API

-   `ping` - Health check endpoint
