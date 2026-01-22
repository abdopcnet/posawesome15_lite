# -*- coding: utf-8 -*-
"""
POS Awesome
"""
from __future__ import unicode_literals
import frappe

__version__ = "22.1.2026"


def console(*data):
    """Send data to console via realtime"""
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
