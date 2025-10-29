# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt
from datetime import datetime, time as dtime, timedelta


class POSClosingShift(Document):
    def validate(self):
        # Validate shift closing allowed time window based on POS Profile settings
        self._validate_shift_closing_window()

        user = frappe.get_all(
            "POS Closing Shift",
            filters={
                "user": self.user,
                "docstatus": 1,
                "pos_opening_shift": self.pos_opening_shift,
                "name": ["!=", self.name],
            },
        )

        if user:
            frappe.throw(
                _(
                    "POS Closing Shift {} against {} between selected period".format(
                        frappe.bold("already exists"), frappe.bold(self.user)
                    )
                ),
                title=_("Invalid Period"),
            )

        if frappe.db.get_value("POS Opening Shift", self.pos_opening_shift, "status") != "Open":
            frappe.throw(
                _("Selected POS Opening Shift should be open."),
                title=_("Invalid Opening Entry"),
            )
        self.update_payment_reconciliation()

    def _parse_time(self, value):
        """Parse a value to datetime.time supporting str and time inputs."""
        if not value:
            return None
        if isinstance(value, dtime):
            return value
        # Support formats with microseconds
        for fmt in ("%H:%M:%S.%f", "%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(str(value), fmt).time()
            except Exception:
                continue
        return None

    def _validate_shift_closing_window(self):
        """Validate if period_end_date is within allowed closing window for POS Profile."""
        if not self.pos_profile or not self.period_end_date:
            return

        profile = frappe.get_doc("POS Profile", self.pos_profile)

        # Check if closing time control is enabled
        if not profile.get("posa_closing_time_control"):
            return  # Skip validation if time control is not enabled

        shift_opening_time = profile.get("posa_closing_time_start")
        shift_closing_time = profile.get("posa_closing_time_end")

        if not shift_opening_time or not shift_closing_time:
            return  # No restriction if not configured

        # Parse times
        start_time = self._parse_time(shift_opening_time)
        end_time = self._parse_time(shift_closing_time)

        if not start_time or not end_time:
            return

        # Get period_end_date as datetime
        period_end_dt = frappe.utils.get_datetime(self.period_end_date)

        # Create datetime objects for comparison
        start_dt = period_end_dt.replace(hour=start_time.hour, minute=start_time.minute, second=start_time.second, microsecond=start_time.microsecond)
        end_dt = period_end_dt.replace(hour=end_time.hour, minute=end_time.minute, second=end_time.second, microsecond=end_time.microsecond)

        # If start_time > end_time, assume end_time is next day
        if start_time > end_time:
            end_dt = end_dt + timedelta(days=1)

        # Check if period_end_dt is within [start_dt, end_dt]
        allowed = start_dt <= period_end_dt <= end_dt

        if not allowed:
            start_str = start_time.strftime("%H:%M")
            end_str = end_time.strftime("%H:%M")
            if start_time > end_time:
                end_str += " (next day)"
            frappe.throw(
                _("Closing shift is not allowed at this time. Closing is allowed only between {0} and {1}").format(start_str, end_str),
                title=_("Closing Time Not Allowed")
            )

    def update_payment_reconciliation(self):
        # update the difference values in Payment Reconciliation child table
        # get default precision for site
        precision = frappe.get_cached_value("System Settings", None, "currency_precision") or 3
        for d in self.payment_reconciliation:
            d.difference = +flt(d.closing_amount, precision) - flt(d.expected_amount, precision)

    def on_submit(self):
        opening_entry = frappe.get_doc("POS Opening Shift", self.pos_opening_shift)
        opening_entry.pos_closing_shift = self.name
        opening_entry.set_status()
        self.delete_draft_invoices()
        opening_entry.save()

    def on_cancel(self):
        if frappe.db.exists("POS Opening Shift", self.pos_opening_shift):
            opening_entry = frappe.get_doc("POS Opening Shift", self.pos_opening_shift)
            if opening_entry.pos_closing_shift == self.name:
                opening_entry.pos_closing_shift = ""
                opening_entry.set_status()
            opening_entry.save()

    @frappe.whitelist()
    def get_payment_reconciliation_details(self):
            currency = frappe.get_cached_value("Company", self.company, "default_currency")
            return frappe.render_template(
                "posawesome/posawesome/doctype/pos_closing_shift/closing_shift_details.html",
                {"data": self, "currency": currency},
            )

    def delete_draft_invoices(self):
        """Delete draft invoices for this shift if auto-delete is enabled in POS Profile."""
        if not frappe.get_value("POS Profile", self.pos_profile, "posa_auto_delete_draft_invoices"):
            return

        # Find draft invoices for this shift
        draft_invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": self.pos_opening_shift,
                "docstatus": 0  # Draft only
            },
            fields=["name"]
        )

        # Delete each draft invoice
        for invoice in draft_invoices:
            try:
                frappe.delete_doc("Sales Invoice", invoice.name, force=1, ignore_permissions=True)
            except Exception as e:
                pass


@frappe.whitelist()
def submit_closing_shift(closing_shift):
    """Submit closing shift - simple wrapper for API calls."""
    import json
    closing_shift = json.loads(closing_shift)

    if closing_shift.get("name"):
        doc = frappe.get_doc("POS Closing Shift", closing_shift.get("name"))
    else:
        doc = frappe.get_doc(closing_shift)
        doc.insert()
        frappe.db.commit()

    doc.submit()  # This calls on_submit() which calls delete_draft_invoices()
    frappe.db.commit()

    return doc


# =============================================================================
# API FUNCTIONS - Consolidated from api/pos_closing_shift.py
# =============================================================================

@frappe.whitelist()
def check_closing_time_allowed(pos_profile):
    """
    Check if closing shift is allowed at current time
    Returns: {"allowed": True/False, "message": "reason"}
    """
    try:
        if not pos_profile:
            return {"allowed": True, "message": "No profile specified"}

        profile = frappe.get_doc("POS Profile", pos_profile)

        # Check if closing time control is enabled
        if not profile.get("posa_closing_time_control"):
            return {"allowed": True, "message": "Time control disabled"}

        closing_start_time = profile.get("posa_closing_time_start")
        closing_end_time = profile.get("posa_closing_time_end")

        if not closing_start_time or not closing_end_time:
            return {"allowed": True, "message": "Time not configured"}

        # Parse times
        start_time = _parse_time_helper(closing_start_time)
        end_time = _parse_time_helper(closing_end_time)

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
            return {"allowed": True, "message": "Closing allowed"}
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
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
    """
    GET - Get cashiers list for POS Profile
    """
    try:
        cashiers_list = frappe.get_all("POS Profile User", filters=filters, fields=["user"])
        result = []
        for cashier in cashiers_list:
            user_email = frappe.get_value("User", cashier.user, "email")
            if user_email:
                # Return list of tuples in format (value, label) where value is user ID and label shows both ID and email
                result.append([cashier.user, f"{cashier.user} ({user_email})"])
        return result

    except Exception as e:
        return []


@frappe.whitelist()
def get_pos_invoices(pos_opening_shift):
    """
    GET - Get POS invoices for opening shift
    """
    try:
        _submit_printed_invoices(pos_opening_shift)
        data = frappe.db.sql(
            """
        select
            name
        from
            `tabSales Invoice`
        where
            docstatus = 1 and posa_pos_opening_shift = %s
        """,
            (pos_opening_shift),
            as_dict=1,
        )

        data = [frappe.get_doc("Sales Invoice", d.name).as_dict() for d in data]

        return data

    except Exception as e:
        return []


@frappe.whitelist()
def get_payments_entries(pos_opening_shift):
    """
    GET - Get payment entries for opening shift
    """
    try:
        return frappe.get_all(
            "Payment Entry",
            filters={
                "docstatus": 1,
                "reference_no": pos_opening_shift,
                "payment_type": "Receive",
            },
            fields=[
                "name",
                "mode_of_payment",
                "paid_amount",
                "reference_no",
                "posting_date",
                "party",
            ],
        )

    except Exception as e:
        return []


@frappe.whitelist()
def get_current_cash_total():
    """
    Get the total amount of cash payments for the current shift
    Uses the same logic as closing shift to calculate cash totals
    """
    try:
        # Get the current open shift
        opening_shift = frappe.get_all(
            "POS Opening Shift",
            filters={"status": "Open"},
            fields=["name", "pos_profile"],
            order_by="period_start_date desc",
            limit=1
        )

        if not opening_shift:
            return {"total": 0}

        pos_opening_shift_name = opening_shift[0].name
        pos_profile = opening_shift[0].pos_profile

        # Get cash mode of payment from POS Profile
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile,
            "posa_cash_mode_of_payment"
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Get all submitted invoices for this shift
        invoices = frappe.db.sql("""
            SELECT name, change_amount
            FROM `tabSales Invoice`
            WHERE docstatus = 1
            AND posa_pos_opening_shift = %s
        """, (pos_opening_shift_name,), as_dict=1)

        total_cash = 0

        # Calculate cash payments for each invoice
        for invoice in invoices:
            # Get payments for this invoice
            payments = frappe.db.sql("""
                SELECT amount, mode_of_payment
                FROM `tabSales Invoice Payment`
                WHERE parent = %s
                AND mode_of_payment = %s
            """, (invoice.name, cash_mode_of_payment), as_dict=1)

            for payment in payments:
                # Subtract change amount from cash payment (same as closing shift logic)
                amount = flt(payment.amount) - flt(invoice.change_amount)
                total_cash += amount

        return {"total": total_cash}

    except Exception as e:
        return {"total": 0, "error": str(e)}


@frappe.whitelist()
def get_current_non_cash_total():
    """
    Get the total amount of non-cash (card, online, etc.) payments for the current shift
    Uses the same logic as closing shift to calculate non-cash totals
    """
    try:
        # Get the current open shift
        opening_shift = frappe.get_all(
            "POS Opening Shift",
            filters={"status": "Open"},
            fields=["name", "pos_profile"],
            order_by="period_start_date desc",
            limit=1
        )

        if not opening_shift:
            return {"total": 0}

        pos_opening_shift_name = opening_shift[0].name
        pos_profile = opening_shift[0].pos_profile

        # Get cash mode of payment from POS Profile
        cash_mode_of_payment = frappe.get_value(
            "POS Profile",
            pos_profile,
            "posa_cash_mode_of_payment"
        )
        if not cash_mode_of_payment:
            cash_mode_of_payment = "Cash"

        # Get all submitted invoices for this shift
        invoices = frappe.db.sql("""
            SELECT name
            FROM `tabSales Invoice`
            WHERE docstatus = 1
            AND posa_pos_opening_shift = %s
        """, (pos_opening_shift_name,), as_dict=1)

        total_non_cash = 0

        # Calculate non-cash payments for each invoice
        for invoice in invoices:
            # Get all non-cash payments for this invoice
            payments = frappe.db.sql("""
                SELECT amount, mode_of_payment
                FROM `tabSales Invoice Payment`
                WHERE parent = %s
                AND mode_of_payment != %s
            """, (invoice.name, cash_mode_of_payment), as_dict=1)

            for payment in payments:
                total_non_cash += flt(payment.amount)

        return {"total": total_non_cash}

    except Exception as e:
        return {"total": 0, "error": str(e)}


@frappe.whitelist()
def make_closing_shift_from_opening(opening_shift):
    """
    POST - Create closing shift from opening shift
    """
    try:
        import json
        opening_shift = json.loads(opening_shift)
        _submit_printed_invoices(opening_shift.get("name"))
        closing_shift = frappe.new_doc("POS Closing Shift")
        closing_shift.pos_opening_shift = opening_shift.get("name")
        closing_shift.period_start_date = opening_shift.get("period_start_date")
        closing_shift.period_end_date = frappe.utils.get_datetime()
        closing_shift.pos_profile = opening_shift.get("pos_profile")
        closing_shift.user = opening_shift.get("user")
        closing_shift.company = opening_shift.get("company")
        closing_shift.grand_total = 0
        closing_shift.net_total = 0
        closing_shift.total_quantity = 0

        invoices = _get_pos_invoices_helper(opening_shift.get("name"))

        pos_transactions = []
        taxes = []
        payments = []
        pos_payments_table = []

        # Check if balance_details exists and is not None
        balance_details = opening_shift.get("balance_details") or []
        for detail in balance_details:
            payments.append(
                frappe._dict(
                    {
                        "mode_of_payment": detail.get("mode_of_payment"),
                        "opening_amount": detail.get("amount") or 0,
                        "expected_amount": detail.get("amount") or 0,
                    }
                )
            )

        for d in invoices:
            pos_transactions.append(
                frappe._dict(
                    {
                        "sales_invoice": d.name,
                        "posting_date": d.posting_date,
                        "grand_total": d.grand_total,
                        "customer": d.customer,
                    }
                )
            )
            closing_shift.grand_total += flt(d.grand_total)
            closing_shift.net_total += flt(d.net_total)
            closing_shift.total_quantity += flt(d.total_qty)

            for t in d.taxes:
                existing_tax = [tx for tx in taxes if tx.account_head == t.account_head and tx.rate == t.rate]
                if existing_tax:
                    existing_tax[0].amount += flt(t.tax_amount)
                else:
                    taxes.append(
                        frappe._dict(
                            {
                                "account_head": t.account_head,
                                "rate": t.rate,
                                "amount": t.tax_amount,
                            }
                        )
                    )

            for p in d.payments:
                existing_pay = [pay for pay in payments if pay.mode_of_payment == p.mode_of_payment]
                if existing_pay:
                    cash_mode_of_payment = frappe.get_value(
                        "POS Profile",
                        opening_shift.get("pos_profile"),
                        "posa_cash_mode_of_payment",
                    )
                    if not cash_mode_of_payment:
                        cash_mode_of_payment = "Cash"
                    if existing_pay[0].mode_of_payment == cash_mode_of_payment:
                        amount = p.amount - d.change_amount
                    else:
                        amount = p.amount
                    existing_pay[0].expected_amount += flt(amount)
                else:
                    payments.append(
                        frappe._dict(
                            {
                                "mode_of_payment": p.mode_of_payment,
                                "opening_amount": 0,
                                "expected_amount": p.amount,
                            }
                        )
                    )

        pos_payments = _get_payments_entries_helper(opening_shift.get("name"))

        for py in pos_payments:
            pos_payments_table.append(
                frappe._dict(
                    {
                        "payment_entry": py.name,
                        "mode_of_payment": py.mode_of_payment,
                        "paid_amount": py.paid_amount,
                        "posting_date": py.posting_date,
                        "customer": py.party,
                    }
                )
            )
            existing_pay = [pay for pay in payments if pay.mode_of_payment == py.mode_of_payment]
            if existing_pay:
                existing_pay[0].expected_amount += flt(py.paid_amount)
            else:
                payments.append(
                    frappe._dict(
                        {
                            "mode_of_payment": py.mode_of_payment,
                            "opening_amount": 0,
                            "expected_amount": py.paid_amount,
                        }
                    )
                )

        closing_shift.set("pos_transactions", pos_transactions)
        closing_shift.set("payment_reconciliation", payments)
        closing_shift.set("taxes", taxes)
        closing_shift.set("pos_payments", pos_payments_table)

        return closing_shift

    except Exception as e:
        frappe.throw(f"Error creating closing shift: {str(e)}")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_time_helper(time_value):
    """Helper function to parse time value to datetime.time object"""
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


def _submit_printed_invoices(pos_opening_shift):
    """Helper function to submit printed invoices"""
    try:
        invoices_list = frappe.get_all(
            "Sales Invoice",
            filters={
                "posa_pos_opening_shift": pos_opening_shift,
                "docstatus": 0,
                "posa_is_printed": 1,
            },
        )
        for invoice in invoices_list:
            invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)
            invoice_doc.submit()
    except Exception as e:
        pass


def _get_pos_invoices_helper(pos_opening_shift):
    """Helper function to get POS invoices"""
    try:
        data = frappe.db.sql(
            """
        select
            name
        from
            `tabSales Invoice`
        where
            docstatus = 1 and posa_pos_opening_shift = %s
        """,
            (pos_opening_shift),
            as_dict=1,
        )

        return [frappe.get_doc("Sales Invoice", d.name).as_dict() for d in data]
    except Exception as e:
        return []


def _get_payments_entries_helper(pos_opening_shift):
    """Helper function to get payment entries"""
    try:
        return frappe.get_all(
            "Payment Entry",
            filters={
                "docstatus": 1,
                "reference_no": pos_opening_shift,
                "payment_type": "Receive",
            },
            fields=[
                "name",
                "mode_of_payment",
                "paid_amount",
                "reference_no",
                "posting_date",
                "party",
            ],
        )
    except Exception as e:
        return []
