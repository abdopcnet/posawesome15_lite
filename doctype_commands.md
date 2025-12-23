# doctype_commands.md

## File structure

```
/apps/[app]/[app]/[module]/doctype/[doctype_name]/
├── __init__.py
├── [doctype_name].json          # DocType definition
├── [doctype_name].py            # Python controller
├── [doctype_name].js            # Client script
├── [doctype_name]_list.js       # List view (optional)
└── test_[doctype_name].py       # Unit tests
```

## JSON structure

```json
{
  "doctype": "DocType",
  "name": "Custom Order",
  "module": "My Module",
  "autoname": "field:order_id",
  "is_submittable": 1,
  "field_order": ["order_id", "customer", "items"],
  "fields": [
    {
      "fieldname": "order_id",
      "fieldtype": "Data",
      "label": "Order ID",
      "reqd": 1
    }
  ],
  "permissions": [
    {
      "role": "System Manager",
      "create": 1,
      "read": 1,
      "write": 1
    }
  ]
}
```

## Python controller

```python
import frappe
from frappe import _
from frappe.model.document import Document

class CustomOrder(Document):
    def validate(self):
        self.calculate_total()

    def on_submit(self):
        # Post-submit logic
        pass

    def on_cancel(self):
        # Cancel logic
        pass
```

## Field types

- `Data` - Single line text (140 chars max)
- `Text` - Multi-line text
- `Link` - Link to DocType (requires `options`)
- `Select` - Dropdown (options: `Option1\nOption2`)
- `Date` - Date picker
- `Currency` - Money field
- `Float` - Decimal number
- `Check` - Checkbox (0 or 1)
- `Table` - Child table (requires `options`)

## Autoname patterns

- Field value: `"autoname": "field:order_id"`
- Naming series: `"autoname": "naming_series:"`
- Format string: `"autoname": "format:ORD-{YYYY}-{####}"`
- User input: `"autoname": "Prompt"`

## Bench commands

- Reload DocType: `bench --site [site] reload-doctype "DocType Name"`
- Migrate: `bench --site [site] migrate`
- Clear cache: `bench --site [site] clear-cache`

## Child DocTypes

- Parent: `"fieldtype": "Table"`, `"options": "Child DocType Name"`
- Child: `"istable": 1`, must have `parent`, `parenttype`, `parentfield` fields

## Single DocTypes

- Pattern: `"issingle": 1`
- Access: `frappe.db.get_single_value("Settings Name", "field")` or `frappe.get_single("Settings Name")`
