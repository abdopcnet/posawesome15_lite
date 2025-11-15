# Copyright (c) 2025, future-support and contributors
# For license information, please see license.txt

import re
import frappe
from frappe import _


def execute(filters=None):
    """Return columns and data for the report."""
    filters = frappe._dict(filters or {})
    payment_modes = get_payment_modes(filters)
    columns = get_columns(payment_modes)
    data = get_data(filters, payment_modes)
    return columns, data


def sanitize_fieldname(name):
    """Convert payment mode name to safe SQL field name."""
    safe_name = re.sub(r'[^\w\s]', '', name)
    safe_name = re.sub(r'\s+', '_', safe_name)
    safe_name = safe_name.strip('_')
    return f"mode_{safe_name}"


def get_columns(payment_modes):
    """Return columns for the report."""
    columns = [
        {"fieldname": "user", "label": _(
            "المستخدم"), "fieldtype": "Link", "options": "User", "width": 130},
        {"fieldname": "pos_profile", "label": _(
            "بروفايل الكاشير"), "fieldtype": "Link", "options": "POS Profile", "width": 120},
        {"fieldname": "pos_opening_shift", "label": _(
            "مستند الفتح"), "fieldtype": "Link", "options": "POS Opening Shift", "width": 200},
        {"fieldname": "period_start_date", "label": _(
            "تاريخ الفتح"), "fieldtype": "Data", "width": 200},
        {"fieldname": "pos_closing_shift", "label": _(
            "مستند الإغلاق"), "fieldtype": "Link", "options": "POS Closing Shift", "width": 200},
        {"fieldname": "period_end_date", "label": _(
            "تاريخ الإغلاق"), "fieldtype": "Data", "width": 200},
        {"fieldname": "grand_total", "label": _(
            "الفواتير"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "paid_amount", "label": _(
            "المدفوع"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "outstanding_amount", "label": _(
            "المتبقي"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "discount_amount", "label": _(
            "الخصم"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "opening_amount", "label": _(
            "المبلغ الإفتتاحي"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "closing_amount", "label": _(
            "مبلغ الإغلاق الفعلي"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "expected_amount", "label": _(
            "المبلغ المتوقع"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "difference", "label": _(
            "الفرق"), "fieldtype": "Currency", "width": 150},
    ]

    for mode in payment_modes:
        columns.append({
            "fieldname": sanitize_fieldname(mode),
            "label": _(mode),
            "fieldtype": "Currency",
            "width": 150
        })

    return columns


def get_payment_modes(filters):
    """Get all unique payment modes used in the filtered period."""
    conditions = get_conditions(filters)
    # Add condition to ensure we only get payment modes if conditions exist
    # This prevents getting all payment modes when no filter is applied
    where_clause = conditions if conditions else "WHERE 1=0"
    query = """
		SELECT DISTINCT pcd.mode_of_payment
		FROM `tabPOS Opening Shift` pos_open
		LEFT JOIN `tabPOS Closing Shift` pos_close ON pos_close.name = pos_open.pos_closing_shift
		LEFT JOIN `tabPOS Closing Shift Detail` pcd ON pcd.parent = pos_close.name
		{conditions}
		AND pcd.mode_of_payment IS NOT NULL
		ORDER BY pcd.mode_of_payment
	""".format(conditions=where_clause)
    modes = frappe.db.sql(query, filters, as_dict=0)
    return [mode[0] for mode in modes if mode[0]]


def get_data(filters, payment_modes):
    """Fetch and return report data based on filters."""
    conditions = get_conditions(filters)

    payment_mode_cases = []
    for mode in payment_modes:
        field_name = sanitize_fieldname(mode)
        safe_mode = mode.replace("'", "''")
        case_sql = f"""
			(SELECT SUM(closing_amount)
			 FROM `tabPOS Closing Shift Detail`
			 WHERE parent = pos_close.name AND mode_of_payment = '{safe_mode}'
			) AS {field_name}
		"""
        payment_mode_cases.append(case_sql)

    payment_mode_sql = ",\n\t\t\t".join(
        payment_mode_cases) if payment_mode_cases else ""
    if payment_mode_sql:
        payment_mode_sql = ",\n\t\t\t" + payment_mode_sql

    query = """
		SELECT
			pos_open.user AS user,
			pos_open.pos_profile AS pos_profile,
			pos_open.name AS pos_opening_shift,
			DATE_FORMAT(pos_open.period_start_date, '%%d-%%m-%%Y %%H:%%i:%%s') AS period_start_date,
			pos_open.pos_closing_shift AS pos_closing_shift,
			DATE_FORMAT(pos_close.period_end_date, '%%d-%%m-%%Y %%H:%%i:%%s') AS period_end_date,
			SUM(si.grand_total) AS grand_total,
			SUM(si.paid_amount - si.change_amount) AS paid_amount,
			SUM(si.discount_amount) AS discount_amount,
			SUM(si.outstanding_amount) AS outstanding_amount,
			(SELECT SUM(opening_amount) FROM `tabPOS Closing Shift Detail` WHERE parent = pos_close.name) AS opening_amount,
			(SELECT SUM(closing_amount) FROM `tabPOS Closing Shift Detail` WHERE parent = pos_close.name) AS closing_amount,
			(SELECT SUM(expected_amount) FROM `tabPOS Closing Shift Detail` WHERE parent = pos_close.name) AS expected_amount,
			(SELECT SUM(difference) FROM `tabPOS Closing Shift Detail` WHERE parent = pos_close.name) AS difference{payment_mode_sql}
		FROM `tabPOS Opening Shift` pos_open
		LEFT JOIN `tabSales Invoice` si
			ON si.posa_pos_opening_shift = pos_open.name
			AND si.owner = pos_open.user
			AND si.status IN ('Submitted', 'Paid', 'Partly Paid', 'Unpaid', 'Unpaid and Discounted', 'Partly Paid and Discounted', 'Overdue and Discounted', 'Overdue')
		LEFT JOIN `tabPOS Closing Shift` pos_close ON pos_close.name = pos_open.pos_closing_shift
		{conditions}
		GROUP BY pos_open.name
		ORDER BY pos_open.period_start_date DESC
	""".format(conditions=conditions, payment_mode_sql=payment_mode_sql)

    data = frappe.db.sql(query, filters, as_dict=1)
    return data


def get_conditions(filters):
    """Build WHERE conditions based on filters."""
    conditions = []
    if filters.get("user"):
        conditions.append("pos_open.user = %(user)s")
    if filters.get("from_date") and filters.get("to_date"):
        conditions.append(
            "pos_open.period_start_date BETWEEN %(from_date)s AND %(to_date)s")
    if filters.get("pos_profile"):
        conditions.append("pos_open.pos_profile = %(pos_profile)s")
    return "WHERE " + " AND ".join(conditions) if conditions else ""
