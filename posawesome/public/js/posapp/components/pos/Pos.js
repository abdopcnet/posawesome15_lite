// ===== IMPORTS =====
import { evntBus } from "../../bus";
import ItemsSelector from "./ItemsSelector.vue";
import Invoice from "./Invoice.vue";
import OpeningDialog from "./OpeningDialog.vue";
import OpenShiftsWarning from "./OpenShiftsWarning.vue";
import Payments from "./Payments.vue";
import PosOffers from "./PosOffers.vue";
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
    OpenShiftsWarning,
    Payments,
    ClosingDialog,
    Returns,
    PosOffers,
    NewAddress,
  },

  data() {
    return {
      dialog: false,
      showOpenShiftsWarning: false,
      openShifts: [],
      pos_profile: null,
      pos_opening_shift: null,
      payment: false,
      offers: false,
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
          _timestamp: Date.now(),
        };
      });
    },

    handleOfferRemoved(removedOffer) {
      this.offerApplied = null;

      // Pass the removed offer object (or true for backward compatibility)
      this.offerRemoved = removedOffer || true;

      // Reset offerRemoved flag after a short delay
      this.$nextTick(() => {
        setTimeout(() => {
          this.offerRemoved = false;
        }, 100);
      });
    },

    async check_opening_entry() {
      try {
        // First check if user has multiple open shifts
        const allShiftsResponse = await frappe.call({
          method: API_MAP.POS_OPENING_SHIFT.GET_ALL_OPEN_SHIFTS,
        });

        console.log("[Pos.js] All open shifts response:", allShiftsResponse);

        if (
          allShiftsResponse.message.success &&
          allShiftsResponse.message.count > 1
        ) {
          // User has MULTIPLE open shifts - show warning component
          console.log(
            "[Pos.js] Multiple open shifts found:",
            allShiftsResponse.message.count
          );
          this.openShifts = allShiftsResponse.message.shifts;
          this.showOpenShiftsWarning = true;
          return;
        }

        // Only one or zero shifts - proceed normally
        const response = await frappe.call({
          method: API_MAP.POS_OPENING_SHIFT.GET_CURRENT_SHIFT_NAME,
        });

        console.log("[Pos.js] check_opening_entry response:", response);
        console.log("[Pos.js] response.message:", response.message);
        console.log(
          "[Pos.js] response.message.success:",
          response.message?.success
        );
        console.log("[Pos.js] response.message.data:", response.message?.data);

        if (response.message.success && response.message.data) {
          // Active shift exists - load full profile data
          console.log(
            "[Pos.js] Active shift found, loading profile:",
            response.message.data.pos_profile
          );
          await this.get_full_profile_data(response.message.data.pos_profile);
        } else {
          // No active shift - show opening dialog
          console.log("[Pos.js] No active shift, showing opening dialog");
          this.create_opening_voucher();
        }
      } catch (error) {
        console.log("[Pos.js] check_opening_entry error:", error);
        this.show_message("فشل التحقق من إدخال الافتتاح", "error");
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

        // Check and apply language from POS Profile

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
        };

        // Load offers for this profile
        await this.get_offers(pos_profile.name);

        // Emit events to notify other components
        evntBus.emit(EVENTS.REGISTER_POS_PROFILE, shift_data);
        evntBus.emit(EVENTS.SET_COMPANY, { name: pos_profile.company });
        // Profile loaded
        evntBus.emit(EVENTS.SET_POS_OPENING_SHIFT, pos_opening_shift);
      } catch (error) {
        console.log("[Pos.js] get_full_profile_data error:", error);
        this.show_message("فشل تحميل بيانات الملف الشخصي", "error");
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
        console.log("[Pos.js] get_pos_setting error:", error);
      }
    },

    // ===== OFFERS METHODS =====
    async get_offers(pos_profile) {
      try {
        // Check if auto fetch offers is enabled (handle different value types)
        const offersEnabled =
          this.pos_profile?.posa_auto_fetch_offers !== 0 &&
          this.pos_profile?.posa_auto_fetch_offers !== "0" &&
          this.pos_profile?.posa_auto_fetch_offers !== false &&
          this.pos_profile?.posa_auto_fetch_offers !== null &&
          this.pos_profile?.posa_auto_fetch_offers !== undefined;

        if (!offersEnabled) {
          evntBus.emit(EVENTS.SET_OFFERS, []); // Clear offers
          return;
        }

        const response = await frappe.call({
          method: API_MAP.POS_OFFER.GET_OFFERS_FOR_PROFILE,
          args: {
            profile: pos_profile,
          },
        });

        if (response.message) {
          evntBus.emit(EVENTS.SET_OFFERS, response.message);
        } else {
          // Failed to load offers
          this.show_message("فشل تحميل العروض", "error");
        }
      } catch (error) {
        console.log("[Pos.js] get_offers error:", error);
        this.show_message("فشل تحميل العروض", "error");
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
          this.show_message("فشل تحميل بيانات الإغلاق", "error");
        }
      } catch (error) {
        console.log("[Pos.js] get_closing_data error:", error);
        this.show_message("فشل تحميل بيانات الإغلاق", "error");
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
          // Cashier shift closed successfully
          this.show_message("تم إغلاق نوبة الصراف بنجاح", "success");
          await this.check_opening_entry();
        } else {
          // Failed to close cashier shift
          this.show_message("فشل إغلاق نوبة الصراف", "error");
        }
      } catch (error) {
        console.log("[Pos.js] submit_closing_pos error:", error);
        this.show_message("فشل إغلاق نوبة الصراف", "error");
      }
    },

    // ===== PANEL SWITCHING METHODS =====
    switchPanel(panelType, show) {
      const isActive = show === "true";

      this.payment = panelType === "payment" && isActive;
      this.offers = panelType === "offers" && isActive;
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

      // Closing shift events
      evntBus.on(EVENTS.OPEN_CLOSING_DIALOG, this.handleOpenClosingDialog);
      evntBus.on(EVENTS.SUBMIT_CLOSING_POS, this.handleSubmitClosingPos);
    },

    unregisterEventListeners() {
      evntBus.$off(EVENTS.CLOSE_OPENING_DIALOG, this.handleCloseOpeningDialog);
      evntBus.$off(EVENTS.REGISTER_POS_DATA, this.handleRegisterPosData);
      evntBus.$off(EVENTS.SHOW_PAYMENT, this.handleShowPayment);
      evntBus.$off(EVENTS.SHOW_OFFERS, this.handleShowOffers);
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
