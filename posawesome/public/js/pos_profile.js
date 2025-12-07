frappe.ui.form.on('POS Profile', {
	setup: function (frm) {
		frm.set_query('posa_cash_mode_of_payment', function (doc) {
			return {
				filters: { type: 'Cash' },
			};
		});
	},

	// posa_auto_fetch_offers logic
	posa_auto_fetch_offers: function (frm) {
		if (frm.doc.posa_auto_fetch_offers) {
			// Clear all related fields
			frm.set_value('posa_allow_user_to_edit_additional_discount', 0);
			frm.set_value('posa_invoice_max_discount_allowed', 0);
			frm.set_value('posa_allow_user_to_edit_item_discount', 0);
			frm.set_value('posa_item_max_discount_allowed', 0);
			frm.set_value('posa_display_discount_percentage', 0);
			frm.set_value('posa_display_discount_amount', 0);
		}
	},

	// posa_allow_user_to_edit_additional_discount logic
	posa_allow_user_to_edit_additional_discount: function (frm) {
		if (frm.doc.posa_allow_user_to_edit_additional_discount) {
			// Clear item discount fields and auto_fetch_offers
			frm.set_value('posa_allow_user_to_edit_item_discount', 0);
			frm.set_value('posa_item_max_discount_allowed', 0);
			frm.set_value('posa_display_discount_percentage', 0);
			frm.set_value('posa_display_discount_amount', 0);
			frm.set_value('posa_auto_fetch_offers', 0);
		}
	},

	// posa_allow_user_to_edit_item_discount logic
	posa_allow_user_to_edit_item_discount: function (frm) {
		if (frm.doc.posa_allow_user_to_edit_item_discount) {
			// Clear Invoice_discount fields and auto_fetch_offers
			frm.set_value('posa_allow_user_to_edit_additional_discount', 0);
			frm.set_value('posa_invoice_max_discount_allowed', 0);
			frm.set_value('posa_auto_fetch_offers', 0);
		}
	},

	posa_apply_tax: function (frm) {
		if (!frm.doc.posa_apply_tax) {
			// Remove tax values when checkbox is unchecked
			frm.set_value('posa_tax_type', '');
			frm.set_value('posa_tax_percent', 0);

			frappe.show_alert({
				message: 'Tax values cleared',
				indicator: 'info',
			});
		}
	},

	// posa_allow_partial_payment logic
	posa_allow_partial_payment: function (frm) {
		if (!frm.doc.posa_allow_partial_payment) {
			// When partial payment is disabled, automatically disable credit sale
			frm.set_value('posa_allow_credit_sale', 0);
		}
	},
});
