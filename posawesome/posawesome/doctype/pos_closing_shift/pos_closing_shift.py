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
            # Fetch fields from pos_opening_shift if it's a Data field (not Link)
            # This replaces the fetch_from functionality that doesn't work with Data fields
            if self.pos_opening_shift and frappe.db.exists("POS Opening Shift", self.pos_opening_shift):
                opening_shift = frappe.get_doc("POS Opening Shift", self.pos_opening_shift)
                # Fetch period_start_date if not set
                if not self.period_start_date and opening_shift.period_start_date:
                    self.period_start_date = opening_shift.period_start_date
                # Fetch company if not set
                if not self.company and opening_shift.company:
                    self.company = opening_shift.company
                # Fetch pos_profile if not set
                if not self.pos_profile and opening_shift.pos_profile:
                    self.pos_profile = opening_shift.pos_profile
                # Fetch user if not set
                if not self.user and opening_shift.user:
                    self.user = opening_shift.user

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
                            frappe.bold("already exists"), frappe.bold(
                                self.user)
                        )
                    ),
                    title=_("Invalid Period"),
                )

            # Validate opening shift is still open
            # Related to: section_break_1 (pos_opening_shift)
            opening_shift_status = frappe.db.get_value(
                "POS Opening Shift", self.pos_opening_shift, "status")
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
            frappe.log_error("[pos_closing_shift.py] method: validate", "POS Closing Shift")
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
                message = _get_closing_time_message(start_time, end_time)
                frappe.throw(
                    message,
                    title=_("الإغلاق غير مسموح")
                )
        except frappe.exceptions.ValidationError:
            # Re-raise validation errors (like frappe.throw)
            raise
        except Exception as e:
            frappe.log_error("[pos_closing_shift.py] method: _validate_shift_closing_window", "POS Closing Shift")
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
            frappe.log_error("[pos_closing_shift.py] method: update_payment_reconciliation", "POS Closing Shift")
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
            frappe.log_error("[pos_closing_shift.py] method: on_submit", "POS Closing Shift")
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
            frappe.log_error("[pos_closing_shift.py] method: on_cancel", "POS Closing Shift")
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
                except Exception:
                    # Silent fail - skip problematic invoice (no logging needed)
                    continue
        except Exception:
            # Don't raise - allow closing shift to complete even if draft deletion fails (no logging needed)
            pass


# =============================================================================
# SECTION 2: API ENDPOINTS
# =============================================================================
# API endpoints for POS Closing Shift operations
# Used by POS frontend and form scripts

# ========================================================================
# SECTION 2.1: SUBMIT CLOSING SHIFT
# ========================================================================
# POST - Create and submit closing shift in one operation
# Creates the document and submits it immediately (no draft)

@frappe.whitelist()
def submit_closing_shift(closing_shift):
    """
    POST - Create and submit closing shift in one operation
    Creates the document and submits it immediately (no draft)
    """
    try:
        import json

        # FRAPPE STANDARD: Parse JSON if string
        if isinstance(closing_shift, str):
            closing_shift = json.loads(closing_shift)

        # Create new document from dict (no draft - create and submit in one operation)
        doc = frappe.get_doc(closing_shift)

        # Validate the document (this will also set missing values if needed)
        doc.validate()

        # Insert the document (creates draft)
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        # Submit the document immediately (calls on_submit() which calls delete_draft_invoices())
        doc.submit()
        frappe.db.commit()

        return doc.as_dict()

    except Exception as e:
        frappe.log_error("[pos_closing_shift.py] method: submit_closing_shift", "POS Closing Shift")
        frappe.throw(_("Failed to submit closing shift: {0}").format(str(e)))


# ========================================================================
# SECTION 2.2: CHECK CLOSING TIME ALLOWED
# ========================================================================
# Check if closing shift is allowed at current time
# Returns: {"allowed": True/False, "message": "reason"}

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
            message = _get_closing_time_message(start_time, end_time)
            return {
                "allowed": False,
                "message": message
            }

    except Exception:
        # Graceful degradation - allow by default (no logging needed)
        return {"allowed": True, "message": "Error checking time, allowing by default"}


# ========================================================================
# SECTION 2.3: GET CASHIERS
# ========================================================================
# GET - Get cashiers for filters (used in Link field queries)
# Frontend needs: user field only

@frappe.whitelist()
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Get cashiers for filters (used in Link field queries)
    Frontend needs: user field only
    """
    try:
        # FRAPPE STANDARD: Simple query - only user field needed for frontend
        return frappe.db.sql("""SELECT DISTINCT user FROM `tabPOS Opening Shift` WHERE docstatus = 1""")
    except Exception:
        # Graceful degradation - return empty list (no logging needed)
        return []


# ========================================================================
# SECTION 2.4: GET POS INVOICES
# ========================================================================
# GET - Get POS invoices for opening shift (with payment_entry for each invoice)

@frappe.whitelist()
def get_pos_invoices(pos_opening_shift):
    """
    GET - Get POS invoices for opening shift (with payment_entry for each invoice)
    """
    try:
        invoices = _get_pos_invoices_helper(pos_opening_shift)

        # Get Payment Entries map (invoice_name -> payment_entry_data)
        payment_entries_map = {}
        payment_entries_list = _get_payments_entries_helper(pos_opening_shift)
        for pe in payment_entries_list:
            invoice_name = pe.get("reference_name")
            if invoice_name and invoice_name not in payment_entries_map:
                payment_entries_map[invoice_name] = {
                    "name": pe.get("name"),
                    "mode_of_payment": pe.get("mode_of_payment") or "",
                    "paid_amount": flt(pe.get("paid_amount") or 0)
                }

        # Add payment_entry data to each invoice
        for invoice in invoices:
            invoice_name = invoice.get("name")
            payment_entry_data = payment_entries_map.get(invoice_name, {})
            invoice["payment_entry"] = payment_entry_data.get(
                "name", "") if payment_entry_data else ""
            invoice["payment_entry_mode_of_payment"] = payment_entry_data.get(
                "mode_of_payment", "") if payment_entry_data else ""
            invoice["payment_entry_paid_amount"] = payment_entry_data.get(
                "paid_amount", 0) if payment_entry_data else 0

        return invoices
    except Exception as e:
        frappe.log_error("[pos_closing_shift.py] method: get_pos_invoices", "POS Closing Shift")
        frappe.throw(_("Error fetching invoices"))


# ========================================================================
# SECTION 2.5: GET PAYMENTS ENTRIES
# ========================================================================
# GET - Get payment entries for opening shift (for "Payments Submitted" section)

@frappe.whitelist()
def get_payments_entries(pos_opening_shift):
    """
    GET - Get payment entries for opening shift (for "Payments Submitted" section)
    """
    try:
        return _get_payments_entries_helper(pos_opening_shift)
    except Exception as e:
        frappe.log_error("[pos_closing_shift.py] method: get_payments_entries", "POS Closing Shift")
        frappe.throw(_("Error fetching payments"))


# ========================================================================
# SECTION 2.6: GET PAYMENT TOTALS
# ========================================================================
# GET - Get both cash and non-cash totals in one call (optimized for performance)
# Returns: {cash_total: float, non_cash_total: float}

@frappe.whitelist()
def get_payment_totals(pos_profile=None, user=None):
    """
    GET - Get both cash and non-cash totals in one call (optimized for performance)
    Returns: {cash_total: float, non_cash_total: float}

    FRAPPE STANDARD: pos_profile can be dict or string (Frappe auto-parses JSON to dict)
    """
    try:
        # FRAPPE STANDARD: Handle string or dict parameter
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile

        # Use session user if not specified
        if not user:
            user = frappe.session.user

        # FRAPPE STANDARD: Re-fetch document from database if needed
        # Find current open shift for user
        open_shift = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "pos_profile": pos_profile_name,
                "docstatus": 1,
                "status": "Open"
            },
            fields=["name", "pos_profile"],
            order_by="period_start_date desc",
            limit=1
        )

        if not open_shift:
            return {"cash_total": 0.0, "non_cash_total": 0.0}

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

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(
            shift_name, pos_profile_name)

        # Get cash total from dict
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))

        # Sum all non-cash payments
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)

        result = {"cash_total": cash_total, "non_cash_total": non_cash_total}

        return result

    except Exception:
        # Graceful degradation - return zero values (no logging needed)
        return {"cash_total": 0.0, "non_cash_total": 0.0}


# ========================================================================
# SECTION 2.7: GET CURRENT CASH TOTAL
# ========================================================================
# GET - Get current cash total for shift (used in POS frontend Navbar)
# DEPRECATED: Use get_payment_totals instead for better performance

@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
    DEPRECATED: Use get_payment_totals instead for better performance
    """
    try:
        result = get_payment_totals(pos_profile, user)
        return {"total": result.get("cash_total", 0.0)}
    except Exception:
        # Graceful degradation - return zero (no logging needed)
        return {"total": 0.0}


# ========================================================================
# SECTION 2.8: GET CURRENT NON-CASH TOTAL
# ========================================================================
# GET - Get current non-cash total for shift (used in POS frontend Navbar)
# DEPRECATED: Use get_payment_totals instead for better performance

@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
    DEPRECATED: Use get_payment_totals instead for better performance
    """
    try:
        result = get_payment_totals(pos_profile, user)
        return {"total": result.get("non_cash_total", 0.0)}
    except Exception:
        # Graceful degradation - return zero (no logging needed)
        return {"total": 0.0}


# ========================================================================
# SECTION 2.9: MAKE CLOSING SHIFT FROM OPENING
# ========================================================================
# POST - Get closing shift data from opening shift (without creating draft)
# Returns: closing shift data as dict (not saved to database)

@frappe.whitelist()
def make_closing_shift_from_opening(opening_shift):
    """
    POST - Get closing shift data from opening shift (without creating draft)
    Returns: closing shift data as dict (not saved to database)
    """
    try:
        # FRAPPE STANDARD: Handle string and dict formats (Frappe auto-parses JSON to dict)
        if isinstance(opening_shift, str):
            # String = document name directly
            opening_shift_name = opening_shift
        elif isinstance(opening_shift, dict):
            # Dict = extract 'name' field (Frappe sends dict from frontend)
            opening_shift_name = opening_shift.get("name")
            if not opening_shift_name:
                frappe.throw(
                    _("Invalid opening shift data: missing 'name' field"))
        else:
            frappe.throw(
                _("Invalid opening shift data: must be string or dict"))

        if not opening_shift_name:
            frappe.throw(
                _("Invalid opening shift data: could not determine shift name"))

        # FRAPPE STANDARD: Re-fetch document from database to get all fields
        opening = frappe.get_doc("POS Opening Shift", opening_shift_name)

        # Ensure balance_details is loaded (reload if needed)
        if not hasattr(opening, 'balance_details') or not opening.balance_details:
            opening.reload()

        # Check if opening shift is valid
        if opening.docstatus != 1:
            frappe.throw(_("Opening shift must be submitted"))

        if opening.status != "Open":
            frappe.throw(_("Opening shift is already closed"))

        # Check if closing shift already exists (submitted only, not drafts)
        existing_closing = frappe.db.get_value(
            "POS Closing Shift",
            filters={
                "pos_opening_shift": opening_shift_name,
                "docstatus": 1  # Submitted only
            },
            fieldname="name"
        )

        if existing_closing:
            frappe.throw(
                _("Closing shift already exists for this opening shift"))

        # Create closing shift data structure (in memory only, not saved)
        closing_data = {
            "doctype": "POS Closing Shift",
            "pos_opening_shift": opening.name,
            "period_start_date": opening.period_start_date,
            "period_end_date": frappe.utils.now_datetime(),
            "pos_profile": opening.pos_profile,
            "user": opening.user,
            "company": opening.company,
            "grand_total": 0.0,
            "net_total": 0.0,
            "total_quantity": 0.0,
            "total_taxes": 0.0,
            "total_invoice_additional_discount": 0.0,
            "total_item_discount": 0.0,
            "total_invoice_paid": 0.0,
            "total_payment_entries_paid": 0.0,
            "payment_reconciliation": [],
            "pos_transactions": []
        }

        # Get payment totals using centralized helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(
            opening.name, opening.pos_profile)

        # Get opening amounts from opening shift balance_details
        opening_amounts = {}
        if hasattr(opening, 'balance_details') and opening.balance_details:
            for detail in opening.balance_details:
                # detail is a Document object (child table row), use attribute access directly
                mode = getattr(detail, 'mode_of_payment', None)
                amount = flt(getattr(detail, 'amount', 0) or 0)
                if mode:
                    opening_amounts[mode] = amount

        # Add payment reconciliation rows (payment_totals is a dict, not a list!)
        for mode_of_payment, expected_amount in payment_totals.items():
            opening_amount = opening_amounts.get(mode_of_payment, 0.0)
            expected = flt(expected_amount)
            closing_data["payment_reconciliation"].append({
                "mode_of_payment": mode_of_payment,
                "opening_amount": opening_amount,
                "expected_amount": expected,  # This already has change_amount subtracted
                # User needs to fill manually (0 means empty in UI)
                "closing_amount": 0.0,
                "difference": 0.0,  # Initially no difference
            })

        # Get POS invoices using helper
        invoices = _get_pos_invoices_helper(opening.name)

        # Get Payment Entries for all invoices (to link them to invoices)
        payment_entries_map = {}
        payment_entries_list = _get_payments_entries_helper(opening.name)
        for pe in payment_entries_list:
            invoice_name = pe.get("reference_name")
            if invoice_name:
                # Store first Payment Entry for each invoice (with all needed fields)
                if invoice_name not in payment_entries_map:
                    payment_entries_map[invoice_name] = {
                        "name": pe.get("name"),
                        "mode_of_payment": pe.get("mode_of_payment") or "",
                        "paid_amount": flt(pe.get("paid_amount") or 0)
                    }

        # Get default mode of payment from POS Profile (fallback if invoice has no payments)
        default_mode_of_payment = frappe.get_value(
            "POS Profile", opening.pos_profile, "posa_cash_mode_of_payment") or "Cash"

        # Process invoices: calculate totals and add to pos_transactions
        for invoice in invoices:
            # Single currency: POS Profile.currency only - no conversion needed
            # Use grand_total directly (same as base_grand_total for single currency)
            grand_total = flt(invoice.get("grand_total") or 0)
            net_total = flt(invoice.get("net_total") or 0)
            total_qty = flt(invoice.get("total_qty") or 0)
            discount_amount = flt(invoice.get("discount_amount") or 0)
            paid_amount = flt(invoice.get("paid_amount") or 0)
            change_amount = flt(invoice.get("change_amount") or 0)
            total = flt(invoice.get("total") or 0)

            # Calculate taxes for this invoice
            invoice_taxes = invoice.get("taxes", [])
            invoice_taxes_total = 0.0
            for tax in invoice_taxes:
                tax_amount = flt(tax.get("tax_amount") or 0)
                invoice_taxes_total += tax_amount

            # Get invoice name and validate
            invoice_name = invoice.get("name")
            if not invoice_name:
                continue

            # Get mode_of_payment from invoice payments (first payment method)
            mode_of_payment = default_mode_of_payment
            invoice_payments = invoice.get("payments", [])
            if invoice_payments:
                payment_mode = invoice_payments[0].get("mode_of_payment", "")
                if payment_mode and payment_mode.strip():
                    mode_of_payment = payment_mode.strip()

            # Get payment_entry data for this invoice (if exists)
            payment_entry_data = payment_entries_map.get(invoice_name, {})
            payment_entry_name = payment_entry_data.get(
                "name", "") if payment_entry_data else ""
            payment_entry_mode_of_payment = payment_entry_data.get(
                "mode_of_payment", "") if payment_entry_data else ""
            payment_entry_paid_amount = payment_entry_data.get(
                "paid_amount", 0) if payment_entry_data else 0

            # Calculate actual_paid = paid_amount - change_amount
            actual_paid = flt(paid_amount) - flt(change_amount)

            # Get additional fields
            posa_item_discount_total = flt(
                invoice.get("posa_item_discount_total") or 0)
            total_taxes_and_charges = flt(
                invoice.get("total_taxes_and_charges") or 0)
            taxes_value = total_taxes_and_charges if total_taxes_and_charges > 0 else invoice_taxes_total

            # Add to totals (calculated from pos_transactions)
            closing_data["grand_total"] += grand_total
            closing_data["net_total"] += net_total
            closing_data["total_quantity"] += total_qty
            closing_data["total_taxes"] += taxes_value
            closing_data["total_invoice_additional_discount"] += discount_amount
            closing_data["total_item_discount"] += posa_item_discount_total
            closing_data["total_invoice_paid"] += paid_amount
            closing_data["total_payment_entries_paid"] += payment_entry_paid_amount

            # Add invoice to pos_transactions (simple and clean - one row per invoice)
            closing_data["pos_transactions"].append({
                "sales_invoice": invoice_name,
                "posting_date": invoice.get("posting_date") or opening.posting_date or frappe.utils.today(),
                "customer": invoice.get("customer") or opening.customer or "",
                "mode_of_payment": mode_of_payment,
                "grand_total": str(grand_total),
                "total": str(total) if total is not None else "",
                "net_total": str(net_total) if net_total is not None else "",
                "taxes": str(taxes_value) if taxes_value else "0",
                "total_qty": str(total_qty) if total_qty is not None else "",
                "discount_amount": str(discount_amount) if discount_amount is not None else "",
                "posa_item_discount_total": str(posa_item_discount_total) if posa_item_discount_total is not None else "",
                "paid_amount": str(paid_amount) if paid_amount is not None else "",
                "change_amount": str(change_amount) if change_amount is not None else "",
                "actual_paid": str(actual_paid) if actual_paid is not None else "",
                "payment_entry": payment_entry_name,
                "payment_entry_mode_of_payment": payment_entry_mode_of_payment if payment_entry_mode_of_payment else "",
                # Currency field - keep as number
                "payment_entry_paid_amount": payment_entry_paid_amount
            })

        # Return data without saving to database (no draft created)
        return closing_data

    except Exception as e:
        frappe.log_error("[pos_closing_shift.py] method: make_closing_shift_from_opening", "POS Closing Shift")
        frappe.throw(_("Error creating closing shift"))


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

    except Exception:
        # Graceful degradation - return empty dict (no logging needed)
        return {}


# ========================================================================
# SECTION 4.2: GET CLOSING TIME MESSAGE
# ========================================================================
# Helper function to generate closing time error message
# Used by both _validate_shift_closing_window and check_closing_time_allowed
# Returns formatted Arabic message with time range

def _format_time_12h(time_obj):
    """Convert 24-hour time to 12-hour format with ص/م"""
    hour = time_obj.hour
    minute = time_obj.minute

    # Convert to 12-hour format
    if hour == 0:
        hour_12 = 12
        period = "ص"
    elif hour < 12:
        hour_12 = hour
        period = "ص"
    elif hour == 12:
        hour_12 = 12
        period = "م"
    else:
        hour_12 = hour - 12
        period = "م"

    return f"{hour_12}:{minute:02d}{period}"


def _get_closing_time_message(start_time, end_time):
    """Generate closing time error message in Arabic with 12-hour format"""
    start_str = _format_time_12h(start_time)
    end_str = _format_time_12h(end_time)
    return _("الإغلاق مسموح من {0} الي {1}").format(start_str, end_str)


# ========================================================================
# SECTION 4.3: PARSE TIME HELPER
# ========================================================================
# Helper function to parse time value to datetime.time object
# Used by _validate_shift_closing_window
# Related to: section_break_1 (period_end_date)

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
        elif isinstance(time_value, dtime):
            return time_value
        else:
            return None
    except Exception:
        # Graceful degradation - return None (no logging needed)
        return None


# ========================================================================
# SECTION 4.4: SUBMIT PRINTED INVOICES
# ========================================================================
# Helper function to submit printed invoices
# Related to: section_break_1 (pos_opening_shift)

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
            except Exception:
                # Silent fail - skip problematic invoice (no logging needed)
                pass

    except Exception:
        # Silent fail - non-critical operation (no logging needed)
        pass


# ========================================================================
# SECTION 4.5: GET POS INVOICES HELPER
# ========================================================================
# Helper function to get POS invoices with full document data
# Returns full documents matching Sales Register report data structure
# Related to: section_break_3 (pos_transactions)

def _get_pos_invoices_helper(pos_opening_shift):
    """
    Helper function to get Sales Invoice documents (is_pos=1) with all required fields.
    POS Awesome uses Sales Invoice doctype (not POS Invoice).
    Uses SQL queries to fetch only needed data instead of loading full documents (OPTIMIZED).
    Following Frappe framework logic: fetch from database directly.
    """
    try:
        # FRAPPE STANDARD: Fetch all required fields for Sales Invoice Reference
        # Single currency: POS Profile.currency only - no base_* fields needed
        # Frontend needs: name, posting_date, customer, grand_total, net_total, total_qty, change_amount, paid_amount, discount_amount, total, posa_item_discount_total
        invoices_data = frappe.db.sql("""
            SELECT
                si.name,
                si.posting_date,
                si.customer,
                si.grand_total,
                si.net_total,
                si.total_qty,
                si.change_amount,
                si.paid_amount,
                si.discount_amount,
                si.total,
                si.posa_item_discount_total,
                si.total_taxes_and_charges
            FROM `tabSales Invoice` si
            WHERE si.posa_pos_opening_shift = %s
            AND si.docstatus = 1
            ORDER BY si.posting_date, COALESCE(si.posting_time, '00:00:00'), si.name
        """, (pos_opening_shift,), as_dict=1)

        # Get payments for all invoices (only fields needed for frontend)
        invoice_names = [inv.name for inv in invoices_data]
        payments_data = []
        if invoice_names:
            # FRAPPE STANDARD: Use safe SQL with placeholders (prevents SQL injection)
            # Single currency: Frontend needs: parent, mode_of_payment, amount only
            placeholders = ','.join(['%s'] * len(invoice_names))
            payments_data = frappe.db.sql(f"""
                SELECT
                    parent,
                    mode_of_payment,
                    amount
                FROM `tabSales Invoice Payment`
                WHERE parent IN ({placeholders})
            """, tuple(invoice_names), as_dict=1)

        # Get taxes for all invoices (only fields needed for frontend)
        taxes_data = []
        if invoice_names:
            # FRAPPE STANDARD: Use safe SQL with placeholders (prevents SQL injection)
            # Single currency: Frontend needs: parent, account_head, rate, tax_amount only
            placeholders = ','.join(['%s'] * len(invoice_names))
            taxes_data = frappe.db.sql(f"""
                SELECT
                    parent,
                    account_head,
                    rate,
                    tax_amount
                FROM `tabSales Taxes and Charges`
                WHERE parent IN ({placeholders})
            """, tuple(invoice_names), as_dict=1)

        # Group payments and taxes by invoice
        payments_dict = {}
        for payment in payments_data:
            parent = payment.parent
            if parent not in payments_dict:
                payments_dict[parent] = []
            payments_dict[parent].append({
                "mode_of_payment": payment.mode_of_payment,
                "amount": flt(payment.amount or 0)
            })

        taxes_dict = {}
        for tax in taxes_data:
            parent = tax.parent
            if parent not in taxes_dict:
                taxes_dict[parent] = []
            taxes_dict[parent].append({
                "account_head": tax.account_head,
                "rate": flt(tax.rate or 0),
                "tax_amount": flt(tax.tax_amount or 0)
            })

        # Build invoice dicts with all required fields
        # Single currency: POS Profile.currency only - no base_* or conversion_rate needed
        invoices = []
        for invoice_row in invoices_data:
            invoice_name = invoice_row.name
            invoice_dict = {
                "name": invoice_name,
                # Required for Sales Invoice Reference
                "posting_date": invoice_row.posting_date,
                "customer": invoice_row.customer,  # Required for Sales Invoice Reference
                "grand_total": flt(invoice_row.grand_total or 0),
                "net_total": flt(invoice_row.net_total or 0),
                "total_qty": flt(invoice_row.total_qty or 0),
                "change_amount": flt(invoice_row.change_amount or 0),
                "paid_amount": flt(invoice_row.paid_amount or 0),
                "discount_amount": flt(invoice_row.discount_amount or 0),
                "total": flt(invoice_row.total or 0),
                "posa_item_discount_total": flt(invoice_row.posa_item_discount_total or 0),
                "total_taxes_and_charges": flt(invoice_row.total_taxes_and_charges or 0),
                "payments": payments_dict.get(invoice_name, []),
                "taxes": taxes_dict.get(invoice_name, [])
            }
            invoices.append(invoice_dict)

        return invoices

    except Exception:
        # Graceful degradation - return empty list (no logging needed)
        return []


# ========================================================================
# SECTION 4.6: GET PAYMENTS ENTRIES HELPER
# ========================================================================
# Helper function to get payment entries linked to invoices in this shift
# Payment Entries link to Sales Invoices via the Payment Entry Reference child table
# Related to: section_break_3 (pos_transactions)

def _get_payments_entries_helper(pos_opening_shift):
    """
    Helper: Get payment entries for POS Opening Shift
    Payment Entries link to Sales Invoices via Payment Entry Reference child table.
    Returns list of payment entries with base_paid_amount for company currency.
    """
    try:
        # Query Payment Entries that reference Sales Invoices from this shift
        # Single currency: POS Profile.currency only - paid_amount equals base_paid_amount
        # Frontend needs: name, mode_of_payment, paid_amount, posting_date, party, reference_name
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
    except Exception:
        # Graceful degradation - return empty list (no logging needed)
        return []


# ========================================================================
# SECTION 4.7: GET INVOICE TYPE
# ========================================================================
# Helper: Determine invoice type based on Frappe framework logic
# Returns: "مبيعات", "مرتجع فاتورة", "مرتجع سريع", or "غير معروف"

def _get_invoice_type(invoice, pos_profile_name, pos_opening_shift_name, user):
    """
    Helper: Determine invoice type based on Frappe framework logic
    Returns: "مبيعات", "مرتجع فاتورة", "مرتجع سريع", or "غير معروف"
    """
    try:
        # Check if invoice matches current shift, profile, and user
        matches_current_shift = (
            pos_opening_shift_name and
            invoice.get("posa_pos_opening_shift") == pos_opening_shift_name
        ) or (not pos_opening_shift_name)

        matches_current_profile = invoice.get(
            "pos_profile") == pos_profile_name
        matches_current_user = invoice.get("owner") == user

        # All invoices must match current profile and user
        if not matches_current_profile or not matches_current_user:
            return "غير معروف"

        # If shift filter is provided, invoice must match it
        if pos_opening_shift_name and not matches_current_shift:
            return "غير معروف"

        is_pos = invoice.get("is_pos", 0)
        is_return = invoice.get("is_return", 0)
        grand_total = flt(invoice.get("grand_total") or 0)
        return_against = invoice.get("return_against")

        # مبيعات: is_pos=1, is_return=0
        if is_pos == 1 and is_return == 0:
            return "مبيعات"

        # مرتجع: is_pos=1, is_return=1, grand_total < 0
        if is_pos == 1 and is_return == 1 and grand_total < 0:
            # مرتجع فاتورة: return_against is not empty or null
            if return_against and str(return_against).strip() != "":
                return "مرتجع فاتورة"
            # مرتجع سريع: return_against is empty or null
            return "مرتجع سريع"

        return "غير معروف"

    except Exception:
        # Graceful degradation - return unknown type (no logging needed)
        return "غير معروف"
