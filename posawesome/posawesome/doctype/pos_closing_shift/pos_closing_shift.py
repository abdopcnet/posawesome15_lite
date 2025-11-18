# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt
from datetime import datetime, time as dtime, timedelta
from posawesome import info_logger, error_logger


class POSClosingShift(Document):
    def validate(self):
        # Validate shift closing allowed time window based on POS Profile settings
        self._validate_shift_closing_window()

        user = frappe.get_all(
            "POS Closing Shift",
            filters={
                "user": self.user,
                "docstatus": 1,
                "pos_opening_shift": self.pos_opening_shift,
                "name": ["!=", self.name],
            },
        )

        if user:
            frappe.throw(
                _(
                    "POS Closing Shift {} against {} between selected period".format(
                        frappe.bold("already exists"), frappe.bold(self.user)
                    )
                ),
                title=_("Invalid Period"),
            )

        if frappe.db.get_value("POS Opening Shift", self.pos_opening_shift, "status") != "Open":
            frappe.throw(
                _("Selected POS Opening Shift should be open."),
                title=_("Invalid Opening Entry"),
            )
        self.update_payment_reconciliation()

    def _parse_time(self, value):
        """Parse a value to datetime.time supporting str and time inputs."""
        if not value:
            return None
        if isinstance(value, dtime):
            return value
        # Support formats with microseconds
        for fmt in ("%H:%M:%S.%f", "%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(str(value), fmt).time()
            except Exception:
                continue
        return None

    def _validate_shift_closing_window(self):
        """Validate if period_end_date is within allowed closing window for POS Profile."""
        if not self.pos_profile or not self.period_end_date:
            return

        profile = frappe.get_doc("POS Profile", self.pos_profile)

        # Check if closing time control is enabled
        if not profile.get("posa_closing_time_control"):
            return  # Skip validation if time control is not enabled

        shift_opening_time = profile.get("posa_closing_time_start")
        shift_closing_time = profile.get("posa_closing_time_end")

        if not shift_opening_time or not shift_closing_time:
            return  # No restriction if not configured

        # Parse times
        start_time = self._parse_time(shift_opening_time)
        end_time = self._parse_time(shift_closing_time)

        if not start_time or not end_time:
            return

        # Get period_end_date as datetime
        period_end_dt = frappe.utils.get_datetime(self.period_end_date)

        # Create datetime objects for comparison
        start_dt = period_end_dt.replace(
            hour=start_time.hour, minute=start_time.minute, second=start_time.second, microsecond=start_time.microsecond)
        end_dt = period_end_dt.replace(
            hour=end_time.hour, minute=end_time.minute, second=end_time.second, microsecond=end_time.microsecond)

        # If start_time > end_time, assume end_time is next day
        if start_time > end_time:
            end_dt = end_dt + timedelta(days=1)

        # Check if period_end_dt is within [start_dt, end_dt]
        allowed = start_dt <= period_end_dt <= end_dt

        if not allowed:
            start_str = start_time.strftime("%H:%M")
            end_str = end_time.strftime("%H:%M")
            if start_time > end_time:
                end_str += " (next day)"
            frappe.throw(
                _("Closing shift is not allowed at this time. Closing is allowed only between {0} and {1}").format(
                    start_str, end_str),
                title=_("Closing Time Not Allowed")
            )

    def update_payment_reconciliation(self):
        # update the difference values in Payment Reconciliation child table
        # get default precision for site
        precision = frappe.get_cached_value(
            "System Settings", None, "currency_precision") or 3
        for d in self.payment_reconciliation:
            d.difference = +flt(d.closing_amount, precision) - \
                flt(d.expected_amount, precision)

    def on_submit(self):
        try:
            backend_logger.info(
                f'POS Closing Shift {self.name} submitted by {self.user}')
            opening_entry = frappe.get_doc(
                "POS Opening Shift", self.pos_opening_shift)
            opening_entry.pos_closing_shift = self.name
            opening_entry.set_status()
            self.delete_draft_invoices()
            opening_entry.save()
            backend_logger.info(
                f'POS Closing Shift {self.name} submitted successfully')
        except Exception as e:
            error_logger.error(
                f'Error submitting POS Closing Shift {self.name}: {str(e)}', exc_info=True)
            raise

    def on_cancel(self):
        try:
            backend_logger.info(
                f'POS Closing Shift {self.name} cancelled by {frappe.session.user}')
            if frappe.db.exists("POS Opening Shift", self.pos_opening_shift):
                opening_entry = frappe.get_doc(
                    "POS Opening Shift", self.pos_opening_shift)
                if opening_entry.pos_closing_shift == self.name:
                    opening_entry.pos_closing_shift = ""
                    opening_entry.set_status()
                opening_entry.save()
            backend_logger.info(
                f'POS Closing Shift {self.name} cancelled successfully')
        except Exception as e:
            error_logger.error(
                f'Error cancelling POS Closing Shift {self.name}: {str(e)}', exc_info=True)
            raise

    @frappe.whitelist()
    def get_payment_reconciliation_details(self):
        currency = frappe.get_cached_value(
            "Company", self.company, "default_currency")
        return frappe.render_template(
            "posawesome/posawesome/doctype/pos_closing_shift/closing_shift_details.html",
            {"data": self, "currency": currency},
        )

    def delete_draft_invoices(self):
        """Delete draft invoices for this shift if auto-delete is enabled in POS Profile."""
        if not frappe.get_value("POS Profile", self.pos_profile, "posa_auto_delete_draft_invoices"):
            return

        backend_logger.info(
            f'Deleting draft invoices for POS Closing Shift {self.name}')

        # Find draft invoices for this shift
        draft_invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": self.pos_opening_shift,
                "docstatus": 0  # Draft only
            },
            fields=["name"]
        )

        # Delete each draft invoice
        for invoice in draft_invoices:
            try:
                frappe.delete_doc("Sales Invoice", invoice.name,
                                  force=1, ignore_permissions=True)
            except Exception as e:
                pass


@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
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
        pos_profile_name = open_shift[0].pos_profile

        # Get cash mode of payment from POS Profile
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile_name,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Calculate payment totals using helper
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Get cash total from the dictionary
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))

        return {"total": cash_total}

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_current_cash_total: {str(e)}", exc_info=True)
        return {"total": 0.0}


@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
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
        pos_profile_name = open_shift[0].pos_profile

        # Get cash mode of payment from POS Profile
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile_name,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Calculate payment totals using helper
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Sum all non-cash payments
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)

        return {"total": non_cash_total}

    except Exception as e:
        error_logger.error(
            f"[pos_closing_shift.py] get_current_non_cash_total: {str(e)}", exc_info=True)
        return {"total": 0.0}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _calculate_payment_totals(pos_opening_shift, pos_profile):
    """
    UNIFIED payment calculation logic used by both closing shift and navbar.
    This is the SINGLE SOURCE OF TRUTH for payment totals.

    Returns: dict with payment_totals per mode_of_payment
    Example: {
        "Cash": 930.00,
        "شبكة - فرع الخضراء": 3017.65
    }
    """
    try:
        invoices = _get_pos_invoices_helper(pos_opening_shift)
        payments = {}

        # Get cash mode of payment
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Process Sales Invoice Payments
        for d in invoices:
            for p in d.payments:
                amount = p.amount

                # ✅ طرح change_amount من المبلغ النقدي فقط
                # change_amount هو المبلغ الذي يُرجع للعميل كباقي
                # يجب طرحه من المبلغ المتوقع في المصالحة النقدية
                if p.mode_of_payment == cash_mode_of_payment:
                    amount = p.amount - flt(d.change_amount or 0)

                # Add to payments dict
                if p.mode_of_payment in payments:
                    payments[p.mode_of_payment] += flt(amount)
                else:
                    payments[p.mode_of_payment] = flt(amount)

        # Process Payment Entries
        pos_payments = _get_payments_entries_helper(pos_opening_shift)
        for py in pos_payments:
            if py.mode_of_payment in payments:
                payments[py.mode_of_payment] += flt(py.paid_amount)
            else:
                payments[py.mode_of_payment] = flt(py.paid_amount)

        return payments

    except Exception as e:
        error_logger.error(f"Error in _calculate_payment_totals: {str(e)}")
        return {}


def _parse_time_helper(time_value):
    """Helper function to parse time value to datetime.time object"""
    if not time_value:
        return None
    if isinstance(time_value, dtime):
        return time_value
    for fmt in ("%H:%M:%S.%f", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(str(time_value), fmt).time()
        except Exception:
            continue
    return None


def _submit_printed_invoices(pos_opening_shift):
    """Helper function to submit printed invoices"""
    try:
        invoices_list = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": pos_opening_shift,
                "docstatus": 0,
                "posa_is_printed": 1,
            },
        )
        for invoice in invoices_list:
            invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)
            invoice_doc.submit()
    except Exception as e:
        pass


def _get_pos_invoices_helper(pos_opening_shift):
    """Helper function to get POS invoices"""
    try:
        data = frappe.db.sql(
            """
        select
            name
        from
            `tabSales Invoice`
        where
            docstatus = 1 and posa_pos_opening_shift = %s
        """,
            (pos_opening_shift),
            as_dict=1,
        )

        return [frappe.get_doc("Sales Invoice", d.name).as_dict() for d in data]
    except Exception as e:
        return []


def _get_payments_entries_helper(pos_opening_shift):
    """
    Helper function to get payment entries linked to invoices in this shift.
    Payment Entries link to Sales Invoices via the Payment Entry Reference child table.
    """
    try:
        # Query Payment Entries that reference Sales Invoices from this shift
        payment_entries = frappe.db.sql("""
            SELECT DISTINCT
                pe.name,
                pe.mode_of_payment,
                per.allocated_amount as paid_amount,
                pe.posting_date,
                pe.party,
                per.reference_name
            FROM `tabPayment Entry` pe
            INNER JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
            INNER JOIN `tabSales Invoice` si ON si.name = per.reference_name
            WHERE pe.docstatus = 1
            AND pe.payment_type = 'Receive'
            AND per.reference_doctype = 'Sales Invoice'
            AND si.posa_pos_opening_shift = %s
            ORDER BY pe.posting_date
        """, (pos_opening_shift,), as_dict=1)

        return payment_entries
    except Exception as e:
        error_logger.error(
            f"Error in _get_payments_entries_helper: {str(e)}")
        return []
