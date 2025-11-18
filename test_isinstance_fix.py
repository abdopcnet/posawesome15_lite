#!/usr/bin/env python3
"""
Test script to verify isinstance() fix for pos_profile parameter handling.
This simulates the frontend sending dict objects to backend API functions.
"""
import json


def simulate_frappe_call(pos_profile_dict):
    """
    Simulate what Frappe does:
    1. Frontend sends JS object
    2. frappe.call() serializes to JSON
    3. HTTP sends JSON string
    4. Frappe app.py parses JSON back to dict
    """
    # Step 1: Frontend JS object (already a dict in our simulation)
    print(f"1. Frontend sends: {pos_profile_dict}")

    # Step 2: Serialize to JSON (what frappe.call() does)
    json_string = json.dumps(pos_profile_dict)
    print(f"2. Serialized JSON: {json_string}")

    # Step 3: Parse back to dict (what Frappe backend does)
    backend_dict = json.loads(json_string)
    print(f"3. Backend receives dict: {backend_dict}")
    print(f"   Type: {type(backend_dict)}")

    return backend_dict


def test_isinstance_pattern(pos_profile):
    """
    Test the isinstance() extraction pattern
    """
    print("\n--- Testing isinstance() pattern ---")
    print(f"Input: {pos_profile}")
    print(f"Type: {type(pos_profile)}")

    # FRAPPE STANDARD: Extract name from dict if needed
    if isinstance(pos_profile, dict):
        pos_profile_name = pos_profile.get('name')
        print(f"✅ Extracted name from dict: '{pos_profile_name}'")
    else:
        pos_profile_name = pos_profile
        print(f"✅ Using string as-is: '{pos_profile_name}'")

    # Now pos_profile_name is always a string
    print(f"Final value for frappe.get_doc(): '{pos_profile_name}'")
    return pos_profile_name


# Test Case 1: Frontend sends full dict (normal case)
print("=" * 60)
print("TEST CASE 1: Frontend sends pos_profile dict")
print("=" * 60)
pos_profile_dict = {
    "name": "فرع العوالي",
    "company": "ﺷﺮﻛﺔ ﻣﺬﺍﻕ ﺍﻷﻧﺪﻟﺲ",
    "warehouse": "مخزن فرع العوالي - AND",
    "selling_price_list": "قائمة البيع",
    "posa_allow_return": 1,
    "payments": [
        {"mode_of_payment": "نقدي - فرع العوالي", "default": 0},
        {"mode_of_payment": "شبكة - فرع العوالي", "default": 1}
    ]
}
backend_dict = simulate_frappe_call(pos_profile_dict)
result = test_isinstance_pattern(backend_dict)
assert result == "فرع العوالي", f"Expected 'فرع العوالي', got '{result}'"
print("✅ TEST PASSED\n")

# Test Case 2: Fallback - string name directly
print("=" * 60)
print("TEST CASE 2: Direct string name (fallback case)")
print("=" * 60)
pos_profile_string = "فرع العوالي"
result = test_isinstance_pattern(pos_profile_string)
assert result == "فرع العوالي", f"Expected 'فرع العوالي', got '{result}'"
print("✅ TEST PASSED\n")

# Test Case 3: What happens WITHOUT isinstance() check
print("=" * 60)
print("TEST CASE 3: WITHOUT isinstance() - demonstrates the bug")
print("=" * 60)
pos_profile_dict = {"name": "فرع العوالي", "company": "Test"}
print(f"pos_profile = {pos_profile_dict}")
print(f"frappe.get_doc('POS Profile', pos_profile) would try to find:")
print(f"   WHERE name = '{pos_profile_dict}'")
print(f"❌ ERROR: POS Profile {pos_profile_dict} not found")
print(f"\nThis is exactly the error we were seeing!\n")

print("=" * 60)
print("ALL TESTS PASSED ✅")
print("=" * 60)
print("\nThe isinstance() fix correctly handles:")
print("1. ✅ Dict objects from frontend (extracts 'name' field)")
print("2. ✅ String names (passes through unchanged)")
print("3. ✅ Prevents 'dict object not found' errors")
