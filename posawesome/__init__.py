# -*- coding: utf-8 -*-
"""
POS Awesome - Global Logger

Backend: from posawesome import posawesome_logger
Frontend: console.log (direct)
"""
from __future__ import unicode_literals
import logging
import frappe
from frappe.utils.logger import get_logger

__version__ = "19.11.2025"

# =============================================================================
# GLOBAL LOGGER - Single Source of Truth
# =============================================================================

# Single logger - logs to posawesome.log
logger = get_logger('posawesome', max_size=1_000_000)
logger.setLevel(logging.DEBUG)

# Global logger alias for easy import
posawesome_logger = logger


def console(*data):
    """Send data to console via realtime"""
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
