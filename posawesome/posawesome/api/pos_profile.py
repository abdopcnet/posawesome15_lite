# -*- coding: utf-8 -*-
# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from posawesome import backend_logger


@frappe.whitelist()
def get_default_payment_from_pos_profile(pos_profile, company):
    """
    Get default payment method from POS Profile
    """
    try:
        if not pos_profile:
            return None

        # Get POS Profile document
        pos_profile_doc = frappe.get_doc("POS Profile", pos_profile)

        # Find default payment method
        for payment in pos_profile_doc.payments:
            if payment.default:
                # Get account for this payment method
                account = get_payment_account(payment.mode_of_payment, company)
                result = {
                    "mode_of_payment": payment.mode_of_payment,
                    "account": account.get("account", "")
                }
                return result

        # If no default found, use first payment method
        if pos_profile_doc.payments:
            first_payment = pos_profile_doc.payments[0]
            account = get_payment_account(
                first_payment.mode_of_payment, company)
            result = {
                "mode_of_payment": first_payment.mode_of_payment,
                "account": account.get("account", "")
            }
            return result

        return None

    except Exception as e:
        backend_logger.error(f"[pos_profile.py] get_default_payment_from_pos_profile: {str(e)}")
        return None


@frappe.whitelist()
def get_opening_dialog_data():
    """
    GET - Get opening dialog data
    """
    try:
        data = {}
        data["companies"] = frappe.get_list(
            "Company", limit_page_length=0, order_by="name")

        data["pos_profiles_data"] = frappe.get_list(
            "POS Profile",
            filters={"disabled": 0},
            fields=["name", "company", "currency"],
            limit_page_length=0,
            order_by="name",
        )

        pos_profiles_list = []
        for i in data["pos_profiles_data"]:
            pos_profiles_list.append(i.name)

        payment_method_table = "POS Payment Method"
        data["payments_method"] = frappe.get_list(
            payment_method_table,
            filters={"parent": ["in", pos_profiles_list]},
            fields=["default", "mode_of_payment",
                    "allow_in_returns", "parent"],
            limit_page_length=0,
            order_by="parent, idx",
            ignore_permissions=True,
        )

        # Set currency from pos profile
        for mode in data["payments_method"]:
            mode["currency"] = frappe.get_cached_value(
                "POS Profile", mode["parent"], "currency"
            )

        return data

    except Exception as e:
        backend_logger.error(f"[pos_profile.py] get_opening_dialog_data: {str(e)}")
        return {}


@frappe.whitelist()
def get_profile_users(profile_name):
    """
    GET - Get POS Profile users
    """
    try:
        users = frappe.get_all(
            "POS Profile User",
            filters={"parent": profile_name},
            fields=["user"],
            order_by="idx"
        )

        result = [u.user for u in users]
        return result

    except Exception as e:
        backend_logger.error(f"[pos_profile.py] get_profile_users: {str(e)}")
        return []


@frappe.whitelist()
def get_profile_warehouses(profile_name):
    """
    GET - Get POS Profile warehouses
    """
    try:
        warehouses = frappe.get_all(
            "POS Profile Warehouse",
            filters={"parent": profile_name},
            fields=["warehouse"],
            order_by="idx"
        )

        result = [w.warehouse for w in warehouses]
        return result

    except Exception as e:
        backend_logger.error(f"[pos_profile.py] get_profile_warehouses: {str(e)}")
        return []


def get_payment_account(mode_of_payment, company):
    """
    Get account for mode of payment
    """
    try:
        # Try to get account from Mode of Payment Account table
        account = frappe.db.get_value(
            "Mode of Payment Account",
            {"parent": mode_of_payment, "company": company},
            "default_account"
        )

        if account:
            result = {"account": account}
            return result

        # Try to get account from POS Payment Method
        account = frappe.db.get_value(
            "POS Payment Method",
            {"mode_of_payment": mode_of_payment},
            "account"
        )

        if account:
            result = {"account": account}
            return result

        # Try to get company's default cash account
        cash_account = frappe.db.get_value(
            "Company",
            company,
            "default_cash_account"
        )

        if cash_account:
            result = {"account": cash_account}
            return result

        # Try to get company's default bank account
        bank_account = frappe.db.get_value(
            "Company",
            company,
            "default_bank_account"
        )

        if bank_account:
            result = {"account": bank_account}
            return result

        # Try to get any cash account for the company
        cash_account = frappe.db.get_value(
            "Account",
            {"account_type": "Cash", "company": company, "is_group": 0},
            "name"
        )

        if cash_account:
            result = {"account": cash_account}
            return result

        # Try to get any bank account for the company
        bank_account = frappe.db.get_value(
            "Account",
            {"account_type": "Bank", "company": company, "is_group": 0},
            "name"
        )

        if bank_account:
            result = {"account": bank_account}
            return result

        result = {"account": ""}
        return result

    except Exception as e:
        backend_logger.error(f"[pos_profile.py] get_payment_account: {str(e)}")
        return {"account": ""}
