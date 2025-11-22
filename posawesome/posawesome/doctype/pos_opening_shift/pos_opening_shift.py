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


# Validate if status value is in allowed options list
def validate_status(status, options):
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
    # Run validations before saving
    def validate(self):
        try:
            self.validate_pos_profile_and_cashier()
            self.validate_pos_shift()
            self.set_status()
        except Exception as e:
            frappe.log_error(f"[[pos_opening_shift.py]] validate: {str(e)}")
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
            frappe.log_error(f"[[pos_opening_shift.py]] validate_pos_profile_and_cashier: {str(e)}")
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
            frappe.log_error(f"[[pos_opening_shift.py]] validate_pos_shift: {str(e)}")
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
            frappe.log_error(f"[[pos_opening_shift.py]] on_submit: {str(e)}")
            raise
