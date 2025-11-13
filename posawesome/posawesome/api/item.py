# -*- coding: utf-8 -*-
# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_items(pos_profile, price_list=None, item_group="", search_value="", customer=None, include_zero_stock=False):
    """
    Search items by name, code, or barcode.
    Uses LIKE search for flexibility.
    
    Item Group filtering logic:
    - If item_group specified (not "ALL"): Shows items from that specific group
    - If item_group = "ALL" and POS Profile has item_groups configured: Shows items from allowed groups only
    - If item_group = "ALL" and NO item_groups in POS Profile: Shows all items
    
    Stock filtering logic:
    - If POS Profile.posa_fetch_zero_qty = 1: Shows items with zero stock
    - If POS Profile.posa_fetch_zero_qty = 0: Only shows items with stock > 0
    - include_zero_stock: Override for barcode lookups to always allow zero stock items
    
    Price filtering logic:
    - If POS Profile.posa_hide_zero_price_items = 1: Only shows items with price > 0
    - If POS Profile.posa_hide_zero_price_items = 0 or NULL: Shows all items regardless of price
    """
    try:
        if isinstance(pos_profile, str):
            pos_profile = json.loads(pos_profile)

        if not price_list:
            price_list = pos_profile.get("selling_price_list")

        warehouse = pos_profile.get("warehouse", "")
        
        # Check POS Profile setting for fetching zero qty items
        posa_fetch_zero_qty = pos_profile.get("posa_fetch_zero_qty", 0)
        
        # Check POS Profile setting for hiding zero price items
        posa_hide_zero_price_items = pos_profile.get("posa_hide_zero_price_items", 0)

        # Build WHERE conditions
        where_conditions = [
            "`tabItem`.disabled = 0",
            "`tabItem`.is_sales_item = 1",
            "`tabItem`.has_variants = 0"
        ]

        params = {
            "price_list": price_list,
            "warehouse": warehouse
        }

        # Get allowed item groups from POS Profile
        allowed_item_groups = []
        if pos_profile.get("item_groups"):
            # POS Profile has item_groups child table
            for ig in pos_profile.get("item_groups"):
                if ig.get("item_group"):
                    allowed_item_groups.append(ig.get("item_group"))
        
        # Add item_group filter based on selection and allowed groups
        if item_group and item_group.strip() and item_group != "ALL":
            # User selected specific group - filter by it
            where_conditions.append("`tabItem`.item_group LIKE %(item_group)s")
            params["item_group"] = f"%{item_group}%"
        elif allowed_item_groups:
            # item_group = "ALL" but we have allowed groups in POS Profile
            # Show only items from allowed groups
            placeholders = ", ".join([f"%(item_group_{i})s" for i in range(len(allowed_item_groups))])
            where_conditions.append(f"`tabItem`.item_group IN ({placeholders})")
            for i, group in enumerate(allowed_item_groups):
                params[f"item_group_{i}"] = group
        # else: No allowed groups configured - show all items (no filter)

        # Add search filter - enhanced to search by exact barcode match
        if search_value:
            where_conditions.append(
                "(`tabItem`.name LIKE %(search)s OR `tabItem`.item_name LIKE %(search)s OR `tabItem`.name IN (SELECT parent FROM `tabItem Barcode` WHERE barcode = %(exact_search)s) OR `tabItem`.name IN (SELECT parent FROM `tabItem Barcode` WHERE barcode LIKE %(search)s))")
            params["search"] = f"%{search_value}%"
            params["exact_search"] = search_value

        # Filter stock based on POS Profile setting and include_zero_stock parameter
        # If posa_fetch_zero_qty = 1, allow zero stock items
        # If posa_fetch_zero_qty = 0, only show items with stock (unless include_zero_stock is True for barcode scans)
        if not posa_fetch_zero_qty and not include_zero_stock:
            where_conditions.append("COALESCE(`tabBin`.actual_qty, 0) > 0")
        
        # Filter items with zero price based on POS Profile setting
        # If posa_hide_zero_price_items = 1, only show items with price > 0
        if posa_hide_zero_price_items:
            where_conditions.append("`tabItem Price`.price_list_rate IS NOT NULL AND `tabItem Price`.price_list_rate > 0")

        where_clause = " AND ".join(where_conditions)

        # Single optimized query
        items = frappe.db.sql(
            f"""
            SELECT
                `tabItem`.name as item_code,
                `tabItem`.item_name,
                `tabItem`.item_group,
                `tabItem`.brand,
                `tabItem`.stock_uom,
                `tabItem`.image,
                `tabItem Price`.price_list_rate,
                `tabItem Price`.price_list_rate as rate,
                `tabItem Price`.price_list_rate as base_rate,
                `tabItem Price`.currency,
                COALESCE(`tabBin`.actual_qty, 0) as actual_qty
            FROM `tabItem`
            LEFT JOIN `tabItem Price`
                ON `tabItem`.name = `tabItem Price`.item_code
                AND `tabItem Price`.selling = 1
                AND `tabItem Price`.price_list = %(price_list)s
                AND (`tabItem Price`.valid_from IS NULL OR `tabItem Price`.valid_from <= CURDATE())
                AND (`tabItem Price`.valid_upto IS NULL OR `tabItem Price`.valid_upto >= CURDATE())
            LEFT JOIN `tabBin`
                ON `tabItem`.name = `tabBin`.item_code
                AND `tabBin`.warehouse = %(warehouse)s
            WHERE {where_clause}
            ORDER BY `tabItem`.item_name ASC
            LIMIT 50
            """,
            params,
            as_dict=True
        )

        return items

    except Exception as e:
        frappe.log_error(title="api.item.get_items", message={
            "fn": "get_items", "error": str(e)})
        return []


@frappe.whitelist()
def get_items_groups():
    """Get item groups"""
    try:
        return frappe.get_all(
            "Item Group",
            filters={"is_group": 0},
            fields=["name", "parent_item_group"],
            order_by="name"
        )
    except Exception as e:
        frappe.logger().error(f"Error in get_items_groups: {str(e)}")
        return []


@frappe.whitelist()
def get_barcode_item(pos_profile, barcode_value):
    """
    Process barcode and return item.
    Tries each barcode type in order.
    """
    try:
        if isinstance(pos_profile, str):
            pos_profile = json.loads(pos_profile)

        # Try each barcode type
        result = (_check_scale_barcode(pos_profile, barcode_value)
                  or _check_private_barcode(pos_profile, barcode_value)
                  or _check_normal_barcode(pos_profile, barcode_value))

        return result or {}

    except Exception as e:
        frappe.logger().error(f"Error in get_barcode_item: {str(e)}")
        return {}


def _check_scale_barcode(profile, barcode):
    """Check if barcode matches scale format and extract item."""
    if not profile.get("posa_enable_scale_barcode"):
        return None

    prefix = str(profile.get("posa_scale_barcode_start", ""))
    total_len = profile.get("posa_scale_barcode_lenth")
    item_len = profile.get("posa_scale_item_code_length")
    weight_len = profile.get("posa_weight_length")

    if not all([prefix, total_len, item_len, weight_len]):
        return None

    if not barcode.startswith(prefix) or len(barcode) != total_len:
        return None

    # Extract item_code and weight
    prefix_len = len(prefix)
    item_code = barcode[prefix_len:prefix_len + item_len]
    weight_part = barcode[prefix_len +
                          item_len:prefix_len + item_len + weight_len]

    # Get item using get_items with include_zero_stock=True
    items = get_items(profile, profile.get("selling_price_list"),
                      search_value=item_code, include_zero_stock=True)
    if not items:
        return None

    item = items[0]
    try:
        weight_value = flt(weight_part) / 1000  # Convert grams to kg
        item["qty"] = flt(weight_value, 3)
    except:
        item["qty"] = 1

    return item


def _check_private_barcode(profile, barcode):
    """Check if barcode matches private format and extract item."""
    if not profile.get("posa_enable_private_barcode"):
        return None

    prefixes_str = str(profile.get("posa_private_barcode_prefixes", ""))
    total_len = profile.get("posa_private_barcode_lenth")
    item_len = profile.get("posa_private_item_code_length")

    if not all([prefixes_str, total_len, item_len]) or len(barcode) != total_len:
        return None

    # Check prefix match
    prefixes = [p.strip() for p in prefixes_str.split(",")]
    matched_prefix = next((p for p in prefixes if barcode.startswith(p)), None)

    if not matched_prefix:
        return None

    # Extract item_code
    item_code = barcode[len(matched_prefix):len(matched_prefix) + item_len]

    # Get item using get_items with include_zero_stock=True
    items = get_items(profile, profile.get("selling_price_list"),
                      search_value=item_code, include_zero_stock=True)
    if not items:
        return None

    item = items[0]
    item["qty"] = 1
    return item


def _check_normal_barcode(profile, barcode):
    """Check normal barcode in Item Barcode table."""
    # Simply use get_items with the barcode value and include_zero_stock=True
    items = get_items(profile, profile.get("selling_price_list"),
                      search_value=barcode, include_zero_stock=True)

    if not items:
        return None

    item = items[0]
    item["qty"] = 1
    return item


@frappe.whitelist()
def process_batch_selection(item_code, current_item_row_id, existing_items_data, batch_no_data, preferred_batch_no=None):
    """Process batch selection for items"""
    try:
        return {
            "success": True,
            "message": "Batch selection processed",
            "data": {}
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": {}
        }
