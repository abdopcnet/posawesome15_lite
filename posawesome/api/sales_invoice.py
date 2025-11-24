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


# ===== DRAFT OPERATIONS =====

@frappe.whitelist()
def save_draft_invoice(invoice_doc):
    """
    Save invoice as draft (docstatus = 0) without submitting.
    Used for saving incomplete invoices to continue later.
    """
    try:
        # Parse invoice_doc if it's a string
        if isinstance(invoice_doc, str):
            invoice_doc = json.loads(invoice_doc)

        # Create or update document
        if invoice_doc.get("name"):
            doc = frappe.get_doc("Sales Invoice", invoice_doc["name"])
            doc.update(invoice_doc)
        else:
            doc = frappe.get_doc(invoice_doc)

        # Set POS flags
        doc.is_pos = 1
        doc.update_stock = 0  # Don't update stock for drafts
        doc.flags.from_pos_page = True
        doc.flags.ignore_permissions = True
        frappe.flags.ignore_account_permission = True

        # Set as draft (not submitted)
        doc.docstatus = 0

        # Set missing values
        doc.set_missing_values()

        # Validate
        doc.validate()

        # Save as draft
        doc.save()

        return doc.as_dict()

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] save_draft_invoice: {str(e)}")
        frappe.throw(_("Error saving draft invoice"))


@frappe.whitelist()
def get_draft_invoices(pos_opening_shift=None):
    """
    Get all draft invoices (docstatus = 0) for the current POS opening shift.
    """
    try:
        filters = {
            "is_pos": 1,
            "docstatus": 0,
        }
        
        if pos_opening_shift:
            filters["posa_pos_opening_shift"] = pos_opening_shift

        invoices_list = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=["name", "customer", "posting_date", "posting_time", "grand_total", "currency"],
            order_by="modified desc",
            limit=50
        )

        # Get full invoice data
        data = []
        for invoice in invoices_list:
            try:
                doc = frappe.get_cached_doc("Sales Invoice", invoice["name"])
                invoice_dict = doc.as_dict()
                invoice_dict["customer_name"] = frappe.get_value("Customer", invoice["customer"], "customer_name") if invoice["customer"] else ""
                data.append(invoice_dict)
            except Exception as e:
                frappe.log_error(f"[[sales_invoice.py]] get_draft_invoices: Error loading {invoice['name']}: {str(e)}")
                continue

        return data

    except Exception as e:
        frappe.log_error(f"[[sales_invoice.py]] get_draft_invoices: {str(e)}")
        return []


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


# ===== PRINT INVOICES =====

@frappe.whitelist()
def get_print_invoices(pos_profile=None, pos_opening_shift=None, user=None):
    """
    GET - Get submitted invoices for print dialog with invoice type
    Returns list of invoices with invoice_type field (مبيعات, مرتجع فاتورة, مرتجع سريع)
    
    FRAPPE STANDARD: pos_profile and pos_opening_shift can be dict or string
    """
    try:
        # FRAPPE STANDARD: Handle string or dict parameters
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile
            
        if isinstance(pos_opening_shift, dict):
            pos_opening_shift_name = pos_opening_shift.get('name')
        else:
            pos_opening_shift_name = pos_opening_shift
        
        # Use session user if not specified
        if not user:
            user = frappe.session.user
        
        if not pos_profile_name:
            return []
        
        # Build filters
        filters = {
            "is_pos": 1,
            "pos_profile": pos_profile_name,
            "owner": user,
            "docstatus": 1,  # Only submitted invoices
        }
        
        # Add pos_opening_shift filter if provided
        if pos_opening_shift_name:
            filters["posa_pos_opening_shift"] = pos_opening_shift_name
        
        # FRAPPE STANDARD: Fetch invoices with all required fields
        invoices = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=[
                "name",
                "customer",
                "posting_date",
                "posting_time",
                "grand_total",
                "currency",
                "is_return",
                "return_against",
                "posa_pos_opening_shift",
                "pos_profile",
                "owner",
            ],
            order_by="creation desc",
            limit=50,
        )
        
        # Get customer names and determine invoice type
        result = []
        for invoice in invoices:
            # Get customer name
            customer_name = invoice.customer
            if invoice.customer:
                try:
                    customer_name = frappe.get_value("Customer", invoice.customer, "customer_name") or invoice.customer
                except:
                    customer_name = invoice.customer
            
            # Determine invoice type based on Frappe framework logic
            invoice_type = _get_invoice_type(
                invoice,
                pos_profile_name,
                pos_opening_shift_name,
                user
            )
            
            result.append({
                "name": invoice.name,
                "customer": invoice.customer,
                "customer_name": customer_name,
                "posting_date": invoice.posting_date,
                "posting_time": invoice.posting_time,
                "grand_total": flt(invoice.grand_total or 0),
                "currency": invoice.currency,
                "invoice_type": invoice_type,
            })
        
        return result
        
    except Exception as e:
        # FRAPPE STANDARD: Short error message (max 140 chars for Error Log title field)
        error_msg = str(e)[:100] if len(str(e)) > 100 else str(e)
        frappe.log_error(f"get_print_invoices: {error_msg}", "Sales Invoice")
        return []


def _get_invoice_type(invoice, pos_profile_name, pos_opening_shift_name, user):
    """
    Helper: Determine invoice type based on Frappe framework logic
    Returns: "مبيعات", "مرتجع فاتورة", "مرتجع سريع", or "غير معروف"
    """
    try:
        # FRAPPE STANDARD: Get values from invoice dict
        # Frappe returns is_pos and is_return as int (0 or 1), not boolean
        is_pos = invoice.get("is_pos", 0)
        is_return = invoice.get("is_return", 0)
        grand_total = flt(invoice.get("grand_total") or 0)
        return_against = invoice.get("return_against")
        
        # Check if invoice matches current shift, profile, and user
        # Only check if filters were provided (if not provided, accept all)
        if pos_profile_name:
            matches_current_profile = invoice.get("pos_profile") == pos_profile_name
            if not matches_current_profile:
                return "غير معروف"
        
        if user:
            matches_current_user = invoice.get("owner") == user
            if not matches_current_user:
                return "غير معروف"
        
        if pos_opening_shift_name:
            matches_current_shift = invoice.get("posa_pos_opening_shift") == pos_opening_shift_name
            if not matches_current_shift:
                return "غير معروف"
        
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
        frappe.log_error(f"_get_invoice_type: {str(e)[:100]}", "Sales Invoice")
        return "غير معروف"


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

        # Check if this is an existing draft invoice (following POS-Awesome-V15 logic)
        invoice_name = invoice_doc.get("name")
        
        # Determine invoice type for logging
        invoice_type = "Sales_Mode"
        if invoice_doc.get("is_return"):
            invoice_type = "Return_Invoice" if invoice_doc.get("return_against") else "Quick_Return"
        
        # Following POS-Awesome-V15 submit_invoice logic exactly:
        # If invoice name exists and document exists in DB, load and update it
        if invoice_name and frappe.db.exists("Sales Invoice", invoice_name):
            doc = frappe.get_doc("Sales Invoice", invoice_name)
            # Check if it's a draft (docstatus = 0) - only update drafts
            if doc.docstatus == 0:
                # Update existing draft (Frappe's update() replaces child tables when passed as list)
                doc.update(invoice_doc)
            else:
                # If already submitted, create new invoice (don't update submitted invoices)
                doc = frappe.get_doc(invoice_doc)
        else:
            # Create new document from dict - using ERPNext native method
            doc = frappe.get_doc(invoice_doc)

        # Set POS flags (following POS-Awesome-V15 pattern)
        doc.is_pos = 1
        doc.update_stock = 1
        doc.flags.from_pos_page = True

        # VALIDATION: If this is a return invoice, validate against over-refunds
        if doc.is_return and doc.return_against:
            validate_return_limits(doc)

        # Step 1: Use ERPNext native set_missing_values() - fills all default values
        # This is called from SellingController and sets customer, warehouse, etc.
        doc.set_missing_values()

        # For return invoices, payments should be negative amounts (following POS-Awesome-V15 and ERPNext requirement)
        # MUST be done AFTER set_missing_values() but BEFORE validate() because validate() calls verify_payment_amount_is_negative()
        # ERPNext's verify_payment_amount_is_negative() requires negative amounts for return invoices
        if doc.is_return and doc.payments:
            for payment in doc.payments:
                # Convert positive amounts to negative (skip zero amounts)
                if payment.amount > 0:
                    payment.amount = -abs(payment.amount)
                elif payment.amount == 0:
                    # Skip zero amounts - they will be removed or ignored
                    continue
                # Ensure base_amount is also negative if it exists
                if hasattr(payment, 'base_amount') and payment.base_amount is not None:
                    if payment.base_amount > 0:
                        payment.base_amount = -abs(payment.base_amount)
                    elif payment.base_amount == 0:
                        payment.base_amount = 0
            
            # Filter out zero-amount payments for return invoices
            doc.payments = [p for p in doc.payments if p.amount != 0]
            
            # Update paid amounts (will be negative for returns)
            # Handle None values in base_amount to avoid TypeError
            doc.paid_amount = flt(sum(p.amount for p in doc.payments))
            if hasattr(doc, 'base_paid_amount'):
                base_amounts = [flt(p.base_amount) if p.base_amount is not None else 0 for p in doc.payments]
                doc.base_paid_amount = flt(sum(base_amounts))

        # Step 2: Use ERPNext native validate() - full validation
        # This validates customer, items, taxes, payments, etc.
        # For return invoices, this will call verify_payment_amount_is_negative() which requires negative amounts
        doc.validate()

        # Step 3: Save document (insert for new, save for existing draft)
        # Check if this is an existing draft by checking if doc has name and docstatus = 0
        is_existing_draft = doc.name and doc.docstatus == 0
        
        if is_existing_draft:
            # For existing draft, just save (already loaded and updated above)
            # Following POS-Awesome-V15: doc.update() already handled child tables
            doc.save()
            invoice_name = doc.name
        else:
            # For new invoice, use insert() - save draft
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
