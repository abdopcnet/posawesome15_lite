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
        {"fieldname": "posting_date", "label": _(
            "التاريخ"), "fieldtype": "Date", "width": 120},
        {"fieldname": "name", "label": _(
            "رقم الفاتورة"), "fieldtype": "Link", "options": "Sales Invoice", "width": 180},
        {"fieldname": "pos_profile", "label": _(
            "الفرع"), "fieldtype": "Link", "options": "POS Profile", "width": 120},
        {"fieldname": "posa_pos_opening_shift", "label": _(
            "مستند الفتح"), "fieldtype": "Link", "options": "POS Opening Shift", "width": 180},
        {"fieldname": "posting_time", "label": _(
            "الوقت"), "fieldtype": "Time", "width": 100},
        {"fieldname": "grand_total", "label": _(
            "الإجمالي"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "paid_amount", "label": _(
            "المدفوع"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "change_amount", "label": _(
            "الباقي"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "actual_amount", "label": _(
            "المبلغ الفعلي"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "outstanding_amount", "label": _(
            "المتبقي"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "discount_amount", "label": _(
            "الخصم"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "posa_item_discount_total", "label": _(
            "خصم الأصناف"), "fieldtype": "Currency", "width": 120},
    ]

    # Add payment mode columns
    for mode in payment_modes:
        columns.append({
            "fieldname": sanitize_fieldname(mode),
            "label": _(mode),
            "fieldtype": "Currency",
            "width": 120
        })

    return columns


def get_payment_modes(filters):
    """Get all unique payment modes used in the filtered period."""
    conditions = get_conditions(filters)
    query = """
        SELECT DISTINCT pe.mode_of_payment
        FROM `tabSales Invoice` si
        LEFT JOIN `tabSales Invoice Payment` pe ON pe.parent = si.name
        {conditions}
        AND pe.mode_of_payment IS NOT NULL
        ORDER BY pe.mode_of_payment
    """.format(conditions=conditions)
    modes = frappe.db.sql(query, filters, as_dict=0)
    return [mode[0] for mode in modes if mode[0]]


def get_data(filters, payment_modes):
    """Fetch and return report data based on filters."""
    conditions = get_conditions(filters)

    # Build payment mode columns
    payment_mode_cases = []
    for mode in payment_modes:
        field_name = sanitize_fieldname(mode)
        safe_mode = mode.replace("'", "''")
        case_sql = f"""
            (SELECT SUM(allocated_amount)
             FROM `tabSales Invoice Payment`
             WHERE parent = si.name AND mode_of_payment = '{safe_mode}'
            ) AS {field_name}
        """
        payment_mode_cases.append(case_sql)

    payment_mode_sql = ",\n            ".join(
        payment_mode_cases) if payment_mode_cases else ""
    if payment_mode_sql:
        payment_mode_sql = ",\n            " + payment_mode_sql

    query = """
        SELECT
            si.owner AS user,
            si.posting_date AS posting_date,
            si.name AS name,
            si.pos_profile AS pos_profile,
            si.posa_pos_opening_shift AS posa_pos_opening_shift,
            si.posting_time AS posting_time,
            si.grand_total AS grand_total,
            si.paid_amount AS paid_amount,
            si.change_amount AS change_amount,
            (si.paid_amount - si.change_amount) AS actual_amount,
            si.outstanding_amount AS outstanding_amount,
            si.discount_amount AS discount_amount,
            si.posa_item_discount_total AS posa_item_discount_total{payment_mode_sql}
        FROM `tabSales Invoice` si
        {conditions}
        AND si.status IN ('Submitted', 'Paid', 'Partly Paid', 'Unpaid', 'Unpaid and Discounted', 'Partly Paid and Discounted', 'Overdue and Discounted', 'Overdue')
        ORDER BY si.posting_date DESC, si.posting_time DESC
    """.format(conditions=conditions, payment_mode_sql=payment_mode_sql)

    data = frappe.db.sql(query, filters, as_dict=1)
    return data


def get_conditions(filters):
    """Build WHERE conditions based on filters."""
    conditions = []
    if filters.get("user"):
        conditions.append("si.owner = %(user)s")
    if filters.get("from_date") and filters.get("to_date"):
        conditions.append(
            "si.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    if filters.get("pos_profile"):
        conditions.append("si.pos_profile = %(pos_profile)s")
    if filters.get("posa_pos_opening_shift"):
        conditions.append(
            "si.posa_pos_opening_shift = %(posa_pos_opening_shift)s")
    return "WHERE " + " AND ".join(conditions) if conditions else ""
