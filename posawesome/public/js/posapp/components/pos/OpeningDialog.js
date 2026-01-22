import { ref, onMounted, watch } from 'vue';
import { evntBus } from '../../bus';
import format from '../../format';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Import API mapper
import { API_MAP } from '../../api_mapper.js';

/**
 * Event names for bus communication
 */
const EVENT_NAMES = {
	CLOSE_OPENING_DIALOG: 'close_opening_dialog',
	REGISTER_POS_DATA: 'register_pos_data',
	SET_COMPANY: 'set_company',
	SHOW_MESSAGE: 'show_mesage',
};

/**
 * Payment method icons and colors
 */
const PAYMENT_ICONS = {
	Cash: { icon: 'mdi-cash', color: '#4CAF50' },
	Card: { icon: 'mdi-credit-card', color: '#2196F3' },
	'Credit Card': { icon: 'mdi-credit-card', color: '#2196F3' },
	'Debit Card': { icon: 'mdi-credit-card-outline', color: '#FF9800' },
	'Bank Transfer': { icon: 'mdi-bank-transfer', color: '#9C27B0' },
	'Mobile Payment': { icon: 'mdi-cellphone', color: '#E91E63' },
	'Digital Wallet': { icon: 'mdi-wallet', color: '#00BCD4' },
	Check: { icon: 'mdi-checkbook', color: '#795548' },
	Voucher: { icon: 'mdi-ticket', color: '#FF5722' },
};

/**
 * Default payment icon for unknown methods
 */
const DEFAULT_PAYMENT_ICON = { icon: 'mdi-currency-usd', color: '#607D8B' };

/**
 * Table headers configuration
 */
const TABLE_HEADERS = [
	{
		title: 'Payment Method',
		align: 'start',
		sortable: false,
		key: 'mode_of_payment',
	},
	{
		title: 'Opening Amount',
		key: 'amount',
		align: 'center',
		sortable: false,
	},
];

/**
 * Validation rules
 */
const VALIDATION_RULES = {
	MAX_CHARS: (v) => v.length <= 12 || 'Text too long!',
};

/**
 * UI configuration
 */
const UI_CONFIG = {
	ITEMS_PER_PAGE: 100,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
	name: 'OpeningDialog',

	mixins: [format],

	props: {
		dialog: {
			type: Boolean,
			default: false,
		},
	},

	setup(props) {
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// STATE
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		const isOpen = ref(props.dialog || false);
		const dialog_data = ref({});
		const is_loading = ref(false);

		// Company data
		const companies = ref([]);
		const company = ref('');

		// POS Profile data
		const pos_profiles_data = ref([]);
		const pos_profiles = ref([]);
		const pos_profile = ref('');

		// Payment methods data
		const payments_method_data = ref([]);
		const payments_methods = ref([]);
		const payments_methods_headers = ref(TABLE_HEADERS);
		const itemsPerPage = ref(UI_CONFIG.ITEMS_PER_PAGE);

		// Time control
		const isOpeningAllowed = ref(true);
		const openingTimeStart = ref('');
		const openingTimeEnd = ref('');
		const openingTimeMessage = ref('');

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// DATA LOADING
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Fetch opening dialog data from server
		 * Loads companies, POS profiles, and payment methods
		 */
		const get_opening_dialog_data = () => {
			frappe.call({
				method: API_MAP.POS_OPENING_SHIFT.GET_OPENING_DATA,
				args: {},
				callback: function (r) {
					if (r.message) {
						// Populate companies
						r.message.companies.forEach((element) => {
							companies.value.push(element.name);
						});
						company.value = companies.value[0];

						// Store POS profiles and payment methods data
						pos_profiles_data.value = r.message.pos_profiles_data;
						payments_method_data.value = r.message.payments_method;
					} else {
						// Failed to load POS opening data
						showMessage('فشل تحميل بيانات فتح نقطة البيع', 'error');
					}
				},
			});
		};

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// DIALOG ACTIONS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Close opening dialog
		 * Emits close event to parent component
		 */
		const close_opening_dialog = () => {
			evntBus.emit(EVENT_NAMES.CLOSE_OPENING_DIALOG);
		};

		/**
		 * Validate form data before submission
		 * @returns {boolean} True if valid, false otherwise
		 */
		const validateForm = () => {
			if (!payments_methods.value.length || !company.value || !pos_profile.value) {
				// Please fill all required fields
				showMessage('يرجى ملء جميع الحقول المطلوبة', 'error');
				return false;
			}
			return true;
		};

		/**
		 * Submit opening dialog
		 * Creates POS opening voucher with payment details
		 */
		const submit_dialog = () => {
			if (!validateForm()) {
				return;
			}

			is_loading.value = true;

			frappe
				.call({
					method: API_MAP.POS_OPENING_SHIFT.CREATE_OPENING_VOUCHER,
					args: {
						pos_profile: pos_profile.value,
						company: company.value,
						balance_details: payments_methods.value,
					},
				})
				.then((r) => {
					if (r.message) {
						// r.message is the opening_voucher document (as_dict())
					const opening_shift = r.message;
					const shift_name = opening_shift.name || 'غير معروف';

						// Fetch complete shift data including pos_profile_data
						frappe.call({
							method: API_MAP.POS_OPENING_SHIFT.GET_CURRENT_SHIFT_NAME,
							callback: (shiftResponse) => {
								if (
									shiftResponse.message &&
									shiftResponse.message.success &&
									shiftResponse.message.data
								) {
									const shift_data = shiftResponse.message.data;
									const pos_profile = shift_data.pos_profile_data;

									if (pos_profile) {
										// Prepare data in the format expected by Pos.js and Navbar.js
										const pos_opening_shift = {
											name: shift_data.name,
											company: shift_data.company,
											period_start_date: shift_data.period_start_date,
											pos_profile: shift_data.pos_profile,
											user: shift_data.user,
										};

										const event_data = {
											pos_profile: pos_profile,
											pos_opening_shift: pos_opening_shift,
											company: { name: pos_profile.company },
										};

										// Emit events with complete data
										evntBus.emit(EVENT_NAMES.REGISTER_POS_DATA, event_data);
										evntBus.emit(EVENT_NAMES.SET_COMPANY, {
											name: pos_profile.company,
										});

										showMessage(
											`تم إنشاء وردية فتح نقطة البيع ${shift_name}`,
											'success',
										);
									close_opening_dialog();
								} else {
									console.error('[OpeningDialog.js] shift_data_missing');
										showMessage('Failed to load POS Profile', 'error');
									}
								} else {
									showMessage('فشل تحميل بيانات الوردية', 'error');
								}
								is_loading.value = false;
						},
						error: (err) => {
							console.error('[OpeningDialog.js] get_current_shift_name_failed');
								showMessage('فشل تحميل بيانات الوردية', 'error');
								is_loading.value = false;
							},
						});
					} else {
						// Failed to create opening document
						showMessage('فشل إنشاء مستند الافتتاح', 'error');
						is_loading.value = false;
					}
			})
			.catch((error) => {
				console.error('[OpeningDialog.js] create_opening_voucher_failed');
				showMessage('فشل إنشاء مستند الافتتاح', 'error');
				is_loading.value = false;
				});
		};

		/**
		 * Navigate to Frappe desk
		 * Reloads the application
		 */
		const go_desk = () => {
			frappe.set_route('/');
			location.reload();
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
		 * Check if opening is allowed based on POS Profile time settings
		 */
		const checkOpeningTimeAllowed = () => {
			if (!pos_profile.value) {
				isOpeningAllowed.value = true;
				return;
			}

			// Call server-side whitelist function
			frappe.call({
				method: API_MAP.POS_OPENING_SHIFT.CHECK_OPENING_TIME_ALLOWED,
				args: {
					pos_profile: pos_profile.value,
				},
				callback: function (r) {
					if (r.message) {
						isOpeningAllowed.value = r.message.allowed;
						if (!r.message.allowed) {
							openingTimeMessage.value = r.message.message;
						}
					} else {
						isOpeningAllowed.value = true;
					}
				},
			});
		};
		/**
		 * Show message to user via event bus
		 * @param {string} text - Message text
		 * @param {string} color - Message color (success, error, warning, info)
		 */
		const showMessage = (text, color) => {
			evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
		};

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// WATCHERS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		/**
		 * Watch company changes
		 * Updates POS profiles list when company changes
		 */
		watch(company, (val) => {
			pos_profiles.value = [];
			pos_profiles_data.value.forEach((element) => {
				if (element.company === val) {
					pos_profiles.value.push(element.name);
				}
			});
			pos_profile.value = pos_profiles.value.length ? pos_profiles.value[0] : '';
		});

		/**
		 * Watch POS profile changes
		 * Updates payment methods list when profile changes
		 */
		watch(pos_profile, (val) => {
			payments_methods.value = [];
			payments_method_data.value.forEach((element) => {
				if (element.parent === val) {
					payments_methods.value.push({
						mode_of_payment: element.mode_of_payment,
						amount: 0,
						currency: element.currency,
					});
				}
			});
			// Check if opening is allowed for this profile
			checkOpeningTimeAllowed();
		});

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// LIFECYCLE HOOKS
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		onMounted(() => {
			get_opening_dialog_data();
		});

		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
		// EXPOSE
		// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

		return {
			// State
			isOpen,
			dialog_data,
			is_loading,
			companies,
			company,
			pos_profiles_data,
			pos_profiles,
			pos_profile,
			payments_method_data,
			payments_methods,
			payments_methods_headers,
			itemsPerPage,

			// Time control
			isOpeningAllowed,
			openingTimeStart,
			openingTimeEnd,
			openingTimeMessage,

			// Validation
			max25chars: VALIDATION_RULES.MAX_CHARS,

			// Actions
			close_opening_dialog,
			submit_dialog,
			go_desk,
			checkOpeningTimeAllowed,

			// Helpers
			getPaymentIcon,
		};
	},
};
