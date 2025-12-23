// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';

const EVENT_NAMES = {
	OPEN_SETTLEMENT_DIALOG: 'open_settlement_dialog',
	LOAD_SETTLEMENT_INVOICE: 'load_settlement_invoice',
	SHOW_MESSAGE: 'show_mesage',
};

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
	mixins: [format],

	// ===== DATA =====
	data() {
		return {
			settlementDialog: false,
			selected: null,
			dialog_data: [],
			isLoading: false,
			pos_profile: null,
			pos_opening_shift: null,
		};
	},

	// ===== LIFECYCLE HOOKS =====
	beforeUnmount() {
		evntBus.off(EVENT_NAMES.OPEN_SETTLEMENT_DIALOG);
		evntBus.off('register_pos_profile');
	},

	created() {
		// Listen for POS profile registration
		evntBus.on('register_pos_profile', (data) => {
			this.pos_profile = data.pos_profile;
			this.pos_opening_shift = data.pos_opening_shift;
		});

		// Listen for settlement dialog open event
		evntBus.on(EVENT_NAMES.OPEN_SETTLEMENT_DIALOG, () => {
			console.log('[OutstandingPayments.js] method: created');
			this.settlementDialog = true;
			this.selected = null;
			this.isLoading = true;
			this.fetchSettlementInvoices();
		});
	},

	// ===== METHODS =====
	methods: {
		async fetchSettlementInvoices() {
			try {
				this.isLoading = true;

				const response = await frappe.call({
					method: API_MAP.SALES_INVOICE.GET_SETTLEMENT_INVOICES,
					args: {
						pos_profile: this.pos_profile?.name || null,
						pos_opening_shift: this.pos_opening_shift?.name || null,
						user: frappe.session.user,
					},
				});

				if (response.message) {
					this.dialog_data = response.message;
					console.log('[OutstandingPayments.js] method: fetchSettlementInvoices');
				} else {
					this.dialog_data = [];
				}
			} catch (error) {
				console.log('[OutstandingPayments.js] method: fetchSettlementInvoices');
				evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
					text: 'فشل جلب الفواتير غير المسددة',
					color: 'error',
				});
				this.dialog_data = [];
			} finally {
				this.isLoading = false;
			}
		},

		selectInvoice(invoice) {
			this.selected = invoice;
		},

		async submit_dialog() {
			if (!this.selected) {
				evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
					text: 'يرجى اختيار فاتورة للسداد',
					color: 'error',
				});
				return;
			}

			// Prevent duplicate submission
			if (this.settlementDialog === false) {
				return;
			}

			const selectedInvoice = this.selected;
			this.settlementDialog = false;
			this.selected = null;

			// Emit after closing dialog to prevent multiple clicks
			this.$nextTick(() => {
				evntBus.emit(EVENT_NAMES.LOAD_SETTLEMENT_INVOICE, selectedInvoice);
			});
		},
	},
};
