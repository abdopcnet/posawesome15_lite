# frappe_site.md

## File locations

- Web pages: `[app]/www/[page].html` + `[app]/www/[page].py`
- Portal pages: `[app]/templates/pages/[page].html` + `[app]/templates/pages/[page].py`
- Print formats: `[app]/[module]/print_format/[name]/[name].html`

## Jinja2 basics

- Variable: `{{ doc.field }}`
- Condition: `{% if condition %}...{% endif %}`
- Loop: `{% for item in doc.items %}...{% endfor %}`
- Format value: `{{ frappe.format_value(doc.amount, {'fieldtype': 'Currency'}) }}`

## Web page structure

```html
{% extends "templates/web.html" %}
{% block title %}Page Title{% endblock %}
{% block page_content %}
<div>{{ content }}</div>
{% endblock %}
```

## Python context

```python
# www/page.py
import frappe

def get_context(context):
    context.items = frappe.get_all('Item', fields=['name', 'item_name'])
    return context
```

## Print format

- Location: `[app]/[module]/print_format/[name]/[name].html`
- Use Jinja2 syntax with `doc` object
- Access via: Desk → Print Format → Create New
