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
    """
    try:
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
def get_current_cash_total(pos_profile=None, user=None):
    """
    GET - Get current cash total for shift (used in POS frontend Navbar)
    """
    try:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: user={user}, pos_profile={pos_profile}")
        
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
            frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: No open shift found")
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
        
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: Cash mode = {cash_mode_of_payment}")

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Get cash total from dict (payment_totals is a dict, not a list!)
        cash_total = flt(payment_totals.get(cash_mode_of_payment, 0.0))
        
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: Cash total = {cash_total}")

        return {"total": cash_total}

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_cash_total: {str(e)}")
        return {"total": 0.0}


@frappe.whitelist()
def get_current_non_cash_total(pos_profile=None, user=None):
    """
    GET - Get current non-cash total for shift (used in POS frontend Navbar)
    """
    try:
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: user={user}, pos_profile={pos_profile}")
        
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
            frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: No open shift found")
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
        
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: Cash mode = {cash_mode_of_payment}")

        # Calculate payment totals using helper (returns dict: {mode_of_payment: amount})
        payment_totals = _calculate_payment_totals(shift_name, pos_profile_name)

        # Sum all non-cash payments (payment_totals is a dict, not a list!)
        non_cash_total = 0.0
        for mode_of_payment, amount in payment_totals.items():
            if mode_of_payment != cash_mode_of_payment:
                non_cash_total += flt(amount)
        
        frappe.log_error(f"[[pos_closing_shift.py]] get_current_non_cash_total: Non-cash total = {non_cash_total}")

        return {"total": non_cash_total}

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
        frappe.log_error(f"[[pos_closing_shift.py]] Creating closing shift from opening: {opening_shift}")

        # Handle string and dict formats only (no JSON parsing)
        if isinstance(opening_shift, str):
            # String = document name directly
            opening_shift_name = opening_shift
            frappe.log_error(f"[[pos_closing_shift.py]] Using string as document name: {opening_shift_name}")
        elif isinstance(opening_shift, dict):
            # Dict = extract 'name' field
            opening_shift_name = opening_shift.get("name")
            if not opening_shift_name:
                frappe.log_error(f"[[pos_closing_shift.py]] make_closing_shift_from_opening: opening_shift dict has no 'name' field")
                frappe.throw(_("Invalid opening shift data: missing 'name' field"))
            frappe.log_error(f"[[pos_closing_shift.py]] Using name from dict: {opening_shift_name}")
        else:
            frappe.log_error(f"[[pos_closing_shift.py]] make_closing_shift_from_opening: opening_shift is neither string nor dict, type: {type(opening_shift)}")
            frappe.throw(_("Invalid opening shift data: must be string or dict"))

        if not opening_shift_name:
            frappe.log_error(f"[[pos_closing_shift.py]] make_closing_shift_from_opening: Could not extract opening_shift_name")
            frappe.throw(_("Invalid opening shift data: could not determine shift name"))

        frappe.log_error(f"[[pos_closing_shift.py]] Using opening shift name: {opening_shift_name}")

        # Get opening shift document
        opening = frappe.get_doc("POS Opening Shift", opening_shift_name)
        
        # Ensure balance_details is loaded (reload if needed)
        if not hasattr(opening, 'balance_details') or not opening.balance_details:
            frappe.log_error(f"[[pos_closing_shift.py]] balance_details not loaded, reloading")
            opening.reload()
        
        if opening.balance_details:
            frappe.log_error(f"[[pos_closing_shift.py]] balance_details: {len(opening.balance_details)} rows")

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
            frappe.log_error(f"[[pos_closing_shift.py]] Updating existing closing shift: {existing_closing}")
            closing = frappe.get_doc("POS Closing Shift", existing_closing)

            # Recalculate payment totals using unified helper (ensures consistency)
            payment_totals = _calculate_payment_totals(
                opening.name, opening.pos_profile)
        
            frappe.log_error(f"[[pos_closing_shift.py]] Recalculated payment totals: {len(payment_totals)} modes")
            
            # Get opening amounts from opening shift balance_details
            opening_amounts = {}
            if hasattr(opening, 'balance_details') and opening.balance_details:
                for detail in opening.balance_details:
                    # detail is a Document object (child table row), use attribute access directly
                    mode = getattr(detail, 'mode_of_payment', None)
                    amount = flt(getattr(detail, 'amount', 0) or 0)
                    if mode:
                        opening_amounts[mode] = amount
                        frappe.log_error(f"[[pos_closing_shift.py]] Opening amount for {mode}: {amount} (from balance_details)")
                    else:
                        frappe.log_error(f"[[pos_closing_shift.py]] balance_details row missing mode_of_payment")
            else:
                frappe.log_error(f"[[pos_closing_shift.py]] Opening shift {opening.name} has no balance_details")
            
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
                frappe.log_error(f"[[pos_closing_shift.py]] Updated payment reconciliation: {mode_of_payment}, opening={opening_amount}, expected={expected_amount}")
            
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
                # Get conversion rate for this invoice
                conversion_rate = invoice.get("conversion_rate") or invoice.get("exchange_rate") or invoice.get("target_exchange_rate") or 1.0
                
                # Use base_* fields for company currency (matches Sales Register)
                base_grand_total = flt(invoice.get("base_grand_total") or invoice.get("grand_total") or 0)
                base_net_total = flt(invoice.get("base_net_total") or invoice.get("net_total") or 0)
                total_qty = flt(invoice.get("total_qty") or 0)
                
                # Add to totals
                closing.grand_total += base_grand_total
                closing.net_total += base_net_total
                closing.total_quantity += total_qty
                
                frappe.log_error(f"[[pos_closing_shift.py]] Invoice {invoice.get('name')}: grand_total={base_grand_total}")
                
                # Process taxes
                invoice_taxes = invoice.get("taxes", [])
                for tax in invoice_taxes:
                    account_head = tax.get("account_head")
                    rate = flt(tax.get("rate") or 0)
                    # Use base_tax_amount for company currency
                    base_tax_amount = flt(tax.get("base_tax_amount") or tax.get("tax_amount") or 0)
                    
                    tax_key = (account_head, rate)
                    if tax_key in taxes_dict:
                        taxes_dict[tax_key] += base_tax_amount
                    else:
                        taxes_dict[tax_key] = base_tax_amount
                
                # Add to pos_transactions
                closing.append("pos_transactions", {
                    "sales_invoice": invoice.get("name"),
                    "posting_date": invoice.get("posting_date"),
                    "grand_total": base_grand_total,  # Use base value
                    "customer": invoice.get("customer")
                })
            
            # Add taxes to closing shift
            for (account_head, rate), amount in taxes_dict.items():
                closing.append("taxes", {
                    "account_head": account_head,
                    "rate": rate,
                    "amount": amount
                })
            
            frappe.log_error(f"[[pos_closing_shift.py]] Updated closing shift: grand_total={closing.grand_total}")
            
            # Save the updated closing shift
            closing.save(ignore_permissions=True)
            frappe.db.commit()
            
            frappe.log_error(f"[[pos_closing_shift.py]] Updated existing closing shift with recalculated amounts")
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
        
        frappe.log_error(f"[[pos_closing_shift.py]] Payment totals: {len(payment_totals)} modes")

        # Get opening amounts from opening shift balance_details
        opening_amounts = {}
        if hasattr(opening, 'balance_details') and opening.balance_details:
            for detail in opening.balance_details:
                # detail is a Document object (child table row), use attribute access directly
                mode = getattr(detail, 'mode_of_payment', None)
                amount = flt(getattr(detail, 'amount', 0) or 0)
                if mode:
                    opening_amounts[mode] = amount
                    frappe.log_error(f"[[pos_closing_shift.py]] Opening amount for {mode}: {amount} (from balance_details)")
                else:
                    frappe.log_error(f"[[pos_closing_shift.py]] balance_details row missing mode_of_payment")
        else:
            frappe.log_error(f"[[pos_closing_shift.py]] Opening shift {opening.name} has no balance_details")

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
            frappe.log_error(f"[[pos_closing_shift.py]] Added payment reconciliation: {mode_of_payment}, opening={opening_amount}, expected={expected_amount}")

        # Get POS invoices using helper
        pos_transactions = _get_pos_invoices_helper(opening.name)
        
        # Process invoices: calculate totals, taxes, and add to pos_transactions
        taxes_dict = {}  # Key: (account_head, rate), Value: amount
        
        for invoice in pos_transactions:
            # Get conversion rate for this invoice
            conversion_rate = invoice.get("conversion_rate") or invoice.get("exchange_rate") or invoice.get("target_exchange_rate") or 1.0
            
            # Use base_* fields for company currency (matches Sales Register)
            base_grand_total = flt(invoice.get("base_grand_total") or invoice.get("grand_total") or 0)
            base_net_total = flt(invoice.get("base_net_total") or invoice.get("net_total") or 0)
            total_qty = flt(invoice.get("total_qty") or 0)
            
            # Add to totals
            closing.grand_total += base_grand_total
            closing.net_total += base_net_total
            closing.total_quantity += total_qty
            
            frappe.log_error(f"[[pos_closing_shift.py]] Invoice {invoice.get('name')}: grand_total={base_grand_total}")
            
            # Process taxes
            invoice_taxes = invoice.get("taxes", [])
            for tax in invoice_taxes:
                account_head = tax.get("account_head")
                rate = flt(tax.get("rate") or 0)
                # Use base_tax_amount for company currency
                base_tax_amount = flt(tax.get("base_tax_amount") or tax.get("tax_amount") or 0)
                
                tax_key = (account_head, rate)
                if tax_key in taxes_dict:
                    taxes_dict[tax_key] += base_tax_amount
                else:
                    taxes_dict[tax_key] = base_tax_amount
                
                frappe.log_error(f"[[pos_closing_shift.py]] Tax {account_head} @ {rate}%: base_tax_amount={base_tax_amount}")
            
            # Add to pos_transactions
            closing.append("pos_transactions", {
                "sales_invoice": invoice.get("name"),  # ← Field name is 'sales_invoice' not 'pos_invoice'
                "posting_date": invoice.get("posting_date"),
                "grand_total": base_grand_total,  # Use base value
                "customer": invoice.get("customer")
            })
        
        # Add taxes to closing shift
        for (account_head, rate), amount in taxes_dict.items():
            closing.append("taxes", {
                "account_head": account_head,
                "rate": rate,
                "amount": amount
            })
            frappe.log_error(f"[[pos_closing_shift.py]] Added tax: {account_head} @ {rate}% = {amount}")
        
        frappe.log_error(f"[[pos_closing_shift.py]] make_closing_shift_from_opening: grand_total={closing.grand_total}")

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

        frappe.log_error(f"[[pos_closing_shift.py]] Created closing shift: {closing.name}")

        return closing.as_dict()

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] make_closing_shift_from_opening: {str(e)}")
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
        frappe.log_error(f"[[pos_closing_shift.py]] _calculate_payment_totals: Calculating for shift {pos_opening_shift}, profile {pos_profile}")
        
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
        
        frappe.log_error(f"[[pos_closing_shift.py]] _calculate_payment_totals: Cash mode of payment = {cash_mode_of_payment}")

        # Process Sales Invoice Payments (matches Sales Register logic)
        for d in invoices:
            invoice_name = d.get("name", "Unknown")
            invoice_payments = d.get("payments", [])
            
            if not invoice_payments:
                frappe.log_error(f"[[pos_closing_shift.py]] _calculate_payment_totals: Invoice {invoice_name} has no payments")
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
                    frappe.log_error(f"[[pos_closing_shift.py]] Cash payment for {invoice_name}: base_amount={p.get('base_amount') or p.get('amount')}, change={change_amount}, final={amount}")

                # Add to payments dict
                if mode_of_payment in payments:
                    payments[mode_of_payment] += amount
                else:
                    payments[mode_of_payment] = amount
                
                frappe.log_error(f"[[pos_closing_shift.py]] Payment {mode_of_payment}: added {amount}, total={payments[mode_of_payment]}")

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
            
            frappe.log_error(f"[[pos_closing_shift.py]] Payment Entry {mode_of_payment}: added {paid_amount}, total={payments[mode_of_payment]}")

        frappe.log_error(f"[[pos_closing_shift.py]] _calculate_payment_totals: {len(payments)} modes")
        return payments

    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] Error in _calculate_payment_totals: {str(e)}")
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
    Helper function to get POS invoices with full document data including payments and taxes.
    Returns full documents matching Sales Register report data structure.
    """
    try:
        frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: Fetching invoices for shift {pos_opening_shift}")
        
        # Get invoice names first (same query as Sales Register)
        invoice_names = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": pos_opening_shift,
                "docstatus": 1
            },
            fields=["name"],
            order_by="posting_date, posting_time"
        )
        
        frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: Found {len(invoice_names)} invoice names")
        
        # Return full documents with all child tables (payments, taxes, etc.)
        # This matches exactly what Sales Register report uses
        invoices = []
        grand_total_sum = 0.0
        net_total_sum = 0.0
        
        for inv in invoice_names:
            try:
                doc = frappe.get_doc("Sales Invoice", inv.name)
                invoice_dict = doc.as_dict()
                
                # Log invoice totals for debugging
                base_grand = flt(invoice_dict.get("base_grand_total") or invoice_dict.get("grand_total") or 0)
                base_net = flt(invoice_dict.get("base_net_total") or invoice_dict.get("net_total") or 0)
                grand_total_sum += base_grand
                net_total_sum += base_net
                
                frappe.log_error(f"[[pos_closing_shift.py]] Invoice {inv.name}: grand_total={base_grand}")
                
                invoices.append(invoice_dict)
            except Exception as e:
                frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: Error loading invoice {inv.name}: {str(e)}")
                continue
        
        frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: {len(invoices)} invoices, total={grand_total_sum}")
        
        return invoices
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] _get_pos_invoices_helper: {str(e)}")
        return []


def _get_payments_entries_helper(pos_opening_shift):
    """
    Helper: Get payment entries for POS Opening Shift
    Payment Entries link to Sales Invoices via Payment Entry Reference child table.
    Returns list of payment entries with base_paid_amount for company currency.
    """
    try:
        frappe.log_error(f"[[pos_closing_shift.py]] _get_payments_entries_helper: Fetching payment entries for shift {pos_opening_shift}")
        
        # Query Payment Entries that reference Sales Invoices from this shift
        # Calculate base_paid_amount using allocated_amount * exchange_rate (matches Sales Register)
        payment_entries = frappe.db.sql("""
            SELECT DISTINCT
                pe.name,
                pe.mode_of_payment,
                per.allocated_amount as paid_amount,
                (per.allocated_amount * COALESCE(per.exchange_rate, pe.target_exchange_rate, pe.source_exchange_rate, 1)) as base_paid_amount,
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

        frappe.log_error(f"[[pos_closing_shift.py]] _get_payments_entries_helper: Found {len(payment_entries)} payment entries")
        
        return payment_entries
    except Exception as e:
        frappe.log_error(f"[[pos_closing_shift.py]] Error in _get_payments_entries_helper: {str(e)}")
        return []
