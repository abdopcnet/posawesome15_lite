// ===== SECTION 1: IMPORTS =====
import { evntBus } from "../../bus";
import format from "../../format";
// Frontend logging: Use console.log/error/warn directly

const EVENT_NAMES = {
  OPEN_DRAFTS_DIALOG: "open_drafts_dialog",
  LOAD_DRAFT_INVOICE: "load_draft_invoice",
  SHOW_MESSAGE: "show_mesage",
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
          text: "يرجى اختيار فاتورة",
          color: "error",
        });
        return;
      }

      // Emit event to load the selected draft invoice
      evntBus.emit(EVENT_NAMES.LOAD_DRAFT_INVOICE, this.selected);
      this.draftsDialog = false;
      this.selected = null;
    },
  },
};

