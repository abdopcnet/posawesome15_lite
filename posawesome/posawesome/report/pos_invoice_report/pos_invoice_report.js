// Copyright (c) 2025, future-support and contributors
// For license information, please see license.txt

frappe.query_reports["POS_invoice_Report"] = {
  filters: [
    {
      fieldname: "user",
      label: __("المستخدم"),
      fieldtype: "Link",
      options: "User",
    },
    {
      fieldname: "from_date",
      label: __("من تاريخ"),
      fieldtype: "Datetime",
      default: frappe.datetime.month_start(),
    },
    {
      fieldname: "to_date",
      label: __("إلى تاريخ"),
      fieldtype: "Datetime",
      default: frappe.datetime.now_datetime(),
    },
    {
      fieldname: "pos_profile",
      label: __("الفرع"),
      fieldtype: "Link",
      options: "POS Profile",
      get_query: function () {
        return {
          query: "posawesome.posawesome.report.pos_invoice_report.pos_invoice_report.get_pos_profiles_for_user",
        };
      },
    },
    {
      fieldname: "posa_pos_opening_shift",
      label: __("مستند الفتح"),
      fieldtype: "Link",
      options: "POS Opening Shift",
    },
    {
      fieldname: "posa_pos_closing_shift",
      label: __("مستند الإغلاق"),
      fieldtype: "Link",
      options: "POS Closing Shift",
    },
  ],
};
