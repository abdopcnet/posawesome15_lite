// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

// =============================================================================
// SECTION 1: FORM EVENT HANDLERS
// =============================================================================
// Handles form-level events: onload, field triggers, etc.
// Corresponds to: section_break_1, section_break_2 (Period & Company Info)

frappe.ui.form.on('POS Closing Shift', {
	// ========================================================================
	// SECTION 1.1: FORM LOAD EVENT
	// ========================================================================
	// Handles form initialization, sets up field queries
	// Related to: section_break_1, section_break_2
	onload: function (frm) {
		// Set query for POS Profile field (filter by user)
		frm.set_query('pos_profile', function (doc) {
			return {
				filters: { user: doc.user },
			};
		});

		// Set query for User/Cashier field (get from POS Profile)
		frm.set_query('user', function (doc) {
			return {
				query: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_cashiers',
				filters: { parent: doc.pos_profile },
			};
		});

		// Set query for POS Opening Shift (only open shifts)
		frm.set_query('pos_opening_shift', function (doc) {
			return { filters: { status: 'Open', docstatus: 1 } };
		});

		// Auto-set period_end_date for new documents
		if (frm.doc.docstatus === 0)
			frm.set_value('period_end_date', frappe.datetime.now_datetime());

		// Calculate totals from pos_transactions on form load (only for draft documents)
		// Don't recalculate for submitted documents to avoid precision issues
		if (
			frm.doc.docstatus === 0 &&
			frm.doc.pos_transactions &&
			frm.doc.pos_transactions.length > 0
		) {
			calculate_totals_from_transactions(frm);
		}
	},

	// ========================================================================
	// SECTION 1.2: POS OPENING SHIFT TRIGGER
	// ========================================================================
	// Triggered when pos_opening_shift field changes
	// Fetches opening amounts and invoices for the selected shift
	// Related to: section_break_1 (period_start_date, period_end_date, pos_opening_shift)
	pos_opening_shift(frm) {
		if (frm.doc.pos_opening_shift && frm.doc.user) {
			reset_values(frm);
			frappe.run_serially([
				() => frm.trigger('set_opening_amounts'),
				() => frm.trigger('get_pos_invoices'),
			]);
		}
	},

	// ========================================================================
	// SECTION 1.3: SET OPENING AMOUNTS
	// ========================================================================
	// Populates payment_reconciliation with opening amounts from POS Opening Shift
	// Initializes expected_amount = opening_amount (will be updated by add_to_payments)
	// Related to: section_break_4 (payment_reconciliation)
	set_opening_amounts(frm) {
		frappe.db
			.get_doc('POS Opening Shift', frm.doc.pos_opening_shift)
			.then(({ balance_details }) => {
				balance_details.forEach((detail) => {
					const opening_amount = flt(detail.amount || 0);
					// In old version, set_opening_amounts sets expected_amount = opening_amount initially
					// Then add_to_payments adds to it, so final = opening_amount + total_from_invoices
					// To match old behavior exactly, we set expected_amount = opening_amount
					frm.add_child('payment_reconciliation', {
						mode_of_payment: detail.mode_of_payment,
						opening_amount: opening_amount,
						expected_amount: opening_amount, // Will be updated by add_to_payments
						closing_amount: 0, // User needs to fill manually
						difference: 0, // Initially no difference
					});
				});
				console.log(
					`[pos_closing_shift.js] set_opening_amounts: Added ${balance_details.length} payment methods. ` +
						`expected_amount initialized to opening_amount (will be updated by add_to_payments)`,
				);
			});
	},

	// ========================================================================
	// SECTION 1.4: GET POS INVOICES
	// ========================================================================
	// Fetches all Sales Invoices for the selected opening shift
	// Populates pos_transactions and updates payment_reconciliation
	// Related to: section_break_3 (pos_transactions), section_break_4 (payment_reconciliation)
	get_pos_invoices(frm) {
		// Simple logic: always fetch and calculate (like old version)
		frappe.call({
			method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_invoices',
			args: {
				pos_opening_shift: frm.doc.pos_opening_shift,
			},
			callback: async (r) => {
				if (r.exc) {
					console.error(`[pos_closing_shift.js] Error fetching invoices:`, r.exc);
					return;
				}
				const pos_docs = r.message;
				await set_form_data(pos_docs, frm);
				refresh_fields(frm);
			},
		});
	},
});

// =============================================================================
// SECTION 2: CHILD TABLE EVENT HANDLERS
// =============================================================================
// Handles events for POS Closing Shift Detail (payment_reconciliation child table)
// Related to: section_break_4 (payment_reconciliation)

frappe.ui.form.on('POS Closing Shift Detail', {
	// ========================================================================
	// SECTION 2.1: CLOSING AMOUNT CHANGE
	// ========================================================================
	// Recalculates difference when user enters closing_amount
	// difference = closing_amount - expected_amount
	closing_amount: (frm, cdt, cdn) => {
		const row = locals[cdt][cdn];
		frappe.model.set_value(
			cdt,
			cdn,
			'difference',
			flt(row.expected_amount - row.closing_amount),
		);
	},
});

// =============================================================================
// SECTION 2.2: CHILD TABLE EVENT HANDLERS - POS TRANSACTIONS
// =============================================================================
// Handles events for Sales Invoice Reference (pos_transactions child table)
// Recalculates totals when transactions are added, removed, or updated
// Related to: section_break_3 (pos_transactions), section_break_5 (totals)

frappe.ui.form.on('Sales Invoice Reference', {
	// Recalculate totals when row is added, removed, or updated (only for draft documents)
	// Don't recalculate for submitted documents to avoid precision issues
	pos_transactions_add: (frm) => {
		if (frm.doc.docstatus === 0) {
			calculate_totals_from_transactions(frm);
		}
	},
	pos_transactions_remove: (frm) => {
		if (frm.doc.docstatus === 0) {
			calculate_totals_from_transactions(frm);
		}
	},
});

// Add event listener to pos_transactions grid for refresh events
frappe.ui.form.on('POS Closing Shift', {
	refresh: (frm) => {
		// Recalculate totals when form is refreshed (only for draft documents)
		// Don't recalculate for submitted documents to avoid precision issues
		if (
			frm.doc.docstatus === 0 &&
			frm.doc.pos_transactions &&
			frm.doc.pos_transactions.length > 0
		) {
			calculate_totals_from_transactions(frm);
		}
	},
});

// =============================================================================
// SECTION 3: DATA PROCESSING FUNCTIONS
// =============================================================================
// Core functions for processing invoice data and populating form fields
// Related to: section_break_3 (pos_transactions), section_break_4 (payment_reconciliation), section_break_5 (totals)

// ========================================================================
// SECTION 3.1: SET FORM DATA (MAIN PROCESSOR)
// ========================================================================
// Processes all invoices: adds to pos_transactions and updates payment_reconciliation
// Also updates grand_total, net_total, total_quantity
// Related to: section_break_3, section_break_4, section_break_5
async function set_form_data(data, frm) {
	if (!Array.isArray(data)) {
		return;
	}

	for (const d of data) {
		add_to_pos_transaction(d, frm);
		await add_to_payments(d, frm);
	}

	// Calculate totals from pos_transactions after adding all rows
	calculate_totals_from_transactions(frm);
}

// ========================================================================
// SECTION 3.2: SET FORM DATA (INVOICES ONLY)
// ========================================================================
// Helper function: Add invoices to pos_transactions only (don't recalculate payments)
// Used when payment_reconciliation already exists from backend
// Related to: section_break_3 (pos_transactions), section_break_5 (totals)
function set_form_data_invoices_only(data, frm) {
	console.log(
		`[pos_closing_shift.js] Processing ${data.length} invoices for pos_transactions only (payment_reconciliation already exists)`,
	);

	data.forEach((d) => {
		add_to_pos_transaction(d, frm);
		// Don't call add_to_payments - use existing payment_reconciliation from backend
	});

	// Calculate totals from pos_transactions after adding all rows
	calculate_totals_from_transactions(frm);

	console.log(`[pos_closing_shift.js] Final totals calculated from pos_transactions`);
	console.log(
		`[pos_closing_shift.js] Payment reconciliation preserved from backend:`,
		frm.doc.payment_reconciliation.map((p) => ({
			mode: p.mode_of_payment,
			opening: p.opening_amount,
			expected: p.expected_amount,
		})),
	);
}

// ========================================================================
// SECTION 3.3: ADD TO POS TRANSACTIONS
// ========================================================================
// Adds a single Sales Invoice to pos_transactions child table
// Extracts all invoice data: totals, discounts, payments, taxes, etc.
// Related to: section_break_3 (pos_transactions - Sales Invoice Reference)
function add_to_pos_transaction(d, frm) {
	// Single currency: POS Profile.currency only - no conversion needed
	// Get mode_of_payment from invoice payments (first payment method)
	// Use default "Cash" if no payments found (reqd field must have value)
	let mode_of_payment = 'Cash';
	const invoice_payments = d.payments || [];
	if (invoice_payments.length > 0) {
		const payment_mode = invoice_payments[0].mode_of_payment || '';
		if (payment_mode) {
			mode_of_payment = payment_mode;
		}
	}

	// Calculate taxes total from invoice taxes child table
	let taxes_total = 0;
	const invoice_taxes = d.taxes || [];
	invoice_taxes.forEach((tax) => {
		taxes_total += flt(tax.tax_amount || 0);
	});

	// Ensure mode_of_payment is not empty (reqd field)
	if (!mode_of_payment) {
		mode_of_payment = 'Cash';
	}

	// Calculate actual_paid = paid_amount - change_amount
	const actual_paid = flt(d.paid_amount || 0) - flt(d.change_amount || 0);

	// Get payment_entry data from invoice (if exists)
	const payment_entry = d.payment_entry || '';
	const payment_entry_mode_of_payment = d.payment_entry_mode_of_payment || '';
	const payment_entry_paid_amount = d.payment_entry_paid_amount || 0;

	// Build child table row for pos_transactions (Sales Invoice Reference)
	const child = {
		sales_invoice: d.name,
		posting_date: d.posting_date,
		customer: d.customer,
		mode_of_payment: mode_of_payment,
		grand_total: String(flt(d.grand_total || 0)),
		total: d.total != null ? String(flt(d.total)) : '',
		net_total: d.net_total != null ? String(flt(d.net_total)) : '',
		taxes:
			taxes_total != 0
				? String(taxes_total)
				: d.total_taxes_and_charges != null && d.total_taxes_and_charges != 0
				? String(flt(d.total_taxes_and_charges))
				: '',
		total_qty: d.total_qty != null ? String(flt(d.total_qty)) : '',
		discount_amount: d.discount_amount != null ? String(flt(d.discount_amount)) : '',
		posa_item_discount_total:
			d.posa_item_discount_total != null ? String(flt(d.posa_item_discount_total)) : '',
		paid_amount: d.paid_amount != null ? String(flt(d.paid_amount)) : '',
		change_amount: d.change_amount != null ? String(flt(d.change_amount)) : '',
		actual_paid: String(actual_paid),
		payment_entry: payment_entry,
		payment_entry_mode_of_payment: payment_entry_mode_of_payment,
		payment_entry_paid_amount: payment_entry_paid_amount,
	};
	console.log(
		`[pos_closing_shift.js] Added transaction: ${d.name} discount: ${d.discount_amount} paid: ${d.paid_amount} change: ${d.change_amount}`,
	);
	frm.add_child('pos_transactions', child);
	console.log(`[pos_closing_shift.js] Added transaction: ${d.name} Total: ${d.grand_total}`);
}

// ========================================================================
// SECTION 3.4: ADD TO PAYMENTS
// ========================================================================
// Updates payment_reconciliation with invoice payment amounts
// For cash payments, subtracts change_amount from expected_amount
// Related to: section_break_4 (payment_reconciliation)
async function add_to_payments(d, frm) {
	const payments = Array.isArray(d.payments) ? d.payments : [];
	const cash_mode_of_payment = await get_cash_mode_of_payment(frm);

	payments.forEach((p) => {
		const payment = frm.doc.payment_reconciliation.find(
			(pay) => pay.mode_of_payment === p.mode_of_payment,
		);
		if (payment) {
			// Single currency: amount equals base_amount
			let amount = flt(p.amount || 0);

			if (payment.mode_of_payment === cash_mode_of_payment) {
				// Single currency: change_amount equals base_change_amount
				// Subtract change_amount from cash payments (customer change/refund)
				amount -= flt(d.change_amount || 0);
			}
			payment.expected_amount += flt(amount);
			// Recalculate difference (closing_amount is filled by user)
			payment.difference = flt(payment.closing_amount || 0) - flt(payment.expected_amount);
		} else {
			// Single currency: amount equals base_amount
			let amount = flt(p.amount || 0);
			if (p.mode_of_payment === cash_mode_of_payment) {
				// Single currency: change_amount equals base_change_amount
				amount -= flt(d.change_amount || 0);
			}
			frm.add_child('payment_reconciliation', {
				mode_of_payment: p.mode_of_payment,
				opening_amount: 0,
				expected_amount: amount,
				closing_amount: 0, // User needs to fill manually
				difference: 0,
			});
		}
	});
}

// =============================================================================
// SECTION 4: UTILITY FUNCTIONS
// =============================================================================
// Helper functions for form operations

// ========================================================================
// SECTION 4.1: CALCULATE TOTALS FROM TRANSACTIONS
// ========================================================================
// Calculates all totals from pos_transactions child table
// Updates: grand_total, net_total, total_quantity, total_taxes,
//          total_invoice_additional_discount, total_item_discount,
//          total_invoice_paid, total_payment_entries_paid
// Related to: section_break_3 (pos_transactions), section_break_5 (totals)
function calculate_totals_from_transactions(frm) {
	if (!frm.doc.pos_transactions || !Array.isArray(frm.doc.pos_transactions)) {
		// Reset all totals to 0 if no transactions
		frm.set_value('grand_total', 0);
		frm.set_value('net_total', 0);
		frm.set_value('total_quantity', 0);
		frm.set_value('total_taxes', 0);
		frm.set_value('total_invoice_additional_discount', 0);
		frm.set_value('total_item_discount', 0);
		frm.set_value('total_invoice_paid', 0);
		frm.set_value('total_payment_entries_paid', 0);
		return;
	}

	// Initialize totals
	let grand_total = 0;
	let net_total = 0;
	let total_quantity = 0;
	let total_taxes = 0;
	let total_invoice_additional_discount = 0;
	let total_item_discount = 0;
	let total_invoice_paid = 0;
	let total_payment_entries_paid = 0;

	// Sum all values from pos_transactions
	// Use flt() with precision to avoid floating point precision issues
	frm.doc.pos_transactions.forEach((row) => {
		// All fields in pos_transactions are stored as strings (Data type)
		// Convert to float for calculation with proper precision
		grand_total = flt(grand_total + flt(row.grand_total || 0), 2);
		net_total = flt(net_total + flt(row.net_total || 0), 2);
		total_quantity = flt(total_quantity + flt(row.total_qty || 0), 3);
		total_taxes = flt(total_taxes + flt(row.taxes || 0), 2);
		total_invoice_additional_discount = flt(
			total_invoice_additional_discount + flt(row.discount_amount || 0),
			2,
		);
		total_item_discount = flt(total_item_discount + flt(row.posa_item_discount_total || 0), 2);
		total_invoice_paid = flt(total_invoice_paid + flt(row.paid_amount || 0), 2);
		total_payment_entries_paid = flt(
			total_payment_entries_paid + flt(row.payment_entry_paid_amount || 0),
			2,
		);
	});

	// Update form fields with rounded values to avoid precision issues
	frm.set_value('grand_total', flt(grand_total, 2));
	frm.set_value('net_total', flt(net_total, 2));
	frm.set_value('total_quantity', flt(total_quantity, 3));
	frm.set_value('total_taxes', flt(total_taxes, 2));
	frm.set_value('total_invoice_additional_discount', flt(total_invoice_additional_discount, 2));
	frm.set_value('total_item_discount', flt(total_item_discount, 2));
	frm.set_value('total_invoice_paid', flt(total_invoice_paid, 2));
	frm.set_value('total_payment_entries_paid', flt(total_payment_entries_paid, 2));
}

// ========================================================================
// SECTION 4.2: RESET VALUES
// ========================================================================
// Clears all form data when opening shift changes
// Related to: section_break_3, section_break_4, section_break_5
function reset_values(frm) {
	frm.set_value('pos_transactions', []);
	frm.set_value('payment_reconciliation', []);
	frm.set_value('grand_total', 0);
	frm.set_value('net_total', 0);
	frm.set_value('total_quantity', 0);
	frm.set_value('total_taxes', 0);
	frm.set_value('total_invoice_additional_discount', 0);
	frm.set_value('total_item_discount', 0);
	frm.set_value('total_invoice_paid', 0);
	frm.set_value('total_payment_entries_paid', 0);
}

// ========================================================================
// SECTION 4.3: REFRESH FIELDS
// ========================================================================
// Refreshes form fields after data population
// Related to: section_break_3, section_break_4, section_break_5
function refresh_fields(frm) {
	frm.refresh_field('pos_transactions');
	frm.refresh_field('payment_reconciliation');
	frm.refresh_field('grand_total');
	frm.refresh_field('net_total');
	frm.refresh_field('total_quantity');
	frm.refresh_field('total_taxes');
	frm.refresh_field('total_invoice_additional_discount');
	frm.refresh_field('total_item_discount');
	frm.refresh_field('total_invoice_paid');
	frm.refresh_field('total_payment_entries_paid');
}

// ========================================================================
// SECTION 4.4: AUTO-FILL CLOSING AMOUNTS
// ========================================================================
// Auto-fills closing_amount with expected_amount for all payment reconciliation rows
// This matches the previous behavior where closing_amount was auto-filled
// Related to: section_break_4 (payment_reconciliation)
function auto_fill_closing_amounts(frm) {
	if (!frm.doc.payment_reconciliation || !Array.isArray(frm.doc.payment_reconciliation)) {
		return;
	}

	console.log(
		`[pos_closing_shift.js] Auto-filling closing_amount with expected_amount for ${frm.doc.payment_reconciliation.length} payment methods`,
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
				`[pos_closing_shift.js] Auto-filled closing_amount for ${payment.mode_of_payment}: ${payment.closing_amount}`,
			);
		} else {
			console.log(
				`[pos_closing_shift.js] Keeping existing closing_amount for ${payment.mode_of_payment}: ${payment.closing_amount}`,
			);
		}

		// Update difference when closing_amount changes
		payment.difference = flt(payment.closing_amount) - flt(payment.expected_amount || 0);
	});
}

// ========================================================================
// SECTION 4.5: GET VALUE HELPER
// ========================================================================
// Generic helper to fetch a single field value from a document
const get_value = async (doctype, name, field) => {
	if (!doctype || !name || !field) {
		return undefined;
	}

	try {
		const { message } = await frappe.db.get_value(doctype, name, field);
		return message ? message[field] : undefined;
	} catch (error) {
		console.error('Failed to fetch value:', error);
		return undefined;
	}
};

// ========================================================================
// SECTION 4.6: GET CASH MODE OF PAYMENT
// ========================================================================
// Gets the cash mode of payment from POS Profile (cached for performance)
// Used to identify which payment method is cash (for change_amount calculation)
const get_cash_mode_of_payment = async (frm) => {
	const profile = frm.doc.pos_profile;

	if (!frm.__cashModeCache || frm.__cashModeCache.profile !== profile) {
		const value = await get_value('POS Profile', profile, 'posa_cash_mode_of_payment');
		frm.__cashModeCache = {
			profile,
			value: value || 'Cash',
		};
	}

	return frm.__cashModeCache.value;
};

// =============================================================================
// NOTES:
// =============================================================================
// Single currency: POS Profile.currency only
// Removed get_conversion_rate and get_base_value functions
// All values are in the same currency, no conversion needed
