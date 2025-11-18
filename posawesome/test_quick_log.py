#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick test for POSAwesome logging
Usage: bench --site erp.andalus-sweets.com execute posawesome.test_quick_log
"""

import frappe
from posawesome import backend_logger, frontend_logger


def test_quick_log():
    """Quick logging test"""
    try:
        backend_logger.info('=== POSAwesome Backend Logger Test ===')
        backend_logger.info('Testing INFO level logging')
        backend_logger.warning('Testing WARNING level logging')
        backend_logger.error('Testing ERROR level logging')

        frontend_logger.info('=== POSAwesome Frontend Logger Test ===')
        frontend_logger.info('Testing frontend INFO level logging')
        frontend_logger.warning('Testing frontend WARNING level logging')
        frontend_logger.error('Testing frontend ERROR level logging')

        print('\n✅ Logging test completed!')
        print('Check logs at:')
        print('  - /home/frappe/frappe-bench/logs/posawesome_backend.log')
        print('  - /home/frappe/frappe-bench/logs/posawesome_frontend.log')

        return {
            'success': True,
            'message': 'Logging test completed successfully'
        }
    except Exception as e:
        print(f'\n❌ Error during logging test: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }
