// ===== IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';

// Lightweight debounce function (replaces lodash)
// CRITICAL: Preserve 'this' context for Vue component methods
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const context = this; // ✅ Capture the Vue component context
    const later = () => {
      clearTimeout(timeout);
      func.apply(context, args); // ✅ Apply with correct context
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const EVENT_NAMES = {
  // Item Events
  ADD_ITEM: 'add_item',
  SET_ALL_ITEMS: 'set_all_items',
  UPDATE_CUR_ITEMS_DETAILS: 'update_cur_items_details',

  // UI Events
  SHOW_OFFERS: 'show_offers',
  SHOW_MESSAGE: 'show_mesage',

  // Configuration Events
  REGISTER_POS_PROFILE: 'register_pos_profile',
  UPDATE_CUSTOMER: 'update_customer',
  UPDATE_CUSTOMER_PRICE_LIST: 'update_customer_price_list',

  // Counter Events
  UPDATE_OFFERS_COUNTERS: 'update_offers_counters',
};

const UI_CONFIG = {
  SEARCH_MIN_LENGTH: 3,
  MAX_DISPLAYED_ITEMS: 50,
  MIN_PANEL_HEIGHT: 180,
  BOTTOM_PADDING: 16,
  DEBOUNCE_DELAY: 200,
};

const VIEW_MODES = {
  CARD: 'card',
  LIST: 'list',
};

const BARCODE_TYPES = {
  SCALE: 'scale',
  PRIVATE: 'private',
  NORMAL: 'normal',
};

// ===== COMPONENT =====
export default {
  name: 'ItemsSelector',

  mixins: [format],

  // ===== DATA =====
  data() {
    return {
      // POS Configuration
      pos_profile: null,
      flags: {},

      // View State
      items_view: VIEW_MODES.LIST,
      item_group: 'ALL',
      loading: false,
      search_loading: false,

      // Items Data
      items_group: ['ALL'],
      items: [],

      // Search State
      search: '',
      first_search: '',
      barcode_search: '',

      // Pagination
      itemsPerPage: 1000,

      // Counters
      offersCount: 0,
      appliedOffersCount: 0,

      // Customer Data
      customer_price_list: null,
      customer: null,

      // Item Operations
      qty: 1,

      // UI State
      itemsScrollHeight: null,

      // Internal Flags
      _suppressCustomerWatcher: false,
      _detailsReady: false,

      // Caching & Performance
      _itemsMap: new Map(),
    };
  },

  // ===== WATCH =====
  watch: {
    filtred_items(newValue, oldValue) {
      if (newValue.length !== oldValue.length) {
        this.update_items_details(newValue);
      }
      this.scheduleScrollHeightUpdate();
    },

    customer(newVal, oldVal) {
      if (this._suppressCustomerWatcher) {
        this._suppressCustomerWatcher = false;
        return;
      }
      if (oldVal !== undefined && newVal !== oldVal) {
        this.get_items();
      }
    },

    items_view() {
      this.scheduleScrollHeightUpdate();
    },
  },

  // ===== COMPUTED =====
  computed: {
    filtred_items() {
      this.search = this.get_search(this.first_search);

      // Cache expensive operations
      const groupFilter = this.item_group !== 'ALL';
      const hasSearch = this.search && this.search.length >= UI_CONFIG.SEARCH_MIN_LENGTH;

      let filtred_list = [];
      let filtred_group_list = [];

      // Filter by group - cache toLowerCase results
      if (groupFilter) {
        const lowerGroup = this.item_group.toLowerCase();
        filtred_group_list = this.items.filter((item) =>
          item.item_group.toLowerCase().includes(lowerGroup),
        );
      } else {
        filtred_group_list = this.items;
      }

      // Filter by search term
      if (!hasSearch) {
        filtred_list = filtred_group_list.slice(0, UI_CONFIG.MAX_DISPLAYED_ITEMS);
      } else {
        // Search in item_code - cache toLowerCase result
        const lowerSearch = this.search.toLowerCase();
        filtred_list = filtred_group_list.filter((item) =>
          item.item_code.toLowerCase().includes(lowerSearch),
        );

        // Search in item_name if no results
        if (filtred_list.length === 0) {
          filtred_list = filtred_group_list.filter((item) =>
            item.item_name.toLowerCase().includes(lowerSearch),
          );
        }
      }

      return filtred_list.slice(0, UI_CONFIG.MAX_DISPLAYED_ITEMS);
    },

    itemsScrollStyle() {
      if (!this.itemsScrollHeight) {
        return {};
      }
      return {
        maxHeight: `${this.itemsScrollHeight - 80}px`,
      };
    },

    debounce_search: {
      get() {
        return this.first_search;
      },
      set: debounce(function (newValue) {
        this.first_search = newValue;
        this.performLiveSearch(newValue);
      }, UI_CONFIG.DEBOUNCE_DELAY),
    },
  },

  methods: {
    scheduleScrollHeightUpdate() {
      this.$nextTick(() => {
        this.updateScrollableHeight();
      });
    },

    updateScrollableHeight() {
      const scrollRef = this.$refs.itemsScrollArea;
      const scrollEl = scrollRef ? scrollRef.$el || scrollRef : null;

      if (!scrollEl || typeof scrollEl.getBoundingClientRect !== 'function') {
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;

      if (!viewportHeight) {
        return;
      }

      const rect = scrollEl.getBoundingClientRect();
      const available = viewportHeight - rect.top - UI_CONFIG.BOTTOM_PADDING;

      if (Number.isFinite(available)) {
        this.itemsScrollHeight = Math.max(UI_CONFIG.MIN_PANEL_HEIGHT, Math.floor(available));
      }
    },

    handle_barcode_input() {
      if (!this.barcode_search.trim()) return;

      this.process_barcode(this.barcode_search.trim());
      this.barcode_search = '';

      const barcodeInput = document.querySelector('input[placeholder*="Barcode"]');
      if (barcodeInput) barcodeInput.value = '';
    },

    process_barcode(barcode_value) {
      // Single unified method - backend determines barcode type
      frappe.call({
        method: API_MAP.ITEM.GET_BARCODE_ITEM,
        args: {
          pos_profile: this.pos_profile,
          barcode_value: barcode_value,
        },
        callback: (response) => {
          if (response?.message?.item_code) {
            // Add item to cart
            this.add_item_to_cart(response.message);

            // Show success message with quantity info
            const qty = response.message.qty || 1;
            const qtyText = qty !== 1 ? ` (qty: ${qty})` : '';

            evntBus.emit('show_mesage', {
              text: `Added ${response.message.item_name}${qtyText} to cart`,
              color: 'success',
            });
          } else {
            evntBus.emit('show_mesage', {
              text: 'Item not found with this barcode',
              color: 'error',
            });
          }
        },
        error: (error) => {
          evntBus.emit('show_mesage', {
            text: 'Error processing barcode',
            color: 'error',
          });
        },
      });
    },

    add_item_to_cart(item) {
      evntBus.emit(EVENT_NAMES.ADD_ITEM, item);
    },

    show_offers() {
      evntBus.emit(EVENT_NAMES.SHOW_OFFERS, 'true');
    },

    onItemGroupChange() {
      if (this.debounce_search) {
        this.debounce_search = '';
        this.first_search = '';
      }
      this.get_items();
    },

    get_items() {
      if (!this.pos_profile) {
        evntBus.emit('show_mesage', {
          text: 'POS Profile not specified',
          color: 'error',
        });
        return;
      }

      const vm = this;
      this.loading = true;
      let search = this.get_search(this.first_search);
      let gr = '';
      let sr = '';

      if (search) {
        sr = search;
      }
      if (vm.item_group != 'ALL') {
        gr = vm.item_group.toLowerCase();
      }

      frappe.call({
        method: API_MAP.ITEM.GET_ITEMS,
        args: {
          pos_profile: vm.pos_profile,
          price_list: vm.customer_price_list,
          item_group: gr,
          search_value: sr,
          customer: vm.customer,
        },
        callback: function (r) {
          if (r.message) {
            vm.items = (r.message || []).map((it) => ({
              item_code: it.item_code,
              item_name: it.item_name,
              item_group: it.item_group, // ✅ Added for filtred_items
              brand: it.brand,
              rate: it.rate,
              price_list_rate: it.price_list_rate,
              base_rate: it.base_rate,
              currency: it.currency,
              actual_qty: it.actual_qty,
              stock_uom: it.stock_uom,
              // Empty arrays for compatibility with barcode/batch/serial features
              item_barcode: [],
              serial_no_data: [],
              batch_no_data: [],
            }));
            vm._buildItemsMap();
            evntBus.emit('set_all_items', vm.items);
            vm.loading = false;
            vm.search_loading = false;
            vm.scheduleScrollHeightUpdate();
          }
        },
      });
    },

    _buildItemsMap() {
      this._itemsMap.clear();

      this.items.forEach((item) => {
        // Add search by item_code
        this._itemsMap.set(item.item_code.toLowerCase(), item);

        // Add search by item_name
        this._itemsMap.set(item.item_name.toLowerCase(), item);
      });
    },

    get_items_groups() {
      if (!this.pos_profile) {
        return;
      }

      if (this.pos_profile.item_groups && this.pos_profile.item_groups.length > 0) {
        this.pos_profile.item_groups.forEach((element) => {
          if (element.item_group !== 'ALL') {
            this.items_group.push(element.item_group);
          }
        });
      } else {
        const vm = this;
        frappe.call({
          method: API_MAP.ITEM.GET_ITEMS_GROUPS,
          args: {},
          callback: function (r) {
            if (r.message) {
              r.message.forEach((element) => {
                vm.items_group.push(element.name);
              });
            }
          },
        });
      }
    },

    getItemsHeaders() {
      const items_headers = [
        {
          title: __('Item Name'),
          align: 'start',
          sortable: true,
          key: 'item_name',
          width: '40%',
        },
        {
          title: __('Item Code'),
          align: 'start',
          sortable: true,
          key: 'item_code',
          width: '35%',
        },
        { title: __('Price'), key: 'rate', align: 'start', width: '5%' },
        {
          title: __('Qty'),
          value: 'actual_qty',
          key: 'actual_qty',
          align: 'center',
          width: '15%',
        },
        { title: __('UOM'), key: 'stock_uom', align: 'center', width: '5%' },
      ];

      return items_headers;
    },

    add_item_table(item) {
      // Add the item from the table - use the item object directly
      evntBus.emit('add_item', {
        ...item,
        qty: this.qty || 1,
      });
      this.qty = 1;
    },

    add_item(item) {
      // Add item from card view
      evntBus.emit('add_item', {
        ...item,
        qty: this.qty || 1,
      });
      this.qty = 1;
    },

    get_search(val) {
      return val || '';
    },

    esc_event() {
      this.first_search = '';
      this.debounce_search = '';
    },

    performLiveSearch(searchValue) {
      const vm = this;

      // Activate search progress bar
      this.search_loading = true;

      // If search is empty, reload all items
      if (!searchValue || searchValue.trim() === '') {
        this.get_items();
        return;
      }

      // Perform live search using get_items
      frappe.call({
        method: API_MAP.ITEM.GET_ITEMS,
        args: {
          pos_profile: vm.pos_profile,
          price_list: vm.customer_price_list,
          item_group: vm.item_group !== 'ALL' ? vm.item_group.toLowerCase() : '',
          search_value: searchValue.trim(),
          customer: vm.customer,
        },
        callback: function (r) {
          // Stop search progress bar
          vm.search_loading = false;

          if (r.message) {
            vm.items = (r.message || []).map((it) => ({
              ...it,
              item_group: it.item_group,
              price_list_rate: it.price_list_rate || it.rate,
              base_rate: it.base_rate || it.rate,
              item_barcode: Array.isArray(it.item_barcode) ? it.item_barcode : [],
              serial_no_data: Array.isArray(it.serial_no_data) ? it.serial_no_data : [],
              batch_no_data: Array.isArray(it.batch_no_data) ? it.batch_no_data : [],
            }));
            vm._buildItemsMap();
            evntBus.emit('set_all_items', vm.items);
          }
        },
        error: function (err) {
          // Stop search progress bar
          vm.search_loading = false;
        },
      });
    },

    update_items_details(items) {
      evntBus.emit('update_cur_items_details', items);
    },

    scan_barcode() {
      const vm = this;
      onScan.attachTo(document, {
        suffixKeyCodes: [],
        keyCodeMapper: function (oEvent) {
          oEvent.stopImmediatePropagation();
          return onScan.decodeKeyEvent(oEvent);
        },
        onScan: function (sCode) {
          // Immediate addition to cart without condition
          vm.trigger_onscan(sCode);
        },
      });
    },

    trigger_onscan(sCode) {
      // Direct barcode processing using existing working method
      this.process_barcode(sCode);
    },
  },

  created: function () {
    this.$nextTick(function () {});
    evntBus.on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      // Set customer without triggering watcher for first time
      this._suppressCustomerWatcher = true;
      this.customer =
        this.pos_profile && this.pos_profile.customer ? this.pos_profile.customer : this.customer;
      this.get_items();
      this.get_items_groups();
      this.items_view = this.pos_profile.posa_default_card_view ? 'card' : 'list';
    });
    // Removed: This was causing infinite recursion
    // evntBus.on("update_cur_items_details", () => {
    //   this.update_items_details(this.filtred_items);
    // });
    evntBus.on('update_offers_counters', (data) => {
      this.offersCount = data.offersCount;
      this.appliedOffersCount = data.appliedOffersCount;
    });
    evntBus.on('update_customer_price_list', (data) => {
      this.customer_price_list = data;
    });
    evntBus.on('update_customer', (data) => {
      this.customer = data;
    });
  },

  // ===== SECTION 6: LIFECYCLE HOOKS =====
  mounted() {
    this.scan_barcode();
    // Calculate scrollable area as soon as the card renders
    this.scheduleScrollHeightUpdate();
    window.addEventListener('resize', this.scheduleScrollHeightUpdate);
  },

  // Add beforeUnmount to clean up memory
  beforeUnmount() {
    // Clear timer
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
    }

    // Clean up event listeners
    evntBus.$off('register_pos_profile');
    evntBus.$off('update_cur_items_details');
    evntBus.$off('update_offers_counters');
    evntBus.$off('update_customer_price_list');
    evntBus.$off('update_customer');

    // Remove window listener
    window.removeEventListener('resize', this.scheduleScrollHeightUpdate);
  },
};
