# -*- coding: utf-8 -*-
"""
Customer API Module
Consolidated API for all customer-related operations including CRUD operations,
credit management, and address handling.
"""

from __future__ import unicode_literals

import json
import frappe
from frappe import _
from datetime import datetime
import re


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
    birthday=None,
    gender=None,
    customer_group="Individual",
    territory="All Territories",
    customer_type="Individual",
    discount_percentage=0
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
        birthday (str): Birthday in various formats
        gender (str): Gender (Male/Female/Other)
        customer_group (str): Customer group (default: Individual)
        territory (str): Territory (default: All Territories)
        customer_type (str): Customer type (default: Individual)
        discount_percentage (float): Default discount percentage

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

        # Process birthday date
        formatted_birthday = None
        if birthday:
            formatted_birthday = _parse_birthday(birthday)

        # Get default values from POS Profile if provided
        pos_defaults = {}
        if pos_profile:
            try:
                pos_doc = frappe.get_cached_doc("POS Profile", pos_profile)
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

        # Add POS-specific fields if they exist
        if hasattr(customer_doc, 'posa_birthday') and formatted_birthday:
            customer_doc.posa_birthday = formatted_birthday
        if hasattr(customer_doc, 'posa_discount') and discount_percentage:
            customer_doc.posa_discount = float(discount_percentage)

        # Insert the customer
        customer_doc.insert(ignore_permissions=False)

        frappe.db.commit()

        # Return the created customer with all details
        return customer_doc.as_dict()

    except Exception as e:
        frappe.logger().error(f"[customer.py] create_customer: {str(e)}")
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
        frappe.logger().error(f"[customer.py] create_customer_address: {str(e)}")
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
            "birthday": getattr(customer_doc, 'posa_birthday', None),
            "posa_discount": getattr(customer_doc, 'posa_discount', 0),

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
                # Silent fallback for loyalty details
                result["loyalty_points"] = 0

        return result

    except Exception as e:
        frappe.logger().error(f"[customer.py] get_customer: {str(e)}")
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
            "customer_group", "territory", "disabled"
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
        frappe.throw(_("Error searching customers: {0}").format(str(e)))


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
            except:
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
            except:
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
            except Exception:
                continue  # Skip if address doesn't exist

        return addresses

    except Exception as e:
        frappe.logger().error(f"[customer.py] get_many_customer_addresses: {str(e)}")
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
    birthday=None,
    gender=None,
    customer_group=None,
    territory=None,
    customer_type=None,
    discount_percentage=None,
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
        birthday (str): New birthday
        gender (str): New gender
        customer_group (str): New customer group
        territory (str): New territory
        customer_type (str): New customer type
        discount_percentage (float): New discount percentage
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
            updated_fields.append("customer_name")

        if mobile_no is not None:
            mobile_no = mobile_no.strip() if mobile_no else ""
            # Check for duplicate mobile (excluding current customer)
            if mobile_no:
                existing = frappe.db.get_value(
                    "Customer", {"mobile_no": mobile_no, "name": ["!=", customer_id]}, "name")
                if existing:
                    frappe.throw(_("Customer with mobile number '{0}' already exists: {1}").format(
                        mobile_no, existing))
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
        if birthday is not None and hasattr(customer_doc, 'posa_birthday'):
            formatted_birthday = _parse_birthday(
                birthday) if birthday else None
            customer_doc.posa_birthday = formatted_birthday
            updated_fields.append("posa_birthday")

        if discount_percentage is not None and hasattr(customer_doc, 'posa_discount'):
            try:
                customer_doc.posa_discount = float(
                    discount_percentage) if discount_percentage else 0
                updated_fields.append("posa_discount")
            except (ValueError, TypeError):
                frappe.throw(_("Invalid discount percentage: {0}").format(
                    discount_percentage))

        # Update any additional fields from kwargs
        for field_name, field_value in kwargs.items():
            if hasattr(customer_doc, field_name) and field_name not in ['name', 'doctype']:
                setattr(customer_doc, field_name, field_value)
                updated_fields.append(field_name)

        # Save the document if any fields were updated
        if updated_fields:
            customer_doc.save()
            frappe.db.commit()

        # Return the updated customer document
        return customer_doc.as_dict()

    except Exception as e:
        frappe.logger().error(f"[customer.py] update_customer: {str(e)}")
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
        frappe.logger().error(f"[customer.py] patch_customer: {str(e)}")
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
        frappe.logger().error(f"[customer.py] get_customer_credit: {str(e)}")
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
        frappe.logger().error(f"[customer.py] get_customer_credit_summary: {str(e)}")
        frappe.throw(_("Error retrieving customer credit summary"))


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_birthday(birthday_input):
    """
    Parse birthday from various input formats to YYYY-MM-DD format.

    Args:
        birthday_input (str): Birthday in various formats

    Returns:
        str: Formatted birthday as YYYY-MM-DD or None if invalid
    """
    if not birthday_input:
        return None

    try:
        # Handle JavaScript Date string format (e.g., "Mon Oct 17 2025 00:00:00 GMT+0000")
        if 'GMT' in birthday_input or 'UTC' in birthday_input:
            match = re.search(
                r'(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})', birthday_input)
            if match:
                day_name, month_name, day, year = match.groups()
                month_map = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                }
                if month_name in month_map:
                    month = month_map[month_name]
                    day = day.zfill(2)
                    return f"{year}-{month}-{day}"

        # Handle ISO date format (YYYY-MM-DD)
        if re.match(r'^\d{4}-\d{2}-\d{2}', birthday_input):
            date_part = birthday_input[:10]  # Take only YYYY-MM-DD part
            datetime.strptime(date_part, '%Y-%m-%d')  # Validate
            return date_part

        # Handle MM/DD/YYYY format
        if re.match(r'^\d{1,2}/\d{1,2}/\d{4}', birthday_input):
            dt = datetime.strptime(birthday_input[:10], '%m/%d/%Y')
            return dt.strftime('%Y-%m-%d')

        # Handle DD/MM/YYYY format
        if re.match(r'^\d{1,2}/\d{1,2}/\d{4}', birthday_input):
            dt = datetime.strptime(birthday_input[:10], '%d/%m/%Y')
            return dt.strftime('%Y-%m-%d')

        # Handle DD-MM-YYYY format
        if re.match(r'^\d{1,2}-\d{1,2}-\d{4}', birthday_input):
            dt = datetime.strptime(birthday_input[:10], '%d-%m-%Y')
            return dt.strftime('%Y-%m-%d')

        # Invalid format - return None silently
        return None

    except ValueError:
        return None
    except Exception as e:
        frappe.logger().error(f"Error parsing birthday: {e}")
        return None


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
        if isinstance(pos_profile, str) and not pos_profile.startswith('{'):
            profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
            return getattr(profile_doc, "customer", None)

        pos_profile_data = frappe.parse_json(pos_profile)
        if isinstance(pos_profile_data, dict):
            return pos_profile_data.get("customer")
    except Exception:
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
    except Exception:
        # Silent fallback - return the original list unchanged
        return customers

    return customers
