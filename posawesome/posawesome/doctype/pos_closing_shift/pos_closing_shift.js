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
          const opening_amount = flt(detail.amount || 0);
          // In old version, set_opening_amounts sets expected_amount = opening_amount initially
          // Then add_to_payments adds to it, so final = opening_amount + total_from_invoices
          // To match old behavior exactly, we set expected_amount = opening_amount
          frm.add_child("payment_reconciliation", {
            mode_of_payment: detail.mode_of_payment,
            opening_amount: opening_amount,
            expected_amount: opening_amount, // Will be updated by add_to_payments
            closing_amount: 0, // User needs to fill manually
            difference: 0, // Initially no difference
          });
        });
        console.log(
          `[pos_closing_shift.js] set_opening_amounts: Added ${balance_details.length} payment methods. ` +
            `expected_amount initialized to opening_amount (will be updated by add_to_payments)`
        );
      });
  },

  get_pos_invoices(frm) {
    // Simple logic: always fetch and calculate (like old version)
    frappe.call({
      method: "posawesome.api.pos_closing_shift.get_pos_invoices",
      args: {
        pos_opening_shift: frm.doc.pos_opening_shift,
      },
      callback: async (r) => {
        if (r.exc) {
          console.error(
            `[pos_closing_shift.js] Error fetching invoices:`,
            r.exc
          );
          return;
        }
        const pos_docs = r.message;
        await set_form_data(pos_docs, frm);
        refresh_fields(frm);
        set_html_data(frm);
      },
    });
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

async function set_form_data(data, frm) {
  if (!Array.isArray(data)) {
    return;
  }

  for (const d of data) {
    add_to_pos_transaction(d, frm);
    // Single currency: POS Profile.currency only - no conversion needed
    frm.doc.grand_total += flt(d.grand_total || 0);
    frm.doc.net_total += flt(d.net_total || 0);
    frm.doc.total_quantity += flt(d.total_qty);
    await add_to_payments(d, frm);
    add_to_taxes(d, frm);
  }
}

// Helper function: Add invoices to pos_transactions only (don't recalculate payments)
function set_form_data_invoices_only(data, frm) {
  console.log(
    `[pos_closing_shift.js] Processing ${data.length} invoices for pos_transactions only (payment_reconciliation already exists)`
  );

  data.forEach((d) => {
    // Single currency: POS Profile.currency only - grand_total equals base_grand_total
    const grand_total = flt(d.grand_total || 0);
    const net_total = flt(d.net_total || 0);
    const total_qty = flt(d.total_qty || 0);

    console.log(
      `[pos_closing_shift.js] Invoice ${d.name}: grand_total=${grand_total}, net_total=${net_total}, qty=${total_qty}`
    );

    add_to_pos_transaction(d, frm);
    frm.doc.grand_total += grand_total;
    frm.doc.net_total += net_total;
    frm.doc.total_quantity += total_qty;
    // Don't call add_to_payments - use existing payment_reconciliation from backend
    add_to_taxes(d, frm);
  });

  console.log(
    `[pos_closing_shift.js] Final totals: grand_total=${frm.doc.grand_total}, net_total=${frm.doc.net_total}, qty=${frm.doc.total_quantity}`
  );
  console.log(
    `[pos_closing_shift.js] Payment reconciliation preserved from backend:`,
    frm.doc.payment_reconciliation.map((p) => ({
      mode: p.mode_of_payment,
      opening: p.opening_amount,
      expected: p.expected_amount,
    }))
  );
}

function set_form_payments_data(data, frm) {
  data.forEach((d) => {
    add_to_pos_payments(d, frm);
    add_pos_payment_to_payments(d, frm);
  });
}

function add_to_pos_transaction(d, frm) {
  // Single currency: POS Profile.currency only - no conversion needed
  const child = {
    posting_date: d.posting_date,
    grand_total: flt(d.grand_total || 0),
    transaction_currency: d.currency,
    transaction_amount: flt(d.grand_total || 0),
    customer: d.customer,
  };
  if (d.doctype === "POS Invoice") {
    child.pos_invoice = d.name;
  } else {
    child.sales_invoice = d.name;
  }
  frm.add_child("pos_transactions", child);
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

async function add_to_payments(d, frm) {
  const payments = Array.isArray(d.payments) ? d.payments : [];
  const cash_mode_of_payment = await get_cash_mode_of_payment(frm);

  payments.forEach((p) => {
    const payment = frm.doc.payment_reconciliation.find(
      (pay) => pay.mode_of_payment === p.mode_of_payment
    );
    if (payment) {
      // Single currency: amount equals base_amount
      let amount = flt(p.amount || 0);

      if (payment.mode_of_payment === cash_mode_of_payment) {
        // Single currency: change_amount equals base_change_amount
        amount -= flt(d.change_amount || 0);
      }
      payment.expected_amount += flt(amount);
      // Recalculate difference (closing_amount is filled by user)
      payment.difference =
        flt(payment.closing_amount || 0) - flt(payment.expected_amount);
    } else {
      // Single currency: amount equals base_amount
      let amount = flt(p.amount || 0);
      if (p.mode_of_payment === cash_mode_of_payment) {
        // Single currency: change_amount equals base_change_amount
        amount -= flt(d.change_amount || 0);
      }
      frm.add_child("payment_reconciliation", {
        mode_of_payment: p.mode_of_payment,
        opening_amount: 0,
        expected_amount: amount,
        closing_amount: 0, // User needs to fill manually
        difference: 0,
      });
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
    // Recalculate difference (closing_amount is filled by user)
    payment.difference =
      flt(payment.closing_amount || 0) - flt(payment.expected_amount);
  } else {
    const expected_amount = flt(p.amount || 0);
    frm.add_child("payment_reconciliation", {
      mode_of_payment: p.mode_of_payment,
      opening_amount: 0,
      expected_amount: expected_amount,
      closing_amount: 0, // User needs to fill manually
      difference: 0, // Initially no difference
    });
  }
}

function add_to_taxes(d, frm) {
  if (!d.taxes || !Array.isArray(d.taxes)) {
    return;
  }

  d.taxes.forEach((t) => {
    const tax = frm.doc.taxes.find(
      (tx) => tx.account_head === t.account_head && tx.rate === t.rate
    );
    if (tax) {
      // Single currency: tax_amount equals base_tax_amount
      tax.amount += flt(t.tax_amount || 0);
    } else {
      frm.add_child("taxes", {
        account_head: t.account_head,
        rate: t.rate,
        // Single currency: tax_amount equals base_tax_amount
        amount: flt(t.tax_amount || 0),
      });
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

/**
 * Auto-fill closing_amount with expected_amount for all payment reconciliation rows
 * This matches the previous behavior where closing_amount was auto-filled
 */
function auto_fill_closing_amounts(frm) {
  if (
    !frm.doc.payment_reconciliation ||
    !Array.isArray(frm.doc.payment_reconciliation)
  ) {
    return;
  }

  console.log(
    `[pos_closing_shift.js] Auto-filling closing_amount with expected_amount for ${frm.doc.payment_reconciliation.length} payment methods`
  );

  frm.doc.payment_reconciliation.forEach((payment) => {
    // Only auto-fill if closing_amount is empty/null/0
    if (
      !payment.closing_amount ||
      payment.closing_amount === 0 ||
      payment.closing_amount === null ||
      payment.closing_amount === undefined
    ) {
      payment.closing_amount = flt(payment.expected_amount || 0);
      console.log(
        `[pos_closing_shift.js] Auto-filled closing_amount for ${payment.mode_of_payment}: ${payment.closing_amount}`
      );
    } else {
      console.log(
        `[pos_closing_shift.js] Keeping existing closing_amount for ${payment.mode_of_payment}: ${payment.closing_amount}`
      );
    }

    // Update difference when closing_amount changes
    payment.difference =
      flt(payment.closing_amount) - flt(payment.expected_amount || 0);
  });
}

const get_value = async (doctype, name, field) => {
  if (!doctype || !name || !field) {
    return undefined;
  }

  try {
    const { message } = await frappe.db.get_value(doctype, name, field);
    return message ? message[field] : undefined;
  } catch (error) {
    console.error("Failed to fetch value:", error);
    return undefined;
  }
};

const get_cash_mode_of_payment = async (frm) => {
  const profile = frm.doc.pos_profile;

  if (!frm.__cashModeCache || frm.__cashModeCache.profile !== profile) {
    const value = await get_value(
      "POS Profile",
      profile,
      "posa_cash_mode_of_payment"
    );
    frm.__cashModeCache = {
      profile,
      value: value || "Cash",
    };
  }

  return frm.__cashModeCache.value;
};

// Single currency: POS Profile.currency only
// Removed get_conversion_rate and get_base_value functions
// All values are in the same currency, no conversion needed
