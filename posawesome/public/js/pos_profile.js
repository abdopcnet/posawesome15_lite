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

	// Update barcode example when any related field changes
	posa_enable_private_barcode: function (frm) {
		update_private_barcode_example(frm);
	},

	posa_private_barcode_lenth: function (frm) {
		update_private_barcode_example(frm);
	},

	posa_private_barcode_prefixes: function (frm) {
		update_private_barcode_example(frm);
	},

	posa_private_item_code_length: function (frm) {
		update_private_barcode_example(frm);
	},

	// Update scale barcode example when any related field changes
	posa_enable_scale_barcode: function (frm) {
		update_scale_barcode_example(frm);
	},

	posa_scale_barcode_lenth: function (frm) {
		update_scale_barcode_example(frm);
	},

	posa_scale_barcode_start: function (frm) {
		update_scale_barcode_example(frm);
	},

	posa_scale_item_code_length: function (frm) {
		update_scale_barcode_example(frm);
	},

	posa_weight_length: function (frm) {
		update_scale_barcode_example(frm);
	},

	refresh: function (frm) {
		update_private_barcode_example(frm);
		update_scale_barcode_example(frm);
	},
});

// Function to generate and display barcode examples
function update_private_barcode_example(frm) {
	if (!frm.doc.posa_enable_private_barcode) {
		if (frm.fields_dict.posa_private_barcode_example) {
			frm.fields_dict.posa_private_barcode_example.$wrapper.html('');
		}
		return;
	}

	if (!frm.fields_dict.posa_private_barcode_example) {
		return;
	}

	const prefixes = frm.doc.posa_private_barcode_prefixes || '';
	const total_length = frm.doc.posa_private_barcode_lenth || 0;
	const item_code_length = frm.doc.posa_private_item_code_length || 0;

	if (!prefixes || !total_length || !item_code_length) {
		frm.fields_dict.posa_private_barcode_example.$wrapper.html(
			'<div style="padding: 10px; color: #999;">Please fill all barcode settings to see examples</div>'
		);
		return;
	}

	// Split prefixes
	const prefix_list = prefixes.split(',').map((p) => p.trim()).filter((p) => p);

	if (prefix_list.length === 0) {
		frm.fields_dict.posa_private_barcode_example.$wrapper.html('');
		return;
	}

	// Generate examples
	let html =
		'<div style="padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">';
	html +=
		'<div style="font-weight: 600; font-size: 13px; margin-bottom: 12px; color: #374151;">Barcode Examples:</div>';

	prefix_list.forEach((prefix) => {
		const prefix_length = prefix.length;
		const remaining_length = total_length - prefix_length - item_code_length;

		if (remaining_length < 0) {
			html += `<div style="margin-bottom: 8px; color: #dc2626; font-size: 12px;">`;
			html += `⚠️ Error: Prefix "${prefix}" + Item Code Length (${item_code_length}) exceeds Total Length (${total_length})`;
			html += `</div>`;
			return;
		}

		// Generate sample item code (padded with zeros)
		const sample_item_code = '12345100'
			.padEnd(item_code_length, '0')
			.substring(0, item_code_length);

		// Generate remaining digits
		const remaining_digits = '0'.repeat(remaining_length);

		// Build complete barcode
		const complete_barcode = prefix + sample_item_code + remaining_digits;

		html += `<div style="margin-bottom: 10px; font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.8;">`;
		html += `<span style="color: #dc2626; font-weight: bold;">${prefix}</span>`;
		html += `<span style="color: #2563eb; font-weight: bold;">${sample_item_code}</span>`;
		html += `<span style="color: #000000;">${remaining_digits}</span>`;
		html += `</div>`;

		// Add breakdown
		html += `<div style="margin-bottom: 12px; font-size: 11px; color: #6b7280; padding-left: 10px;">`;
		html += `Prefix: ${prefix_length} digits | Item Code: ${item_code_length} digits | Remaining: ${remaining_length} digits | Total: ${total_length} digits`;
		html += `</div>`;
	});

	html += '</div>';

	frm.fields_dict.posa_private_barcode_example.$wrapper.html(html);
}

// Function to generate and display scale barcode examples
function update_scale_barcode_example(frm) {
	if (!frm.doc.posa_enable_scale_barcode) {
		if (frm.fields_dict.posa_scale_barcode_example) {
			frm.fields_dict.posa_scale_barcode_example.$wrapper.html('');
		}
		return;
	}

	if (!frm.fields_dict.posa_scale_barcode_example) {
		return;
	}

	const prefix = frm.doc.posa_scale_barcode_start || '';
	const total_length = frm.doc.posa_scale_barcode_lenth || 0;
	const item_code_length = frm.doc.posa_scale_item_code_length || 0;
	const weight_length = frm.doc.posa_weight_length || 0;

	if (!prefix || !total_length || !item_code_length || !weight_length) {
		frm.fields_dict.posa_scale_barcode_example.$wrapper.html(
			'<div style="padding: 10px; color: #999;">Please fill all barcode settings to see examples</div>'
		);
		return;
	}

	const prefix_length = prefix.length;
	const calculated_length = prefix_length + item_code_length + weight_length;

	// Generate examples
	let html =
		'<div style="padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">';
	html +=
		'<div style="font-weight: 600; font-size: 13px; margin-bottom: 12px; color: #374151;">Scale Barcode Examples:</div>';

	if (calculated_length !== total_length) {
		html += `<div style="margin-bottom: 8px; color: #dc2626; font-size: 12px;">`;
		html += `⚠️ Error: Prefix (${prefix_length}) + Item Code (${item_code_length}) + Weight (${weight_length}) = ${calculated_length} does not match Total Length (${total_length})`;
		html += `</div>`;
	} else {
		// Generate sample item code
		const sample_item_code = '12345100'
			.padEnd(item_code_length, '0')
			.substring(0, item_code_length);

		// Generate sample weight (in grams, e.g., 1250 = 1.250 kg)
		const sample_weight = '1250'.padStart(weight_length, '0').substring(0, weight_length);

		// Build complete barcode
		const complete_barcode = prefix + sample_item_code + sample_weight;

		html += `<div style="margin-bottom: 10px; font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.8;">`;
		html += `<span style="color: #dc2626; font-weight: bold;">${prefix}</span>`;
		html += `<span style="color: #2563eb; font-weight: bold;">${sample_item_code}</span>`;
		html += `<span style="color: #16a34a; font-weight: bold;">${sample_weight}</span>`;
		html += `</div>`;

		// Add breakdown
		html += `<div style="margin-bottom: 12px; font-size: 11px; color: #6b7280; padding-left: 10px;">`;
		html += `Prefix: ${prefix_length} digits | Item Code: ${item_code_length} digits | Weight: ${weight_length} digits | Total: ${total_length} digits`;
		html += `</div>`;

		// Add weight explanation
		html += `<div style="margin-top: 10px; padding: 8px; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 11px; color: #92400e;">`;
		html += `<strong>Note:</strong> Weight is stored in grams. Example: ${sample_weight} = ${(
			parseInt(sample_weight) / 1000
		).toFixed(3)} kg`;
		html += `</div>`;
	}

	html += '</div>';

	frm.fields_dict.posa_scale_barcode_example.$wrapper.html(html);
}
