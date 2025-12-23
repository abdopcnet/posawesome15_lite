# server_script.md

## File locations

- DocType controllers: `/apps/[app]/[app]/[module]/doctype/[doctype]/[doctype].py`
- API methods: `/apps/[app]/[app]/[module]/api.py`
- Hooks: `/apps/[app]/[app]/hooks.py`

## Controller structure

```python
import frappe
from frappe import _
from frappe.model.document import Document

class DocTypeName(Document):
    def validate(self):
        """Called before save"""
        pass

    def on_update(self):
        """Called after save"""
        pass

    def on_submit(self):
        """Called after submit"""
        pass

    def on_cancel(self):
        """Called on cancel"""
        pass
```

## Lifecycle methods

- `validate()` - Before save
- `before_save()` - Before save
- `on_update()` - After save
- `before_submit()` - Before submit
- `on_submit()` - After submit
- `on_cancel()` - On cancel
- `on_trash()` - Before delete

## API methods

```python
@frappe.whitelist()
def method_name(param1, param2):
    # Whitelisted method
    return result
```

## Common operations

- Get value: `frappe.db.get_value('DocType', 'name', 'field')`
- Get list: `frappe.db.get_list('DocType', filters={}, fields=[], limit=10)`
- Set value: `frappe.db.set_value('DocType', 'name', 'field', 'value')` then `frappe.db.commit()`
- SQL query: `frappe.db.sql("SELECT * FROM \`tabDocType\` WHERE field = %s", (value,), as_dict=True)`
- Throw error: `frappe.throw(_("Error message"))`
- Log error: `frappe.log_error(message, "Error Title")`

## Link field query filtering

```python
@frappe.whitelist()
def get_students(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.sql("""
        SELECT DISTINCT u.name, u.full_name
        FROM `tabUser` u
        INNER JOIN `tabHas Role` hr ON hr.parent = u.name
        WHERE hr.role = %(role)s
        AND (u.name LIKE %(txt)s OR u.full_name LIKE %(txt)s)
        LIMIT %(start)s, %(page_len)s
    """, {
        'role': filters.get('role'),
        'txt': f'%{txt}%',
        'start': start,
        'page_len': page_len
    })
```
