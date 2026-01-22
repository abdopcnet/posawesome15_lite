// ===== SECTION 1: IMPORTS =====
// This section imports required dependencies for the Payments component
// - evntBus: Event bus for inter-component communication
// - format: Mixin for formatting numbers and currency
// - API_MAP: Maps API method names to their endpoints
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';

// ===== EVENT NAMES CONSTANTS =====
// All event names used for inter-component communication
// These events are emitted and listened to via the event bus
const EVENT_NAMES = {
	SHOW_PAYMENT: 'show_payment',
	SET_CUSTOMER_READONLY: 'set_customer_readonly',
	SHOW_MESSAGE: 'show_mesage',
	SET_LAST_INVOICE: 'set_last_invoice',
	NEW_INVOICE: 'new_invoice',
	INVOICE_SUBMITTED: 'invoice_submitted',
	PAYMENTS_UPDATED: 'payments_updated',
	FREEZE: 'freeze',
	UNFREEZE: 'unfreeze',
	OPEN_EDIT_CUSTOMER: 'open_edit_customer',
	OPEN_NEW_ADDRESS: 'open_new_address',
	TOGGLE_QUICK_RETURN: 'toggle_quick_return',
	SEND_INVOICE_DOC_PAYMENT: 'send_invoice_doc_payment',
	REGISTER_POS_PROFILE: 'register_pos_profile',
	ADD_THE_NEW_ADDRESS: 'add_the_new_address',
	UPDATE_CUSTOMER: 'update_customer',
	SET_POS_SETTINGS: 'set_pos_settings',
	SET_CUSTOMER_INFO_TO_EDIT: 'set_customer_info_to_edit',
	UPDATE_DUE_DATE: 'update_due_date',
	POSA_USE_CUSTOMER_CREDIT_SWITCH_CHANGED: 'posa_use_customer_credit_switch_changed',
};

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
	mixins: [format],

	// ===== DATA =====
	// Component's reactive data properties
	// These properties are used throughout the component to manage state
	data() {
		return {
			// UI state
			// Loading indicator state
			loading: false,
			// Phone payment dialog visibility
			phone_dialog: false,

			// POS configuration
			// Current POS profile configuration
			pos_profile: '',
			// POS system settings
			pos_settings: '',

			// Invoice data
			// Current invoice document object
			invoice_doc: null,
			// Selected customer ID
			customer: '',
			// Customer details and information
			customer_info: '',

			// Payment amounts
			// Loyalty points amount to redeem
			loyalty_amount: 0,
			// Whether to use customer credit
			redeem_customer_credit: false,

			// Invoice flags
			// Whether this is a credit sale (unpaid invoice)
			is_credit_sale: false,
			// Whether this is a return invoice
			is_return: false,
			// Quick return mode (no original invoice reference)
			quick_return: false,
			// Use customer credit switch for return invoices
			posa_use_customer_credit_switch: false,
			// Write-off amount flag
			is_write_off_change: 0, // Customer credit
			// Available customer credit sources
			customer_credit_dict: [],
			// Cashback feature flag
			is_cashback: true,

			// Address management
			// Customer addresses list
			addresses: [],

			// Payment management
			// Rules for calculating change amount
			change_amount_rules: [],
			// Selected payment method index for returns
			selected_return_payment_idx: null,
			// Timeouts for debouncing payment amount changes
			set_full_amount_timeouts: {},

			// Credit sale state management
			// Store payment values before enabling credit sale
			// This allows restoring payments when credit sale is disabled
			saved_payments_before_credit_sale: null,

			// Return invoice state management
			// Track if original invoice is unpaid (for return invoices)
			// If unpaid, payment fields should be disabled
			is_original_invoice_unpaid: false,

			// Customer outstanding balance
			// Total unpaid amount for the customer (from all unpaid invoices)
			customer_outstanding_balance: 0.0,
			// Currency for customer outstanding balance
			customer_outstanding_currency: null,
		};
	},

	// ===== COMPUTED PROPERTIES =====
	// These properties are automatically recalculated when their dependencies change
	// They provide derived values based on the component's data
	computed: {
		// Minimum date for due date input (today's date)
		// Used to prevent selecting past dates for credit sale due dates
		min_date() {
			if (typeof frappe !== 'undefined' && frappe.datetime) {
				return frappe.datetime.now_date();
			}
			// Fallback: return today's date in YYYY-MM-DD format
			const today = new Date();
			return today.toISOString().split('T')[0];
		},

		// Calculate total paid amount
		// Sums all payment methods, loyalty points, and customer credit
		// This is the total amount the customer has paid so far
		paid_amount() {
			if (!this.invoice_doc) return 0;

			// Start with loyalty points amount
			let total = parseFloat(this.invoice_doc.loyalty_amount || 0);

			// Add all payment method amounts
			// Use precision = 2 for all currency amounts
			if (this.invoice_doc?.payments) {
				this.invoice_doc.payments.forEach((payment) => {
					total += this.flt(payment.amount || 0, 2);
				});
			}

			// Add redeemed customer credit
			total += this.flt(this.redeemed_customer_credit || 0, 2);

			// Use precision = 2 for all currency amounts
			// Following user requirement: all currency amounts should be 2 decimal places
			return flt(total, 2);
		},

		// Calculate outstanding amount (amount still owed by customer)
		// Formula: outstanding = grand_total - paid_amount - write_off_amount
		// This follows ERPNext's standard calculation logic
		outstanding_amount() {
			if (!this.invoice_doc) return 0;

			// For settlement invoices, use the original outstanding_amount from the invoice
			// Don't recalculate based on current payments (which are for settlement only)
			if (this.invoice_doc._is_settlement) {
				// Get the original outstanding amount from the invoice (before settlement payments)
				// This is the amount that was still owed before we started the settlement process
				let originalOutstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
				if (originalOutstanding <= 0) {
					// Fallback: calculate from grand_total and paid_amount of original invoice
					const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
					const originalPaidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
					const write_off_amount = flt(this.invoice_doc.write_off_amount || 0, 2);
					originalOutstanding = flt(
						grandTotal - originalPaidAmount - write_off_amount,
						2,
					);
					if (originalOutstanding < 0) originalOutstanding = 0;
				}

				// Calculate current settlement payments (payments entered in settlement mode)
				const currentSettlementPayments = flt(this.paid_amount, 2);

				// Remaining to pay = Original outstanding - Current settlement payments
			const remaining = flt(originalOutstanding - currentSettlementPayments, 2);

			return remaining > 0 ? remaining : 0;
			}

			// Normal mode: calculate outstanding from current invoice state
			// Get invoice total (use grand_total only, no rounding)
			// Following user requirement: no rounded_total dependency at all
			// Use precision = 2 for all currency amounts
			const target_amount = flt(this.invoice_doc.grand_total, 2);
			// Get write-off amount if any
			const write_off_amount = flt(this.invoice_doc.write_off_amount || 0, 2);

			// Following ERPNext logic: outstanding_amount = grand_total - paid_amount - write_off_amount
			// Use precision = 2 for all currency amounts
			const outstanding = flt(target_amount - this.paid_amount - write_off_amount, 2);

			// Return only positive values (what's still owed)
			// Negative values mean customer overpaid (handled by change_amount)
			return outstanding > 0 ? outstanding : 0;
		},

		// Calculate change amount (excess payment to return to customer)
		// This is the amount customer overpaid that should be returned
		// Only calculated when paid_total > grand_total and payment includes cash
		change_amount() {
			if (!this.invoice_doc) return 0;

			// Calculate paid_amount directly (not using computed property to avoid dependency issues)
			// This prevents circular dependency problems
			let paid_total = parseFloat(this.invoice_doc.loyalty_amount || 0);
			// Use precision = 2 for all currency amounts
			if (this.invoice_doc?.payments) {
				this.invoice_doc.payments.forEach((payment) => {
					paid_total += this.flt(payment.amount || 0, 2);
				});
			}
			paid_total += this.flt(this.redeemed_customer_credit || 0, 2);
			// Use precision = 2 for all currency amounts
			paid_total = flt(paid_total, 2);

			// Get invoice total (use grand_total only, no rounding)
			// Following user requirement: no rounded_total dependency at all
			// Use precision = 2 for all currency amounts
			const target_amount = flt(this.invoice_doc.grand_total, 2);
			// Get cash payment mode from POS profile
			const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;

			// Only calculate change_amount if customer overpaid
			// Change can only be given if excess payment is from cash
			if (paid_total > target_amount) {
				// If cash_mode is defined, verify that excess is from cash payment
				if (cash_mode) {
					const cash_payment = this.invoice_doc?.payments?.find(
						(p) => p.mode_of_payment === cash_mode,
					);
					const other_payments_total =
						this.invoice_doc?.payments
							?.filter((p) => p.mode_of_payment !== cash_mode)
							.reduce((sum, p) => sum + this.flt(p.amount || 0, 2), 0) || 0;

					// Calculate other totals with precision = 2 for all currency amounts
					const other_totals = flt(
						flt(this.invoice_doc.loyalty_amount || 0, 2) +
							flt(this.redeemed_customer_credit || 0, 2) +
							other_payments_total,
						2,
					);

					// Only allow excess if:
					// 1. Cash payment exists and has amount > 0
					// 2. Other payments (non-cash) don't exceed invoice total
					if (
						cash_payment &&
						this.flt(cash_payment.amount || 0) > 0 &&
						other_totals <= target_amount
					) {
						// Following ERPNext: change_amount = paid_amount - grand_total (when paid_amount > grand_total)
						// Use precision = 2 for all currency amounts
						const change = flt(paid_total - target_amount, 2);
						return change;
					} else {
						return 0;
					}
				} else {
					// No cash_mode defined, but paid_total > grand_total
					// Allow change_amount calculation (for backward compatibility)
					// Use exact calculation without rounding to preserve precision
					// Use precision = 2 for all currency amounts
					const change = flt(paid_total - target_amount, 2);
					return change;
				}
			}

			// No change amount (paid_total <= grand_total)
			return 0;
		},

		// Backward compatibility: alias for paid_amount
		// Keep total_payments for backward compatibility
		// Some components may still reference this property
		total_payments() {
			return this.paid_amount;
		},

		// Backward compatibility: deprecated property
		// Keep diff_payment for backward compatibility (deprecated, use outstanding_amount and change_amount)
		// Returns positive outstanding or negative change amount
		diff_payment() {
			// Return outstanding_amount (positive) or negative change_amount
			if (this.change_amount > 0) {
				// Negative to indicate excess
				return -this.change_amount;
			}
			// Positive to indicate remaining
			return this.outstanding_amount;
		},

		// Get available loyalty points for current customer
		available_pioints_amount() {
			if (!this.customer_info?.loyalty_points) return 0;
			return this.customer_info.loyalty_points;
		},

		// Calculate total available customer credit
		// Sums all credit sources (advance payments, credit notes, etc.)
		available_customer_credit() {
			return this.customer_credit_dict.reduce((total, row) => total + row.total_credit, 0);
		},

		// Calculate total redeemed customer credit
		// Sums the credit_to_redeem amount from all credit sources
		redeemed_customer_credit() {
			return this.customer_credit_dict.reduce((total, row) => {
				const credit = flt(row.credit_to_redeem);
				if (!credit) row.credit_to_redeem = 0;
				return total + credit;
			}, 0);
		},

		// Validate if payment data exists
		// Returns true if invoice_doc or payments array is missing
		vaildatPayment() {
			return !this.invoice_doc || !this.invoice_doc.payments;
		},

		// Check if any payment method is of type 'Phone'
		// Used to show/hide phone payment request button
		request_payment_field() {
			return (
				this.invoice_doc?.payments?.some((payment) => payment.type === 'Phone') || false
			);
		},

		// Get customer outstanding balance (total unpaid amount)
		// This is the total amount the customer owes across all unpaid invoices
		customer_outstanding_display() {
			// Return exact value without rounding to preserve precision
			// Following user requirement: no rounding logic at all
			// formatCurrency will handle display formatting
			return flt(this.customer_outstanding_balance || 0);
		},
	},

	// ===== METHODS =====
	// All component methods for handling business logic and user interactions
	methods: {
		// Display a message to the user via event bus
		// Used for success, error, and warning notifications
		showMessage(text, color) {
			evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
		},

		// Emit print request event to parent component
		emitPrintRequest() {
			this.$emit('request-print');
		},

		// Expose submit method with default parameters
		// Used for programmatic invoice submission
		exposeSubmit(print = true, autoMode = false) {
			this.submit(undefined, autoMode, print);
		},

		// Automatically pay invoice with default payment method
		// Used for quick payment scenarios (e.g., auto-pay on item scan)
		autoPayWithDefault(invoice_doc) {
			this.invoice_doc = invoice_doc;
			const defaultPayment = this.getDefaultPayment();
			if (defaultPayment) {
				// Use grand_total with precision = 2 for all currency amounts
				// Following user requirement: no rounded_total dependency at all
				const total = flt(invoice_doc.grand_total, 2);
				// Set payment amount with precision = 2
				defaultPayment.amount = total;
			}
			this.exposeSubmit(true, true);
		},

		// Get the default payment method from payments array
		// Returns payment marked as default, or first payment if no default
		getDefaultPayment() {
			const payments = Array.isArray(this.invoice_doc?.payments)
				? this.invoice_doc.payments
				: [];
			return payments.find((payment) => payment.default == 1) || payments[0] || null;
		},

		// Navigate back to invoice view
		// Hides payment dialog and enables customer editing
		back_to_invoice() {
			evntBus.emit(EVENT_NAMES.SHOW_PAYMENT, 'false');
			evntBus.emit(EVENT_NAMES.SET_CUSTOMER_READONLY, false);
		},

		// Submit payment for settlement invoice (already submitted)
		// Creates Payment Entry using ERPNext's get_payment_entry
		async submitSettlementPayment() {
			try {
				// Validate that we have payment amounts
				const totalPayment = this.paid_amount;
				if (totalPayment <= 0) {
					this.showMessage('يرجى إدخال مبلغ السداد', 'error');
					return;
				}

				// Get all payment methods with amounts > 0
				const payments = this.invoice_doc.payments.filter((p) => flt(p.amount) > 0);
				if (payments.length === 0) {
					this.showMessage('يرجى اختيار طريقة دفع', 'error');
					return;
				}

				// Show loading
				evntBus.emit('show_loading', { text: 'جاري إنشاء سند الدفع...', color: 'info' });

				// If single payment, use create_payment_entry_for_invoice
				// If multiple payments, use create_payment_entry_for_multiple_payments
				let response;
				if (payments.length === 1) {
					// Single payment method
					const payment = payments[0];
					response = await frappe.call({
						method: API_MAP.PAYMENT_ENTRY.CREATE_PAYMENT_ENTRY,
						args: {
							invoice_name: this.invoice_doc.name,
							payment_data: {
								mode_of_payment: payment.mode_of_payment,
								amount: payment.amount,
								account: payment.account || null,
								pos_profile: this.invoice_doc.pos_profile || null,
							},
						},
					});
				} else {
					// Multiple payment methods - create separate Payment Entries
					const paymentsList = payments.map((p) => ({
						mode_of_payment: p.mode_of_payment,
						amount: p.amount,
						account: p.account || null,
						pos_profile: this.invoice_doc.pos_profile || null,
					}));

					response = await frappe.call({
						method: API_MAP.PAYMENT_ENTRY.CREATE_MULTIPLE_PAYMENTS,
						args: {
							invoice_name: this.invoice_doc.name,
							payments_list: paymentsList,
						},
					});
				}

				evntBus.emit('hide_loading');

				if (response.message) {
					const entries = Array.isArray(response.message)
						? response.message
						: [response.message];
					const entryName = entries.map((e) => e.name).join(', ');

					this.showMessage(`تم إنشاء سند الدفع: ${entryName}`, 'success');

					// Print Payment Entry receipt
					// Use the first entry for printing (or all if multiple)
					const firstEntry = entries[0];
					if (firstEntry && firstEntry.name) {
						// Get print format from invoice_doc or use default
						// Payment Entry uses same print format as Sales Invoice
						const printFormat =
							this.invoice_doc?.pos_profile?.posa_print_format || 'Standard';

						// Open print window for Payment Entry
						const printUrl = frappe.urllib.get_full_url(
							`/printview?doctype=Payment%20Entry&name=${firstEntry.name}&format=${printFormat}&trigger_print=1&no_letterhead=0`,
						);
						window.open(printUrl);
					}

					// Close payment dialog and reset
					this.back_to_invoice();
					evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
				}
		} catch (error) {
			evntBus.emit('hide_loading');
			console.error('[Payments.js] submit_settlement_payment_failed');
			const errorMessage = error?.message || error?.exc || 'فشل إنشاء سند الدفع';
			this.showMessage(errorMessage, 'error');
			}
		},

		// Main submit method - entry point for invoice submission
		// Handles form submission, validation, and delegates to submit_invoice
		async submit(event, autoMode = false, print = false) {
			// Prevent default form submission if event is provided
			if (event && typeof event.preventDefault === 'function') {
				event.preventDefault();
			}

			// Refresh invoice document from server to get latest data
			// This prevents conflicts if invoice was modified elsewhere
			try {
			await this.refreshInvoiceDoc();
		} catch (error) {
			console.error('[Payments.js] submit_failed');
		}

			// If invoice is already submitted (settlement flow)
			if (this.invoice_doc?.docstatus === 1) {
				// Check if this is a settlement payment
				if (this.invoice_doc._is_settlement) {
					await this.submitSettlementPayment();
					return;
				}

				// Otherwise, just print if requested
				if (print) {
					this.load_print_page();
				}
				evntBus.emit(EVENT_NAMES.SET_LAST_INVOICE, this.invoice_doc.name);
				evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
				this.back_to_invoice();
				return;
			}

			// Auto mode: automatically fill default payment with invoice total
			if (autoMode) {
				const defaultPayment = this.getDefaultPayment();
				if (!defaultPayment) {
					this.showMessage('No default payment method in POS profile', 'error');
					return;
				}
				// Use grand_total with precision = 2 for all currency amounts
				// Following user requirement: no rounded_total dependency at all
				const total = flt(this.invoice_doc.grand_total, 2);
				// Set payment amount with precision = 2
				defaultPayment.amount = total;
			}

			// Delegate to submit_invoice for actual submission logic
			this.submit_invoice(print, autoMode);
		},

		// Core invoice submission logic
		// Handles quick return mode, payment calculations, and server submission
		submit_invoice(print, autoMode, retrying = false) {
			// Handle quick return mode (return without original invoice reference)
			// In quick return, all item quantities and amounts must be negative
			if (this.quick_return) {
				this.invoice_doc.is_return = 1;

				// Make all item quantities and amounts negative
				// This is required by ERPNext for return invoices
				let total = 0;
				this.invoice_doc.items.forEach((item) => {
					item.qty = -1 * Math.abs(item.qty);
					item.stock_qty = -1 * Math.abs(item.stock_qty || item.qty);
					item.amount = -1 * Math.abs(item.amount);
					item.net_amount = -1 * Math.abs(item.net_amount || item.amount);
					total += item.amount;
				});

				// Update all invoice totals to negative values
				this.invoice_doc.total = total;
				this.invoice_doc.net_total = total;
				this.invoice_doc.grand_total = total;
				// Do not set rounded_total - following user requirement: no rounded_total dependency
				this.invoice_doc.base_total = total;
				this.invoice_doc.base_net_total = total;
				this.invoice_doc.base_grand_total = total;

				// Set payment amount for selected payment method or first payment
				if (typeof this.selected_return_payment_idx === 'number') {
					this.invoice_doc.payments.forEach((payment) => {
						payment.amount =
							payment.idx === this.selected_return_payment_idx ? total : 0;
					});
				} else {
					if (this.invoice_doc.payments?.length > 0) {
						this.invoice_doc.payments[0].amount = total;
					}
				}

				// Reset quick return flag after processing
				this.quick_return = false;
			}

			// Calculate total payments with precision = 2 for all currency amounts
			let totalPayedAmount = 0;
			this.invoice_doc.payments.forEach((payment) => {
				// Use precision = 2 for all currency amounts
				payment.amount = flt(payment.amount, 2);
				totalPayedAmount += payment.amount;
			});

			// Use grand_total with precision = 2 for all currency amounts
			// Following user requirement: no rounded_total dependency at all
			const targetAmount = flt(this.invoice_doc.grand_total, 2);

			// Include loyalty and customer credit in total with precision = 2
			const allPaymentsTotal = flt(
				totalPayedAmount +
					flt(this.invoice_doc.loyalty_amount || 0, 2) +
					flt(this.redeemed_customer_credit || 0, 2),
				2,
			);

			// Simplified: No validation here - just allow submission
			// Validation is done in Invoice.vue to hide print button

			if (this.invoice_doc.is_return && totalPayedAmount == 0) {
				this.invoice_doc.is_pos = 0;
			}

			if (this.customer_credit_dict.length) {
				this.customer_credit_dict.forEach((row) => {
					row.credit_to_redeem = flt(row.credit_to_redeem);
				});
			}

			// Calculate paid_amount following ERPNext's set_paid_amount() logic
			// This matches ERPNext's calculation: sum of all payments.amount
			// Use exact values without rounding to preserve grand_total precision
			let paid_amount = 0.0;
			if (this.invoice_doc?.payments) {
				this.invoice_doc.payments.forEach((payment) => {
					paid_amount += flt(payment.amount || 0);
				});
			}
			paid_amount += flt(this.invoice_doc.loyalty_amount || 0);
			paid_amount += flt(this.redeemed_customer_credit || 0);

			// Set paid_amount in invoice_doc (ERPNext field name)
			// Use flt without precision to preserve exact decimal values
			// Use precision = 2 for all currency amounts
			this.invoice_doc.paid_amount = flt(paid_amount, 2);

			// Calculate change_amount following ERPNext's calculate_change_amount() logic
			// change_amount = paid_amount - grand_total (when paid_amount > grand_total and has Cash payment)
			// Use precision = 2 for all currency amounts
			// Following user requirement: no rounded_total dependency at all
			const grand_total = flt(this.invoice_doc.grand_total, 2);

			// Check if there's a Cash payment (following ERPNext logic)
			const has_cash_payment =
				this.invoice_doc?.payments?.some((p) => p.type === 'Cash') || false;

			// Calculate change_amount with precision = 2 for all currency amounts
			const calculated_change_amount =
				!this.invoice_doc.is_return && paid_amount > grand_total && has_cash_payment
					? flt(paid_amount - grand_total, 2)
					: 0.0;

			// Set change_amount in invoice_doc (ERPNext field name)
			this.invoice_doc.change_amount = calculated_change_amount;

			const data = {
				redeemed_customer_credit: this.redeemed_customer_credit,
				customer_credit_dict: this.customer_credit_dict,
			};

			if (autoMode) {
				this.load_print_page();
				evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
				this.back_to_invoice();
				return;
			}

			frappe.call({
				method: API_MAP.SALES_INVOICE.SUBMIT,
				args: {
					data: data,
					invoice: {
						name: this.invoice_doc.name,
						customer: this.invoice_doc.customer,
						is_return: this.invoice_doc.is_return,
						is_pos: this.invoice_doc.is_pos,
						payments: this.invoice_doc.payments,
						loyalty_amount: this.invoice_doc.loyalty_amount,
						redeem_loyalty_points: this.invoice_doc.redeem_loyalty_points,
						loyalty_points: this.invoice_doc.loyalty_points,
						write_off_amount: this.invoice_doc.write_off_amount,
						write_off_outstanding_amount_automatically:
							this.invoice_doc.write_off_outstanding_amount_automatically,
						contact_mobile: this.invoice_doc.contact_mobile,
						contact_person: this.invoice_doc.contact_person,
						contact_email: this.invoice_doc.contact_email,
						due_date: this.invoice_doc.due_date,
						is_credit_sale: this.is_credit_sale || 0,
						delivery_date: this.invoice_doc.delivery_date,
						address_display: this.invoice_doc.address_display,
						shipping_address_name: this.invoice_doc.shipping_address_name,
						customer_address: this.invoice_doc.customer_address,
						shipping_address: this.invoice_doc.shipping_address,
					},
				},
				async: true,
				callback: (r) => {
					if (r.message) {
						if (print) {
							this.load_print_page();
						}
						evntBus.emit(EVENT_NAMES.SET_LAST_INVOICE, this.invoice_doc.name);
						this.addresses = [];
						evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
						evntBus.emit(EVENT_NAMES.INVOICE_SUBMITTED);
						this.back_to_invoice();
					} else {
						this.showMessage('Failed to submit invoice', 'error');
					}
				},
				error: (err) => {
					const errorMsg = err?.message || '';
					const isTimestampError =
						typeof errorMsg === 'string' &&
						errorMsg.includes('Document has been modified');

					if (!retrying && isTimestampError) {
						this.refreshInvoiceDoc()
							.then(() => {
								this.submit_invoice(print, autoMode, true);
						})
						.catch((err) => {
							console.error('[Payments.js] refresh_invoice_doc_failed');
							this.showMessage(
								'Invoice was modified elsewhere, please try again',
									'error',
								);
							});
					} else {
						this.showMessage(err?.message || 'Failed to submit invoice', 'error');
					}
				},
			});
		},

		// Refresh invoice document from server
		// Merges local payment changes with server data to prevent data loss
		// Used before submission to ensure we have latest invoice data
		refreshInvoiceDoc() {
			if (!this.invoice_doc?.name) {
				return Promise.resolve();
			}

			// Only merge payments if invoice is still a draft (docstatus = 0)
			// Submitted invoices should not have local payment modifications
			const shouldMergeLocalPayments = this.invoice_doc.docstatus === 0;
			// Save local payment values before fetching from server
			const localPayments =
				shouldMergeLocalPayments && this.invoice_doc.payments
					? this.invoice_doc.payments.map((payment) => ({ ...payment }))
					: [];

			return new Promise((resolve, reject) => {
				frappe.call({
					method: API_MAP.FRAPPE.CLIENT_GET,
					args: {
						doctype: 'Sales Invoice',
						name: this.invoice_doc.name,
					},
					async: true,
					callback: (res) => {
						if (res.message) {
							const freshDoc = res.message;

							if (shouldMergeLocalPayments && freshDoc.docstatus === 0) {
								const mergedPayments = (freshDoc.payments || []).map((payment) => {
									const localMatch = localPayments.find((localPayment) => {
										if (
											localPayment.idx !== undefined &&
											payment.idx !== undefined
										) {
											return payment.idx === localPayment.idx;
										}
										return (
											payment.mode_of_payment ===
											localPayment.mode_of_payment
										);
									});

									return localMatch
										? { ...payment, amount: localMatch.amount }
										: payment;
								});

								const seen = new Set(
									mergedPayments.map(
										(payment) =>
											`${payment.mode_of_payment || ''}__${
												payment.idx || ''
											}`,
									),
								);

								localPayments.forEach((localPayment) => {
									const key = `${localPayment.mode_of_payment || ''}__${
										localPayment.idx || ''
									}`;
									if (!seen.has(key) && flt(localPayment.amount)) {
										mergedPayments.push(localPayment);
									}
								});

								freshDoc.payments = mergedPayments;
							}

							this.invoice_doc = freshDoc;

							// After refreshing from server, ensure default payment amount matches grand_total exactly
							// This prevents rounded values from server (e.g., 18.37) from overriding exact grand_total (18.38)
							// Following user requirement: no rounding logic at all
							if (
								this.invoice_doc &&
								!this.invoice_doc.is_return &&
								this.invoice_doc.docstatus === 0
							) {
								const default_payment = this.invoice_doc.payments?.find(
									(payment) => payment.default == 1,
								);
								if (default_payment) {
									// Use grand_total with precision = 2 for all currency amounts
									// Following user requirement: no rounded_total dependency at all
									const total = flt(this.invoice_doc.grand_total, 2);
									// Set payment amount with precision = 2
									default_payment.amount = total;
									if (default_payment.base_amount !== undefined) {
										default_payment.base_amount = total;
									}
								}
							}

							resolve();
						} else {
							reject(new Error('Failed to refresh invoice'));
						}
					},
					error: (err) => reject(err),
				});
			});
		},

		// Set payment amount to full invoice total
		// Called when user clicks on a payment method button
		// Uses debouncing to prevent rapid successive calls
		set_full_amount(idx) {
			try {
				// Clear any pending timeout for this specific payment
				// This prevents multiple rapid calls from overwriting each other
				if (this.set_full_amount_timeouts[idx]) {
					clearTimeout(this.set_full_amount_timeouts[idx]);
					delete this.set_full_amount_timeouts[idx];
				}

				// Debounce to prevent multiple rapid calls for the same payment
				// Wait 150ms before executing to batch rapid clicks
				this.set_full_amount_timeouts[idx] = setTimeout(() => {
					// Do not allow payment amount changes if posa_use_customer_credit_switch is enabled
					if (this.posa_use_customer_credit_switch) {
						delete this.set_full_amount_timeouts[idx];
						return;
					}
					const isQuickReturn = !!this.quick_return;

					const payment = this.invoice_doc.payments.find((p) => p.idx == idx);
					if (!payment) {
						delete this.set_full_amount_timeouts[idx];
						return;
					}

					// Clear all other payment methods first
					this.invoice_doc.payments.forEach((p) => {
						if (p.idx !== idx) {
							p.amount = 0;
							if (p.base_amount !== undefined) {
								p.base_amount = 0;
							}
						}
					});

					// Calculate invoice total
					// For settlement invoices, use outstanding_amount instead of grand_total
					// Use grand_total with precision = 2 for all currency amounts
					// Following user requirement: no rounded_total dependency
					let invoice_total = flt(this.invoice_doc.grand_total, 2);
					if (this.invoice_doc._is_settlement) {
						// Calculate outstanding if not present
						let outstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
						if (outstanding <= 0) {
							// Fallback: calculate from grand_total and paid_amount
							const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
							const paidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
							outstanding = flt(grandTotal - paidAmount, 2);
							if (outstanding < 0) outstanding = 0;
						}
						invoice_total = outstanding;
					}

					// Fill with full invoice amount when clicking the payment method button
					// For quick_return mode, same logic as sales_mode but with negative values
					// For settlement invoices, use outstanding_amount (already set in invoice_total)
					// Use precision = 2 for all currency amounts
					const amount = invoice_total;
					let target_amount = isQuickReturn ? -Math.abs(amount) : amount;

					// For settlement invoices, ensure amount doesn't exceed outstanding_amount
					if (this.invoice_doc._is_settlement && target_amount > 0) {
						// Calculate outstanding if not present
						let outstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
						if (outstanding <= 0) {
							// Fallback: calculate from grand_total and paid_amount
							const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
							const paidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
							outstanding = flt(grandTotal - paidAmount, 2);
							if (outstanding < 0) outstanding = 0;
						}

						// Calculate total payments including this one
						const otherPayments = this.invoice_doc.payments
							.filter((p) => p.idx !== payment.idx)
							.reduce((sum, p) => sum + flt(p.amount || 0, 2), 0);
						const maxAllowed = flt(outstanding - otherPayments, 2);

						if (target_amount > maxAllowed) {
							target_amount = maxAllowed > 0 ? maxAllowed : 0;
						}
					}

					// Set payment amount with precision = 2
					payment.amount = target_amount;
					if (payment.base_amount !== undefined) {
						payment.base_amount = payment.amount;
					}

					// Trigger validation after setting amount
					this.$nextTick(() => {
						this.validate_payment_amount(payment);
					});

					evntBus.emit(
						EVENT_NAMES.PAYMENTS_UPDATED,
						JSON.parse(JSON.stringify(this.invoice_doc.payments)),
					);

					// Force update to recalculate computed properties
					this.$nextTick(() => {
						this.$forceUpdate();
					});

					delete this.set_full_amount_timeouts[idx];
			}, 150); // 150ms debounce per payment
		} catch (error) {
			console.error('[Payments.js] set_full_amount_failed');
			if (this.set_full_amount_timeouts[idx]) {
				delete this.set_full_amount_timeouts[idx];
				}
			}
		},

		// Set payment amount to remaining balance
		// Called when user focuses/clicks on payment amount input field
		// Calculates remaining amount after other payments and fills it in
		set_rest_amount(idx) {
			try {
				// Do not allow payment amount changes if posa_use_customer_credit_switch is enabled
				if (this.posa_use_customer_credit_switch) {
					return;
				}

				const isQuickReturn = !!this.quick_return;
				// For settlement invoices, use outstanding_amount instead of grand_total
				// Use grand_total directly without rounding to preserve exact value
				// Following user requirement: no rounded_total dependency
				// Use precision = 2 for all currency amounts
				let invoice_total = flt(this.invoice_doc.grand_total, 2);
				if (this.invoice_doc._is_settlement) {
					// Calculate outstanding if not present
					let outstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
					if (outstanding <= 0) {
						// Fallback: calculate from grand_total and paid_amount
						const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
						const paidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
						outstanding = flt(grandTotal - paidAmount, 2);
						if (outstanding < 0) outstanding = 0;
					}
					invoice_total = outstanding;
				}

				// Find the payment method being edited
				const payment = this.invoice_doc.payments.find((p) => p.idx === idx);
				if (!payment) return;

				// Calculate current total payments excluding this payment
				// This gives us the amount already covered by other payment methods
				// Use precision = 2 for all currency amounts
				const other_payments =
					this.invoice_doc.payments
						?.filter((p) => p.idx !== idx)
						.reduce((sum, p) => sum + flt(p.amount || 0, 2), 0) || 0;

				// Calculate other totals with precision = 2 for all currency amounts
				const other_totals = flt(
					flt(this.invoice_doc.loyalty_amount || 0, 2) +
						flt(this.redeemed_customer_credit || 0, 2) +
						other_payments,
					2,
				);

				// Calculate remaining amount (works for both positive and negative values)
				// Use precision = 2 for all currency amounts
				const remaining = flt(invoice_total - other_totals, 2);

				// Fill with remaining amount (cannot exceed invoice total for non-cash)
				const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;
				let amount = remaining;

				// For non-cash payments, limit to remaining amount (cannot exceed invoice total)
				if (cash_mode && payment.mode_of_payment !== cash_mode) {
					// Non-cash: fill with remaining amount, but not more than invoice total
					// For quick_return mode, use absolute values for comparison
					if (isQuickReturn) {
						// Quick return mode: use absolute values for comparison
						const abs_remaining = Math.abs(remaining);
						const abs_target = Math.abs(invoice_total);
						amount =
							abs_remaining <= abs_target ? remaining : -Math.abs(invoice_total);
					} else {
						// Normal mode: compare directly
						amount = remaining > 0 ? remaining : 0;
					}
				} else {
					// Cash payment: can fill with remaining amount (can exceed later if needed)
					amount = remaining;
				}

				// For quick_return mode, ensure value is negative
				// If positive, convert to negative (same as sales_mode but negative)
				if (isQuickReturn && amount > 0) {
					amount = -Math.abs(amount);
				}

				// For settlement invoices, ensure amount doesn't exceed outstanding_amount
				if (this.invoice_doc._is_settlement && amount > 0) {
					// Calculate outstanding if not present
					let outstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
					if (outstanding <= 0) {
						// Fallback: calculate from grand_total and paid_amount
						const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
						const paidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
						outstanding = flt(grandTotal - paidAmount, 2);
						if (outstanding < 0) outstanding = 0;
					}

					// Calculate total payments including this one
					const otherPayments = this.invoice_doc.payments
						.filter((p) => p.idx !== payment.idx)
						.reduce((sum, p) => sum + flt(p.amount || 0, 2), 0);
					const maxAllowed = flt(outstanding - otherPayments, 2);

					if (amount > maxAllowed) {
						amount = maxAllowed > 0 ? maxAllowed : 0;
					}
				}

				// Set payment amount to exact remaining value without rounding
				// Following user requirement: no rounding logic at all
				// This ensures payment.amount matches grand_total exactly
				payment.amount = amount;
				if (payment.base_amount !== undefined) {
					payment.base_amount = payment.amount;
				}

				// Trigger validation after setting amount
				this.$nextTick(() => {
					this.validate_payment_amount(payment);
				});

				evntBus.emit(
					EVENT_NAMES.PAYMENTS_UPDATED,
					JSON.parse(JSON.stringify(this.invoice_doc.payments)),
				);

				// Force update to recalculate computed properties
				this.$nextTick(() => {
					this.$forceUpdate();
			});
		} catch (error) {
			console.error('[Payments.js] set_rest_amount_failed');
		}
	},

		// Clear all payment amounts to zero
		// Used when resetting payment form or switching payment methods
		clear_all_amounts() {
			this.invoice_doc.payments.forEach((payment) => {
				payment.amount = 0;
			});
		},

		// Open print preview window for current invoice
		// Uses POS profile print format and letterhead settings
		load_print_page() {
			const print_format =
				this.pos_profile.print_format_for_online || this.pos_profile.posa_print_format;
			const letter_head = this.pos_profile.letter_head || 0;
			const url = `${frappe.urllib.get_base_url()}/printview?doctype=Sales%20Invoice&name=${
				this.invoice_doc.name
			}&trigger_print=1&format=${print_format}&no_letterhead=${letter_head}`;

			const printWindow = window.open(url, 'Print');
			printWindow.addEventListener(
				'load',
				function () {
					printWindow.print();
					setTimeout(() => printWindow.close(), 1000);
				},
				true,
			);
		},

		// Validate due date is not in the past
		// For credit sales, due date must be today or future
		validate_due_date() {
			const today = frappe.datetime.now_date();
			const parse_today = Date.parse(today);
			const new_date = Date.parse(this.invoice_doc.due_date);

			// If due date is in the past, reset to today
			if (new_date < parse_today) {
				setTimeout(() => {
					this.invoice_doc.due_date = today;
				}, 0);
			}
		},

		// Keyboard shortcut handler: Ctrl+X or Cmd+X to submit
		shortPay(e) {
			if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.submit();
			}
		},

		set_change_amount() {
			// Following ERPNext logic: change_amount is calculated automatically
			// change_amount = paid_amount - grand_total (when paid_amount > grand_total)
			// This method is kept for compatibility but change_amount is now a computed property
			this.change_amount_rules = [];
		},

		// Handle user input in payment amount field
		// Automatically converts positive values to negative in quick return mode
		handlePaymentAmountChange(payment, $event) {
			// Do not allow payment amount changes if posa_use_customer_credit_switch is enabled
			if (this.posa_use_customer_credit_switch) {
				return;
			}
			// Handle payment amount change - make negative automatically for quick_return mode
			let value = 0;
			try {
				// Parse input value from text field
				// Remove commas and parse as float to preserve exact decimal precision
				let inputValue = $event.target.value.toString().replace(/,/g, '');
				let _value = parseFloat(inputValue);
				if (!isNaN(_value)) {
					value = _value;
				}

				// For quick_return mode, make value negative automatically
				// Return invoices require negative payment amounts
				// If input value is positive, convert to negative
				if (this.quick_return && value > 0) {
					value = -Math.abs(value);
				}

				// For settlement invoices, validate that payment doesn't exceed outstanding_amount
				if (this.invoice_doc._is_settlement && value > 0) {
					// Calculate outstanding if not present
					let outstanding = flt(this.invoice_doc.outstanding_amount || 0, 2);
					if (outstanding <= 0) {
						// Fallback: calculate from grand_total and paid_amount
						const grandTotal = flt(this.invoice_doc.grand_total || 0, 2);
						const paidAmount = flt(this.invoice_doc.paid_amount || 0, 2);
						outstanding = flt(grandTotal - paidAmount, 2);
						if (outstanding < 0) outstanding = 0;
					}

					// Calculate total payments including this one
					const otherPayments = this.invoice_doc.payments
						.filter((p) => p.idx !== payment.idx)
						.reduce((sum, p) => sum + flt(p.amount || 0, 2), 0);
				const totalPayments = flt(otherPayments + value, 2);

				if (totalPayments > outstanding) {
						// Limit to outstanding amount
						value = flt(outstanding - otherPayments, 2);
						if (value < 0) value = 0;
						this.showMessage(
							`لا يمكن الدفع أكثر من المبلغ المتبقي: ${this.formatCurrency(
								outstanding,
							)}`,
							'error',
						);
					}
				}

				// Set the payment amount without rounding to preserve exact value
				// Following user requirement: no rounding logic at all
				// Use parseFloat directly to preserve all decimal places from user input
				payment.amount = value;
				if (payment.base_amount !== undefined) {
					payment.base_amount = payment.amount;
				}

				// Emit payment update event
				evntBus.emit(
					EVENT_NAMES.PAYMENTS_UPDATED,
					JSON.parse(JSON.stringify(this.invoice_doc.payments)),
				);

				// Force update to recalculate computed properties
				this.$nextTick(() => {
					this.$forceUpdate();
			});
		} catch (e) {
			console.error('[Payments.js] handle_payment_amount_change_failed');
			payment.amount = 0;
		}
		},

		// Validate payment amount and notify other components
		// Actual validation logic is in Invoice.js component
		validate_payment_amount(payment) {
			// Emit event to update Invoice component (validation happens in Invoice.js)
			evntBus.emit('payment_amount_changed');

			// Force update to recalculate computed properties
			// This ensures outstanding_amount and change_amount are updated
			this.$nextTick(() => {
				this.$forceUpdate();
			});

			return true;
		},

		// Fetch available customer credit from server
		// Used when customer credit redemption feature is enabled
		get_available_credit(e) {
			this.clear_all_amounts();

			if (!e) {
				this.customer_credit_dict = [];
				return;
			}

			frappe.call({
				method: API_MAP.CUSTOMER.GET_CUSTOMER_CREDIT,
				args: {
					customer_id: this.invoice_doc.customer,
					company: this.pos_profile.company,
				},
				callback: (r) => {
					const data = r.message;

					if (!data?.length) {
						this.customer_credit_dict = [];
						return;
					}

					const amount = this.invoice_doc.grand_total;
					let remainAmount = amount;

					data.forEach((row) => {
						if (remainAmount > 0) {
							row.credit_to_redeem =
								remainAmount >= row.total_credit ? row.total_credit : remainAmount;
							remainAmount -= row.credit_to_redeem;
						} else {
							row.credit_to_redeem = 0;
						}
					});

					this.customer_credit_dict = data;
				},
			});
		},

		// Fetch customer addresses from server
		// Used for shipping and billing address selection
		get_addresses() {
			const customer = this.invoice_doc?.customer || this.customer;

			if (!customer) {
				this.addresses = [];
				return;
			}

			frappe.call({
				method: API_MAP.CUSTOMER.GET_ADDRESSES,
				args: { customer_id: customer },
				async: true,
				callback: (r) => {
					this.addresses = r.exc ? [] : r.message;
				},
			});
		},

		// Fetch customer outstanding balance from server
		// Gets total unpaid amount for the customer across all unpaid invoices
		get_customer_outstanding_balance() {
			const customer = this.invoice_doc?.customer || this.customer;
			const company = this.pos_profile?.company;

			if (!customer) {
				this.customer_outstanding_balance = 0.0;
				this.customer_outstanding_currency = null;
				return;
			}

			frappe.call({
				method: API_MAP.CUSTOMER.GET_CUSTOMER_OUTSTANDING_BALANCE,
				args: {
					customer_id: customer,
					company: company,
				},
				async: true,
				callback: (r) => {
					if (r.exc) {
						this.customer_outstanding_balance = 0.0;
						this.customer_outstanding_currency = null;
						return;
					}

					const data = r.message || {};
					this.customer_outstanding_balance = this.flt(
						data.total_outstanding || 0,
						this.currency_precision,
					);
					this.customer_outstanding_currency = data.currency || null;
				},
			});
		},

		// Filter addresses for autocomplete/search functionality
		addressFilter(item, queryText) {
			const searchText = queryText.toLowerCase();
			const fields = [
				item.address_title,
				item.address_line1,
				item.address_line2,
				item.city,
				item.name,
			];

			return fields.some((field) => field?.toLowerCase().includes(searchText));
		},

		// Open dialog to create new address
		new_address() {
			evntBus.emit(EVENT_NAMES.OPEN_NEW_ADDRESS, this.invoice_doc.customer);
		},

		//  Request payment (disabled feature)
		request_payment() {
			this.phone_dialog = false;

			if (!this.invoice_doc.contact_mobile) {
				this.showMessage('Please enter customer phone number', 'error');
				evntBus.emit(EVENT_NAMES.OPEN_EDIT_CUSTOMER);
				this.back_to_invoice();
				return;
			}

			evntBus.emit(EVENT_NAMES.FREEZE, { title: 'Please wait for payment...' });

			// Use precision = 2 for all currency amounts
			this.invoice_doc.payments.forEach((payment) => {
				payment.amount = flt(payment.amount, 2);
			});

			evntBus.emit(EVENT_NAMES.UNFREEZE);
		},
	},

	// ===== LIFECYCLE HOOKS =====
	// Vue.js lifecycle methods for component initialization and cleanup
	mounted() {
		// Wait for DOM to be ready before setting up event listeners
		this.$nextTick(() => {
			// Listen for settlement payment submission from Invoice component
			evntBus.on('submit_settlement_payment', () => {
				if (this.invoice_doc?._is_settlement && this.invoice_doc?.docstatus === 1) {
					this.submitSettlementPayment();
				}
			});

			// Listen for quick return mode toggle
			evntBus.on(EVENT_NAMES.TOGGLE_QUICK_RETURN, (value) => {
				this.quick_return = value;
			});

			// Listen for invoice document updates from Invoice component
			// This is the main event that loads invoice data into Payments component
			evntBus.on(EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT, (invoice_doc) => {
				this.invoice_doc = invoice_doc;

				// Reset posa_use_customer_credit_switch when new invoice is loaded
				this.posa_use_customer_credit_switch = false;

				if (!Array.isArray(this.invoice_doc.payments)) {
					this.showMessage('No payments array in invoice document', 'error');
					this.invoice_doc.payments = [];
				} else {
					this.invoice_doc.payments.forEach((payment, index) => {
						if (!payment.idx) payment.idx = index + 1;
					});
				}

				const default_payment = this.invoice_doc.payments.find(
					(payment) => payment.default == 1,
				);
				// Initialize is_credit_sale from invoice_doc if it exists, otherwise default to false
				this.is_credit_sale = invoice_doc.is_credit_sale || false;
				// Initialize due_date if credit sale is enabled but due_date is not set
				if (this.is_credit_sale && !invoice_doc.due_date) {
					// Set due_date to today's date as default
					if (typeof frappe !== 'undefined' && frappe.datetime) {
						this.invoice_doc.due_date = frappe.datetime.now_date();
					} else {
						// Fallback: use current date in YYYY-MM-DD format
						const today = new Date();
						this.invoice_doc.due_date = today.toISOString().split('T')[0];
					}
				}
				// Reset saved payments when receiving a new invoice_doc
				this.saved_payments_before_credit_sale = null;
				this.is_write_off_change = 0;
				// Reset for new invoice
				this.is_original_invoice_unpaid = false;

				// Fetch customer outstanding balance when invoice_doc is received
				if (invoice_doc?.customer) {
					this.get_customer_outstanding_balance();
				}

				if (default_payment && !invoice_doc.is_return) {
					// For settlement invoices, use outstanding_amount instead of grand_total
					if (invoice_doc._is_settlement) {
						// Settlement mode: use outstanding_amount (what's left to pay)
						// Calculate outstanding if not present
						let outstanding = flt(invoice_doc.outstanding_amount || 0, 2);
						if (outstanding <= 0) {
							// Fallback: calculate from grand_total and paid_amount
							const grandTotal = flt(invoice_doc.grand_total || 0, 2);
							const paidAmount = flt(invoice_doc.paid_amount || 0, 2);
							outstanding = flt(grandTotal - paidAmount, 2);
							if (outstanding < 0) outstanding = 0;
					}

					// Set payment amount with precision = 2
						default_payment.amount = outstanding;
						if (default_payment.base_amount !== undefined) {
							default_payment.base_amount = outstanding;
						}
						// Clear other payment methods (but keep them visible)
						this.invoice_doc.payments.forEach((payment) => {
							if (payment.idx !== default_payment.idx) {
								payment.amount = 0;
								if (payment.base_amount !== undefined) {
									payment.base_amount = 0;
								}
							}
						});
					} else {
						// Normal mode: use grand_total with precision = 2 for all currency amounts
						// Following user requirement: no rounded_total dependency at all
						// Always set default payment amount from grand_total, even if invoice exists
						const total = flt(invoice_doc.grand_total, 2);
						// Set payment amount with precision = 2
						default_payment.amount = total;
						if (default_payment.base_amount !== undefined) {
							default_payment.base_amount = total;
						}
					}
				}

				if (invoice_doc.is_return) {
					this.is_return = true;
					// Enable quick_return for all return invoices (quick return or normal)
					// Difference: quick return has no return_against, normal return has return_against
					// Both need input enabled and negative values
					this.quick_return = true;

					// Use grand_total only, no rounding
					// Following user requirement: no rounded_total dependency at all
					const total = invoice_doc.grand_total;
					const absTotal = Math.abs(total);

					// Reset all payments to zero first
					invoice_doc.payments.forEach((payment) => {
						payment.amount = 0;
						if (payment.base_amount !== undefined) payment.base_amount = 0;
					});

					// Calculate refundable amount based on original invoice payment status
					// If unpaid: no payments (payments = 0 and disabled)
					// If paid (partly or fully): refundable = (paid_amount / grand_total) × return_amount
					// Check if original invoice is unpaid
					this.is_original_invoice_unpaid = false;
					// Default: no refund (unpaid invoice)
					let refundableAmount = 0;

					// Check if POS Profile has posa_use_customer_credit enabled
					const useCustomerCredit = this.pos_profile?.posa_use_customer_credit == 1;

					if (invoice_doc._original_invoice_payment_info) {
						const orig = invoice_doc._original_invoice_payment_info;
						// Use precision = 2 for all currency amounts
						const origPaid = Math.abs(this.flt(orig.paid_amount || 0, 2));
						const origGrand = Math.abs(this.flt(orig.grand_total || 0, 2));

						// Check if original invoice is unpaid (paid_amount = 0 or very close to 0)
						if (origPaid <= 0.01) {
							// Original invoice is unpaid
							this.is_original_invoice_unpaid = true;
							refundableAmount = 0;
						} else if (origGrand > 0) {
							// Original invoice was paid (partly or fully)
							// Calculate refundable amount based on what was actually paid
							// refundable = (paid_amount / grand_total) × return_amount
							const paymentRatio = origPaid / origGrand;
							refundableAmount = absTotal * paymentRatio;
							this.is_original_invoice_unpaid = false;
						} else {
							// Original invoice had zero total, no refund
							this.is_original_invoice_unpaid = true;
							refundableAmount = 0;
						}
					} else {
						// No payment info available - assume unpaid (safe default)
						this.is_original_invoice_unpaid = true;
						refundableAmount = 0;
					}

					// Reset posa_use_customer_credit_switch to false
					// User can enable it manually if POS Profile has posa_use_customer_credit=1
					this.posa_use_customer_credit_switch = false; // Fill default payment with negative refundable amount
					// Only if there is a refundable amount AND posa_use_customer_credit_switch is disabled
					// If posa_use_customer_credit_switch is enabled, payments should remain 0
					if (
						default_payment &&
						refundableAmount > 0.01 &&
						!this.posa_use_customer_credit_switch
					) {
						// Set payment amount with precision = 2 for all currency amounts
						const neg = -flt(refundableAmount, 2);
						default_payment.amount = neg;
						if (default_payment.base_amount !== undefined)
							default_payment.base_amount = neg;
					}
					// If posa_use_customer_credit_switch is enabled or refundableAmount = 0, payments remain 0
				} else {
					// Reset quick_return if not a return invoice
					this.quick_return = false;
				}

				this.loyalty_amount = 0;
				this.get_addresses();
			});

			evntBus.on(EVENT_NAMES.REGISTER_POS_PROFILE, (data) => {
				this.pos_profile = data.pos_profile;
				if (data.pos_profile?.customer) {
					this.customer = data.pos_profile.customer;
					this.get_addresses();
				}
			});

			evntBus.on(EVENT_NAMES.ADD_THE_NEW_ADDRESS, (data) => {
				this.addresses.push(data);
				this.$forceUpdate();
			});
		});

		evntBus.on(EVENT_NAMES.UPDATE_CUSTOMER, (customer) => {
			if (this.customer != customer) {
				this.customer_credit_dict = [];
				this.redeem_customer_credit = false;
				this.is_cashback = true;
			}
			this.customer = customer;
			// Fetch customer outstanding balance when customer changes
			if (customer) {
				this.get_customer_outstanding_balance();
			}
		});

		evntBus.on(EVENT_NAMES.SET_POS_SETTINGS, (data) => {
			this.pos_settings = data;
		});

		evntBus.on(EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT, (data) => {
			this.customer_info = data;
		});

		evntBus.on(EVENT_NAMES.UPDATE_DUE_DATE, (date) => {
			if (this.invoice_doc) {
				this.invoice_doc.due_date = date;
			}
		});
	},

	// Component created hook
	// Sets up keyboard shortcuts when component is created
	created() {
		document.addEventListener('keydown', this.shortPay.bind(this));
	},

	// Component beforeUnmount hook
	// Cleans up all timeouts and event listeners before component is destroyed
	// Prevents memory leaks and orphaned event handlers
	beforeUnmount() {
		// Clean up all timeouts
		// Prevents pending debounce timers from executing after component destruction
		Object.keys(this.set_full_amount_timeouts || {}).forEach((idx) => {
			if (this.set_full_amount_timeouts[idx]) {
				clearTimeout(this.set_full_amount_timeouts[idx]);
			}
		});
		this.set_full_amount_timeouts = {};

		// Clean up all event listeners
		// Removes all event bus listeners to prevent memory leaks
		const events = [
			EVENT_NAMES.TOGGLE_QUICK_RETURN,
			EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT,
			EVENT_NAMES.REGISTER_POS_PROFILE,
			EVENT_NAMES.ADD_THE_NEW_ADDRESS,
			EVENT_NAMES.UPDATE_CUSTOMER,
			EVENT_NAMES.SET_POS_SETTINGS,
			EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT,
			EVENT_NAMES.UPDATE_DUE_DATE,
			'update_delivery_date',
		];

		events.forEach((event) => evntBus.$off(event));
	},

	// Component destroyed hook
	// Final cleanup when component is completely destroyed
	destroyed() {
		document.removeEventListener('keydown', this.shortPay);
	},

	// ===== WATCHERS =====
	// Vue.js watchers that react to data property changes
	// These automatically execute when watched properties change
	watch: {
		// Watch loyalty amount changes
		// Validates that loyalty points don't exceed available balance
		loyalty_amount(value) {
			if (value > this.available_pioints_amount) {
				this.invoice_doc.loyalty_amount = 0;
				this.invoice_doc.redeem_loyalty_points = 0;
				this.invoice_doc.loyalty_points = 0;
				this.showMessage(
					`Cannot enter points greater than available balance ${this.available_pioints_amount}`,
					'error',
				);
			} else {
				this.invoice_doc.loyalty_amount = this.flt(this.loyalty_amount);
				this.invoice_doc.redeem_loyalty_points = 1;
				this.invoice_doc.loyalty_points = this.flt(this.loyalty_amount);
			}
		},

		// Watch credit sale toggle changes
		// When enabled: saves current payments, clears all payment amounts
		// When disabled: restores saved payments or sets default cash payment
		is_credit_sale(value) {
			if (!this.invoice_doc) {
				return;
			}

			// Save is_credit_sale to invoice_doc for access from Invoice component
			this.invoice_doc.is_credit_sale = value ? true : false;

			// Emit event to notify Invoice component about credit sale status
			// This allows Invoice component to update its validation logic
			// Use posa_use_customer_credit_switch_changed event name (unified event name)
			evntBus.emit(EVENT_NAMES.POSA_USE_CUSTOMER_CREDIT_SWITCH_CHANGED, value);

			if (value) {
				// Credit sale is being enabled
				// If credit sale is enabled:
				// 1. Initialize due_date if not set
				if (!this.invoice_doc.due_date) {
					if (typeof frappe !== 'undefined' && frappe.datetime) {
						this.invoice_doc.due_date = frappe.datetime.now_date();
					} else {
						// Fallback: use current date in YYYY-MM-DD format
						const today = new Date();
						this.invoice_doc.due_date = today.toISOString().split('T')[0];
					}
				}

				// 2. Save current payment values before clearing them
				// 3. Clear all payment amounts to 0
				if (Array.isArray(this.invoice_doc.payments)) {
					// Save current payment values (deep copy)
					this.saved_payments_before_credit_sale = JSON.parse(
						JSON.stringify(this.invoice_doc.payments),
					);

					// Clear all payment amounts
					this.invoice_doc.payments.forEach((payment) => {
						payment.amount = 0;
						if (payment.base_amount !== undefined) {
							payment.base_amount = 0;
						}
					});
				}
			} else {
				// Credit sale is being disabled
				// Simply fill default payment method and clear others
				if (Array.isArray(this.invoice_doc.payments)) {
					const invoice_total = this.flt(this.invoice_doc.grand_total, 2);
					const defaultPayment = this.getDefaultPayment();

					if (defaultPayment) {
						// Fill default payment method
						defaultPayment.amount = invoice_total;
						if (defaultPayment.base_amount !== undefined) {
							defaultPayment.base_amount = invoice_total;
						}

						// Clear all other payment amounts
						this.invoice_doc.payments.forEach((payment) => {
							if (
								payment.idx !== defaultPayment.idx &&
								payment.name !== defaultPayment.name
							) {
								payment.amount = 0;
								if (payment.base_amount !== undefined) {
									payment.base_amount = 0;
								}
							}
						});
					}

					// Clear saved values
					this.saved_payments_before_credit_sale = null;

					// Emit payments update to notify other components
					evntBus.emit(
						EVENT_NAMES.PAYMENTS_UPDATED,
						JSON.parse(JSON.stringify(this.invoice_doc.payments)),
					);
				}
			}
			// Force update to recalculate computed properties
			this.$nextTick(() => {
				this.$forceUpdate();
			});
		},

		// Watch write-off toggle changes
		// When enabled: sets write_off_amount to outstanding_amount
		// When disabled: clears write_off_amount
		is_write_off_change(value) {
			if (value == 1) {
				this.invoice_doc.write_off_amount = this.outstanding_amount;
				this.invoice_doc.write_off_outstanding_amount_automatically = 1;
			} else {
				this.invoice_doc.write_off_amount = 0;
				this.invoice_doc.write_off_outstanding_amount_automatically = 0;
			}
		},

		// Watch payments array for deep changes
		// Forces recalculation of change_amount when any payment amount changes
		'invoice_doc.payments': {
			handler() {
				// Force update to recalculate computed properties
				this.$nextTick(() => {
					this.$forceUpdate();
				});
			},
			deep: true,
		},

		// Watch redeemed customer credit amount
		// Validates that redeemed amount doesn't exceed available credit
		redeemed_customer_credit(value) {
			if (value > this.available_customer_credit) {
				this.showMessage(
					`Customer credit can be redeemed up to ${this.available_customer_credit}`,
					'error',
				);
			}
		},

		// Watch posa_use_customer_credit_switch toggle
		// Simple logic based on posa_use_customer_credit_switch only
		posa_use_customer_credit_switch(value) {
			if (!this.invoice_doc || !this.invoice_doc.is_return) return;

			if (value === true) {
				// Switch is ON: clear all payment amounts (payments = 0)
				if (this.invoice_doc.payments) {
					this.invoice_doc.payments.forEach((payment) => {
						payment.amount = 0;
						if (payment.base_amount !== undefined) {
							payment.base_amount = 0;
						}
					});
					// Emit payments update to notify other components
					evntBus.emit(
						EVENT_NAMES.PAYMENTS_UPDATED,
						JSON.parse(JSON.stringify(this.invoice_doc.payments)),
					);
				}
			} else {
				// Switch is OFF: set payment amount to grand_total
				if (this.invoice_doc.payments && this.invoice_doc.payments.length > 0) {
					// Use grand_total only, no rounding
					// Following user requirement: no rounded_total dependency at all
					// Use precision = 2 for all currency amounts
					const grandTotal = Math.abs(this.flt(this.invoice_doc.grand_total || 0, 2));
					// Set first payment method to grand_total
					const firstPayment = this.invoice_doc.payments[0];
					if (firstPayment) {
						firstPayment.amount = grandTotal;
						if (firstPayment.base_amount !== undefined) {
							firstPayment.base_amount = grandTotal;
						}
						// Clear other payments
						for (let i = 1; i < this.invoice_doc.payments.length; i++) {
							this.invoice_doc.payments[i].amount = 0;
							if (this.invoice_doc.payments[i].base_amount !== undefined) {
								this.invoice_doc.payments[i].base_amount = 0;
							}
						}
						// Emit payments update to notify other components
						evntBus.emit(
							EVENT_NAMES.PAYMENTS_UPDATED,
							JSON.parse(JSON.stringify(this.invoice_doc.payments)),
						);
					}
				}
			}

			// Emit event to notify Invoice component
			evntBus.emit(EVENT_NAMES.POSA_USE_CUSTOMER_CREDIT_SWITCH_CHANGED, value);
			// Force update to recalculate computed properties
			this.$nextTick(() => {
				this.$forceUpdate();
			});
		},
	},
};
