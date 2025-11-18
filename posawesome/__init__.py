# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import logging
import frappe
from frappe.utils.logger import get_logger

__version__ = "18.11.2025"

# Backend Logger
backend_logger = get_logger('posawesome_backend', max_size=1_000_000)
backend_logger.setLevel(logging.INFO)

# Frontend Logger
frontend_logger = get_logger('posawesome_frontend', max_size=1_000_000)
frontend_logger.setLevel(logging.INFO)


def console(*data):
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
