// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';
// Frontend logging: console.log('[filename.js] method: function_name')

const EVENT_NAMES = {
	OPEN_RETURNS: 'open_returns',
	LOAD_RETURN_INVOICE: 'load_return_invoice',
	SHOW_MESSAGE: 'show_mesage',
};

const TABLE_HEADERS = [
	{ title: 'العميل', key: 'customer', align: 'start', sortable: true },
	{ title: 'التاريخ', key: 'posting_date', align: 'start', sortable: true },
	{ title: 'الوقت', key: 'posting_time', align: 'center', sortable: false },
	{ title: 'رقم الفاتورة', key: 'name', align: 'start', sortable: true },
	{ title: 'الحالة', key: 'invoice_status', align: 'center', sortable: false },
	{ title: 'المبلغ', key: 'grand_total', align: 'end', sortable: false },
];

const DEFAULT_COMPANY = 'Khaleej Women';

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
	mixins: [format],

	// ===== DATA =====
	data() {
		return {
			invoicesDialog: false,
			selected: null, // Changed from [] to null for single selection
			dialog_data: [],
			isLoading: false,
			company: '',
			invoice_name: '',
			pos_profile: null,
			pos_opening_shift: null,
			headers: TABLE_HEADERS,
		};
	},
	// ===== LIFECYCLE HOOKS =====
	beforeUnmount() {
		evntBus.off(EVENT_NAMES.OPEN_RETURNS);
	},

	created() {
		evntBus.on(EVENT_NAMES.OPEN_RETURNS, (data) => {
			this.invoicesDialog = true;
			this.pos_profile = data.pos_profile || null;
			this.pos_opening_shift = data.pos_opening_shift || null;
			this.company = this.getCompany();
			this.dialog_data = [];
			this.selected = null; // Changed from [] to null
			this.search_invoices();
		});
	},

	// ===== METHODS =====
	methods: {
		getInvoiceUrl(invoiceName) {
			// Build URL to open Sales Invoice document in new tab
			return `/app/sales-invoice/${encodeURIComponent(invoiceName)}`;
		},

		showMessage(text, color) {
			evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
		},

		getCompany() {
			return (
				this.pos_profile?.company ||
				this.pos_opening_shift?.company ||
				this.company ||
				DEFAULT_COMPANY
			);
		},

		// Removed toggleSelectAll - not needed for radio buttons

		// Close the returns dialog and reset state
		close_dialog() {
			this.$nextTick(() => {
				this.invoicesDialog = false;
				this.selected = null; // Changed from [] to null
				this.dialog_data = [];
				this.invoice_name = '';
			});
		},

		// Search for invoices available for return
		search_invoices() {
			this.company = this.getCompany();

			this.isLoading = true;

			frappe.call({
				method: API_MAP.SALES_INVOICE.GET_INVOICES_FOR_RETURN,
				args: {
					invoice_name: this.invoice_name || '',
					company: this.company,
					pos_profile: this.pos_profile?.name || null,
				},
				callback: (r) => {
					this.isLoading = false;

					this.dialog_data =
						r.message?.length > 0
							? r.message.map((item) => ({
									name: item.name,
									customer: item.customer,
									posting_date: item.posting_date,
									posting_time: item.posting_time || null,
									grand_total: item.grand_total,
									outstanding_amount: item.outstanding_amount || 0,
									paid_amount: item.paid_amount || 0,
									currency: item.currency,
									items: item.items || [],
									invoice_status: item.invoice_status || item.status || '-',
									status: item.status || '-',
							  }))
							: [];

					this.displaySearchResultsMessage();
				},
				error: () => {
					this.isLoading = false;
					// Failed to search for invoices
					this.showMessage('فشل البحث عن الفواتير', 'error');
				},
			});
		},

		// Display appropriate message based on search results
		displaySearchResultsMessage() {
			if (this.dialog_data.length === 0) {
				const message = this.invoice_name
					? // No invoices found matching search
					  'لم يتم العثور على فواتير مطابقة للبحث'
					: // No submitted invoices available for return in company
					  `لا توجد فواتير متاحة للإرجاع في الشركة: ${this.company}`;
			}
		},

		async fetchOriginalInvoice(invoice_name) {
			try {
				const response = await frappe.call({
					method: API_MAP.FRAPPE.CLIENT_GET,
					args: {
						doctype: 'Sales Invoice',
						name: invoice_name,
					},
				});
				return response.message;
			} catch (e) {
				console.log('[Returns.js] method: fetchOriginalInvoice');
				this.showMessage('فشل جلب الفاتورة الأصلية', 'error');
				return null;
			}
		},

		validateReturnItems(return_items, original_invoice) {
			const original_items = original_invoice.items.map((i) => i.item_code);
			const invalid_items = return_items.filter(
				(item) => !original_items.includes(item.item_code),
			);

			if (invalid_items.length > 0) {
				// The following items are not in the original invoice
				this.showMessage(
					`الأصناف التالية غير موجودة في الفاتورة الأصلية: ${invalid_items
						.map((i) => i.item_code)
						.join(', ')}`,
					'error',
				);
				return false;
			}
			return true;
		},

		createReturnInvoiceDoc(return_doc) {
			return {
				items: return_doc.items.map((item) => ({
					...item,
					qty: Math.abs(item.qty) * -1,
					stock_qty: Math.abs(item.stock_qty || item.qty) * -1,
					amount: Math.abs(item.amount) * -1,
					posa_row_id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
					posa_offers: '[]',
					posa_offer_applied: 0,
					posa_is_offer: 0,
					posa_is_replace: 0,
					is_free_item: 0,
					sales_invoice_item: item.name,
					name: null,
				})),
				is_return: 1,
				return_against: return_doc.name,
				company: this.getCompany(),
				customer: return_doc.customer,
				posa_pos_opening_shift: this.pos_opening_shift?.name,
				pos_opening_shift: this.pos_opening_shift || null,
				pos_profile: this.pos_profile || null,
			};
		},

		// Select invoice (similar to Drafts.js)
		selectInvoice(invoice) {
			this.selected = invoice;
		},

		// Submit selected invoice for return
		async submit_dialog() {
			if (!this.selected || !this.dialog_data.length) {
				// Please select a valid invoice
				this.showMessage('يرجى اختيار فاتورة صحيحة', 'error');
				return;
			}

			const selectedItem = this.selected;
			if (!selectedItem) {
				// Selected invoice not found
				this.showMessage('الفاتورة المحددة غير موجودة', 'error');
				return;
			}

			const return_doc = selectedItem;
			const original_invoice = await this.fetchOriginalInvoice(return_doc.name);

			if (!original_invoice) {
				// Original invoice not found
				this.showMessage('الفاتورة الأصلية غير موجودة', 'error');
				return;
			}

			if (!this.validateReturnItems(return_doc.items, original_invoice)) {
				return;
			}

			const invoice_doc = this.createReturnInvoiceDoc(return_doc);

			// Close dialog first
			this.invoicesDialog = false;

			// Reset selection
			this.selected = null;
			this.dialog_data = [];
			this.invoice_name = '';

			// Emit event after closing with original invoice payment info
			evntBus.emit(EVENT_NAMES.LOAD_RETURN_INVOICE, {
				invoice_doc,
				return_doc,
				original_invoice_payment_info: {
					grand_total: this.flt(original_invoice.grand_total || 0),
					paid_amount: this.flt(original_invoice.paid_amount || 0),
					outstanding_amount: this.flt(original_invoice.outstanding_amount || 0),
				},
			});
		},
	},

	beforeDestroy() {
		// Clean up event listener
		evntBus.$off(EVENT_NAMES.OPEN_RETURNS);
	},
};
