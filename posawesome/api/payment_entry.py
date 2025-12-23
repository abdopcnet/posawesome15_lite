# -*- coding: utf-8 -*-
# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

"""
Payment Entry API Module

Uses ERPNext's native Payment Entry workflow:
- get_payment_entry() - Create Payment Entry from Sales Invoice
- Payment Entry references - Link to Sales Invoice
- Payment Entry deductions - For discounts/adjustments
"""

from __future__ import unicode_literals

import json

import frappe
from frappe import _
from frappe.utils import flt, nowdate

# Import ERPNext's native Payment Entry functions
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry


@frappe.whitelist()
def create_payment_entry_for_invoice(invoice_name, payment_data):
    """
    Create and submit Payment Entry for a submitted Sales Invoice (Settlement)

    Uses ERPNext's native get_payment_entry() to create Payment Entry
    following the standard ERPNext workflow.

    Args:
        invoice_name (str): Sales Invoice name
        payment_data (dict|str): Payment details with:
            - mode_of_payment: Payment method name
            - amount: Payment amount (required)
            - account: (optional) Payment account (if not provided, will be fetched from mode_of_payment)
            - pos_profile: (optional) POS Profile name for account lookup

    Returns:
        dict: Created and submitted Payment Entry document

    Example:
        payment_data = {
            "mode_of_payment": "Cash",
            "amount": 100.00,
            "account": "Cash - Company",
            "pos_profile": "Main POS Profile"
        }
    """
    try:
        # Parse payment_data if it's a string
        if isinstance(payment_data, str):
            payment_data = json.loads(payment_data)

        # Validate invoice exists
        if not frappe.db.exists("Sales Invoice", invoice_name):
            frappe.throw(_("Sales Invoice {0} not found").format(invoice_name))

        # Get invoice document
        invoice = frappe.get_doc("Sales Invoice", invoice_name)

        # Validate invoice is submitted
        if invoice.docstatus != 1:
            frappe.throw(_("Sales Invoice {0} is not submitted").format(invoice_name))

        # Validate invoice is not a return invoice
        if invoice.is_return:
            frappe.throw(_("Cannot create payment for return invoice"))

        # Validate payment amount
        payment_amount = flt(payment_data.get("amount") or 0, 2)
        if payment_amount <= 0:
            frappe.throw(_("Payment amount must be greater than zero"))

        # Validate outstanding amount
        outstanding_amount = flt(invoice.outstanding_amount or 0, 2)
        if payment_amount > outstanding_amount:
            frappe.throw(
                _("Payment amount ({0}) cannot exceed outstanding amount ({1})").format(
                    payment_amount, outstanding_amount
                )
            )

        # Use ERPNext's native get_payment_entry to create Payment Entry
        # This creates a Payment Entry with all standard fields populated
        payment_entry = get_payment_entry("Sales Invoice", invoice_name)

        # Set payment method
        if payment_data.get("mode_of_payment"):
            payment_entry.mode_of_payment = payment_data["mode_of_payment"]

        # Set payment amounts
        payment_entry.paid_amount = payment_amount
        payment_entry.received_amount = payment_amount

        # Set payment account
        # Priority: 1. Provided account, 2. Account from mode_of_payment, 3. Default from Payment Entry
        if payment_data.get("account"):
            # Use provided account
            if payment_entry.payment_type == "Receive":
                payment_entry.paid_to = payment_data["account"]
            else:
                payment_entry.paid_from = payment_data["account"]
        elif payment_data.get("mode_of_payment"):
            # Try to get account from mode_of_payment
            account = _get_payment_account(
                payment_data["mode_of_payment"],
                invoice.company,
                payment_data.get("pos_profile"),
            )
            if account:
                if payment_entry.payment_type == "Receive":
                    payment_entry.paid_to = account
                else:
                    payment_entry.paid_from = account

        # Update reference allocated_amount to match payment amount
        # This ensures only the settlement amount is allocated, not the full outstanding
        if payment_entry.references:
            for reference in payment_entry.references:
                if reference.reference_doctype == "Sales Invoice" and reference.reference_name == invoice_name:
                    # Set allocated amount to payment amount (not full outstanding)
                    reference.allocated_amount = payment_amount
                    break

        # Set posting date to today
        payment_entry.posting_date = nowdate()
        payment_entry.reference_date = nowdate()

        # Set missing values (this will recalculate amounts based on allocated_amount)
        payment_entry.set_missing_values()
        payment_entry.set_missing_ref_details()

        # Validate Payment Entry
        payment_entry.validate()

        # Save Payment Entry
        payment_entry.insert()

        # Submit Payment Entry
        payment_entry.submit()

        # Return created Payment Entry
        return payment_entry.as_dict()

    except frappe.ValidationError:
        # Re-raise validation errors as-is
        raise
    except Exception as e:
        frappe.log_error("[payment_entry.py] method: create_payment_entry_for_invoice", "Payment Entry")
        frappe.throw(_("Error creating payment entry"))


@frappe.whitelist()
def create_payment_entry_for_multiple_payments(invoice_name, payments_list):
    """
    Create Payment Entry for multiple payment methods (split payment)

    Args:
        invoice_name (str): Sales Invoice name
        payments_list (list|str): List of payment dictionaries, each with:
            - mode_of_payment: Payment method name
            - amount: Payment amount
            - account: (optional) Payment account
            - pos_profile: (optional) POS Profile name

    Returns:
        list: List of created Payment Entry documents
    """
    try:
        # Parse payments_list if it's a string
        if isinstance(payments_list, str):
            payments_list = json.loads(payments_list)

        if not isinstance(payments_list, list):
            frappe.throw(_("payments_list must be a list"))

        # Validate invoice
        if not frappe.db.exists("Sales Invoice", invoice_name):
            frappe.throw(_("Sales Invoice {0} not found").format(invoice_name))

        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        if invoice.docstatus != 1:
            frappe.throw(_("Sales Invoice {0} is not submitted").format(invoice_name))

        # Calculate total payment amount
        total_payment = sum(flt(p.get("amount") or 0, 2) for p in payments_list)
        outstanding_amount = flt(invoice.outstanding_amount or 0, 2)

        if total_payment > outstanding_amount:
            frappe.throw(
                _("Total payment amount ({0}) cannot exceed outstanding amount ({1})").format(
                    total_payment, outstanding_amount
                )
            )

        # Create Payment Entry for each payment method
        created_entries = []
        remaining_outstanding = outstanding_amount

        for payment_data in payments_list:
            payment_amount = flt(payment_data.get("amount") or 0, 2)
            if payment_amount <= 0:
                continue

            # Create Payment Entry for this payment method
            # Use the remaining outstanding amount as the limit
            payment_data_copy = payment_data.copy()
            payment_data_copy["amount"] = min(payment_amount, remaining_outstanding)

            entry = create_payment_entry_for_invoice(invoice_name, payment_data_copy)
            created_entries.append(entry)

            # Update remaining outstanding
            remaining_outstanding -= payment_amount
            if remaining_outstanding <= 0:
                break

        return created_entries

    except frappe.ValidationError:
        raise
    except Exception as e:
        frappe.log_error("[payment_entry.py] method: create_payment_entry_for_multiple_payments", "Payment Entry")
        frappe.throw(_("Error creating payment entries"))


def _get_payment_account(mode_of_payment, company, pos_profile=None):
    """
    Get payment account for mode of payment

    Priority:
    1. Mode of Payment Account (company-specific)
    2. POS Payment Method account (if pos_profile provided)
    3. Company default cash/bank account

    Args:
        mode_of_payment (str): Mode of Payment name
        company (str): Company name
        pos_profile (str, optional): POS Profile name

    Returns:
        str: Account name or None
    """
    try:
        # Try Mode of Payment Account (company-specific)
        account = frappe.db.get_value(
            "Mode of Payment Account",
            {"parent": mode_of_payment, "company": company},
            "default_account",
        )
        if account:
            return account

        # Try POS Payment Method account (if pos_profile provided)
        if pos_profile:
            account = frappe.db.get_value(
                "POS Payment Method",
                {"parent": pos_profile, "mode_of_payment": mode_of_payment},
                "account",
            )
            if account:
                return account

        # Try company default cash account
        cash_account = frappe.db.get_value("Company", company, "default_cash_account")
        if cash_account:
            return cash_account

        # Try company default bank account
        bank_account = frappe.db.get_value("Company", company, "default_bank_account")
        if bank_account:
            return bank_account

        return None

    except Exception:
        return None

