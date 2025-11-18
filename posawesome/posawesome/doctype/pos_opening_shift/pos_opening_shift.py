# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import cint, comma_or, nowdate, getdate
from frappe.model.document import Document
import sys
from datetime import datetime, timedelta
from posawesome import backend_logger


class OverAllowanceError(frappe.ValidationError):
    pass


# Validate if status value is in allowed options list
def validate_status(status, options):
    try:
        if status not in options:
            frappe.throw(
                _("Status must be one of {0}").format(comma_or(options)))
    except Exception as e:
        backend_logger.error(
            f"[[pos_opening_shift.py]] validate_status: {str(e)}")
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
                            backend_logger.error(
                                f"[[pos_opening_shift.py]] set_status: {str(e)}")
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
            backend_logger.error(
                f"[[pos_opening_shift.py]] set_status: {str(e)}")
            raise


# Main POS Opening Shift document class
class POSOpeningShift(StatusUpdater):
    # Run validations before saving
    def validate(self):
        try:
            self.validate_pos_profile_and_cashier()
            self.validate_pos_shift()
            self.set_status()
        except Exception as e:
            backend_logger.error(
                f"[[pos_opening_shift.py]] validate: {str(e)}")
            raise

    # Validate POS Profile, Company, and User
    def validate_pos_profile_and_cashier(self):
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
            backend_logger.error(
                f"[[pos_opening_shift.py]] validate_pos_profile_and_cashier: {str(e)}")
            raise

    # Validate shift-specific rules (prevent duplicate open shifts)
    def validate_pos_shift(self):
        """
        Validate POS Opening Shift specific rules
        """
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
            backend_logger.error(
                f"[[pos_opening_shift.py]] validate_pos_shift: {str(e)}")
            raise

    # Helper: Parse time string to datetime.time object
    def _parse_time(self, time_value):
        """Parse time value to datetime.time object."""
        if not time_value:
            return None

        try:
            if isinstance(time_value, str):
                return datetime.strptime(time_value, "%H:%M:%S").time()
            elif hasattr(time_value, 'hour'):  # datetime.time object
                return time_value
            else:
                return None
        except (ValueError, TypeError):
            return None

    # Update status on document submit
    def on_submit(self):
        try:
            self.set_status(update=True)
        except Exception as e:
            backend_logger.error(
                f"[[pos_opening_shift.py]] on_submit: {str(e)}")
            raise


# =============================================================================
# API FUNCTIONS - Whitelisted endpoints for POS Opening Shift
# =============================================================================

# Check if opening shift is allowed at current time (time-based restrictions)
@frappe.whitelist()
def check_opening_time_allowed(pos_profile):
    """
    Check if opening shift is allowed at current time
    Returns: {"allowed": True/False, "message": "reason"}
    """
    try:
        if not pos_profile:
            return {"allowed": True, "message": "No profile specified"}

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
        backend_logger.error(
            f"[[pos_opening_shift.py]] check_opening_time_allowed: {str(e)}")
        return {"allowed": False, "message": f"Error: {str(e)}"}


# Create new POS Opening Shift (API endpoint)
@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
    """
    POST - Create new POS Opening Shift
    """
    try:
        import json
        balance_details = json.loads(balance_details)

        user = frappe.session.user

        # Prevent duplicate open shifts for same user + company + POS profile
        existing_shift = frappe.db.get_value(
            "POS Opening Shift",
            {
                "user": user,
                "company": company,
                "pos_profile": pos_profile,
                "docstatus": 1,
                "status": "Open"
            },
            "name"
        )

        if existing_shift:
            frappe.throw(_(
                "An open POS Opening Shift already exists for user {0}, company {1}, and POS profile {2}. "
                "Please close shift {3} before opening a new one."
            ).format(
                frappe.bold(user),
                frappe.bold(company),
                frappe.bold(pos_profile),
                frappe.bold(existing_shift)
            ))

        # Create and submit new shift
        new_pos_opening = frappe.get_doc(
            {
                "doctype": "POS Opening Shift",
                "period_start_date": frappe.utils.get_datetime(),
                "posting_date": frappe.utils.getdate(),
                "user": user,
                "pos_profile": pos_profile,
                "company": company,
                "docstatus": 1,
            }
        )
        new_pos_opening.set("balance_details", balance_details)
        new_pos_opening.insert(ignore_permissions=True)

        # Return shift data with profile and company info
        data = {}
        data["pos_opening_shift"] = new_pos_opening.as_dict()
        update_opening_shift_data(data, new_pos_opening.pos_profile)
        return data

    except Exception as e:
        backend_logger.error(
            f"[[pos_opening_shift.py]] create_opening_voucher: {str(e)}")
        frappe.throw(_("Error creating opening voucher"))


# Get current user's open shift info
@frappe.whitelist()
def get_current_shift_name():
    """
    GET - Get current user's open POS Opening Shift with full POS Profile data
    """
    try:
        user = frappe.session.user

        # Find latest open shift for current user
        rows = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "docstatus": 1,
                "status": "Open",
            },
            fields=["name", "company", "period_start_date",
                    "pos_profile", "user"],
            order_by="period_start_date desc",
            limit=1,
        )

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
                # Get main POS Profile fields using frappe.get_all with ignore_permissions
                pos_profile_list = frappe.get_all(
                    "POS Profile",
                    filters={"name": pos_profile_name},
                    fields=[
                        "name",
                        "company",
                        "customer",
                        "currency",
                        "warehouse",
                        "selling_price_list",
                        "posa_print_format",
                        "letter_head",
                        "posa_cash_mode_of_payment",
                        "posa_auto_fetch_offers",
                        "posa_allow_write_off_change",
                        "posa_allow_credit_sale",
                        "posa_allow_return",
                        "posa_use_customer_credit",
                        "posa_use_cashback",
                        "posa_hide_expected_amount",
                        "posa_hide_closing_shift",
                        "posa_default_card_view",
                        "posa_fetch_zero_qty",
                        "posa_hide_zero_price_items",
                    ],
                    limit=1,
                    ignore_permissions=True
                )

                if pos_profile_list and len(pos_profile_list) > 0:
                    pos_profile_data = pos_profile_list[0]

                    # Get item_groups child table using SQL (child tables are not DocTypes)
                    # Note: POS Item Group is the child table for item_groups field in POS Profile
                    try:
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
                        backend_logger.warning(
                            f"[[pos_opening_shift.py]] Could not load item_groups for POS Profile {pos_profile_name}: {str(item_groups_error)}")
                        pos_profile_data["item_groups"] = []

                    # Get payments child table (POS Payment Method)
                    try:
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
                        backend_logger.warning(
                            f"[[pos_opening_shift.py]] Could not load payments for POS Profile {pos_profile_name}: {str(payments_error)}")
                        pos_profile_data["payments"] = []
                else:
                    pos_profile_data = None
                    backend_logger.error(
                        f"[[pos_opening_shift.py]] get_current_shift_name: POS Profile {pos_profile_name} not found")

                row["pos_profile_data"] = pos_profile_data
            except Exception as e:
                backend_logger.error(
                    f"[[pos_opening_shift.py]] get_current_shift_name: Error loading POS Profile {pos_profile_name}: {str(e)}")
                row["pos_profile_data"] = None

        result = {
            "success": True,
            "data": row,
        }
        return result

    except Exception as e:
        backend_logger.error(
            f"[[pos_opening_shift.py]] get_current_shift_name: {str(e)}")
        return {
            "success": False,
            "message": f"Error getting current shift: {str(e)}",
            "data": None,
        }


# Get all open shifts for current user (for multi-shift warnings)
@frappe.whitelist()
def get_all_open_shifts():
    """
    GET - Get all open shifts for current user (for info display)
    """
    try:
        user = frappe.session.user

        # Find all open shifts for this user
        shifts = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "docstatus": 1,
                "status": "Open",
            },
            fields=["name", "company", "period_start_date",
                    "pos_profile", "user"],
            order_by="period_start_date desc",
        )

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
        backend_logger.error(
            f"[[pos_opening_shift.py]] get_all_open_shifts: {str(e)}")
        return {
            "success": False,
            "message": f"Error getting open shifts: {str(e)}",
            "count": 0,
            "shifts": [],
        }


# Get users registered in POS Profile (for user dropdown filter)
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
        backend_logger.error(
            f"[[pos_opening_shift.py]] get_profile_users: {str(e)}")
        frappe.throw(_("Error retrieving profile users"))


# Get invoice count for specific shift
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
        backend_logger.error(
            f"[[pos_opening_shift.py]] get_user_shift_invoice_count: {str(e)}")
        return 0


# Get shift statistics (total sales, invoice count)
@frappe.whitelist()
def get_user_shift_stats(pos_profile, pos_opening_shift):
    """
    GET - Get user shift statistics
    """
    try:
        # Calculate total sales amount for shift
        total_sales = frappe.db.sql("""
            SELECT SUM(grand_total) as total
            FROM `tabSales Invoice`
            WHERE posa_pos_opening_shift = %s
            AND docstatus = 1
        """, (pos_opening_shift,), as_dict=True)

        # Count submitted invoices
        invoice_count = frappe.db.count("Sales Invoice", {
            "posa_pos_opening_shift": pos_opening_shift,
            "docstatus": 1
        })

        total_amount = total_sales[0].total or 0
        result = {
            "total_sales": total_amount,
            "invoice_count": invoice_count,
            "shift_name": pos_opening_shift
        }
        return result

    except Exception as e:
        backend_logger.error(
            f"[[pos_opening_shift.py]] get_user_shift_stats: {str(e)}")
        return {
            "total_sales": 0,
            "invoice_count": 0,
            "shift_name": pos_opening_shift
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Populate data with POS Profile and Company info
def update_opening_shift_data(data, pos_profile):
    """
    Helper function to update opening shift data
    """
    try:
        data["pos_profile"] = frappe.get_doc("POS Profile", pos_profile)
        data["company"] = frappe.get_doc(
            "Company", data["pos_profile"].company)
        allow_negative_stock = frappe.get_value(
            "Stock Settings", None, "allow_negative_stock"
        )
        data["stock_settings"] = {}
        data["stock_settings"].update(
            {"allow_negative_stock": allow_negative_stock})
    except Exception as e:
        backend_logger.error(
            f"[[pos_opening_shift.py]] update_opening_shift_data: {str(e)}")
        pass


# Parse time from various formats (string, datetime.time)
def _parse_time_helper(time_value):
    """Helper function to parse time from various formats"""
    from datetime import datetime, time as dtime
    if not time_value:
        return None
    if isinstance(time_value, dtime):
        return time_value
    for fmt in ("%H:%M:%S.%f", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(str(time_value), fmt).time()
        except Exception:
            continue
    return None
