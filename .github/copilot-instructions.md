# POS Awesome Lite: AI Agent Guide

## 🎯 Core Philosophy

**Modern UI + ERPNext Engine** - Zero custom calculations; UI builds state, ERPNext handles all business logic.

## 🏗️ Architecture Overview

**Frontend:** Vue 3 SFCs (pure HTML/CSS, NO Vuetify), mitt event bus for component communication, onScan.js for barcode handling.
**Backend:** ERPNext v15/Frappe v15; strict one-function-per-file API structure in `posawesome/api/[doctype]/[action].py`.
**Data Flow:** UI → API_MAP → ERPNext Controllers → DB (UI never calculates prices/taxes/totals).
**Invoice Lifecycle:** Local state (\_\_islocal=1) → Single API call → `create_and_submit_invoice()` → ERPNext native workflow.

## 📁 Critical File Map

- `posawesome/public/js/posapp/api_mapper.js` - **ONLY source** for API endpoint constants (`API_MAP.SALES_INVOICE.CREATE_AND_SUBMIT`)
- `posawesome/public/js/posapp/components/pos/` - Core screens: `Invoice.vue`, `ItemsSelector.vue`, `Payments.vue`, `Navbar.vue`
- `posawesome/public/js/posapp/bus.js` - mitt event bus; **MUST cleanup** listeners in `beforeUnmount()`
- `posawesome/posawesome/api/` - Backend APIs; each file = one `@frappe.whitelist()` function
- `posawesome/hooks.py` - Wires bundle.js and DocType-specific JS into ERPNext
- `posawesome/public/js/posapp/posapp.js` - Vue 3 app initialization with global properties setup

## ⚡ Mandatory Patterns

### Invoice Lifecycle (Single-API System)

```javascript
// ONE API call for complete workflow: __islocal → insert() → submit()
frappe.call({ method: API_MAP.SALES_INVOICE.CREATE_AND_SUBMIT, args: { invoice_doc } });
```

### API Calls

```javascript
// ✅ CORRECT - via API_MAP
frappe.call({ method: API_MAP.SALES_INVOICE.CREATE_AND_SUBMIT, ... })

// ❌ WRONG - hardcoded path
frappe.call({ method: "posawesome.posawesome.api.sales_invoice.create_and_submit_invoice", ... })
```

### Vue Component Structure

```javascript
// ✅ CORRECT - .vue files with separate .js includes
<template><!-- Pure HTML --></template>
<script src="./Component.js" />

// Component.js exports default with mixins
export default {
  name: 'ComponentName',
  mixins: [format], // Use format mixin for currency/number formatting
  //...existing code...
}
```

### Backend Queries

```python
# ✅ CORRECT - specific fields
frappe.get_doc("Item", name, fields=["name", "item_code", "item_name"])

# ❌ WRONG - SELECT *
frappe.get_doc("Item", name)
```

### Event Bus Usage

```javascript
// Emit events
evntBus.emit('add_item', item);

// Subscribe & cleanup
onMounted(() => {
  evntBus.on('update_invoice', handler);
});
onBeforeUnmount(() => {
  evntBus.off('update_invoice', handler); // REQUIRED
});
```

## 🔧 Developer Workflows

### Apply Frontend Changes

```bash
cd ~/frappe-bench-15
bench clear-cache && bench build --app posawesome --force
```

### Apply Backend Changes

```bash
find . -name "*.pyc" -delete
find . -type d -name "__pycache__" -exec rm -rf {} +
bench restart
```

### Install Frontend Dependencies

```bash
npm install  # ESLint, Prettier, Vue tooling
```

### Verify Database Schema

```bash
bench mariadb
> DESCRIBE tabSalesInvoice;  # Confirm field names before queries
```

## � Debugging

- Frontend: use console.log while developing to inspect state; remove before commit. In production, prefer console.error/console.warn only.
- Backend: wrap risky code in try/except and call frappe.log_error(...) in except blocks; never log successful operations. Focus areas: `pos_offer/offers.get_offers`, `sales_invoice/*`.

## �🚨 Strict Rules (Will Break CI/CD)

### Backend

- ❌ No `SELECT *` queries - specify fields: `fields=["field1", "field2"]`
- ❌ No logging successful operations - only `frappe.log_error()` for errors
- ✅ Target < 100ms response time
- ✅ Use `ignore_version=True` for faster saves

### Frontend

- ❌ No Vuetify/external UI libs - pure HTML/CSS only
- ❌ No caching except temp operation queue (cleared after API success)
- ❌ No `console.log` in production - use `console.error` / `console.warn` only
- ❌ No external CDN/fonts - all assets local
- ✅ Virtual scrolling for lists > 50 items
- ✅ Components must stay < 500 lines

### API Structure

```
posawesome/api/[doctype]/
├── get_[doctype].py          # Single record
├── get_many_[doctype]s.py    # Multiple records
├── create_[doctype].py       # POST - create new
├── update_[doctype].py       # PUT - update existing
└── delete_[doctype].py       # DELETE
```

## 🔍 Integration Points

- **Barcode:** All barcode types (scale/private/regular) → `API_MAP.ITEM.GET_BARCODE_ITEM`
- **Shifts:** Navbar cash/non-cash totals use same logic as `pos_closing_shift` APIs
- **Offers:** Auto-apply transaction discounts in `sales_invoice/create_and_submit_invoice.py` before save
- **Vue Global Properties:** `posapp.js` sets up `$frappe`, `$call`, `__()` translation function

## 📚 Reference Docs

- **Policies:** `docs/backend_policy.md`, `docs/frontend_policy.md`
- **Commands:** `docs/dev_common_commands.md`, `docs/development_tools.md`
- **Features:** `docs/pos_lite_features.md`, `docs/pos_lite_shortcuts.md`
- **VSCode:** `.vscode/README.md` - locked extension policy

## ⚠️ Common Mistakes

1. Hardcoding API paths instead of using `API_MAP`
2. Forgetting `beforeUnmount()` cleanup → memory leaks
3. Using `SELECT *` → slow queries
4. Adding calculations in UI instead of ERPNext controllers
5. Installing unauthorized VSCode extensions

**When in doubt:** Check existing patterns in `Invoice.vue` or `sales_invoice/create_and_submit_invoice.py` - conventions here override generic best practices.
