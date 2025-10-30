// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../bus';
// Import cache manager utility
(function () {
  if (window.clearCacheAndReload) return;
  window.clearCacheAndReload = function () {
    try {
      localStorage.clear();
    } catch (_) {
      try {
        Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      } catch (_) {}
    }
    try {
      sessionStorage.clear();
    } catch (_) {}
    try {
      location.reload(true);
    } catch (_) {
      location.reload();
    }
  };
})();
import { API_MAP } from '../api_mapper.js';

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
  // components: {MyPopup},
  // ===== SECTION 3: DATA =====
  data() {
    return {
      drawer: false,
      mini: true,
      item: 0,
      items: [{ text: 'POS', icon: 'mdi-network-pos' }],
      page: '',
      fav: true,
      menu: false,
      showMenu: false,
      message: false,
      hints: true,
      menu_item: 0,
      snack: false,
      snackColor: '',
      snackText: '',
      company_name: '',
      pos_profile: '',
      freeze: false,
      freezeTitle: '',
      freezeMsg: '',
      last_invoice: '',
      invoice_doc: null,
      pos_opening_shift: null,
      shift_invoice_count: 0,
      // Ping variables
      pingTime: '000',
      pingInterval: null,
      // Payment totals
      totalCash: 0,
      totalNonCash: 0,
      // Quick return mode
      quick_return_value: false,
    };
  },
  computed: {
    invoiceNumberText() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Check current mode
        if (this.invoice_doc?.is_return) {
          return 'Return_Invoice_Mode';
        }
        if (this.quick_return_value) {
          return 'Quick_Return_Mode';
        }
        return 'Sales_Invoice_Mode';
      }
      return this.invoice_doc.name;
    },
    invoiceNumberClass() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Check current mode for class
        if (this.invoice_doc?.is_return) {
          return 'return-invoice-mode';
        }
        if (this.quick_return_value) {
          return 'quick-return-mode';
        }
        return 'sales-invoice-mode';
      }
      return this.invoice_doc.is_return ? 'return-invoice' : 'regular-invoice';
    },
    invoiceIconColor() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Check current mode for color
        if (this.invoice_doc?.is_return) {
          return '#757575'; // Grey for Return Invoice Mode
        }
        if (this.quick_return_value) {
          return '#9c27b0'; // Purple for Quick Return Mode
        }
        return '#4caf50'; // Green for Sales Invoice Mode
      }
      return this.invoice_doc.is_return ? 'error' : 'primary';
    },
    shiftNumberText() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'Shift not opened yet';
      }
      return this.pos_opening_shift.name;
    },
    shiftNumberClass() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'no-shift';
      }
      return this.pos_opening_shift.status === 'Open' ? 'open-shift' : 'closed-shift';
    },
    shiftIconColor() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'grey';
      }
      return this.pos_opening_shift.status === 'Open' ? 'success' : 'warning';
    },
    currentUserName() {
      return frappe.session.user || 'Unknown User';
    },
    shiftStartText() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'Not opened';
      }
      if (!this.pos_opening_shift.period_start_date) {
        return 'Unknown';
      }
      const startDate = new Date(this.pos_opening_shift.period_start_date);
      const timeString = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${timeString}`;
    },
    shiftStartClass() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'no-shift-start';
      }
      return this.pos_opening_shift.status === 'Open' ? 'open-shift-start' : 'closed-shift-start';
    },
    shiftStartIconColor() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return 'grey';
      }
      return this.pos_opening_shift.status === 'Open' ? 'success' : 'warning';
    },
    totalInvoicesQty() {
      // Get total invoices count for current shift
      if (!this.pos_opening_shift || !this.pos_opening_shift.name || !this.pos_profile) {
        return '000';
      }
      return this.shift_invoice_count || '000';
    },
    // Ping computed properties
    pingClass() {
      const ping = parseInt(this.pingTime);
      if (ping < 100) return 'ping-excellent';
      if (ping < 300) return 'ping-good';
      if (ping < 500) return 'ping-fair';
      return 'ping-poor';
    },
    pingIconColor() {
      const ping = parseInt(this.pingTime);
      if (ping < 100) return 'success';
      if (ping < 300) return 'primary';
      if (ping < 500) return 'warning';
      return 'error';
    },
  },
  // ===== SECTION 3.5: WATCHERS =====
  watch: {
    showMenu(newVal, oldVal) {
      // Menu visibility watcher - cleaned up debug logs
    },
  },
  // ===== SECTION 4: METHODS =====
  methods: {
    // Format currency values
    formatCurrency(value) {
      // Handle null, undefined or NaN values
      if (value === null || value === undefined || isNaN(value)) {
        value = 0;
      }

      // Convert to number if it's a string
      if (typeof value === 'string') {
        value = parseFloat(value) || 0;
      }

      // Format the number with comma separators and 2 decimal places
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    // Fetch payment totals
    fetchPaymentTotals() {
      // Fetch cash total
      frappe.call({
        method: API_MAP.POS_CLOSING_SHIFT.GET_CURRENT_CASH_TOTAL,
        callback: (r) => {
          if (r.message && r.message.total !== undefined && r.message.total !== null) {
            this.totalCash = parseFloat(r.message.total) || 0;
          } else {
            this.totalCash = 0;
          }
        },
        error: (err) => {
          console.error('Error fetching cash total:', err);
          this.totalCash = 0;
        },
      });

      // Fetch non-cash total
      frappe.call({
        method: API_MAP.POS_CLOSING_SHIFT.GET_CURRENT_NON_CASH_TOTAL,
        callback: (r) => {
          if (r.message && r.message.total !== undefined && r.message.total !== null) {
            this.totalNonCash = parseFloat(r.message.total) || 0;
          } else {
            this.totalNonCash = 0;
          }
        },
        error: (err) => {
          console.error('Error fetching non-cash total:', err);
          this.totalNonCash = 0;
        },
      });
    },

    // Set up interval to periodically update payment totals
    setupCashUpdateInterval() {
      // Clear existing interval if any
      if (this.cashUpdateInterval) {
        clearInterval(this.cashUpdateInterval);
      }

      // Fetch initial totals
      this.fetchPaymentTotals();

      // Set up interval to update totals (every 5 minutes)
      this.cashUpdateInterval = setInterval(() => {
        this.fetchPaymentTotals();
      }, 300000); // 5 minutes in milliseconds
    },

    changePage(key) {
      this.$emit('changePage', key);
    },
    toggleMenu() {
      this.showMenu = !this.showMenu;

      // Add click outside handler when menu opens
      if (this.showMenu) {
        // Use setTimeout to avoid catching the same click that opened the menu
        setTimeout(() => {
          document.addEventListener('click', this.handleClickOutside);
        }, 50);

        // Position menu to stay within viewport
        this.$nextTick(() => {
          // Safely get the root element
          const root =
            this.$el instanceof HTMLElement
              ? this.$el
              : this.$el && this.$el.$el instanceof HTMLElement
                ? this.$el.$el
                : null;

          if (!root) return;

          const menuElement = root.querySelector('.dropdown-menu');
          const menuButton = root.querySelector('.menu-btn');

          if (menuElement && menuButton) {
            const buttonRect = menuButton.getBoundingClientRect();
            const menuWidth = 200; // min-width from CSS
            const viewportWidth = window.innerWidth;

            // Check if menu would overflow on the right
            if (buttonRect.right < menuWidth) {
              // Not enough space on right, align to left edge of button
              menuElement.style.right = 'auto';
              menuElement.style.left = '0';
            } else {
              // Enough space, keep right alignment
              menuElement.style.right = '0';
              menuElement.style.left = 'auto';
            }
          }
        });
      } else {
        document.removeEventListener('click', this.handleClickOutside);
      }
    },
    handleClickOutside(event) {
      try {
        // Safely get the root element
        const root =
          this.$el instanceof HTMLElement
            ? this.$el
            : this.$el && this.$el.$el instanceof HTMLElement
              ? this.$el.$el
              : null;

        if (!root) return;

        // Check if click is outside the menu wrapper
        const menuWrapper = root.querySelector('.menu-wrapper');
        if (menuWrapper && !menuWrapper.contains(event.target)) {
          this.showMenu = false;
          document.removeEventListener('click', this.handleClickOutside);
        }
      } catch (err) {
        // Non-fatal error, just close the menu
        this.showMenu = false;
        document.removeEventListener('click', this.handleClickOutside);
        console.warn('handleClickOutside error:', err);
      }
    },
    go_desk() {
      frappe.set_route('/');
      location.reload();
    },
    go_about() {
      // this.showMenu = false; // Close menu after action
      // const win = window.open("https://github.com/abdopcnet", "_blank");
      // win.focus();

      this.show_mesage({
        color: 'info',
        text: 'POSAwesome Lite v15 - Local System',
      });
    },
    close_shift_dialog() {
      this.showMenu = false; // Close menu after action
      evntBus.emit('open_closing_dialog');
    },
    show_mesage(data) {
      this.snack = true;
      this.snackColor = data.color;
      this.snackText = data.text;

      // Auto-hide snackbar after 4 seconds
      setTimeout(() => {
        this.snack = false;
      }, 4000);
    },
    logOut() {
      this.showMenu = false; // Close menu after action
      var me = this;
      me.logged_out = true;
      return frappe.call({
        method: 'logout',
        callback: function (r) {
          if (r.exc) {
            return;
          }
          // Instead of automatic reload, let the user manually reload
          me.show_mesage({
            color: 'info',
            text: 'Logged out successfully. Click to reload.',
          });
          // Only reload when user clicks on the message
          document.querySelector('.snackbar').addEventListener('click', function () {
            frappe.set_route('/login');
            location.reload();
          });
        },
      });
    },
    print_last_invoice() {
      if (!this.last_invoice) {
        return;
      }
      const print_format =
        this.pos_profile.print_format_for_online || this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        '/printview?doctype=Sales%20Invoice&name=' +
        this.last_invoice +
        '&trigger_print=1' +
        '&format=' +
        print_format +
        '&no_letterhead=' +
        letter_head;
      const printWindow = window.open(url, 'Print');
      printWindow.addEventListener(
        'load',
        function () {
          printWindow.print();
        },
        true,
      );
    },
    fetch_company_info() {
      if (this.pos_profile && this.pos_profile.company) {
        frappe.db
          .get_doc('Company', this.pos_profile.company)
          .then((company_doc) => {
            this.company_name = company_doc.company_name;
          })
          .catch(() => {
            // Error fetching company info
          });
      }
    },
    async clearCache() {
      try {
        // Show loading message
        this.show_mesage({
          color: 'info',
          text: 'Clearing cache...',
        });

        // Use the comprehensive cache manager
        if (window.clearCacheAndReload) {
          await window.clearCacheAndReload();

          this.show_mesage({
            color: 'success',
            text: 'Cache cleared successfully. Reloading...',
          });

          // Reload page after short delay
          setTimeout(() => {
            location.reload();
          }, 1000);
        } else {
          // Fallback to basic cache clearing
          localStorage.clear();
          sessionStorage.clear();

          this.show_mesage({
            color: 'success',
            text: 'Basic cache cleared. Reloading...',
          });

          setTimeout(() => {
            location.reload();
          }, 1000);
        }
      } catch (error) {
        this.show_mesage({
          color: 'error',
          text: 'Error clearing cache: ' + error.message,
        });
      }
    },
    async fetchShiftInvoiceCount() {
      if (!this.pos_profile || !this.pos_opening_shift) {
        return;
      }

      try {
        const response = await frappe.call({
          method: API_MAP.POS_OPENING_SHIFT.GET_USER_SHIFT_INVOICE_COUNT,
          args: {
            pos_profile: this.pos_profile.name,
            pos_opening_shift: this.pos_opening_shift.name,
          },
        });

        if (response.message !== undefined) {
          this.shift_invoice_count = response.message;
        }
      } catch (error) {
        this.shift_invoice_count = 0;
      }
    },
    // Ping methods
    async measurePing() {
      // Skip if connection issues might cause a reload
      if (navigator.onLine === false) {
        this.pingTime = '999';
        return;
      }

      const startTime = performance.now();
      try {
        await frappe.call({
          method: 'frappe.ping',
          args: {},
          callback: () => {
            const endTime = performance.now();
            const ping = Math.round(endTime - startTime);
            this.pingTime = ping.toString().padStart(3, '0');
          },
          error: () => {
            // Silently handle error without triggering page reload
            this.pingTime = '999';
          },
          freeze: false, // Don't freeze the UI
          show_spinner: false, // Don't show spinner
          async: true, // Make sure it's async
        });
      } catch (error) {
        // Capture error without allowing it to affect the application
        this.pingTime = '999';
      }
    },
    startPingMonitoring() {
      // Safety check - if already monitoring, don't start another interval
      if (this.pingInterval) {
        return;
      }

      // Track that we're running (for visibility change handler)
      this._wasRunningBeforeHidden = true;

      // Initial ping
      this.measurePing();

      // Set up interval for continuous monitoring (every 5 seconds)
      this.pingInterval = setInterval(() => {
        this.measurePing();
      }, 5000);
    },
    stopPingMonitoring() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
        // Track that monitoring is stopped
        this._wasRunningBeforeHidden = false;
      }
    },

    // Toggle ping monitoring (can be called via evntBus)
    togglePingMonitoring(enable) {
      if (enable) {
        sessionStorage.setItem('pos_enable_ping_monitoring', 'true');
        this.startPingMonitoring();
      } else {
        sessionStorage.setItem('pos_enable_ping_monitoring', 'false');
        this.stopPingMonitoring();
      }
    },

    // Inline-hover helpers for badges (mutates inline styles only, fast & scoped)
    badgeMouseEnter(e) {
      try {
        const el = e.currentTarget;
        // store original border color for restore
        el.dataset._origBorder = el.style.borderColor || getComputedStyle(el).borderColor || '';
        // subtle hover visual (no translate)
        el.style.boxShadow = '0 6px 18px rgba(12, 24, 40, 0.06)';
        el.style.filter = 'brightness(1.03)';
        el.style.borderColor = 'rgba(0,0,0,0.08)';
      } catch (err) {
        // non-fatal - avoid console spam in production
        console.warn && console.warn('badgeMouseEnter error', err);
      }
    },

    badgeMouseLeave(e) {
      try {
        const el = e.currentTarget;
        // restore original properties
        el.style.boxShadow = '';
        el.style.filter = '';
        if (el.dataset._origBorder !== undefined) {
          el.style.borderColor = el.dataset._origBorder;
          delete el.dataset._origBorder;
        } else {
          el.style.borderColor = '';
        }
      } catch (err) {
        console.warn && console.warn('badgeMouseLeave error', err);
      }
    },
  },
  created: function () {
    this.$nextTick(function () {
      try {
        // Check if ping monitoring should be enabled
        // We can add a global setting to control this
        const enablePingMonitoring =
          sessionStorage.getItem('pos_enable_ping_monitoring') !== 'false';

        if (enablePingMonitoring) {
          // Start ping monitoring
          this.startPingMonitoring();
        }

        // Add page visibility handler to pause/resume ping monitoring for bfcache compatibility
        // Modified to prevent automatic reloads
        this.handleVisibilityChange = () => {
          if (document.hidden) {
            this.stopPingMonitoring();
          } else {
            // Only restart monitoring if it was previously running
            if (this._wasRunningBeforeHidden) {
              this.startPingMonitoring();
            }
          }
        };
        // Track ping monitor state before hiding
        this._wasRunningBeforeHidden = true;
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        evntBus.on('show_mesage', (data) => {
          this.show_mesage(data);
        });
        evntBus.on('set_company', (data) => {
          this.company_name = data.name;
        });
        evntBus.on('register_pos_profile', (data) => {
          this.pos_profile = data.pos_profile;
          this.pos_opening_shift = data.pos_opening_shift;
          this.fetch_company_info();
          this.fetchShiftInvoiceCount();
          this.fetchPaymentTotals(); // Fetch payment totals when POS profile is registered
          // External payments screen disabled - removed payments option
        });
        evntBus.on('set_last_invoice', (data) => {
          this.last_invoice = data;
        });
        evntBus.on('toggle_quick_return', (value) => {
          this.quick_return_value = value;
        });
        evntBus.on('update_invoice_doc', (data) => {
          this.invoice_doc = data;
        });
        evntBus.on('set_pos_opening_shift', (data) => {
          this.pos_opening_shift = data;
          this.fetchShiftInvoiceCount();
          this.fetchPaymentTotals(); // Fetch payment totals when shift is opened
        });
        evntBus.on('register_pos_data', (data) => {
          this.pos_opening_shift = data.pos_opening_shift;
          this.fetchPaymentTotals(); // Fetch payment totals when POS data is registered
        });
        evntBus.on('invoice_submitted', () => {
          // Refresh invoice count when a new invoice is submitted
          // Add delay to wait for background job to complete
          setTimeout(() => {
            this.fetchShiftInvoiceCount();
            this.fetchPaymentTotals(); // Update payment totals after invoice submission
          }, 2000); // Wait 2 seconds for background job
        });
        evntBus.on('freeze', (data) => {
          this.freeze = true;
          this.freezeTitle = data.title;
          this.freezeMsg = data.msg;
        });
        evntBus.on('unfreeze', () => {
          this.freeze = false;
          this.freezTitle = '';
          this.freezeMsg = '';
        });

        // Add event listener for toggling ping monitoring
        evntBus.on('toggle_ping_monitoring', (enable) => {
          this.togglePingMonitoring(enable);
        });
      } catch (error) {
        this.show_mesage({
          color: 'error',
          text: 'An error occurred while loading the menu.',
        });
      }
    });
  },
  beforeUnmount() {
    // Clean up ping monitoring
    this.stopPingMonitoring();

    // Clean up click outside listener
    document.removeEventListener('click', this.handleClickOutside);

    // Clean up page visibility listener
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // Clean up payment totals interval
    if (this.cashUpdateInterval) {
      clearInterval(this.cashUpdateInterval);
      this.cashUpdateInterval = null;
    }

    // Clean up all event listeners
    evntBus.off('show_mesage');
    evntBus.off('set_company');
    evntBus.off('register_pos_profile');
    evntBus.off('set_last_invoice');
    evntBus.off('update_invoice_doc');
    evntBus.off('set_pos_opening_shift');
    evntBus.off('register_pos_data');
    evntBus.off('invoice_submitted');
    evntBus.off('freeze');
    evntBus.off('unfreeze');
    evntBus.off('toggle_ping_monitoring');
  },
};
