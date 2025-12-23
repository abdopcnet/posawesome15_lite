// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';
// Frontend logging: Use console.log/error/warn directly

const EVENT_NAMES = {
	OPEN_DRAFTS_DIALOG: 'open_drafts_dialog',
	LOAD_DRAFT_INVOICE: 'load_draft_invoice',
	SHOW_MESSAGE: 'show_mesage',
};

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
	mixins: [format],

	// ===== DATA =====
	data() {
		return {
			draftsDialog: false,
			selected: null,
			dialog_data: [],
			isLoading: false,
		};
	},

	// ===== LIFECYCLE HOOKS =====
	beforeUnmount() {
		evntBus.off(EVENT_NAMES.OPEN_DRAFTS_DIALOG);
	},

	created() {
		evntBus.on(EVENT_NAMES.OPEN_DRAFTS_DIALOG, (data) => {
			console.log('[Drafts.js] Opening drafts dialog with', data?.length || 0, 'invoices');
			this.draftsDialog = true;
			this.dialog_data = data || [];
			this.selected = null;
			this.isLoading = false;
		});
	},

	// ===== METHODS =====
	methods: {
		selectInvoice(invoice) {
			this.selected = invoice;
		},

		submit_dialog() {
			if (!this.selected) {
				evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
					text: 'يرجى اختيار فاتورة',
					color: 'error',
				});
				return;
			}

			// Prevent duplicate submission
			if (this.draftsDialog === false) {
				return;
			}

			// Emit event to load the selected draft invoice (only once)
			const selectedInvoice = this.selected;
			this.draftsDialog = false;
			this.selected = null;

			// Emit after closing dialog to prevent multiple clicks
			this.$nextTick(() => {
				evntBus.emit(EVENT_NAMES.LOAD_DRAFT_INVOICE, selectedInvoice);
			});
		},

		async deleteInvoice(invoice) {
			if (!invoice || !invoice.name) {
				return;
			}

			// Confirm deletion
			if (!confirm(`هل أنت متأكد من حذف الفاتورة ${invoice.name}؟`)) {
				return;
			}

			try {
				// Show loading
				evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
					text: 'جاري حذف الفاتورة...',
					color: 'info',
				});

				// Delete invoice using API
				const response = await frappe.call({
					method: API_MAP.SALES_INVOICE.DELETE,
					args: {
						invoice_name: invoice.name,
					},
				});

				if (response.message) {
					// Remove invoice from list
					this.dialog_data = this.dialog_data.filter((inv) => inv.name !== invoice.name);

					// Clear selection if deleted invoice was selected
					if (this.selected && this.selected.name === invoice.name) {
						this.selected = null;
					}

					evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
						text: `تم حذف الفاتورة ${invoice.name} بنجاح`,
						color: 'success',
					});
				}
			} catch (error) {
				console.error('[Drafts.js] deleteInvoice error:', error);
				evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, {
					text: 'فشل حذف الفاتورة',
					color: 'error',
				});
			}
		},
	},
};
