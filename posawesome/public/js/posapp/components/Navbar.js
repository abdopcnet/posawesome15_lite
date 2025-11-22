// ===== SECTION 1: IMPORTS =====
import { evntBus } from "../bus";
// Frontend logging: Use console.log/error/warn directly
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
import { API_MAP } from "../api_mapper.js";

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
  // components: {MyPopup},
  // ===== SECTION 3: DATA =====
  data() {
    return {
      drawer: false,
      mini: true,
      item: 0,
      items: [{ text: "POS", icon: "mdi-network-pos" }],
      page: "",
      fav: true,
      message: false,
      hints: true,
      snack: false,
      snackColor: "",
      snackText: "",
      company_name: "",
      pos_profile: "",
      freeze: false,
      freezeTitle: "",
      freezeMsg: "",
      last_invoice: "",
      invoice_doc: null,
      pos_opening_shift: null,
      shift_invoice_count: 0,
      // Ping variables
      pingTime: "000",
      pingInterval: null,
      // Payment totals
      totalCash: 0,
      totalNonCash: 0,
      // Quick return mode
      quick_return_value: false,
      // Connection state tracking
      wasConnectionLost: false,
      // Shift monitoring
      shiftMonitoringInterval: null,
    };
  },
  computed: {
    invoiceNumberText() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Prefer quick return mode when active
        if (this.quick_return_value) {
          return "Quick_Return";
        }
        if (this.invoice_doc?.is_return) {
          return "Return_Invoice";
        }
        return "Sales_Mode";
      }
      // When an invoice exists, still reflect mode by flags
      if (this.quick_return_value) return "Quick_Return";
      if (this.invoice_doc?.is_return) return "Return_Invoice";
      return "Sales_Mode";
    },
    invoiceNumberClass() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Prefer quick return mode when active
        if (this.quick_return_value) {
          return "quick-return-mode";
        }
        if (this.invoice_doc?.is_return) {
          return "return-invoice-mode";
        }
        return "sales-invoice-mode";
      }
      return this.invoice_doc.is_return ? "return-invoice" : "regular-invoice";
    },
    invoiceIconColor() {
      if (!this.invoice_doc || !this.invoice_doc.name) {
        // Prefer quick return mode when active
        if (this.quick_return_value) {
          return "#9c27b0"; // Purple for Quick Return Mode
        }
        if (this.invoice_doc?.is_return) {
          return "#607d8b"; // Blue-grey for Return Invoice Mode (same as return button)
        }
        return "#4caf50"; // Green for Sales Invoice Mode
      }
      // Use hex colors even when invoice exists
      if (this.quick_return_value) return "#9c27b0";
      return this.invoice_doc.is_return ? "#607d8b" : "#4caf50";
    },
    shiftNumberText() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "Shift not opened yet";
      }
      return this.pos_opening_shift.name;
    },
    shiftNumberClass() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "no-shift";
      }
      return this.pos_opening_shift.status === "Open"
        ? "open-shift"
        : "closed-shift";
    },
    shiftIconColor() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "#757575";
      }
      return this.pos_opening_shift.status === "Open" ? "#4caf50" : "#ff9800";
    },
    currentUserName() {
      return frappe.session.user || "Unknown User";
    },
    shiftStartText() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "Not opened";
      }
      if (!this.pos_opening_shift.period_start_date) {
        return "Unknown";
      }
      const startDate = new Date(this.pos_opening_shift.period_start_date);
      const timeString = startDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${timeString}`;
    },
    shiftStartClass() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "no-shift-start";
      }
      return this.pos_opening_shift.status === "Open"
        ? "open-shift-start"
        : "closed-shift-start";
    },
    shiftStartIconColor() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return "#757575";
      }
      return this.pos_opening_shift.status === "Open" ? "#4caf50" : "#ff9800";
    },
    totalInvoicesQty() {
      // Get total invoices count for current shift
      if (
        !this.pos_opening_shift ||
        !this.pos_opening_shift.name ||
        !this.pos_profile
      ) {
        return "000";
      }
      return this.shift_invoice_count || "000";
    },
    // Ping computed properties
    pingClass() {
      const ping = parseInt(this.pingTime);
      if (ping < 100) return "ping-excellent";
      if (ping < 300) return "ping-good";
      if (ping < 500) return "ping-fair";
      return "ping-poor";
    },
    pingIconColor() {
      const ping = parseInt(this.pingTime);
      if (ping < 100) return "#4caf50";
      if (ping < 300) return "#1976d2";
      if (ping < 500) return "#ff9800";
      return "#f44336";
    },
  },
  // ===== SECTION 3.5: WATCHERS =====
  watch: {},
  // ===== SECTION 4: METHODS =====
  methods: {
    // Format currency values
    formatCurrency(value) {
      // Handle null, undefined or NaN values
      if (value === null || value === undefined || isNaN(value)) {
        value = 0;
      }

      // Convert to number if it's a string
      if (typeof value === "string") {
        value = parseFloat(value) || 0;
      }

      // Format the number with comma separators and 2 decimal places
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    // Fetch payment totals (optimized: single API call instead of two)
    fetchPaymentTotals() {
      // Only fetch if we have pos_profile
      if (!this.pos_profile || !this.pos_profile.name) {
        this.totalCash = 0;
        this.totalNonCash = 0;
        return;
      }

      // Fetch both totals in one API call (optimized for performance)
      frappe.call({
        method: API_MAP.POS_CLOSING_SHIFT.GET_PAYMENT_TOTALS,
        args: {
          pos_profile: this.pos_profile.name,
          user: frappe.session.user,
        },
        callback: (r) => {
          if (r.message) {
            this.totalCash = parseFloat(r.message.cash_total || 0) || 0;
            this.totalNonCash = parseFloat(r.message.non_cash_total || 0) || 0;
            console.log("[Navbar.js] Cash total:", this.totalCash, "Non-cash total:", this.totalNonCash);
          } else {
            this.totalCash = 0;
            this.totalNonCash = 0;
          }
        },
        error: (err) => {
          this.totalCash = 0;
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

      // Set up interval to update totals (every 30 seconds for real-time accuracy)
      this.cashUpdateInterval = setInterval(() => {
        this.fetchPaymentTotals();
      }, 30000); // 30 seconds in milliseconds
    },

    changePage(key) {
      this.$emit("changePage", key);
    },
    go_desk() {
      frappe.set_route("/");
      location.reload();
    },
    close_shift_dialog() {
      evntBus.emit("open_closing_dialog");
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
      var me = this;
      me.logged_out = true;
      return frappe.call({
        method: "logout",
        callback: function (r) {
          if (r.exc) {
            return;
          }
          // Instead of automatic reload, let the user manually reload
          me.show_mesage({
            color: "info",
            text: "Logged out successfully. Click to reload.",
          });
          // Only reload when user clicks on the message
          document
            .querySelector(".snackbar")
            .addEventListener("click", function () {
              frappe.set_route("/login");
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
        this.pos_profile.print_format_for_online ||
        this.pos_profile.posa_print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        this.last_invoice +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
        },
        true
      );
    },
    fetch_company_info() {
      if (this.pos_profile && this.pos_profile.company) {
        frappe.db
          .get_doc("Company", this.pos_profile.company)
          .then((company_doc) => {
            this.company_name = company_doc.company_name;
          })
          .catch((err) => {
            // Error fetching company info
          });
      }
    },
    async clearCache() {
      try {
        // Show loading message
        this.show_mesage({
          color: "info",
          text: "Clearing cache...",
        });

        // Use the comprehensive cache manager
        if (window.clearCacheAndReload) {
          await window.clearCacheAndReload();

          this.show_mesage({
            color: "success",
            text: "Cache cleared successfully. Reloading...",
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
            color: "success",
            text: "Basic cache cleared. Reloading...",
          });

          setTimeout(() => {
            location.reload();
          }, 1000);
        }
      } catch (error) {
        this.show_mesage({
          color: "error",
          text: "Error clearing cache: " + error.message,
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
    measurePing() {
      // Check if browser reports offline
      if (!navigator.onLine) {
        this.pingTime = "999";
        if (!this.wasConnectionLost) {
          this.wasConnectionLost = true;
          this.show_mesage({
            color: "error",
            text: "الاتصال بالإنترنت مفصول",
          });
        }
        return;
      }

      const startTime = performance.now();
      let timeoutId = null;
      let isResolved = false;

      // Timeout: 1 second to detect no response
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.pingTime = "999";
          
          if (!this.wasConnectionLost) {
            this.wasConnectionLost = true;
            this.show_mesage({
              color: "error",
              text: "الاتصال بالإنترنت مفصول",
            });
          }
        }
      }, 1000);

      frappe.call({
        method: API_MAP.POSAWESOME.PING,
        args: {},
        callback: (r) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          if (isResolved) return;
          isResolved = true;

          const endTime = performance.now();
          const ping = Math.round(endTime - startTime);
          this.pingTime = ping.toString().padStart(3, "0");

          // If ping > 1000ms, show weak connection message
          if (ping > 1000) {
            this.show_mesage({
              color: "warning",
              text: "الاتصال بالإنترنت ضعيف جدا",
            });
          }

          // If connection was lost before and now it's back
          if (this.wasConnectionLost) {
            this.wasConnectionLost = false;
            this.show_mesage({
              color: "success",
              text: "تم رجوع الاتصال بالإنترنت",
            });
          }
        },
        error: (err) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          if (isResolved) return;
          isResolved = true;

          this.pingTime = "999";
          
          if (!this.wasConnectionLost) {
            this.wasConnectionLost = true;
            this.show_mesage({
              color: "error",
              text: "الاتصال بالإنترنت مفصول",
            });
          }
        },
        freeze: false,
        show_spinner: false,
        async: true,
      });
    },
    startPingMonitoring() {
      if (this.pingInterval) {
        return;
      }

      this._wasRunningBeforeHidden = true;

      // Initial ping
      this.measurePing();

      // Ping every 2 seconds
      this.pingInterval = setInterval(() => {
        this.measurePing();
      }, 2000);
    },
    stopPingMonitoring() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
        // Track that monitoring is stopped
        this._wasRunningBeforeHidden = false;
      }
    },
    // Shift monitoring methods
    checkShiftStatus() {
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return;
      }

      frappe.call({
        method: API_MAP.POS_OPENING_SHIFT.GET_CURRENT_SHIFT_NAME,
        args: {},
        callback: (r) => {
          if (r.message && r.message.success && r.message.data) {
            const currentShift = r.message.data;
            // Check if current shift matches our shift
            // Note: get_current_shift_name only returns open shifts, so if we get data, it's open
            if (currentShift.name !== this.pos_opening_shift.name) {
              // Shift was changed (different shift opened)
              this.show_mesage({
                color: "error",
                text: "تم تغيير الوردية. سيتم إعادة تحميل الصفحة...",
              });
              
              // Reload after short delay
              setTimeout(() => {
                if (window.clearCacheAndReload) {
                  window.clearCacheAndReload();
                } else {
                  location.reload();
                }
              }, 2000);
            }
            // If names match, shift is still open - do nothing
          } else {
            // No active shift found - shift was closed
            this.show_mesage({
              color: "error",
              text: "تم إغلاق الوردية. سيتم إعادة تحميل الصفحة...",
            });
            
            setTimeout(() => {
              if (window.clearCacheAndReload) {
                window.clearCacheAndReload();
              } else {
                location.reload();
              }
            }, 2000);
          }
        },
        error: (err) => {
          // On error, don't reload - might be network issue
          console.log("[Navbar.js] checkShiftStatus error:", err);
        },
        freeze: false,
        show_spinner: false,
        async: true,
      });
    },
    startShiftMonitoring() {
      if (this.shiftMonitoringInterval) {
        return;
      }

      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
        return;
      }

      // Check immediately
      this.checkShiftStatus();

      // Check every 3 seconds
      this.shiftMonitoringInterval = setInterval(() => {
        this.checkShiftStatus();
      }, 3000);
    },
    stopShiftMonitoring() {
      if (this.shiftMonitoringInterval) {
        clearInterval(this.shiftMonitoringInterval);
        this.shiftMonitoringInterval = null;
      }
    },

    // Toggle ping monitoring (can be called via evntBus)
    togglePingMonitoring(enable) {
      if (enable) {
        sessionStorage.setItem("pos_enable_ping_monitoring", "true");
        this.startPingMonitoring();
      } else {
        sessionStorage.setItem("pos_enable_ping_monitoring", "false");
        this.stopPingMonitoring();
      }
    },

    // Inline-hover helpers for badges (mutates inline styles only, fast & scoped)
    badgeMouseEnter(e) {
      try {
        const el = e.currentTarget;
        // store original border color for restore
        el.dataset._origBorder =
          el.style.borderColor || getComputedStyle(el).borderColor || "";
        // subtle hover visual (no translate)
        el.style.boxShadow = "0 6px 18px rgba(12, 24, 40, 0.06)";
        el.style.filter = "brightness(1.03)";
        el.style.borderColor = "rgba(0,0,0,0.08)";
      } catch (err) {
      }
    },

    badgeMouseLeave(e) {
      try {
        const el = e.currentTarget;
        // restore original properties
        el.style.boxShadow = "";
        el.style.filter = "";
        if (el.dataset._origBorder !== undefined) {
          el.style.borderColor = el.dataset._origBorder;
          delete el.dataset._origBorder;
        } else {
          el.style.borderColor = "";
        }
      } catch (err) {
      }
    },
  },
  created: function () {
    this.$nextTick(function () {
      try {
        // Check if ping monitoring should be enabled
        // We can add a global setting to control this
        const enablePingMonitoring =
          sessionStorage.getItem("pos_enable_ping_monitoring") !== "false";

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
        document.addEventListener(
          "visibilitychange",
          this.handleVisibilityChange
        );

        // Listen to online/offline events for immediate response
        this.handleOnline = () => {
          if (this.wasConnectionLost) {
            this.wasConnectionLost = false;
            this.show_mesage({
              color: "success",
              text: "تم رجوع الاتصال بالإنترنت",
            });
          }
          // Restart ping monitoring if it stopped
          if (!this.pingInterval) {
            this.startPingMonitoring();
          } else {
            // Trigger immediate ping
            this.measurePing();
          }
        };

        this.handleOffline = () => {
          this.pingTime = "999";
          if (!this.wasConnectionLost) {
            this.wasConnectionLost = true;
            this.show_mesage({
              color: "error",
              text: "الاتصال بالإنترنت مفصول",
            });
          }
        };

        window.addEventListener("online", this.handleOnline);
        window.addEventListener("offline", this.handleOffline);

        evntBus.on("show_mesage", (data) => {
          this.show_mesage(data);
        });
        evntBus.on("set_company", (data) => {
          this.company_name = data.name;
        });
        evntBus.on("register_pos_profile", (data) => {
          this.pos_profile = data.pos_profile;
          this.pos_opening_shift = data.pos_opening_shift;
          this.fetch_company_info();
          this.fetchShiftInvoiceCount();
          this.setupCashUpdateInterval(); // Start auto-refresh interval when POS loads
          this.startShiftMonitoring(); // Start shift monitoring when POS profile is registered
          // External payments screen disabled - removed payments option
        });
        evntBus.on("set_last_invoice", (data) => {
          this.last_invoice = data;
        });
        evntBus.on("toggle_quick_return", (value) => {
          this.quick_return_value = value;
        });
        evntBus.on("update_invoice_doc", (data) => {
          this.invoice_doc = data;
        });
        evntBus.on("set_pos_opening_shift", (data) => {
          this.pos_opening_shift = data;
          this.fetchShiftInvoiceCount();
          this.setupCashUpdateInterval(); // Restart auto-refresh when shift changes
          // Start shift monitoring when shift is set
          this.startShiftMonitoring();
        });
        evntBus.on("register_pos_data", (data) => {
          if (data.pos_profile) {
            this.pos_profile = data.pos_profile;
          }
          if (data.pos_opening_shift) {
            this.pos_opening_shift = data.pos_opening_shift;
            console.log("[Navbar.js] Shift registered:", this.pos_opening_shift.name);
          }
          this.fetch_company_info();
          this.fetchShiftInvoiceCount();
          this.setupCashUpdateInterval(); // Start auto-refresh when POS data registered
          // Start shift monitoring when POS data is registered
          this.startShiftMonitoring();
        });
        evntBus.on("invoice_submitted", () => {
          // Refresh invoice count when a new invoice is submitted
          // Immediate refresh for payment totals (backend queries are fast)
          this.fetchPaymentTotals(); // Immediate update

          // Also schedule a delayed refresh to catch any async updates
          setTimeout(() => {
            this.fetchShiftInvoiceCount();
            this.fetchPaymentTotals(); // Update payment totals after invoice submission
          }, 1000); // Wait 1 second for any background processing
        });
        evntBus.on("freeze", (data) => {
          this.freeze = true;
          this.freezeTitle = data.title;
          this.freezeMsg = data.msg;
        });
        evntBus.on("unfreeze", () => {
          this.freeze = false;
          this.freezTitle = "";
          this.freezeMsg = "";
        });

        // Add event listener for toggling ping monitoring
        evntBus.on("toggle_ping_monitoring", (enable) => {
          this.togglePingMonitoring(enable);
        });
      } catch (error) {
        this.show_mesage({
          color: "error",
          text: "An error occurred while loading the menu.",
        });
      }
    });
  },
  beforeUnmount() {
    // Clean up ping monitoring
    this.stopPingMonitoring();

    // Clean up shift monitoring
    this.stopShiftMonitoring();

    // Clean up click outside listener
    document.removeEventListener("click", this.handleClickOutside);

    // Clean up page visibility listener
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );

    // Clean up online/offline listeners
    if (this.handleOnline) {
      window.removeEventListener("online", this.handleOnline);
    }
    if (this.handleOffline) {
      window.removeEventListener("offline", this.handleOffline);
    }

    // Clean up payment totals interval
    if (this.cashUpdateInterval) {
      clearInterval(this.cashUpdateInterval);
      this.cashUpdateInterval = null;
    }

    // Clean up all event listeners
    evntBus.off("show_mesage");
    evntBus.off("set_company");
    evntBus.off("register_pos_profile");
    evntBus.off("set_last_invoice");
    evntBus.off("update_invoice_doc");
    evntBus.off("set_pos_opening_shift");
    evntBus.off("register_pos_data");
    evntBus.off("invoice_submitted");
    evntBus.off("freeze");
    evntBus.off("unfreeze");
    evntBus.off("toggle_ping_monitoring");
  },
};
