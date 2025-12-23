# AGENTS.md

---

## 1. General Instructions & Response Style

### General Instructions

-   All responses must be in English only
-   All code content, comments, messages must be in English only
-   Work ONLY based on existing rules - If no rule exists, show PROMPT format and wait for user guidance
-   Never modify core - Don't edit frappe/erpnext/hrms core applications files
-   JSON files - Don't edit or create JSON files, just prompt the user

### Documentation

-   Respect AGENTS.md in every chat
-   Read app documentation first - Read existing app md files or create new as app knowledge base
-   Update progress - Update documentation with every progress made
-   Required files in app directory: `app_api_tree.md`, `app_file_structure.md`, `app_workflow.md`, `app_plan.md`, `README.md`

### Response Format

-   End with Applied Rules section as numbered list
-   Format: `Applied Rules: 1. RULE NAME (filename.md) 2. RULE NAME (filename.md)`

### User Inquiry Style

-   When user asks a question or reports an issue:
    1.  First, understand the context by reading relevant files
    2.  If unclear, ask specific questions to clarify
    3.  Show the solution step by step
    4.  Explain what was changed and why
-   If a rule doesn't exist, show PROMPT format and wait for user guidance
-   Never assume - Always verify before making changes

### Frappe Framework Structure

-   Bench: `[bench_path]/` (e.g., `/home/frappe/frappe-bench/`, `/home/frappe/frappe-bench-15/`)
-   Apps: `[bench_path]/apps/`
-   Sites: `[bench_path]/sites/`

### Core Applications

-   frappe
-   erpnext
-   hrms

---

## 2. System & Debugging

### Network Debug

#### Prerequisites

-   Run this FIRST before checking Frappe-specific issues

#### Check Running Ports

-   All listening ports: `sudo netstat -tulpn | grep LISTEN` or `sudo ss -tulpn | grep LISTEN`
-   Web server (8000): `sudo netstat -tulpn | grep :8000`
-   Socket.IO (9000): `sudo netstat -tulpn | grep :9000`
-   Redis Cache (13000): `sudo netstat -tulpn | grep :13000`
-   Redis Queue (11000): `sudo netstat -tulpn | grep :11000`
-   MariaDB (3306): `sudo netstat -tulpn | grep :3306`

#### Check Service Status

-   Bench processes: `ps aux | grep bench`
-   Redis: `sudo systemctl status redis`
-   MariaDB: `sudo systemctl status mariadb` or `sudo systemctl status mysql`
-   Nginx: `sudo systemctl status nginx`

#### Check Network Connectivity

-   Test localhost: `curl http://localhost:8000`
-   Test specific IP: `curl http://[server_ip]/`
-   Check port: `telnet localhost 8000` or `nc -zv localhost 8000`

#### Check Firewall

-   Check status: `sudo ufw status` or `sudo firewall-cmd --list-all`
-   Allow ports: `sudo ufw allow 8000/tcp` or `sudo firewall-cmd --add-port=8000/tcp --permanent`

#### Common Issues

-   Port not listening: Check if service is running, check firewall
-   Connection refused: Service not running or firewall blocking
-   Timeout: Network issue or service not responding

### Bench Debug

#### Prerequisites

-   Run `network_debug.md` first for system-level issues
-   Ensure ports are listening: 8000, 9000, 13000, 11000, 3306
-   System services running: Redis, MariaDB

#### Common Commands

-   Check bench status: `bench status`
-   View logs: `tail -f logs/web.log`
-   Clear cache: `bench --site [site] clear-cache`
-   Restart: `bench restart`
-   Run migrations: `bench --site [site] migrate`

#### Common Issues

-   Bench not starting: Check ports, restart Redis/MariaDB, clear cache
-   404 errors: Clear cache, rebuild website, check site exists
-   Database errors: Restart MariaDB, check credentials in `site_config.json`
-   Redis errors: Restart Redis, check config files
-   Permission errors: Fix ownership with `chown -R frappe:frappe [bench_path]`
-   Migration TypeError (module **file** is None): Check `modules.txt`, ensure all modules have `__init__.py` files

#### Log Files

-   Web server: `logs/web.log`
-   Socket.IO: `logs/socketio.log`
-   Workers: `logs/worker.log`
-   Schedule: `logs/schedule.log`
-   Site logs: `sites/[site]/logs/web.log`

#### Configuration Files

-   Bench config: `config/common_site_config.json`
-   Site config: `sites/[site]/site_config.json`
-   Process file: `Procfile`
-   Redis config: `config/redis_cache.conf`, `config/redis_queue.conf`

---

## 3. Frappe Framework

### Frappe Framework

#### Locations

-   Frappe: `[bench_path]/apps/frappe/frappe/`
-   ERPNext: `[bench_path]/apps/erpnext/erpnext/`
-   Apps: `[bench_path]/apps/[app_name]/[app_name]/`
-   Sites: `[bench_path]/sites/[site_name]/`

#### Core Modules

-   `api/` - API handlers
-   `desk/` - Desk UI (forms, lists, reports)
-   `model/` - Data model (Document, BaseDocument)
-   `database/` - Database abstraction
-   `website/` - Website builder
-   `printing/` - Print formats
-   `integrations/` - Third-party integrations
-   `utils/` - Utility functions

#### DocType File Pattern

-   DocType: "Sales Invoice"
-   File: `sales_invoice`
-   Table: `tabSales Invoice`
-   Child: `tabSales Invoice Item`

#### Hooks System

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

#### Integration Patterns

-   Check installed apps: `installed_apps = frappe.get_installed_apps()`
-   Create integration request: `from frappe.integrations.utils import create_request_log`
-   Call hook methods: `from frappe.utils import call_hook_method`

### Frappe Site

#### File Locations

-   Web pages: `[app]/www/[page].html` + `[app]/www/[page].py`
-   Portal pages: `[app]/templates/pages/[page].html` + `[app]/templates/pages/[page].py`
-   Print formats: `[app]/[module]/print_format/[name]/[name].html`

#### Jinja2 Basics

-   Variable: `{{ doc.field }}`
-   Condition: `{% if condition %}...{% endif %}`
-   Loop: `{% for item in doc.items %}...{% endfor %}`
-   Format value: `{{ frappe.format_value(doc.amount, {'fieldtype': 'Currency'}) }}`

#### Web Page Structure

```html
{% extends "templates/web.html" %} {% block title %}Page Title{% endblock %} {% block page_content
%}
<div>{{ content }}</div>
{% endblock %}
```

#### Python Context

```python
# www/page.py
import frappe

def get_context(context):
    context.items = frappe.get_all('Item', fields=['name', 'item_name'])
    return context
```

#### Print Format

-   Location: `[app]/[module]/print_format/[name]/[name].html`
-   Use Jinja2 syntax with `doc` object
-   Access via: Desk → Print Format → Create New

### Frappe Site SSL

#### Prerequisites

-   For Proxmox containers: `apt install snapd squashfuse fuse lxcfs -y`
-   For regular systems: `sudo apt install snapd -y` then `sudo snap install --classic certbot`

#### Setup Nginx

-   Setup nginx: `sudo bench setup nginx`
-   Test config: `sudo nginx -t`
-   Restart nginx: `sudo systemctl restart nginx`

#### Obtain SSL Certificate

-   All sites: `sudo certbot --nginx`
-   Specific site: `sudo certbot --nginx -d example.com -d www.example.com`
-   Verify certificates: `sudo certbot certificates`

#### Restart Services

-   Restart bench: `bench restart`
-   Restart nginx: `sudo systemctl restart nginx`
-   Restart supervisor: `sudo supervisorctl restart all`

#### Certificate Management

-   Revoke certificate: `sudo certbot revoke --cert-name domain.com`
-   Delete certificate: `sudo certbot delete --cert-name domain.com`
-   Test renewal: `sudo certbot renew --dry-run`
-   Check renewal status: `sudo systemctl status certbot.timer`

#### Troubleshooting

-   Nginx config errors: `sudo nginx -t`
-   Port 80/443 not accessible: Check firewall with `sudo ufw status`
-   DNS not resolving: Verify DNS A record with `dig +short example.com A`
-   Certificate renewal fails: Check logs with `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

#### Notes

-   DNS A record must point to server IP before requesting certificate
-   Port 80 must be open for Let's Encrypt domain validation
-   Certbot sets up automatic renewal via systemd timer
-   Certificates stored in `/etc/letsencrypt/live/[domain]/`

### ERPNext

#### Module Structure

-   `accounts/` - Financial accounting
-   `selling/` - Sales (Quotation, Sales Order, Delivery Note, Sales Invoice)
-   `buying/` - Procurement (Purchase Order, Purchase Receipt, Purchase Invoice)
-   `stock/` - Inventory management
-   `manufacturing/` - Production
-   `crm/` - Customer relationship
-   `projects/` - Project management
-   `controllers/` - Base controllers

#### Key DocTypes

-   Accounts: Sales Invoice, Purchase Invoice, Payment Entry, Journal Entry, GL Entry, Account
-   Selling: Quotation → Sales Order → Delivery Note → Sales Invoice
-   Buying: Supplier Quotation → Purchase Order → Purchase Receipt → Purchase Invoice
-   Stock: Stock Entry, Item, Warehouse, Stock Ledger Entry, Batch, Serial Number

#### Common Controllers

```python
from erpnext.controllers.accounts_controller import AccountsController
from erpnext.selling.doctype.sales_order.sales_order import SalesOrder

class CustomSalesInvoice(AccountsController):
    def validate(self):
        super().validate()
        # Custom validation
```

---

## 4. Frontend

### Frontend Logging

-   Use ONLY `console.log` with filename and method name
-   Format: `console.log('[filename.js] method: function_name')`
-   Examples:
    -   `console.log('[Customer.js] method: get_many_customers')`
    -   `console.log('[Payments.js] method: submitSettlementPayment')`
-   Don't log error details, arrays, or objects
-   Only log method/function names

### Frontend Patterns

```javascript
frappe.call({
	method: API_MAP.MODULE.METHOD,
	args: { param: value },
	callback: (r) => {
		if (!r.exc) {
			/* success */
		}
	},
	error: (err) => {
		console.log('[file.js] method: name');
	},
});

evntBus.emit(EVENT_NAME, data);
evntBus.on(EVENT_NAME, (data) => {});
```

### Client Script

#### File Location

-   DocType scripts: `/apps/[app]/[app]/[module]/doctype/[doctype]/[doctype].js`
-   Client Script DocType: Desk → Customize → Customize Form → Client Script

#### Basic Structure

```javascript
frappe.ui.form.on('DocType Name', {
	onload: function (frm) {},
	refresh: function (frm) {},
	field_name: function (frm) {},
});
```

#### Form Events

-   `onload` - First load only
-   `refresh` - Every refresh (load, save, etc.)
-   `before_save` - Before save
-   `validate` - Before save validation
-   `after_save` - After save
-   `before_submit` - Before submit
-   `on_submit` - After submit

#### Field Operations

-   Get value: `frm.doc.field_name`
-   Set value: `frm.set_value("field_name", "value")`
-   Hide/Show: `frm.set_df_property("field_name", "hidden", 1)`
-   Enable/Disable: `frm.toggle_enable("field_name", true)`
-   Make mandatory: `frm.set_df_property("field_name", "reqd", 1)`
-   Read-only: `frm.set_df_property("field_name", "read_only", 1)`

#### Child Table Operations

-   Add row: `frm.add_child("items", {item_code: "ITEM-001"})` then `frm.refresh_field("items")`
-   Remove row: `frm.doc.items.pop()` then `frm.refresh_field("items")`
-   Clear table: `frm.clear_table("items")` then `frm.refresh_field("items")`
-   Set value in row: `frappe.model.set_value("Child DocType", row.name, "field", value)`

#### Field Filtering

-   Set query: `frm.set_query("field_name", function() { return {filters: {status: "Active"}}; })`
-   Child table filter: `frm.set_query("item_code", "items", function() { return {filters: {item_group: "Products"}}; })`
-   Custom query function: Use `query` property pointing to whitelisted server method

#### API Calls

```javascript
frm.call({
	doc: frm.doc,
	method: 'method_name',
	callback: function (r) {
		if (r.message) frm.set_value('field', r.message);
		frm.refresh();
	},
});
```

#### Custom Buttons

-   Add button: `frm.add_custom_button("Label", function() {}, "Group Name")`
-   Add web link: `frm.add_web_link("/path", "Label")`

#### Utilities

-   Type conversion: `flt(value)`, `cint(value)`
-   Date: `frappe.datetime.get_today()`, `frappe.datetime.add_days(date, days)`
-   Messages: `frappe.msgprint("Message")`, `frappe.throw("Error")`, `frappe.show_alert("Alert")`
-   Translation: `__("String")`

---

## 5. Backend

### Backend Logging

-   Use `frappe.log_error` with filename and method name only
-   Format: `frappe.log_error('[filename.py] method: function_name', 'Tag')`
-   Examples:
    -   `frappe.log_error('[customer.py] method: create_customer', 'Customer API')`
    -   `frappe.log_error('[pos_closing_shift.py] method: validate', 'POS Closing Shift')`
-   Don't include error details or stack traces
-   Only log method/function names

### Backend Patterns

#### Backend API

```python
@frappe.whitelist()
def api_method(param):
    try:
        if isinstance(param, str):
            param = json.loads(param) if param else {}
        if not param:
            frappe.throw(_("Error"))
        return process_data(param)
    except Exception as e:
        frappe.log_error("[file.py] method: api_method", "Module")
        frappe.throw(_("Error"))
```

#### DocType Controller

```python
class DocTypeName(Document):
    def validate(self):
        if not self.field:
            frappe.throw("Field required")

    def on_submit(self):
        # Post-submit logic
        pass
```

### Server Script

#### File Locations

-   DocType controllers: `/apps/[app]/[app]/[module]/doctype/[doctype]/[doctype].py`
-   API methods: `/apps/[app]/[app]/[module]/api.py`
-   Hooks: `/apps/[app]/[app]/hooks.py`

#### Controller Structure

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

#### Lifecycle Methods

-   `validate()` - Before save
-   `before_save()` - Before save
-   `on_update()` - After save
-   `before_submit()` - Before submit
-   `on_submit()` - After submit
-   `on_cancel()` - On cancel
-   `on_trash()` - Before delete

#### API Methods

```python
@frappe.whitelist()
def method_name(param1, param2):
    # Whitelisted method
    return result
```

#### Common Operations

-   Get value: `frappe.db.get_value('DocType', 'name', 'field')`
-   Get list: `frappe.db.get_list('DocType', filters={}, fields=[], limit=10)`
-   Set value: `frappe.db.set_value('DocType', 'name', 'field', 'value')` then `frappe.db.commit()`
-   SQL query: `frappe.db.sql("SELECT * FROM \`tabDocType\` WHERE field = %s", (value,), as_dict=True)`
-   Throw error: `frappe.throw(_("Error message"))`
-   Log error: `frappe.log_error(message, "Error Title")`
-   Get cached doc: `frappe.get_cached_doc('DocType', 'name')` for full fields

#### Link Field Query Filtering

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

### Database Commands

#### Query Method

-   Use ONLY command line: `bench --site all mariadb -e "SQL_QUERY"`
-   DO NOT use `frappe.db.sql()` or other Python DB methods for debugging/inspection
-   Python DB methods allowed ONLY in server scripts/controllers for application logic

#### Access Methods

-   Interactive mode: `bench --site [site_name] mariadb`
-   Execute query: `bench --site all mariadb -e "SELECT * FROM \`tabUser\` LIMIT 10;"`

#### Schema Inspection

-   Table structure: `DESCRIBE \`tabSales Invoice\`;`
-   Create table: `SHOW CREATE TABLE \`tabSales Invoice\`;`
-   Indexes: `SHOW INDEX FROM \`tabSales Invoice\`;`

#### Table Naming

-   Parent: `tabDocType Name`
-   Child: `tabChild DocType Name`
-   Single: `tabSingles` (stores all single values)

#### Frappe DB API (for server scripts only)

-   Get value: `frappe.db.get_value('DocType', 'name', 'field')`
-   Get list: `frappe.db.get_list('DocType', filters={}, fields=[], limit=10)`
-   Set value: `frappe.db.set_value('DocType', 'name', 'field', 'value')` then `frappe.db.commit()`
-   SQL query: `frappe.db.sql("SELECT * FROM \`tabDocType\` WHERE field = %s", (value,), as_dict=True)`
-   Exists: `frappe.db.exists('DocType', 'name')`
-   Count: `frappe.db.count('DocType', filters={})`
-   Delete: `frappe.db.delete('DocType', {'name': 'name'})`

#### Common Queries (command line)

-   Table structure: `bench --site all mariadb -e "DESCRIBE \`tabPOS Profile\`;"`
-   Custom fields: `bench --site all mariadb -e "SELECT fieldname FROM \`tabCustom Field\` WHERE dt='POS Profile';"`
-   Data inspection: `bench --site all mariadb -e "SELECT name, grand_total FROM \`tabSales Invoice\` WHERE posa_pos_opening_shift = 'POSA-OS-25-0001078';"`
-   Error log: `bench --site all mariadb -e "SELECT error, method FROM \`tabError Log\` ORDER BY creation DESC LIMIT 1000;"`
-   DocTypes: `bench --site all mariadb -e "SELECT name, module, custom FROM \`tabDocType\` ORDER BY name;"`
-   User roles: `bench --site all mariadb -e "SELECT u.name, hr.role FROM \`tabUser\` u JOIN \`tabHas Role\` hr ON hr.parent = u.name WHERE u.name = 'user@example.com';"`

#### Safety Rules

-   Always backup before direct DB operations
-   Test queries with LIMIT first
-   Use command line for ALL database queries/inspection
-   Never modify core tables directly

### DocType Commands

#### File Structure

```
/apps/[app]/[app]/[module]/doctype/[doctype_name]/
├── __init__.py
├── [doctype_name].json          # DocType definition
├── [doctype_name].py            # Python controller
├── [doctype_name].js            # Client script
├── [doctype_name]_list.js       # List view (optional)
└── test_[doctype_name].py       # Unit tests
```

#### JSON Structure

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

#### Python Controller

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

#### Field Types

-   `Data` - Single line text (140 chars max)
-   `Text` - Multi-line text
-   `Link` - Link to DocType (requires `options`)
-   `Select` - Dropdown (options: `Option1\nOption2`)
-   `Date` - Date picker
-   `Currency` - Money field
-   `Float` - Decimal number
-   `Check` - Checkbox (0 or 1)
-   `Table` - Child table (requires `options`)

#### Autoname Patterns

-   Field value: `"autoname": "field:order_id"`
-   Naming series: `"autoname": "naming_series:"`
-   Format string: `"autoname": "format:ORD-{YYYY}-{####}"`
-   User input: `"autoname": "Prompt"`

#### Bench Commands

-   Reload DocType: `bench --site [site] reload-doctype "DocType Name"`
-   Migrate: `bench --site [site] migrate`
-   Clear cache: `bench --site [site] clear-cache`

#### Child DocTypes

-   Parent: `"fieldtype": "Table"`, `"options": "Child DocType Name"`
-   Child: `"istable": 1`, must have `parent`, `parenttype`, `parentfield` fields

#### Single DocTypes

-   Pattern: `"issingle": 1`
-   Access: `frappe.db.get_single_value("Settings Name", "field")` or `frappe.get_single("Settings Name")`

### Custom Field

#### Creation Methods

-   Via UI: Desk → Customize → Customize Form → Add Row
-   Via Python: Use `frappe.get_doc()` with `doctype: 'Custom Field'`

#### Python Pattern

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

#### Field Types

-   `Data` - Single line text (140 chars)
-   `Text` - Multi-line text
-   `Link` - Link to DocType (requires `options`)
-   `Select` - Dropdown (options: `Option1\nOption2`)
-   `Date` - Date picker
-   `Currency` - Money field
-   `Float` - Decimal number
-   `Check` - Checkbox (0 or 1)
-   `Table` - Child table (requires `options`)

#### Essential Properties

-   `fieldname` - Must start with `custom_`
-   `label` - Field label
-   `fieldtype` - Field type
-   `insert_after` - Position after existing field
-   `reqd` - Mandatory (1 or 0)
-   `hidden` - Hidden field (1 or 0)
-   `read_only` - Read-only (1 or 0)
-   `default` - Default value
-   `options` - For Link/Table (DocType name)
-   `in_list_view` - Show in list (1 or 0)
-   `depends_on` - Conditional display (`eval:doc.status`)
-   `fetch_from` - Auto-fetch (`customer.tax_id`)

#### Property Setter

```python
frappe.make_property_setter({
    'doctype': 'Sales Invoice',
    'fieldname': 'customer_name',
    'property': 'reqd',
    'value': '1',
    'property_type': 'Check'
})
```

#### Bulk Creation

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

#### Naming Rules

-   Prefix: `custom_` (required)
-   Descriptive: `custom_tax_id`, `custom_delivery_date`
-   Avoid: `custom_field1`, `custom_date`

### Script Report

#### File Structure

```
[app]/[module]/report/[report_name]/
├── [report_name].json    # Filters definition
├── [report_name].py      # Main logic
└── [report_name].js      # Optional client-side customization
```

#### Python Structure

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

#### Filters (JSON)

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

#### Return Values

-   `columns` - List of column definitions
-   `data` - List of dictionaries with report data
-   `message` - Optional message to display
-   `chart` - Optional chart configuration
-   `report_summary` - Optional summary data

### Site Commands

#### Site Management

-   Create site: `bench new-site [site_name]`
-   Drop site: `bench drop-site [site_name]`
-   List apps: `bench --site [site] list-apps`

#### App Management

-   Get app: `bench get-app [app_name]`
-   Install app: `bench --site [site] install-app [app_name]`
-   Uninstall app: `bench --site [site] uninstall-app [app_name]`

#### Database Operations

-   Backup: `bench --site [site] backup`
-   Backup with files: `bench --site [site] backup --with-files`
-   Migrate: `bench --site [site] migrate`
-   Console: `bench --site [site] console`
-   MariaDB: `bench --site [site] mariadb`

#### Development Commands

-   Build: `bench build`
-   Build app: `bench build --app [app_name]`
-   Restart: `bench restart`
-   Clear cache: `bench --site [site] clear-cache`
-   Clear website cache: `bench --site [site] clear-website-cache`
-   Watch: `bench watch` (auto-rebuild on changes)
-   Reload DocType: `bench --site [site] reload-doctype "DocType Name"`

#### Configuration

-   Set config: `bench --site [site] set-config developer_mode 1`
-   Get config: `bench --site [site] get-config developer_mode`
-   Set admin password: `bench --site [site] set-admin-password [password]`

---

## Logging Summary

### Logging Format

**Format:** `[filename.py] method: function_name` or `[filename.js] method: function_name`

**Examples:**

-   Frontend: `console.log('[Customer.js] method: get_many_customers')`
-   Backend: `frappe.log_error('[customer.py] method: create_customer', 'Customer API')`

### Log Locations

-   Frontend: Browser console (F12)
-   Backend: Desk → Error Log
-   Bench logs: `logs/web.log`, `logs/worker.log`, `logs/schedule.log`
-   Site logs: `sites/[site]/logs/web.log`, `sites/[site]/logs/error.log`

### Best Practices

-   Format: `[filename.py] method: function_name`
-   Only method/function names, no error details
-   Keep it simple and short
-   Use tags for filtering: `frappe.log_error(message, 'Tag Name')`
