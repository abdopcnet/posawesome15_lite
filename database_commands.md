# database_commands.md

## Query method

- Use ONLY command line: `bench --site all mariadb -e "SQL_QUERY"`
- DO NOT use `frappe.db.sql()` or other Python DB methods for debugging/inspection
- Python DB methods allowed ONLY in server scripts/controllers for application logic

## Access methods

- Interactive mode: `bench --site [site_name] mariadb`
- Execute query: `bench --site all mariadb -e "SELECT * FROM \`tabUser\` LIMIT 10;"`

## Schema inspection

- Table structure: `DESCRIBE \`tabSales Invoice\`;`
- Create table: `SHOW CREATE TABLE \`tabSales Invoice\`;`
- Indexes: `SHOW INDEX FROM \`tabSales Invoice\`;`

## Table naming

- Parent: `tabDocType Name`
- Child: `tabChild DocType Name`
- Single: `tabSingles` (stores all single values)

## Frappe DB API (for server scripts only)

- Get value: `frappe.db.get_value('DocType', 'name', 'field')`
- Get list: `frappe.db.get_list('DocType', filters={}, fields=[], limit=10)`
- Set value: `frappe.db.set_value('DocType', 'name', 'field', 'value')` then `frappe.db.commit()`
- SQL query: `frappe.db.sql("SELECT * FROM \`tabDocType\` WHERE field = %s", (value,), as_dict=True)`
- Exists: `frappe.db.exists('DocType', 'name')`
- Count: `frappe.db.count('DocType', filters={})`
- Delete: `frappe.db.delete('DocType', {'name': 'name'})`

## Common queries (command line)

- Table structure: `bench --site all mariadb -e "DESCRIBE \`tabPOS Profile\`;"`
- Custom fields: `bench --site all mariadb -e "SELECT fieldname FROM \`tabCustom Field\` WHERE dt='POS Profile';"`
- Data inspection: `bench --site all mariadb -e "SELECT name, grand_total FROM \`tabSales Invoice\` WHERE posa_pos_opening_shift = 'POSA-OS-25-0001078';"`
- Error log: `bench --site all mariadb -e "SELECT error, method FROM \`tabError Log\` ORDER BY creation DESC LIMIT 1000;"`
- DocTypes: `bench --site all mariadb -e "SELECT name, module, custom FROM \`tabDocType\` ORDER BY name;"`
- User roles: `bench --site all mariadb -e "SELECT u.name, hr.role FROM \`tabUser\` u JOIN \`tabHas Role\` hr ON hr.parent = u.name WHERE u.name = 'user@example.com';"`

## Safety rules

- Always backup before direct DB operations
- Test queries with LIMIT first
- Use command line for ALL database queries/inspection
- Never modify core tables directly
