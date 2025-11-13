// Copyright (c) 2025
// For license information, please see license.txt
/* eslint-disable */

frappe.ui.form.on('Sales Invoice', {
  refresh(frm) {
    if (frm.doc.is_pos && frm.doc.is_return) {
      check_and_set_pos_opening_shift(frm);
    }
  },

  is_return(frm) {
    if (frm.doc.is_pos && frm.doc.is_return) {
      check_and_set_pos_opening_shift(frm);
    }
  },

  return_against(frm) {
    if (frm.doc.is_pos && frm.doc.is_return) {
      check_and_set_pos_opening_shift(frm);
    }
  },

  // ✅ New: React if user manually changes the POS Opening Shift
  posa_pos_opening_shift(frm) {
    if (frm.doc.is_pos && frm.doc.is_return && frm.doc.posa_pos_opening_shift) {
      check_shift_status(frm, frm.doc.posa_pos_opening_shift);
    }
  },
});

function check_and_set_pos_opening_shift(frm) {
  if (!frm.doc.is_pos || !frm.doc.is_return) return;
  if (!frm.doc.return_against) return;

  if (!frm.doc.posa_pos_opening_shift) {
    frappe.call({
      method: 'frappe.client.get_value',
      args: {
        doctype: 'Sales Invoice',
        filters: { name: frm.doc.return_against },
        fieldname: ['posa_pos_opening_shift'],
      },
      callback: function (r) {
        if (!r.exc && r.message && r.message.posa_pos_opening_shift) {
          frm.set_value('posa_pos_opening_shift', r.message.posa_pos_opening_shift);
          frm.refresh_field('posa_pos_opening_shift');
          check_shift_status(frm, r.message.posa_pos_opening_shift);
        }
      },
    });
  } else {
    check_shift_status(frm, frm.doc.posa_pos_opening_shift);
  }
}

function check_shift_status(frm, shift_name) {
  if (!shift_name) return;

  frappe.call({
    method: 'frappe.client.get_value',
    args: {
      doctype: 'POS Opening Shift',
      filters: { name: shift_name },
      fieldname: ['status'],
    },
    callback: function (r) {
      if (!r.exc && r.message) {
        if (r.message.status !== 'Open') {
          frappe.msgprint({
            title: __('تحذير'),
            message: __('يرجي فتح الشفت أولا  حتي يتم خصم الفاتورة من الشفت'),
            indicator: 'red',
          });
        }
      }
    },
  });
}
