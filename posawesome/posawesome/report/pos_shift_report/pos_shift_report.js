// Copyright (c) 2025, future-support and contributors
// For license information, please see license.txt

frappe.query_reports['POS Shift Report'] = {
  filters: [
    {
      fieldname: 'user',
      label: __('المستخدم'),
      fieldtype: 'Link',
      options: 'User',
    },
    {
      fieldname: 'from_date',
      label: __('من تاريخ'),
      fieldtype: 'Datetime',
      default: frappe.datetime.month_start(),
    },
    {
      fieldname: 'to_date',
      label: __('إلى تاريخ'),
      fieldtype: 'Datetime',
      default: frappe.datetime.now_datetime(),
    },
    {
      fieldname: 'pos_profile',
      label: __('الفرع'),
      fieldtype: 'Link',
      options: 'POS Profile',
    },
  ],
};
