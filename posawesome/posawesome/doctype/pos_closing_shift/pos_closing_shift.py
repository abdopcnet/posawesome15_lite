# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt
from datetime import datetime, time as dtime, timedelta
from posawesome import posawesome_logger


class POSClosingShift(Document):
    def validate(self):
        try:
            posawesome_logger.info(
                f'[pos_closing_shift.py] Validating POS Closing Shift {self.name}')
            
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
                posawesome_logger.warning(
                    f'[pos_closing_shift.py] Duplicate closing shift detected for user {self.user}')
                frappe.throw(
                    _(
                        "POS Closing Shift {} against {} between selected period".format(
                            frappe.bold("already exists"), frappe.bold(self.user)
                        )
                    ),
                    title=_("Invalid Period"),
                )

            opening_shift_status = frappe.db.get_value("POS Opening Shift", self.pos_opening_shift, "status")
            if opening_shift_status != "Open":
                posawesome_logger.warning(
                    f'[pos_closing_shift.py] Opening shift {self.pos_opening_shift} status is {opening_shift_status}, expected Open')
                frappe.throw(
                    _("Selected POS Opening Shift should be open."),
                    title=_("Invalid Opening Entry"),
                )
            
            self.update_payment_reconciliation()
            posawesome_logger.info(
                f'[pos_closing_shift.py] Validation completed for POS Closing Shift {self.name}')
        except Exception as e:
            posawesome_logger.error(
                f'[pos_closing_shift.py] Error validating POS Closing Shift {self.name}: {str(e)}', exc_info=True)
            raise

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
        try:
            if not self.pos_profile or not self.period_end_date:
                return

            profile = frappe.get_doc("POS Profile", self.pos_profile)

            # Check if closing time control is enabled
            if not profile.get("posa_closing_time_control"):
                posawesome_logger.debug(
                    f'[pos_closing_shift.py] Closing time control disabled for POS Profile {self.pos_profile}')
                return  # Skip validation if time control is not enabled

            shift_opening_time = profile.get("posa_closing_time_start")
            shift_closing_time = profile.get("posa_closing_time_end")

            if not shift_opening_time or not shift_closing_time:
                posawesome_logger.debug(
                    f'[pos_closing_shift.py] Closing time not configured for POS Profile {self.pos_profile}')
                return  # No restriction if not configured

            # Parse times
            start_time = self._parse_time(shift_opening_time)
            end_time = self._parse_time(shift_closing_time)

            if not start_time or not end_time:
                posawesome_logger.warning(
                    f'[pos_closing_shift.py] Could not parse closing times for POS Profile {self.pos_profile}')
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
                posawesome_logger.warning(
                    f'[pos_closing_shift.py] Closing time {period_end_dt} not allowed. Allowed window: {start_str} - {end_str}')
                frappe.throw(
                    _("Closing shift is not allowed at this time. Closing is allowed only between {0} and {1}").format(
                        start_str, end_str),
                    title=_("Closing Time Not Allowed")
                )
        except Exception as e:
            posawesome_logger.error(
                f'[pos_closing_shift.py] Error validating shift closing window: {str(e)}', exc_info=True)
            raise

    def update_payment_reconciliation(self):
        try:
            posawesome_logger.debug(
                f'[pos_closing_shift.py] Updating payment reconciliation for {self.name}')
            # update the difference values in Payment Reconciliation child table
            # get default precision for site
            precision = frappe.get_cached_value(
                "System Settings", None, "currency_precision") or 3
            for d in self.payment_reconciliation:
                d.difference = +flt(d.closing_amount, precision) - \
                    flt(d.expected_amount, precision)
        except Exception as e:
            posawesome_logger.error(
                f'[pos_closing_shift.py] Error updating payment reconciliation: {str(e)}', exc_info=True)
            raise

    def on_submit(self):
        try:
            posawesome_logger.info(
                f'POS Closing Shift {self.name} submitted by {self.user}')
            opening_entry = frappe.get_doc(
                "POS Opening Shift", self.pos_opening_shift)
            opening_entry.pos_closing_shift = self.name
            opening_entry.set_status()
            self.delete_draft_invoices()
            opening_entry.save()
            posawesome_logger.info(
                f'POS Closing Shift {self.name} submitted successfully')
        except Exception as e:
            posawesome_logger.error(
                f'Error submitting POS Closing Shift {self.name}: {str(e)}', exc_info=True)
            raise

    def on_cancel(self):
        try:
            posawesome_logger.info(
                f'POS Closing Shift {self.name} cancelled by {frappe.session.user}')
            if frappe.db.exists("POS Opening Shift", self.pos_opening_shift):
                opening_entry = frappe.get_doc(
                    "POS Opening Shift", self.pos_opening_shift)
                if opening_entry.pos_closing_shift == self.name:
                    opening_entry.pos_closing_shift = ""
                    opening_entry.set_status()
                opening_entry.save()
            posawesome_logger.info(
                f'POS Closing Shift {self.name} cancelled successfully')
        except Exception as e:
            posawesome_logger.error(
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
        try:
            if not frappe.get_value("POS Profile", self.pos_profile, "posa_auto_delete_draft_invoices"):
                posawesome_logger.debug(
                    f'[pos_closing_shift.py] Auto-delete draft invoices disabled for POS Profile {self.pos_profile}')
                return

            posawesome_logger.info(
                f'[pos_closing_shift.py] Deleting draft invoices for POS Closing Shift {self.name}')

            # Find draft invoices for this shift
            draft_invoices = frappe.get_all(
                "Sales Invoice",
                filters={
                    "posa_pos_opening_shift": self.pos_opening_shift,
                    "docstatus": 0  # Draft only
                },
                fields=["name"]
            )

            posawesome_logger.info(
                f'[pos_closing_shift.py] Found {len(draft_invoices)} draft invoices to delete')

            # Delete each draft invoice
            deleted_count = 0
            for invoice in draft_invoices:
                try:
                    frappe.delete_doc("Sales Invoice", invoice.name,
                                      force=1, ignore_permissions=True)
                    deleted_count += 1
                    posawesome_logger.debug(
                        f'[pos_closing_shift.py] Deleted draft invoice {invoice.name}')
                except Exception as e:
                    posawesome_logger.error(
                        f'[pos_closing_shift.py] Error deleting draft invoice {invoice.name}: {str(e)}')
                    continue
            
            posawesome_logger.info(
                f'[pos_closing_shift.py] Successfully deleted {deleted_count} draft invoices')
        except Exception as e:
            posawesome_logger.error(
                f'[pos_closing_shift.py] Error in delete_draft_invoices: {str(e)}', exc_info=True)
            # Don't raise - allow closing shift to complete even if draft deletion fails


@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
    """
    try:
        posawesome_logger.info(
            f"[pos_closing_shift.py] get_current_cash_total: user={user}, pos_profile={pos_profile}")
        
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
            posawesome_logger.debug(
                f"[pos_closing_shift.py] get_current_cash_total: No open shift found")
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
        
        posawesome_logger.debug(
            f"[pos_closing_shift.py] get_current_cash_total: Cash mode = {cash_mode_of_payment}")

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Get cash total from dict (payment_totals is a dict, not a list!)
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))
        
        posawesome_logger.info(
            f"[pos_closing_shift.py] get_current_cash_total: Cash total = {cash_total}")

        return {"total": cash_total}

    except Exception as e:
        posawesome_logger.error(
            f"[pos_closing_shift.py] get_current_cash_total: {str(e)}", exc_info=True)
        return {"total": 0.0}


@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
    """
    try:
        posawesome_logger.info(
            f"[pos_closing_shift.py] get_current_non_cash_total: user={user}, pos_profile={pos_profile}")
        
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
            posawesome_logger.debug(
                f"[pos_closing_shift.py] get_current_non_cash_total: No open shift found")
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
        
        posawesome_logger.debug(
            f"[pos_closing_shift.py] get_current_non_cash_total: Cash mode = {cash_mode_of_payment}")

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Sum all non-cash payments (payment_totals is a dict, not a list!)
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)
                posawesome_logger.debug(
                    f"[pos_closing_shift.py] Non-cash payment {mode_of_payment}: {amount}")
        
        posawesome_logger.info(
            f"[pos_closing_shift.py] get_current_non_cash_total: Non-cash total = {non_cash_total}")

        return {"total": non_cash_total}

    except Exception as e:
        posawesome_logger.error(
            f"[pos_closing_shift.py] get_current_non_cash_total: {str(e)}", exc_info=True)
        return {"total": 0.0}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

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
    """
    try:
        posawesome_logger.info(
            f"[pos_closing_shift.py] _calculate_payment_totals: Calculating for shift {pos_opening_shift}, profile {pos_profile}")
        
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
        
        posawesome_logger.debug(
            f"[pos_closing_shift.py] _calculate_payment_totals: Cash mode of payment = {cash_mode_of_payment}")

        # Process Sales Invoice Payments (matches Sales Register logic)
        for d in invoices:
            invoice_name = d.get("name", "Unknown")
            invoice_payments = d.get("payments", [])
            
            if not invoice_payments:
                posawesome_logger.warning(
                    f"[pos_closing_shift.py] _calculate_payment_totals: Invoice {invoice_name} has no payments")
                continue
            
            # Use base_* fields for company currency (matches Sales Register)
            change_amount = flt(d.get("base_change_amount") or d.get("change_amount") or 0)
            
            for p in invoice_payments:
                # Use base_amount for company currency (matches Sales Register)
                amount = flt(p.get("base_amount") or p.get("amount") or 0)
                mode_of_payment = p.get("mode_of_payment")

                # ✅ طرح change_amount من المبلغ النقدي فقط (matches Sales Register)
                # change_amount هو المبلغ الذي يُرجع للعميل كباقي
                # يجب طرحه من المبلغ المتوقع في المصالحة النقدية
                if mode_of_payment == cash_mode_of_payment:
                    amount = amount - change_amount
                    posawesome_logger.debug(
                        f"[pos_closing_shift.py] Cash payment for {invoice_name}: "
                        f"base_amount={p.get('base_amount') or p.get('amount')}, "
                        f"change={change_amount}, final={amount}")

                # Add to payments dict
                if mode_of_payment in payments:
                    payments[mode_of_payment] += amount
                else:
                    payments[mode_of_payment] = amount
                
                posawesome_logger.debug(
                    f"[pos_closing_shift.py] Payment {mode_of_payment}: added {amount}, total={payments[mode_of_payment]}")

        # Process Payment Entries
        pos_payments = _get_payments_entries_helper(pos_opening_shift)
        for py in pos_payments:
            mode_of_payment = py.get("mode_of_payment")
            # Use base_paid_amount for company currency
            paid_amount = flt(py.get("base_paid_amount") or py.get("paid_amount") or 0)
            
            if mode_of_payment in payments:
                payments[mode_of_payment] += paid_amount
            else:
                payments[mode_of_payment] = paid_amount
            
            posawesome_logger.debug(
                f"[pos_closing_shift.py] Payment Entry {mode_of_payment}: added {paid_amount}, total={payments[mode_of_payment]}")

        posawesome_logger.info(
            f"[pos_closing_shift.py] _calculate_payment_totals: Final totals: {payments}")
        return payments

    except Exception as e:
        posawesome_logger.error(
            f"[pos_closing_shift.py] Error in _calculate_payment_totals: {str(e)}", exc_info=True)
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
    """
    Helper function to get POS invoices with full document data.
    Returns full documents matching Sales Register report data structure.
    """
    try:
        posawesome_logger.info(
            f"[pos_closing_shift.py] _get_pos_invoices_helper: Fetching invoices for shift {pos_opening_shift}")
        
        # Get invoice names first (same query as Sales Register)
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

        posawesome_logger.info(
            f"[pos_closing_shift.py] _get_pos_invoices_helper: Found {len(data)} invoice names")
        
        # Return full documents with all child tables (payments, taxes, etc.)
        # This matches exactly what Sales Register report uses
        invoices = []
        grand_total_sum = 0.0
        net_total_sum = 0.0
        
        for d in data:
            try:
                doc = frappe.get_doc("Sales Invoice", d.name)
                invoice_dict = doc.as_dict()
                
                # Log invoice totals for debugging
                base_grand = flt(invoice_dict.get("base_grand_total") or invoice_dict.get("grand_total") or 0)
                base_net = flt(invoice_dict.get("base_net_total") or invoice_dict.get("net_total") or 0)
                grand_total_sum += base_grand
                net_total_sum += base_net
                
                posawesome_logger.debug(
                    f"[pos_closing_shift.py] Invoice {d.name}: base_grand_total={base_grand}, base_net_total={base_net}, "
                    f"payments_count={len(invoice_dict.get('payments', []))}, taxes_count={len(invoice_dict.get('taxes', []))}")
                
                invoices.append(invoice_dict)
            except Exception as e:
                posawesome_logger.error(
                    f"[pos_closing_shift.py] _get_pos_invoices_helper: Error loading invoice {d.name}: {str(e)}", exc_info=True)
                continue
        
        posawesome_logger.info(
            f"[pos_closing_shift.py] _get_pos_invoices_helper: Processed {len(invoices)} invoices, "
            f"total base_grand_total={grand_total_sum}, total base_net_total={net_total_sum}")
        
        return invoices
    except Exception as e:
        posawesome_logger.error(
            f"[pos_closing_shift.py] _get_pos_invoices_helper: {str(e)}", exc_info=True)
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
        posawesome_logger.error(
            f"Error in _get_payments_entries_helper: {str(e)}")
        return []
