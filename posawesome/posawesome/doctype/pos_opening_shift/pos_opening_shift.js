// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Opening Shift', {
	setup(frm) {
		try {
			if (frm.doc.docstatus == 0) {
				frm.trigger('set_posting_date_read_only');
				frm.set_value('period_start_date', frappe.datetime.now_datetime());
				frm.set_value('user', frappe.session.user);
			}
			frm.set_query("user", function(doc) {
				return {
					query: "posawesome.posawesome.api.pos_opening_shift.get_profile_users.get_profile_users",
					filters: { 'parent': doc.pos_profile }
				};
			});
			frm.set_query("pos_profile", function(doc) {
				return {
					filters: { 'company': doc.company}
				};
			});
		} catch (error) {
			console.error('[ERROR] setup error:', error);
		}
	},

	refresh(frm) {
		try {
			// set default posting date / time
			if(frm.doc.docstatus == 0) {
				if(!frm.doc.posting_date) {
					frm.set_value('posting_date', frappe.datetime.nowdate());
			}
			frm.trigger('set_posting_date_read_only');
			
			// Make user field read-only if POS Profile is not selected
			if (!frm.doc.pos_profile) {
				frm.set_df_property('user', 'read_only', 1);
			}
			}

			// Administrator-only shift control buttons
			if (frappe.user.has_role('Administrator')) {
				// Clear previous buttons to prevent duplication
				frm.clear_custom_buttons();

				if (frm.doc.docstatus === 1) {  // Only if submitted
					if (frm.doc.status === 'Closed') {
						frm.add_custom_button(__('🔓 Open Shift'), function() {
							frappe.call({
								method: "frappe.client.set_value",
								args: {
									doctype: "POS Opening Shift",
									name: frm.doc.name,
									fieldname: "status",
									value: "Open"
								},
								callback: function(response) {
									if (!response.exc) {
										frappe.msgprint(__('✅ Shift has been opened.'));
										frm.reload_doc();
									}
								}
							});
						}).addClass("btn-primary");
					} 
					else if (frm.doc.status === 'Open') {
						frm.add_custom_button(__('🔒 Close Shift'), function() {
							frappe.call({
								method: "frappe.client.set_value",
								args: {
									doctype: "POS Opening Shift",
									name: frm.doc.name,
									fieldname: "status",
									value: "Closed"
								},
								callback: function(response) {
									if (!response.exc) {
										frappe.msgprint(__('✅ Shift has been closed.'));
										frm.reload_doc();
									}
								}
							});
						}).addClass("btn-danger");
					}
				}
			}
		} catch (error) {
			console.error('[ERROR] refresh error:', error);
		}
	},

	set_posting_date_read_only(frm) {
		try {
			if(frm.doc.docstatus == 0 && frm.doc.set_posting_date) {
				frm.set_df_property('posting_date', 'read_only', 0);
			} else {
				frm.set_df_property('posting_date', 'read_only', 1);
			}
		} catch (error) {
			console.error('[ERROR] set_posting_date_read_only error:', error);
		}
	},

	set_posting_date(frm) {
		try {
			frm.trigger('set_posting_date_read_only');
		} catch (error) {
			console.error('[ERROR] set_posting_date error:', error);
		}
	},

	pos_profile: (frm) => {
		try {
			if (frm.doc.pos_profile) {
				// Clear user field when POS Profile changes
				frm.set_value('user', '');
				
				// Make user field editable
				frm.set_df_property('user', 'read_only', 0);
				
				frappe.db.get_doc("POS Profile", frm.doc.pos_profile)
					.then(({ payments }) => {
						if (payments.length) {
							frm.doc.balance_details = [];
							payments.forEach(({ mode_of_payment }) => {
								frm.add_child("balance_details", { mode_of_payment });
							})
							frm.refresh_field("balance_details");
						}
					})
					.catch(error => {
						console.error('[ERROR] pos_profile get_doc error:', error);
					});
			} else {
				// Make user field read-only if POS Profile is not selected
				frm.set_df_property('user', 'read_only', 1);
			}
		} catch (error) {
			console.error('[ERROR] pos_profile error:', error);
		}
	}
});