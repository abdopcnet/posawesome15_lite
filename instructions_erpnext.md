# erpnext.md

## Module structure

- `accounts/` - Financial accounting
- `selling/` - Sales (Quotation, Sales Order, Delivery Note, Sales Invoice)
- `buying/` - Procurement (Purchase Order, Purchase Receipt, Purchase Invoice)
- `stock/` - Inventory management
- `manufacturing/` - Production
- `crm/` - Customer relationship
- `projects/` - Project management
- `controllers/` - Base controllers

## Key DocTypes

- Accounts: Sales Invoice, Purchase Invoice, Payment Entry, Journal Entry, GL Entry, Account
- Selling: Quotation → Sales Order → Delivery Note → Sales Invoice
- Buying: Supplier Quotation → Purchase Order → Purchase Receipt → Purchase Invoice
- Stock: Stock Entry, Item, Warehouse, Stock Ledger Entry, Batch, Serial Number

## Common controllers

```python
from erpnext.controllers.accounts_controller import AccountsController
from erpnext.selling.doctype.sales_order.sales_order import SalesOrder

class CustomSalesInvoice(AccountsController):
    def validate(self):
        super().validate()
        # Custom validation
```
