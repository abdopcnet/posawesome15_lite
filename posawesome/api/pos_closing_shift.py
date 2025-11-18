# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt
from datetime import datetime, time as dtime, timedelta
from posawesome import info_logger, error_logger


@frappe.whitelist()
def submit_closing_shift(closing_shift):
    """Submit closing shift - simple wrapper for API calls."""
    import json
    closing_shift = json.loads(closing_shift)

    if closing_shift.get("name"):
        doc = frappe.get_doc("POS Closing Shift", closing_shift.get("name"))
    else:
        doc = frappe.get_doc(closing_shift)
        doc.insert()
        frappe.db.commit()

    doc.submit()  # This calls on_submit() which calls delete_draft_invoices()
    frappe.db.commit()

    return doc


@frappe.whitelist()
def check_closing_time_allowed(pos_profile):
    """
    Check if closing shift is allowed at current time
    Returns: {"allowed": True/False, "message": "reason"}
    """
    try:
        if not pos_profile:
            return {"allowed": True, "message": "No profile specified"}

        # FRAPPE STANDARD: Handle string or dict
        if isinstance(pos_profile, dict):
            pos_profile = pos_profile.get('name')

        profile = frappe.get_doc("POS Profile", pos_profile)

        # Check if closing time control is enabled
        if not profile.get("posa_closing_time_control"):
            return {"allowed": True, "message": "Time control disabled"}

        closing_start_time = profile.get("posa_closing_time_start")
        closing_end_time = profile.get("posa_closing_time_end")

        if not closing_start_time or not closing_end_time:
            return {"allowed": True, "message": "Time not configured"}

        # Parse time strings
        start_time = _parse_time_helper(closing_start_time)
        end_time = _parse_time_helper(closing_end_time)

        if not start_time or not end_time:
            return {"allowed": True, "message": "Invalid time format"}

        # Get current time
        current_dt = frappe.utils.now_datetime()

        # Create datetime objects for comparison
        start_dt = current_dt.replace(hour=start_time.hour, minute=start_time.minute,
                                      second=start_time.second, microsecond=start_time.microsecond)
        end_dt = current_dt.replace(hour=end_time.hour, minute=end_time.minute,
                                    second=end_time.second, microsecond=end_time.microsecond)

        # Handle overnight shifts (e.g., 23:00 to 02:00)
        if start_time > end_time:
            end_dt = end_dt + timedelta(days=1)

        # Check if current time is within [start_dt, end_dt]
        allowed = start_dt <= current_dt <= end_dt

        if allowed:
            return {"allowed": True, "message": "Within allowed time"}
        else:
            start_str = start_time.strftime("%H:%M")
            end_str = end_time.strftime("%H:%M")
            if start_time > end_time:
                end_str += " (next day)"
            return {
                "allowed": False,
                "message": f"Closing is allowed only between {start_str} and {end_str}"
            }

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] check_closing_time_allowed: {str(e)}")
        return {"allowed": True, "message": "Error checking time, allowing by default"}


@frappe.whitelist()
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Get cashiers for filters (used in Link field queries)
    """
    try:
        return frappe.db.sql("""SELECT DISTINCT user FROM `tabPOS Opening Shift` WHERE docstatus = 1""")
    except Exception as e:
        error_logger.error(f"[pos_closing_shift.py] get_cashiers: {str(e)}")
        return []


@frappe.whitelist()
def get_pos_invoices(pos_opening_shift):
    """
    GET - Get POS invoices for opening shift
    """
    try:
        return _get_pos_invoices_helper(pos_opening_shift)
    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_pos_invoices: {str(e)}")
        frappe.throw(_("Error fetching POS invoices"))


@frappe.whitelist()
def get_payments_entries(pos_opening_shift):
    """
    GET - Get payment entries for opening shift (for "Payments Submitted" section)
    """
    try:
        return _get_payments_entries_helper(pos_opening_shift)
    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_payments_entries: {str(e)}")
        frappe.throw(_("Error fetching payment entries"))


@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend)
    """
    try:
        # Use session user if not specified
        if not user:
            user = frappe.session.user

        # Find current open shift for user
        open_shift = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "pos_profile": pos_profile,
                "docstatus": 1,
                "status": "Open"
            },
            fields=["name", "pos_profile"],
            order_by="period_start_date desc",
            limit=1
        )

        if not open_shift:
            return {"total": 0.0}

        shift_name = open_shift[0].name
        pos_profile = open_shift[0].pos_profile

        # Calculate cash total using helper
        payment_totals = _calculate_payment_totals(shift_name, pos_profile)

        # Find cash payment mode
        cash_total = 0.0
        for payment in payment_totals:
            # Check if this is cash payment
            if payment.get("is_cash", False):
                cash_total += payment.get("expected_amount", 0.0)

        return {"total": cash_total}

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_current_cash_total: {str(e)}")
        return {"total": 0.0}


@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend)
    """
    try:
        # Use session user if not specified
        if not user:
            user = frappe.session.user

        # Find current open shift for user
        open_shift = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "pos_profile": pos_profile,
                "docstatus": 1,
                "status": "Open"
            },
            fields=["name", "pos_profile"],
            order_by="period_start_date desc",
            limit=1
        )

        if not open_shift:
            return {"total": 0.0}

        shift_name = open_shift[0].name
        pos_profile = open_shift[0].pos_profile

        # Calculate payment totals using helper
        payment_totals = _calculate_payment_totals(shift_name, pos_profile)

        # Sum non-cash payments
        non_cash_total = 0.0
        for payment in payment_totals:
            # Check if this is NOT cash payment
            if not payment.get("is_cash", False):
                non_cash_total += payment.get("expected_amount", 0.0)

        return {"total": non_cash_total}

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_current_non_cash_total: {str(e)}")
        return {"total": 0.0}


@frappe.whitelist()
def make_closing_shift_from_opening(opening_shift):
    """
    POST - Create closing shift from opening shift
    Returns: closing shift document as dict
    """
    try:
        info_logger.info(
            f"[pos_closing_shift.py] Creating closing shift from opening: {opening_shift}")

        # Handle string and dict formats only (no JSON parsing)
        if isinstance(opening_shift, str):
            # String = document name directly
            opening_shift_name = opening_shift
            info_logger.info(
                f"[pos_closing_shift.py] Using string as document name: {opening_shift_name}")
        elif isinstance(opening_shift, dict):
            # Dict = extract 'name' field
            opening_shift_name = opening_shift.get("name")
            if not opening_shift_name:
                error_logger.error(
                    f"[pos_closing_shift.py] make_closing_shift_from_opening: opening_shift dict has no 'name' field")
                frappe.throw(
                    _("Invalid opening shift data: missing 'name' field"))
            info_logger.info(
                f"[pos_closing_shift.py] Using name from dict: {opening_shift_name}")
        else:
            error_logger.error(
                f"[pos_closing_shift.py] make_closing_shift_from_opening: opening_shift is neither string nor dict, type: {type(opening_shift)}")
            frappe.throw(
                _("Invalid opening shift data: must be string or dict"))

        if not opening_shift_name:
            error_logger.error(
                f"[pos_closing_shift.py] make_closing_shift_from_opening: Could not extract opening_shift_name")
            frappe.throw(
                _("Invalid opening shift data: could not determine shift name"))

        info_logger.info(
            f"[pos_closing_shift.py] Using opening shift name: {opening_shift_name}")

        # Get opening shift document
        opening = frappe.get_doc("POS Opening Shift", opening_shift_name)

        # Check if opening shift is valid
        if opening.docstatus != 1:
            frappe.throw(_("Opening shift must be submitted"))

        if opening.status != "Open":
            frappe.throw(_("Opening shift is already closed"))

        # Check if closing shift already exists
        existing_closing = frappe.db.get_value(
            "POS Closing Shift",
            filters={
                "pos_opening_shift": opening_shift_name,
                "docstatus": ["<", 2]  # Draft or Submitted
            },
            fieldname="name"
        )

        if existing_closing:
            # Return existing closing shift
            info_logger.info(
                f"[pos_closing_shift.py] Returning existing closing shift: {existing_closing}")
            return frappe.get_doc("POS Closing Shift", existing_closing).as_dict()

        # Create new closing shift
        closing = frappe.new_doc("POS Closing Shift")
        closing.pos_opening_shift = opening.name
        closing.period_start_date = opening.period_start_date
        closing.period_end_date = frappe.utils.now_datetime()
        closing.pos_profile = opening.pos_profile
        closing.user = opening.user
        closing.company = opening.company

        # Get payment totals using centralized helper
        payment_totals = _calculate_payment_totals(
            opening.name, opening.pos_profile)

        # Add payment reconciliation rows
        for payment in payment_totals:
            closing.append("payment_reconciliation", {
                "mode_of_payment": payment.get("mode_of_payment"),
                "opening_amount": payment.get("opening_amount", 0.0),
                "expected_amount": payment.get("expected_amount", 0.0),
                "closing_amount": 0.0,  # To be filled by user
            })

        # Get POS invoices using helper
        pos_transactions = _get_pos_invoices_helper(opening.name)
        for invoice in pos_transactions:
            closing.append("pos_transactions", {
                "sales_invoice": invoice.get("name"),  # ← Field name is 'sales_invoice' not 'pos_invoice'
                "posting_date": invoice.get("posting_date"),
                "grand_total": invoice.get("grand_total"),
                "customer": invoice.get("customer")
            })

        # Get payment entries using helper
        payment_entries = _get_payments_entries_helper(opening.name)
        for entry in payment_entries:
            closing.append("payment_entries", {
                "payment_entry": entry.get("name"),
                "posting_date": entry.get("posting_date"),
                "mode_of_payment": entry.get("mode_of_payment"),
                "paid_amount": entry.get("paid_amount")
            })

        # Insert but don't submit yet (user needs to confirm amounts)
        closing.insert(ignore_permissions=True)
        frappe.db.commit()

        info_logger.info(
            f"[pos_closing_shift.py] Created closing shift: {closing.name}")

        return closing.as_dict()

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] make_closing_shift_from_opening: {str(e)}")
        frappe.throw(_("Error creating closing shift"))


# =============================================================================
# HELPER FUNCTIONS (not @frappe.whitelist())
# =============================================================================

def _calculate_payment_totals(pos_opening_shift, pos_profile):
    """
    Helper: Calculate payment totals for closing shift
    Returns list of payment totals with expected amounts
    """
    try:
        # FRAPPE STANDARD: Extract name from dict if needed
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile

        # Get POS Profile document to get payment methods
        profile_doc = frappe.get_doc("POS Profile", pos_profile_name)

        # Get opening shift document
        opening_doc = frappe.get_doc("POS Opening Shift", pos_opening_shift)

        # Initialize payment totals from POS Profile payment methods
        payment_totals = []
        for payment_method in profile_doc.payments:
            mode_of_payment = payment_method.mode_of_payment

            # Get opening amount from opening shift
            opening_amount = 0.0
            for balance in opening_doc.balance_details:
                if balance.mode_of_payment == mode_of_payment:
                    opening_amount = balance.amount
                    break

            # Get cash mode from POS Profile
            cash_mode = profile_doc.get("posa_cash_mode_of_payment", "Cash")
            is_cash = (mode_of_payment == cash_mode)

            # Calculate expected amount from invoices
            invoice_payments = frappe.db.sql("""
                SELECT 
                    IFNULL(SUM(sip.amount), 0) as total_amount,
                    IFNULL(SUM(si.change_amount), 0) as total_change
                FROM `tabSales Invoice Payment` sip
                INNER JOIN `tabSales Invoice` si ON sip.parent = si.name
                WHERE si.posa_pos_opening_shift = %s
                AND si.docstatus = 1
                AND sip.mode_of_payment = %s
            """, (pos_opening_shift, mode_of_payment), as_dict=True)

            total_amount = invoice_payments[0].total_amount if invoice_payments else 0.0
            total_change = invoice_payments[0].total_change if invoice_payments else 0.0

            # For cash: subtract change amount from total
            if is_cash:
                expected_amount = opening_amount + total_amount - total_change
            else:
                expected_amount = total_amount

            payment_totals.append({
                "mode_of_payment": mode_of_payment,
                "opening_amount": opening_amount,
                "expected_amount": expected_amount,
                "is_cash": is_cash
            })

        return payment_totals

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] _calculate_payment_totals: {str(e)}")
        return []


def _parse_time_helper(time_value):
    """Helper function to parse time value to datetime.time object"""
    try:
        if isinstance(time_value, str):
            # Try parsing as time string
            try:
                parsed = datetime.strptime(time_value, "%H:%M:%S").time()
                return parsed
            except ValueError:
                parsed = datetime.strptime(time_value, "%H:%M").time()
                return parsed
        elif isinstance(time_value, datetime):
            return time_value.time()
        elif isinstance(time_value, timedelta):
            total_seconds = int(time_value.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return datetime(1900, 1, 1, hours, minutes, seconds).time()
        else:
            return None
    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] _parse_time_helper: {str(e)}")
        return None


def _submit_printed_invoices(pos_opening_shift):
    """Helper function to submit printed invoices"""
    try:
        # Find printed but unsubmitted invoices
        printed_invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": pos_opening_shift,
                "docstatus": 0,  # Draft
                "posa_is_printed": 1
            },
            fields=["name"]
        )

        for invoice in printed_invoices:
            try:
                doc = frappe.get_doc("Sales Invoice", invoice.name)
                doc.submit()
            except Exception as e:
                error_logger.error(
                    f"[pos_closing_shift.py] Error submitting invoice {invoice.name}: {str(e)}")
                pass

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] _submit_printed_invoices: {str(e)}")


def _get_pos_invoices_helper(pos_opening_shift):
    """Helper function to get POS invoices"""
    try:
        return frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": pos_opening_shift,
                "docstatus": 1
            },
            fields=["name", "posting_date",
                    "posting_time", "grand_total", "customer"],
            order_by="posting_date, posting_time"
        )
    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] _get_pos_invoices_helper: {str(e)}")
        return []


def _get_payments_entries_helper(pos_opening_shift):
    """
    Helper: Get payment entries for POS Opening Shift
    Returns list of payment entries
    
    NOTE: Payment Entry doctype doesn't have posa_pos_opening_shift field.
    This function returns empty list for now. If you need to track Payment Entries,
    you'll need to add a custom field to Payment Entry doctype.
    """
    try:
        # Payment Entry doesn't have posa_pos_opening_shift field
        # Return empty list to avoid SQL errors
        return []
        
        # TODO: If you want to link Payment Entries to POS Opening Shift:
        # 1. Add custom field 'posa_pos_opening_shift' to Payment Entry doctype
        # 2. Then uncomment this code:
        # return frappe.get_all(
        #     "Payment Entry",
        #     filters={
        #         "posa_pos_opening_shift": pos_opening_shift,
        #         "docstatus": 1
        #     },
        #     fields=["name", "posting_date", "mode_of_payment", "paid_amount"],
        #     order_by="posting_date"
        # )
    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] _get_payments_entries_helper: {str(e)}")
        return []
