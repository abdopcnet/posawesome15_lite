# client_script.md

## File location

- DocType scripts: `/apps/[app]/[app]/[module]/doctype/[doctype]/[doctype].js`
- Client Script DocType: Desk → Customize → Customize Form → Client Script

## Basic structure

```javascript
frappe.ui.form.on("DocType Name", {
  onload: function (frm) {},
  refresh: function (frm) {},
  field_name: function (frm) {},
});
```

## Form events

- `onload` - First load only
- `refresh` - Every refresh (load, save, etc.)
- `before_save` - Before save
- `validate` - Before save validation
- `after_save` - After save
- `before_submit` - Before submit
- `on_submit` - After submit

## Field operations

- Get value: `frm.doc.field_name`
- Set value: `frm.set_value("field_name", "value")`
- Hide/Show: `frm.set_df_property("field_name", "hidden", 1)`
- Enable/Disable: `frm.toggle_enable("field_name", true)`
- Make mandatory: `frm.set_df_property("field_name", "reqd", 1)`
- Read-only: `frm.set_df_property("field_name", "read_only", 1)`

## Child table operations

- Add row: `frm.add_child("items", {item_code: "ITEM-001"})` then `frm.refresh_field("items")`
- Remove row: `frm.doc.items.pop()` then `frm.refresh_field("items")`
- Clear table: `frm.clear_table("items")` then `frm.refresh_field("items")`
- Set value in row: `frappe.model.set_value("Child DocType", row.name, "field", value)`

## Field filtering

- Set query: `frm.set_query("field_name", function() { return {filters: {status: "Active"}}; })`
- Child table filter: `frm.set_query("item_code", "items", function() { return {filters: {item_group: "Products"}}; })`
- Custom query function: Use `query` property pointing to whitelisted server method

## API calls

```javascript
frm.call({
  doc: frm.doc,
  method: "method_name",
  callback: function (r) {
    if (r.message) frm.set_value("field", r.message);
    frm.refresh();
  },
});
```

## Custom buttons

- Add button: `frm.add_custom_button("Label", function() {}, "Group Name")`
- Add web link: `frm.add_web_link("/path", "Label")`

## Utilities

- Type conversion: `flt(value)`, `cint(value)`
- Date: `frappe.datetime.get_today()`, `frappe.datetime.add_days(date, days)`
- Messages: `frappe.msgprint("Message")`, `frappe.throw("Error")`, `frappe.show_alert("Alert")`
- Translation: `__("String")`
