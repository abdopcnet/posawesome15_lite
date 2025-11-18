// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Closing Shift", {
  onload: function (frm) {
    frm.set_query("pos_profile", function (doc) {
      return {
        filters: { user: doc.user },
      };
    });

    frm.set_query("user", function (doc) {
      return {
        query: "posawesome.api.pos_closing_shift.get_cashiers",
        filters: { parent: doc.pos_profile },
      };
    });

    frm.set_query("pos_opening_shift", function (doc) {
      return { filters: { status: "Open", docstatus: 1 } };
    });

    if (frm.doc.docstatus === 0)
      frm.set_value("period_end_date", frappe.datetime.now_datetime());
    if (frm.doc.docstatus === 1) set_html_data(frm);
  },

  pos_opening_shift(frm) {
    if (frm.doc.pos_opening_shift && frm.doc.user) {
      reset_values(frm);
      frappe.run_serially([
        () => frm.trigger("set_opening_amounts"),
        () => frm.trigger("get_pos_invoices"),
        () => frm.trigger("get_pos_payments"),
      ]);
    }
  },

  set_opening_amounts(frm) {
    frappe.db
      .get_doc("POS Opening Shift", frm.doc.pos_opening_shift)
      .then(({ balance_details }) => {
        balance_details.forEach((detail) => {
          frm.add_child("payment_reconciliation", {
            mode_of_payment: detail.mode_of_payment,
            opening_amount: detail.amount || 0,
            expected_amount: detail.amount || 0,
          });
        });
      });
  },

  get_pos_invoices(frm) {
    console.log(
      `[pos_closing_shift.js] Fetching invoices for opening shift: ${frm.doc.pos_opening_shift}`
    );

    // Helper function to fetch invoices (defined locally to avoid scope issues)
    const fetchInvoices = () => {
      console.log(
        `[pos_closing_shift.js] fetchInvoices called, cash_mode=${frm.cash_mode_of_payment}`
      );
      frappe.call({
        method: "posawesome.api.pos_closing_shift.get_pos_invoices",
        args: {
          pos_opening_shift: frm.doc.pos_opening_shift,
        },
        callback: (r) => {
          if (r.exc) {
            console.error(
              `[pos_closing_shift.js] Error fetching invoices:`,
              r.exc
            );
            return;
          }
          let pos_docs = r.message;
          console.log(
            `[pos_closing_shift.js] Received ${
              pos_docs ? pos_docs.length : 0
            } invoices from API`
          );
          console.log(
            `[pos_closing_shift.js] Processing invoices to calculate payment reconciliation`
          );
          set_form_data(pos_docs, frm);
          refresh_fields(frm);
          set_html_data(frm);
          console.log(
            `[pos_closing_shift.js] Payment reconciliation updated. Final expected amounts:`,
            frm.doc.payment_reconciliation.map((p) => ({
              mode: p.mode_of_payment,
              opening: p.opening_amount,
              expected: p.expected_amount,
            }))
          );
        },
      });
    };

    // First, get cash mode of payment from POS Profile
    // Try multiple methods to ensure we get the correct value
    const getCashMode = () => {
      // Method 1: Try to get from opening shift's POS Profile document
      if (frm.doc.pos_opening_shift) {
        frappe.db
          .get_doc("POS Opening Shift", frm.doc.pos_opening_shift)
          .then((opening_shift) => {
            if (opening_shift && opening_shift.pos_profile) {
              return frappe.db.get_doc(
                "POS Profile",
                opening_shift.pos_profile
              );
            }
            return null;
          })
          .then((pos_profile) => {
            if (pos_profile && pos_profile.posa_cash_mode_of_payment) {
              frm.cash_mode_of_payment = pos_profile.posa_cash_mode_of_payment;
              console.log(
                `[pos_closing_shift.js] Cash mode from POS Profile doc: ${frm.cash_mode_of_payment}`
              );
              fetchInvoices();
              return;
            }
            // Fallback: Use API call
            fallbackGetCashMode();
          })
          .catch((err) => {
            console.warn(
              `[pos_closing_shift.js] Error getting POS Profile doc:`,
              err
            );
            fallbackGetCashMode();
          });
      } else {
        fallbackGetCashMode();
      }
    };

    const fallbackGetCashMode = () => {
      // Method 2: Use API call as fallback
      frappe.call({
        method: "frappe.client.get_value",
        args: {
          doctype: "POS Profile",
          filters: { name: frm.doc.pos_profile },
          fieldname: ["posa_cash_mode_of_payment"],
        },
        callback: (r) => {
          if (r.exc || !r.message) {
            console.error(
              `[pos_closing_shift.js] Error fetching cash mode:`,
              r.exc
            );
            frm.cash_mode_of_payment = "Cash";
            fetchInvoices();
            return;
          }

          // frappe.client.get_value returns {fieldname: value}
          const cash_mode = r.message.posa_cash_mode_of_payment || "Cash";
          frm.cash_mode_of_payment = cash_mode;
          console.log(
            `[pos_closing_shift.js] Cash mode from API: ${cash_mode}`
          );
          fetchInvoices();
        },
      });
    };

    getCashMode();
  },

  get_pos_payments(frm) {
    frappe.call({
      method: "posawesome.api.pos_closing_shift.get_payments_entries",
      args: {
        pos_opening_shift: frm.doc.pos_opening_shift,
      },
      callback: (r) => {
        let pos_payments = r.message;
        set_form_payments_data(pos_payments, frm);
        refresh_fields(frm);
        set_html_data(frm);
      },
    });
  },
});

frappe.ui.form.on("POS Closing Shift Detail", {
  closing_amount: (frm, cdt, cdn) => {
    const row = locals[cdt][cdn];
    frappe.model.set_value(
      cdt,
      cdn,
      "difference",
      flt(row.expected_amount - row.closing_amount)
    );
  },
});

function set_form_data(data, frm) {
  console.log(
    `[pos_closing_shift.js] Processing ${data.length} invoices for closing shift`
  );

  data.forEach((d) => {
    // Use base_* fields for company currency totals (matches Sales Register)
    const grand_total = flt(d.base_grand_total || d.grand_total || 0);
    const net_total = flt(d.base_net_total || d.net_total || 0);
    const total_qty = flt(d.total_qty || 0);

    console.log(
      `[pos_closing_shift.js] Invoice ${d.name}: grand_total=${grand_total}, net_total=${net_total}, qty=${total_qty}`
    );

    add_to_pos_transaction(d, frm);
    frm.doc.grand_total += grand_total;
    frm.doc.net_total += net_total;
    frm.doc.total_quantity += total_qty;
    add_to_payments(d, frm);
    add_to_taxes(d, frm);
  });

  console.log(
    `[pos_closing_shift.js] Final totals: grand_total=${frm.doc.grand_total}, net_total=${frm.doc.net_total}, qty=${frm.doc.total_quantity}`
  );
}

function set_form_payments_data(data, frm) {
  data.forEach((d) => {
    add_to_pos_payments(d, frm);
    add_pos_payment_to_payments(d, frm);
  });
}

function add_to_pos_transaction(d, frm) {
  frm.add_child("pos_transactions", {
    sales_invoice: d.name,
    posting_date: d.posting_date,
    grand_total: d.grand_total,
    customer: d.customer,
  });
}

function add_to_pos_payments(d, frm) {
  frm.add_child("pos_payments", {
    payment_entry: d.name,
    posting_date: d.posting_date,
    paid_amount: d.paid_amount,
    customer: d.party,
    mode_of_payment: d.mode_of_payment,
  });
}

function add_to_payments(d, frm) {
  if (!d.payments || !Array.isArray(d.payments)) {
    console.warn(
      `[pos_closing_shift.js] Invoice ${d.name} has no payments array`
    );
    return;
  }

  // Get cash mode of payment - use cached value from form if available
  let cash_mode_of_payment = frm.cash_mode_of_payment;

  // If not cached, try to get from form's linked POS Profile document
  if (!cash_mode_of_payment && frm.doc.pos_profile) {
    const pos_profile_doc = frappe.model.get_doc(
      "POS Profile",
      frm.doc.pos_profile
    );
    if (pos_profile_doc && pos_profile_doc.posa_cash_mode_of_payment) {
      cash_mode_of_payment = pos_profile_doc.posa_cash_mode_of_payment;
      frm.cash_mode_of_payment = cash_mode_of_payment; // Cache it
    }
  }

  // If still not found, use synchronous API call (fallback)
  if (!cash_mode_of_payment) {
    cash_mode_of_payment = get_value(
      "POS Profile",
      frm.doc.pos_profile,
      "posa_cash_mode_of_payment"
    );
    if (cash_mode_of_payment) {
      frm.cash_mode_of_payment = cash_mode_of_payment; // Cache it
    }
  }

  // Final fallback to default
  if (!cash_mode_of_payment) {
    cash_mode_of_payment = "Cash";
    frm.cash_mode_of_payment = cash_mode_of_payment; // Cache it
  }
  console.log(
    `[pos_closing_shift.js] Processing payments for invoice ${d.name}, cash mode = ${cash_mode_of_payment}`
  );

  // Use base_* fields for company currency (matches Sales Register)
  const change_amount = flt(d.base_change_amount || d.change_amount || 0);
  console.log(
    `[pos_closing_shift.js] Invoice ${d.name}: base_change_amount = ${change_amount}`
  );

  d.payments.forEach((p) => {
    // Use base_amount if available, otherwise amount (matches Sales Register logic)
    let amount = flt(p.base_amount || p.amount || 0);
    const original_amount = amount;

    // For cash payments: subtract change_amount (matches Sales Register logic)
    if (p.mode_of_payment == cash_mode_of_payment) {
      amount = amount - change_amount;
      console.log(
        `[pos_closing_shift.js] Cash payment for invoice ${d.name}: ` +
          `mode=${p.mode_of_payment}, base_amount=${original_amount}, ` +
          `change=${change_amount}, adjusted_amount=${amount}`
      );
    } else {
      console.log(
        `[pos_closing_shift.js] Non-cash payment for invoice ${d.name}: ` +
          `mode=${p.mode_of_payment}, base_amount=${amount}`
      );
    }

    const payment = frm.doc.payment_reconciliation.find(
      (pay) => pay.mode_of_payment === p.mode_of_payment
    );
    if (payment) {
      const old_expected = payment.expected_amount;
      payment.expected_amount += amount;
      console.log(
        `[pos_closing_shift.js] Updated payment ${p.mode_of_payment}: ` +
          `old_expected=${old_expected}, added=${amount}, new_expected=${payment.expected_amount}`
      );
    } else {
      frm.add_child("payment_reconciliation", {
        mode_of_payment: p.mode_of_payment,
        opening_amount: 0,
        expected_amount: amount,
      });
      console.log(
        `[pos_closing_shift.js] Added new payment ${p.mode_of_payment}: expected_amount=${amount}`
      );
    }
  });
}

function add_pos_payment_to_payments(p, frm) {
  const payment = frm.doc.payment_reconciliation.find(
    (pay) => pay.mode_of_payment === p.mode_of_payment
  );
  if (payment) {
    let amount = p.paid_amount;
    payment.expected_amount += flt(amount);
  } else {
    frm.add_child("payment_reconciliation", {
      mode_of_payment: p.mode_of_payment,
      opening_amount: 0,
      expected_amount: p.amount || 0,
    });
  }
}

function add_to_taxes(d, frm) {
  if (!d.taxes || !Array.isArray(d.taxes)) {
    console.warn(`[pos_closing_shift.js] Invoice ${d.name} has no taxes array`);
    return;
  }

  d.taxes.forEach((t) => {
    // Use base_tax_amount for company currency (matches Sales Register)
    const tax_amount = flt(t.base_tax_amount || t.tax_amount || 0);

    const tax = frm.doc.taxes.find(
      (tx) => tx.account_head === t.account_head && tx.rate === t.rate
    );
    if (tax) {
      tax.amount += tax_amount;
      console.log(
        `[pos_closing_shift.js] Updated tax ${t.account_head} (${t.rate}%): added ${tax_amount}, total=${tax.amount}`
      );
    } else {
      frm.add_child("taxes", {
        account_head: t.account_head,
        rate: t.rate,
        amount: tax_amount,
      });
      console.log(
        `[pos_closing_shift.js] Added new tax ${t.account_head} (${t.rate}%): ${tax_amount}`
      );
    }
  });
}

function reset_values(frm) {
  frm.set_value("pos_transactions", []);
  frm.set_value("payment_reconciliation", []);
  frm.set_value("pos_payments", []);
  frm.set_value("taxes", []);
  frm.set_value("grand_total", 0);
  frm.set_value("net_total", 0);
  frm.set_value("total_quantity", 0);
}

function refresh_fields(frm) {
  frm.refresh_field("pos_transactions");
  frm.refresh_field("payment_reconciliation");
  frm.refresh_field("pos_payments");
  frm.refresh_field("taxes");
  frm.refresh_field("grand_total");
  frm.refresh_field("net_total");
  frm.refresh_field("total_quantity");
}

function set_html_data(frm) {
  frappe.call({
    method: "get_payment_reconciliation_details",
    doc: frm.doc,
    callback: (r) => {
      frm.get_field("payment_reconciliation_details").$wrapper.html(r.message);
    },
  });
}

const get_value = (doctype, name, field) => {
  let value;
  frappe.call({
    method: "frappe.client.get_value",
    args: {
      doctype: doctype,
      filters: { name: name },
      fieldname: field,
    },
    async: false,
    callback: function (r) {
      if (!r.exc) {
        value = r.message[field];
      }
    },
  });
  return value;
};
