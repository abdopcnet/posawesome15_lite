# -*- coding: utf-8 -*-
"""
Database Performance Optimization
Adds indexes for frequently queried fields to improve performance
"""

import frappe
from frappe import _

def add_performance_indexes():
    """
    Add database indexes for performance optimization
    """
    
    # Get database connection
    db = frappe.db
    
    # List of indexes to create
    indexes = [
        {
            'table': 'tabSales Invoice',
            'index_name': 'idx_pos_invoice_profile',
            'columns': ['pos_profile'],
            'description': 'Index for POS Profile queries'
        },
        {
            'table': 'tabSales Invoice',
            'index_name': 'idx_pos_invoice_shift',
            'columns': ['posa_pos_opening_shift'],
            'description': 'Index for POS Opening Shift queries'
        },
        {
            'table': 'tabSales Invoice',
            'index_name': 'idx_pos_invoice_status',
            'columns': ['docstatus', 'is_return'],
            'description': 'Index for invoice status queries'
        },
        {
            'table': 'tabItem',
            'index_name': 'idx_item_barcode',
            'columns': ['barcode'],
            'description': 'Index for barcode lookups'
        },
        {
            'table': 'tabItem',
            'index_name': 'idx_item_group_disabled',
            'columns': ['item_group', 'disabled'],
            'description': 'Index for item group filtering'
        },
        {
            'table': 'tabCustomer',
            'index_name': 'idx_customer_mobile',
            'columns': ['mobile_no'],
            'description': 'Index for customer mobile lookups'
        },
        {
            'table': 'tabCustomer',
            'index_name': 'idx_customer_name',
            'columns': ['customer_name'],
            'description': 'Index for customer name searches'
        },
        {
            'table': 'tabPOS Offer',
            'index_name': 'idx_pos_offer_profile',
            'columns': ['pos_profile', 'disable'],
            'description': 'Index for POS offer queries'
        },
        {
            'table': 'tabPOS Coupon',
            'index_name': 'idx_pos_coupon_code',
            'columns': ['coupon_code'],
            'description': 'Index for coupon code lookups'
        },
        {
            'table': 'tabPOS Opening Shift',
            'index_name': 'idx_pos_opening_user',
            'columns': ['user', 'status'],
            'description': 'Index for user shift queries'
        }
    ]
    
    created_indexes = []
    failed_indexes = []
    
    for index_info in indexes:
        try:
            # Check if index already exists
            existing_indexes = db.sql(f"""
                SHOW INDEX FROM `{index_info['table']}` 
                WHERE Key_name = '{index_info['index_name']}'
            """)
            
            if not existing_indexes:
                # Create the index
                columns_str = ', '.join([f'`{col}`' for col in index_info['columns']])
                db.sql(f"""
                    CREATE INDEX `{index_info['index_name']}` 
                    ON `{index_info['table']}` ({columns_str})
                """)
                
                created_indexes.append({
                    'table': index_info['table'],
                    'index': index_info['index_name'],
                    'description': index_info['description']
                })
                
                frappe.logger().info(f"Created index: {index_info['index_name']} on {index_info['table']}")
            else:
                frappe.logger().info(f"Index already exists: {index_info['index_name']} on {index_info['table']}")
                
        except Exception as e:
            failed_indexes.append({
                'table': index_info['table'],
                'index': index_info['index_name'],
                'error': str(e)
            })
            frappe.logger().error(f"Failed to create index {index_info['index_name']}: {str(e)}")
    
    # Log results
    frappe.logger().info(f"Database optimization completed:")
    frappe.logger().info(f"Created indexes: {len(created_indexes)}")
    frappe.logger().info(f"Failed indexes: {len(failed_indexes)}")
    
    return {
        'created_indexes': created_indexes,
        'failed_indexes': failed_indexes,
        'total_created': len(created_indexes),
        'total_failed': len(failed_indexes)
    }

@frappe.whitelist()
def optimize_database():
    """
    Public method to optimize database performance
    """
    try:
        result = add_performance_indexes()
        return {
            'success': True,
            'message': f"Database optimization completed. Created {result['total_created']} indexes.",
            'details': result
        }
    except Exception as e:
        return {
            'success': False,
            'message': f"Database optimization failed: {str(e)}",
            'error': str(e)
        }

@frappe.whitelist()
def get_database_performance_info():
    """
    Get database performance information
    """
    try:
        db = frappe.db
        
        # Get table sizes
        table_sizes = db.sql("""
            SELECT 
                table_name,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size_MB'
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'tab%'
            ORDER BY (data_length + index_length) DESC
            LIMIT 10
        """, as_dict=True)
        
        # Get index information
        index_info = db.sql("""
            SELECT 
                table_name,
                index_name,
                column_name,
                cardinality
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'tab%'
            ORDER BY table_name, index_name
        """, as_dict=True)
        
        return {
            'success': True,
            'table_sizes': table_sizes,
            'index_info': index_info
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
