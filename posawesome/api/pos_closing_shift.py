# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt
from datetime import datetime, time as dtime, timedelta


@frappe.whitelist()
def submit_closing_shift(closing_shift):
    """
    POST - Submit closing shift with updated payment_reconciliation data
    Updates payment_reconciliation child table with closing_amount values from frontend
    """
    try:
        import json
        
        frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Received closing shift data")
        
        # FRAPPE STANDARD: Parse JSON if string
        if isinstance(closing_shift, str):
            closing_shift = json.loads(closing_shift)
        
        # Get closing shift document
        if closing_shift.get("name"):
            doc = frappe.get_doc("POS Closing Shift", closing_shift.get("name"))
            frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Found existing closing shift {doc.name}")
            
            # ✅ CRITICAL: Update payment_reconciliation with data from frontend
            if closing_shift.get("payment_reconciliation"):
                payment_reconciliation = closing_shift.get("payment_reconciliation")
                frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Updating {len(payment_reconciliation)} payment reconciliation rows")
                
                # Clear existing rows
                doc.set("payment_reconciliation", [])
                
                # Add updated rows from frontend
                for payment in payment_reconciliation:
                    doc.append("payment_reconciliation", {
                        "mode_of_payment": payment.get("mode_of_payment"),
                        "opening_amount": flt(payment.get("opening_amount", 0)),
                        "expected_amount": flt(payment.get("expected_amount", 0)),
                        "closing_amount": flt(payment.get("closing_amount", 0)),  # ✅ This is the user input!
                        "difference": flt(payment.get("difference", 0)),
                    })
            
            # Save the updated document before submitting
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Saved updated closing shift {doc.name}")
        else:
            # New document - create from dict
            doc = frappe.get_doc(closing_shift)
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Created new closing shift {doc.name}")

        # Submit the document (calls on_submit() which calls delete_draft_invoices())
        doc.submit()
        frappe.db.commit()
        
        frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: Successfully submitted closing shift {doc.name}")
        
        return doc.as_dict()
        
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] submit_closing_shift: {str(e)}")
        frappe.throw(_("Failed to submit closing shift: {0}").format(str(e)))


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
        frappe.log_error(f"[[pos_closing_shift.py]] check_closing_time_allowed: {str(e)}")
        return {"allowed": True, "message": "Error checking time, allowing by default"}


@frappe.whitelist()
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Get cashiers for filters (used in Link field queries)
    Frontend needs: user field only
    """
    try:
        # FRAPPE STANDARD: Simple query - only user field needed for frontend
        return frappe.db.sql("""SELECT DISTINCT user FROM `tabPOS Opening Shift` WHERE docstatus = 1""")
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_cashiers: {str(e)}")
        return []


@frappe.whitelist()
def get_pos_invoices(pos_opening_shift):
    """
    GET - Get POS invoices for opening shift
    """
    try:
        return _get_pos_invoices_helper(pos_opening_shift)
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_pos_invoices: {str(e)}")
        frappe.throw(_("Error fetching POS invoices"))


@frappe.whitelist()
def get_payments_entries(pos_opening_shift):
    """
    GET - Get payment entries for opening shift (for "Payments Submitted" section)
    """
    try:
        return _get_payments_entries_helper(pos_opening_shift)
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_payments_entries: {str(e)}")
        frappe.throw(_("Error fetching payment entries"))


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
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Get cash total from dict
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))
        
        # Sum all non-cash payments
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)

        result = {"cash_total": cash_total, "non_cash_total": non_cash_total}
        
        return result

    except Exception as e:
        # FRAPPE STANDARD: Short error message (max 140 chars for Error Log title field)
        error_msg = str(e)[:100] if len(str(e)) > 100 else str(e)
        frappe.log_error(f"get_payment_totals: {error_msg}", "POS Closing Shift")
        return {"cash_total": 0.0, "non_cash_total": 0.0}


@frappe.whitelist()
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
    DEPRECATED: Use get_payment_totals instead for better performance
    """
    try:
        result = get_payment_totals(pos_profile, user)
        return {"total": result.get("cash_total", 0.0)}
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: {str(e)}")
        return {"total": 0.0}


@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
    DEPRECATED: Use get_payment_totals instead for better performance
    """
    try:
        result = get_payment_totals(pos_profile, user)
        return {"total": result.get("non_cash_total", 0.0)}
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: {str(e)}")
        return {"total": 0.0}


@frappe.whitelist()
def make_closing_shift_from_opening(opening_shift):
    """
    POST - Create closing shift from opening shift
    Returns: closing shift document as dict
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
                frappe.throw(_("Invalid opening shift data: missing 'name' field"))
        else:
            frappe.throw(_("Invalid opening shift data: must be string or dict"))

        if not opening_shift_name:
            frappe.throw(_("Invalid opening shift data: could not determine shift name"))

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
            # Update existing closing shift with recalculated payment totals, taxes, and totals
            closing = frappe.get_doc("POS Closing Shift", existing_closing)

            # Recalculate payment totals using unified helper (ensures consistency)
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
            
            # Update payment_reconciliation with recalculated expected_amount
            # Clear existing rows and add new ones with correct calculations
            closing.set("payment_reconciliation", [])
            for mode_of_payment, expected_amount in payment_totals.items():
                opening_amount = opening_amounts.get(mode_of_payment, 0.0)
                expected = flt(expected_amount)
                closing.append("payment_reconciliation", {
                    "mode_of_payment": mode_of_payment,
                    "opening_amount": opening_amount,
                    "expected_amount": expected,  # Recalculated with correct logic
                    "closing_amount": 0.0,  # User needs to fill manually (0 means empty in UI)
                    "difference": 0.0,  # Initially no difference
                })
            
            # Recalculate totals and taxes from invoices
            pos_transactions = _get_pos_invoices_helper(opening.name)
            
            # Reset totals
            closing.grand_total = 0.0
            closing.net_total = 0.0
            closing.total_quantity = 0.0
            
            # Process invoices: calculate totals, taxes, and update pos_transactions
            taxes_dict = {}  # Key: (account_head, rate), Value: amount
            
            # Clear existing pos_transactions and taxes
            closing.set("pos_transactions", [])
            closing.set("taxes", [])
            
            for invoice in pos_transactions:
                # Single currency: POS Profile.currency only - no conversion needed
                # Use grand_total directly (same as base_grand_total for single currency)
                grand_total = flt(invoice.get("grand_total") or 0)
                net_total = flt(invoice.get("net_total") or 0)
                total_qty = flt(invoice.get("total_qty") or 0)
                
                # Add to totals
                closing.grand_total += grand_total
                closing.net_total += net_total
                closing.total_quantity += total_qty
                
                # Process taxes
                invoice_taxes = invoice.get("taxes", [])
                for tax in invoice_taxes:
                    account_head = tax.get("account_head")
                    rate = flt(tax.get("rate") or 0)
                    # Single currency: tax_amount equals base_tax_amount
                    tax_amount = flt(tax.get("tax_amount") or 0)
                    
                    tax_key = (account_head, rate)
                    if tax_key in taxes_dict:
                        taxes_dict[tax_key] += tax_amount
                    else:
                        taxes_dict[tax_key] = tax_amount
                
                # FRAPPE STANDARD: Ensure all required fields are present before appending
                # Sales Invoice Reference requires: sales_invoice (reqd), posting_date (reqd), customer (reqd), grand_total (reqd)
                invoice_name = invoice.get("name")
                posting_date = invoice.get("posting_date")
                customer = invoice.get("customer")
                
                # Validate required fields (following Frappe framework validation logic)
                if not invoice_name:
                    continue  # Skip if no invoice name
                if not posting_date:
                    # Use opening shift posting_date as fallback (following Frappe set_missing_values pattern)
                    posting_date = opening.posting_date or frappe.utils.today()
                if not customer:
                    # Use default customer or skip (following Frappe validation pattern)
                    customer = opening.customer or ""
                
                # Add to pos_transactions (all required fields now present)
                closing.append("pos_transactions", {
                    "sales_invoice": invoice_name,
                    "posting_date": posting_date,
                    "grand_total": grand_total,
                    "customer": customer
                })
            
            # Add taxes to closing shift
            for (account_head, rate), amount in taxes_dict.items():
                closing.append("taxes", {
                    "account_head": account_head,
                    "rate": rate,
                    "amount": amount
                })
            
            # Save the updated closing shift
            closing.save(ignore_permissions=True)
            frappe.db.commit()
            
            return closing.as_dict()

        # Create new closing shift
        closing = frappe.new_doc("POS Closing Shift")
        closing.pos_opening_shift = opening.name
        closing.period_start_date = opening.period_start_date
        closing.period_end_date = frappe.utils.now_datetime()
        closing.pos_profile = opening.pos_profile
        closing.user = opening.user
        closing.company = opening.company
        
        # Initialize totals
        closing.grand_total = 0.0
        closing.net_total = 0.0
        closing.total_quantity = 0.0

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
            closing.append("payment_reconciliation", {
                "mode_of_payment": mode_of_payment,
                "opening_amount": opening_amount,
                "expected_amount": expected,  # This already has change_amount subtracted
                "closing_amount": 0.0,  # User needs to fill manually (0 means empty in UI)
                "difference": 0.0,  # Initially no difference
            })

        # Get POS invoices using helper
        pos_transactions = _get_pos_invoices_helper(opening.name)
        
        # Process invoices: calculate totals, taxes, and add to pos_transactions
        taxes_dict = {}  # Key: (account_head, rate), Value: amount
        
        for invoice in pos_transactions:
            # Single currency: POS Profile.currency only - no conversion needed
            # Use grand_total directly (same as base_grand_total for single currency)
            grand_total = flt(invoice.get("grand_total") or 0)
            net_total = flt(invoice.get("net_total") or 0)
            total_qty = flt(invoice.get("total_qty") or 0)
            
            # Add to totals
            closing.grand_total += grand_total
            closing.net_total += net_total
            closing.total_quantity += total_qty
            
            # Process taxes
            invoice_taxes = invoice.get("taxes", [])
            for tax in invoice_taxes:
                account_head = tax.get("account_head")
                rate = flt(tax.get("rate") or 0)
                # Single currency: tax_amount equals base_tax_amount
                tax_amount = flt(tax.get("tax_amount") or 0)
                
                tax_key = (account_head, rate)
                if tax_key in taxes_dict:
                    taxes_dict[tax_key] += tax_amount
                else:
                    taxes_dict[tax_key] = tax_amount
            
            # FRAPPE STANDARD: Ensure all required fields are present before appending
            # Sales Invoice Reference requires: sales_invoice (reqd), posting_date (reqd), customer (reqd), grand_total (reqd)
            invoice_name = invoice.get("name")
            posting_date = invoice.get("posting_date")
            customer = invoice.get("customer")
            
            # Validate required fields (following Frappe framework validation logic)
            if not invoice_name:
                continue  # Skip if no invoice name
            if not posting_date:
                # Use opening shift posting_date as fallback (following Frappe set_missing_values pattern)
                posting_date = opening.posting_date or frappe.utils.today()
            if not customer:
                # Use default customer or skip (following Frappe validation pattern)
                customer = opening.customer or ""
            
                # Add to pos_transactions (all required fields now present)
                closing.append("pos_transactions", {
                    "sales_invoice": invoice_name,
                    "posting_date": posting_date,
                    "grand_total": grand_total,
                    "customer": customer
                })
        
        # Add taxes to closing shift
        for (account_head, rate), amount in taxes_dict.items():
            closing.append("taxes", {
                "account_head": account_head,
                "rate": rate,
                "amount": amount
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

        return closing.as_dict()

    except Exception as e:
        # FRAPPE STANDARD: Short error message (max 140 chars for Error Log title field)
        error_msg = str(e)[:100] if len(str(e)) > 100 else str(e)
        frappe.log_error(f"make_closing_shift_from_opening: {error_msg}", "POS Closing Shift")
        frappe.throw(_("Error creating closing shift"))


# =============================================================================
# HELPER FUNCTIONS (not @frappe.whitelist())
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
        invoices = _get_pos_invoices_helper(pos_opening_shift)
        payments = {}

        # Get cash mode of payment
        # FRAPPE STANDARD: Extract name from dict if needed
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile
        
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile_name,
            "posa_cash_mode_of_payment",
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Process Sales Invoice Payments (matches Sales Register logic)
        for d in invoices:
            invoice_payments = d.get("payments", [])
            
            if not invoice_payments:
                continue
            
            # Single currency: change_amount equals base_change_amount
            change_amount = flt(d.get("change_amount") or 0)
            
            for p in invoice_payments:
                # Single currency: amount equals base_amount
                amount = flt(p.get("amount") or 0)
                mode_of_payment = p.get("mode_of_payment")

                # ✅ طرح change_amount من المبلغ النقدي فقط (matches Sales Register)
                # change_amount هو المبلغ الذي يُرجع للعميل كباقي
                # يجب طرحه من المبلغ المتوقع في المصالحة النقدية
                if mode_of_payment == cash_mode_of_payment:
                    amount = amount - change_amount

                # Add to payments dict
                if mode_of_payment in payments:
                    payments[mode_of_payment] += amount
                else:
                    payments[mode_of_payment] = amount

        # Process Payment Entries
        pos_payments = _get_payments_entries_helper(pos_opening_shift)
        for py in pos_payments:
            mode_of_payment = py.get("mode_of_payment")
            # Single currency: paid_amount equals base_paid_amount
            paid_amount = flt(py.get("paid_amount") or 0)
            
            if mode_of_payment in payments:
                payments[mode_of_payment] += paid_amount
            else:
                payments[mode_of_payment] = paid_amount

        return payments

    except Exception as e:
        # FRAPPE STANDARD: Short error message (max 140 chars for Error Log title field)
        error_msg = str(e)[:100] if len(str(e)) > 100 else str(e)
        frappe.log_error(f"_calculate_payment_totals: {error_msg}", "POS Closing Shift")
        return {}


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
        frappe.log_error(f"[[pos_closing_shift.py]] _parse_time_helper: {str(e)}")
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
                frappe.log_error(f"[[pos_closing_shift.py]] Error submitting invoice {invoice.name}: {str(e)}")
                pass

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] _submit_printed_invoices: {str(e)}")


def _get_pos_invoices_helper(pos_opening_shift):
    """
    Helper function to get Sales Invoice documents (is_pos=1) with all required fields.
    POS Awesome uses Sales Invoice doctype (not POS Invoice).
    Uses SQL queries to fetch only needed data instead of loading full documents (OPTIMIZED).
    Following Frappe framework logic: fetch from database directly.
    """
    try:
        # FRAPPE STANDARD: Fetch only required fields for frontend (optimized)
        # Single currency: POS Profile.currency only - no base_* fields needed
        # Frontend needs: name, posting_date, customer, grand_total, net_total, total_qty, change_amount
        invoices_data = frappe.db.sql("""
            SELECT 
                si.name,
                si.posting_date,
                si.customer,
                si.grand_total,
                si.net_total,
                si.total_qty,
                si.change_amount
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
                "posting_date": invoice_row.posting_date,  # Required for Sales Invoice Reference
                "customer": invoice_row.customer,  # Required for Sales Invoice Reference
                "grand_total": flt(invoice_row.grand_total or 0),
                "net_total": flt(invoice_row.net_total or 0),
                "total_qty": flt(invoice_row.total_qty or 0),
                "change_amount": flt(invoice_row.change_amount or 0),
                "payments": payments_dict.get(invoice_name, []),
                "taxes": taxes_dict.get(invoice_name, [])
            }
            invoices.append(invoice_dict)
        
        return invoices
        
    except Exception as e:
        frappe.log_error(f"_get_pos_invoices_helper: {str(e)[:100]}", "POS Closing Shift")
        return []


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
        
        matches_current_profile = invoice.get("pos_profile") == pos_profile_name
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
        
    except Exception as e:
        frappe.log_error(f"_get_invoice_type: {str(e)[:100]}", "POS Closing Shift")
        return "غير معروف"


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
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] Error in _get_payments_entries_helper: {str(e)}")
        return []
