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


@frappe.whitelist()
def get_pos_profiles_for_user(doctype, txt, searchfield, start, page_len, filters):
    """Get POS Profiles that the user has permission to access."""
    user = frappe.session.user

    # Administrator can see all
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return frappe.db.sql("""
            SELECT name
            FROM `tabPOS Profile`
            WHERE disabled = 0
            AND (name LIKE %(txt)s OR company LIKE %(txt)s)
            ORDER BY name
            LIMIT %(start)s, %(page_len)s
        """, {
            'txt': "%%%s%%" % txt,
            'start': start,
            'page_len': page_len
        })

    # Check if user has specific permissions
    user_permissions = frappe.db.sql("""
        SELECT for_value
        FROM `tabUser Permission`
        WHERE user = %(user)s
        AND allow = 'POS Profile'
        AND (applicable_for IS NULL OR applicable_for = '')
    """, {'user': user}, as_dict=1)

    if user_permissions:
        allowed_profiles = [up.for_value for up in user_permissions]
        return frappe.db.sql("""
            SELECT name
            FROM `tabPOS Profile`
            WHERE disabled = 0
            AND name IN %(allowed_profiles)s
            AND (name LIKE %(txt)s OR company LIKE %(txt)s)
            ORDER BY name
            LIMIT %(start)s, %(page_len)s
        """, {
            'allowed_profiles': allowed_profiles,
            'txt': "%%%s%%" % txt,
            'start': start,
            'page_len': page_len
        })

    # If no specific permissions, show all
    return frappe.db.sql("""
        SELECT name
        FROM `tabPOS Profile`
        WHERE disabled = 0
        AND (name LIKE %(txt)s OR company LIKE %(txt)s)
        ORDER BY name
        LIMIT %(start)s, %(page_len)s
    """, {
        'txt': "%%%s%%" % txt,
        'start': start,
        'page_len': page_len
    })


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
            "المستخدم"), "fieldtype": "Link", "options": "User"},
        {"fieldname": "posting_date", "label": _(
            "التاريخ"), "fieldtype": "Date"},
        {"fieldname": "name", "label": _(
            "رقم الفاتورة"), "fieldtype": "Link", "options": "Sales Invoice"},
        {"fieldname": "pos_profile", "label": _(
            "الفرع"), "fieldtype": "Link", "options": "POS Profile"},
        {"fieldname": "posa_pos_opening_shift", "label": _(
            "مستند الفتح"), "fieldtype": "Link", "options": "POS Opening Shift"},
        {"fieldname": "posting_time", "label": _(
            "الوقت"), "fieldtype": "Time"},
        {"fieldname": "grand_total", "label": _(
            "الإجمالي"), "fieldtype": "Currency"},
        {"fieldname": "paid_amount", "label": _(
            "المدفوع"), "fieldtype": "Currency"},
        {"fieldname": "change_amount", "label": _(
            "الباقي"), "fieldtype": "Currency"},
        {"fieldname": "actual_amount", "label": _(
            "المبلغ الفعلي"), "fieldtype": "Currency"},
        {"fieldname": "outstanding_amount", "label": _(
            "المتبقي"), "fieldtype": "Currency"},
        {"fieldname": "discount_amount", "label": _(
            "خصم الفاتورة"), "fieldtype": "Currency"},
        {"fieldname": "posa_item_discount_total", "label": _(
            "خصم الأصناف"), "fieldtype": "Currency"},
    ]

    # Add payment mode columns
    for mode in payment_modes:
        columns.append({
            "fieldname": sanitize_fieldname(mode),
            "label": _(mode),
            "fieldtype": "Currency"
        })

    # Add payment entries column
    columns.append({
        "fieldname": "payment_entries",
        "label": _("إذن المدفوعات"),
        "fieldtype": "Data"
    })

    return columns


def get_payment_modes(filters):
    """Get all unique payment modes used in the filtered invoices from both sources."""
    conditions = get_conditions(filters)

    # Get payment modes from Sales Invoice Payment
    query1 = """
        SELECT DISTINCT sip.mode_of_payment
        FROM `tabSales Invoice Payment` sip
        INNER JOIN `tabSales Invoice` si ON sip.parent = si.name
        {conditions}
        {and_or_where} si.is_pos = 1
        AND si.docstatus = 1
        AND sip.mode_of_payment IS NOT NULL
        AND sip.mode_of_payment != ''
    """.format(
        conditions=conditions,
        and_or_where="AND" if conditions else "WHERE"
    )

    # Get payment modes from Payment Entry
    query2 = """
        SELECT DISTINCT pe.mode_of_payment
        FROM `tabPayment Entry` pe
        INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
        INNER JOIN `tabSales Invoice` si ON per.reference_name = si.name
        {conditions}
        {and_or_where} si.is_pos = 1
        AND si.docstatus = 1
        AND pe.docstatus = 1
        AND per.reference_doctype = 'Sales Invoice'
        AND pe.mode_of_payment IS NOT NULL
        AND pe.mode_of_payment != ''
    """.format(
        conditions=conditions,
        and_or_where="AND" if conditions else "WHERE"
    )

    # Combine both queries with UNION
    query = """
        {query1}
        UNION
        {query2}
        ORDER BY mode_of_payment
    """.format(query1=query1, query2=query2)

    modes = frappe.db.sql(query, filters, as_dict=0)
    return [mode[0] for mode in modes if mode[0]]


def get_data(filters, payment_modes):
    """Fetch and return report data based on filters."""
    conditions = get_conditions(filters)

    # Build payment mode columns - from Sales Invoice Payment
    payment_mode_cases = []
    for mode in payment_modes:
        field_name = sanitize_fieldname(mode)
        safe_mode = mode.replace("'", "''")
        case_sql = f"""
            (SELECT SUM(amount)
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
        {and_or_where} si.is_pos = 1
        AND si.docstatus = 1
        AND si.status NOT IN ('Draft', 'Cancelled')
        ORDER BY si.posting_date DESC, si.posting_time DESC
    """.format(
        conditions=conditions,
        payment_mode_sql=payment_mode_sql,
        and_or_where="AND" if conditions else "WHERE"
    )

    data = frappe.db.sql(query, filters, as_dict=1)

    # Add payment entries and additional payments from Payment Entry
    for row in data:
        # Get Payment Entries linked to this invoice
        payment_entries = frappe.db.sql("""
            SELECT DISTINCT pe.name
            FROM `tabPayment Entry` pe
            INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
            WHERE per.reference_name = %(invoice)s
            AND per.reference_doctype = 'Sales Invoice'
            AND pe.docstatus = 1
            ORDER BY pe.name
        """, {"invoice": row.name}, as_dict=1)

        # Add payment entry names to the row
        if payment_entries:
            row.payment_entries = ", ".join(
                [pe.name for pe in payment_entries])

            # Add amounts from Payment Entry to respective payment modes
            for mode in payment_modes:
                field_name = sanitize_fieldname(mode)
                safe_mode = mode.replace("'", "''")

                # Get amount from Payment Entry for this mode
                pe_amount = frappe.db.sql("""
                    SELECT SUM(per.allocated_amount) as total
                    FROM `tabPayment Entry` pe
                    INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
                    WHERE per.reference_name = %(invoice)s
                    AND per.reference_doctype = 'Sales Invoice'
                    AND pe.docstatus = 1
                    AND pe.mode_of_payment = %(mode)s
                """, {"invoice": row.name, "mode": mode}, as_dict=1)

                if pe_amount and pe_amount[0].total:
                    # Add to existing amount from Sales Invoice Payment
                    current_amount = row.get(field_name) or 0
                    row[field_name] = current_amount + pe_amount[0].total
        else:
            row.payment_entries = ""

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
    if filters.get("posa_pos_closing_shift"):
        conditions.append(
            "si.posa_pos_opening_shift IN (SELECT name FROM `tabPOS Opening Shift` WHERE pos_closing_shift = %(posa_pos_closing_shift)s)")
    return "WHERE " + " AND ".join(conditions) if conditions else ""
