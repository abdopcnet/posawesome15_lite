# -*- coding: utf-8 -*-
"""
Updated to use ERPNext Sales Invoice native cancellation methods.
Minimal custom logic - relies on ERPNext's built-in cancellation workflow.
"""
from __future__ import unicode_literals
import frappe
from frappe import _


def before_cancel(doc, method):
    """
    Minimal custom logic before cancellation.
    ERPNext handles most cancellation validations and business logic.
    """
    # Only run for POS invoices
    if not getattr(doc, 'is_pos', False):
        return

    # Only essential POS-specific check
    if doc.get('posa_pos_opening_shift'):
        shift_status = frappe.get_cached_value(
            "POS Opening Shift",
            doc.posa_pos_opening_shift,
            "status"
        )
        if shift_status == "Closed":
            frappe.throw(_("Cannot cancel invoice from closed shift"))


def before_cancel_closing_shift(doc, method):
    """
    Allow canceling POS Closing Shift without canceling linked documents.
    Sets flag to bypass Frappe's linked document checks.
    """
    # Set flag to ignore linked document validation
    # This allows canceling the closing shift without canceling Sales Invoices
    frappe.flags.ignore_linked_doctypes = True
