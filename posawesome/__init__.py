# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import logging
import frappe
from frappe.utils.logger import get_logger

__version__ = "18.11.2025"

# Info Logger - logs to posawesome_info.log
info_logger = get_logger('posawesome_info', max_size=1_000_000)
info_logger.setLevel(logging.INFO)

# Error Logger - logs to posawesome_error.log
error_logger = get_logger('posawesome_error', max_size=1_000_000)
error_logger.setLevel(logging.ERROR)

# Backward compatibility aliases (deprecated - use info_logger/error_logger directly)
backend_logger = info_logger
frontend_logger = info_logger


def console(*data):
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
