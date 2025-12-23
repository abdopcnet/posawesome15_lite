// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Opening Shift', {
	setup(frm) {
		try {
			// Auto-fill fields on new document
			if (frm.doc.docstatus == 0) {
				frm.set_value('period_start_date', frappe.datetime.now_datetime());
				frm.set_value('user', frappe.session.user); // Auto-fill current user
			}

			// Filter users dropdown - show only users registered in selected POS Profile
			frm.set_query('user', function (doc) {
				return {
					query: 'posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_profile_users',
					filters: { parent: doc.pos_profile },
				};
			});

			// Filter POS Profile dropdown by company
			frm.set_query('pos_profile', function (doc) {
				return {
					filters: { company: doc.company },
				};
			});
		} catch (error) {
			console.log('[pos_opening_shift.js] method: setup');
		}
	},

	refresh(frm) {
		try {
			// Set default posting date on draft documents
			if (frm.doc.docstatus == 0) {
				if (!frm.doc.posting_date) {
					frm.set_value('posting_date', frappe.datetime.nowdate());
				}

				// Lock user field until POS Profile is selected
				if (!frm.doc.pos_profile) {
					frm.set_df_property('user', 'read_only', 1);
				}
			}

			// Administrator-only: Add shift control buttons (Open/Close)
			if (frappe.user.has_role('Administrator')) {
				// Clear previous buttons to prevent duplication
				frm.clear_custom_buttons();

				if (frm.doc.docstatus === 1) {
					// Only on submitted documents
					if (frm.doc.status === 'Closed') {
						// Add "Open Shift" button
						frm.add_custom_button(__('🔓 Open Shift'), function () {
							frappe.call({
								method: 'frappe.client.set_value',
								args: {
									doctype: 'POS Opening Shift',
									name: frm.doc.name,
									fieldname: 'status',
									value: 'Open',
								},
								callback: function (response) {
									if (!response.exc) {
										frappe.msgprint(__('✅ Shift has been opened.'));
										frm.reload_doc();
									}
								},
							});
						}).addClass('btn-primary');
					} else if (frm.doc.status === 'Open') {
						// Add "Close Shift" button
						frm.add_custom_button(__('🔒 Close Shift'), function () {
							frappe.call({
								method: 'frappe.client.set_value',
								args: {
									doctype: 'POS Opening Shift',
									name: frm.doc.name,
									fieldname: 'status',
									value: 'Closed',
								},
								callback: function (response) {
									if (!response.exc) {
										frappe.msgprint(__('✅ Shift has been closed.'));
										frm.reload_doc();
									}
								},
							});
						}).addClass('btn-danger');
					}
				}
			}
		} catch (error) {
			console.log('[pos_opening_shift.js] method: refresh');
		}
	},

	// Trigger when POS Profile field changes
	pos_profile: (frm) => {
		try {
			if (frm.doc.pos_profile) {
				// Clear user field when POS Profile changes (force re-selection)
				frm.set_value('user', '');

				// Unlock user field for selection
				frm.set_df_property('user', 'read_only', 0);

				// Load payment methods from POS Profile and populate balance_details table
				frappe.db
					.get_doc('POS Profile', frm.doc.pos_profile)
					.then(({ payments }) => {
						if (payments.length) {
							frm.doc.balance_details = [];
							payments.forEach(({ mode_of_payment }) => {
								frm.add_child('balance_details', { mode_of_payment });
							});
							frm.refresh_field('balance_details');
						}
					})
					.catch((error) => {
						console.log('[pos_opening_shift.js] method: pos_profile');
					});
			} else {
				// Lock user field if POS Profile not selected
				frm.set_df_property('user', 'read_only', 1);
			}
		} catch (error) {
			console.log('[pos_opening_shift.js] method: pos_profile');
		}
	},
});
