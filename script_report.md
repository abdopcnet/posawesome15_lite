# script_report.md

## File structure

```
[app]/[module]/report/[report_name]/
├── [report_name].json    # Filters definition
├── [report_name].py      # Main logic
└── [report_name].js      # Optional client-side customization
```

## Python structure

```python
import frappe
from frappe import _

def execute(filters=None):
    """Main report function"""
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    """Define report columns"""
    return [
        {
            "fieldname": "name",
            "label": _("Name"),
            "fieldtype": "Link",
            "options": "DocType",
            "width": 150
        }
    ]

def get_data(filters):
    """Fetch report data"""
    conditions = get_conditions(filters)
    return frappe.db.sql("""
        SELECT name, field, total
        FROM `tabDocType`
        WHERE docstatus = 1
        {conditions}
        ORDER BY creation DESC
    """.format(conditions=conditions), filters, as_dict=1)
```

## Filters (JSON)

```json
{
  "filters": [
    {
      "fieldname": "from_date",
      "label": "From Date",
      "fieldtype": "Date",
      "reqd": 1
    }
  ]
}
```

## Return values

- `columns` - List of column definitions
- `data` - List of dictionaries with report data
- `message` - Optional message to display
- `chart` - Optional chart configuration
- `report_summary` - Optional summary data
