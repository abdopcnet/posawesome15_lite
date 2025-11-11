import { ref, onMounted, onBeforeUnmount } from "vue";
import { evntBus } from "../../bus";
import format from "../../format";
import { API_MAP } from "../../api_mapper.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Event names for bus communication
 */
const EVENT_NAMES = {
	OPEN_CLOSING_DIALOG: "open_ClosingDialog",
	REGISTER_POS_PROFILE: "register_pos_profile",
	SUBMIT_CLOSING_POS: "submit_closing_pos",
};

/**
 * Payment method icons and colors
 */
const PAYMENT_ICONS = {
	Cash: { icon: "mdi-cash", color: "#4CAF50" },
	Card: { icon: "mdi-credit-card", color: "#2196F3" },
	"Credit Card": { icon: "mdi-credit-card", color: "#2196F3" },
	"Debit Card": { icon: "mdi-credit-card-outline", color: "#FF9800" },
	"Bank Transfer": { icon: "mdi-bank-transfer", color: "#9C27B0" },
	"Mobile Payment": { icon: "mdi-cellphone", color: "#E91E63" },
	"Digital Wallet": { icon: "mdi-wallet", color: "#00BCD4" },
	Check: { icon: "mdi-checkbook", color: "#795548" },
	Voucher: { icon: "mdi-ticket", color: "#FF5722" },
};

/**
 * Default payment icon for unknown methods
 */
const DEFAULT_PAYMENT_ICON = { icon: "mdi-currency-usd", color: "#607D8B" };

/**
 * Table column headers configuration
 */
const TABLE_HEADERS = {
	PAYMENT_METHOD: {
		title: "Payment Method",
		key: "mode_of_payment",
		align: "start",
		sortable: true,
	},
	SYSTEM_TOTAL: {
		title: "System Total",
		align: "end",
		sortable: true,
		key: "opening_amount",
	},
	ACTUAL_COUNT: {
		title: "Actual Count",
		key: "closing_amount",
		align: "end",
		sortable: true,
	},
	EXPECTED_TOTAL: {
		title: "Expected Total",
		key: "expected_amount",
		align: "end",
		sortable: false,
	},
	DIFFERENCE: {
		title: "Difference",
		key: "difference",
		align: "end",
		sortable: false,
	},
};

/**
 * Validation rules
 */
const VALIDATION_RULES = {
	MAX_CHARS: (v) => v.length <= 20 || "Input too long!",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
	name: "ClosingDialog",

	mixins: [format],

	setup() {
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// STATE
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		const closingDialog = ref(false);
		const itemsPerPage = ref(20);
		const dialog_data = ref({ payment_reconciliation: [] });
		const pos_profile = ref(null);
		const headers = ref([
			TABLE_HEADERS.PAYMENT_METHOD,
			TABLE_HEADERS.SYSTEM_TOTAL,
			TABLE_HEADERS.ACTUAL_COUNT,
		]);

		// Time control
		const isClosingAllowed = ref(true);
		const closingTimeMessage = ref("");

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// DIALOG ACTIONS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Close the closing dialog
		 * Resets dialog visibility to false
		 */
		const close_dialog = () => {
			closingDialog.value = false;
		};

		/**
		 * Submit closing dialog data
		 * Emits submit event with payment reconciliation data
		 */
		const submit_dialog = () => {
			evntBus.emit(EVENT_NAMES.SUBMIT_CLOSING_POS, dialog_data.value);
			closingDialog.value = false;
		};

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// HELPER METHODS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Get payment method icon and color
		 * @param {string} paymentMethod - Payment method name
		 * @returns {Object} Icon configuration with icon name and color
		 */
		const getPaymentIcon = (paymentMethod) => {
			const method = Object.keys(PAYMENT_ICONS).find((key) =>
				paymentMethod.toLowerCase().includes(key.toLowerCase()),
			);

			return method ? PAYMENT_ICONS[method] : DEFAULT_PAYMENT_ICON;
		};

		/**
		 * Get CSS class for difference amount
		 * @param {number} difference - Difference value
		 * @returns {string} CSS class name
		 */
		const getDifferenceClass = (difference) => {
			if (difference > 0) return "positive-diff";
			if (difference < 0) return "negative-diff";
			return "zero-diff";
		};

		/**
		 * Check if closing POS is allowed based on time controls
		 * Validates against configured closing time window if enabled
		 */
		const checkClosingTimeAllowed = () => {
			if (!pos_profile.value?.name) {
				isClosingAllowed.value = true;
				return;
			}

			// Call server-side whitelist function
			frappe.call({
				method: API_MAP.POS_CLOSING_SHIFT.CHECK_CLOSING_TIME_ALLOWED,
				args: {
					pos_profile: pos_profile.value.name,
				},
				callback: function (r) {
					if (r.message) {
						isClosingAllowed.value = r.message.allowed;
						if (!r.message.allowed) {
							closingTimeMessage.value = r.message.message;
						}
					} else {
						isClosingAllowed.value = false;
						closingTimeMessage.value = "Error checking closing time permissions";
					}
				},
			});
		}; // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// EVENT HANDLERS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Handle opening closing dialog event
		 * @param {Object} data - Payment reconciliation data
		 */
		const openClosingDialogHandler = (data) => {
			closingDialog.value = true;
			dialog_data.value = data;
			checkClosingTimeAllowed();
		};

		/**
		 * Handle POS profile registration
		 * Configures table headers based on profile settings
		 * @param {Object} data - Profile data with pos_profile
		 */
		const registerPosProfileHandler = (data) => {
			pos_profile.value = data.pos_profile;

			if (!pos_profile.value.posa_hide_expected_amount) {
				headers.value.push(TABLE_HEADERS.EXPECTED_TOTAL);
				headers.value.push(TABLE_HEADERS.DIFFERENCE);
			}
		};

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// LIFECYCLE HOOKS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		onMounted(() => {
			evntBus.on(EVENT_NAMES.OPEN_CLOSING_DIALOG, openClosingDialogHandler);
			evntBus.on(EVENT_NAMES.REGISTER_POS_PROFILE, registerPosProfileHandler);
		});

		onBeforeUnmount(() => {
			evntBus.off(EVENT_NAMES.OPEN_CLOSING_DIALOG, openClosingDialogHandler);
			evntBus.off(EVENT_NAMES.REGISTER_POS_PROFILE, registerPosProfileHandler);
		});

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// EXPOSE
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		return {
			// State
			closingDialog,
			itemsPerPage,
			dialog_data,
			pos_profile,
			headers,

			// Time control
			isClosingAllowed,
			closingTimeMessage,

			// Validation
			max25chars: VALIDATION_RULES.MAX_CHARS,

			// Actions
			close_dialog,
			submit_dialog,

			// Helpers
			getPaymentIcon,
			getDifferenceClass,
		};
	},
};
