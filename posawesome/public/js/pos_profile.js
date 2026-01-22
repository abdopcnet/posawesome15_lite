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
	let html = '<div style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">';
	html += '<table style="width: 100%; border-collapse: collapse; font-family: \'Courier New\', monospace;">';
	html += '<thead><tr style="background: #374151; color: white;">';
	html += '<th style="padding: 4px 8px; text-align: left; font-size: 14px; font-weight: 600;">Barcode</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Prefix</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Item Code</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Rest</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Total</th>';
	html += '</tr></thead><tbody>';

	prefix_list.forEach((prefix, index) => {
		const prefix_length = prefix.length;
		const remaining_length = total_length - prefix_length - item_code_length;

		if (remaining_length < 0) {
			html += `<tr style="background: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">`;
			html += `<td colspan="5" style="padding: 4px 8px; color: #dc2626; font-size: 14px;">`;
			html += `⚠️ Error: Prefix "${prefix}" + Item Code (${item_code_length}) exceeds Total (${total_length})`;
			html += `</td></tr>`;
			return;
		}

		// Generate sample item code (padded with zeros)
		const sample_item_code = '12345100'.padEnd(item_code_length, '0').substring(0, item_code_length);
		const remaining_digits = '0'.repeat(remaining_length);
		const complete_barcode = prefix + sample_item_code + remaining_digits;

		html += `<tr style="background: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">`;
		html += `<td style="padding: 2px 8px; font-size: 20px; font-weight: bold;">`;
		html += `<span style="color: #dc2626;">${prefix}</span>`;
		html += `<span style="color: #2563eb;">${sample_item_code}</span>`;
		html += `<span style="color: #000000;">${remaining_digits}</span>`;
		html += `</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${prefix_length}</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${item_code_length}</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${remaining_length}</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${total_length}</td>`;
		html += `</tr>`;
	});

	html += '</tbody></table></div>';

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

	const prefix = String(frm.doc.posa_scale_barcode_start || '');
	const total_length = parseInt(frm.doc.posa_scale_barcode_lenth) || 0;
	const item_code_length = parseInt(frm.doc.posa_scale_item_code_length) || 0;
	const weight_length = parseInt(frm.doc.posa_weight_length) || 0;

	if (!prefix || !total_length || !item_code_length || !weight_length) {
		frm.fields_dict.posa_scale_barcode_example.$wrapper.html(
			'<div style="padding: 10px; color: #999;">Please fill all barcode settings to see examples</div>'
		);
		return;
	}

	const prefix_length = prefix.length;
	const calculated_length = parseInt(prefix_length) + parseInt(item_code_length) + parseInt(weight_length);
	const check_digit = (calculated_length < total_length) ? 1 : 0;

	// Generate examples
	let html = '<div style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">';
	html += '<table style="width: 100%; border-collapse: collapse; font-family: \'Courier New\', monospace;">';
	html += '<thead><tr style="background: #374151; color: white;">';
	html += '<th style="padding: 4px 8px; text-align: left; font-size: 14px; font-weight: 600;">Barcode</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Prefix</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Item Code</th>';
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Weight</th>';
	if (check_digit) {
		html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Check</th>';
	}
	html += '<th style="padding: 4px 8px; text-align: center; font-size: 14px; font-weight: 600;">Total</th>';
	html += '</tr></thead><tbody>';

	if (calculated_length + check_digit !== total_length) {
		html += `<tr style="background: #fff;">`;
		html += `<td colspan="${check_digit ? 6 : 5}" style="padding: 4px 8px; color: #dc2626; font-size: 14px;">`;
		html += `⚠️ Error: Prefix (${prefix_length}) + Item Code (${item_code_length}) + Weight (${weight_length})${check_digit ? ' + Check (1)' : ''} = ${calculated_length + check_digit} ≠ Total (${total_length})`;
		html += `</td></tr>`;
	} else {
		// Generate sample item code
		const sample_item_code = '12345'.padEnd(item_code_length, '0').substring(0, item_code_length);
		const sample_weight = '00125'.padStart(weight_length, '0').substring(0, weight_length);
		const check_digit_value = '0';
		const complete_barcode = prefix + sample_item_code + sample_weight + (check_digit ? check_digit_value : '');

		html += `<tr style="background: #fff;">`;
		html += `<td style="padding: 2px 8px; font-size: 20px; font-weight: bold;">`;
		html += `<span style="color: #dc2626;">${prefix}</span>`;
		html += `<span style="color: #2563eb;">${sample_item_code}</span>`;
		html += `<span style="color: #16a34a;">${sample_weight}</span>`;
		if (check_digit) {
			html += `<span style="color: #6b7280;">${check_digit_value}</span>`;
		}
		html += `</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${prefix_length}</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${item_code_length}</td>`;
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${weight_length}</td>`;
		if (check_digit) {
			html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">1</td>`;
		}
		html += `<td style="padding: 2px 8px; text-align: center; font-size: 13px; color: #6b7280;">${total_length}</td>`;
		html += `</tr>`;
		html += `<tr style="background: #fef3c7;"><td colspan="${check_digit ? 6 : 5}" style="padding: 4px 8px; font-size: 12px; color: #92400e;">`;
		html += `<strong>Note:</strong> Weight in grams. Example: ${sample_weight} = ${(parseInt(sample_weight) / 1000).toFixed(3)} kg`;
		if (check_digit) {
			html += ` | Last digit is check digit (ignored)`;
		}
		html += `</td></tr>`;
	}

	html += '</tbody></table></div>';

	frm.fields_dict.posa_scale_barcode_example.$wrapper.html(html);
}
