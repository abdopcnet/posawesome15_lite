# -*- coding: utf-8 -*-
"""
Sales Invoice API - ERPNext Native Workflow Only
Following ERPNext sales_invoice.py approach: __islocal -> insert() -> submit()
"""
from __future__ import unicode_literals
import json
import frappe
from frappe import _
from frappe.utils import flt


# ===== DELETE OPERATIONS =====

@frappe.whitelist()
def delete_invoice(invoice_name):
    """
    Delete Sales Invoice using ERPNext native methods only.
    Uses ERPNext's standard deletion workflow.
    """
    try:
        if not invoice_name:
            frappe.throw(_("Invoice name is required"))

        # Get document using ERPNext
        doc = frappe.get_doc("Sales Invoice", invoice_name)

        # Check permissions using ERPNext
        if not doc.has_permission("delete"):
            frappe.throw(_("Not permitted to delete this invoice"))

        # Only allow deletion of draft documents
        if doc.docstatus != 0:
            frappe.throw(
                _("Cannot delete submitted invoice. Use cancel instead."))

        # Use ERPNext native delete method
        doc.delete()

        return {
            "success": True,
            "message": "Invoice deleted successfully"
        }

    except frappe.exceptions.DoesNotExistError:
        frappe.throw(_("Invoice {0} does not exist").format(invoice_name))

    except frappe.exceptions.PermissionError as pe:
        frappe.throw(_("Permission denied: {0}").format(str(pe)))

    except frappe.exceptions.ValidationError as ve:
        frappe.throw(_("Validation error: {0}").format(str(ve)))

    except Exception as e:
        frappe.logger().error(f"Error in delete_invoice: {str(e)}")
        frappe.throw(_("Error deleting invoice: {0}").format(str(e)))


# ===== GET RETURN OPERATIONS =====

@frappe.whitelist()
def get_invoices_for_return(invoice_name=None, company=None, pos_profile=None):
    """
    Search invoices for return operations

    Filters:
    - Only POS invoices (is_pos=1)
    - Only from current POS profile
    - Only submitted invoices (docstatus=1)
    - Not already returns (is_return=0)
    - Not already returned (status != 'Credit Note Issued')
    - Only paid or partly paid (outstanding_amount < grand_total)
    """
    try:
        # Build filters
        filters = {
            "docstatus": 1,  # Only submitted invoices
            "is_return": 0,  # Not already a return
            "is_pos": 1,     # Only POS invoices
            # Exclude already returned invoices
            "status": ["!=", "Credit Note Issued"],
        }

        # Add company filter if provided
        if company:
            filters["company"] = company

        # Add pos_profile filter if provided
        if pos_profile:
            filters["pos_profile"] = pos_profile

        # Add invoice name search if provided
        if invoice_name:
            filters["name"] = ["like", f"%{invoice_name}%"]

        # Get invoices
        invoices = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=[
                "name", "customer", "grand_total",
                "outstanding_amount", "posting_date", "currency",
                "status", "pos_profile"
            ],
            order_by="posting_date desc, creation desc",
            limit=50
        )

        # Filter to only paid or partly paid invoices
        # (outstanding_amount < grand_total means at least partially paid)
        paid_invoices = []
        for invoice in invoices:
            outstanding = flt(invoice.get("outstanding_amount", 0))
            grand_total = flt(invoice.get("grand_total", 0))

            # Include if paid or partly paid (outstanding < grand_total)
            if outstanding < grand_total:
                paid_invoices.append(invoice)

        # Get items data for each paid invoice with essential fields
        for invoice in paid_invoices:
            items = frappe.get_all(
                "Sales Invoice Item",
                filters={"parent": invoice["name"]},
                fields=[
                    "name", "item_code", "item_name", "qty", "rate", "amount", "stock_qty",
                    "discount_percentage", "discount_amount", "uom", "warehouse",
                    "price_list_rate", "conversion_factor"
                ]
            )
            invoice["items"] = items

        return paid_invoices

    except Exception as e:
        frappe.logger().error(f"Error in get_invoices_for_return: {str(e)}")
        frappe.log_error(title="api.sales_invoice.get_invoices_for_return", message={
            "fn": "get_invoices_for_return",
            "error": str(e),
            "invoice_name": invoice_name,
            "company": company,
            "pos_profile": pos_profile
        })
        return []


# ===== CREATE AND SUBMIT OPERATION =====
# This is the ONLY method used for creating POS invoices
# Following ERPNext native workflow: __islocal -> insert() -> submit()

@frappe.whitelist()
def create_and_submit_invoice(invoice_doc):
    """
    Create and submit Sales Invoice using ERPNext native workflow 100%.

    This follows the exact same flow as ERPNext's sales_invoice.py:
    1. frappe.get_doc() - Create document from dict
    2. doc.set_missing_values() - Fill missing values (native)
    3. doc.validate() - Full validation (native)
    4. doc.insert() - Save draft (native)
    5. doc.submit() - Submit document (native)

    No custom logic - only ERPNext native methods!

    This is for the __islocal scenario:
    - Invoice stays local (__islocal = 1) during all operations
    - When Print is clicked, send entire doc to server
    - Server: uses native workflow to insert() then submit() immediately

    Args:
        invoice_doc (dict): Complete Sales Invoice document as JSON/dict

    Returns:
        dict: Submitted invoice as dict
    """
    try:
        # Parse invoice_doc if it's a string
        if isinstance(invoice_doc, str):
            invoice_doc = json.loads(invoice_doc)

        # Create new document from dict - using ERPNext native method
        doc = frappe.get_doc(invoice_doc)

        # Set POS flags
        doc.is_pos = 1
        doc.update_stock = 1
        doc.flags.from_pos_page = True

        # Step 1: Use ERPNext native set_missing_values() - fills all default values
        # This is called from SellingController and sets customer, warehouse, etc.
        doc.set_missing_values()

        # Step 2: Use ERPNext native validate() - full validation
        # This validates customer, items, taxes, payments, etc.
        doc.validate()

        # Step 3: Use ERPNext native insert() - save draft
        # This saves the document and sets docstatus = 0
        doc.insert()
        invoice_name = doc.name

        # Step 4: Use ERPNext native submit() - submit document
        # This runs before_submit() then on_submit() hooks
        doc.submit()

        # Return the submitted document
        return doc.as_dict()

    except frappe.exceptions.ValidationError as ve:
        error_msg = str(ve)
        frappe.log_error(title="api.sales_invoice.create_and_submit_invoice", message={
            "fn": "create_and_submit_invoice",
            "error_type": "ValidationError",
            "error": error_msg,
        })
        frappe.throw(_("Validation error: {0}").format(str(ve)))

    except Exception as e:
        error_msg = str(e)
        frappe.log_error(title="api.sales_invoice.create_and_submit_invoice", message={
            "fn": "create_and_submit_invoice",
            "error_type": "Exception",
            "error": error_msg,
        })
        frappe.throw(
            _("Error creating and submitting invoice: {0}").format(str(e)))
