# debugging.md

## Frontend logging

- Use ONLY `console.log` with filename and short important results
- Format: `console.log(\`[filename.js] (short_important_result)\`);`
- Examples: `console.log(\`[payment_gateway.js] (Payment processed: ${payment_id})\`);`
- Don't use: `console.info()`, `console.warn()`, `console.error()` (unless for actual errors)
- Don't log long arrays or entire objects

## Backend logging

- Use `frappe.log_error` with filename and short important results
- Format: `frappe.log_error(f"[filename.py] (short_important_result)")`
- View logs: Desk → Error Log → Filter by message
- Examples: `frappe.log_error(f"[user.py] (Signup started for: {email})", "Debug Tag")`

## Log locations

- Frontend: Browser console (F12)
- Backend: Desk → Error Log
- Bench logs: `logs/web.log`, `logs/worker.log`, `logs/schedule.log`
- Site logs: `sites/[site]/logs/web.log`, `sites/[site]/logs/error.log`

## Best practices

- Include filename in brackets: `[filename.js]` or `[filename.py]`
- Show short important results only
- No long arrays or full objects
- Keep messages concise and meaningful
- Use tags for filtering: `frappe.log_error(message, "Tag Name")`
