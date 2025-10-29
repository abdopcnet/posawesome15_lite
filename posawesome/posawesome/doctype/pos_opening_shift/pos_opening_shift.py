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


class OverAllowanceError(frappe.ValidationError):
    pass


def validate_status(status, options):
    try:
        if status not in options:
            frappe.throw(_("Status must be one of {0}").format(comma_or(options)))
    except Exception as e:
        raise


status_map = {
    "POS Opening Shift": [
        ["Draft", None],
        ["Open", "eval:self.docstatus == 1 and not self.pos_closing_shift"],
        ["Closed", "eval:self.docstatus == 1 and self.pos_closing_shift"],
        ["Cancelled", "eval:self.docstatus == 2"],
    ]
}


class StatusUpdater(Document):

    def set_status(self, update=False, status=None, update_modified=True):
        try:
            if self.is_new():
                if self.get('amended_from'):
                    self.status = 'Draft'
                return

            if self.doctype in status_map:
                _status = self.status
                if status and update:
                    self.db_set("status", status)

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
                            raise
                    elif getattr(self, s[1])():
                        self.status = s[0]
                        break

                if self.status != _status and self.status not in ("Cancelled", "Partially Ordered",
                                                                  "Ordered", "Issued", "Transferred"):
                    self.add_comment("Label", _(self.status))

                if update:
                    self.db_set('status', self.status, update_modified=update_modified)
        except Exception as e:
            raise


class POSOpeningShift(StatusUpdater):
    def validate(self):
        try:
            self.validate_pos_profile_and_cashier()
            self.validate_pos_shift()
            self.set_status()
        except Exception as e:
            raise

    def validate_pos_profile_and_cashier(self):
        try:
            if self.company != frappe.db.get_value("POS Profile", self.pos_profile, "company"):
                frappe.throw(_("POS Profile {} does not belongs to company {}".format(self.pos_profile, self.company)))

            if not cint(frappe.db.get_value("User", self.user, "enabled")):
                frappe.throw(_("User {} has been disabled. Please select valid user/cashier".format(self.user)))

            # Verify that the user is registered in POS Profile
            if self.pos_profile and self.user:
                user_exists = frappe.db.exists("POS Profile User", {
                    "parent": self.pos_profile,
                    "user": self.user
                })

                if not user_exists:
                    frappe.throw(_("User {} is not registered in POS Profile {}. Please select a user registered in the profile".format(self.user, self.pos_profile)))
        except Exception as e:
            raise

    def validate_pos_shift(self):
        """
        Validate POS Opening Shift specific rules
        """
        try:
            # Validate company
            if not self.company:
                frappe.throw(_("Company is required"))

            # Validate POS Profile
            if not self.pos_profile:
                frappe.throw(_("POS Profile is required"))

            # Validate user
            if not self.user:
                frappe.throw(_("User is required"))

            # Validate opening balance details
            if not self.balance_details:
                frappe.throw(_("Opening balance details are required"))

            # Flexible validation - allow zero opening balance
            total_opening_amount = 0
            negative_amounts = 0

            for detail in self.balance_details:
                amount = frappe.utils.flt(detail.amount) if detail.amount else 0
                if amount > 0:
                    total_opening_amount += amount
                elif amount < 0:
                    negative_amounts += abs(amount)

            # Allow zero opening balance (for digital stores)
            # But prevent negative amounts
            if negative_amounts > 0:
                frappe.throw(_("Opening cash amount cannot be negative"))

        except Exception as e:
            raise

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

    def on_submit(self):
        try:
            self.set_status(update=True)
        except Exception as e:
            raise


# =============================================================================
# API FUNCTIONS - Consolidated from api/pos_opening_shift.py
# =============================================================================

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

        # Check if opening time control is enabled
        if not profile.get("posa_opening_time_control"):
            return {"allowed": True, "message": "Time control disabled"}

        opening_start_time = profile.get("posa_opening_time_start")
        opening_end_time = profile.get("posa_opening_time_end")

        if not opening_start_time or not opening_end_time:
            return {"allowed": True, "message": "Time not configured"}

        # Parse times using helper function
        start_time = _parse_time_helper(opening_start_time)
        end_time = _parse_time_helper(opening_end_time)

        if not start_time or not end_time:
            return {"allowed": True, "message": "Invalid time format"}

        # Get current datetime
        current_dt = frappe.utils.now_datetime()

        # Create datetime objects for comparison
        start_dt = current_dt.replace(hour=start_time.hour, minute=start_time.minute, second=start_time.second, microsecond=start_time.microsecond)
        end_dt = current_dt.replace(hour=end_time.hour, minute=end_time.minute, second=end_time.second, microsecond=end_time.microsecond)

        # If start_time > end_time, assume end_time is next day
        if start_time > end_time:
            end_dt = end_dt + timedelta(days=1)

        # Check if current time is within [start_dt, end_dt]
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
        return {"allowed": False, "message": f"Error: {str(e)}"}


@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
    """
    POST - Create new POS Opening Shift
    """
    try:
        import json
        balance_details = json.loads(balance_details)

        new_pos_opening = frappe.get_doc(
            {
                "doctype": "POS Opening Shift",
                "period_start_date": frappe.utils.get_datetime(),
                "posting_date": frappe.utils.getdate(),
                "user": frappe.session.user,
                "pos_profile": pos_profile,
                "company": company,
                "docstatus": 1,
            }
        )
        new_pos_opening.set("balance_details", balance_details)
        new_pos_opening.insert(ignore_permissions=True)

        data = {}
        data["pos_opening_shift"] = new_pos_opening.as_dict()
        update_opening_shift_data(data, new_pos_opening.pos_profile)
        return data

    except Exception as e:
        frappe.throw(f"Error creating opening voucher: {str(e)}")


@frappe.whitelist()
def get_current_shift_name():
    """
    GET - Get current user's open POS Opening Shift basic info
    """
    try:
        user = frappe.session.user

        # Find latest open shift for this user
        rows = frappe.get_all(
            "POS Opening Shift",
            filters={
                "user": user,
                "docstatus": 1,
                "status": "Open",
            },
            fields=["name", "company", "period_start_date", "pos_profile", "user"],
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
        # Ensure period_start_date is serializable
        if row.get("period_start_date"):
            row["period_start_date"] = str(row["period_start_date"])

        result = {
            "success": True,
            "data": row,
        }
        return result

    except Exception as e:
        return {
            "success": False,
            "message": f"Error getting current shift: {str(e)}",
            "data": None,
        }


@frappe.whitelist()
def get_profile_users(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Retrieve users registered in POS Profile
    """
    try:
        pos_profile = filters.get("parent")

        # Use frappe.get_all instead of direct SQL
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

        # Convert result to required format
        result = [[user.user] for user in users]

        return result

    except Exception as e:
        frappe.throw(f"Error retrieving profile users: {str(e)}")


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
        return 0


@frappe.whitelist()
def get_user_shift_stats(pos_profile, pos_opening_shift):
    """
    GET - Get user shift statistics
    """
    try:
        # Get total sales amount
        total_sales = frappe.db.sql("""
            SELECT SUM(grand_total) as total
            FROM `tabSales Invoice`
            WHERE posa_pos_opening_shift = %s
            AND docstatus = 1
        """, (pos_opening_shift,), as_dict=True)

        # Get invoice count
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
        return {
            "total_sales": 0,
            "invoice_count": 0,
            "shift_name": pos_opening_shift
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def update_opening_shift_data(data, pos_profile):
    """
    Helper function to update opening shift data
    """
    try:
        data["pos_profile"] = frappe.get_doc("POS Profile", pos_profile)
        data["company"] = frappe.get_doc("Company", data["pos_profile"].company)
        allow_negative_stock = frappe.get_value(
            "Stock Settings", None, "allow_negative_stock"
        )
        data["stock_settings"] = {}
        data["stock_settings"].update({"allow_negative_stock": allow_negative_stock})
    except Exception as e:
        pass


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
