# -*- coding: utf-8 -*-
"""
Customer API Module

FRAPPE API PATTERN:
- All @frappe.whitelist() methods handle both dict and string parameters
- pos_profile can be dict {name: 'Profile1'} or string 'Profile1'
- args/filters can be JSON string or dict - use frappe.parse_json()
- Use isinstance() checks to normalize parameters before processing

Consolidated API for all customer-related operations including CRUD operations,
credit management, and address handling.
"""

from __future__ import unicode_literals

import json
import frappe
from frappe import _
from posawesome import info_logger, error_logger


# =============================================================================
# CREATE FUNCTIONS
# =============================================================================

@frappe.whitelist(allow_guest=True)
def create_customer(
    customer_name,
    company=None,
    pos_profile=None,
    mobile_no=None,
    email_id=None,
    tax_id=None,
    posa_referral_code=None,
    gender=None,
    customer_group="Individual",
    territory="All Territories",
    customer_type="Individual",
    posa_discount=0
):
    """
    Create a new customer with comprehensive validation and data processing.

    Args:
        customer_name (str): Customer name (required)
        company (str): Company name
        pos_profile (str): POS Profile for default values
        mobile_no (str): Mobile phone number
        email_id (str): Email address
        tax_id (str): Tax identification number
        posa_referral_code (str): Referral code
        gender (str): Gender (Male/Female/Other)
        customer_group (str): Customer group (default: Individual)
        territory (str): Territory (default: All Territories)
        customer_type (str): Customer type (default: Individual)
        posa_discount (float): Discount percentage (0-100)

    Returns:
        dict: Created customer document with all details
    """
    try:
        # Validate required fields
        if not customer_name or not customer_name.strip():
            frappe.throw(_("Customer name is required"))

        customer_name = customer_name.strip()

        # Check permissions
        if not frappe.has_permission("Customer", "create"):
            frappe.throw(
                _("You don't have permission to create customers"), frappe.PermissionError)

        # Check for duplicate customer by name
        if frappe.db.exists("Customer", {"customer_name": customer_name}):
            frappe.throw(
                _("Customer with name '{0}' already exists").format(customer_name))

        # Check for duplicate by mobile number if provided
        if mobile_no and mobile_no.strip():
            existing_customer = frappe.db.get_value(
                "Customer", {"mobile_no": mobile_no.strip()}, "name")
            if existing_customer:
                frappe.throw(_("Customer with mobile number '{0}' already exists: {1}").format(
                    mobile_no, existing_customer))

        # Get default values from POS Profile if provided
        pos_defaults = {}
        if pos_profile:
            try:
                # FRAPPE STANDARD: Extract name from dict if needed
                if isinstance(pos_profile, dict):
                    pos_profile_name = pos_profile.get('name')
                else:
                    pos_profile_name = pos_profile

                pos_doc = frappe.get_cached_doc(
                    "POS Profile", pos_profile_name)
                if hasattr(pos_doc, 'customer_group') and pos_doc.customer_group:
                    pos_defaults["customer_group"] = pos_doc.customer_group
                if hasattr(pos_doc, 'territory') and pos_doc.territory:
                    pos_defaults["territory"] = pos_doc.territory
            except Exception as pos_error:
                error_logger.error(
                    f"[[customer.py]] create_customer: {str(pos_error)}")
                # Silent fallback - no logging needed for optional POS defaults
                pass

        # Create customer document
        customer_doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": customer_type or "Individual",
            "customer_group": pos_defaults.get("customer_group", customer_group) or "Individual",
            "territory": pos_defaults.get("territory", territory) or "All Territories",
            "mobile_no": mobile_no.strip() if mobile_no else "",
            "email_id": email_id.strip() if email_id else "",
            "tax_id": tax_id.strip() if tax_id else "",
            "gender": gender if gender in ["Male", "Female", "Other"] else "",
            "disabled": 0
        })

        # Add customer_name_in_arabic if the field exists
        if hasattr(customer_doc, 'customer_name_in_arabic'):
            customer_doc.customer_name_in_arabic = customer_name

        # Add POS-specific fields if they exist
        if hasattr(customer_doc, 'posa_referral_code') and posa_referral_code:
            customer_doc.posa_referral_code = posa_referral_code.strip()
        if hasattr(customer_doc, 'posa_discount') and posa_discount:
            customer_doc.posa_discount = float(posa_discount)

        # Insert the customer (this will trigger validate and after_insert)
        customer_doc.insert(ignore_permissions=False)

        # Create primary contact (following ERPNext logic in on_update)
        # This ensures Contact is created with proper mobile_no and email_id
        if not customer_doc.customer_primary_contact and not customer_doc.lead_name:
            if customer_doc.mobile_no or customer_doc.email_id:
                try:
                    contact = _make_contact_for_customer(customer_doc)
                    customer_doc.db_set(
                        "customer_primary_contact", contact.name)
                    customer_doc.db_set("mobile_no", customer_doc.mobile_no)
                    customer_doc.db_set("email_id", customer_doc.email_id)
                except Exception as contact_error:
                    error_logger.error(
                        f"[[customer.py]] create_customer: {str(contact_error)}")
                    # Don't fail customer creation if contact creation fails

        frappe.db.commit()

        # Return the created customer with all details
        return customer_doc.as_dict()

    except Exception as e:
        error_logger.error(f"[[customer.py]] create_customer: {str(e)}")
        frappe.throw(_("Error creating customer"))


@frappe.whitelist()
def create_customer_address(args):
    """
    Create a new address for a customer.

    Args:
        args (str): JSON string containing address details

    Returns:
        dict: Created address document
    """
    try:
        import json
        args = json.loads(args) if isinstance(args, str) else args

        if not args.get("customer"):
            frappe.throw(_("Customer is required"))

        address = frappe.get_doc({
            "doctype": "Address",
            "address_title": args.get("name") or args.get("address_title"),
            "address_line1": args.get("address_line1"),
            "address_line2": args.get("address_line2"),
            "city": args.get("city"),
            "state": args.get("state"),
            "pincode": args.get("pincode"),
            "country": args.get("country"),
            "address_type": args.get("address_type", "Shipping"),
            "links": [{
                "link_doctype": args.get("doctype", "Customer"),
                "link_name": args.get("customer")
            }],
        }).insert()

        return address.as_dict()

    except Exception as e:
        error_logger.error(
            f"[[customer.py]] create_customer_address: {str(e)}")
        frappe.throw(_("Error creating address"))


# =============================================================================
# READ FUNCTIONS
# =============================================================================

@frappe.whitelist()
def get_customer(customer_id):
    """
    Get detailed customer information by ID.

    Args:
        customer_id (str): Customer ID or name

    Returns:
        dict: Customer details including loyalty points, addresses, etc.
    """
    try:
        if not customer_id:
            frappe.throw(_("Customer ID is required"))

        # Check if customer exists
        if not frappe.db.exists("Customer", customer_id):
            frappe.throw(_("Customer not found"))

        customer_doc = frappe.get_cached_doc("Customer", customer_id)

        result = {
            # Basic customer info
            "name": customer_doc.name,
            "customer_name": customer_doc.customer_name,
            "customer_type": customer_doc.customer_type,
            "customer_group": customer_doc.customer_group,
            "territory": customer_doc.territory,

            # Contact details
            "email_id": customer_doc.email_id,
            "mobile_no": customer_doc.mobile_no,
            "tax_id": customer_doc.tax_id,

            # POS specific fields
            "gender": customer_doc.gender,
            "posa_discount": getattr(customer_doc, 'posa_discount', 0),
            "posa_referral_code": getattr(customer_doc, 'posa_referral_code', ""),

            # Business fields - maintaining backward compatibility
            "default_price_list": customer_doc.default_price_list,
            "customer_price_list": customer_doc.default_price_list,  # Legacy compatibility
            "loyalty_program": customer_doc.loyalty_program,
            "disabled": customer_doc.disabled,

            # Calculated fields
            "loyalty_points": None,
            "customer_group_price_list": None,
        }

        # Get customer group price list
        if customer_doc.customer_group:
            result["customer_group_price_list"] = frappe.get_cached_value(
                "Customer Group",
                customer_doc.customer_group,
                "default_price_list"
            )

        # Get loyalty program details
        if customer_doc.loyalty_program:
            try:
                from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
                    get_loyalty_program_details_with_points
                )
                lp_details = get_loyalty_program_details_with_points(
                    customer_doc.name,
                    customer_doc.loyalty_program,
                    silent=True,
                    include_expired_entry=False,
                )
                result["loyalty_points"] = lp_details.get("loyalty_points", 0)
            except Exception as loyalty_error:
                error_logger.error(
                    f"[[customer.py]] get_customer: {str(loyalty_error)}")
                result["loyalty_points"] = 0

        return result

    except Exception as e:
        error_logger.error(f"[[customer.py]] get_customer: {str(e)}")
        frappe.throw(_("Error retrieving customer information"))


@frappe.whitelist()
def get_many_customers(pos_profile=None, search_term=None, limit=50, offset=0):
    """
    Get multiple customers with advanced filtering and server-side search.
    Optimized replacement for legacy get_customer_names function.
    Implements Backend Improvement Policy: ORM-only, field optimization, Redis caching.

    Args:
        pos_profile (str): POS Profile name for filtering (optional)
        search_term (str): Search query for customer_name, mobile, email, etc. (optional)
        limit (int): Maximum number of results (default: 50)
        offset (int): Number of records to skip for pagination (default: 0)

    Returns:
        list: List of customer dictionaries with optimized fields
    """
    try:
        # Convert limit and offset to integers for safety
        limit = min(int(limit or 50), 200)  # Cap at 200 for performance
        offset = int(offset or 0)

        # Base query filters
        query_filters = {
            "disabled": 0  # Only active customers
        }

        # Apply POS Profile customer group filtering ONLY when searching
        # When no search term, we want to show all customers including the default customer
        apply_customer_group_filter = False

        if pos_profile and search_term and search_term.strip():
            # Only apply customer group filter when actively searching
            apply_customer_group_filter = True
            try:
                # Handle both POS Profile name and JSON data
                if isinstance(pos_profile, str) and not pos_profile.startswith('{'):
                    # It's a POS Profile name - get the document
                    profile_doc = frappe.get_cached_doc(
                        "POS Profile", pos_profile)
                    if hasattr(profile_doc, 'customer_group') and profile_doc.customer_group:
                        query_filters["customer_group"] = profile_doc.customer_group
                else:
                    # It's JSON data - parse customer groups
                    pos_profile_data = frappe.parse_json(pos_profile)
                    if pos_profile_data.get("customer_groups"):
                        customer_groups = []
                        for cg_data in pos_profile_data.get("customer_groups", []):
                            if cg_data.get("customer_group"):
                                customer_groups.append(
                                    cg_data.get("customer_group"))

                        if customer_groups:
                            query_filters["customer_group"] = [
                                "in", customer_groups]
            except Exception as profile_error:
                error_logger.error(
                    f"[[customer.py]] get_many_customers: {str(profile_error)}")
                # Silent fallback for POS profile processing
                pass

        # Add search term filtering (POSNext ORM-only approach)
        search_filters = []
        if search_term and search_term.strip():
            search_term = search_term.strip()
            # Priority-based search fields (most important first)
            search_filters = [
                # Primary search field
                ["customer_name", "like", f"%{search_term}%"],
                # Customer ID search
                ["name", "like", f"%{search_term}%"],
                # Mobile number search
                ["mobile_no", "like", f"%{search_term}%"],
                ["email_id", "like", f"%{search_term}%"],       # Email search
                ["tax_id", "like", f"%{search_term}%"]          # Tax ID search
            ]

        # Use Frappe ORM with optimized field selection (Backend Policy Compliance)
        fields_to_fetch = [
            "name", "customer_name", "mobile_no", "email_id", "tax_id",
            "customer_group", "territory", "disabled", "posa_discount", "gender",
            "posa_referral_code", "customer_type"
        ]

        default_customer_name = _resolve_default_customer_name(pos_profile)

        # Handle search term with ORM-only approach (POSNext style)
        if search_filters:
            # Use Frappe's or_filters parameter for OR search
            customers = frappe.get_all(
                "Customer",
                filters=query_filters,
                or_filters=search_filters,
                fields=fields_to_fetch,
                limit=limit,
                start=offset,
                order_by="customer_name asc"
            )

            if apply_customer_group_filter:
                customers = _ensure_default_customer_in_results(
                    customers, default_customer_name, fields_to_fetch
                )
        else:
            # Simple query without search terms - no need to add default customer separately
            # It will already be in the results since no customer_group filter is applied
            customers = frappe.get_all(
                "Customer",
                filters=query_filters,
                fields=fields_to_fetch,
                limit=limit,
                start=offset,
                order_by="customer_name asc"
            )

        customers = _ensure_default_customer_in_results(
            customers, default_customer_name, fields_to_fetch
        )

        return customers

    except Exception as e:
        error_logger.error(f"[[customer.py]] get_many_customers: {str(e)}")
        frappe.throw(_("Error searching customers"))


@frappe.whitelist()
def get_customers_count(search_term="", pos_profile=None, filters=None):
    """
    Get total count of customers matching the search criteria (for pagination).

    Args:
        search_term (str): Search query
        pos_profile (str): POS Profile for filtering
        filters (str): Additional JSON filters

    Returns:
        int: Total number of matching customers
    """
    try:
        # Use same filtering logic as get_many_customers but only count
        query_filters = {"disabled": 0}

        # Parse additional filters
        if filters:
            try:
                additional_filters = frappe.parse_json(filters)
                query_filters.update(additional_filters)
            except Exception as filter_error:
                error_logger.error(
                    f"[[customer.py]] get_customers_count: {str(filter_error)}")
                pass

        # Apply POS Profile filtering
        if pos_profile:
            try:
                if isinstance(pos_profile, str) and not pos_profile.startswith('{'):
                    profile_doc = frappe.get_cached_doc(
                        "POS Profile", pos_profile)
                    if hasattr(profile_doc, 'customer_group') and profile_doc.customer_group:
                        query_filters["customer_group"] = profile_doc.customer_group
                else:
                    pos_profile_data = frappe.parse_json(pos_profile)
                    if pos_profile_data.get("customer_groups"):
                        customer_groups = [
                            cg.get("customer_group") for cg in pos_profile_data.get("customer_groups", [])]
                        if customer_groups:
                            query_filters["customer_group"] = [
                                "in", customer_groups]
            except Exception as profile_error:
                error_logger.error(
                    f"[[customer.py]] get_customers_count: {str(profile_error)}")
                pass

        # Add search filtering
        if search_term and search_term.strip():
            search_term = search_term.strip()
            query_filters.update({
                "or": [
                    {"customer_name": ["like", f"%{search_term}%"]},
                    {"mobile_no": ["like", f"%{search_term}%"]},
                    {"email_id": ["like", f"%{search_term}%"]},
                    {"name": ["like", f"%{search_term}%"]},
                    {"tax_id": ["like", f"%{search_term}%"]}
                ]
            })

        count = frappe.db.count("Customer", filters=query_filters)
        return count

    except Exception as e:
        error_logger.error(f"[[customer.py]] get_customers_count: {str(e)}")
        return 0


@frappe.whitelist()
def get_many_customer_addresses(customer_id):
    """
    Get all addresses for a customer.

    Args:
        customer_id (str): Customer name/ID

    Returns:
        list: List of address documents
    """
    try:
        if not customer_id:
            frappe.throw(_("Customer is required"))

        # Get all address links for this customer
        address_links = frappe.get_all(
            "Dynamic Link",
            filters={
                "link_doctype": "Customer",
                "link_name": customer_id,
                "parenttype": "Address"
            },
            fields=["parent"]
        )

        if not address_links:
            return []

        addresses = []
        for link in address_links:
            try:
                address = frappe.get_doc("Address", link.parent)
                addresses.append(address.as_dict())
            except Exception as address_error:
                error_logger.error(
                    f"[[customer.py]] get_many_customer_addresses: {str(address_error)}")
                continue  # Skip if address doesn't exist

        return addresses

    except Exception as e:
        error_logger.error(
            f"[[customer.py]] get_many_customer_addresses: {str(e)}")
        frappe.throw(_("Error retrieving addresses"))


# =============================================================================
# UPDATE FUNCTIONS
# =============================================================================

@frappe.whitelist()
def update_customer(
    customer_id,
    customer_name=None,
    mobile_no=None,
    email_id=None,
    tax_id=None,
    posa_referral_code=None,
    gender=None,
    customer_group=None,
    territory=None,
    customer_type=None,
    posa_discount=None,
    disabled=None,
    **kwargs
):
    """
    Update existing customer information with validation.

    Args:
        customer_id (str): Customer ID/name (required)
        customer_name (str): New customer name
        mobile_no (str): New mobile number
        email_id (str): New email address
        tax_id (str): New tax ID
        posa_referral_code (str): New referral code
        gender (str): New gender
        customer_group (str): New customer group
        territory (str): New territory
        customer_type (str): New customer type
        posa_discount (float): New discount percentage (0-100)
        disabled (int): Disable/enable customer (0/1)
        **kwargs: Additional fields to update

    Returns:
        dict: Updated customer document
    """
    try:
        # Validate required parameters
        if not customer_id:
            frappe.throw(_("Customer ID is required"))

        # Check if customer exists
        if not frappe.db.exists("Customer", customer_id):
            frappe.throw(_("Customer not found: {0}").format(customer_id))

        # Check permissions
        if not frappe.has_permission("Customer", "write", customer_id):
            frappe.throw(
                _("You don't have permission to update this customer"), frappe.PermissionError)

        # Get the customer document
        customer_doc = frappe.get_doc("Customer", customer_id)

        # Track what fields are being updated
        updated_fields = []

        # Update basic fields if provided
        if customer_name is not None and customer_name.strip():
            new_name = customer_name.strip()
            # Check for duplicate customer name (excluding current customer)
            existing = frappe.db.get_value(
                "Customer", {"customer_name": new_name, "name": ["!=", customer_id]}, "name")
            if existing:
                frappe.throw(_("Customer with name '{0}' already exists: {1}").format(
                    new_name, existing))
            customer_doc.customer_name = new_name
            # Also update customer_name_in_arabic if it exists and is mandatory
            if hasattr(customer_doc, 'customer_name_in_arabic'):
                customer_doc.customer_name_in_arabic = new_name
                updated_fields.append("customer_name_in_arabic")
            updated_fields.append("customer_name")

        if mobile_no is not None:
            mobile_no = mobile_no.strip() if mobile_no else ""
            # Check for duplicate mobile (excluding current customer) - only if mobile_no is not empty
            if mobile_no:  # Only check if there's actually a mobile number
                existing = frappe.db.get_value(
                    "Customer", {"mobile_no": mobile_no, "name": ["!=", customer_id]}, "name")
                if existing:
                    existing_customer_name = frappe.db.get_value(
                        "Customer", existing, "customer_name")
                    frappe.throw(_("رقم الجوال '{0}' مستخدم بالفعل للعميل: {1}").format(
                        mobile_no, existing_customer_name or existing))
            customer_doc.mobile_no = mobile_no
            updated_fields.append("mobile_no")

        if email_id is not None:
            customer_doc.email_id = email_id.strip() if email_id else ""
            updated_fields.append("email_id")

        if tax_id is not None:
            customer_doc.tax_id = tax_id.strip() if tax_id else ""
            updated_fields.append("tax_id")

        if gender is not None and gender in ["Male", "Female", "Other", ""]:
            customer_doc.gender = gender
            updated_fields.append("gender")

        if customer_group is not None:
            # Validate customer group exists
            if customer_group and not frappe.db.exists("Customer Group", customer_group):
                frappe.throw(
                    _("Customer Group '{0}' does not exist").format(customer_group))
            customer_doc.customer_group = customer_group
            updated_fields.append("customer_group")

        if territory is not None:
            # Validate territory exists
            if territory and not frappe.db.exists("Territory", territory):
                frappe.throw(
                    _("Territory '{0}' does not exist").format(territory))
            customer_doc.territory = territory
            updated_fields.append("territory")

        if customer_type is not None:
            customer_doc.customer_type = customer_type
            updated_fields.append("customer_type")

        if disabled is not None:
            customer_doc.disabled = int(disabled) if disabled else 0
            updated_fields.append("disabled")

        # Handle POS-specific fields if they exist
        if posa_referral_code is not None and hasattr(customer_doc, 'posa_referral_code'):
            customer_doc.posa_referral_code = posa_referral_code.strip() if posa_referral_code else ""
            updated_fields.append("posa_referral_code")

        if posa_discount is not None and hasattr(customer_doc, 'posa_discount'):
            try:
                customer_doc.posa_discount = float(
                    posa_discount) if posa_discount else 0
                updated_fields.append("posa_discount")
            except (ValueError, TypeError):
                frappe.throw(
                    _("Invalid discount percentage: {0}").format(posa_discount))

        # Update any additional fields from kwargs
        for field_name, field_value in kwargs.items():
            if hasattr(customer_doc, field_name) and field_name not in ['name', 'doctype']:
                setattr(customer_doc, field_name, field_value)
                updated_fields.append(field_name)

        # Ensure customer_name_in_arabic is set if it's a mandatory field
        if hasattr(customer_doc, 'customer_name_in_arabic') and not customer_doc.customer_name_in_arabic:
            customer_doc.customer_name_in_arabic = customer_doc.customer_name
            if "customer_name_in_arabic" not in updated_fields:
                updated_fields.append("customer_name_in_arabic")

        # Save the document if any fields were updated
        if updated_fields:
            customer_doc.save()

            # Update the primary contact if mobile_no or email_id changed (following ERPNext pattern)
            mobile_no_updated = "mobile_no" in updated_fields
            email_id_updated = "email_id" in updated_fields

            if mobile_no_updated or email_id_updated:
                _update_contact_for_customer(
                    customer_doc, mobile_no_updated, email_id_updated)

            frappe.db.commit()

        # Return the updated customer document
        return customer_doc.as_dict()

    except Exception as e:
        error_logger.error(f"[[customer.py]] update_customer: {str(e)}")
        frappe.throw(_("Error updating customer"))


@frappe.whitelist()
def patch_customer(customer_id, **kwargs):
    """
    Partial update of customer (PATCH method equivalent).
    Only updates the fields that are explicitly provided.

    Args:
        customer_id (str): Customer ID/name (required)
        **kwargs: Fields to update

    Returns:
        dict: Updated customer document
    """
    try:
        # Filter out None values and empty strings for true partial update
        update_data = {k: v for k,
                       v in kwargs.items() if v is not None and v != ""}

        if not update_data:
            frappe.throw(_("No fields provided to update"))

        return update_customer(customer_id, **update_data)

    except Exception as e:
        error_logger.error(f"[[customer.py]] patch_customer: {str(e)}")
        frappe.throw(_("Error updating customer"))


# =============================================================================
# CREDIT FUNCTIONS
# =============================================================================

@frappe.whitelist()
def get_customer_credit(customer_id, company=None):
    """
    Get available credit information for a customer.

    Args:
        customer_id (str): Customer ID/name (required)
        company (str): Company to filter by (optional)

    Returns:
        dict: Credit information including invoices and advances
    """
    try:
        if not customer_id:
            frappe.throw(_("Customer ID is required"))

        if not frappe.db.exists("Customer", customer_id):
            frappe.throw(_("Customer not found: {0}").format(customer_id))

        # Initialize result structure
        result = {
            "customer": customer_id,
            "company": company,
            "total_available_credit": 0,
            "credit_sources": [],
            "summary": {
                "invoice_credits": 0,
                "advance_credits": 0,
                "total_credits": 0
            }
        }

        # Get credit from outstanding return invoices (negative outstanding amount)
        invoice_credits = _get_invoice_credits(customer_id, company)
        result["credit_sources"].extend(invoice_credits)

        # Get credit from unallocated advances
        advance_credits = _get_advance_credits(customer_id, company)
        result["credit_sources"].extend(advance_credits)

        # Calculate totals
        invoice_total = sum(credit["available_amount"]
                            for credit in invoice_credits)
        advance_total = sum(credit["available_amount"]
                            for credit in advance_credits)

        result["summary"]["invoice_credits"] = invoice_total
        result["summary"]["advance_credits"] = advance_total
        result["summary"]["total_credits"] = invoice_total + advance_total
        result["total_available_credit"] = invoice_total + advance_total

        return result

    except Exception as e:
        error_logger.error(f"[[customer.py]] get_customer_credit: {str(e)}")
        frappe.throw(_("Error retrieving customer credit"))


@frappe.whitelist()
def get_customer_credit_summary(customer_id, company=None):
    """
    Get a simplified summary of customer credit (faster than full details).

    Args:
        customer_id (str): Customer ID/name (required)
        company (str): Company to filter by (optional)

    Returns:
        dict: Simplified credit summary
    """
    try:
        if not customer_id:
            frappe.throw(_("Customer ID is required"))

        # Build filters for both queries
        invoice_filters = {
            "outstanding_amount": ["<", 0],
            "docstatus": 1,
            "is_return": 0,
            "customer": customer_id,
        }

        advance_filters = {
            "unallocated_amount": [">", 0],
            "party_type": "Customer",
            "party": customer_id,
            "docstatus": 1,
        }

        if company:
            invoice_filters["company"] = company
            advance_filters["company"] = company

        # Get invoice credits using ORM (Backend Improvement Policy)
        invoice_credit_filters = {
            "customer": customer_id,
            "docstatus": 1,
            "is_return": 0,
            "outstanding_amount": ["<", 0]
        }

        if company:
            invoice_credit_filters["company"] = company

        invoice_credits = frappe.get_all(
            "Sales Invoice",
            filters=invoice_credit_filters,
            fields=["outstanding_amount"],
            order_by="posting_date desc"
        )

        invoice_credit = sum(abs(inv.get("outstanding_amount", 0))
                             for inv in invoice_credits)

        # Get advance credits using ORM (Backend Improvement Policy)
        advance_credit_filters = {
            "party_type": "Customer",
            "party": customer_id,
            "docstatus": 1,
            "unallocated_amount": [">", 0]
        }

        if company:
            advance_credit_filters["company"] = company

        advance_credits = frappe.get_all(
            "Payment Entry",
            filters=advance_credit_filters,
            fields=["unallocated_amount"],
            order_by="posting_date desc"
        )

        advance_credit = sum(payment.get("unallocated_amount", 0)
                             for payment in advance_credits)

        total_credit = invoice_credit + advance_credit

        return {
            "customer": customer_id,
            "company": company,
            "invoice_credits": invoice_credit,
            "advance_credits": advance_credit,
            "total_available_credit": total_credit
        }

    except Exception as e:
        error_logger.error(
            f"[[customer.py]] get_customer_credit_summary: {str(e)}")
        frappe.throw(_("Error retrieving customer credit summary"))


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _get_invoice_credits(customer_id, company=None):
    """
    Get credit available from return invoices with negative outstanding amounts.

    Returns:
        list: List of invoice credit entries
    """
    filters = {
        "outstanding_amount": ["<", 0],
        "docstatus": 1,
        "is_return": 0,
        "customer": customer_id,
    }

    if company:
        filters["company"] = company

    outstanding_invoices = frappe.get_all(
        "Sales Invoice",
        filters=filters,
        fields=["name", "outstanding_amount",
                "posting_date", "grand_total", "company"],
        order_by="posting_date desc"
    )

    invoice_credits = []
    for invoice in outstanding_invoices:
        credit_amount = abs(invoice.outstanding_amount)
        invoice_credits.append({
            "type": "Invoice Credit",
            "reference_doctype": "Sales Invoice",
            "reference_name": invoice.name,
            "posting_date": invoice.posting_date,
            "available_amount": credit_amount,
            "original_amount": invoice.grand_total,
            "company": invoice.company,
            "description": f"Credit from Sales Invoice {invoice.name}"
        })

    return invoice_credits


def _get_advance_credits(customer_id, company=None):
    """
    Get credit available from unallocated advance payments.

    Returns:
        list: List of advance credit entries
    """
    filters = {
        "unallocated_amount": [">", 0],
        "party_type": "Customer",
        "party": customer_id,
        "docstatus": 1,
    }

    if company:
        filters["company"] = company

    advances = frappe.get_all(
        "Payment Entry",
        filters=filters,
        fields=["name", "unallocated_amount", "posting_date",
                "paid_amount", "company", "mode_of_payment"],
        order_by="posting_date desc"
    )

    advance_credits = []
    for advance in advances:
        advance_credits.append({
            "type": "Advance Payment",
            "reference_doctype": "Payment Entry",
            "reference_name": advance.name,
            "posting_date": advance.posting_date,
            "available_amount": advance.unallocated_amount,
            "original_amount": advance.paid_amount,
            "company": advance.company,
            "mode_of_payment": advance.mode_of_payment,
            "description": f"Advance payment {advance.name} via {advance.mode_of_payment}"
        })

    return advance_credits


def _resolve_default_customer_name(pos_profile):
    """
    Determine the default customer linked to the provided POS Profile input.

    Args:
        pos_profile (str|dict): POS Profile identifier or serialized data

    Returns:
        str|None: Default customer name if configured
    """
    if not pos_profile:
        return None

    try:
        # FRAPPE STANDARD: Handle dict or string for pos_profile
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        elif isinstance(pos_profile, str) and not pos_profile.startswith('{'):
            pos_profile_name = pos_profile
        else:
            # Try to parse JSON string
            try:
                pos_profile_data = frappe.parse_json(pos_profile)
                if isinstance(pos_profile_data, dict):
                    pos_profile_name = pos_profile_data.get('name')
                else:
                    return None
            except:
                return None

        if pos_profile_name:
            profile_doc = frappe.get_cached_doc(
                "POS Profile", pos_profile_name)
            return getattr(profile_doc, "customer", None)

        pos_profile_data = frappe.parse_json(pos_profile)
        if isinstance(pos_profile_data, dict):
            return pos_profile_data.get("customer")
    except Exception as resolve_error:
        error_logger.error(
            f"[[customer.py]] _resolve_default_customer_name: {str(resolve_error)}")
        # Silent fallback - default customer remains None
        return None

    return None


def _ensure_default_customer_in_results(customers, default_customer_name, fields_to_fetch):
    """
    Ensure the configured default customer is present in the provided customer list.

    Args:
        customers (list): Current customer list (mutated when default customer added)
        default_customer_name (str): Customer name to include if missing
        fields_to_fetch (list): Fields to retrieve when fetching the default customer

    Returns:
        list: Updated customer list with default customer prepended when needed
    """
    if not default_customer_name:
        return customers

    try:
        if any(c.get("name") == default_customer_name for c in customers):
            return customers

        default_customer_data = frappe.get_all(
            "Customer",
            filters={
                "name": default_customer_name,
                "disabled": 0
            },
            fields=fields_to_fetch,
            limit=1
        )

        if default_customer_data:
            customers.insert(0, default_customer_data[0])
    except Exception as ensure_error:
        error_logger.error(
            f"[[customer.py]] _ensure_default_customer_in_results: {str(ensure_error)}")
        # Silent fallback - return the original list unchanged
        return customers

    return customers


def _make_contact_for_customer(customer_doc):
    """
    Create a primary contact for a customer (following ERPNext make_contact logic).

    Args:
        customer_doc: Customer document object

    Returns:
        Contact document
    """
    from erpnext.selling.doctype.customer.customer import parse_full_name

    values = {
        "doctype": "Contact",
        "is_primary_contact": 1,
        "links": [{"link_doctype": "Customer", "link_name": customer_doc.name}],
    }

    # Set name based on customer type
    if customer_doc.customer_type == "Individual":
        first, middle, last = parse_full_name(customer_doc.customer_name)
        values.update({
            "first_name": first,
            "middle_name": middle,
            "last_name": last,
        })
    else:
        values.update({
            "company_name": customer_doc.customer_name,
        })

    contact = frappe.get_doc(values)

    # Add email if provided
    if customer_doc.email_id:
        contact.append("email_ids", {
            "email_id": customer_doc.email_id,
            "is_primary": 1
        })

    # Add mobile if provided
    if customer_doc.mobile_no:
        contact.append("phone_nos", {
            "phone": customer_doc.mobile_no,
            "is_primary_mobile_no": 1,
            "is_primary_phone": 0
        })

    contact.flags.ignore_mandatory = True
    contact.insert(ignore_permissions=True)

    return contact


def _update_contact_for_customer(customer_doc, mobile_no_updated, email_id_updated):
    """
    Update the primary contact when customer mobile_no or email_id changes.
    Follows ERPNext pattern of updating both the main field and child tables.

    Args:
        customer_doc: Customer document object
        mobile_no_updated: Boolean indicating if mobile_no was updated
        email_id_updated: Boolean indicating if email_id was updated
    """
    if not customer_doc.customer_primary_contact:
        # No primary contact exists, create one if we have mobile or email
        if customer_doc.mobile_no or customer_doc.email_id:
            try:
                contact = _make_contact_for_customer(customer_doc)
                customer_doc.db_set("customer_primary_contact", contact.name)
            except Exception as e:
                error_logger.error(
                    f"[[customer.py]] _update_contact_for_customer: {str(e)}")
        return

    try:
        contact_doc = frappe.get_doc(
            "Contact", customer_doc.customer_primary_contact)
        contact_updated = False

        if mobile_no_updated:
            # Update mobile_no field directly (this is what shows in Contact form)
            contact_doc.mobile_no = customer_doc.mobile_no or ""
            contact_updated = True

            # Update phone_nos child table for primary mobile
            primary_mobile_found = False
            for phone in contact_doc.phone_nos:
                if phone.is_primary_mobile_no:
                    phone.phone = customer_doc.mobile_no or ""
                    primary_mobile_found = True
                    break

            # If no primary mobile exists in child table, add one
            if not primary_mobile_found and customer_doc.mobile_no:
                contact_doc.append("phone_nos", {
                    "phone": customer_doc.mobile_no,
                    "is_primary_mobile_no": 1,
                    "is_primary_phone": 0
                })

        if email_id_updated:
            # Update email_id field directly (this is what shows in Contact form)
            contact_doc.email_id = customer_doc.email_id or ""
            contact_updated = True

            # Update email_ids child table for primary email
            primary_email_found = False
            for email in contact_doc.email_ids:
                if email.is_primary:
                    email.email_id = customer_doc.email_id or ""
                    primary_email_found = True
                    break

            # If no primary email exists in child table, add one
            if not primary_email_found and customer_doc.email_id:
                contact_doc.append("email_ids", {
                    "email_id": customer_doc.email_id,
                    "is_primary": 1
                })

        if contact_updated:
            contact_doc.flags.ignore_mandatory = True
            contact_doc.save(ignore_permissions=True)

    except Exception as contact_error:
        error_logger.error(
            f"[[customer.py]] _update_contact_for_customer: {str(contact_error)}")
        # Don't fail the whole operation if contact update fails
