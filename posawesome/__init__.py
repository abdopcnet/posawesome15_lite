# -*- coding: utf-8 -*-
"""
POS Awesome - Unified Logger System

This is the SINGLE SOURCE OF TRUTH for all loggers.

Usage:
    Backend (Python):
        from posawesome import info_logger, error_logger
        
        info_logger.info("Message")      # -> posawesome_info.log
        error_logger.error("Error")       # -> posawesome_error.log
    
    Frontend (JavaScript):
        import { posawesome_logger } from "./logger.js"
        
        posawesome_logger.info("File.js", "Message")    # -> posawesome_info.log
        posawesome_logger.error("File.js", "Error")     # -> posawesome_error.log
"""
from __future__ import unicode_literals
import logging
import frappe
from frappe.utils.logger import get_logger

__version__ = "18.11.2025"

# =============================================================================
# UNIFIED LOGGERS - Single Source of Truth
# =============================================================================

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
    """Send data to console via realtime"""
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
