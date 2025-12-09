# Frappe/ERPNext v15 Development Agent

**Framework Versions:** Frappe v15.x, ERPNext v15.x, Python 3.10, Node.js 20.x

---

## 1. FIELD NAMING & DATA INTEGRITY 📌

1. Use only real DB field names from the schema.
2. No fake/temp/abbrev fields; only actual table fields.
3. Verify fields via DB schema or DocType JSON before use.

---

## 2. CODE ANALYSIS PRINCIPLES 🧭

1. Base answers on actual code analysis only.
2. Understand architecture before proposing solutions.
3. Read the real files; no guesses.

---

## 3. CORE SYSTEM APPLICATIONS REFERENCE 🏛️

1. Reference `/home/frappe/frappe-bench/apps/frappe` for patterns.
2. Reference `/home/frappe/frappe-bench/apps/erpnext` for patterns.
3. Search these apps to learn structure and best practices.

---

## 4. DATABASE MODIFICATION PROTOCOL 🔒

1. Never modify DB without explicit permission.
2. Always ask before DROP/ALTER/INSERT/UPDATE.

### 4.1. DATABASE FIELD QUERY PROTOCOL ✅

1. Use: `bench --site all mariadb -e "DESCRIBE \`tabTableName\`;\"` to inspect fields.
2. Replace `TableName` with actual DocType (e.g., `tabPOS Profile`).
3. Never assume field names; always verify first.
4. Common tables to inspect:
   - `tabDocType` - All doctypes in system
   - `tabDocField` - System fields
   - `tabCustom Field` - Custom fields
   - `tabError Log` - Error records
5. Example: `bench --site all mariadb -e "DESCRIBE \`tabSales Invoice\`;\"`

### 4.2. FIND DOCTYPE FILES PROTOCOL

1. Convert DocType name to lowercase with underscores (e.g., "POS Opening Shift" → "pos_opening_shift").
2. Use: `find . -type f \( -iname 'doctype_name.json' -o -iname 'doctype_name.py' -o -iname 'doctype_name.js' \)`

### 4.3. RULE COMMAND TROUBLESHOOTING PROTOCOL

1. If a rule command fails, check syntax, bench env, site, DB connection, table exists.
2. If blocked, explain cause, ask user to run, fallback to DocType JSON only as last resort.

---

## 5. CRITICAL SECURITY PATTERNS 🔐

### SQL Injection Prevention

**NEVER use string formatting in SQL queries. ALWAYS use parameterized queries.**

```python
# ❌ WRONG - SQL Injection Vulnerable
result = frappe.db.sql(f"SELECT * FROM tabCustomer WHERE name='{user_input}'")

# ✅ CORRECT - Parameterized query
result = frappe.db.sql("SELECT * FROM tabCustomer WHERE name=%s", [user_input])

# ✅ BETTER - Use ORM methods
result = frappe.db.get_value("Customer", user_input, ["name", "customer_name"])

# ✅ BEST - Use get_list (automatically checks permissions)
customers = frappe.get_list("Customer",
    filters={"customer_name": ["like", f"%{search_term}%"]},
    fields=["name", "customer_name"]
)
```

### API Security (Whitelisted Methods)

**ALWAYS check permissions explicitly in whitelisted methods.**

```python
# ❌ WRONG - Bypasses all permissions
@frappe.whitelist()
def get_sensitive_data(doctype: str, name: str):
    return frappe.get_doc(doctype, name)  # NO PERMISSION CHECK!

# ✅ CORRECT - Explicit permission check
@frappe.whitelist()
def get_sensitive_data(doctype: str, name: str):
    frappe.only_for("System Manager")  # Role-based restriction
    doc = frappe.get_doc(doctype, name)
    doc.check_permission("read")  # Document-level permission check
    return doc

# ✅ BEST - Multiple permission layers
@frappe.whitelist()
def update_customer_credit(customer: str, new_limit: float):
    frappe.only_for("Accounts Manager")  # Layer 1: Role check
    doc = frappe.get_doc("Customer", customer)
    doc.check_permission("write")  # Layer 2: Document permission
    if new_limit < 0:
        frappe.throw("Credit limit cannot be negative")  # Layer 3: Validation
    doc.db_set("credit_limit", new_limit)
    return {"success": True}
```

### Security Rules

1. **Never use `ignore_permissions=True`** without explicit role/permission checks first
2. **Add type annotations** to whitelisted methods (v15 requirement)
3. **Use `frappe.get_list()` instead of `frappe.get_all()`** - get_list checks permissions
4. **Never use `eval()` or `exec()`** with user input
5. **Check document permissions** after `frappe.get_doc()` in whitelisted methods

---

## 6. FRAMEWORK STANDARDS 🎯

### Naming Conventions

- **DocType:** Title Case, singular (e.g., "Sales Order", "Purchase Receipt")
- **Field names:** snake_case (e.g., `customer_name`, `grand_total`)
- **Variables:** snake_case (e.g., `sales_order = frappe.get_doc("Sales Order", "SO-0001")`)
- **Code Style:** Double quotes for strings, tabs for indentation, wrap user-facing strings in `_("")` for Python, `__("")` for JavaScript

### Essential Database Operations

```python
# Get single value
value = frappe.db.get_value("Customer", "CUST-001", "territory")

# Get multiple fields as dict
customer = frappe.db.get_value("Customer", "CUST-001",
    ["customer_name", "territory"], as_dict=True)

# Check existence
if frappe.db.exists("Customer", customer_name):
    pass

# Count records
count = frappe.db.count("Sales Order", {"status": "Draft"})

# Bulk operations (MUCH faster than loops)
frappe.db.bulk_insert("DocType",
    fields=["field1", "field2"],
    values=[[val1, val2], [val3, val4]],
    chunk_size=10000
)
```

### Frappe Query Builder (v15 Preferred)

```python
from frappe.query_builder import DocType, functions as fn

# Basic query
Item = DocType("Item")
items = (
    frappe.qb.from_(Item)
    .select(Item.name, Item.item_name, Item.item_group)
    .where(Item.disabled == 0)
).run(as_dict=True)

# Complex query with joins
SalesOrder = DocType("Sales Order")
Customer = DocType("Customer")

orders = (
    frappe.qb.from_(SalesOrder)
    .join(Customer).on(SalesOrder.customer == Customer.name)
    .select(SalesOrder.name, SalesOrder.grand_total, Customer.customer_name)
    .where(SalesOrder.docstatus == 1)
).run(as_dict=True)
```

### Essential Utilities

```python
from frappe.utils import flt, cint, cstr, nowdate, today, getdate, add_days

# Safe type conversions
amount = flt(user_input, precision=2)  # Float (returns 0.0 for None)
quantity = cint(user_input)  # Integer (returns 0 for None/"")
text = cstr(user_input)  # String

# Date operations
today_date = today()  # Returns YYYY-MM-DD string
future_date = add_days(today(), 30)
date_obj = getdate("2025-01-15")  # Returns datetime.date object
```

### Caching (Use for Expensive Operations)

```python
# Basic caching
frappe.cache.set_value("cache_key", expensive_result, expires_in_sec=3600)
result = frappe.cache.get_value("cache_key")

# Cached documents (10000x faster)
system_settings = frappe.get_cached_doc("System Settings")
company_doc = frappe.get_cached_doc("Company", "Company ABC")

# Decorator for function caching
from frappe.utils.caching import redis_cache

@redis_cache(ttl=3600)
def calculate_complex_pricing(item_code: str, customer: str) -> dict:
    return perform_pricing_logic(item_code, customer)
```

### Background Jobs (Use for Long Operations)

```python
# Enqueue background job
frappe.enqueue(
    method="myapp.tasks.process_large_file",
    queue="long",  # Options: short (2 min), default (5 min), long (30 min)
    timeout=1500,
    file_path=file_path,
    user=frappe.session.user
)

# Pattern for background processing with user feedback
def process_import(doc):
    frappe.enqueue(
        method="myapp.api.import_handler.process_import_background",
        queue="long",
        timeout=1800,
        doc_name=doc.name
    )
    frappe.msgprint("Import started in background. You will be notified when complete.")
```

---

## 7. CONTROLLER PATTERNS 🎛️

### Extending Standard DocTypes (Use hooks.py)

**NEVER modify core Frappe/ERPNext files. ALWAYS use hooks.py in your custom app.**

**Method 1: Document Events Hook (Recommended)**

```python
# hooks.py
doc_events = {
    "Sales Order": {
        "validate": "custom_app.overrides.sales_order.validate_custom",
        "on_submit": "custom_app.overrides.sales_order.on_submit_custom"
    }
}

# custom_app/overrides/sales_order.py
import frappe
from frappe import _

def validate_custom(doc, method):
    if doc.custom_discount_percent and doc.custom_discount_percent > 20:
        frappe.throw(_("Discount cannot exceed 20%"))
```

**Method 2: Controller Override (For Replacing Entire Class)**

```python
# hooks.py
override_doctype_class = {
    "Sales Order": "custom_app.overrides.sales_order.CustomSalesOrder"
}

# custom_app/overrides/sales_order.py
from erpnext.selling.doctype.sales_order.sales_order import SalesOrder

class CustomSalesOrder(SalesOrder):
    def validate(self):
        super().validate()  # ALWAYS call parent first
        self.validate_custom_requirements()

    def on_submit(self):
        super().on_submit()  # ALWAYS call parent first
        self.create_linked_documents()
```

### Controller Base Classes

```python
from erpnext.controllers.accounts_controller import AccountsController
from erpnext.controllers.stock_controller import StockController
from erpnext.controllers.selling_controller import SellingController
from frappe.model.document import Document

# For accounting document (gets GL entries, taxes automatically)
class CustomInvoice(AccountsController):
    def validate(self):
        super().validate()  # Calculates taxes, totals, GL entries

# For stock document (gets stock ledger entries automatically)
class CustomStockMovement(StockController):
    def validate(self):
        super().validate()  # Creates stock ledger entries

# For simple custom DocType
class CustomDocType(Document):
    def validate(self):
        self.validate_mandatory_fields()
```

### Document Lifecycle Hooks (Execution Order)

1. `before_insert` - Before creating new document
2. `before_naming` / `autoname` - Custom naming logic
3. `before_validate`
4. `validate` - **Most commonly used for validation**
5. `before_save`
6. `before_submit` - For submittable documents
7. `after_insert`
8. `on_update` - After save to database
9. `on_submit` - **Most commonly used for post-submission logic**
10. `on_cancel` - **Must handle cleanup/reversal**

---

## 8. ERPNext v15 Specific ⚡

### Serial and Batch Bundle (V15 CRITICAL)

**IMPORTANT:** In v15, serial numbers use the Serial and Batch Bundle system, not text fields.

```python
from erpnext.stock.serial_batch_bundle import SerialBatchCreation

# Create Serial and Batch Bundle
def create_serial_bundle(item_code, warehouse, serial_numbers, qty, rate):
    bundle = SerialBatchCreation({
        "item_code": item_code,
        "warehouse": warehouse,
        "type_of_transaction": "Inward",  # or "Outward"
        "qty": qty,
        "rate": rate,
        "entries": [{"serial_no": sn} for sn in serial_numbers]
    }).make_serial_and_batch_bundle()
    return bundle.name

# Fetch serial numbers from bundle
def get_serial_numbers_from_bundle(bundle_name):
    if not bundle_name:
        return []
    bundle = frappe.get_doc("Serial and Batch Bundle", bundle_name)
    return [entry.serial_no for entry in bundle.entries]
```

---

## 9. PERFORMANCE OPTIMIZATION 🚀

### Database Query Optimization

```python
# ❌ WRONG - N+1 query problem
for item in items:
    warehouse = frappe.get_doc("Warehouse", item.warehouse)  # Separate query each time!

# ✅ CORRECT - Bulk fetch
warehouse_names = list(set([item.warehouse for item in items]))
warehouses = frappe.get_all("Warehouse",
    filters={"name": ["in", warehouse_names]},
    fields=["name", "warehouse_name"]
)
warehouse_map = {w.name: w for w in warehouses}

# ❌ WRONG - Fetching all fields
docs = frappe.get_all("Sales Invoice")  # Gets all columns unnecessarily

# ✅ CORRECT - Select only needed fields
docs = frappe.get_all("Sales Invoice",
    fields=["name", "customer", "grand_total"])

# ❌ WRONG - Multiple db_set calls
doc.db_set("status", "Completed")
doc.db_set("completion_date", today())

# ✅ CORRECT - Single update
doc.db_set({
    "status": "Completed",
    "completion_date": today()
})
```

---

## 10. DEVELOPMENT WORKFLOW 🧭

1. Manual read/write; avoid bulk modify commands.
2. Update `plan.md` before changes; document modifications.
3. Read files fully before editing; use read tools, not broad search.

---

## 11. CODE QUALITY STANDARDS 🎛️

1. Review syntax every time before saving.
2. Keep formatting consistent; follow project style.
3. Write English comments above sections (not beside code).

---

## 12. COMMON PATTERNS 📋

### Pattern 1: Custom DocType with Validation

```python
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate

class ProjectMilestone(Document):
    def validate(self):
        self.validate_dates()
        self.calculate_totals()

    def validate_dates(self):
        if self.end_date and self.start_date:
            if getdate(self.end_date) < getdate(self.start_date):
                frappe.throw(_("End Date cannot be before Start Date"))

    def calculate_totals(self):
        if self.total_tasks:
            self.completion_percentage = (flt(self.completed_tasks) / flt(self.total_tasks)) * 100
```

### Pattern 2: Whitelisted API Method with Security

```python
@frappe.whitelist()
def get_customer_summary(customer: str) -> dict:
    """Get customer summary with orders and outstanding"""
    frappe.only_for("Sales User")  # Permission check

    if not frappe.db.exists("Customer", customer):
        frappe.throw(_("Customer {0} not found").format(customer))

    customer_doc = frappe.get_doc("Customer", customer)
    customer_doc.check_permission("read")

    orders = frappe.db.sql("""
        SELECT COUNT(*) as total_orders,
               SUM(CASE WHEN docstatus = 1 THEN grand_total ELSE 0 END) as total_revenue
        FROM `tabSales Order`
        WHERE customer = %s
    """, [customer], as_dict=True)[0]

    return {
        "customer_name": customer_doc.customer_name,
        "total_orders": orders.total_orders or 0,
        "total_revenue": orders.total_revenue or 0.0
    }
```

### Pattern 3: Client-Side Script (Form Customization)

```javascript
frappe.ui.form.on("Sales Order", {
  refresh: function (frm) {
    if (frm.doc.docstatus === 1) {
      frm.add_custom_button(__("Create Project"), function () {
        create_project_from_order(frm);
      });
    }
  },

  customer: function (frm) {
    if (frm.doc.customer) {
      frappe.call({
        method: "custom_app.api.customer.get_customer_summary",
        args: { customer: frm.doc.customer },
        callback: function (r) {
          if (r.message) {
            frm.set_value("custom_total_orders", r.message.total_orders);
          }
        },
      });
    }
  },
});
```

---

## 13. RESPONSE POLICY ✅

1. Always reply with numbered points.
2. Keep English short and simple for Arabic readers; avoid idioms and long sentences.
3. End every reply with `Applied rules:` then list only the sections you actually used in your response (one line per section, no numbers), then finish with ✅:
   - `📌 FIELD NAMING & DATA INTEGRITY`
   - `🧭 CODE ANALYSIS PRINCIPLES`
   - `🏛️ CORE SYSTEM APPLICATIONS REFERENCE`
   - `🔒 DATABASE MODIFICATION PROTOCOL`
   - `🔐 CRITICAL SECURITY PATTERNS`
   - `🎯 FRAMEWORK STANDARDS`
   - `🎛️ CONTROLLER PATTERNS`
   - `⚡ ERPNext v15 Specific`
   - `🚀 PERFORMANCE OPTIMIZATION`
   - `🧭 DEVELOPMENT WORKFLOW`
   - `🎛️ CODE QUALITY STANDARDS`
   - `📋 COMMON PATTERNS`
   - `✅ RESPONSE POLICY`

---

## Quick Reference

### Essential Imports

```python
import frappe
from frappe import _
from frappe.utils import flt, cint, cstr, nowdate, today, getdate
from frappe.model.document import Document
```

### Common Frappe Functions

```python
# Document operations
doc = frappe.get_doc(doctype, name)
docs = frappe.get_list("DocType", filters={}, fields=[])  # With permissions

# Database operations
value = frappe.db.get_value("DocType", name, fieldname)
exists = frappe.db.exists("DocType", name)
frappe.db.set_value("DocType", name, fieldname, value)

# Permissions
frappe.only_for("Role Name")
doc.check_permission("read")

# Background jobs
frappe.enqueue(method="path.to.function", queue="default")

# Caching
frappe.cache.set_value(key, value, expires_in_sec=3600)
frappe.get_cached_doc("DocType", name)
```
