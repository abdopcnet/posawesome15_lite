# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import cint, comma_or, nowdate, getdate
from frappe.model.document import Document
import sys
import json
from datetime import datetime, timedelta
from posawesome.api.pos_profile import get_payment_methods


class OverAllowanceError(frappe.ValidationError):
    pass


def validate_status(status, options):
    """Validate if status value is in allowed options list"""
    try:
        if status not in options:
            frappe.throw(
                _("Status must be one of {0}").format(comma_or(options)))
    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] validate_status: {str(e)}")
        raise


# Status workflow rules for POS Opening Shift
status_map = {
    "POS Opening Shift": [
        ["Draft", None],
        ["Open", "eval:self.docstatus == 1 and not self.pos_closing_shift"],
        ["Closed", "eval:self.docstatus == 1 and self.pos_closing_shift"],
        ["Cancelled", "eval:self.docstatus == 2"],
    ]
}


# Auto-update status based on workflow rules
class StatusUpdater(Document):

    def set_status(self, update=False, status=None, update_modified=True):
        """Auto-update status based on workflow rules"""
        try:
            if self.is_new():
                if self.get('amended_from'):
                    self.status = 'Draft'
                return

            if self.doctype in status_map:
                _status = self.status

                # Manual status update (if provided)
                if status and update:
                    self.db_set("status", status)

                # Auto-calculate status based on workflow rules
                sl = status_map[self.doctype][:]
                sl.reverse()
                for s in sl:
                    if not s[1]:
                        self.status = s[0]
                        break
                    elif s[1].startswith("eval:"):
                        try:
                            result = frappe.safe_eval(s[1][5:], None, {"self": self.as_dict(), "getdate": getdate,
                                                                       "nowdate": nowdate, "get_value": frappe.db.get_value})
                            if result:
                                self.status = s[0]
                                break
                        except Exception as e:
                            frappe.log_error(f"[[pos_opening_shift.py]] set_status: {str(e)}")
                            raise
                    elif getattr(self, s[1])():
                        self.status = s[0]
                        break

                # Add comment log if status changed
                if self.status != _status and self.status not in ("Cancelled", "Partially Ordered",
                                                                  "Ordered", "Issued", "Transferred"):
                    self.add_comment("Label", _(self.status))

                # Save to database
                if update:
                    self.db_set('status', self.status,
                                update_modified=update_modified)
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] set_status: {str(e)}")
            raise


# Main POS Opening Shift document class
class POSOpeningShift(StatusUpdater):
    def validate(self):
        """Run validations before saving document"""
        try:
            self.validate_pos_profile_and_cashier()
            self.validate_pos_shift()
            self._validate_shift_opening_window()
            self.set_status()
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] validate: {str(e)}")
            raise

    def validate_pos_profile_and_cashier(self):
        """Validate POS Profile, Company, and User permissions"""
        try:
            # Check if POS Profile belongs to selected company
            if self.company != frappe.db.get_value("POS Profile", self.pos_profile, "company"):
                frappe.throw(_("POS Profile {} does not belongs to company {}".format(
                    self.pos_profile, self.company)))

            # Check if user is enabled/active
            if not cint(frappe.db.get_value("User", self.user, "enabled")):
                frappe.throw(
                    _("User {} has been disabled. Please select valid user/cashier".format(self.user)))

            # Check if user is registered in POS Profile User child table
            if self.pos_profile and self.user:
                user_exists = frappe.db.exists("POS Profile User", {
                    "parent": self.pos_profile,
                    "user": self.user
                })

                if not user_exists:
                    frappe.throw(_("User {} is not registered in POS Profile {}. Please select a user registered in the profile".format(
                        self.user, self.pos_profile)))
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] validate_pos_profile_and_cashier: {str(e)}")
            raise

    def validate_pos_shift(self):
        """Validate shift rules and prevent duplicate open shifts"""
        try:
            # Validate required fields
            if not self.company:
                frappe.throw(_("Company is required"))

            if not self.pos_profile:
                frappe.throw(_("POS Profile is required"))

            if not self.user:
                frappe.throw(_("User is required"))

            # Prevent duplicate open shifts (same user + company + POS profile)
            if self.docstatus == 0:  # Only check when creating/saving draft
                existing_shift = frappe.db.exists(
                    "POS Opening Shift",
                    {
                        "user": self.user,
                        "company": self.company,
                        "pos_profile": self.pos_profile,
                        "docstatus": 1,
                        "status": "Open",
                        "name": ["!=", self.name]  # Exclude current document
                    }
                )

                if existing_shift:
                    frappe.throw(_(
                        "An open POS Opening Shift already exists for user {0}, company {1}, and POS profile {2}. "
                        "Please close shift {3} before opening a new one."
                    ).format(
                        frappe.bold(self.user),
                        frappe.bold(self.company),
                        frappe.bold(self.pos_profile),
                        frappe.bold(existing_shift)
                    ))

            # Validate opening balance details exist
            if not self.balance_details:
                frappe.throw(_("Opening balance details are required"))

            # Allow zero opening balance but prevent negative amounts
            total_opening_amount = 0
            negative_amounts = 0

            for detail in self.balance_details:
                amount = frappe.utils.flt(
                    detail.amount) if detail.amount else 0
                if amount > 0:
                    total_opening_amount += amount
                elif amount < 0:
                    negative_amounts += abs(amount)

            # Prevent negative opening cash
            if negative_amounts > 0:
                frappe.throw(_("Opening cash amount cannot be negative"))

        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] validate_pos_shift: {str(e)}")
            raise

    def _parse_time(self, time_value):
        """Parse time string to datetime.time object"""
        if not time_value:
            return None

        try:
            if isinstance(time_value, str):
                # Try parsing with microseconds first
                try:
                    return datetime.strptime(time_value, "%H:%M:%S.%f").time()
                except ValueError:
                    return datetime.strptime(time_value, "%H:%M:%S").time()
            elif hasattr(time_value, 'hour'):  # datetime.time object
                return time_value
            else:
                return None
        except (ValueError, TypeError):
            return None

    def _validate_shift_opening_window(self):
        """Validate if current time is within allowed opening window"""
        try:
            if not self.posting_date:
                return

            # Check if opening time control is enabled in POS Opening Shift
            time_control = self.get("posa_opening_time_control")
            if not cint(time_control):
                return  # Skip validation if time control is not enabled

            # Get opening time window from POS Opening Shift
            opening_start_time = self.get("posa_opening_time_start")
            opening_end_time = self.get("posa_opening_time_end")

            if not opening_start_time or not opening_end_time:
                return  # No restriction if not configured

            # Parse times
            start_time = self._parse_time(opening_start_time)
            end_time = self._parse_time(opening_end_time)

            if not start_time or not end_time:
                return

            # Get posting_date and current time
            posting_date = frappe.utils.getdate(self.posting_date)
            current_dt = frappe.utils.now_datetime()

            # Create datetime objects for comparison using posting_date
            start_dt = datetime.combine(posting_date, start_time)
            end_dt = datetime.combine(posting_date, end_time)

            # If start_time > end_time, assume end_time is next day (overnight shift)
            if start_time > end_time:
                end_dt = end_dt + timedelta(days=1)

            # Check if current_dt is within [start_dt, end_dt]
            allowed = start_dt <= current_dt <= end_dt

            if not allowed:
                start_str = _format_time_12h(start_time)
                end_str = _format_time_12h(end_time)
                frappe.throw(
                    _("الفتح مسموح من {0} الي {1}").format(start_str, end_str),
                    title=_("Opening Time Not Allowed")
                )
        except frappe.exceptions.ValidationError:
            # Re-raise validation errors (like frappe.throw)
            raise
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] Error validating shift opening window: {str(e)}")
            raise

    def on_submit(self):
        """Update status when document is submitted"""
        try:
            self.set_status(update=True)
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] on_submit: {str(e)}")
            raise


# =============================================================================
# SECTION 2: API ENDPOINTS
# =============================================================================
# API endpoints for POS Opening Shift operations
# Used by POS frontend and form scripts

# ========================================================================
# SECTION 2.1: CHECK OPENING TIME ALLOWED
# ========================================================================
# Check if opening shift is allowed at current time
# Returns: {"allowed": True/False, "message": "reason"}

@frappe.whitelist()
def check_opening_time_allowed(pos_profile):
    """Check if opening shift is allowed at current time"""
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
            start_str = _format_time_12h(start_time)
            end_str = _format_time_12h(end_time)
            return {
                "allowed": False,
                "message": _("الفتح مسموح من {0} الي {1}").format(start_str, end_str)
            }

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] check_opening_time_allowed: {str(e)}")
        return {"allowed": False, "message": f"Error: {str(e)}"}


# ========================================================================
# SECTION 2.2: CREATE OPENING VOUCHER
# ========================================================================
# POST - Create new POS Opening Shift

@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
    """Create new POS Opening Shift document"""
    try:
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


# ========================================================================
# SECTION 2.3: GET CURRENT SHIFT NAME
# ========================================================================
# GET - Get current open shift for logged-in user

@frappe.whitelist()
def get_current_shift_name():
    """Get current open shift for logged-in user with POS Profile data"""
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
                        "posa_use_customer_credit",
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


# ========================================================================
# SECTION 2.4: GET ALL OPEN SHIFTS
# ========================================================================
# GET - Get all open shifts for the current user (or specified user)

@frappe.whitelist()
def get_all_open_shifts(user=None):
    """Get all open shifts for current or specified user"""
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


# ========================================================================
# SECTION 2.5: GET PROFILE USERS
# ========================================================================
# GET - Retrieve users registered in POS Profile

@frappe.whitelist()
def get_profile_users(doctype, txt, searchfield, start, page_len, filters):
    """Get users registered in POS Profile for dropdown query"""
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


# ========================================================================
# SECTION 2.6: GET USER SHIFT INVOICE COUNT
# ========================================================================
# GET - Get user shift invoice count

@frappe.whitelist()
def get_user_shift_invoice_count(pos_profile, pos_opening_shift):
    """Get count of submitted invoices for a shift"""
    try:
        count = frappe.db.count("Sales Invoice", {
            "posa_pos_opening_shift": pos_opening_shift,
            "docstatus": 1
        })
        return count

    except Exception as e:
        frappe.log_error(f"[[pos_opening_shift.py]] get_user_shift_invoice_count: {str(e)}")
        return 0


# =============================================================================
# SECTION 3: HELPER FUNCTIONS
# =============================================================================
# Internal helper functions (not @frappe.whitelist())
# Used by document methods and API endpoints

# ========================================================================
# SECTION 3.1: FORMAT TIME TO 12-HOUR
# ========================================================================
# Helper function to convert 24-hour time to 12-hour format with ص/م

def _format_time_12h(time_obj):
    """Convert 24-hour time to 12-hour format with ص/م"""
    hour = time_obj.hour
    minute = time_obj.minute
    
    # Convert to 12-hour format
    if hour == 0:
        hour_12 = 12
        period = "ص"
    elif hour < 12:
        hour_12 = hour
        period = "ص"
    elif hour == 12:
        hour_12 = 12
        period = "م"
    else:
        hour_12 = hour - 12
        period = "م"
    
    return f"{hour_12}:{minute:02d}{period}"


# ========================================================================
# SECTION 3.2: PARSE TIME HELPER
# ========================================================================
# Helper function to parse time value to datetime.time object
# Used by check_opening_time_allowed

def _parse_time_helper(time_value):
    """Parse time from string, datetime, or timedelta to time object"""
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
