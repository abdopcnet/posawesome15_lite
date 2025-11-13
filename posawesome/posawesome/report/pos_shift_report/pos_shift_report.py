# Copyright (c) 2025, future-support and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    """Return columns and data for the report.

    This is the main entry point for the report. It accepts the filters as a
    dictionary and should return columns and data. It is called by the framework
    every time the report is refreshed or a filter is updated.
    """
    filters = frappe._dict(filters or {})
    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    """Return columns for the report."""
    return [
        {
            "fieldname": "user",
            "label": _("المستخدم"),
            "fieldtype": "Link",
            "options": "User",
            "width": 130
        },
        {
            "fieldname": "pos_profile",
            "label": _("بروفايل الكاشير"),
            "fieldtype": "Link",
            "options": "POS Profile",
            "width": 120
        },
        {
            "fieldname": "pos_opening_shift",
            "label": _("مستند الفتح"),
            "fieldtype": "Link",
            "options": "POS Opening Shift",
            "width": 200
        },
        {
            "fieldname": "period_start_date",
            "label": _("تاريخ الفتح"),
            "fieldtype": "Datetime",
            "width": 200
        },
        {
            "fieldname": "pos_closing_shift",
            "label": _("مستند الإغلاق"),
            "fieldtype": "Link",
            "options": "POS Closing Shift",
            "width": 200
        },
        {
            "fieldname": "period_end_date",
            "label": _("تاريخ الإغلاق"),
            "fieldtype": "Datetime",
            "width": 200
        },
        {
            "fieldname": "grand_total",
            "label": _("الفواتير"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "paid_amount",
            "label": _("المدفوع"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "outstanding_amount",
            "label": _("المتبقي"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "discount_amount",
            "label": _("الخصم"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "opening_amount",
            "label": _("المبلغ الإفتتاحي"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "closing_amount",
            "label": _("مبلغ الإغلاق الفعلي"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "expected_amount",
            "label": _("المبلغ المتوقع"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "difference",
            "label": _("الفرق"),
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "mode_of_payment_1",
            "label": _("طريقة دفع 1"),
            "fieldtype": "Data",
            "width": 160
        },
        {
            "fieldname": "mode_of_payment_amount_1",
            "label": _("مبلغ دفع 1"),
            "fieldtype": "Currency",
            "width": 160
        },
        {
            "fieldname": "mode_of_payment_2",
            "label": _("طريقة دفع 2"),
            "fieldtype": "Data",
            "width": 160
        },
        {
            "fieldname": "mode_of_payment_amount_2",
            "label": _("مبلغ دفع 2"),
            "fieldtype": "Currency",
            "width": 160
        },
    ]


def get_data(filters):
    """Fetch and return report data based on filters."""
    # Build WHERE conditions
    conditions = get_conditions(filters)

    # Build the query
    query = """
		SELECT
			pos_open.user AS user,
			pos_open.pos_profile AS pos_profile,
			pos_open.name AS pos_opening_shift,
			pos_open.period_start_date AS period_start_date,
			pos_open.pos_closing_shift AS pos_closing_shift,
			pos_close.period_end_date AS period_end_date,
			SUM(si.grand_total) AS grand_total,
			SUM(si.paid_amount - si.change_amount) AS paid_amount,
			SUM(si.discount_amount) AS discount_amount,
			SUM(si.outstanding_amount) AS outstanding_amount,
			
			-- Closing Shift Detail aggregations
			(SELECT SUM(opening_amount) 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			) AS opening_amount,
			
			(SELECT SUM(closing_amount) 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			) AS closing_amount,
			
			(SELECT SUM(expected_amount) 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			) AS expected_amount,
			
			(SELECT SUM(difference) 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			) AS difference,
			
			-- Payment method 1
			(SELECT mode_of_payment 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			 ORDER BY idx ASC LIMIT 1
			) AS mode_of_payment_1,
			
			(SELECT closing_amount 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			 ORDER BY idx ASC LIMIT 1
			) AS mode_of_payment_amount_1,
			
			-- Payment method 2
			(SELECT mode_of_payment 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			 ORDER BY idx ASC LIMIT 1 OFFSET 1
			) AS mode_of_payment_2,
			
			(SELECT closing_amount 
			 FROM `tabPOS Closing Shift Detail` 
			 WHERE parent = pos_close.name
			 ORDER BY idx ASC LIMIT 1 OFFSET 1
			) AS mode_of_payment_amount_2
			
		FROM `tabPOS Opening Shift` pos_open
		
		LEFT JOIN `tabSales Invoice` si
			ON si.posa_pos_opening_shift = pos_open.name
			AND si.owner = pos_open.user
			AND si.status IN (
				'Submitted', 'Paid', 'Partly Paid', 'Unpaid',
				'Unpaid and Discounted', 'Partly Paid and Discounted',
				'Overdue and Discounted', 'Overdue'
			)
		
		LEFT JOIN `tabPOS Closing Shift` pos_close
			ON pos_close.name = pos_open.pos_closing_shift
		
		{conditions}
		
		GROUP BY pos_open.name
		ORDER BY pos_open.period_start_date DESC
	""".format(conditions=conditions)

    # Execute query with filters
    data = frappe.db.sql(query, filters, as_dict=1)

    return data


def get_conditions(filters):
    """Build WHERE conditions based on filters."""
    conditions = []

    if filters.get("user"):
        conditions.append("pos_open.user = %(user)s")

    if filters.get("from_date") and filters.get("to_date"):
        conditions.append(
            "pos_open.period_start_date BETWEEN %(from_date)s AND %(to_date)s"
        )

    if filters.get("pos_profile"):
        conditions.append("pos_open.pos_profile = %(pos_profile)s")

    return "WHERE " + " AND ".join(conditions) if conditions else ""
