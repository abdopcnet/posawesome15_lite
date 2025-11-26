#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to close all open POS Opening Shifts for a specific user

Usage:
    bench --site [site-name] console
    exec(open('close_open_shifts.py').read())
    close_all_open_shifts('sharaaadmin1@andalus.cloud')
"""

import frappe


def close_all_open_shifts(user_email=None):
    """
    Close all open POS Opening Shifts for a specific user
    
    Args:
        user_email: Email of the user. If None, uses current session user.
    """
    if not user_email:
        user_email = frappe.session.user
    
    if not user_email:
        frappe.throw("User email is required")
    
    # Get all open shifts for the user
    open_shifts = frappe.get_all(
        "POS Opening Shift",
        filters={
            "user": user_email,
            "status": "Open",
            "docstatus": 1  # Only submitted shifts
        },
        fields=["name", "pos_profile", "company", "period_start_date"]
    )
    
    if not open_shifts:
        print(f"✅ No open shifts found for user: {user_email}")
        return
    
    print(f"📋 Found {len(open_shifts)} open shift(s) for user: {user_email}\n")
    
    closed_count = 0
    failed_shifts = []
    
    for shift in open_shifts:
        shift_name = shift.name
        print(f"🔄 Processing shift: {shift_name} ({shift.pos_profile})")
        
        try:
            # Check if closing shift already exists
            existing_closing = frappe.db.exists(
                "POS Closing Shift",
                {
                    "pos_opening_shift": shift_name,
                    "docstatus": ["<", 2]  # Draft or Submitted
                }
            )
            
            if existing_closing:
                print(f"   ⚠️  Closing shift already exists: {existing_closing}")
                # Just update the opening shift to link it
                opening_shift = frappe.get_doc("POS Opening Shift", shift_name)
                opening_shift.pos_closing_shift = existing_closing
                opening_shift.save()
                opening_shift.set_status()
                opening_shift.save()
                print(f"   ✅ Shift {shift_name} closed via existing closing shift")
                closed_count += 1
                continue
            
            # Create a closing shift document
            closing_shift = frappe.new_doc("POS Closing Shift")
            closing_shift.pos_opening_shift = shift_name
            closing_shift.user = user_email
            closing_shift.company = shift.company
            closing_shift.period_end_date = frappe.utils.now()
            
            # Set minimal balance details (required field)
            # Get opening balance details from opening shift
            opening_shift = frappe.get_doc("POS Opening Shift", shift_name)
            
            if hasattr(opening_shift, 'balance_details') and opening_shift.balance_details:
                # Copy opening balance details to closing shift
                for detail in opening_shift.balance_details:
                    closing_shift.append("balance_details", {
                        "mode_of_payment": detail.mode_of_payment,
                        "opening_amount": detail.opening_amount or 0,
                        "expected_amount": detail.opening_amount or 0,
                    })
            
            # Insert and submit the closing shift
            closing_shift.insert(ignore_permissions=True)
            closing_shift.submit()
            
            print(f"   ✅ Shift {shift_name} closed successfully")
            closed_count += 1
            
        except Exception as e:
            error_msg = str(e)
            print(f"   ❌ Failed to close shift {shift_name}: {error_msg}")
            frappe.log_error(f"Failed to close shift {shift_name}: {error_msg}")
            failed_shifts.append({
                "shift": shift_name,
                "error": error_msg
            })
    
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"   ✅ Successfully closed: {closed_count} shift(s)")
    if failed_shifts:
        print(f"   ❌ Failed: {len(failed_shifts)} shift(s)")
        for failed in failed_shifts:
            print(f"      - {failed['shift']}: {failed['error']}")
    print(f"{'='*60}\n")
    
    return {
        "closed": closed_count,
        "failed": len(failed_shifts),
        "failed_shifts": failed_shifts
    }


if __name__ == "__main__":
    # When run directly in console
    close_all_open_shifts('sharaaadmin1@andalus.cloud')

