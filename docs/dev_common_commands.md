#### ⚙️ Development Commands - Common Commands

**Backend Apply Changes**

```bash
cd ~/frappe-bench-15
bench clear-cache && \
bench clear-website-cache &&
find . -name "*.pyc" -print -delete &&
bench restart
```

**Backend (Python) Debug Policy**

- **Summary:** Use `frappe.log_error()` at the end of each function to summarize results
- **Details:** Include the filename, function name, and results in the log
- **Tracking:** [Error Log](http://192.168.100.117/app/error-log)
- **Tracking:** [Error Log](https://test.future-support.online/app/error-log)

**Frontend Debug Policy**

- **Summary:** Use `console.log` to debug
- **Details:** Include the filename, section, and important parameters only

**Frontend Apply Changes**

```bash
cd ~/frappe-bench-15
bench clear-cache && \
bench clear-website-cache && \
bench build --app posawesome --force
