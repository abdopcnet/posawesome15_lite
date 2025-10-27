# -*- coding: utf-8 -*-
# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_items(pos_profile, price_list=None, item_group="", search_value="", customer=None):
    """
    GET - Get items for POS
    Returns items with prices and stock qty in a single optimized query

    Frontend expects (ItemsSelector.vue):
    - item_code, item_name, stock_uom, item_group
    - rate, price_list_rate, base_rate, currency
    - actual_qty (stock quantity from warehouse)

    Frontend calls:
    1. get_items() - line 461 (initial load)
    2. performLiveSearch() - line 702 (live search with 200ms debounce)
    3. _performItemSearch() - line 746 (manual search)
    4. update_items_details() - line 824 (refresh item details)
    5. search_barcode_from_server() - line 898 (barcode search)

    Uses JOIN to avoid N+1 query problem (1 query instead of 51)
    """
    try:
        pos_profile = json.loads(pos_profile)

        if not price_list:
            price_list = pos_profile.get("selling_price_list")

        # Get warehouse from POS Profile
        warehouse = pos_profile.get("warehouse", "")

        # Build WHERE conditions dynamically
        where_conditions = [
            "`tabItem`.disabled = 0",
            "`tabItem`.is_sales_item = 1",
            "`tabItem`.has_variants = 0"
        ]

        # Build parameters dictionary
        params = {
            "price_list": price_list,
            "warehouse": warehouse
        }

        # Add item_group filter if provided (case-insensitive)
        if item_group and item_group.strip():
            where_conditions.append("`tabItem`.item_group LIKE %(item_group)s")
            params["item_group"] = f"%{item_group}%"

        # Add search filter (item_code OR item_name)
        if search_value:
            where_conditions.append("(`tabItem`.name LIKE %(search)s OR `tabItem`.item_name LIKE %(search)s)")
            params["search"] = f"%{search_value}%"

        where_clause = " AND ".join(where_conditions)

        # Single optimized query with JOINs for price and stock
        items = frappe.db.sql(
            f"""
            SELECT
                `tabItem`.name as item_code,
                `tabItem`.item_name,
                `tabItem`.item_group,
                `tabItem`.stock_uom,
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
        return []


@frappe.whitelist()
def get_items_groups():
    """
    GET - Get item groups
    """
    try:
        result = frappe.get_all(
            "Item Group",
            filters={"is_group": 0},
            fields=["name", "parent_item_group"],
            order_by="name"
        )
        return result
    except Exception as e:
        return []


@frappe.whitelist()
def get_barcode_item(pos_profile, barcode_value):
    """
    Main entry point for all barcode scanning.
    Automatically determines barcode type and returns item with price.

    Args:
        pos_profile: JSON string of POS Profile with settings
        barcode_value: Scanned barcode string

    Returns:
        dict: Item details {item_code, item_name, uom, rate, qty, etc.}
              Empty dict {} if item not found
    """
    try:
        # Parse POS Profile
        if isinstance(pos_profile, str):
            pos_profile = json.loads(pos_profile)

        frappe.log_error(f"get_barcode_item: barcode={barcode_value[:20]}, price_list={pos_profile.get('selling_price_list')}", "POS Barcode Debug")

        # Try scale barcode first (highest priority - specific format)
        result = _get_scale_barcode(pos_profile, barcode_value)
        if result:
            frappe.log_error(f"get_barcode_item: scale_barcode SUCCESS item={result.get('item_code')} rate={result.get('rate')} qty={result.get('qty')}", "POS Barcode Debug")
            return result

        # Try private barcode second (medium priority - specific prefixes)
        result = _get_private_barcode(pos_profile, barcode_value)
        if result:
            frappe.log_error(f"get_barcode_item: private_barcode SUCCESS item={result.get('item_code')} rate={result.get('rate')} qty={result.get('qty')}", "POS Barcode Debug")
            return result

        # Try normal barcode last (fallback - search Item Barcode table)
        result = _get_normal_barcode(pos_profile, barcode_value)
        if result:
            frappe.log_error(f"get_barcode_item: normal_barcode SUCCESS item={result.get('item_code')} rate={result.get('rate')} qty={result.get('qty')}", "POS Barcode Debug")
            return result

        # Not found - return empty dict
        frappe.log_error(f"get_barcode_item: NOT FOUND barcode={barcode_value[:20]}", "POS Barcode Debug")
        return {}

    except Exception as e:
        frappe.logger().error(f"Barcode processing error: {str(e)} - Barcode: {barcode_value}")
        return {}


@frappe.whitelist()
def process_batch_selection(item_code, current_item_row_id, existing_items_data, batch_no_data, preferred_batch_no=None):
    """
    Process batch selection for items
    """
    try:
        # Implementation for batch selection processing
        # This is a placeholder - you may need to implement the actual logic
        result = {
            "success": True,
            "message": "Batch selection processed",
            "data": {}
        }
        return result
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": {}
        }


def _get_scale_barcode(profile, barcode):
    """
    Handle scale/weight barcodes.
    Format: PREFIX + ITEM_CODE + WEIGHT
    Example: 44 + 12003 + 10010 = "4412003100100"

    Returns item with calculated weight as qty
    """
    try:
        # Get scale barcode configuration
        enabled = profile.get("posa_enable_scale_barcode")
        if not enabled or enabled != 1:
            return None

        # Get format settings (convert to string if needed)
        prefix = str(profile.get("posa_scale_barcode_start", ""))
        total_length = profile.get("posa_scale_barcode_lenth")
        item_code_length = profile.get("posa_scale_item_code_length")
        weight_length = profile.get("posa_weight_length")

        # Validate configuration
        if not all([prefix, total_length, item_code_length, weight_length]):
            return None

        # Check if barcode matches scale format
        if not barcode.startswith(prefix) or len(barcode) != total_length:
            return None

        # Extract item code and weight
        prefix_len = len(prefix)
        item_code_part = barcode[prefix_len:prefix_len + item_code_length]
        weight_part = barcode[prefix_len + item_code_length:prefix_len + item_code_length + weight_length]

        # Extract scale barcode components

        # Fetch item with price using ORM
        item_data = _fetch_item_with_price(item_code_part, profile.get("selling_price_list"))
        if not item_data:
            return None

        # Calculate weight (convert grams to kg, remove trailing zeros)
        try:
            weight_value = flt(weight_part) / 1000  # Convert to kg
            # Remove trailing zeros: 10010 → 10.01 kg (not 10.010)
            item_data["qty"] = flt(weight_value, 3)
        except:
            item_data["qty"] = 1

        return item_data

    except Exception as e:
        frappe.logger().error(f"Scale barcode error: {str(e)}")
        return None


def _get_private_barcode(profile, barcode):
    """
    Handle private barcodes with custom prefixes.
    Format: PREFIX + ITEM_CODE + CUSTOM_DATA
    Example: 91 + 12003 + 100100 = "9112003100100"

    Supports multiple prefixes: 91, 92, 93, etc.
    Returns item with qty=1
    """
    try:
        # Get private barcode configuration
        enabled = profile.get("posa_enable_private_barcode")
        if not enabled or enabled != 1:
            return None

        # Get format settings
        prefixes_str = str(profile.get("posa_private_barcode_prefixes", ""))
        total_length = profile.get("posa_private_barcode_lenth")
        item_code_length = profile.get("posa_private_item_code_length")

        # Validate configuration
        if not all([prefixes_str, total_length, item_code_length]):
            return None

        # Check barcode length
        if len(barcode) != total_length:
            return None

        # Parse prefixes (comma-separated: "91,92,93")
        prefixes = [p.strip() for p in prefixes_str.split(",")]

        # Check if barcode starts with any valid prefix
        matched_prefix = None
        for prefix in prefixes:
            if barcode.startswith(prefix):
                matched_prefix = prefix
                break

        if not matched_prefix:
            return None

        # Extract item code
        prefix_len = len(matched_prefix)
        item_code_part = barcode[prefix_len:prefix_len + item_code_length]

        # Extract private barcode components

        # Fetch item with price using ORM
        item_data = _fetch_item_with_price(item_code_part, profile.get("selling_price_list"))
        if not item_data:
            return None

        # Private barcodes always have qty=1
        item_data["qty"] = 1

        return item_data

    except Exception as e:
        frappe.logger().error(f"Private barcode error: {str(e)}")
        return None


def _get_normal_barcode(profile, barcode):
    """
    Handle normal barcodes from Item Barcode table.
    Searches for exact barcode match in child table.

    Returns item with qty=1
    """
    try:
        # Search Item Barcode table using ORM
        barcode_entry = frappe.db.get_value(
            "Item Barcode",
            filters={"barcode": barcode},
            fieldname="parent"
        )

        if not barcode_entry:
            return None

        # Process normal barcode

        # Fetch item with price using ORM
        item_data = _fetch_item_with_price(barcode_entry, profile.get("selling_price_list"))
        if not item_data:
            return None

        # Normal barcodes always have qty=1
        item_data["qty"] = 1

        return item_data

    except Exception as e:
        frappe.logger().error(f"Normal barcode error: {str(e)}")
        return None


def _fetch_item_with_price(item_code, price_list):
    """
    Central query for all barcode types.
    Returns only required fields for invoice creation.

    Returns:
        dict: {item_code, item_name, stock_uom, max_discount, price_list_rate}
              or None if not found/invalid
    """
    try:
        # Single optimized query joining Item and Item Price
        result = frappe.db.sql(
            """
            SELECT
                `tabItem`.name as item_code,
                `tabItem`.item_name,
                `tabItem`.stock_uom,
                `tabItem`.max_discount,
                COALESCE(`tabItem Price`.price_list_rate, 0) as price_list_rate
            FROM `tabItem`
            LEFT JOIN `tabItem Price`
                ON `tabItem`.name = `tabItem Price`.item_code
                AND `tabItem Price`.selling = 1
                AND `tabItem Price`.price_list = %(price_list)s
                AND (`tabItem Price`.valid_from IS NULL OR `tabItem Price`.valid_from <= CURDATE())
                AND (`tabItem Price`.valid_upto IS NULL OR `tabItem Price`.valid_upto >= CURDATE())
            WHERE `tabItem`.name = %(item_code)s
                AND `tabItem`.disabled = 0
                AND `tabItem`.is_fixed_asset = 0
            LIMIT 1
            """,
            {
                "item_code": item_code,
                "price_list": price_list
            },
            as_dict=True
        )

        if not result:
            return None

        item = result[0]

        # Return clean response
        result = {
            "item_code": item.get("item_code"),
            "item_name": item.get("item_name"),
            "stock_uom": item.get("stock_uom"),
            "uom": item.get("stock_uom"),  # Default UOM
            "max_discount": item.get("max_discount", 0),
            "price_list_rate": item.get("price_list_rate", 0),
            "rate": item.get("price_list_rate", 0),  # Same as price_list_rate
            "base_rate": item.get("price_list_rate", 0),  # Same as price_list_rate
        }

        frappe.log_error(f"_fetch_item_with_price: item={result.get('item_code')} rate={result.get('rate')}", "POS Barcode Debug")
        return result

    except Exception as e:
        frappe.logger().error(f"Error fetching item: {item_code} - Error: {str(e)}")
        frappe.log_error(f"_fetch_item_with_price: ERROR item={item_code} error={str(e)}", "POS Barcode Debug")
        return None
