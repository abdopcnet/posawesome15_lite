// ===== SECTION 1: IMPORTS =====
import { evntBus } from "../../bus";
import format from "../../format";
import { API_MAP } from "../../api_mapper.js";

const EVENT_NAMES = {
  OPEN_RETURNS: "open_returns",
  LOAD_RETURN_INVOICE: "load_return_invoice",
  SHOW_MESSAGE: "show_mesage",
};

const TABLE_HEADERS = [
  { title: "Customer", key: "customer", align: "start", sortable: true },
  { title: "Date", key: "posting_date", align: "start", sortable: true },
  { title: "Invoice Number", key: "name", align: "start", sortable: true },
  { title: "Amount", key: "grand_total", align: "end", sortable: false },
];

const DEFAULT_COMPANY = "Khaleej Women";

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
      company: "",
      invoice_name: "",
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
    showMessage(text, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
    },

    getCompany() {
      return this.pos_profile?.company || this.pos_opening_shift?.company || this.company || DEFAULT_COMPANY;
    },

    // Removed toggleSelectAll - not needed for radio buttons

    // Close the returns dialog and reset state
    close_dialog() {
      this.$nextTick(() => {
        this.invoicesDialog = false;
        this.selected = null; // Changed from [] to null
        this.dialog_data = [];
        this.invoice_name = "";
      });
    },

    // Search for invoices available for return
    search_invoices() {
      this.company = this.getCompany();

      this.isLoading = true;

      frappe.call({
        method: API_MAP.SALES_INVOICE.GET_INVOICES_FOR_RETURN,
        args: {
          invoice_name: this.invoice_name || "",
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
                  grand_total: item.grand_total,
                  currency: item.currency,
                  items: item.items || [],
                }))
              : [];

          this.displaySearchResultsMessage();
        },
        error: () => {
          this.isLoading = false;
          this.showMessage("Failed to search for invoices", "error");
        },
      });
    },

    // Display appropriate message based on search results
    displaySearchResultsMessage() {
      if (this.dialog_data.length === 0) {
        const message = this.invoice_name
          ? "No invoices found matching search"
          : `No submitted invoices available for return in company: ${this.company}`;
        this.showMessage(message, "info");
      } else {
        this.showMessage(`Found ${this.dialog_data.length} invoices available for return`, "success");
      }
    },

    async fetchOriginalInvoice(invoice_name) {
      try {
        const response = await frappe.call({
          method: API_MAP.FRAPPE.CLIENT_GET,
          args: {
            doctype: "Sales Invoice",
            name: invoice_name,
          },
        });
        return response.message;
      } catch (e) {
        this.showMessage("Failed to fetch original invoice", "error");
        return null;
      }
    },

    validateReturnItems(return_items, original_invoice) {
      const original_items = original_invoice.items.map((i) => i.item_code);
      const invalid_items = return_items.filter((item) => !original_items.includes(item.item_code));

      if (invalid_items.length > 0) {
        this.showMessage(
          `The following items are not in the original invoice: ${invalid_items.map((i) => i.item_code).join(", ")}`,
          "error"
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
          posa_offers: "[]",
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

    // Submit selected invoice for return
    async submit_dialog() {
      if (!this.selected || !this.dialog_data.length) {
        this.showMessage("Please select a valid invoice", "error");
        return;
      }

      const selectedItem = this.dialog_data.find((item) => item.name === this.selected);
      if (!selectedItem) {
        this.showMessage("Selected invoice not found", "error");
        return;
      }

      const return_doc = selectedItem;
      const original_invoice = await this.fetchOriginalInvoice(return_doc.name);

      if (!original_invoice) {
        this.showMessage("Original invoice not found", "error");
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
      this.invoice_name = "";

      // Emit event after closing
      evntBus.emit(EVENT_NAMES.LOAD_RETURN_INVOICE, { invoice_doc, return_doc });
    },
  },

  beforeDestroy() {
    // Clean up event listener
    evntBus.$off(EVENT_NAMES.OPEN_RETURNS);
  },
};
