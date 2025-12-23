import { evntBus } from '../../bus';
import UpdateCustomer from './UpdateCustomer.vue';
import { API_MAP } from '../../api_mapper.js';
// Frontend logging: Use console.log/error/warn directly

const EVENT_NAMES = {
	UPDATE_CUSTOMER: 'update_customer',
	SHOW_MESSAGE: 'show_mesage',
	OPEN_UPDATE_CUSTOMER: 'open_update_customer',
	TOGGLE_QUICK_RETURN: 'toggle_quick_return',
	REGISTER_POS_PROFILE: 'register_pos_profile',
	PAYMENTS_REGISTER_POS_PROFILE: 'payments_register_pos_profile',
	SET_CUSTOMER: 'set_customer',
	ADD_CUSTOMER_TO_LIST: 'add_customer_to_list',
	UPDATE_CUSTOMER_IN_LIST: 'update_customer_in_list',
	SET_CUSTOMER_READONLY: 'set_customer_readonly',
	SET_CUSTOMER_INFO_TO_EDIT: 'set_customer_info_to_edit',
	FETCH_CUSTOMER_DETAILS: 'fetch_customer_details',
	CUSTOMER_DROPDOWN_OPENED: 'customer_dropdown_opened',
};

const ERROR_MESSAGES = {
	// An unexpected error occurred while fetching customers
	UNEXPECTED_ERROR: 'حدث خطأ غير متوقع أثناء جلب العملاء',
	// POS Profile not loaded
	POS_PROFILE_NOT_LOADED: 'ملف نقطة البيع غير محمّل',
	// Default customer not defined in POS Profile
	DEFAULT_CUSTOMER_NOT_DEFINED: 'العميل الافتراضي غير محدد في ملف نقطة البيع',
	// Failed to fetch customers
	FAILED_TO_FETCH: 'فشل جلب العملاء',
	// Error opening new customer form
	NEW_CUSTOMER_ERROR: 'خطأ في فتح نموذج عميل جديد',
	// Error opening customer edit form
	EDIT_CUSTOMER_ERROR: 'خطأ في فتح نموذج تعديل العميل',
	// An error occurred during component initialization
	INITIALIZATION_ERROR: 'حدث خطأ أثناء تهيئة المكون',
};

export default {
	name: 'Customer',
	components: { UpdateCustomer },
	data() {
		return {
			pos_profile: null,
			customers: [],
			customer: '',
			readonly: false,
			customer_info: {},
			quick_return: false,
			searchTimeout: null,
			loading: false,
			customer_search: '',
			showDropdown: false,
			selectedIndex: -1,
			filteredCustomers: [],
			defaultLoaded: false, // ✅ New flag
		};
	},

	methods: {
		get_many_customers() {
			try {
				if (this.customers.length > 0) return;
				// Load customers first, then default customer will be set in the callback
				this.load_all_customers('');
				// Set the default customer name immediately for API calls, UI will update after customers load
				// Check both possible paths: pos_profile.customer (from register_pos_profile event) or pos_profile.pos_profile.customer (from SET_POS_SETTINGS event)
				const default_customer =
					this.pos_profile?.customer || this.pos_profile?.pos_profile?.customer;
				if (default_customer) {
					this.customer = default_customer;
					evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER, this.customer);
				}
			} catch (error) {
				console.log('[Customer.js] get_many_customers error:', error);
				this.showMessage(ERROR_MESSAGES.UNEXPECTED_ERROR, 'error');
			}
		},

		handleCustomerFocus() {
			this.load_all_customers('');
			this.showDropdown = true;
		},

		load_all_customers(searchTerm = '') {
			if (!this.pos_profile) {
				this.showMessage(ERROR_MESSAGES.POS_PROFILE_NOT_LOADED, 'error');
				return;
			}

			// Handle both possible structures: pos_profile (from register_pos_profile) or pos_profile.pos_profile (from SET_POS_SETTINGS)
			const pos_profile_for_api = this.pos_profile.pos_profile || this.pos_profile;

			const args = {
				pos_profile: pos_profile_for_api,
				limit: 100,
			};
			if (searchTerm.trim()) args.search_term = searchTerm.trim();

			this.loading = true;

			frappe.call({
				method: API_MAP.CUSTOMER.GET_MANY_CUSTOMERS,
				args,
				callback: (r) => {
					if (r.message) {
						this.customers = r.message;
						this.filteredCustomers = r.message;

						// ✅ After customers loaded, if default not yet shown, show it now
						if (!this.defaultLoaded && this.customer) {
							const selected = this.customers.find((c) => c.name === this.customer);
							if (selected) {
								this.customer_search = selected.customer_name;
								this.customer_info = selected;
								this.defaultLoaded = true;
								// Default customer loaded (logged to backend only)
							} else {
								console.log(
									'[Customer.js] Default customer not found in list:',
									this.customer,
								);
								// If default customer not in list, fetch it directly
								if (this.customer && !this.customer_info.name) {
									this.fetch_customer_details_for_default(this.customer);
								}
							}
						}
					}
					this.loading = false;
				},
				error: (err) => {
					console.log('[Customer.js] load_all_customers error:', err);
					this.showMessage(ERROR_MESSAGES.FAILED_TO_FETCH, 'error');
					this.loading = false;
				},
			});
		},

		performSearch(event) {
			const searchTerm = event?.target?.value || '';
			this.customer_search = searchTerm;
			this.showDropdown = true;
			this.selectedIndex = -1;

			if (this.searchTimeout) clearTimeout(this.searchTimeout);
			this.searchTimeout = setTimeout(() => {
				this.load_all_customers(searchTerm);
			}, 300);
		},

		selectCustomer(customer) {
			this.customer = customer.name;
			this.customer_search = customer.customer_name;
			this.customer_info = customer;
			this.showDropdown = false;
			this.selectedIndex = -1;
			evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER, customer.name);
		},

		handleEnter() {
			if (!this.showDropdown) return;
			if (this.filteredCustomers.length > 0 && this.selectedIndex >= 0) {
				this.selectCustomer(this.filteredCustomers[this.selectedIndex]);
			} else if (this.filteredCustomers.length > 0) {
				this.selectCustomer(this.filteredCustomers[0]);
			}
		},

		navigateDown() {
			if (this.selectedIndex < this.filteredCustomers.length - 1) {
				this.selectedIndex++;
			}
		},

		navigateUp() {
			if (this.selectedIndex > 0) {
				this.selectedIndex--;
			}
		},

		new_customer() {
			try {
				evntBus.emit(EVENT_NAMES.OPEN_UPDATE_CUSTOMER, null);
			} catch (err) {
				console.log('[Customer.js] new_customer error:', err);
				this.showMessage(ERROR_MESSAGES.NEW_CUSTOMER_ERROR, 'error');
			}
		},

		edit_customer() {
			try {
				evntBus.emit(EVENT_NAMES.OPEN_UPDATE_CUSTOMER, this.customer_info);
			} catch (err) {
				console.log('[Customer.js] edit_customer error:', err);
				this.showMessage(ERROR_MESSAGES.EDIT_CUSTOMER_ERROR, 'error');
			}
		},

		showMessage(message, color) {
			evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { message, color });
		},

		// avatar helpers moved to Customer.vue (visual helpers belong with template)

		registerEventListeners() {
			try {
				evntBus.on(EVENT_NAMES.TOGGLE_QUICK_RETURN, this.handleToggleQuickReturn);
				evntBus.on(EVENT_NAMES.REGISTER_POS_PROFILE, this.handleRegisterPosProfile);
				evntBus.on(
					EVENT_NAMES.PAYMENTS_REGISTER_POS_PROFILE,
					this.handlePaymentsRegisterPosProfile,
				);
				evntBus.on(EVENT_NAMES.SET_CUSTOMER, this.handleSetCustomer);
				evntBus.on(EVENT_NAMES.ADD_CUSTOMER_TO_LIST, this.handleAddCustomerToList);
				evntBus.on(EVENT_NAMES.UPDATE_CUSTOMER_IN_LIST, this.handleUpdateCustomerInList);
				evntBus.on(EVENT_NAMES.SET_CUSTOMER_READONLY, this.handleSetCustomerReadonly);
				evntBus.on(
					EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT,
					this.handleSetCustomerInfoToEdit,
				);
				evntBus.on(EVENT_NAMES.FETCH_CUSTOMER_DETAILS, this.handleFetchCustomerDetails);
				evntBus.on(
					EVENT_NAMES.CUSTOMER_DROPDOWN_OPENED,
					this.handleCustomerDropdownOpened,
				);
			} catch (err) {
				console.log('[Customer.js] registerEventListeners error:', err);
				this.showMessage(ERROR_MESSAGES.INITIALIZATION_ERROR, 'error');
			}
		},

		handleToggleQuickReturn(value) {
			this.quick_return = value;
		},
		handleRegisterPosProfile(event_data) {
			// event_data structure: { pos_profile: {...}, pos_opening_shift: {...}, company: {...} }
			this.pos_profile = event_data;
			// Set default customer immediately if available
			// Check pos_profile.pos_profile.customer (actual POS Profile object) or pos_profile.customer (direct access)
			const default_customer = event_data?.pos_profile?.customer;
			if (default_customer) {
				this.customer = default_customer;
				// Fetch customer details immediately to display in UI
				this.fetch_customer_details_for_default(default_customer);
				evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER, this.customer);
			}
			this.get_many_customers();
		},
		handlePaymentsRegisterPosProfile(pos_profile) {
			this.pos_profile = pos_profile;
			this.get_many_customers();
		},
		handleSetCustomer(customer) {
			this.customer = customer;
		},
		handleAddCustomerToList(customer) {
			this.customers.push(customer);
		},
		handleUpdateCustomerInList(updatedCustomer) {
			const index = this.customers.findIndex((c) => c.name === updatedCustomer.name);
			if (index !== -1) {
				this.customers[index] = {
					...this.customers[index],
					...updatedCustomer,
				};
			}
		},
		handleSetCustomerReadonly(value) {
			this.readonly = value;
		},
		handleSetCustomerInfoToEdit(data) {
			this.customer_info = data;
		},
		handleFetchCustomerDetails() {
			this.get_many_customers();
		},
		handleCustomerDropdownOpened() {
			this.load_all_customers('');
		},

		// Fetch customer details for default customer when not found in list
		fetch_customer_details_for_default(customer_name) {
			if (!customer_name) return;

			frappe.call({
				method: API_MAP.CUSTOMER.GET_CUSTOMER,
				args: {
					customer_id: customer_name,
				},
				callback: (r) => {
					if (r.message) {
						this.customer_info = r.message;
						this.customer_search = r.message.customer_name || customer_name;
						this.defaultLoaded = true;
						// Add to customers list if not already present
						if (!this.customers.find((c) => c.name === customer_name)) {
							this.customers.unshift(r.message);
							this.filteredCustomers = this.customers;
						}
					}
				},
				error: (err) => {
					console.log('[Customer.js] fetch_customer_details_for_default error:', err);
				},
			});
		},
	},

	created() {
		this.$nextTick(() => {
			this.registerEventListeners();
		});
	},

	watch: {
		customer(newVal) {
			const selected = this.customers.find((c) => c.name === newVal);
			if (selected) this.customer_search = selected.customer_name;
			evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER, newVal);
		},
	},
};
