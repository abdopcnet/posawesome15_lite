## 1. FIELD NAMING & DATA INTEGRITY

Use only original, real field names from the actual database schema.

- No temporary variables, abbreviations, or fake names unrelated to actual fields
- Never create fictional field names - only use what exists in the actual table structure
- Always verify field names by checking the database schema or DocType JSON files

## 2. CODE ANALYSIS PRINCIPLES

All answers must be based on actual code analysis of the project structure.

- No predictions or suggestions - only analysis of existing code patterns
- Understand the project's architecture before providing solutions
- Read actual files to understand the codebase structure

## 3. CORE SYSTEM APPLICATIONS REFERENCE

The original system applications that should be referenced for understanding code patterns and architecture:

- `/home/frappe/frappe-bench/apps/frappe` - Core Frappe framework
- `/home/frappe/frappe-bench/apps/erpnext` - ERPNext application

These applications should be searched or queried to understand how to build and structure code properly.

- Always reference these core applications when understanding code patterns
- Search these directories when learning how features are implemented
- Use them as reference for code structure and best practices

## 4. DATABASE MODIFICATION PROTOCOL

Never modify the database without explicit permission.

- Always ask first before any database changes
- Never run DROP, ALTER, or INSERT/UPDATE commands without user approval

## 4.1. DATABASE FIELD QUERY PROTOCOL

When searching for fields in database tables or DocTypes, always use the specified query method.

- Use the command: `bench --site all mariadb -e "DESCRIBE \`tabTableName\`;"`
- Replace `TableName` with the actual DocType name (e.g., `tabPOS Profile` for POS Profile DocType)
- This command shows all fields in the table with their types and properties
- Always use this method to verify field names and structure before using them in code
- Never guess or assume field names - always query the database first

### 4.2. RULE COMMAND TROUBLESHOOTING PROTOCOL

When a rule-specified command fails or doesn't work, follow this troubleshooting protocol.

- First, verify the command syntax matches the rule exactly (check quotes, backticks, table name format)
- Check if the command requires specific environment setup (bench directory, site name, database connection)
- If the command fails with no output or error code, investigate the root cause:
  - Note: Terminal tool execution failures may be environment-specific - the command may work when run directly by the user
  - **Cursor Agent Terminal Execution (Linux)**:
    - Sandbox is NOT available on Linux (macOS only per Cursor docs)
    - Check Settings -> Cursor Settings -> Agents -> Auto-Run -> "Auto-Run Mode"
    - If set to "Ask Every Time", commands require approval that may not be captured
    - If set to "Run Everything", commands should execute automatically
    - Add commands to "Command Allowlist" to allow automatic execution outside sandbox
    - Check Enterprise Controls if applicable (may override user settings)
    - Even basic commands failing suggests Auto-Run Mode or Enterprise restrictions
  - Verify bench is installed and accessible
  - Check if sites exist and are configured
  - Verify database connection is available
  - Check if the table/DocType exists
- If the command cannot be executed due to environment issues:
  - Inform the user about the failure and root cause
  - Ask the user to run the command manually and share the output
  - As a last resort, use DocType JSON files from the codebase (e.g., `erpnext/erpnext/accounts/doctype/pos_profile/pos_profile.json`)
  - Always mention that the JSON file method is a fallback and the database query is the preferred method
- Never silently switch to alternative methods without explaining why the rule-specified method failed
- Document any command failures and their causes in the response

## 5. DEVELOPMENT WORKFLOW

Manual reading and writing - no bulk modifications with commands.

- Follow the plan.md file - update it with every change
- Document all modifications in the plan file before implementation
- Read files completely before making changes
- Use file reading tools instead of search patterns when analyzing code

## 6. CODE QUALITY STANDARDS

Revise file syntax every time before writing.

- Write English comments above every section (not beside code)
- Maintain consistent formatting and coding standards
- Check for syntax errors before saving files
- Follow project's existing code style

## 7. COMMUNICATION & VERIFICATION

MANDATORY: Use emoji ✅ at the end of EVERY response to confirm rule compliance.

- MANDATORY: Number ALL important points in responses (1. 2. 3. etc.)
- MANDATORY: Include these rules summary at the end when user requests "show rules" or "what rules"
- Response format requirements:
  - Always start with numbered points
  - Always end with ✅ emoji
  - Use clear Arabic/English mixed communication as needed
  - Each response must demonstrate compliance with all rules
