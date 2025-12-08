import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';

// Helper function to convert value to float
function flt(value, precision) {
	if (value === null || value === undefined || value === '') {
		return 0.0;
	}
	const num = parseFloat(value);
	if (isNaN(num)) {
		return 0.0;
	}
	if (precision !== undefined) {
		return parseFloat(num.toFixed(precision));
	}
	return num;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Event names for bus communication
 */
const EVENT_NAMES = {
	OPEN_CLOSING_DIALOG: 'open_ClosingDialog',
	REGISTER_POS_PROFILE: 'register_pos_profile',
	SUBMIT_CLOSING_POS: 'submit_closing_pos',
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
 * Table column headers configuration
 */
const TABLE_HEADERS = {
	PAYMENT_METHOD: {
		title: 'Payment Method',
		key: 'mode_of_payment',
		align: 'start',
		sortable: true,
	},
	SYSTEM_TOTAL: {
		title: 'System Total',
		align: 'end',
		sortable: true,
		key: 'opening_amount',
	},
	ACTUAL_COUNT: {
		title: 'Actual Count',
		key: 'closing_amount',
		align: 'end',
		sortable: true,
	},
	EXPECTED_TOTAL: {
		title: 'Expected Total',
		key: 'expected_amount',
		align: 'end',
		sortable: false,
	},
	DIFFERENCE: {
		title: 'Difference',
		key: 'difference',
		align: 'end',
		sortable: false,
	},
};

/**
 * Validation rules
 */
const VALIDATION_RULES = {
	MAX_CHARS: (v) => v.length <= 20 || 'Input too long!',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
	name: 'ClosingDialog',

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
		const closingTimeMessage = ref('');

		/**
		 * Check if all required closing_amount fields are filled
		 * Required: All rows with expected_amount > 0 must have closing_amount filled
		 * Using computed for reactivity
		 */
		const isAllRequiredFieldsFilled = computed(() => {
			if (
				!dialog_data.value.payment_reconciliation ||
				!Array.isArray(dialog_data.value.payment_reconciliation)
			) {
				return false;
			}

			// Check if all rows with expected_amount have closing_amount filled
			const requiredRows = dialog_data.value.payment_reconciliation.filter(
				(payment) => payment.expected_amount && flt(payment.expected_amount) > 0,
			);

			if (requiredRows.length === 0) {
				return false; // No expected amounts, can't submit
			}

			// All required rows must have closing_amount filled (not null, not undefined, not empty, not 0)
			return requiredRows.every((payment) => {
				const closing = payment.closing_amount;
				// Check if closing_amount is valid (not null, not undefined, not empty string, not 0)
				if (closing === null || closing === undefined || closing === '' || closing === 0) {
					return false;
				}
				// Convert to number and check if > 0
				const closingNum = parseFloat(closing);
				return !isNaN(closingNum) && closingNum > 0;
			});
		});

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
		 * Submits closing shift and prints if auto-print is enabled
		 * Similar to invoice submit + print logic
		 */
		const submit_dialog = async (event) => {
			console.log('[ClosingDialog.js] ===== submit_dialog START =====');
			console.log('[ClosingDialog.js] Event:', event);
			
			// Prevent default form submission behavior
			if (event) {
				event.preventDefault();
				event.stopPropagation();
				console.log('[ClosingDialog.js] Prevented default event behavior');
			}
			
			const transactionsCount = dialog_data.value.pos_transactions
				? dialog_data.value.pos_transactions.length
				: 0;
			console.log(
				`[ClosingDialog.js] Submitting shift: ${
					dialog_data.value.pos_opening_shift || 'new'
				} transactions: ${transactionsCount}`,
			);

			// Get pos_profile - try multiple sources
			// 1. From dialog_data (if available from get_closing_data)
			// 2. From pos_profile.value (from REGISTER_POS_PROFILE event)
			// 3. Fetch from API if only name is available
			let currentPosProfile = dialog_data.value?.pos_profile || pos_profile.value;
			console.log('[ClosingDialog.js] currentPosProfile (initial):', currentPosProfile);
			console.log('[ClosingDialog.js] dialog_data.value?.pos_profile:', dialog_data.value?.pos_profile);
			console.log('[ClosingDialog.js] pos_profile.value:', pos_profile.value);
			
			// If pos_profile is just a name (string) or doesn't have posa_auto_print_closing_shift, fetch full document
			if (!currentPosProfile || typeof currentPosProfile === 'string' || !currentPosProfile.posa_auto_print_closing_shift) {
				const posProfileName = typeof currentPosProfile === 'string' 
					? currentPosProfile 
					: (currentPosProfile?.name || dialog_data.value?.pos_profile || pos_profile.value?.name);
				
				if (posProfileName) {
					console.log('[ClosingDialog.js] Fetching full pos_profile from API:', posProfileName);
					try {
						const profileResponse = await frappe.call({
							method: 'frappe.client.get',
							args: {
								doctype: 'POS Profile',
								name: posProfileName,
							},
						});
						currentPosProfile = profileResponse.message;
						console.log('[ClosingDialog.js] Fetched pos_profile from API:', currentPosProfile);
						console.log('[ClosingDialog.js] posa_auto_print_closing_shift:', currentPosProfile?.posa_auto_print_closing_shift);
					} catch (err) {
						console.error('[ClosingDialog.js] Error fetching pos_profile:', err);
					}
				}
			}
			
			// Check if auto-print is enabled BEFORE submitting
			const willAutoPrint = currentPosProfile?.posa_auto_print_closing_shift === 1;
			console.log('[ClosingDialog.js] willAutoPrint:', willAutoPrint);
			console.log('[ClosingDialog.js] posa_auto_print_closing_shift:', currentPosProfile?.posa_auto_print_closing_shift);
			
			// If auto-print will be triggered, stop monitoring in Navbar BEFORE API call
			// This prevents checkShiftStatus() from reloading the page during print
			if (willAutoPrint) {
				console.log('[ClosingDialog.js] Auto-print enabled - stopping Navbar shift monitoring');
				// Emit event to stop shift monitoring in Navbar immediately (only once)
				evntBus.emit('stop_shift_monitoring');
				console.log('[ClosingDialog.js] stop_shift_monitoring event emitted');
			}

			try {
				console.log('[ClosingDialog.js] Calling API: SUBMIT_CLOSING_SHIFT');
				// Submit closing shift
				const response = await frappe.call({
					method: API_MAP.POS_CLOSING_SHIFT.SUBMIT_CLOSING_SHIFT,
					args: {
						closing_shift: dialog_data.value,
					},
				});

				console.log('[ClosingDialog.js] API response received:', response);
				console.log('[ClosingDialog.js] response.message:', response.message);
				console.log('[ClosingDialog.js] response.message?.name:', response.message?.name);

				if (response.message?.name) {
					console.log(
						`[ClosingDialog.js] submit_dialog success: ${response.message.name}`,
					);

					// Get pos_profile again (use the one we fetched earlier or current value)
					const currentPosProfileForPrint = currentPosProfile || pos_profile.value;
					console.log('[ClosingDialog.js] Using pos_profile for auto-print check:', currentPosProfileForPrint);
					console.log('[ClosingDialog.js] currentPosProfile:', currentPosProfile);
					
					// Auto print closing shift if enabled in POS Profile
					if (
						currentPosProfileForPrint?.posa_auto_print_closing_shift === 1 &&
						response.message.name
					) {
						console.log('[ClosingDialog.js] Auto-print condition met - preparing to print');
						const print_format =
							currentPosProfileForPrint?.posa_closing_shift_print_format || '';
						console.log('[ClosingDialog.js] Print format:', print_format);

						// Open print window directly
						const print_url = frappe.urllib.get_full_url(
							`/printview?doctype=POS%20Closing%20Shift&name=${response.message.name}&format=${print_format}&trigger_print=1&no_letterhead=0`,
						);
						console.log('[ClosingDialog.js] Print URL:', print_url);

						// Open print window first
						console.log('[ClosingDialog.js] Opening print window...');
						const printWindow = window.open(print_url);
						console.log('[ClosingDialog.js] printWindow object:', printWindow);
						
						// Close dialog after print window opens
						console.log('[ClosingDialog.js] Closing dialog...');
						closingDialog.value = false;
						console.log('[ClosingDialog.js] Dialog closed, closingDialog.value:', closingDialog.value);
						
						// Start monitoring shift status AFTER print window opens
						// This ensures we wait for print to complete before checking
						console.log('[ClosingDialog.js] Starting shift status monitoring after print window opens...');
						const openingShiftName = dialog_data.value?.pos_opening_shift;
						const closingShiftName = response.message.name;
						
						// Start monitoring after 2 seconds (give print window time to load)
						setTimeout(() => {
							console.log('[ClosingDialog.js] Starting shift status check...');
							startShiftStatusMonitoring(openingShiftName, closingShiftName);
						}, 2000); // 2 seconds delay to ensure print window is fully loaded
					} else {
						console.log('[ClosingDialog.js] Auto-print NOT enabled - closing dialog and emitting event immediately');
						// No auto-print - close dialog and emit event immediately
						closingDialog.value = false;
						
						// Emit event to notify Pos.js that closing was successful
						console.log('[ClosingDialog.js] Emitting SUBMIT_CLOSING_POS event (no auto-print)');
						evntBus.emit(EVENT_NAMES.SUBMIT_CLOSING_POS, {
							success: true,
							closing_shift_name: response.message.name,
						});
						console.log('[ClosingDialog.js] SUBMIT_CLOSING_POS event emitted');
					}
					console.log('[ClosingDialog.js] ===== submit_dialog END (success) =====');
				} else {
					// Failed to close cashier shift
					frappe.show_alert({
						message: 'فشل إغلاق وردية الصراف',
						indicator: 'red',
					});
				}
			} catch (error) {
				console.error(
					`[ClosingDialog.js] submit_dialog error: ${error.message || error}`,
				);
				console.error('[ClosingDialog.js] Error stack:', error.stack);
				console.log('[ClosingDialog.js] ===== submit_dialog END (error) =====');
				frappe.show_alert({
					message: 'فشل إغلاق وردية الصراف',
					indicator: 'red',
				});
			}
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
			if (difference > 0) return 'positive-diff';
			if (difference < 0) return 'negative-diff';
			return 'zero-diff';
		};

		/**
		 * Update difference when closing_amount changes
		 * @param {Object} payment - Payment reconciliation item
		 */
		const updateDifference = (payment) => {
			if (payment) {
				payment.difference =
					flt(payment.closing_amount || 0) - flt(payment.expected_amount || 0);
			}
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
						// Error checking closing time permissions
						closingTimeMessage.value = 'خطأ في التحقق من أذونات وقت الإغلاق';
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
			const transactionsCount = data.pos_transactions ? data.pos_transactions.length : 0;
			console.log(
				`[ClosingDialog.js] Opening dialog shift: ${
					data.pos_opening_shift || 'new'
				} transactions: ${transactionsCount}`,
			);

			closingDialog.value = true;

			// ✅ لا تعبئة تلقائية - الحقول تبقى فارغة للمستخدم
			// Ensure closing_amount is 0 (which means empty in UI) if not set (user needs to fill manually)
			if (data.payment_reconciliation && Array.isArray(data.payment_reconciliation)) {
				data.payment_reconciliation.forEach((payment) => {
					// Reset closing_amount to 0 if not set (0 means empty in UI, user needs to fill manually)
					if (
						!payment.closing_amount ||
						payment.closing_amount === null ||
						payment.closing_amount === undefined
					) {
						payment.closing_amount = 0;
					}
					// Add editing flag for UI
					if (payment.editing === undefined) {
						payment.editing = false;
					}
					// Update difference
					payment.difference =
						flt(payment.closing_amount || 0) - flt(payment.expected_amount || 0);
				});
			}

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

		/**
		 * Monitor shift status after closing shift is submitted and print window opens
		 * Checks if opening shift status changed to "Closed" with pos_closing_shift set
		 * This ensures we wait for print to complete before reloading
		 * @param {string} openingShiftName - Name of the opening shift being monitored
		 * @param {string} closingShiftName - Name of the closing shift that was just submitted
		 */
		const startShiftStatusMonitoring = (openingShiftName, closingShiftName) => {
			if (!openingShiftName) {
				console.log('[ClosingDialog.js] No opening shift name - cannot monitor');
				return;
			}

			console.log('[ClosingDialog.js] Monitoring shift:', openingShiftName);
			console.log('[ClosingDialog.js] Expected closing shift:', closingShiftName);

			// Check every 2 seconds (faster than old 3 seconds, but still reasonable)
			const monitoringInterval = setInterval(() => {
				console.log('[ClosingDialog.js] Checking shift status...');
				
				frappe.call({
					method: 'frappe.client.get',
					args: {
						doctype: 'POS Opening Shift',
						name: openingShiftName,
					},
					callback: (r) => {
						if (r.message) {
							const openingShift = r.message;
							console.log('[ClosingDialog.js] Opening shift status:', openingShift.status);
							console.log('[ClosingDialog.js] Opening shift pos_closing_shift:', openingShift.pos_closing_shift);
							
							// Check if shift is closed AND has pos_closing_shift set
							// This means closing shift was successfully submitted and linked
							if (
								openingShift.status === 'Closed' &&
								openingShift.pos_closing_shift === closingShiftName
							) {
								console.log('[ClosingDialog.js] Shift closed successfully with closing shift linked!');
								console.log('[ClosingDialog.js] Stopping monitoring and emitting SUBMIT_CLOSING_POS event');
								
								// Stop monitoring
								clearInterval(monitoringInterval);
								
								// Emit event to trigger check_opening_entry() in Pos.js
								evntBus.emit(EVENT_NAMES.SUBMIT_CLOSING_POS, {
									success: true,
									closing_shift_name: closingShiftName,
									has_auto_print: true,
								});
								console.log('[ClosingDialog.js] SUBMIT_CLOSING_POS event emitted');
							} else {
								console.log('[ClosingDialog.js] Shift not yet closed or closing shift not linked - continuing to monitor...');
							}
						} else {
							console.log('[ClosingDialog.js] Could not fetch opening shift - continuing to monitor...');
						}
					},
					error: (err) => {
						console.error('[ClosingDialog.js] Error checking shift status:', err);
						// Continue monitoring on error (might be network issue)
					},
					freeze: false,
					show_spinner: false,
					async: true,
				});
			}, 2000); // Check every 2 seconds

			// Stop monitoring after 30 seconds (safety timeout)
			setTimeout(() => {
				console.log('[ClosingDialog.js] Monitoring timeout reached - stopping and emitting event');
				clearInterval(monitoringInterval);
				// Emit event anyway after timeout
				evntBus.emit(EVENT_NAMES.SUBMIT_CLOSING_POS, {
					success: true,
					closing_shift_name: closingShiftName,
					has_auto_print: true,
				});
			}, 30000); // 30 seconds timeout
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
			isAllRequiredFieldsFilled,

			// Actions
			close_dialog,
			submit_dialog,

			// Helpers
			getPaymentIcon,
			getDifferenceClass,
			updateDifference,
		};
	},
};
