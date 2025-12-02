# -*- coding: utf-8 -*-
# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

"""
POS Opening Shift API Module

FRAPPE API PATTERN:
- All @frappe.whitelist() methods handle both dict and string parameters
- pos_profile can be dict {name: 'Profile1'} or string 'Profile1'
- Use isinstance() checks to normalize parameters before processing
"""

from __future__ import unicode_literals
import frappe
from frappe import _
from datetime import datetime, timedelta
from posawesome.api.pos_profile import get_payment_methods


@frappe.whitelist()
def check_opening_time_allowed(pos_profile):
    """
    Check if opening shift is allowed at current time
    Returns: {"allowed": True/False, "message": "reason"}
    """
    try:
        if not pos_profile:
            return {"allowed": True, "message": "No profile specified"}

        # FRAPPE STANDARD: Handle string or dict
        if isinstance(pos_profile, dict):
            pos_profile = pos_profile.get('name')

        profile = frappe.get_doc("POS Profile", pos_profile)

        # Check if time control is enabled in POS Profile
        if not profile.get("posa_opening_time_control"):
            return {"allowed": True, "message": "Time control disabled"}

        opening_start_time = profile.get("posa_opening_time_start")
        opening_end_time = profile.get("posa_opening_time_end")

        if not opening_start_time or not opening_end_time:
            return {"allowed": True, "message": "Time not configured"}

        # Parse time strings
        start_time = _parse_time_helper(opening_start_time)
        end_time = _parse_time_helper(opening_end_time)

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

        # Check if current time is within allowed range
        allowed = start_dt <= current_dt <= end_dt

        if allowed:
            return {"allowed": True, "message": "Opening allowed"}
        else:
            start_str = start_time.strftime("%H:%M")
            end_str = end_time.strftime("%H:%M")
            if start_time > end_time:
                end_str += " (next day)"

            return {
                "allowed": False,
                "message": f"{start_str} : {end_str}"
            }

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] check_opening_time_allowed: {str(e)}")
        return {"allowed": False, "message": f"Error: {str(e)}"}


@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
    """
    POST - Create new POS Opening Shift
    """
    try:
        import json

        # FRAPPE STANDARD: Parse JSON parameters
        if isinstance(balance_details, str):
            balance_details = json.loads(balance_details)

        # Check for existing open shift
        existing_shift = frappe.db.get_value(
            "POS Opening Shift",
            {
                "user": frappe.session.user,
                "company": company,
                "pos_profile": pos_profile,
                "status": "Open"
            },
            "name"
        )

        if existing_shift:
            frappe.throw(_(
                "An open POS Opening Shift already exists for user {0}, company {1}, and POS profile {2}. "
                "Please close shift {3} before opening a new one."
            ).format(
                frappe.bold(frappe.session.user),
                frappe.bold(company),
                frappe.bold(pos_profile),
                frappe.bold(existing_shift)
            ))

        # Create new POS Opening Shift document
        opening_voucher = frappe.new_doc("POS Opening Shift")
        opening_voucher.period_start_date = frappe.utils.now()
        opening_voucher.user = frappe.session.user
        opening_voucher.company = company
        opening_voucher.pos_profile = pos_profile
        opening_voucher.status = "Open"

        # Set opening balances
        opening_voucher.set("balance_details", balance_details)

        # Save and submit
        opening_voucher.insert(ignore_permissions=True)
        opening_voucher.submit()
        # Return as dict for frontend (Frappe automatically converts Document to dict in whitelist)
        return opening_voucher.as_dict()

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] create_opening_voucher: {str(e)}")
        frappe.throw(_("Error creating opening voucher"))


@frappe.whitelist()
def get_current_shift_name():
    """
    GET - Get current open shift for logged-in user
    """
    try:
        rows = frappe.db.sql("""
            SELECT name, pos_profile, company, period_start_date, user
            FROM `tabPOS Opening Shift`
            WHERE user = %s
            AND status = 'Open'
            ORDER BY period_start_date DESC
            LIMIT 1
        """, (frappe.session.user,), as_dict=True)

        if not rows:
            return {
                "success": False,
                "message": "No active shift found",
                "data": None,
            }

        row = rows[0]
        # Make datetime serializable
        if row.get("period_start_date"):
            row["period_start_date"] = str(row["period_start_date"])

        # Get only required POS Profile fields for cashier (based on frontend usage)
        pos_profile_name = row.get("pos_profile")
        if pos_profile_name:
            try:
                # First check if POS Profile exists in database
                if not frappe.db.exists("POS Profile", pos_profile_name):
                    error_msg = f"POS Profile '{pos_profile_name}' غير موجود في قاعدة البيانات"
                    frappe.log_error(
                        f"[[pos_opening_shift.py]] get_current_shift_name: {error_msg}",
                        "POS Profile Not Found"
                    )
                    row["pos_profile_data"] = None
                    row["pos_profile_error"] = error_msg
                else:
                    # FRAPPE FRAMEWORK STANDARD: Use frappe.get_all() to fetch document fields
                    # Following Frappe pattern: specify exact fields needed (optimized query)
                    # Only fetch fields that exist in database (verified against tabPOS Profile structure)
                    pos_profile_list = frappe.get_all(
                    "POS Profile",
                    filters={"name": pos_profile_name},
                    fields=[
                            # Standard Frappe fields (always exist in DocType)
                        "name",
                        "company",
                        "customer",
                        "currency",
                        "warehouse",
                        "selling_price_list",
                        "letter_head",
                        "apply_discount_on",
                            # POS Awesome custom fields (verified in database)
                        # Print settings
                        "posa_print_format",
                        # Cash settings
                        "posa_cash_mode_of_payment",
                        # Return settings
                        "posa_allow_return",
                        "posa_allow_quick_return",
                        # Credit settings
                        "posa_allow_credit_sale",
                        "posa_use_cashback",
                        # Offers settings
                        "posa_auto_fetch_offers",
                        "posa_fetch_zero_qty",
                        # Display settings
                        "posa_default_card_view",
                        "posa_hide_expected_amount",
                        "posa_hide_closing_shift",
                        "posa_hide_zero_price_items",
                        "posa_display_discount_percentage",
                        "posa_display_discount_amount",
                        # Discount settings
                        "posa_allow_user_to_edit_item_discount",
                        "posa_allow_user_to_edit_additional_discount",
                        "posa_item_max_discount_allowed",
                        "posa_invoice_max_discount_allowed",
                        # Tax fields
                        "posa_apply_tax",
                        "posa_tax_type",
                        "posa_tax_percent",
                    ],
                    limit=1,
                    ignore_permissions=True
                    )

                    if pos_profile_list and len(pos_profile_list) > 0:
                        pos_profile_data = pos_profile_list[0]

                        # FRAPPE FRAMEWORK STANDARD: Fetch child table data using SQL
                        # Child tables are not DocTypes, so we query them directly from database
                        # Following Frappe pattern: use parameterized queries to prevent SQL injection
                        try:
                            # Fetch item_groups child table (tabPOS Item Group)
                            item_groups_result = frappe.db.sql("""
                                SELECT item_group
                                FROM `tabPOS Item Group`
                                WHERE parent = %s
                                AND parentfield = 'item_groups'
                                AND parenttype = 'POS Profile'
                                ORDER BY idx
                            """, (pos_profile_name,), as_dict=True)
                            pos_profile_data["item_groups"] = [
                                ig.item_group for ig in item_groups_result]
                        except Exception as item_groups_error:
                            # FRAPPE STANDARD: Log error but continue (graceful degradation)
                            frappe.log_error(
                                f"[[pos_opening_shift.py]] get_current_shift_name: item_groups error: {str(item_groups_error)}",
                                "POS Item Groups Fetch Error"
                            )
                            pos_profile_data["item_groups"] = []

                        # FRAPPE FRAMEWORK STANDARD: Fetch child table data using SQL
                        try:
                            # Fetch payments child table (tabPOS Payment Method)
                            payments_result = frappe.db.sql("""
                                SELECT 
                                    mode_of_payment,
                                    `default`,
                                    allow_in_returns
                                FROM `tabPOS Payment Method`
                                WHERE parent = %s
                                AND parentfield = 'payments'
                                AND parenttype = 'POS Profile'
                                ORDER BY idx
                            """, (pos_profile_name,), as_dict=True)
                            pos_profile_data["payments"] = payments_result
                        except Exception as payments_error:
                            # FRAPPE STANDARD: Log error but continue (graceful degradation)
                            frappe.log_error(
                                f"[[pos_opening_shift.py]] get_current_shift_name: payments error: {str(payments_error)}",
                                "POS Payment Methods Fetch Error"
                            )
                            pos_profile_data["payments"] = []

                        row["pos_profile_data"] = pos_profile_data
                    else:
                        # POS Profile exists but frappe.get_all returned empty (permissions issue?)
                        error_msg = f"لم يتم العثور على بيانات POS Profile '{pos_profile_name}' (قد تكون مشكلة في الصلاحيات)"
                        frappe.log_error(
                            f"[[pos_opening_shift.py]] get_current_shift_name: POS Profile '{pos_profile_name}' exists but frappe.get_all returned empty list",
                            "POS Profile Data Not Retrieved"
                        )
                        row["pos_profile_data"] = None
                        row["pos_profile_error"] = error_msg
            except Exception as profile_error:
                # Log error with full details for debugging
                error_message = f"خطأ في تحميل POS Profile '{pos_profile_name}': {str(profile_error)}"
                frappe.log_error(
                    f"[[pos_opening_shift.py]] get_current_shift_name: {error_message}",
                    "POS Profile Load Error"
                )
                # Don't fail silently - return error info
                row["pos_profile_data"] = None
                row["pos_profile_error"] = error_message

        return {
            "success": True,
            "data": row if rows else None
        }

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] get_current_shift_name: {str(e)}")
        return {
            "success": False,
            "message": "No active shift found",
            "data": None,
        }


@frappe.whitelist()
def get_all_open_shifts(user=None):
    """
    GET - Get all open shifts for the current user (or specified user)
    
    FRAPPE STANDARD: Filters by frappe.session.user by default
    """
    try:
        # FRAPPE STANDARD: Use session user if not specified
        if not user:
            user = frappe.session.user
        
        # Filter shifts by user and status
        shifts = frappe.db.sql("""
            SELECT name, pos_profile, company, period_start_date, user
            FROM `tabPOS Opening Shift`
            WHERE user = %s
            AND status = 'Open'
            AND docstatus = 1
            ORDER BY period_start_date DESC
        """, (user,), as_dict=True)

        # Make dates JSON-serializable
        for shift in shifts:
            if shift.get("period_start_date"):
                shift["period_start_date"] = str(shift["period_start_date"])

        return {
            "success": True,
            "count": len(shifts),
            "shifts": shifts,
        }

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] get_all_open_shifts: {str(e)}")
        return {
            "success": False,
            "count": 0,
            "shifts": [],
        }


@frappe.whitelist()
def get_profile_users(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Retrieve users registered in POS Profile
    """
    try:
        pos_profile = filters.get("parent")

        # Query POS Profile User child table
        users = frappe.get_all(
            "POS Profile User",
            filters={
                "parent": pos_profile,
                "user": ["like", f"%{txt}%"]
            },
            fields=["user"],
            order_by="user",
            limit_start=start,
            limit_page_length=page_len
        )

        # Convert to format expected by set_query [[user1], [user2], ...]
        result = [[user.user] for user in users]

        return result

    except Exception as e:
        # Note: get_profile_users doesn't have pos_profile parameter
        frappe.log_error(f"[[pos_opening_shift.py]] get_profile_users: {str(e)}")
        frappe.throw(_("Error retrieving profile users"))


@frappe.whitelist()
def get_user_shift_invoice_count(pos_profile, pos_opening_shift):
    """
    GET - Get user shift invoice count
    """
    try:
        count = frappe.db.count("Sales Invoice", {
            "posa_pos_opening_shift": pos_opening_shift,
            "docstatus": 1
        })
        return count

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] get_user_shift_invoice_count: {str(e)}")
        return 0


# Helper function
def _parse_time_helper(time_value):
    """
    Parse time from various formats (string, datetime, timedelta)
    Returns: datetime.time object or None
    """
    try:
        if isinstance(time_value, str):
            # Try parsing as time string (HH:MM or HH:MM:SS)
            try:
                parsed = datetime.strptime(time_value, "%H:%M:%S").time()
                return parsed
            except ValueError:
                parsed = datetime.strptime(time_value, "%H:%M").time()
                return parsed

        elif isinstance(time_value, datetime):
            return time_value.time()

        elif isinstance(time_value, timedelta):
            # timedelta to time conversion
            total_seconds = int(time_value.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return datetime(1900, 1, 1, hours, minutes, seconds).time()

        else:
            return None

    except Exception as e:
        # Note: _parse_time_helper doesn't have pos_profile parameter
        frappe.log_error(f"[[pos_opening_shift.py]] _parse_time_helper: {str(e)}")
        return None
