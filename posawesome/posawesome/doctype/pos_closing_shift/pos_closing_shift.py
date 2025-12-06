# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint
from datetime import datetime, time as dtime, timedelta


# =============================================================================
# SECTION 1: DOCUMENT CLASS - POSClosingShift
# =============================================================================
# Main document class for POS Closing Shift
# Handles document lifecycle: validate, on_submit, on_cancel

class POSClosingShift(Document):
    # ========================================================================
    # SECTION 1.1: VALIDATE METHOD
    # ========================================================================
    # Validates document before save/submit
    # Related to: section_break_1 (period_start_date, period_end_date, pos_opening_shift)
    #             section_break_2 (company, pos_profile, user)
    #             section_break_4 (payment_reconciliation)
    def validate(self):
        try:
            # Validate shift closing allowed time window based on POS Profile settings
            # Checks if period_end_date is within allowed closing window
            # Related to: section_break_1 (period_end_date), section_break_2 (pos_profile)
            self._validate_shift_closing_window()

            # Validate no duplicate closing shifts for same user and opening shift
            # Related to: section_break_2 (user), section_break_1 (pos_opening_shift)
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

            # Validate opening shift is still open
            # Related to: section_break_1 (pos_opening_shift)
            opening_shift_status = frappe.db.get_value("POS Opening Shift", self.pos_opening_shift, "status")
            if opening_shift_status != "Open":
                frappe.throw(
                    _("Selected POS Opening Shift should be open."),
                    title=_("Invalid Opening Entry"),
                )
            
            # Update payment reconciliation difference values
            # Calculates difference = closing_amount - expected_amount for each payment method
            # Related to: section_break_4 (payment_reconciliation)
            self.update_payment_reconciliation()
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error validating POS Closing Shift {self.name}: {str(e)}")
            raise

    # ========================================================================
    # SECTION 1.2: PARSE TIME HELPER (PRIVATE)
    # ========================================================================
    # Helper method to parse time values to datetime.time object
    # Used by _validate_shift_closing_window
    # Related to: section_break_1 (period_end_date), section_break_2 (pos_profile)
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

    # ========================================================================
    # SECTION 1.3: VALIDATE SHIFT CLOSING WINDOW (PRIVATE)
    # ========================================================================
    # Validates if current time is within allowed closing window using POS Closing Shift fields
    # Uses posting_date + time window (not period_end_date)
    # Checks posa_closing_time_control, posa_closing_time_start, posa_closing_time_end
    # Related to: section_break_1 (posting_date), section_break_2 (pos_profile)
    def _validate_shift_closing_window(self):
        """
        Validate if current time is within allowed closing window using POS Closing Shift fields.
        Uses posting_date + time window (not period_end_date).
        Example: posting_date=2025-12-06, time_start=18:00, time_end=20:00
        Validates if current time is between 2025-12-06 18:00:00 and 2025-12-06 20:00:00
        """
        try:
            if not self.posting_date:
                return

            # Check if closing time control is enabled in POS Closing Shift
            time_control = self.get("posa_closing_time_control")
            if not cint(time_control):
                return  # Skip validation if time control is not enabled

            # Get closing time window from POS Closing Shift
            closing_start_time = self.get("posa_closing_time_start")
            closing_end_time = self.get("posa_closing_time_end")

            if not closing_start_time or not closing_end_time:
                return  # No restriction if not configured

            # Parse times
            start_time = self._parse_time(closing_start_time)
            end_time = self._parse_time(closing_end_time)

            if not start_time or not end_time:
                return

            # Get posting_date and current time
            posting_date = frappe.utils.getdate(self.posting_date)
            current_dt = frappe.utils.now_datetime()

            # Create datetime objects for comparison using posting_date
            start_dt = datetime.combine(posting_date, start_time)
            end_dt = datetime.combine(posting_date, end_time)

            # If start_time > end_time, assume end_time is next day (overnight shift)
            if start_time > end_time:
                end_dt = end_dt + timedelta(days=1)

            # Check if current_dt is within [start_dt, end_dt]
            allowed = start_dt <= current_dt <= end_dt

            if not allowed:
                start_str = start_time.strftime("%H:%M")
                end_str = end_time.strftime("%H:%M")
                if start_time > end_time:
                    end_str += " (next day)"
                frappe.throw(
                    _("Closing shift is not allowed at this time. Closing is allowed only between {0} and {1} on {2}").format(
                        start_str, end_str, frappe.utils.formatdate(posting_date)),
                    title=_("Closing Time Not Allowed")
                )
        except frappe.exceptions.ValidationError:
            # Re-raise validation errors (like frappe.throw)
            raise
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error validating shift closing window: {str(e)}")
            raise

    # ========================================================================
    # SECTION 1.4: UPDATE PAYMENT RECONCILIATION
    # ========================================================================
    # Updates difference values in Payment Reconciliation child table
    # difference = closing_amount - expected_amount
    # Related to: section_break_4 (payment_reconciliation)
    def update_payment_reconciliation(self):
        try:
            # Update the difference values in Payment Reconciliation child table
            # Get default precision for site (used for float calculations)
            precision = frappe.get_cached_value(
                "System Settings", None, "currency_precision") or 3
            for d in self.payment_reconciliation:
                d.difference = +flt(d.closing_amount, precision) - \
                    flt(d.expected_amount, precision)
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error updating payment reconciliation: {str(e)}")
            raise

    # ========================================================================
    # SECTION 1.5: ON SUBMIT METHOD
    # ========================================================================
    # Called when document is submitted
    # Links closing shift to opening shift and deletes draft invoices
    # Related to: section_break_1 (pos_opening_shift), section_break_2 (pos_profile)
    def on_submit(self):
        try:
            # Link this closing shift to the opening shift
            # Related to: section_break_1 (pos_opening_shift)
            opening_entry = frappe.get_doc(
                "POS Opening Shift", self.pos_opening_shift)
            opening_entry.pos_closing_shift = self.name
            opening_entry.set_status()  # Updates opening shift status to "Closed"
            
            # Delete draft invoices if auto-delete is enabled
            # Related to: section_break_2 (pos_profile)
            self.delete_draft_invoices()
            
            opening_entry.save()
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error submitting POS Closing Shift {self.name}: {str(e)}")
            raise

    # ========================================================================
    # SECTION 1.6: ON CANCEL METHOD
    # ========================================================================
    # Called when document is cancelled
    # Unlinks closing shift from opening shift
    # Related to: section_break_1 (pos_opening_shift)
    def on_cancel(self):
        try:
            # Unlink this closing shift from the opening shift
            # Related to: section_break_1 (pos_opening_shift)
            if frappe.db.exists("POS Opening Shift", self.pos_opening_shift):
                opening_entry = frappe.get_doc(
                    "POS Opening Shift", self.pos_opening_shift)
                if opening_entry.pos_closing_shift == self.name:
                    opening_entry.pos_closing_shift = ""
                    opening_entry.set_status()  # Updates opening shift status back to "Open"
                opening_entry.save()
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error cancelling POS Closing Shift {self.name}: {str(e)}")
            raise

    # ========================================================================
    # SECTION 1.7: DELETE DRAFT INVOICES (PRIVATE)
    # ========================================================================
    # Deletes draft invoices for this shift if auto-delete is enabled in POS Profile
    # Related to: section_break_2 (pos_profile), section_break_1 (pos_opening_shift)
    def delete_draft_invoices(self):
        """Delete draft invoices for this shift if auto-delete is enabled in POS Profile."""
        try:
            # Check if auto-delete is enabled in POS Profile
            # Related to: section_break_2 (pos_profile)
            if not frappe.get_value("POS Profile", self.pos_profile, "posa_auto_delete_draft_invoices"):
                return

            # Find draft invoices for this shift
            # Related to: section_break_1 (pos_opening_shift)
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
                    frappe.log_error(f"[[pos_closing_shift.py]] Error deleting draft invoice {invoice.name}: {str(e)}")
                    continue
        except Exception as e:
            frappe.log_error(f"[[pos_closing_shift.py]] Error in delete_draft_invoices: {str(e)}")
            # Don't raise - allow closing shift to complete even if draft deletion fails


# =============================================================================
# SECTION 2: API ENDPOINTS - GET CURRENT CASH TOTAL
# =============================================================================
# API endpoint to get current cash total for shift (used in POS frontend Navbar)
# Related to: section_break_2 (pos_profile, user), section_break_4 (payment_reconciliation)

@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
    Related to: section_break_2 (pos_profile, user)
    """
    try:
        # Use session user if not specified
        # Related to: section_break_2 (user)
        if not user:
            user = frappe.session.user

        # Find current open shift for user
        # Related to: section_break_2 (pos_profile, user)
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
        # Related to: section_break_2 (pos_profile)
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile_name,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        # Related to: section_break_4 (payment_reconciliation)
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Get cash total from dict (payment_totals is a dict, not a list!)
        # Related to: section_break_4 (payment_reconciliation)
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))

        return {"total": cash_total}

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: {str(e)}")
        return {"total": 0.0}


# =============================================================================
# SECTION 3: API ENDPOINTS - GET CURRENT NON-CASH TOTAL
# =============================================================================
# API endpoint to get current non-cash total for shift (used in POS frontend Navbar)
# Related to: section_break_2 (pos_profile, user), section_break_4 (payment_reconciliation)

@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
    Related to: section_break_2 (pos_profile, user)
    """
    try:
        # Use session user if not specified
        # Related to: section_break_2 (user)
        if not user:
            user = frappe.session.user

        # Find current open shift for user
        # Related to: section_break_2 (pos_profile, user)
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
        # Related to: section_break_2 (pos_profile)
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile_name,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        # Related to: section_break_4 (payment_reconciliation)
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Sum all non-cash payments (payment_totals is a dict, not a list!)
        # Related to: section_break_4 (payment_reconciliation)
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)

        return {"total": non_cash_total}

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: {str(e)}")
        return {"total": 0.0}


# =============================================================================
# SECTION 4: HELPER FUNCTIONS
# =============================================================================
# Internal helper functions (not @frappe.whitelist())
# Used by document methods and API endpoints

# ========================================================================
# SECTION 4.1: CALCULATE PAYMENT TOTALS
# ========================================================================
# UNIFIED payment calculation logic used by both closing shift and navbar
# This is the SINGLE SOURCE OF TRUTH for payment totals
# Matches Sales Register report calculation exactly
# Related to: section_break_4 (payment_reconciliation), section_break_3 (pos_transactions)

def _calculate_payment_totals(pos_opening_shift, pos_profile):
    """
    UNIFIED payment calculation logic used by both closing shift and navbar.
    This is the SINGLE SOURCE OF TRUTH for payment totals.
    Matches Sales Register report calculation exactly.

    Returns: dict with payment_totals per mode_of_payment (in company currency)
    Example: {
        "Cash": 930.00,
        "شبكة - فرع الخضراء": 3017.65
    }
    Related to: section_break_4 (payment_reconciliation)
    """
    try:
        # Get all invoices for this opening shift
        # Related to: section_break_3 (pos_transactions)
        invoices = _get_pos_invoices_helper(pos_opening_shift)
        payments = {}

        # Get cash mode of payment from POS Profile
        # Related to: section_break_2 (pos_profile)
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Process Sales Invoice Payments (matches Sales Register logic)
        # Related to: section_break_3 (pos_transactions)
        for d in invoices:
            invoice_name = d.get("name", "Unknown")
            invoice_payments = d.get("payments", [])
            
            if not invoice_payments:
                continue
            
            # Single currency: change_amount equals base_change_amount
            # Related to: section_break_3 (pos_transactions)
            change_amount = flt(d.get("change_amount") or 0)
            
            for p in invoice_payments:
                # Single currency: amount equals base_amount
                amount = flt(p.get("amount") or 0)
                mode_of_payment = p.get("mode_of_payment")

                # Subtract change_amount from cash payments only (matches Sales Register)
                # change_amount is the amount returned to customer as change
                # Must be subtracted from expected amount in cash reconciliation
                # Related to: section_break_4 (payment_reconciliation)
                if mode_of_payment == cash_mode_of_payment:
                    amount = amount - change_amount

                # Add to payments dict
                # Related to: section_break_4 (payment_reconciliation)
                if mode_of_payment in payments:
                    payments[mode_of_payment] += amount
                else:
                    payments[mode_of_payment] = amount

        # Process Payment Entries (separate from Sales Invoice Payments)
        # Related to: section_break_3 (pos_transactions)
        pos_payments = _get_payments_entries_helper(pos_opening_shift)
        for py in pos_payments:
            mode_of_payment = py.get("mode_of_payment")
            # Single currency: paid_amount equals base_paid_amount
            paid_amount = flt(py.get("paid_amount") or 0)
            
            # Add to payments dict
            # Related to: section_break_4 (payment_reconciliation)
            if mode_of_payment in payments:
                payments[mode_of_payment] += paid_amount
            else:
                payments[mode_of_payment] = paid_amount

        return payments

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] Error in _calculate_payment_totals: {str(e)}")
        return {}


# ========================================================================
# SECTION 4.2: PARSE TIME HELPER
# ========================================================================
# Helper function to parse time value to datetime.time object
# Used by _validate_shift_closing_window
# Related to: section_break_1 (period_end_date)

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


# ========================================================================
# SECTION 4.3: SUBMIT PRINTED INVOICES
# ========================================================================
# Helper function to submit printed invoices
# Related to: section_break_1 (pos_opening_shift)

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
        frappe.log_error(f"[[pos_closing_shift.py]] _submit_printed_invoices: {str(e)}")
        pass


# ========================================================================
# SECTION 4.4: GET POS INVOICES HELPER
# ========================================================================
# Helper function to get POS invoices with full document data
# Returns full documents matching Sales Register report data structure
# Related to: section_break_3 (pos_transactions)

def _get_pos_invoices_helper(pos_opening_shift):
    """
    Helper function to get POS invoices with full document data.
    Returns full documents matching Sales Register report data structure.
    Related to: section_break_3 (pos_transactions)
    """
    try:
        # Get invoice names first (same query as Sales Register)
        # Related to: section_break_3 (pos_transactions)
        data = frappe.db.sql(
            """
        select
            name
        from
            `tabSales Invoice`
        where
            docstatus = 1 and posa_pos_opening_shift = %s
        order by posting_date, posting_time
        """,
            (pos_opening_shift),
            as_dict=1,
        )

        # Return full documents with all child tables (payments, taxes, etc.)
        # This matches exactly what Sales Register report uses
        # Related to: section_break_3 (pos_transactions)
        invoices = []
        grand_total_sum = 0.0
        net_total_sum = 0.0
        
        for d in data:
            try:
                doc = frappe.get_doc("Sales Invoice", d.name)
                invoice_dict = doc.as_dict()
                
                # Log invoice totals for debugging
                # Single currency: grand_total equals base_grand_total
                # Related to: section_break_5 (grand_total, net_total)
                grand = flt(invoice_dict.get("grand_total") or 0)
                net = flt(invoice_dict.get("net_total") or 0)
                grand_total_sum += grand
                net_total_sum += net
                
                invoices.append(invoice_dict)
            except Exception as e:
                frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: Error loading invoice {d.name}: {str(e)}")
                continue
        
        return invoices
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: {str(e)}")
        return []


# ========================================================================
# SECTION 4.5: GET PAYMENTS ENTRIES HELPER
# ========================================================================
# Helper function to get payment entries linked to invoices in this shift
# Payment Entries link to Sales Invoices via the Payment Entry Reference child table
# Related to: section_break_3 (pos_transactions)

def _get_payments_entries_helper(pos_opening_shift):
    """
    Helper function to get payment entries linked to invoices in this shift.
    Payment Entries link to Sales Invoices via the Payment Entry Reference child table.
    Related to: section_break_3 (pos_transactions)
    """
    try:
        # Query Payment Entries that reference Sales Invoices from this shift
        # Related to: section_break_3 (pos_transactions)
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
        frappe.log_error(f"[[pos_closing_shift.py]] Error in _get_payments_entries_helper: {str(e)}")
        return []
