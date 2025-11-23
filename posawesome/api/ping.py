# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe


@frappe.whitelist(allow_guest=True)
def ping():
    """
    Simple ping endpoint for POS Awesome
    Returns: "pong"
    """
    return "pong"

