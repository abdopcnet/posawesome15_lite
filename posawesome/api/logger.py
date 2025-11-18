# -*- coding: utf-8 -*-
"""
Frontend Logger API
Receives logs from frontend and writes them to posawesome_info.log and posawesome_error.log
"""
from __future__ import unicode_literals
import frappe
from posawesome import info_logger, error_logger


@frappe.whitelist()
def log_frontend(level, file, message, data=None):
    """
    Log frontend messages to backend log files

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

        # Log based on level
        if level == 'error':
            error_logger.error(log_message)
        elif level == 'warn':
            error_logger.warning(log_message)
        else:
            info_logger.info(log_message)

        return {"success": True}

    except Exception as e:
        frappe.log_error(
            title=f"Frontend Logger Error",
            message=str(e)
        )
        return {"success": False, "error": str(e)}
