# custom_field.md

## Creation methods

- Via UI: Desk → Customize → Customize Form → Add Row
- Via Python: Use `frappe.get_doc()` with `doctype: 'Custom Field'`

## Python pattern

```python
if not frappe.db.exists('Custom Field', {'dt': 'Sales Invoice', 'fieldname': 'custom_tax_id'}):
    frappe.get_doc({
        'doctype': 'Custom Field',
        'dt': 'Sales Invoice',
        'label': 'Tax ID',
        'fieldname': 'custom_tax_id',
        'fieldtype': 'Data',
        'insert_after': 'customer_name',
        'reqd': 1
    }).insert()
    frappe.db.commit()
```

## Field types

- `Data` - Single line text (140 chars)
- `Text` - Multi-line text
- `Link` - Link to DocType (requires `options`)
- `Select` - Dropdown (options: `Option1\nOption2`)
- `Date` - Date picker
- `Currency` - Money field
- `Float` - Decimal number
- `Check` - Checkbox (0 or 1)
- `Table` - Child table (requires `options`)

## Essential properties

- `fieldname` - Must start with `custom_`
- `label` - Field label
- `fieldtype` - Field type
- `insert_after` - Position after existing field
- `reqd` - Mandatory (1 or 0)
- `hidden` - Hidden field (1 or 0)
- `read_only` - Read-only (1 or 0)
- `default` - Default value
- `options` - For Link/Table (DocType name)
- `in_list_view` - Show in list (1 or 0)
- `depends_on` - Conditional display (`eval:doc.status`)
- `fetch_from` - Auto-fetch (`customer.tax_id`)

## Property setter

```python
frappe.make_property_setter({
    'doctype': 'Sales Invoice',
    'fieldname': 'customer_name',
    'property': 'reqd',
    'value': '1',
    'property_type': 'Check'
})
```

## Bulk creation

```python
def create_custom_fields():
    custom_fields = {
        'Sales Invoice': [
            {
                'fieldname': 'custom_tax_id',
                'label': 'Tax ID',
                'fieldtype': 'Data',
                'insert_after': 'customer_name'
            }
        ]
    }
    for doctype, fields in custom_fields.items():
        for field in fields:
            if not frappe.db.exists('Custom Field', {'dt': doctype, 'fieldname': field['fieldname']}):
                frappe.get_doc({'doctype': 'Custom Field', 'dt': doctype, **field}).insert()
    frappe.db.commit()
```

## Naming rules

- Prefix: `custom_` (required)
- Descriptive: `custom_tax_id`, `custom_delivery_date`
- Avoid: `custom_field1`, `custom_date`
