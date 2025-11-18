# -*- coding: utf-8 -*-
"""
Frontend Logger API Bridge
Receives logs from frontend JavaScript and writes them using the unified loggers from posawesome.__init__

This is just a bridge - all actual loggers are defined in posawesome/__init__.py
Backend files should use: from posawesome import info_logger, error_logger
Frontend files use: posawesome_logger from logger.js (which calls this API)
"""
from __future__ import unicode_literals
import frappe
from posawesome import info_logger, error_logger


@frappe.whitelist()
def log_frontend(level, file, message, data=None):
    """
    Bridge: Receive frontend logs and write to backend log files
    
    All loggers are defined in posawesome/__init__.py:
    - info_logger -> posawesome_info.log
    - error_logger -> posawesome_error.log

    Args:
        level: Log level (info, warn, error)
        file: Frontend file name
        message: Log message
        data: Additional data (JSON string)
    """
    try:
        log_message = f"[{file}] {message}"

        if data:
            log_message += f" | Data: {data}"

        # Use unified loggers from posawesome.__init__
        if level == 'error':
            error_logger.error(log_message)
        elif level == 'warn':
            error_logger.warning(log_message)
        else:
            info_logger.info(log_message)

        return {"success": True}

    except Exception as e:
        # Fallback to Frappe's error logger if our logger fails
        frappe.log_error(
            title="Frontend Logger Bridge Error",
            message=str(e)
        )
        return {"success": False, "error": str(e)}
