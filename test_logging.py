# -*- coding: utf-8 -*-
"""
Test script for POSAwesome logging system
Run from bench console:
    bench --site erp.andalus-sweets.com console
    >>> exec(open('/home/frappe/frappe-bench/apps/posawesome/test_logging.py').read())
"""
import frappe
from posawesome import backend_logger, frontend_logger


def test_backend_logging():
    """Test backend logger"""
    print("\n=== Testing Backend Logger ===")
    backend_logger.info("Test INFO message from test_logging.py")
    backend_logger.warning("Test WARNING message from test_logging.py")
    backend_logger.error("Test ERROR message from test_logging.py")
    print("✓ Backend logging test completed")
    print("Check: /home/frappe/frappe-bench/logs/posawesome_backend.log")


def test_frontend_logging():
    """Test frontend logger"""
    print("\n=== Testing Frontend Logger ===")
    frontend_logger.info("Test INFO message from test_logging.py")
    frontend_logger.warning("Test WARNING message from test_logging.py")
    frontend_logger.error("Test ERROR message from test_logging.py")
    print("✓ Frontend logging test completed")
    print("Check: /home/frappe/frappe-bench/logs/posawesome_frontend.log")


# Run tests
if __name__ == "__main__":
    test_backend_logging()
    test_frontend_logging()
    print("\n✅ All logging tests completed successfully!")
    print("\nTo view logs:")
    print("  tail -f /home/frappe/frappe-bench/logs/posawesome_backend.log")
    print("  tail -f /home/frappe/frappe-bench/logs/posawesome_frontend.log")
