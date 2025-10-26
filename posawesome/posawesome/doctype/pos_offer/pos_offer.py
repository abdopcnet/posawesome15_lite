# -*- coding: utf-8 -*-
# Copyright (c) 2021, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, flt

class POSOffer(Document):
    def validate(self):
        # Clear non-relevant fields based on offer_type to prevent conflicts
        if self.offer_type == "grand_total":
            self.item_code = None
            self.item_group = None
            self.brand = None
            self.customer = None
            self.customer_group = None
        elif self.offer_type == "item_code":
            self.item_group = None
            self.brand = None
            self.customer = None
            self.customer_group = None
        elif self.offer_type == "item_group":
            self.item_code = None
            self.brand = None
            self.customer = None
            self.customer_group = None
        elif self.offer_type == "brand":
            self.item_code = None
            self.item_group = None
            self.customer = None
            self.customer_group = None
        elif self.offer_type == "customer":
            self.item_code = None
            self.item_group = None
            self.brand = None
            self.customer_group = None
        elif self.offer_type == "customer_group":
            self.item_code = None
            self.item_group = None
            self.brand = None
            self.customer = None

        # Validate required fields
        if not self.title:
            frappe.throw("Title is required")

        if not self.offer_type:
            frappe.throw("Offer Type is required")

        if not self.company:
            frappe.throw("Company is required")

        # Validate discount fields
        if self.discount_type == "Discount Percentage" and not self.discount_percentage:
            frappe.throw("Discount Percentage is required when Discount Type is 'Discount Percentage'")

        # Validate date range
        if self.valid_from and self.valid_upto:
            from frappe.utils import getdate
            if getdate(self.valid_from) > getdate(self.valid_upto):
                frappe.throw("Valid From date cannot be after Valid Upto date")

        # Validate offer_type specific fields
        if self.offer_type == "item_code" and not self.item_code:
            frappe.throw("Item Code is required when Offer Type is 'Item Code'")

        if self.offer_type == "item_group" and not self.item_group:
            frappe.throw("Item Group is required when Offer Type is 'Item Group'")

        if self.offer_type == "brand" and not self.brand:
            frappe.throw("Brand is required when Offer Type is 'Brand'")

        if self.offer_type == "customer" and not self.customer:
            frappe.throw("Customer is required when Offer Type is 'Customer'")

        if self.offer_type == "customer_group" and not self.customer_group:
            frappe.throw("Customer Group is required when Offer Type is 'Customer Group'")

        # Validate no duplicate offers
        self.check_duplicate_offers()

    def check_duplicate_offers(self):
        """التحقق من وجود عروض مكررة ونشطة"""
        from frappe.utils import getdate, today

        # تحقق من وجود الحقول المطلوبة
        if not self.pos_profile or not self.offer_type:
            return

        # الحالة 1: grand_total - لا يجوز أكثر من عرض واحد مفعل
        if self.offer_type == "grand_total":
            filters = {
                "pos_profile": self.pos_profile,
                "offer_type": "grand_total",
                "disable": 0,
            }

            # استثناء المستند الحالي إذا كان تعديل
            if not self.is_new():
                filters["name"] = ["!=", self.name]

            existing_grand_total = frappe.get_all(
                "POS Offer",
                filters=filters,
                fields=["name", "title"],
            )

            if existing_grand_total:
                frappe.throw(
                    f"لا يمكن إنشاء عرض إضافي من نوع 'Grand Total' لملف POS Profile '{self.pos_profile}'. "
                    f"يوجد بالفعل عرض نشط: '{existing_grand_total[0].title}'"
                )

        # الحالة 2: الأنواع الأخرى - التحقق من المطابقة الكاملة
        else:
            # بناء الفلاتر بناءً على نوع العرض
            filters = {
                "pos_profile": self.pos_profile,
                "offer_type": self.offer_type,
                "disable": 0,
            }

            # إضافة الفلاتر المحددة حسب نوع العرض
            if self.offer_type == "item_code":
                if not self.item_code:
                    return  # انتظر حتى يتم تعيين item_code
                filters["item_code"] = self.item_code

            elif self.offer_type == "item_group":
                if not self.item_group:
                    return
                filters["item_group"] = self.item_group

            elif self.offer_type == "brand":
                if not self.brand:
                    return
                filters["brand"] = self.brand

            elif self.offer_type == "customer":
                if not self.customer:
                    return
                filters["customer"] = self.customer

            elif self.offer_type == "customer_group":
                if not self.customer_group:
                    return
                filters["customer_group"] = self.customer_group

            # استثناء المستند الحالي
            if not self.is_new():
                filters["name"] = ["!=", self.name]

            # البحث عن عروض مطابقة
            existing_docs = frappe.get_all(
                "POS Offer",
                filters=filters,
                fields=["name", "title"],
            )

            if existing_docs:
                frappe.throw(
                    f"يوجد عرض مكرر نشط '{existing_docs[0].title}' لنفس ملف POS Profile '{self.pos_profile}' "
                    f"ونفس نوع العرض '{self.offer_type}'"
                )


# =============================================================================
# API FUNCTIONS - Consolidated from api/offers.py
# =============================================================================

@frappe.whitelist()
def get_offers(invoice_data):
    """
    🎯 Central function that applies offers directly to invoice

    Args:
        invoice_data: dict - Invoice data with items

    Returns:
        dict: {
            "enabled": bool,
            "applied_offers": list,
            "message": str,
            "updated_invoice": dict
        }
    """
    try:
        # Check if offers are enabled in POS Profile
        if not check_offers_enabled_by_profile(invoice_data.get("pos_profile")):
            return {
                "enabled": False,
                "applied_offers": [],
                "message": "Offers disabled",
                "updated_invoice": invoice_data
            }

        # Get all applicable offers
        applicable_offers = get_applicable_offers_for_invoice_data(invoice_data)

        if not applicable_offers:
            return {
                "enabled": True,
                "applied_offers": [],
                "message": "No applicable offers found",
                "updated_invoice": invoice_data
            }

        # Apply offers to invoice
        updated_invoice = invoice_data.copy()
        applied_offers = []

        # Get existing offers to avoid duplicates
        existing_offers = set()
        if "posa_offers" in updated_invoice and updated_invoice["posa_offers"]:
            existing_offers = {offer.get("offer_name") for offer in updated_invoice["posa_offers"] if offer.get("offer_name")}

        for offer in applicable_offers:
            # Skip if offer is already applied
            if offer.get("name") in existing_offers:
                continue

            if apply_offer_by_type(offer, updated_invoice):
                applied_offers.append(offer)

        return {
            "enabled": True,
            "applied_offers": applied_offers,
            "message": f"Applied {len(applied_offers)} offers",
            "updated_invoice": updated_invoice
        }

    except Exception as e:
        frappe.log_error(f"Error in get_offers: {str(e)}", "POS Offers Error")
        return {
            "enabled": False,
            "applied_offers": [],
            "message": f"Error: {str(e)}",
            "updated_invoice": invoice_data
        }


@frappe.whitelist()
def get_applicable_offers(invoice_name):
    """Get applied offers for an existing invoice"""
    try:
        doc = frappe.get_doc("Sales Invoice", invoice_name)

        # Return the existing posa_offers from the invoice with offer_applied flag set
        posa_offers = []
        for offer in doc.get("posa_offers", []):
            offer_data = {
                "offer_name": offer.offer_name,
                "row_id": offer.row_id,
                "offer_type": offer.offer_type,
                "discount_percentage": offer.discount_percentage,
                "offer_applied": True
            }
            posa_offers.append(offer_data)

        return posa_offers

    except Exception as e:
        frappe.log_error(f"Error in get_applicable_offers: {str(e)}", "POS Offers Error")
        return []


@frappe.whitelist()
def get_offers_for_profile(profile):
    """Legacy API - redirects to centralized API"""
    try:
        # Check if offers are enabled
        if not check_offers_enabled_by_profile(profile):
            return []

        # Get applicable offers for POS Profile
        pos_profile_doc = frappe.get_doc("POS Profile", profile)
        company = pos_profile_doc.company
        warehouse = pos_profile_doc.warehouse
        date = nowdate()

        offers = frappe.get_all(
            "POS Offer",
            fields=["name", "title", "description", "offer_type", "discount_type",
                    "discount_percentage", "min_qty", "max_qty",
                    "min_amt", "max_amt", "auto", "item_code", "item_group",
                    "brand", "customer", "customer_group", "valid_from", "valid_upto"],
            filters={
                "disable": 0,
                "company": company,
                "pos_profile": ["in", [profile, ""]],
                "warehouse": ["in", [warehouse, ""]],
                "valid_from": ["<=", date],
                "valid_upto": [">=", date]
            },
            order_by="auto desc, discount_percentage desc, title asc"
        )

        return offers or []

    except Exception as e:
        frappe.log_error(f"Error in get_offers_for_profile: {str(e)}", "POS Offers Error")
        return []


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def check_offers_enabled_by_profile(profile):
    """Helper: Check if offers are enabled in POS Profile"""
    if not profile:
        return False

    try:
        pos_profile_doc = frappe.get_doc("POS Profile", profile)
        return pos_profile_doc.get("posa_auto_fetch_offers")
    except:
        return False


def get_applicable_offers_for_invoice_data(invoice_data):
    """Helper: Get applicable offers for invoice data"""
    try:
        # Extract required data from invoice
        company = invoice_data.get("company")
        pos_profile = invoice_data.get("pos_profile")
        warehouse = invoice_data.get("set_warehouse")
        posting_date = invoice_data.get("posting_date") or nowdate()

        # Calculate total quantity
        total_qty = sum(flt(item.get("qty", 0)) for item in invoice_data.get("items", []))
        total_amount = sum(flt(item.get("qty", 0)) * flt(item.get("rate", 0))
                          for item in invoice_data.get("items", []))
        # Get applicable offers
        offers = frappe.get_all(
            "POS Offer",
            filters={
                "disable": 0,
                "company": company,
                "pos_profile": ["in", [pos_profile, ""]],
                "warehouse": ["in", [warehouse, ""]],
                "valid_from": ["<=", posting_date],
                "valid_upto": [">=", posting_date],
                "min_qty": ["<=", total_qty],
                "max_qty": [">=", total_qty],
                "min_amt": ["<=", total_amount],
                "max_amt": [">=", total_amount]
            },
            order_by="auto desc, discount_percentage desc, title asc"
        )

        # Check applicable offers
        applicable = []
        for offer in offers:
            if check_offer_applicable_for_data(offer, invoice_data, total_qty):
                applicable.append(offer)

        return applicable

    except Exception as e:
        frappe.log_error(f"Error in get_applicable_offers_for_invoice_data: {str(e)}", "POS Offers Error")
        return []


def check_offer_applicable_for_data(offer, invoice_data, total_qty):
    """Helper: Check if offer is applicable for invoice data"""
    try:
        # Check quantity
        if offer.get('min_qty') and total_qty < flt(offer.min_qty):
            return False

        if offer.get('max_qty') and total_qty > flt(offer.max_qty):
            return False
        total_amount = sum(flt(item.get("qty", 0)) * flt(item.get("rate", 0))
                          for item in invoice_data.get("items", []))

        if offer.get('min_amt') and total_amount < flt(offer.min_amt):
            return False

        if offer.get('max_amt') and total_amount > flt(offer.max_amt):
            return False
        # Check offer type
        offer_type = offer.get('offer_type')

        if not offer_type or offer_type == "":
            return True  # General offer

        if offer_type == "grand_total":
            return True

        if offer_type == "item_code":
            return check_item_code_in_invoice(offer, invoice_data)

        if offer_type == "item_group":
            return check_item_group_in_invoice(offer, invoice_data)

        if offer_type == "brand":
            return check_brand_in_invoice(offer, invoice_data)

        if offer_type == "customer":
            return check_customer_match(offer, invoice_data)

        if offer_type == "customer_group":
            return check_customer_group_match(offer, invoice_data)

        return False

    except Exception as e:
        frappe.log_error(f"Error in check_offer_applicable_for_data: {str(e)}", "POS Offers Error")
        return False


def check_item_code_in_invoice(offer, invoice_data):
    """Helper: Check if specific item exists in invoice"""
    if not offer.get('item_code'):
        return False

    for item in invoice_data.get("items", []):
        if item.get("item_code") == offer.item_code:
            return True

    return False


def check_item_group_in_invoice(offer, invoice_data):
    """Helper: Check if item group exists in invoice"""
    if not offer.get('item_group'):
        return False

    for item in invoice_data.get("items", []):
        if item.get("item_group") == offer.item_group:
            return True

    return False


def check_brand_in_invoice(offer, invoice_data):
    """Helper: Check if specific brand exists in invoice"""
    if not offer.get('brand'):
        return False

    for item in invoice_data.get("items", []):
        if item.get("brand") == offer.brand:
            return True

    return False


def check_customer_match(offer, invoice_data):
    """Helper: Check customer match"""
    if not offer.get('customer'):
        return False

    return offer.customer == invoice_data.get("customer")


def check_customer_group_match(offer, invoice_data):
    """Helper: Check customer group match"""
    if not offer.get('customer_group'):
        return False

    try:
        customer_group = frappe.get_value("Customer", invoice_data.get("customer"), "customer_group")
        return customer_group == offer.customer_group
    except:
        return False


def apply_offer_by_type(offer, invoice_data):
    """Helper: Apply offer by type"""
    try:
        offer_type = offer.get('offer_type')

        if not offer_type or offer_type == "" or offer_type == "grand_total":
            return apply_discount_percentage_on_grand_total(offer, invoice_data)

        if offer_type == "item_code":
            return apply_discount_percentage_on_item_code(offer, invoice_data)

        if offer_type == "item_group":
            return apply_discount_percentage_on_item_group(offer, invoice_data)

        if offer_type == "brand":
            return apply_discount_percentage_on_brand(offer, invoice_data)

        if offer_type == "customer":
            return apply_discount_percentage_on_grand_total(offer, invoice_data)

        if offer_type == "customer_group":
            return apply_discount_percentage_on_grand_total(offer, invoice_data)

        return False

    except Exception as e:
        frappe.log_error(f"Error in apply_offer_by_type: {str(e)}", "POS Offers Error")
        return False


def apply_discount_percentage_on_grand_total(offer, invoice_data):
    """Helper: Apply discount on grand total"""
    try:
        discount_percentage = offer.get("discount_percentage")
        offer_name = offer.get("name")

        if not discount_percentage or not offer_name:
            return False

        # Check if offer is already applied
        if "posa_offers" in invoice_data and invoice_data["posa_offers"]:
            for existing_offer in invoice_data["posa_offers"]:
                if existing_offer.get("offer_name") == offer_name:
                    return False  # Already applied

        # Apply discount on grand total
        invoice_data["additional_discount_percentage"] = flt(discount_percentage)

        # Record the offer
        if offer_name and str(offer_name).strip():
            if "posa_offers" not in invoice_data:
                invoice_data["posa_offers"] = []

            invoice_data["posa_offers"].append({
                "offer_name": offer_name,
                "offer_type": offer.get("offer_type"),
                "discount_percentage": discount_percentage,
                "row_id": ""
            })

        return True

    except Exception as e:
        frappe.log_error(f"Error in apply_discount_percentage_on_grand_total: {str(e)}", "POS Offers Error")
        return False


def apply_discount_percentage_on_item_code(offer, invoice_data):
    """Helper: Apply discount on specific item"""
    try:
        discount_percentage = offer.get("discount_percentage")
        item_code = offer.get("item_code")
        offer_name = offer.get("name")

        if not discount_percentage or not item_code or not offer_name:
            return False

        # Check if offer is already applied
        if "posa_offers" in invoice_data and invoice_data["posa_offers"]:
            for existing_offer in invoice_data["posa_offers"]:
                if existing_offer.get("offer_name") == offer_name:
                    return False  # Already applied

        # Apply discount on matching items
        applied = False
        for item in invoice_data.get("items", []):
            if item.get("item_code") == item_code:
                item["discount_percentage"] = flt(discount_percentage)
                applied = True

        if applied and offer_name and str(offer_name).strip():
            # Record the offer
            if "posa_offers" not in invoice_data:
                invoice_data["posa_offers"] = []

            invoice_data["posa_offers"].append({
                "offer_name": offer_name,
                "offer_type": offer.get("offer_type"),
                "discount_percentage": discount_percentage,
                "row_id": item_code
            })

        return applied

    except Exception as e:
        frappe.log_error(f"Error in apply_discount_percentage_on_item_code: {str(e)}", "POS Offers Error")
        return False


def apply_discount_percentage_on_item_group(offer, invoice_data):
    """Helper: Apply discount on item group"""
    try:
        discount_percentage = offer.get("discount_percentage")
        item_group = offer.get("item_group")
        offer_name = offer.get("name")

        if not discount_percentage or not item_group or not offer_name:
            return False

        # Check if offer is already applied
        if "posa_offers" in invoice_data and invoice_data["posa_offers"]:
            for existing_offer in invoice_data["posa_offers"]:
                if existing_offer.get("offer_name") == offer_name:
                    return False  # Already applied

        # Apply discount on matching items
        applied = False
        for item in invoice_data.get("items", []):
            if item.get("item_group") == item_group:
                item["discount_percentage"] = flt(discount_percentage)
                applied = True

        if applied and offer_name and str(offer_name).strip():
            # Record the offer
            if "posa_offers" not in invoice_data:
                invoice_data["posa_offers"] = []

            invoice_data["posa_offers"].append({
                "offer_name": offer_name,
                "offer_type": offer.get("offer_type"),
                "discount_percentage": discount_percentage,
                "row_id": item_group
            })

        return applied

    except Exception as e:
        frappe.log_error(f"Error in apply_discount_percentage_on_item_group: {str(e)}", "POS Offers Error")
        return False


def apply_discount_percentage_on_brand(offer, invoice_data):
    """Helper: Apply discount on specific brand"""
    try:
        discount_percentage = offer.get("discount_percentage")
        brand = offer.get("brand")
        offer_name = offer.get("name")

        if not discount_percentage or not brand or not offer_name:
            return False

        # Check if offer is already applied
        if "posa_offers" in invoice_data and invoice_data["posa_offers"]:
            for existing_offer in invoice_data["posa_offers"]:
                if existing_offer.get("offer_name") == offer_name:
                    return False  # Already applied

        # Apply discount on matching items
        applied = False
        for item in invoice_data.get("items", []):
            if item.get("brand") == brand:
                item["discount_percentage"] = flt(discount_percentage)
                applied = True

        if applied and offer_name and str(offer_name).strip():
            # Record the offer
            if "posa_offers" not in invoice_data:
                invoice_data["posa_offers"] = []

            invoice_data["posa_offers"].append({
                "offer_name": offer_name,
                "offer_type": offer.get("offer_type"),
                "discount_percentage": discount_percentage,
                "row_id": brand
            })

        return applied

    except Exception as e:
        frappe.log_error(f"Error in apply_discount_percentage_on_brand: {str(e)}", "POS Offers Error")
        return False


# =============================================================================
# LEGACY COMPATIBILITY FUNCTIONS
# =============================================================================

def is_offer_applicable(offer, invoice):
    """Legacy function - redirects to helper"""
    try:
        # Convert invoice doc to invoice_data
        invoice_data = {
            "company": invoice.company,
            "pos_profile": invoice.pos_profile,
            "set_warehouse": invoice.set_warehouse,
            "posting_date": invoice.posting_date,
            "customer": invoice.customer,
            "items": [{"item_code": item.item_code, "item_group": item.item_group, "brand": getattr(item, 'brand', None), "qty": item.qty} for item in invoice.items]
        }

        total_qty = sum(flt(item.qty) for item in invoice.items)
        return check_offer_applicable_for_data(offer, invoice_data, total_qty)

    except Exception as e:
        frappe.log_error(f"Error in is_offer_applicable: {str(e)}", "POS Offers Error")
        return False


def apply_offer_to_invoice(doc, offer):
    """Legacy function - Apply offer to document"""
    try:
        if not offer or not offer.name:
            frappe.log_error(f"Invalid offer provided: {offer}", "POS Offers Error")
            return False
        # Convert doc to invoice_data
        invoice_data = {
            "company": doc.company,
            "pos_profile": doc.pos_profile,
            "set_warehouse": doc.set_warehouse,
            "posting_date": doc.posting_date,
            "customer": doc.customer,
            "items": [{"item_code": item.item_code, "item_group": item.item_group, "brand": getattr(item, 'brand', None), "qty": item.qty} for item in doc.items],
            "posa_offers": [{"offer_name": offer_row.offer_name, "offer_type": offer_row.offer_type, "discount_percentage": offer_row.discount_percentage, "row_id": offer_row.row_id} for offer_row in doc.get("posa_offers", [])]
        }

        # Apply the offer
        if apply_offer_by_type(offer, invoice_data):
            # Apply changes to document
            if "additional_discount_percentage" in invoice_data:
                doc.additional_discount_percentage = invoice_data["additional_discount_percentage"]

            # Apply item discounts
            for i, item in enumerate(doc.items):
                if i < len(invoice_data["items"]) and "discount_percentage" in invoice_data["items"][i]:
                    item.discount_percentage = invoice_data["items"][i]["discount_percentage"]

            # Record the offer
            # Record the offer
            if "posa_offers" in invoice_data:
                for offer_data in invoice_data["posa_offers"]:
                    # Validate offer_name before appending
                    if offer_data.get("offer_name") and str(offer_data["offer_name"]).strip():
                        # Check if this offer is already in the document
                        existing_offers = [row.offer_name for row in doc.get("posa_offers", [])]
                        if offer_data["offer_name"] not in existing_offers:
                            doc.append("posa_offers", offer_data)

            return True

        return False

    except Exception as e:
        frappe.log_error(f"Error in apply_offer_to_invoice: {str(e)}", "POS Offers Error")
        return False
