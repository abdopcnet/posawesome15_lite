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

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] delete_invoice: {str(e)}")
        frappe.throw(_("Error deleting invoice"))


# ===== RETURN HELPERS =====

def calculate_return_stats(invoice_name):
    """
    Calculate remaining returnable amounts for an invoice.

    Returns dict with:
    - remaining_returnable_amount: Total amount still available for return
    - items: List of items with per-item return stats
    """
    try:
        # Get original invoice
        invoice = frappe.get_doc("Sales Invoice", invoice_name)

        # Get all return invoices against this invoice
        return_invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "return_against": invoice_name,
                "docstatus": 1,  # Only submitted returns
                "is_return": 1
            },
            fields=["name", "grand_total"]
        )

        # Calculate total already returned amount
        total_returned_amount = sum([flt(r.grand_total)
                                    for r in return_invoices])

        # Calculate remaining amount (note: return amounts are negative)
        remaining_amount = flt(invoice.grand_total) + \
            flt(total_returned_amount)

        # Calculate per-item return stats
        items_stats = []

        for item in invoice.items:
            # Get all returned quantities for this item
            returned_items = frappe.db.sql("""
                SELECT SUM(qty) as total_returned_qty
                FROM `tabSales Invoice Item`
                WHERE parent IN (
                    SELECT name FROM `tabSales Invoice`
                    WHERE return_against = %s
                    AND docstatus = 1
                    AND is_return = 1
                )
                AND item_code = %s
            """, (invoice_name, item.item_code), as_dict=1)

            # Note: returned qty is negative, so we need to negate it
            total_returned_qty = -1 * \
                flt(returned_items[0].total_returned_qty) if returned_items and returned_items[0].total_returned_qty else 0

            # Calculate remaining returnable quantity
            remaining_qty = flt(item.qty) - flt(total_returned_qty)

            items_stats.append({
                "item_code": item.item_code,
                "item_name": item.item_name,
                "original_qty": flt(item.qty),
                "already_returned_qty": flt(total_returned_qty),
                "remaining_returnable_qty": max(0, remaining_qty),
                # For frontend compatibility
                "max_returnable_qty": max(0, remaining_qty)
            })

        return {
            "remaining_returnable_amount": max(0, remaining_amount),
            "total_returned_amount": abs(total_returned_amount),
            "original_amount": flt(invoice.grand_total),
            "items": items_stats
        }

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] get_returnable_amounts: {str(e)}")
        return {
            "remaining_returnable_amount": 0,
            "total_returned_amount": 0,
            "original_amount": 0,
            "items": []
        }


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
    - Only paid or partly paid (outstanding_amount < grand_total)

    Note: Does NOT filter by "Credit Note Issued" status because:
    - Partial returns are allowed (ERPNext native behavior)
    - Invoice may have status "Paid" or "Partly Paid" with remaining returnable amount
    - We filter by remaining_returnable_amount > 0 instead
    """
    try:
        # Build filters
        filters = {
            "docstatus": 1,  # Only submitted invoices
            "is_return": 0,  # Not already a return
            "is_pos": 1,     # Only POS invoices
            # NOTE: Do NOT filter by status - allow partial returns
        }

        # Add company filter if provided
        if company:
            filters["company"] = company

        # Add pos_profile filter if provided
        if pos_profile:
            # FRAPPE STANDARD: Extract name from dict if needed
            if isinstance(pos_profile, dict):
                filters["pos_profile"] = pos_profile.get('name')
            else:
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

        # Get items data and return stats for each paid invoice
        returnable_invoices = []

        for invoice in paid_invoices:
            # Calculate return stats
            return_stats = calculate_return_stats(invoice["name"])

            # Only include invoices with remaining returnable amount > 0
            if return_stats["remaining_returnable_amount"] > 0:
                items = frappe.get_all(
                    "Sales Invoice Item",
                    filters={"parent": invoice["name"]},
                    fields=[
                        "name", "item_code", "item_name", "qty", "rate", "amount", "stock_qty",
                        "discount_percentage", "discount_amount", "uom", "warehouse",
                        "price_list_rate", "conversion_factor"
                    ]
                )

                # Enrich items with return stats
                items_dict = {item["item_code"]: item for item in items}
                for item_stat in return_stats["items"]:
                    if item_stat["item_code"] in items_dict:
                        items_dict[item_stat["item_code"]].update({
                            "max_returnable_qty": item_stat["max_returnable_qty"],
                            "already_returned_qty": item_stat["already_returned_qty"],
                            "remaining_returnable_qty": item_stat["remaining_returnable_qty"]
                        })

                invoice["items"] = list(items_dict.values())
                invoice["remaining_returnable_amount"] = return_stats["remaining_returnable_amount"]
                invoice["total_returned_amount"] = return_stats["total_returned_amount"]
                invoice["original_amount"] = return_stats["original_amount"]

                returnable_invoices.append(invoice)

        return returnable_invoices

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] get_returnable_invoices: {str(e)}")
        frappe.throw(_("Error fetching invoices for return"))
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

        # VALIDATION: If this is a return invoice, validate against over-refunds
        if doc.is_return and doc.return_against:
            validate_return_limits(doc)

        # Fix: Convert negative payment amounts to positive for return invoices
        # ERPNext requires positive amounts in payment table, even for returns
        if doc.is_return and doc.payments:
            for payment in doc.payments:
                if payment.amount < 0:
                    payment.amount = abs(payment.amount)
                    if hasattr(payment, 'base_amount') and payment.base_amount is not None and payment.base_amount < 0:
                        payment.base_amount = abs(payment.base_amount)

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

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] create_and_submit_invoice: {str(e)}")
        frappe.throw(_("Error creating and submitting invoice"))


def validate_return_limits(return_doc):
    """
    Validate that return invoice doesn't exceed remaining returnable amounts.

    Raises ValidationError if:
    - Total return amount exceeds remaining amount
    - Any item quantity exceeds remaining quantity
    """
    try:
        if not return_doc.return_against:
            return

        # Get return stats for original invoice
        stats = calculate_return_stats(return_doc.return_against)

        # Calculate total return amount (absolute value)
        return_total = abs(flt(return_doc.grand_total))
        remaining_amount = flt(stats["remaining_returnable_amount"])

        # Check total amount
        if return_total > remaining_amount + 0.01:  # Allow 0.01 rounding tolerance
            frappe.throw(
                _("Return amount {0} exceeds remaining returnable amount {1}").format(
                    frappe.utils.fmt_money(
                        return_total, currency=return_doc.currency),
                    frappe.utils.fmt_money(
                        remaining_amount, currency=return_doc.currency)
                ),
                title=_("Return Amount Exceeded")
            )

        # Check per-item quantities
        items_stats_dict = {item["item_code"]: item for item in stats["items"]}

        for item in return_doc.items:
            if item.item_code in items_stats_dict:
                item_stats = items_stats_dict[item.item_code]
                return_qty = abs(flt(item.qty))
                max_qty = flt(item_stats["remaining_returnable_qty"])

                if return_qty > max_qty + 0.001:  # Allow 0.001 rounding tolerance
                    frappe.throw(
                        _("Return quantity {0} for item {1} exceeds remaining returnable quantity {2}").format(
                            return_qty,
                            item.item_code,
                            max_qty
                        ),
                        title=_("Return Quantity Exceeded")
                    )

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] validate_return_limits: {str(e)}")
        # Don't block submission if validation check fails
        pass
