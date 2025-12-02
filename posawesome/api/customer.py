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
from frappe.utils import flt


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
                    # Don't fail customer creation if contact creation fails
                    frappe.log_error(f"[[customer.py]] create_customer: {str(contact_error)}")
                    pass

        frappe.db.commit()

        # Return the created customer with all details
        return customer_doc.as_dict()

    except Exception as e:
        frappe.log_error(f"[[customer.py]] create_customer: {str(e)}")
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
        frappe.log_error(f"[[customer.py]] create_customer_address: {str(e)}")
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
            try:
                customer_group_doc = frappe.get_cached_doc(
                    "Customer Group", customer_doc.customer_group)
                if hasattr(customer_group_doc, 'default_price_list') and customer_group_doc.default_price_list:
                    result["customer_group_price_list"] = customer_group_doc.default_price_list
            except Exception as cg_error:
                # Note: get_customer doesn't have pos_profile parameter
                frappe.log_error(f"[[customer.py]] get_customer: {str(cg_error)}")

        # Get loyalty points (if loyalty program exists)
        if customer_doc.loyalty_program:
            try:
                from erpnext.accounts.doctype.loyalty_program.loyalty_program import get_loyalty_program_details_with_points
                loyalty_details = get_loyalty_program_details_with_points(
                    customer_doc.name, customer_doc.loyalty_program, silent=True)
                if loyalty_details and loyalty_details.get("loyalty_points"):
                    result["loyalty_points"] = loyalty_details.get("loyalty_points")
            except Exception as loyalty_error:
                # Note: get_customer doesn't have pos_profile parameter
                frappe.log_error(f"[[customer.py]] get_customer: {str(loyalty_error)}")

        return result

    except Exception as e:
        # Note: get_customer doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_customer: {str(e)}")
        frappe.throw(_("Error retrieving customer"))


@frappe.whitelist()
def get_many_customers(pos_profile=None, search_term=None, limit=50, offset=0):
    """
    Get multiple customers with advanced filtering and server-side search.
    Optimized replacement for legacy get_customer_names function.

    Args:
        pos_profile (str|dict): POS Profile name or dict with name
        search_term (str): Search query to filter customers
        limit (int): Maximum number of customers to return (default: 50)
        offset (int): Number of customers to skip (default: 0)

    Returns:
        list: List of customer dictionaries with name, customer_name, mobile_no
    """
    try:
        # FRAPPE STANDARD: Handle string or dict for pos_profile
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile

        # Build base filters
        filters = {"disabled": 0}  # Only active customers

        # Add customer group filter from POS Profile if available
        if pos_profile_name:
            try:
                # FRAPPE STANDARD: Extract name if pos_profile_name is dict
                profile_name_to_fetch = pos_profile_name
                if isinstance(pos_profile_name, dict):
                    profile_name_to_fetch = pos_profile_name.get('name')
                elif not isinstance(pos_profile_name, str):
                    # Try to convert to string if it's not already
                    profile_name_to_fetch = str(pos_profile_name)
                
                # Verify POS Profile exists before fetching
                if profile_name_to_fetch and frappe.db.exists("POS Profile", profile_name_to_fetch):
                    pos_profile_data = frappe.get_cached_doc(
                        "POS Profile", profile_name_to_fetch)
                    if hasattr(pos_profile_data, 'customer_groups') and pos_profile_data.customer_groups:
                        # Filter by customer groups from POS Profile
                        customer_groups = [
                            cg.customer_group for cg in pos_profile_data.customer_groups if cg.customer_group]
                        if customer_groups:
                            filters["customer_group"] = ["in", customer_groups]
            except Exception as profile_error:
                # Note: get_many_customers doesn't have pos_profile parameter
                # Truncate error message to avoid CharacterLengthExceededError (max 140 chars)
                error_msg = str(profile_error)
                if len(error_msg) > 100:
                    error_msg = error_msg[:100] + "..."
                frappe.log_error(f"[[customer.py]] get_many_customers: {error_msg}", "POS Profile Filter Error")

        # Add search term filter
        if search_term and search_term.strip():
            search_term = search_term.strip()
            # Search in customer_name, name, and mobile_no
            search_filters = [
                ["customer_name", "like", f"%{search_term}%"],
                ["name", "like", f"%{search_term}%"],
                ["mobile_no", "like", f"%{search_term}%"]
            ]
            # Use OR condition for search
            filters["or"] = search_filters

        # Fetch customers
        customers = frappe.get_all(
            "Customer",
            filters=filters,
            fields=["name", "customer_name", "mobile_no", "customer_group"],
            order_by="customer_name asc",
            limit=limit,
            start=offset
        )

        # Ensure default customer is included
        if pos_profile_name:
            try:
                # FRAPPE STANDARD: Extract name if pos_profile_name is dict
                profile_name_to_fetch = pos_profile_name
                if isinstance(pos_profile_name, dict):
                    profile_name_to_fetch = pos_profile_name.get('name')
                elif not isinstance(pos_profile_name, str):
                    # Try to convert to string if it's not already
                    profile_name_to_fetch = str(pos_profile_name)
                
                if profile_name_to_fetch and frappe.db.exists("POS Profile", profile_name_to_fetch):
                    pos_profile_data = frappe.get_cached_doc(
                        "POS Profile", profile_name_to_fetch)
                    default_customer = getattr(
                        pos_profile_data, 'customer', None)
                    if default_customer:
                        customers = _ensure_default_customer_in_results(
                            customers, default_customer, ["name", "customer_name", "mobile_no", "customer_group"])
            except Exception as filter_error:
                # Note: get_many_customers doesn't have pos_profile parameter
                # Truncate error message to avoid CharacterLengthExceededError
                error_msg = str(filter_error)[:100] if len(str(filter_error)) > 100 else str(filter_error)
                frappe.log_error(f"[[customer.py]] get_many_customers: {error_msg}", "Customer Filter Error")

        return customers

    except Exception as e:
        # Note: get_many_customers doesn't have pos_profile parameter
        # Truncate error message to avoid CharacterLengthExceededError (max 140 chars for Error Log title)
        error_msg = str(e)
        if len(error_msg) > 100:
            error_msg = error_msg[:100] + "..."
        frappe.log_error(f"[[customer.py]] get_many_customers: {error_msg}", "Get Customers Error")
        frappe.throw(_("Error retrieving customers"))


@frappe.whitelist()
def get_customers_count(search_term="", pos_profile=None, filters=None):
    """
    Get total count of customers matching the search criteria (for pagination).

    Args:
        search_term (str): Search query to filter customers
        pos_profile (str|dict): POS Profile name or dict with name
        filters (dict): Additional filters to apply

    Returns:
        int: Total count of matching customers
    """
    try:
        # Build base filters
        base_filters = {"disabled": 0}

        # Apply additional filters if provided
        if filters:
            if isinstance(filters, str):
                filters = json.loads(filters)
            base_filters.update(filters)

        # FRAPPE STANDARD: Handle string or dict for pos_profile
        if isinstance(pos_profile, dict):
            pos_profile_name = pos_profile.get('name')
        else:
            pos_profile_name = pos_profile

        # Add customer group filter from POS Profile if available
        if pos_profile_name:
            try:
                pos_profile_data = frappe.get_cached_doc(
                    "POS Profile", pos_profile_name)
                if hasattr(pos_profile_data, 'customer_groups') and pos_profile_data.customer_groups:
                    customer_groups = [
                        cg.get("customer_group") for cg in pos_profile_data.get("customer_groups", [])
                        if cg.get("customer_group")
                    ]
                    if customer_groups:
                        base_filters["customer_group"] = ["in", customer_groups]
            except Exception as profile_error:
                # Note: get_customers_count doesn't have pos_profile parameter
                frappe.log_error(f"[[customer.py]] get_customers_count: {str(profile_error)}")

        # Add search term filter
        if search_term and search_term.strip():
            search_term = search_term.strip()
            search_filters = [
                ["customer_name", "like", f"%{search_term}%"],
                ["name", "like", f"%{search_term}%"],
                ["mobile_no", "like", f"%{search_term}%"]
            ]
            base_filters["or"] = search_filters

        # Count customers
        count = frappe.db.count("Customer", filters=base_filters)
        return count

    except Exception as e:
        # Note: get_customers_count doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_customers_count: {str(e)}")
        frappe.throw(_("Error counting customers"))


@frappe.whitelist()
def get_many_customer_addresses(customer_id):
    """
    Get all addresses for a customer.

    Args:
        customer_id (str): Customer ID or name

    Returns:
        list: List of address dictionaries
    """
    try:
        if not customer_id:
            return []

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

        # Get unique address names
        address_names = list(set([link.parent for link in address_links]))

        if not address_names:
            return []

        # Fetch address details
        addresses = frappe.get_all(
            "Address",
            filters={"name": ["in", address_names]},
            fields=["name", "address_title", "address_line1", "address_line2",
                    "city", "state", "pincode", "country", "address_type"],
            order_by="creation desc"
        )

        return addresses

    except Exception as address_error:
        # Note: get_many_customer_addresses doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_many_customer_addresses: {str(address_error)}")
        return []
    except Exception as e:
        # Note: get_many_customer_addresses doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_many_customer_addresses: {str(e)}")
        return []


# =============================================================================
# UPDATE FUNCTIONS
# =============================================================================

@frappe.whitelist()
def update_customer(customer_id, **kwargs):
    """
    Update customer information.

    Args:
        customer_id (str): Customer ID to update
        **kwargs: Fields to update (mobile_no, email_id, etc.)

    Returns:
        dict: Updated customer document
    """
    try:
        if not customer_id:
            frappe.throw(_("Customer ID is required"))

        if not frappe.db.exists("Customer", customer_id):
            frappe.throw(_("Customer not found"))

        # Check permissions
        if not frappe.has_permission("Customer", "write"):
            frappe.throw(
                _("You don't have permission to update customers"), frappe.PermissionError)

        # Get the customer document
        customer_doc = frappe.get_doc("Customer", customer_id)

        # Track which fields were updated for contact sync
        mobile_no_updated = False
        email_id_updated = False

        # Update fields
        for field, value in kwargs.items():
            if hasattr(customer_doc, field):
                old_value = getattr(customer_doc, field, None)
                setattr(customer_doc, field, value)
                if field == "mobile_no" and old_value != value:
                    mobile_no_updated = True
                if field == "email_id" and old_value != value:
                    email_id_updated = True

        # Save the document
        customer_doc.save(ignore_permissions=False)
        frappe.db.commit()

        # Update contact if mobile or email changed
        if mobile_no_updated or email_id_updated:
            _update_contact_for_customer(
                customer_doc, mobile_no_updated, email_id_updated)

        return customer_doc.as_dict()

    except Exception as e:
        frappe.log_error(f"[[customer.py]] update_customer: {str(e)}")
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
        # Note: get_customer_credit doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_customer_credit: {str(e)}")
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
        # Note: get_customer_credit_summary doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] get_customer_credit_summary: {str(e)}")
        frappe.throw(_("Error retrieving customer credit summary"))


@frappe.whitelist()
def get_customer_outstanding_balance(customer_id, company=None):
    """
    Get total outstanding balance (unpaid amount) for a customer.
    Following ERPNext logic: sum of outstanding_amount from all unpaid Sales Invoices.
    
    Args:
        customer_id (str): Customer ID/name (required)
        company (str): Company to filter by (optional)
    
    Returns:
        dict: Outstanding balance information
    """
    try:
        if not customer_id:
            return {
                "customer": customer_id,
                "company": company,
                "total_outstanding": 0.0,
                "currency": None
            }

        if not frappe.db.exists("Customer", customer_id):
            return {
                "customer": customer_id,
                "company": company,
                "total_outstanding": 0.0,
                "currency": None
            }

        # Build filters for unpaid invoices
        # Outstanding amount > 0 means customer owes money
        filters = {
            "customer": customer_id,
            "docstatus": 1,  # Only submitted invoices
            "outstanding_amount": [">", 0],  # Only unpaid invoices
            "is_return": 0  # Exclude return invoices
        }

        if company:
            filters["company"] = company

        # Get unpaid invoices with outstanding amounts
        unpaid_invoices = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=["outstanding_amount", "currency", "company"],
            order_by="posting_date desc"
        )

        # Calculate total outstanding by currency
        # Group by currency to handle multi-currency scenarios
        outstanding_by_currency = {}
        for invoice in unpaid_invoices:
            currency = invoice.get("currency") or "USD"  # Default currency if not set
            outstanding = flt(invoice.get("outstanding_amount", 0))
            if outstanding > 0:
                if currency not in outstanding_by_currency:
                    outstanding_by_currency[currency] = 0.0
                outstanding_by_currency[currency] += outstanding

        # For single currency POS, return the main currency outstanding
        if company:
            # Get company default currency
            company_currency = frappe.get_cached_value("Company", company, "default_currency")
        else:
            company_currency = None

        # If company currency is specified, prioritize it
        if company_currency and company_currency in outstanding_by_currency:
            total_outstanding = outstanding_by_currency[company_currency]
            currency = company_currency
        elif outstanding_by_currency:
            # Return first currency found (for single currency systems)
            currency = list(outstanding_by_currency.keys())[0]
            total_outstanding = outstanding_by_currency[currency]
        else:
            total_outstanding = 0.0
            currency = company_currency or "USD"

        return {
            "customer": customer_id,
            "company": company,
            "total_outstanding": flt(total_outstanding, 2),
            "currency": currency,
            "outstanding_by_currency": outstanding_by_currency
        }

    except Exception as e:
        frappe.log_error(f"[[customer.py]] get_customer_outstanding_balance: {str(e)}", "Customer Outstanding Balance Error")
        return {
            "customer": customer_id,
            "company": company,
            "total_outstanding": 0.0,
            "currency": None
        }


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
        frappe.log_error(f"[[customer.py]] _resolve_default_customer_name: {str(resolve_error)}")
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
        # Note: _ensure_default_customer_in_results doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] _ensure_default_customer_in_results: {str(ensure_error)}")
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
                # Note: _update_contact_for_customer doesn't have pos_profile parameter
                frappe.log_error(f"[[customer.py]] _update_contact_for_customer: {str(e)}")
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
        # Note: _update_contact_for_customer doesn't have pos_profile parameter
        frappe.log_error(f"[[customer.py]] _update_contact_for_customer: {str(contact_error)}")
        # Don't fail the whole operation if contact update fails
