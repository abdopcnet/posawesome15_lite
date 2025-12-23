# AGENTS.md

## General instructions

- All responses must be in English only
- All code content,comments,messages must be in English only
- Work ONLY based on existing rules - If no rule exists, show PROMPT format and wait for user guidance
- Never modify core - Don't edit frappe/erpnext/hrms core applications files
- JSON files - Don't edit or create JSON files, just prompt the user

## Documentation

- Respect AGENTS.md in every chat
- Read app documentation first - Read existing app md files or create new as app knowledge base
- Update progress - Update documentation with every progress made
- Required files in app directory: `app_api_tree.md`, `app_file_structure.md`, `app_workflow.md`, `app_plan.md`, `README.md`

## Response format

- End with Applied Rules section as numbered list
- Format: `Applied Rules: 1. RULE NAME (filename.md) 2. RULE NAME (filename.md)`

## Frappe Framework structure

- Bench: `[bench_path]/` (e.g., `/home/frappe/frappe-bench/`, `/home/frappe/frappe-bench-15/`)
- Apps: `[bench_path]/apps/`
- Sites: `[bench_path]/sites/`

## Core applications

- frappe
- erpnext
- hrms

## Reference files

- Database instructions: `database_commands.md`
- DocType instructions: `doctype_commands.md`
- Custom fields instructions: `custom_field.md`
- Client-side instructions: `client_script.md`
- Server-side instructions: `server_script.md`
- Script Report instructions: `script_report.md`
- Bench commands instructions: `site_commands.md`
- Web pages instructions: `frappe_site.md`
- SSL certificates instructions: `frappe_site_ssl.md`
- Framework structure instructions: `frappe.md`
- ERPNext instructions: `erpnext.md`
- Logging instructions: `debugging.md`
- Network troubleshooting instructions: `network_debug.md`
- Bench debugging instructions: `bench_debug.md`
- HRMS instructions: `hrms.md`
- LMS instructions: `lms.md`
- Payments instructions: `payments.md`
- Export custom fields instructions: `export_custom_fields.md`
