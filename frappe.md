# frappe.md

## Locations

- Frappe: `[bench_path]/apps/frappe/frappe/`
- ERPNext: `[bench_path]/apps/erpnext/erpnext/`
- Apps: `[bench_path]/apps/[app_name]/[app_name]/`
- Sites: `[bench_path]/sites/[site_name]/`

## Core modules

- `api/` - API handlers
- `desk/` - Desk UI (forms, lists, reports)
- `model/` - Data model (Document, BaseDocument)
- `database/` - Database abstraction
- `website/` - Website builder
- `printing/` - Print formats
- `integrations/` - Third-party integrations
- `utils/` - Utility functions

## DocType file pattern

- DocType: "Sales Invoice"
- File: `sales_invoice`
- Table: `tabSales Invoice`
- Child: `tabSales Invoice Item`

## Hooks system

```python
# hooks.py
app_name = "app_name"
app_title = "App Title"

# Installation
before_install = "app.utils.before_install"
after_install = "app.utils.after_install"

# Extend DocType classes
extend_doctype_class = {
    "Web Form": "app.overrides.webform.CustomWebForm"
}

# Document events
doc_events = {
    "DocType": {
        "validate": "app.module.handler",
        "on_submit": ["app.module.handler1", "app.module.handler2"]
    }
}

# Override methods
override_whitelisted_methods = {
    "frappe.method.path": "app.overrides.custom_method"
}

# Scheduler
scheduler_events = {
    "hourly": ["app.tasks.hourly_task"],
    "daily": ["app.tasks.daily_task"]
}

# Fixtures
fixtures = ["Custom Field", "Property Setter"]
```

## Integration patterns

- Check installed apps: `installed_apps = frappe.get_installed_apps()`
- Create integration request: `from frappe.integrations.utils import create_request_log`
- Call hook methods: `from frappe.utils import call_hook_method`
