import { evntBus } from '../../bus';
import UpdateCustomer from './UpdateCustomer.vue';
import { API_MAP } from '../../api_mapper.js';

const EVENT_NAMES = {
  UPDATE_CUSTOMER: 'update_customer',
  SHOW_MESSAGE: 'show_mesage',
  OPEN_UPDATE_CUSTOMER: 'open_update_customer',
  TOGGLE_QUICK_RETURN: 'toggle_quick_return',
  REGISTER_POS_PROFILE: 'register_pos_profile',
  PAYMENTS_REGISTER_POS_PROFILE: 'payments_register_pos_profile',
  SET_CUSTOMER: 'set_customer',
  ADD_CUSTOMER_TO_LIST: 'add_customer_to_list',
  SET_CUSTOMER_READONLY: 'set_customer_readonly',
  SET_CUSTOMER_INFO_TO_EDIT: 'set_customer_info_to_edit',
  FETCH_CUSTOMER_DETAILS: 'fetch_customer_details',
  CUSTOMER_DROPDOWN_OPENED: 'customer_dropdown_opened',
};

const ERROR_MESSAGES = {
  UNEXPECTED_ERROR: 'An unexpected error occurred while fetching customers',
  POS_PROFILE_NOT_LOADED: 'POS Profile not loaded',
  DEFAULT_CUSTOMER_NOT_DEFINED: 'Default customer not defined in POS Profile',
  FAILED_TO_FETCH: 'Failed to fetch customers',
  NEW_CUSTOMER_ERROR: 'Error opening new customer form',
  EDIT_CUSTOMER_ERROR: 'Error opening customer edit form',
  INITIALIZATION_ERROR: 'An error occurred during component initialization',
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
        this.load_all_customers('');
        this.load_default_customer();
      } catch (error) {
        this.showMessage(ERROR_MESSAGES.UNEXPECTED_ERROR, 'error');
      }
    },

    handleCustomerFocus() {
      this.load_all_customers('');
      this.showDropdown = true;
    },

    load_default_customer() {
      if (!this.pos_profile) {
        this.showMessage(ERROR_MESSAGES.POS_PROFILE_NOT_LOADED, 'error');
        return;
      }

      const default_customer = this.pos_profile.pos_profile?.customer;
      if (default_customer) {
        this.customer = default_customer;

        // Wait for customers list to load, then match name
        const checkInterval = setInterval(() => {
          const selected = this.customers.find((c) => c.name === default_customer);
          if (selected) {
            this.customer_search = selected.customer_name;
            this.customer_info = selected;
            this.defaultLoaded = true;
            clearInterval(checkInterval);
          }
        }, 300);

        evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER, default_customer);
      } else {
        this.showMessage(ERROR_MESSAGES.DEFAULT_CUSTOMER_NOT_DEFINED, 'error');
      }
    },

    load_all_customers(searchTerm = '') {
      if (!this.pos_profile) {
        this.showMessage(ERROR_MESSAGES.POS_PROFILE_NOT_LOADED, 'error');
        return;
      }

      const args = {
        pos_profile: this.pos_profile.pos_profile,
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
              }
            }
          }
          this.loading = false;
        },
        error: () => {
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
      } catch {
        this.showMessage(ERROR_MESSAGES.NEW_CUSTOMER_ERROR, 'error');
      }
    },

    edit_customer() {
      try {
        evntBus.emit(EVENT_NAMES.OPEN_UPDATE_CUSTOMER, this.customer_info);
      } catch {
        this.showMessage(ERROR_MESSAGES.EDIT_CUSTOMER_ERROR, 'error');
      }
    },

    showMessage(message, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { message, color });
    },

    // avatar helpers moved to Customer.vue (visual helpers belong with template)

    handleClickOutside(e) {
      try {
        // Prefer composedPath for Shadow DOM / web components compatibility
        const path = (typeof e.composedPath === 'function' && e.composedPath()) || e.path || [];

        // Resolve the component root element safely (some test harnesses can wrap $el)
        const root =
          this.$el instanceof HTMLElement
            ? this.$el
            : this.$el && this.$el.$el instanceof HTMLElement
              ? this.$el.$el
              : null;

        // Find the autocomplete wrapper starting from component root if possible,
        // otherwise fall back to querying the document (safe fallback).
        const wrapper = root ? root.querySelector('.autocomplete') : document.querySelector('.autocomplete');
        if (!wrapper) return;

        // If event path exists, check whether any node in the path is the wrapper (or inside it).
        if (path && path.length) {
          for (let i = 0; i < path.length; i++) {
            if (path[i] === wrapper || (path[i] instanceof Node && wrapper.contains(path[i]))) {
              return; // click occurred inside the wrapper -> do nothing
            }
          }
          // not inside: close
          this.showDropdown = false;
          return;
        }

        // Fallback: use contains with event.target
        if (!wrapper.contains(e.target)) {
          this.showDropdown = false;
        }
      } catch (err) {
        // non-fatal; avoid breaking UI if something unexpected occurs
        console.warn && console.warn('handleClickOutside error', err);
      }
    },

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
        evntBus.on(EVENT_NAMES.SET_CUSTOMER_READONLY, this.handleSetCustomerReadonly);
        evntBus.on(EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT, this.handleSetCustomerInfoToEdit);
        evntBus.on(EVENT_NAMES.FETCH_CUSTOMER_DETAILS, this.handleFetchCustomerDetails);
        evntBus.on(EVENT_NAMES.CUSTOMER_DROPDOWN_OPENED, this.handleCustomerDropdownOpened);
      } catch {
        this.showMessage(ERROR_MESSAGES.INITIALIZATION_ERROR, 'error');
      }
    },

    handleToggleQuickReturn(value) {
      this.quick_return = value;
    },
    handleRegisterPosProfile(pos_profile) {
      this.pos_profile = pos_profile;
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
  },

  mounted() {
    // ensure we install a single document click listener and remove it on unmount
    // bound so we can remove exactly the same reference later
    this._boundHandleClickOutside = (e) => this.handleClickOutside(e);
    // use capture to reliably catch outside clicks even if other handlers stopPropagation
    document.addEventListener('click', this._boundHandleClickOutside, true);
  },

  beforeUnmount() {
    if (this._boundHandleClickOutside) {
      document.removeEventListener('click', this._boundHandleClickOutside, true);
      this._boundHandleClickOutside = null;
    }
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
