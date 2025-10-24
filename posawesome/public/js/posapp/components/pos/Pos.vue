<template>
  <div class="pos-container">
    <ClosingDialog></ClosingDialog>
    <Returns></Returns>
    <NewAddress></NewAddress>
    <OpeningDialog v-if="dialog" :dialog="dialog"></OpeningDialog>

    <div v-show="!dialog" class="pos-main-wrapper">
      <div class="pos-left-panel">
        <div v-show="!payment && !offers && !coupons" class="panel-content">
          <ItemsSelector></ItemsSelector>
        </div>
        <div v-show="offers" class="panel-content">
          <PosOffers
            @offerApplied="handleOfferApplied"
            @offerRemoved="handleOfferRemoved"
          ></PosOffers>
        </div>
        <div v-show="coupons" class="panel-content">
          <PosCoupons></PosCoupons>
        </div>
        <div v-show="payment" class="panel-content">
          <Payments ref="payments" @request-print="onPrintRequest"></Payments>
        </div>
      </div>

      <div class="pos-right-panel">
        <div class="panel-content">
          <Invoice :is_payment="payment" :offer-applied="offerApplied" :offer-removed="offerRemoved"></Invoice>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// ===== IMPORTS =====
import { evntBus } from "../../bus";
import ItemsSelector from "./ItemsSelectorOptimized.vue";
import Invoice from "./InvoiceOptimized.vue";
import OpeningDialog from "./OpeningDialog.vue";
import Payments from "./Payments.vue";
import PosOffers from "./PosOffers.vue";
import PosCoupons from "./PosCoupons.vue";
import ClosingDialog from "./ClosingDialog.vue";
import NewAddress from "./NewAddress.vue";
import Returns from "./Returns.vue";
import { API_MAP } from "../../api_mapper.js";

// ===== EVENT BUS EVENTS =====
const EVENTS = {
  CLOSE_OPENING_DIALOG: "close_opening_dialog",
  REGISTER_POS_DATA: "register_pos_data",
  REGISTER_POS_PROFILE: "register_pos_profile",
  SET_COMPANY: "set_company",
  SET_POS_OPENING_SHIFT: "set_pos_opening_shift",
  SET_OFFERS: "set_offers",
  SET_POS_SETTINGS: "set_pos_settings",
  SHOW_PAYMENT: "show_payment",
  SHOW_OFFERS: "show_offers",
  SHOW_COUPONS: "show_coupons",
  SHOW_MESSAGE: "show_mesage",
  OPEN_CLOSING_DIALOG: "open_closing_dialog",
  OPEN_CLOSING_DIALOG_EMIT: "open_ClosingDialog",
  SUBMIT_CLOSING_POS: "submit_closing_pos",
  REQUEST_INVOICE_PRINT: "request_invoice_print",
  LOAD_POS_PROFILE: "LoadPosProfile",
};

// ===== COMPONENT =====
export default {
  name: "PosMain",

  components: {
    ItemsSelector,
    Invoice,
    OpeningDialog,
    Payments,
    ClosingDialog,
    Returns,
    PosOffers,
    PosCoupons,
    NewAddress,
  },

  data() {
    return {
      dialog: false,
      pos_profile: null,
      pos_opening_shift: null,
      payment: false,
      offers: false,
      coupons: false,
      offerApplied: null,
      offerRemoved: false,
    };
  },

  methods: {
    // ===== OFFER EVENT HANDLERS =====
    handleOfferApplied(offer) {
      
      // Reset first to null to ensure reactivity
      this.offerApplied = null;
      this.offerRemoved = false;
      
      // Use $nextTick to ensure reset is processed
      this.$nextTick(() => {
        // Create new object with timestamp to force reactivity
        this.offerApplied = {
          ...offer,
          _timestamp: Date.now()
        };
      });
    },

    handleOfferRemoved() {
      this.offerApplied = null;
      this.offerRemoved = true;
      
      // Reset offerRemoved flag after a short delay
      this.$nextTick(() => {
        setTimeout(() => {
          this.offerRemoved = false;
        }, 100);
      });
    },

    async check_opening_entry() {
      try {
        const response = await frappe.call({
          method: API_MAP.POS_OPENING_SHIFT.GET_CURRENT_SHIFT_NAME,
        });

        if (response.message.success && response.message.data) {
          // Active shift exists - load full profile data
          await this.get_full_profile_data(response.message.data.pos_profile);
        } else {
          // No active shift - show message and create new opening voucher
          this.show_message(
            response.message.message ||
              "No opening shift found, a new opening entry will be created.",
            "info"
          );
          this.create_opening_voucher();
        }
      } catch (error) {
        console.error("Pos.vue(check_opening_entry): Error", error);
        this.show_message("Failed to check opening entry", "error");
      }
    },

    async get_full_profile_data(pos_profile_name) {
      try {
        // Fetch POS profile
        const profileResponse = await frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "POS Profile",
            name: pos_profile_name,
          },
        });

        if (!profileResponse.message) {
          throw new Error("Failed to load POS profile");
        }

        const pos_profile = profileResponse.message;

        // Fetch current shift data
        const shiftResponse = await frappe.call({
          method: API_MAP.POS_OPENING_SHIFT.GET_CURRENT_SHIFT_NAME,
        });

        const pos_opening_shift = shiftResponse.message.success
          ? shiftResponse.message.data
          : null;

        // Update component state
        this.pos_profile = pos_profile;
        this.pos_opening_shift = pos_opening_shift;

        // Prepare data for event bus
        const shift_data = {
          pos_profile: pos_profile,
          pos_opening_shift: pos_opening_shift,
          company: { name: pos_profile.company },
          stock_settings: { allow_negative_stock: 0 },
        };

        // Load offers for this profile
        await this.get_offers(pos_profile.name);

        // Emit events to notify other components
        evntBus.emit(EVENTS.REGISTER_POS_PROFILE, shift_data);
        evntBus.emit(EVENTS.SET_COMPANY, { name: pos_profile.company });
        // Profile loaded
        evntBus.emit(EVENTS.SET_POS_OPENING_SHIFT, pos_opening_shift);
      } catch (error) {
        console.error("Pos.vue(get_full_profile_data): Error", error);
        this.show_message("Failed to load profile data", "error");
      }
    },

    /**
     * Show opening dialog to create new shift
     */
    create_opening_voucher() {
      this.dialog = true;
    },

    /**
     * Load POS settings from database
     */
    async get_pos_setting() {
      try {
        const doc = await frappe.db.get_doc("POS Settings", undefined);
        evntBus.emit(EVENTS.SET_POS_SETTINGS, doc);
      } catch (error) {
        console.error("Pos.vue(get_pos_setting): Error", error);
      }
    },

    // ===== OFFERS METHODS =====
    async get_offers(pos_profile) {
      try {
        const response = await frappe.call({
          method: API_MAP.POS_OFFER.GET_OFFERS_FOR_PROFILE,
          args: {
            profile: pos_profile,
          },
        });

        if (response.message) {
          evntBus.emit(EVENTS.SET_OFFERS, response.message);
        } else {
          this.show_message("Failed to load offers", "error");
        }
      } catch (error) {
        console.error("Pos.vue(get_offers): Error", error);
        this.show_message("Failed to load offers", "error");
      }
    },

    // ===== CLOSING SHIFT METHODS =====
    async get_closing_data() {
      try {
        const response = await frappe.call({
          method: API_MAP.POS_CLOSING_SHIFT.MAKE_CLOSING_SHIFT,
          args: {
            opening_shift: this.pos_opening_shift,
          },
        });

        if (response.message) {
          evntBus.emit(EVENTS.OPEN_CLOSING_DIALOG_EMIT, response.message);
        } else {
          // Failed to load closing data
          this.show_message("Failed to load closing data", "error");
        }
      } catch (error) {
        console.error("Pos.vue(get_closing_data): Error", error);
        this.show_message("Failed to load closing data", "error");
      }
    },

    async submit_closing_pos(data) {
      try {
        const response = await frappe.call({
          method: API_MAP.POS_CLOSING_SHIFT.SUBMIT_CLOSING_SHIFT,
          args: {
            closing_shift: data,
          },
        });

        if (response.message) {
          // Closing shift submitted successfully
          this.show_message("Cashier shift closed successfully", "success");
          await this.check_opening_entry();
        } else {
          this.show_message("Failed to close cashier shift", "error");
        }
      } catch (error) {
        console.error("Pos.vue(submit_closing_pos): Error", error);
        this.show_message("Failed to close cashier shift", "error");
      }
    },

    // ===== PANEL SWITCHING METHODS =====
    switchPanel(panelType, show) {
      const isActive = show === "true";

      this.payment = panelType === "payment" && isActive;
      this.offers = panelType === "offers" && isActive;
      this.coupons = panelType === "coupons" && isActive;
    },

    // ===== UTILITY METHODS =====
    show_message(text, color) {
      evntBus.emit(EVENTS.SHOW_MESSAGE, { text, color });
    },

    onPrintRequest() {
      evntBus.emit(EVENTS.REQUEST_INVOICE_PRINT);
    },

    // ===== EVENT BUS HANDLERS =====

    registerEventListeners() {
      // Opening dialog events
      evntBus.on(EVENTS.CLOSE_OPENING_DIALOG, this.handleCloseOpeningDialog);
      evntBus.on(EVENTS.REGISTER_POS_DATA, this.handleRegisterPosData);

      // Panel switching events
      evntBus.on(EVENTS.SHOW_PAYMENT, this.handleShowPayment);
      evntBus.on(EVENTS.SHOW_OFFERS, this.handleShowOffers);
      evntBus.on(EVENTS.SHOW_COUPONS, this.handleShowCoupons);

      // Closing shift events
      evntBus.on(EVENTS.OPEN_CLOSING_DIALOG, this.handleOpenClosingDialog);
      evntBus.on(EVENTS.SUBMIT_CLOSING_POS, this.handleSubmitClosingPos);
    },

    unregisterEventListeners() {
      evntBus.$off(EVENTS.CLOSE_OPENING_DIALOG, this.handleCloseOpeningDialog);
      evntBus.$off(EVENTS.REGISTER_POS_DATA, this.handleRegisterPosData);
      evntBus.$off(EVENTS.SHOW_PAYMENT, this.handleShowPayment);
      evntBus.$off(EVENTS.SHOW_OFFERS, this.handleShowOffers);
      evntBus.$off(EVENTS.SHOW_COUPONS, this.handleShowCoupons);
      evntBus.$off(EVENTS.OPEN_CLOSING_DIALOG, this.handleOpenClosingDialog);
      evntBus.$off(EVENTS.SUBMIT_CLOSING_POS, this.handleSubmitClosingPos);
      evntBus.$off(EVENTS.LOAD_POS_PROFILE);
    },

    // Event handler methods
    handleCloseOpeningDialog() {
      this.dialog = false;
    },

    handleRegisterPosData(data) {
      this.pos_profile = data.pos_profile;
      this.pos_opening_shift = data.pos_opening_shift;
      this.get_offers(this.pos_profile.name);
      evntBus.emit(EVENTS.REGISTER_POS_PROFILE, data);
    },

    handleShowPayment(data) {
      this.switchPanel("payment", data);
    },

    handleShowOffers(data) {
      this.switchPanel("offers", data);
    },

    handleShowCoupons(data) {
      this.switchPanel("coupons", data);
    },

    handleOpenClosingDialog() {
      this.get_closing_data();
    },

    handleSubmitClosingPos(data) {
      this.submit_closing_pos(data);
    },
  },

  // ===== LIFECYCLE HOOKS =====

  mounted() {
    this.$nextTick(() => {
      // Initialize POS system
      this.check_opening_entry();
      this.get_pos_setting();

      // Register event listeners
      this.registerEventListeners();
    });
  },

  beforeUnmount() {
    // Clean up event listeners
    this.unregisterEventListeners();
  },
};
</script>

<style scoped>
/* ===== MAIN CONTAINER ===== */
/* Simple background - no gradient to avoid affecting ERP doctypes */
.pos-container {
  padding: 0 3px 3px 3px; /* top=0, right=3px, bottom=3px, left=3px */
  background: #f8f9fa; /* Simple light gray background */
  min-height: 100vh;
  overflow: visible;
}

/* ===== MAIN WRAPPER - FLEXBOX LAYOUT ===== */
.pos-main-wrapper {
  display: flex;
  gap: 5px;
  min-height: calc(100vh - 130px) !important;
  width: 100%;
  margin-top: 3px !important;
}

/* ===== LEFT PANEL (Items/Offers/Coupons/Payments) ===== */
.pos-left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

/* ===== RIGHT PANEL (Invoice) ===== */
.pos-right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ===== PANEL CONTENT WRAPPER ===== */
.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.panel-content:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: rgba(25, 118, 210, 0.2);
}

/* ===== NESTED COMPONENT STYLING ===== */
.panel-content > * {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 1280px) {
  .pos-main-wrapper {
    gap: 3px;
  }

  .panel-content {
    border-radius: 6px;
  }
}

@media (max-width: 1024px) {
  .pos-container {
    padding: 0 2px 2px 2px; /* top=0, right=2px, bottom=2px, left=2px */
  }

  .pos-main-wrapper {
    gap: 2px;
    min-height: calc(100vh - 48px);
  }

  .panel-content {
    border-radius: 6px;
  }
}

@media (max-width: 768px) {
  .pos-container {
    padding: 0 2px 2px 2px; /* top=0, right=2px, bottom=2px, left=2px */
  }

  .pos-main-wrapper {
    flex-direction: column;
    gap: 3px;
  }

  .pos-left-panel,
  .pos-right-panel {
    flex: 1;
    min-height: 300px;
  }
}

/* ===== SMOOTH TRANSITIONS FOR PANEL SWITCHING ===== */
.pos-left-panel > div {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
  pointer-events: none;
}

.pos-left-panel > div[style*="display: none"] {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.pos-left-panel > div:not([style*="display: none"]) {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

/* ===== LOADING ANIMATION SUPPORT ===== */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-content {
  animation: fadeIn 0.3s ease;
}

/* ===== PROFESSIONAL SCROLLBAR STYLING ===== */
.panel-content ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.panel-content ::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.panel-content ::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.panel-content ::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
}

/* ===== ENHANCED FOCUS STATES ===== */
.panel-content:focus-within {
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.2);
  border-color: rgba(25, 118, 210, 0.3);
}
</style>
